---
name: requirements-to-architecture-drivers
description: Stage 1 of 4 in the design chain. Reads the quality chain's artifacts in docs/quality/ (users, CUJs, functional requirements, quality requirements, NFRs, SLIs), the design inputs that never come from users (technology constraints; budget, deadline and team; team structure; anticipated changes) and any existing code, and writes architecture drivers - quality and change scenarios with a measurable response, constraints, functional, observability and security drivers, and principles. Ranks them by business priority and design difficulty, records conflicts, and checks early whether the budget, the deadline and the team can meet them. Drafts first, then asks about every uncertain point. Use it when someone wants to start an architecture or system design from requirements, NFRs or SLOs, or asks which requirements should shape the architecture. Writes docs/design/. Next stage is architecture-drivers-to-architecture.
license: MIT
metadata:
  version: "0.1.0"
---

# Requirements → architecture drivers

Stage 1 of the design chain. It reads what the quality chain produced and what the user knows about the solution side (technology, budget, team, roadmap), and writes the architecture drivers (DRV): the requirements, constraints and expected changes that decide the shape of the system. Stage 2 designs the architecture from the top of their ranking down.

Requirements do not weigh the same in a design. Most can be met by any reasonable structure. A few decide the structure, because they are demanding, conflict with each other, or are expensive to change once built. This stage finds those few, writes each one so that a design can be checked against it, and ranks them. A design built without this step optimizes whatever the designer noticed first.

Users are not the only source. Budget owners, the people who build and run the system, laws and contracts, and the roadmap all bring concerns that no CUJ mentions: whether the system can be built in time, by this team, at this cost, and whether it can absorb the changes already planned. They enter here.

## Read first

- `references/conventions.md`: the design chain, the quality chain's role, the working language, judgment basis marks and the question protocol. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for `design-context.yaml` and DRV.
- `references/reading-the-quality-chain.md`: what each quality-chain item gives this stage.
- `references/drivers.md`: driver kinds, how to write scenarios, constraints and principles, and how to rank.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.

## Inputs

- `docs/quality/`: `context.yaml`, `qiu/`, `kpi/`, `fr/`, `frp/`, `qr/`, `nfr/`, `sli/`, `ebp/` and the four reports. Read them; never write to them. If they do not exist, accept the same information from the user and record its source.
- Design inputs that do not come from users. Take them from the input; when one is missing, it is a question:
  - technology constraints: technologies that must or must not be used, the platform, external services and what they promise (SLAs, rate limits);
  - project constraints: budget, deadline, team size and skills;
  - team structure: which teams exist and what each owns;
  - anticipated changes: the roadmap, changes already expected, the variants the product must support (markets, tenants, devices).
- Code and infrastructure definitions in the repository, when there are any.
- Existing items under `docs/design/`, on a re-run, and the open findings addressed to this stage: `fnd/` items with `to: requirements-to-architecture-drivers` and `status: open`.

Essential inputs: at least one functional requirement and at least one quality requirement, from the quality chain or from the user. If either is missing, ask for it (or suggest running the quality chain first) before drafting.

## Workflow

### 1. Boundary and the outside

From `context.yaml` (boundary, users, data producers, constraints) and the interfaces named in the FRs, list the system and everything outside it that it deals with: users by kind, external systems, data producers. Stage 2 draws this as the context view.

### 2. Current structure

If the repository holds code or infrastructure definitions, read them before anything else and record the current structure under `as_is` in `design-context.yaml`, following "Existing systems" in `conventions.md`. The current structure binds the design: changing it costs time, and that cost counts in the drivers' difficulty.

### 3. Design inputs and stakeholders

Record the four kinds of design input in `design-context.yaml`. Then list the stakeholders who are not users in `context.yaml` but whose concerns the design must meet (the budget owner, the team that builds it, the team that runs it, the people who brought a law or a standard into the quality chain), each with the concerns the inputs give them. Do not invent stakeholders. When a kind of input is missing, ask who owns it.

### 4. Concern inventory

Walk every input item once (FRs, QRs, NFRs, SLIs, entry points, design inputs) and classify it as function, quality, constraint, change or organization, with whose concern it is: a user from `context.yaml` or a stakeholder from step 3. Every item ends as a driver, inside a driver, or set aside with a reason, so that a reader can check that nothing was dropped. Items set aside for the same reason can share a row ("FR-10 to FR-18: met inside one component").

### 5. Quality scenarios

Write a scenario with a source, a stimulus, an artifact, an environment, a response and a measure, following `reading-the-quality-chain.md` and `drivers.md` ("Quality scenarios"):

- for every QR whose handling is `emphasized`;
- for a QR whose handling is `minimum-line`, and for an NFR, only when it could decide between designs: it is hard to achieve, hard to undo, or in conflict with another driver. Otherwise set it aside in the concern inventory with a one-line reason; any reasonable design meets it.

Take the measure from the NFR when there is one; otherwise keep the QR's placeholders, or write a new named placeholder. One scenario may serve several QRs and NFRs. One QR may need several scenarios, when the response or the measure differs between environments (normal load and sale peak, for example).

Include data quality requirements. Freshness, accuracy and consistency of data decide how data moves and where it lives.

### 6. Change scenarios

From the anticipated changes, the variants, and the QRs of maintainability and portability, write change scenarios: what changes, which part of the system it may touch, and how much effort it may take. The effort is a business number: take it from the input, or write a placeholder.

### 7. Constraints

Write a constraint driver for every technology constraint, for every requirement that entered the quality chain through an entry point (law, standard, security risk analysis, development policy), and for the project constraints (budget, deadline, team), the team structure and the current structure when they bind a choice. Mark each as negotiable or not, from what the input says. When the input does not say, ask.

### 8. Functional, observability and security drivers

- Functional: the FRs whose demands shape the structure rather than one module: continuous updates, money movement, long-running processes across parts, work while disconnected, integrations, heavy computation, strict ordering, work bound to a clock. See `drivers.md`.
- Observability: what the SLIs need from the system (events at measurement points, client-side timings, one request ID carried through every hop), and what the people who analyse failures need.
- Security: from the security QRs and the security risk analysis, the assets to protect and the threats the inputs name. Stage 2 draws the threat model.

### 9. Principles

Write the few rules that apply to the whole system and follow from several drivers ("every operation that moves money can be repeated without moving it twice"; "personal data stays in the region"). A principle earns its place only when two or more stages or teams would otherwise decide the same thing separately.

### 10. Rank

Rank every driver except principles by business priority and design difficulty, following `drivers.md` ("Ranking"). The candidates are the drivers from emphasized and minimum-line QRs, every constraint, every change scenario, and every QR excluded this cycle whose later inclusion would mean changing the structure. Check each excluded QR for that cost, and say why it is or is not a candidate.

Mark the primary drivers. The ranking table is a business decision: mark it as needing agreement.

### 11. Conflicts

Record conflicts between drivers, on both drivers. A conflict between QRs that the quality chain recorded carries over, and new ones appear (a deadline against a new technology, a budget against redundancy). Say whether stage 2 can resolve it by design or the business must choose; ask when you cannot tell.

### 12. Feasibility

Before stage 2 spends effort, check every primary driver against the budget, the deadline and the team: is there any known way to meet it with these resources? When there is none, say so plainly, list the driver under "Needs agreement" and under "Issues for the quality chain" (the target or the priority may have to move), and keep the driver as written.

### 13. Findings, report, questions, items

On a re-run, process every open finding addressed to this stage, as `conventions.md` describes. Write the draft report following `report-template.md`. Ask about every uncertain point as `conventions.md` describes, apply the answers and check the exit criteria. Then write `design-context.yaml`, the DRV items and the updated findings.

## Exit criteria

- Every QR whose handling is emphasized or minimum-line, and every NFR, is used by a driver or set aside with a reason.
- Every requirement that came through an entry point is a constraint driver.
- Every anticipated change and every variant is a change scenario, or set aside with a reason.
- Every excluded QR has been checked for the cost of adding it later.
- Every quality, change, observability and security driver has a complete scenario, with a measure from the inputs or a named placeholder.
- Every constraint says whether it is negotiable.
- The ranking table marks the primary drivers and is listed under "Needs agreement".
- The concern inventory accounts for every input item, and every missing design input is an open question.
- No number appears that the inputs do not give, except provisional design parameters with their basis.
- Every open finding addressed to this stage is accepted or rejected.

## Pitfalls

- Treating every QR as a driver. Most quality requirements are met by any sensible design; drivers are the ones that decide between designs.
- Starting from a technology ("we use microservices") before the drivers exist. The technology then becomes the requirement.
- Scenarios without a measure ("the system is fast"). Nobody can check a design against them.
- Copying the quality chain's priority as the design priority. Business priority is one axis of the ranking; design difficulty is the other.
- Forgetting the drivers that never come from users: the deadline, the budget, the team's skills, the planned changes. They sink more designs than performance does.
- Writing a solution as a driver ("use a cache"). A driver says what must hold; stage 2 decides how.

## Finish

Tell the user which files were written, how many drivers of each kind, which are primary, what needs agreement, which design inputs are still missing, which issues for the quality chain were raised, and that the next stage is `architecture-drivers-to-architecture`.
