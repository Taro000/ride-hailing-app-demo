# Review report template and worked example

## Contents
- Report template (`docs/design/reviews/<stage>.md`)
- Worked example: review of the online store's high-level design
- Example items
- Worked example: the next review of the same stage, a diff review

Write the report in the working language. Translate the headings. Keep the IDs as they are, and write the basis marks, severities and statuses with the glossary's terms for the working language.

Each reviewed stage has one report at a fixed path, and the next review of the same stage replaces it: `reviews/2-architecture.md`, `reviews/2b-technical-policy.md`, `reviews/3-high-level-design.md`, and one per component for stage 4, such as `reviews/4-detailed-design-ELM-02.md`. The report describes the latest review only, full or diff. Earlier reviews are in git, and their findings keep their own status in `fnd/`. A diff review records only what it did; its header names the last review's commit, where the earlier report can be read.

The report holds what only the review records: the activities and their results, and for stage 2 the risks, non-risks, sensitive points and trade-offs. It indexes the findings and assumptions, and never restates their evidence or statements: those live in the FND and DAS files.

`scripts/tables.py` writes the findings and the open assumptions between `<!-- generated: <name> -->` and `<!-- /generated -->` from the items ("Scripts" in `conventions.md`). Do not edit them by hand, except the breadth and severity of a quality-chain assumption, which the review writes as activity E3 rates it (the script starts them from the QAS's own). Every other table is written by hand.

## Report template

```markdown
# Design review: <stage, with the component for stage 4> of <system name>

Status: draft | waiting for answers | answers applied · Updated: <date> · Inputs as of: <commit, or "none"> · Review: full | diff since <the last review's commit> · Context: fresh | the conversation that wrote the design (weaker) · Items reviewed: <IDs; in a diff review, the items its activities covered>

## Summary
<The number of findings by severity and by addressed skill; the most serious ones in a sentence each; the main risks.>

## Activities and results
| # | Activity | What was done | Result | Findings |
|---|---|---|---|---|
<Every activity in review-procedures.md for the stage, then those for every stage, in order, including those that found nothing. In a diff review, "What was done" says what the activity covered, from its "In a diff review" column; an activity with nothing there reads "No change in scope", and its other cells stay empty. A result too long for its row (stage 2's four questions, stage 3's recomputed budgets with the script's output) goes in a subsection under the table, headed with the activity's number and name.>

## Risks, non-risks, sensitive points and trade-offs
<Stage 2 only: what the driver walkthroughs showed; in a diff review, for the drivers walked in it.>
| DRV | Risks | Non-risks | Sensitive points | Trade-offs |
|---|---|---|---|---|

## Findings
<!-- generated: findings -->
| FND | Title | Severity | To | Targets |
|---|---|---|---|---|
<!-- /generated -->
<The open findings raised at this report's path, by this review and by earlier ones, ordered by severity. Under the table, by hand, cite in one line the rejected findings not raised again.>

## Unanswered questions
| # | Question | Why unsure | Options | Items | Answer |
|---|---|---|---|---|---|
<Only while rows wait: the questions about facts the review needed and could not ask because nobody could answer during the run, in the order it would ask them, and the corrections to assumptions that the user gave after such a run ("Draft first, ask afterwards", step 7, and "Finishing a run", step 1, in conventions.md). #: the number the row keeps under "Decisions". Items: the items, findings and activities the answer bears on. Answer: what the user answered, written by the user or by the agent that started the run; empty until then. A question about a request to the quality chain names the request among its items, and its answer may be written under the request in `quality-chain-requests.md` instead. The next run moves each answered row to "Decisions".>

## Decisions
| # | Question | Answer | Items |
|---|---|---|---|
<The questions about facts the review needed, and their answers: those of this review, and those of earlier reviews at this path that are still in effect. Items: the items, findings and activities the answer bears on.>

## Open assumptions
<!-- generated: assumptions -->
| ID | Title | Kind | Breadth | Severity | Items that depend on it |
|---|---|---|---|---|---|
<!-- /generated -->
<The open DAS this review wrote, and the open DAS and QAS that the items of the reviewed stage or the findings raised here depend on, highest first, with their ratings after activity E3.>

## Open gaps
<What the review could not check, and why: an input that is missing, a stage report still in draft. The stages that still have problems that `scripts/check.py` reports in the items in scope, with their number. A diff review lists again the gaps of the last review that it still cannot check, and notes in one line any problem that looks critical in what has not changed, for the user to decide on a full review.>
```

## Worked example: review of the online store's high-level design

`docs/design/reviews/3-high-level-design.md`, the first review of stage 3, with this header:

Status: answers applied · Updated: 2026-11-10 · Inputs as of: 4f2c9e1 · Review: full · Context: fresh · Items reviewed: IFC-01 to IFC-06, DAT-01 to DAT-06, DEC-13 and DEC-15, HND-04 and HND-05

Activities (excerpt):

| # | Activity | What was done | Result | Findings |
|---|---|---|---|---|
| B1 | Trace acceptance criteria | Traced the 14 criteria of FR-01 to FR-05 through IFC-01 to IFC-06 and the flows | 13 traced; FR-05's second criterion (a sold-out item is shown as unavailable in the open cart) has no interface that carries stock to the cart | FND-02 |
| B2 | Recompute latency budgets | A script added NFR-02's three serial hops inside the load balancer, where SLI-02's binding observes checkouts, each at the 99.67th percentile (1.30 s, plus a 0.20 s margin), and counted the failover path: at most 3,000 slow checkouts per provider outage at peak | The normal path fits; the failover path uses 3.6% of the error budget per outage, which holds while outages stay rare | none |
| B3 | Check error contracts | Followed every error case of IFC-01 and IFC-02, and what each caller does | When provider A times out, the flow charges provider B at once, while A's outcome is still unknown; A's key does not cover B | FND-01 |
| B6 | Check data entities | Checked the writers and readers of DAT-01 to DAT-06 | One writer each; ELM-02 reads DAT-04 directly under a recorded read-only decision (DEC-13); reservations are a separate entity (DAT-06) | none |
| B7 | Check SLI bindings | Compared SLI-02's unit event (one checkout submitted), vantage (system boundary) and counting rules with the binding on IFC-01 | The vantage holds: the load balancer is the system boundary. The binding counts requests, though, and none of its fields ties a resubmitted checkout to the first, so a checkout submitted again counts twice, against SLI-02's counting rule. SLI-02's counting rules also do not say how a checkout that IFC-01 answers with PAYMENT_PENDING counts, which no binding can settle: QCR-05 asks the quality chain | FND-03 |
| B10 | Compare specs with IFCs | Checked each HTTP and event IFC against the entry of POL-05 that covers its kind | IFC-01 and IFC-06 are of the first entry, whose specs are generated from ELM-02's code: neither has a spec, and HND-04 hands their schemas to implementation, which is not a gap. IFC-02 and IFC-03 link their owners' documents, as the second entry says. No IFC is of the entry written by hand, and `ifc/specs/` is empty | none |
| E3 | Re-rate open assumptions | Counted the items whose `premises` name each open DAS and QAS | DAS-06 keeps its ratings (medium, low): IFC-01 and IFC-02 depend on it. DAS-07 keeps its ratings (low, low): only DEC-13 depends on it. None is high, so none was asked. DAS-01, which IFC-03 rests on, is confirmed (stage 2, question 3) and is not open | none |
| E5 | Look for copied statements | Read IFC-01 to IFC-06 and DAT-01 to DAT-06 for quality-chain wording | None; IFC-01's timing names NFR-02's 1.5 s next to its ID, a label rather than a copy | none |
| E7 | Check hand-offs | Read HND-04 and HND-05, which stage 3 wrote, against the full-depth kinds of stage 3 | Each names its stage, its component and its trigger, and its bounds and origin exist. Neither hands off a point of stage 3's full-depth kinds: POL-05 generates the specs of IFC-01 and IFC-06 from the code, and IFC-06's calls are on no path of a time SLO and move no money | none |
| E8 | Look for gates and thresholds in the design | Read IFC-01 to IFC-06, DAT-01 to DAT-06, DEC-13, DEC-15 and the latency budgets for checks before release and levels the system must reach | None; NFR-02's budget splits its threshold, and the load test before the sale that the budget calls for is QCR-04, a request of stage 3 | none |

Findings:

| FND | Title | Severity | To | Targets |
|---|---|---|---|---|
| FND-01 | Failover after a timeout can charge the buyer twice | critical | architecture-to-high-level-design | IFC-02 |
| FND-02 | The open cart never learns that an item sold out | major | architecture-to-high-level-design | IFC-05 |
| FND-03 | SLI-02's binding counts a resubmitted checkout twice | major | architecture-to-high-level-design | IFC-01 |

Open assumptions (excerpt):

| ID | Title | Kind | Breadth | Severity | Items that depend on it |
|---|---|---|---|---|---|
| DAS-06 | Timeouts on the payment path adopted provisionally | decision | medium | low | IFC-01, IFC-02 |
| DAS-07 | Stock cache lifetime adopted provisionally | decision | low | low | DEC-13 |

## Example items

Every finding the review raises sets `raised_in` to the report's path, which stays the same from one review of the stage to the next.

`docs/design/fnd/FND-02.yaml`:

```yaml
id: FND-02
title: The open cart never learns that an item sold out
status: open
basis: inferred
basis_note: null
premises: []
raised_by: design-review
raised_in: reviews/3-high-level-design.md
to: architecture-to-high-level-design
targets: [IFC-05]
severity: major
evidence: FR-05's second criterion says a sold-out item is shown as unavailable in the cart; IFC-05 (the cart screen) loads availability once, when the cart opens, and no other IFC updates it
suggestion: Return availability with every cart read (a cart IFC operation), and recheck it when the buyer starts checkout
resolution: null
```

## Worked example: the next review of the same stage, a diff review

The review above was committed as 7e2d5a8. Stage 3 then accepted FND-01 to FND-03: it changed IFC-01, IFC-02 and IFC-05, added IFC-07 (the cart API, which the cart page calls from the buyer's browser and which returns availability with every cart read) and named it in HND-04, since POL-05 generates its spec from the code, and redrew the failure paths of the checkout flow. Its items changed to accept critical and major findings, so the stage was reviewed again, and the report at the same path now has this header:

Status: answers applied · Updated: 2026-11-12 · Inputs as of: 9c41b07 · Review: diff since 7e2d5a8 · Context: fresh · Items reviewed: IFC-01, IFC-02, IFC-05 and IFC-07, HND-04, DAT-04 and DAT-06, the checkout flow and the cart screen flow

Activities (excerpt):

| # | Activity | What was done | Result | Findings |
|---|---|---|---|---|
| B1 | Trace acceptance criteria | Traced the criteria of FR-01, FR-04 and FR-05, the FRs that the changed IFCs serve | All traced; FR-05's second criterion goes through IFC-07's cart read | none |
| B2 | Recompute latency budgets | Ran the budget script again for NFR-02, with the failover path that settles A's charge before B is tried | The normal path fits; the failover path makes at most 3,000 checkouts slow per provider outage, 3.6% of the error budget | none |
| B3 | Check error contracts | Followed every error case of IFC-01, IFC-02, IFC-05 and IFC-07, and what each caller does, through the failure paths of the checkout flow | A timeout at A is an unknown outcome, settled at A before B is tried; while it is unsettled, IFC-01 answers that the payment is being confirmed | none |
| B4 | Check timeouts | Checked the timeouts on every call path through IFC-01, IFC-02 and IFC-07 | The payment path's worst case, 10.3 s, is below IFC-01's 15 s timeout; the cart read path holds too | none |
| B5 | Check event IFCs | No change in scope | | |
| B6 | Check data entities | Checked DAT-04 and DAT-06, which IFC-07's cart read uses | DAT-04 keeps one writer, ELM-03, and ELM-02 reads it under the read-only decision DEC-13; DAT-06 is ELM-02's own | none |
| B8 | Check shared conventions | Checked IFC-01, IFC-02, IFC-05 and IFC-07 against the shared conventions | All followed, except one error code that IFC-07 writes in camel case | FND-04 |
| B10 | Compare specs with IFCs | Checked IFC-07 against the entry of POL-05 that covers its kind, and HND-04, which changed with it | IFC-07 is of the first entry, as IFC-01 is: no spec, and HND-04 now names IFC-07 in its origin and bounds | none |
| E1 | Read findings | Read FND-01 to FND-03, which stage 3 accepted, and the items they changed | Each change is in the items, cited in their `basis_note` | none |
| E6 | Check points to confirm | No change in scope | | |
| E7 | Check hand-offs | Read HND-04, which stage 3 changed | It still hands off no point of stage 3's full-depth kinds: the interfaces it names, IFC-01, IFC-06 and IFC-07, are all of POL-05's first entry, whose specs are generated from the code | none |

Findings:

| FND | Title | Severity | To | Targets |
|---|---|---|---|---|
| FND-04 | An error code of IFC-07 does not follow the error convention's case | minor | architecture-to-high-level-design | IFC-07 |

B5 and E6 had nothing in scope: no event IFC is in scope, and no point to confirm is new or changed. No finding was raised about IFC-03 or the other items that did not change. FND-04 is minor, so it starts no run: stage 3 processes it the next time it runs for another reason, and no review follows from it.
