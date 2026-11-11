import type { Problem } from "@ride/contracts";
import type { ApiRequest, CallResult, Operation } from "@ride/web-shared";
import { useCallback, useRef, useState } from "react";
import { api } from "./api.ts";

// 状態を変える操作の進め方（ELM-03 の MOD-20 と同じ判断表を、この縦の一本が使う行だけ持つ）。
// 結果が分からないうちは同じ冪等キーを持ち続け、定まった結果で閉じる（DEC-48）。

export type Outcome<T> =
  | { kind: "done"; status: number; data: T }
  | { kind: "pending"; data: T }
  | { kind: "rejected"; problem: Problem }
  | { kind: "needs_login" }
  | { kind: "waiting"; problem: Problem; retryAfterSeconds: number | null }
  | { kind: "stopped"; problem: Problem }
  | { kind: "key_reused"; problem: Problem }
  | { kind: "unknown"; traceId: string };

export function classify<T>(result: CallResult<T>): Outcome<T> {
  if (result.ok)
    return result.status === 202
      ? { kind: "pending", data: result.data }
      : { kind: "done", status: result.status, data: result.data };
  const error = result.error;
  if (error.kind === "unknown") return { kind: "unknown", traceId: error.traceId };
  const { problem } = error;
  if (error.status === 401) return { kind: "needs_login" };
  // 503 PAYMENTS_UNAVAILABLE は「押さえていない」と分かっている。Retry-After の後に同じキーで送れる（IFC-02）。
  if (error.status === 429 || problem.code === "PAYMENTS_UNAVAILABLE") {
    return { kind: "waiting", problem, retryAfterSeconds: error.retryAfterSeconds };
  }
  if (error.status === 403 || error.status === 404) return { kind: "stopped", problem };
  if (problem.code === "IDEMPOTENCY_KEY_REUSED") return { kind: "key_reused", problem };
  // ROUTE_TIMEOUT、DEPENDENCY_UNAVAILABLE、INTERNAL_ERROR は送り直しを尽くしても分からない。キーを保つ。
  if (error.status >= 500) return { kind: "unknown", traceId: problem.traceId };
  return { kind: "rejected", problem };
}

const closesKey = new Set<Outcome<unknown>["kind"]>(["done", "rejected", "stopped", "key_reused"]);

export function useOperation(name: string) {
  const operation = useRef<Operation | null>(null);
  const [sending, setSending] = useState(false);

  const run = useCallback(
    async <T>(request: Omit<ApiRequest, "kind" | "operation">): Promise<Outcome<T>> => {
      operation.current ??= api.newOperation(name);
      setSending(true);
      try {
        const outcome = classify(await api.call<T>({ ...request, kind: "change", operation: operation.current }));
        if (closesKey.has(outcome.kind)) operation.current = null;
        return outcome;
      } finally {
        setSending(false);
      }
    },
    [name],
  );

  const reset = useCallback(() => {
    operation.current = null;
  }, []);

  return { run, sending, reset, currentKey: () => operation.current?.key ?? null };
}
