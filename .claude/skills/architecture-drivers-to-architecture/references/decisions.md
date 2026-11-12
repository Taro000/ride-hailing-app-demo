# Design decisions

## Contents
- When to write a decision
- Options
- Comparing options
- Sensitive points and trade-offs
- Business decisions
- Design parameters
- Debt
- Deferral
- Existing systems and transition
- Example

## When to write a decision

A decision answers one question the design must settle ("how does checkout survive a provider outage?"), for named drivers. Write one when:

- a driver needs a response that the design does not produce yet;
- a functional requirement states behaviour that needs a mechanism spanning elements, or a demanding one (failover, idempotency, reconciliation);
- the platforms and device support are not all fixed by a technology constraint (`structures-and-mechanisms.md`, "Platforms and device support");
- a design concern has more than one sensible answer;
- a constraint leaves a choice open (which managed database the platform offers);
- a later stage would otherwise make a choice of stage 2's full-depth kinds silently.

Do not write decisions for what any competent implementation would do the same way. Those go in the "standard practice is enough" lines. Nor write them for what a later stage decides, such as the key or the error codes of one operation, or the value of a timeout ("Deferral"), or for what stage 2b decides for every component: a language beyond what the runtime fixes, a framework or a library, the repositories and the layout of the code, the tests, the pipeline and the conventions inside the code. Decide the runtime and the platform that they must fit, and leave them to stage 2b; it needs no hand-off, since its workflow decides them all.

## Options

Write at least two options that someone could really choose. "Keep what exists" or "do nothing" is a real option when it could meet the driver. When only one option is possible because a constraint forces it, write that option and name the constraint.

For each option, write what it does for the drivers in question (`effect`) and what it costs (`cost`: work, money, complexity, risk). Keep the options comparable: the same drivers, at the same level of detail.

## Comparing options

1. Drop the options that break a non-negotiable constraint, and say which and why.
2. Compare the rest driver by driver, in rank order: does each option meet the driver, meet it in part, or fail it? A short table in the report is enough.
3. Prefer the option that meets the highest-ranked drivers. Use the lower-ranked drivers to choose between options that tie.
4. Do not add up scores across unlike drivers unless the business has set the weights. Adding latency points to cost points hides a choice the business should make.
5. When options tie on every driver, choose the one that is easier to undo, and say so.

Record the chosen option, the rationale (which drivers decided it), each rejected option with the reason it lost, the gains and the costs. Write in `assumptions` what the decision relies on (a provider's promise, a fact about the users' devices). One that you were unsure of and did not ask about is a DAS: list it in `premises` as well. Refer to the quality chain's items and the design context's entries by ID; do not copy their statements into the decision.

## Sensitive points and trade-offs

- A sensitive point is a property of the decision that the response depends on strongly: a timeout, a threshold, a cache lifetime, the number of instances. Name it, so that later stages treat it as a design parameter, and so that the people who run the system know what to tune. Set its value here only as "Design parameters" allows; otherwise hand the value off, so that the stage that sets it knows that the response depends on it.
- A trade-off is a decision that helps one driver and hurts another. Record it on the decision (`trade_offs`) and in both drivers' walkthroughs, with the size of the effect as far as you can judge it ("adds up to 0.2 s to checkout").

## Business decisions

These are business decisions as much as technical ones: a decision that accepts a risk, a cost in money or contracts, a weaker driver or a debt; the deferral of a point of this stage's full-depth kinds, or of one that rates high ("Deferral"); a provisional design parameter that this stage sets ("Design parameters"); and the rejection of a finding that leaves a risk in place. Every decision lists its costs; that alone does not make it a business decision. Rate each one like any uncertain point ("Decisions" in `conventions.md`):

- If either rating is high, ask. The answer is the decision: the judgment becomes `confirmed`, and the question and its answer go under "Decisions" in the report.
- Otherwise, adopt the drafted decision provisionally: write a DAS of kind `decision`, list it in the `premises` of the decision and of every item that depends on it, and mark those items `assumed`.

Never write a provisional decision as if it were decided.

## Design parameters

Timeouts, retry counts, pool sizes, cache lifetimes and partition counts are design decisions too ("Numbers" in `conventions.md`). Set a value here only for a parameter of stage 2's full-depth kinds, one that sizes something paid for or hard to change once built (the capacity in a contract, the number of partitions of stored data), or for one that rates high. Propose the value with its basis (a stated number it derives from, a calculation, the default of a named library or service). A provisional parameter is a business decision ("Business decisions"). These usually rate high, because a contract or the shape of stored data depends on them, so they are asked. A parameter that is part of an option you ask about anyway is answered with it.

Leave every other value to the stage that sets it, within the bounds this stage decides ("Decision depth" in `conventions.md`): timeouts, waits, intervals and thresholds go to stage 3 on the paths of time SLOs and of money, and to stage 4 elsewhere, within such bounds as the order of the timeouts along a call path, or a cache lifetime within the freshness its driver allows. When the response depends on the value, name the parameter as a sensitive point and hand the value off, with the decision in the hand-off's `origin`. Leaving a value is not a business decision: it is neither asked nor recorded as an assumption.

## Debt

When a decision knowingly takes a cheaper option that weakens a driver, to meet the deadline or to save money, record the debt in the decision's `debt`: what is weaker, why it was accepted, and when or on which event it must be repaid. Debt is a business decision. Debt that nobody decided on is a defect that will be found later.

## Deferral

Deferring is the default for what this stage need not decide in full: "Decision depth" and "Hand-offs" in `conventions.md` give the rule for every stage, and the full-depth kinds of stage 2. A point outside those kinds that does not rate high gets its bounds here when several elements or later stages must keep one promise about it, and its detail is left to the stage that decides it, with a hand-off where `conventions.md` asks for one. That is not a business decision, and it is neither asked nor recorded as an assumption. For example, decide here the order of the timeouts along a call path and what idempotency keys cover, and leave to later stages the values of the timeouts and the key of each operation.

Deferring a point of stage 2's full-depth kinds, or one that rates high, is a business decision ("Business decisions"): a vendor chosen only once its contract is signed, or a structure settled only after a pilot. Address its hand-off to this stage, with the event that settles it as the trigger.

## Existing systems and transition

For an existing system, the first option of every decision is to keep what exists, and a change must earn its cost against the drivers. When several elements change, write the order of the changes as decisions, so that the system works after each step. For example: first put the payment adapter in front of the current provider, then add the second provider behind it.

## Example

How does checkout survive a provider outage (DRV-02)?

| Driver (rank) | One provider, retries with back-off | Second provider with failover |
|---|---|---|
| DRV-02 survive an outage (2) | fails: retries cannot help during an outage | meets |
| DRV-09 release date (3) | meets | in part: it cannot be ready before the sale, so it ships right after it |
| DRV-10 add a provider later (10) | in part | meets |
| DRV-07 running cost (11) | meets | in part: a second contract |

DRV-02 ranks above DRV-09, so the second provider wins. The business already chose when it ships (stage 1, question 5): right after the spring sale, and until then an outage of the provider stops checkout. That is not asked again; the decision records it as a debt, repaid right after the sale. The second contract ties the system to another vendor, which is high severity, so it is asked (question 2). The decision records a trade-off with DRV-07, and the error threshold at which checkout fails over as a sensitive point. The threshold's value is not set here: it lies on the paths of NFR-02 and of money, so HND-02 hands it to stage 3, which checks the failover path against NFR-02's error budget.
