// 外部サービス、時計、ID の生成の口（DEC-25、DEC-26）。adapters が実装し、server が組み立てる。
import type { PlaceCandidate, PlaceResolved, Point } from "@ride/contracts";

export interface Clock {
  now(): Date;
}

export type IdKind = "ride" | "acc" | "est" | "chg" | "mop" | "route";

export interface IdGenerator {
  newId(kind: IdKind): string;
  newSecret(): string;
  newTraceId(): string;
}

export type Severity = "DEBUG" | "INFO" | "WARNING" | "ERROR";

export interface LogEntry {
  event: string;
  severity: Severity;
  message: string;
  [field: string]: unknown;
}

export interface Logger {
  log(entry: LogEntry): void;
}

// 一つの操作の記録をつなぐもの（DEC-44）。
export interface TraceContext {
  clientTraceId: string;
  cloudTrace: string | null;
  spanId: string | null;
}

// Stripe（IFC-13）の押さえの結果を、DEC-52 の三つの分け方で返す。
export type HoldOutcome =
  | { kind: "succeeded"; paymentIntentId: string }
  | {
      kind: "declined";
      code: "card_declined" | "authentication_required";
      paymentIntentId: string | null;
    }
  | { kind: "not_executed"; reason: "rate_limited" | "connect_failed"; retryAfterSeconds: number }
  | { kind: "unknown"; error: "timeout" | "connection_lost" | "stripe_5xx" | "stripe_409" };

export interface CreateHoldRequest {
  customerId: string;
  paymentMethodId: string;
  amountYen: number;
  idempotencyKey: string;
  metadata: {
    ride_id: string;
    money_op_id: string;
    op_kind: "hold";
    hold_seq: string;
    attempt: string;
  };
}

export type CancelHoldOutcome =
  | { kind: "succeeded" }
  | { kind: "failed"; code: string }
  | { kind: "unknown"; error: "timeout" | "connection_lost" | "stripe_5xx" | "stripe_409" };

export interface PaymentIntentSummary {
  id: string;
  status: "requires_capture" | "canceled" | "requires_payment_method" | "succeeded";
  amountYen: number;
  metadata: Record<string, string>;
  created: Date;
}

export type PaymentIntentList = { kind: "ok"; items: PaymentIntentSummary[] } | { kind: "unavailable" };

export interface PaymentGateway {
  createHold(req: CreateHoldRequest, trace: TraceContext): Promise<HoldOutcome>;
  cancelHold(paymentIntentId: string, idempotencyKey: string, trace: TraceContext): Promise<CancelHoldOutcome>;
  listPaymentIntents(customerId: string, createdGte: Date, trace: TraceContext): Promise<PaymentIntentList>;
}

export type MapsResult<T> = { kind: "ok"; value: T } | { kind: "unavailable" };

export interface RouteResult {
  distanceM: number;
  durationSec: number;
  encodedPolyline: string;
}

// Google Maps（IFC-15）。呼び出しは 2 秒で切り、要求の中では送り直さない（DEC-22）。
export interface MapsGateway {
  autocomplete(
    query: string,
    sessionToken: string,
    near: Point | null,
    trace: TraceContext,
  ): Promise<MapsResult<PlaceCandidate[]>>;
  placeDetails(placeId: string, sessionToken: string, trace: TraceContext): Promise<MapsResult<PlaceResolved | null>>;
  computeRoute(from: Point, to: Point, trace: TraceContext): Promise<MapsResult<RouteResult | null>>;
}
