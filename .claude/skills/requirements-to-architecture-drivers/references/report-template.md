# Stage 1 report template and worked example

## Contents
- Report template (`docs/design/1-architecture-drivers.md`)
- Worked example: online store
- Example items

Write the report in the working language. Translate the headings. Keep the IDs as they are, and write the basis marks and statuses with the glossary's terms for the working language. Write each driver's statement and scenario in the "Architecture drivers" section only; elsewhere, refer to drivers by ID.

## Report template

```markdown
# Architecture drivers: <system name>

Status: draft | answers applied · Updated: <date> · Stage 1 of 4

## Summary
<Two or three sentences: the primary drivers in a phrase each, the hardest conflict, the feasibility verdict, the design inputs still missing.>

## Inputs
| Source | What it gave |
|---|---|

## Boundary and the outside
<The system, its users by kind, external systems and data producers, as a short list. Stage 2 draws it.>

## Current structure
<For an existing system: what was read, what the code cannot tell, the elements found. Otherwise one line: "No existing code; everything is new.">

## Design inputs and stakeholders
| ID | Kind | Statement | Source | Basis |
|---|---|---|---|---|
<Technology constraints, project constraints, teams, anticipated changes, stakeholders. A missing input is a row that says "missing" and gives the question number.>

## Concern inventory
| Input item | Kind | Whose concern | Became |
|---|---|---|---|
<Every FR, QR (whatever its handling), NFR, SLI, entry point and design input, once each; items set aside for the same reason can share a row. "Became" is a DRV ID, "inside DRV-xx", or "set aside: <reason>".>

## Architecture drivers
### Quality and change scenarios
| DRV | Source | Stimulus | Artifact | Environment | Response | Measure | Basis |
|---|---|---|---|---|---|---|---|
### Constraints
| DRV | Constraint | Negotiable | Source | Basis |
|---|---|---|---|---|
### Functional, observability and security drivers
| DRV | Kind | Statement | Sources | Basis |
|---|---|---|---|---|
### Principles
| DRV | Principle | Derived from | Basis |
|---|---|---|---|

## Excluded quality requirements checked
| QR | Cost to add later | Candidate | Reason |
|---|---|---|---|

## Ranking table
| Rank | DRV | Business priority | Reason | Design difficulty | Reason | Primary |
|---|---|---|---|---|---|---|
<Under the table: the number of primary drivers, and why the line falls where it does.>

## Conflicts
| Drivers | Conflict | Resolved by |
|---|---|---|
<"Resolved by" is stage 2 (by design), the business (a question number), or the quality chain (an issue number).>

## Feasibility
<For each primary driver: a known way to meet it with this budget, deadline and team, or "no known way", and why.>

## Issues for the quality chain
| # | Issue | Chain items | Suggested change | Quality-chain stage |
|---|---|---|---|---|

## Needs agreement
| Item | What to agree | Approver candidates |
|---|---|---|

## Questions and answers
| # | Question | Drafted answer | Answer | What changed |
|---|---|---|---|---|

## Open gaps
## Out of scope
## Next
<Run `architecture-drivers-to-architecture`. If issues for the quality chain were raised, say which quality-chain stage would handle each, and that the user decides whether to re-run it first.>
```

## Worked example: online store

Inputs: the quality chain's artifacts for the online store (CUJ-01 Purchase, with QR-02 checkout time behaviour, QR-04 order totals correct, QR-08 checkout survives a payment provider failure and QR-13 fraud screening emphasized; CUJ-02 Browse, with QR-03 stock currentness emphasized; QR-12 card data confidentiality, from the security risk analysis; NFR-01 checkout latency SLO with SLI-02), the architecture notes, the kick-off notes and the 2026 roadmap.

Design inputs and stakeholders (excerpt):

| ID | Kind | Statement | Source | Basis |
|---|---|---|---|---|
| TC-01 | external service | Card payments go through the provider's API; card numbers never reach our servers | context.yaml; security memo | stated |
| TC-02 | platform | The company's cloud account, one region | Architecture notes | stated |
| PC-01 | deadline | First release before the spring sale | Kick-off notes | stated |
| PC-02 | team | Four developers (TypeScript, PostgreSQL); no dedicated operations engineer | Kick-off notes | stated |
| PC-03 | budget | missing | — | question 3 |
| TEAM-01 | team | The store team owns everything | Kick-off notes | stated |
| CHG-01 | anticipated change | A second payment provider within a year | Roadmap 2026 | stated |
| STK-01 | stakeholder | Product owner: release date, running cost | Kick-off notes | stated |

Quality and change scenarios (excerpt):

| DRV | Source | Stimulus | Artifact | Environment | Response | Measure |
|---|---|---|---|---|---|---|
| DRV-01 | Buyers on smartphones | Submit the checkout | Checkout (FR-01) | Sale peak, up to 300 requests/s | Order confirmed, confirmation shown | 99% within 1.5 s over 28 days (NFR-01) |
| DRV-02 | Payment provider | Stops responding | Checkout (FR-01) | Normal operation | Orders still confirmed through a second route | At least A_failover of checkouts succeed during the outage (placeholder: QR-08 gives no number) |
| DRV-03 | Warehouse system | Changes a stock count | Cart and product pages (FR-04, FR-05) | Any time | The change is shown | Within T_stock for 99% of changes (QR-03's placeholder) |
| DRV-10 | Store team | Adds a second payment provider | Payment handling | Next year | Only the payment adapter changes; checkout and stored orders do not | Within E_provider days of work (placeholder) |

Ranking table (excerpt):

| Rank | DRV | Business priority | Reason | Design difficulty | Reason | Primary |
|---|---|---|---|---|---|---|
| 1 | DRV-01 | high | QR-02 emphasized for CUJ-01 | high | The provider's latency and its fraud screening both sit inside the 1.5 s | yes |
| 2 | DRV-02 | high | QR-08 emphasized | high | Needs a second route, failover logic and reconciliation across two providers | yes |
| 3 | DRV-09 | high | Fixed release date (PC-01) | high | Four developers (PC-02); the second integration competes for the same weeks | yes |
| 4 | DRV-03 | high | QR-03 emphasized | medium | The warehouse publishes stock changes; caches must respect T_stock | yes |
| 5 | DRV-08 | high | Non-negotiable (TC-01, QR-12) | medium | Hosted card fields limit the checkout page | yes |
| 6 | DRV-06 | high | QR-13 emphasized | medium | The provider's fraud service adds latency | yes |
| 7 | DRV-04 | high | QR-04 emphasized | low | The rules live in one module | no |
| 8 | DRV-10 | medium | CHG-01 within a year | medium | Cheap if payment sits behind one interface from the start | no |
| 9 | DRV-07 | medium | Running cost (STK-01); the budget is not stated (PC-03, question 3) | medium | A second provider and a second zone add cost | no |

Six primary drivers. DRV-10 is not primary, but stage 2 should still keep payment behind one interface, because that costs little now (DRV-10's reason).

Excluded quality requirements checked (excerpt):

| QR | Cost to add later | Candidate | Reason |
|---|---|---|---|
| QR-16 availability across regions | High: data placement and replication would change | yes, DRV-12 (change, low, high) | Stage 2 keeps region-specific settings in one place, which costs nothing now |
| QR-17 user interface aesthetics | Low | no | Any structure supports a redesign of the screens |

Conflicts:

| Drivers | Conflict | Resolved by |
|---|---|---|
| DRV-01, DRV-06 | Fraud screening adds latency inside the 1.5 s | Stage 2 (screen inside the charge call, or budget a separate call) |
| DRV-02, DRV-09 | Building failover before the spring sale | The business: in the first release, or right after (question 5) |
| DRV-02, DRV-07 | A second provider raises the running cost | The business (question 3) |

Issues for the quality chain:

| # | Issue | Chain items | Suggested change | Quality-chain stage |
|---|---|---|---|---|
| 1 | No target for how many checkouts must succeed during a provider outage | QR-08 | Add an availability target that covers outages of the provider | 4 |

## Example items

`docs/design/drv/DRV-02.yaml`:

```yaml
id: DRV-02
title: Checkout survives a payment provider outage
status: draft
version: 1
basis: inferred
basis_note: Scenario from QR-08; the ranking needs agreement; the measure is a placeholder
needs_agreement: true
approver_candidates: [Product owner, Tech lead]
kind: quality
statement: Checkout keeps confirming orders while the payment provider is down
sources: [QR-08, CHG-01]
concern_of: [USR-01, STK-01]
scenario:
  source: Payment provider
  stimulus: Stops responding
  artifact: Checkout (FR-01)
  environment: Normal operation
  response: Orders are still confirmed through a second route
  measure: At least A_failover of checkouts succeed during the outage
negotiable: null
derived_from: []
priority:
  business: high
  business_reason: QR-08 is emphasized for CUJ-01
  difficulty: high
  difficulty_reason: Needs a second route, failover logic and reconciliation across two providers
  rank: 2
primary: true
conflicts:
  - {with: DRV-09, note: Building failover competes with the release date (question 5)}
  - {with: DRV-07, note: A second provider raises the running cost (question 3)}
placeholders:
  - {name: A_failover, meaning: share of checkouts that succeed during a provider outage, from: this driver}
changelog:
  - {version: 1, date: 2026-11-02, change: Created, reason: Stage 1 draft}
```

`docs/design/drv/DRV-05.yaml`:

```yaml
id: DRV-05
title: Money movement can be repeated safely
status: draft
version: 1
basis: inferred
basis_note: Follows from QIU-03, FR-01 and QR-04
needs_agreement: false
approver_candidates: []
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
changelog:
  - {version: 1, date: 2026-11-02, change: Created, reason: Stage 1 draft}
```
