import { defaultSettings, type AppSettings } from "@ride/application";

// 設定（DEC-45）。値のない未定の値は起動を止める（未定のまま本番に出さない）。
export interface ServerConfig {
  port: number;
  appVersion: string;
  appOrigin: string; // 状態を変える要求の Origin と比べる（DEC-20）。DEC-45 の一覧にないので足した
  databaseUrl: string;
  databaseAuthToken: string | undefined;
  gcpProjectId: string | null;
  routeTimeoutMs: number; // T_route（DEC-33）
  dbTimeoutMs: number; // T_db（DEC-33）
  sweepIntervalMs: number; // P_sweep（DEC-04）
  tailIntervalMs: number; // P_tail（DEC-03）
  keepaliveMs: number; // 生存確認（DEC-03）
  streamMaxAgeMs: number; // 流れの最長（DEC-03）
  pickupAccuracyM: number; // D_pickup_accuracy（未定の値）
  staticDir: string | null;
  seedDemo: boolean;
  settings: AppSettings;
}

export class ConfigError extends Error {}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (value === undefined || value === "") throw new ConfigError(`${name} is required (DEC-45)`);
  return value;
}

function numberOr(env: Record<string, string | undefined>, name: string, fallback: number): number {
  const value = env[name];
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new ConfigError(`${name} must be a non-negative number`);
  return parsed;
}

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  if ((env.PAYMENTS_MODE ?? "fake") !== "fake" || (env.MAPS_MODE ?? "fake") !== "fake") {
    throw new ConfigError("only the fake Stripe and Maps adapters exist in this slice");
  }
  return {
    port: numberOr(env, "PORT", 8080),
    appVersion: required(env, "APP_VERSION"),
    appOrigin: required(env, "APP_ORIGIN"),
    databaseUrl: required(env, "TURSO_DATABASE_URL"),
    databaseAuthToken: env.TURSO_AUTH_TOKEN,
    gcpProjectId: env.GCP_PROJECT_ID ?? null,
    routeTimeoutMs: numberOr(env, "T_ROUTE_MS", 10_000),
    dbTimeoutMs: numberOr(env, "T_DB_MS", 2_000),
    sweepIntervalMs: numberOr(env, "P_SWEEP_MS", 5_000),
    tailIntervalMs: numberOr(env, "P_TAIL_MS", 1_000),
    keepaliveMs: numberOr(env, "STREAM_KEEPALIVE_MS", 25_000),
    streamMaxAgeMs: numberOr(env, "STREAM_MAX_AGE_MS", 30 * 60_000),
    pickupAccuracyM: Number(required(env, "D_PICKUP_ACCURACY_M")),
    staticDir: env.STATIC_DIR ?? null,
    seedDemo: env.SEED_DEMO === "1",
    settings: {
      ...defaultSettings,
      holdWaitMs: numberOr(env, "T_HOLD_WAIT_MS", defaultSettings.holdWaitMs),
      opStaleMs: numberOr(env, "T_OP_STALE_MS", defaultSettings.opStaleMs),
      estimateValidMs: numberOr(env, "T_ESTIMATE_VALID_MS", defaultSettings.estimateValidMs),
    },
  };
}
