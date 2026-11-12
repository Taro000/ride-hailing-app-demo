# Stage 1 report template and worked example

## Contents
- Report template (`docs/design/1-architecture-drivers.md`)
- Worked example: online store
- Example items

Write the report in the working language. Translate the headings. Keep the IDs as they are, and write the basis marks, statuses and other enum values with the glossary's terms for the working language.

The report indexes `design-context.yaml`, the DRV, HND and DAS items, and never restates them: statements, scenarios, reasons and values live in the YAML only, and the report's tables hold IDs, titles or short labels, enum values and references. What the report holds that no item does: the summary, the inputs and how each input item was classified, the boundary list, the excluded QRs checked, where the primary line falls, who resolves each conflict, the feasibility check, decisions, placeholders, open gaps and what is out of scope. The requests to the quality chain are QCR items, which `quality-chain-requests.md` lists; the report does not.

`scripts/tables.py` writes the tables between `<!-- generated: <name> -->` and `<!-- /generated -->` from the items ("Scripts" in `conventions.md`): the design context, the architecture drivers, the ranking table, the conflicts, the findings, the hand-offs and the open assumptions. Do not edit them by hand. In them, the report writes only these cells, which the script keeps: the label of each design-context entry, who resolves each conflict, and the breadth and severity of a quality-chain assumption as this stage rates it (the script starts them from the QAS's own). Every other table is written by hand.

## Report template

```markdown
# Architecture drivers: <system name>

Status: draft | waiting for answers | answers applied · Updated: <date> · Inputs as of: <commit, or "none"> · Stage 1 of 4

## Summary
<Two or three sentences: the primary drivers in a phrase each, the hardest conflict, the feasibility verdict, the inputs of the design context still missing.>

## Inputs
| Source | What it gave |
|---|---|
<One row per source: docs/quality/ (which items and shared facts), each document or note the user gave, the code read.>

## Boundary and the outside
| Outside | Kind | Exchanges with the system through |
|---|---|---|
<Users by kind (USR IDs; mark the people who create data), external systems (EXT IDs; mark those that create data), and for each the interfaces the FRs name, by kind and FR ID. Stage 2 draws it.>

## Current structure
<For an existing system: what was read, what the code cannot tell, and the elements found, by name (the detail is under `as_is` in design-context.yaml). Otherwise one line: "No existing code; everything is new.">

## Design context
<!-- generated: design-context -->
| ID | Label | Kind | Source | Basis |
|---|---|---|---|---|
<!-- /generated -->
<Technology constraints (the DINs taken in and the organization's engineering standards included), project constraints, teams, anticipated changes, stakeholders. Label, by hand: a few words, not the statement. A missing input is an entry too: its statement says what is missing, its source names the question or the DAS, and its label says "missing".>
<One line on platforms and device support: the TC that fixes them, or "No input fixes them; stage 2 decides them from the kinds of device in the contexts of use.">

## Concern inventory
| Input item | Kind | Whose concern | Became |
|---|---|---|---|
<Every FR, QR (whatever its handling), NFR, SLI, entry point, CON, DIN and design-context entry, once each; items set aside for the same reason can share a row. "Became" is a DRV ID, "inside DRV-xx", a TC ID, or "set aside: <reason>".>

## Architecture drivers
<!-- generated: drivers -->
| DRV | Title | Kind | Negotiable | Sources | Premises | Basis |
|---|---|---|---|---|---|---|
<!-- /generated -->
<One row per driver, grouped by kind. Negotiable is shown for constraints and principles only.>

## Excluded quality requirements checked
| QR | Cost to add later | Candidate | Reason |
|---|---|---|---|

## Ranking table
<!-- generated: ranking -->
| Rank | DRV | Business priority | Design difficulty | Primary |
|---|---|---|---|---|
<!-- /generated -->
<The reasons are in each DRV's `priority`. Under the table, by hand: the number of primary drivers, why the line falls where it does, and the question that decided the ranking.>

## Conflicts
<!-- generated: conflicts -->
| Drivers | Resolved by |
|---|---|
<!-- /generated -->
<One row per pair of drivers whose `conflicts` name each other; what each conflict is lives there. Resolved by, by hand: stage 2 (by design, with the options it should weigh), the business (a question number), or the quality chain (a request, QCR-xx).>

## Feasibility
| DRV | Known way with this budget, deadline and team | Why |
|---|---|---|
<One row per primary driver: "yes", "yes, if <condition>", or "no known way". Name a missing budget or deadline.>

## Findings
<!-- generated: findings -->
| FND | Title | Severity | Raised by | To | Status | Items changed |
|---|---|---|---|---|---|---|
<!-- /generated -->
<The findings addressed to this stage, from a later stage or a review, and those this stage raised. Items changed are the items whose `basis_note` cites the finding; the reason for a rejection is in its `resolution`, and a rejection that leaves a risk in place is also under "Decisions".>

## Hand-offs
<!-- generated: handoffs -->
| HND | Title | From | To | Component | Status | Decided in |
|---|---|---|---|---|---|---|
<!-- /generated -->
<The hand-offs this stage wrote, and those addressed to it. This stage writes one for each point that a quality-chain item leaves for the design to confirm and that becomes no driver, constraint, question or DAS here, addressed to the stage that designs the part, and one for each point of its own whose deferral waits for an event. Decided in: the items whose `basis_note` cites the hand-off. The point, its bounds, its trigger and why one was passed on are in the HND file; one that this stage passed on is listed by the stage it went to.>

## Unanswered questions
| # | Question | Why unsure | Options | Items | Answer |
|---|---|---|---|---|---|
<Only while rows wait: the questions this run could not ask because nobody could answer during the run, in the order it would ask them, and the corrections to assumptions that the user gave after such a run ("Draft first, ask afterwards", step 7, and "Finishing a run", step 1, in conventions.md). #: the number the row keeps under "Decisions". Options: 2 to 4, the drafted one first and marked as drafted; a multi-select question lists up to 4 items and the drafted choice. Answer: what the user answered, written by the user or by the agent that started the run; empty until then. A question about a request to the quality chain names the request among its items, and its answer may be written under the request in `quality-chain-requests.md` instead. The next run moves each answered row to "Decisions".>

## Decisions
| # | Question | Answer | Items |
|---|---|---|---|
<Questions asked and answers in effect, numbered per stage and continued on re-runs; an overturning answer replaces the row.>

## Open assumptions
<!-- generated: assumptions -->
| ID | Title | Kind | Breadth | Severity | Items that depend on it |
|---|---|---|---|---|---|
<!-- /generated -->
<The open DAS this stage wrote, and the open DAS and QAS its items depend on, highest first. Breadth and severity of a QAS, by hand: as this stage rates it.>

## Placeholders
| Name | Stands for | Used in |
|---|---|---|
<New placeholders, and the quality chain's placeholders that the drivers use, each with the chain item it comes from.>

## Open gaps
<Only what no input settles and no design stage can take up: blind spots no vantage can see; proposed FRPs; a value cut off at ` #` in a file another stage wrote, for that stage to fix. A point that a later stage or implementation decides is under "Hand-offs", not here.>

## Out of scope
## Next
<While questions wait for answers: answer them under "Unanswered questions", then run this stage again; no later stage runs until then. Otherwise, run `architecture-drivers-to-architecture`. If this run raised or answered requests to the quality chain, name them, and say that `quality-chain-requests.md` lists them for the user to answer and hand to the quality chain, and that the user decides whether to do that before stage 2 runs.>
```

## Worked example: online store

Inputs: the quality chain's artifacts for the online store. CUJ-01 Purchase, with QR-02 checkout time behaviour, QR-04 order totals correct, QR-08 checkout survives a payment provider failure and QR-13 fraud screening emphasized; CUJ-02 Browse, with QR-03 stock currentness emphasized, with NFR-03, the stock-freshness SLO, whose threshold and target rest on an open assumption (QAS-09); QR-12 card data confidentiality, from the security risk analysis; NFR-02, the checkout latency SLO, whose target rests on an open assumption (QAS-08), with SLI-02, whose vantage is the system boundary and whose existing source is OPF-02; the shared facts CON-01, EXT-01 (payment provider), EXT-02 (warehouse system) and OPF-01 to OPF-03; and DIN-01. Besides them: the architecture notes, the kick-off notes, the security team memo and the 2026 roadmap.

Boundary and the outside (excerpt):

| Outside | Kind | Exchanges with the system through |
|---|---|---|
| USR-01 Buyer | user | screen: buyer checkout (FR-01); screen: product pages and cart (FR-04, FR-05) |
| EXT-01 Payment provider | external system, creates data (payment records) | FR-01 |
| EXT-02 Warehouse system | external system, creates data | FR-05 |

Design context (excerpt). The script writes every cell but the labels:

| ID | Label | Kind | Source | Basis |
|---|---|---|---|---|
| TC-01 | Card payments through the provider | external service | context.yaml CON-01; security team memo | stated |
| TC-02 | One region of the company cloud | platform | Architecture notes | stated |
| TC-03 | Web app only this year | platform | context.yaml DIN-01 | stated |
| PC-01 | Release before the spring sale | deadline | Kick-off notes | stated |
| PC-02 | Four developers | team | Kick-off notes | stated |
| PC-03 | missing | budget | Stage 1, question 3 | confirmed |
| TEAM-01 | Store team | team structure | Kick-off notes | stated |
| CHG-01 | Second payment provider | anticipated change | Roadmap 2026 | stated |
| STK-01 | Product owner | stakeholder | Kick-off notes | stated |

Platforms and device support: TC-03 fixes the storefront as a web app (DIN-01). No input fixes the browsers or their versions; stage 2 decides them from the kinds of device in the contexts of use (QIU-01).

Architecture drivers (excerpt):

| DRV | Title | Kind | Negotiable | Sources | Premises | Basis |
|---|---|---|---|---|---|---|
| DRV-01 | Checkout answers without keeping buyers waiting | quality | — | QR-02, NFR-02, SLI-02 | OPF-03, QAS-08 | inferred |
| DRV-02 | Checkout survives a payment provider outage | quality | — | QR-08, CHG-01 | EXT-01, CHG-01, QCR-01 | inferred |
| DRV-03 | Stock changes reach buyers in time | quality | — | QR-03, NFR-03, SLI-03 | EXT-02, QAS-09, DAS-01 | assumed |
| DRV-08 | Card numbers never reach our servers | constraint | no | TC-01, QR-12 | TC-01, CON-01 | inferred |
| DRV-09 | First release before the spring sale | constraint | no | PC-01, PC-02 | PC-01, PC-02 | confirmed |
| DRV-11 | The storefront is a web app this year | constraint | no | TC-03 | TC-03 | confirmed |
| DRV-13 | One region of the company cloud | constraint | yes | TC-02 | TC-02 | confirmed |
| DRV-14 | Checkouts are visible at the system boundary | observability | — | SLI-02 | OPF-02 | inferred |
| DRV-05 | Money movement can be repeated safely | principle | no | QIU-03, FR-01, QR-04 | — | inferred |

Ranking table (excerpt):

| Rank | DRV | Business priority | Design difficulty | Primary |
|---|---|---|---|---|
| 1 | DRV-01 | high | high | yes |
| 2 | DRV-02 | high | high | yes |
| 3 | DRV-09 | high | high | yes |
| 4 | DRV-03 | high | medium | yes |
| 5 | DRV-08 | high | medium | yes |
| 6 | DRV-06 | high | medium | yes |
| 7 | DRV-11 | high | low | yes |
| 8 | DRV-04 | high | low | no |
| 9 | DRV-14 | high | low | no |
| 10 | DRV-10 | medium | medium | no |
| 11 | DRV-07 | medium | medium | no |
| 12 | DRV-13 | medium | low | no |

Seven primary drivers: three high on both axes, three of high priority and medium difficulty, and DRV-11, which is primary because it cannot be negotiated (question 4), although any reasonable design meets it. DRV-10 is not primary, but stage 2 should still keep payment behind one interface, because that costs little now (DRV-10's difficulty reason). The ranking was decided in question 1.

Excluded quality requirements checked (excerpt):

| QR | Cost to add later | Candidate | Reason |
|---|---|---|---|
| QR-16 availability across regions | High: data placement and replication would change | yes, DRV-12 (change, low, high) | Stage 2 keeps region-specific settings in one place, which costs nothing now |
| QR-17 user interface aesthetics | Low | no | Any structure supports a redesign of the screens |

Conflicts (excerpt):

| Drivers | Resolved by |
|---|---|
| DRV-01, DRV-06 | Stage 2: screen for fraud inside the charge call, or give a separate call its own share of the 1.5 s |
| DRV-02, DRV-09 | The business: failover comes right after the spring sale (question 5) |
| DRV-02, DRV-07 | The business, when stage 2 weighs the options for DRV-02; there is no budget to weigh them against until the funding review (question 3) |

Feasibility (excerpt):

| DRV | Known way with this budget, deadline and team | Why |
|---|---|---|
| DRV-01 | yes | Known designs answer within 1.5 s at this peak; the provider's latency is the open part, and stage 2 budgets it together with DRV-06 |
| DRV-02 | no known way before PC-01 | A second integration and its reconciliation take weeks that four developers (PC-02) do not have before the sale; it is built right after it (question 5) |
| DRV-09 | yes, if failover waits | Holds once DRV-02 moves after the sale (question 5) |

The budget is missing (PC-03): the verdicts weigh only the team and the date, and stage 2 weighs the cost of DRV-02's second contract with no budget to check it against until the funding review (question 3).

Hand-offs (excerpt):

| HND | Title | From | To | Component | Status | Decided in |
|---|---|---|---|---|---|---|
| HND-01 | Where the time of a stock change at the warehouse can be read | requirements-to-architecture-drivers | architecture-to-high-level-design | — | open | — |

SLI-03's `basis_note` leaves it to the design to confirm that the time each count changed at the warehouse can be read. No driver, constraint or ranking here turns on it, and stage 3 binds SLI-03 to its source, so the point goes there; `artifacts.md` shows HND-01 once stage 3 has decided it. The missing budget needs no hand-off: it is an input that question 3 asked for, and this stage runs again when the funding review sets it. Nor does the conflict between DRV-02 and DRV-07: stage 2 compares its options against both drivers anyway.

Requests to the quality chain: this run wrote three, which `quality-chain-requests.md` lists (`artifacts.md`, "The request document"). QCR-01 asks for a target for checkout during a provider outage, which DRV-02's measure needs; DRV-02 is primary, so the request has high impact and was asked (question 7), and DRV-02 lists it in `premises` and keeps the placeholder A_failover until the quality chain sets the target. QCR-02 and QCR-03 carry the answers to QAS-09 (question 2) and QAS-08 (question 6) to the quality chain.

Decisions (excerpt):

| # | Question | Answer | Items |
|---|---|---|---|
| 1 | Are these the primary drivers, in this order: DRV-01, DRV-02, DRV-09, DRV-03, DRV-08, DRV-06, DRV-11? Just below the line come DRV-04, DRV-14 and DRV-10. | Yes, as drafted. | Every ranked driver |
| 2 | NFR-03's stock-freshness threshold (T_stock_lag) and target are provisional in the quality chain (QAS-09), and DRV-03 is primary because they are tight. Should the design treat them as the ones to meet? | Yes. During a sale, stock shown wrongly costs more in cancelled orders than a slow page does; design for them, and the quality chain should confirm them on its next run. | DRV-03; QCR-02 |
| 3 | What budget is there for building and running the store in its first year (PC-03)? Without one, the draft keeps running cost as a concern of the product owner only. | Not set until the funding review in March. Keep the draft as it is until then. | PC-03, DRV-07 |
| 4 | Which of these could change if keeping them proves costly: one region (TC-02), a web app only this year (TC-03, from DIN-01), the first release before the spring sale (PC-01)? | Only TC-02: a second region is acceptable if its cost is shown. | DRV-09, DRV-11, DRV-13 |
| 5 | Four developers cannot build failover for a provider outage (DRV-02) before the spring sale (DRV-09). Which gives way? | Failover. It is built right after the sale. Until then, an outage of the provider stops checkout, and the business accepts that risk for the sale. | DRV-02, DRV-09 |
| 6 | NFR-02's 99% target is provisional in the quality chain (QAS-08). Should the design treat it as the target to meet? | Yes. Design for 99% within 1.5 s; the quality chain should confirm the target on its next run. | DRV-01; QCR-03 |
| 7 | No NFR says how many checkouts must succeed during an outage of the payment provider, and DRV-02, a primary driver, needs that for its measure. Should the design ask the quality chain for a target? | Yes, as suggested. Until the quality chain sets it, keep the placeholder A_failover. | DRV-02; QCR-01 |

Open assumptions (excerpt):

| ID | Title | Kind | Breadth | Severity | Items that depend on it |
|---|---|---|---|---|---|
| QAS-09 | First threshold and target of stock freshness | decision | high | medium | DRV-03 |
| QAS-08 | First target of checkout latency | decision | low | high | DRV-01 |
| DAS-01 | The warehouse system announces stock changes | judgment | low | medium | DRV-03 |

QAS-09 has high breadth here, where the quality chain rated it medium, because it moves the primary line; it was answered in question 2 and stays open until the quality chain applies QCR-02. QAS-08 has high severity because DRV-01, a primary driver, takes its measure from NFR-02's target; it was answered in question 6 and stays open until the quality chain applies QCR-03. Neither makes a driver `assumed`: DRV-03 is `assumed` because of DAS-01.

Placeholders (excerpt):

| Name | Stands for | Used in |
|---|---|---|
| A_failover | Share of checkouts that succeed during a provider outage | DRV-02 |
| E_provider | Days of work to add a second payment provider | DRV-10 |
| T_stock_lag | Time until a stock change is shown (from QR-03) | DRV-03 |

## Example items

`docs/design/design-context.yaml` (excerpt; TC-03 takes in a design input of the quality chain as a constraint):

```yaml
technology_constraints:
  - id: TC-01
    statement: Card payments go through the payment provider's API; card numbers never reach our servers
    kind: external-service
    source: context.yaml CON-01; security team memo
    basis: stated
  - id: TC-03
    statement: The storefront stays a web app this year; no native app
    kind: platform
    source: context.yaml DIN-01
    basis: stated
```

`docs/design/drv/DRV-01.yaml`:

```yaml
id: DRV-01
title: Checkout answers without keeping buyers waiting
status: active
basis: inferred
basis_note: Scenario from QR-02 and NFR-02; ranking confirmed (question 1); NFR-02's target rests on QAS-08, answered in question 6 and open until the quality chain applies QCR-03
premises: [OPF-03, QAS-08]
kind: quality
statement: Checkout confirms orders without keeping buyers waiting, up to sale-peak load
sources: [QR-02, NFR-02, SLI-02]
concern_of: [USR-01]
scenario:
  source: Buyers on smartphones (USR-01)
  stimulus: Submit the checkout during a sale
  artifact: Checkout (FR-01)
  environment: Sale peak (OPF-03); normal operation
  response: The order is confirmed and the confirmation page is shown
  measure: NFR-02's SLO, counted by SLI-02
negotiable: null
derived_from: []
priority:
  business: high
  business_reason: QR-02 is emphasized for CUJ-01
  difficulty: high
  difficulty_reason: The payment provider's latency and its fraud screening both sit inside the 1.5 s
  rank: 1
primary: true
conflicts:
  - {with: DRV-06, note: Fraud screening adds latency to the same request}
placeholders: []
```

`docs/design/drv/DRV-03.yaml`, which rests on an assumption of the quality chain and on one of this stage:

```yaml
id: DRV-03
title: Stock changes reach buyers in time
status: active
basis: assumed
basis_note: Scenario from QR-03 and NFR-03; ranking confirmed (question 1); NFR-03's threshold and target rest on QAS-09, answered in question 2 and open until the quality chain applies QCR-02; the difficulty rests on DAS-01
premises: [EXT-02, QAS-09, DAS-01]
kind: quality
statement: Stock counts that change at the warehouse reach what buyers see within T_stock_lag
sources: [QR-03, NFR-03, SLI-03]
concern_of: [USR-01]
scenario:
  source: Warehouse system (EXT-02)
  stimulus: Changes a stock count
  artifact: Cart and product pages (FR-04, FR-05)
  environment: Any time
  response: Buyers see the new count
  measure: Within T_stock_lag of the change (QR-03's placeholder)
negotiable: null
derived_from: []
priority:
  business: high
  business_reason: QR-03 is emphasized for CUJ-01, and its measure (NFR-03) is tight (QAS-09)
  difficulty: medium
  difficulty_reason: Known ways exist if the warehouse announces changes (DAS-01); every copy of the stock must respect T_stock_lag
  rank: 4
primary: true
conflicts: []
placeholders:
  - {name: T_stock_lag, meaning: time until a stock change is shown, from: QR-03}
```

`docs/design/drv/DRV-05.yaml`:

```yaml
id: DRV-05
title: Money movement can be repeated safely
status: active
basis: inferred
basis_note: Follows from QIU-03, FR-01 and QR-04
premises: []
kind: principle
statement: Every operation that moves money can be repeated without moving it twice
sources: [QIU-03, FR-01, QR-04]
concern_of: [USR-01]
scenario: null
negotiable: false
derived_from: [DRV-02, DRV-04]
priority: null
primary: false
conflicts: []
placeholders: []
```

`docs/design/das/DAS-01.yaml`, a judgment below the bar for questions:

```yaml
id: DAS-01
title: The warehouse system announces stock changes
status: open
stage: 1
kind: judgment
statement: The warehouse system (EXT-02) tells the store when a stock count changes, so the store does not have to ask it for every count
why_unsure: The inputs name the warehouse system only by its role and do not say whether it announces changes or can only be asked
breadth: low
severity: medium
rating_note: Only DRV-03 rests on it so far. If the warehouse can only be asked, stage 2 designs the stock flow differently, before anything is built; stage 2 asks about it if its structure comes to rest on it
answer: null
answered_in: null
```
