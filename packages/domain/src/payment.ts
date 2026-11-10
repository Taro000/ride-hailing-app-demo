// 依頼の支払いの状態（13 値）とお金の操作の状態。報告書の二つの状態遷移図を表にした。

export type PaymentStateValue =
  | "none"
  | "holding"
  | "hold_checking"
  | "held"
  | "release_checking"
  | "released"
  | "capturing"
  | "checking"
  | "paid"
  | "unpaid"
  | "unpaid_checking"
  | "partially_refunded"
  | "refunded";

const paymentTransitions: Readonly<Record<PaymentStateValue, readonly PaymentStateValue[]>> = {
  none: [],
  holding: ["held", "none", "hold_checking"],
  hold_checking: ["held", "release_checking", "released", "none"],
  held: ["held", "released", "release_checking", "capturing"],
  release_checking: ["released"],
  released: [],
  capturing: ["paid", "unpaid", "checking"],
  checking: ["paid", "unpaid"],
  paid: ["partially_refunded", "refunded"],
  unpaid: ["paid", "unpaid_checking"],
  unpaid_checking: ["paid", "unpaid"],
  partially_refunded: ["partially_refunded", "refunded"],
  refunded: [],
};

export function canChangePayment(from: PaymentStateValue, to: PaymentStateValue): boolean {
  return paymentTransitions[from].includes(to);
}

export type MoneyOpStatus = "processing" | "succeeded" | "failed" | "checking" | "not_happened";

const moneyOpTransitions: Readonly<Record<MoneyOpStatus, readonly MoneyOpStatus[]>> = {
  processing: ["succeeded", "failed", "not_happened", "checking"],
  checking: ["succeeded", "failed", "not_happened", "checking"],
  succeeded: [],
  failed: [],
  not_happened: [],
};

export function canChangeMoneyOp(from: MoneyOpStatus, to: MoneyOpStatus): boolean {
  return moneyOpTransitions[from].includes(to);
}

// Stripe へのキー（IFC-13 の idempotency）。設計の「ride_<依頼 ID>_hold_…」の <依頼 ID> は ride_ を含む ID と読み、
// 接頭辞を二重にしない（例の ride_R_hold_1_a1 と同じ形になる）。
export function holdKey(rideId: string, holdSeq: number, attempt: number): string {
  return `${rideId}_hold_${holdSeq}_a${attempt}`;
}

export function cancelHoldKey(paymentIntentId: string): string {
  return `${paymentIntentId}_cancel`;
}
