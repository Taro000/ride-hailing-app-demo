---
name: design-review
description: Reviews the output of stage 2, 2b, 3 or 4 of the design chain in a fresh context and writes findings addressed to the stage that must decide. Every check is an activity with a recorded result - walking drivers and CUJs through the design for risks, sensitive points and trade-offs; judging whether it fits its use, survives planned changes, can be built for its cost and is clear; checking views, allocations, decisions and platforms; checking stacks, repositories against the deployment, dependency rules, gate bindings and spec rules; tracing acceptance criteria, recomputing latency budgets, checking data ownership, error contracts, unknown outcomes and SLI bindings; checking module depths, states, decision tables and verifiability; and, at every stage, premises, assumptions that should have been asked, and points left for the design to confirm. Never edits the design. Use it after any design stage, or when asked to review or evaluate an architecture, a technical policy, a high-level design or a detailed design.
license: MIT
metadata:
  version: "0.3.0"
---

# Design review

The review of the design chain. It checks the output of one design stage and writes findings (FND) addressed to the stage that must decide. It never fixes anything itself: the stage that wrote an item is the only one that changes it.

Whoever wrote a design tends to confirm it. The review therefore runs apart from the design, in a context with no memory of how the design was made. It reads only the artifacts, as a newcomer would. What is not written down does not exist for it, and when that matters, the missing piece is itself a finding.

Every check is an activity with a result: add up the budget, trace the criterion, walk the scenario. "Looks fine" is not a result. The report records what was done, so that a reader can tell a checked area from an unchecked one.

The first review of a stage checks all of it. Each later review is a diff review: it checks only what changed since the last review, and what the change can break. A fresh reading of a large design always finds something new, so reviews that read everything again never run out of findings; what has not changed was covered by the last review.

## Read first

- `references/conventions.md`: the design chain, findings, the working language, judgment basis marks, the question protocol, assumptions and how a run finishes. Follow it exactly.
- `references/artifacts.md`: where files go, the schemas for FND, DAS and QCR, and the items under review.
- `references/review-procedures.md`: the activities for each stage (2, 2b, 3 and 4) and for every stage, the scope of a diff review, and how to classify what they find.
- `references/report-template.md`: the report layout, and worked examples of a full review and a diff review.
- `references/glossary.md`: terms for the working language.
- `scripts/tables.py` and `scripts/check.py`: write the report's index tables from the items, and check the items, specs and reports for what needs no judgment. Run them before committing ("Scripts" and "Finishing a run" in `references/conventions.md`).

## Run it in a fresh context

- In Claude Code, run it in a new session, or as a subagent that receives only the stage to review and the paths of the artifacts.
- In other agents, run it in a new session.
- If this conversation is the one that wrote the design and a fresh context is not possible, say so at the top of the report. The review is then weaker, and the user should know it.

## Inputs

- The stage to review: 2 (architecture), 2b (technical policy), 3 (high-level design), or 4 (the detailed design of one component, named by its element ID). If the user does not say, ask.
- The stage's report and items, and what they were built from: the items of the earlier design stages, `design-context.yaml`, the assumptions in `das/`, the hand-offs in `hnd/`, the requests to the quality chain in `qcr/`, and the quality chain's artifacts (read only), with its shared facts and its assumptions (QAS).
- The findings in `fnd/`, whatever their status, those of earlier reviews included, so that a finding rejected with a reason is not raised again unless its inputs changed.
- The review report of the same stage (for stage 4, of the same component), if there is one. This review replaces it: it keeps the answers still in effect and continues the question numbering, and takes over the open gaps. The requests to the quality chain that earlier reviews raised are QCR items, and stay as they are. Its other results are not inputs. Whether the report exists, and whether it waits for answers, decides the kind of review:
  - None: this is the first review of the stage, a full review. Do every activity for the whole stage.
  - One: this is a diff review. Its scope is what changed since the last review's commit, and the items connected to a change through `premises`, trace fields or `depends_on` ("Rules for every review" in `review-procedures.md`). Do each activity for its part of that scope, and record an activity with nothing in it as "No change in scope".
  - One whose status is "waiting for answers": this run resumes that review instead of starting a new one. It keeps the kind of review that the report's header names, with the last review's commit for a diff review, applies the answers written under "Unanswered questions" to the activities that waited for them, and does the activities for what changed since the commit that left the questions, as a diff review would.
  - Do a full review instead when the user asks for one, or when the last review's commit cannot be found (the project is not under git, or this skill never committed the report).

Essential input: the report and items of the stage under review. A stage whose report is still a draft can be reviewed, but say so. A stage whose report waits for answers is reviewed once it has applied them ("Stale stages" in `conventions.md`).

## Workflow

### 1. Scope

Name the stage (and the component, for stage 4); whether this is a full review or a diff review, and for a diff review the last review's commit; the items in scope, found for a diff review as "Rules for every review" in `review-procedures.md` describes; and the commit they were read at (`Inputs as of`: the commit current when the review starts, or "none" outside git). When a diff review finds that nothing has changed since the last review, say so and stop: the last report still holds. A review that resumes one waiting for answers never stops here: it applies the answers ("Inputs"). The report has one fixed path per reviewed stage and replaces the report already there: `docs/design/reviews/2-architecture.md`, `2b-technical-policy.md`, `3-high-level-design.md`, or `4-detailed-design-<element ID>.md`.

### 2. Do the activities

Run `scripts/check.py` first, without `--skill`. What it checks is not the review's to raise ("Rules for every review" in `review-procedures.md`). Then do every activity that `review-procedures.md` lists for the stage and for every stage, working from the artifacts only, and record the result of each one, including the ones that find nothing. In a diff review, do each activity for what its "In a diff review" column names, and record an activity with nothing there as "No change in scope".

### 3. Classify

For a review of stage 2, sort what the walkthroughs showed into risks, non-risks, sensitive points and trade-offs ("Risks, non-risks, sensitive points and trade-offs" in `review-procedures.md`). For every stage, decide which results are findings.

### 4. Draft the findings and the report

Write one finding per problem as an FND item, as you draft it, following `artifacts.md`: the skill it is addressed to, the items it concerns, the severity, the evidence (what the activity showed, with IDs and numbers) and a suggested resolution. Address each finding to the skill that owns the cause, which may be earlier than the stage reviewed: a high-level design problem caused by an architecture decision goes to `architecture-drivers-to-architecture`. A problem in the quality chain is a request to the quality chain instead (`conventions.md`, "Requests to the quality chain"), with `stage` set to the review of the stage under review (`review-2`, `review-2b`, `review-3` or `review-4`); a design item that decides or changes what the quality chain owns is a finding (E8 in `review-procedures.md`). Do not raise again a finding that was rejected with a reason, unless its inputs have changed, and do not write a second finding for a problem that an open one already covers; cite it. In a diff review, raise no new finding about what has not changed ("Rules for every review" in `review-procedures.md`). Write the draft review report that records the results and indexes the findings, following `report-template.md`.

### 5. Questions

Some activities need facts that the artifacts do not give, such as a provider's SLA or a team's experience. Rate each such point as `conventions.md` describes ("Draft first, ask afterwards"): ask the user when its breadth or severity is high; otherwise write a DAS with `stage` set to the review of the stage under review (`review-2`, `review-2b`, `review-3` or `review-4`), keep the drafted judgment, and cite the DAS in the activity's result and in the `premises` of the findings that rest on it. Record a question about an existing assumption as "Assumptions" in `conventions.md` describes. Ask also about each request this review raises whose impact is high, and record the answer in the request; the stages whose items depend on it follow the answer when they run. Number the questions per review report, continuing from earlier reviews at the same path, and cite them as "review of stage 3, question 2" or "review of stage 4 ELM-02, question 1".

A judgment about the design is never a question for the user: it is a finding, which the addressed stage accepts or rejects.

Apply the answers to the results, and to the FND, DAS and QCR items in place.

When nobody can answer during the run, write the questions under "Unanswered questions" instead, set the report's status to "waiting for answers", and finish the run, as "Draft first, ask afterwards", step 7, in `conventions.md` describes. Write no finding that rests on a question still waiting; the run that applies the answer writes it if the answer bears it out.

### 6. Answers applied

Check the exit criteria, make the report match the items, and set the report's status to "answers applied".

## Exit criteria

- Every activity listed for the stage and for every stage was done, and its result is recorded, including those with no finding. In a diff review, each was done for what its "In a diff review" column names, or is recorded as "No change in scope".
- Every primary driver and every CUJ in scope was walked through; in a diff review, those that the A1 and A2 columns name.
- In a diff review, no new finding is about what has not changed: each one concerns a changed item, or what a change breaks in another item, and then its evidence names that change.
- Every finding names the skill it is addressed to, the items, the severity, the evidence and a suggested resolution, and lists in `premises` the open assumptions it rests on.
- Every fact the review needed and could not find was asked about, or is a DAS.
- No design item was changed, except for what `conventions.md` lets any run record in an assumption or a request to the quality chain (ratings, answers and statuses).
- No finding is about what `scripts/check.py` checks, and "Open gaps" names the stages that still have its problems in the items in scope.
- Every problem found in the quality chain is a request to the quality chain, not a finding, and each request of high impact that this review raised was asked.
- `scripts/check.py --skill design-review` reports no problem in the review's files.
- The report says whether the review ran in a fresh context and whether it was a full review or a diff review (with the last review's commit), and names the commit its inputs were read at.

## Pitfalls

- Reviewing in the conversation that wrote the design, without saying so.
- Ticking a checklist instead of doing the work. A budget is checked by adding it up.
- Counting a detail that the stage handed off as missing. The stage it is handed to decides it when its trigger comes; a finding about it now starts a run that decides nothing.
- Fixing the design during the review. The stage that owns an item decides; the review's job is evidence.
- Findings without evidence ("seems risky"). The addressed stage cannot accept or reject what it cannot check.
- Letting minor findings bury critical ones. Order the findings by severity, and keep the minor ones short.
- Addressing a finding to the stage under review when the cause lies in an earlier stage.
- Asking the user to judge the design. Questions are for facts the review needs; a judgment is a finding.
- Raising again a finding that was rejected with a reason when nothing it rests on has changed. The stage has decided; repeating it adds noise, not evidence.
- In a diff review, reading again the items that no change reaches, or raising a new finding about a problem that no change caused. The last review covered them; a fresh look at the same text always finds something, and the findings then never decrease.
- Restating the findings in the report. The report indexes them; the evidence lives in the FND files, where the addressed stage reads it.

## Finish

Finish the run as `conventions.md` describes ("Finishing a run"): the open assumptions to skim, what to run next, `scripts/tables.py` and `scripts/check.py` with `--skill design-review` for the review's own files, and a commit of the files this review wrote (the report, the findings, the assumptions and the requests to the quality chain it wrote, re-rated or answered, and `quality-chain-requests.md`). Also tell the user the stage reviewed, whether the context was fresh, whether it was a full review or a diff review, the number of findings by severity and by addressed skill, the main risks and trade-offs, and the requests to the quality chain it raised or answered. The next steps follow "Findings between design stages" in `conventions.md`: re-run each stage that a critical or major finding is addressed to, to accept or reject it. A stage whose items then change for one is reviewed again, as a diff review: the stage that accepted it, and the stage reviewed here once it has followed a change made upstream for a finding this review raised. Do not name a stage to run for minor findings alone; say how many minor findings wait for the next run of the stage they are addressed to. When questions wait for answers, name them, and say that this review runs again once they are answered and that the stages below the stage it reviews wait until then ("Stale stages" in `conventions.md`).
