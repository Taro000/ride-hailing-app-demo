import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  accountKind,
  authenticate,
  bookRide,
  cancelRide,
  createEstimate,
  getActiveRide,
  getRideView,
  login,
  logout,
  problem,
  resolvePlace,
  searchPlaces,
  type ApiResult,
  type AuthedAccount,
  type Clock,
  type Database,
  type IdGenerator,
  type Logger,
  type MapsGateway,
  type PaymentGateway,
} from "@ride/application";
import {
  BookingRequest,
  CancelRequest,
  Credentials,
  EstimateRequest,
  idPattern,
  PlaceResolveRequest,
  PlaceSearchRequest,
  type FieldErrorCode,
  type Session,
} from "@ride/contracts";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { timeout } from "hono/timeout";
import type { z } from "zod";
import type { ServerConfig } from "./config.ts";
import type { Env } from "./env.ts";
import { streamRoute } from "./stream.ts";

export const sessionCookie = "__Host-rh_session";

export interface AppDeps {
  config: ServerConfig;
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  payments: PaymentGateway;
  maps: MapsGateway;
}

// traceparent（W3C）と X-Client-Trace-Id からブラウザのトレース ID を取る。なければサーバーが作る（Problem.traceId は必須のため）。
function clientTraceId(c: Context<Env>, ids: IdGenerator): string {
  const explicit = c.req.header("X-Client-Trace-Id");
  if (explicit && /^[0-9a-f]{32}$/.test(explicit)) return explicit;
  const parent = c.req.header("traceparent")?.match(/^00-([0-9a-f]{32})-[0-9a-f]{16}-0[01]$/);
  return parent?.[1] ?? ids.newTraceId();
}

function respond(c: Context<Env>, result: ApiResult): Response {
  for (const [name, value] of Object.entries(result.headers ?? {})) c.header(name, value);
  if (result.status === 204) return c.body(null, 204);
  const isProblem = result.status >= 400;
  return c.body(JSON.stringify(result.body), result.status as 200, {
    "Content-Type": isProblem ? "application/problem+json" : "application/json; charset=utf-8",
  });
}

function fieldCode(issue: z.core.$ZodIssue): FieldErrorCode {
  if (issue.code === "invalid_type" && issue.input === undefined) return "REQUIRED";
  if (issue.code === "too_big") return issue.origin === "string" ? "TOO_LONG" : "OUT_OF_RANGE";
  if (issue.code === "too_small") return issue.origin === "string" ? "REQUIRED" : "OUT_OF_RANGE";
  return "INVALID";
}

// 要求の形の誤りは 400 INVALID_REQUEST と、欄ごとの JSON Pointer（DEC-38）。
async function parseBody<T>(c: Context<Env>, schema: z.ZodType<T>): Promise<T> {
  const traceId = c.get("trace").clientTraceId;
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new HTTPException(400, {
      res: respond(c, problem("INVALID_REQUEST", traceId, { detail: "JSON として読めません" })),
    });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({
      field: `/${issue.path.map(String).join("/")}`,
      code: fieldCode(issue),
    }));
    throw new HTTPException(400, { res: respond(c, problem("INVALID_REQUEST", traceId, { errors })) });
  }
  return parsed.data;
}

function idempotencyKey(c: Context<Env>): string {
  const key = c.req.header("Idempotency-Key");
  if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    const traceId = c.get("trace").clientTraceId;
    throw new HTTPException(400, {
      res: respond(
        c,
        problem("INVALID_REQUEST", traceId, { errors: [{ field: "header:Idempotency-Key", code: "REQUIRED" }] }),
      ),
    });
  }
  return key.toLowerCase();
}

function rideIdParam(c: Context<Env>): string {
  const rideId = c.req.param("rideId") ?? "";
  if (!idPattern.ride.test(rideId)) {
    const traceId = c.get("trace").clientTraceId;
    throw new HTTPException(400, {
      res: respond(c, problem("INVALID_REQUEST", traceId, { errors: [{ field: "path:rideId", code: "INVALID" }] })),
    });
  }
  return rideId;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .toSorted(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

function requestHash(parts: unknown): string {
  return createHash("sha256").update(stableStringify(parts)).digest("hex");
}

function isDependencyError(error: unknown): boolean {
  const code = String((error as { code?: unknown }).code ?? "");
  const name = String((error as { name?: unknown }).name ?? "");
  return code.startsWith("SQLITE") || name === "LibsqlError" || name === "TimeoutError" || name === "AbortError";
}

export function createApp(deps: AppDeps): Hono<Env> {
  const { config, db, clock, ids, logger } = deps;
  const authDeps = { db, clock, ids, settings: config.settings };
  const moneyDeps = { db, clock, ids, payments: deps.payments, logger, settings: config.settings };
  const estimateDeps = {
    db,
    clock,
    ids,
    maps: deps.maps,
    logger,
    settings: config.settings,
    pickupAccuracyM: config.pickupAccuracyM,
  };
  const app = new Hono<Env>();

  // 一つの操作の記録をつなぐ（DEC-44）。すべての応答に X-App-Version（DEC-49）と x-route-id（FND-35）を付け、request.completed を書く。
  app.use("*", async (c, next) => {
    const started = performance.now();
    const cloud = c.req.header("X-Cloud-Trace-Context")?.match(/^([0-9a-f]{32})\/(\d+)/);
    c.set("trace", {
      clientTraceId: clientTraceId(c, ids),
      cloudTrace: cloud && config.gcpProjectId ? `projects/${config.gcpProjectId}/traces/${cloud[1]}` : null,
      spanId: cloud?.[2] ?? null,
    });
    c.set("account", null);
    c.set("routeId", null);
    await next();
    c.res.headers.set("X-App-Version", config.appVersion);
    const routeId = c.get("routeId");
    if (!routeId) return;
    c.res.headers.set("x-route-id", routeId);
    const account = c.get("account");
    const trace = c.get("trace");
    logger.log({
      event: "request.completed",
      severity: c.res.status >= 500 ? "ERROR" : "INFO",
      message: `${c.req.method} ${routeId} ${c.res.status}`,
      "logging.googleapis.com/trace": trace.cloudTrace,
      "logging.googleapis.com/spanId": trace.spanId,
      client_trace_id: trace.clientTraceId,
      route_id: routeId,
      method: c.req.method,
      status: c.res.status,
      elapsed_ms: Math.round(performance.now() - started),
      ...(account ? { account_id: account.accountId, account_kind: accountKind(account) } : {}),
    });
  });

  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse();
    const traceId = c.get("trace")?.clientTraceId ?? ids.newTraceId();
    logger.log({
      event: "app.error",
      severity: "ERROR",
      message: error instanceof Error ? error.message : String(error),
      client_trace_id: traceId,
      route_id: c.get("routeId"),
    });
    return respond(c, problem(isDependencyError(error) ? "DEPENDENCY_UNAVAILABLE" : "INTERNAL_ERROR", traceId));
  });

  // SSE 以外の経路は T_route で切って 503 ROUTE_TIMEOUT（DEC-33）。切っても中の処理は続く。
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/v1/stream") return next();
    return timeout(config.routeTimeoutMs, (ctx) => {
      const traceId = (ctx as Context<Env>).get("trace").clientTraceId;
      return new HTTPException(503, { res: respond(ctx as Context<Env>, problem("ROUTE_TIMEOUT", traceId)) });
    })(c, next);
  });

  // 状態を変える要求は送り元（Origin）を確かめる（DEC-20、DEC-43）。ログインのない login も同じ（FND-42）。
  app.use("/api/*", async (c, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(c.req.method)) return next();
    if (c.req.header("Origin") !== config.appOrigin) {
      return respond(c, problem("FORBIDDEN", c.get("trace").clientTraceId));
    }
    return next();
  });

  const withRoute = (routeId: string) => async (c: Context<Env>, next: () => Promise<void>) => {
    c.set("routeId", routeId);
    await next();
  };

  // セッションのクッキー（DEC-43）と役割（経路のまとまりごとに一か所で確かめる。DEC-20）。
  const requireSession = async (c: Context<Env>, next: () => Promise<void>) => {
    const token = getCookie(c, sessionCookie);
    const account = token ? await authenticate(authDeps, token) : null;
    if (!account) return respond(c, problem("UNAUTHENTICATED", c.get("trace").clientTraceId));
    c.set("account", account);
    return next();
  };
  const requirePassenger = async (c: Context<Env>, next: () => Promise<void>) => {
    const account = c.get("account");
    if (!account?.roles.includes("passenger")) return respond(c, problem("FORBIDDEN", c.get("trace").clientTraceId));
    return next();
  };
  const passenger = (c: Context<Env>): AuthedAccount => {
    const account = c.get("account");
    if (!account) throw new Error("passenger route without a session");
    return account;
  };

  app.post("/api/v1/auth/login", withRoute("auth.login"), async (c) => {
    const body = await parseBody(c, Credentials);
    const result = await login(authDeps, body.email, body.password);
    if (result.kind === "invalid") return respond(c, problem("INVALID_CREDENTIALS", c.get("trace").clientTraceId));
    c.set("account", result.account);
    setCookie(c, sessionCookie, result.token, {
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/",
      maxAge: result.maxAgeSec,
    });
    const session: Session = { account: result.account, nextStep: "none" };
    return respond(c, { status: 200, body: session });
  });

  app.get("/api/v1/auth/session", withRoute("auth.session"), requireSession, (c) => {
    const session: Session = { account: passenger(c), nextStep: "none" };
    return respond(c, { status: 200, body: session });
  });

  app.post("/api/v1/auth/logout", withRoute("auth.logout"), async (c) => {
    const token = getCookie(c, sessionCookie);
    if (token) await logout(authDeps, token);
    deleteCookie(c, sessionCookie, { path: "/", secure: true });
    return c.body(null, 204);
  });

  app.use("/api/v1/passenger/*", requireSession, requirePassenger);

  app.post("/api/v1/passenger/places/search", withRoute("passenger.places.search"), async (c) => {
    const body = await parseBody(c, PlaceSearchRequest);
    return respond(
      c,
      await searchPlaces(estimateDeps, c.get("trace"), {
        query: body.query,
        sessionToken: body.sessionToken,
        near: body.near ?? null,
      }),
    );
  });

  app.post("/api/v1/passenger/places/resolve", withRoute("passenger.places.resolve"), async (c) => {
    const body = await parseBody(c, PlaceResolveRequest);
    return respond(c, await resolvePlace(estimateDeps, c.get("trace"), body));
  });

  app.post("/api/v1/passenger/estimates", withRoute("passenger.estimates.create"), async (c) => {
    const body = await parseBody(c, EstimateRequest);
    return respond(c, await createEstimate(estimateDeps, c.get("trace"), passenger(c).accountId, body));
  });

  app.post("/api/v1/passenger/rides", withRoute("passenger.rides.create"), async (c) => {
    const key = idempotencyKey(c);
    const body = await parseBody(c, BookingRequest);
    const result = await bookRide(moneyDeps, {
      account: passenger(c),
      idempotencyKey: key,
      requestHash: requestHash({ body }),
      estimateId: body.estimateId,
      paymentMethodId: body.paymentMethodId ?? null,
      trace: c.get("trace"),
    });
    return respond(c, result);
  });

  app.get("/api/v1/passenger/rides/active", withRoute("passenger.rides.active"), async (c) =>
    respond(c, await getActiveRide(db, passenger(c).accountId)),
  );

  app.get("/api/v1/passenger/rides/:rideId", withRoute("passenger.rides.get"), async (c) =>
    respond(c, await getRideView(db, passenger(c).accountId, rideIdParam(c), c.get("trace").clientTraceId)),
  );

  app.post("/api/v1/passenger/rides/:rideId/cancel", withRoute("passenger.rides.cancel"), async (c) => {
    const key = idempotencyKey(c);
    const body = await parseBody(c, CancelRequest);
    const rideId = rideIdParam(c);
    const result = await cancelRide(moneyDeps, {
      account: passenger(c),
      idempotencyKey: key,
      requestHash: requestHash({ rideId, body }),
      rideId,
      expectedFee: body.expectedFee,
      trace: c.get("trace"),
    });
    return respond(c, result);
  });

  app.get("/api/v1/stream", withRoute("stream.open"), requireSession, requirePassenger, (c) =>
    streamRoute(c, { db, ids, logger, config }),
  );

  app.all("/api/*", (c) => respond(c, problem("NOT_FOUND", c.get("trace").clientTraceId)));

  // 三つの SPA は同じ入口から配る（DEC-23）。乗客の SPA を / に置くのはこの実装で決めた（設計は管理の画面の /backoffice/ だけを決めた）。
  if (config.staticDir && existsSync(join(config.staticDir, "index.html"))) {
    const indexHtml = readFileSync(join(config.staticDir, "index.html"), "utf8");
    app.use("/assets/*", serveStatic({ root: relative(process.cwd(), config.staticDir) }));
    app.get("*", (c) => {
      c.header("Cache-Control", "no-cache");
      return c.html(indexHtml);
    });
  }

  return app;
}
