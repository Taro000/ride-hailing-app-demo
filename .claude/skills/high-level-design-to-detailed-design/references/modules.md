# Modules

## Contents
- Splitting a component into modules
- Depth of modules
- Where modules live, dependencies and visibility
- Frameworks and off-the-shelf parts
- Contracts
- Allocation

## Splitting a component into modules

- One responsibility per module, stated in one sentence without "and": "calculates order totals", not "handles orders and payments".
- Split by reason to change: what changes together lives together. A rule the business changes often (pricing, fares, eligibility) gets its own module.
- Hide each decision that is likely to change behind a module's interface: an external provider, a storage technology, a rule set. The rest of the component must not know about it.
- Keep cohesion high: everything in a module serves its responsibility. Keep coupling low: modules talk through their interfaces, never through each other's data.
- Prefer modules named after what they do for the business, with the technical parts inside them, to modules named only after technical layers.

## Depth of modules

The detailed design goes into detail only where a mistake in the code is costly to find and to undo ("Decision depth" in `conventions.md`). Give every module one of two depths, in its `depth` field:

| Depth | The module | This stage writes |
|---|---|---|
| `full` | Moves money, settles an unknown outcome, shares state with work that runs at the same time, applies rules with several conditions, or migrates data; or would rate high on breadth or severity at bounds depth | Its responsibility, its whole contract, its allocation and verification approach, and, as they apply, its states, decision tables, algorithms, concurrency and error handling, what keeps the invariants of its data, its migrations, caches, screens and parameter values (`behaviour-and-data.md`) |
| `bounds` | Any other | Its responsibility, the summary of its contract, the acceptance criteria allocated to it and its verification approach. Implementation decides its inside within these |

- Bounds is the default. For a module at full depth, write in `depth_reason` which of the kinds it is, or why it would rate high at bounds depth.
- A module shares state with work that runs at the same time when it decides how work that runs at once on the same records or values is kept apart or put in order: it holds the lock, the version check or the key that decides which one wins. A module that only stores or reads records, while a constraint under "Data" and another module's concurrency settle the race, does not.
- Rate each module that is of none of these kinds in step 2, as a whole and as it would stand at bounds depth, with its contract holding what other modules rely on: would a wrong inside cause harm of high severity (money, personal data, safety, stored data that cannot be repaired), or would five or more items have to change? It is at full depth when either rating is high. A module that decides what personal data leaves the component typically rates high. The points inside a module at bounds depth are not rated one by one: implementation decides them.
- A module is at one depth as a whole. When a small part of a module is of these kinds and the rest is not, that part is often a module of its own: split it, so that the rest stays at bounds depth.
- Leaving a module of these kinds, or one that would rate high, at bounds depth defers a point of this stage's full-depth kinds: a business decision ("Deferring the rest" in `conventions.md`). Its `depth_reason` cites the question or the DAS that decided it.
- The depth decides only how much this stage writes. At either depth, a module keeps the technical policies, the shared conventions, the IFCs it realizes and the DATs it writes, and its verification approach checks it.

## Where modules live, dependencies and visibility

The repository policy of stage 2b (`pol/`, scope `repository`) gives every component the layout of its directories and the dependency rules that CI checks. Place each module where those rules put it, under its component's directory: when the layout groups the code by business capability, in the capability the module serves, at the layer its responsibility belongs to (an adapter of an external system among the adapters, the business rules where nothing reaches a framework or the database).

- Dependencies point toward stable modules. Business rules do not depend on frameworks, storage or providers; the adapters for those depend on the rules.
- Every dependency keeps the policy's dependency rules. This stage adds no rule of its own: a boundary between modules that the rules do not hold, and that a mistake in the code would cross at a cost, is a finding addressed to `architecture-to-technical-policy`, and so is a rule that blocks every reasonable split of the component.
- No cycles. When two modules need each other, one of them is really two modules, or a third module holds what they share.
- Mark each module `public` (other components call it, through an IFC) or `internal` (only modules of the same component call it).
- Draw the module dependencies as a Mermaid flowchart in the component report, with the directory of each module, so that a coding agent knows where each one goes.

## Frameworks and off-the-shelf parts

The technical policy chooses the language, the framework and the main libraries of each kind of component, and the tools that every component shares (stage 2b, the policy of scope `technology`). Build every module on the stack of its component's kind, as it is. Never choose another framework for one component, nor a second library for what a main library of the stack already does: components of one kind would then differ, and a package they share would force one component's choice on the others.

Write a decision (a DEC with `stage: detailed-design`) only for a library whose choice the technical policy left open on purpose and handed to this stage for this component, because a module at full depth is designed around it, such as a rules engine. Decide it within the stack, as the hand-off's bounds say, with options, the drivers it serves, its cost (licence, lock-in, learning) and the rejected options, and cite the hand-off in the decision's `basis_note`. Any other library beyond the main ones is implementation's choice, within the stack.

When the stack cannot do what a module needs (a driver it cannot meet, a library that no module can do without and that the stack rules out), write a finding addressed to `architecture-to-technical-policy`; do not choose around it. Write one too when a module at full depth is designed around a library that no hand-off gave this stage: stage 2b decided before the module existed, and decides the library, or hands its choice to this stage, when it runs for the finding. Until then, design the module's contract and behaviour without the library's own terms, and leave its inside that depends on the choice open. A managed service is an element of the architecture: a module that needs one the architecture lacks is a finding addressed to `architecture-drivers-to-architecture`.

## Contracts

For each public operation of a module at full depth:

| Part | Says | Example |
|---|---|---|
| Signature | Name, inputs and output, in a language-neutral notation | `calculateTotal(order: OrderDraft) -> Money` |
| Preconditions | What must hold before the call: the caller's duty | Every line has a positive quantity and a price |
| Postconditions | What holds after a successful call: the module's promise | The total is the sum of the lines plus shipping, minus discounts, and never below zero |
| Invariants | What always holds for the module's state | A confirmed order's total never changes |
| Errors | Every way the operation can fail, and what the caller learns | `CouponExpired`: the coupon expired after it was added |

Use the types of the shared conventions (money in integer minor units, times in UTC). Define once, in the component report, the structured types the signatures use at either depth (`OrderDraft`, `Money`). Write preconditions, postconditions and errors with each operation in the MOD's `interface`, and invariants in its `invariants` field. The report does not repeat them: two copies drift apart.

A module at bounds depth gets the summary of its contract, which is what its callers rely on: the signature of each public operation, its postcondition and the errors the caller must handle. Write a precondition only when the caller must check something the module does not (`pre: null` otherwise), and no invariants: what holds inside the module is implementation's, within the summary.

## Allocation

Every acceptance criterion of every FR allocated to the component goes to at least one module. Every operation of every IFC the component provides or consumes goes to exactly one module of the component, which realizes it: each operation has exactly one module in each component that takes part in it, the provider's and each consumer's. When an SLI binding (`sli_bindings` of an IFC or DAT) needs the component to produce events or fields, that goes to the module that produces them. A criterion or an operation with no module is a gap. A criterion may need several modules; an operation never has two in the same component.
