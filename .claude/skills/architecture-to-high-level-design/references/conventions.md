# Conventions shared by the design skills

Five skills turn a system's requirements into its design. Four are stages that run in order; the fifth reviews the output of stages 2 to 4.

| Stage | Skill | Reads | Writes |
|---|---|---|---|
| 1 | `requirements-to-architecture-drivers` | the quality chain's artifacts, the design inputs the user gives, existing code | `design-context.yaml`, architecture drivers (DRV) |
| 2 | `architecture-drivers-to-architecture` | DRV, the design context, functional requirements and CUJs | design decisions (DEC), elements (ELM), views |
| 3 | `architecture-to-high-level-design` | ELM, DEC, DRV, acceptance criteria, SLI definitions | interfaces (IFC) and their specs, data entities (DAT), DEC |
| 4 | `high-level-design-to-detailed-design` | one component per run, with its IFC, DAT, DEC, DRV and functions | modules (MOD), DEC, the detailed design index |
| Review | `design-review` | the output of stage 2, 3 or 4, and what it was built from | a review report, findings (FND) |

Each stage turns the decisions of the stage above into obligations for the stage below: an architecture decision binds the high-level design, and an interface binds the modules that realize it. Every item traces up to what it serves, so anyone can walk from a module back to the driver, the quality requirement and the user behind it.

## The quality chain

The quality chain is the set of four skills that write `docs/quality/`. It produces what the design starts from: users and CUJs (`context.yaml`), quality-in-use requirements (QIU), functional requirements (FR) with acceptance criteria, product and data quality requirements (QR) with their handling, non-functional requirements (NFR), SLI definitions (SLI) and error budget policies (EBP).

- Read it; never write to it. Do not edit, add or retire anything under `docs/quality/`, and do not write function proposals there.
- When the design shows that something in the quality chain should change, write it in the report's "Issues for the quality chain" section: the issue, the chain items it concerns, the change you suggest, and which quality-chain stage would make it. Typical issues: a target that no design within the budget can meet, a conflict between quality requirements that no design resolves, a missing function, a CUJ step that no element can perform. The user decides whether to re-run that quality-chain stage; afterwards, the design stages that the change reaches are re-run.
- Refer to chain items by their IDs. Do not copy their statements into design items; trace to them.
- When `docs/quality/` does not exist, accept the same information from the user (users, CUJs and their steps, functional requirements with acceptance criteria, quality requirements with their priority, targets that can be measured) and record where it came from in the report's "Inputs" table. In trace fields, write the source instead of an ID ("PRD, section 3").

## Findings between design stages

A later stage, or a review, that finds a problem in an earlier design stage's items writes a finding (FND) addressed to that stage. It never edits that stage's items itself, so that every item has exactly one stage that writes it.

- A finding names the skill it is addressed to, the items it concerns, its severity, the evidence and a suggested resolution.
- Every stage reads the open findings addressed to it, on every run. For each one, it accepts (changes its items and cites the finding in their changelogs) or rejects (writes why in `resolution`), sets the finding's status, bumps its version and adds a changelog entry. A rejection that leaves a risk in place needs agreement.
- When an accepted finding changes items, tell the user which later stages to re-run and which reviews to repeat.
- A finding is about this design. A problem in the quality chain goes to "Issues for the quality chain", not into a finding.

## Scope

These skills design software for the system inside the boundary in `context.yaml`, or inside the boundary the user gives: its structure, interfaces, data, modules and deployment. The infrastructure the software runs on (runtime environments, networks, managed services) is in scope as part of the deployment design.

Business procedures, operating runbooks and training are not. When only they can meet a need, write one line in the report's "Out of scope" section saying what and why. Systems outside the boundary appear only as external systems, with what the design assumes about them.

## Working language

- Ask questions in the language the user writes in.
- Write artifacts in the language of the project's existing documentation. If the project has none, use the user's language.
- Keep YAML keys, IDs and enum values in English exactly as `artifacts.md` defines them, so that every stage can read every other stage's files. Write free-text values in the working language.
- Use the terms in `glossary.md` for the working language, and use each one consistently.
- When you name a quality characteristic, use the name the quality chain's own report uses for the working language.
- Write diagram labels in the working language and keep IDs in them as they are.
- In reports, write the basis marks and statuses with the glossary's terms for the working language. In YAML, use the English enum values.

## Judgment basis

Mark every judgment with where it came from:

- `stated`: written in the input, in the quality chain's artifacts or in an earlier design stage's items. Rewording that keeps the meaning is still `stated`.
- `inferred`: your own judgment, made with enough evidence that you are not unsure. Anything the input does not say is `inferred`, even when it seems obvious. A design decision you make is `inferred` until the user confirms it.
- `confirmed`: the user answered a question about it.

A judgment you are unsure about is still drafted, as `inferred`, and also becomes a question. Never present an `inferred` judgment as if it were `stated`. People tend to accept a confident-looking draft without checking it; the basis mark tells them where to look.

An item holds several judgments, and its `basis` is the weakest of them. An item is `confirmed` only when every inferred judgment in it has been answered. When a question settled only part of an item, keep the item `inferred` and say in `basis_note` which parts are stated, inferred and confirmed. Most design items stay `inferred`: they are proposals, and agreement (`status: agreed`) is what settles them.

## Numbers

- Business numbers (targets, deadlines, thresholds, volumes, budgets) come from the inputs: the quality chain's items, the design context or the user. Never invent one. Use the chain's values and the names of its placeholders as they are. A number the design needs that no input gives is a gap: ask for the fact that would settle it, or write a named placeholder whose name no other placeholder uses, and list it under "Needs agreement".
- Design parameters (timeouts, retry counts and back-off, pool and batch sizes, cache lifetimes, partition counts) are design decisions. Propose a provisional value, say what it is based on (a stated number it derives from, a calculation, the default of a named library or service), and mark it as needing agreement.
- Show in the report how every derived number (a latency budget, a capacity estimate, a storage estimate) follows from stated numbers. Compute with a script, not by hand.

## Existing systems

When the repository holds code or infrastructure definitions for the system:

1. Stage 1 reads them before drafting and records the current structure in `design-context.yaml`: elements, data stores, deployment, dependencies, and the conventions the code follows.
2. Later stages read the parts they design, and design changes as deltas: every element, interface, data entity and module is marked `keep`, `change`, `new` or `remove`.
3. Say in the report what was read, and what the code cannot tell (runtime behaviour, production configuration, real volumes). Never present a guess about runtime behaviour as something read.

When there is no code, every item is `new`.

## Draft first, ask afterwards

1. Read every input: the quality chain's artifacts (or what the user gave instead), `design-context.yaml`, this stage's existing items and the items of the stages above it, the open findings addressed to this stage, and the code the stage needs. On a re-run, read this stage's inputs and its own items, and the items of other stages only where the changes lead.
2. If an essential input is missing, so that no meaningful draft is possible (each skill names its essential inputs), ask only for that input before drafting. This is a request for input, not a judgment question.
3. Draft the whole stage without stopping. Make every judgment yourself, using the rules in the skill. Write the draft report.
4. Then ask about every point you were unsure of: all of them, not a sample. A point is uncertain when:
   - the input is silent or ambiguous about it, and the choice changes this stage or a later one;
   - two or more reasonable options exist, and the wrong one would cause rework downstream;
   - inputs contradict each other, the quality chain or an earlier design stage;
   - it depends on facts that only the user's organization knows: budgets, contracts, team skills, existing systems, operating practice, volumes.

   Do not ask about anything the input already states, or about wording. Do not ask how the method works; do ask about the facts that a judgment made with the method depends on. Merge questions that hinge on the same fact.
5. Group the questions by theme, and put first the ones where an answer different from your draft would cause the most rework. For each question, give what you drafted, why you are unsure, and the options, with your drafted answer first. When a question asks for a fact (a budget, a name), the drafted option says what the draft does without it ("left as a placeholder"), and the user types the value.
   - An uncertain point whose answer would change only one item, and nothing that depends on it, is still asked, but not as a question of its own. Collect such points into one last question that lists each assumption in one line and asks which of them are wrong. Its options are the assumptions themselves, with no recommended option; choosing none means every assumption holds.
   - When several items share one yes-or-no judgment ("which of these components does the team already run?"), ask it as one multi-select question rather than one question per item.
   - If a structured question tool is available (for example, AskUserQuestion in Claude Code), ask up to 4 questions per call with 2 to 4 options each, put your drafted option first and label it as recommended, and call the tool again for the next batch. Ask multi-select questions with up to 4 items each, splitting longer lists over several questions.
   - Otherwise, ask in chat as a numbered list and wait for the answers.
6. Apply the answers and mark the affected judgments `confirmed`. If an answer overturns a premise, redo the affected part of the draft, then ask any new uncertain points the same way. A redone item keeps its ID while it serves the same purpose, even when its content changes; record the change in the questions and answers. If an answer drops a drafted item, remove it from the report and write its file with `status: retired`, so that its number is never used again.
7. Check the stage's exit criteria. Set the report's status to "answers applied" and write the YAML items. Until then the report is the working copy; from then on the YAML items are the source of truth, and the report must match them. The report's status says nothing about agreement; that lives in each item's `status`.

## Items that need agreement

The driver ranking, provisional design parameters, decisions that accept a risk, a cost or a debt, deferred decisions, and rejections of findings that leave a risk in place are business decisions as much as technical ones. A design nobody agreed to is reopened at the first incident or the first budget review. For these items:

- Ask about them only if you are unsure, like any other judgment.
- Set `needs_agreement: true` and list `approver_candidates`. Use roles, not names, unless the input names people.
- List every one of them in the report under "Needs agreement".
- Keep `status: draft` until the user says the agreement was made. Then set `status: agreed` and record who agreed in the changelog.

## Re-running a stage

- A re-run handles what changed: new or changed upstream items (in the quality chain or in an earlier design stage), and the open findings addressed to this stage. Leave the other items as they are unless a change reaches them.
- Update in place. Keep existing IDs and never renumber. A new item takes the number after the highest one in use, retired items included.
- When an item is no longer needed, set `status: retired` and add a changelog entry. Do not delete the file: other items may trace to it. A drafted item that an answer dropped before any file was written also gets a file, with `status: retired`.
- Whenever an item's meaning changes, bump `version` and add a changelog entry with the date, the change and the reason.
- Keep answers from earlier rounds. Do not ask the same question again unless the inputs it depended on have changed. Number questions per stage and continue the numbering on a re-run; when citing another stage's question, name the stage ("stage 2, question 4").
- Add a "Re-run on <date>" section at the top of the report: what triggered the re-run, which items changed, and which items of later stages are affected.
- End by telling the user which later stages to re-run and for which items, which reviews to repeat, and which issues for the quality chain are still open.
