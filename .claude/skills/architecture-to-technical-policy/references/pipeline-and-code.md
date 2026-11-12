# Pipeline and the conventions inside the code

## Contents
- The pipeline
- Deployment and rollback
- Static checks
- Conventions inside the code
- What stage 3 decides instead

## The pipeline

Decide the steps that every change passes, in order (`pipeline` in the pipeline-and-code POL):

| Field | Says |
|---|---|
| `step` | Its name, as gate bindings and agents refer to it |
| `when` | What starts it: every push, every pull request, a merge into the main branch, a release, a schedule |
| `runs` | What it runs: the build, the static checks, the dependency rules, test layers, the gates that bind to it |
| `blocks` | What its failure stops: a merge, a deployment, a release; or nothing, when it only reports |

- Run the fast checks on every change: types, lint, format, dependency rules, unit and integration tests. Make them required for a merge into the main branch, so that the main branch always passes them.
- Put each gate whose binding places it in CI into a step that blocks what the gate stops. Which checks on a quality requirement must pass before a merge or a release is the quality chain's to decide, through its gates: the pipeline runs them where their bindings say, and adds none of its own ("Gates that the design finds missing" in `gate-bindings.md`).
- Run the slow checks (end-to-end and contract tests, and the load tests that a gate asks for) where their cost fits: before a release, or on a schedule whose result blocks the next release.
- Stay within the CI that the technology constraints fix, and its limits: minutes, machines, the secrets it holds.
- Say which secrets each step receives. A step that runs code from outside the team, such as a pull request from a fork, receives none.

## Deployment and rollback

Within stage 2's deployment (what runs where, what is deployed on its own), decide how a release reaches each environment, and write it in the pipeline and in `rules`:

- Build each deployable once, and promote that same build from one environment to the next.
- Run database migrations before the new version starts, and keep each one compatible with the version still running: add first, remove only after no running version reads it. Then a rollback is a redeploy of the previous build.
- Say what starts a release (a tag, a merge, a person), and how a release is rolled back.

Writing the pipeline's files is implementation's work; the policy says what they must do.

## Static checks

Decide the type checker and its strictness, the linter and the rules that matter (those that catch bugs, not only style), and the formatter, within the technology constraints. Each runs on a developer's machine and in the pipeline, with the same configuration, and the pipeline's check step blocks a merge on any of them. The rest of their configuration is implementation's.

## Conventions inside the code

Decide the conventions that the code of every component follows inside itself, each in the POL's `rules` with its check:

- Errors: how a module signals a failure that its caller must handle (a result value or an exception, by kind of failure); what it does with a failure it cannot handle (passes it on, with its cause); where errors become the interface's error contract (one place per component, at its boundary); and that no error is swallowed: an error that is caught is handled, or logged with the request ID.
- Logs: the logging library, structured output (one object per line), the levels and when each is used, that every line carries the request ID and the fields that stage 3's conventions require, and that personal and payment data never reach a log unmasked, enforced in the logger and checked by a test.
- Settings and secrets: settings come from the environment, one source per environment and none written in the code; each component reads and validates them in one place when it starts, and refuses to start when one is missing. Secrets come from the secret store of the platform that stage 2 decided, never from the repository, and never reach a log; a scan in the pipeline looks for secrets committed by mistake.
- Texts for people: where they live (one place per language), so that the code holds keys rather than sentences; and how dates, numbers and amounts are shown in each language (one formatter, from the language of the request).

Stage 3 and stage 4 decide none of these: stage 3's shared conventions are only those that interfaces show to their consumers, and stage 4 designs each module's errors within these rules.

## What stage 3 decides instead

The conventions that interfaces show to their consumers are stage 3's ("Decision depth" in `conventions.md`): the error format and its codes, IDs, time and money as they travel, paging, authentication tokens, versioning, the headers of idempotency keys and request IDs, the log fields that SLIs need, and the naming of paths, fields and events. The code follows them; this stage decides how the code produces them, not what they are. A rule here that would fix one of them waits for stage 3: write it as "the code produces the error format of stage 3's conventions at the component's boundary", not as the format itself.
