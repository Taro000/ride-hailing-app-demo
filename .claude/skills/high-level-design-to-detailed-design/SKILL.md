---
name: high-level-design-to-detailed-design
description: Stage 4 of 4 in the design chain. Designs the inside of one component of the high-level design from architecture-to-high-level-design, far enough that a developer or a coding agent can implement it with no design decision left - modules with one responsibility each, their dependencies, frameworks, contracts (preconditions, postconditions, invariants, errors) in a language-neutral notation, state diagrams, decision tables, algorithms, concurrency, error handling, the physical data model, caches, screens, a verification approach per module, and provisional design parameters. Every component gets the same depth, and an index tracks their status. Writes documents only, never code. Drafts first, then asks about every uncertain point. Use it when someone wants a detailed design, module design, a database schema, state machines or decision tables for a component whose interfaces are designed. Review it with design-review.
license: MIT
metadata:
  version: "0.1.0"
---

# High-level design → detailed design

Stage 4, the last stage of the design chain. It takes one component (or a few, when they are small and closely related) from the high-level design and designs its inside: modules (MOD), their interfaces and behaviour, the data structures, and how each module will be verified. Run it once per component; the index `docs/design/4-detailed-design.md` tracks which components are done.

Detailed design ends where coding starts. The test: a developer, or a coding agent, could implement the component from it without making a design decision, and a reviewer could check the code against it. Every component gets the same depth. A component that looks simple still gets its modules, contracts, states and data written down, because "simple" is where unstated assumptions hide.

This stage writes documents, not code. Interfaces are written in a language-neutral notation, so that the design survives a change of language or framework.

## Read first

- `references/conventions.md`: the design chain, findings, the working language, judgment basis marks and the question protocol. Follow it exactly.
- `references/artifacts.md`: where files go, the schemas for MOD, DEC and FND, and the detailed design index.
- `references/modules.md`: splitting a component into modules, dependencies, frameworks, contracts and allocation.
- `references/behaviour-and-data.md`: states, decision tables, algorithms, concurrency, error handling, physical data, caches, screens and the verification approach.
- `references/report-template.md`: the component report, the index, and a worked example.
- `references/glossary.md`: terms for the working language.

## Inputs

- The component or components to design, named by their element IDs. If the user does not name them, ask, offering the components the index shows as not started.
- `docs/design/`: the element (`elm/`), its interfaces (`ifc/` and `ifc/specs/`), its data entities (`dat/`), the decisions that bind it (`dec/`), the drivers it carries (`drv/`), the shared conventions in `3-high-level-design.md`, and the index.
- `docs/quality/`, read only: the FRs allocated to the component, with their acceptance criteria, and the QRs behind its drivers, internal quality included.
- Open findings addressed to this stage for this component.
- The component's existing code, as recorded under `as_is`: read the parts being designed in full.

Essential input: the IFCs of the component. If there are none, ask for the high-level design (or suggest running `architecture-to-high-level-design`) before drafting.

## Workflow

### 1. Scope

Confirm the component for this run. One component per run is the default; take several only when they are small and closely related. Add every component element to the index if it is not there yet.

### 2. Modules

Split the component into modules, following `modules.md`: one responsibility each, what changes together kept together, decisions likely to change hidden behind interfaces, dependencies pointing toward stable modules, no cycles. Choose frameworks and off-the-shelf parts as decisions. For an existing component, start from its current modules and mark each `keep`, `change`, `new` or `remove`.

### 3. Allocation

Allocate every acceptance criterion of every FR allocated to the component, and every operation of every IFC it provides or consumes, to a module. Allocate the drivers the element carries to the modules that realize them.

### 4. Module interfaces

For every public operation of every module, write the signature in a language-neutral notation, with preconditions, postconditions, invariants and errors ("Contracts" in `modules.md`). Use the types of the shared conventions.

### 5. Behaviour

For each module, as it applies, following `behaviour-and-data.md`: a state diagram with every state and transition, timeouts and errors included; sequences inside the component; decision tables for rules with several conditions; algorithms with their steps, cost and edge cases; concurrency (what runs at the same time, what is locked, what is idempotent); error handling (what is handled where, what is passed on, what is logged). A timeout on a call that changes something leads to a state that settles its outcome, never to a failure.

### 6. Data structures

Design the physical data of the data entities the component owns (the DAT items whose owner is this component), wherever they are stored: tables, columns, types, constraints, indexes tied to the queries that need them, and, for an existing schema, migrations that keep the running version working. When another component reads these tables directly, keep them as stable as an interface. Design caches and in-memory structures with their keys, lifetimes and size bounds.

### 7. Screens

When the component serves people, design each screen: its components, the data each shows and takes, its states (loading, empty, error, success, and any the acceptance criteria name), input validation and messages, and what the accessibility requirements need.

### 8. Verification approach

For each module, write which acceptance criteria, contracts, budgets and internal quality requirements it must pass, and how they will be checked: unit tests from a decision table, contract tests against the IFC spec, property tests for an algorithm, a load test for a budget, a check in CI. Do not write test code.

### 9. Design parameters

Propose the remaining values inside the component (timeouts, retry limits, pool sizes, batch sizes, cache lifetimes) with their basis. They must fit the latency budgets and timeouts of stage 3; when they cannot, write a finding addressed to `architecture-to-high-level-design`.

### 10. Findings, report, questions, items, index

Process every open finding addressed to this stage for this component. When an interface, an entity or an architecture decision does not work, write a finding addressed to the stage that owns it; do not change its items yourself. Write the component report following `report-template.md`, ask about every uncertain point as `conventions.md` describes, apply the answers and check the exit criteria. Then write the MOD, DEC and FND items, and update the index.

## Exit criteria

- Every acceptance criterion of every FR allocated to the component is allocated to a module.
- Every operation of every IFC the component provides or consumes is realized by a module.
- Every module has one responsibility, an interface with contracts, its behaviour, its data structures and a verification approach.
- Every module with states has all its states and transitions, timeouts and errors included. Every decision table covers every combination of its conditions, without overlaps.
- The module dependencies have no cycles and follow the shared conventions.
- Every table of the data entities the component owns has its columns, constraints, and the indexes its queries need.
- Every call that changes something has a state that settles its outcome after a timeout.
- Every design parameter has a value and a basis, and fits the stage 3 budgets.
- The index lists every component with its current status.
- Every open finding addressed to this stage for this component is accepted or rejected.

## Pitfalls

- Designing only the happy path. States and errors are where two implementations of the same design differ.
- Modules named only after technical layers (controllers, services, repositories) with no business responsibility. Every change then touches every layer.
- Contracts without errors. The caller then learns them in production.
- Decision tables with gaps. Each missing combination is a behaviour someone will implement differently.
- Indexes chosen without the queries. Write the query first.
- Writing code. The design must survive a change of language; code is the next step, not this one.
- Leaving a component shallower than the others because it looked simple.

## Finish

Tell the user which files were written, how many modules, the decisions and parameters that need agreement, the findings processed and raised, the issues for the quality chain, the components still not designed according to the index, and the next steps: run `design-review` on this component in a fresh context, re-run this stage for the component to resolve its findings, and run this stage for the next component.
