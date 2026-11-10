import { randomUUID } from "node:crypto";
import type { PaymentGateway } from "@ride/application";
import type { HoldPending, HoldReleasePending, PassengerRide } from "@ride/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { setup, type Harness } from "./harness.ts";

// 失敗の流れ: 押さえの結果が分からないとき（FR-05 AC4、DEC-52、CUJ-01-B の確かめ）。
let h: Harness;
afterEach(() => h?.cleanup());

async function rideOf(rideId: string): Promise<{ state: string; payment: string }> {
  const row = (
    await h.db.client.execute({ sql: "SELECT state, payment_status FROM rides WHERE ride_id = ?", args: [rideId] })
  ).rows[0]!;
  return { state: String(row.state), payment: String(row.payment_status) };
}

describe("押さえの結果が分からないとき", () => {
  it("タイムアウトでも Stripe が押さえていれば、見回りが見つけて searching にする。キーは 201 に替わる", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    h.stripe.nextHold("timeout_after_create");
    const res = await p.book(estimate.estimateId, key);
    expect(res.status).toBe(202);
    const pending = (await res.json()) as HoldPending;
    expect(pending.code).toBe("HOLD_PENDING");
    expect(pending.ride.state).toBe("hold_checking");
    expect(pending.ride.payment.state).toBe("hold_checking");
    // 結果待ちのキーの送り直しは 202 のまま（新しいキーで送り直させない）。
    expect((await p.book(estimate.estimateId, key)).status).toBe(202);

    h.clock.advance(5_000);
    await h.sweep();
    expect(await rideOf(pending.ride.rideId)).toEqual({ state: "searching", payment: "held" });
    expect(await h.history(pending.ride.rideId)).toEqual(["requested"]);
    const replay = await p.book(estimate.estimateId, key);
    expect(replay.status).toBe(201);
    expect(((await replay.json()) as { ride: PassengerRide }).ride.state).toBe("searching");
  });

  it("要求が Stripe に届いていなければ、見回りが同じキーで送り直す", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    h.stripe.nextHold("lost_before_stripe");
    const pending = (await (await p.book((await p.estimate()).estimateId)).json()) as HoldPending;
    h.clock.advance(5_000);
    await h.sweep();
    expect(await rideOf(pending.ride.rideId)).toEqual({ state: "searching", payment: "held" });
    const keys = h.stripe.calls.filter((call) => call.op === "createHold").map((call) => call.key);
    expect(keys).toEqual([`${pending.ride.rideId}_hold_1_a1`, `${pending.ride.rideId}_hold_1_a1`]);
  });

  it("Stripe の 5xx の後は、T_op_stale を過ぎてから試みの番号を進めた新しいキーで送る", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    h.stripe.nextHold("server_error");
    const pending = (await (await p.book((await p.estimate()).estimateId)).json()) as HoldPending;
    const rideId = pending.ride.rideId;

    h.clock.advance(10_000);
    await h.sweep();
    expect(h.stripe.calls.filter((call) => call.op === "createHold")).toHaveLength(1);
    expect(await rideOf(rideId)).toEqual({ state: "hold_checking", payment: "hold_checking" });

    h.clock.advance(21_000);
    await h.sweep();
    expect(await rideOf(rideId)).toEqual({ state: "searching", payment: "held" });
    expect(await h.moneyOps(rideId)).toEqual([
      { kind: "hold", attempt: 1, status: "not_happened", key: `${rideId}_hold_1_a1` },
      { kind: "hold", attempt: 2, status: "succeeded", key: `${rideId}_hold_1_a2` },
    ]);
  });

  it("Stripe が答えないまま T_hold_wait を過ぎたら手配をやめ、押さえがないと確かめてから none にする", async () => {
    h = await setup();
    const p = await h.loginAs("lost@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    const pending = (await (await p.book(estimate.estimateId, key)).json()) as HoldPending;
    const rideId = pending.ride.rideId;

    for (let second = 5; second <= 55; second += 5) {
      h.clock.advance(5_000);
      await h.sweep();
    }
    expect(await rideOf(rideId)).toEqual({ state: "hold_checking", payment: "hold_checking" });

    h.clock.advance(6_000);
    await h.sweep();
    // 手配はやめるが、押さえはまだ「分からない」（「押さえていない」と言わない）。
    expect(await rideOf(rideId)).toEqual({ state: "not_booked", payment: "hold_checking" });
    const settled = await p.book(estimate.estimateId, key);
    expect(settled.status).toBe(200);
    expect(((await settled.json()) as { ride: PassengerRide }).ride.state).toBe("not_booked");
    // 押さえを確かめている間も、新しい手配はできる（not_booked は進行中に数えない）。
    expect((await p.get("/api/v1/passenger/rides/active")).status).toBe(200);

    // 最後の送り直し（55 秒）から T_op_stale を過ぎたら、一覧に押さえがないことで「ない」と決める。
    h.clock.advance(30_000);
    await h.sweep();
    expect(await rideOf(rideId)).toEqual({ state: "not_booked", payment: "none" });
    expect(await h.history(rideId)).toEqual(["not_booked", "hold_not_found"]);
    expect((await p.get("/api/v1/passenger/rides/active")).status).toBe(204);
  });

  it("確かめ中に乗客が取り消すと 202 HOLD_RELEASE_PENDING。後で押さえを見つけたら取り消して released にする", async () => {
    h = await setup();
    const p = await h.loginAs("unresponsive@example.com");
    const estimate = await p.estimate();
    const bookingKey = randomUUID();
    const pending = (await (await p.book(estimate.estimateId, bookingKey)).json()) as HoldPending;
    const rideId = pending.ride.rideId;

    const cancelKey = randomUUID();
    const cancelled = await p.cancel(rideId, 0, cancelKey);
    expect(cancelled.status).toBe(202);
    const body = (await cancelled.json()) as HoldReleasePending;
    expect(body.code).toBe("HOLD_RELEASE_PENDING");
    expect(body.ride.state).toBe("not_booked");
    expect(body.ride.payment.state).toBe("hold_checking");
    expect((await p.cancel(rideId, 0, cancelKey)).status).toBe(202);
    expect((await p.book(estimate.estimateId, bookingKey)).status).toBe(200);

    // 一覧が答えない間は待つ。
    h.clock.advance(2_000);
    await h.sweep();
    expect(await rideOf(rideId)).toEqual({ state: "not_booked", payment: "hold_checking" });

    h.clock.advance(3_000);
    await h.sweep();
    expect(await rideOf(rideId)).toEqual({ state: "not_booked", payment: "released" });
    expect(await h.history(rideId)).toEqual(["not_booked", "hold_released"]);
    expect(h.stripe.intentsFor("cus_fake_0004")[0]?.status).toBe("canceled");
    expect((await h.moneyOps(rideId)).map((op) => `${op.kind}:${op.status}`)).toEqual([
      "hold:succeeded",
      "cancel_hold:succeeded",
    ]);
  });

  it("インスタンスが一つ目のトランザクションの後に止まっても、T_op_stale の後に確かめて片付ける", async () => {
    let crash = true;
    h = await setup({
      wrapPayments: (inner): PaymentGateway => ({
        createHold: async (req, trace) => {
          if (crash) {
            crash = false;
            throw new Error("instance stopped");
          }
          return inner.createHold(req, trace);
        },
        cancelHold: inner.cancelHold.bind(inner),
        listPaymentIntents: inner.listPaymentIntents.bind(inner),
      }),
    });
    const p = await h.loginAs("passenger@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    expect((await p.book(estimate.estimateId, key)).status).toBe(500);
    const rideId = String((await h.db.client.execute("SELECT ride_id FROM rides")).rows[0]!.ride_id);
    expect(await rideOf(rideId)).toEqual({ state: "booking", payment: "holding" });
    expect((await p.book(estimate.estimateId, key)).status).toBe(409);

    h.clock.advance(31_000);
    await h.sweep();
    expect(await rideOf(rideId)).toEqual({ state: "searching", payment: "held" });
    expect((await p.book(estimate.estimateId, key)).status).toBe(201);
  });
});
