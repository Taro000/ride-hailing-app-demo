#!/usr/bin/env python3
"""Show the state of the design chain: which stages are stale and why, which reports wait for answers, which reviews
are due, and what runs next ("Stale stages" in conventions.md). It reads the items, the reports and git, and changes
nothing.

Usage:
    python3 scripts/status.py [--design DIR] [--quality DIR] [--since COMMIT] [--questions] [--summary]
                              [--format text|json]

Options:
    --design DIR     the design directory (default: docs/design)
    --quality DIR    the quality chain's directory (default: read_from.quality_chain in design-context.yaml,
                     else docs/quality)
    --since COMMIT   the commit an invocation of design-chain started from: count the runs since then, the runs that
                     closed critical findings, and look in those commits for oscillation
    --questions      show every question that waits for an answer, with its options
    --summary        show what will make a stage stale later, and the open assumptions
    --format json    everything, as JSON

The units of the chain, in the order they run: stage 1; stage 2 and its review; stage 2b and its review; stage 3 and
its review; then, for each component, its run of stage 4 and its review. A unit is:

    not run yet  a stage with no report, or a review of a stage that has not run
    stale        a stage with something to process (the reasons are listed)
    due          a review that "Findings between design stages" calls for, or one that has answers to apply
    waiting      a report with questions that wait for answers, none of which has come
    up to date   none of these

What runs next is the first unit, from the top, that is stale, due or not run yet, when no unit above it is stale, due,
waiting or not run yet. Each component of stage 4 counts as a stage of its own: it waits for the units above stage 4,
never for another component, and its review waits for it.

A stage's last run is the last commit whose first line starts with its skill's name and that changed its report (in
stage 4, the component's report); a review's, the last such commit of design-review that changed its review report.
A stage is stale when, since its last run (uncommitted changes included):
    - an input changed: an item of the quality chain (a YAML file, or an entry of context.yaml); an item of an earlier
      design stage (an entry of design-context.yaml, DRV, DEC, ELM, POL, IFC, DAT, a spec); or, in an earlier stage's
      report, a Mermaid diagram (a view, a flow, a state diagram), or a table under a heading that names a view, a
      flow, a budget, a state or a decision table. For stage 1, a change to design-context.yaml counts too. In stage
      4, only what concerns the component counts (below);
    - an open hand-off addressed to it was written, passed on to it or changed. A script cannot tell from its trigger
      whether an event has come, so every such hand-off counts, with its trigger listed: the stage leaves one whose
      trigger has not come open, and it does not count again;
    - an assumption (DAS) that it wrote, or that its items list in premises, was overturned;
and whatever its last run:
    - a critical or major finding addressed to it is open (in stage 4, one that concerns the component: by the report
      it was raised in, or by the component of the items it targets);
    - a row under its report's "Unanswered questions" has an answer: in the row; or, for a row that names a request
      to the quality chain, in the request recorded since the stage's last run, or under the request in
      quality-chain-requests.md;
    - its report is still a draft: the run that wrote it did not finish, and its next run starts from what it left.
Without git, or when a report has no commit of its skill, the changes since the last run cannot be found: the stage
is stale when its report has no such commit, and the reasons that need no history are listed.

The questions are the rows of the table under the heading "Unanswered questions" (in Japanese, 未回答の質問), or of
any table whose header has six cells and starts with '#'. A report waits for answers when its status says so or when
such a row has no answer.

What concerns a component of stage 4: a technical policy (POL); the component's own items, which are its element, the
interfaces it provides or consumes, the data entities it owns, its modules and its decisions; an item that names one
of its own items, or that its own items or the drivers it carries name; a decision that names no element, interface
or data entity, since it binds every component; a spec that one of its interfaces names; an item of the quality chain
that its own items or the drivers they carry name, or that a request in their premises targets; and a diagram or a
table that names one of its own items, or no element, interface or data entity at all. A finding addressed to stage 4
that concerns no component this way is listed apart, for the user to name its component.

A review is due after the first run of the stage it reviews; when its report is still a draft or has answers to
apply; and when, since the review's last run, the stage accepted a critical or major finding addressed to it, or ran
after an earlier stage accepted a critical or major finding that this review raised, and in either case the stage's
own items changed since.

With --since, a field of an item (any field but basis, basis_note and premises; DAS and QCR are left out, since their
statuses follow answers) or of an entry of design-context.yaml that goes back to a value it had earlier in those
commits is listed: a decision changed back, a finding opened again, a hand-off sent back to a stage, a retired item
made active again. A field that goes back to no value (null, empty, or absent) does not count: something added and
then dropped, such as a debt that an answer made moot, is no oscillation, and when it is added again, that counts.
It is an oscillation when nothing explains the change back; it is listed for the reader to judge instead when an input
of the item's stage changed in between, or when the run that changed it back applied answers. A finding raised in
those commits, addressed to the same stage as one rejected earlier in them and targeting an item it targeted, is
listed as a possible repeat, for the reader to compare.

Exit status: 0, or 2 when an argument is wrong or neither the design nor the quality chain is found.
"""

import json
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True

import design_lib as lib  # noqa: E402
import tables as tables_mod  # noqa: E402
import yaml_lite  # noqa: E402

ORDER = [1, 2, "2b", 3, 4]
REPORT_OF = {1: "1-architecture-drivers.md", 2: "2-architecture.md", "2b": "2b-technical-policy.md",
             3: "3-high-level-design.md"}
REVIEWED = (2, "2b", 3)
SEVERE = ("critical", "major")
QUESTION_HEADINGS = ("unanswered questions", "未回答の質問")
INPUT_HEADINGS = ("view", "flow", "budget", "state", "decision table", "ビュー", "流れ", "予算", "状態", "判断表")
EMPTY_CELLS = ("", "—", "–", "-")
ITEM_DIRS = dict(lib.DESIGN_DIRS)  # directory -> prefix
ITEM_STAGE = {"DRV": 1, "ELM": 2, "POL": "2b", "IFC": 3, "DAT": 3, "MOD": 4}
BOOKKEEPING = ("basis", "basis_note", "premises")
NO_REVERTS = ("DAS", "QCR")  # their statuses and ratings follow answers, not the design
RATING = {"high": 3, "medium": 2, "low": 1}
FENCE_RE = re.compile(r"\s*(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)")
HEADING_RE = re.compile(r"(#{1,6})\s+(.*)")
STRUCTURE = ("ELM", "IFC", "DAT")
MISSING = "\x00missing"
EMPTY_VALUES = (MISSING, "null", "[]", "{}", '""')


def starts_with_skill(subject, skill):
    return re.match(re.escape(skill) + r"(?![A-Za-z0-9-])", subject or "") is not None


def stage_index(stage):
    return ORDER.index(stage) if stage in ORDER else len(ORDER)


def stage_name(stage):
    return "stage %s" % stage


def parse(text):
    """The mapping a YAML text holds, or None."""
    if text is None:
        return None
    try:
        data = yaml_lite.load(text).data
    except yaml_lite.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def all_mentions(data):
    out = set()
    for _, text in lib.strings_in(data):
        out.update(lib.mentions(text))
    return out


def one_line(value):
    return re.sub(r"\s+", " ", str(value)).strip() if value not in (None, "") else "—"


def id_list(ids):
    """IDs in order, with a run of three or more consecutive numbers of one kind written as 'DRV-01 to DRV-05'."""
    out, run = [], []

    def flush():
        out.extend(["%s to %s" % (run[0], run[-1])] if len(run) >= 3 else run)

    for ident in sorted(set(ids), key=lib.id_key):
        if run and lib.is_id(ident) and lib.is_id(run[-1]) and lib.id_key(run[-1])[0] == lib.id_key(ident)[0] \
                and lib.id_key(run[-1])[1] + 1 == lib.id_key(ident)[1]:
            run.append(ident)
            continue
        flush()
        run = [ident]
    flush()
    return ", ".join(out)


def norm(line):
    return re.sub(r"\s+", " ", line.strip())


class Git(object):
    """The git repository that holds the design; `root` is None outside git."""

    def __init__(self, path):
        self.root = None
        self.head = None
        self.memo = {}
        top = self.run(["rev-parse", "--show-toplevel"], cwd=path)
        if top is None:
            return
        self.root = top.strip()
        head = self.run(["rev-parse", "--verify", "-q", "HEAD"])
        self.head = head.strip() if head else None

    def run(self, args, cwd=None):
        try:
            p = subprocess.run(["git", "-c", "core.quotepath=off"] + args, cwd=cwd or self.root,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        except OSError:
            return None
        if p.returncode != 0:
            return None
        return p.stdout.decode("utf-8", "replace")

    def rel(self, path):
        """A path relative to the repository's root, with / separators; None when it is outside."""
        rel = os.path.relpath(os.path.realpath(path), os.path.realpath(self.root))
        if rel == os.pardir or rel.startswith(os.pardir + os.sep):
            return None
        return "" if rel == "." else rel.replace(os.sep, "/")

    def resolve(self, rev):
        out = self.run(["rev-parse", "--verify", "-q", "%s^{commit}" % rev])
        return out.strip() if out else None

    def short(self, sha):
        return sha[:7] if sha else "—"

    def last_run(self, skill, path):
        """The last commit whose first line starts with the skill's name and that changed the path."""
        out = self.run(["log", "--format=%H%x09%s", "--", path]) if self.head else None
        for line in (out or "").splitlines():
            sha, _, subject = line.partition("\t")
            if starts_with_skill(subject, skill):
                return sha
        return None

    def last_change(self, path):
        out = self.run(["log", "-1", "--format=%H", "--", path]) if self.head else None
        return out.strip() if out and out.strip() else None

    def changed_since(self, commit, paths):
        """The files under the paths that differ from the commit in the working tree, untracked files included."""
        key = ("changed", commit, tuple(paths))
        if key not in self.memo:
            out = set()
            diff = self.run(["diff", "--name-only", "--no-renames", commit, "--"] + paths)
            untracked = self.run(["ls-files", "--others", "--exclude-standard", "--"] + paths)
            for text in (diff, untracked):
                out.update(l for l in (text or "").splitlines() if l)
            self.memo[key] = out
        return self.memo[key]

    def changed_between(self, a, b, paths):
        """The files under the paths that differ between two commits."""
        key = ("between", a, b, tuple(paths))
        if key not in self.memo:
            out = self.run(["diff", "--name-only", "--no-renames", a, b, "--"] + paths)
            self.memo[key] = set(l for l in (out or "").splitlines() if l)
        return self.memo[key]

    def show(self, commit, path):
        key = ("show", commit, path)
        if key not in self.memo:
            self.memo[key] = self.run(["show", "%s:%s" % (commit, path)])
        return self.memo[key]

    def is_ancestor(self, a, b):
        return self.run(["merge-base", "--is-ancestor", a, b]) is not None

    def commits_since(self, since):
        out = self.run(["rev-list", "--reverse", "%s..HEAD" % since])
        return out.split() if out else []

    def subject(self, commit):
        out = self.run(["log", "-1", "--format=%s", commit])
        return out.strip() if out else ""

    def diff_tree(self, commit, paths):
        """[(old blob, new blob, status, path)] of the files a commit changed under the paths."""
        out = self.run(["diff-tree", "-r", "--no-commit-id", "--no-renames", "--root", commit, "--"] + paths)
        entries = []
        for line in (out or "").splitlines():
            meta, _, path = line.partition("\t")
            bits = meta.split()
            if len(bits) >= 5 and path:
                entries.append((bits[2], bits[3], bits[4], path))
        return entries

    def blob(self, sha):
        if not sha or set(sha) == set("0"):
            return None
        key = ("blob", sha)
        if key not in self.memo:
            self.memo[key] = self.run(["cat-file", "-p", sha])
        return self.memo[key]

    def dirty(self, paths):
        out = self.run(["status", "--porcelain", "--untracked-files=all", "--"] + paths)
        return len([l for l in (out or "").splitlines() if l.strip()])


def question_rows(text):
    """The rows of the questions table of a report, as lists of cells: the table under the heading "Unanswered
    questions", or any table whose header has six cells and starts with '#' (the template's questions table, in any
    language)."""
    rows, under_heading, header, wanted = [], False, None, False
    for line in (text or "").split("\n"):
        s = line.strip()
        m = HEADING_RE.match(s)
        if m:
            under_heading = any(h in m.group(2).strip().lower() for h in QUESTION_HEADINGS)
            header, wanted = None, False
            continue
        if not s.startswith("|"):
            header, wanted = None, False  # a line that is not a row ends the table
            continue
        if re.match(r"\|?\s*:?-{3,}", s):
            continue
        cells = tables_mod.split_row(s)
        if header is None:
            header = cells
            wanted = under_heading or (len(cells) == 6 and cells[0] in ("#", "＃"))
        elif wanted and len(cells) >= 3:
            rows.append(cells)
    return rows


def report_blocks(text):
    """The parts of a report that later stages read as inputs: each Mermaid block, and each table written by hand
    under a heading that names a view, a flow, a budget, a state or a decision table. A table whose first header cell
    is '#' (questions and decisions) is left out, and so are the generated tables."""
    lines = tables_mod.BLOCK_RE.sub("", text or "").split("\n")
    out, i = [], 0
    headings = []  # (level, text) of the headings above the current line
    while i < len(lines):
        m = HEADING_RE.match(lines[i].strip())
        if m:
            level = len(m.group(1))
            headings = [h for h in headings if h[0] < level] + [(level, m.group(2).strip().lower())]
            i += 1
            continue
        m = FENCE_RE.match(lines[i])
        if m:
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith(m.group(1)):
                j += 1
            if m.group(2).lower() == "mermaid":
                out.append("\n".join(norm(l) for l in lines[i + 1:j]))
            i = j + 1
            continue
        if lines[i].strip().startswith("|"):
            j = i
            while j < len(lines) and lines[j].strip().startswith("|"):
                j += 1
            header = tables_mod.split_row(lines[i])
            named = any(word in heading for _, heading in headings for word in INPUT_HEADINGS)
            if header and header[0] not in ("#", "＃") and named:
                out.append("\n".join(norm(l) for l in lines[i:j]))
            i = j
            continue
        i += 1
    return out


class Unit(object):
    """A stage run (stage 4: for one component) or a review, with its report and its state."""

    def __init__(self, kind, stage, component=None):
        self.kind = kind  # "stage" | "review"
        self.stage = stage
        self.component = component
        name = ("4-detailed-design/%s.md" % component) if stage == 4 else REPORT_OF[stage]
        if kind == "stage":
            self.skill = lib.STAGE_SKILLS[stage]
            self.report = name
        else:
            self.skill = lib.REVIEW_SKILL
            self.report = "reviews/" + (("4-detailed-design-%s.md" % component) if stage == 4 else name)
        where = "%s %s" % (stage, component) if component else str(stage)
        self.key = where if kind == "stage" else "review " + where
        self.label = ("stage " if kind == "stage" else "review of stage ") + where
        self.exists = False
        self.text = None
        self.status = None
        self.rows = []
        self.last_run = None
        self.state = None
        self.reasons = []
        self.answered = []
        self.waiting_rows = []
        self.blocked_by = None
        self.notes = []

    def questions(self):
        names = ["number", "question", "why_unsure", "options", "items", "answer"]
        out = []
        for cells in self.rows:
            row = dict(zip(names[:-1], cells[:-1]))
            row["answer"] = cells[-1]
            row["waiting"] = cells[0] in self.waiting_rows
            out.append(row)
        return out

    def as_dict(self):
        return {"unit": self.key, "label": self.label, "skill": self.skill, "component": self.component,
                "report": self.report, "report_status": self.status, "last_run": self.last_run,
                "state": self.state, "reasons": self.reasons, "notes": self.notes,
                "blocked_by": self.blocked_by.key if self.blocked_by else None,
                "answered_questions": [n for n, _ in self.answered], "waiting_questions": self.waiting_rows,
                "questions": self.questions()}


class Chain(object):
    def __init__(self, project, glossary, git):
        self.p = project
        self.g = glossary
        self.git = git
        self.design_rel = git.rel(project.design_dir) if git.root else None
        if git.root and self.design_rel is None:
            git.root = None  # the design is outside the repository: no history to read
        self.quality_rel = git.rel(project.quality_dir) if git.root and project.has_quality else None
        self.history = bool(git.root and git.head)
        self.units = []
        for stage in (1, 2, "2b", 3):
            self.units.append(Unit("stage", stage))
            if stage in REVIEWED:
                self.units.append(Unit("review", stage))
        self.component_ids = [c.id for c in project.components()]
        for c in self.component_ids:
            self.units += [Unit("stage", 4, c), Unit("review", 4, c)]
        self.doc_answers = self.request_doc_answers()
        self.next = []
        self.waiting = []
        self.own = {}
        self.named = {}
        self.due_handoffs = set()
        self.unplaced = []  # findings addressed to stage 4 that concern no component that can be named

    # paths

    def drel(self, rel):
        """A path under the design directory, relative to the repository's root."""
        return rel if not self.design_rel else self.design_rel + "/" + rel

    def under(self, path, base):
        return base is not None and (base == "" or path == base or path.startswith(base + "/"))

    def inputs(self):
        return [self.design_rel or "."] + ([self.quality_rel or "."] if self.quality_rel is not None else [])

    def changed(self, commit):
        return self.git.changed_since(commit, self.inputs())

    def current(self, rel):
        path = os.path.join(self.p.design_dir, rel)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def read_root(self, path):
        full = os.path.join(self.git.root, path)
        if not os.path.exists(full):
            return None
        with open(full, "r", encoding="utf-8") as f:
            return f.read()

    # the units

    def unit(self, kind, stage, component=None):
        for u in self.units:
            if u.kind == kind and u.stage == stage and u.component == component:
                return u
        return None

    def evaluate(self):
        self.place_findings()
        for u in self.units:
            u.text = self.current(u.report)
            u.exists = u.text is not None
            if u.exists:
                u.status = tables_mod.report_status(u.text, self.g)
                u.rows = question_rows(u.text)
                if u.status is None:
                    u.notes.append("its status cannot be read (only English and Japanese are read): waiting for"
                                   " answers is judged from its questions alone")
                if self.history:
                    u.last_run = self.git.last_run(u.skill, self.drel(u.report))
        for u in self.units:
            if u.kind == "stage":
                self.stage_state(u)
            else:
                self.review_state(u)
        self.order()
        return self

    def own_reasons(self, u):
        """The reasons that come from the unit's own report: an unfinished run, and answers to apply."""
        self.questions(u)
        out = []
        if u.status == "draft":
            out.append("its report is still a draft: the run that wrote it did not finish, and the next run starts"
                       " from what it left")
        if u.answered:
            out.append("answers under Unanswered questions: %s" % self.answer_list(u))
        return out

    def waits(self, u):
        return (u.status == "waiting for answers" or bool(u.waiting_rows)) and not u.answered

    def stage_state(self, u):
        if not u.exists:
            u.state = "not run yet"
            return
        reasons = self.own_reasons(u)
        reasons += self.finding_reasons(u)
        if not self.git.root:
            u.notes.append("not under git: input changes, hand-offs and overturned assumptions are not checked")
        elif u.last_run is None:
            reasons.append("its report has no commit whose first line starts with %s, so its last run cannot be"
                           " found: the run reads every input again" % u.skill)
        else:
            reasons += self.input_reasons(u)
            reasons += self.handoff_reasons(u)
            reasons += self.assumption_reasons(u)
        u.reasons = reasons
        if self.waits(u) and u.status != "draft":
            u.state = "waiting"
        else:
            u.state = "stale" if reasons else "up to date"

    def review_state(self, u):
        stage = self.unit("stage", u.stage, u.component)
        if not stage.exists:
            u.state = "not run yet"
            return
        if not u.exists:
            u.state = "due"
            u.reasons = ["the first review of %s" % stage.label]
            return
        reasons = self.own_reasons(u)
        if self.waits(u) and u.status != "draft":
            u.state = "waiting"
            return
        if not self.git.root:
            u.notes.append("not under git: whether a critical or major finding changed the stage since the review is"
                           " not checked")
        else:
            if u.last_run is None:
                u.notes.append("its report has no commit of design-review: findings are read whatever their date")
            reasons += self.review_reasons(u, stage)
        u.reasons = reasons
        u.state = "due" if reasons else "up to date"

    def order(self):
        """Which unit waits for which, and what runs next."""
        unsettled = ("stale", "due", "not run yet", "waiting")
        top = None
        for u in self.units:
            if u.stage == 4:
                continue
            if top is not None:
                u.blocked_by = top
            elif u.state in unsettled:
                top = u
        first = {}
        for u in self.units:
            if u.stage != 4:
                continue
            if top is not None:
                u.blocked_by = top
            elif u.component in first:
                u.blocked_by = first[u.component]
            elif u.state in unsettled:
                first[u.component] = u
        self.next = [u for u in self.units if u.blocked_by is None and u.state in ("stale", "due", "not run yet")]
        self.waiting = [u for u in self.units if u.state == "waiting"]

    # questions

    def request_doc_answers(self):
        """{QCR ID: answer} written by hand under the requests in quality-chain-requests.md, and not recorded in the
        request yet. A section as the script wrote it holds no such answer (its fingerprint says so)."""
        out = {}
        _, sections, prints = tables_mod.doc_parts(self.p.request_doc)
        for ident, _, lines in sections:
            if prints.get(ident) == tables_mod.fingerprint(lines):
                continue
            written = tables_mod.answer_key(tables_mod.section_edits(lines)[0])
            item = self.p.get(ident)
            recorded = tables_mod.answer_key(item.get("answer")) if item is not None else ""
            if written and written != recorded:
                out[ident] = written
        return out

    def questions(self, u):
        u.answered, u.waiting_rows = [], []
        changed = self.changed(u.last_run) if (self.git.root and u.last_run) else None
        for cells in u.rows:
            number = cells[0]
            if cells[-1].strip() not in EMPTY_CELLS:
                u.answered.append((number, None))
                continue
            where = None
            for q in [x for x in lib.mentions(cells[-2]) if lib.prefix_of(x) == "QCR"]:
                item = self.p.get(q)
                # an answer the stage has not seen yet: written in the document, or recorded since its last run
                recorded = item is not None and item.status != "open" and (
                    changed is None or self.drel(item.path) in changed)
                if recorded or q in self.doc_answers:
                    where = q
                    break
            if where:
                u.answered.append((number, where))
            else:
                u.waiting_rows.append(number)

    def answer_list(self, u):
        return ", ".join("question %s%s" % (n, " (answered in %s)" % w if w else "") for n, w in u.answered)

    # findings

    def finding_components(self, finding):
        """The components a finding addressed to stage 4 concerns: by the report it was raised in, or by the items it
        targets (a module, a decision of the detailed design, the element, a hand-off, an interface, a data entity)."""
        found = set()
        raised_in = finding.get("raised_in")
        m = re.search(r"(ELM-[0-9]{2,})\.md\Z", raised_in) if isinstance(raised_in, str) else None
        if m:
            found.add(m.group(1))
        for t in lib.as_list(finding.get("targets")):
            it = self.p.get(t) if isinstance(t, str) else None
            if it is None:
                continue
            if it.prefix == "ELM":
                found.add(it.id)
            elif it.prefix in ("MOD", "HND") and isinstance(it.get("component"), str):
                found.add(it.get("component"))
            elif it.prefix == "DEC" and it.get("stage") == "detailed-design":
                for c in self.component_ids:
                    if it in self.p.stage4_decisions_of(c):
                        found.add(c)
            elif it.prefix == "IFC":
                found.update(x for x in [it.get("provider")] + lib.as_list(it.get("consumers")) if isinstance(x, str))
            elif it.prefix == "DAT" and isinstance(it.get("owner"), str):
                found.add(it.get("owner"))
        return found & set(self.component_ids)

    def place_findings(self):
        self.placed = {}
        for f in self.p.of("FND", active_only=False):
            if f.get("to") == lib.STAGE_SKILLS[4]:
                self.placed[f.id] = self.finding_components(f)
                if not self.placed[f.id] and f.status == "open" and f.get("severity") in SEVERE:
                    self.unplaced.append(f.id)

    def concerns_finding(self, finding, component):
        return component in self.placed.get(finding.id, set())

    # reasons a stage is stale

    def finding_reasons(self, u):
        found = []
        for f in self.p.of("FND", active_only=False):
            if f.status != "open" or f.get("to") != u.skill or f.get("severity") not in SEVERE:
                continue
            if u.stage == 4 and not self.concerns_finding(f, u.component):
                continue
            found.append("%s (%s)" % (f.id, f.get("severity")))
        return ["open findings addressed to it: %s" % ", ".join(found)] if found else []

    def handoff_reasons(self, u):
        changed = self.changed(u.last_run)
        found = []
        for h in self.p.of("HND", active_only=False):
            if h.status != "open" or h.get("to") != u.skill:
                continue
            if u.stage == 4 and h.get("component") != u.component:
                continue
            if self.drel(h.path) in changed:
                found.append("%s (trigger: %s)" % (h.id, one_line(h.get("trigger"))))
                self.due_handoffs.add(h.id)
        return ["hand-offs written or passed on to it since its last run: %s" % "; ".join(found)] if found else []

    def assumption_reasons(self, u):
        changed = self.changed(u.last_run)
        own = self.p.stage_own_items(u.stage, u.component)
        found = []
        for d in self.p.of("DAS", active_only=False):
            if d.status != "overturned" or self.drel(d.path) not in changed:
                continue
            wrote = u.stage != 4 and str(d.get("stage")) == str(u.stage)
            rests = any(d.id in self.p.premises(i) or (i.is_entry and d.id in lib.mentions(i.get("source")))
                        for i in own)
            if wrote or rests:
                found.append(d.id)
        return ["assumptions overturned since its last run: %s" % id_list(found)] if found else []

    def input_reasons(self, u):
        changed = sorted(self.changed(u.last_run))
        quality, design, reports = [], [], []
        for path in changed:
            if self.quality_rel is not None and self.under(path, self.quality_rel):
                rel = path[len(self.quality_rel) + 1:] if self.quality_rel else path
                quality += self.quality_change(u, rel, path)
            elif self.under(path, self.design_rel):
                rel = path[len(self.design_rel) + 1:] if self.design_rel else path
                kind, ids = self.design_change(u, rel, path)
                if kind == "report":
                    reports.append(rel)
                elif kind:
                    design += ids
        out = []
        if design:
            out.append("inputs changed: %s" % id_list(design))
        if reports:
            out.append("diagrams or tables changed in %s" % ", ".join(reports))
        if quality:
            out.append("quality chain changed: %s" % id_list(quality))
        return out

    def quality_ids(self, rel, path, commit):
        """The IDs of the quality-chain items that a changed file holds; ["context.yaml"] when context.yaml changed
        outside its entries; [] for a file that holds no item (a report)."""
        parts = rel.split("/")
        if rel == "context.yaml":
            return self.entry_changes(path, commit, lib.QUALITY_CONTEXT_LISTS) or ["context.yaml"]
        if len(parts) == 2 and parts[0] in dict(lib.QUALITY_DIRS) and parts[1].endswith(".yaml"):
            return [parts[1][:-5]]
        return []

    def quality_change(self, u, rel, path):
        """The IDs of the quality-chain items that a changed file holds and that count for the unit."""
        ids = self.quality_ids(rel, path, u.last_run)
        if u.stage == 4:
            named = self.named_ids(u.component)
            ids = [i for i in ids if i in named]
        return ids

    def entry_changes(self, path, commit, lists):
        """The IDs of the entries that differ between the commit and the working tree; None when no entry did."""
        new = parse(self.read_root(path))
        old = parse(self.git.show(commit, path))

        def entries(data):
            out = {}
            for key, _ in lists:
                for e in lib.as_list((data or {}).get(key)):
                    if isinstance(e, dict) and isinstance(e.get("id"), str):
                        out[e["id"]] = json.dumps(e, sort_keys=True, ensure_ascii=False, default=str)
            return out

        a, b = entries(old), entries(new)
        ids = [i for i in set(a) | set(b) if a.get(i) != b.get(i)]
        return ids if ids else None

    def item_stage(self, prefix, data):
        if prefix == "DEC":
            return lib.DEC_STAGES.get((data or {}).get("stage"))
        return ITEM_STAGE.get(prefix)

    def design_change(self, u, rel, path):
        """("item", [IDs]) or ("report", None) when a changed file under docs/design counts for the unit, else
        (None, None)."""
        parts = rel.split("/")
        if rel == "design-context.yaml":
            if u.stage == 1:
                ids = self.entry_changes(path, u.last_run, lib.CONTEXT_LISTS)
                return "item", ids or ["design-context.yaml"]
            ids = self.entry_changes(path, u.last_run, lib.CONTEXT_LISTS) or []
            if u.stage == 4:
                named = self.named_ids(u.component)
                ids = [i for i in ids if i in named]
            elif not ids:
                ids = ["design-context.yaml"]
            return ("item", ids) if ids else (None, None)
        if len(parts) == 2 and parts[0] in ITEM_DIRS and parts[1].endswith(".yaml"):
            prefix = ITEM_DIRS[parts[0]]
            ident = parts[1][:-5]
            now = parse(self.read_root(path))
            then = parse(self.git.show(u.last_run, path))
            stage = self.item_stage(prefix, now if now is not None else then)
            if stage is None or stage_index(stage) >= stage_index(u.stage):
                return None, None
            if u.stage == 4 and not self.concerns(u.component, prefix, ident, [now, then]):
                return None, None
            return "item", [ident]
        if len(parts) >= 3 and parts[0] == "ifc" and parts[1] == "specs":
            if stage_index(3) >= stage_index(u.stage):
                return None, None
            if u.stage == 4 and rel not in self.own_specs(u.component):
                return None, None
            return "item", [rel]
        for stage, name in REPORT_OF.items():
            if rel == name and stage_index(stage) < stage_index(u.stage):
                old = report_blocks(self.git.show(u.last_run, path))
                new = report_blocks(self.read_root(path))
                diff = set(old) ^ set(new)
                if u.stage == 4:
                    diff = [b for b in diff if self.concerns_text(u.component, b)]
                return ("report", None) if diff else (None, None)
        return None, None

    # what concerns a component of stage 4

    def own_ids(self, component):
        if component not in self.own:
            p = self.p
            ids = set([component])
            ids.update(i.id for i in p.of("IFC") if i.get("provider") == component
                       or component in lib.as_list(i.get("consumers")))
            ids.update(d.id for d in p.of("DAT") if d.get("owner") == component)
            ids.update(m.id for m in p.modules_of(component))
            ids.update(d.id for d in p.stage4_decisions_of(component))
            self.own[component] = ids
        return self.own[component]

    def named_ids(self, component):
        if component not in self.named:
            ids = set()
            for ident in self.own_ids(component):
                item = self.p.get(ident)
                if item is not None:
                    ids.update(all_mentions(item.data))
            element = self.p.get(component)
            for d in lib.as_list(element.get("drivers") if element is not None else None):
                driver = self.p.get(d) if isinstance(d, str) else None
                if driver is not None:
                    ids.add(driver.id)
                    ids.update(all_mentions(driver.data))
            for q in [x for x in ids if lib.prefix_of(x) == "QCR"]:
                request = self.p.get(q)
                if request is not None:
                    ids.update(x for x in lib.as_list(request.get("targets")) if isinstance(x, str))
            self.named[component] = ids
        return self.named[component]

    def own_specs(self, component):
        out = set()
        for ident in self.own_ids(component):
            item = self.p.get(ident)
            spec = item.get("spec") if item is not None and item.prefix == "IFC" else None
            if isinstance(spec, str) and spec:
                spec = spec.replace(os.sep, "/")
                out.add(spec[len("docs/design/"):] if spec.startswith("docs/design/") else spec)
        return out

    def concerns(self, component, prefix, ident, versions):
        if prefix == "POL" or ident in self.own_ids(component) or ident in self.named_ids(component):
            return True
        mentioned = set()
        for data in versions:
            if data is not None:
                mentioned.update(all_mentions(data))
        if mentioned & self.own_ids(component):
            return True
        return prefix == "DEC" and not any(lib.prefix_of(x) in STRUCTURE for x in mentioned)

    def concerns_text(self, component, text):
        mentioned = set(lib.mentions(text))
        return bool(mentioned & self.own_ids(component)) or not any(lib.prefix_of(x) in STRUCTURE for x in mentioned)

    # reviews

    def own_paths(self, stage):
        return [self.drel(i.path) for i in self.p.stage_own_items(stage.stage, stage.component) if not i.is_entry] + \
            ([self.drel("design-context.yaml")] if stage.stage == 1 else [])

    def review_reasons(self, u, stage):
        changed = self.changed(u.last_run) if u.last_run else None
        own = self.own_paths(stage)
        own_changed = changed is None or bool(changed & set(own))
        accepted, followed = [], []
        for f in self.p.of("FND", active_only=False):
            if f.status != "accepted" or f.get("severity") not in SEVERE:
                continue
            if changed is not None and self.drel(f.path) not in changed:
                continue
            if f.get("to") == stage.skill:
                if (u.stage != 4 or self.concerns_finding(f, u.component)) and own_changed:
                    accepted.append("%s (%s)" % (f.id, f.get("severity")))
            elif f.get("raised_in") == u.report and stage.last_run and \
                    stage_index(lib.SKILL_STAGE.get(f.get("to"))) < stage_index(u.stage):
                change = self.git.last_change(self.drel(f.path))
                if change and change != stage.last_run and self.git.is_ancestor(change, stage.last_run) and \
                        self.git.changed_between(change, stage.last_run, own):
                    followed.append("%s (%s)" % (f.id, f.get("severity")))
        out = []
        if accepted:
            out.append("%s accepted findings addressed to it since this review: %s" % (stage.label,
                                                                                       ", ".join(accepted)))
        if followed:
            out.append("%s changed its items after an earlier stage accepted findings that this review raised: %s"
                       % (stage.label, ", ".join(followed)))
        return out

    # since the start of an invocation

    def owner_stage(self, rel, data):
        """(stage, component) of the stage that writes a design file; (None, None) for one that no stage owns."""
        parts = rel.split("/")
        if rel == "design-context.yaml":
            return 1, None
        if len(parts) != 2 or parts[0] not in ITEM_DIRS:
            return None, None
        prefix = ITEM_DIRS[parts[0]]
        stage = self.item_stage(prefix, data)
        if stage != 4:
            return stage, None
        if prefix == "MOD":
            return 4, (data or {}).get("component")
        ident = parts[1][:-5]
        for c in self.component_ids:
            if any(d.id == ident for d in self.p.stage4_decisions_of(c)):
                return 4, c
        return 4, None

    def since(self, start):
        commits = self.git.commits_since(start)
        position = dict((c, n) for n, c in enumerate(commits))
        runs = dict((u.key, []) for u in self.units)
        changes = {}
        inputs = {}  # commit -> the stages whose inputs it changed (ORDER indexes), as a set
        closed = {}  # commit -> the critical findings it closed, as Items
        for c in commits:
            subject = self.git.subject(c)
            touched = set()
            reached = set()
            for old, new, status, path in self.git.diff_tree(c, self.inputs()):
                if self.quality_rel is not None and self.under(path, self.quality_rel):
                    reached.update(range(len(ORDER)))
                    continue
                rel = path[len(self.design_rel) + 1:] if self.design_rel else path
                touched.add(rel)
                changes.setdefault(rel, []).append((c, old, new, status))
                data = parse(self.git.blob(new)) or parse(self.git.blob(old))
                stage, _ = self.owner_stage(rel, data)
                if stage is not None:
                    reached.update(range(stage_index(stage) + 1, len(ORDER)))
                    if stage == 1 and rel == "design-context.yaml":
                        reached.add(0)
                if rel.startswith("fnd/"):
                    a, b = parse(self.git.blob(old)), parse(self.git.blob(new))
                    if a and b and b.get("severity") == "critical" and a.get("status") == "open" \
                            and b.get("status") in ("accepted", "rejected"):
                        closed.setdefault(c, []).append(lib.Item(str(b.get("id")), "design", rel, b))
            inputs[c] = reached
            for u in self.units:
                if starts_with_skill(subject, u.skill) and u.report in touched:
                    runs[u.key].append(c)
        rounds = {}
        for u in self.units:
            count = len([c for c in runs[u.key] if u.kind == "stage" and any(
                f.get("to") == u.skill and (u.stage != 4 or u.component in self.finding_components(f))
                for f in closed.get(c, []))])
            if count:
                rounds[u.key] = count
        oscillation, judge = [], []
        for revert in self.reverts(changes, start):
            why = self.explained(revert, commits, position, inputs)
            if why:
                revert["why"] = why
                judge.append(revert)
            else:
                oscillation.append(revert)
        return {"start": start, "commits": commits,
                "runs": dict((k, v) for k, v in runs.items() if v),
                "critical_rounds": rounds,
                "oscillation": oscillation,
                "reverts_to_judge": judge,
                "repeats": self.repeats(changes, position)}

    def explained(self, revert, commits, position, inputs):
        """Why a field may have gone back for a good reason, or None: an input of its stage changed in between, or
        the run that changed it back applied answers."""
        rel = revert["file"]
        data = parse(self.read_root(self.drel(rel)))
        stage, component = self.owner_stage(rel, data)
        if stage is None or rel.startswith(("fnd/", "hnd/")):
            return None
        a, b = position.get(revert["changed_in"], -1), position.get(revert["back_in"], -1)
        for c in commits[a + 1:b]:
            if stage_index(stage) in inputs.get(c, set()):
                return "an input of %s changed in %s" % (stage_name(stage), self.git.short(c))
        unit = self.unit("stage", stage, component if stage == 4 else None)
        if unit is not None and b > 0:
            before = self.git.show(commits[b - 1], self.drel(unit.report))
            if before is not None and tables_mod.report_status(before, self.g) == "waiting for answers":
                return "the run that changed it back applied answers to the questions of %s" % unit.label
        return None

    def versions(self, seq, start):
        """[(commit, data)] of a file: as it was before the first change, then after each change."""
        out = [(start, parse(self.git.blob(seq[0][1])))]
        for commit, old, new, status in seq:
            out.append((commit, None if status == "D" else parse(self.git.blob(new))))
        return out

    def reverts(self, changes, start):
        out = []
        for rel, seq in sorted(changes.items()):
            parts = rel.split("/")
            series = {}  # ID -> [(commit, data)]
            if rel == "design-context.yaml":
                for commit, data in self.versions(seq, start):
                    seen = set()
                    for key, _ in lib.CONTEXT_LISTS:
                        for e in lib.as_list((data or {}).get(key)):
                            if isinstance(e, dict) and isinstance(e.get("id"), str):
                                series.setdefault(e["id"], []).append((commit, e))
                                seen.add(e["id"])
                    for ident in series:
                        if ident not in seen:
                            series[ident].append((commit, None))
            elif len(parts) == 2 and parts[0] in ITEM_DIRS and ITEM_DIRS[parts[0]] not in NO_REVERTS \
                    and parts[1].endswith(".yaml"):
                series[parts[1][:-5]] = self.versions(seq, start)
            for ident, vs in sorted(series.items(), key=lambda kv: lib.id_key(kv[0])):
                fields = set()
                for _, data in vs:
                    fields.update(k for k in (data or {}) if k not in BOOKKEEPING)
                for field in sorted(fields):
                    values = []
                    for commit, data in vs:
                        value = MISSING if data is None or field not in data else json.dumps(
                            data.get(field), sort_keys=True, ensure_ascii=False, default=str)
                        if values and values[-1][0] == value:
                            continue
                        values.append((value, commit))
                    for k in range(2, len(values)):
                        if values[k][0] in EMPTY_VALUES:
                            continue  # something added and then dropped, such as a debt an answer made moot
                        earlier = [j for j in range(k - 1) if values[j][0] == values[k][0]]
                        if earlier:
                            j = earlier[-1]
                            out.append({"id": ident, "field": field, "changed_in": values[j + 1][1],
                                        "back_in": values[k][1], "file": rel})
                            break
        return out

    def repeats(self, changes, position):
        """New findings that may raise again what a finding rejected in these commits raised. A finding accepted
        and then undone shows as a field that goes back to its value instead."""
        new, closed = [], {}
        for rel, seq in changes.items():
            if not rel.startswith("fnd/"):
                continue
            for n, (commit, old, blob, status) in enumerate(seq):
                a, b = parse(self.git.blob(old)), parse(self.git.blob(blob))
                if n == 0 and a is None and b is not None:
                    new.append((commit, b))
                if a and b and a.get("status") == "open" and b.get("status") == "rejected":
                    closed[str(b.get("id"))] = (commit, b)
        out = []
        for commit, f in new:
            for gid, (when, g) in sorted(closed.items(), key=lambda kv: lib.id_key(kv[0])):
                if gid == str(f.get("id")) or f.get("to") != g.get("to"):
                    continue
                shared = set(lib.as_list(f.get("targets"))) & set(lib.as_list(g.get("targets")))
                if shared and position.get(when, -1) < position.get(commit, -1):
                    out.append({"id": str(f.get("id")), "raised_in": commit, "like": gid, "closed_in": when,
                                "targets": sorted((x for x in shared if isinstance(x, str)), key=lib.id_key)})
        return out

    # what makes a stage stale later

    def stale_when_applied(self, request):
        """The stages that become stale once the quality chain applies a request: every stage that has run reads the
        quality chain whole, and a component of stage 4 whose items name a target of the request or the request."""
        targets = set(x for x in lib.as_list(request.get("targets")) if isinstance(x, str))
        out = []
        for u in self.units:
            if u.kind != "stage" or not u.exists:
                continue
            if u.stage != 4 or (self.named_ids(u.component) & (targets | set([request.id]))):
                out.append(u)
        return out

    def later(self):
        requests = []
        for q in self.p.of("QCR", active_only=False):
            if q.status not in ("open", "answered"):
                continue
            names = [q.id] + [x for x in lib.as_list(q.get("targets")) if lib.prefix_of(x) == "QAS"]
            items = set()
            for name in names:
                items.update(self.p.dependents(name))
            requests.append({"id": q.id, "title": one_line(q.get("title")), "status": q.status,
                             "impact": q.get("impact"), "stages": [u.label for u in self.stale_when_applied(q)],
                             "items": sorted((i.id for i in items), key=lib.id_key)})
        handoffs = []
        for h in self.p.of("HND", active_only=False):
            if h.status != "open" or h.get("to") not in lib.SKILL_STAGE or h.id in self.due_handoffs:
                continue
            stage = lib.SKILL_STAGE[h.get("to")]
            label = stage_name(stage) + (" %s" % h.get("component") if stage == 4 and h.get("component") else "")
            handoffs.append({"id": h.id, "to": label, "trigger": one_line(h.get("trigger")),
                             "title": one_line(h.get("title"))})
        minor = {}
        for f in self.p.of("FND", active_only=False):
            if f.status == "open" and f.get("severity") == "minor" and f.get("to") in lib.SKILL_STAGE:
                stage = lib.SKILL_STAGE[f.get("to")]
                minor.setdefault(stage_name(stage), []).append(f.id)
        return {"requests": requests, "handoffs": handoffs, "minor_findings": minor,
                "unplaced_findings": list(self.unplaced)}

    def assumptions(self):
        out = []
        for d in self.p.of("DAS", active_only=False):
            if d.status == "open":
                out.append(d)
        for q in self.p.of("QAS", active_only=False):
            if q.status == "open" and self.p.dependents(q.id):
                out.append(q)

        def rank(item):
            b, s = RATING.get(item.get("breadth"), 0), RATING.get(item.get("severity"), 0)
            return (-(b + s), -max(b, s), lib.id_key(item.id))

        return [{"id": a.id, "title": one_line(a.get("title")), "stage": str(a.get("stage")),
                 "kind": a.get("kind"), "breadth": a.get("breadth"), "severity": a.get("severity"),
                 "items": [i.id for i in self.p.dependents(a.id)]} for a in sorted(out, key=rank)]


def text_output(chain, since=None, questions=False, summary=False):
    p, git = chain.p, chain.git
    lines = []
    quality = p.quality_dir if p.has_quality else "not found"
    if not os.path.isdir(p.design_dir):
        where = "does not exist yet"
    elif git.root and git.head:
        dirty = git.dirty(chain.inputs())
        where = "at %s%s" % (git.short(git.head), ", %d uncommitted change(s) under the design and the quality chain"
                             % dirty if dirty else "")
    elif git.root:
        where = "in a repository with no commit yet"
    else:
        where = "not under git"
    lines.append("status.py: %s %s; quality chain: %s" % (p.design_dir, where, quality))
    lines.append("")
    width = max(len(u.label) for u in chain.units)
    for u in chain.units:
        state = u.state
        if u.blocked_by is not None and u.state != "up to date":
            state += " (after %s)" % u.blocked_by.label
        if u.state == "waiting":
            state += ": question%s %s" % ("s" if len(u.waiting_rows) > 1 else "", ", ".join(u.waiting_rows))
        lines.append("%-*s  %-7s  %s" % (width, u.label, git.short(u.last_run) if u.last_run else "—", state))
        for reason in u.reasons:
            lines.append("%-*s    - %s" % (width, "", reason))
        for note in u.notes:
            lines.append("%-*s    (%s)" % (width, "", note))
    if chain.unplaced:
        lines.append("")
        lines.append("Findings addressed to stage 4 that name no component (by the report they were raised in, or"
                     " the items they target), so no component's run takes them up: %s. Name the component in"
                     " their targets." % ", ".join(chain.unplaced))
    lines.append("")
    if chain.next:
        first = chain.next[0]
        lines.append("Next: %s (%s)" % (first.label, first.skill))
        others = [u for u in chain.next[1:]]
        if others:
            lines.append("Also ready, one at a time after it: %s" % ", ".join(u.label for u in others))
    elif chain.waiting:
        lines.append("Next: nothing can run until questions are answered")
    else:
        lines.append("Next: nothing; every stage and review is up to date")
    if chain.waiting:
        lines.append("Waiting for answers: %s" % "; ".join("%s (question%s %s)" % (
            u.label, "s" if len(u.waiting_rows) > 1 else "", ", ".join(u.waiting_rows)) for u in chain.waiting))
    if since is not None:
        label = dict((u.key, u.label) for u in chain.units)
        lines.append("")
        lines.append("Since %s:" % git.short(since["start"]))
        runs = since["runs"]
        total = sum(len(v) for v in runs.values())
        lines.append("  runs: %d%s" % (total, (" (" + ", ".join("%s %d" % (label.get(k, k), len(v))
                                                                  for k, v in runs.items()) + ")") if runs else ""))
        rounds = since["critical_rounds"]
        lines.append("  runs that closed critical findings: %s" % (", ".join(
            "%s %d" % (label.get(k, k), v) for k, v in rounds.items()) if rounds else "none"))
        if since["oscillation"]:
            lines.append("  oscillation:")
            for o in since["oscillation"]:
                lines.append("    - %s %s went back to its value before %s, in %s (%s)" % (
                    o["id"], o["field"], git.short(o["changed_in"]), git.short(o["back_in"]), o["file"]))
        else:
            lines.append("  oscillation: none")
        for o in since["reverts_to_judge"]:
            lines.append("  went back, to judge: %s %s went back to its value before %s, in %s; %s" % (
                o["id"], o["field"], git.short(o["changed_in"]), git.short(o["back_in"]), o["why"]))
        for r in since["repeats"]:
            lines.append("  possible repeat: %s (raised in %s) targets %s, as %s did, which was rejected in %s:"
                         " compare them" % (r["id"], git.short(r["raised_in"]), id_list(r["targets"]), r["like"],
                                            git.short(r["closed_in"])))
    if questions:
        lines.append("")
        lines.append("Questions waiting for answers:")
        shown = False
        for u in chain.units:
            for row in u.questions():
                if row["waiting"]:
                    shown = True
                    lines.append("  %s, question %s (%s)" % (u.label, row["number"], u.report))
                    for name in ("question", "why_unsure", "options", "items"):
                        lines.append("    %s: %s" % (name.replace("_", " "), row.get(name, "")))
        if not shown:
            lines.append("  none")
    if summary:
        later = chain.later()
        lines.append("")
        lines.append("Requests to the quality chain, open or answered (quality-chain-requests.md):")
        for r in later["requests"] or []:
            lines.append("  - %s %s (%s, impact %s): once the quality chain applies it, %s; items that depend on it:"
                         " %s" % (r["id"], r["title"], r["status"], r["impact"],
                                  ("%s become%s stale" % (", ".join(r["stages"]), "s" if len(r["stages"]) == 1 else ""))
                                  if r["stages"] else "no stage has run to become stale",
                                  id_list(r["items"]) or "none"))
        if not later["requests"]:
            lines.append("  none")
        lines.append("Hand-offs waiting for their trigger:")
        for h in later["handoffs"] or []:
            lines.append("  - %s to %s: %s (trigger: %s)" % (h["id"], h["to"], h["title"], h["trigger"]))
        if not later["handoffs"]:
            lines.append("  none")
        lines.append("Minor findings waiting for the next run of the stage they are addressed to:")
        for stage, ids in sorted(later["minor_findings"].items()):
            lines.append("  - %s: %s" % (stage, id_list(ids)))
        if not later["minor_findings"]:
            lines.append("  none")
        lines.append("Open assumptions, highest first:")
        assumptions = chain.assumptions()
        for a in assumptions:
            lines.append("  - %s (%s, %s; breadth %s, severity %s) %s; items: %s" % (
                a["id"], "stage " + a["stage"] if a["id"].startswith("DAS") else "quality-chain stage " + a["stage"],
                a["kind"], a["breadth"], a["severity"], a["title"], id_list(a["items"]) or "—"))
        if not assumptions:
            lines.append("  none")
    return "\n".join(lines)


def json_output(chain, since=None):
    git = chain.git
    out = {"design": chain.p.design_dir, "quality": chain.p.quality_dir if chain.p.has_quality else None,
           "git": bool(git.root), "head": git.head,
           "units": [u.as_dict() for u in chain.units],
           "next": [u.key for u in chain.next], "waiting": [u.key for u in chain.waiting],
           "later": chain.later(), "assumptions": chain.assumptions()}
    if since is not None:
        out["since"] = since
    return json.dumps(out, ensure_ascii=False, indent=1)


def main(argv):
    import argparse

    parser = argparse.ArgumentParser(description="Show the state of the design chain.")
    parser.add_argument("--design", default="docs/design")
    parser.add_argument("--quality", default=None)
    parser.add_argument("--since", default=None)
    parser.add_argument("--questions", action="store_true")
    parser.add_argument("--summary", action="store_true")
    parser.add_argument("--format", default="text", choices=("text", "json"))
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    # a design directory that does not exist yet is a chain whose stage 1 has not run; with no quality chain either,
    # the command runs in the wrong place
    quality = args.quality if args.quality is not None else lib.default_quality_dir(args.design)
    if not os.path.isdir(args.design) and not (quality and os.path.isdir(quality)):
        print("status.py: neither a design directory (%s) nor a quality chain was found: run it from the project's"
              " root, or give --design and --quality" % args.design)
        return 2
    project = lib.Project(args.design, quality)
    git = Git(args.design if os.path.isdir(args.design) else os.getcwd())
    chain = Chain(project, lib.Glossary(), git).evaluate()
    since = None
    if args.since:
        if not (git.root and git.head):
            print("status.py: --since needs a git repository with commits")
            return 2
        start = git.resolve(args.since)
        if start is None:
            print("status.py: %s is not a commit" % args.since)
            return 2
        since = chain.since(start)
    if args.format == "json":
        print(json_output(chain, since))
    else:
        print(text_output(chain, since, args.questions, args.summary))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
