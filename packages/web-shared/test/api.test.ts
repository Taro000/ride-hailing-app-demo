import { describe, expect, it, vi } from "vitest";
import { createApi } from "../src/api.ts";

function problemResponse(status: number, code: string, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ type: "x", title: "t", status, code, traceId: "0".repeat(32) }), {
    status,
    headers: { "Content-Type": "application/problem+json", "X-App-Version": "v1", ...headers },
  });
}

describe("WS-API の送り直し（DEC-48）", () => {
  it("状態を変える要求は、すべての試みで同じ冪等キーとトレース ID を使い、503 ROUTE_TIMEOUT を送り直す", async () => {
    const seen: { key: string | null; trace: string | null }[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      seen.push({ key: headers.get("Idempotency-Key"), trace: headers.get("X-Client-Trace-Id") });
      return seen.length < 3
        ? problemResponse(503, "ROUTE_TIMEOUT")
        : new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "X-App-Version": "v1" } });
    });
    const api = createApi({ buildVersion: "v1", fetchImpl, sleep: async () => undefined });
    const operation = api.newOperation("passenger.rides.create");
    const result = await api.call({
      method: "POST",
      path: "/api/v1/passenger/rides",
      body: {},
      kind: "change",
      operation,
    });
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((s) => s.key))).toEqual(new Set([operation.key]));
    expect(new Set(seen.map((s) => s.trace))).toEqual(new Set([operation.traceId]));
  });

  it("503 PAYMENTS_UNAVAILABLE は自動で送り直さない（乗客が Retry-After の後に送る）", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      problemResponse(503, "PAYMENTS_UNAVAILABLE", { "Retry-After": "2" }),
    );
    const api = createApi({ buildVersion: "v1", fetchImpl, sleep: async () => undefined });
    const result = await api.call({
      method: "POST",
      path: "/x",
      body: {},
      kind: "change",
      operation: api.newOperation("x"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ ok: false, error: { kind: "answered", status: 503, retryAfterSeconds: 2 } });
  });

  it("409 OPERATION_IN_PROGRESS は Retry-After だけ待って同じキーで送り直す", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => undefined);
    let calls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      calls += 1;
      return calls === 1
        ? problemResponse(409, "OPERATION_IN_PROGRESS", { "Retry-After": "1" })
        : new Response("{}", { status: 201 });
    });
    const api = createApi({ buildVersion: "v1", fetchImpl, sleep });
    await api.call({ method: "POST", path: "/x", body: {}, kind: "change", operation: api.newOperation("x") });
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("答えがないまま送り直しを尽くしたら unknown。版が違えば知らせる", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network");
    });
    const api = createApi({ buildVersion: "v1", fetchImpl, sleep: async () => undefined });
    const result = await api.call({ method: "GET", path: "/x", kind: "read" });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(result).toMatchObject({ ok: false, error: { kind: "unknown", cause: "network" } });

    const mismatch = vi.fn<(version: string) => void>();
    const versioned = createApi({
      buildVersion: "v1",
      fetchImpl: (async () => new Response("{}", { status: 200, headers: { "X-App-Version": "v2" } })) as typeof fetch,
    });
    versioned.onVersionMismatch(mismatch);
    await versioned.call({ method: "GET", path: "/x", kind: "read" });
    expect(mismatch).toHaveBeenCalledWith("v2");
  });
});
