# Artifacts

## Contents
- Layout
- Common fields
- design-context.yaml (stage 1)
- DRV: architecture driver (stage 1)
- DEC: design decision (stages 2, 2b, 3 and 4)
- ELM: element (stage 2)
- POL: technical policy (stage 2b)
- IFC: interface (stage 3)
- DAT: data entity (stage 3)
- MOD: module (stage 4)
- HND: hand-off (stages 1 to 4)
- FND: finding (stages 2 to 4, the review and implementation)
- DAS: assumption (every stage and the review)
- QCR: request to the quality chain (every stage and the review)
- The request document (scripts/tables.py)
- The detailed design index (stage 4)

## Layout

All design skills write under `docs/design/`, unless the project already keeps its design somewhere else. In that case, use that location and say so in the report. The quality chain's `docs/quality/` is read only.

```
docs/design/
├── 1-architecture-drivers.md          stage 1 report
├── 2-architecture.md                  stage 2 report, views included
├── 2b-technical-policy.md             stage 2b report
├── 3-high-level-design.md             stage 3 report, flows included
├── 4-detailed-design.md               stage 4 index: every component, its status and the depth of its modules; the hand-off to implementation
├── 4-detailed-design/ELM-02.md        stage 4 report, one per component
├── reviews/3-high-level-design.md     review report, one per reviewed stage (stage 4: per component, reviews/4-detailed-design-ELM-02.md): the latest review
├── quality-chain-requests.md          the request document: the requests to the quality chain, written by scripts/tables.py
├── design-chain.yaml                  optional: the limits that design-chain keeps, set by the user
├── design-context.yaml                the design context: constraints, teams, changes, stakeholders, current structure
├── drv/DRV-01.yaml …                  stage 1: architecture drivers
├── dec/DEC-01.yaml …                  stages 2, 2b, 3 and 4: design decisions
├── elm/ELM-01.yaml …                  stage 2: elements
├── pol/POL-01.yaml …                  stage 2b: technical policies, one per scope
├── ifc/IFC-01.yaml …                  stage 3: interfaces
├── ifc/specs/<name>.openapi.yaml      stage 3: OpenAPI and AsyncAPI documents, for the interfaces whose spec the technical policy says is written by hand
├── dat/DAT-01.yaml …                  stage 3: data entities
├── mod/MOD-01.yaml …                  stage 4: modules
├── hnd/HND-01.yaml …                  stages 1–4: hand-offs, the points a stage leaves to a later stage or to implementation
├── fnd/FND-01.yaml …                  stages 2–4, the review and implementation: findings
├── das/DAS-01.yaml …                  every stage and the review: assumptions made without asking
└── qcr/QCR-01.yaml …                  every stage and the review: requests to the quality chain
```

- One item per file. The file name is the ID: `dec/DEC-07.yaml`.
- IDs are the prefix plus a zero-padded number (`DEC-07`, then `DEC-100` when needed). Never reuse or renumber an ID.
- Write every ID in full wherever you cite it, in lists inside a text too ("FND-30, FND-31", not "FND-30, 31" or "FND-30・31"). The scripts find a citation by its full ID only.
- The YAML items are the source of truth. A report summarizes and indexes them and never restates what an item says; it holds what only the report records (views, flows, walkthroughs, budgets, reasons, decisions). Its index tables are written from the items by `scripts/tables.py` ("Scripts" in `conventions.md`). The items are written while the stage drafts, and answers change them in place. If the report and an item disagree, ask which one is right; do not silently pick one.
- Items hold the current state only: no changelog, no version, no dates of changes. Git keeps the history (`conventions.md`, "Current state only").
- `design-context.yaml` holds the design context that the other items refer to. Stage 1 writes it; later stages and reviews only add facts the user gives them (`conventions.md`, "Judgment basis"). It is the only file that holds more than one entry.
- Views, flows, state diagrams and decision tables live in the reports, as Mermaid diagrams and tables. Items refer to them by the report's section heading.
- Keep the YAML valid. Quote a free-text value when it contains `: ` or ` #`, or starts with one of `[ { * & ! | > ' " % @` or a backtick, and quote any value inside `[ ]` or `{ }` that contains a comma or `: `. Cite decisions and questions without `#` ("decision 12", "design stage 3, decision 4"): an unquoted ` #` starts a comment and silently cuts off the rest of the value.
- The comments in the schemas below explain the fields; do not copy them into the items. In an item, a comment after an unquoted value is reported as a value cut off at ` #`.

## Common fields

Every item file except `design-context.yaml`, the assumption files and the requests (DAS and QCR, which have their own fields) has these fields, first:

```yaml
id: DEC-07
title: Short name, in the working language
status: active             # active | retired   (HND: open | decided | retired; FND: open | accepted | rejected; DAS: open | confirmed | overturned | retired; QCR: open | answered | applied | withdrawn)
basis: inferred            # stated | inferred | assumed | confirmed: the weakest basis of the judgments in the item
basis_note: null           # which parts are stated, inferred, assumed or confirmed, when they differ; findings accepted, hand-offs decided and requests answered
premises: []               # what the item depends on that could change under it: TC, PC, TEAM, CHG, STK, DAS, QCR, and the quality chain's CON, EXT, OPF, QAS
# ... the fields of the item type ...
```

An item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`. A request to the quality chain (QCR) in `premises` does not make it `assumed`.

Every item that describes part of the system also has `as_is: keep | change | new | remove` (see "Existing systems" in `conventions.md`). In a system with no code, it is always `new`.

The examples below follow one fictional online store through all the stages.

## design-context.yaml (stage 1)

```yaml
read_from:
  quality_chain: docs/quality/           # null when the user gave the requirements directly
  other: [Architecture notes (wiki), Roadmap 2026, Kick-off notes, Security team memo]
technology_constraints:                  # the organization's engineering standards among them (the languages, tools and CI it mandates or prohibits, how code is reviewed), which stage 2b follows; a standard that makes a quality check a condition of a merge or a release is a gate of the quality chain instead
  - id: TC-01
    statement: Card payments go through the payment provider's API; card numbers never reach our servers
    kind: external-service               # mandated | prohibited | platform | external-service
    source: context.yaml CON-01; security team memo
    basis: stated
  - id: TC-02
    statement: Runs in the company's existing cloud account, in one region
    kind: platform
    source: Architecture notes
    basis: stated
  - id: TC-03
    statement: The storefront stays a web app this year; no native app
    kind: platform
    source: context.yaml DIN-01                # every design input of the quality chain is taken in as a candidate
    basis: stated
project_constraints:                     # kind: budget | deadline | team | other
  - id: PC-01
    kind: deadline
    statement: First release before the spring sale
    source: Kick-off notes
    basis: stated
  - id: PC-02
    kind: team
    statement: Four developers (TypeScript, PostgreSQL); no dedicated operations engineer
    source: Kick-off notes
    basis: stated
  - id: PC-03
    kind: budget
    statement: Not set until the funding review in March
    source: Stage 1, question 3
    basis: confirmed
teams:
  - {id: TEAM-01, name: Store team, owns: Storefront and checkout and stock, basis: stated}
anticipated_changes:
  - {id: CHG-01, change: Add a second payment provider, expected: Within a year, source: Roadmap 2026, basis: stated}
stakeholders:                            # roles that are not users in context.yaml, but whose concerns the design must meet
  - {id: STK-01, role: Product owner, concerns: [Release date, Running cost], source: Kick-off notes, basis: stated}
as_is:                                   # only when the repository holds code or infrastructure definitions; the online store in these examples has none, so this block only shows the shape
  read: [src/, infra/terraform/]
  not_learned: Production volumes and runtime behaviour
  elements:
    - {name: storefront, kind: component, technology: Next.js, note: Server-rendered pages and the cart}
    - {name: orders-db, kind: data-store, technology: PostgreSQL 15, note: Orders and payments and stock}
  conventions: [REST under /api/v1, "errors as {code, message}"]
```

## DRV: architecture driver (stage 1), `drv/DRV-01.yaml`

```yaml
id: DRV-01
# ... the other common fields ...  (premises: [OPF-03, QAS-08]; QAS-08, the provisional target behind NFR-02, was asked in stage 1, question 6, and QCR-03 carries the answer to the quality chain; the ranking is a business decision, see "Decisions" in conventions.md)
kind: quality                            # quality | change | constraint | function | observability | security | principle
statement: Checkout confirms orders without keeping buyers waiting, up to sale-peak load
sources: [QR-02, NFR-02, SLI-02]         # quality-chain IDs and design-context IDs (TC, PC, TEAM, CHG, STK)
concern_of: [USR-01]                     # user IDs from context.yaml, stakeholder IDs from design-context.yaml
scenario:                                # quality, change, observability and security drivers; optional for function drivers; null for constraints and principles
  source: Buyers on smartphones (USR-01)
  stimulus: Submit the checkout during a sale
  artifact: Checkout (FR-01)
  environment: Sale peak (OPF-03); normal operation
  response: The order is confirmed and the confirmation page is shown
  measure: NFR-02's SLO, counted by SLI-02     # name the chain's measure by ID; do not copy its statement
negotiable: null                         # constraints and principles: true | false
derived_from: []                         # principles: the drivers a principle serves
priority:                                # every driver except principles
  business: high                         # high | medium | low
  business_reason: QR-02 is emphasized for CUJ-01
  difficulty: high                       # high | medium | low: how hard to achieve, and how hard to undo
  difficulty_reason: The payment provider's latency and its fraud screening both sit inside the 1.5 s
  rank: 1
primary: true                            # primary drivers decide stage 2's first decisions
conflicts:
  - {with: DRV-06, note: Fraud screening adds latency to the same request}
placeholders: []                         # named placeholders from the quality chain, kept as they are
```

A principle is a rule for the whole system that follows from several drivers ("every operation that moves money can be repeated without moving it twice"). It has a `statement`, `derived_from` and `negotiable`, and no scenario and no priority.

## DEC: design decision (stages 2, 2b, 3 and 4), `dec/DEC-02.yaml`

```yaml
id: DEC-02
# ... the other common fields ...  (premises: [TC-01, CHG-01, DAS-02])
stage: architecture                      # architecture | technical-policy | high-level-design | detailed-design
question: How does checkout keep confirming orders when the payment provider fails?
addresses: [DRV-02, DRV-10]              # the drivers, interfaces or findings the decision answers, or the FR, QR, NFR or SLI it answers directly
options:
  - name: One provider, retries with back-off
    effect: Rides out short errors; an outage still stops checkout
    cost: Little work
  - name: Fail over to a second provider
    effect: Checkout continues while either provider is down
    cost: A second contract and integration; reconciliation across two providers
chosen: Fail over to a second provider
rationale: DRV-02 asks checkout to continue through a provider outage, which retries cannot do; CHG-01 already plans a second provider
rejected:
  - {option: "One provider, retries with back-off", reason: Does not meet DRV-02 during an outage}
gains: [Checkout survives an outage of either provider]
costs: [A second integration to build and test, Reconciliation must cover two providers]
sensitive_points: [The error threshold that opens a provider's breaker - too low switches back and forth; too high keeps buyers waiting on a failing provider]
trade_offs: [{with: DRV-07, note: A second contract raises running cost}]
assumptions: ["The second provider works like the first: hosted card fields, and fraud screening inside its charge (DAS-02)"]   # what the decision relies on; one you were unsure of and did not ask about is a DAS in premises
depends_on: [DEC-01]
parameters: []                           # {name, value, basis}: provisional design values that this stage sets, each a decision ("Numbers" and "Decisions" in conventions.md); DEC-02 sets none, and leaves the value of its sensitive point to stage 3 (HND-02)
debt:                                    # {what, why_accepted, repay_when}; null when the decision accepts none
  what: Failover ships right after the spring sale; until then an outage of the provider stops checkout
  why_accepted: "The business keeps the date and accepts the risk (stage 1, question 5)"
  repay_when: Right after the spring sale
as_is: new
```

What a decision leaves to a later stage, or to an event, is a hand-off (HND) whose `origin` names the decision.

## ELM: element (stage 2), `elm/ELM-02.yaml`

```yaml
id: ELM-02
# ... the other common fields ...
kind: component                          # component | data-store | external-system | node
name: Store API
responsibility: Serves the catalog, cart, checkout and order history; confirms orders and takes payment
functions: [FR-01, FR-03, FR-04]         # FRs allocated to it; [] for nodes
drivers: [DRV-01, DRV-02, DRV-05]        # drivers it carries
decisions: [DEC-01, DEC-02, DEC-04]
team: TEAM-01                            # null when no team structure is given
technology: Node.js, in containers (DEC-04)   # the runtime and the platform it runs on; the language, framework and libraries are stage 2b's, for each kind of component; null until decided
runs_on: ELM-08                          # the node it is deployed to; null for external systems
depends_on: [ELM-04, ELM-05, ELM-06]
as_is: new
```

For an external system, `responsibility` says what the design assumes it does and `functions` stays empty; what it promises (an SLA, a rate limit) goes in `assumptions` of the decisions that rely on it.

## POL: technical policy (stage 2b), `pol/POL-03.yaml`

Stage 2b writes one POL for each scope of the technical policy: the rules that the code of every component follows and that the later stages keep, each decided once for the whole system. Coding agents read them before they change code.

| Scope | What it decides | Fields of its own |
|---|---|---|
| `technology` | The language, framework and main libraries of each kind of component, and the tools every component shares | `stack`: one entry per kind of component, `{kind, elements, language, runtime, framework, libraries}`; every component is in exactly one |
| `repository` | The repositories, the layout of their directories, and the dependency rules | `repositories`: `{name, holds}`, every component held by exactly one; `dependency_rules`: `{rule, check}`, each naming the check in CI that enforces it |
| `testing` | The test layers, the test doubles, the environments and their test data; where the quality chain's gates are checked and its audits held | `layers`: `{layer, covers, replaces, runs}`; `doubles`: `{replaces, with, seam}`; `environments`: `{name, runs, data}`; `gate_bindings` and `audit_bindings` (below) |
| `pipeline-and-code` | The pipeline, deployment and rollback, the static checks, and the conventions inside the code: errors, logs, settings and secrets, texts for people | `pipeline`: the steps in order, `{step, when, runs, blocks}` |
| `specs` | For each kind of interface, how its spec is made | `specs`: `{interfaces, made, how}`; `made` is `by-hand` (written in stage 3 before the code), `from-code` (generated from the code), `owner` (the other side's document) or `none` (no document: screens, batch jobs) |
| `implementation-feedback` | How coding agents find the design and the policies, and how implementation's findings come back | none |

Every POL has the common fields, then `scope`, `addresses`, `decisions`, `rules` and `as_is`, and the fields of its own scope; it leaves out the fields of the other scopes. The testing policy of the online store:

```yaml
id: POL-03
# ... the other common fields ...  (premises: [PC-02, TC-02, DAS-03, DAS-04, DAS-05]; so basis: assumed)
scope: testing                           # technology | repository | testing | pipeline-and-code | specs | implementation-feedback
addresses: [DRV-02, DRV-05]              # the drivers and the quality chain's QRs that the policy serves; gates and audits are traced by their bindings
decisions: [DEC-02]                      # the decisions that set the policy: this stage's, and an earlier stage's that it follows
rules:                                   # every scope: what the code and the later stages keep, each with how a breach is found (a pipeline step, a test or the review of a pull request; null when nothing finds it)
  - rule: Every acceptance criterion allocated to a module is checked at the lowest layer that can check it
    check: The review of the pull request, against the module's verification approach
layers:
  - layer: Unit
    covers: The rules of one module - decision tables, calculations, state transitions
    replaces: Everything outside the module
    runs: In the pipeline's check step, on every push
  - layer: Integration
    covers: One component through its interfaces, with its own tables in PostgreSQL
    replaces: The external systems, with the doubles below
    runs: In the pipeline's check step, against PostgreSQL in a container
  - layer: Contract
    covers: The adapters of the payment providers against the providers' sandboxes
    replaces: Nothing
    runs: In the pipeline's release step, from the staging environment
  - layer: End-to-end
    covers: CUJ-01 and its failure paths, through the storefront's screens
    replaces: The payment providers and the warehouse, with the doubles below
    runs: In the pipeline's release step, against the staging environment
doubles:
  - replaces: ELM-05 and ELM-06, the payment providers
    with: A fake provider that can decline, time out, answer late, and report a charge it took after a timeout
    seam: The payment adapter's interface in ELM-02 (DEC-02)
  - replaces: ELM-07, the warehouse system
    with: Stock events that the test publishes to a local broker, late, twice or out of order
    seam: The broker client of ELM-03
  - replaces: The clock and the generation of IDs
    with: A clock the test sets and moves, and IDs from a generator the test seeds
    seam: A clock and an ID generator handed to every module that reads the time or makes an ID
environments:
  - name: CI
    runs: The check step, with PostgreSQL in a container and the doubles
    data: Built by factories in each test; no copy of production data
  - name: Staging
    runs: The release step's end-to-end and contract tests, on the platform of ELM-08, started for the step and stopped after it (DAS-05)
    data: Seeded by a script with fictional buyers and items; the providers' sandboxes hold no real card
gate_bindings:                           # one entry per NFR of kind gate in the quality chain
  - nfr: NFR-06
    where: "The Definition of Done in the pull request template: the reviewer ticks it, and a pull request that changes the payment path cannot merge until it is ticked"
    by: An integration test for each payment path that fails a payment and checks that the log lines of the order and of the charge carry the same request_id; the reviewer checks that a new payment path has one
audit_bindings:                          # one entry per NFR of kind audit in the quality chain
  - nfr: NFR-05
    where: "Its fix deadline: a ticket that the dependency scan of the pipeline's check step opens, with the deadline as its due date. Its audit: a ticket that a scheduled job opens from a template at the cadence NFR-05 sets, which keeps the audit's record"
    by: The dependency scan of the check step (POL-04) finds the vulnerabilities; the security team performs the audit (DAS-03)
as_is: new
```

A gate binding is to a gate what an SLI binding is to an SLI: it decides where and by what the gate is checked, never what passes.

- `nfr`: the ID of the gate, an NFR of kind `gate`.
- `where`: the place that realizes the gate's `where` in the quality chain: for `CI`, the pipeline step and what a failure there blocks; for `release-check`, the step or the checklist that a release passes before it goes out; for `definition-of-done`, the checklist that holds the item, and who ticks it.
- `by`: what runs the gate's check and judges its threshold: a test layer and its tests, a tool, or a person and what they look at; and what it needs (an environment, test data, a double).

An audit binding places an NFR of kind `audit`, with the same fields: `where` it is held, so that its cadence or deadline is kept, and where its record is kept; `by` what supports it and who performs it. Neither binding copies the NFR's check, threshold, criterion or cadence: they stay in the NFR. A gate or an audit that no design within the constraints can realize as the quality chain defines it gets a request to the quality chain with the NFR in `targets`, which the stage 2b report's table names in place of the binding. A gate that the design finds missing is a request too; no policy adds one of its own.

## IFC: interface (stage 3), `ifc/IFC-01.yaml`

```yaml
id: IFC-01
# ... the other common fields ...
kind: http                               # http | event | file | screen | batch
name: Checkout API
provider: ELM-02
consumers: [ELM-01]                      # elements; for a screen, the users (USR IDs) who use it. Here: the storefront's checkout script, running in the buyer's browser
functions: [FR-01]                       # the FRs whose acceptance criteria pass through it
operations:                              # http: method and path; event: message; file and batch: the file or job; screen: the screen
  - {name: POST /v1/checkout, does: Confirms the cart as an order and charges the buyer}
format: JSON
protocol: HTTPS, request and response
auth: Buyer session cookie
errors:                                  # the error contract
  - {case: Card declined, signal: 402 with code CARD_DECLINED, caller_does: Show the decline and keep the cart}
  - {case: No provider could take the payment and every provider tried confirmed that nothing was charged, signal: 503 with code PAYMENT_UNAVAILABLE, caller_does: Ask the buyer to try again later}
  - {case: The outcome of the payment is not settled yet because a provider timed out, signal: 202 with code PAYMENT_PENDING and the order ID, caller_does: Show that the payment is being confirmed and poll the order; never submit again with a new key}
  - {case: The same key while the first request is still running, signal: 409 with code CHECKOUT_IN_PROGRESS, caller_does: Wait and poll the order}
  - {case: The same key with a different cart, signal: 422 with code KEY_REUSED, caller_does: Start a new checkout with a new key}
idempotency: One Idempotency-Key per order - the storefront creates it when the buyer first submits the cart and reuses it on every retry; the same key returns the first result
timing:                                  # on the paths of time SLOs and of money, every timeout and wait; on other calls, only their bounds, with the values handed off to stage 4
  timeout: 15 s (provisional; above the worst case of the payment path, 10.3 s, so that a payment still running is never abandoned; the 1.5 s of NFR-02 is a target, not a timeout)
  ordering: null                         # events: the ordering guarantee and its key
  delivery: null                         # events: at-most-once | at-least-once, and how duplicates are handled
versioning: Version in the path; only additive changes within v1
observability: Logs request_id and outcome in the service, for investigations
sli_bindings:                            # how this interface yields the events of quality-chain SLIs, without changing what the SLI counts
  - sli: SLI-02
    events: Each POST /v1/checkout request that reaches the load balancer in front of ELM-02 (the SLI's vantage is the system boundary); requests with the same Idempotency-Key are one checkout, counted by the first request
    fields: [request_id, idempotency_key, status, elapsed, user_agent]
    method: The load balancer's access logs, which already exist (OPF-02), with the Idempotency-Key header added to the logged fields
spec: null                               # the document under ifc/specs/ when the technical policy says the interface's spec is written by hand; null otherwise. IFC-01's spec is generated from ELM-02's code (POL-05), and HND-04 hands its schema to implementation
as_is: new
```

## DAT: data entity (stage 3), `dat/DAT-01.yaml`

```yaml
id: DAT-01
# ... the other common fields ...
entity: Order
owner: ELM-02                            # the one element that writes it
store: ELM-04
key_attributes: [order_id, buyer_id, total, payment_state, created_at]
relations:
  - {to: DAT-02, kind: one-to-many, note: Order lines}
  - {to: DAT-03, kind: one-to-many, note: Payment attempts}
consistency: The order and its lines are written in one transaction, as pending; each payment attempt and the order's final state are written in a second transaction once the provider answers
retention: T_order_retention             # a stated period, or a named placeholder listed under "Placeholders" when no input gives one
classification: personal                 # public | internal | personal | payment | other (say which)
drivers: [DRV-05]
sli_bindings: []                         # data SLIs: how this entity yields the SLI's events (which timestamps or attributes), as in IFC
as_is: new
```

## MOD: module (stage 4), `mod/MOD-02.yaml`

```yaml
id: MOD-02
# ... the other common fields ...
component: ELM-02
name: Order total calculator
depth: full                              # full | bounds: full for a module that moves money, settles an unknown outcome, shares state with work that runs at the same time, applies rules with several conditions or migrates data, or that would rate high at bounds depth; bounds for any other, whose inside implementation decides
depth_reason: Applies the shipping fee rules, which have several conditions   # full: the kind, or why it would rate high at bounds depth; bounds: null, or the question or DAS that deferred a module of those kinds
responsibility: Calculates an order's total from its lines, shipping, coupons and points
visibility: internal                     # public: other components call it through an IFC | internal: only modules of the same component call it
interface:                               # full: the whole contract; bounds: a summary - the signature, post and errors of each operation, with pre only when the caller must check something the module does not
  - operation: "calculateTotal(order: OrderDraft) -> Money"
    pre: Every line has a positive quantity and a price
    post: The total is the sum of the lines plus shipping, minus discounts, and never below zero
    errors: ["CouponExpired: the coupon was valid when added and has expired since"]
invariants: []                           # what always holds for the module's state; [] when it holds no state, and at bounds depth
depends_on: [MOD-05]
functions: [FR-03]
realizes: []                             # the IFC operations this module implements, each as the IFC ID and the operation's name ("IFC-01 POST /v1/checkout"); each operation has exactly one module in each component that takes part in it (MOD-01 realizes IFC-01 in ELM-02)
drivers: [DRV-04]
decisions: [DEC-16]
behaviour: "Report section: MOD-02 Order total calculator"   # where its states, decision tables and algorithms are drawn; null at bounds depth
verification:
  - {checks: "FR-03, criteria 1 to 3", how: Unit tests generated from the decision table}
parameters: []                           # its design values, at full depth only; implementation sets those of a module at bounds depth
as_is: new
```

A module at full depth is designed in detail: its whole contract here, and its states, decision tables, concurrency and the physical data that keeps its invariants in the component report. A module at bounds depth gets only its responsibility, a summary of its contract, the acceptance criteria allocated to it and its verification; implementation decides its inside ("Decision depth" in `conventions.md`).

## HND: hand-off (stages 1 to 4), `hnd/HND-01.yaml`

A stage decides each point at one of three depths: full (every detail), bounds (only the promise later stages keep) or hand-off (none of it) (`conventions.md`, "Decision depth"). A hand-off carries one point that a stage defers, whole or in its detail, to the stage that will decide it or to implementation ("Hand-offs" there). The stage that writes it owns `what`, `bounds` and `origin`; the stage it is addressed to records `status`, `to`, `component`, `trigger` and `resolution` as it takes it up.

A point that a quality-chain item leaves for the design to confirm, which stage 1 hands to the stage that designs the part:

```yaml
id: HND-01
title: Where the time of a stock change at the warehouse can be read
status: decided                          # open | decided | retired
basis: inferred
basis_note: The point is stated in SLI-03's basis_note; the stage it goes to is inferred
premises: [EXT-02]
from: requirements-to-architecture-drivers   # the skill that wrote it
to: architecture-to-high-level-design    # the skill that decides it, or implementation; a stage that passes it on changes it
component: null                          # for a hand-off to stage 4 or to implementation: the component (ELM ID) it concerns
origin: [SLI-03]                         # the items the point comes from; for stage 1, the quality-chain item that leaves it to the design
what: Whether the store learns when each stock count changed at the warehouse, so that SLI-03 can compare that time with the time buyers see the change
bounds: SLI-03's unit event and counting rules, unchanged; DRV-03   # what the decision must keep, by the IDs of the items that set it
trigger: The next run of stage 3         # that stage's next run, its run for a component, the implementation of a named part, or an event outside the chain (a measurement in operation, a signed contract, a date)
resolution: "Confirmed in DAT-04: changed_at keeps the time of the change, which IFC-03's messages carry"   # written by the stage that takes it up: the items that decide it, or why it passed it on
```

A detail that stage 4 leaves to implementation, inside a module at full depth:

```yaml
id: HND-06
title: Where the coupon rules are kept
status: open                             # a hand-off to implementation stays open: the code and its tests decide it
basis: inferred
basis_note: null
premises: []
from: high-level-design-to-detailed-design
to: implementation
component: ELM-02
origin: [MOD-05]
what: Where the coupon rules are kept (a table, a file or code) and how MOD-05 reads them
bounds: MOD-05's interface, and the decision table in its report section
trigger: When MOD-05 is implemented
resolution: null
```

## FND: finding (stages 2 to 4, the review and implementation), `fnd/FND-01.yaml`

```yaml
id: FND-01
title: Failover after a timeout can charge the buyer twice
status: open                             # open | accepted | rejected; a rejection that leaves a risk in place is a decision
basis: inferred
basis_note: null
premises: []
raised_by: design-review                 # or the stage skill that found it, or implementation
raised_in: reviews/3-high-level-design.md   # the report it was raised in; for implementation, the path of the code where the problem shows
to: architecture-to-high-level-design    # the skill that must decide
targets: [IFC-02]
severity: critical                       # critical | major | minor
evidence: The checkout flow sends the charge to provider B as soon as provider A times out. A may still complete its charge, and A's idempotency key does not cover B, so the buyer can be charged twice (DRV-05)
suggestion: Treat A's timeout as an unknown outcome and settle it at A (look up the key and cancel it if found) before charging B; if A cannot be settled within payment_wait, keep the order pending for reconciliation and tell the buyer the payment is being confirmed
resolution: null                         # written by the addressed stage: what changed, or why the finding is rejected
```

A finding raised by implementation has the same fields, with `raised_by: implementation`. It concerns a decision the code cannot keep, never a detail the design leaves open (`conventions.md`, "Findings between design stages").

Severity:

- `critical`: a primary driver, a non-negotiable constraint or principle, or a CUJ cannot be met as designed.
- `major`: a driver, a function or an interface is met only in part, or two items contradict each other.
- `minor`: a detail is unclear, inconsistent or incomplete, and nothing fails because of it.

## DAS: assumption (every stage and the review), `das/DAS-02.yaml`

One judgment made without asking, because neither of its ratings was high (`conventions.md`, "Draft first, ask afterwards"). The items that depend on it list it in `premises`.

```yaml
id: DAS-02
title: The second payment provider works like the first
status: open                             # open | confirmed | overturned | retired
stage: 2                                 # 1 | 2 | 2b | 3 | 4 | review-2 | review-2b | review-3 | review-4: the stage, or the review of a stage, that wrote it
kind: judgment                           # judgment | decision (a business decision adopted provisionally, such as a design parameter)
statement: The second provider offers hosted card fields, so card numbers still never reach our servers (TC-01), and screens for fraud inside its charge, as the first does (DRV-06)
why_unsure: CHG-01 names a second provider but not which one; most providers offer hosted fields, not all
breadth: medium                          # high | medium | low
severity: low                            # high | medium | low
rating_note: A few items of stages 2 and 3 depend on it; checked when the provider is chosen, before any of it is built
answer: null                             # the user's answer, when someone asked about it later
answered_in: null                        # where, e.g. "stage 3, question 4" or "review of stage 3, question 2"
```

## QCR: request to the quality chain (every stage and the review), `qcr/QCR-06.yaml`

One change that the design asks the quality chain to make (`conventions.md`, "Requests to the quality chain"). The stage or review that raises it owns its content; any stage or review records its `status`, `answer` and `answered_in`, re-rates its `impact` and `impact_note`, and fits its `targets` and `quality_stages` to an answer that asks for another change than the one suggested. The items that would change with it list it in `premises` (an item that rests on a QAS whose answer it carries lists the QAS instead); a request does not list them.

```yaml
id: QCR-06
title: How a percentage coupon is rounded
status: answered                         # open | answered | applied | withdrawn
stage: 4                                 # 1 | 2 | 2b | 3 | 4 | review-2 | review-2b | review-3 | review-4: the stage, or the review of a stage, that raised it
targets: [FR-03]                         # the quality-chain items it asks to change, or that show what is missing
origin: [MOD-02, MOD-05]                 # the design items that show the issue
issue: FR-03's acceptance criteria do not say how a percentage discount is rounded, and MOD-05's decision table needs the rule
suggestion: Add the rounding rule to FR-03 as an acceptance criterion
quality_stages: [2]                      # the quality-chain stages that make the change: 1 the context and quality in use, 2 functions, 3 quality requirements, 4 NFRs, SLIs and error budget policies; for a QAS, the stage that wrote it; [] when there is no quality chain
impact: high                             # high | low: what the design would redo if the quality chain decided otherwise
impact_note: MOD-02 and MOD-05 move money, which stage 4 decides in full, and MOD-05's decision table rests on the rule
answer: Once on the order. The percentage applies to the sum of the eligible lines, and the discount is rounded down to the minor unit, so that a buyer never gets more than the stated percentage
answered_in: stage 4 ELM-02, question 2  # where the user answered: a question, quality-chain-requests.md, or a later stage the user told
```

A request that carries the answer to a question about a QAS names the QAS in `targets`, with the chain items it covers, and the stage that wrote the QAS in `quality_stages`; its suggestion says whether the assumption holds. A gate, a target or a threshold that the design finds the system needs is a request too, whose suggestion names the NFR it would add or change; the design never writes one into its own items.

## The request document (scripts/tables.py), `docs/design/quality-chain-requests.md`

`scripts/tables.py` writes the whole document whenever it runs, from the requests that are open or answered, in the working language (Japanese or English; another language gets English): the list, each request with its answer, and what each quality-chain stage would change. Applied and withdrawn requests leave it. The user reads it, writes answers in it after "Answer:", and hands it to the quality chain; nothing else in it is edited by hand. A run records each answer written there in its request before it runs the script. The last line holds a fingerprint of each part of the document as the script wrote it: in the parts edited since, the script compares each answer with its request, and leaves the document as it is, and says so, while an answer or other text written by hand is not in the requests (`conventions.md`, "Requests to the quality chain").

The online store's document, with the requests that stages 1, 3 and 4 and the review of stage 3 raise in the worked examples of the report templates:

```markdown
# Requests to the quality chain

<!-- Written by scripts/tables.py from the requests in qcr/. Edit nothing but the answers: write an answer after "Answer:" under a request, and the next design run records it in the request. The fingerprints on the last line tell the script what was edited by hand. -->

The design chain never changes the quality chain (`docs/quality/`). When the design shows that a requirement should change, or that one it needs is missing, it writes a request; every request that is open or answered is here. Write an answer after "Answer:" under a request when you know it: the next design run records it. Then hand this document to the quality-chain stages listed under "What to do in each quality-chain stage", and re-run them. On their next run, the design stages follow what changed in `docs/quality/`, and drop the requests applied there.

## List

| QCR | Request | Chain items | Quality-chain stages | Impact | Status | Raised in |
|---|---|---|---|---|---|---|
| QCR-01 | A target for checkout during a provider outage | QR-08 | 4 | high | answered | stage 1 |
| QCR-02 | The stock-freshness threshold and target hold | NFR-03, QAS-09 | 4 | high | answered | stage 1 |
| QCR-03 | The checkout latency target holds | NFR-02, QAS-08 | 4 | high | answered | stage 1 |
| QCR-04 | A load test of checkout before the spring sale | NFR-02 | 4 | low | open | stage 3 |
| QCR-05 | Whether a pending payment counts as a checkout answered in time | SLI-02 | 4 | low | open | review of stage 3 |
| QCR-06 | How a percentage coupon is rounded | FR-03 | 2 | high | answered | stage 4 |

## Requests and answers

<QCR-01 to QCR-03 in the same form>

### QCR-04 A load test of checkout before the spring sale

- Status: open · Raised in: stage 3
- Impact: low. No design item changes with it; it adds a check before release
- Chain items: NFR-02 · Quality-chain stages: 4
- Origin: IFC-01, IFC-02 · Items that depend on it: —
- Issue: NFR-02's latency budget gives ELM-02's own work and the database provisional values that nothing has measured, and no NFR checks the whole checkout flow at the sale peak before release
- Suggested change: Add an NFR of kind gate that load-tests checkout at the sale peak (OPF-03) before release, against NFR-02's threshold

Answer: —

<QCR-05 in the same form>

### QCR-06 How a percentage coupon is rounded

- Status: answered (stage 4 ELM-02, question 2) · Raised in: stage 4
- Impact: high. MOD-02 and MOD-05 move money, which stage 4 decides in full, and MOD-05's decision table rests on the rule
- Chain items: FR-03 · Quality-chain stages: 2
- Origin: MOD-02, MOD-05 · Items that depend on it: MOD-02, MOD-05
- Issue: FR-03's acceptance criteria do not say how a percentage discount is rounded, and MOD-05's decision table needs the rule
- Suggested change: Add the rounding rule to FR-03 as an acceptance criterion

Answer: Once on the order. The percentage applies to the sum of the eligible lines, and the discount is rounded down to the minor unit, so that a buyer never gets more than the stated percentage

## What to do in each quality-chain stage

Re-run each stage below with this document. It applies the answers and decides with you the requests that have none; the later quality-chain stages follow its changes on their own re-run.

### Stage 2 (`quality-in-use-to-functional-requirements`)

- FR-03: QCR-06 How a percentage coupon is rounded (answered)

### Stage 4 (`product-quality-to-slo`)

- QCR-01 A target for checkout during a provider outage (answered)
- NFR-03, QAS-09: QCR-02 The stock-freshness threshold and target hold (answered)
- NFR-02, QAS-08: QCR-03 The checkout latency target holds (answered)
- NFR-02: QCR-04 A load test of checkout before the spring sale (open)
- SLI-02: QCR-05 Whether a pending payment counts as a checkout answered in time (open)

<!-- fingerprints: rest bf9534b6ee, QCR-01 9a728d2f53, QCR-02 c45afbb346, QCR-03 7f4f932156, QCR-04 77b9920e09, QCR-05 5ac7af170d, QCR-06 2f7f6f4475 -->
```

## The detailed design index (stage 4), `docs/design/4-detailed-design.md`

Stage 4 keeps one row per element of kind `component`, with its modules at each depth. The tables of a data store are designed by the components that own the entities stored in it; external systems and nodes get no detailed design. `scripts/tables.py` writes the table from the elements, the component reports and the modules. Under it, the hand-off to implementation is what coding agents read first: the rules for treating the design, then every open hand-off addressed to implementation, whichever stage wrote it, in a second table that `scripts/tables.py` writes from the hand-offs.

```markdown
# Detailed design index: <system name>

Updated: <date> · Inputs as of: <commit, or "none">

<!-- generated: components -->
| Component | Name | Status | Report | Full depth | Bounds depth |
|---|---|---|---|---|---|
| ELM-01 | Storefront | not started | — | — | — |
| ELM-02 | Store API | answers applied | 4-detailed-design/ELM-02.md | MOD-01 to MOD-07, MOD-09 to MOD-10 | MOD-08, MOD-11 to MOD-12 |
| ELM-03 | Stock sync worker | not started | — | — | — |
<!-- /generated -->

## Hand-off to implementation

- Implement each component within its MOD items and its component report: every module within its MOD item and the report's Types, Data and Verification approach; a module at full depth also within the report section its `behaviour` names, and the caches, screens and design parameters the report gives it. Keep the interfaces (IFC), data entities (DAT) and decisions (DEC) that bind the component, and the technical policies (POL) that bind every component: its stack, its directories and dependency rules, its test layers, the pipeline and the conventions inside the code, which `2b-technical-policy.md` indexes.
- Decide what the design leaves open: the inside of each module at bounds depth, the tables beyond what the reports' Data sections give (within the DATs), the values the design does not set, and the hand-offs below. The code and its tests hold these decisions; do not write them back into `docs/design/`.
- When the code cannot keep a decision the design made (a contract, an invariant, an interface, a policy or a decision that does not work as written, or two items that contradict each other), do not work around it in silence: write a finding, and tell the user which stage to re-run. A detail the design leaves open is never a finding. A finding is a new file in `docs/design/fnd/`, numbered after the highest FND there, with the fields the other files there have (`references/artifacts.md` of the design skills defines them):
  - `raised_by: implementation`, and in `raised_in` the path of the code where the problem shows;
  - `to`: the skill that wrote the item: `requirements-to-architecture-drivers` for a DRV, `architecture-drivers-to-architecture` for an ELM, `architecture-to-technical-policy` for a POL, `architecture-to-high-level-design` for an IFC or a DAT, `high-level-design-to-detailed-design` for a MOD, and for a DEC the skill of its `stage`;
  - `severity`: `critical` when a primary driver, a non-negotiable constraint or a CUJ cannot be met as designed, `major` when something is met only in part or two items contradict each other, and `minor` otherwise.

<!-- generated: implementation-handoffs -->
| HND | Component | Title | Trigger |
|---|---|---|---|
| HND-04 | ELM-02 | The schemas of the interfaces between elements that ELM-02 provides | When ELM-02 is implemented |
| HND-06 | ELM-02 | Where the coupon rules are kept | When MOD-05 is implemented |
<!-- /generated -->
```

Status: `not started` when the component has no report, otherwise the status in its report's header (`draft`, `waiting for answers` or `answers applied`), written with the glossary's terms in the working language. A component's modules with no `depth` yet, written by an earlier version, are listed under full depth. Write the three rules of the hand-off as they stand here, in the working language, whatever else changes in the index.
