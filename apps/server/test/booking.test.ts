import { randomUUID } from "node:crypto";
import type { PaymentGateway } from "@ride/application";
import type { Estimate, PassengerRide, PlaceCandidates, PlaceResolved, Problem } from "@ride/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { setup, type Harness } from "./harness.ts";

let h: Harness;
afterEach(() => h?.cleanup());

describe("CUJ-01 の主な流れ", () => {
  it("場所を探し、見積もり、手配すると、押さえて searching になる", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const session = randomUUID();

    const search = await p.post("/api/v1/passenger/places/search", { query: "渋谷", sessionToken: session });
    expect(search.status).toBe(200);
    const candidates = (await search.json()) as PlaceCandidates;
    expect(candidates.items[0]?.name).toBe("渋谷駅");

    const resolve = await p.post("/api/v1/passenger/places/resolve", {
      placeId: candidates.items[0]!.placeId,
      sessionToken: session,
    });
    expect(resolve.status).toBe(200);
    const place = (await resolve.json()) as PlaceResolved;

    const estimate = await p.estimate(place.position);
    expect(estimate.fare.total.amount).toBe(
      estimate.fare.base.amount +
        estimate.fare.distance.amount +
        estimate.fare.time.amount +
        estimate.fare.pickupFee.amount +
        estimate.fare.bookingFee.amount,
    );
    expect(estimate.eta.components.rideSec).toBe(estimate.durationSec);

    const booked = await p.book(estimate.estimateId);
    expect(booked.status).toBe(201);
    const { ride } = (await booked.json()) as { ride: PassengerRide };
    expect(ride.state).toBe("searching");
    expect(ride.payment.state).toBe("held");
    expect(ride.fare.booked).toEqual(estimate.fare.total);
    expect(ride.eta).toEqual(estimate.eta);

    expect(await h.history(ride.rideId)).toEqual(["requested"]);
    const intents = h.stripe.intentsFor("cus_fake_0001");
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      status: "requires_capture",
      amountYen: estimate.fare.total.amount,
      metadata: { ride_id: ride.rideId, hold_seq: "1", attempt: "1" },
    });

    const active = await p.get("/api/v1/passenger/rides/active");
    expect(((await active.json()) as { ride: PassengerRide }).ride.rideId).toBe(ride.rideId);
  });

  it("許諾の前の取り消しは無料で、押さえを解放する（FR-07 AC1）", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const { ride } = (await (await p.book((await p.estimate()).estimateId)).json()) as { ride: PassengerRide };

    const wrongFee = await p.cancel(ride.rideId, 500);
    expect(wrongFee.status).toBe(409);
    expect(((await wrongFee.json()) as Problem).currentFee).toEqual({ amount: 0, currency: "jpy" });

    const cancelled = await p.cancel(ride.rideId, 0);
    expect(cancelled.status).toBe(200);
    const after = ((await cancelled.json()) as { ride: PassengerRide }).ride;
    expect(after.state).toBe("cancelled");
    expect(after.cancellation).toEqual({ cancelledBy: "passenger", reason: null });
    expect(after.payment.state).toBe("released");
    expect(await h.history(ride.rideId)).toEqual(["requested", "cancelled", "hold_released"]);
    expect(h.stripe.intentsFor("cus_fake_0001")[0]?.status).toBe("canceled");
    expect((await p.get("/api/v1/passenger/rides/active")).status).toBe(204);
  });
});

describe("冪等キー（DEC-48）", () => {
  it("同じキーの送り直しは最初の結果を返し、依頼も押さえも一つ（FR-05 AC6）", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    const first = await p.book(estimate.estimateId, key);
    const second = await p.book(estimate.estimateId, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
    expect(h.stripe.calls.filter((call) => call.op === "createHold")).toHaveLength(1);
  });

  it("同じキーで中身が違えば 422 IDEMPOTENCY_KEY_REUSED", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const key = randomUUID();
    await p.book((await p.estimate()).estimateId, key);
    const reused = await p.book((await p.estimate()).estimateId, key);
    expect(reused.status).toBe(422);
    expect(((await reused.json()) as Problem).code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("同じキーの要求が動いている間は 409 OPERATION_IN_PROGRESS と Retry-After", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h = await setup({
      wrapPayments: (inner): PaymentGateway => ({
        ...inner,
        createHold: async (req, trace) => {
          await gate;
          return inner.createHold(req, trace);
        },
        cancelHold: inner.cancelHold.bind(inner),
        listPaymentIntents: inner.listPaymentIntents.bind(inner),
      }),
    });
    const p = await h.loginAs("passenger@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    const first = p.book(estimate.estimateId, key);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await p.book(estimate.estimateId, key);
    expect(second.status).toBe(409);
    expect(second.headers.get("Retry-After")).toBe("1");
    expect(((await second.json()) as Problem).code).toBe("OPERATION_IN_PROGRESS");
    release();
    expect((await first).status).toBe(201);
  });

  it("冪等キーがなければ 400", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const res = await p.post("/api/v1/passenger/rides", { estimateId: (await p.estimate()).estimateId });
    expect(res.status).toBe(400);
    expect(((await res.json()) as Problem).errors?.[0]?.field).toBe("header:Idempotency-Key");
  });
});

describe("手配の確定の断り（IFC-02 のエラーの決まり）", () => {
  it("支払い手段がなければ 409 PAYMENT_METHOD_REQUIRED（FR-05 AC2）", async () => {
    h = await setup();
    const p = await h.loginAs("nocard@example.com");
    const res = await p.book((await p.estimate()).estimateId);
    expect(res.status).toBe(409);
    expect(((await res.json()) as Problem).code).toBe("PAYMENT_METHOD_REQUIRED");
  });

  it("進行中の依頼があれば 409 ACTIVE_RIDE_EXISTS（FR-05 AC5）", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    expect((await p.book((await p.estimate()).estimateId)).status).toBe(201);
    const second = await p.book((await p.estimate()).estimateId);
    expect(second.status).toBe(409);
    expect(((await second.json()) as Problem).code).toBe("ACTIVE_RIDE_EXISTS");
  });

  it("期限切れか使用済みの見積もりは 409 ESTIMATE_EXPIRED", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const expired = await p.estimate();
    h.clock.advance(10 * 60_000 + 1);
    const res = await p.book(expired.estimateId);
    expect(((await res.json()) as Problem).code).toBe("ESTIMATE_EXPIRED");

    const fresh = await p.estimate();
    const { ride } = (await (await p.book(fresh.estimateId)).json()) as { ride: PassengerRide };
    await p.cancel(ride.rideId);
    const reused = await p.book(fresh.estimateId);
    expect(((await reused.json()) as Problem).code).toBe("ESTIMATE_EXPIRED");
  });

  it("押さえを断られたら 402 CARD_DECLINED で、キーの最初の結果になる（FR-05 AC3）", async () => {
    h = await setup();
    const p = await h.loginAs("declined@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    const res = await p.book(estimate.estimateId, key);
    expect(res.status).toBe(402);
    expect(((await res.json()) as Problem).code).toBe("CARD_DECLINED");
    expect((await p.book(estimate.estimateId, key)).status).toBe(402);
    expect(h.stripe.calls.filter((call) => call.op === "createHold")).toHaveLength(1);
    const ride = await h.db.client.execute("SELECT ride_id, state, payment_status FROM rides");
    expect(ride.rows[0]).toMatchObject({ state: "not_booked", payment_status: "none" });
  });

  it("Stripe が実行しなかったら 503 PAYMENTS_UNAVAILABLE で、キーを放す（同じキーで初めからやり直せる）", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const estimate = await p.estimate();
    const key = randomUUID();
    h.stripe.nextHold("rate_limited");
    const first = await p.book(estimate.estimateId, key);
    expect(first.status).toBe(503);
    expect(first.headers.get("Retry-After")).toBe("2");
    expect(((await first.json()) as Problem).code).toBe("PAYMENTS_UNAVAILABLE");
    expect(
      await h.moneyOps((await h.db.client.execute("SELECT ride_id FROM rides")).rows[0]!.ride_id as string),
    ).toMatchObject([{ kind: "hold", status: "not_happened" }]);

    // 同じキー、同じ見積もりで初めからやり直せる（見積もりの使用も戻す。設計にない片付け）。
    const retry = await p.book(estimate.estimateId, key);
    expect(retry.status).toBe(201);
    expect(
      (await h.db.client.execute("SELECT state FROM rides ORDER BY created_at")).rows.map((row) => row.state),
    ).toEqual(["not_booked", "searching"]);
  });

  it("経路がなければ 422 NO_ROUTE、地図が答えなければ 503 MAPS_UNAVAILABLE", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const noRoute = await p.post("/api/v1/passenger/estimates", {
      pickup: { position: { lat: 35.681236, lng: 139.767125 }, source: "search" },
      dropoff: { position: { lat: 34.75, lng: 139.355 }, source: "search" },
    });
    expect(noRoute.status).toBe(422);
    expect(((await noRoute.json()) as Problem).code).toBe("NO_ROUTE");

    h.maps.failNext();
    const down = await p.post("/api/v1/passenger/places/search", { query: "駅", sessionToken: randomUUID() });
    expect(down.status).toBe(503);
    expect(((await down.json()) as Problem).code).toBe("MAPS_UNAVAILABLE");
  });

  it("誤差の大きい現在地をピンで確かめていなければ 422 PICKUP_NOT_CONFIRMED（FR-02 AC3）", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const res = await p.post("/api/v1/passenger/estimates", {
      pickup: { position: { lat: 35.681236, lng: 139.767125 }, source: "current_location", accuracyM: 120 },
      dropoff: { position: { lat: 35.658034, lng: 139.701636 }, source: "search" },
    });
    expect(((await res.json()) as Problem).code).toBe("PICKUP_NOT_CONFIRMED");
  });

  it("要求の形の誤りは欄ごとの JSON Pointer を返す", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const res = await p.post("/api/v1/passenger/estimates", {
      pickup: { position: { lat: 200, lng: 0 }, source: "search" },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as Problem;
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { field: "/pickup/position/lat", code: "OUT_OF_RANGE" },
        { field: "/dropoff", code: "REQUIRED" },
      ]),
    );
  });

  it("他人の依頼は 404（DRV-29）", async () => {
    h = await setup();
    const owner = await h.loginAs("passenger@example.com");
    const other = await h.loginAs("timeout@example.com");
    const { ride } = (await (await owner.book((await owner.estimate()).estimateId)).json()) as { ride: PassengerRide };
    expect((await other.get(`/api/v1/passenger/rides/${ride.rideId}`)).status).toBe(404);
  });
});

export type { Estimate };
