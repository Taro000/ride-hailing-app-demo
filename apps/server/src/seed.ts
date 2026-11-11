import { createPassenger, type AuthDeps } from "@ride/application";

// 手元と画面の自動テストのための乗客（設定の符号でパスワードを決め終えた形）。支払い手段は偽物の Stripe の筋書き
// （adapters の demoPaymentMethods）を選ぶ。運営・サポート担当がアカウントを作る流れ（FR-48）は縦の一本の外。
export const demoPassengers = [
  { email: "passenger@example.com", name: "乗客 一郎", paymentMethodId: "pm_card_visa" },
  { email: "timeout@example.com", name: "乗客 二郎", paymentMethodId: "pm_fake_timeout_after_create" },
  { email: "lost@example.com", name: "乗客 三郎", paymentMethodId: "pm_fake_lost" },
  { email: "unresponsive@example.com", name: "乗客 四郎", paymentMethodId: "pm_fake_unresponsive" },
  { email: "declined@example.com", name: "乗客 五郎", paymentMethodId: "pm_card_chargeDeclined" },
  { email: "nocard@example.com", name: "乗客 六郎", paymentMethodId: null },
] as const;

export const demoPassword = "demo-password-123";

export async function seedDemo(deps: AuthDeps): Promise<void> {
  const existing = await deps.db.client.execute("SELECT COUNT(*) AS n FROM accounts");
  if (Number(existing.rows[0]?.n ?? 0) > 0) return;
  for (const [index, passenger] of demoPassengers.entries()) {
    await createPassenger(deps, {
      email: passenger.email,
      name: passenger.name,
      password: demoPassword,
      testAccount: true,
      stripeCustomerId: `cus_fake_${String(index + 1).padStart(4, "0")}`,
      defaultPaymentMethodId: passenger.paymentMethodId,
    });
  }
}
