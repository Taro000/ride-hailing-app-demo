---
name: architecture-to-high-level-design
description: Stage 3 of 4 in the design chain. Turns the architecture and the technical policy into the high-level design of the whole system in one run - every interface between elements and with the outside (HTTP, events, files, screens, batch) with its error contract, idempotency, timing and versioning, and OpenAPI and AsyncAPI documents where the technical policy wants hand-written specs; where each SLI's events come from; sequence diagrams for every CUJ and primary driver, with failure paths and latency budgets checked against the SLOs; screen flows; the logical data model with one owner per entity; states that span elements; and shared conventions. Drafts first, asks only about points of high breadth or severity, and records the rest as assumptions. Use it when someone wants API or event design, interface specifications, SLI instrumentation, sequence diagrams, a data model, latency budgets or interface conventions. Next, review it with design-review, then run high-level-design-to-detailed-design for each component.
license: MIT
metadata:
  version: "0.3.0"
---

# Architecture → high-level design

Stage 3 of the design chain. It takes the elements (ELM) and decisions (DEC) of stage 2, within the technical policy (POL) of stage 2b, and specifies, for the whole system at once, how the elements interact with each other and with the outside: interfaces (IFC) with their specs, end-to-end flows, data entities (DAT), the shared conventions that every interface follows, and where the events of every SLI come from. Stage 4 then designs the inside of each component.

This stage looks outward from each component. A component's inside can change freely later; its interfaces cannot, because other parts depend on them. That is why the interfaces are designed here for the whole system in one run: an error code, an ID format or a delivery guarantee decided separately in two places will not match.

The quality chain names an interface only by its kind and, for an external system, its EXT ID, and defines each SLI in the terms of the domain. The names, paths, protocols and mechanisms of the interfaces (idempotency keys, tokens, queues), and where each SLI's events are observed, are decided here.

The technical policy has already decided what the code does inside every component, and how each kind of interface gets its spec: written by hand here, generated from the code, or the other side's document. This stage follows it, and decides only what the interfaces show to their consumers.

## Read first

- `references/conventions.md`: the design chain, how to use the quality chain, findings, the working language, judgment basis marks, the question protocol, decisions, assumptions, re-runs and finishing a run. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for IFC, DAT, DEC, HND, FND, DAS and QCR (and the ELM and DRV items you read).
- `references/interfaces.md`: what every interface specifies, error contracts, idempotency, timing, versioning, SLI bindings, and the specs that the technical policy asks for.
- `references/flows-and-budgets.md`: sequence diagrams, failure paths, latency budgets, screen flows and states.
- `references/data-and-conventions.md`: data entities, ownership, consistency, retention, classification, data quality flows, data SLIs, and the shared conventions that interfaces show to their consumers.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.
- `scripts/tables.py` and `scripts/check.py`: write the report's index tables from the items, and check the items, specs and reports for what needs no judgment. Run them before committing ("Scripts" and "Finishing a run" in `references/conventions.md`).

## Inputs

- `docs/design/`: `1-architecture-drivers.md`, `2-architecture.md`, `elm/`, `dec/`, `drv/`, `design-context.yaml`, and the open assumptions in `das/`.
- The technical policy: `2b-technical-policy.md` and `pol/`. The specs policy (`scope: specs`) says for each kind of interface how its spec is made; the pipeline-and-code policy holds the conventions inside the code, which the shared conventions leave to it.
- `docs/quality/`, read only: `fr/` (acceptance criteria and interface kinds), `sli/` (unit events, vantages, counting rules and existing sources), `nfr/` (targets, for the latency budgets), `qr/` (data quality and security detail), `context.yaml` (CUJ steps; external systems, EXT; operational facts, OPF, such as telemetry that already exists), and the open assumptions in `qas/`.
- Open findings addressed to this stage.
- Open hand-offs addressed to this stage: `hnd/` items with `to: architecture-to-high-level-design` and `status: open`.
- The interfaces and schemas that exist in the code, as recorded under `as_is`; read the parts you need.
- On a re-run, this stage's report and items, and what changed since this stage's last run (`conventions.md`, "Re-running a stage").

Essential inputs: at least one element of kind `component`, and the technical policy's specs policy. If either is missing, ask for it (or suggest running `architecture-drivers-to-architecture`, or `architecture-to-technical-policy`) before drafting.

## Workflow

### 1. Interface inventory

Write one IFC for every connector between components in the runtime view, and for every interaction with an external system or a person. Name the provider, the consumers (for a screen, the users who use it, by USR ID), the operations or messages, and the FRs whose acceptance criteria pass through it. An FR's `interface` gives a kind and an EXT ID (`"screen: buyer checkout"`, `EXT-01`), and everything else about the interface is yours to decide. When it names the endpoint of an interface that already exists in a running product, that endpoint is a fact about the current system, not a design input and not a request to the quality chain: the IFC keeps it (`as_is: keep`) unless a decision changes it. For an external system, write what the design relies on; cite what it promises by the ID of the TC that records it (or of the OPF that states it), without restating it, and list its EXT in `premises` with those IDs. Its spec belongs to its owner. A component's access to its own data store is not an interface: stage 4 designs it. When a component reads data that another component owns, follow "Ownership" in `data-and-conventions.md`.

### 2. Shared conventions

Decide the conventions that every interface shows to its consumers (errors, IDs, time, money, paging, tokens, versioning, the headers of idempotency keys and request IDs, the log fields that SLIs need, naming), each as a decision, following `data-and-conventions.md` ("Shared conventions"). Do this early: every interface depends on them. The conventions inside the code (how errors are passed on, how logs are written, how settings and secrets are read, where the texts for people live) are the technical policy's: follow its pipeline-and-code policy, and decide none of them here.

### 3. Specify each interface

Fill every field that `interfaces.md` lists for the interface's kind: format, protocol, authentication, error contract, idempotency, timing (the timeouts and waits on the call, settlement waits included, or only their bounds on a call off the paths of time SLOs and of money; ordering; delivery), versioning and observability. Every error case says what the caller does. Every call that changes something says what happens when its outcome is unknown ("Unknown outcomes" in `interfaces.md`).

### 4. SLI bindings

For every SLI in the quality chain, write an `sli_bindings` entry on the IFC that produces its events, or, when its vantage is `data`, on the DAT (step 9): which events are its unit events, the fields its counting rules need, and the method that collects them, following "SLI bindings" in `interfaces.md`. The binding realizes the SLI's vantage and keeps its unit event, counting rules, applicability and lifecycle as they are. Use the SLI's `existing_source` when it has one. When nothing produces the events, design what does here. When producing them needs a new behaviour of the system, write a request to the quality chain with the SLI in its `targets`: the report's SLI bindings table names it in place of a binding.

### 5. Specs

Find, for each HTTP or event interface, the entry of the specs policy that covers its kind, and follow it, as `interfaces.md` ("Specs") describes:

- `by-hand`: write its OpenAPI or AsyncAPI document under `ifc/specs/`, with its whole contract, schema included, only what the design decides, and provisional values marked.
- `from-code`: write no spec. Its IFC holds its operations, its errors and their codes, what its idempotency keys mean and how it answers when an outcome is unknown, and its schema is handed off to implementation, which generates it from the code with the tool that the policy names. Write one hand-off for each component that provides such interfaces.
- `owner`: write no spec; the IFC links the owner's document. When a component of this system serves the interface, such as the endpoints of a library it uses, hand its schema off to implementation as for `from-code`, with the owner's document in the hand-off's `bounds`.

Write a spec only where the policy says to. An interface that no entry covers, or whose entry goes against the policy's own rule (another party builds against an interface whose spec the policy says is generated from the code), is a finding addressed to `architecture-to-technical-policy`, major when its other side is built apart from this system's code. Until the policy changes, follow its entry, or its default when no entry covers the interface: hand the schema off.

### 6. End-to-end flows

For every CUJ and every primary driver's scenario, draw a sequence diagram across the elements, following `flows-and-budgets.md`. Include the failure paths: timeouts, refusals, crashes halfway, duplicates, failover. Each message names the IFC it uses.

### 7. Latency budgets and timeouts

For every SLO with a time threshold, start from where its SLI's binding observes the flow, check the normal path with each hop budgeted at its share of the SLO's tail, and check every failure path against the error budget, following `flows-and-budgets.md`. Compute with a script. Then set the timeouts and waits of every call on these paths, and on every path that moves money, settlement waits included, as `interfaces.md` ("Timing") describes: each call's timeout above its dependency's slowest healthy response, and each caller's timeout above the worst case it waits for, computed with the same script. Write them in the IFCs' `timing`, and back each provisional value with a DAS of kind `decision` or an answered question. On every other call between elements, write only the bounds in the IFC's `timing`, and hand the values off to stage 4, for the component that makes the call. When the normal path cannot fit, or a failure path uses up the error budget, change the design here, write a finding addressed to `architecture-drivers-to-architecture`, or write a request to the quality chain. When the budget rests on numbers that nothing has measured, a load test before release is a gate that only the quality chain can set: write a request for it, never a step of the design (`flows-and-budgets.md`, "Latency budgets").

### 8. Screens

For every FR whose interface is a screen, list the screens, and draw per CUJ how the person moves between them, including the error and empty states the acceptance criteria name. Stage 4 designs a screen in detail when the module that serves it is at full depth; implementation designs the others, within the screen's IFC.

### 9. Data

Write the logical data model as DAT items, following `data-and-conventions.md`: entities, key attributes, relations, one owner, the store, consistency, retention, classification, and the bindings of data SLIs (step 4). For each data quality driver, draw where the data comes from, how it is validated, how changes propagate and what is reconciled with what.

### 10. States across elements

For each entity whose life spans several elements and that holds money, a booking or an unknown outcome (an order, a payment, a ride request), and for any other such entity whose states rate high, draw its state diagram: states, transitions, the element that causes each one, timeouts and cancellations. A state that money, goods or a booking can still leave is never final. For any other entity, the states and events its consumers see are in the IFCs that carry them, and the rest of its states are left to the stage that designs its owner.

### 11. Check

Trace every acceptance criterion of every allocated FR through the IFCs and flows. Recompute every latency budget. Check that every entity has one owner, that every interface follows the shared conventions and its spec rule, and that every SLI has its binding.

### 12. Hand-offs

Take up every open hand-off addressed to this stage whose trigger has come, as `conventions.md` describes ("Hand-offs"): decide it within its bounds, citing it in the `basis_note` of the items that decide it, or pass it on with the reason. Stage 1 hands off the points that quality-chain items leave for the design to confirm (where a measure can be taken, how likely a failure is) and that it could not settle: confirm each one addressed to this stage, or write a request to the quality chain when the design shows that it does not hold.

### 13. Findings, report, questions, items

Process every open finding addressed to this stage; a rejection that leaves a risk in place is a decision. When the architecture cannot support what the interfaces need, write a finding addressed to `architecture-drivers-to-architecture`, and when the technical policy cannot (no spec rule fits an interface, or a convention inside the code keeps an interface from its contract), one addressed to `architecture-to-technical-policy`; do not change their items yourself. Write the IFC, DAT, DEC, HND and FND items and the spec documents as you draft them in steps 1 to 12, and the draft report that indexes them, following `report-template.md`. Then list, rate and ask as `conventions.md` describes ("Draft first, ask afterwards"), re-rate the open DAS and QAS that your judgments depend on ("Assumptions"), and write a DAS for each point you do not ask about:

- Rate only the points you are unsure of. A judgment you are sure of stays `inferred` and is not asked, however much depends on it.
- What this stage decides in full, whatever the ratings, is its row of the full-depth kinds ("Decision depth" in `conventions.md`). Rate each point of those kinds that you are unsure of on the scales of "Draft first, ask afterwards", as every stage does. A point outside them, such as the schema of an interface whose spec the technical policy says is generated from the code or the timeout of a call off the paths of time SLOs and of money, is deferred unless it rates high as it would stand once deferred; a deferred point is neither asked nor recorded as a DAS here.
- Most values this stage sets, the timeouts, waits and retry limits on the paths of time SLOs and of money included, are low or medium on both scales: adopt the drafted value and record it as a DAS of `kind: decision`.

Apply the answers to the items in place, check the exit criteria, and set the report's status to "answers applied". When nobody can answer during the run, write the questions under "Unanswered questions" instead, set the report's status to "waiting for answers", and finish the run; the next run applies the answers ("Draft first, ask afterwards", steps 7 and 8, in `conventions.md`).

## Exit criteria

- Every connector between components and every interaction with the outside has an IFC with its operations, error contract, idempotency, timing and versioning.
- Every call that changes something says what happens when its outcome is unknown, and no one is told "nothing happened" unless every party asked has confirmed it.
- Every call between elements on the path of an SLO with a time threshold, or on a path that moves money, has its timeouts and waits in its IFC's `timing`, settlement waits included, and every caller's timeout there is above the worst case it waits for, as computed in the report. Every other call between elements has the bounds of its timeouts in its IFC's `timing`, and their values are handed off to stage 4, with the component and the trigger.
- Every HTTP or event interface follows the entry of the specs policy that covers its kind: an OpenAPI or AsyncAPI document under `ifc/specs/` for the kinds whose spec is written by hand, and for no other; its schema handed off to implementation, with the component and the trigger, for the kinds whose spec is generated from the code; its owner's document linked for the kinds whose other side owns it, and its schema handed off as well when a component of this system serves it. An interface that no entry covers has a finding addressed to `architecture-to-technical-policy`, and its schema handed off until the policy covers it.
- Every quality-chain SLI has an `sli_bindings` entry, on an IFC or a DAT, that realizes its vantage, counting rules, applicability and lifecycle without changing them; or, when producing its events needs a new behaviour of the system, a request to the quality chain.
- Every CUJ and every primary driver has a sequence diagram with its failure paths.
- Every SLO with a time threshold has a latency budget whose normal path fits the threshold with each hop at its share of the tail, and whose failure paths fit the error budget; or a finding or a request to the quality chain.
- Every acceptance criterion of every allocated FR can be traced through IFCs and flows.
- Every DAT has one owner, a store, a consistency rule, a classification, and a retention period (stated, or a placeholder).
- Every entity whose life spans several elements and that holds money, a booking or an unknown outcome, or whose states rate high, has a state diagram in which no state that money, goods or a booking can still leave is final.
- The shared conventions that interfaces show to their consumers are decided, and every IFC follows them. None decides a convention inside the code, which the technical policy holds.
- No point of this stage's full-depth kinds, and none that rates high, is handed off unless its deferral was decided as a business decision ("Decision depth" in `conventions.md`).
- Every open hand-off addressed to this stage whose trigger has come is decided or passed on; a point that a quality-chain item leaves for the design to confirm is confirmed in the `basis_note` of an item, or raised as a request to the quality chain.
- Every open finding addressed to this stage is accepted or rejected.
- Each uncertain point was asked or recorded as a DAS, as `conventions.md` describes, and every provisional design parameter that this stage sets is either under "Decisions" or in a DAS of `kind: decision`.
- Every item that depends on an assumption lists it in `premises`, and an item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`.
- `scripts/check.py --skill architecture-to-high-level-design` reports no problem, except those waiting for a finding.

## Pitfalls

- Designing interfaces one component at a time. Two teams then pick two error formats.
- Error contracts that only cover the happy path. Callers then guess, and retry what must not be retried.
- Adding up the hops' 99th percentiles. They do not add up to the flow's 99th percentile; a rare stall in one hop breaks the sum.
- Deriving timeouts from the latency budget. A timeout below a dependency's slow tail turns healthy calls into failures, and calls that change something into unknown outcomes.
- Treating a timeout as a failure. On a charge, it is an unknown outcome; telling the buyer that nothing was charged invites a second charge.
- Using the SLO's threshold as a timeout. A payment abandoned at 1.5 s may still be charged.
- Two writers for one entity. Nobody can then say which value is right.
- Events without a stated delivery guarantee. Consumers then lose data or process it twice.
- Binding an SLI where the telemetry happens to be instead of at its vantage. A user-side SLI bound at the server reports a better number than people get: it misses their device, their network and the requests that never arrive.
- Changing what an SLI counts to fit the logs at hand: counting requests where the SLI counts checkouts, or dropping an exclusion that no field can tell apart. Write a request to the quality chain instead.
- Making a load test before release a gate of the design, or a level the system must reach a parameter. Gates, targets and thresholds belong to the quality chain: write a request for the one the design needs.
- Asking about every timeout and retry count. A wrong value is tuned in operation; record it as an assumption of kind decision, and spend the questions on what is hard to reverse: the shared conventions, published interfaces and the shape of stored data.
- Setting every timeout here. Off the paths of time SLOs and of money, a value set now is set again when the component is designed; decide the bounds, and hand the values to stage 4.
- Writing a spec by hand where the technical policy has it generated from the code. The schema then exists twice, and the copy written here drifts from the code.
- Deciding here how the code writes its logs or reads its settings. Those are the technical policy's, and a second rule here contradicts it.

## Finish

Finish the run as `conventions.md` describes ("Finishing a run"): list the open assumptions (no answer needed), tell the user what to run next, run `scripts/tables.py` and `scripts/check.py` with `--skill architecture-to-high-level-design` and fix what the check reports in this stage's files, and commit the files this run wrote. Also tell the user which files were written; how many interfaces, specs, flows and entities; which latency budgets fit and which do not; which SLIs are bound and which became requests; the findings processed and raised; the requests to the quality chain raised or answered; and the next steps: run `design-review` on this stage in a fresh context when it has not been reviewed yet, or when a critical or major finding changed its items since its last review ("Findings between design stages" in `conventions.md`); re-run this stage when a review addresses a critical or major finding to it, but not for minor ones, which wait for its next run; then run `high-level-design-to-detailed-design` for each component, naming them. When questions wait for answers, name them, and say that this stage runs again once they are answered and that its review and the later stages wait until then ("Finishing a run", step 2, in `conventions.md`).
