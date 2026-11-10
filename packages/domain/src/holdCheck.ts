// 押さえの結果が分からないときの確かめ（DEC-52、第 2 段階の DEC-12 の (d)）。
// 設計は手順図（CUJ-01-B の alt）と文で書いており、判断表はない。ここで入力と行いを表にした。

export type HoldLookup =
  | { kind: "unavailable" }
  | { kind: "absent" }
  | { kind: "found"; status: "held" | "declined" | "canceled" };

export type HoldLastError = "timeout" | "connection_lost" | "stripe_5xx" | "stripe_409" | "stale";

export interface HoldCheckInput {
  now: Date;
  rideState: "hold_checking" | "not_booked" | "other";
  rideCreatedAt: Date;
  holdWaitMs: number;
  opFirstSentAt: Date;
  // 最後に送った時刻。同じキーで送り直すと進む。DAT-13 には first_sent_at しかないので、この実装で足した
  // （送り直した要求がまだ動いているうちに「押さえはない」と決めないため）。
  opLastSentAt: Date;
  opStaleMs: number;
  lastError: HoldLastError | null;
  lookup: HoldLookup;
}

export type HoldCheckAction =
  | "confirm"
  | "release"
  | "already_released"
  | "declined"
  | "absent"
  | "resend_same_key"
  | "retry_new_attempt"
  | "wait";

export function holdWaitDeadline(rideCreatedAt: Date, holdWaitMs: number): Date {
  return new Date(rideCreatedAt.getTime() + holdWaitMs);
}

// | 照らした結果 | 依頼 | 時刻 | 前の誤り | 行い |
// |---|---|---|---|---|
// | 答えない | — | — | — | wait |
// | 押さえあり | hold_checking | T_hold_wait の内 | — | confirm |
// | 押さえあり | それ以外 | — | — | release |
// | 取り消し済み | — | — | — | already_released |
// | 断られた | — | — | — | declined（設計にない行。実装で決めた） |
// | なし | hold_checking | T_hold_wait の内 | 5xx | T_op_stale を過ぎたら retry_new_attempt、まだなら wait |
// | なし | hold_checking | T_hold_wait の内 | 5xx 以外 | resend_same_key |
// | なし | それ以外 | — | — | 最後の送信から T_op_stale を過ぎたら absent、まだなら wait |
export function decideHoldCheck(input: HoldCheckInput): HoldCheckAction {
  const { lookup } = input;
  if (lookup.kind === "unavailable") return "wait";

  const withinWait =
    input.rideState === "hold_checking" &&
    input.now.getTime() < holdWaitDeadline(input.rideCreatedAt, input.holdWaitMs).getTime();
  const firstRequestOver = input.now.getTime() >= input.opFirstSentAt.getTime() + input.opStaleMs;
  const lastRequestOver = input.now.getTime() >= input.opLastSentAt.getTime() + input.opStaleMs;

  if (lookup.kind === "found") {
    if (lookup.status === "canceled") return "already_released";
    if (lookup.status === "declined") return "declined";
    return withinWait ? "confirm" : "release";
  }

  if (withinWait) {
    if (input.lastError === "stripe_5xx") return firstRequestOver ? "retry_new_attempt" : "wait";
    return "resend_same_key";
  }
  return lastRequestOver ? "absent" : "wait";
}
