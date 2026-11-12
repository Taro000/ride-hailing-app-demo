# Reading the quality chain

## Contents
- How to read it
- What each item gives the design
- Shared facts
- Design inputs
- Platforms and device support
- From quality requirements to drivers
- SLIs and observability
- Excluded quality requirements
- The quality chain's assumptions
- Placeholders and numbers
- Requests to the quality chain

## How to read it

The quality chain states requirements in the terms of users and the domain, and decides no design. Its items describe what holds now; they carry no history and no approval status.

Read each item's `basis` and `premises`. A chain item that is `stated`, `inferred` or `confirmed` is a stated input for this stage (`conventions.md`, "Judgment basis"). An item that is `assumed` rests on an open assumption of the quality chain (QAS), and so does every driver built on the part of it that the assumption covers ("The quality chain's assumptions").

A chain item's `basis_note` may also say what the design must confirm (how likely a failure is, where a measure can be taken). Turn each such point into a driver, a constraint, a question, an assumption (DAS), or a hand-off (HND) to the stage that designs the part: a driver when it could decide between designs; a constraint when an input already settles it (an external service's SLA, the code); a question or a DAS when it is an uncertain point for this stage, rated like any other; otherwise a hand-off, with the chain item in `origin` and the point in `what` ("Hand-offs" in `conventions.md`). That stage decides the hand-off by confirming the point, citing it in `basis_note`, or writes a request to the quality chain. When this stage already finds that a point does not hold, it writes the request itself.

## What each item gives the design

| Item | What it gives the design | Where it goes |
|---|---|---|
| `context.yaml` system | The boundary and the purpose | What is inside; the context view |
| `context.yaml` users | Who uses the system, by kind; `data_role` marks the people who create data | Sources of scenarios; whose concern a driver is; the boundary list |
| `context.yaml` CUJs and steps | The journeys the system must carry, step by step | Artifacts of scenarios; stage 2's walkthroughs |
| `constraints` (CON) | Requirement-level constraints: contracts, business decisions | Technology constraints, when one binds what the design may use or do; otherwise premises of the drivers it shapes |
| `external_systems` (EXT) | Systems outside the boundary, by role; `creates_data` marks those whose data users rely on | The boundary list; integration drivers; sources of data quality scenarios |
| `operational_facts` (OPF) | Volumes, peaks, when the product is used, telemetry that already exists, baselines, existing SLOs or SLAs | Environments of scenarios, by ID; capacity estimates; existing sources for observability drivers |
| `design_inputs` (DIN) | Design decisions stated in the quality chain's inputs; no chain item refers to them | Technology constraint candidates ("Design inputs") |
| `context.yaml` hints | Statements that the quality chain's stage 3 turned into QRs | Background: read one only to understand the QR built from it |
| QIU | The user's goal and context of use (kinds of device and situations), with a measure | The source and environment of scenarios; the kinds of device that stage 2 decides platforms from. Never a design target |
| KPI | What the business counts | Background only: a design does not optimize KPIs directly |
| FR | Behaviour observable from outside; the interfaces it uses, by kind (a screen, a notification, a file or a report, and for whom) and by EXT ID; acceptance criteria; `existing` and `extends` | Functional drivers; the boundary list; stage 2 allocation; stage 3 interfaces |
| FRP | Function proposals and their status | Accepted ones are FRs already; proposed ones are open gaps to mention |
| QR | The quality the system must have: handling, failure scenario, conflicts, entry point, stated numbers, placeholders | Quality scenarios, constraints, conflicts |
| NFR | How well, as an SLO, a gate, an audit or a monitor, with its conditions (shared facts by ID) | The measure and environment of scenarios |
| SLI | What counts, in the terms of the domain: the unit event, the vantage, the counting rules, the existing source, the blind spots | Observability drivers ("SLIs and observability"); stage 3 binds each SLI to its source |
| EBP | What happens when an error budget runs out | Background for how much reliability work the team accepts; rarely a driver |
| QAS | The judgments and provisional decisions the quality chain made without asking | Premises of the drivers that rest on them ("The quality chain's assumptions") |

The FRs name no paths, endpoints or mechanisms (keys, tokens, queues, retries), and the SLIs name no log fields, tools or collection methods. Do not add them in drivers; they are decided from stage 2 on.

The one exception: an FR may name the endpoint of an interface that already exists in a running product. That endpoint is a fact about the current system, like the current structure: it is not a design input and not a request to the quality chain, and later stages keep the interface (`as_is: keep`) unless a decision changes it.

## Shared facts

`context.yaml` gives an ID to each fact that several items depend on: constraints (CON), external systems (EXT) and operational facts (OPF).

- Name a fact by its ID with a short label ("Sale peak (OPF-03)"), and list it in the `premises` of the driver that uses it. Never copy its values or its wording: when the fact changes, the drivers to revisit are exactly those whose premises name it.
- A number derived from a fact (a capacity estimate from a daily volume) goes in the report, computed with a script, with the fact named.
- A fact that the chain's own items need but `context.yaml` lacks (an external system that an FR interface names but `external_systems` does not list) is a request to the quality chain.

## Design inputs

A design input (DIN) is a design decision that someone made before the design started and the quality chain found in its inputs ("payments go through <vendor>", "no native app this year"). The quality chain records it once and builds nothing on it; weighing it is the design's job.

- Take every DIN in as a technology constraint candidate: a TC in `design-context.yaml` with `source: context.yaml DIN-xx` and the kind that fits what it fixes (`mandated`, `prohibited`, `platform` or `external-service`). It then becomes a constraint driver like any other.
- Set a DIN aside, in the concern inventory with a reason, only when it fixes nothing the design would choose, or the user withdraws it.
- Whether a DIN can change is rarely stated, because the quality chain only recorded it. Rate its negotiability like any constraint's (`drivers.md`, "Constraints"): a technology constraint has high breadth, so it is asked.
- A DIN that contradicts a CUJ, a QR or another constraint ("no native app" against a CUJ that needs work while offline) is a contradiction: ask, whatever its ratings. When the answer keeps the DIN and that limits what users can do, write a request to the quality chain.
- A chain item that states a design decision anyway (a platform in a context of use, a mechanism in an acceptance criterion) is treated as a DIN would be, with that item as its source. Suggest moving it to the design inputs in a request to the quality chain. An FR that names the endpoint of an interface that already exists in a running product states no decision: the endpoint is a fact about the current system ("What each item gives the design").

## Platforms and device support

The quality chain names only kinds of device and situations ("smartphone, one hand, unstable network"). Operating systems, browsers and their versions, and native or web, are design.

- They are a technology constraint only when an input fixes them: a DIN, or the user. Write the TC with that source.
- Otherwise leave them to stage 2, which decides them from the kinds of device in the contexts of use, and say so in the report's design context section. They are not a question, an assumption or a constraint in this stage.
- Never infer a platform from a kind of device: "smartphone" does not mean a native app, and does not name the systems it runs.

## From quality requirements to drivers

| QR | Use |
|---|---|
| `emphasized` | Always a candidate. Write its scenario from the QR's failure scenario, the NFR's measure and conditions, and the QIU's context of use. |
| `minimum-line` | A driver only when it could decide between designs: hard to achieve, hard to undo, or in conflict with another driver. Otherwise set it aside in the concern inventory: any reasonable design meets it. |
| `excluded` (this cycle) | Not a driver, unless adding it later would mean changing the structure. See "Excluded quality requirements". |
| With an entry point (law, standard, security risk analysis, policy) | Always a constraint driver, whatever its score. |
| `layer: internal` | Usually a change scenario, an observability driver or a principle: "a failure can be traced to the part that caused it" becomes an observability driver. |

The scenario's measure names the NFR's measure by ID and copies nothing of it, whatever the NFR's kind:

| NFR kind | Measure in the scenario |
|---|---|
| `slo` | The SLO and the SLI that counts it: "NFR-02's SLO, counted by SLI-02" |
| `gate` | The gate: "NFR-05's gate" |
| `audit` | The audit: "NFR-06's audit" |
| `monitor` | The monitor: "NFR-07's monitor" |

The share, the threshold, the window, the check, the cadence and the signal stay in the NFR. A copy in a scenario goes stale when the NFR changes, and nobody finds it.

Conflicts that a QR records (`conflicts`) carry over to the drivers built from those QRs, with the quality chain's resolution when it gave one.

## SLIs and observability

The quality chain defines each SLI logically: the unit event (an event of the domain, not a log line), the vantage it is observed from (`user-side`, `system-boundary`, `synthetic` or `data`), the counting rules, and what that vantage cannot see (`blind_spots`). Where its events come from, which fields carry them and how they are collected is design: stage 3 binds every SLI to an interface or a data entity (`sli_bindings`). This stage writes what the system must make visible for that binding to be possible, by vantage (`drivers.md`, "Observability drivers").

- `existing_source` names telemetry that already exists, as an OPF. It is a fact: list the OPF in the driver's `premises`, so that stage 3 binds the SLI to that source instead of building another, and write a demand only for what the source does not cover.
- `existing_source: null` means the design provides the source. The driver says what must be visible; it does not choose the source.
- A blind spot that hides a failure a primary driver cares about becomes an observability driver, or an open gap when no vantage can see it.

## Excluded quality requirements

A QR excluded this cycle is a business decision; respect it. But some qualities are cheap to add later and some are not. For each excluded QR, judge: if the business asks for this next year, does the structure have to change, or only a few modules?

- Expensive later: availability across regions, moving to another cloud or runtime, isolating each tenant's data, work while offline, a complete audit trail of every change, real-time updates. Write a change scenario with low business priority and the design difficulty it has, so that stage 2 can avoid closing the door where that costs little. Keeping the door open is a business decision when it costs money or weakens another driver, such as the deadline ("Decisions" in `conventions.md`): rate it. When keeping it open shapes the structure, its breadth is high, so it is asked.
- Cheap later: most usability refinements, extra reports, extra validations. Leave them out and say why in one line.

## The quality chain's assumptions

A chain item with `basis: assumed` rests on one or more open QAS, listed in its `premises`. Read each QAS: what was drafted, why it was uncertain, its kind (`judgment` or `decision`) and the chain's ratings.

- A driver that rests on the part of a chain item that a QAS covers lists the QAS in its `premises`, and has `basis: assumed` while no design question has answered the QAS. A driver that uses only other parts of the item does not list it.
- Re-rate the QAS for the design ("Assumptions" in `conventions.md`). When a judgment you would ask about rests on it (the ranking or the primary line, a primary driver's measure, a technology constraint), ask about the QAS in this run, whichever chain stage wrote it.
- Never write the answer in `docs/quality/`. Record the question and its answer under "Decisions", and write a request to the quality chain that carries the answer: the QAS in `targets`, with the chain items it covers; the answer; a suggestion that says whether the QAS holds; and the stage that wrote it in `quality_stages` ("Assumptions" in `conventions.md`). The drivers that rest on it cite the answer in `basis_note` and are no longer `assumed` on its account. They keep the QAS in `premises` until the quality chain applies the answer.
- When the answer overturns the QAS, redo the drivers that rest on it, and tell the user to hand the request document to the quality-chain stage that wrote it before stage 2 builds on them.
- A QAS that no judgment you would ask about rests on needs no question. It stays in the drivers' `premises` and in the report's open assumptions.

## Placeholders and numbers

- Keep the quality chain's placeholder names (`T_stock_lag`, `R_fare`) exactly. Do not give them values.
- Name a scenario's measure by the NFR's ID ("NFR-02's SLO, counted by SLI-02") and copy nothing of it; when there is no NFR, name the QR's stated number or placeholder with the QR's ID ("within T_stock_lag (QR-03)"). Name volumes and peaks by their OPF ID.
- Numbers the design needs and the chain does not give (peak concurrency, data volume per year, number of tenants) are facts only the user's organization knows. Ask for the fact when its breadth or severity is high; otherwise write a placeholder with a new name and list it under "Placeholders".
- A target or a threshold that a scenario's measure needs and the chain does not give (the share of checkouts that must succeed during a provider outage) is a requirement, not a number the design may set: write a new named placeholder, and a request to the quality chain for the target ("Requests to the quality chain").

## Requests to the quality chain

Write a request to the quality chain, and leave the chain's items untouched, when (`conventions.md`, "Requests to the quality chain"):

- a primary driver cannot be met by any design within the budget, the deadline and the team;
- two QRs conflict and the chain recorded no resolution a design can follow;
- a function the drivers need is missing from the FRs (a reconciliation; keeping checkout working while the payment provider fails);
- a QR's handling or a number contradicts another chain item;
- a CUJ step has no FR at all;
- a shared fact is missing (an external system that an FR interface names but `external_systems` does not list);
- a technology constraint limits what users can do, and the user chose to keep it;
- a chain item states a design decision ("Design inputs"); an existing endpoint that an FR names is not one, but a fact about the current system;
- the user answered a question about a QAS ("The quality chain's assumptions").

A request whose answer could change what a primary driver's scenario asks, or move the primary line, has high impact: ask it in this run, and rank the drivers on the answer. Any other request waits for its answer, and the drivers it would change follow the chain as it stands, with the request in their `premises`.
