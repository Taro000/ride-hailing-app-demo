# Review report template and worked example

## Contents
- Report template (`docs/design/reviews/<date>-<stage>.md`)
- Worked example: review of the online store's high-level design
- Example items

Write the report in the working language. Translate the headings. Keep the IDs as they are, and write the basis marks, severities and statuses with the glossary's terms for the working language. Name the file after the date and the stage: `2026-11-10-architecture.md`, `2026-11-10-high-level-design.md`, `2026-11-12-detailed-design-ELM-02.md`.

## Report template

```markdown
# Review: <stage> <component, for stage 4> of <system name>

Updated: <date> · Context: fresh | the conversation that wrote the design (weaker) · Items reviewed: <IDs and versions>

## Summary
<The number of findings by severity and by addressed skill; the most serious ones in a sentence each; the main risks.>

## Inputs
| Source | What it gave |
|---|---|

## Activities
| # | Activity | What was done | Result | Findings |
|---|---|---|---|---|
<Every activity in review-procedures.md for the stage, in order, including those that found nothing.>

## Walkthroughs
<Stage 2 only.>
| DRV | Risks | Non-risks | Sensitive points | Trade-offs |
|---|---|---|---|---|

## Four questions
<Stage 2 only: fit for its use; robust over its life and its changes; buildable and worth its cost; clear to its builders, users and maintainers.>

## Findings
| FND | Severity | Addressed to | Items | Finding | Evidence |
|---|---|---|---|---|---|
<Ordered by severity. Findings raised in earlier reviews and rejected with a reason are not repeated; cite them under the table.>

## Issues for the quality chain
| # | Issue | Chain items | Suggested change | Quality-chain stage |
|---|---|---|---|---|

## Questions and answers
| # | Question | Drafted answer | Answer | What changed |
|---|---|---|---|---|
<Facts the review needed and could not find in the artifacts.>

## Next
<Re-run each addressed skill to accept or reject its findings; review again if critical findings changed the design.>
```

## Worked example: review of the online store's high-level design

Activities (excerpt):

| # | Activity | What was done | Result | Findings |
|---|---|---|---|---|
| B1 | Trace acceptance criteria | Traced the 14 criteria of FR-01 to FR-05 through IFC-01 to IFC-05 and the flows | 13 traced; FR-05's second criterion (a sold-out item is shown as unavailable in the open cart) has no interface that carries stock to the cart | FND-02 |
| B2 | Recompute latency budgets | A script added NFR-01's three serial hops at the 99.67th percentile (1.30 s, plus a 0.20 s margin), and counted the failover path: at most 3,000 slow checkouts per provider outage at peak | The normal path fits; the failover path uses 3.6% of the error budget per outage, a non-risk while outages stay rare | none |
| B3 | Check error contracts | Followed every error case of IFC-01 and IFC-02, and what each caller does | When provider A times out, the flow charges provider B at once, while A's outcome is still unknown; A's key does not cover B | FND-01 |
| B6 | Check data entities | Checked the writers and readers of DAT-01 to DAT-06 | One writer each; ELM-02 reads DAT-04 directly under a recorded read-only decision (DEC-11); reservations are a separate entity (DAT-06) | none |
| B7 | Check measurement points | Matched SLI-02's counting rules with IFC-01's load balancer log fields | All fields present | none |

Findings:

| FND | Severity | Addressed to | Items | Finding | Evidence |
|---|---|---|---|---|---|
| FND-01 | critical | architecture-to-high-level-design | IFC-02 | Failover after a timeout can charge the buyer twice | Activity B3: the flow charges B as soon as A times out; A may still complete its charge, and A's key does not cover B (DRV-05) |
| FND-02 | major | architecture-to-high-level-design | IFC-05 | The open cart never learns that an item sold out | FR-05's second criterion; no IFC from ELM-02 to ELM-01 carries availability after the cart is loaded |

## Example items

`docs/design/fnd/FND-02.yaml`:

```yaml
id: FND-02
title: The open cart never learns that an item sold out
status: open
version: 1
basis: inferred
basis_note: null
needs_agreement: false
approver_candidates: []
raised_by: design-review
raised_in: reviews/2026-11-10-high-level-design.md
to: architecture-to-high-level-design
targets: [IFC-05]
severity: major
evidence: FR-05's second criterion says a sold-out item is shown as unavailable in the cart; IFC-05 (the cart screen) loads availability once, when the cart opens, and no other IFC updates it
suggestion: Return availability with every cart read (a cart IFC operation), and recheck it when the buyer starts checkout
resolution: null
changelog:
  - {version: 1, date: 2026-11-10, change: Raised, reason: "Review of stage 3, activity B1"}
```
