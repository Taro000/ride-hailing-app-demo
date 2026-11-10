# Modules

## Contents
- Splitting a component into modules
- Dependencies and visibility
- Frameworks and off-the-shelf parts
- Contracts
- Allocation

## Splitting a component into modules

- One responsibility per module, stated in one sentence without "and": "calculates order totals", not "handles orders and payments".
- Split by reason to change: what changes together lives together. A rule the business changes often (pricing, fares, eligibility) gets its own module.
- Hide each decision that is likely to change behind a module's interface: an external provider, a storage technology, a rule set. The rest of the component must not know about it.
- Keep cohesion high: everything in a module serves its responsibility. Keep coupling low: modules talk through their interfaces, never through each other's data.
- Prefer modules named after what they do for the business, with the technical parts inside them, to modules named only after technical layers.

## Dependencies and visibility

- Dependencies point toward stable modules. Business rules do not depend on frameworks, storage or providers; the adapters for those depend on the rules.
- No cycles. When two modules need each other, one of them is really two modules, or a third module holds what they share.
- Mark each module `public` (other components call it, through an IFC) or `internal` (only modules of the same component call it).
- Draw the module dependencies as a Mermaid flowchart in the component report, and write the rule a tool can check in CI ("nothing under pricing imports from payment").

## Frameworks and off-the-shelf parts

Choosing a framework, a library or a managed service for a module is a decision, with options, the drivers it serves, its cost (licence, lock-in, learning) and the rejected options. Prefer what the shared conventions and the team's skills already use.

## Contracts

For each public operation:

| Part | Says | Example |
|---|---|---|
| Signature | Name, inputs and output, in a language-neutral notation | `calculateTotal(order: OrderDraft) -> Money` |
| Preconditions | What must hold before the call: the caller's duty | Every line has a positive quantity and a price |
| Postconditions | What holds after a successful call: the module's promise | The total is the sum of the lines plus shipping, minus discounts, and never below zero |
| Invariants | What always holds for the module's state | A confirmed order's total never changes |
| Errors | Every way the operation can fail, and what the caller learns | `CouponExpired`: the coupon expired after it was added |

Use the types of the shared conventions (money in integer minor units, times in UTC). Define once, in the component report, the structured types the signatures use (`OrderDraft`, `Money`). Write preconditions, postconditions and errors with each operation in the MOD's `interface`, and invariants in its `invariants` field.

## Allocation

Every acceptance criterion of every FR allocated to the component goes to at least one module. Every operation of every IFC the component provides or consumes goes to exactly one module that realizes it. A criterion or an operation with no module is a gap; one with two modules needs an explanation.
