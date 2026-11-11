import type { PassengerRide } from "@ride/contracts";
import { describe, expect, it } from "vitest";
import { classify } from "../src/useOperation.ts";
import { applyUpdate, describeRide } from "../src/rideView.ts";

const base: PassengerRide = {
  rideId: "ride_01M71TEVX39YGH5WXRSW2EW4GA",
  state: "hold_checking",
  version: 2,
  pickup: { label: "東京駅", address: null, placeId: null, position: { lat: 35.68, lng: 139.76 } },
  dropoff: { label: "渋谷駅", address: null, placeId: null, position: { lat: 35.65, lng: 139.7 } },
  fare: { booked: { amount: 4952, currency: "jpy" }, current: { amount: 4952, currency: "jpy" } },
  eta: null,
  threshold: null,
  payment: { state: "hold_checking", unpaidAmount: null, reason: null },
  cancellation: null,
  cancelRequested: false,
  createdAt: "2026-11-10T03:00:00.000Z",
  updatedAt: "2026-11-10T03:00:00.000Z",
};

describe("配信の重なりと順の入れ替わり", () => {
  it("古い version を捨てる", () => {
    const newer = { ...base, state: "searching" as const, version: 3 };
    expect(applyUpdate(newer, base)).toBe(newer);
    expect(applyUpdate(base, newer)).toBe(newer);
  });
});

describe("手配の状況の文（FR-05 AC4）", () => {
  it("確かめ中は「支払いを確かめています」と取り消し", () => {
    expect(describeRide(base)).toMatchObject({ title: "支払いを確かめています", canCancel: true });
  });

  it("手配をやめて押さえが分からない間は「押さえが残っていれば解放します」", () => {
    const stopped = { ...base, state: "not_booked" as const };
    expect(describeRide(stopped).title).toBe("手配をやめました。押さえが残っていれば解放します");
    expect(describeRide(stopped).finished).toBe(false);
  });

  it("「押さえていません」は Stripe が答えた（none）ときだけ", () => {
    const none = { ...base, state: "not_booked" as const, payment: { ...base.payment, state: "none" as const } };
    expect(describeRide(none).title).toBe("手配をやめました。押さえていません");
    const released = { ...none, payment: { ...base.payment, state: "released" as const } };
    expect(describeRide(released).title).toBe("手配をやめました。押さえを解放しました");
  });
});

describe("操作の結果の分け方（MOD-20 の判断表の一部）", () => {
  const answered = (status: number, code: string) =>
    ({
      ok: false,
      error: {
        kind: "answered",
        status,
        retryAfterSeconds: null,
        problem: { type: "", title: "", status, code, traceId: "t" },
      },
    }) as const;

  it.each([
    [answered(402, "CARD_DECLINED"), "rejected"],
    [answered(409, "ACTIVE_RIDE_EXISTS"), "rejected"],
    [answered(503, "PAYMENTS_UNAVAILABLE"), "waiting"],
    [answered(503, "ROUTE_TIMEOUT"), "unknown"],
    [answered(401, "UNAUTHENTICATED"), "needs_login"],
    [answered(422, "IDEMPOTENCY_KEY_REUSED"), "key_reused"],
    [answered(404, "NOT_FOUND"), "stopped"],
  ] as const)("%j → %s", (result, kind) => {
    expect(classify(result).kind).toBe(kind);
  });

  it("202 は結果待ち（キーを保つ）", () => {
    expect(classify({ ok: true, status: 202, data: {} }).kind).toBe("pending");
  });
});
