---
name: high-level-design-to-detailed-design
description: Stage 4 of 4 in the design chain. Designs the inside of one component of the high-level design from architecture-to-high-level-design, in detail only where a mistake in the code is costly. Modules that move money, settle an unknown outcome, share state with concurrent work, apply rules with several conditions or migrate data get full contracts, state diagrams, decision tables, concurrency and the constraints keeping their data's invariants; every other module goes to implementation with its responsibility, a contract summary, its acceptance criteria and its checks. An index tracks each component's status and module depths, and tells coding agents what the code decides and how to raise findings. Writes documents only, never code. Drafts first, then asks only about points of high breadth or severity and records the rest as assumptions. Use it when someone wants a detailed design, module design, state machines or decision tables for a component whose interfaces are designed. Review it with design-review.
license: MIT
metadata:
  version: "0.3.0"
---

# High-level design → detailed design

Stage 4, the last stage of the design chain. It takes one component (or a few, when they are small and closely related) from the high-level design and designs its inside: modules (MOD), their interfaces, the behaviour and data of the modules where a mistake is costly, and how each module will be verified. Run it once per component; the index `docs/design/4-detailed-design.md` tracks which components are done and hands the design to implementation.

The detailed design is the input to implementation, and coding agents are its main readers. It goes into detail only where a mistake in the code is costly to find and to undo: the modules that move money, settle an unknown outcome, share state with work that runs at the same time, apply rules with several conditions or migrate data, and any module that would rate high on breadth or severity at bounds depth. These modules are at full depth: their whole contracts, states, decision tables, concurrency and what keeps their data's invariants are written down. Every other module is at bounds depth: its responsibility, a summary of its contract, the acceptance criteria allocated to it and its verification approach are written down, and the code decides the rest. The test: a coding agent can implement every module without deciding anything that is costly to get wrong, and a reviewer can check the code against what the design decides.

This stage writes documents, not code. Interfaces are written in a language-neutral notation, so that the design survives a change of language or framework.

The technical policy of stage 2b has already decided, for every component of a kind, how its code is built: the stack, the directories and the dependency rules, the test layers with their doubles and environments, and the conventions inside the code. This stage designs the modules within it, and chooses none of it again for one component.

## Read first

- `references/conventions.md`: the design chain, findings, the working language, judgment basis marks, the question protocol, decisions, assumptions, re-runs and how a run finishes. Follow it exactly.
- `references/artifacts.md`: where files go, the schemas for MOD, DEC, HND, FND, DAS and QCR, and the detailed design index with its hand-off to implementation.
- `references/modules.md`: splitting a component into modules, the depth of each module, where modules live and what they depend on, the stack they are built on, contracts and allocation.
- `references/behaviour-and-data.md`: what a module at full depth gets (states, decision tables, algorithms, concurrency, error handling, physical data, caches, screens), and the verification approach of every module.
- `references/report-template.md`: the component report, the index, and a worked example.
- `references/glossary.md`: terms for the working language.
- `scripts/tables.py` and `scripts/check.py`: write the report's index tables from the items, and check the items, specs and reports for what needs no judgment. Run them before committing ("Scripts" and "Finishing a run" in `references/conventions.md`).

## Inputs

- The component or components to design, named by their element IDs. If the user does not name them, ask, offering the components the index shows as not started.
- `docs/design/`: the element (`elm/`), its interfaces (`ifc/` and `ifc/specs/`), its data entities (`dat/`), the decisions that bind it (`dec/`), the drivers it carries (`drv/`), the shared conventions, read from the DEC items that record them (the "Shared conventions" table of `3-high-level-design.md` lists them), and the index.
- The technical policies (`pol/`, which `2b-technical-policy.md` indexes): the stack of the component's kind, the layout of its directories and the dependency rules, the test layers with their doubles and environments, and the conventions inside the code.
- `docs/quality/`, read only: the FRs allocated to the component, with their acceptance criteria; the QRs behind its drivers, internal quality included; and the SLIs that its interfaces and data entities bind (`sli_bindings`), for the events and fields the component must produce.
- The open assumptions in the `premises` of the items you read: DAS under `docs/design/das/`, and the quality chain's QAS.
- Open findings addressed to this stage for this component, those raised by implementation included.
- Open hand-offs addressed to this stage for this component: `hnd/` items with `to: high-level-design-to-detailed-design`, `status: open` and the component's element ID in `component`. For the index, also every open hand-off addressed to implementation (`to: implementation`), whatever its component.
- The component's existing code, as recorded under `as_is`: read the parts being designed in full.

Essential input: the IFCs of the component. If there are none, ask for the high-level design (or suggest running `architecture-to-high-level-design`) before drafting.

## Workflow

### 1. Scope

Confirm the component for this run. One component per run is the default; take several only when they are small and closely related. The index lists every component element; `scripts/tables.py` writes its rows. When the component already has a report, start from what changed since this stage's last run for the component ("Re-running a stage" in `conventions.md`).

### 2. Modules

Split the component into modules, following `modules.md`: one responsibility each, what changes together kept together, decisions likely to change hidden behind interfaces, dependencies pointing toward stable modules, no cycles. Place each module in the directories that the repository policy's rules give, within its dependency rules. Build on the stack that the technology policy gives the component's kind, and choose no framework or main library here: write a decision only for a library whose choice the technical policy handed to this stage for this component ("Frameworks and off-the-shelf parts" in `modules.md`). For an existing component, start from its current modules and mark each `keep`, `change`, `new` or `remove`.

Then give each module its depth ("Depth of modules" in `modules.md`): `full` when it moves money, settles an unknown outcome, shares state with work that runs at the same time, applies rules with several conditions or migrates data, or when it would rate high on breadth or severity at bounds depth, with the reason in `depth_reason`; `bounds` otherwise. Rate each module that is of none of these kinds here, as a whole, as `modules.md` describes. Steps 4 to 9 design a module at full depth in detail. A module at bounds depth gets only its responsibility, the summary of its contract, its allocation and its verification approach; implementation decides the rest.

### 3. Allocation

Allocate every acceptance criterion of every FR allocated to the component to a module, and every operation of every IFC it provides or consumes to exactly one module of the component, which realizes it. When an SLI binding on those IFCs, or on the DATs the component owns, needs the component to produce events or fields, allocate that to a module too. Allocate the drivers the element carries to the modules that realize them.

### 4. Module interfaces

For every public operation of every module at full depth, write the signature in a language-neutral notation, with preconditions, postconditions, invariants and errors ("Contracts" in `modules.md`). For a module at bounds depth, write the summary its callers rely on: the signature, postcondition and errors of each public operation. Use the types of the shared conventions. The contracts belong in the MOD items; the report does not repeat them.

### 5. Behaviour

For each module at full depth, as it applies, following `behaviour-and-data.md`: a state diagram with every state and transition, timeouts and errors included; sequences inside the component; decision tables for rules with several conditions; algorithms with their steps, cost and edge cases; concurrency (what runs at the same time, what is locked, what is idempotent); error handling (which errors are handled where, and which are passed on, within the technical policy's conventions for errors and logs). A timeout on a call that changes something leads to a state that settles its outcome, never to a failure. Implementation decides the behaviour of a module at bounds depth, within its contract.

### 6. Data structures

Design the physical data that keeps the invariants the modules at full depth rely on, in the data entities the component owns (the DAT items whose owner is this component), wherever they are stored: what keeps each invariant (a constraint, an index, a transaction, a conditional update or the rights of a database role), and, for an existing schema, migrations that keep the running version working. When another component reads a table directly, design that table in full, whichever module writes it, and keep it as stable as an interface. Implementation designs the rest of the tables (their columns, types and the indexes that queries need) within the DATs: their attributes and relations, owner, consistency rule, classification and retention. Design the caches and in-memory structures of the modules at full depth with their keys, lifetimes and size bounds.

### 7. Screens

When a module at full depth serves a screen, design the screen with it: its states in the module's state diagram (loading, empty, error, success, and any the acceptance criteria name), the validation of its inputs with their messages, and what the accessibility requirements need. Implementation designs every other screen, within its screen IFC, the acceptance criteria allocated to its module and the accessibility requirements, which the module's verification approach checks.

### 8. Verification approach

For every module, at either depth, write which acceptance criteria, contracts, budgets and internal quality requirements it must pass, and how they will be checked, at the test layers of the technical policy, with its doubles and environments: unit tests from a decision table, property tests for an algorithm, an integration test against the database, a contract test of an adapter against the provider's sandbox. Do not write test code. Each module's checks go in its MOD item; the report names the layers, doubles and environments that the checks use, and describes only the scenarios that several modules share. A check that needs a layer, a double or an environment that the policy lacks is a finding addressed to `architecture-to-technical-policy`, except a budget that only a load test can check: the policy has a load layer only where a gate asks for one, so such a check rests on a request to the quality chain for the gate ("Verification approach" in `behaviour-and-data.md`).

### 9. Design parameters

Propose the values inside the modules at full depth (timeouts on the component's own data store, retry limits, pool sizes, batch sizes, cache lifetimes, schedules) with their basis. Implementation sets the values inside the modules at bounds depth, within their contracts and the stage 3 budgets. A timeout or wait that an IFC's `timing` holds, settlement waits included, is stage 3's: use it as it is, refer to it by the IFC's ID, and never set it here. Stage 3 sets those on the paths of time SLOs and of money. On the component's other calls to other elements, the IFC's `timing` gives only the bounds, and stage 3 hands the values to this stage (step 10): set each one here, within those bounds, as a parameter of the module that makes the call when that module is at full depth, and otherwise pass the hand-off on to implementation. The values set here must fit the latency budgets and timeouts of stage 3; when they cannot, or when a value in an IFC's timing must change, write a finding addressed to `architecture-to-high-level-design`. Each value is a provisional decision, rated like any other point ("Decisions" in `conventions.md`). Most stay inside one module and are tuned in operation, so they are adopted as an assumption of kind `decision`; values that hinge on the same fact share one.

### 10. Hand-offs

Take up every open hand-off addressed to this stage for this component whose trigger has come, as `conventions.md` describes ("Hand-offs"): decide it within its bounds, citing it in the `basis_note` of the items that decide it, or pass it on with the reason. A point that falls inside a module at bounds depth goes on to implementation, with the module named in `resolution`. A point that a quality-chain item leaves for the design to confirm reaches this stage as a hand-off too: confirm it, or write a request to the quality chain when the design shows that it does not hold.

Write a hand-off to implementation for a point this stage leaves open inside a module at full depth, with the bounds it must keep, such as where a set of rules is kept. The inside of a module at bounds depth needs none: its MOD item, with the report's types, data and verification approach, is its bounds.

### 11. Findings, report, questions, items, index

Process every open finding addressed to this stage for this component, those raised by implementation included. When an interface, an entity, an architecture decision or a technical policy does not work, write a finding addressed to the stage that owns it; do not change its items yourself. Write the MOD, DEC, HND and FND items as you draft them in steps 2 to 10, and the draft component report that indexes them, following `report-template.md`; the index shows the component as `draft` from the status in the report's header.

Then list and rate the uncertain points, ask about the ones `conventions.md` says to ask about, and record the rest as assumptions ("Draft first, ask afterwards"). The rules in `modules.md` and `behaviour-and-data.md` settle most choices here; a choice they settle from what the inputs state stays `inferred` and is not a point. A point inside a module at bounds depth is implementation's and is not rated here. Most of the points that remain stay inside one module and are easy to change later, so both ratings are low and they become assumptions. The points of high severity here are typically those that move money, touch personal data, fix the shape of stored data or tie the component to a vendor; breadth is high when five or more modules depend on a point, as they do on a type they all pass around. The stack, the directories and the test layers are not points of this stage: the technical policy decided them.

Re-rate the open assumptions this component's judgments depend on, whichever stage wrote them, and ask about one when a judgment you would ask about depends on it ("Assumptions" in `conventions.md`). Number the questions per component report and continue the numbering when the component is re-run; from elsewhere, cite one as "stage 4 ELM-02, question 3".

Apply the answers to the items in place, check the exit criteria, set the report's status to "answers applied", and update the index's header. `scripts/tables.py` updates the component's row, with its modules at each depth, and the list of open hand-offs addressed to implementation; keep the rules above that list as `artifacts.md` gives them ("The detailed design index"). When nobody can answer during the run, write the questions under "Unanswered questions" instead, set the report's status to "waiting for answers", update the index's header, and finish the run; the index then shows the component as waiting for answers, and the next run for the component applies them ("Draft first, ask afterwards", steps 7 and 8, in `conventions.md`).

## Exit criteria

- Every acceptance criterion of every FR allocated to the component is allocated to a module.
- Every operation of every IFC the component provides or consumes is realized by exactly one module of the component.
- Every SLI binding that needs the component to produce events or fields has a module that produces them.
- Every module has a depth, one responsibility, an interface with its contract (a summary at bounds depth) and a verification approach.
- Every module that moves money, settles an unknown outcome, shares state with work that runs at the same time, applies rules with several conditions or migrates data, and every module that would rate high at bounds depth, is at full depth, with its reason in `depth_reason`, unless its deferral was decided as a business decision, which its `depth_reason` then cites.
- Every module at full depth has its behaviour and its data structures, as they apply. The inside of a module at bounds depth is left to implementation, and is not a gap.
- Every module at full depth that has states has all its states and transitions, timeouts and errors included. Every decision table covers every combination of its conditions, without overlaps.
- The module dependencies have no cycles and keep the dependency rules of the technical policy, and every module sits in the directory that the policy's rules give it.
- The component is built on the stack of its kind in the technical policy. No decision of this stage chooses a framework or a main library; one chooses a library only where the technical policy handed that choice to this stage for this component.
- Every check in the verification approaches runs at a layer of the technical policy, with doubles and environments that the policy has, or a finding addressed to `architecture-to-technical-policy` names what it lacks; a budget that only a load test can check names instead the request to the quality chain for the gate.
- Every invariant of stored data that a module at full depth relies on is kept by the physical data the report designs ("Physical data" in `behaviour-and-data.md`), and every migration of an existing schema keeps the running version working. Every table another component reads directly is designed in full. The rest of the physical data is left to implementation, within the DATs.
- Every call that changes something in an external system or in another component is driven by a module at full depth, which has a state that settles its outcome after a timeout, whichever module sends the call.
- Every design parameter of a module at full depth has a value and a basis, fits the stage 3 budgets, and is either decided under "Decisions" or recorded as an assumption of kind `decision`. None is a timeout or wait that an IFC's `timing` holds: those are used by IFC ID. A timeout that stage 3 handed off to this component keeps the bounds in its IFC's `timing`, whether this stage sets it or passes it on to implementation. The values inside modules at bounds depth are left to implementation.
- Every item that depends on an assumption lists it in `premises`, and an item whose `premises` include an open DAS, or an open QAS that no design question has answered, has `basis: assumed`.
- The index lists every component with its current status and its modules at each depth, and its header gives the date and the `Inputs as of` commit. Its hand-off to implementation starts with the rules for implementation and lists every open hand-off addressed to implementation.
- Every open hand-off addressed to this stage for this component whose trigger has come is decided or passed on; a point that a quality-chain item leaves for the design to confirm is confirmed in the `basis_note` of an item, or raised as a request to the quality chain.
- Every open finding addressed to this stage for this component, those raised by implementation included, is accepted or rejected.
- `scripts/check.py --skill high-level-design-to-detailed-design` reports no problem, except those waiting for a finding.

## Pitfalls

- Designing only the happy path of a module at full depth. States and errors are where two implementations of the same design differ.
- Modules named only after technical layers (controllers, services, repositories) with no business responsibility. Every change then touches every layer.
- Choosing a framework or a library for one component. Components of the same kind then differ, and a package they share forces one component's choice on the others; the technical policy chooses once for each kind.
- Writing a dependency rule or a test layer of the component's own. The policy's rules and layers already hold every component; a gap in them is a finding addressed to `architecture-to-technical-policy`.
- Contracts without errors, at either depth. The caller then learns them in production.
- Decision tables with gaps. Each missing combination is a behaviour someone will implement differently.
- Putting a module at full depth to be safe. Each detail in it is then decided twice, in the design and in the code, and the two copies drift apart.
- Leaving a module at bounds depth because its code looks short, when it moves money, settles an unknown outcome or shares state. Short code is not cheap to get wrong.
- Designing whole tables that no other component reads. Implementation designs their columns, types and indexes for queries within the DATs; the design keeps what holds an invariant.
- Copying the items into the report. A contract written in two places drifts, and nobody can tell which copy is right.
- Writing code. The design must survive a change of language; code is the next step, not this one.

## Finish

Finish the run as `conventions.md` describes ("Finishing a run"). List the open assumptions this run wrote or depends on, highest ratings first, and say that no answer is needed. Tell the user which files were written, how many modules, how many questions were asked, the findings processed and raised, the requests to the quality chain raised or answered, the components still not designed according to the index, and the next steps: run `design-review` on this component in a fresh context when it has not been reviewed yet, or when a critical or major finding changed its items since its last review ("Findings between design stages" in `conventions.md`); re-run the stages that this run addressed a critical or major finding to; re-run this stage for the component when a review addresses a critical or major finding to it; and run this stage for the next component. Minor findings start no run: each waits for the next run of the stage it is addressed to. When questions wait for answers, name them, and say that this stage runs again for the component once they are answered and that its review waits until then ("Finishing a run", step 2, in `conventions.md`). Then run `scripts/tables.py` and `scripts/check.py` with `--skill high-level-design-to-detailed-design`, fix what the check reports in this stage's files, and commit the files this run wrote (the component report, the index, the MOD, DEC, DAS, HND, FND and QCR files, `quality-chain-requests.md`, and the DAS, HND and QCR files of other stages that it re-rated, answered or took up), with a message that names the component.
