import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeMaps, FakeStripe, ManualClock } from "@ride/adapters";
import {
  defaultSettings,
  migrate,
  openDatabase,
  sweepOnce,
  ulidIdGenerator,
  type PaymentGateway,
} from "@ride/application";
import type { Estimate } from "@ride/contracts";
import { createApp } from "../src/app.ts";
import type { ServerConfig } from "../src/config.ts";
import { MemoryLogger } from "../src/logger.ts";
import { demoPassword, seedDemo } from "../src/seed.ts";

export const origin = "http://app.test";

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 0,
    appVersion: "test-1",
    appOrigin: origin,
    databaseUrl: "unused",
    databaseAuthToken: undefined,
    gcpProjectId: "demo-project",
    routeTimeoutMs: 10_000,
    dbTimeoutMs: 2_000,
    sweepIntervalMs: 5_000,
    tailIntervalMs: 10,
    keepaliveMs: 25_000,
    streamMaxAgeMs: 30 * 60_000,
    pickupAccuracyM: 50,
    staticDir: null,
    seedDemo: true,
    settings: defaultSettings,
    ...overrides,
  };
}

export async function setup(
  options: { config?: Partial<ServerConfig>; wrapPayments?: (inner: PaymentGateway) => PaymentGateway } = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "ride-test-"));
  const db = openDatabase({ url: `file:${join(dir, "test.db")}`, timeoutMs: 2_000 });
  await migrate(db);
  const clock = new ManualClock();
  const ids = ulidIdGenerator();
  const logger = new MemoryLogger();
  const stripe = new FakeStripe(clock);
  const payments = options.wrapPayments ? options.wrapPayments(stripe) : stripe;
  const maps = new FakeMaps();
  const config = testConfig(options.config);
  await seedDemo({ db, clock, ids, settings: config.settings });
  const app = createApp({ config, db, clock, ids, logger, payments, maps });
  const sweep = () => sweepOnce({ db, clock, ids, payments, logger, settings: config.settings });

  async function loginAs(email: string) {
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: demoPassword }),
    });
    if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      app.request(path, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie, ...headers },
        body: JSON.stringify(body),
      });
    const get = (path: string, headers: Record<string, string> = {}) =>
      app.request(path, { headers: { Cookie: cookie, ...headers } });
    const estimate = async (dropoff = { lat: 35.658034, lng: 139.701636 }): Promise<Estimate> => {
      const res = await post("/api/v1/passenger/estimates", {
        pickup: {
          position: { lat: 35.681236, lng: 139.767125 },
          source: "search",
          label: "東京駅",
          placeId: "fake-tokyo-station",
        },
        dropoff: { position: dropoff, source: "search", label: "渋谷駅", placeId: "fake-shibuya-station" },
      });
      if (res.status !== 201) throw new Error(`estimate failed: ${res.status} ${await res.text()}`);
      return (await res.json()) as Estimate;
    };
    const book = (estimateId: string, key: string = randomUUID()) =>
      post("/api/v1/passenger/rides", { estimateId }, { "Idempotency-Key": key });
    const cancel = (rideId: string, amount = 0, key: string = randomUUID()) =>
      post(
        `/api/v1/passenger/rides/${rideId}/cancel`,
        { expectedFee: { amount, currency: "jpy" } },
        { "Idempotency-Key": key },
      );
    return { cookie, post, get, estimate, book, cancel };
  }

  async function history(rideId: string): Promise<string[]> {
    const rows = await db.client.execute({
      sql: "SELECT type FROM ride_history WHERE ride_id = ? ORDER BY seq",
      args: [rideId],
    });
    return rows.rows.map((row) => String(row.type));
  }

  async function moneyOps(rideId: string) {
    const rows = await db.client.execute({
      sql: "SELECT kind, attempt, status, stripe_idempotency_key FROM money_ops WHERE ride_id = ? ORDER BY created_at, attempt",
      args: [rideId],
    });
    return rows.rows.map((row) => ({
      kind: String(row.kind),
      attempt: Number(row.attempt),
      status: String(row.status),
      key: String(row.stripe_idempotency_key),
    }));
  }

  return {
    app,
    db,
    clock,
    stripe,
    maps,
    logger,
    config,
    sweep,
    loginAs,
    history,
    moneyOps,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export type Harness = Awaited<ReturnType<typeof setup>>;

// SSE の本文を読み、出来事を集める。
export async function readEvents(
  res: Response,
  until: (events: { event: string; id: string | null; data: unknown }[]) => boolean,
  timeoutMs = 2_000,
) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: { event: string; id: string | null; data: unknown }[] = [];
  let buffer = "";
  const deadline = Date.now() + timeoutMs;
  try {
    while (!until(events)) {
      if (Date.now() > deadline)
        throw new Error(`timed out waiting for events: ${JSON.stringify(events.map((e) => e.event))}`);
      const { value, done } = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 200),
        ),
      ]);
      if (value) buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const fields = Object.fromEntries(
          block
            .split("\n")
            .filter((line) => line && !line.startsWith(":"))
            .map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]),
        );
        if (fields.event)
          events.push({ event: fields.event, id: fields.id ?? null, data: JSON.parse(fields.data ?? "null") });
      }
      if (done && !value) continue;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return events;
}
