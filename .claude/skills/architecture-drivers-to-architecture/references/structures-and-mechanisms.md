# Structures, design mechanisms and design concerns

## Contents
- Overall structures
- Design mechanisms by quality
- Design concerns

## Overall structures

Choose the overall structure from the primary drivers and the constraints. These are common starting points; most systems combine two or three.

| Structure | Fits when | Costs |
|---|---|---|
| One deployable application with enforced internal modules | One or two teams; an early product; parts with similar load and availability needs | Everything is deployed and scaled together; module boundaries decay unless dependency rules are checked |
| Several services split by business capability | Several teams that must release independently; parts with very different load, availability or security needs | Failures between services; data consistency across services; more to run and observe |
| Parts that react to published events | Changes must reach many consumers; producers must not wait for consumers | Consistency arrives later; flows are harder to follow; duplicates and ordering need handling |
| Layers inside a part (interface, application, domain, infrastructure) | Almost every part that holds business rules | Layers leak when nobody checks the direction of dependencies |
| Pipeline or batch stages | Data processing, imports, settlement | Latency between stages; a failure in the middle needs a restart point |
| A client that holds state (a single-page app or a native app) | Rich interaction, work while offline, frequent small updates | Two places to keep correct; a slower first load; harder for search engines |
| Server-rendered pages | Content and forms; search indexing; simple clients | Less interaction without a round trip to the server |
| Functions the platform runs on demand | Spiky, event-triggered work with little steady load | Start-up delay; the platform's limits; tied to one vendor |

Screen first: drop every option that breaks a non-negotiable constraint (the team cannot run it, the platform does not offer it, the budget cannot pay for it). Then compare what remains against the primary drivers, in rank order, as `decisions.md` describes.

## Design mechanisms by quality

A design mechanism is a known way to produce a response. Pick the ones that produce the response a driver's scenario asks for, and record each choice as a decision.

### Availability and fault tolerance
- Notice failures: health checks, a timeout on every call, watching each dependency's error rate.
- Contain failures: stop calling a failing dependency for a while (a circuit breaker); give each dependency its own resources, so one slow dependency cannot exhaust them all; shed or postpone non-essential work under overload; serve a cached or partial result instead of an error.
- Recover: retry with back-off and jitter, only for operations that are safe to repeat; fail over to a standby or a second provider; let the platform restart failed instances; replay queued work.
- Settle before you switch: a timeout on a call that changes something (a charge, a booking) does not mean nothing happened. Fail over such a call only after the first route's outcome is known, or cancelled there; until then, the outcome is unknown and must be held for reconciliation, never reported as a failure.
- Remove single points of failure: several instances across zones; replicated data stores; backups that are restored in drills.

### Time behaviour and capacity
- Do less: cache results, precompute, index for the queries the CUJs make, batch calls instead of making many small ones.
- Do it at the same time, or later: call dependencies in parallel; move work out of the request into a queue; answer first and finish in the background, when the CUJ allows it.
- Control demand: rate limits per client or tenant; admit only what can be served; serve the CUJ's requests before background work.
- Grow: add instances of parts that hold no state; split data by key; send reads to replicas; absorb bursts with a queue.
- Bring it closer: content delivery networks; caches at the edge; deploy near the users.

### Security
- Know who: authenticate every caller; prefer the platform's or a provider's identity service to building one.
- Limit what: authorize every action against the caller's rights; give each part the least rights it needs; separate trust zones.
- Protect data: encrypt in transit and at rest; keep secrets in a secret store; keep sensitive data out of every system that does not need it (hosted payment fields, tokens instead of card numbers).
- Trust nothing from outside: validate input at the boundary; never accept prices, amounts or results computed by the client.
- Leave a trail: record who did what, and when, for sensitive actions, in a log the actor cannot change.
- Resist abuse: rate limits, detection of unusual patterns, locking after repeated failures.

### Modifiability and variability
- Hide what is likely to change behind an interface: a payment provider, a pricing rule, a map service.
- Split by reason to change: code that changes for the same reason lives together.
- Point dependencies toward stable parts; never let a stable part depend on a volatile one.
- Make known variants configuration, not code: settings per tenant, feature flags, rule tables.
- Agree contracts between parts and version them, so one part can change without the other.

### Analysability and observability
- One request ID carried through every hop, into every log line.
- Structured logs with the fields the SLIs and investigations need.
- Metrics per CUJ step; traces across parts; health and diagnostic endpoints.
- Events emitted at the SLIs' measurement points.

### Testability and deployability
- Seams to replace dependencies in tests: an interface for every external system, an injectable clock and ID generator.
- Contract tests between parts that are released separately.
- Small, backward-compatible changes; feature flags; gradual rollout with automatic rollback; infrastructure defined as code.

### Data quality
- Currentness: push changes as events instead of polling; bound every cache's lifetime by the freshness the driver allows; keep the time each value was produced.
- Accuracy and completeness: validate at intake; required fields; checks against reference data.
- Consistency: one owner writes each entity; transactions for rules inside one store; idempotent consumers of events across stores; regular reconciliation against the source, with a list of mismatches.
- Traceability: keep the history of changes (who, when, what), and never rewrite records of money.

### Interoperability
- One adapter per external system, translating its model into ours, so that its changes stay in one place.
- Validate messages against a schema at the boundary; tolerate unknown fields; version messages.
- Handle messages that may arrive twice without doing the work twice.

### Cost
- Pay per use for spiky or small workloads; scale idle parts to zero where start-up delay is acceptable.
- Managed services where the team's time is scarcer than money.
- One shared platform for a small team, rather than one per part.

## Design concerns

Walk all eight for the whole system. For each, point to the decisions that settle it, or write "standard practice is enough" with a reason.

| Concern | Questions |
|---|---|
| Concurrency | What runs at the same time? What state is shared? How are conflicting updates prevented (one writer, locks, version checks)? What must be atomic? |
| Control and event handling | What drives each flow: requests, events, schedules? How are timed events handled (timeouts, expiry, reminders)? What happens to events that nobody expects, or that arrive late or twice? |
| Data persistence | What is stored where, written by whom, kept how long? How is it backed up and restored? How does its structure change without downtime? |
| Distribution | What runs where? How do the parts talk across machines and networks? What happens when a link is slow or down? How does each part grow with load? |
| Error handling and fault tolerance | How are errors detected, contained, reported and recovered from? What degrades, and what must never fail silently? |
| Integration and interoperability | How does the system exchange data and calls with external systems, and between its own parts built on different technologies? With which formats, protocols, versions and contracts? |
| Assurance, security and safety | How does the system resist attack and misuse, protect its data, limit damage and recover safely? Could it harm people, property or the environment, and how is that prevented? |
| Variability | What must vary by market, tenant, device or configuration? How are the variants built, configured and tested? |
