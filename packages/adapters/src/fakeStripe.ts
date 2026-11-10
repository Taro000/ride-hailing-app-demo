import type {
  CancelHoldOutcome,
  Clock,
  CreateHoldRequest,
  HoldOutcome,
  PaymentGateway,
  PaymentIntentList,
  PaymentIntentSummary,
  TraceContext,
} from "@ride/application";

// Stripe の偽物（DEC-25 の差し替え口）。冪等キーの振る舞いは Stripe の文書のとおりにまねる:
// 実行した要求（成功、断り、5xx）は同じキーに同じ応答を返し、実行しなかった要求（429、届かなかった）は結果を保たない。

export type FakeHoldBehavior =
  | "succeed"
  | "decline"
  | "auth_required"
  | "rate_limited"
  | "connect_failed"
  | "timeout_after_create"
  | "lost_before_stripe"
  | "server_error"
  | "conflict_409";

export type FakeCancelBehavior = "succeed" | "timeout_after_cancel" | "lost_before_stripe";

export interface FakePaymentMethodScript {
  holds: FakeHoldBehavior[]; // 手配ごとの最初の呼び出しから順に使い、尽きたら最後のものを使い続ける
  listOutageMs?: number; // 押さえを作ってからこの間、その顧客の一覧が答えない
}

export const demoPaymentMethods: Record<string, FakePaymentMethodScript> = {
  pm_card_visa: { holds: ["succeed"] },
  pm_card_chargeDeclined: { holds: ["decline"] },
  pm_fake_timeout_after_create: { holds: ["timeout_after_create", "succeed"] },
  pm_fake_lost: { holds: ["lost_before_stripe"] },
  pm_fake_server_error: { holds: ["server_error", "succeed"] },
  pm_fake_unresponsive: { holds: ["timeout_after_create", "succeed"], listOutageMs: 4_000 },
  pm_fake_rate_limited: { holds: ["rate_limited", "succeed"] },
};

interface StoredIntent extends PaymentIntentSummary {
  customerId: string;
}

type StoredHold = HoldOutcome;

export class FakeStripe implements PaymentGateway {
  readonly calls: { op: "createHold" | "cancelHold" | "list"; key?: string }[] = [];
  private readonly intents = new Map<string, StoredIntent>();
  private readonly holdResults = new Map<string, StoredHold>();
  private readonly cancelResults = new Map<string, CancelHoldOutcome>();
  private readonly holdQueue: FakeHoldBehavior[] = [];
  private readonly cancelQueue: FakeCancelBehavior[] = [];
  private readonly callsByRide = new Map<string, number>();
  private readonly outages = new Map<string, number>();
  private listAvailable = true;
  private sequence = 0;
  private readonly clock: Clock;
  private readonly scripts: Record<string, FakePaymentMethodScript>;

  constructor(clock: Clock, scripts: Record<string, FakePaymentMethodScript> = demoPaymentMethods) {
    this.clock = clock;
    this.scripts = scripts;
  }

  nextHold(...behaviors: FakeHoldBehavior[]): void {
    this.holdQueue.push(...behaviors);
  }

  nextCancel(...behaviors: FakeCancelBehavior[]): void {
    this.cancelQueue.push(...behaviors);
  }

  setListAvailable(available: boolean): void {
    this.listAvailable = available;
  }

  intentsFor(customerId: string): PaymentIntentSummary[] {
    return [...this.intents.values()].filter((intent) => intent.customerId === customerId);
  }

  async createHold(req: CreateHoldRequest, _trace: TraceContext): Promise<HoldOutcome> {
    this.calls.push({ op: "createHold", key: req.idempotencyKey });
    const stored = this.holdResults.get(req.idempotencyKey);
    if (stored) return stored.kind === "succeeded" || stored.kind === "declined" ? { ...stored } : stored;

    const behavior = this.holdQueue.shift() ?? this.scriptedBehavior(req);
    switch (behavior) {
      case "succeed":
        return this.store(req.idempotencyKey, {
          kind: "succeeded",
          paymentIntentId: this.newIntent(req, "requires_capture").id,
        });
      case "decline":
        return this.store(req.idempotencyKey, {
          kind: "declined",
          code: "card_declined",
          paymentIntentId: this.newIntent(req, "requires_payment_method").id,
        });
      case "auth_required":
        return this.store(req.idempotencyKey, {
          kind: "declined",
          code: "authentication_required",
          paymentIntentId: this.newIntent(req, "requires_payment_method").id,
        });
      case "rate_limited":
        return { kind: "not_executed", reason: "rate_limited", retryAfterSeconds: 2 };
      case "connect_failed":
        return { kind: "not_executed", reason: "connect_failed", retryAfterSeconds: 2 };
      case "timeout_after_create": {
        const intent = this.newIntent(req, "requires_capture");
        this.holdResults.set(req.idempotencyKey, { kind: "succeeded", paymentIntentId: intent.id });
        const outageMs = this.scripts[req.paymentMethodId]?.listOutageMs;
        if (outageMs) this.outages.set(req.customerId, this.clock.now().getTime() + outageMs);
        return { kind: "unknown", error: "timeout" };
      }
      case "lost_before_stripe":
        return { kind: "unknown", error: "timeout" };
      case "server_error":
        return this.store(req.idempotencyKey, { kind: "unknown", error: "stripe_5xx" });
      case "conflict_409":
        return { kind: "unknown", error: "stripe_409" };
    }
  }

  async cancelHold(paymentIntentId: string, idempotencyKey: string, _trace: TraceContext): Promise<CancelHoldOutcome> {
    this.calls.push({ op: "cancelHold", key: idempotencyKey });
    const stored = this.cancelResults.get(idempotencyKey);
    if (stored) return stored;
    const intent = this.intents.get(paymentIntentId);
    const behavior = this.cancelQueue.shift() ?? "succeed";
    if (behavior === "lost_before_stripe") return { kind: "unknown", error: "timeout" };
    if (!intent || intent.status !== "requires_capture") {
      const failed: CancelHoldOutcome = { kind: "failed", code: "payment_intent_unexpected_state" };
      this.cancelResults.set(idempotencyKey, failed);
      return failed;
    }
    intent.status = "canceled";
    this.cancelResults.set(idempotencyKey, { kind: "succeeded" });
    return behavior === "timeout_after_cancel" ? { kind: "unknown", error: "timeout" } : { kind: "succeeded" };
  }

  async listPaymentIntents(customerId: string, createdGte: Date, _trace: TraceContext): Promise<PaymentIntentList> {
    this.calls.push({ op: "list" });
    const outageUntil = this.outages.get(customerId);
    if (!this.listAvailable || (outageUntil !== undefined && this.clock.now().getTime() < outageUntil)) {
      return { kind: "unavailable" };
    }
    const items = [...this.intents.values()]
      .filter((intent) => intent.customerId === customerId && intent.created.getTime() >= createdGte.getTime())
      .map(({ customerId: _customer, ...summary }) => ({ ...summary, metadata: { ...summary.metadata } }));
    return { kind: "ok", items };
  }

  private scriptedBehavior(req: CreateHoldRequest): FakeHoldBehavior {
    const script = this.scripts[req.paymentMethodId];
    if (!script) return "succeed";
    // 同じ手配（依頼）の中で何回目の新しい要求かで決める（同じキーの送り直しは保った結果を返すので数えない）。
    const count = this.callsByRide.get(req.metadata.ride_id) ?? 0;
    this.callsByRide.set(req.metadata.ride_id, count + 1);
    return script.holds[Math.min(count, script.holds.length - 1)] ?? "succeed";
  }

  private newIntent(req: CreateHoldRequest, status: StoredIntent["status"]): StoredIntent {
    this.sequence += 1;
    const intent: StoredIntent = {
      id: `pi_fake_${String(this.sequence).padStart(6, "0")}`,
      status,
      amountYen: req.amountYen,
      metadata: { ...req.metadata },
      created: this.clock.now(),
      customerId: req.customerId,
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  private store(key: string, outcome: StoredHold): HoldOutcome {
    this.holdResults.set(key, outcome);
    return outcome;
  }
}
