import type { HoldReleasePending, Money, RideEnvelope } from "@ride/contracts";
import { cancelHoldKey } from "@ride/domain";
import type { AuthedAccount } from "./auth.ts";
import { bookingRouteId, logMoneyOp, operationInProgress, replayOrConflict, type MoneyDeps } from "./booking.ts";
import { TxAbort } from "./db.ts";
import {
  insertProcessing,
  KeyConflictError,
  lookupKey,
  saveResult,
  settlePending,
  type KeyRef,
} from "./idempotency.ts";
import { changeMoneyOp, findSucceededHold, insertMoneyOp } from "./payments.ts";
import type { TraceContext } from "./ports.ts";
import { ok, problem, type ApiResult } from "./result.ts";
import { changeRide, getPassengerRide, RideConflictError, toPassengerRide } from "./rides.ts";

// 乗客の取り消し（FR-07 AC1 と、押さえの確かめ中の取り消し。CUJ-01-C）。許諾の後の取り消し（キャンセル料）は縦の一本の外。

export const cancelRouteId = "passenger.rides.cancel";

export interface CancelInput {
  account: AuthedAccount;
  idempotencyKey: string;
  requestHash: string;
  rideId: string;
  expectedFee: Money;
  trace: TraceContext;
}

export async function cancelRide(deps: MoneyDeps, input: CancelInput): Promise<ApiResult> {
  const traceId = input.trace.clientTraceId;
  const accountId = input.account.accountId;
  const ref: KeyRef = { accountId, key: input.idempotencyKey };
  const early = replayOrConflict(await lookupKey(deps.db.client, ref, cancelRouteId, input.requestHash), traceId);
  if (early) return early;

  // 見回りと重なったら（版の条件で落ちたら）読み直してもう一度だけ判断する。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await cancelOnce(deps, input, ref);
    } catch (error) {
      if (error instanceof RideConflictError) continue;
      if (error instanceof KeyConflictError) return operationInProgress(traceId);
      if (error instanceof TxAbort) return error.result as ApiResult;
      throw error;
    }
  }
  return operationInProgress(traceId);
}

async function cancelOnce(deps: MoneyDeps, input: CancelInput, ref: KeyRef): Promise<ApiResult> {
  const traceId = input.trace.clientTraceId;
  const accountId = input.account.accountId;
  const ride = await getPassengerRide(deps.db.client, input.rideId, accountId);
  if (!ride) return problem("NOT_FOUND", traceId);
  const now = deps.clock.now();

  switch (ride.state) {
    case "hold_checking":
      // 手配をやめて not_booked にする。押さえの確かめは続く（DEC-52）。支払いの状態は hold_checking のまま
      // （押さえがあるかがまだ分からない。報告書の支払いの状態の図に従い、OpenAPI の「release_checking」とは合わせない）。
      return deps.db.write(async (tx) => {
        await insertProcessing(tx, ref, cancelRouteId, input.requestHash, now, deps.settings.idemKeepMs, ride.rideId);
        const stopped = await changeRide(
          tx,
          deps.ids,
          ride,
          { state: "not_booked", cancelRequested: true },
          {
            type: "not_booked",
            actorKind: "passenger",
            actorId: accountId,
            details: { reason: "passenger_cancelled" },
            traceId,
          },
          now,
        );
        const view = toPassengerRide(stopped);
        const envelope: RideEnvelope = { ride: view };
        await settlePending(tx, ride.rideId, bookingRouteId, ok(200, envelope));
        const body: HoldReleasePending = { code: "HOLD_RELEASE_PENDING", ride: view };
        const result = ok(202, body);
        await saveResult(tx, ref, "completed", result);
        return result;
      });
    case "searching":
      return cancelSearching(deps, input, ref, ride, now);
    case "booking":
      // 押さえの要求がまだ動いている。設計は booking の依頼の取り消しを決めていない。少し後に送り直させる。
      return operationInProgress(traceId);
    case "in_progress":
      return problem("RIDE_ALREADY_STARTED", traceId);
    case "not_booked":
    case "cancelled":
    case "ended":
    case "no_show":
      return problem("RIDE_ALREADY_ENDED", traceId);
    case "accepted":
    case "arrived":
      return problem("INTERNAL_ERROR", traceId, { detail: "許諾の後の取り消しはこの実装にありません" });
  }
}

async function cancelSearching(
  deps: MoneyDeps,
  input: CancelInput,
  ref: KeyRef,
  ride: Awaited<ReturnType<typeof getPassengerRide>> & object,
  now: Date,
): Promise<ApiResult> {
  const traceId = input.trace.clientTraceId;
  const accountId = input.account.accountId;
  // 許諾の前は無料（FR-07 AC1）。確かめた額が違えば今の額を添えて断る（DEC-41）。
  if (input.expectedFee.amount !== 0) {
    return problem("CANCELLATION_FEE_CHANGED", traceId, { currentFee: { amount: 0, currency: "jpy" } });
  }
  const hold = await findSucceededHold(deps.db.client, ride.rideId);
  if (!hold?.stripeObjectId) throw new Error(`searching ride without a hold: ${ride.rideId}`);
  const paymentIntentId = hold.stripeObjectId;

  const { cancelled, op } = await deps.db.write(async (tx) => {
    await insertProcessing(tx, ref, cancelRouteId, input.requestHash, now, deps.settings.idemKeepMs, ride.rideId);
    const cancelledRide = await changeRide(
      tx,
      deps.ids,
      ride,
      { state: "cancelled", cancelledBy: "passenger", cancelReason: null },
      { type: "cancelled", actorKind: "passenger", actorId: accountId, details: { fee: 0 }, traceId },
      now,
    );
    const cancelOp = await insertMoneyOp(tx, {
      moneyOpId: deps.ids.newId("mop"),
      rideId: ride.rideId,
      kind: "cancel_hold",
      seq: hold.seq,
      attempt: 1,
      amount: hold.amount,
      stripeIdempotencyKey: cancelHoldKey(paymentIntentId),
      stripeObjectId: paymentIntentId,
      now,
    });
    return { cancelled: cancelledRide, op: cancelOp };
  });
  logMoneyOp(deps.logger, input.trace, op, "processing", { account_id: accountId });

  const outcome = await deps.payments.cancelHold(paymentIntentId, op.stripeIdempotencyKey, input.trace);
  const settledAt = deps.clock.now();
  return deps.db.write(async (tx) => {
    let after = cancelled;
    if (outcome.kind === "succeeded") {
      await changeMoneyOp(tx, op, { status: "succeeded" }, settledAt);
      after = await changeRide(
        tx,
        deps.ids,
        cancelled,
        { paymentStatus: "released" },
        { type: "hold_released", actorKind: "system", actorId: null, traceId },
        settledAt,
      );
      logMoneyOp(deps.logger, input.trace, op, "succeeded");
    } else {
      // 定まった失敗も含めて確かめ中にし、見回りが Stripe の状態を照らして片付ける。
      const error = outcome.kind === "unknown" ? outcome.error : outcome.code;
      await changeMoneyOp(tx, op, { status: "checking", errorCode: error }, settledAt);
      after = await changeRide(tx, deps.ids, cancelled, { paymentStatus: "release_checking" }, null, settledAt);
      logMoneyOp(deps.logger, input.trace, op, "checking", { error });
    }
    const body: RideEnvelope = { ride: toPassengerRide(after) };
    const result = ok(200, body);
    await saveResult(tx, ref, "completed", result);
    return result;
  });
}
