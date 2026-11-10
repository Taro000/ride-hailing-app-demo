import type { Exec } from "./db.ts";
import type { ApiResult } from "./result.ts";

// 冪等性のモジュール（DAT-14 を書く唯一のモジュール。DEC-48）。

export type KeyLookup =
  | { kind: "new" }
  | { kind: "replay"; result: ApiResult }
  | { kind: "in_progress" }
  | { kind: "reused" };

export interface KeyRef {
  accountId: string;
  key: string;
}

export async function lookupKey(exec: Exec, ref: KeyRef, routeId: string, requestHash: string): Promise<KeyLookup> {
  const found = await exec.execute({
    sql: `SELECT route_id, request_hash, status, response_status, response_body
          FROM idempotency_keys WHERE account_id = ? AND idempotency_key = ?`,
    args: [ref.accountId, ref.key],
  });
  const row = found.rows[0];
  if (!row) return { kind: "new" };
  if (row.route_id !== routeId || row.request_hash !== requestHash) return { kind: "reused" };
  if (row.status === "processing") return { kind: "in_progress" };
  return {
    kind: "replay",
    result: { status: Number(row.response_status), body: JSON.parse(String(row.response_body)) },
  };
}

export class KeyConflictError extends Error {}

// 一つ目のトランザクションで処理中として書く。同時の二つ目は一意の制約で落ちる（409 OPERATION_IN_PROGRESS）。
export async function insertProcessing(
  exec: Exec,
  ref: KeyRef,
  routeId: string,
  requestHash: string,
  now: Date,
  keepMs: number,
  resourceId: string | null,
): Promise<void> {
  try {
    await exec.execute({
      sql: `INSERT INTO idempotency_keys
              (account_id, idempotency_key, route_id, request_hash, status, resource_id, created_at, expires_at)
            VALUES (?, ?, ?, ?, 'processing', ?, ?, ?)`,
      args: [
        ref.accountId,
        ref.key,
        routeId,
        requestHash,
        resourceId,
        now.toISOString(),
        new Date(now.getTime() + keepMs).toISOString(),
      ],
    });
  } catch (error) {
    if (String((error as { code?: string }).code ?? error).includes("CONSTRAINT")) throw new KeyConflictError();
    throw error;
  }
}

export async function saveResult(
  exec: Exec,
  ref: KeyRef,
  status: "pending" | "completed",
  result: ApiResult,
): Promise<void> {
  await exec.execute({
    sql: `UPDATE idempotency_keys SET status = ?, response_status = ?, response_body = ?
          WHERE account_id = ? AND idempotency_key = ?`,
    args: [status, result.status, JSON.stringify(result.body), ref.accountId, ref.key],
  });
}

// 手配の押さえで Stripe が実行しなかったか届かなかったときの 503 は、キーの最初の結果にしない（DEC-48 の例外）。
export async function releaseKey(exec: Exec, ref: KeyRef): Promise<void> {
  await exec.execute({
    sql: "DELETE FROM idempotency_keys WHERE account_id = ? AND idempotency_key = ?",
    args: [ref.accountId, ref.key],
  });
}

// 結果待ちのキーを、確かめで定まった結果に替える（「確定したら最初の結果を確定したものに替える」）。
export async function settlePending(exec: Exec, resourceId: string, routeId: string, result: ApiResult): Promise<void> {
  await exec.execute({
    sql: `UPDATE idempotency_keys SET status = 'completed', response_status = ?, response_body = ?
          WHERE resource_id = ? AND route_id = ? AND status IN ('pending', 'processing')`,
    args: [result.status, JSON.stringify(result.body), resourceId, routeId],
  });
}

export async function markPendingForResource(
  exec: Exec,
  resourceId: string,
  routeId: string,
  result: ApiResult,
): Promise<void> {
  await exec.execute({
    sql: `UPDATE idempotency_keys SET status = 'pending', response_status = ?, response_body = ?
          WHERE resource_id = ? AND route_id = ? AND status = 'processing'`,
    args: [result.status, JSON.stringify(result.body), resourceId, routeId],
  });
}
