# Technology, repositories and directories

## Contents
- What is already decided
- One stack for each kind of component
- Choosing a stack
- Tools every component shares
- Repositories
- Directories
- Dependency rules

## What is already decided

Before choosing anything, list what already fixes part of the answer. The policies follow it, and decide only what it leaves open.

| Source | What it can fix | Where to read it |
|---|---|---|
| Technology constraints (TC) | A language, a framework or a tool that the organization mandates or prohibits; its engineering standards (a linter, a test framework, how code is reviewed); the CI it runs on | `design-context.yaml`, `technology_constraints` |
| Project constraints and teams (PC, TEAM) | The team's size and skills, the deadline and the budget that a choice must fit; which team owns which component | `design-context.yaml` |
| Stage 2 | The runtime and platform of each element (its `technology`, and the decisions that it cites); the deployment: what runs where, and what is deployed separately; the owning team of each component; the mechanisms whose seams the code must keep, such as an adapter of its own for each external system | `elm/`, `dec/`, `2-architecture.md` |
| The existing code | Its languages, frameworks, package manager, lint, type and test configuration, directory layout and pipeline | `as_is` in `design-context.yaml`, then the code itself |
| Hand-offs addressed to this stage | A point an earlier stage left here, with its bounds | `hnd/` |

- An earlier stage's decision binds this stage like any other input: list the DEC in the policy's `decisions`, and decide within it, except as the next point says.
- Stage 2 decides no language beyond what a runtime fixes, no framework or library, no layout of the code and no way to test: this stage is their only home. A decision of stage 2 that fixes one of them all the same, such as a layering of the code inside the components, decides a point of this stage's full-depth kinds. Decide the point here, with stage 2's choice among the options, and write a finding addressed to stage 2 so that its decision leaves the point to this stage: major when this stage chooses otherwise, since the two items then contradict each other, and minor when it chooses the same. This is the one case in which this stage does not wait for the earlier stage to change its decision: from this run on, the later stages and the code follow the policy.
- An earlier stage may also leave a point of this stage's scopes to a later stage (a library "chosen in stage 4", a tool "chosen at implementation"). When this stage's full-depth kinds include the point, decide it here, as you would a hand-off addressed to this stage, and cite the decision that left it.
- When a driver calls for what one of them rules out, write a finding addressed to the stage that decided it (stage 1 for a TC, stage 2 for one of its decisions), with the driver as evidence, and keep following the decision until that stage changes it, unless it is a decision of stage 2 on a point of this stage's full-depth kinds (the second point). Never decide against it silently.
- For an existing system, keeping what the code does is always an option. A change costs the work to move every component that follows the old way, and must earn that cost against the drivers.

## One stack for each kind of component

Group the components (the ELM items of kind `component`) by kind: what they are built as. Typical kinds are a server that answers requests, a worker that consumes events or a queue, a scheduled or batch job, a single-page app in the browser, a server-rendered web app, a native app; and, when stage 2 makes them components, the definitions of a pipeline or the scripts that people run by hand. Decide one stack for each kind, never one per component: components of one kind then share their libraries, their tests and their tooling, and anyone who knows one can work on another. Data stores, external systems and nodes get no stack; stage 2's elements give their platforms.

A stack entry (`stack` in the technology POL) holds:

| Field | Says |
|---|---|
| `kind` | The kind, in the working language |
| `elements` | The components of this kind (ELM IDs). Every component is in exactly one entry |
| `language` | The language and its major version, with the settings that change what code can be written (strict typing) |
| `runtime` | The runtime and its major version line, within what stage 2 decided; for code that runs in a browser, the browsers of stage 2's platforms, and the runtime that builds it |
| `framework` | The framework the components are built on, or "none" with what takes its place |
| `libraries` | The main libraries: those that shape the code of every component of the kind, each with what it is for (data access, validation of input, rendering, the client of a message broker, logging) |

Leave out the libraries that only one component or one module needs, and the exact versions: implementation chooses them within the stack ("Decision depth" in `conventions.md`). When a later stage will design a costly module around such a choice (a rules engine, the library that settles payments), hand the choice to stage 4 for that component, with the stack as its bounds. Two kinds may share most of a stack, such as a server and a worker in the same language with the same data access library; write each kind's entry in full all the same, so that an agent reads one entry and not two.

## Choosing a stack

When no technology constraint fixes a kind's stack, compare real options and write the choice as a decision (SKILL.md, step 9):

1. Drop the options that break a non-negotiable constraint: a runtime the platform does not offer, a licence the organization cannot accept, a language the mandated tools do not support.
2. Weigh the team. A stack the team knows is faster to build and to keep correct; a stack new to it costs its learning against the deadline. When the cost is real, the choice is a business decision, and it usually rates high.
3. Compare the rest against the drivers in rank order: what each option makes possible or hard for them (many open connections, pages rendered on the server, the libraries an external system offers, a change scenario that swaps a provider).
4. Prefer what will still be maintained over the life of the system, and what is cheap to leave if it is not: count the code that would have to change.
5. Prefer fewer stacks. Each extra kind of stack doubles the tooling, the libraries to keep up to date and the knowledge to keep.

A language or a framework that no constraint fixes ties every component of its kind to it: its breadth and its severity are high, and it is asked ("Draft first, ask afterwards" in `conventions.md`). So is a library that brings its own endpoints, tables or error format, such as an authentication library: name in its decision what it fixes, since stage 3 then designs the interfaces around it.

Check what you write about a library or a tool (its current major version, what it supports, how it is configured) against its current documentation when you have a way to read it, and name in `basis_note` the facts you could not check. A version remembered from earlier work may no longer be current.

## Tools every component shares

Decide in the technology POL's `rules`, each with its check:

- the package manager, and how the packages of one repository are linked (workspaces), with one lockfile;
- how the code is built and run, locally and in the pipeline (compiled ahead, or run as it is);
- the tool that changes database schemas: how a change is written (a migration), and when it runs (before the new version starts);
- how a component runs on a developer's machine with its dependencies (containers, a local copy of a managed service), and where the local copy behaves differently from the managed one (how it handles concurrent writes, which features it lacks), so that the test strategy covers the difference (`testing.md`).

## Repositories

Decide the repositories and the components each holds (`repositories` in the repository POL). Every component is held by exactly one repository.

- One repository for the components that one team builds and releases together is the usual start: one change can span them, and one pipeline checks them together.
- A repository per team when teams must release on their own schedule, or must not change each other's code.
- A repository of its own for a component only when it must be released, secured or published apart from the rest.

Check the split against stage 2:

- Each component that stage 2 deploys on its own can be built, tested and released on its own within its repository: the pipeline builds what changed, or one pipeline per component.
- The teams: a repository that two teams must change together for most change scenarios slows both, and one that splits what one team changes together doubles its work.
- Say where the definitions of the infrastructure live: the nodes, the managed services, the secrets they reference (never the secrets themselves).

## Directories

Decide the layout inside each repository, and write it as rules in the repository POL: where each component lives, where code that several components share lives, and how the code inside a component is grouped.

- Group the code inside a component by business capability (what changes together for the business: payments, stock, orders), with the layers inside each group, rather than by technical layer at the top (controllers, services, repositories). A change of a business rule then touches one directory, and the boundary between two capabilities can be checked. Choose technical layers at the top only for a component with no business rules to speak of, such as a thin adapter.
- Keep the business rules free of frameworks and external systems: they define the interfaces (ports) they need, and the adapters that talk to a framework, a database or an external system implement them. The test doubles plug into the same ports (`testing.md`).
- Put code that several components share in a package with a reason and an owner. A shared package that grows by convenience couples the components that use it.
- Say where tests live (next to the code they test, or apart by layer), and where generated files go (generated specs, generated clients), and whether they are committed.

Draw the tree of directories, two or three levels deep, in the report.

## Dependency rules

A boundary that no tool checks decays at the first deadline. Write each dependency rule so that a tool can check it, and name the tool and the pipeline step that fails on a breach (`dependency_rules` in the repository POL):

- `rule`: what may not depend on what, by paths or packages: "nothing under `apps/storefront/` imports from `apps/store-api/`", "only `src/payments/adapters/` imports the providers' client libraries".
- `check`: the tool, its rule and the step that runs it: "dependency-cruiser, rule `no-cross-app`, in the pipeline's check step".

Cover the boundaries that the architecture relies on:

- between components, which talk only through their interfaces;
- around the adapter of each external system, so that a second provider or a new version changes one place;
- between the business rules and the frameworks, the database and the external systems;
- between the business capabilities inside a component: a capability uses another only through the other's public entry point.

Some rules cannot be checked by imports. "Only the dispatch module writes the state of a ride" is about writes, which an import checker does not see. Name the check in CI that can see it: the rights of a database role that only that module's connection holds, or a test that fails when another module writes the table. When only a person can check a rule, it is not a dependency rule: put it in the repository POL's `rules`, with the review of the pull request as its `check`, so that whoever reviews the design can weigh it.
