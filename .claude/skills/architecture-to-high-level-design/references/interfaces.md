# Interfaces

## Contents
- What every interface specifies
- By kind
- Error contracts
- Idempotency and retries
- Unknown outcomes
- Timing
- Versioning
- Specs

## What every interface specifies

| Field | Says |
|---|---|
| provider, consumers | Which element offers it, which elements use it |
| functions | The FRs whose acceptance criteria pass through it |
| operations | HTTP: method and path. Event: message name. File or batch: the file or the job. Screen: the screen |
| format | JSON, CSV, a binary format; the character encoding where it matters |
| protocol | HTTPS request and response, a message broker, a file transfer, a browser |
| auth | Who may call it, and how that is proven |
| errors | Every error case, how it is signalled, and what the caller does |
| idempotency | Whether the operation can be repeated safely, and how |
| timing | Timeout; ordering guarantee; delivery guarantee |
| versioning | How the interface changes without breaking its consumers |
| observability | What it logs and emits, for the SLIs and for investigations |
| spec | The OpenAPI or AsyncAPI document |

## By kind

| Kind | Also specify |
|---|---|
| http | Resource paths and methods; request and response schemas; status codes; paging for lists; rate limits |
| event | The channel or topic; the message schema; who publishes and who subscribes; the ordering key; the delivery guarantee; how consumers recognize duplicates; how long messages are kept |
| file | The name pattern; layout and encoding; who writes it and when; how the reader knows it is complete; what happens to a malformed file |
| screen | Its purpose in the CUJ step; the data it shows and takes; its actions and where each leads; error and empty states |
| batch | The schedule or trigger; input and output; how a failed run restarts; how long a run may take (from the NFRs) |

A component's access to its own data store is not an interface; stage 4 designs it. When another component reads that store directly, the tables it reads become part of the owner's interface ("Ownership" in `data-and-conventions.md`).

For an external system, write the interface as what the design relies on (operations, errors, timing, rate limits, SLA), with the source of each fact. Do not write a spec for it; link the owner's.

## Error contracts

For each operation, list every error case the caller must handle differently:

| Group | Typical signal | The caller |
|---|---|---|
| The request is wrong | 400, 422 | Fixes the request; never resends it unchanged |
| Not signed in, or not allowed | 401, 403 | Signs in again, or stops |
| The thing does not exist | 404 | Stops, or refreshes what it shows |
| The current state forbids it | 409 | Reloads and decides again |
| Too many requests | 429, with a time to wait | Waits as told |
| A dependency failed | 502, 503, 504 | Retries only if the operation is idempotent; otherwise checks the outcome first |
| The outcome is not known yet | 202, with a status to poll | Polls; never repeats the request with a new key |
| A business refusal (card declined, out of stock) | A specific code with a reason | Shows the reason, and offers what the CUJ allows next |

Every interface uses the one error format of the shared conventions: a stable code for programs, a message for people, the request ID.

## Idempotency and retries

- Reads are safe to repeat.
- For each operation that changes state, decide: naturally idempotent (setting a value); made idempotent by a key the caller supplies; or not idempotent, in which case the caller never retries blindly and checks the outcome instead.
- Scope the key by what must happen once: one key per order for a payment, not one per attempt. The caller reuses the key on every retry.
- A request whose key belongs to a request still running gets "in progress" (409) or waits for the first result; it never starts a second run.
- A key reused with a different request gets an error (422); it never returns the first result for a different request.
- Operations that move money are always made idempotent.
- Retries happen in one place on each call path, with back-off and a limit. Retries at several layers multiply each other.

## Unknown outcomes

A timeout, a dropped connection or an unclear error on a call that changes something (a charge, a booking, a dispatch) leaves the outcome unknown: the other side may have done it, may still be doing it, or may not have started.

- Never report an unknown outcome as a failure. Say "nothing was charged" only when every party that was asked has confirmed it.
- Settle it with the same party before trying another one: look the request up by its key, and cancel it there if it went through or is still running. Some providers separate authorization from capture, which makes cancelling cheap.
- If it cannot be settled within a set time, hold the record in its own "unknown" state, tell the caller that the outcome is pending, and let reconciliation settle it. Draw that state and its ways out.
- A key is known only to the party that received it. A second provider does not know the first provider's key, so failing over a charge without settling the first one can charge twice.

## Timing

- A timeout is not a budget. The latency budget checks that the flow is fast enough when things are healthy; timeouts decide what happens when they are not.
- Set each call's timeout above the slowest response the dependency gives when healthy (its stated 99.9th percentile, or its stated maximum), so that healthy calls almost never time out. On a call that changes something, every timeout creates an unknown outcome.
- Set each caller's timeout above the worst case of everything it waits for, settlement included, so that no caller abandons work that is still running. Each callee's own timeouts stay within its caller's remaining time.
- Never use an SLO's threshold as a timeout.
- Ordering: for events, say whether order matters and, if so, per which key (per order, per vehicle). Order across all events is rarely needed and is expensive.
- Delivery: at-least-once with consumers that recognize duplicates is the usual choice. Say how duplicates are recognized (an event ID).

## Versioning

- Additive changes (a new optional field, a new operation) keep the version.
- A breaking change needs a new version, run alongside the old one until every consumer has moved.
- Consumers ignore fields they do not know.
- Events carry their schema version in the message.

## Specs

Write the decided parts only, and mark provisional values.

- OpenAPI, for each HTTP interface: paths and methods; request and response schemas with required fields and formats; every error response, using the shared error schema; the security scheme; the idempotency header where it applies.
- AsyncAPI, for each event interface this system publishes or defines: channels; messages with their payload schemas and headers (event ID, schema version, the time the event happened); who publishes and who subscribes; the delivery and ordering notes from the IFC.

Name each file after its interface (`checkout.openapi.yaml`, `order-events.asyncapi.yaml`) and keep one document per interface, so that each can change on its own. For an external system's interface, link the owner's document instead of writing one.
