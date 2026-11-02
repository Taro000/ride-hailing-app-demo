# Behaviour and data

## Contents
- States
- Decision tables
- Algorithms
- Concurrency
- Error handling
- Physical data
- Caches and in-memory structures
- Screens
- Verification approach

## States

A module whose behaviour depends on what happened before has states. Draw them as a Mermaid state diagram, with:

- every state, including the ones for waiting, timing out and failing;
- every transition, with its trigger and its condition;
- what happens to every event in every state, including events that should not arrive (ignore, reject, or log and alert);
- the final states.

Check that from every state the module reaches a final state or waits for a named event, and that no event leaves the state undefined. A timeout on a call that changes something (a charge, a booking) leads to a state that settles the outcome with the same party, never straight to a failure or to another party; a state that money or goods can still leave is never final.

## Decision tables

For a rule with several conditions (fees, fares, eligibility, failover), write a table with one column per condition, one row per combination, and the action for each row. Check that the rows cover every combination and do not overlap. The table is also the source of the unit tests. Keep business numbers as the placeholders or stated values the inputs give.

| Total of at least F_free | Member | Remote area | Shipping fee |
|---|---|---|---|
| yes | any | no | 0 |
| yes | any | yes | S_remote |
| no | yes | no | S_member |
| no | yes | yes | S_member + S_remote |
| no | no | no | S_standard |
| no | no | yes | S_standard + S_remote |

Eight combinations, six rows: "any" covers two each in the first two rows.

## Algorithms

For each computation that is not trivial: the steps, at the level a developer can follow; the cost in time and memory for the expected sizes (from stated volumes); the edge cases (empty input, ties, overflow, rounding); and where the result is checked.

## Concurrency

Say what runs at the same time inside the component (requests, workers, scheduled jobs), what state they share, and how conflicts are prevented: one writer, a database constraint, a row lock, a version check that rejects stale updates, an idempotency key. Name what must be atomic, and the transaction that makes it so.

## Error handling

For each module: which errors it handles itself and how, which it turns into its own errors for its caller, and which it passes on. Where the component meets the outside, errors become the IFC's error contract. Every error caught is either recovered from or logged with the request ID; none is swallowed.

## Physical data

For the data entities the component owns (the DAT items whose owner is this component), wherever they are stored:

- tables or collections; columns with their types, nullability, defaults and constraints (keys, uniqueness, checks);
- one row per event for records of money and other records that must never be rewritten (one row per payment attempt, not one row per order that is updated);
- indexes, each tied to a query that needs it: write the query;
- the transactions the modules use;
- for an existing schema, the migrations, in an order that keeps the running version working;
- for tables another component reads directly, the read-only rights it gets, and the rule that they change only with a new version.

Draw the tables as a Mermaid entity-relationship diagram.

## Caches and in-memory structures

For each cache: what it holds, its key, its lifetime (bounded by the freshness the drivers allow), how it is invalidated, and what happens on a miss. For each in-memory structure: its size bound.

## Screens

For each screen the component serves: its components and what each shows and takes; its states (loading, empty, error, success, and any the acceptance criteria name); the validation of each input, with its messages; and what the accessibility requirements need (keyboard order, labels, contrast), from the QRs.

## Verification approach

For each module, list what must be verified and how, without writing the tests:

| Checks | How |
|---|---|
| FR-03, criteria 1 to 3 | Unit tests generated from the decision table |
| IFC-01's error contract | Contract tests against checkout.openapi.yaml |
| The module's share of the NFR-01 budget | A load test at 300 requests/s in staging |
| Analysability (an internal QR) | A CI check that every log line carries request_id |
