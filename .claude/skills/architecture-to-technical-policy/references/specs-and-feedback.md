# Specs, and the feedback from implementation

## Contents
- How each kind of interface gets its spec
- Keeping the code and the spec together
- How coding agents find the design
- How findings come back

## How each kind of interface gets its spec

Stage 3 designs the interfaces after this stage, so decide by kind of interface, from what stage 2 shows: the connectors of the runtime view (request and response, events, files, schedules), the external systems of the context view, the components that the users' devices call, and the teams that own each component. For each kind, decide how its spec is made (`specs` in the specs POL):

| Field | Says |
|---|---|
| `interfaces` | The kind of interface, in words that stage 3 can apply to each IFC: "HTTP called from the buyers' browsers", "events between this system's own components", "the payment providers' APIs" |
| `made` | How its spec is made (below) |
| `how` | The format and the tool, where the spec lives, and the check that keeps the code and the spec together |

| `made` | When | The spec |
|---|---|---|
| `by-hand` | The other side is implemented apart from this code: an external system that calls an interface this system provides, another team, a party that builds against a contract this system sets | Written before the code, by stage 3 under `ifc/specs/`; both sides are checked against it |
| `from-code` | The default: the teams of this system build both sides | Generated from the code by the tool that `how` names; the IFC holds the contract that the code keeps (operations, errors and their codes, idempotency, what happens when an outcome is unknown) |
| `owner` | The other side owns the interface: an external system's API that this system calls, a broker that another team runs; or a library serves it on this system's behalf, such as the endpoints of an authentication library | The owner's document, which the IFC links; this system's adapter, or its use of the library, is checked against it |
| `none` | Screens and batch jobs | No document: the IFC is the contract |

A spec written by hand for an interface whose two sides the same team writes is a second copy of the code. It drifts from the code, and its schemas and repeated error responses grow larger than the code they describe. Generate it instead, and keep the contract that consumers rely on in the IFC.

Cover every kind that stage 2's views show, and say "none today" for a kind the policy expects but the architecture does not have yet (an interface another team will build against), so that stage 3 finds a rule when one appears.

## Keeping the code and the spec together

Name, in `how`, the check that fails when the code and the spec disagree:

- `by-hand`: contract tests that check the provider's answers against the spec's schemas, or code generated from the spec (types, validators, clients) that fails to build when the code disagrees with it.
- `from-code`: the pipeline generates the spec from the code on every change and keeps it where `how` says. A change that breaks the spec of the last release (a field removed, a type narrowed) fails the check unless the interface's versioning allows it. Consumers in the same repository are typed from the generated spec, so that they fail to build when it changes under them.
- `owner`: contract tests of the adapter against the owner's sandbox, where the pipeline can reach it, before a release.

## How coding agents find the design

Coding agents read the design before they change code only when something points them to it. Decide, in the `rules` of the implementation-feedback POL:

- The file that coding agents read first in each repository: an agent instructions file at its root, such as `AGENTS.md` or `CLAUDE.md`. Say what it tells them: before a change, read this stage's report and policies, then the hand-off to implementation in the detailed design index and the report of the component they change; follow the policies; run the commands below before they finish. Implementation writes and keeps that file; the policy says what it holds.
- The commands an agent runs before it finishes a change: the static checks and the tests of the pipeline's check step, as one command, so that the agent does not leave them to CI.

## How findings come back

- Details that the design leaves open are decided in the code and its tests, and never written back into `docs/design/` ("Findings between design stages" in `conventions.md`; the hand-off to implementation in the detailed design index says the same to coding agents).
- When the code cannot keep a decision of the design, implementation writes a finding as the hand-off to implementation describes, addressed to the stage that wrote the item. When the code cannot keep a policy (a framework that cannot do what a driver needs, a dependency rule that blocks every reasonable change), the finding is addressed to this stage.
- The pipeline checks what implementation writes under `docs/design/`: the check step runs `scripts/check.py --skill implementation` from one of the design skills installed in the repository, so that a finding parses and names items that exist. When the skills are not installed in the repository, say so, and name the check that stands in for it.
- The agent's summary of a change names each finding it wrote, and the stage to re-run, so that the user can decide.
