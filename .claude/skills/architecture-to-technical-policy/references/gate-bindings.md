# Gates and audits

## Contents
- What the quality chain gives
- Gate bindings
- Audit bindings
- When a gate or an audit cannot be bound
- Gates that the design finds missing
- Example

## What the quality chain gives

The quality chain writes its non-functional requirements (NFR) in four kinds: `slo`, `gate`, `audit` and `monitor`. Stage 3 binds the SLIs that its SLOs count. This stage binds its gates and places its audits:

- A gate (`kind: gate`) is a check that something must pass before it ships. Its `gate` field says where it runs (`CI`, `release-check` or `definition-of-done`), what it checks, and the threshold that passes it.
- An audit (`kind: audit`) is a check made by people, or on a cadence, rather than on every change. Its `audit` field says the mechanism (an audit, a deadline to fix vulnerabilities, a penetration test, a usability evaluation, an accessibility check, a recovery drill), the criterion and the cadence or deadline.

Read each one by its ID. Never copy its check, threshold, criterion or cadence into the policy: when the quality chain changes them, a copy stays behind, and nobody finds it.

## Gate bindings

For every NFR of kind `gate`, write one entry in the testing POL's `gate_bindings`. A gate binding is to a gate what an SLI binding is to an SLI: it decides where and by what the gate is checked, never what passes.

| Field | Says |
|---|---|
| `nfr` | The gate's ID |
| `where` | The place that realizes the gate's `where`. For `CI`: the pipeline step (from the pipeline POL) and what a failure there blocks, such as a merge into the main branch. For `release-check`: the step or the checklist that a release passes before it goes out. For `definition-of-done`: the checklist that holds the item (the pull request template, the checklist of a story), who ticks it, and what cannot proceed until it is ticked |
| `by` | What runs the gate's check and judges its threshold: a test layer and the tests it holds, a tool, or a person and what they look at; and what it needs: an environment, test data, a double |

Keep what the gate requires:

- Keep its `where`. A gate that the quality chain puts in CI is checked on every change; moving it to a release check lets failures pile up until the release. When the design cannot run it where the chain says (a load test at the stated peak needs more than the CI runners have), write a request to the quality chain with the gate in `targets`; do not move it in the binding.
- Keep its check and its threshold. When the tool at hand covers only part of the check (an automated accessibility checker finds some failures of a standard, not all), say what covers the rest (a person, a second tool), or write a request to the quality chain.
- Name only what exists: the step must be in the pipeline POL, the layer in `layers`, the environment in `environments`, the double in `doubles`, the tool in the stack or the rules. A gate bound to a step that nobody builds is never checked.
- Write one binding per gate. Several gates can share a step and a layer, but each still gets its entry, so that `scripts/check.py` finds every gate bound.
- A gate that applies to every change of a kind (every new function, every screen) usually lives in the Definition of Done even when tests do the checking: the binding then says which tests, and who confirms that a new function has them.
- In a team of one, nobody else ticks the Definition of Done. Say what stands in for a second person: a checklist in the pull request that the pipeline reads and fails on when an item that applies is not ticked, together with the tests that show it.

## Audit bindings

For every NFR of kind `audit`, write one entry in the testing POL's `audit_bindings`, with the same fields:

| Field | Says |
|---|---|
| `nfr` | The audit's ID |
| `where` | Where the audit is held, so that its cadence or deadline is kept: a scheduled job that opens it, an item of the release checklist, a recurring entry in the team's tracker; and where its record is kept (the ticket, a report in the repository) |
| `by` | What supports it, and who performs it: the tool that finds what it acts on (a dependency scan for a deadline to fix vulnerabilities, a backup job for a restore drill, an accessibility checker before a manual check), and the person or team that runs it |

Place the audit where the system and its pipeline can support it. Keep its record where only the people allowed to read it can: the findings of a security audit, and anything that holds personal data, never go into a public repository or tracker. Who signs an audit off, and the procedures around it, are business procedures and out of scope ("Scope" in `conventions.md`): write in the report's "Out of scope" what only a procedure can do. When the inputs do not say who performs an audit, that is an uncertain point: rate it, and usually record it as a DAS.

## When a gate or an audit cannot be bound

A gate or an audit that no design within the constraints can realize as the quality chain defines it gets a request to the quality chain, not a binding: the check needs an environment that the budget does not pay for, a threshold needs data the system never has, a cadence asks for people the team does not have. Write the request with the NFR in `targets` (`conventions.md`, "Requests to the quality chain"), and name it in the last column of the report's gate or audit bindings table ("Request instead"), as stage 3 does for an SLI that nothing can bind. `scripts/check.py` then counts the gate as handled while the request is open or answered.

## Gates that the design finds missing

A check that the work must pass on a quality requirement before it is merged, shown, released or called done is a gate, and gates are the quality chain's. When the design finds that the system needs one that no NFR asks for, such as a load test before release, write a request to the quality chain that suggests the gate; never add it to the pipeline, a rule or a binding as the design's own. A check in CI that the code keeps a decision of the design (the dependency rules, the static checks, the fields every log line carries) is design, not a gate, and the policies decide it.

## Example

In the online store, the quality chain has one gate and one audit. NFR-06 asks, in the Definition of Done, that a failed payment can be followed from the order to the charge; NFR-05 asks for a deadline to fix vulnerabilities that affect payment, and a regular audit of how card payments are handled. The testing policy binds them (`artifacts.md`, POL-03):

- NFR-06: `where` is the Definition of Done in the pull request template, which the reviewer ticks and without which a change to the payment path cannot merge; `by` is an integration test for each payment path that fails a payment and checks that the log lines of the order and of the charge carry the same request ID, which the reviewer confirms a new payment path has. The binding names the integration layer and the reviewer, and copies nothing of what NFR-06 checks.
- NFR-05: its deadline is held by a ticket that the dependency scan of the pipeline's check step opens, with the deadline as its due date; its audit by a ticket that a scheduled job opens from a template at the cadence NFR-05 sets, which keeps the audit's record. Neither copies the deadline or the cadence. Who performs the audit is not in the inputs: DAS-03 assumes the security team.
