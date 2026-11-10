---
name: design-review
description: Reviews the output of stage 2, 3 or 4 of the design chain (architecture-drivers-to-architecture, architecture-to-high-level-design, high-level-design-to-detailed-design) in a fresh context, apart from the one that wrote the design, and writes findings addressed to the stage that must decide. Every check is an activity with a recorded result - walking drivers and CUJs through the design to find risks, sensitive points and trade-offs; judging whether the design fits its use, survives its planned changes, can be built for its cost and is clear; checking views, allocations and decisions; tracing acceptance criteria, recomputing latency budgets, checking data ownership, error contracts and unknown outcomes; checking modules for complete states, decision tables and verifiability. Never edits the design. Use it after any design stage, or when someone asks to review or evaluate an architecture, a high-level design or a detailed design.
license: MIT
metadata:
  version: "0.1.0"
---

# Design review

The review of the design chain. It checks the output of one design stage and writes findings (FND) addressed to the stage that must decide. It never fixes anything itself: the stage that wrote an item is the only one that changes it.

Whoever wrote a design tends to confirm it. The review therefore runs apart from the design, in a context with no memory of how the design was made. It reads only the artifacts, as a newcomer would. What is not written down does not exist for it, and when that matters, the missing piece is itself a finding.

Every check is an activity with a result: add up the budget, trace the criterion, walk the scenario. "Looks fine" is not a result. The report records what was done, so that a reader can tell a checked area from an unchecked one.

## Read first

- `references/conventions.md`: the design chain, findings, the working language, judgment basis marks and the question protocol. Follow it exactly.
- `references/artifacts.md`: where files go, the schema for FND, and the items under review.
- `references/review-procedures.md`: the activities for each stage, and how to classify what they find.
- `references/report-template.md`: the report layout and a worked example.
- `references/glossary.md`: terms for the working language.

## Run it in a fresh context

- In Claude Code, run it in a new session, or as a subagent that receives only the stage to review and the paths of the artifacts.
- In other agents, run it in a new session.
- If this conversation is the one that wrote the design and a fresh context is not possible, say so at the top of the report. The review is then weaker, and the user should know it.

## Inputs

- The stage to review: 2 (architecture), 3 (high-level design), or 4 (the detailed design of one component, named by its element ID). If the user does not say, ask.
- The stage's report and items, and what they were built from: the items of the earlier design stages, `design-context.yaml`, and the quality chain's artifacts (read only).
- Earlier reviews of the same stage and their findings, so that a finding rejected with a reason is not raised again unless its inputs changed.

Essential input: the report and items of the stage under review. A stage whose report is still a draft can be reviewed, but say so.

## Workflow

### 1. Scope

Name the stage (and the component, for stage 4), the items in scope and their versions, and the date.

### 2. Do the activities

Do every activity that `review-procedures.md` lists for the stage, working from the artifacts only, and record the result of each one, including the ones that find nothing.

### 3. Classify

For a review of stage 2, sort what the walkthroughs showed into risks, non-risks, sensitive points and trade-offs ("Risks, non-risks, sensitive points and trade-offs" in `review-procedures.md`). For every stage, decide which results are findings.

### 4. Write the findings

Write one finding per problem, following `artifacts.md`: the skill it is addressed to, the items it concerns, the severity, the evidence (what the activity showed, with IDs and numbers) and a suggested resolution. Address each finding to the skill that owns the cause, which may be earlier than the stage reviewed: a high-level design problem caused by an architecture decision goes to `architecture-drivers-to-architecture`. A problem in the quality chain goes to "Issues for the quality chain" instead. Do not raise again a finding that was rejected with a reason, unless its inputs have changed; cite it.

### 5. Report, questions, items

Write the review report following `report-template.md`. Ask the user about the facts the review needs and cannot find in the artifacts (a provider's SLA, a team's experience), as `conventions.md` describes. A judgment about the design is not a question for the user: it is a finding, which the addressed stage accepts or rejects. Then write the FND items.

## Exit criteria

- Every activity listed for the stage was done, and its result is recorded, including those with no finding.
- Every primary driver and every CUJ in scope was walked through.
- Every finding names the skill it is addressed to, the items, the severity, the evidence and a suggested resolution.
- No design item was changed.
- The report says whether the review ran in a fresh context.

## Pitfalls

- Reviewing in the conversation that wrote the design, without saying so.
- Ticking a checklist instead of doing the work. A budget is checked by adding it up.
- Fixing the design during the review. The stage that owns an item decides; the review's job is evidence.
- Findings without evidence ("seems risky"). The addressed stage cannot accept or reject what it cannot check.
- Letting minor findings bury critical ones. Order the findings by severity, and keep the minor ones short.
- Addressing a finding to the stage under review when the cause lies in an earlier stage.

## Finish

Tell the user the stage reviewed, whether the context was fresh, the number of findings by severity and by addressed skill, the main risks and trade-offs, the issues for the quality chain, and the next steps: re-run each addressed stage to accept or reject its findings, then review again if critical findings changed the design.
