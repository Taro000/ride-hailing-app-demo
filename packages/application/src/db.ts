import { createClient, type Client, type InStatement, type ResultSet, type Transaction } from "@libsql/client";

// データの置き場所（DEC-08）。物理の形は設計にない（ELM-04 の詳細設計はまだない）ので、この実装で決めた。
// 時刻は UTC の ISO 8601 の文字（ミリ秒、Z）で持つ。DEC-40 は「持つ: UTC（形は第 4 段階）」とした。

const schemaV1 = `
CREATE TABLE accounts (
  account_id TEXT PRIMARY KEY,
  roles TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('invited', 'active')),
  test_account INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (account_id),
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE payment_refs (
  account_id TEXT PRIMARY KEY REFERENCES accounts (account_id),
  stripe_customer_id TEXT NOT NULL,
  default_payment_method_id TEXT
);
CREATE TABLE estimates (
  estimate_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('booking', 'destination_change')),
  pickup_json TEXT NOT NULL,
  dropoff_json TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  fare_json TEXT NOT NULL,
  eta_json TEXT NOT NULL,
  route_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_by_ride_id TEXT
);
CREATE TABLE routes (
  route_id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  ride_id TEXT,
  estimate_id TEXT,
  encoded_polyline TEXT NOT NULL,
  distance_m INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE TABLE rides (
  ride_id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL,
  driver_id TEXT,
  state TEXT NOT NULL,
  version INTEGER NOT NULL,
  pickup_json TEXT NOT NULL,
  dropoff_json TEXT NOT NULL,
  fare_booked INTEGER NOT NULL,
  fare_current INTEGER NOT NULL,
  eta_shown_json TEXT NOT NULL,
  threshold_at_booking REAL,
  threshold_current REAL,
  payment_status TEXT NOT NULL,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  cancelled_by TEXT,
  cancel_reason TEXT,
  estimate_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ended_at TEXT,
  test_account INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX rides_one_active_per_passenger ON rides (passenger_id)
  WHERE state IN ('booking', 'hold_checking', 'searching', 'accepted', 'arrived', 'in_progress');
CREATE INDEX rides_passenger ON rides (passenger_id, created_at);
CREATE TABLE ride_history (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  ride_id TEXT NOT NULL,
  type TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT,
  details_json TEXT,
  trace_id TEXT,
  test_account INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ride_history_ride ON ride_history (ride_id, seq);
CREATE TABLE money_ops (
  money_op_id TEXT PRIMARY KEY,
  ride_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  seq INTEGER NOT NULL,
  attempt INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  stripe_idempotency_key TEXT NOT NULL UNIQUE,
  stripe_object_id TEXT,
  status TEXT NOT NULL,
  lease_until TEXT,
  first_sent_at TEXT NOT NULL,
  last_sent_at TEXT NOT NULL,
  last_checked_at TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX money_ops_status ON money_ops (status);
CREATE UNIQUE INDEX money_ops_one_active_per_kind ON money_ops (ride_id, kind)
  WHERE status IN ('processing', 'checking');
CREATE TABLE idempotency_keys (
  account_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  route_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'pending', 'completed')),
  response_status INTEGER,
  response_body TEXT,
  resource_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (account_id, idempotency_key)
);
CREATE INDEX idempotency_keys_resource ON idempotency_keys (resource_id, status);
`;

export type Exec = { execute(stmt: InStatement): Promise<ResultSet> };

// 業務の断りでトランザクションを戻すときに投げる。write() の外で result を取り出す。
export class TxAbort<T> extends Error {
  readonly result: T;
  constructor(result: T) {
    super("transaction aborted");
    this.result = result;
  }
}

export interface Database {
  client: Client;
  // 書き込みのトランザクション。手元の libSQL は同時の BEGIN IMMEDIATE をすぐ SQLITE_BUSY で返すので、
  // この処理の中で一つずつに並べる（Turso の書き手も一つ。DEC-08）。
  write<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
  close(): void;
}

export interface DbOptions {
  url: string;
  authToken?: string | undefined;
  timeoutMs: number; // T_db（DEC-33）
}

export function openDatabase(options: DbOptions): Database {
  const remote = !options.url.startsWith("file:") && options.url !== ":memory:";
  const client = createClient({
    url: options.url,
    ...(options.authToken ? { authToken: options.authToken } : {}),
    // 手元のファイルは timeout が効く。Turso は fetch に中止のタイマーを付ける（DEC-33）。手元では確かめていない。
    timeout: options.timeoutMs,
    ...(remote
      ? {
          fetch: (input: string | URL | Request, init?: RequestInit) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(options.timeoutMs) }),
        }
      : {}),
  });
  let chain: Promise<unknown> = Promise.resolve();
  return {
    client,
    write<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
      const run = async (): Promise<T> => {
        const tx = await client.transaction("write");
        try {
          const result = await fn(tx);
          await tx.commit();
          return result;
        } catch (error) {
          await tx.rollback().catch(() => undefined);
          throw error;
        } finally {
          tx.close();
        }
      };
      const next = chain.then(run, run);
      chain = next.catch(() => undefined);
      return next;
    },
    close() {
      client.close();
    },
  };
}

export async function migrate(db: Database): Promise<void> {
  await db.client.execute("PRAGMA journal_mode = WAL").catch(() => undefined);
  await db.client.execute(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = await db.client.execute("SELECT version FROM schema_migrations WHERE version = 1");
  if (applied.rows.length > 0) return;
  await db.client.executeMultiple(schemaV1);
  await db.client.execute({
    sql: "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)",
    args: [new Date().toISOString()],
  });
}

export function iso(date: Date): string {
  return date.toISOString();
}
