import { problemText, type Money, type Problem } from "@ride/contracts";

// WS-TEXT（文言と表し方。DEC-46）。額は「1,234 円」、時刻は HH:mm（日本時間）、到着予定は分の単位。

const yen = new Intl.NumberFormat("ja-JP");
const timeJst = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatYen(money: Money): string {
  return `${yen.format(money.amount)} 円`;
}

export function formatTimeJst(iso: string): string {
  return timeJst.format(new Date(iso));
}

export function formatMinutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} 分`;
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;
}

export function problemMessage(problem: Pick<Problem, "code">): string {
  return problemText(problem.code);
}
