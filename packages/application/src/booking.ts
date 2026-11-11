import type { HoldPending, RideEnvelope } from "@ride/contracts";
import { holdKey } from "@ride/domain";
import type { AuthedAccount } from "./auth.ts";
import { TxAbort, type Database, type Exec } from "./db.ts";
import { getEstimate } from "./estimates.ts";
import {
  insertProcessing,
  KeyConflictError,
  lookupKey,
  releaseKey,
  saveResult,
  settlePending,
  type KeyRef,
} from "./idempotency.ts";
import { changeMoneyOp, getPaymentRef, insertMoneyOp, type MoneyOpRow } from "./payments.ts";
import type { Clock, HoldOutcome, IdGenerator, Logger, PaymentGateway, TraceContext } from "./ports.ts";
import { ok, problem, type ApiResult } from "./result.ts";
import {
  changeRide,
  findActiveRide,
  hasUnpaidRide,
  insertBookingRide,
  toPassengerRide,
  type RideRow,
} from "./rides.ts";
import type { AppSettings } from "./settings.ts";

// 手配の確定（FR-05、CUJ-01-B）。DEC-12 の三つに分けたトランザクション: キーと処理中 → Stripe → 結果と状態と履歴。

export const bookingRouteId = "passenger.rides.create";

export interface MoneyDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  payments: PaymentGateway;
  logger: Logger;
  settings: AppSettings;
}

export interface BookingInput {
  account: AuthedAccount;
  idempotencyKey: string;
  requestHash: string;
  estimateId: string;
  paymentMethodId: string | null;
  trace: TraceContext;
}

export function operationInProgress(traceId: string): ApiResult {
  const result = problem("OPERATION_IN_PROGRESS", traceId, { retryAfterSeconds: 1 });
  return result;
}

export function replayOrConflict(lookup: Awaited<ReturnType<typeof lookupKey>>, traceId: string): ApiResult | null {
  if (lookup.kind === "replay") return lookup.result;
  if (lookup.kind === "in_progress") return operationInProgress(traceId);
  if (lookup.kind === "reused") return problem("IDEMPOTENCY_KEY_REUSED", traceId);
  return null;
}

export function logMoneyOp(
  logger: Logger,
  trace: TraceContext,
  op: MoneyOpRow,
  step: "processing" | "succeeded" | "failed" | "checking" | "settled",
  extra: Record<string, unknown> = {},
): void {
  logger.log({
    event: "money.op",
    severity: step === "failed" ? "WARNING" : "INFO",
    message: `money op ${op.kind} ${step}`,
    client_trace_id: trace.clientTraceId,
    "logging.googleapis.com/trace": trace.cloudTrace,
    "logging.googleapis.com/spanId": trace.spanId,
    ride_id: op.rideId,
    money_op_id: op.moneyOpId,
    kind: op.kind,
    step,
    idempotency_key: op.stripeIdempotencyKey,
    ...extra,
  });
}

export async function bookRide(deps: MoneyDeps, input: BookingInput): Promise<ApiResult> {
  const traceId = input.trace.clientTraceId;
  const accountId = input.account.accountId;
  const ref: KeyRef = { accountId, key: input.idempotencyKey };
  const early = replayOrConflict(await lookupKey(deps.db.client, ref, bookingRouteId, input.requestHash), traceId);
  if (early) return early;

  // 一つ目のトランザクションの前の断りはキーに残さない（何も書いていないので、同じキーで送り直すと初めからやり直す）。
  const estimate = await getEstimate(deps.db.client, accountId, input.estimateId);
  if (!estimate) return problem("NOT_FOUND", traceId);
  const paymentRef = await getPaymentRef(deps.db.client, accountId);
  const paymentMethodId = input.paymentMethodId ?? paymentRef?.defaultPaymentMethodId ?? null;
  if (!paymentRef || !paymentMethodId) return problem("PAYMENT_METHOD_REQUIRED", traceId);

  const now = deps.clock.now();
  const rideId = deps.ids.newId("ride");
  let ride: RideRow;
  let op: MoneyOpRow;
  try {
    ({ ride, op } = await deps.db.write(async (tx) => {
      if (await findActiveRide(tx, accountId)) throw new TxAbort(problem("ACTIVE_RIDE_EXISTS", traceId));
      if (await hasUnpaidRide(tx, accountId)) throw new TxAbort(problem("UNPAID_RIDE_EXISTS", traceId));
      const used = await tx.execute({
        sql: `UPDATE estimates SET used_by_ride_id = ?
              WHERE estimate_id = ? AND account_id = ? AND used_by_ride_id IS NULL AND expires_at > ?`,
        args: [rideId, estimate.estimateId, accountId, now.toISOString()],
      });
      if (used.rowsAffected !== 1) throw new TxAbort(problem("ESTIMATE_EXPIRED", traceId));
      const created = await insertBookingRide(tx, {
        rideId,
        passengerId: accountId,
        pickup: estimate.pickup,
        dropoff: estimate.dropoff,
        fareYen: estimate.fareTotal,
        eta: estimate.eta,
        threshold: null,
        estimateId: estimate.estimateId,
        testAccount: input.account.testAccount,
        now,
      });
      const hold = await insertMoneyOp(tx, {
        moneyOpId: deps.ids.newId("mop"),
        rideId,
        kind: "hold",
        seq: 1,
        attempt: 1,
        amount: estimate.fareTotal,
        stripeIdempotencyKey: holdKey(rideId, 1, 1),
        now,
      });
      await insertProcessing(tx, ref, bookingRouteId, input.requestHash, now, deps.settings.idemKeepMs, rideId);
      return { ride: created, op: hold };
    }));
  } catch (error) {
    if (error instanceof TxAbort) return error.result as ApiResult;
    if (error instanceof KeyConflictError) return operationInProgress(traceId);
    throw error;
  }
  logMoneyOp(deps.logger, input.trace, op, "processing", { account_id: accountId });

  const outcome = await deps.payments.createHold(
    {
      customerId: paymentRef.stripeCustomerId,
      paymentMethodId,
      amountYen: op.amount,
      idempotencyKey: op.stripeIdempotencyKey,
      metadata: {
        ride_id: rideId,
        money_op_id: op.moneyOpId,
        op_kind: "hold",
        hold_seq: String(op.seq),
        attempt: String(op.attempt),
      },
    },
    input.trace,
  );
  return applyBookingOutcome(deps, input.trace, ride, op, outcome, ref, input.account.accountId);
}

async function applyBookingOutcome(
  deps: MoneyDeps,
  trace: TraceContext,
  ride: RideRow,
  op: MoneyOpRow,
  outcome: HoldOutcome,
  ref: KeyRef,
  actorId: string,
): Promise<ApiResult> {
  const now = deps.clock.now();
  const traceId = trace.clientTraceId;
  switch (outcome.kind) {
    case "succeeded":
      return deps.db.write(async (tx) => {
        const result = await confirmHold(tx, deps, trace, ride, op, outcome.paymentIntentId, actorId, now);
        await saveResult(tx, ref, "completed", result);
        return result;
      });
    case "declined":
      return deps.db.write(async (tx) => {
        const result = await failHold(tx, deps, trace, ride, op, outcome.code, actorId, now);
        await saveResult(tx, ref, "completed", result);
        return result;
      });
    case "not_executed":
      return deps.db.write(async (tx) => {
        const after = await changeMoneyOp(tx, op, { status: "not_happened", errorCode: outcome.reason }, now);
        await changeRide(
          tx,
          deps.ids,
          ride,
          { state: "not_booked", paymentStatus: "none" },
          { type: "not_booked", actorKind: "passenger", actorId, details: { reason: "payments_unavailable" }, traceId },
          now,
        );
        await releaseKey(tx, ref);
        // 起きていないと扱うので、見積もりの使用も戻す。設計（DEC-48、DEC-52）は依頼とキーだけを書き、見積もりを書いていない。
        // 戻さないと「同じキーで初めからやり直す」が 409 ESTIMATE_EXPIRED で断られる。
        await tx.execute({
          sql: "UPDATE estimates SET used_by_ride_id = NULL WHERE estimate_id = ? AND used_by_ride_id = ?",
          args: [ride.estimateId, ride.rideId],
        });
        logMoneyOp(deps.logger, trace, after, "settled", { outcome: "not_happened" });
        return problem("PAYMENTS_UNAVAILABLE", traceId, { retryAfterSeconds: outcome.retryAfterSeconds });
      });
    case "unknown":
      return deps.db.write(async (tx) => {
        const after = await changeMoneyOp(tx, op, { status: "checking", errorCode: outcome.error }, now);
        const checking = await changeRide(
          tx,
          deps.ids,
          ride,
          { state: "hold_checking", paymentStatus: "hold_checking" },
          null,
          now,
        );
        const body: HoldPending = { code: "HOLD_PENDING", ride: toPassengerRide(checking) };
        const result = ok(202, body);
        await saveResult(tx, ref, "pending", result);
        logMoneyOp(deps.logger, trace, after, "checking", { error: outcome.error });
        return result;
      });
  }
}

// 押さえたと分かった。手配が続いていれば searching にし、手配のキーを 201 にする（要求の中と見回りの両方から使う）。
export async function confirmHold(
  tx: Exec,
  deps: MoneyDeps,
  trace: TraceContext,
  ride: RideRow,
  op: MoneyOpRow,
  paymentIntentId: string,
  actorId: string | null,
  now: Date,
): Promise<ApiResult> {
  const after = await changeMoneyOp(
    tx,
    op,
    { status: "succeeded", stripeObjectId: paymentIntentId, errorCode: null },
    now,
  );
  const searching = await changeRide(
    tx,
    deps.ids,
    ride,
    { state: "searching", paymentStatus: "held" },
    { type: "requested", actorKind: actorId ? "passenger" : "system", actorId, traceId: trace.clientTraceId },
    now,
  );
  const body: RideEnvelope = { ride: toPassengerRide(searching) };
  const result = ok(201, body);
  await settlePending(tx, ride.rideId, bookingRouteId, result);
  logMoneyOp(deps.logger, trace, after, "succeeded", { stripe_object_id: paymentIntentId });
  return result;
}

// 定まった断り。依頼は not_booked、押さえの操作は failed（DEC-52）。
export async function failHold(
  tx: Exec,
  deps: MoneyDeps,
  trace: TraceContext,
  ride: RideRow,
  op: MoneyOpRow,
  code: "card_declined" | "authentication_required",
  actorId: string | null,
  now: Date,
): Promise<ApiResult> {
  const after = await changeMoneyOp(tx, op, { status: "failed", errorCode: code }, now);
  const stillBooking = ride.state === "booking" || ride.state === "hold_checking";
  const next = await changeRide(
    tx,
    deps.ids,
    ride,
    { ...(stillBooking ? { state: "not_booked" as const } : {}), paymentStatus: "none" },
    {
      type: stillBooking ? "not_booked" : "hold_not_found",
      actorKind: actorId ? "passenger" : "system",
      actorId,
      details: { reason: code },
      traceId: trace.clientTraceId,
    },
    now,
  );
  const result = problem(
    code === "card_declined" ? "CARD_DECLINED" : "CARD_AUTHENTICATION_REQUIRED",
    trace.clientTraceId,
  );
  await settlePending(tx, ride.rideId, bookingRouteId, result);
  logMoneyOp(deps.logger, trace, after, "failed", { error: code, ride_state: next.state });
  return result;
}
