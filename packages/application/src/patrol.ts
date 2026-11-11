import type { RideEnvelope } from "@ride/contracts";
import {
  cancelHoldKey,
  decideHoldCheck,
  holdKey,
  holdWaitDeadline,
  type HoldLastError,
  type HoldLookup,
} from "@ride/domain";
import { bookingRouteId, confirmHold, failHold, logMoneyOp, type MoneyDeps } from "./booking.ts";
import { markPendingForResource, settlePending } from "./idempotency.ts";
import {
  acquireLease,
  changeMoneyOp,
  findActiveOp,
  findOpsByStatus,
  getMoneyOp,
  getPaymentRef,
  insertMoneyOp,
  markSent,
  releaseLease,
  type MoneyOpRow,
} from "./payments.ts";
import type { HoldOutcome, PaymentIntentSummary, TraceContext } from "./ports.ts";
import { ok } from "./result.ts";
import { changeRide, getRide, toPassengerRide, type RideRow } from "./rides.ts";

// 時刻の見回り（DEC-04。P_sweep ごと）のうち、押さえの確かめ（DEC-52、DEC-12 の (d)）。
// T_request_max でのシステムの取り消し（FR-08 AC5）と T_match_wait は縦の一本の外。

const listLookbackMs = 10 * 60_000;

export async function sweepOnce(deps: MoneyDeps): Promise<void> {
  const trace: TraceContext = { clientTraceId: deps.ids.newTraceId(), cloudTrace: null, spanId: null };
  const now = deps.clock.now();
  await markStaleProcessing(deps, trace, now);
  await abandonOverdueBookings(deps, trace, now);
  for (const op of await findOpsByStatus(deps.db.client, "checking", "hold")) {
    await withLease(deps, op, now, (leased) => checkHold(deps, trace, leased, now));
  }
  for (const op of await findOpsByStatus(deps.db.client, "checking", "cancel_hold")) {
    await withLease(deps, op, now, (leased) => checkRelease(deps, trace, leased, now));
  }
}

// 一つの操作の確かめが失敗しても（乗客の操作と版がぶつかったときなど）、ほかの操作の確かめは続ける。次の見回りでやり直す。
async function withLease(
  deps: MoneyDeps,
  op: MoneyOpRow,
  now: Date,
  fn: (op: MoneyOpRow) => Promise<void>,
): Promise<void> {
  try {
    if (!(await acquireLease(deps.db, op, now, deps.settings.opStaleMs))) return;
    try {
      const fresh = await getMoneyOp(deps.db.client, op.moneyOpId);
      if (fresh && fresh.status === "checking") await fn(fresh);
    } finally {
      await releaseLease(deps.db, op);
    }
  } catch (error) {
    deps.logger.log({
      event: "sweep.op_failed",
      severity: "WARNING",
      message: error instanceof Error ? error.message : String(error),
      ride_id: op.rideId,
      money_op_id: op.moneyOpId,
    });
  }
}

// 処理中のまま T_op_stale を過ぎた操作（インスタンスがトランザクション 1 の後に止まった）を確かめ中にする。
async function markStaleProcessing(deps: MoneyDeps, trace: TraceContext, now: Date): Promise<void> {
  const cutoff = now.getTime() - deps.settings.opStaleMs;
  for (const kind of ["hold", "cancel_hold"] as const) {
    for (const op of await findOpsByStatus(deps.db.client, "processing", kind)) {
      if (new Date(op.firstSentAt).getTime() > cutoff) continue;
      await deps.db.write(async (tx) => {
        const after = await changeMoneyOp(tx, op, { status: "checking", errorCode: "stale" }, now);
        const ride = await getRide(tx, op.rideId);
        if (kind === "hold" && ride?.state === "booking") {
          const checking = await changeRide(
            tx,
            deps.ids,
            ride,
            { state: "hold_checking", paymentStatus: "hold_checking" },
            null,
            now,
          );
          await markPendingForResource(
            tx,
            ride.rideId,
            bookingRouteId,
            ok(202, { code: "HOLD_PENDING", ride: toPassengerRide(checking) }),
          );
        }
        if (kind === "cancel_hold" && ride?.paymentStatus === "held") {
          await changeRide(tx, deps.ids, ride, { paymentStatus: "release_checking" }, null, now);
        }
        logMoneyOp(deps.logger, trace, after, "checking", { error: "stale" });
      });
    }
  }
}

// 手配から T_hold_wait を過ぎても押さえが分からない依頼は、手配をやめる（Stripe が答えなくても必ずやめる）。
async function abandonOverdueBookings(deps: MoneyDeps, trace: TraceContext, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - deps.settings.holdWaitMs).toISOString();
  const found = await deps.db.client.execute({
    sql: "SELECT ride_id FROM rides WHERE state = 'hold_checking' AND created_at <= ?",
    args: [cutoff],
  });
  for (const row of found.rows) {
    await deps.db.write(async (tx) => {
      const ride = await getRide(tx, String(row.ride_id));
      if (!ride || ride.state !== "hold_checking") return;
      const active = await findActiveOp(tx, ride.rideId, "hold");
      const stopped = await changeRide(
        tx,
        deps.ids,
        ride,
        // 確かめ中の押さえが残っていなければ（どの試みも起きていないと分かっていれば）押さえはない。
        { state: "not_booked", ...(active ? {} : { paymentStatus: "none" as const }) },
        {
          type: "not_booked",
          actorKind: "system",
          actorId: null,
          details: { reason: "hold_wait_expired" },
          traceId: trace.clientTraceId,
        },
        now,
      );
      // 手配のキーの「最後の結果」。設計は形を決めていない（CUJ-01-B「K に最後の結果」）。依頼の今の姿を 200 で返す。
      const envelope: RideEnvelope = { ride: toPassengerRide(stopped) };
      await settlePending(tx, ride.rideId, bookingRouteId, ok(200, envelope));
    });
  }
}

function lookupHold(
  list: PaymentIntentSummary[] | null,
  op: MoneyOpRow,
): { lookup: HoldLookup; pi: PaymentIntentSummary | null } {
  if (!list) return { lookup: { kind: "unavailable" }, pi: null };
  const pi = list.find(
    (item) =>
      item.metadata.ride_id === op.rideId &&
      item.metadata.hold_seq === String(op.seq) &&
      item.metadata.attempt === String(op.attempt),
  );
  if (!pi) return { lookup: { kind: "absent" }, pi: null };
  const status = pi.status === "canceled" ? "canceled" : pi.status === "requires_payment_method" ? "declined" : "held";
  return { lookup: { kind: "found", status }, pi };
}

function lastError(op: MoneyOpRow): HoldLastError | null {
  const known: HoldLastError[] = ["timeout", "connection_lost", "stripe_5xx", "stripe_409", "stale"];
  return known.find((code) => code === op.errorCode) ?? null;
}

async function checkHold(deps: MoneyDeps, trace: TraceContext, op: MoneyOpRow, now: Date): Promise<void> {
  const ride = await getRide(deps.db.client, op.rideId);
  if (!ride) return;
  const paymentRef = await getPaymentRef(deps.db.client, ride.passengerId);
  if (!paymentRef) return;
  const listed = await deps.payments.listPaymentIntents(
    paymentRef.stripeCustomerId,
    new Date(new Date(op.firstSentAt).getTime() - listLookbackMs),
    trace,
  );
  const { lookup, pi } = lookupHold(listed.kind === "ok" ? listed.items : null, op);
  const action = decideHoldCheck({
    now,
    rideState: ride.state === "hold_checking" || ride.state === "not_booked" ? ride.state : "other",
    rideCreatedAt: new Date(ride.createdAt),
    holdWaitMs: deps.settings.holdWaitMs,
    opFirstSentAt: new Date(op.firstSentAt),
    opLastSentAt: new Date(op.lastSentAt),
    opStaleMs: deps.settings.opStaleMs,
    lastError: lastError(op),
    lookup,
  });

  switch (action) {
    case "confirm":
      await deps.db.write((tx) => confirmHold(tx, deps, trace, ride, op, pi!.id, null, now));
      return;
    case "release":
      await releaseFoundHold(deps, trace, ride, op, pi!.id, now);
      return;
    case "already_released":
      await deps.db.write(async (tx) => {
        await changeMoneyOp(tx, op, { status: "succeeded", stripeObjectId: pi!.id }, now);
        await changeRide(
          tx,
          deps.ids,
          ride,
          { paymentStatus: "released" },
          { type: "hold_released", actorKind: "system", actorId: null, traceId: trace.clientTraceId },
          now,
        );
      });
      return;
    case "declined":
      await deps.db.write((tx) => failHold(tx, deps, trace, ride, op, "card_declined", null, now));
      return;
    case "absent":
      await deps.db.write(async (tx) => {
        const after = await changeMoneyOp(tx, op, { status: "not_happened" }, now);
        await changeRide(
          tx,
          deps.ids,
          ride,
          { paymentStatus: "none" },
          { type: "hold_not_found", actorKind: "system", actorId: null, traceId: trace.clientTraceId },
          now,
        );
        logMoneyOp(deps.logger, trace, after, "settled", { outcome: "not_happened" });
      });
      return;
    case "resend_same_key":
      await sendHold(deps, trace, ride, op, paymentRef.stripeCustomerId);
      return;
    case "retry_new_attempt": {
      const next = await deps.db.write(async (tx) => {
        await changeMoneyOp(tx, op, { status: "not_happened" }, now);
        return insertMoneyOp(tx, {
          moneyOpId: deps.ids.newId("mop"),
          rideId: op.rideId,
          kind: "hold",
          seq: op.seq,
          attempt: op.attempt + 1,
          amount: op.amount,
          stripeIdempotencyKey: holdKey(op.rideId, op.seq, op.attempt + 1),
          now,
        });
      });
      logMoneyOp(deps.logger, trace, next, "processing", { previous_attempt: op.attempt });
      await sendHold(deps, trace, ride, next, paymentRef.stripeCustomerId);
      return;
    }
    case "wait":
      await deps.db.write((tx) => changeMoneyOp(tx, op, { status: "checking" }, now));
      return;
  }
}

// 確かめの中で押さえを送る（同じキーの送り直しか、試みの番号を進めた新しいキー）。
async function sendHold(
  deps: MoneyDeps,
  trace: TraceContext,
  ride: RideRow,
  op: MoneyOpRow,
  customerId: string,
): Promise<void> {
  const paymentRef = await getPaymentRef(deps.db.client, ride.passengerId);
  await deps.db.write((tx) => markSent(tx, op, deps.clock.now()));
  const outcome: HoldOutcome = await deps.payments.createHold(
    {
      customerId,
      paymentMethodId: paymentRef?.defaultPaymentMethodId ?? "",
      amountYen: op.amount,
      idempotencyKey: op.stripeIdempotencyKey,
      metadata: {
        ride_id: op.rideId,
        money_op_id: op.moneyOpId,
        op_kind: "hold",
        hold_seq: String(op.seq),
        attempt: String(op.attempt),
      },
    },
    trace,
  );
  const now = deps.clock.now();
  const current = await getRide(deps.db.client, ride.rideId);
  if (!current) return;
  switch (outcome.kind) {
    case "succeeded": {
      const stillWaiting =
        current.state === "hold_checking" &&
        now.getTime() < holdWaitDeadline(new Date(current.createdAt), deps.settings.holdWaitMs).getTime();
      if (stillWaiting) {
        await deps.db.write((tx) => confirmHold(tx, deps, trace, current, op, outcome.paymentIntentId, null, now));
      } else {
        await releaseFoundHold(deps, trace, current, op, outcome.paymentIntentId, now);
      }
      return;
    }
    case "declined":
      await deps.db.write((tx) => failHold(tx, deps, trace, current, op, outcome.code, null, now));
      return;
    case "not_executed":
    case "unknown": {
      // Stripe が実行しなかった要求は結果を保たないので、次の見回りで同じキーを送れる。
      const error = outcome.kind === "unknown" ? outcome.error : "timeout";
      await deps.db.write((tx) => changeMoneyOp(tx, op, { status: "checking", errorCode: error }, now));
      return;
    }
  }
}

// 押さえはあったが手配をやめていた。押さえを取り消す（キーは PaymentIntent の ID と「取り消し」）。
async function releaseFoundHold(
  deps: MoneyDeps,
  trace: TraceContext,
  ride: RideRow,
  op: MoneyOpRow,
  paymentIntentId: string,
  now: Date,
): Promise<void> {
  const { stopped, cancelOp } = await deps.db.write(async (tx) => {
    await changeMoneyOp(tx, op, { status: "succeeded", stripeObjectId: paymentIntentId }, now);
    let current = ride;
    if (ride.state === "hold_checking") {
      current = await changeRide(
        tx,
        deps.ids,
        ride,
        { state: "not_booked" },
        {
          type: "not_booked",
          actorKind: "system",
          actorId: null,
          details: { reason: "hold_wait_expired" },
          traceId: trace.clientTraceId,
        },
        now,
      );
      await settlePending(tx, ride.rideId, bookingRouteId, ok(200, { ride: toPassengerRide(current) }));
    }
    const created = await insertMoneyOp(tx, {
      moneyOpId: deps.ids.newId("mop"),
      rideId: ride.rideId,
      kind: "cancel_hold",
      seq: op.seq,
      attempt: 1,
      amount: op.amount,
      stripeIdempotencyKey: cancelHoldKey(paymentIntentId),
      stripeObjectId: paymentIntentId,
      now,
    });
    return { stopped: current, cancelOp: created };
  });
  logMoneyOp(deps.logger, trace, cancelOp, "processing");
  const outcome = await deps.payments.cancelHold(paymentIntentId, cancelOp.stripeIdempotencyKey, trace);
  await applyReleaseOutcome(deps, trace, stopped, cancelOp, outcome, deps.clock.now());
}

async function applyReleaseOutcome(
  deps: MoneyDeps,
  trace: TraceContext,
  ride: RideRow,
  cancelOp: MoneyOpRow,
  outcome: Awaited<ReturnType<MoneyDeps["payments"]["cancelHold"]>>,
  now: Date,
): Promise<void> {
  await deps.db.write(async (tx) => {
    const current = (await getRide(tx, ride.rideId)) ?? ride;
    if (outcome.kind === "succeeded") {
      const after = await changeMoneyOp(tx, cancelOp, { status: "succeeded" }, now);
      await changeRide(
        tx,
        deps.ids,
        current,
        { paymentStatus: "released" },
        { type: "hold_released", actorKind: "system", actorId: null, traceId: trace.clientTraceId },
        now,
      );
      logMoneyOp(deps.logger, trace, after, "succeeded");
      return;
    }
    const error = outcome.kind === "unknown" ? outcome.error : outcome.code;
    const after = await changeMoneyOp(tx, cancelOp, { status: "checking", errorCode: error }, now);
    if (current.paymentStatus !== "release_checking") {
      await changeRide(tx, deps.ids, current, { paymentStatus: "release_checking" }, null, now);
    }
    logMoneyOp(deps.logger, trace, after, "checking", { error });
  });
}

// 押さえの取り消しの結果が分からない（release_checking）。照らして取り消し済みなら released、まだなら同じキーで送る。
async function checkRelease(deps: MoneyDeps, trace: TraceContext, op: MoneyOpRow, now: Date): Promise<void> {
  const ride = await getRide(deps.db.client, op.rideId);
  if (!ride || !op.stripeObjectId) return;
  const paymentRef = await getPaymentRef(deps.db.client, ride.passengerId);
  if (!paymentRef) return;
  const listed = await deps.payments.listPaymentIntents(
    paymentRef.stripeCustomerId,
    new Date(new Date(op.firstSentAt).getTime() - 24 * 60 * 60_000),
    trace,
  );
  if (listed.kind === "unavailable") {
    await deps.db.write((tx) => changeMoneyOp(tx, op, { status: "checking" }, now));
    return;
  }
  const pi = listed.items.find((item) => item.id === op.stripeObjectId);
  if (pi?.status === "canceled") {
    await applyReleaseOutcome(deps, trace, ride, op, { kind: "succeeded" }, now);
    return;
  }
  const outcome = await deps.payments.cancelHold(op.stripeObjectId, op.stripeIdempotencyKey, trace);
  await applyReleaseOutcome(deps, trace, ride, op, outcome, deps.clock.now());
}
