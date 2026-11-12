---
name: design-chain
description: Runs the design chain for you in Claude Code. Finds the stages that are stale - something they read changed, a critical or major finding or a hand-off came, an assumption was overturned, a question was answered - and runs each one with its skill as a subagent, one at a time from the top of the chain down, with design-review only after a stage's first run and after a critical or major finding changed it. Keeps the stages below one that waits for answers stopped while it runs the others, then asks the questions the runs wrote, grouped by stage, writes the answers into the reports and resumes those stages. Stops only for those questions, an item that goes back to an earlier value, its limits on runs, or critical findings left after two rounds, and ends with the runs, the questions, the open assumptions and the requests to the quality chain. In other agents, shows the next stage to run and what to ask it. Use it to start, continue or check the design chain, or to ask which design stage to run next.
license: MIT
metadata:
  version: "0.3.0"
---

# Design chain

Runs the stages of the design chain for the user. It finds the stages that are stale, runs each one with its skill as a subagent, from the top of the chain down, and runs `design-review` where a review is due. Findings, hand-offs, overturned assumptions and requests that the quality chain applied start the runs they call for, without the user. It stops for the user only when a run wrote questions that nobody could answer during it: it asks them all at once, grouped by stage, writes the answers into the reports, and resumes the stages that asked them.

It decides nothing about the design. Each stage decides, writes and commits its own items, as its skill says. When to run what follows `conventions.md` ("Stale stages", "Findings between design stages"), and `scripts/status.py` applies those rules to the items, the reports and git. This skill writes nothing but the answers the user gives, in the reports' "Unanswered questions", and it never pushes.

Nobody confirms a stage before it runs, so an assumption that is wrong and was not rated high flows down the chain. The safety net is the stages' own rules: each run re-rates the open assumptions its judgments depend on, an assumption that more and more items rest on rises to high breadth and is then asked, and every open assumption is listed for the user at the end, where any correction is applied like an answer.

## Read first

- `references/conventions.md`: the design chain. Above all "Stale stages" and "Re-running a stage", "Draft first, ask afterwards" (steps 7 and 8: questions written down and answers applied), "Findings between design stages" (when a review runs), "Assumptions" and "Finishing a run".
- `references/running-the-chain.md`: the units of the chain and their order, what `scripts/status.py` shows, what runs next, the limits, and when to stop.
- `references/runs.md`: the request each subagent gets, how to continue one with answers, what to check after a run, and what to hand over where no subagent can run.
- `references/questions.md`: how to ask the questions that the runs wrote, and how to write the answers and the corrections back.
- `references/summary.md`: the closing summary, with an example.
- `references/glossary.md`: terms for the working language.
- `scripts/status.py`: the state of the chain. Run it from the project's root: `python3 <this skill's directory>/scripts/status.py`. It needs Python 3.8 or later and no packages, and changes nothing.

## What the user asks for

- **Start**: run the chain on a design that has not started, or whose later stages have not run yet. For stage 1's first run, the request gives what stage 1 needs from the user, the design context: technology constraints and the organization's engineering standards, budget and deadline, team, how the teams are split, anticipated changes. Pass it to stage 1 as the user wrote it.
- **Continue**: run whatever is stale now: after the user answered questions in the reports, corrected an assumption, handed the request document to the quality chain and re-ran it, or after implementation raised findings, or after a run of this skill stopped at a limit.
- **Status**: show the state of the chain and run nothing. Run `scripts/status.py --summary`, and tell the user in the working language what is stale and why, what waits for answers, what runs next, and what will make a stage stale later.

A request may also name a stage to run, or say that an event a hand-off waits for has come ("the vendor contract is signed"). Run that stage then, saying so in its request, even when `scripts/status.py` does not show it as stale: the user may run any stage at any time.

## Where it runs

It runs the chain where it can start subagents and ask the user structured questions: Claude Code, with its Agent tool and AskUserQuestion. Elsewhere, and when this skill itself runs as a subagent, it runs nothing: it shows the state, the next unit to run with the request to give it in a new session, and the questions that wait ("Handing over" in `runs.md`).

## Settings

| Setting | Default | What it limits |
|---|---|---|
| `runs` | 10 | Runs of stages and reviews in one invocation |
| `runs_per_unit` | 3 | Runs of one stage, one component of stage 4, or one review, in one invocation |
| `critical_rounds` | 2 | Runs of one stage that closed critical findings addressed to it, after which a critical finding still open for it stops the chain |

`docs/design/design-chain.yaml`, when it exists, sets them for every invocation; the request sets them for one ("continue, with up to 20 runs"). `running-the-chain.md` shows the file.

## Workflow

### 1. Check the setup

- The project is a git repository. Without git, `scripts/status.py` cannot see what changed since a stage's last run: show the state it can find, and hand over instead of running ("Handing over" in `runs.md`).
- Python 3.8 or later runs `scripts/status.py`. Without it, find the stale stages by hand as "Stale stages" in `conventions.md` describes, and say so in the summary.
- The stage skills and `design-review` are installed in the same skills directory as this skill, or in the other one (`.claude/skills/` in the project, `~/.claude/skills/`). When one that the chain needs is missing, stop and say which to install (`npx skills add Taro000/req-to-design`).
- Note the commit the invocation starts from (`git rev-parse HEAD`): the limits and the check for oscillation count from it. Leave the files as they are. Uncommitted changes under `docs/design/` are the user's hand edits or answers, which the runs take in ("Re-running a stage" in `conventions.md`), or what a run that did not finish left: `scripts/status.py` shows that stage as stale, because its report is still a draft, and its next run starts from what it finds. Say so in the summary, so that the user can discard those files first if they want.
- Read the settings.

### 2. Read the state

Run `scripts/status.py --since <start commit>`. It lists every unit of the chain (each stage, each component of stage 4, and each review) with its state and the reasons, and names what runs next. `running-the-chain.md` explains the output.

### 3. Stop, or go on

Stop when one of the conditions under "When to stop" in `running-the-chain.md` holds: an item went back to an earlier value with nothing to explain it, a limit is reached, critical findings remain after the rounds allowed, or the last run failed. When a limit stops the chain while questions wait, ask them first and write the answers (step 5), and run nothing more. Otherwise:

- When a unit can run, go to step 4.
- When nothing can run and questions wait, go to step 5.
- When nothing is stale, due or waiting, go to step 6.

### 4. Run the next unit

Run the first unit that `scripts/status.py` names under "Next", as a subagent, with the request that `runs.md` gives for it, and wait for it to finish before anything else. Run one unit at a time, also when several are ready, such as two components of stage 4: two runs at once would number new items from the same highest ID and mix their commits. Never run a unit that the output shows after another (`after stage 2b`), and never a stage below one that waits for answers.

When the run ends, check it as "After a run" in `runs.md` describes, note what it did for the summary, and go back to step 2.

### 5. Ask the questions

When nothing can run and some units wait for answers, ask their questions now, all together, as `questions.md` describes: run `scripts/status.py --questions`, ask with AskUserQuestion one unit at a time, up to 4 questions per call, and write each answer in its question's row in the unit's report. Do not commit the answers: the run that applies them commits them.

Then go back to step 2, and run what `scripts/status.py` names next, one unit at a time as before: a unit with answers is stale (a review, due) now, and runs in its turn, which is not always the order in which its questions were asked, since resuming one unit can change what the others read. When the unit to run is one whose questions this invocation asked, and the subagent that wrote them can still be continued, continue it, so that it keeps its context ("Resuming with answers" in `runs.md`); otherwise run it in a new subagent, whose run applies the answers.

When nobody answers, because AskUserQuestion is not available or the user dismissed it, stop: the questions wait in the reports.

### 6. Finish

Write the summary that `summary.md` describes, in the working language: why the chain stopped, the runs with their commits, the questions asked and their answers, the open assumptions (no answer needed; any correction is applied like an answer), the requests to the quality chain that are open or answered and the stages that become stale once the quality chain applies them, and what to do next.

When the user then corrects an assumption, or decides between the values of an item that went back and forth, write it as `questions.md` describes ("Corrections and decisions after a stop"), and continue: the stage that applies it is stale now.

## Before finishing

- Every run that this invocation started ended with a commit of its skill, or was a diff review that found nothing changed, or the summary names the run that failed and why the chain stopped there.
- No answer was written that the user did not give, and nothing was committed or pushed by this skill.
- No unit ran below a unit that waited for answers or that the output showed before it, and no two runs overlapped.
- No review ran that `scripts/status.py` did not show as due, and no stage ran for minor findings alone, unless the user asked for that run.
- The summary says why the chain stopped and lists the runs, the questions with their answers, the open assumptions, and the open or answered requests to the quality chain.

## Pitfalls

- Answering a question in the user's place, even with the drafted option. An answer makes a judgment `confirmed`, and only the user can confirm it.
- Committing the answers. A commit whose first line starts with a skill's name would pass for that stage's run, and the stage would never apply them ("Re-running a stage" in `conventions.md`).
- Fixing an item between runs, or editing what a run wrote. The stage that owns an item is the only one that changes it; a problem in it is a finding for that stage.
- Giving a review subagent this conversation's view of the design, or the reasons the review is due. A review runs in a fresh context, from the artifacts alone (`design-review`, "Run it in a fresh context").
- Running a review after every run, or a stage for its minor findings. Both start runs that decide nothing; `scripts/status.py` names only the runs that the conventions call for.
- Running the next unit before the last one has finished, or two components of stage 4 at once.
- Reading the design to decide what runs next. The output of `scripts/status.py` and the runs' replies are enough; the items stay with the stages, and this conversation stays small enough to last a long chain.
- Going on after a run that left no commit. The same unit would show as stale again, and the chain would run it until a limit stops it. The one exception is a diff review that found nothing changed since the last review: it ends without a commit by design ("After a run" in `runs.md`).
- Resuming every unit that got answers, one after another. Resuming one can make another stale for a new reason, or hold it back; run only what `scripts/status.py` names next.

## Finish

Tell the user, in the working language, as `summary.md` describes. When the chain stopped for questions that nobody answered, list them by unit and number, say where to answer them (the "Answer" column of "Unanswered questions" in each report, or under the request in `docs/design/quality-chain-requests.md` for a question about a request), and say that the next invocation of this skill resumes from there.
