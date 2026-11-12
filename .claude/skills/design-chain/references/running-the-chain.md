# Running the chain

## Contents
- The units and their order
- Reading the state
- What runs next
- Limits and settings
- When to stop

## The units and their order

The chain runs in units. A unit is a run of one stage, or a review of one stage; each component of stage 4 is a stage of its own ("Stale stages" in `conventions.md`), with its own review.

| Order | Unit | Skill | Report |
|---|---|---|---|
| 1 | stage 1 | `requirements-to-architecture-drivers` | `1-architecture-drivers.md` |
| 2 | stage 2 | `architecture-drivers-to-architecture` | `2-architecture.md` |
| 3 | review of stage 2 | `design-review` | `reviews/2-architecture.md` |
| 4 | stage 2b | `architecture-to-technical-policy` | `2b-technical-policy.md` |
| 5 | review of stage 2b | `design-review` | `reviews/2b-technical-policy.md` |
| 6 | stage 3 | `architecture-to-high-level-design` | `3-high-level-design.md` |
| 7 | review of stage 3 | `design-review` | `reviews/3-high-level-design.md` |
| 8 | stage 4 ELM-xx, for each component | `high-level-design-to-detailed-design` | `4-detailed-design/ELM-xx.md` |
| 9 | review of stage 4 ELM-xx | `design-review` | `reviews/4-detailed-design-ELM-xx.md` |

A unit's last run is the last commit whose first line starts with its skill's name and that changed its report. Each run of a stage ends with such a commit ("Finishing a run" in `conventions.md`), and each review with one that changes its review report.

## Reading the state

`scripts/status.py` prints one line per unit: its label, its last run, and its state, with the reasons under it.

| State | Meaning | What this skill does |
|---|---|---|
| not run yet | A stage with no report, or the review of a stage that has not run | Runs it once every unit above it is up to date: a first run |
| stale | A stage with something to process since its last run: the reasons say what | Runs it |
| due | A review that "Findings between design stages" calls for: after the stage's first run, or after a critical or major finding changed the stage's items; or a review whose report is still a draft or has answers to apply | Runs it |
| waiting | A report has questions that wait for answers, and none has come | Asks its questions once nothing else can run |
| up to date | None of these | Nothing |

`(after stage 2)` after a state means that the unit waits for the unit named: it runs only once that one is up to date. A unit whose state is stale or due can still show `after`: it is stale now, and runs in its turn.

The reasons that make a stage stale, as "Stale stages" in `conventions.md` defines them:

- `inputs changed: DRV-03, DEC-05`: items of earlier stages changed since the stage's last run, uncommitted changes included. For a component of stage 4, only what concerns the component counts: its own items, the items they name or that name them, every technical policy, and every decision that names no element, interface or data entity.
- `diagrams or tables changed in 2-architecture.md`: in an earlier stage's report, a Mermaid diagram (a view, a flow, a state diagram) changed, or a table under a heading that names a view, a flow, a budget, a state or a decision table. Other tables, such as the placeholders or the inputs, do not count.
- `quality chain changed: FR-12`: an item of the quality chain changed, such as a request the quality chain applied.
- `open findings addressed to it: FND-12 (major)`: a critical or major finding waits for the stage; in stage 4, one that concerns the component, by the report it was raised in or by what it targets. Minor findings never appear here; they wait for the stage's next run.
- `hand-offs written or passed on to it since its last run: HND-04 (trigger: ...)`. A script cannot tell from a trigger whether an event has come, so every hand-off written or passed on to the stage since its last run counts, whatever its trigger: the stage decides whether the trigger has come, as "Hand-offs" in `conventions.md` says, leaves the hand-off open when it has not, and the hand-off does not count again.
- `assumptions overturned since its last run: DAS-03`
- `answers under Unanswered questions: question 4`: a row has an answer: in the row; or, for a question about a request to the quality chain, recorded in the request since the stage's last run, or written under the request in the request document.
- `its report is still a draft`: the run that wrote it did not finish. The next run starts from the files it left, uncommitted, as the stage's own work.
- `its report has no commit whose first line starts with ...`: the stage's last run cannot be found, so the run reads every input again.

Under the units, `Next` names the unit to run, and `Also ready` the other units that can run after it, one at a time; `Waiting for answers` names the units that wait, with the numbers of their questions. A finding addressed to stage 4 whose component neither the report it was raised in nor its targets tell is listed apart: no component's run takes it up until its targets name the component, so tell the user in the summary.

With `--since <commit>`, the output also counts, since that commit, the runs of each unit and the runs of each stage that closed critical findings addressed to it, and it lists the fields of items that went back to a value they had earlier: as `oscillation` when nothing explains the change back, and as `went back, to judge` when an input of the item's stage changed in between, or the run that changed it back applied answers. It also lists a finding that may raise again what a stage rejected (`possible repeat`). With `--questions`, it prints every question that waits, with its options. With `--summary`, it lists the requests to the quality chain that are open or answered with the stages that become stale once the quality chain applies them, the hand-offs that wait for their trigger, the minor findings that wait for the next run of their stage, and the open assumptions, highest first. `--format json` prints all of it as JSON.

`scripts/status.py` reads the status of a report, and the heading "Unanswered questions", in English and in Japanese. In another language it finds the questions by the shape of their table (six columns, the first one `#`), and notes that it could not read the status.

## What runs next

The unit that `Next` names, alone. The rules behind it:

- **From the top down.** The first unit, in the order above, that is stale, due or not run yet runs first, and the state is read again after each run: a run can make other units stale, or settle what made them stale.
- **Nothing below a unit that must run first.** A unit waits while a unit above it is stale, due, waiting or not run yet. A stage that waits for answers holds back everything below it, its own review included. A review that waits for answers holds back the stages below the stage it reviews.
- **Components are independent.** Each component of stage 4 waits for the units above stage 4, never for another component; a component's review waits for that component. While one component waits for answers, the others run.
- **One at a time.** New items take the number after the highest one in use, and every run commits to the current branch: two runs at once would give two items one ID and mix their commits.
- **Upstream first, also while a unit waits.** A stage above one that waits still runs when it is stale; the stage that waits then applies its answers and the upstream change in the same run.

First runs follow the same rules. On a design that has not started, `Next` is stage 1; once it has run, stage 2, then its review, and so on down to one first run of stage 4 for each component and the review of each.

`scripts/status.py` judges only what it can read. When the user says that an event a hand-off waits for has come, or asks for a run, run that stage even when its state is up to date, and say why in its request.

## Limits and settings

| Setting | Default | What it limits |
|---|---|---|
| `runs` | 10 | Runs of stages and reviews in one invocation |
| `runs_per_unit` | 3 | Runs of one unit in one invocation, a resumed run included |
| `critical_rounds` | 2 | Runs of one stage that closed critical findings addressed to it, after which a critical finding still open for it stops the chain |

`docs/design/design-chain.yaml` sets them for every invocation of this skill, when it exists:

```yaml
runs: 20
runs_per_unit: 3
critical_rounds: 2
```

A setting that the request gives ("continue, with up to 20 runs") holds for that invocation and comes before the file. A setting that is neither in the request nor in the file keeps its default.

Count the runs with `scripts/status.py --since <start commit>`: it counts each commit of a unit's skill that changed the unit's report, so the count holds whatever this conversation remembers.

## When to stop

Read the state after every run, and stop at the first condition that holds. Each stop is a line of the summary, with its cause.

| Condition | How to see it | What the summary says |
|---|---|---|
| Nothing to do | `Next: nothing; every stage and review is up to date` | That the chain is up to date |
| Questions that nobody answers | Units wait for answers, and AskUserQuestion is not available or the user dismissed it | The questions by unit and number, and where to answer them |
| Oscillation | `oscillation:` lists a field that went back to an earlier value with nothing to explain it. Or a field under `went back, to judge`, or a `possible repeat`, that you judge an oscillation (below) | The item and the field, or the two findings; the runs that changed it and changed it back, by commit; the findings or answers behind each change |
| Runs | The total of `runs` reached `runs`; or the unit to run next already ran `runs_per_unit` times | The limit reached, and the unit that would run next |
| Critical findings after the rounds | For a stage, `runs that closed critical findings` reached `critical_rounds`, and a critical finding addressed to it is open | The stage, the critical findings still open, and the rounds that closed the earlier ones |
| A run that failed | After a run, the unit has no new commit of its skill, or its reply says it could not finish; a diff review that found nothing changed is no failure ("After a run" in `runs.md`) | The unit, what its reply said, and that nothing after it ran |

Questions that someone answers are no stop: ask them and go on ("Ask the questions" in SKILL.md). A run that ends waiting for answers is no failure either: it committed its draft and its questions.

When a limit stops the chain while questions wait, ask them anyway and write the answers, so that the next invocation can resume, and run nothing more.

A field under `went back, to judge` names what may explain it. Read the first lines of the two commits it names, which say what triggered each run. It is no oscillation when the change back follows from that explanation: the input that changed in between made the earlier change unneeded, or the user's answer chose the earlier value. Go on, and mention it in the summary. It is an oscillation when the two runs changed the field for reasons that pull against each other, such as two findings that ask for opposite values.

A possible repeat is not an oscillation by itself: a later finding on an item that a rejected finding also targeted may be about something else. Read the two findings named. It is an oscillation when the new one asks for what the stage rejected in the other, since its inputs have not changed in between ("Do not raise again a finding that was rejected with a reason", in `design-review`); otherwise go on, and mention it in the summary. A finding that the stage accepted and a later finding then undoes shows as a field that went back to its value.
