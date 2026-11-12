# The closing summary

## Contents
- What it holds
- Template
- Worked example: online store

## What it holds

Every invocation ends with one summary, in the working language, with the glossary's terms. It is the user's view of everything the runs did, so it names each run by its commit and each item by its ID, and restates none of what the items say: the reports and items hold that.

- **Why the chain stopped**: nothing is stale; questions wait that nobody answered; an oscillation; a limit; critical findings left after the rounds allowed; or a run that failed, with its cause ("When to stop" in `running-the-chain.md`).
- **The runs**: each unit that ran, its commit, and what it did, from its reply.
- **The questions asked**: each question that this invocation asked, with the answer the user gave, by unit and number.
- **The open assumptions**: from `scripts/status.py --summary`, one line each with its ratings, highest first. No answer is needed; a correction is applied like an answer ("Corrections to assumptions" in `questions.md`). When there are more than fifteen, list those rated high or medium on either scale, and say how many others there are and that each report lists its own.
- **The requests to the quality chain** that are open or answered, with the stages that become stale once the quality chain applies each one; they wait in `docs/design/quality-chain-requests.md` for the user to answer and to hand to the quality chain.
- **What else will make a stage stale later**: the hand-offs that wait for their trigger, the minor findings that wait for the next run of their stage, and the problems that `check.py` left for other stages, as the runs named them. Also, when there are any: the findings addressed to stage 4 that name no component, which no run takes up until their targets name one; the fields that went back to an earlier value and that you judged no oscillation, with why; and the files that a run which did not finish left uncommitted, which its stage's next run starts from unless the user discards them.
- **Next**: what the user can do, and that invoking this skill again continues from here.

Leave out a part that has nothing in it, except why the chain stopped and the runs.

## Template

```markdown
## Design chain: <why it stopped, in one line>

<n> runs since <start commit>; limits: <runs> runs, <runs_per_unit> per unit, <critical_rounds> rounds of critical findings.

### Runs
| # | Unit | Commit | What it did |
|---|---|---|---|

### Questions asked
| Unit | # | Question | Answer |
|---|---|---|---|

### Open assumptions
No answer is needed. Correct any that is wrong, and the stage that wrote it applies the correction when the chain continues.
- <ID> (<stage>, <kind>; breadth <rating>, severity <rating>): <title>. Items: <IDs>

### Requests to the quality chain
- <QCR ID> <title> (<status>, impact <rating>): when the quality chain applies it, <stages> become stale.
<Answer them in docs/design/quality-chain-requests.md, hand it to the quality-chain stages it names, and re-run those.>

### Later
- Hand-offs waiting for their trigger: <ID> to <stage>: <trigger>
- Minor findings waiting for the next run of their stage: <stage>: <IDs>
- Problems that check.py left for other stages: <stage>: <number and rules>

### Next
<One to three lines.>
```

## Worked example: online store

While stage 3 of the online store budgeted the latency of checkout, it found that DRV-06's measure counts the orders the store screens for fraud, while the providers screen inside their charge (DEC-06) and report no screening of their own. No interface can yield that measure, so stage 3 raised FND-09, major, to stage 1, and the user asked to continue the chain. Stage 3 waited for one answer on the way, which the user gave.

```markdown
## Design chain: up to date; nothing is stale, due or waiting

6 runs since 4e1a9c0; limits: 10 runs, 3 per unit, 2 rounds of critical findings.

### Runs
| # | Unit | Commit | What it did |
|---|---|---|---|
| 1 | stage 1 | 9b03d2e requirements-to-architecture-drivers: accept FND-09 | Accepted FND-09; changed DRV-06's measure to the declines the providers report |
| 2 | stage 2 | 51c7e88 architecture-drivers-to-architecture: follow DRV-06 | Checked DEC-06 against DRV-06; nothing to change |
| 3 | stage 2b | 0d6b4f1 architecture-to-technical-policy: follow DRV-06 | Nothing to change |
| 4 | stage 3 | c2a8e05 architecture-to-high-level-design: follow DRV-06, waiting for answers to question 6 | Changed IFC-02; wrote question 6 |
| 5 | stage 3 | 7f31b9a architecture-to-high-level-design: apply question 6 | Applied the answer; changed IFC-01's errors |
| 6 | stage 4 ELM-02 | e94d2c7 high-level-design-to-detailed-design: ELM-02, follow IFC-01 and IFC-02 | Changed MOD-01; raised nothing |

No review was due: stage 1, which accepted FND-09, has no review, and the other stages only followed its change.

### Questions asked
| Unit | # | Question | Answer |
|---|---|---|---|
| stage 3 | 6 | Does checkout answer a charge that a provider declines for fraud as a card decline (402 with code CARD_DECLINED), or with a code of its own? | As a card decline, as drafted |

### Open assumptions
No answer is needed. Correct any that is wrong, and the stage that wrote it applies the correction when the chain continues.
- DAS-02 (stage 2, judgment; breadth medium, severity low): The second payment provider works like the first. Items: DEC-02, ELM-06
- DAS-04 (stage 2b, judgment; breadth medium, severity low): The code host's CI runs the pipeline. Items: POL-03, POL-04
- DAS-03 (stage 2b, judgment; breadth low, severity medium): The security team performs NFR-05's audit of card payments. Items: POL-03
- DAS-05 (stage 2b, decision; breadth low, severity low): A staging environment started only for the release step. Items: POL-03

### Requests to the quality chain
- QCR-04 A load test of checkout before the spring sale (open, impact low): no item depends on it.
- QCR-05 Whether a pending payment counts as a checkout answered in time (open, impact low): no item depends on it.
Answer them in docs/design/quality-chain-requests.md, hand the document to quality-chain stage 4, and re-run that stage.

### Next
Hand the request document to the quality chain when you are ready. Invoke design-chain again afterwards, or after any correction: it continues from here.
```

When the chain stops early, the first line says why, with what shows it:

```markdown
## Design chain: stopped; DEC-02 went back and forth

DEC-02 `chosen` changed to "One provider, retries with back-off" in 51c7e88 (stage 2, accepting FND-14 from the review of stage 2) and back to "Fail over to a second provider" in 8d20a4b (stage 2, accepting FND-17 from the next review). Tell design-chain which one holds: it writes your decision as an answered question in the report of stage 2, which applies it when the chain continues.
```
