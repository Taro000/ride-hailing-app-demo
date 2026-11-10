import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// CUJ-01 配車手配の縦の一本（ELM-01 → ELM-04 → 偽物の Stripe と地図）。
const password = "demo-password-123";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログインする" }).click();
  await expect(page.getByRole("heading", { name: "配車を手配する" })).toBeVisible();
}

async function choosePlace(page: Page, label: "乗る場所" | "降りる場所", query: string, name: RegExp) {
  const region = page.getByRole("region", { name: label });
  await region.getByLabel(`${label}を探す`).fill(query);
  await region.getByRole("button", { name: "探す" }).click();
  await region.getByRole("button", { name }).click();
  await expect(region.getByRole("button", { name: "変える" })).toBeVisible();
}

async function choosePlaces(page: Page) {
  await choosePlace(page, "乗る場所", "東京", /東京駅/);
  await choosePlace(page, "降りる場所", "渋谷", /渋谷駅/);
  await expect(page.locator(".fare-total")).toHaveText(/^[\d,]+ 円$/);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

test("主な流れ: 場所を決め、料金を確かめ、手配すると「ドライバーを探しています」。取り消すと押さえを解放する", async ({
  page,
}) => {
  await login(page, "passenger@example.com");
  await expectNoAxeViolations(page);
  await choosePlaces(page);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "手配する" }).click();
  await expect(page.getByRole("heading", { name: "手配の状況" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("ドライバーを探しています");
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "取り消す（無料）" }).click();
  await expect(page.getByRole("status")).toContainText("取り消しました。押さえを解放しました");
});

test("失敗の流れ 1: 押さえの結果が分からなくても、見回りが押さえを見つけたら配信で「ドライバーを探しています」に変わる", async ({
  page,
}) => {
  await login(page, "timeout@example.com");
  await choosePlaces(page);
  await page.getByRole("button", { name: "手配する" }).click();
  await expect(page.getByRole("status")).toContainText("支払いを確かめています");
  await expect(page.getByRole("status")).toContainText("ドライバーを探しています", { timeout: 10_000 });
});

test("失敗の流れ 2: Stripe が答えないまま T_hold_wait を過ぎたら手配をやめ、押さえがないと分かってから「押さえていません」", async ({
  page,
}) => {
  await login(page, "lost@example.com");
  await choosePlaces(page);
  await page.getByRole("button", { name: "手配する" }).click();
  await expect(page.getByRole("status")).toContainText("支払いを確かめています");
  await expect(page.getByRole("status")).toContainText("手配をやめました。押さえが残っていれば解放します", {
    timeout: 15_000,
  });
  await expect(page.getByRole("status")).toContainText("手配をやめました。押さえていません", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "新しく手配する" })).toBeVisible();
});

test("失敗の流れ 3: 確かめ中に取り消すと手配をやめ、後で見つかった押さえを解放する", async ({ page }) => {
  await login(page, "unresponsive@example.com");
  await choosePlaces(page);
  await page.getByRole("button", { name: "手配する" }).click();
  await expect(page.getByRole("status")).toContainText("支払いを確かめています");
  await page.getByRole("button", { name: "手配をやめる" }).click();
  await expect(page.getByRole("status")).toContainText("手配をやめました。押さえが残っていれば解放します");
  await expect(page.getByRole("status")).toContainText("手配をやめました。押さえを解放しました", { timeout: 15_000 });
});

test("押さえを断られたら、理由と問い合わせ番号を示す", async ({ page }) => {
  await login(page, "declined@example.com");
  await choosePlaces(page);
  await page.getByRole("button", { name: "手配する" }).click();
  await expect(page.getByRole("alert")).toContainText("カードで押さえられませんでした");
  await expect(page.getByRole("alert")).toContainText("問い合わせ番号");
});
