# Architecture drivers

## Contents
- Driver kinds
- Quality scenarios
- Change scenarios
- Constraints
- Functional drivers
- Observability drivers
- Security drivers
- Principles
- Ranking
- Primary drivers

## Driver kinds

| Kind | It says | Example |
|---|---|---|
| quality | How the system must respond to a stimulus, measurably | 99% of checkouts respond within 1.5 s at sale peak |
| change | What must be cheap to change, and how cheap | A second payment provider can be added without changing checkout |
| constraint | What the design must or must not use or do | Card numbers never reach our servers |
| function | A function whose demands shape the structure | Driver locations reach waiting passengers continuously |
| observability | What the system must make visible, and where | Every request carries one ID from the browser to the database |
| security | An asset to protect and the threats against it | Payment results cannot be forged from the browser |
| principle | A rule for the whole system that follows from several drivers | Every operation that moves money can be repeated without moving it twice |

## Quality scenarios

Write every quality driver as a scenario with six parts. A design can be checked against a scenario; it cannot be checked against an adjective.

| Part | Says | Take it from |
|---|---|---|
| Source | Who or what causes the stimulus | The QIU's user; an external system; a fault; an operator |
| Stimulus | What happens | The QR's failure scenario, turned into the event that triggers it |
| Artifact | Which part of the system it hits | The FR now; the element, once stage 2 has one |
| Environment | Under which conditions | The QIU's context of use; the NFR's conditions (workload, users, transactions); normal, peak, degraded, during a deployment |
| Response | What the system does | The QR's statement, as observable behaviour |
| Measure | How the response is judged | The NFR (SLO, gate, audit, monitor); a stated number; a named placeholder |

| Weak | Better |
|---|---|
| The system is highly available | When the payment provider stops responding (stimulus) during normal operation (environment), checkout (artifact) keeps confirming orders through a second route (response); the share that succeeds during an outage is at least A_failover (measure, placeholder) |
| Stock is up to date | When the warehouse changes a stock count (stimulus) at any time (environment), the stock shown in the cart (artifact) reflects the change (response) within T_stock for 99% of changes (measure, from the QR's placeholder) |
| Checkout is fast | When buyers on smartphones submit the checkout (source, stimulus) at sale peak, up to 300 requests/s (environment), the order is confirmed (artifact, response), and 99% of valid checkouts respond within 1.5 s over 28 days (measure, NFR-01) |

Write separate scenarios for separate environments when the response or the measure differs (normal load and sale peak; one zone down; during a deployment).

## Change scenarios

A change scenario is a scenario whose stimulus is a change request. Sources:

- anticipated changes and the roadmap (a second payment provider, a new market, a native app);
- variants the product must support (tenants with their own settings, languages, currencies, devices);
- QRs of maintainability (modularity, modifiability, testability) and portability;
- excluded QRs that are expensive to add later.

The measure is effort or reach: "touches only the payment module", "no change to stored data", "within N_coupon_days of one developer". Effort numbers are business numbers: take them from the input or write a placeholder.

| Weak | Better |
|---|---|
| The code is maintainable | When a new coupon type is introduced (stimulus) by the store team (source), only the pricing module changes (response), within N_coupon_days of work (measure, placeholder) |
| We may add another provider | When the business signs a second payment provider (stimulus), the team adds it (source) without changing the checkout flow or stored orders (response), within E_provider days of work (measure, placeholder) |

## Constraints

A constraint is a decision made outside the design. Write it as what must or must not be true, with its source, and mark it:

- `negotiable: false`: a law, a contract, a standard the business committed to, a platform the company mandates.
- `negotiable: true`: a preference that could change if the cost of keeping it is shown ("we would like to keep our existing database").
- When the input does not say, ask.

The budget, the deadline and the team are constraints too. Write them as drivers when they bind a choice: "the first release ships before the spring sale" rules out designs the team cannot build by then.

## Functional drivers

Most functions are met inside one module and do not shape the architecture. A function is a driver when it demands something of the structure:

| Demand | Examples |
|---|---|
| Continuous or real-time updates | Locations of vehicles; live prices; shared editing |
| Money, or anything that must happen exactly once | Payments, refunds, points, ticket sales |
| Long-running processes across parts | Matching a ride and waiting for acceptance; order fulfilment |
| Work while disconnected | Recording on a ward; field inspections |
| Integration with external systems | Payment providers, maps, the customer's ERP |
| Heavy or bursty computation | Route optimization, report generation, image processing |
| Strict ordering or consistency across parts | Seat allocation; stock reservation |
| Work bound to a clock | Nightly settlement; reminders; expiry |

Name the FRs and the demand. Write a scenario when the demand has a measure.

## Observability drivers

From each SLI: the events the system must emit, at which measurement point, with which fields; whether timings from the client are needed; what must be counted that the system does not see yet. From the people who maintain the system: one request ID carried through every hop, structured logs, traces, health endpoints. Write each as a scenario: "when a checkout fails (stimulus), the engineer on call (source) can find the failing hop from the request ID alone (response), for at least P_trace of failed requests (measure: the analysability QR's number, or a placeholder)".

## Security drivers

From security QRs and the security risk analysis: the asset (card data, personal data, payment results, accounts), the threat the input names (account takeover with leaked passwords, forged payment results, scraping), and the response required. Do not invent threats the inputs do not raise. List the kinds of threat you suspect and ask. Stage 2 draws the threat model.

## Principles

A principle is worth writing when two or more stages or teams would otherwise decide the same thing separately and differently. Write it as a rule, with the drivers it serves in `derived_from`. Typical principles: money movement can be repeated safely; one owner per data entity; personal data stays in the region; every call to another part has a timeout; no module reads another module's tables. Keep the list short; five is plenty for most systems.

## Ranking

Rank every driver except principles on two axes.

Business priority, taken from the quality chain and the inputs:

| Value | When |
|---|---|
| high | From an emphasized QR; a non-negotiable constraint; a requirement from an entry point; a fixed deadline |
| medium | From a minimum-line QR; a negotiable constraint; a change expected within a year |
| low | A change expected later; an excluded QR kept for its retrofit cost |

Function, observability and security drivers take the priority of the requirements they serve: high when they serve an emphasized QR or a requirement from an entry point; medium when they serve a minimum-line QR, or only FRs; low otherwise.

Design difficulty, your judgment, with a one-line reason:

| Value | When |
|---|---|
| high | A demanding measure; a conflict with another high-priority driver; a dependence on an external system the team does not control; hard to undo once built (data placement, overall structure, a vendor); new to the team |
| medium | Known solutions exist, but they cost real effort or money |
| low | Any reasonable design meets it |

Order the table with high and high first, then high and medium, then medium and high, then the rest by business priority. Within the same pair, put first the driver that touches more CUJs.

## Primary drivers

Primary drivers are the ones stage 2 designs for first. Mark as primary:

- every driver that is high on both axes;
- every high-priority driver with medium difficulty;
- every non-negotiable constraint.

A mid-sized system usually ends with five to twelve primary drivers. More than twelve usually means the scenarios are too fine (merge the ones with the same stimulus and response) or the business has not chosen; ask. Fewer than three usually means the difficulty was underestimated: check the excluded QRs and the change scenarios again.
