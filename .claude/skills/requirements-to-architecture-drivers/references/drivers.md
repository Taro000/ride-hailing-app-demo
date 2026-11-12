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
| quality | How the system must respond to a stimulus, measurably | At sale peak (OPF-03), checkout confirms orders within NFR-02's SLO, counted by SLI-02 |
| change | What must be cheap to change, and how cheap | A second payment provider can be added without changing checkout |
| constraint | What the design must or must not use or do | Card numbers never reach our servers |
| function | A function whose demands shape the structure | Driver locations reach waiting passengers continuously |
| observability | What the system must make visible, and where | An engineer can follow any one checkout from the buyer's device to the stored order |
| security | An asset to protect and the threats against it | Payment results cannot be forged from the buyer's device |
| principle | A rule for the whole system that follows from several drivers | Every operation that moves money can be repeated without moving it twice |

## Quality scenarios

Write every quality driver as a scenario with six parts. A design can be checked against a scenario; it cannot be checked against an adjective.

| Part | Says | Take it from |
|---|---|---|
| Source | Who or what causes the stimulus | The QIU's user; an external system; a fault; an operator |
| Stimulus | What happens | The QR's failure scenario, turned into the event that triggers it |
| Artifact | Which part of the system it hits | The FR now; the element, once stage 2 has one |
| Environment | Under which conditions | The QIU's context of use; the NFR's conditions (workload, users, transactions), with the shared facts they name by ID; normal, peak, degraded, during a deployment |
| Response | What the system does | The QR's statement, as observable behaviour |
| Measure | How the response is judged | The NFR's measure, named by ID and never copied ("NFR-02's SLO, counted by SLI-02"); a QR's stated number or placeholder, with the QR's ID; a new named placeholder, with a request to the quality chain for the target |

| Weak | Better |
|---|---|
| The system is highly available | When the payment provider stops responding (stimulus) during normal operation (environment), checkout (artifact) keeps confirming orders (response); the share that succeeds during an outage is at least A_failover (measure, placeholder) |
| Stock is up to date | When the warehouse changes a stock count (stimulus) at any time (environment), the stock shown in the cart (artifact) reflects the change (response) within T_stock_lag (measure, the QR's placeholder) |
| Checkout is fast | When buyers on smartphones submit the checkout (source, stimulus) at sale peak (environment, OPF-03), the order is confirmed (artifact, response) within NFR-02's SLO, counted by SLI-02 (measure, named by ID; the NFR holds the share, the threshold and the window) |

Write separate scenarios for separate environments when the response or the measure differs (normal load and sale peak; one zone down; during a deployment).

Name volumes, peaks and other shared facts by ID, and list them in the driver's `premises`. A copied "up to 300 requests/s" stays in the scenario after the fact changes, and nobody finds it.

## Change scenarios

A change scenario is a scenario whose stimulus is a change request. Sources:

- anticipated changes and the roadmap (a second payment provider, a new market, a native app);
- variants the product must support (tenants with their own settings, languages, currencies, kinds of device);
- QRs of maintainability (modularity, modifiability, testability) and portability;
- excluded QRs that are expensive to add later.

The measure is effort or reach: "touches only the payment module", "no change to stored data", "within N_coupon_days of one developer". Effort numbers are business numbers: take them from the input or write a placeholder.

| Weak | Better |
|---|---|
| The code is maintainable | When a new coupon type is introduced (stimulus) by the store team (source), only the pricing module changes (response), within N_coupon_days of work (measure, placeholder) |
| We may add another provider | When the business signs a second payment provider (stimulus), the team adds it (source) without changing the checkout flow or stored orders (response), within E_provider days of work (measure, placeholder) |

## Constraints

A constraint is a decision made outside the design. Write it as what must or must not be true, with its source. Constraints come from:

- the technology constraints in `design-context.yaml`: what the user gave, the organization's engineering standards among it (but not a standard that makes a quality check a condition of a merge or a release: that is a gate, which the quality chain owns), every design input (DIN) of the quality chain taken in (`source: context.yaml DIN-01`), and every CON that binds what the design may use or do (`source: context.yaml CON-01`);
- the requirements that entered the quality chain through an entry point (law, standard, security risk analysis, development policy);
- the budget, the deadline, the team, the team structure and the current structure, when they bind a choice.

A DIN is a decision someone made before the design started ("no native app this year", "payments go through <vendor>"). Take it in, or set it aside with a reason, as `reading-the-quality-chain.md` describes ("Design inputs"). Platforms and device support are a constraint only when an input fixes them; otherwise they are stage 2's decision ("Platforms and device support" there).

Mark each constraint:

- `negotiable: false`: a law, a contract, a standard the business committed to, a platform the company mandates.
- `negotiable: true`: a preference that could change if the cost of keeping it is shown ("we would like to keep our existing database").
- When the input does not say, draft it from the kind of source and rate the point. Whether a technology constraint or a deadline can change has high breadth, because it decides which options stage 2 may consider, so it is asked. Ask about several constraints in one multi-select question ("which of these could change if keeping them proves costly?").

The budget, the deadline and the team are constraints too. Write them as drivers when they bind a choice: "the first release ships before the spring sale" rules out designs the team cannot build by then. A missing budget or deadline usually has high breadth, because it can move the line between the primary drivers and the rest, so it is asked. When the user cannot give it, the feasibility check names it as missing.

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

Name the FRs and the demand. Write a scenario when the demand has a measure. Write the demand as behaviour, as the FRs do; the mechanism that meets it (a key, a queue, a lock) is decided from stage 2 on.

## Observability drivers

The quality chain defines each SLI by its unit event, its vantage and its counting rules; stage 3 decides where the events come from. Write what the system must make visible so that each SLI can be counted from its vantage:

| Vantage | What the system must make visible |
|---|---|
| `system-boundary` | Every unit event where it crosses the boundary, with what the counting rules need (the outcome, the time taken, whether it repeats an earlier event) |
| `user-side` | Timings and outcomes on the user's side, reported back from the kinds of device in the contexts of use |
| `synthetic` | A way for synthetic users to go through the CUJ, kept apart from real data and from the counts of other SLIs |
| `data` | The timestamps and attributes the counting rules read in the data (when a stock count changed at the warehouse, when the store showed it) |

An SLI whose `existing_source` names telemetry that already exists (an OPF) needs nothing new where that telemetry covers its vantage. Keep the OPF in the driver's `premises`, so that stage 3 binds the SLI to it, and write a demand only for what it does not cover. A blind spot that hides a failure a primary driver cares about becomes a driver, or an open gap when no vantage can see it. One driver may serve several SLIs with the same vantage.

From the people who maintain the system: a way to follow one request end to end, from the user's side to the stored data, and to find where it failed. Write what must be visible, never how: logs, traces, fields, IDs and tools are decided from stage 2 on. Write each as a scenario: "when a checkout fails (stimulus), the engineer on call (source) can follow that one checkout end to end and find the step that failed (response), for at least P_trace of failed checkouts (measure: the analysability QR's number, or a placeholder)".

## Security drivers

From security QRs and the security risk analysis: the asset (card data, personal data, payment results, accounts), the threat the input names (account takeover with leaked passwords, forged payment results, scraping), and the response required. Do not invent threats the inputs do not raise. A kind of threat you suspect but no input raises is an uncertain point: rate it. A threat to money or personal data has high severity, so it is asked, and the answer decides whether it becomes a driver. Stage 2 draws the threat model.

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

For a driver below the primary line, the reason needs to show only why it stays there. How hard it is beyond that is stage 2's to judge, as it checks whether its decisions meet the driver ("Decision depth" in `conventions.md`).

Order the table with high and high first, then high and medium, then medium and high, then the rest by business priority. Within the same pair, put first the driver that touches more CUJs.

## Primary drivers

Primary drivers are the ones stage 2 designs for first. Mark as primary, within the limit below:

- every driver that is high on both axes;
- every high-priority driver with medium difficulty;
- every non-negotiable constraint.

Mark at most twelve. A primary line that lets most drivers through no longer tells stage 2 what to design for first. When the rules above mark more than twelve:

1. Merge the drivers whose scenarios have the same stimulus and response: the scenarios are too fine. One scenario may serve several QRs and NFRs.
2. If more than twelve remain, the business has not chosen. Ask which drivers to merge, or which to keep primary, in the ranking question below; it has high breadth, since it moves the primary line. Draft the option that keeps the twelve highest-ranked of the drivers the rules mark, and names the ones that fall below the line. A non-negotiable constraint that any reasonable design meets is usually among them: every decision respects it, primary or not.

A mid-sized system usually ends with five to twelve primary drivers. Fewer than three usually means the difficulty was underestimated: check the excluded QRs and the change scenarios again.

The ranking is a business decision ("Decisions" in `conventions.md`). The order of the primary drivers and where the line falls have high breadth, so ask about them in one question: the primary drivers in order, with the drafted ranking as the first option, and the drivers just below the line named. When the business has not chosen, the question asks it to. The answer is the decision: record it under "Decisions" and cite the question in the `basis_note` of every ranked driver. A judgment inside the ranking that moves no driver across the line is not asked on its own: the ranking question answers the order of the primary drivers, and how hard a driver below the line is, beyond what keeps it there, is left to stage 2 ("Ranking").
