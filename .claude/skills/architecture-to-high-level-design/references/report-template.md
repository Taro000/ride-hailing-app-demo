# Stage 3 report template and worked example

## Contents
- Report template (`docs/design/3-high-level-design.md`)
- Worked example: online store
- Example items

Write the report in the working language. Translate the headings. Keep the IDs, paths, field names and codes as they are, and write the basis marks and statuses with the glossary's terms for the working language.

## Report template

```markdown
# High-level design: <system name>

Status: draft | answers applied · Updated: <date> · Stage 3 of 4

## Summary
<Two or three sentences: the number of interfaces and specs, the budgets that fit or do not, the main conventions, what needs agreement.>

## Inputs
| Source | What it gave |
|---|---|

## Shared conventions
| Convention | Decided | DEC |
|---|---|---|

## Interfaces
| IFC | Kind | Name | Provider | Consumers | Operations | FRs | Spec | Basis |
|---|---|---|---|---|---|---|---|---|

## Error contracts
| IFC | Operation | Case | Signal | The caller |
|---|---|---|---|---|

## End-to-end flows
### <CUJ-xx name>
<A sequence diagram with its failure paths.>
### <DRV-xx>
<A sequence diagram of the driver's scenario.>

## Latency budgets
### <NFR-xx>
<The hop table, the failure paths, and the script's output.>

## Screens
### <CUJ-xx name>
<A flowchart of the screens and their actions, error and empty states included.>

## Data
<The entity-relationship diagram, then:>
| DAT | Entity | Owner | Store | Consistency | Retention | Classification | Basis |
|---|---|---|---|---|---|---|---|
### Data quality flows

## States across elements
<One state diagram per entity whose life spans several elements.>

## Measurement points
| SLI | Produced by | Fields |
|---|---|---|

## Acceptance criteria trace
| FR | Criterion | IFCs | Flow |
|---|---|---|---|

## Design parameters
| Parameter | Value | Basis | Item |
|---|---|---|---|

## Findings
| FND | From | Decision | What changed |
|---|---|---|---|

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
<Run `design-review` on this stage in a fresh context; re-run this stage to resolve its findings; then run `high-level-design-to-detailed-design` once per component: list them.>
```

## Worked example: online store

Interfaces (excerpt):

| IFC | Kind | Name | Provider | Consumers | Operations | FRs | Spec |
|---|---|---|---|---|---|---|---|
| IFC-01 | http | Checkout API | ELM-02 | ELM-01 | POST /v1/checkout | FR-01, FR-03 | checkout.openapi.yaml |
| IFC-02 | http | Payment provider A | ELM-05 | ELM-02 | charge with fraud screening, look up by key, cancel, refund | FR-01 | the provider's own |
| IFC-03 | event | Stock changed | ELM-07 | ELM-03 | stock.changed | FR-04, FR-05 | the warehouse's own |
| IFC-04 | screen | Checkout screen | ELM-01 | (buyers) | Checkout | FR-01 | none |
| IFC-05 | screen | Cart screen | ELM-01 | (buyers) | Cart | FR-04, FR-05 | none |

Error contracts (excerpt):

| IFC | Operation | Case | Signal | The caller |
|---|---|---|---|---|
| IFC-01 | POST /v1/checkout | Card declined | 402, CARD_DECLINED | Shows the decline and keeps the cart |
| IFC-01 | POST /v1/checkout | An item sold out since it was added | 409, OUT_OF_STOCK, with the items | Shows the items and lets the buyer remove them |
| IFC-01 | POST /v1/checkout | The same Idempotency-Key again, after the first request finished | The first result, unchanged | Nothing more |
| IFC-01 | POST /v1/checkout | The same key while the first request is still running | 409, CHECKOUT_IN_PROGRESS | Waits and polls the order |
| IFC-01 | POST /v1/checkout | A provider timed out and its outcome is not settled yet | 202, PAYMENT_PENDING, with the order ID | Shows that the payment is being confirmed and polls the order; never submits again with a new key |
| IFC-01 | POST /v1/checkout | No provider took the payment, and every provider tried confirmed that nothing was charged | 503, PAYMENT_UNAVAILABLE | Asks the buyer to try later |

Latency budget for NFR-01: the hop table in `flows-and-budgets.md` budgets three serial hops at the 99.67th percentile, 1.30 s in all, plus a 0.20 s margin, against the 1.5 s threshold. The failover path makes at most 3,000 checkouts slow per provider outage at peak, 3.6% of the error budget ("Failure paths and the error budget"). The script's output is pasted under the table.

IFC-01 is called by ELM-01's checkout script in the buyer's browser, through the load balancer in front of ELM-02. SLI-02 is measured there, so ELM-01's own time is outside the budget.

Measurement points (excerpt):

| SLI | Produced by | Fields |
|---|---|---|
| SLI-02 checkout latency | The load balancer's access log for IFC-01 | request_id, status, elapsed, user_agent |

Acceptance criteria trace (excerpt):

| FR | Criterion | IFCs | Flow |
|---|---|---|---|
| FR-01 | A second payment request with the same key returns the first result and charges nothing | IFC-01 (Idempotency-Key) | Checkout, duplicate request path |

## Example items

`docs/design/ifc/IFC-03.yaml`:

```yaml
id: IFC-03
title: Stock changed events from the warehouse
status: draft
version: 1
basis: inferred
basis_note: The warehouse's event feed is stated in the architecture notes; delivery and ordering are its documented behaviour; the consumer's handling is a proposal
needs_agreement: false
approver_candidates: []
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
observability: ELM-03 logs the event ID, item, sequence number, and the delay between the event time and storing it (for DRV-03)
spec: null                               # the warehouse team owns the document; the report links it
as_is: new
changelog:
  - {version: 1, date: 2026-11-04, change: Created, reason: Stage 3 draft}
```

`docs/design/dat/DAT-04.yaml`:

```yaml
id: DAT-04
title: Stock level
status: draft
version: 1
basis: inferred
basis_note: null
needs_agreement: false
approver_candidates: []
entity: Stock level
owner: ELM-03
store: ELM-04
key_attributes: [item_id, available_count, warehouse_sequence, changed_at]
relations:
  - {to: DAT-05, kind: one-to-one, note: Catalog item}
consistency: Written only by ELM-03, from IFC-03. ELM-02 never changes it; reservations are a separate entity that ELM-02 owns (DAT-06), and the stock offered to buyers is this count minus the active reservations. ELM-02 reads this table directly, with read-only rights (DEC-11), so the table is part of ELM-03's interface and changes only with a new version
retention: The current value only; history is not kept
classification: internal
drivers: [DRV-03]
as_is: new
changelog:
  - {version: 1, date: 2026-11-04, change: Created, reason: Stage 3 draft}
```
