import type { Problem } from "@ride/contracts";

// WS-API（API の呼び出し。ELM-03 の詳細設計が web-shared に求めた約束のうち、この縦の一本が使う部分）。
// 送り直すのはこのモジュールだけ（DEC-48）。一回の試みは 15 秒で切る（DEC-50）。

export type ApiKind = "read" | "change" | "session" | "once";

export interface Operation {
  name: string;
  key: string;
  traceId: string;
}

export interface ApiRequest {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  kind: ApiKind;
  operation?: Operation;
  suppressAuthEvent?: boolean;
}

export type ApiError =
  | { kind: "answered"; status: number; problem: Problem; retryAfterSeconds: number | null }
  | { kind: "unknown"; traceId: string; cause: "timeout" | "network" | "server" };

export type CallResult<T> = { ok: true; status: number; data: T } | { ok: false; error: ApiError };

export interface ApiOptions {
  buildVersion: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attemptTimeoutMs?: number;
  backoffMs?: readonly number[];
}

function randomHex(bytes: number): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function newTraceId(): string {
  return randomHex(16);
}

export function traceparent(traceId: string): string {
  return `00-${traceId}-${randomHex(8)}-01`;
}

export interface Api {
  newOperation(name: string): Operation;
  call<T>(req: ApiRequest): Promise<CallResult<T>>;
  onUnauthenticated(handler: () => void): void;
  onVersionMismatch(handler: (serverVersion: string) => void): void;
  buildVersion(): string;
}

const noop = () => undefined;

export function createApi(options: ApiOptions): Api {
  const doFetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options.attemptTimeoutMs ?? 15_000;
  const backoff = options.backoffMs ?? [1_000, 2_000, 4_000];
  let unauthenticated: () => void = noop;
  let versionMismatch: (version: string) => void = noop;

  async function call<T>(req: ApiRequest): Promise<CallResult<T>> {
    if (req.kind === "change" && !req.operation) throw new Error("change requests need an operation");
    const traceId = req.operation?.traceId ?? newTraceId();
    for (let attempt = 0; ; attempt += 1) {
      const headers: Record<string, string> = { traceparent: traceparent(traceId), "X-Client-Trace-Id": traceId };
      if (req.body !== undefined) headers["Content-Type"] = "application/json";
      if (req.kind === "change" && req.operation) headers["Idempotency-Key"] = req.operation.key;
      let res: Response | null = null;
      let cause: "timeout" | "network" = "network";
      try {
        res = await doFetch(req.path, {
          method: req.method,
          headers,
          credentials: "same-origin",
          signal: AbortSignal.timeout(timeoutMs),
          ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
        });
      } catch (error) {
        cause =
          (error as Error).name === "TimeoutError" || (error as Error).name === "AbortError" ? "timeout" : "network";
      }
      const canRetry = req.kind !== "once" && attempt < backoff.length;
      if (!res) {
        if (canRetry) {
          await sleep(backoff[attempt] ?? 0);
          continue;
        }
        return { ok: false, error: { kind: "unknown", traceId, cause } };
      }

      const serverVersion = res.headers.get("X-App-Version");
      if (serverVersion && serverVersion !== options.buildVersion) versionMismatch(serverVersion);
      if (res.ok) {
        const data = (res.status === 204 ? null : await res.json()) as T;
        return { ok: true, status: res.status, data };
      }
      const problem = (await res.json().catch(() => null)) as Problem | null;
      const retryAfter = Number(res.headers.get("Retry-After") ?? Number.NaN);
      const retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
      if (res.status === 401 && !req.suppressAuthEvent) unauthenticated();

      // 503 PAYMENTS_UNAVAILABLE は自動では送り直さない。IFC-02 は「押さえていないと示し、Retry-After の後に同じキーで送れる」とし、
      // 送るのは乗客。WS-API の「503 は 3 回まで送り直す」とぶつかるので、この符号だけ外した（実装で決めた）。
      const transient = res.status === 500 || (res.status === 503 && problem?.code !== "PAYMENTS_UNAVAILABLE");
      const inProgress = req.kind === "change" && res.status === 409 && problem?.code === "OPERATION_IN_PROGRESS";
      if ((transient || inProgress) && canRetry) {
        await sleep(inProgress ? (retryAfterSeconds ?? 1) * 1_000 : (backoff[attempt] ?? 0));
        continue;
      }
      if (problem?.code)
        return { ok: false, error: { kind: "answered", status: res.status, problem, retryAfterSeconds } };
      return { ok: false, error: { kind: "unknown", traceId, cause: "server" } };
    }
  }

  return {
    newOperation: (name) => ({ name, key: crypto.randomUUID(), traceId: newTraceId() }),
    call,
    onUnauthenticated: (handler) => {
      unauthenticated = handler;
    },
    onVersionMismatch: (handler) => {
      versionMismatch = handler;
    },
    buildVersion: () => options.buildVersion,
  };
}
