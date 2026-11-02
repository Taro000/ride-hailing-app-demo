---
name: architecture-drivers-to-architecture
description: Stage 2 of 4 in the design chain. Designs the architecture from the ranked drivers of requirements-to-architecture-drivers - the overall structure first, then decisions from the top of the ranking down, each with real options, the rejected ones and why, gains, costs, sensitive points, trade-offs, debts and deferrals. Walks eight design concerns, draws a threat model, defines the elements (components, data stores, external systems, nodes) with their responsibilities, functions, drivers and owning team, draws five Mermaid views (context, runtime, deployment, information, code structure), and walks every CUJ and primary driver through the design. Drafts first, then asks about every uncertain point. Use it when someone wants an architecture, a system design, component boundaries, a deployment design or design decisions with their rationale. Next, review it with design-review, then run architecture-to-high-level-design.
license: MIT
metadata:
  version: "0.1.0"
---

# Architecture drivers → architecture

Stage 2 of the design chain. It takes the architecture drivers (DRV) from stage 1 and produces the architecture: design decisions (DEC), the elements of the system (ELM), and five views. Stage 3 then specifies how the elements talk to each other and to the outside.

An architecture is the set of decisions that are expensive to change: how the system is split, where data lives, how the parts communicate, where they run. Each such decision serves some drivers at the expense of others. Writing down the options considered, why one was chosen and what it costs is what lets the next person change the design safely, instead of rediscovering why it is the way it is.

Design from the drivers down, not from a favourite structure up. Make the decisions the primary drivers force first, and let the rest of the design fill in around them.

## Read first

- `references/conventions.md`: the design chain, findings, the working language, judgment basis marks and the question protocol. Follow it exactly.
- `references/artifacts.md`: where files go, and the schemas for DEC, ELM and FND (and the DRV items you read).
- `references/structures-and-mechanisms.md`: overall structures, design mechanisms by quality, and the eight design concerns.
- `references/decisions.md`: how to write and compare options, sensitive points, trade-offs, parameters, debt, deferral and transition.
- `references/views.md`: the five views, consistency rules, walkthroughs, the threat model and teams.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.

## Inputs

- `docs/design/`: `1-architecture-drivers.md`, `design-context.yaml` and `drv/` from stage 1.
- `docs/quality/`, read only: `context.yaml` (users, CUJs and their steps), `fr/` (the functions to allocate), `qr/`, `nfr/` and `sli/` for the detail behind the drivers.
- Open findings addressed to this stage: `fnd/` items with `to: architecture-drivers-to-architecture` and `status: open`.
- The existing code, as recorded under `as_is` in `design-context.yaml`; read the parts you need.

Essential input: at least one DRV. If there is none, ask for the drivers (or suggest running `requirements-to-architecture-drivers`) before drafting.

## Workflow

### 1. Overall structure

From the primary drivers and the constraints, decide the overall structure: how the system splits into deployable parts, how the parts communicate by default, where state lives, and on what platform it runs. Follow `structures-and-mechanisms.md` ("Overall structures") and `decisions.md`: screen out the options that break a non-negotiable constraint, then compare the rest against the primary drivers in rank order. Write the result as the first decisions.

For an existing system, start from its current structure. Keeping it is always an option, and every change must earn its cost against the drivers.

### 2. One driver at a time

Take the drivers in rank order. For each one, decide how the design will produce the response its scenario asks for, choosing design mechanisms from `structures-and-mechanisms.md` ("Design mechanisms by quality"). Record each choice as a decision with at least two real options, following `decisions.md`. Name the points the response is sensitive to, and the trade-offs with other drivers, on both drivers.

When no option you know meets two primary drivers together, draft the option that serves the higher-ranked one, record the conflict on both drivers, and put the choice first among the questions: the business must choose, and the choice may become an issue for the quality chain.

For drivers below the primary line, check whether the decisions already made meet them, and add decisions only where they do not. Constraints and principles apply to every decision; say in each decision's rationale how it respects the ones it touches.

### 3. Threat model

Draw the data flows across trust boundaries, mark the assets that the security drivers name, and walk the six kinds of threat on every flow that crosses a boundary, following `views.md` ("Threat model"). Each threat that applies gets a decision that counters it, or a question when the inputs do not say whether it matters.

### 4. The eight design concerns

Walk all eight concerns in `structures-and-mechanisms.md` ("Design concerns"). For each, point to the decisions that settle it, or write "standard practice is enough" with a one-line reason. Concerns that share a reason can share a line.

### 5. Elements and allocation

Define the elements: components (deployable parts), data stores, external systems, and nodes (where things run). Then allocate:

- every FR to at least one component;
- every driver to the elements that carry it;
- every component to a team, when the design context names teams.

A component that two teams must change together for most change scenarios is a risk; record it, or move the boundary. Mark every element `keep`, `change`, `new` or `remove`.

### 6. Views

Draw the five views in Mermaid, following `views.md`: context, runtime, deployment, information and code structure. Use the element IDs in every view and check the consistency rules.

### 7. Walkthroughs

- Walk every step of every CUJ through the elements and their interactions.
- Walk every primary driver's scenario: where the stimulus enters, which decisions shape the response, whether the response can meet the measure as far as can be judged before anything is built, and what risk remains.

A walkthrough that fails sends you back to the decisions. A gap you cannot close becomes an open question, or an issue for the quality chain.

### 8. Debt, deferrals and transition

Record the decisions deliberately deferred and the debts accepted for the budget or the deadline, following `decisions.md`. For an existing system, write the order of the changes as decisions, so that the system works after each step.

### 9. Cost and team

Check the whole design against the budget, the deadline and the team: the running cost of the chosen platform and services (from stated prices only; otherwise placeholders), the work to build it, and the skills it needs. When it does not fit, say which driver must give way, list it under "Needs agreement", and write an issue for the quality chain when a target or a priority would have to move.

### 10. Findings

Process every open finding addressed to this stage, as `conventions.md` describes. When a driver is wrong or missing, write a finding addressed to `requirements-to-architecture-drivers`; do not change the drivers yourself.

### 11. Report, questions, items

Write the draft report following `report-template.md`. Ask about every uncertain point as `conventions.md` describes, apply the answers and check the exit criteria. Then write the DEC, ELM and FND items.

## Exit criteria

- Every primary driver is addressed by at least one decision. Every other driver is met by an existing decision, has its own, or is deferred with a reason and its risk.
- Every decision respects every non-negotiable constraint, and its rationale says how for the constraints it touches.
- Every FR is allocated to at least one component.
- Every CUJ and every primary driver has a walkthrough with no gap left unrecorded.
- Each of the eight design concerns has a decision or a reason.
- Every flow that crosses a trust boundary has been walked for the six kinds of threat.
- Every decision has at least two options (or the reason only one was possible), a rationale, gains and costs. Every provisional design parameter has its basis.
- The five views use the same elements and IDs, and pass the consistency rules.
- Every open finding addressed to this stage is accepted or rejected.

## Pitfalls

- Choosing a structure because it is popular. Separate services for a team of four, or one process for a system that must keep running when one part fails, are choices the drivers should make.
- Decisions with one option. If there was no alternative, say what forced it; otherwise the decision is only a description.
- Boxes with no decision behind them. An element is not designed until someone can say why it exists and what it is for.
- Ignoring the team. A split that makes most changes cross two teams is slower than either team alone.
- Polishing a low-ranked driver at the expense of the primary ones.
- Hiding cost. A design that meets every driver at a price nobody agreed to is not finished.

## Finish

Tell the user which files were written, how many decisions and elements, which drivers are met, deferred or at risk, what needs agreement, the findings processed and raised, the issues for the quality chain, and the next steps: run `design-review` on this stage in a fresh context, resolve its findings by re-running this stage, then run `architecture-to-high-level-design`.
