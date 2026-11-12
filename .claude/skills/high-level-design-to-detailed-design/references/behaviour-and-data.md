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

Everything here except the verification approach is for the modules at full depth ("Depth of modules" in `modules.md`), and for the tables another component reads directly. For a module at bounds depth, implementation decides its states, rules, algorithms, concurrency, error handling, data, caches and screens, within its MOD item, the IFCs it realizes, the DATs it writes and the technical policies. Every module, at either depth, has a verification approach.

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

For each module at full depth: which errors it handles itself and how, which it turns into its own errors for its caller, and which it passes on. The technical policy's conventions inside the code say how a failure is signalled and passed on, where errors become the IFC's error contract, and that none is swallowed (the pipeline-and-code policy); this stage says which errors each module meets and what it does about each, within them.

## Physical data

Design only the physical data that keeps the invariants the modules at full depth rely on, in the data entities the component owns (the DAT items whose owner is this component), wherever they are stored:

- what keeps each invariant: a constraint (a key, a uniqueness, partial when the invariant holds only in some states, a check, a foreign key), an index, a transaction that keeps what must be atomic and the module that runs it, a conditional update that changes a row only from the state it names, or the rights of a database role that keep records from being deleted or rewritten;
- one row per event for records of money and other records that must never be rewritten (one row per payment attempt, not one row per order that is updated);
- for an existing schema, the migrations, in an order that keeps the running version working.

Name the table and the columns that each of these covers, and nothing more of the table. A table that another component reads directly is part of an interface: design it in full, whichever module writes it, with its columns, types and constraints, the read-only rights the reader gets, the decision that allows the read, and the rule that it changes only with a new version.

Implementation designs the rest: the tables and their other columns and types, the indexes that queries need, and the tables that only modules at bounds depth write. The DATs bound it: their attributes and relations, owner, consistency rule, classification and retention.

Write the invariants in the component report, one table per database table: the invariant, what keeps it, and the modules that rely on it. The physical data lives in the component report only; no item holds it.

## Caches and in-memory structures

For each cache of a module at full depth: what it holds, its key, its lifetime (a design parameter of the module, bounded by the freshness the drivers allow), how it is invalidated, and what happens on a miss. For each in-memory structure: its size bound. The caches of modules at bounds depth are implementation's, within the freshness the drivers and the IFCs allow.

## Screens

For a screen that a module at full depth serves: its states, in the module's state diagram (loading, empty, error, success, and any the acceptance criteria name, such as a payment still being confirmed); the validation of each input, with its messages, in a decision table when it has several conditions; and what the accessibility requirements need (keyboard order, labels, contrast), from the QRs. Implementation designs every other screen, within its screen IFC (the data it shows and takes, its actions, its error and empty states), the acceptance criteria allocated to its module and the accessibility requirements, which the module's verification approach checks.

## Verification approach

For every module, at either depth, list in the MOD's `verification` what must be verified and how, without writing the tests. Each check runs at a test layer of the technical policy (stage 2b, the policy of scope `testing`), with the doubles and environments it has:

| Checks | How |
|---|---|
| FR-03, criteria 1 to 3 | Unit tests generated from the decision table |
| IFC-01's error contract | Integration tests of POST /v1/checkout, one for each error case, with the fake payment providers |
| A charge that provider A completes after its timeout is taken once | An integration test in which the fake provider answers after its timeout |
| The module's share of the NFR-02 budget | No layer before release: the policy has no load layer, and QCR-04 asks the quality chain for a load test of checkout |

For a module at bounds depth, these checks are what holds the code to the summary of its contract and to its acceptance criteria. A check that needs a layer, a double or an environment that the policy lacks, such as a double that can answer late where the policy's can only answer or fail, is a finding addressed to `architecture-to-technical-policy`. A budget that only a load test can check is the exception. The policy has a load layer only where a gate of the quality chain asks for one, and whether to have the gate is the quality chain's to decide. So say in the verification approach that no layer checks the budget before release, and name the request to the quality chain that asks for the gate: stage 3 writes it when a budget rests on numbers that nothing has measured, and this stage writes one only when none exists. The module lists the request in `premises`, since its verification changes when the gate comes. In the report, name the layers, doubles and environments of the policy that the component's checks use, and describe only the scenarios that several modules share, such as what the fake providers must do for the checks of the payment path. The doubles, the environments and the checks in CI themselves are the policy's.
