# Design decisions

## Contents
- When to write a decision
- Options
- Comparing options
- Sensitive points and trade-offs
- Design parameters
- Debt
- Deferral
- Existing systems and transition
- Example

## When to write a decision

A decision answers one question the design must settle ("how does checkout survive a provider outage?"), for named drivers. Write one when:

- a driver needs a response that the design does not produce yet;
- a design concern has more than one sensible answer;
- a constraint leaves a choice open (which managed database the platform offers);
- a later stage would otherwise make the choice silently.

Do not write decisions for what any competent implementation would do the same way. Those go in the "standard practice is enough" lines.

## Options

Write at least two options that someone could really choose. "Keep what exists" or "do nothing" is a real option when it could meet the driver. When only one option is possible because a constraint forces it, write that option and name the constraint.

For each option, write what it does for the drivers in question (`effect`) and what it costs (`cost`: work, money, complexity, risk). Keep the options comparable: the same drivers, at the same level of detail.

## Comparing options

1. Drop the options that break a non-negotiable constraint, and say which and why.
2. Compare the rest driver by driver, in rank order: does each option meet the driver, meet it in part, or fail it? A short table in the report is enough.
3. Prefer the option that meets the highest-ranked drivers. Use the lower-ranked drivers to choose between options that tie.
4. Do not add up scores across unlike drivers unless the business has agreed to weights. Adding latency points to cost points hides a choice the business should make.
5. When options tie on every driver, choose the one that is easier to undo, and say so.

Record the chosen option, the rationale (which drivers decided it), each rejected option with the reason it lost, the gains and the costs.

## Sensitive points and trade-offs

- A sensitive point is a property of the decision that the response depends on strongly: a timeout, a threshold, a cache lifetime, the number of instances. Name it, so that later stages treat it as a design parameter, and so that the people who run the system know what to tune.
- A trade-off is a decision that helps one driver and hurts another. Record it on the decision (`trade_offs`) and in both drivers' walkthroughs, with the size of the effect as far as you can judge it ("adds up to 0.2 s to checkout").

## Design parameters

Timeouts, retry counts, pool sizes and cache lifetimes are design decisions too. Propose a provisional value with its basis (a stated number it derives from, a calculation, the default of a named library or service), mark it as needing agreement, and list it as a sensitive point when the response depends on it.

## Debt

When a decision knowingly takes a cheaper option that weakens a driver, to meet the deadline or to save money, record the debt: what is weaker, why it was accepted, and when or on which event it must be repaid. Debt needs agreement. Debt that nobody agreed to is a defect that will be found later.

## Deferral

Defer a decision only when all of these hold:

- no primary driver depends on it now;
- deferring it does not make it more expensive to change later: it does not leak into stored data or published interfaces;
- the event or date that will settle it is named (`revisit_when`).

Otherwise, decide now. Every deferral is listed under "Needs agreement".

## Existing systems and transition

For an existing system, the first option of every decision is to keep what exists, and a change must earn its cost against the drivers. When several elements change, write the order of the changes as decisions, so that the system works after each step. For example: first put the payment adapter in front of the current provider, then add the second provider behind it.

## Example

How does checkout survive a provider outage (DRV-02)?

| Driver (rank) | One provider, retries with back-off | Second provider with failover |
|---|---|---|
| DRV-02 survive an outage (2) | fails: retries cannot help during an outage | meets |
| DRV-09 release date (3) | meets | in part: a second integration before the sale is tight |
| DRV-10 add a provider later (8) | in part | meets |
| DRV-07 running cost (9) | meets | in part: a second contract |

DRV-02 ranks above DRV-09, so the second provider wins. The risk to the release date goes to the business (question 5), and the decision records a sensitive point (the failover threshold) and a trade-off with DRV-07.
