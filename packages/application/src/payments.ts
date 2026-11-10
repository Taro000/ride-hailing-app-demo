import { canChangeMoneyOp, type HoldLastError, type MoneyOpStatus } from "@ride/domain";
import type { Database, Exec } from "./db.ts";

// 支払いのモジュール（DAT-12、DAT-13 を書く唯一のモジュール）。

export interface PaymentRef {
  stripeCustomerId: string;
  defaultPaymentMethodId: string | null;
}

export async function getPaymentRef(exec: Exec, accountId: string): Promise<PaymentRef | null> {
  const found = await exec.execute({
    sql: "SELECT stripe_customer_id, default_payment_method_id FROM payment_refs WHERE account_id = ?",
    args: [accountId],
  });
  const row = found.rows[0];
  if (!row) return null;
  return {
    stripeCustomerId: String(row.stripe_customer_id),
    defaultPaymentMethodId: row.default_payment_method_id === null ? null : String(row.default_payment_method_id),
  };
}

export type MoneyOpKind = "hold" | "cancel_hold";

export interface MoneyOpRow {
  moneyOpId: string;
  rideId: string;
  kind: MoneyOpKind;
  seq: number;
  attempt: number;
  amount: number;
  stripeIdempotencyKey: string;
  stripeObjectId: string | null;
  status: MoneyOpStatus;
  leaseUntil: string | null;
  firstSentAt: string;
  lastSentAt: string;
  errorCode: string | null;
}

function rowToOp(row: Record<string, unknown>): MoneyOpRow {
  return {
    moneyOpId: String(row.money_op_id),
    rideId: String(row.ride_id),
    kind: String(row.kind) as MoneyOpKind,
    seq: Number(row.seq),
    attempt: Number(row.attempt),
    amount: Number(row.amount),
    stripeIdempotencyKey: String(row.stripe_idempotency_key),
    stripeObjectId: row.stripe_object_id === null ? null : String(row.stripe_object_id),
    status: String(row.status) as MoneyOpStatus,
    leaseUntil: row.lease_until === null ? null : String(row.lease_until),
    firstSentAt: String(row.first_sent_at),
    lastSentAt: String(row.last_sent_at),
    errorCode: row.error_code === null ? null : String(row.error_code),
  };
}

export interface NewMoneyOp {
  moneyOpId: string;
  rideId: string;
  kind: MoneyOpKind;
  seq: number;
  attempt: number;
  amount: number;
  stripeIdempotencyKey: string;
  stripeObjectId?: string | null;
  now: Date;
}

export async function insertMoneyOp(exec: Exec, op: NewMoneyOp): Promise<MoneyOpRow> {
  const now = op.now.toISOString();
  await exec.execute({
    sql: `INSERT INTO money_ops (money_op_id, ride_id, kind, seq, attempt, amount, stripe_idempotency_key,
            stripe_object_id, status, first_sent_at, last_sent_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)`,
    args: [
      op.moneyOpId,
      op.rideId,
      op.kind,
      op.seq,
      op.attempt,
      op.amount,
      op.stripeIdempotencyKey,
      op.stripeObjectId ?? null,
      now,
      now,
      now,
      now,
    ],
  });
  const created = await getMoneyOp(exec, op.moneyOpId);
  if (!created) throw new Error("money op insert failed");
  return created;
}

export async function getMoneyOp(exec: Exec, moneyOpId: string): Promise<MoneyOpRow | null> {
  const found = await exec.execute({ sql: "SELECT * FROM money_ops WHERE money_op_id = ?", args: [moneyOpId] });
  return found.rows[0] ? rowToOp(found.rows[0]) : null;
}

export class MoneyOpConflictError extends Error {}

export interface MoneyOpChange {
  status: MoneyOpStatus;
  stripeObjectId?: string | null;
  errorCode?: HoldLastError | string | null;
}

export async function changeMoneyOp(exec: Exec, op: MoneyOpRow, change: MoneyOpChange, now: Date): Promise<MoneyOpRow> {
  if (change.status !== op.status && !canChangeMoneyOp(op.status, change.status)) {
    throw new Error(`money op transition not allowed: ${op.status} -> ${change.status}`);
  }
  const updated = await exec.execute({
    sql: `UPDATE money_ops SET status = ?, stripe_object_id = ?, error_code = ?, last_checked_at = ?, updated_at = ?
          WHERE money_op_id = ? AND status = ?`,
    args: [
      change.status,
      change.stripeObjectId === undefined ? op.stripeObjectId : change.stripeObjectId,
      change.errorCode === undefined ? op.errorCode : change.errorCode,
      now.toISOString(),
      now.toISOString(),
      op.moneyOpId,
      op.status,
    ],
  });
  if (updated.rowsAffected !== 1) throw new MoneyOpConflictError(op.moneyOpId);
  const after = await getMoneyOp(exec, op.moneyOpId);
  if (!after) throw new Error("money op vanished");
  return after;
}

// 同じキーで送り直す前に、送った時刻を残す（呼び出しの途中で止まっても残る）。
export async function markSent(exec: Exec, op: MoneyOpRow, now: Date): Promise<void> {
  await exec.execute({
    sql: "UPDATE money_ops SET last_sent_at = ?, updated_at = ? WHERE money_op_id = ?",
    args: [now.toISOString(), now.toISOString(), op.moneyOpId],
  });
}

export async function findOpsByStatus(exec: Exec, status: MoneyOpStatus, kind: MoneyOpKind): Promise<MoneyOpRow[]> {
  const found = await exec.execute({
    sql: "SELECT * FROM money_ops WHERE status = ? AND kind = ? ORDER BY created_at",
    args: [status, kind],
  });
  return found.rows.map(rowToOp);
}

export async function findActiveOp(exec: Exec, rideId: string, kind: MoneyOpKind): Promise<MoneyOpRow | null> {
  const found = await exec.execute({
    sql: "SELECT * FROM money_ops WHERE ride_id = ? AND kind = ? AND status IN ('processing', 'checking')",
    args: [rideId, kind],
  });
  return found.rows[0] ? rowToOp(found.rows[0]) : null;
}

export async function findSucceededHold(exec: Exec, rideId: string): Promise<MoneyOpRow | null> {
  const found = await exec.execute({
    sql: "SELECT * FROM money_ops WHERE ride_id = ? AND kind = 'hold' AND status = 'succeeded' ORDER BY seq DESC LIMIT 1",
    args: [rideId],
  });
  return found.rows[0] ? rowToOp(found.rows[0]) : null;
}

// 確かめ中を片付けるのは、リースを条件付きの書き込みで取った一つだけ（見回りが二つ並んでも一つ。DAT-13）。
export async function acquireLease(db: Database, op: MoneyOpRow, now: Date, leaseMs: number): Promise<boolean> {
  const result = await db.write((tx) =>
    tx.execute({
      sql: `UPDATE money_ops SET lease_until = ?
            WHERE money_op_id = ? AND status IN ('processing', 'checking') AND (lease_until IS NULL OR lease_until <= ?)`,
      args: [new Date(now.getTime() + leaseMs).toISOString(), op.moneyOpId, now.toISOString()],
    }),
  );
  return result.rowsAffected === 1;
}

export async function releaseLease(db: Database, op: MoneyOpRow): Promise<void> {
  await db.write((tx) =>
    tx.execute({ sql: "UPDATE money_ops SET lease_until = NULL WHERE money_op_id = ?", args: [op.moneyOpId] }),
  );
}
