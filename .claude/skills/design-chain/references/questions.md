# Questions

## Contents
- The questions to ask
- Asking
- Writing the answers
- Corrections and decisions after a stop
- When nobody answers

## The questions to ask

A run that nobody could answer wrote its questions as rows under "Unanswered questions" in its report, and set the report's status to "waiting for answers" ("Draft first, ask afterwards", step 7, in `conventions.md`). `scripts/status.py --questions` prints every row that waits for an answer: the unit, the report, the number, the question, why the stage was unsure, the options, and the items the answer bears on.

Ask them once nothing else can run, all in one sitting: unit by unit, in the order of the chain, and within a unit in the order of its rows, which is the order the stage would have asked them (breadth × severity, highest first).

A question is the stage's, not this skill's. Ask each one as the row writes it: do not drop one, merge two, add an option, or turn it into another question. Shorten only what the question tool needs short.

## Asking

Ask with AskUserQuestion:

- **One unit per call.** A call holds the questions of one unit only, up to 4. A unit with more takes several calls, in the order of its rows.
- **The question.** The user may see only the dialog, so each question stands on its own. Start with the unit and the number ("Stage 2b, question 3:"), then the question as the row has it, then why the stage was unsure.
- **The header.** At most 12 characters: the unit and the number, such as "2b Q3" or "段 2b 問 3".
- **The options.** The row's options, 2 to 4, in their order. The drafted one comes first, as the row marks it: add "(Recommended)" to its label, in the working language ("（推奨）"). A label has 1 to 5 words; the description gives the option's full text as the row writes it.
- **A choice among items.** A row that lists items to choose from, with the drafted choice, is a multi-select question: the items as options, and the drafted choice named in the question.
- **A fact.** A row that asks for a fact (a budget, a name, a number) has a drafted option that says what the draft does without it ("left as a placeholder"). The user types the value as their own answer.

The user can always answer in their own words. That is an answer, as written: write it as given, and let the stage apply it. Only the stage decides whether an answer can be applied; one that cannot is asked again by its next run ("Draft first, ask afterwards", step 8).

## Writing the answers

After each call, write each answer in the "Answer" column of its row, in the unit's report under `docs/design/`:

- The drafted option, chosen: its text, then "as drafted" ("Fail over to a second provider, as drafted").
- Another option: its text, as the row writes it.
- A multi-select question: the items chosen, separated by commas.
- The user's own words: as the user wrote them.

Keep the cell on one line: write line breaks as spaces, and `|` as `\|`. Change nothing else in the report: not its status, not the question, not the other rows. The run that applies the answers moves the rows to "Decisions", updates the items, and commits all of it.

Never commit the answers yourself. `scripts/status.py` reads the working tree, so an answer shows at once: the unit becomes stale (a review, due) with `answers under Unanswered questions`.

A row that names a request to the quality chain among its items asks about that request. Write its answer in the row like any other; the run that applies it records it in the request. The user may also have answered under the request in `docs/design/quality-chain-requests.md`: `scripts/status.py` counts an answer written there, or one recorded in the request since the stage's last run, and the row needs no other.

## Corrections and decisions after a stop

The summary lists the open assumptions, and the user may correct one of them; after a stop for an oscillation, the user may decide which value of the item holds. Either one is applied like an answer: write it as a row with its answer filled in, under "Unanswered questions" in the report of the unit that applies it ("Finishing a run", step 1, in `conventions.md`). Never change the item yourself.

- A correction to a DAS goes to the unit that wrote it, as its `stage` says: stage 1, 2, 2b or 3; for stage 4, the component whose items list it in `premises`; for `review-2` and the like, the review report of that stage.
- A correction to a QAS of the quality chain goes to the first stage, in the order of the chain, whose items list it in `premises`: that stage records the answer and writes the request to the quality chain that carries it ("Assumptions" in `conventions.md`).
- A decision about an item that went back and forth goes to the stage that writes the item.

The row:

| Column | A correction to an assumption | A decision after a stop |
|---|---|---|
| # | The number after the highest under "Decisions" and "Unanswered questions" in that report | The same |
| Question | "Does DAS-03 hold: <its title>?" | "Which value of DEC-02 `chosen` holds: <one> or <the other>?" |
| Why unsure | "Recorded as an assumption without asking" | "It went back and forth between runs: <the two commits>" |
| Options | "1. It holds (drafted) 2. It does not" | "1. <the value now> 2. <the other value>" |
| Items | The assumption, and the items that list it in `premises` (`scripts/status.py --summary` names them) | The item, and the findings behind each change |
| Answer | The correction, as the user gave it | The decision, as the user gave it |

When the report has no "Unanswered questions" section, add it before "Decisions", with the header row of the report template. Then set the report's status to "waiting for answers", if it is not already: a review applies answers only when its report waits for them (`design-review`, "Inputs"), and a stage applies them either way. The unit is stale (a review, due) now, and runs when the chain continues.

## When nobody answers

When AskUserQuestion is not available, or the user dismisses the questions, write nothing and stop: the questions wait in the reports, and the summary lists them with where to answer them. When the user answers some questions and not others, write the answers given: the unit resumes with them, and keeps the others waiting.
