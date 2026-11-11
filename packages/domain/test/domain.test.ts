import { describe, expect, it } from "vitest";
import {
  canChangePayment,
  canTransition,
  computeFare,
  decideHoldCheck,
  demoFareTable,
  holdKey,
  isActive,
  type HoldCheckInput,
} from "../src/index.ts";

describe("配車依頼の状態遷移表", () => {
  it("押さえの結果で三つに分かれる", () => {
    expect(canTransition("booking", "searching")).toBe(true);
    expect(canTransition("booking", "not_booked")).toBe(true);
    expect(canTransition("booking", "hold_checking")).toBe(true);
  });

  it("確かめ中からは searching か not_booked だけに出る", () => {
    expect(canTransition("hold_checking", "searching")).toBe(true);
    expect(canTransition("hold_checking", "not_booked")).toBe(true);
    expect(canTransition("hold_checking", "cancelled")).toBe(false);
  });

  it("終わった状態から出ない", () => {
    for (const state of ["not_booked", "ended", "cancelled", "no_show"] as const) {
      expect(canTransition(state, "searching")).toBe(false);
    }
  });

  it("ACTIVE_RIDE_EXISTS に not_booked を数えない", () => {
    expect(isActive("hold_checking")).toBe(true);
    expect(isActive("not_booked")).toBe(false);
  });

  it("支払いの状態の図にない変化を許さない", () => {
    expect(canChangePayment("hold_checking", "none")).toBe(true);
    expect(canChangePayment("hold_checking", "release_checking")).toBe(true);
    expect(canChangePayment("released", "held")).toBe(false);
  });
});

describe("料金（R_fare）", () => {
  it("基本料金、距離、時間、迎車料金、アプリ手配料を足す", () => {
    // 8.39 km → 8.4 km × 330 = 2,772 円、1,645 秒 → 28 分 × 60 = 1,680 円
    const fare = computeFare(8390, 1645, demoFareTable);
    expect(fare).toEqual({ total: 4952, base: 100, distance: 2772, time: 1680, pickupFee: 300, bookingFee: 100 });
  });

  it("0 m、0 秒でも固定の料金はかかる", () => {
    expect(computeFare(0, 0, demoFareTable).total).toBe(500);
  });

  it("負の値は受けない", () => {
    expect(() => computeFare(-1, 0, demoFareTable)).toThrow(RangeError);
  });
});

describe("押さえのキー", () => {
  it("依頼の ID、何番目か、試みの何回目か", () => {
    expect(holdKey("ride_01ABC", 1, 2)).toBe("ride_01ABC_hold_1_a2");
  });
});

describe("押さえの確かめの判断表（DEC-52）", () => {
  const base: HoldCheckInput = {
    now: new Date("2026-11-10T00:00:30.000Z"),
    rideState: "hold_checking",
    rideCreatedAt: new Date("2026-11-10T00:00:00.000Z"),
    holdWaitMs: 60_000,
    opFirstSentAt: new Date("2026-11-10T00:00:00.000Z"),
    opLastSentAt: new Date("2026-11-10T00:00:00.000Z"),
    opStaleMs: 30_000,
    lastError: "timeout",
    lookup: { kind: "absent" },
  };
  const at = (seconds: number) => new Date(base.rideCreatedAt.getTime() + seconds * 1000);

  it.each([
    ["Stripe が答えない", { lookup: { kind: "unavailable" } }, "wait"],
    ["押さえがあり、T_hold_wait の内", { lookup: { kind: "found", status: "held" } }, "confirm"],
    [
      "押さえがあるが、手配をやめていた",
      { rideState: "not_booked", lookup: { kind: "found", status: "held" } },
      "release",
    ],
    ["押さえがあるが、T_hold_wait を過ぎた", { now: at(61), lookup: { kind: "found", status: "held" } }, "release"],
    ["取り消し済み", { rideState: "not_booked", lookup: { kind: "found", status: "canceled" } }, "already_released"],
    ["断られていた", { lookup: { kind: "found", status: "declined" } }, "declined"],
    ["なし、タイムアウトの後、T_hold_wait の内", {}, "resend_same_key"],
    ["なし、5xx の後、T_op_stale の前", { now: at(10), lastError: "stripe_5xx" }, "wait"],
    ["なし、5xx の後、T_op_stale を過ぎた", { now: at(31), lastError: "stripe_5xx" }, "retry_new_attempt"],
    ["なし、手配をやめた、T_op_stale の前", { rideState: "not_booked", now: at(10) }, "wait"],
    ["なし、手配をやめた、T_op_stale を過ぎた", { rideState: "not_booked", now: at(31) }, "absent"],
    [
      "なし、手配をやめた、最初の送信からは過ぎたが送り直しからはまだ",
      { rideState: "not_booked", now: at(70), opLastSentAt: at(55) },
      "wait",
    ],
  ] as const)("%s", (_name, change, expected) => {
    expect(decideHoldCheck({ ...base, ...(change as Partial<HoldCheckInput>) })).toBe(expected);
  });
});
