# Stage 3 report template and worked example

## Contents
- Report template (`docs/design/3-high-level-design.md`)
- Worked example: online store
- Example items

Write the report in the working language. Translate the headings. Keep the IDs, paths, field names and codes as they are, and write the basis marks and statuses with the glossary's terms for the working language.

The report never restates what an item says: no operations, error contracts, timings, fields, bindings, or other text or values copied from the YAML. It indexes the items by ID, title, enum values and references, and holds what only the report records: the flows, the latency budgets and the worst cases behind the timeouts, the screen flows, the data model diagram, the states across elements, the shared conventions, the flows that the acceptance criteria pass through, and the decisions. The requests to the quality chain are QCR items, which `quality-chain-requests.md` lists; the report does not.

`scripts/tables.py` writes the tables between `<!-- generated: <name> -->` and `<!-- /generated -->` from the items ("Scripts" in `conventions.md`): the design decisions, the interfaces, the SLI bindings, the data entities, the acceptance criteria trace, the findings, the hand-offs and the open assumptions. Do not edit them by hand. In them, the report writes only these cells, which the script keeps: the request that replaces the binding of an SLI that nothing binds, the flow each acceptance criterion passes through, and the breadth and severity of a quality-chain assumption as this stage rates it (the script starts them from the QAS's own). Every other table is written by hand.

## Report template

```markdown
# High-level design: <system name>

Status: draft | waiting for answers | answers applied · Updated: <date> · Inputs as of: <commit, or "none"> · Stage 3 of 4

## Summary
<Two or three sentences: how many interfaces, specs, flows and entities; which latency budgets fit and which do not; the main conventions; how many questions were decided and how many assumptions are open.>

## Inputs
| Source | What it gave |
|---|---|

## Shared conventions
| Convention | DEC |
|---|---|
<One row per convention that interfaces show to their consumers, with the DEC that records it. What was decided lives in the DEC only; stage 4 reads the conventions from those DECs. The conventions inside the code are the technical policy's, and get no row here.>

## Design decisions
<!-- generated: decisions -->
| DEC | Title | Addresses | Basis |
|---|---|---|---|
<!-- /generated -->
<The decisions of stage `high-level-design`, the shared conventions included.>

## Interfaces
<!-- generated: interfaces -->
| IFC | Title | Kind | Provider | Consumers | FRs | Spec | Basis |
|---|---|---|---|---|---|---|---|
<!-- /generated -->
<Spec, as the specs policy's entry for the interface's kind makes it: the file under `ifc/specs/` for a spec written by hand; the hand-off that leaves the schema to implementation for a spec generated from the code, and for an interface whose owner's document a component of this system serves; "—" for an external system's interface, whose owner's document the report links, and for a screen, a file or a batch.>

## SLI bindings
<!-- generated: sli-bindings -->
| SLI | Title | Vantage | Bound on | Existing source | Request instead |
|---|---|---|---|---|---|
<!-- /generated -->
<One row per quality-chain SLI. Bound on: the IFCs and DATs whose `sli_bindings` name it. Request instead, by hand, only for an SLI that nothing binds: the request to the quality chain that replaces its binding, an open or answered QCR with the SLI in `targets`.>

## End-to-end flows
### <CUJ-xx name>
<A sequence diagram with its failure paths.>
### <DRV-xx>
<A sequence diagram of the driver's scenario.>

## Latency budgets and timeouts
### <NFR-xx>
<Where the SLI's binding observes the flow, the hop table, the failure paths, and the script's output.>
### Timeouts
<For each call path of an SLO with a time threshold, and each path that moves money: the timeouts and waits in the IFCs' `timing`, settlement waits included, and the worst case each caller waits for, from the same script. Then the other calls between elements: the IFCs whose `timing` holds only the bounds, and the hand-offs that leave the values to stage 4.>

## Screens
### <CUJ-xx name>
<A flowchart of the screens and their actions, error and empty states included.>

## Data
<The entity-relationship diagram, then:>
<!-- generated: data -->
| DAT | Title | Owner | Store | Classification | Basis |
|---|---|---|---|---|---|
<!-- /generated -->
### Data quality flows

## States across elements
<One state diagram per entity whose life spans several elements and that holds money, a booking or an unknown outcome, or whose states rate high.>

## Acceptance criteria trace
<!-- generated: criteria -->
| FR | Criterion | IFCs | Flow |
|---|---|---|---|
<!-- /generated -->
<One row per acceptance criterion of every FR allocated to a component, by its number in the FR. IFCs: the interfaces whose `functions` include the FR. Flow, by hand: the flow the criterion passes through, and the part of an interface when it helps.>

## Findings
<!-- generated: findings -->
| FND | Title | Severity | Raised by | To | Status | Items changed |
|---|---|---|---|---|---|---|
<!-- /generated -->
<The findings addressed to this stage, and those this stage raised. Items changed are the items whose `basis_note` cites the finding.>

## Hand-offs
<!-- generated: handoffs -->
| HND | Title | From | To | Component | Status | Decided in |
|---|---|---|---|---|---|---|
<!-- /generated -->
<The hand-offs this stage wrote, and those addressed to it: the schemas of interfaces between elements, to implementation; the timeouts of calls off the paths of time SLOs and of money, to stage 4; any other point left to a later stage that it would not take up otherwise. Decided in: the items whose `basis_note` cites the hand-off. The point, its bounds, its trigger and why one was passed on are in the HND file; one that this stage passed on is listed by the stage it went to.>

## Unanswered questions
| # | Question | Why unsure | Options | Items | Answer |
|---|---|---|---|---|---|
<Only while rows wait: the questions this run could not ask because nobody could answer during the run, in the order it would ask them, and the corrections to assumptions that the user gave after such a run ("Draft first, ask afterwards", step 7, and "Finishing a run", step 1, in conventions.md). #: the number the row keeps under "Decisions". Options: 2 to 4, the drafted one first and marked as drafted; a multi-select question lists up to 4 items and the drafted choice. Answer: what the user answered, written by the user or by the agent that started the run; empty until then. A question about a request to the quality chain names the request among its items, and its answer may be written under the request in `quality-chain-requests.md` instead. The next run moves each answered row to "Decisions".>

## Decisions
| # | Question | Answer | Items |
|---|---|---|---|
<Questions asked and the answers in effect, numbered per stage and continued on re-runs; an overturning answer replaces the row.>

## Open assumptions
<!-- generated: assumptions -->
| ID | Title | Kind | Breadth | Severity | Items that depend on it |
|---|---|---|---|---|---|
<!-- /generated -->
<The open DAS this stage wrote, and the open DAS and QAS its items depend on, highest first. Breadth and severity of a QAS, by hand: as this stage rates it.>

## Placeholders
| Name | Stands for | Used in |
|---|---|---|

## Open gaps
<Only what this stage could not close and no later stage will take up, such as a value cut off at ` #` in a file another stage wrote, for that stage to fix. A point left to stage 4 or to implementation is under "Hand-offs"; a problem in the architecture is a finding addressed to stage 2; one that only a change in the quality chain would close is a request to the quality chain, which `quality-chain-requests.md` lists.>

## Out of scope
## Next
<While questions wait for answers: answer them under "Unanswered questions", then run this stage again; neither its review nor a later stage runs until then. Otherwise, run `design-review` on this stage in a fresh context when it has not been reviewed yet, or when a critical or major finding changed its items since its last review; re-run this stage for the critical or major findings a review addresses to it, not for minor ones; then run `high-level-design-to-detailed-design` once per component: list them.>
```

## Worked example: online store

Interfaces (excerpt). The operations, error contracts, timing and bindings are in each IFC's file; the script indexes them.

| IFC | Title | Kind | Provider | Consumers | FRs | Spec | Basis |
|---|---|---|---|---|---|---|---|
| IFC-01 | Checkout API | http | ELM-02 | ELM-01 | FR-01 | HND-04 | assumed |
| IFC-02 | Payment provider A | http | ELM-05 | ELM-02 | FR-01 | — | assumed |
| IFC-03 | Stock changed events from the warehouse | event | ELM-07 | ELM-03 | FR-04, FR-05 | — | inferred |
| IFC-04 | Checkout screen | screen | ELM-01 | USR-01 | FR-01 | — | inferred |
| IFC-05 | Cart screen | screen | ELM-01 | USR-01 | FR-04, FR-05 | — | inferred |
| IFC-06 | Catalog reads for the storefront's pages | http | ELM-02 | ELM-01 | FR-04 | HND-04 | inferred |

The consumers of a screen are the users who use it (USR-01, the buyer). IFC-02 and IFC-03 have no spec of ours: provider A and the warehouse team own theirs, and "Inputs" links them. Provider A's stated latencies for a charge, a lookup and a cancel come from its API documentation, which the user gave for this run; this stage added them to `design-context.yaml` as TC-04 and lists the document under "Inputs" (`conventions.md`, "Judgment basis"). IFC-02 cites TC-04 and does not restate it.

IFC-01 and IFC-06 follow the first entry of the specs policy, POL-05: the store team builds both sides of each, so their specs are generated from ELM-02's code. The storefront's checkout script calls IFC-01 from the buyer's browser, and ELM-01's server calls IFC-06 to render the product pages. Their IFCs hold what their consumers rely on: their operations, their errors and their codes, and for IFC-01 what its idempotency key means and how it answers when the outcome of a payment is unknown. The schemas of their requests and responses are handed off to implementation (HND-04). No interface of the store is of POL-05's by-hand kind, so this stage writes no spec under `ifc/specs/`. IFC-06's calls are on no path of a time SLO and move no money (NFR-03 counts how long a stock change takes to become visible, which its own budget covers, not how long a page takes to load), so its `timing` holds only the bound: ELM-01's timeout above the worst case of the read it waits for. Stage 4 sets the value for ELM-01 (HND-05).

SLI bindings (excerpt):

| SLI | Title | Vantage | Bound on | Existing source | Request instead |
|---|---|---|---|---|---|
| SLI-02 | Checkout latency | system-boundary | IFC-01 | OPF-02 | — |

Latency budget for NFR-02: SLI-02's vantage is the system boundary, and its binding observes it at the load balancer in front of ELM-02 (IFC-01). ELM-01's checkout script runs in the buyer's browser and calls IFC-01 through that load balancer, so the script's own time and the buyer's network are outside the budget. The hop table in `flows-and-budgets.md` budgets three serial hops at the 99.67th percentile, 1.30 s in all, plus a 0.20 s margin, against the 1.5 s threshold. The failover path makes at most 3,000 checkouts slow per provider outage at the sale peak (OPF-03), 3.6% of the error budget ("Failure paths and the error budget"). The script's output is pasted under the table. The hops of ELM-02's own work and of the database are provisional values that nothing has measured, and no NFR load-tests checkout before release, so this stage wrote QCR-04, asking the quality chain for a gate; whether to have one is the quality chain's to decide, and no item of this stage depends on it.

Timeouts on the payment path, from the same script: IFC-02's provider_timeout and payment_wait at A, then the same values at B, whose interface keeps them, plus the 0.3 s that the budget gives ELM-02's own work and the database, make a worst case of 2.0 + 3.0 + 2.0 + 3.0 + 0.3 = 10.3 s. IFC-01's timeout of 15 s is above it, so the storefront never abandons a payment that is still running. The three values are provisional and share DAS-06 with IFC-02's failover_after, the threshold that HND-02 left to this stage; stage 4 uses them by IFC ID and sets none of them. Off these paths, IFC-06's `timing` holds only the bound, and HND-05 leaves the value to stage 4.

Acceptance criteria trace (excerpt). The script lists every interface that carries FR-01; the flow, written by hand, says where this criterion passes:

| FR | Criterion | IFCs | Flow |
|---|---|---|---|
| FR-01 | 1 | IFC-01, IFC-02, IFC-04 | Checkout, duplicate request path (IFC-01 `idempotency`) |

Hand-offs (excerpt):

| HND | Title | From | To | Component | Status | Decided in |
|---|---|---|---|---|---|---|
| HND-01 | Where the time of a stock change at the warehouse can be read | requirements-to-architecture-drivers | architecture-to-high-level-design | — | decided | DAT-04 |
| HND-02 | The error threshold at which checkout fails over | architecture-drivers-to-architecture | architecture-to-high-level-design | — | decided | IFC-02 |
| HND-03 | How long ELM-02 keeps a stock count it has read | architecture-drivers-to-architecture | architecture-to-high-level-design | — | decided | DEC-13 |
| HND-04 | The schemas of the interfaces between elements that ELM-02 provides | architecture-to-high-level-design | implementation | ELM-02 | open | — |
| HND-05 | The timeouts of ELM-01's calls to IFC-06 | architecture-to-high-level-design | high-level-design-to-detailed-design | ELM-01 | open | — |

HND-03 is decided within NFR-03's budget: DEC-13, which lets ELM-02 read the stock table, gives the cache the share of T_stock_lag that the warehouse event and ELM-03 leave, as a provisional value in its `parameters` (DAS-07). HND-04 stays open in the design, as every hand-off to implementation does; stage 4 takes up HND-05 at its run for ELM-01.

Decisions (excerpt):

| # | Question | Answer | Items |
|---|---|---|---|
| 1 | When a provider times out and its charge cannot be settled within payment_wait, should checkout keep the buyer waiting until it is settled, or answer that the payment is being confirmed and leave the order to reconciliation? | Answer that the payment is being confirmed and leave the order to reconciliation. Never tell the buyer that nothing was charged until every provider tried has confirmed it, and never keep the buyer waiting beyond IFC-01's timeout. | IFC-01, IFC-02, DAT-01 |
| 2 | Public order IDs are drafted as random IDs that cannot be guessed. Do support staff also need a short order number they can read out on the phone? | No. Support staff never read order IDs aloud, so the random ID is enough. | DEC-15 |

Open assumptions (excerpt):

| ID | Title | Kind | Breadth | Severity | Items that depend on it |
|---|---|---|---|---|---|
| DAS-06 | Timeouts on the payment path adopted provisionally | decision | medium | low | IFC-01, IFC-02 |
| DAS-07 | Stock cache lifetime adopted provisionally | decision | low | low | DEC-13 |

## Example items

`docs/design/ifc/IFC-01.yaml`:

```yaml
id: IFC-01
title: Checkout API
status: active
basis: assumed
basis_note: The binding of SLI-02 uses the load balancer logs that already exist (OPF-02), and counts a checkout submitted again once, following FND-03; the handling of unsettled payments follows FND-01 and is confirmed (question 1); the timeout is a provisional decision (DAS-06); the rest is inferred from DEC-02, DRV-05 and the shared conventions
premises: [OPF-02, DAS-06]
kind: http
name: Checkout API
provider: ELM-02
consumers: [ELM-01]                      # the storefront's checkout script, running in the buyer's browser
functions: [FR-01]
operations:
  - {name: POST /v1/checkout, does: Confirms the cart as an order and charges the buyer}
format: JSON
protocol: HTTPS, request and response
auth: Buyer session cookie
errors:
  - {case: Card declined, signal: 402 with code CARD_DECLINED, caller_does: Show the decline and keep the cart}
  - {case: No provider could take the payment and every provider tried confirmed that nothing was charged, signal: 503 with code PAYMENT_UNAVAILABLE, caller_does: Ask the buyer to try again later}
  - {case: The outcome of the payment is not settled yet because a provider timed out, signal: 202 with code PAYMENT_PENDING and the order ID, caller_does: Show that the payment is being confirmed and poll the order; never submit again with a new key}
  - {case: The same key while the first request is still running, signal: 409 with code CHECKOUT_IN_PROGRESS, caller_does: Wait and poll the order}
  - {case: The same key with a different cart, signal: 422 with code KEY_REUSED, caller_does: Start a new checkout with a new key}
idempotency: One Idempotency-Key per order - the storefront creates it when the buyer first submits the cart and reuses it on every retry; the same key returns the first result
timing:
  timeout: 15 s (provisional, DAS-06; above the worst case of the payment path, 10.3 s, so that a payment still running is never abandoned; the 1.5 s of NFR-02 is a target, not a timeout)
  ordering: null
  delivery: null
versioning: Version in the path; only additive changes within v1
observability: Logs request_id and outcome in the service, for investigations
sli_bindings:
  - sli: SLI-02
    events: Each POST /v1/checkout request that reaches the load balancer in front of ELM-02 (the SLI's vantage is the system boundary); requests with the same Idempotency-Key are one checkout, counted by the first request
    fields: [request_id, idempotency_key, status, elapsed, user_agent]
    method: The load balancer's access logs, which already exist (OPF-02), with the Idempotency-Key header added to the logged fields
spec: null
as_is: new
```

The fields cover SLI-02's counting rules: `status` tells apart the checkouts the system failed (they belong to the availability SLI) and the requests that were not signed in, `user_agent` tells synthetic monitoring and load tests apart, and `idempotency_key` makes a checkout submitted again count once.

`docs/design/ifc/IFC-02.yaml` (excerpt), the interface of an external system. What provider A promises is cited by TC ID, and the timeouts and waits on calls to it are this stage's (`interfaces.md`, "Timing"):

```yaml
id: IFC-02
title: Payment provider A
status: active
basis: assumed
basis_note: Operations and errors as provider A's documentation gives them, linked in the report; its stated latencies are TC-04; settling a timed-out charge at A before trying another provider follows FND-01; the handling of unsettled payments is confirmed (question 1); the timing is a provisional decision (DAS-06), and its failover_after decides HND-02; the rest is inferred
premises: [EXT-01, TC-01, TC-04, DAS-06]
kind: http
name: Payment provider A
provider: ELM-05
consumers: [ELM-02]
functions: [FR-01]
# ... operations, format, protocol, auth, errors and idempotency ...
timing:
  timeout: provider_timeout 2.0 s on each call to A (provisional, DAS-06; above the 99.9th percentile that TC-04 states for a charge, so that healthy charges almost never time out); payment_wait 3.0 s to settle an unknown outcome at A, by looking up the key and cancelling the charge there, before any other provider is tried (provisional, DAS-06; room for a lookup and a cancel at the latencies TC-04 states, and to repeat the lookup once); failover_after 5 consecutive errors or 10 s of timeouts, after which ELM-02 stops calling A and sends new charges to B (provisional, DAS-06; the failover path then uses 3.6% of NFR-02's error budget per outage at the sale peak, as the report computes)
  ordering: null
  delivery: null
# ... versioning and observability ...
sli_bindings: []
spec: null                               # provider A owns its document; the report links it
as_is: new
```

`docs/design/das/DAS-06.yaml`. The timing values that hinge on how the providers behave in operation share it; its statement names them and leaves their values in IFC-01 and IFC-02, so that tuning them changes only those files:

```yaml
id: DAS-06
title: Timeouts on the payment path adopted provisionally
status: open
stage: 3
kind: decision
statement: IFC-02 uses the provisional provider_timeout, payment_wait and failover_after in its timing, and IFC-01's timeout stays above the worst case of the payment path that they give, until operation shows the providers' real latencies and error rates
why_unsure: The values rest on the latencies that provider A states (TC-04), which our own traffic has not measured yet; no input says how often a provider fails, or how long buyers wait before they give up or press again
breadth: medium
severity: low
rating_note: IFC-01 and IFC-02 depend on it, and stage 4's payment router will through IFC-02's timing; tuned in operation, with IFC-01's timeout kept above the worst case whenever the others change
answer: null
answered_in: null
```

`docs/design/ifc/IFC-03.yaml`:

```yaml
id: IFC-03
title: Stock changed events from the warehouse
status: active
basis: inferred
basis_note: The warehouse sends one event per stock change (DAS-01, confirmed in stage 2, question 3); delivery and ordering are as the warehouse team's document gives them; the consumer's handling is inferred
premises: [EXT-02, DAS-01]
kind: event
name: Stock changed
provider: ELM-07
consumers: [ELM-03]
functions: [FR-04, FR-05]
operations:
  - {name: stock.changed, does: Tells that the count of one item at the warehouse changed}
format: JSON
protocol: The warehouse's message broker, one topic
auth: A client certificate issued by the warehouse team
errors:
  - {case: A message that does not match the schema, signal: Rejected by ELM-03 validation, caller_does: ELM-03 sets it aside and alerts; the next message for the item corrects the count}
idempotency: Each message carries an event ID; ELM-03 ignores IDs it has processed
timing:
  timeout: null
  ordering: Per item, by the warehouse's sequence number; ELM-03 drops a message older than the last one stored
  delivery: At-least-once
versioning: Schema version in the message header; ELM-03 ignores unknown fields
observability: ELM-03 logs the event ID, item, sequence number, and the delay between the event time and storing it, for investigating stale stock (DRV-03)
sli_bindings: []
spec: null                               # the warehouse team owns the document; the report links it
as_is: new
```

`docs/design/dat/DAT-04.yaml`:

```yaml
id: DAT-04
title: Stock level
status: active
basis: inferred
basis_note: changed_at keeps the time each count changed at the warehouse, which IFC-03's messages carry; this decides HND-01
premises: []
entity: Stock level
owner: ELM-03
store: ELM-04
key_attributes: [item_id, available_count, warehouse_sequence, changed_at]
relations:
  - {to: DAT-05, kind: one-to-one, note: Catalog item}
consistency: Written only by ELM-03, from IFC-03. ELM-02 never changes it; reservations are a separate entity that ELM-02 owns (DAT-06), and the stock offered to buyers is this count minus the active reservations. ELM-02 reads this table directly, with read-only rights (DEC-13), so the table is part of ELM-03's interface and changes only with a new version
retention: The current value only; history is not kept
classification: internal
drivers: [DRV-03]
sli_bindings: []
as_is: new
```
