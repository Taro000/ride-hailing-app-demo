---
name: requirements-to-architecture-drivers
description: Stage 1 of 4 in the design chain. Reads the quality chain's artifacts in docs/quality/ (users, CUJs, shared facts, design inputs, functional requirements, quality requirements, NFRs, SLIs), what the user knows of the solution side (technology constraints; budget, deadline and team; team structure; anticipated changes) and any existing code, and writes architecture drivers - quality and change scenarios with a measurable response, constraints, functional, observability and security drivers, and principles. Ranks them by business priority and design difficulty, records conflicts, and checks early whether the budget, the deadline and the team can meet them. Drafts first, then asks only about points of high breadth or severity and records the rest as assumptions. Use it when someone wants to start an architecture or system design from requirements, NFRs or SLOs, or asks which requirements should shape the architecture. Writes docs/design/. Next stage is architecture-drivers-to-architecture.
license: MIT
metadata:
  version: "0.3.0"
---

# Requirements → architecture drivers

Stage 1 of the design chain. It reads what the quality chain produced and what the user knows about the solution side (technology, budget, team, roadmap), and writes the architecture drivers (DRV): the requirements, constraints and expected changes that decide the shape of the system. Stage 2 designs the architecture from the top of their ranking down.

Requirements do not weigh the same in a design. Most can be met by any reasonable structure. A few decide the structure, because they are demanding, conflict with each other, or are expensive to change once built. This stage finds those few, writes each one so that a design can be checked against it, and ranks them. A design built without this step optimizes whatever the designer noticed first.

Users are not the only source. Budget owners, the people who build and run the system, laws and contracts, and the roadmap all bring concerns that no CUJ mentions: whether the system can be built in time, by this team, at this cost, and whether it can absorb the changes already planned. They enter here. So do the design decisions someone made before the design started: the quality chain decides no design, and passes the ones it found in its inputs on as design inputs (DIN).

## Read first

- `references/conventions.md`: the design chain, what the quality chain leaves to the design, the working language, judgment basis marks, the question protocol, decisions, assumptions, re-runs and how to finish a run. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for `design-context.yaml`, DRV, HND, DAS and QCR.
- `references/reading-the-quality-chain.md`: what each quality-chain item gives this stage, including its shared facts, design inputs, SLIs and assumptions.
- `references/drivers.md`: driver kinds, how to write scenarios, constraints and principles, and how to rank.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.
- `scripts/tables.py` and `scripts/check.py`: write the report's index tables from the items, and check the items, specs and reports for what needs no judgment. Run them before committing ("Scripts" and "Finishing a run" in `references/conventions.md`).

## Inputs

- `docs/quality/`: `context.yaml` (the boundary, users, CUJs, constraints CON, external systems EXT, operational facts OPF, design inputs DIN, hints), `qiu/`, `kpi/`, `fr/`, `frp/`, `qr/`, `nfr/`, `sli/`, `ebp/`, `qas/` and the four reports. Read them; never write to them. If they do not exist, accept the same information from the user and record its source.
- What the user knows about the solution side. The quality chain decides none of it; take it from the input:
  - technology constraints: technologies that must or must not be used, the platform, external services and what they promise (SLAs, rate limits). Every DIN in `context.yaml` is a candidate. The organization's engineering standards are technology constraints too: the languages, frameworks, tools and CI it mandates or prohibits, and how code is reviewed. Record each one, mandated or prohibited, with its source; stage 2 designs within them, and stage 2b's technical policy follows them and decides only what they leave open. A standard that makes a check on a quality requirement a condition of a merge, a release or done (a coverage to reach, a scan to pass) is a gate, which the quality chain owns: it reaches the design as an NFR of kind gate, from the development policy that the quality chain takes in as an entry point. When no NFR carries it, write a request to the quality chain for it, not a technology constraint;
  - project constraints: budget, deadline, team size and skills;
  - team structure: which teams exist and what each owns;
  - anticipated changes: the roadmap, changes already expected, the variants the product must support (markets, tenants, kinds of device).

  A missing one is an uncertain point, rated like any other (step 13). A missing budget or deadline usually has high breadth, because it can move the line between the primary drivers and the rest, so it is asked.
- Code and infrastructure definitions in the repository, when there are any.
- On a re-run: this stage's report (the diff starts from this stage's last run, as "Re-running a stage" in `conventions.md` finds it), `design-context.yaml`, `drv/`, the DAS files this stage wrote or depends on, the open findings addressed to this stage (`fnd/` items with `to: requirements-to-architecture-drivers` and `status: open`), and the open hand-offs addressed to it (`hnd/` items with the same `to` and `status: open`), such as a point of its own that waits for an event; and the requests to the quality chain (`qcr/`), with the answers the user wrote in `quality-chain-requests.md`.

Essential inputs: at least one functional requirement and at least one quality requirement, from the quality chain or from the user. If either is missing, ask for it (or suggest running the quality chain first) before drafting.

## Workflow

### 1. Boundary and the outside

From `context.yaml` (the boundary, users, CUJs and external systems) and the interfaces the FRs name, list the system and everything outside it that it deals with:

- users by kind; those whose `data_role` is `producer` or `both` are the people who create data;
- external systems, by EXT ID; `creates_data: true` marks the ones whose data users rely on;
- for each, how it exchanges with the system: the interfaces the FRs name, by kind (a screen or a notification for whom, a file or a report for whom) and by EXT ID.

Stage 2 draws this as the context view. An FR interface that names an external system missing from `external_systems` is a request to the quality chain.

### 2. Current structure

If the repository holds code or infrastructure definitions, read them before anything else and record the current structure under `as_is` in `design-context.yaml`, following "Existing systems" in `conventions.md`. The current structure binds the design: changing it costs time, and that cost counts in the drivers' difficulty.

### 3. Design context and stakeholders

Record the four kinds of solution-side input in `design-context.yaml`, the organization's engineering standards among the technology constraints. Take every DIN in as a technology constraint candidate: a TC with `source: context.yaml DIN-xx`, or set aside in the concern inventory with a reason. Take in each CON the same way when it binds what the design may use or do (`source: context.yaml CON-xx`); the other CONs stay in the `premises` of the drivers they shape. Follow `drivers.md` ("Constraints").

Platforms and device support (operating systems, browsers and their versions, native or web) are a technology constraint only when an input fixes them: a DIN, or the user. Otherwise leave them to stage 2, which decides them from the kinds of device in the contexts of use, and say so in the report. Never infer a platform from the quality chain: "smartphone" in a context of use is a kind of device, not a choice of operating systems.

Then list the stakeholders who are not users in `context.yaml` but whose concerns the design must meet (the budget owner, the team that builds it, the team that runs it, the people who brought a law or a standard into the quality chain), each with the concerns the inputs give them. Do not invent stakeholders.

An entry you drafted without asking (a stakeholder's concern that the inputs imply but do not state) has `basis: assumed`, its `source` names the DAS, and every driver that rests on it lists the DAS in `premises` as well as the entry.

### 4. Concern inventory

Walk every input item once (FRs, QRs, NFRs, SLIs, entry points, CONs, DINs and the entries of the design context) and classify it as function, quality, constraint, change or organization, with whose concern it is: a user from `context.yaml` or a stakeholder from step 3. Every item ends as a driver, inside a driver, as a technology constraint, or set aside with a reason, so that a reader can check that nothing was dropped. Items set aside for the same reason can share a row ("FR-10 to FR-18: met inside one component").

### 5. Quality scenarios

Write a scenario with a source, a stimulus, an artifact, an environment, a response and a measure, following `reading-the-quality-chain.md` and `drivers.md` ("Quality scenarios"):

- for every QR whose handling is `emphasized`;
- for a QR whose handling is `minimum-line`, and for an NFR, only when it could decide between designs: it is hard to achieve, hard to undo, or in conflict with another driver. Otherwise set it aside in the concern inventory with a one-line reason; any reasonable design meets it.

Name the NFR's measure by ID when there is one ("NFR-02's SLO, counted by SLI-02") and copy nothing of it; otherwise keep the QR's placeholders, or write a new named placeholder and a request to the quality chain for the target it stands for. Refer to shared facts by ID ("Sale peak (OPF-03)"), never by their values. One scenario may serve several QRs and NFRs. One QR may need several scenarios, when the response or the measure differs between environments (normal load and sale peak, for example).

Include data quality requirements. Freshness, accuracy and consistency of data decide how data moves and where it lives.

### 6. Change scenarios

From the anticipated changes, the variants, and the QRs of maintainability and portability, write change scenarios: what changes, which part of the system it may touch, and how much effort it may take. The effort is a business number: take it from the input, or write a placeholder.

### 7. Constraints

Write a constraint driver for every technology constraint (every DIN taken in included), for every requirement that entered the quality chain through an entry point (law, standard, security risk analysis, development policy), and for the project constraints (budget, deadline, team), the team structure and the current structure when they bind a choice. Mark each as negotiable or not, from what the input says. When the input does not say, draft it from the kind of source and rate the point (`drivers.md`, "Constraints"). Whether a technology constraint or a deadline can change has high breadth, because it decides which options stage 2 may consider, so it is asked.

### 8. Functional, observability and security drivers

- Functional: the FRs whose demands shape the structure rather than one module: continuous updates, money movement, long-running processes across parts, work while disconnected, integrations, heavy computation, strict ordering, work bound to a clock. See `drivers.md`. The FRs state behaviour, not mechanisms; keep it that way, since the keys, queues and retries that produce the behaviour are decided from stage 2 on.
- Observability: what the SLIs need from the system, in terms of their vantage: events at the system boundary, timings on the user's side, synthetic use kept apart from real use, timestamps in the data. Add a way for the people who analyse failures to follow one request end to end. An SLI's `existing_source` names telemetry that already exists: keep it as a fact, with its OPF in `premises`. Say what must be visible, not how; stage 3 binds every SLI to its source. See `drivers.md` ("Observability drivers").
- Security: from the security QRs and the security risk analysis, the assets to protect and the threats the inputs name. Stage 2 draws the threat model.

### 9. Principles

Write the few rules that apply to the whole system and follow from several drivers ("every operation that moves money can be repeated without moving it twice"; "personal data stays in the region"). A principle earns its place only when two or more stages or teams would otherwise decide the same thing separately.

### 10. Rank

Rank every driver except principles by business priority and design difficulty, following `drivers.md` ("Ranking"). The candidates are the drivers from emphasized and minimum-line QRs, every constraint, every change scenario, and every QR excluded this cycle whose later inclusion would mean changing the structure. Check each excluded QR for that cost, and say why it is or is not a candidate.

Mark the primary drivers, at most twelve. The ranking is a business decision ("Decisions" in `conventions.md`), and the order of the primary drivers has high breadth, so it is asked: one question that shows the primary drivers in order, with the drafted ranking as the first option. When the rules mark more than twelve and merging the scenarios that are too fine leaves more than twelve, the same question asks which to merge or which to keep primary (`drivers.md`, "Primary drivers"). How hard a driver below the line is, beyond what keeps it there, is stage 2's to judge.

### 11. Conflicts

Record conflicts between drivers, on both drivers. A conflict between QRs that the quality chain recorded carries over, and new ones appear (a deadline against a new technology, a budget against redundancy). Say whether stage 2 can resolve it by design or the business must choose. A choice between primary drivers that only the business can make has high breadth, so it is asked, and the answer is a decision. When you cannot tell who resolves a conflict, rate it like any other uncertain point.

### 12. Feasibility

Before stage 2 spends effort, check every primary driver against the budget, the deadline and the team: is there any known way to meet it with these resources? When there is none, say so plainly, and keep the driver as written. What to give up is a business decision of high severity, so it is asked; when the answer moves a target or a priority, write a request to the quality chain for it. When the budget or the deadline is missing, give the verdict with the missing input named.

### 13. Findings, report, questions, items

On a re-run, start from what changed since this stage's last run, process every open finding addressed to this stage, take up every open hand-off addressed to it whose trigger has come, and apply the answers written under the report's "Unanswered questions" and those recorded in the DAS files this stage wrote ("Re-running a stage", "Findings between design stages", "Hand-offs", "Draft first, ask afterwards" and "Assumptions" in `conventions.md`).

Write `design-context.yaml`, the DRV items, the hand-offs and the findings you process as you draft them in steps 1 to 12, and the draft report that indexes them, following `report-template.md`. Then follow "Draft first, ask afterwards", "Decisions" and "Assumptions" in `conventions.md`: list the uncertain points, rate the breadth and severity of each, ask about the points that are high on either scale, and record every other point as a DAS item. In this stage:

- Usually high, so asked: the ranking of the primary drivers; a missing budget or deadline; whether a technology constraint or a deadline can change; a quality-chain QAS that the ranking or a primary driver's measure rests on (a request to the quality chain carries its answer); a request to the quality chain whose answer could change a primary driver or move the primary line (its impact is high).
- Asked whatever the ratings: a contradiction between inputs (a DIN against a CUJ or a QR, the code against a constraint), and the content of a law, standard, contract or policy that the inputs name but do not give, when a judgment in this stage depends on it (what an external service's SLA promises).
- Usually below the bar, so recorded as DAS: setting aside a minimum-line QR, when you are unsure whether it could decide between designs; a stakeholder's concern that the inputs imply but do not state.
- Deferred, so neither asked nor recorded as DAS, unless one rates high as it would stand once deferred ("Deferring the rest" in `conventions.md`): how hard a driver below the primary line is, beyond what keeps it there, and a point that a quality-chain item leaves for the design to confirm and that this stage hands off. The stage that decides each one rates it then.

Each driver lists in `premises` the design-context entries, shared facts (CON, EXT, OPF), assumptions (DAS, QAS) and requests to the quality chain (QCR) it rests on, even when `sources` names them too: `sources` says what the driver is built from, and `premises` finds it when one of them changes. A chain item that rests on an open QAS passes it on to the drivers that use the part it covers (`reading-the-quality-chain.md`, "The quality chain's assumptions"). An item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`. A driver that rests on a QAS that a question answered cites the answer in `basis_note` and is not `assumed` on its account.

Apply the answers to the items in place, check the exit criteria, set the report's status to "answers applied", and finish the run ("Finish"). When nobody can answer during the run, write the questions under "Unanswered questions" instead, set the report's status to "waiting for answers", and finish the run; the next run applies the answers ("Draft first, ask afterwards", steps 7 and 8, in `conventions.md`).

## Exit criteria

- Every QR whose handling is emphasized or minimum-line, and every NFR, is used by a driver or set aside with a reason.
- Every requirement that came through an entry point is a constraint driver.
- Every design input (DIN) is a technology constraint or set aside with a reason.
- Platforms and device support are a technology constraint only where an input fixes them; otherwise the report leaves them to stage 2.
- Every anticipated change and every variant is a change scenario, or set aside with a reason.
- Every excluded QR has been checked for the cost of adding it later.
- Every quality, change, observability and security driver has a complete scenario that names shared facts by ID. Its measure names the chain's measure by ID and copies nothing of it, or uses a stated number or a named placeholder.
- Every constraint says whether it is negotiable.
- The ranking table marks at most twelve primary drivers, and the ranking is recorded under "Decisions".
- Every point that a quality-chain item leaves for the design to confirm is a driver, a constraint, a question, a DAS, or a hand-off to the stage that designs the part, with its trigger.
- The concern inventory accounts for every input item. Every missing input of the design context was asked or recorded as a DAS, and every number still missing is a named placeholder.
- No number appears that the inputs do not give, except provisional design parameters with their basis.
- No point of this stage's full-depth kinds, and none that rates high, is handed off unless its deferral was decided as a business decision ("Decision depth" in `conventions.md`).
- Every open hand-off addressed to this stage whose trigger has come is decided or passed on.
- Every open finding addressed to this stage is accepted or rejected.
- Every point high on either scale was asked, and so were every contradiction and the content of every law, standard, contract or policy that the inputs name but do not give, when a judgment in this stage depends on it; every other uncertain point is a DAS.
- Every item that depends on an assumption lists it in `premises`, and an item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`.
- The report indexes the items and restates none of them.
- `scripts/check.py --skill requirements-to-architecture-drivers` reports no problem, except those waiting for a finding.

## Pitfalls

- Treating every QR as a driver. Most quality requirements are met by any sensible design; drivers are the ones that decide between designs.
- Letting the primary drivers grow past twelve. Stage 2 then designs for everything first, which is the same as designing for nothing first: merge the scenarios that are too fine, or ask the business to choose.
- Starting from a technology ("we use microservices") before the drivers exist. The technology then becomes the requirement.
- Inferring a platform from the kinds of device in the contexts of use. "Smartphone" leaves native or web, and which systems, to stage 2, unless an input fixes them.
- Scenarios without a measure ("the system is fast"). Nobody can check a design against them.
- Copying the values of shared facts ("up to 300 requests/s") into scenarios instead of their IDs (OPF-03). When the fact changes, nobody finds the copy.
- Copying the quality chain's priority as the design priority. Business priority is one axis of the ranking; design difficulty is the other.
- Forgetting the drivers that never come from users: the deadline, the budget, the team's skills, the planned changes. They sink more designs than performance does.
- Writing a solution as a driver ("use a cache", "every request carries a trace ID"). A driver says what must hold; stage 2 decides how.
- Asking about points that are low on both scales. They bury the few questions that matter; record them as assumptions.

## Finish

Finish the run as `conventions.md` describes ("Finishing a run"): list the open assumptions this run wrote or depends on (DAS and QAS), one line each with their ratings, highest first, and say that no answer is needed and that any correction is applied like an answer. Then tell the user which files were written, how many drivers of each kind, which are primary, which inputs of the design context are still missing, which requests to the quality chain this run raised or answered, and that the next stage is `architecture-drivers-to-architecture`; on a re-run, which later stages to re-run for which items, as "Finishing a run" in `conventions.md` describes. No review follows a run of this stage: `design-review` reviews stages 2 to 4. Run `scripts/tables.py` and `scripts/check.py` with `--skill requirements-to-architecture-drivers`, fix what the check reports in this stage's files, and commit the files this run wrote, and only those. When questions wait for answers, name them, and say that this stage runs again once they are answered and that the later stages wait until then ("Finishing a run", step 2, in `conventions.md`).
