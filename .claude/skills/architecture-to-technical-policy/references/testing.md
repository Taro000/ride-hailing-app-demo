# Test strategy

## Contents
- Test layers
- Test doubles and seams
- Environments and test data
- What the later stages take from it

## Test layers

Decide the layers of tests (`layers` in the testing POL): for each, what it covers, what it replaces, and where and when it runs. Choose the layers that the drivers, the gates and the acceptance criteria need, not every layer there is.

| Layer | Covers | Replaces | Runs |
|---|---|---|---|
| Unit | The rules of one module: decision tables, calculations, state transitions | Everything outside the module | On every push; in seconds |
| Integration | One component through its interfaces, with its own data store | The external systems and the other components, through test doubles | On every push |
| Contract | That the two sides of an interface agree: the provider against the spec, a consumer against what it relies on | The other side | On every change to either side |
| End-to-end | Each CUJ across the components, through the screens | The external systems | Before a release, or on a schedule; in minutes |
| Load | A flow at a stated workload | The external systems, or their sandboxes | Before a release, in an environment that can carry the load |

- Every component with business rules gets a unit layer: it is where a decision table becomes tests, row by row.
- Run the integration layer against the same kind of data store as production. An in-memory substitute does not enforce the constraints, transactions and concurrent writes that the design relies on, and the tests then pass where the system fails.
- Add contract tests where the two sides of an interface are built or released apart: an external system, another team, a client released on its own.
- Keep end-to-end tests few: one for each CUJ and for its failure paths that only the whole system shows. They are slow, and they break for reasons outside the change.
- Add a load layer only where a gate of the quality chain asks for one, and say which environment can carry the load. When the design finds that the system needs a load test that no gate asks for, write a request to the quality chain ("Gates that the design finds missing" in `gate-bindings.md`).
- Write in `rules` what decides the layer of a check, such as "every acceptance criterion is checked at the lowest layer that can check it", with its check.

## Test doubles and seams

A test cannot show what happens when a provider times out, a deadline passes or two requests race, if it must wait for the real provider, the real clock or the real moment. Decide how each of them is replaced (`doubles` in the testing POL):

| Field | Says |
|---|---|
| `replaces` | What the double stands in for: an external system (by ELM ID), the clock, the generation of IDs or random values |
| `with` | The double, and what it can do: answer, refuse, time out, answer late, report later what it did; a clock the test sets and moves; IDs the test can predict |
| `seam` | Where it plugs in: the interface of the adapter that stage 2 puts around the external system, or the clock and the ID generator that the code receives instead of reading the system's |

- Give every external system that a component calls a double, unless a reason says why none is needed (the system is only read, and its sandbox is fast and stable).
- A double that can only succeed tests nothing that matters. Make it able to produce every outcome that the design handles: the errors of the interface, the timeout that leaves an outcome unknown, the late answer that settles it.
- Replace the clock wherever a rule depends on time (an expiry, a timeout, a schedule), and the IDs wherever a test must know one in advance.
- A double drifts from the system it stands in for. Say how it is kept honest: contract tests of the adapter against the provider's sandbox, run where the pipeline can reach it.

## Environments and test data

Decide the environments (`environments` in the testing POL): for each, what runs there and how it gets its data.

- Typical environments: a developer's machine, the pipeline's CI runners, a staging environment shaped like production. Name only those the layers and the gates need, within the platform that stage 2 decided and the budget.
- Test data comes from factories and fixtures in the tests, or from a generated set. It never comes from a copy of production that holds personal or payment data; when a test needs data shaped like production, say how it is made safe.
- Say where an environment differs from production in a way that tests can miss (a local database that serializes writes, a sandbox without the provider's fraud screening), and which layer covers that gap.
- When nothing runs between releases (a system deployed only for set sessions or events), say where the checks that need a running system happen, such as a short deployment before the system opens that the platform's rules allow, and what must pass there before it opens.
- An environment that costs money to keep running (a staging environment, a load-test cluster) is a cost the business decides ("Decisions" in `conventions.md`): rate it.

## What the later stages take from it

- Stage 4 names these layers in the verification approach of each module ("unit tests from the decision table", "an integration test against the database"), and implementation writes the tests in them.
- The gate bindings name the layers, environments and doubles that check each gate (`gate-bindings.md`), so every one they name must be here.
- A module whose checks need a layer that the policy lacks is a finding addressed to this stage.
