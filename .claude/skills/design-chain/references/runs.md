# Runs

## Contents
- Starting a subagent
- The request for a stage
- The request for a review
- The reply
- Resuming with answers
- After a run
- Handing over

## Starting a subagent

Run each unit in a subagent of its own (Claude Code's Agent tool, with an agent that can read and write files and run commands, such as `general-purpose`), and wait for it to finish before reading the state again. A subagent starts with no memory of this conversation: everything it needs is in its request and in the files.

The skill of the unit is in the skills directory that holds this skill (`.claude/skills/` in the project, or `~/.claude/skills/`), as `<skills directory>/<skill>/SKILL.md`. Name that path in the request, so that the subagent reads the skill itself.

Write the request in the user's language. The stage writes its artifacts in the language of the project's documentation, as `conventions.md` says ("Working language").

## The request for a stage

```text
Run the skill `<skill>`: read <path>/SKILL.md and follow it, with its references, exactly.
This run is <stage 2 of the design chain | stage 4 for the component ELM-02>. The design is in docs/design/
and the quality chain in docs/quality/.

Nobody can answer questions during this run. When the skill would ask the user, write the questions under
"Unanswered questions" in the report, set its status to "waiting for answers", and finish the run, as step 7 of
"Draft first, ask afterwards" in references/conventions.md describes. Never answer a question yourself.

Why this run: <the reasons scripts/status.py gives for the unit, as it gives them>.

Finish the run as the skill says ("Finishing a run" in references/conventions.md), with its commit to the
current branch. Do not push.

When you have finished, reply with only the lines below.
```

Fill in "Why this run" with what applies:

- A stale stage: the reasons under its line in the output of `scripts/status.py`, word for word. They say where to start; the stage still reads everything that changed since its last run, as "Re-running a stage" says.
- A first run: "This is the first run of the stage; the stages above it have run." For stage 1, add the design context that the user gave, as the user wrote it: "The user gave this design context: ...". When the user gave none, say so. The design context is not an essential input of stage 1: it drafts the whole stage, rates each missing part of it as an uncertain point, and writes down the questions about those that rate high, such as a missing budget or deadline; this skill then asks them. Only missing functional or quality requirements stop it before drafting ("Draft first, ask afterwards", step 2).
- A run the user asked for: the user's words, such as the event that a hand-off waited for ("The user says that the vendor contract is signed: HND-07 may have come due").

## The request for a review

A review runs in a fresh context and works from the artifacts alone (`design-review`, "Run it in a fresh context"). Its request names the stage to review and the paths, and nothing else: no reasons, no findings, nothing of what this conversation knows about the design.

```text
Run the skill `design-review`: read <path>/SKILL.md and follow it, with its references, exactly.
Review <stage 2 | stage 2b | stage 3 | stage 4 for the component ELM-02> of the design. The design is in
docs/design/ and the quality chain in docs/quality/.

Nobody can answer questions during this run. When the skill would ask the user, write the questions under
"Unanswered questions" in the review report, set its status to "waiting for answers", and finish the run, as
step 7 of "Draft first, ask afterwards" in references/conventions.md describes. Never answer a question yourself.

Finish the run as the skill says, with its commit to the current branch. Do not push.

When you have finished, reply with only the lines below.
```

The review finds by itself whether it is a full review or a diff review, and from which commit.

## The reply

Ask every subagent to end with these lines, and nothing else, so that this conversation stays small:

```text
commit: <short hash> <first line of the commit>, or "none: <why>"
report status: answers applied | waiting for answers
kind of review: full | diff since <commit>        (reviews only)
questions written: <numbers>, or none
findings raised: <ID severity addressed-skill>, ..., or none
findings processed: <ID accepted|rejected>, ..., or none        (stages only)
hand-offs: written <IDs>; decided <IDs>; passed on <IDs>        (stages only)
requests to the quality chain: raised <IDs>; answered <IDs>; found applied <IDs>
problems left for other stages: <stage: number and rules>, or none
next, as the skill says: <one line>
```

## Resuming with answers

Once the answers are written in the reports ("Writing the answers" in `questions.md`), read the state again, and run what `scripts/status.py` names next, as always. A unit with answers is stale (a review, due) and runs in its turn: resuming one unit can change what another reads, so units are not resumed in the order their questions were asked.

When the unit to run next is one whose questions this invocation asked, and the subagent that wrote them can still be continued (Claude Code's SendMessage, to the agent's ID, in the same session), continue it, so that it keeps what it read and drafted:

```text
The user answered questions <numbers>: the answers are in the Answer column of "Unanswered questions" in
docs/design/<report>. Apply them as step 8 of "Draft first, ask afterwards" in references/conventions.md
describes: read them from the report, and start from what changed since your commit <short hash>, other runs
included. Ask nothing: write any new question down as before. Finish the run with its commit, and do not push.
Reply with the same lines as before.
```

Otherwise (a new session, an agent that cannot be continued, or one whose context is full), run the unit again in a new subagent, with the request for a stage or for a review: the reasons that `scripts/status.py` gives then include the answers, and the run applies them.

A resumed run counts as a run of the unit.

## After a run

1. Read the state again with `scripts/status.py --since <start commit>`.
2. Check that the unit has a new last run: the commit its reply names, whose first line starts with the unit's skill. When it has none, or the reply says `none`, the run failed: stop, and give its reply in the summary. Do not run it again in this invocation. The one exception is a diff review whose reply says that nothing changed since the last review: `design-review` stops there without a commit, and the last review still holds. Note it, go on, and do not run that review again in this invocation.
3. Note for the summary: the unit, the commit and its first line, the report's status, the questions written, the findings raised and processed, the hand-offs, the requests to the quality chain, and the problems left for other stages.
4. When the reply's "next" names a unit that `scripts/status.py` does not show as ready, follow `scripts/status.py`, which applies the conventions to what is committed, and mention the difference in the summary.

## Handing over

Where this skill cannot start subagents, it runs nothing. Show the state, in the working language, from `scripts/status.py --summary`, then:

- the questions that wait, with where to answer them: the "Answer" column of "Unanswered questions" in each report, or under the request in `docs/design/quality-chain-requests.md` for a question about a request;
- the next unit to run, and the request to give it in a new session. A person who runs a stage directly is asked during the run, so the request says nothing about writing questions down:
  - a stale stage: "Run `<skill>` on docs/design/. It is stale: <the reasons>." For stage 4, name the component;
  - a first run of stage 1: "Derive the architecture drivers from docs/quality/. Technology constraints: … Engineering standards: … Budget and deadline: … Teams: … Roadmap: …";
  - a review: "Review stage <2 | 2b | 3 | 4 for ELM-xx> of the design.", to run in a new session, not in the one that wrote the design;
- the units that can run after it, one at a time, and that the state should be read again after each run, since a run can make other units stale.
