#!/usr/bin/env python3
"""Check the design items, specs and reports for what a script can find.

Every problem is listed under the skill that writes the file it is in. A stage
fixes the problems listed under its own name. A problem that only an earlier
stage can fix names that stage; while an open finding addressed to it targets
the item concerned, the problem is shown as waiting for that finding and does
not count.

Usage:
    python3 scripts/check.py [--skill <skill name> | --skill implementation] [--design DIR] [--quality DIR]
                             [--format text|json]

With --skill, the exit status is 1 when that skill's files have problems that
do not wait for a finding, and generated tables are checked only in that
skill's reports (the other reports show the items as of their stage's last
run). Without it, the exit status is 1 when any file has such a problem.
Exit status 2: the design directory is missing or the arguments are wrong.

Rules:
    yaml             the file does not parse
    cut-value        a plain value followed by ' #' on its line: the rest of the line is a comment
    duplicate-key    a key written twice in one mapping; the first value is lost
    id               the file name and the id differ, or an ID is not a prefix and a zero-padded number
    legacy           fields of an earlier version of the skills (changelog, version, needs_agreement,
                     approver_candidates, status draft or agreed)
    missing-field    a field of the item's schema is missing (write null or [] when it has no value)
    bad-value        a value outside its field's allowed values
    unknown-id       an ID that names no item, in a reference field or in text
    wrong-kind       a reference to the wrong kind of item (premises: TC, PC, TEAM, CHG, STK, DAS,
                     CON, EXT, OPF, QAS; functions: FR; runs_on: a node; ...)
    retired-ref      an active item refers to a retired one
    basis            premises with an open DAS, or an open QAS that basis_note does not cite, and the
                     basis is not assumed; or assumed with no such assumption in premises
    orphan-assumption  an open DAS that no item lists in premises
    allocation       FRs, drivers, teams, interface functions, module functions and drivers,
                     operations realized by modules, decisions used by modules
    conflict         a conflict recorded on one driver only
    cycle            module dependencies (depends_on) that form a cycle
    depth            a module at full depth with no depth_reason, or a module at bounds depth with a behaviour
                     section, invariants or parameters (its inside is implementation's)
    debt             a debt without repay_when
    handoff          a hand-off's from, to, component, trigger, origin or resolution; a decided hand-off that
                     no item cites in basis_note
    spec             a spec that is missing (with no hand-off of the schema to implementation), unused
                     or not found, or that differs from its IFC in operations, error statuses or error codes
    finding          a finding's to, raised_by (a skill or implementation), raised_in or resolution; an
                     accepted finding that no item cites in basis_note
    request          a request to the quality chain whose status and answer disagree, or that names no
                     target or quality-chain stage; a QAS that an item treats as answered, with no answered
                     request that carries the answer
    sli-binding      a quality-chain SLI that no IFC or DAT binds, and that the SLI bindings table does not
                     replace by an open or answered request that targets it
    policy           once stage 2b has run (or with --skill for it): a scope with no active POL, or with two; a
                     component in no stack entry or repository of the policies, or in two; a dependency rule with
                     no check; a field of another scope's policy
    gate-binding     once stage 2b has run: a gate NFR of the quality chain that no policy binds, and that the
                     gate bindings table does not replace by an open or answered request that targets it; or a
                     gate binding with no where or no by
    audit-binding    the same for the audit NFRs and audit_bindings
    table            a generated table or the request document is out of date, or a table's markers are
                     wrong (run tables.py)
    empty-cell       a cell of a generated table that the report fills in is empty
    request-edit     an answer, or other text, written by hand in quality-chain-requests.md that the requests
                     do not hold

Problems in quality-chain-requests.md, and in the status and answer of a request, are listed under the
skill given with --skill, since every run rewrites the document and may record answers.
"""

import json
import os
import re
import sys

sys.dont_write_bytecode = True

import design_lib as lib  # noqa: E402
import tables as tables_mod  # noqa: E402

S1, S2, S3, S4 = (lib.STAGE_SKILLS[n] for n in (1, 2, 3, 4))
S2B = lib.STAGE_SKILLS["2b"]
COMMON = ["id", "title", "status", "basis", "basis_note", "premises"]
REQUIRED = {
    "DRV": COMMON + ["kind", "statement", "sources", "concern_of", "scenario", "negotiable", "derived_from",
                     "priority", "primary", "conflicts", "placeholders"],
    "DEC": COMMON + ["stage", "question", "addresses", "options", "chosen", "rationale", "rejected", "gains",
                     "costs", "sensitive_points", "trade_offs", "assumptions", "depends_on", "parameters", "debt",
                     "as_is"],
    "ELM": COMMON + ["kind", "name", "responsibility", "functions", "drivers", "decisions", "team", "technology",
                     "runs_on", "depends_on", "as_is"],
    "IFC": COMMON + ["kind", "name", "provider", "consumers", "functions", "operations", "format", "protocol",
                     "auth", "errors", "idempotency", "timing", "versioning", "observability", "sli_bindings",
                     "spec", "as_is"],
    "DAT": COMMON + ["entity", "owner", "store", "key_attributes", "relations", "consistency", "retention",
                     "classification", "drivers", "sli_bindings", "as_is"],
    "MOD": COMMON + ["component", "name", "depth", "depth_reason", "responsibility", "visibility", "interface",
                     "invariants", "depends_on", "functions", "realizes", "drivers", "decisions", "behaviour",
                     "verification", "parameters", "as_is"],
    "POL": COMMON + ["scope", "addresses", "decisions", "rules", "as_is"],
    "HND": COMMON + ["from", "to", "component", "origin", "what", "bounds", "trigger", "resolution"],
    "FND": COMMON + ["raised_by", "raised_in", "to", "targets", "severity", "evidence", "suggestion",
                     "resolution"],
    "DAS": ["id", "title", "status", "stage", "kind", "statement", "why_unsure", "breadth", "severity",
            "rating_note", "answer", "answered_in"],
    "QCR": ["id", "title", "status", "stage", "targets", "origin", "issue", "suggestion", "quality_stages", "impact",
            "impact_note", "answer", "answered_in"],
}
SCOPE_FIELDS = {  # the fields a POL has besides the common ones, by its scope
    "technology": ["stack"],
    "repository": ["repositories", "dependency_rules"],
    "testing": ["layers", "doubles", "environments", "gate_bindings", "audit_bindings"],
    "pipeline-and-code": ["pipeline"],
    "specs": ["specs"],
    "implementation-feedback": [],
}
RATINGS = ["high", "medium", "low"]
STAGE_VALUES = ["1", "2", "2b", "3", "4", "review-2", "review-2b", "review-3", "review-4"]
ENUMS = {
    "basis": ["stated", "inferred", "assumed", "confirmed"],
    "as_is": ["keep", "change", "new", "remove"],
    ("DRV", "kind"): ["quality", "change", "constraint", "function", "observability", "security", "principle"],
    ("DEC", "stage"): list(lib.DEC_STAGES),
    ("ELM", "kind"): ["component", "data-store", "external-system", "node"],
    ("IFC", "kind"): ["http", "event", "file", "screen", "batch"],
    ("MOD", "visibility"): ["public", "internal"],
    ("MOD", "depth"): ["full", "bounds"],
    ("POL", "scope"): list(lib.POL_SCOPES),
    ("FND", "severity"): ["critical", "major", "minor"],
    ("DAS", "kind"): ["judgment", "decision"],
    ("DAS", "breadth"): RATINGS,
    ("DAS", "severity"): RATINGS,
    ("DAS", "stage"): STAGE_VALUES,
    ("QCR", "stage"): STAGE_VALUES,
    ("QCR", "impact"): ["high", "low"],
    ("TC", "kind"): ["mandated", "prohibited", "platform", "external-service"],
    ("PC", "kind"): ["budget", "deadline", "team", "other"],
}
STATUSES = {"FND": ["open", "accepted", "rejected"], "DAS": ["open", "confirmed", "overturned", "retired"],
            "HND": ["open", "decided", "retired"], "QCR": ["open", "answered", "applied", "withdrawn"]}
LEGACY_FIELDS = ["changelog", "version", "needs_agreement", "approver_candidates"]
LEGACY_DEC_FIELDS = ["deferred", "revisit_when"]  # a deferral is a hand-off now
PREMISE_PREFIXES = ["TC", "PC", "TEAM", "CHG", "STK", "DAS", "QCR", "CON", "EXT", "OPF", "QAS"]
OWN_FIELDS = ("DAS", "QCR")  # item types with their own fields instead of the common ones
REQUESTS_OWNER = "every skill (each run rewrites %s)" % lib.REQUESTS_DOC
REFS = {
    "DRV": [("sources", None), ("concern_of", ["USR", "STK"]), ("derived_from", ["DRV"]),
            ("conflicts[].with", ["DRV"])],
    "DEC": [("addresses", ["DRV", "IFC", "DAT", "ELM", "MOD", "DEC", "FND", "FR", "QR", "NFR", "SLI"]),
            ("depends_on", ["DEC"]), ("trade_offs[].with", ["DRV"])],
    "ELM": [("functions", ["FR"]), ("drivers", ["DRV"]), ("decisions", ["DEC"]), ("team", ["TEAM"]),
            ("runs_on", ["ELM:node"]), ("depends_on", ["ELM"])],
    "IFC": [("provider", ["ELM"]), ("consumers", ["ELM", "USR"]), ("functions", ["FR"]),
            ("sli_bindings[].sli", ["SLI"])],
    "DAT": [("owner", ["ELM"]), ("store", ["ELM:data-store"]), ("relations[].to", ["DAT"]),
            ("drivers", ["DRV"]), ("sli_bindings[].sli", ["SLI"])],
    "MOD": [("component", ["ELM:component"]), ("depends_on", ["MOD"]), ("functions", ["FR"]),
            ("drivers", ["DRV"]), ("decisions", ["DEC"])],
    "POL": [("addresses", ["DRV", "QR"]), ("decisions", ["DEC"]), ("stack[].elements", ["ELM:component"]),
            ("repositories[].holds", ["ELM"]),
            ("gate_bindings[].nfr", ["NFR:gate"]), ("audit_bindings[].nfr", ["NFR:audit"])],
    "HND": [("component", ["ELM:component"]), ("origin", None)],
    "FND": [("targets", lib.DESIGN_PREFIXES)],
    "DAS": [],
    "QCR": [("targets", lib.QUALITY_PREFIXES), ("origin", lib.DESIGN_PREFIXES)],
}
SPEC_MADE = ["by-hand", "from-code", "owner", "none"]
HTTP_METHODS = ["get", "put", "post", "delete", "patch", "head", "options", "trace"]
OP_RE = re.compile(r"(GET|PUT|POST|DELETE|PATCH|HEAD|OPTIONS|TRACE)\s+(/\S*)")
STATUS_RE = re.compile(r"\s*([1-5][0-9]{2})(?![0-9])")
CODE_RE = re.compile(r"(?<![A-Za-z0-9_])([A-Z][A-Z0-9]*_[A-Z0-9_]+|[A-Z]{4,})(?![A-Za-z0-9_])")


class Problem(object):
    def __init__(self, rule, path, line, message, owner, upstream=None):
        self.rule = rule
        self.path = path
        self.line = line
        self.message = message
        self.owner = owner
        self.upstream = upstream  # (skill, [ids]) when an earlier stage may have to make the fix
        self.waiting = None  # the open finding that covers it

    def as_dict(self):
        return {"rule": self.rule, "path": self.path, "line": self.line, "message": self.message,
                "owner": self.owner, "waiting_for": self.waiting,
                "upstream": self.upstream[0] if self.upstream else None}


class Checker(object):
    def __init__(self, project, glossary, skill=None):
        self.p = project
        self.g = glossary
        self.skill = skill
        self.problems = []
        self.rendered = {}  # report -> its generated tables
        self.carried = set()  # the QAS whose answer an answered request carries to the quality chain
        for q in project.of("QCR", active_only=False):
            if q.status in ("answered", "applied"):
                self.carried.update(t for t in lib.as_list(q.get("targets")) if lib.prefix_of(t) == "QAS")

    def add(self, rule, path, line, message, owner, upstream=None):
        self.problems.append(Problem(rule, path, line, message, owner, upstream))

    def item_problem(self, rule, item, key, message, owner=None, upstream=None):
        owner = owner if owner is not None else self.p.owner(item)
        self.add(rule, item.path, item.line_of(key), message, owner, upstream)

    def run(self):
        self.files()
        for item in sorted(self.p.design_items(), key=lambda i: (i.path, lib.id_key(i.id))):
            self.fields(item)
            self.references(item)
            self.basis(item)
        self.duplicates()
        self.orphans()
        self.allocation()
        self.conflicts()
        self.specs()
        self.findings()
        self.handoffs()
        self.requests()
        self.reports()
        self.request_doc()
        self.sli_bindings()
        self.policies()
        self.nfr_bindings()
        self.cover()
        return self.problems

    # files

    def file_owner(self, f):
        owner = lib.path_owner(f.rel)
        if owner:
            return owner
        m = re.search(r"^stage:\s*['\"]?([A-Za-z0-9-]+)", f.text, re.M)
        if f.rel.startswith("dec/") and m:
            return lib.STAGE_SKILLS.get(lib.DEC_STAGES.get(m.group(1)))
        if f.rel.startswith(("das/", "qcr/")) and m:
            return lib.das_owner(m.group(1))
        m = re.search(r"^raised_by:\s*['\"]?([A-Za-z0-9-]+)", f.text, re.M)
        if f.rel.startswith("fnd/") and m and m.group(1) in lib.SKILLS + [lib.IMPLEMENTATION]:
            return m.group(1)
        m = re.search(r"^from:\s*['\"]?([A-Za-z0-9-]+)", f.text, re.M)
        if f.rel.startswith("hnd/") and m and m.group(1) in lib.SKILLS:
            return m.group(1)
        return None

    def files(self):
        for f in self.p.files:
            if f.chain != "design":
                continue
            owner = self.file_owner(f)
            if f.error is not None:
                self.add("yaml", f.rel, f.error.line, f.error.message, owner)
                continue
            for note in f.document.notes:
                if note.kind == "comment-after-value":
                    self.add("cut-value", f.rel, note.line,
                             "%s is followed by ' #' on its line, so the rest of the line is a comment: quote the"
                             " value if the text goes on, or put the comment on its own line"
                             % (note.path or "the value"), owner)
                elif note.kind == "duplicate-key":
                    self.add("duplicate-key", f.rel, note.line,
                             "%s is written twice in one mapping; only the last value is read" % note.path, owner)
            parts = f.rel.split("/")
            is_item = len(parts) == 2 and parts[0] in dict(lib.DESIGN_DIRS)
            if is_item and not isinstance(f.data, dict):
                self.add("yaml", f.rel, 1, "an item file holds one mapping (id, title, status, ...)", owner)
            elif is_item:
                stem = os.path.splitext(os.path.basename(f.rel))[0]
                ident = f.data.get("id")
                prefix = dict(lib.DESIGN_DIRS)[f.rel.split("/")[0]]
                if ident != stem:
                    self.add("id", f.rel, f.document.key_lines.get("id", 1),
                             "the id is %r and the file name is %s; they must be the same" % (ident, stem), owner)
                if not lib.is_id(stem) or lib.prefix_of(stem) != prefix:
                    self.add("id", f.rel, 1, "the file name is not %s- followed by a zero-padded number" % prefix,
                             owner)
        if self.p.context is not None and self.p.context.data is not None:
            seen = {}
            for key, prefix in lib.CONTEXT_LISTS:
                for entry in lib.as_list(self.p.context.data.get(key)):
                    ident = entry.get("id") if isinstance(entry, dict) else None
                    if not isinstance(ident, str) or lib.prefix_of(ident) != prefix:
                        self.add("id", "design-context.yaml", 1,
                                 "an entry of %s has no id of the form %s-01: %r" % (key, prefix, ident), S1)
                    elif ident in seen:
                        self.add("id", "design-context.yaml", 1, "%s is used twice" % ident, S1)
                    seen[ident] = True

    def duplicates(self):
        for item, first in self.p.duplicates:
            self.add("id", item.path, item.line, "%s is also the ID of %s" % (item.id, first.path), self.p.owner(item))

    # one item's fields

    def fields(self, item):
        p = item.prefix
        if item.is_entry:
            self.entry_fields(item)
            return
        status = item.get("status")
        legacy = [k for k in LEGACY_FIELDS + (LEGACY_DEC_FIELDS if p == "DEC" else []) if k in item.data]
        legacy_status = p not in ("FND", "DAS", "HND", "QCR") and status in ("draft", "agreed")
        if legacy or legacy_status:
            what = legacy + (["status: %s" % status] if legacy_status else [])
            self.item_problem("legacy", item, legacy[0] if legacy else "status",
                              "content in the form of an earlier version of the skills: %s. Move it into the current"
                              " form (conventions.md, 'Re-running a stage'): drop the fields, write a hand-off for a"
                              " deferral, and set draft or agreed to active" % ", ".join(what))
        missing = [k for k in REQUIRED.get(p, []) if k not in item.data]
        if missing:
            self.item_problem("missing-field", item, "id", "missing %s (write null or [] when there is no value)"
                              % ", ".join(missing))
        allowed = STATUSES.get(p, ["active", "retired"])
        if "status" in item.data and status not in allowed and not legacy_status:
            self.item_problem("bad-value", item, "status", "status is %r; allowed: %s" % (status, ", ".join(allowed)))
        if "basis" in item.data and p not in OWN_FIELDS and item.get("basis") not in ENUMS["basis"]:
            self.item_problem("bad-value", item, "basis", "basis is %r; allowed: %s"
                              % (item.get("basis"), ", ".join(ENUMS["basis"])))
        if "as_is" in item.data and item.get("as_is") not in ENUMS["as_is"]:
            self.item_problem("bad-value", item, "as_is", "as_is is %r; allowed: %s"
                              % (item.get("as_is"), ", ".join(ENUMS["as_is"])))
        for (prefix, key), values in ((k, v) for k, v in ENUMS.items() if isinstance(k, tuple)):
            if prefix == p and key in item.data:
                value = item.get(key)
                value = str(value) if key == "stage" and p in OWN_FIELDS else value
                if value not in values:
                    self.item_problem("bad-value", item, key, "%s is %r; allowed: %s" % (key, value, ", ".join(values)))
        if p == "QCR" and "quality_stages" in item.data:
            stages = lib.as_list(item.get("quality_stages"))
            if (not stages and self.p.has_quality) or any(str(s) not in ("1", "2", "3", "4") for s in stages):
                self.item_problem("bad-value", item, "quality_stages", "quality_stages is %r; it lists the quality-chain"
                                  " stages that would make the change, from 1 to 4" % (item.get("quality_stages"),))
        if p == "QCR" and "targets" in item.data and not lib.as_list(item.get("targets")):
            self.item_problem("request", item, "targets", "targets names the quality-chain items the request asks to"
                                                          " change, or that show what is missing (without a quality"
                                                          " chain, the source of the requirement)")
        if p == "DRV":
            priority = item.get("priority")
            if isinstance(priority, dict):
                for key in ("business", "difficulty"):
                    if priority.get(key) not in RATINGS:
                        self.item_problem("bad-value", item, "priority", "priority.%s is %r; allowed: %s"
                                          % (key, priority.get(key), ", ".join(RATINGS)))
            elif priority is not None:
                self.item_problem("bad-value", item, "priority",
                                  "priority is a mapping (business, difficulty, rank, ...) or null for a principle")
            if "primary" in item.data and not isinstance(item.get("primary"), bool):
                self.item_problem("bad-value", item, "primary", "primary is true or false")
            if item.get("negotiable") not in (True, False, None):
                self.item_problem("bad-value", item, "negotiable", "negotiable is true, false or null")
        if p == "DEC":
            debt = item.get("debt")
            if debt and (not isinstance(debt, dict) or not debt.get("repay_when")):
                self.item_problem("debt", item, "debt", "a debt needs what, why_accepted and repay_when")
        if p == "POL":
            self.policy_fields(item)
        if p == "MOD":
            depth = item.get("depth")
            if depth == "full" and not item.get("depth_reason"):
                self.item_problem("depth", item, "depth_reason", "a module at full depth says in depth_reason which"
                                                                 " kind it is, or why it would rate high at bounds"
                                                                 " depth")
            if depth == "bounds":
                kept = [k for k in ("behaviour", "invariants", "parameters") if item.get(k)]
                if kept:
                    self.item_problem("depth", item, kept[0], "a module at bounds depth leaves its inside to"
                                                              " implementation: write %s as null or []"
                                                              % ", ".join(kept))

    def policy_fields(self, item):
        scope = item.get("scope")
        if not isinstance(scope, str) or scope not in SCOPE_FIELDS:
            return  # reported as a bad value of scope
        own = SCOPE_FIELDS[scope]
        missing = [k for k in own if k not in item.data]
        if missing:
            self.item_problem("missing-field", item, "scope", "missing %s, which a policy of scope %s has (write []"
                                                              " when there is no value)" % (", ".join(missing), scope))
        foreign = [k for s, fields in SCOPE_FIELDS.items() if s != scope for k in fields if k in item.data]
        if foreign:
            owners = ", ".join("%s (%s)" % (k, next(s for s, f in SCOPE_FIELDS.items() if k in f)) for k in foreign)
            self.item_problem("policy", item, foreign[0], "%s belong%s to the policy of another scope: %s"
                              % (", ".join(foreign), "s" if len(foreign) == 1 else "", owners))
        for n, entry in enumerate(lib.as_list(item.get("rules")), 1):
            if not isinstance(entry, dict) or not entry.get("rule"):
                self.item_problem("policy", item, "rules", "rules entry %d is {rule, check}, with the rule written" % n)
        for n, entry in enumerate(lib.as_list(item.get("dependency_rules")), 1):
            if not isinstance(entry, dict) or not entry.get("rule") or not entry.get("check"):
                self.item_problem("policy", item, "dependency_rules", "dependency rule %d needs the rule and the check"
                                                                      " in CI that enforces it" % n)
        for n, entry in enumerate(lib.as_list(item.get("specs")), 1):
            made = entry.get("made") if isinstance(entry, dict) else None
            if made not in SPEC_MADE:
                self.item_problem("bad-value", item, "specs", "specs entry %d: made is %r; allowed: %s"
                                  % (n, made, ", ".join(SPEC_MADE)))
        for field, rule in (("gate_bindings", "gate-binding"), ("audit_bindings", "audit-binding")):
            for n, entry in enumerate(lib.as_list(item.get(field)), 1):
                lacking = [k for k in ("nfr", "where", "by") if not (isinstance(entry, dict) and entry.get(k))]
                if lacking:
                    self.item_problem(rule, item, field, "%s entry %d has no %s" % (field, n, ", ".join(lacking)))

    def entry_fields(self, item):
        for key in ("basis",):
            if key in item.data and item.get(key) not in ENUMS["basis"]:
                self.item_problem("bad-value", item, key, "%s: basis is %r; allowed: %s"
                                  % (item.id, item.get(key), ", ".join(ENUMS["basis"])))
        values = ENUMS.get((item.prefix, "kind"))
        if values and item.get("kind") not in values:
            self.item_problem("bad-value", item, "kind", "%s: kind is %r; allowed: %s"
                              % (item.id, item.get("kind"), ", ".join(values)))

    # references

    def ref_values(self, item, field):
        if field.endswith("]"):
            return []
        if "[]." in field:
            parent, child = field.split("[].")
            out = []
            for entry in lib.as_list(item.get(parent)):
                if isinstance(entry, dict) and entry.get(child) is not None:
                    value = entry.get(child)
                    out.extend(value if isinstance(value, list) else [value])
            return out
        return lib.as_list(item.get(field))

    def references(self, item):
        if item.is_entry:
            self.text_mentions(item, skip=())
            self.entry_basis(item)
            return
        fields = list(REFS.get(item.prefix, []))
        if item.prefix not in OWN_FIELDS:
            fields.append(("premises", PREMISE_PREFIXES))
        check_retired = (not item.retired and item.prefix != "FND" and (item.prefix != "HND" or item.status == "open")
                         and (item.prefix != "QCR" or item.status in ("open", "answered")))
        for field, allowed in fields:
            for value in self.ref_values(item, field):
                self.reference(item, field, value, allowed, check_retired)
        skip = set()
        for field, _ in fields:
            skip.add((field.split("[]")[0],) if "[]." not in field else
                     (field.split("[].")[0], "[]", field.split("[].")[1]))
        skip.add(("id",))
        if item.prefix == "MOD":
            skip.add(("realizes",))
        self.text_mentions(item, skip)

    def reference(self, item, field, value, allowed, check_retired):
        key = field.split("[]")[0]
        if not isinstance(value, str) or not lib.is_id(value):
            design_only = allowed is not None and all(a.split(":")[0] in lib.DESIGN_PREFIXES for a in allowed)
            if design_only or (self.p.has_quality and allowed is not None):
                self.item_problem("wrong-kind", item, key, "%s holds %r, which is not an ID" % (field, value))
            return
        prefix = lib.prefix_of(value)
        target = self.p.get(value)
        if allowed is not None and prefix not in [a.split(":")[0] for a in allowed]:
            names = sorted(set(a.split(":")[0] for a in allowed))
            self.item_problem("wrong-kind", item, key, "%s holds %s; it takes %s" % (field, value, ", ".join(names)))
            return
        if target is None:
            if prefix in lib.QUALITY_PREFIXES and not self.p.has_quality:
                return
            self.item_problem("unknown-id", item, key, "%s names %s, which does not exist" % (field, value))
            return
        kinds = [a.split(":")[1] for a in (allowed or []) if a.startswith(prefix + ":")]
        if kinds and target.get("kind") not in kinds:
            what = "an element" if prefix == "ELM" else "an %s" % prefix
            self.item_problem("wrong-kind", item, key, "%s names %s, %s of kind %s; it takes %s"
                              % (field, value, what, target.get("kind"), " or ".join(kinds)))
        if check_retired and target.retired:
            self.item_problem("retired-ref", item, key, "%s names %s, which is retired" % (field, value))

    def text_mentions(self, item, skip):
        reported = set()
        for path, text in lib.strings_in(item.data, skip):
            for ident in lib.mentions(text):
                if ident in reported or self.p.get(ident) is not None:
                    continue
                if lib.prefix_of(ident) in lib.QUALITY_PREFIXES and not self.p.has_quality:
                    continue
                reported.add(ident)
                where = path[0] if path else "the item"
                self.item_problem("unknown-id", item, where if not item.is_entry else "id",
                                  "%s mentions %s, which does not exist" % ("/".join(p for p in path if p != "[]")
                                                                             or where, ident))

    # basis and assumptions

    def basis(self, item):
        if item.is_entry or item.prefix in OWN_FIELDS or "premises" not in item.data:
            return
        if item.prefix in ("FND", "HND") and item.status != "open":
            return
        if item.retired:
            return
        premises = self.p.premises(item)
        cited = lib.mentions(item.get("basis_note"))
        open_das = [x for x in premises if lib.prefix_of(x) == "DAS" and self.p.is_open_assumption(x)]
        open_qas = [x for x in premises if lib.prefix_of(x) == "QAS" and self.p.is_open_assumption(x)]
        uncited = [x for x in open_qas if x not in cited]
        basis = item.get("basis")
        if (open_das or uncited) and basis != "assumed":
            what = open_das + ["%s (not cited in basis_note as answered)" % x for x in uncited]
            self.item_problem("basis", item, "basis", "premises include the open %s, so basis is assumed, not %s"
                              % (", ".join(what), basis))
        if basis == "assumed" and not open_das and not open_qas:
            self.item_problem("basis", item, "basis", "basis is assumed, but premises name no open DAS or QAS: list"
                              " the assumption in premises, or mark the basis that holds (a QCR in premises does"
                              " not make an item assumed)")
        if basis != "assumed" and self.p.has_quality:
            for x in open_qas:
                if x in cited and x not in self.carried:
                    self.item_problem("request", item, "basis_note",
                                      "basis_note cites %s as answered, and no answered request to the quality chain"
                                      " carries the answer: write a QCR with %s in targets (conventions.md,"
                                      " 'Assumptions')" % (x, x))

    def entry_basis(self, item):
        sources = lib.mentions(item.get("source"))
        open_das = [x for x in sources if lib.prefix_of(x) == "DAS" and self.p.is_open_assumption(x)]
        if open_das and item.get("basis") != "assumed":
            self.item_problem("basis", item, "id", "%s: its source names the open %s, so basis is assumed"
                              % (item.id, ", ".join(open_das)))
        if item.get("basis") == "assumed" and not open_das:
            self.item_problem("basis", item, "id", "%s: basis is assumed, but its source names no open DAS" % item.id)

    def orphans(self):
        for d in self.p.of("DAS", active_only=False):
            if d.status == "open" and not self.p.dependents(d.id):
                self.item_problem("orphan-assumption", d, "status",
                                  "no item lists this open assumption in premises: add it to the premises of the items"
                                  " that rest on it, or set status: retired when nothing does")

    # allocation across items

    def allocation(self):
        p = self.p
        components = p.components()
        elements = p.of("ELM")
        comp_ids = set(c.id for c in components)
        if components and p.has_quality:
            allocated = set()
            for c in components:
                allocated.update(lib.as_list(c.get("functions")))
            for fr in p.of("FR"):
                if fr.id not in allocated:
                    self.add("allocation", "elm/", 0, "%s is allocated to no component (add it to the functions of the"
                                                      " component that performs it)" % fr.id, S2)
        if elements:
            carried = set()
            for e in elements:
                carried.update(lib.as_list(e.get("drivers")))
            for d in p.of("DRV"):
                if d.id not in carried:
                    self.add("allocation", "elm/", 0, "%s is carried by no element (add it to the drivers of the"
                                                      " elements that carry it)" % d.id, S2)
        if components and p.of("TEAM"):
            for c in components:
                if not c.get("team"):
                    self.item_problem("allocation", c, "team", "the design context names teams, and this component"
                                                               " has none")
        for i in p.of("IFC"):
            provider = p.get(i.get("provider")) if isinstance(i.get("provider"), str) else None
            if provider is None:
                continue
            if provider.id in comp_ids:
                sides = [provider]
            else:
                sides = [p.get(c) for c in lib.as_list(i.get("consumers")) if c in comp_ids]
            if not sides:
                continue
            have = set()
            for s in sides:
                have.update(lib.as_list(s.get("functions")))
            extra = [f for f in lib.as_list(i.get("functions")) if f not in have]
            if extra:
                names = ", ".join(s.id for s in sides)
                role = "its provider" if sides == [provider] else "its consumers"
                self.item_problem("allocation", i, "functions",
                                  "functions has %s, which %s %s do%s not have (remove it here, or raise a finding to"
                                  " %s for %s)" % (", ".join(extra), role, names, "es" if len(sides) == 1 else "",
                                                   S2, names), upstream=(S2, [s.id for s in sides], extra))
        ifcs = p.of("IFC")
        if ifcs and p.has_quality:
            carried = set()
            for i in ifcs:
                carried.update(lib.as_list(i.get("functions")))
            uncarried = {}
            for c in components:
                for f in lib.as_list(c.get("functions")):
                    fr = p.get(f)
                    if fr is not None and not fr.retired and f not in carried:
                        uncarried.setdefault(f, []).append(c.id)
            for f in sorted(uncarried, key=lib.id_key):
                self.add("allocation", "ifc/", 0, "%s is allocated to %s, and no interface carries it: add it to the"
                                                  " functions of the IFCs its acceptance criteria pass through"
                                                  % (f, ", ".join(uncarried[f])), S3)
        for c in components:
            modules = p.modules_of(c.id)
            if not modules:
                continue
            for m in modules:
                for field in ("functions", "drivers"):
                    extra = [x for x in lib.as_list(m.get(field)) if x not in lib.as_list(c.get(field))]
                    if extra:
                        self.item_problem("allocation", m, field,
                                          "%s has %s, which its component %s does not have (remove it here, or raise a"
                                          " finding to %s for %s)" % (field, ", ".join(extra), c.id, S2, c.id),
                                          upstream=(S2, [c.id], extra))
            in_modules = set()
            for m in modules:
                in_modules.update(lib.as_list(m.get("functions")))
            for f in lib.as_list(c.get("functions")):
                fr = p.get(f)
                if fr is not None and not fr.retired and f not in in_modules:
                    self.add("allocation", "mod/", 0, "%s is a function of %s, and none of its modules lists it in"
                                                      " functions" % (f, c.id), S4)
            self.realization(c, modules)
        used = set()
        for m in p.of("MOD"):
            used.update(lib.as_list(m.get("decisions")))
        for d in p.of("DEC"):
            if d.get("stage") == "detailed-design" and d.id not in used:
                self.item_problem("allocation", d, "stage", "a decision of the detailed design that no module lists in"
                                                            " decisions")
        self.module_cycles()

    def module_cycles(self):
        graph = dict((m.id, [x for x in lib.as_list(m.get("depends_on")) if isinstance(x, str)])
                     for m in self.p.of("MOD"))
        state = {}
        reported = set()

        def visit(node, trail):
            state[node] = "open"
            for nxt in graph.get(node, []):
                if nxt not in graph:
                    continue
                if state.get(nxt) == "open":
                    cycle = trail[trail.index(nxt):] + [nxt] if nxt in trail else [node, nxt]
                    key = frozenset(cycle)
                    if key not in reported:
                        reported.add(key)
                        self.item_problem("cycle", self.p.get(nxt), "depends_on", "the module dependencies form a"
                                                                                  " cycle: %s" % " -> ".join(cycle))
                elif nxt not in state:
                    visit(nxt, trail + [nxt])
            state[node] = "done"

        for node in sorted(graph, key=lib.id_key):
            if node not in state:
                visit(node, [node])

    def realization(self, component, modules):
        p = self.p
        ifcs = [i for i in p.of("IFC") if i.get("provider") == component.id
                or component.id in lib.as_list(i.get("consumers"))]
        operations = {}
        for i in ifcs:
            for op in lib.as_list(i.get("operations")):
                name = op.get("name") if isinstance(op, dict) else op
                if isinstance(name, str):
                    operations[(i.id, name)] = []
        for m in modules:
            for entry in lib.as_list(m.get("realizes")):
                text = str(entry)
                match = re.match(r"(IFC-[0-9]{2,})\s+(.*)\Z", text.strip())
                if not match:
                    self.item_problem("wrong-kind", m, "realizes", "realizes holds %r; write the IFC ID and the"
                                      " operation's name ('IFC-01 POST /v1/checkout')" % text)
                    continue
                ifc_id, op = match.group(1), match.group(2).strip()
                ifc = p.get(ifc_id)
                if ifc is None:
                    self.item_problem("unknown-id", m, "realizes", "realizes names %s, which does not exist" % ifc_id)
                    continue
                keys = [k for k in operations if k[0] == ifc_id and (k[1] == op or op.startswith(k[1] + " ")
                                                                     or op.startswith(k[1] + "（")
                                                                     or op.startswith(k[1] + "("))]
                if not keys:
                    if ifc not in ifcs:
                        why = "%s neither provides nor consumes %s" % (component.id, ifc_id)
                    else:
                        why = "%s has no operation named %r" % (ifc_id, op)
                    self.item_problem("allocation", m, "realizes", "realizes %r, but %s" % (text, why),
                                      upstream=(S3, [ifc_id], []))
                    continue
                operations[max(keys, key=lambda k: len(k[1]))].append(m.id)
        provided = set(i.id for i in ifcs if i.get("provider") == component.id)
        for (ifc_id, op), mods in sorted(operations.items(), key=lambda kv: (lib.id_key(kv[0][0]), kv[0][1])):
            if not mods and ifc_id in provided:
                self.add("allocation", "mod/", 0, "%s %s: no module of %s realizes it (each operation of an IFC the"
                                                  " component provides has exactly one module that realizes it)"
                         % (ifc_id, op, component.id), S4)
            elif len(mods) > 1:
                self.add("allocation", "mod/", 0, "%s %s is realized by %s; one module of %s realizes it"
                         % (ifc_id, op, ", ".join(mods), component.id), S4)

    def conflicts(self):
        drivers = dict((d.id, d) for d in self.p.of("DRV"))
        for d in drivers.values():
            for c in lib.as_list(d.get("conflicts")):
                other = drivers.get(c.get("with")) if isinstance(c, dict) else None
                if other is None:
                    continue
                back = [x.get("with") for x in lib.as_list(other.get("conflicts")) if isinstance(x, dict)]
                if d.id not in back:
                    self.item_problem("conflict", other, "conflicts", "%s records a conflict with %s; record it here"
                                                                      " too" % (d.id, other.id))

    # specs

    def specs(self):
        p = self.p
        used = set()
        components = set(c.id for c in p.components())
        for i in p.of("IFC"):
            spec = i.get("spec")
            if isinstance(spec, str) and spec:
                rel = spec.replace(os.sep, "/")
                if rel.startswith("docs/design/"):
                    rel = rel[len("docs/design/"):]
                used.add(rel)
                f = p.specs.get(rel)
                if f is None:
                    self.item_problem("spec", i, "spec", "spec names %s, which is not under %s" % (spec, p.design_dir))
                    continue
                if f.data is None:
                    continue
                self.compare_spec(i, f)
            elif i.get("kind") in ("http", "event") and "spec" in i.data:
                provider = i.get("provider")
                if provider in components and not p.schema_handoffs(i.id):
                    kind = "an OpenAPI" if i.get("kind") == "http" else "an AsyncAPI"
                    self.item_problem("spec", i, "spec", "an %s interface that %s provides needs %s document under"
                                                         " ifc/specs/, or a hand-off of its schema to %s that names"
                                                         " it in origin" % (i.get("kind"), provider, kind,
                                                                            lib.IMPLEMENTATION))
        for rel in p.specs:
            if rel not in used:
                self.add("spec", rel, 1, "no active IFC names this spec in its spec field", S3)

    def compare_spec(self, ifc, f):
        data = f.data
        if not isinstance(data, dict):
            return
        names = []
        for op in lib.as_list(ifc.get("operations")):
            name = op.get("name") if isinstance(op, dict) else op
            if isinstance(name, str):
                names.append(name)
        if "openapi" in data or "swagger" in data:
            self.compare_openapi(ifc, f, data, names)
        elif "asyncapi" in data:
            self.compare_asyncapi(ifc, f, data, names)
        else:
            self.add("spec", f.rel, 1, "neither an OpenAPI nor an AsyncAPI document", S3)

    def compare_openapi(self, ifc, f, data, names):
        bases = [""]
        for server in lib.as_list(data.get("servers")):
            url = server.get("url") if isinstance(server, dict) else None
            if isinstance(url, str):
                path = re.sub(r"^[a-z]+://[^/]*", "", url).rstrip("/")
                if path.startswith("/") and path not in bases:
                    bases.append(path)
        spec_ops = {}
        for path, item in (data.get("paths") or {}).items():
            if not isinstance(item, dict):
                continue
            for method, operation in item.items():
                if str(method).lower() in HTTP_METHODS:
                    for base in bases:
                        spec_ops[(str(method).upper(), norm_path(base + str(path)))] = (str(method).upper(), str(path),
                                                                                          operation)
        matched = set()
        ifc_ops = {}
        for name in names:
            m = OP_RE.match(name.strip())
            if not m:
                self.item_problem("spec", ifc, "operations", "operation %r is not written as 'METHOD /path', so it"
                                                             " cannot be matched with %s" % (name, f.rel))
                continue
            key = (m.group(1), norm_path(m.group(2)))
            ifc_ops[name] = key
            if key in spec_ops:
                matched.add(spec_ops[key][:2])
            else:
                self.item_problem("spec", ifc, "operations", "operation %s is not in %s" % (name, f.rel))
        listed = set(value[:2] for value in spec_ops.values())
        for method, path in sorted(listed):
            if (method, path) not in matched:
                self.add("spec", f.rel, 1, "%s %s is in the spec and not in the operations of %s" % (method, path,
                                                                                                     ifc.id), S3)
        text = f.text
        for err in lib.as_list(ifc.get("errors")):
            if not isinstance(err, dict):
                continue
            status, code = parse_signal(err.get("signal"))
            if status is None:
                continue
            ops = error_operations(err.get("case"), names)
            for name in ops:
                key = ifc_ops.get(name)
                if key is None or key not in spec_ops:
                    continue
                responses = spec_ops[key][2].get("responses") if isinstance(spec_ops[key][2], dict) else None
                codes = [str(k).upper() for k in (responses or {})]
                if status not in codes and status[0] + "XX" not in codes and "DEFAULT" not in codes:
                    self.item_problem("spec", ifc, "errors", "%s answers %s%s, and the spec's %s %s has no %s response"
                                      % (name, status, " " + code if code else "", spec_ops[key][0],
                                         spec_ops[key][1], status))
            if code and code not in text:
                self.item_problem("spec", ifc, "errors", "error code %s is not in %s" % (code, f.rel))

    def compare_asyncapi(self, ifc, f, data, names):
        spec_names = set()
        for msg in asyncapi_messages(data):
            name = msg.get("name") or msg.get("x-key")
            if isinstance(name, str):
                spec_names.update(part.strip() for part in name.split(" / "))
        ifc_names = set()
        for name in names:
            ifc_names.update(part.strip() for part in name.split(" / "))
        for name in sorted(ifc_names - spec_names):
            self.item_problem("spec", ifc, "operations", "message %s is not in %s" % (name, f.rel))
        for name in sorted(spec_names - ifc_names):
            self.add("spec", f.rel, 1, "message %s is in the spec and not in the operations of %s" % (name, ifc.id), S3)

    # findings

    def findings(self):
        stage_skills = list(lib.STAGE_SKILLS.values())
        for fnd in self.p.of("FND", active_only=False):
            to = fnd.get("to")
            if "to" in fnd.data and to not in stage_skills:
                self.item_problem("finding", fnd, "to", "to is %r; a finding is addressed to the stage skill that must"
                                                        " decide: %s" % (to, ", ".join(stage_skills)))
            raisers = lib.SKILLS + [lib.IMPLEMENTATION]
            if "raised_by" in fnd.data and fnd.get("raised_by") not in raisers:
                self.item_problem("finding", fnd, "raised_by", "raised_by is %r; it is one of %s"
                                  % (fnd.get("raised_by"), ", ".join(raisers)))
            raised_in = fnd.get("raised_in")
            # implementation names the path of the code, which is not under the design directory
            if fnd.get("raised_by") != lib.IMPLEMENTATION and isinstance(raised_in, str) and raised_in and \
                    not os.path.exists(os.path.join(self.p.design_dir, raised_in)):
                self.item_problem("finding", fnd, "raised_in", "raised_in names %s, which is not under %s"
                                  % (raised_in, self.p.design_dir))
            owner = to if to in stage_skills else None
            if fnd.status in ("accepted", "rejected") and not fnd.get("resolution"):
                self.item_problem("finding", fnd, "resolution", "an %s finding says in resolution what changed, or why"
                                                                " it is rejected" % fnd.status, owner=owner)
            if fnd.status == "accepted" and not self.p.citing(fnd.id):
                self.item_problem("finding", fnd, "status", "accepted, but no item cites %s in basis_note: cite it, in"
                                                            " full, in the items it changed" % fnd.id, owner=owner)

    def handoffs(self):
        stages = list(lib.STAGE_SKILLS.values())
        for hnd in self.p.of("HND", active_only=False):
            sender, to = hnd.get("from"), hnd.get("to")
            taker = to if to in stages else None
            if "from" in hnd.data and sender not in stages:
                self.item_problem("handoff", hnd, "from", "from is %r; it is the stage skill that wrote the hand-off: %s"
                                  % (sender, ", ".join(stages)))
            if "to" in hnd.data and to not in stages + [lib.IMPLEMENTATION]:
                self.item_problem("handoff", hnd, "to", "to is %r; it is a stage skill or %s"
                                  % (to, lib.IMPLEMENTATION))
            if hnd.status == "open" and to in (lib.STAGE_SKILLS[4], lib.IMPLEMENTATION) and not hnd.get("component"):
                self.item_problem("handoff", hnd, "component", "a hand-off to %s names the component it concerns"
                                  % to)
            if hnd.status == "open" and "trigger" in hnd.data and not hnd.get("trigger"):
                self.item_problem("handoff", hnd, "trigger", "a hand-off says when it falls due: a stage's next run, its"
                                                             " run for a component, an implementation, or an event")
            if "origin" in hnd.data and not lib.as_list(hnd.get("origin")):
                self.item_problem("handoff", hnd, "origin", "origin names the items the point comes from")
            if hnd.status in ("decided", "retired") and not hnd.get("resolution"):
                self.item_problem("handoff", hnd, "resolution", "a %s hand-off says in resolution %s" % (
                    hnd.status, "the items that decide it" if hnd.status == "decided" else "why nothing needs it"),
                    owner=taker)
            if hnd.status == "decided" and not self.p.citing(hnd.id):
                self.item_problem("handoff", hnd, "status", "decided, but no item cites %s in basis_note: cite it, in"
                                                            " full, in the items that decide it" % hnd.id, owner=taker)

    def run_skill(self):
        """The design skill this check runs for: implementation writes no request and no request document."""
        return self.skill if self.skill in lib.SKILLS else None

    def requests(self):
        for q in self.p.of("QCR", active_only=False):
            answer, where = q.get("answer"), q.get("answered_in")
            if q.status == "answered" and (not answer or not where):
                self.item_problem("request", q, "answer", "an answered request records the user's answer in answer, and"
                                                          " where it was given in answered_in", owner=self.run_skill())
            if q.status == "open" and answer:
                self.item_problem("request", q, "status", "the request holds an answer, so it is answered, or withdrawn"
                                                          " when the user decided that the quality chain need not act on"
                                                          " it", owner=self.run_skill())

    # reports

    def reports(self):
        for rel, text in sorted(self.p.reports.items()):
            ctx = lib.report_context(rel)
            owner = ctx.owner if ctx else lib.path_owner(rel)
            reported = set()
            for n, line in enumerate(text.split("\n"), 1):
                for ident in lib.mentions(line):
                    if ident in reported or self.p.get(ident) is not None:
                        continue
                    if lib.prefix_of(ident) in lib.QUALITY_PREFIXES and not self.p.has_quality:
                        continue
                    reported.add(ident)
                    self.add("unknown-id", rel, n, "the report mentions %s, which does not exist" % ident, owner)
            new_text, problems, tables = tables_mod.render_report(self.p, self.g, rel, text)
            self.rendered[rel] = tables
            if ctx is None and not problems:
                continue
            if self.skill and owner != self.skill:
                continue
            for line, message in problems:
                self.add("table", rel, line, message, owner)
            if new_text != text:
                first = first_difference(text, new_text)
                self.add("table", rel, first, "generated tables are out of date: run scripts/tables.py", owner)
            for name, line, header, rows, table, empties in tables:
                if name in ("sli-bindings", "gate-bindings", "audit-bindings"):
                    continue  # reported by the sli-binding, gate-binding and audit-binding rules
                columns = {}
                for key, column in empties:
                    columns.setdefault(column, []).append(" ".join(key))
                for column, keys in columns.items():
                    shown = ", ".join(keys[:5]) + (", ..." if len(keys) > 5 else "")
                    self.add("empty-cell", rel, line, "table '%s': fill in '%s' in %d row(s): %s"
                             % (name, column, len(keys), shown), owner)

    def request_doc(self):
        p = self.p
        if p.request_doc is None and not p.of("QCR", active_only=False):
            return
        owner = self.run_skill() or REQUESTS_OWNER
        conflicts = tables_mod.answer_conflicts(p)
        for ident, line, message in conflicts:
            self.add("request-edit", lib.REQUESTS_DOC, line, message, owner)
        new_text = tables_mod.render_requests(p, self.g)
        if not conflicts and new_text != p.request_doc:
            line = first_difference(p.request_doc, new_text) if p.request_doc is not None else 0
            what = "is out of date" if p.request_doc is not None else "does not exist yet"
            self.add("table", lib.REQUESTS_DOC, line, "the request document %s: run scripts/tables.py" % what, owner)

    def sli_bindings(self):
        p = self.p
        if not p.of("IFC") or not p.has_quality:
            return
        bound = set()
        for it in p.of("IFC") + p.of("DAT"):
            for b in lib.as_list(it.get("sli_bindings")):
                if isinstance(b, dict):
                    bound.add(b.get("sli"))
        named = {}
        for name, line, header, rows, table, empties in self.rendered.get("3-high-level-design.md", []):
            if name == "sli-bindings":
                for row in rows:
                    if len(row) > 5:
                        named[row[0]] = [x for x in lib.mentions(row[5]) if lib.prefix_of(x) == "QCR"]
        for s in p.of("SLI"):
            if s.id in bound:
                continue
            valid = [q.id for q in p.requests_on(s.id)]
            if not named.get(s.id):
                self.add("sli-binding", "ifc/", 0, "%s is bound on no IFC or DAT; bind it, or, when no binding can"
                                                   " realize it as defined, write a request to the quality chain with"
                                                   " %s in targets and name it in the last column of the report's SLI"
                                                   " bindings table" % (s.id, s.id), S3)
            elif not set(named[s.id]) & set(valid):
                self.add("sli-binding", "ifc/", 0, "%s is bound on no IFC or DAT, and the report's SLI bindings table"
                                                   " names %s instead, which is no open or answered request with %s in"
                                                   " targets" % (s.id, ", ".join(named[s.id]), s.id), S3)

    def stage_2b_ran(self):
        """Stage 2b has written something, or this run is stage 2b's own."""
        return bool(self.p.of("POL")) or "2b-technical-policy.md" in self.p.reports or self.skill == S2B

    def policies(self):
        """Once stage 2b has run: one active policy per scope, and every component in one stack and one repository."""
        p = self.p
        policies = p.of("POL")
        if not self.stage_2b_ran():
            return
        by_scope = {}
        for pol in policies:
            scope = pol.get("scope")
            by_scope.setdefault(scope if isinstance(scope, str) else None, []).append(pol)
        for scope in lib.POL_SCOPES:
            found = by_scope.get(scope, [])
            if not found:
                self.add("policy", "pol/", 0, "no active policy of scope %s: stage 2b writes one POL for each scope" % scope,
                         S2B)
            for extra in found[1:]:
                self.item_problem("policy", extra, "scope", "%s is also an active policy of scope %s; each scope has"
                                                            " one" % (found[0].id, scope))
        for scope, field, child, what, whats in (("technology", "stack", "elements", "stack entry", "stack entries"),
                                                 ("repository", "repositories", "holds", "repository", "repositories")):
            pols = by_scope.get(scope, [])
            if not pols:
                continue
            count = {}
            for pol in pols:
                for entry in lib.as_list(pol.get(field)):
                    if isinstance(entry, dict):
                        for ident in lib.as_list(entry.get(child)):
                            if isinstance(ident, str):
                                count[ident] = count.get(ident, 0) + 1
            for c in p.components():
                n = count.get(c.id, 0)
                if n != 1:
                    self.item_problem("policy", pols[0], field, "%s is in %s of the policies; every component is in"
                                                                " exactly one" % (c.id, "no " + what if n == 0 else
                                                                                  "%d %s" % (n, whats)))

    def nfr_bindings(self):
        """Once stage 2b has run: every gate and audit of the quality chain is bound, or a request replaces it."""
        p = self.p
        if not self.stage_2b_ran() or not p.has_quality:
            return
        tables = dict((name, rows) for name, line, header, rows, table, empties
                      in self.rendered.get("2b-technical-policy.md", []))
        for kind, field, rule, table, column in (("gate", "gate_bindings", "gate-binding", "gate-bindings", 4),
                                                 ("audit", "audit_bindings", "audit-binding", "audit-bindings", 3)):
            bound = p.nfr_bindings(field)
            named = {}
            for row in tables.get(table, []):
                if len(row) > column:
                    named[row[0]] = [x for x in lib.mentions(row[column]) if lib.prefix_of(x) == "QCR"]
            a = "an" if kind == "audit" else "a"
            for n in p.nfrs_of_kind(kind):
                if n.id in bound:
                    continue
                valid = [q.id for q in p.requests_on(n.id)]
                if not named.get(n.id):
                    self.add(rule, "pol/", 0, "%s, %s %s of the quality chain, is in no policy's %s; bind it, or, when no"
                                              " design can realize it as defined, write a request to the quality chain"
                                              " with %s in targets and name it in the last column of the report's %s"
                                              " table" % (n.id, a, kind, field, n.id, table), S2B)
                elif not set(named[n.id]) & set(valid):
                    self.add(rule, "pol/", 0, "%s is in no policy's %s, and the report's %s table names %s instead,"
                                              " which is no open or answered request with %s in targets"
                                              % (n.id, field, table, ", ".join(named[n.id]), n.id), S2B)

    # findings that cover problems

    def cover(self):
        """Mark a problem as waiting when an open finding to the upstream skill targets the item and names the value."""
        open_findings = [f for f in self.p.of("FND", active_only=False) if f.status == "open"]
        for problem in self.problems:
            if not problem.upstream:
                continue
            skill, ids, values = problem.upstream
            for f in open_findings:
                if f.get("to") != skill or not set(ids) & set(lib.as_list(f.get("targets"))):
                    continue
                said = set()
                for key in ("title", "evidence", "suggestion"):
                    said.update(lib.mentions(f.get(key)))
                if not values or set(values) & said:
                    problem.waiting = f.id
                    break


def norm_path(path):
    return re.sub(r"\{[^}]*\}", "{}", path.split("?")[0].rstrip("/") or "/")


def parse_signal(signal):
    if not isinstance(signal, str):
        return None, None
    m = STATUS_RE.match(signal)
    if not m:
        return None, None
    rest = signal[m.end():]
    code = CODE_RE.search(rest)
    return m.group(1), (code.group(1) if code else None)


def error_operations(case, names):
    if len(names) == 1:
        return names
    if not isinstance(case, str):
        return []
    out = [n for n in names if case.strip().startswith(n + ":") or case.strip().startswith(n + " :")]
    return out[:1] if out else []


def asyncapi_messages(data):
    """Every message object of an AsyncAPI 2 or 3 document, with local $refs resolved."""
    found = []

    def resolve(node):
        seen = 0
        while (isinstance(node, dict) and isinstance(node.get("$ref"), str) and node["$ref"].startswith("#/")
               and seen < 10):
            target = data
            for part in node["$ref"][2:].split("/"):
                part = part.replace("~1", "/").replace("~0", "~")
                target = target.get(part) if isinstance(target, dict) else None
            node = target
            seen += 1
        return node

    def add(node, key=None):
        node = resolve(node)
        if isinstance(node, dict):
            if isinstance(node.get("oneOf"), list):
                for x in node["oneOf"]:
                    add(x)
                return
            entry = dict(node)
            if key is not None:
                entry.setdefault("x-key", key)
            if not any(entry is e or entry == e for e in found):
                found.append(entry)

    components = data.get("components") if isinstance(data.get("components"), dict) else {}
    for key, msg in (components.get("messages") or {}).items():
        add(msg, key)
    for channel in (data.get("channels") or {}).values():
        if not isinstance(channel, dict):
            continue
        for key, msg in (channel.get("messages") or {}).items() if isinstance(channel.get("messages"), dict) else []:
            add(msg, key)
        for verb in ("publish", "subscribe"):
            op = channel.get(verb)
            if isinstance(op, dict) and op.get("message") is not None:
                add(op.get("message"))
    unique = []
    for entry in found:
        name = entry.get("name") or entry.get("x-key")
        if name not in [e.get("name") or e.get("x-key") for e in unique]:
            unique.append(entry)
    return unique


def first_difference(a, b):
    la, lb = a.split("\n"), b.split("\n")
    for n, (x, y) in enumerate(zip(la, lb), 1):
        if x != y:
            return n
    return min(len(la), len(lb))


def output_text(project, problems, skill):
    lines = []
    quality = project.quality_dir if project.has_quality else "not found (quality-chain IDs are not checked)"
    lines.append("check.py: %s; quality chain: %s" % (project.design_dir, quality))
    groups = {}
    for pr in problems:
        groups.setdefault(pr.owner or "(no skill: the file does not say which skill wrote it)", []).append(pr)
    order = [s for s in lib.SKILLS if s in groups] + [g for g in groups if g not in lib.SKILLS]
    if skill in order:
        order.remove(skill)
        order.insert(0, skill)
    for owner in order:
        group = sorted(groups[owner], key=lambda x: (x.waiting is not None, x.path, x.line, x.rule))
        counted = [x for x in group if x.waiting is None]
        mark = "  <- this run's skill" if owner == skill else ""
        lines.append("")
        lines.append("%s: %d problem(s)%s%s" % (owner, len(counted), (", %d waiting for findings" % (
            len(group) - len(counted))) if len(group) > len(counted) else "", mark))
        if skill and owner != skill:
            rules = {}
            for pr in counted:
                rules[pr.rule] = rules.get(pr.rule, 0) + 1
            if rules:
                lines.append("  not this run's to fix: %s (run without --skill to list them)"
                             % ", ".join("%s %d" % kv for kv in sorted(rules.items())))
            continue
        for pr in group:
            where = pr.path + (":%d" % pr.line if pr.line else "")
            wait = " (waiting for %s)" % pr.waiting if pr.waiting else ""
            lines.append("  %s: %s: %s%s" % (where, pr.rule, pr.message, wait))
    counted = [x for x in problems if x.waiting is None]
    by_rule = {}
    for pr in counted:
        by_rule[pr.rule] = by_rule.get(pr.rule, 0) + 1
    lines.append("")
    if counted:
        lines.append("%d problem(s): %s" % (len(counted), ", ".join("%s %d" % kv for kv in sorted(by_rule.items()))))
    else:
        lines.append("No problems.")
    if skill:
        own = [x for x in counted if x.owner == skill]
        lines.append("%s: %d problem(s) to fix in this run" % (skill, len(own)))
    return "\n".join(lines)


def main(argv):
    import argparse

    parser = argparse.ArgumentParser(description="Check the design items, specs and reports.")
    parser.add_argument("--design", default="docs/design")
    parser.add_argument("--quality", default=None)
    parser.add_argument("--skill", default=None, choices=lib.SKILLS + [lib.IMPLEMENTATION])
    parser.add_argument("--format", default="text", choices=("text", "json"))
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if not os.path.isdir(args.design):
        print("check.py: no design directory at %s" % args.design)
        return 2
    quality = args.quality if args.quality is not None else lib.default_quality_dir(args.design)
    project = lib.Project(args.design, quality)
    checker = Checker(project, lib.Glossary(), args.skill)
    problems = checker.run()
    if args.format == "json":
        print(json.dumps({"design": project.design_dir, "quality": project.quality_dir if project.has_quality else None,
                          "problems": [p.as_dict() for p in problems]}, ensure_ascii=False, indent=1))
    else:
        print(output_text(project, problems, args.skill))
    counted = [x for x in problems if x.waiting is None and (args.skill is None or x.owner == args.skill)]
    return 1 if counted else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
