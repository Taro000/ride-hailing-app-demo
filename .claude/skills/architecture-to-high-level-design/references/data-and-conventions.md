# Data and shared conventions

## Contents
- Data entities
- Ownership
- Consistency
- Retention and classification
- Data quality flows and data SLIs
- Shared conventions

## Data entities

Write one DAT for every entity that the FRs read or write and that more than one module or element cares about: orders, payments, stock, accounts, rides. For each: the key attributes (enough to show what it is, not every column), relations, the owner, the store, the consistency rule, retention, classification, and the bindings of data SLIs ("Data quality flows and data SLIs"). Stage 4 designs only what keeps the invariants its modules at full depth rely on, their migrations, and the tables another component reads directly; implementation designs the rest of the tables, within the DAT. Draw the entities and their relations as a Mermaid entity-relationship diagram in the report.

## Ownership

Every entity has exactly one owner element: the only one that writes it. Other elements read it through the owner's interface, or keep a copy fed by the owner's events. Reading the owner's tables directly is a third way only when a decision records it: the reader gets read-only rights, and the tables it reads become part of the owner's interface, changed only with a new version. Two writers for one entity means nobody can say which value is right. When the inputs seem to need two, split the entity, or route the second writer through the owner.

## Consistency

| Need | Usual choice |
|---|---|
| A rule across records in one store (an order and its lines) | One transaction |
| A rule across elements that must hold at every moment | Give both records one owner, or redesign so the rule is not needed |
| A change that other elements must learn about | An event from the owner, published only after the change is stored: store the change and the event together, then publish the event |
| A multi-step process across elements (payment, then shipping) | A sequence of local steps, each with a compensating step for when a later one fails |
| Copies that may drift | Regular reconciliation against the owner, with a list of mismatches |

## Retention and classification

- Retention comes from a law, a contract or a policy that entered the quality chain through an entry point; otherwise it is a placeholder. Never invent a period. When the inputs name the law, contract or policy but not the period, ask: the content of a law, standard, contract or policy that the inputs name but do not give is always asked when a judgment in this stage depends on it (`conventions.md`, "Draft first, ask afterwards").
- Classification (personal data, payment data, internal, public) decides encryption, who may read the data, what may be logged and where it may be stored. Personal and payment data never go into logs or analytics events unmasked: no field that this stage puts in a log line or an event carries them, and the technical policy's convention for logs masks what the code writes.

## Data quality flows and data SLIs

For each data quality driver, show where the data comes from, how it is validated, how changes propagate and how long that may take, and what is reconciled against what. The freshness the driver allows bounds every cache and every delay on the path.

For each SLI whose vantage is `data`, write its binding in the DAT's `sli_bindings`, as "SLI bindings" in `interfaces.md` describes: which records are its unit events, the timestamps or attributes its counting rules compare (for freshness, the time a change happened at its source and the time it became visible), and the method (a scheduled query, a reconciliation run). When people see the data through a copy, such as a cache, the binding observes the copy: the time the owner stored a change is not the time people saw it.

## Shared conventions

Decide once for the whole system the conventions that interfaces show to their consumers, each as a decision. A convention that the existing code follows is `stated`. A shared convention has high breadth (`conventions.md`, "Draft first, ask afterwards"), so ask about any that you are unsure of.

| Convention | Decide |
|---|---|
| Errors | One error format: a stable code, a message for people, the request ID, details for validation errors, and the codes for errors in fields |
| IDs | The format of public IDs (random, not guessable; never a database sequence in a URL), and who generates them |
| Time | Stored and sent in UTC with an offset; the business time zone for deadlines and reports |
| Money | Integer minor units with a currency code; the rounding rules |
| Paging and sorting | One style for every list |
| Authentication tokens | The kind of token, its lifetime, how it is renewed and revoked |
| Versioning | Where every interface carries its version (in the path, in the message), and what a change may do within a version ("Versioning" in `interfaces.md`) |
| Idempotency keys | The header or field that carries a key, one name for every interface, and the answers to a key still running and to a key reused for another request ("Idempotency and retries" in `interfaces.md`) |
| Request IDs and log fields | The request ID header that every hop passes on; the fields that every log line carries for the SLI bindings, the request ID among them. What one interface logs besides, for investigations, is in its IFC's `observability` |
| Naming | Case and style for paths, fields, events and topics |

The conventions inside the code are the technical policy's, in its pipeline-and-code policy (stage 2b): how the code raises and passes on errors and where they become the error format above, how logs are written (the library, the format, the levels, what is masked), where settings live in each environment and which are secrets, and where the texts for people live and how dates and numbers are shown in each language. Follow them, and decide none of them here: two rules for one thing, one here and one there, contradict each other at the first change. When an interface's contract cannot be kept within them, write a finding addressed to `architecture-to-technical-policy`.
