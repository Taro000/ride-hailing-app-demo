# Reading the quality chain

## Contents
- What each item gives the design
- From quality requirements to drivers
- Excluded quality requirements
- Placeholders and numbers
- Issues for the quality chain

## What each item gives the design

| Item | What it gives the design | Where it goes |
|---|---|---|
| `context.yaml` system | Boundary, purpose, constraints, data producers | Technology constraints; external systems; the context view |
| `context.yaml` users | Who uses the system, by kind, with data roles | Sources of scenarios; whose concern a driver is |
| `context.yaml` CUJs and steps | The journeys the system must carry, step by step | Artifacts of scenarios; stage 2's walkthroughs |
| `context.yaml` hints and operational facts | Volumes, peaks, telemetry, statements about the product | Environments of scenarios; capacity estimates; observability drivers |
| QIU | The user's goal and context of use, with a measure | The source and environment of scenarios. Never a design target |
| KPI | What the business counts | Background only: a design does not optimize KPIs directly |
| FR | Functions, their interfaces and acceptance criteria; `existing` and `extends` | Functional drivers; stage 2 allocation; stage 3 interfaces |
| FRP | Function proposals and their status | Accepted ones are FRs already; proposed ones are open gaps to mention |
| QR | The quality the system must have: handling, failure scenario, conflicts, entry point, stated numbers, placeholders | Quality scenarios, constraints, conflicts |
| NFR | How well, as an SLO, a gate, an audit or a monitor, with its conditions | The measure and environment of scenarios |
| SLI | Measurement method and point, unit events, blind spots | Observability drivers |
| EBP | What happens when an error budget runs out | Background for how much reliability work the team accepts; rarely a driver |

## From quality requirements to drivers

| QR | Use |
|---|---|
| `emphasized` | Always a candidate. Write its scenario from the QR's failure scenario, the NFR's measure and conditions, and the QIU's context of use. |
| `minimum-line` | A driver only when it could decide between designs: hard to achieve, hard to undo, or in conflict with another driver. Otherwise set it aside in the concern inventory: any reasonable design meets it. |
| `excluded` (this cycle) | Not a driver, unless adding it later would mean changing the structure. See "Excluded quality requirements". |
| With an entry point (law, standard, security risk analysis, policy) | Always a constraint driver, whatever its score. |
| `layer: internal` | Usually a change scenario, an observability driver or a principle: "every service logs the trace ID" becomes an observability driver. |

Turn each NFR kind into the scenario's measure:

| NFR kind | Measure in the scenario |
|---|---|
| `slo` | The SLO statement: share of good events, threshold, window |
| `gate` | The check, its threshold, and where it runs |
| `audit` | The criterion, and the cadence or deadline |
| `monitor` | The signal and its threshold |

Conflicts that a QR records (`conflicts`) carry over to the drivers built from those QRs, with the quality chain's resolution when it gave one.

## Excluded quality requirements

A QR excluded this cycle is a business decision; respect it. But some qualities are cheap to add later and some are not. For each excluded QR, ask: if the business asks for this next year, does the structure have to change, or only a few modules?

- Expensive later: availability across regions, moving to another cloud or runtime, isolating each tenant's data, work while offline, a complete audit trail of every change, real-time updates. Write a change scenario with low business priority and the design difficulty it has, so that stage 2 can avoid closing the door where that costs little, and ask whether the business accepts the cost of keeping the door open.
- Cheap later: most usability refinements, extra reports, extra validations. Leave them out and say why in one line.

## Placeholders and numbers

- Keep the quality chain's placeholder names (`T_stock`, `R_fare`) exactly. Do not give them values.
- Numbers the design needs and the chain does not give (peak concurrency, data volume per year, number of tenants) are design inputs: ask for the fact, or write a placeholder with a new name and list it under "Needs agreement".
- Copy stated numbers, with their source, into the scenario's environment or measure.

## Issues for the quality chain

Write an issue, and leave the chain's items untouched, when:

- a primary driver cannot be met by any design within the budget, the deadline and the team;
- two QRs conflict and the chain recorded no resolution a design can follow;
- a function the drivers need is missing from the FRs (an event at a measurement point, a reconciliation, a second route for payments);
- a QR's handling or a number contradicts another chain item;
- a CUJ step has no FR at all.

Write each issue with the chain items it concerns, the change you suggest, and the quality-chain stage that would make it: stage 2 for functions, stage 3 for priorities and conflicts, stage 4 for targets and SLIs.
