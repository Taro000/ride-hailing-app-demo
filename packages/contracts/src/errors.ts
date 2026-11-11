// 誤りの符号と日本語の文（DEC-38、DEC-46）。画面もサーバーもここだけを読む。
// 文は IFC-02 の「場合」をもとに、利用者に示せる形に縮めた（報告書の表と OpenAPI の例は場合の説明で、そのまま画面に出せない）。

export const problemCatalog = {
  INVALID_REQUEST: { status: 400, title: "入力の形が正しくありません" },
  UNAUTHENTICATED: { status: 401, title: "ログインしてください" },
  INVALID_CREDENTIALS: { status: 401, title: "メールアドレスかパスワードが違います" },
  FORBIDDEN: { status: 403, title: "この操作はできません" },
  NOT_FOUND: { status: 404, title: "見つかりません" },
  OPERATION_IN_PROGRESS: { status: 409, title: "同じ操作を処理しています" },
  PAYMENT_METHOD_REQUIRED: { status: 409, title: "支払い手段を登録してください" },
  ACTIVE_RIDE_EXISTS: { status: 409, title: "進行中の手配があります" },
  UNPAID_RIDE_EXISTS: { status: 409, title: "未払いの乗車があります" },
  ESTIMATE_EXPIRED: { status: 409, title: "見積もりの期限が切れました。見積もり直してください" },
  CANCELLATION_FEE_CHANGED: { status: 409, title: "取り消しの額が変わりました" },
  RIDE_ALREADY_STARTED: { status: 409, title: "乗車が始まっています" },
  RIDE_ALREADY_ENDED: { status: 409, title: "この手配はもう終わっています" },
  CARD_DECLINED: { status: 402, title: "カードで押さえられませんでした。別の支払い手段を選んでください" },
  CARD_AUTHENTICATION_REQUIRED: {
    status: 402,
    title: "カードの本人確認が必要なため押さえられませんでした。別の支払い手段を選んでください",
  },
  NO_ROUTE: { status: 422, title: "乗る場所と降りる場所の間に経路がありません" },
  PICKUP_NOT_CONFIRMED: { status: 422, title: "乗る場所を地図で確かめてください" },
  IDEMPOTENCY_KEY_REUSED: { status: 422, title: "操作をやり直してください" },
  RATE_LIMITED: { status: 429, title: "操作が多すぎます。少し待ってください" },
  INTERNAL_ERROR: { status: 500, title: "予期しない誤りが起きました" },
  MAPS_UNAVAILABLE: { status: 503, title: "地図のサービスが使えません" },
  PAYMENTS_UNAVAILABLE: { status: 503, title: "決済のサービスが混み合っています。押さえていません" },
  ROUTE_TIMEOUT: { status: 503, title: "時間内に処理を終えられませんでした" },
  DEPENDENCY_UNAVAILABLE: { status: 503, title: "一時的に処理できません" },
} as const satisfies Record<string, { status: number; title: string }>;

export type ProblemCode = keyof typeof problemCatalog;

export const pendingCatalog = {
  HOLD_PENDING: "支払いを確かめています",
  HOLD_RELEASE_PENDING: "手配をやめました。押さえが残っていれば解放します",
} as const;

export type PendingCode = keyof typeof pendingCatalog;

// 欄の誤りの符号（Problem.errors[].code）。設計は形（field は JSON Pointer、code、message）だけを決め、符号の一覧を持たない。
export const fieldErrorCatalog = {
  REQUIRED: "入力してください",
  INVALID: "形が正しくありません",
  TOO_LONG: "長すぎます",
  OUT_OF_RANGE: "範囲の外です",
} as const;

export type FieldErrorCode = keyof typeof fieldErrorCatalog;

export function problemText(code: string): string {
  return code in problemCatalog ? problemCatalog[code as ProblemCode].title : problemCatalog.INTERNAL_ERROR.title;
}

export function problemType(code: string): string {
  return `urn:ride-hailing-demo:problem:${code.toLowerCase()}`;
}
