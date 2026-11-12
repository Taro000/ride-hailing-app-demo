---
name: architecture-to-technical-policy
description: Stage 2b of the design chain, between the architecture and the high-level design. Decides once for the whole system the technical policy that later stages and the code follow - the language, framework and main libraries of each kind of component; the repositories, directory layout and dependency rules that CI enforces; test layers, test doubles for external services, clock and IDs, environments and test data; where and by what each gate of the quality chain is checked, and where each audit is held; the pipeline, static checks and conventions inside the code (errors, logs, settings, secrets, texts for people); which specs are hand-written or generated from code; and how coding agents find the design and raise findings. Needs only the architecture. Drafts first, asks only about points of high breadth or severity, records the rest as assumptions. Use it for a tech stack, repository layout, test strategy, CI/CD or coding conventions. Next, review it with design-review, then run architecture-to-high-level-design.
license: MIT
metadata:
  version: "0.3.0"
---

# Architecture → technical policy

Stage 2b of the design chain, between the architecture and the high-level design. It takes the elements (ELM) and decisions (DEC) of stage 2, with the drivers (DRV) and the design context, and decides the technical policy (POL): the rules that the code of every component follows, each decided once for the whole system. Stage 3 then designs the interfaces, stage 4 the modules, and implementation writes the code, within these policies.

Left to the later stages, these rules get decided in pieces and too late: a test strategy decided per component, a directory rule that one stage writes and another contradicts, a library that one component's detailed design picks and a shared package then imposes on the others, a gate that the quality chain requires and that nothing in the pipeline runs. They are also expensive to change once code builds on them. Deciding them here, before the interfaces and the modules, gives every later stage and every coding agent one place to read them.

The policies are written for coding agents first. Each rule says what the code does and how a breach is found, in words an agent can follow without asking.

## Read first

- `references/conventions.md`: the design chain, what the quality chain leaves to the design, decision depth, hand-offs, findings, the working language, judgment basis marks, the question protocol, decisions and assumptions, current state only, re-runs and finishing a run. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for POL (with its `gate_bindings` and `audit_bindings`), DEC, HND, DAS, FND and QCR (and the ELM and DRV items you read).
- `references/stack-and-repository.md`: what is already decided, one stack for each kind of component, the tools every component shares, repositories, directories and dependency rules.
- `references/testing.md`: test layers, test doubles and seams, environments and test data.
- `references/gate-bindings.md`: binding the quality chain's gates, and placing its audits.
- `references/pipeline-and-code.md`: the pipeline, deployment and rollback, static checks, and the conventions inside the code.
- `references/specs-and-feedback.md`: how each kind of interface gets its spec, and how coding agents find the design and bring findings back.
- `references/report-template.md`: the report layout, a worked example and example items.
- `references/glossary.md`: terms for the working language.
- `scripts/tables.py` and `scripts/check.py`: write the report's index tables from the items, and check the items, specs and reports for what needs no judgment. Run them before committing ("Scripts" and "Finishing a run" in `references/conventions.md`).

## Inputs

- `docs/design/`: `1-architecture-drivers.md`, `2-architecture.md`, `design-context.yaml` (technology constraints, the organization's engineering standards among them; project constraints, the team's size and skills among them; teams; anticipated changes; and, for an existing system, its current structure and the conventions its code follows), `drv/`, `elm/`, `dec/`, and the open assumptions in `das/`.
- `docs/quality/`, read only: `nfr/` (every NFR of kind `gate` or `audit`, to bind or place), `qr/` (the quality requirements of maintainability and portability: modularity, analysability, modifiability, testability, installability), `fr/` (the acceptance criteria that depend on time, IDs or an external system, which the test doubles must reach), `context.yaml` (the constraints CON and operational facts OPF that bind tools or environments), and the open assumptions in `qas/`.
- Open findings addressed to this stage: `fnd/` items with `to: architecture-to-technical-policy` and `status: open`, those raised by implementation included.
- Open hand-offs addressed to this stage: `hnd/` items with `to: architecture-to-technical-policy` and `status: open`.
- The requests to the quality chain that are open or answered (`qcr/`), and the answers the user wrote in `quality-chain-requests.md`: those that target a gate, an audit or a QR this stage reads.
- The existing code, as recorded under `as_is` in `design-context.yaml`: its manifests, its lint, type and test configuration, its directory layout and its pipeline. Read the parts you need.
- On a re-run, this stage's report and items, and what changed since this stage last ran ("Re-running a stage" in `conventions.md`).

This stage needs nothing from stages 3 and 4. It decides by kind, of component and of interface, what those stages and implementation then apply to each one.

Essential input: at least one element of kind `component`. If there is none, ask for the architecture (or suggest running `architecture-drivers-to-architecture`) before drafting.

## Workflow

### 1. What is already decided

List what already fixes part of the policy, following "What is already decided" in `stack-and-repository.md`: the technology constraints, the organization's engineering standards among them; the runtime, platform and deployment of each element, and the mechanisms that stage 2 decided; the conventions of the existing code; the hand-offs addressed to this stage. The policies follow them and decide only what they leave open, and each POL names in `decisions` the decisions it follows. Read also the drivers and the quality requirements of maintainability and portability, which usually shape the dependency rules (modularity, modifiability), the test layers and doubles (testability), the conventions for logs (analysability) and the deployment (installability): each POL names in `addresses` the drivers and QRs it serves. When a driver calls for something they rule out, write a finding addressed to the stage that decided it (stage 1 for a technology constraint, stage 2 for one of its decisions), and follow the decision until that stage changes it. A decision of stage 2 that fixes a point of this stage's full-depth kinds (a framework, the layout of the code, a way to test) is the exception: decide the point here, and write the finding, as `stack-and-repository.md` says. For an existing system, keeping its conventions is always an option, and every change must earn its cost against the drivers.

### 2. Technology

Group the components by kind (a server, a single-page app, a server-rendered web app, a native app, a worker, a scheduled job) and choose one stack for each kind: its language, framework and main libraries, within the runtime and the platform that stage 2 decided, following `stack-and-repository.md`. Never choose per component. Decide also the tools that every component shares: the package manager, the build, the tool that changes database schemas, and how each component runs on a developer's machine. Write them in the `technology` POL.

### 3. Repositories and directories

Decide the repositories and the components each holds; the layout of the directories inside each, by business capability or by technical layer, with where shared code, tests and generated files live; and the dependency rules, each with the check in CI that enforces it, following `stack-and-repository.md`. Check the split against stage 2's deployment and the teams. Write them in the `repository` POL, and draw the code structure in the report, which stage 2 leaves to this stage: the directory tree with the owning teams, and the allowed dependencies.

### 4. Test strategy

Decide the test layers (what each covers, what it replaces, where and when it runs), the test doubles of the external systems with the seams they plug into, how the clock and IDs are replaced, and the environments with their test data, following `testing.md`. Write them in the `testing` POL.

### 5. Gates and audits

For every NFR of kind `gate` in the quality chain, write a gate binding in the `testing` POL: where the gate is checked and by what, realizing its `where`, check and threshold without changing them. For every NFR of kind `audit`, write an audit binding: where the audit is held, so that its cadence or deadline is kept, and what supports it. Follow `gate-bindings.md`. When no design within the constraints can realize a gate or an audit as the quality chain defines it, write a request to the quality chain with the NFR in `targets`, and name it in the report's table in place of a binding. Never add a gate of the design's own: a check on a quality requirement that the system needs before a merge or a release, and that no gate asks for, is a request to the quality chain too ("The quality chain" in `conventions.md`).

### 6. Pipeline and code conventions

Decide the pipeline (its steps, when each runs, what each blocks), how a release is deployed and rolled back within stage 2's deployment, the static checks, and the conventions inside the code: how errors are raised and passed on, how logs are written, how settings and secrets are read, and where the texts for people live, following `pipeline-and-code.md`. Every step that a gate binding names is in the pipeline. Leave to stage 3 the conventions that interfaces show to their consumers ("Decision depth" in `conventions.md`). Write them in the `pipeline-and-code` POL.

### 7. Specs

For each kind of interface that stage 2's views show (with an external system, called from the users' devices, used by another team, between this system's own elements; HTTP, events, files, screens, batch jobs), decide how its spec is made: written by hand before the code when its other side is implemented apart from it, generated from the code otherwise (the default), the other side's own document, or none. Name the tool, and the check that keeps the code and the spec together. Follow `specs-and-feedback.md`, and write them in the `specs` POL.

### 8. Feedback from implementation

Decide how coding agents find the design and the policies before they change code, what they run before they finish a change, and how a finding comes back when the code cannot keep a decision of the design or a policy, following `specs-and-feedback.md`. Write it in the `implementation-feedback` POL.

### 9. Decisions

Write a decision (DEC with `stage: technical-policy`) for each choice that had real options: a framework, the layout of the directories, a paid tool or service, an environment that costs money. Give it at least two options someone could choose, what each does for the drivers it touches, the rejected options with their reasons, the gains and the costs, as `artifacts.md` shows; drop first the options that break a non-negotiable constraint, and compare the rest against the drivers in rank order. Do not write decisions for what a technology constraint fixes, for what any competent team would do the same way, or for what a later stage or implementation decides. A choice that accepts a cost in money or contracts, a weaker driver or a debt (no end-to-end tests before the first release) is a business decision ("Decisions" in `conventions.md`).

### 10. Hand-offs

Take up every open hand-off addressed to this stage whose trigger has come, as `conventions.md` describes ("Hand-offs"): decide it within its bounds, citing it in the `basis_note` of the items that decide it, or pass it on with the reason. Write a hand-off for a point this stage leaves to a later stage that would not take it up otherwise: a library that only one component needs and that a module stage 4 designs in full will depend on, to stage 4 for that component; a point whose deferral waits for an event, such as a tool chosen once its contract is signed.

### 11. Findings, report, questions, items

Process every open finding addressed to this stage, those raised by implementation included. When a driver or a decision of stage 2 is wrong or missing, write a finding addressed to the stage that owns it; do not change its items yourself. Write the POL, DEC, HND and FND items as you draft them in steps 1 to 10, and the draft report that indexes them, following `report-template.md`. Then list, rate and ask as `conventions.md` describes ("Draft first, ask afterwards"), re-rate the open DAS and QAS that your judgments depend on ("Assumptions"), and write a DAS for each point you do not ask about. In this stage:

- Usually high, so asked: a language or framework that no technology constraint fixes, since every component of its kind is built on it and the system is tied to it; a library that brings its own endpoints, tables or error format, such as an authentication library, since it fixes stored data and part of an interface; the repositories, when several teams share components; a tool or an environment that costs money; a request to the quality chain whose impact is high ("Requests to the quality chain" in `conventions.md`).
- Usually below the bar, so recorded as DAS: who performs an audit, when the inputs do not say; whether the team knows the main libraries, when the inputs do not say, as one DAS for the libraries that rest on that fact; another fact about the team's tools or habits that a choice depends on.
- Not a point: a choice that the guides settle from what the inputs state, such as a test double for an external system behind its adapter; it stays `inferred`. The libraries and versions left to implementation are deferred, and neither asked nor recorded.

Apply the answers to the items in place, check the exit criteria, and set the report's status to "answers applied". When nobody can answer during the run, write the questions under "Unanswered questions" instead, set the report's status to "waiting for answers", and finish the run; the next run applies the answers ("Draft first, ask afterwards", steps 7 and 8, in `conventions.md`).

## Exit criteria

- Every scope has one active POL: technology, repository, testing, pipeline and code, specs, implementation feedback. Each POL names in `addresses` the drivers and QRs it serves, and in `decisions` the decisions it follows.
- Every component is in exactly one stack entry. Every stack keeps the technology constraints and the runtime and platform that stage 2 decided, and components of one kind share one stack. The technology POL names the package manager, the build, the tool that changes database schemas, and how each component runs on a developer's machine.
- Every component is held by exactly one repository, and the split fits stage 2's deployment and the teams.
- Every dependency rule names what it constrains and the check in CI that fails on a breach.
- Every external system that a component calls has a test double and its seam, or a reason it needs none. The clock and IDs can be replaced wherever a driver or an acceptance criterion depends on time or IDs. Every layer and environment that a binding or a rule names is in the testing POL, and an environment that costs money is a business decision.
- Every NFR of kind `gate` in the quality chain has a gate binding that keeps its `where`, check and threshold, or an open or answered request to the quality chain that targets it replaces it. Every NFR of kind `audit` has an audit binding, or such a request replaces it. No policy adds a check on a quality requirement that no gate of the quality chain asks for. Every step, layer, environment and tool that a binding names exists in the policies.
- The pipeline says when each step runs and what it blocks, and a merge requires the static checks. The policy says how a release is deployed and rolled back, within stage 2's deployment, and how the code handles errors, writes logs, reads settings and secrets, and keeps the texts for people, each rule with its check.
- Every kind of interface that stage 2's views show has its spec rule, with its tool and the check that keeps the code and the spec together.
- The implementation-feedback POL says what coding agents read first, what they run before they finish, and how a finding comes back.
- No convention that interfaces show to their consumers is decided here: those are stage 3's.
- No point of this stage's full-depth kinds, and none that rates high, is handed off unless its deferral was decided as a business decision ("Decision depth" in `conventions.md`).
- Every open hand-off addressed to this stage whose trigger has come is decided or passed on.
- Every open finding addressed to this stage is accepted or rejected.
- Each uncertain point has been asked or recorded as a DAS, and every business decision is under "Decisions" or is a DAS of kind `decision`, as `conventions.md` describes.
- Every item that depends on an assumption lists it in `premises`, and an item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`.
- Items refer to the quality chain and the design context by ID, and copy none of their statements: no gate's threshold and no audit's cadence is written into a policy.
- `scripts/check.py --skill architecture-to-technical-policy` reports no problem, except those waiting for a finding.

## Pitfalls

- Choosing per component. Two server components on two frameworks double the libraries, the tests and the knowledge the team must keep, and a shared package then forces one component's choice on the other.
- Choosing for novelty. A framework the team has not used costs its learning against the deadline; the drivers, not taste, justify that cost.
- A layout by technical layer at the top of a component with business rules. Every change then touches every layer, and the boundaries between business capabilities vanish.
- A dependency rule that no tool checks. It decays at the first deadline.
- Checking a rule about writes with an import rule. An import checker cannot see which module writes a table; name the check that can (a database role, a test), or say that only review can.
- Binding a gate to a step that nobody builds, or moving it from CI to a release check because CI is slow. The quality chain decided where the gate runs; the binding realizes it, or a request goes back to the quality chain.
- Writing a spec by hand for an interface whose two sides the same team writes. It is a second copy of the code, and it drifts.
- Deciding here the error format, the IDs or the log fields of the interfaces. They are stage 3's, which every interface shows.
- Writing the pipeline's files, the lint configuration or the tests. They are implementation's; the policy says what they must do.

## Finish

Finish the run as `conventions.md` describes ("Finishing a run"): list the open assumptions, without asking for answers; name what to run next; run `scripts/tables.py` and `scripts/check.py` with `--skill architecture-to-technical-policy` and fix what the check reports in this stage's files; and commit the files this run wrote: the report, the POL, DEC, DAS, HND, FND and QCR items, `quality-chain-requests.md`, and the DAS, HND and QCR files of other stages that it re-rated, answered or took up. Tell the user also which files were written, the stack of each kind of component, the repositories, which gates and audits are bound and which became requests, the findings processed and raised, the requests to the quality chain raised or answered, and the next steps: run `design-review` on this stage in a fresh context when it has not been reviewed yet, or when a critical or major finding changed its items since its last review ("Findings between design stages" in `conventions.md`); re-run this stage when a review addresses a critical or major finding to it, but not for minor ones, which wait for its next run; then run `architecture-to-high-level-design`. On a re-run that changed a policy, name the later stages and the components whose items or code must follow it. When questions wait for answers, name them, and say that this stage runs again once they are answered and that its review and the later stages wait until then ("Finishing a run", step 2, in `conventions.md`).
