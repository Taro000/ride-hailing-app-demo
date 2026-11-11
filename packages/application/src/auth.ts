import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Database } from "./db.ts";
import type { Clock, IdGenerator } from "./ports.ts";
import type { AppSettings } from "./settings.ts";

// 認証のモジュール（DAT-01、DAT-02 を書く唯一のモジュール）。DEC-20 はライブラリの候補を Better Auth とし
// 第 4 段階で決めるとしたが、この縦の一本はメールアドレスとパスワードとセッションだけなので、node:crypto で足りた。
// ログインの失敗の数と一時の停止（DEC-20 版 3、DEC-55）と設定の符号（FR-01 AC1・2）は作っていない。

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const scryptParams = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, scryptParams);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltText, hashText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const actual = await scrypt(password, Buffer.from(saltText, "base64url"), expected.length, scryptParams);
  return timingSafeEqual(expected, actual);
}

function sessionHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type Role = "passenger" | "driver" | "operator" | "engineer";

export interface AuthedAccount {
  accountId: string;
  roles: Role[];
  testAccount: boolean;
}

export type AccountKind = "participant" | "staff" | "test";

export function accountKind(account: AuthedAccount): AccountKind {
  if (account.testAccount) return "test";
  return account.roles.some((role) => role === "operator" || role === "engineer") ? "staff" : "participant";
}

export interface AuthDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  settings: AppSettings;
}

export type LoginResult =
  | { kind: "ok"; token: string; account: AuthedAccount; maxAgeSec: number }
  | { kind: "invalid" };

export async function login(deps: AuthDeps, email: string, password: string): Promise<LoginResult> {
  const found = await deps.db.client.execute({
    sql: "SELECT account_id, roles, password_hash, status, test_account FROM accounts WHERE email = ?",
    args: [email],
  });
  const row = found.rows[0];
  // どちらが違うかを言わない（FR-01 AC5）。アカウントがないときも同じ時間をかける。
  const stored = typeof row?.password_hash === "string" ? row.password_hash : null;
  const valid = await verifyPassword(password, stored ?? (await dummyHash()));
  if (!row || !stored || !valid || row.status !== "active") return { kind: "invalid" };

  const now = deps.clock.now();
  const token = deps.ids.newSecret();
  const expiresAt = new Date(now.getTime() + deps.settings.sessionIdleMs);
  await deps.db.write(async (tx) => {
    await tx.execute({
      sql: "INSERT INTO sessions (session_hash, account_id, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      args: [sessionHash(token), String(row.account_id), now.toISOString(), now.toISOString(), expiresAt.toISOString()],
    });
    await tx.execute({
      sql: "UPDATE accounts SET last_used_at = ? WHERE account_id = ?",
      args: [now.toISOString(), String(row.account_id)],
    });
  });
  return {
    kind: "ok",
    token,
    account: toAccount(row),
    maxAgeSec: Math.floor(deps.settings.sessionMaxMs / 1000),
  };
}

let cachedDummy: Promise<string> | null = null;
function dummyHash(): Promise<string> {
  cachedDummy ??= hashPassword("dummy-password-for-timing");
  return cachedDummy;
}

function toAccount(row: Record<string, unknown>): AuthedAccount {
  return {
    accountId: String(row.account_id),
    roles: String(row.roles).split(",") as Role[],
    testAccount: Number(row.test_account) === 1,
  };
}

// セッションを読み、最後に使った時刻を進める（最後に使ってから 24 時間、長くても 7 日。DEC-43）。
export async function authenticate(deps: AuthDeps, token: string): Promise<AuthedAccount | null> {
  const now = deps.clock.now();
  const found = await deps.db.client.execute({
    sql: `SELECT s.created_at, s.expires_at, a.account_id, a.roles, a.test_account
          FROM sessions s JOIN accounts a ON a.account_id = s.account_id
          WHERE s.session_hash = ? AND s.revoked_at IS NULL`,
    args: [sessionHash(token)],
  });
  const row = found.rows[0];
  if (!row) return null;
  const createdAt = new Date(String(row.created_at));
  if (now >= new Date(String(row.expires_at)) || now.getTime() - createdAt.getTime() >= deps.settings.sessionMaxMs) {
    return null;
  }
  const nextExpiry = Math.min(
    now.getTime() + deps.settings.sessionIdleMs,
    createdAt.getTime() + deps.settings.sessionMaxMs,
  );
  await deps.db.write((tx) =>
    tx.execute({
      sql: "UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE session_hash = ?",
      args: [now.toISOString(), new Date(nextExpiry).toISOString(), sessionHash(token)],
    }),
  );
  return toAccount(row);
}

export async function logout(deps: AuthDeps, token: string): Promise<void> {
  await deps.db.write((tx) =>
    tx.execute({
      sql: "UPDATE sessions SET revoked_at = ? WHERE session_hash = ? AND revoked_at IS NULL",
      args: [deps.clock.now().toISOString(), sessionHash(token)],
    }),
  );
}

export interface NewPassenger {
  email: string;
  name: string;
  password: string;
  testAccount?: boolean;
  stripeCustomerId?: string;
  defaultPaymentMethodId?: string | null;
}

// 運営・サポート担当がアカウントを作り設定の符号でパスワードを決める流れ（FR-48、FR-01 AC1）は縦の一本の外。
// 手元とテストでは、パスワードを決め終えた乗客をこの関数で直接作る。
export async function createPassenger(deps: AuthDeps, input: NewPassenger): Promise<string> {
  const accountId = deps.ids.newId("acc");
  const now = deps.clock.now().toISOString();
  const passwordHash = await hashPassword(input.password);
  await deps.db.write(async (tx) => {
    await tx.execute({
      sql: `INSERT INTO accounts (account_id, roles, name, email, password_hash, status, test_account, created_at)
            VALUES (?, 'passenger', ?, ?, ?, 'active', ?, ?)`,
      args: [accountId, input.name, input.email, passwordHash, input.testAccount ? 1 : 0, now],
    });
    if (input.stripeCustomerId) {
      await tx.execute({
        sql: "INSERT INTO payment_refs (account_id, stripe_customer_id, default_payment_method_id) VALUES (?, ?, ?)",
        args: [accountId, input.stripeCustomerId, input.defaultPaymentMethodId ?? null],
      });
    }
  });
  return accountId;
}

export function newSessionSecret(): string {
  return randomBytes(32).toString("base64url");
}
