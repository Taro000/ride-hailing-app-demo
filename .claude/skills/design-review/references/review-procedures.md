# Review procedures

## Contents
- Rules for every review
- Stage 2: architecture
- Stage 3: high-level design
- Stage 4: detailed design
- Risks, non-risks, sensitive points and trade-offs

## Rules for every review

- Work from the artifacts. What is not written down does not exist; when it matters, that is a finding.
- Every activity has a result: what you computed, traced or walked, and what it showed. Record the activities that found nothing too.
- Quote the evidence with IDs and numbers. Compute with a script when there is arithmetic.
- Address each finding to the skill that owns its cause, and give it a severity as `artifacts.md` defines.
- Check the stage against its own exit criteria as well; an unmet exit criterion is a finding.

## Stage 2: architecture

| # | Activity | Result to record |
|---|---|---|
| A1 | Walk each primary driver's scenario through the design: where the stimulus enters, which elements and decisions shape the response, whether the response can meet the measure | Per driver: risks, non-risks, sensitive points, trade-offs |
| A2 | Walk each CUJ, step by step, through the elements and their interactions | Per step: the elements, the interactions, any gap |
| A3 | Answer four questions, with evidence: Is the design fit for its use (the CUJs and the drivers)? Will it hold up over its life and its planned changes (the change scenarios, the debts)? Can this team build and run it by the deadline and within the budget, and is it worth its cost? Is it clear to those who will build, use and maintain it? | One short paragraph each |
| A4 | Check every decision: real options, a rationale tied to drivers, rejected options with reasons, gains and costs, constraints respected | The decisions that fall short, and how |
| A5 | Check the views against the consistency rules of stage 2 | Each rule: holds, or where it fails |
| A6 | Check the allocation: every FR to a component, every driver to elements, every component to a team when teams are given | Gaps |
| A7 | Check the threat model: every flow that crosses a trust boundary, walked for the six kinds of threat | Flows or threats not covered |
| A8 | Check the eight design concerns: each settled by a decision, or set aside with a reason that holds | Concerns with a weak reason |
| A9 | Check debts and deferrals: each has its condition to repay or revisit, and is listed under "Needs agreement" | Missing conditions |
| A10 | Check the fit with the teams: components that most change scenarios make two teams change together | The pairs found |

## Stage 3: high-level design

| # | Activity | Result to record |
|---|---|---|
| B1 | Trace every acceptance criterion of every allocated FR through the IFCs and flows | The criteria that cannot be traced |
| B2 | Recompute every latency budget with a script: the normal path with each serial hop at its share of the SLO's tail; each failure path's duration and the number of valid events that take it, against the error budget volume | The normal path's sum against the threshold; each failure path's share of the error budget |
| B3 | Check every IFC's error contract: every case has a signal and says what the caller does; retries only on idempotent operations; a timeout on a call that changes something is an unknown outcome, settled with the same party before any other is tried; "nothing happened" is said only when every party asked has confirmed it | Gaps; unsafe retries; unknown outcomes reported as failures |
| B4 | Check every timeout: above its dependency's slowest healthy response, within the caller's remaining time, and below the caller's own timeout with settlement included; no SLO threshold used as a timeout | Timeouts that cut healthy calls; callers that give up on running work |
| B5 | Check every event IFC: delivery guarantee, duplicate handling, ordering key, versioning | Gaps |
| B6 | Check every DAT: one writer; every reader goes through the owner's interface, a copy fed by the owner's events, or a recorded read-only decision; a consistency rule, a retention period, a classification | Second writers; unrecorded readers; missing rules |
| B7 | Check the measurement points: every SLI has the IFC or event that produces it, with the fields its counting rules need | SLIs without a source |
| B8 | Check that every IFC and every spec follows the shared conventions | Deviations |
| B9 | Check every state diagram across elements: every state has a way out; timeouts and cancellations are present; no state that money, goods or a booking can still leave is final | Dead ends; final states that hide an unknown outcome |
| B10 | Compare the specs with the IFC items: same operations, errors and schemas | Mismatches |

## Stage 4: detailed design

| # | Activity | Result to record |
|---|---|---|
| C1 | Check the allocation: every acceptance criterion and every IFC operation of the component goes to a module | Gaps; operations with two modules |
| C2 | Check every module: one responsibility, contracts with errors, behaviour, data structures, a verification approach | Missing parts |
| C3 | Check every state diagram: every event defined in every state; a final state or a named wait reachable from each state; every timeout on a call that changes something leads to a state that settles it | Undefined events; dead ends; timeouts that skip settlement |
| C4 | Check every decision table: count the combinations; every one covered once | Missing or overlapping rows |
| C5 | Check the module dependencies: no cycles, direction toward stable modules, a CI rule written down | Cycles; inversions |
| C6 | Check concurrency and idempotency: shared state; what must be atomic; money movement that stays idempotent with a duplicate arriving while the first request runs, with a key reused for a different request, and with failover after an unknown outcome | Races; double effects |
| C7 | Check the data: every query has its index; constraints match the contracts; migrations keep the running version working | Missing indexes; mismatches |
| C8 | Check that the design parameters fit the stage 3 budgets and timeouts | Overruns |
| C9 | Check verifiability: every criterion and contract has a verification approach | Items that cannot be verified |
| C10 | Check the component against the shared conventions: errors, IDs, time, money, logs | Deviations |

## Risks, non-risks, sensitive points and trade-offs

- A risk is a decision, or a missing one, that may keep a driver's response from meeting its measure.
- A non-risk is a decision that was checked and holds, with the reason. Recording non-risks shows what was checked.
- A sensitive point is a property the response depends on strongly: a threshold, a timeout, a number of instances.
- A trade-off is a property that helps one driver and hurts another.

Every risk becomes a finding. A sensitive point with no design parameter written for it, and a trade-off recorded on only one of its drivers, are findings too: minor, unless they hide a risk.
