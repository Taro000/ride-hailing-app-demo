import { randomUUID } from "node:crypto";
import type { PaymentGateway } from "@ride/application";
import type { HoldPending, Problem, RideUpdated, StreamHello } from "@ride/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { origin, readEvents, setup, type Harness } from "./harness.ts";

let h: Harness;
afterEach(() => h?.cleanup());

describe("状態の変化の配信（IFC-08）", () => {
  it("確かめの結果を ride.updated で届け、つなぎ直しは最後の id から送り直す", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    h.stripe.nextHold("timeout_after_create");
    const pending = (await (await p.book((await p.estimate()).estimateId)).json()) as HoldPending;

    const stream = await p.get("/api/v1/stream");
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    expect(stream.headers.get("x-app-version")).toBe("test-1");
    const reading = readEvents(stream, (events) => events.some((event) => event.event === "ride.updated"));
    h.clock.advance(5_000);
    await h.sweep();
    const events = await reading;
    const hello = events[0]!;
    expect(hello.event).toBe("hello");
    expect((hello.data as StreamHello).appVersion).toBe("test-1");
    const updated = events.find((event) => event.event === "ride.updated")!;
    const message = updated.data as RideUpdated;
    expect(message.changeType).toBe("requested");
    expect(message.ride.rideId).toBe(pending.ride.rideId);
    expect(message.ride.state).toBe("searching");
    expect(updated.id).toMatch(/^h\d+-d0$/);

    const resumed = await p.get("/api/v1/stream", { "Last-Event-ID": "h0-d0" });
    const replayed = await readEvents(resumed, (list) => list.some((event) => event.event === "ride.updated"));
    expect((replayed.find((event) => event.event === "ride.updated")!.data as RideUpdated).changeId).toBe(
      message.changeId,
    );
  });

  it("読めないカーソルには、今の状態を changeId なしで丸ごと送る", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    await p.book((await p.estimate()).estimateId);
    const stream = await p.get("/api/v1/stream", { "Last-Event-ID": "garbage" });
    const events = await readEvents(stream, (list) => list.some((event) => event.event === "ride.updated"));
    const message = events.find((event) => event.event === "ride.updated")!.data as RideUpdated;
    expect(message.changeId).toBeNull();
    expect(message.ride.state).toBe("searching");
  });

  it("ログインしていなければ 401", async () => {
    h = await setup();
    const res = await h.app.request("/api/v1/stream");
    expect(res.status).toBe(401);
  });
});

describe("経路の上限とログ", () => {
  it("T_route で切って 503 ROUTE_TIMEOUT。中の処理は続き、同じキーの送り直しで最初の結果を受ける（DEC-33）", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h = await setup({
      config: { routeTimeoutMs: 100 },
      wrapPayments: (inner): PaymentGateway => ({
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
    const timedOut = await p.book(estimate.estimateId, key);
    expect(timedOut.status).toBe(503);
    expect(((await timedOut.json()) as Problem).code).toBe("ROUTE_TIMEOUT");
    release();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await p.book(estimate.estimateId, key)).status).toBe(201);
  });

  it("送り元がサービスの URL でなければ 403、ログインしていなければ 401", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const forbidden = await h.app.request("/api/v1/passenger/estimates", {
      method: "POST",
      headers: { Origin: "https://evil.example", Cookie: p.cookie, "Content-Type": "application/json" },
      body: "{}",
    });
    expect(forbidden.status).toBe(403);
    const anonymous = await h.app.request("/api/v1/passenger/rides/active");
    expect(anonymous.status).toBe(401);
    expect(((await anonymous.json()) as Problem).code).toBe("UNAUTHENTICATED");
    const wrongPassword = await h.app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "passenger@example.com", password: "wrong-password-0000" }),
    });
    expect(((await wrongPassword.json()) as Problem).code).toBe("INVALID_CREDENTIALS");
  });

  it("応答に X-App-Version と x-route-id、ログに request.completed と money.op を書き、座標と検索の語を書かない", async () => {
    h = await setup();
    const p = await h.loginAs("passenger@example.com");
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    await p.post(
      "/api/v1/passenger/places/search",
      { query: "渋谷", sessionToken: randomUUID() },
      { "X-Client-Trace-Id": traceId },
    );
    const res = await p.book((await p.estimate()).estimateId);
    expect(res.headers.get("x-app-version")).toBe("test-1");
    expect(res.headers.get("x-route-id")).toBe("passenger.rides.create");

    const completed = h.logger.entries.filter((entry) => entry.event === "request.completed");
    expect(completed.map((entry) => entry.route_id)).toEqual(
      expect.arrayContaining([
        "auth.login",
        "passenger.places.search",
        "passenger.estimates.create",
        "passenger.rides.create",
      ]),
    );
    expect(completed.find((entry) => entry.route_id === "passenger.places.search")).toMatchObject({
      client_trace_id: traceId,
      account_kind: "test",
      status: 200,
    });
    expect(h.logger.entries.filter((entry) => entry.event === "money.op").map((entry) => entry.step)).toEqual([
      "processing",
      "succeeded",
    ]);
    const serialized = JSON.stringify(h.logger.entries);
    expect(serialized).not.toContain("35.68");
    expect(serialized).not.toContain("渋谷");
    expect(serialized).not.toContain("passenger@example.com");
  });
});
