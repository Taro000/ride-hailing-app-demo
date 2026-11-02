---
name: architecture-to-high-level-design
description: Stage 3 of 4 in the design chain. Turns the architecture from architecture-drivers-to-architecture into the high-level design of the whole system in one run - every interface between elements and with the outside (HTTP, events, files, screens, batch) with its error contract, idempotency, timeouts, ordering, delivery and versioning, plus OpenAPI and AsyncAPI documents; sequence diagrams for every CUJ and primary driver, failure paths included, with latency budgets checked against the SLOs; screen flows; the logical data model with one owner per entity; states that span elements; shared conventions; and where each SLI's events come from. Drafts first, then asks about every uncertain point. Use it when someone wants API or event design, interface specifications, sequence diagrams, a data model, latency budgets or cross-cutting conventions. Next, review it with design-review, then run high-level-design-to-detailed-design for each component.
license: MIT
metadata:
  version: "0.1.0"
---

# Architecture → high-level design

Stage 3 of the design chain. It takes the elements (ELM) and decisions (DEC) of stage 2 and specifies, for the whole system at once, how the elements interact with each other and with the outside: interfaces (IFC) with their specs, end-to-end flows, data entities (DAT) and the shared conventions every part follows. Stage 4 then designs the inside of each component.

This stage looks outward from each component. A component's inside can change freely later; its interfaces cannot, because other parts depend on them. That is why the interfaces are designed here for the whole system in one run: an error code, an ID format or a delivery guarantee decided separately in two places will not match.

## Read first

- `references/conventions.md`: the design chain, findings, the working language, judgment basis marks and the question protocol. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for IFC, DAT, DEC and FND (and the ELM and DRV items you read).
- `references/interfaces.md`: what every interface specifies, error contracts, idempotency, timing, versioning and the spec documents.
- `references/flows-and-budgets.md`: sequence diagrams, failure paths, latency budgets, screen flows and states.
- `references/data-and-conventions.md`: data entities, ownership, consistency, retention, classification, data quality flows and shared conventions.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.

## Inputs

- `docs/design/`: `2-architecture.md`, `elm/`, `dec/`, `drv/` and `design-context.yaml`.
- `docs/quality/`, read only: `fr/` (acceptance criteria and interfaces), `sli/` (measurement points, methods, counting rules), `nfr/` (targets, for the latency budgets), `qr/` (data quality and security detail), `context.yaml` (CUJ steps).
- Open findings addressed to this stage.
- The interfaces and schemas that exist in the code, as recorded under `as_is`; read the parts you need.

Essential input: at least one element of kind `component`. If there is none, ask for the architecture (or suggest running `architecture-drivers-to-architecture`) before drafting.

## Workflow

### 1. Interface inventory

Write one IFC for every connector between components in the runtime view, and for every interaction with an external system or a person. Name the provider, the consumers, the operations or messages, and the FRs whose acceptance criteria pass through it. For an external system, write what the design relies on, with the source of each fact; its spec belongs to its owner. A component's access to its own data store is not an interface: stage 4 designs it. When a component reads data that another component owns, follow "Ownership" in `data-and-conventions.md`.

### 2. Shared conventions

Decide the conventions every interface and component follows (errors, IDs, time, money, paging, tokens, log and trace fields, configuration, languages, naming), each as a decision, following `data-and-conventions.md` ("Shared conventions"). Do this early: every interface depends on them.

### 3. Specify each interface

Fill every field that `interfaces.md` lists for the interface's kind: format, protocol, authentication, error contract, idempotency, timing (timeout, ordering, delivery), versioning and observability. Every error case says what the caller does. Every call that changes something says what happens when its outcome is unknown ("Unknown outcomes" in `interfaces.md`).

### 4. Specs

Write an OpenAPI document for every HTTP interface and an AsyncAPI document for every event interface under `ifc/specs/`, following `interfaces.md` ("Specs"). Write only what the design decides, and mark provisional values.

### 5. End-to-end flows

For every CUJ and every primary driver's scenario, draw a sequence diagram across the elements, following `flows-and-budgets.md`. Include the failure paths: timeouts, refusals, crashes halfway, duplicates, failover. Each message names the IFC it uses.

### 6. Latency budgets and timeouts

For every SLO with a time threshold, check the normal path with each hop budgeted at its share of the SLO's tail, and check every failure path against the error budget, following `flows-and-budgets.md`. Compute with a script. Then set the timeouts as `interfaces.md` ("Timing") describes: each call's timeout above its dependency's slowest healthy response, and each caller's timeout above the worst case it waits for. When the normal path cannot fit, or a failure path uses up the error budget, change the design here, write a finding addressed to `architecture-drivers-to-architecture`, or write an issue for the quality chain.

### 7. Screens

For every FR whose interface is a screen, list the screens, and draw per CUJ how the person moves between them, including the error and empty states the acceptance criteria name. The detailed design of each screen is stage 4.

### 8. Data

Write the logical data model as DAT items, following `data-and-conventions.md`: entities, key attributes, relations, one owner, the store, consistency, retention and classification. For each data quality driver, draw where the data comes from, how it is validated, how changes propagate and what is reconciled with what.

### 9. States across elements

For each entity whose life spans several elements (an order, a ride request), draw its state diagram: states, transitions, the element that causes each one, timeouts and cancellations. A state that money, goods or a booking can still leave is never final.

### 10. Measurement points

For every SLI in the quality chain, name the IFC or event that produces its events, with the fields its counting rules need. When nothing produces them, design it here. When producing them needs a new function, write an issue for the quality chain.

### 11. Check

Trace every acceptance criterion of every allocated FR through the IFCs and flows. Recompute every latency budget. Check that every entity has one owner, that every interface follows the shared conventions, and that every SLI has its source.

### 12. Findings, report, questions, items

Process every open finding addressed to this stage. When the architecture cannot support what the interfaces need, write a finding addressed to `architecture-drivers-to-architecture`; do not change stage 2's items yourself. Write the draft report following `report-template.md`, ask about every uncertain point as `conventions.md` describes, apply the answers and check the exit criteria. Then write the IFC, DAT, DEC and FND items and the spec documents.

## Exit criteria

- Every connector between components and every interaction with the outside has an IFC with its error contract, timing and versioning.
- Every call that changes something says what happens when its outcome is unknown, and no one is told "nothing happened" unless every party asked has confirmed it.
- Every HTTP interface has an OpenAPI document and every event interface an AsyncAPI document, except where the spec belongs to an external system.
- Every CUJ and every primary driver has a sequence diagram with its failure paths.
- Every SLO with a time threshold has a latency budget whose normal path fits the threshold with each hop at its share of the tail, and whose failure paths fit the error budget; or a finding or an issue for the quality chain.
- Every acceptance criterion of every allocated FR can be traced through IFCs and flows.
- Every SLI has the IFC or event that produces its events.
- Every DAT has one owner, a store, a consistency rule, a classification, and a retention period (stated, or a placeholder).
- The shared conventions are decided, and every IFC follows them.
- Every open finding addressed to this stage is accepted or rejected.

## Pitfalls

- Designing interfaces one component at a time. Two teams then pick two error formats.
- Error contracts that only cover the happy path. Callers then guess, and retry what must not be retried.
- Adding up the hops' 99th percentiles. They do not add up to the flow's 99th percentile; a rare stall in one hop breaks the sum.
- Deriving timeouts from the latency budget. A timeout below a dependency's slow tail turns healthy calls into failures, and calls that change something into unknown outcomes.
- Treating a timeout as a failure. On a charge, it is an unknown outcome; telling the buyer that nothing was charged invites a second charge.
- Using the SLO's threshold as a timeout. A payment abandoned at 1.5 s may still be charged.
- Two writers for one entity. Nobody can then say which value is right.
- Events without a stated delivery guarantee. Consumers then lose data or process it twice.

## Finish

Tell the user which files were written, how many interfaces, specs, flows and entities, which latency budgets fit and which do not, what needs agreement, the findings processed and raised, the issues for the quality chain, and the next steps: run `design-review` on this stage in a fresh context, re-run this stage to resolve its findings, then run `high-level-design-to-detailed-design` for each component, naming them.
