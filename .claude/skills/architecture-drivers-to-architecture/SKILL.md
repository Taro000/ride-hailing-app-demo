---
name: architecture-drivers-to-architecture
description: Stage 2 of 4 in the design chain. Designs the architecture from the ranked drivers of requirements-to-architecture-drivers - the overall structure and the platforms first, then decisions and mechanisms from the top of the ranking down, each with real options, the rejected ones and why, gains, costs, sensitive points, trade-offs, debts and deferrals. Walks eight design concerns, draws a threat model, defines the elements (components, data stores, external systems, nodes) with their functions, drivers, owning team and runtime, draws four Mermaid views (context, runtime, deployment, information), and walks every CUJ and primary driver through the design. Drafts first, then asks only about points of high breadth or severity and records the rest as assumptions. Use it when someone wants an architecture, a system design, component boundaries, platform choices, a deployment design or design decisions with their rationale. Next, review it with design-review, then run architecture-to-technical-policy.
license: MIT
metadata:
  version: "0.3.0"
---

# Architecture drivers → architecture

Stage 2 of the design chain. It takes the architecture drivers (DRV) from stage 1 and produces the architecture: design decisions (DEC), the elements of the system (ELM), four views, and the assumptions it made without asking (DAS). Stage 2b then decides the technical policy that the code of every component follows, and stage 3 specifies how the elements talk to each other and to the outside.

An architecture is the set of decisions that are expensive to change: how the system is split, where data lives, how the parts communicate, where they run. Each such decision serves some drivers at the expense of others. Writing down the options considered, why one was chosen and what it costs is what lets the next person change the design safely, instead of rediscovering why it is the way it is.

Design from the drivers down, not from a favourite structure up. Make the decisions the primary drivers force first, and let the rest of the design fill in around them.

The quality chain states requirements and leaves the design to this chain. Two kinds of choice it leaves are made here first: the platforms and device support (native or web, operating systems, browsers, versions) when no technology constraint fixes them, and the mechanisms that produce the behaviour its functional requirements state (failover, idempotency, reconciliation).

This stage decides what each component runs on (its runtime and its platform), not how its code is built. The language, framework and libraries of each kind of component, the repositories and the layout of the code, the tests and the pipeline, and the conventions inside the code are the technical policy's: stage 2b decides them once for every component, within this stage's decisions.

## Read first

- `references/conventions.md`: the design chain, what the quality chain leaves to the design, findings, the working language, judgment basis marks, the question protocol, decisions and assumptions, current state only, re-runs and finishing a run. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for DEC, ELM, HND, DAS, FND and QCR (and the DRV items and `design-context.yaml` you read).
- `references/structures-and-mechanisms.md`: overall structures, platforms and device support, design mechanisms by quality, and the eight design concerns.
- `references/decisions.md`: how to write and compare options, sensitive points, trade-offs, business decisions, parameters, debt, deferral and transition.
- `references/views.md`: the four views, consistency rules, walkthroughs, the threat model and teams.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.
- `scripts/tables.py` and `scripts/check.py`: write the report's index tables from the items, and check the items, specs and reports for what needs no judgment. Run them before committing ("Scripts" and "Finishing a run" in `references/conventions.md`).

## Inputs

- `docs/design/`: `1-architecture-drivers.md`, `design-context.yaml` (technology and project constraints, teams, anticipated changes, stakeholders, the current structure) and `drv/` from stage 1.
- `docs/quality/`, read only: `context.yaml` (users, CUJs and their steps, and the shared facts: constraints CON, external systems EXT, operational facts OPF), `qiu/` (the contexts of use: kinds of device and situations), `fr/` (the functions to allocate, and the behaviour that the mechanisms must produce), and `qr/`, `nfr/` and `sli/` for the detail behind the drivers.
- The open assumptions that this stage's judgments depend on: stage 1's in `das/`, and the quality chain's in `docs/quality/qas/`.
- Open findings addressed to this stage: `fnd/` items with `to: architecture-drivers-to-architecture` and `status: open`.
- Open hand-offs addressed to this stage: `hnd/` items with `to: architecture-drivers-to-architecture` and `status: open`.
- The existing code, as recorded under `as_is` in `design-context.yaml`; read the parts you need.
- On a re-run, this stage's report and items. Start from what changed since this stage's last run ("Re-running a stage" in `conventions.md`).

Essential input: at least one DRV. If there is none, ask for the drivers (or suggest running `requirements-to-architecture-drivers`) before drafting.

## Workflow

### 1. Overall structure and platforms

From the primary drivers and the constraints, decide the overall structure: how the system splits into deployable parts, how the parts communicate by default, where state lives, and on what platform it runs. Follow `structures-and-mechanisms.md` ("Overall structures") and `decisions.md`: screen out the options that break a non-negotiable constraint, then compare the rest against the primary drivers in rank order. Write the result as the first decisions.

Decide the platforms on the users' side and the device support the same way: native or web, which operating systems and browsers, from which versions. The quality chain names only kinds of device and situations. When a technology constraint fixes the platform, follow it and decide only what it leaves open; otherwise decide it here, from the contexts of use and the anticipated changes, following `structures-and-mechanisms.md` ("Platforms and device support"). The choice depends on facts that only the user's organization knows, such as the devices and systems its users have and the team's skills, so it is an uncertain point: rate it like any other. It changes the elements and every interface the users' devices call, so it usually has high breadth and is asked.

For an existing system, start from its current structure. Keeping it is always an option, and every change must earn its cost against the drivers.

### 2. One driver at a time

Take the drivers in rank order. For each one, decide how the design will produce the response its scenario asks for, choosing design mechanisms from `structures-and-mechanisms.md` ("Design mechanisms by quality"). Record each choice as a decision with at least two real options, following `decisions.md`. Name the points the response is sensitive to, and the trade-offs with other drivers, in the decision and in both drivers' walkthroughs.

The functional requirements say what can be observed from outside ("an order is charged at most once, even when the request is sent again"), never how. When that behaviour is demanding or spans elements, choose here the mechanisms that produce it (failover, idempotency, reconciliation, events instead of polling), and decide only their principles and the promises they make across elements: the principles that "Decision depth" in `conventions.md` lists for stage 2, such as which operations are idempotent and what their keys cover, or the order of the timeouts along a call path. Leave how each operation applies them (its key, its error codes, its retries) to stage 3, and the values they run with (timeouts, waits, intervals, thresholds) to the stage that "Decision depth" names, with a hand-off for each sensitive point ("Design parameters" in `decisions.md`). Stage 3 writes the mechanisms into the interfaces, and stage 4 into the modules.

When no option you know meets two primary drivers together, draft the option that serves the higher-ranked one, record the conflict in the decision and in both drivers' walkthroughs, and ask the business to choose, unless it already chose in stage 1. A primary driver left unmet is high severity, and the choice may become a request to the quality chain.

For drivers below the primary line, check whether the decisions already made meet them, and add decisions only where they do not. Constraints and principles apply to every decision; say in each decision's rationale how it respects the ones it touches.

### 3. Threat model

Draw the data flows across trust boundaries, mark the assets that the security drivers name, and walk the six kinds of threat on every flow that crosses a boundary, following `views.md` ("Threat model"). Each threat that applies gets a decision that counters it. When the inputs do not say whether a threat matters, that is an uncertain point; rate it like any other.

### 4. The eight design concerns

Walk all eight concerns in `structures-and-mechanisms.md` ("Design concerns"). For each, point to the decisions that settle what this stage decides of it, and name the later stage that decides the rest, with its trigger, citing the hand-off when there is one; or write "standard practice is enough" with a one-line reason. A part left to a later stage that way is an answer, not a gap. Concerns that share a reason can share a line.

### 5. Elements and allocation

Define the elements: components (deployable parts), data stores, external systems, and nodes (where things run). Each external system comes from an EXT entry in `context.yaml`, which it lists in `premises`, or from a decision that adds one (a second provider, a managed service).

Write in each component's `technology` the runtime it runs on and its platform (Node.js in containers; the browsers that the decision on platforms names), and in the `technology` of a data store or a node its product or managed service. Give the components that are built the same way (the servers, the workers, the web apps) the same runtime, unless a driver or a constraint needs otherwise. Name no language beyond what the runtime fixes, and no framework or library: stage 2b chooses them for each kind of component, within the runtime.

Then allocate:

- every FR to at least one component;
- every driver to the elements that carry it;
- every component to a team, when the design context names teams.

A component that two teams must change together for most change scenarios is a risk; record it, or move the boundary. Mark every element `keep`, `change`, `new` or `remove`.

### 6. Views

Draw the four views in Mermaid, following `views.md`: context, runtime, deployment and information. Use the element IDs in every view and check the consistency rules. How the code is organized into repositories, directories and packages is not a view of this stage: stage 2b draws it, with the dependency rules that hold it.

### 7. Walkthroughs

- Walk every step of every CUJ through the elements and their interactions.
- Walk every primary driver's scenario: where the stimulus enters, which decisions shape the response, whether the response can meet the measure as far as can be judged before anything is built, and what risk remains.

A walkthrough that fails sends you back to the decisions. A risk that a later stage settles within this stage's bounds, such as a value it sets, is not a gap: name that stage in the walkthrough. A gap you cannot close goes under "Open gaps", or becomes a request to the quality chain when only a change there would close it.

### 8. Debt, deferrals and transition

Record the debts accepted for the budget or the deadline, and the deferrals of points of this stage's full-depth kinds or of points that rate high, following `decisions.md`. Each one is a business decision: asked when either rating is high, otherwise adopted provisionally as a DAS of kind `decision`. Handing off any other point is not a business decision ("Decision depth" in `conventions.md`). For an existing system, write the order of the changes as decisions, so that the system works after each step.

### 9. Cost and team

Check the whole design against the budget, the deadline and the team: the running cost of the chosen platform and services (from stated prices only; otherwise placeholders), the work to build it, and the skills it needs. When it does not fit, say which driver must give way. That is a business decision, and it is asked whenever a primary driver gives way. Write a request to the quality chain when a target or a priority would have to move.

### 10. Hand-offs

Take up every open hand-off addressed to this stage whose trigger has come, as `conventions.md` describes ("Hand-offs"): decide it within its bounds, citing it in the `basis_note` of the items that decide it, or pass it on with the reason. Stage 1 hands off the points that quality-chain items leave for the design to confirm and that it could not settle: confirm each one addressed to this stage, or write a request to the quality chain when the design shows that it does not hold.

### 11. Findings

Process every open finding addressed to this stage, as `conventions.md` describes. When a driver is wrong or missing, write a finding addressed to `requirements-to-architecture-drivers`; do not change the drivers yourself.

### 12. Report and questions

Write the DEC, ELM, HND and FND items as you draft them in steps 1 to 11, and the draft report that indexes them, following `report-template.md`. Then follow "Draft first, ask afterwards" in `conventions.md`: list the points you were unsure of, together with the open DAS and QAS that your judgments depend on ("Assumptions"); rate them; ask the ones that need asking; and write a DAS for each of the others. At this stage, an uncertain overall structure, platform, vendor or managed service the system becomes tied to, or conflict between primary drivers usually rates high and is asked, and so does a design parameter that this stage sets, since it sizes something paid for or hard to change. The tables of single operations, the values of other parameters and the choices inside one component are deferred, unless one rates high as it would stand once deferred ("Deferring the rest" in `conventions.md`): they are left to the stages that decide them, and are neither asked nor recorded as a DAS here. Apply the answers to the items in place, check the exit criteria, and set the report's status to "answers applied". When nobody can answer during the run, write the questions under "Unanswered questions" instead, set the report's status to "waiting for answers", and finish the run; the next run applies the answers ("Draft first, ask afterwards", steps 7 and 8, in `conventions.md`).

## Exit criteria

- Every primary driver is addressed by at least one decision. Every other driver is met by a decision, or by what a later stage decides within this stage's decisions; one that nothing will meet is a debt or a deferral, decided as a business decision with its risk.
- Every decision respects every non-negotiable constraint, and its rationale says how for the constraints it touches.
- The platforms and device support are fixed by a technology constraint or settled by a decision.
- Every FR is allocated to at least one component. Every external system comes from an EXT entry or from a decision.
- Every mechanism that spans elements has its principles decided, the ones that `conventions.md` lists for stage 2 ("Decision depth"). No table of single operations is written here.
- Every CUJ and every primary driver has a walkthrough with no gap left unrecorded.
- Each of the eight design concerns points to the decisions that settle it, to the later stage that decides the rest with its trigger, or to a reason that standard practice is enough.
- Every flow that crosses a trust boundary has been walked for the six kinds of threat.
- Every decision has at least two options (or the reason only one was possible), a rationale, gains and costs.
- Every design parameter whose value this stage sets is of its full-depth kinds or rates high, and has its basis. Every other sensitive point names its parameter, and its value is handed off with its stage and trigger.
- The four views use the same elements and IDs, and pass the consistency rules.
- Every component's `technology` names its runtime and platform, and nothing that stage 2b decides. No decision of this stage chooses a framework or a library, the repositories or the layout of the code, a test layer or a test double, the pipeline, or a convention inside the code.
- No point of this stage's full-depth kinds, and none that rates high, is handed off unless its deferral was decided as a business decision ("Decision depth" in `conventions.md`).
- Every open hand-off addressed to this stage whose trigger has come is decided or passed on; a point that a quality-chain item leaves for the design to confirm is confirmed in the `basis_note` of an item, or raised as a request to the quality chain.
- Every open finding addressed to this stage is accepted or rejected.
- Each uncertain point has been asked or recorded as a DAS, and every business decision is under "Decisions" or is a DAS of kind `decision`, as `conventions.md` describes.
- Every item that depends on an assumption lists it in `premises`, and an item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`.
- Items refer to the quality chain and the design context by ID, and copy none of their statements.
- `scripts/check.py --skill architecture-drivers-to-architecture` reports no problem, except those waiting for a finding.

## Pitfalls

- Choosing a structure because it is popular. Separate services for a team of four, or one process for a system that must keep running when one part fails, are choices the drivers should make.
- Taking a platform for granted. When no constraint fixes native or web, or which systems and browsers, a platform picked by habit can leave out users that the quality chain counts on.
- Decisions with one option. If there was no alternative, say what forced it; otherwise the decision is only a description.
- Deciding here what a later stage will know better: the key and the error codes of each operation, the value of each timeout or threshold. They are redone once the interfaces and the code are designed. Decide the principle and the bounds, and hand off the rest.
- Deciding how the code is built: a framework, the layers inside a component, a way to test. Stage 2b decides them once for every component of a kind, from the drivers and the teams; a layering decided here binds the code before anyone has weighed the layouts, and contradicts the one that stage 2b then chooses.
- Boxes with no decision behind them. An element is not designed until someone can say why it exists and what it is for.
- Copying the quality chain into the design. A decision or an element that restates an FR or a constraint goes stale when the chain changes; refer to it by ID.
- Ignoring the team. A split that makes most changes cross two teams is slower than either team alone.
- Polishing a low-ranked driver at the expense of the primary ones.
- Hiding cost. A design that meets every driver at a price nobody decided on is not finished.

## Finish

Finish the run as `conventions.md` describes ("Finishing a run"): list the open assumptions, without asking for answers; name what to run next; run `scripts/tables.py` and `scripts/check.py` with `--skill architecture-drivers-to-architecture` and fix what the check reports in this stage's files; and commit the files this run wrote: the report, the DEC, ELM, DAS, HND, FND and QCR items, `quality-chain-requests.md`, and the DAS, HND and QCR files of other stages that it re-rated, answered or took up. Tell the user also which files were written, how many decisions and elements, the platforms decided, which drivers are met, deferred or at risk, the findings processed and raised, the requests to the quality chain raised or answered, and the next steps: run `design-review` on this stage in a fresh context when it has not been reviewed yet, or when a critical or major finding changed its items since its last review ("Findings between design stages" in `conventions.md`); re-run this stage when a review addresses a critical or major finding to it, but not for minor ones, which wait for its next run; then run `architecture-to-technical-policy`, and after it `architecture-to-high-level-design`. When questions wait for answers, name them, and say that this stage runs again once they are answered and that its review and the later stages wait until then ("Finishing a run", step 2, in `conventions.md`).
