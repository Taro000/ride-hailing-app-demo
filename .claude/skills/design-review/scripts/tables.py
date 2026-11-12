#!/usr/bin/env python3
"""Write the index tables of the design reports from the YAML items.

A report marks each table that this script writes:

    <!-- generated: drivers -->
    | DRV | Title | Kind | Negotiable | Sources | Premises | Basis |
    |---|---|---|---|---|---|---|
    <!-- /generated -->

The script rewrites everything between the two markers from the items. It keeps
the header row when its number of columns is right, so a header written in the
working language stays as written. Some cells hold what only the report records
(how a conflict is resolved, the flow an acceptance criterion passes through, a
quality-chain assumption rated by this stage): the script keeps what the report
already says in those cells, matched by the row's key, and leaves them empty on
new rows for the stage to fill in. The report templates say which columns those are.

It also writes the whole request document, quality-chain-requests.md, from the
requests to the quality chain (qcr/) that are open or answered, whatever skill it
runs for. The user may write an answer after "Answer:" under a request; until the
request holds that answer, the script leaves the document as it is and says so.

Usage:
    python3 scripts/tables.py --skill <skill name>   the reports that skill writes, and the request document
    python3 scripts/tables.py [REPORT ...]           the reports named, or every report and the request document
Options:
    --design DIR    the design directory (default: docs/design)
    --quality DIR   the quality chain's directory (default: read_from.quality_chain in
                    design-context.yaml, else docs/quality)
    --lang en|ja    the language of headers and terms (default: Japanese when the report
                    is written in Japanese, otherwise English)
    --dry-run       only list the reports whose tables would change; exit 1 if any would
"""

import hashlib
import os
import re
import sys

sys.dont_write_bytecode = True

import design_lib as lib  # noqa: E402

BLOCK_RE = re.compile(r"(<!--[ \t]*generated:[ \t]*([A-Za-z0-9_-]+)[ \t]*-->)(.*?)"
                      r"(<!--[ \t]*/generated[ \t]*-->)", re.S)
OPEN_RE = re.compile(r"<!--[ \t]*generated:[ \t]*([A-Za-z0-9_-]+)[ \t]*-->")
CLOSE_RE = re.compile(r"<!--[ \t]*/generated[ \t]*-->")
KANA_RE = re.compile(r"[぀-ヿ]")
DASH = "—"
RATING_ORDER = {"high": 3, "medium": 2, "low": 1}
SEVERITY_ORDER = {"critical": 0, "major": 1, "minor": 2}
DRIVER_KIND_ORDER = ["quality", "change", "constraint", "function", "observability", "security", "principle"]


class Hand(object):
    """A cell that the report fills in: keep the report's text, or start from `default`."""

    def __init__(self, default=""):
        self.default = default


class Table(object):
    def __init__(self, headers, rows, key_columns=1, sort_key=None):
        self.headers = headers  # [(english, japanese)]
        self.rows = rows  # [[str | Hand]]
        self.key_columns = key_columns
        self.sort_key = sort_key


class TableError(Exception):
    pass


class Renderer(object):
    def __init__(self, project, glossary, lang):
        self.p = project
        self.g = glossary
        self.lang = lang

    # cell text

    def term(self, label, value):
        if value is None or value == "":
            return DASH
        if isinstance(value, bool):
            return self.g.term("", "yes" if value else "no", self.lang)
        return self.g.term(label, value, self.lang)

    def join(self, values):
        values = [str(v) for v in lib.as_list(values) if v is not None and str(v) != ""]
        if not values:
            return DASH
        return ("、" if self.lang == "ja" else ", ").join(values)

    def text(self, value):
        if value is None or value == "":
            return DASH
        return str(value)

    def ranges(self, ids, shortest=2):
        """MOD-01, MOD-02, MOD-03, MOD-05 -> 'MOD-01 to MOD-03, MOD-05' (Japanese: 'MOD-01〜MOD-03、MOD-05').

        A run of consecutive numbers becomes a range when it has at least `shortest` IDs."""
        keys = sorted(set(lib.id_key(i) for i in ids), key=lambda k: (k[0], k[1]))
        groups = []
        for prefix, number in keys:
            if groups and groups[-1][0] == prefix and groups[-1][2] == number - 1:
                groups[-1][2] = number
            else:
                groups.append([prefix, number, number])
        width = lambda n: "%02d" % n  # noqa: E731
        out = []
        for prefix, first, last in groups:
            if last - first + 1 >= max(shortest, 2):
                link = "〜" if self.lang == "ja" else " to "
                out.append("%s-%s%s%s-%s" % (prefix, width(first), link, prefix, width(last)))
            else:
                out.extend("%s-%s" % (prefix, width(n)) for n in range(first, last + 1))
        return self.join(out)

    # the tables

    def build(self, name, ctx):
        method = getattr(self, "t_" + name.replace("-", "_"), None)
        if method is None:
            raise TableError("unknown table '%s'" % name)
        return method(ctx)

    def need(self, ctx, kinds, stages=None):
        if ctx.kind not in kinds or (stages and ctx.stage not in stages):
            raise TableError("this table does not belong in this report")

    def t_design_context(self, ctx):
        self.need(ctx, ("stage",), (1,))
        rows = []
        for prefix in ("TC", "PC", "TEAM", "CHG", "STK"):
            for e in self.p.of(prefix):
                if prefix == "TC":
                    kind = self.term("technology constraint", e.get("kind"))
                elif prefix == "PC":
                    kind = self.term("project constraint kinds", e.get("kind"))
                else:
                    kind = self.term("", {"TEAM": "team structure", "CHG": "anticipated change",
                                          "STK": "stakeholder"}[prefix])
                rows.append([e.id, Hand(), kind, self.text(e.get("source")), self.term("basis", e.get("basis"))])
        return Table([("ID", "ID"), ("Label", "見出し"), ("Kind", "種類"), ("Source", "出どころ"),
                      ("Basis", "根拠")], rows)

    def t_drivers(self, ctx):
        self.need(ctx, ("stage",), (1,))
        drivers = self.p.of("DRV")
        order = dict((k, n) for n, k in enumerate(DRIVER_KIND_ORDER))
        drivers.sort(key=lambda d: (order.get(d.get("kind"), 99), lib.id_key(d.id)))
        rows = []
        for d in drivers:
            negotiable = DASH
            if d.get("kind") in ("constraint", "principle"):
                negotiable = self.term("", d.get("negotiable"))
            rows.append([d.id, self.text(d.get("title")), self.term("driver kinds", d.get("kind")), negotiable,
                         self.join(d.get("sources")), self.join(d.get("premises")), self.term("basis", d.get("basis"))])
        return Table([("DRV", "DRV"), ("Title", "名前"), ("Kind", "種類"), ("Negotiable", "交渉"),
                      ("Sources", "出どころ"), ("Premises", "前提"), ("Basis", "根拠")], rows)

    def t_ranking(self, ctx):
        self.need(ctx, ("stage",), (1,))
        rows = []
        for d in self.p.of("DRV"):
            priority = d.get("priority")
            if not isinstance(priority, dict):
                continue
            rank = priority.get("rank")
            rows.append((rank if isinstance(rank, int) else 10 ** 6, lib.id_key(d.id), [
                self.text(rank), d.id, self.term("", priority.get("business")),
                self.term("", priority.get("difficulty")), self.term("", d.get("primary"))]))
        rows.sort(key=lambda r: (r[0], r[1]))
        return Table([("Rank", "順位"), ("DRV", "DRV"), ("Business priority", "事業の優先度"),
                      ("Design difficulty", "設計上の難しさ"), ("Primary", "主")], [r[2] for r in rows])

    def t_conflicts(self, ctx):
        self.need(ctx, ("stage",), (1,))
        pairs = set()
        for d in self.p.of("DRV"):
            for c in lib.as_list(d.get("conflicts")):
                other = c.get("with") if isinstance(c, dict) else None
                if isinstance(other, str):
                    pairs.add(tuple(sorted((d.id, other), key=lib.id_key)))
        rows = [[self.join(pair), Hand()] for pair in sorted(pairs, key=lambda p: (lib.id_key(p[0]), lib.id_key(p[1])))]
        return Table([("Drivers", "要求"), ("Resolved by", "決める所")], rows)

    def decisions_of(self, ctx):
        if ctx.stage == 4:
            return self.p.stage4_decisions_of(ctx.component) if ctx.component else []
        stage = {2: "architecture", "2b": "technical-policy", 3: "high-level-design"}.get(ctx.stage)
        return [d for d in self.p.of("DEC") if d.get("stage") == stage]

    def t_decisions(self, ctx):
        self.need(ctx, ("stage",), (2, "2b", 3, 4))
        rows = [[d.id, self.text(d.get("title")), self.join(d.get("addresses")), self.term("basis", d.get("basis"))]
                for d in self.decisions_of(ctx)]
        return Table([("DEC", "DEC"), ("Title", "名前"), ("Addresses", "対象"), ("Basis", "根拠")], rows)

    def t_elements(self, ctx):
        self.need(ctx, ("stage",), (2,))
        rows = [[e.id, self.text(e.get("name") or e.get("title")), self.term("element", e.get("kind")),
                 self.text(e.get("team")), self.term("as-is", e.get("as_is"))] for e in self.p.of("ELM")]
        return Table([("ELM", "ELM"), ("Name", "名前"), ("Kind", "種類"), ("Team", "チーム"),
                      ("As-is", "今の構造との差分")], rows)

    def t_parameters(self, ctx):
        self.need(ctx, ("stage",), (2, 4))
        rows = []
        if ctx.stage == 2:
            for d in self.decisions_of(ctx):
                for prm in lib.as_list(d.get("parameters")):
                    name = prm.get("name") if isinstance(prm, dict) else prm
                    rows.append([self.text(name), d.id, Hand()])
            return Table([("Parameter", "値"), ("DEC", "DEC"), ("Decided in", "決めた所")], rows, key_columns=2)
        for m in self.p.modules_of(ctx.component):
            for prm in lib.as_list(m.get("parameters")):
                name = prm.get("name") if isinstance(prm, dict) else prm
                rows.append([self.text(name), m.id, Hand(), Hand()])
        return Table([("Parameter", "値"), ("MOD", "MOD"), ("Decision", "決めた所"),
                      ("Budget or timeout it fits", "収まる予算かタイムアウト")], rows, key_columns=2)

    def t_policies(self, ctx):
        self.need(ctx, ("stage",), ("2b",))
        order = dict((s, n) for n, s in enumerate(lib.POL_SCOPES))
        scope = lambda x: x.get("scope") if isinstance(x.get("scope"), str) else None  # noqa: E731
        policies = sorted(self.p.of("POL"), key=lambda x: (order.get(scope(x), 99), lib.id_key(x.id)))
        rows = [[x.id, self.text(x.get("title")), self.term("policy scope", scope(x)), self.join(x.get("addresses")),
                 self.join(x.get("decisions")), self.term("basis", x.get("basis"))] for x in policies]
        return Table([("POL", "POL"), ("Title", "名前"), ("Scope", "範囲"), ("Addresses", "対象"), ("Decisions", "決定"),
                      ("Basis", "根拠")], rows)

    def t_gate_bindings(self, ctx):
        self.need(ctx, ("stage",), ("2b",))
        bound = self.p.nfr_bindings("gate_bindings")
        rows = []
        for n in self.p.nfrs_of_kind("gate"):
            gate = n.get("gate") if isinstance(n.get("gate"), dict) else {}
            on = bound.get(n.id)
            rows.append([n.id, self.text(n.get("title")), self.term("where a gate runs", gate.get("where")),
                         self.join(on), DASH if on else Hand()])
        return Table([("NFR", "NFR"), ("Title", "名前"), ("Where", "確かめる所"), ("Bound in", "出どころの方針"),
                      ("Request instead", "代わりの要求")], rows)

    def t_audit_bindings(self, ctx):
        self.need(ctx, ("stage",), ("2b",))
        bound = self.p.nfr_bindings("audit_bindings")
        rows = []
        for n in self.p.nfrs_of_kind("audit"):
            on = bound.get(n.id)
            rows.append([n.id, self.text(n.get("title")), self.join(on), DASH if on else Hand()])
        return Table([("NFR", "NFR"), ("Title", "名前"), ("Placed in", "置き場所の方針"), ("Request instead", "代わりの要求")],
                     rows)

    def t_interfaces(self, ctx):
        self.need(ctx, ("stage",), (3,))
        rows = []
        for i in self.p.of("IFC"):
            spec = i.get("spec")
            if isinstance(spec, str) and spec:
                spec_cell = os.path.basename(spec)
            elif i.get("kind") in ("http", "event"):
                # an interface between elements whose schema implementation generates: the hand-off that leaves it
                spec_cell = self.join([h.id for h in self.p.schema_handoffs(i.id)])
            else:
                spec_cell = DASH
            rows.append([i.id, self.text(i.get("title")), self.term("interface kinds", i.get("kind")),
                         self.text(i.get("provider")), self.join(i.get("consumers")), self.join(i.get("functions")),
                         spec_cell, self.term("basis", i.get("basis"))])
        return Table([("IFC", "IFC"), ("Title", "名前"), ("Kind", "種類"), ("Provider", "提供側"),
                      ("Consumers", "利用側"), ("FRs", "FR"), ("Spec", "仕様"), ("Basis", "根拠")], rows)

    def bindings(self):
        out = {}
        for it in self.p.of("IFC") + self.p.of("DAT"):
            for b in lib.as_list(it.get("sli_bindings")):
                sli = b.get("sli") if isinstance(b, dict) else None
                if isinstance(sli, str):
                    out.setdefault(sli, []).append(it.id)
        return out

    def t_sli_bindings(self, ctx):
        self.need(ctx, ("stage",), (3,))
        bound = self.bindings()
        rows = []
        for s in self.p.of("SLI"):
            on = bound.get(s.id)
            rows.append([s.id, self.text(s.get("title")), self.term("vantage", s.get("vantage")), self.join(on),
                         self.text(s.get("existing_source")), DASH if on else Hand()])
        return Table([("SLI", "SLI"), ("Title", "名前"), ("Vantage", "見る位置"), ("Bound on", "出どころの項目"),
                      ("Existing source", "既存の出どころ"), ("Request instead", "代わりの要求")], rows)

    def t_data(self, ctx):
        self.need(ctx, ("stage",), (3,))
        rows = [[d.id, self.text(d.get("title") or d.get("entity")), self.text(d.get("owner")),
                 self.text(d.get("store")), self.term("classification", d.get("classification")),
                 self.term("basis", d.get("basis"))] for d in self.p.of("DAT")]
        return Table([("DAT", "DAT"), ("Title", "名前"), ("Owner", "持ち主"), ("Store", "置き場所"),
                      ("Classification", "扱いの区分"), ("Basis", "根拠")], rows)

    def allocated_frs(self):
        out = set()
        for c in self.p.components():
            out.update(f for f in lib.as_list(c.get("functions")) if isinstance(f, str))
        return sorted(out, key=lib.id_key)

    def t_criteria(self, ctx):
        self.need(ctx, ("stage",), (3,))
        carriers = {}
        for i in self.p.of("IFC"):
            for f in lib.as_list(i.get("functions")):
                carriers.setdefault(f, []).append(i.id)
        rows = []
        for f in self.allocated_frs():
            fr = self.p.get(f)
            if fr is None or fr.retired:
                continue
            count = len(lib.as_list(fr.get("acceptance_criteria")))
            for n in range(1, count + 1):
                rows.append([f, str(n), self.join(carriers.get(f)), Hand()])
        return Table([("FR", "FR"), ("Criterion", "基準"), ("IFCs", "IFC"), ("Flow", "流れ")], rows, key_columns=2)

    def t_modules(self, ctx):
        self.need(ctx, ("stage",), (4,))
        if not ctx.component:
            raise TableError("this table belongs in a component report")
        rows = [[m.id, self.text(m.get("name") or m.get("title")), self.term("module depth", m.get("depth")),
                 self.term("visibility", m.get("visibility")), self.join(m.get("functions")),
                 self.join(m.get("realizes")), self.term("as-is", m.get("as_is")), self.term("basis", m.get("basis"))]
                for m in self.p.modules_of(ctx.component)]
        return Table([("MOD", "MOD"), ("Name", "名前"), ("Depth", "深さ"), ("Visibility", "公開範囲"),
                      ("Functions", "FR"), ("Realizes", "実現する操作"), ("As-is", "今の構造との差分"),
                      ("Basis", "根拠")], rows)

    def findings_of(self, ctx):
        findings = self.p.of("FND", active_only=False)
        if ctx.kind == "review":
            out = [f for f in findings if f.get("raised_in") == ctx.rel and f.status == "open"]
            out.sort(key=lambda f: (SEVERITY_ORDER.get(f.get("severity"), 9), lib.id_key(f.id)))
            return out
        skill = lib.STAGE_SKILLS[ctx.stage]
        out = [f for f in findings if f.get("to") == skill or f.get("raised_by") == skill]
        if ctx.stage == 4 and ctx.component:
            out = [f for f in out if ctx.component in self.p.component_of_finding(f)
                   or f.get("raised_in") == ctx.rel]
        return out

    def t_findings(self, ctx):
        self.need(ctx, ("stage", "review"))
        findings = self.findings_of(ctx)
        if ctx.kind == "review":
            rows = [[f.id, self.text(f.get("title")), self.term("severity", f.get("severity")), self.text(f.get("to")),
                     self.join(f.get("targets"))] for f in findings]
            return Table([("FND", "FND"), ("Title", "名前"), ("Severity", "重さ"), ("To", "宛先"),
                          ("Targets", "対象")], rows)
        rows = [[f.id, self.text(f.get("title")), self.term("severity", f.get("severity")),
                 self.text(f.get("raised_by")), self.text(f.get("to")), self.term("finding status", f.status),
                 self.join([i.id for i in self.p.citing(f.id)])] for f in findings]
        return Table([("FND", "FND"), ("Title", "名前"), ("Severity", "重さ"), ("Raised by", "出した段"),
                      ("To", "宛先"), ("Status", "状態"), ("Items changed", "変えた項目")], rows)

    def handoffs_of(self, ctx):
        """The hand-offs that the stage wrote, and those addressed to it; in stage 4, those of the component."""
        skill = lib.STAGE_SKILLS[ctx.stage]
        out = [h for h in self.p.of("HND", active_only=False) if h.get("from") == skill or h.get("to") == skill]
        if ctx.stage == 4 and ctx.component:
            out = [h for h in out if h.get("component") == ctx.component]
        return out

    def t_handoffs(self, ctx):
        self.need(ctx, ("stage",))
        rows = [[h.id, self.text(h.get("title")), self.text(h.get("from")), self.text(h.get("to")),
                 self.text(h.get("component")), self.term("hand-off status", h.status),
                 self.join([i.id for i in self.p.citing(h.id)])] for h in self.handoffs_of(ctx)]
        return Table([("HND", "HND"), ("Title", "名前"), ("From", "書いた段"), ("To", "宛先"),
                      ("Component", "コンポーネント"), ("Status", "状態"), ("Decided in", "決めた項目")], rows)

    def assumptions_of(self, ctx):
        ids = set()
        scope = list(self.p.stage_items(ctx.stage, ctx.component))
        reached = []
        if ctx.stage == 4 and ctx.component:
            # what the component's modules rest on through the interfaces and data they use
            reached = [i for i in self.p.of("IFC") if i.get("provider") == ctx.component
                       or ctx.component in lib.as_list(i.get("consumers"))]
            reached += [d for d in self.p.of("DAT") if d.get("owner") == ctx.component]
        if ctx.kind == "review":
            label = "review-%s" % ctx.stage
            scope += [f for f in self.p.of("FND", active_only=False) if f.get("raised_in") == ctx.rel]
        else:
            label = str(ctx.stage)
            skill = lib.STAGE_SKILLS[ctx.stage]
            scope += [f for f in self.p.of("FND", active_only=False) if f.get("raised_by") == skill
                      and (ctx.stage != 4 or not ctx.component or f.get("raised_in") == ctx.rel)]
        scope_ids = set(i.id for i in scope)
        for d in self.p.of("DAS", active_only=False):
            if d.status != "open" or str(d.get("stage")) != label:
                continue
            if ctx.component and not (set(i.id for i in self.p.dependents(d.id)) & scope_ids):
                continue
            ids.add(d.id)
        for it in scope + reached:
            refs = lib.mentions(it.get("source")) if it.is_entry else self.p.premises(it)
            for ref in refs:
                if self.p.is_open_assumption(ref):
                    ids.add(ref)
        return [self.p.get(i) for i in ids]

    def t_assumptions(self, ctx):
        self.need(ctx, ("stage", "review"))
        rows = []
        for a in self.assumptions_of(ctx):
            breadth = self.term("", a.get("breadth"))
            severity = self.term("", a.get("severity"))
            if a.prefix == "QAS":
                breadth, severity = Hand(breadth), Hand(severity)
            rows.append([a.id, self.text(a.get("title")), self.term("assumption kind", a.get("kind")), breadth, severity,
                         self.join([i.id for i in self.p.dependents(a.id)])])

        def rating(row):
            b = RATING_ORDER.get(self.g.value_of("", row[3]) or "", 0)
            s = RATING_ORDER.get(self.g.value_of("", row[4]) or "", 0)
            return (-max(b, s), -min(b, s), lib.id_key(row[0]))

        return Table([("ID", "ID"), ("Title", "名前"), ("Kind", "種類"), ("Breadth", "影響の広さ"),
                      ("Severity", "重大さ"), ("Items that depend on it", "依存する項目")], rows, sort_key=rating)

    def t_components(self, ctx):
        self.need(ctx, ("index",))
        rows = []
        for c in self.p.components():
            rel = "4-detailed-design/%s.md" % c.id
            text = self.p.reports.get(rel)
            status = "not started"
            if text is not None:
                status = report_status(text, self.g) or "draft"
            modules = self.p.modules_of(c.id)
            # a module with no depth was written by an earlier version, which designed every module in full
            bounds = [m.id for m in modules if m.get("depth") == "bounds"]
            full = [m.id for m in modules if m.get("depth") != "bounds"]
            rows.append([c.id, self.text(c.get("name") or c.get("title")), self.term("detailed design status", status),
                         rel if text is not None else DASH, self.ranges(full) if full else DASH,
                         self.ranges(bounds) if bounds else DASH])
        return Table([("Component", "コンポーネント"), ("Name", "名前"), ("Status", "状態"), ("Report", "報告書"),
                      ("Full depth", "確定のモジュール"), ("Bounds depth", "枠のモジュール")], rows)

    def t_implementation_handoffs(self, ctx):
        """The open hand-offs addressed to implementation, whichever stage wrote them, for the index."""
        self.need(ctx, ("index",))
        handoffs = [h for h in self.p.of("HND") if h.get("to") == lib.IMPLEMENTATION and h.status == "open"]
        handoffs.sort(key=lambda h: (lib.id_key(h.get("component")), lib.id_key(h.id)))
        rows = [[h.id, self.text(h.get("component")), self.text(h.get("title")), self.text(h.get("trigger"))]
                for h in handoffs]
        return Table([("HND", "HND"), ("Component", "コンポーネント"), ("Title", "名前"), ("Trigger", "契機")], rows)


def report_status(text, glossary):
    """'draft', 'waiting for answers' or 'answers applied', read from a report's header line."""
    for line in text.split("\n")[:12]:
        if "·" not in line:
            continue
        for value in ("answers applied", "waiting for answers", "draft"):
            ja = glossary.term("report status", value, "ja")
            if value in line.lower() or (ja and ja in line):
                return value
    return None


# markdown tables

def split_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|") and not line.endswith("\\|"):
        line = line[:-1]
    cells = re.split(r"(?<!\\)\|", line)
    return [c.strip() for c in cells]


def escape(text):
    return str(text).replace("\r", " ").replace("\n", " ").replace("|", "\\|").strip()


def parse_table(body):
    lines = [l for l in body.split("\n") if l.strip().startswith("|")]
    if not lines:
        return None, []
    header = split_row(lines[0])
    rows = [split_row(l) for l in lines[1:] if not re.match(r"\|?\s*:?-{3,}", l.strip())]
    return header, rows


def render_table(table, lang, old_body):
    old_header, old_rows = parse_table(old_body)
    k = table.key_columns
    old = {}
    for cells in old_rows:
        old.setdefault(tuple(cells[:k]), cells)
    rows = []
    empties = []
    if old_header and len(old_header) == len(table.headers):
        header = old_header
    else:
        header = [h[1] if lang == "ja" else h[0] for h in table.headers]
    for row in table.rows:
        key = tuple(escape(c) if not isinstance(c, Hand) else "" for c in row[:k])
        previous = old.get(key)
        cells = []
        for n, cell in enumerate(row):
            if isinstance(cell, Hand):
                kept = previous[n] if previous is not None and n < len(previous) else ""
                cells.append(kept if kept else escape(cell.default))
                if not cells[-1]:
                    empties.append((key, header[n]))
            else:
                cells.append(escape(cell))
        rows.append(cells)
    if table.sort_key:
        rows.sort(key=table.sort_key)
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(cells) + " |" for cells in rows]
    return "\n".join(out), rows, empties


def language(text):
    outside = BLOCK_RE.sub("", text)
    return "ja" if KANA_RE.search(outside) else "en"


def render_report(project, glossary, rel, text, lang=None):
    """Return (new text, problems, tables): the report with its generated tables rewritten.

    problems: [(line, message)] for markers that cannot be rendered.
    tables: [(name, line, header, rows)] of the tables written, for the checks.
    """
    ctx = lib.report_context(rel)
    lang = lang or language(text)
    renderer = Renderer(project, glossary, lang)
    problems = []
    tables = []
    opens = [m.start() for m in OPEN_RE.finditer(text)]
    closes = [m.start() for m in CLOSE_RE.finditer(text)]
    balanced = len(opens) == len(closes) and all(
        o < c and (n + 1 == len(opens) or c < opens[n + 1]) for n, (o, c) in enumerate(zip(opens, closes)))
    if not balanced:
        problems.append((line_of(text, opens[0] if opens else (closes[0] if closes else 0)),
                         "the generated-table markers do not pair up: every '<!-- generated: name -->' needs a"
                         " '<!-- /generated -->' after it"))
        return text, problems, tables

    def replace(m):
        name = m.group(2)
        line = line_of(text, m.start())
        if ctx is None:
            problems.append((line, "generated tables are written only in the reports of a stage, the detailed"
                                   " design index and the review reports at their fixed paths"))
            return m.group(0)
        try:
            table = renderer.build(name, ctx)
        except TableError as e:
            problems.append((line, "table '%s': %s" % (name, e)))
            return m.group(0)
        body, rows, empties = render_table(table, lang, m.group(3))
        header = parse_table(body)[0]
        tables.append((name, line, header, rows, table, empties))
        return m.group(1) + "\n" + body + "\n" + m.group(4)

    new_text = BLOCK_RE.sub(replace, text)
    return new_text, problems, tables


def line_of(text, index):
    return text.count("\n", 0, index) + 1


# the request document

REQUESTS_SHOWN = ("open", "answered")
SECTION_RE = re.compile(r"###[ \t]+(QCR-[0-9]{2,})(?![0-9])")
PRINTS_RE = re.compile(r"<!--[ \t]*fingerprints:[ \t]*(.*?)[ \t]*-->\Z")
# an answer's label, also written as a list item, in bold, in lower case or as 回答
ANSWER_RE = re.compile(r"[ \t]*(?:[-*+][ \t]+)?[*_]{0,2}[ \t]*(?:answer|答え|回答)[ \t]*[*_]{0,2}[ \t]*[:：][ \t]*[*_]{0,2}"
                       r"[ \t]*(.*)\Z", re.I)
STAGE_LINE_RE = re.compile(r"- (?:.*?: )?QCR-[0-9]{2,} .*(?: \((?:open|answered)\)|（(?:未回答|回答済み)）)\Z")
REQUEST_TEXT = {
    "title": ("Requests to the quality chain", "品質チェーンへの要求書"),
    "note": ("Written by scripts/tables.py from the requests in qcr/. Edit nothing but the answers: write an answer"
             " after \"Answer:\" under a request, and the next design run records it in the request. The fingerprints"
             " on the last line tell the script what was edited by hand.",
             "scripts/tables.py が qcr/ の要求から書く。手で書くのは答えだけにする。要求の「答え:」の後に答えを書くと、"
             "次の設計の実行がそれを要求に写す。最後の行の指紋で、スクリプトは手で書いた所を見分ける。"),
    "intro": ("The design chain never changes the quality chain (`docs/quality/`). When the design shows that a"
              " requirement should change, or that one it needs is missing, it writes a request; every request that"
              " is open or answered is here. Write an answer after \"Answer:\" under a request when you know it: the"
              " next design run records it. Then hand this document to the quality-chain stages listed under \"What"
              " to do in each quality-chain stage\", and re-run them. On their next run, the design stages follow"
              " what changed in `docs/quality/`, and drop the requests applied there.",
              "設計の連鎖は、品質チェーン（`docs/quality/`）を直さない。品質チェーンの要求を変えるべきだと設計で分かったときや、"
              "設計に要る要求が品質チェーンにないときは、品質チェーンへの要求を書く。ここには、未回答と回答済みの要求がすべてある。"
              "答えが決まった要求には、「答え:」の後に答えを書く。次の設計の実行が、それを要求に写す。そのうえで、この文書を"
              "「品質チェーンの段ごとにすること」に挙げた段に渡して、その段を再実行する。設計の段は、次の実行で `docs/quality/` "
              "の変わった所に追随し、反映された要求をここから外す。"),
    "list": ("List", "一覧"),
    "requests": ("Requests and answers", "要求と答え"),
    "stages": ("What to do in each quality-chain stage", "品質チェーンの段ごとにすること"),
    "stages_intro": ("Re-run each stage below with this document. It applies the answers and decides with you the"
                     " requests that have none; the later quality-chain stages follow its changes on their own re-run.",
                     "下の段に、この文書を渡して再実行する。その段は答えを反映し、答えのない要求はあなたと決める。品質チェーンの"
                     "後の段は、その変更に自分の再実行で追随する。"),
    "none": ("No request is open or answered.", "未回答の要求も、回答済みの要求もない。"),
    "status": ("Status", "状態"),
    "raised": ("Raised in", "出した段"),
    "impact": ("Impact", "影響"),
    "targets": ("Chain items", "品質チェーンの項目"),
    "quality_stages": ("Quality-chain stages", "品質チェーンの段"),
    "origin": ("Origin", "由来の項目"),
    "dependents": ("Items that depend on it", "依存する項目"),
    "issue": ("Issue", "課題"),
    "suggestion": ("Suggested change", "直し方の案"),
    "answer": ("Answer", "答え"),
}
BULLET_RE = re.compile(r"- (?:%s): " % "|".join(re.escape(x) for k in ("status", "impact", "targets", "origin", "issue",
                                                                         "suggestion") for x in REQUEST_TEXT[k]))
FIXED_TEXTS = set(REQUEST_TEXT[k][n] for k in ("intro", "stages_intro", "none") for n in (0, 1))


def one_line(value):
    return re.sub(r"\s*\n\s*", " ", str(value)).strip() if value not in (None, "") else ""


def normalized(value):
    return re.sub(r"\s+", " ", str(value)).strip() if value not in (None, "") else ""


def answer_key(value):
    """An answer as compared: unescaped, without its spacing, and without a placeholder or a list mark before it."""
    text = re.sub(r"(?m)^\\#", "#", str(value)) if value not in (None, "") else ""
    return re.sub(r"\A(?:[%s-](?:\s+|\Z))+" % DASH, "", normalized(text))


def answer_lines(answer):
    """The lines of an answer as the document shows them: a line that starts with # is escaped, to stay text."""
    return [("\\" + l if l.startswith("#") else l) for l in str(answer).strip().split("\n")]


def quality_stages(request):
    out = []
    for s in lib.as_list(request.get("quality_stages")):
        if str(s) in ("1", "2", "3", "4") and int(s) not in out:
            out.append(int(s))
    return sorted(out)


def fingerprint(lines):
    return hashlib.sha1("\n".join(lines).strip().encode("utf-8")).hexdigest()[:10]


def doc_parts(text):
    """(rest, sections, fingerprints) of a request document.

    rest: [(line number, line)] outside the sections of the requests; sections: [(QCR ID, line number, lines)];
    fingerprints: {QCR ID or "rest": fingerprint}, as the last line records them.
    """
    rest, sections, prints, current = [], [], {}, None
    for n, line in enumerate((text or "").split("\n"), 1):
        m = PRINTS_RE.match(line.strip())
        if m:
            for part in m.group(1).split(","):
                bits = part.split()
                if len(bits) == 2:
                    prints[bits[0]] = bits[1]
            continue
        if line.startswith("#"):
            m = SECTION_RE.match(line)
            if m:
                current = (m.group(1), n, [line])
                sections.append(current)
                continue
            current = None
        if current is not None:
            current[2].append(line)
        else:
            rest.append((n, line))
    return rest, sections, prints


def requests_language(project):
    """The language of the request document: its title's when it exists, else that of the reports or the requests."""
    if project.request_doc is not None:
        first = next((l for l in project.request_doc.split("\n") if l.startswith("# ")), project.request_doc)
        return "ja" if KANA_RE.search(first) else "en"
    sample = " ".join(BLOCK_RE.sub("", t) for t in project.reports.values())
    if not sample.strip():
        sample = " ".join(str(q.get(k) or "") for q in project.of("QCR", active_only=False) for k in ("title", "issue"))
    return "ja" if KANA_RE.search(sample) else "en"


def render_requests(project, glossary, lang=None):
    """The request document, written from the requests to the quality chain that are open or answered."""
    lang = lang or requests_language(project)
    ja = lang == "ja"
    r = Renderer(project, glossary, lang)

    def t(key):
        return REQUEST_TEXT[key][1 if ja else 0]

    def label(key, value):
        return "%s: %s" % (t(key), value)

    def raised_in(stage):
        stage = str(stage)
        if stage in ("1", "2", "2b", "3", "4"):
            return ("第 %s 段階" if ja else "stage %s") % stage
        m = re.match(r"review-(2b|[234])\Z", stage)
        if m:
            return ("第 %s 段階のレビュー" if ja else "review of stage %s") % m.group(1)
        return r.text(stage)

    def ids(values):
        values = [str(v) for v in lib.as_list(values) if v not in (None, "")]
        valid = [v for v in values if lib.is_id(v)]
        out = [r.ranges(valid, shortest=3)] if valid else []
        return r.join(out + [v for v in values if not lib.is_id(v)])

    def status(q):
        text = r.term("request status", q.status)
        where = one_line(q.get("answered_in"))
        if q.status == "answered" and where:
            text += ("（%s）" if ja else " (%s)") % where
        return text

    def dependents(q):
        """The items whose premises name the request, or a QAS whose answer it carries."""
        names = [q.id] + [x for x in lib.as_list(q.get("targets")) if lib.prefix_of(x) == "QAS"]
        found = set(i.id for name in names for i in project.dependents(name))
        return sorted(found, key=lib.id_key)

    def answer(q):
        if q.get("answer") in (None, ""):
            return [label("answer", DASH)]
        lines = answer_lines(q.get("answer"))
        return [label("answer", lines[0])] if len(lines) == 1 else [t("answer") + ":"] + lines

    shown = [q for q in project.of("QCR", active_only=False) if q.status in REQUESTS_SHOWN]
    out = ["# " + t("title"), "", "<!-- " + t("note") + " -->", "", t("intro"), "", "## " + t("list"), ""]
    if not shown:
        out += [t("none"), ""]
    else:
        rows = [[q.id, r.text(one_line(q.get("title"))), ids(q.get("targets")), r.join(quality_stages(q)),
                 r.term("impact of a request", q.get("impact")), r.term("request status", q.status),
                 raised_in(q.get("stage"))] for q in shown]
        table = Table([("QCR", "QCR"), ("Request", "要求"), ("Chain items", "品質チェーンの項目"),
                       ("Quality-chain stages", "品質チェーンの段"), ("Impact", "影響"), ("Status", "状態"),
                       ("Raised in", "出した段")], rows)
        out += [render_table(table, lang, "")[0], "", "## " + t("requests"), ""]
        stop = "。" if ja else ". "
        for q in shown:
            impact = r.term("impact of a request", q.get("impact"))
            note = one_line(q.get("impact_note"))
            out += ["### %s %s" % (q.id, one_line(q.get("title"))), "",
                    "- %s · %s" % (label("status", status(q)), label("raised", raised_in(q.get("stage")))),
                    "- " + label("impact", impact + (stop + note if note else "")),
                    "- %s · %s" % (label("targets", ids(q.get("targets"))),
                                   label("quality_stages", r.join(quality_stages(q)))),
                    "- %s · %s" % (label("origin", ids(q.get("origin"))), label("dependents", ids(dependents(q)))),
                    "- " + label("issue", r.text(one_line(q.get("issue")))),
                    "- " + label("suggestion", r.text(one_line(q.get("suggestion")))),
                    ""] + answer(q) + [""]
        if any(quality_stages(q) for q in shown):
            out += ["## " + t("stages"), "", t("stages_intro"), ""]
            for stage in sorted(lib.QUALITY_STAGE_SKILLS):
                lines = []
                for q in shown:
                    if stage not in quality_stages(q):
                        continue
                    here = [x for x in lib.as_list(q.get("targets")) if project.quality_stage_of(x) == stage]
                    line = "- %s%s %s" % (ids(here) + ": " if here else "", q.id, one_line(q.get("title")))
                    lines.append(line + (("（%s）" if ja else " (%s)") % r.term("request status", q.status)))
                if lines:
                    heading = ("第 %d 段階（`%s`）" if ja else "Stage %d (`%s`)") % (stage,
                                                                                lib.QUALITY_STAGE_SKILLS[stage])
                    out += ["### " + heading, ""] + lines + [""]
    body = "\n".join(out)
    rest, sections, _ = doc_parts(body)
    prints = ["rest " + fingerprint([l for _, l in rest])] + ["%s %s" % (i, fingerprint(ls)) for i, _, ls in sections]
    return body + "\n<!-- fingerprints: %s -->\n" % ", ".join(prints)


def section_edits(lines):
    """(answer, its line offset, [(offset, line)] written by hand) of a request section that was edited."""
    answer, at, stray = None, 0, []
    for k, line in enumerate(lines[1:], 1):
        if answer is not None:
            answer.append(line)
            continue
        m = ANSWER_RE.match(line)
        if m:
            answer, at = [m.group(1)], k
        elif line.strip() and not BULLET_RE.match(line):
            stray.append((k, line))
    return ("\n".join(answer) if answer is not None else None), at, stray


def generated_rest_line(line):
    s = line.strip()
    return (not s or s.startswith(("#", "|", "<!--")) or s in FIXED_TEXTS or bool(STAGE_LINE_RE.match(s)))


def answer_conflicts(project):
    """[(QCR ID or None, line, message)]: what was written in the request document by hand and the requests lack.

    Only the parts whose fingerprint shows an edit are read, so that a request's answer can change freely while its
    section in the document is as the script wrote it."""
    rest, sections, prints = doc_parts(project.request_doc)
    out = []
    if project.request_doc is None:
        return out
    again = ("record it in the request it concerns, then delete it here, or delete the request's section (or the whole"
             " document) once the requests hold everything written in it")
    if prints.get("rest") != fingerprint([l for _, l in rest]):
        for n, line in rest:
            if not generated_rest_line(line):
                out.append((None, n, "this line was written by hand outside the answers, and the script would drop it: "
                           + again))
    for ident, start, lines in sections:
        if prints.get(ident) == fingerprint(lines):
            continue
        written, at, stray = section_edits(lines)
        for k, line in stray:
            out.append((ident, start + k, "the section of %s holds a line written by hand that is not its answer, and"
                                          " the script would drop it: %s" % (ident, again)))
        got = answer_key(written)
        if not got:
            continue
        item = project.get(ident)
        if item is None or item.prefix != "QCR":
            out.append((ident, start + at, "an answer is written under %s, which is no request in qcr/: move it under"
                                           " the request it answers, or delete it" % ident))
        elif got != answer_key(item.get("answer")):
            out.append((ident, start + at, "the answer written under %s is not the one qcr/%s.yaml holds: record it"
                                           " there as written (answer, answered_in: %s, status), then run tables.py"
                                           " again; if the request holds it in other words, delete it here"
                                           % (ident, ident, lib.REQUESTS_DOC)))
    return out


def reports_for_skill(project, skill):
    out = []
    for rel in project.reports:
        ctx = lib.report_context(rel)
        if ctx is not None and ctx.owner == skill:
            out.append(rel)
    return out


def main(argv):
    import argparse

    parser = argparse.ArgumentParser(description="Write the generated tables of the design reports from the items.")
    parser.add_argument("reports", nargs="*", help="report paths, relative to the design directory or not")
    parser.add_argument("--design", default="docs/design")
    parser.add_argument("--quality", default=None)
    parser.add_argument("--skill", default=None, choices=lib.SKILLS)
    parser.add_argument("--lang", default=None, choices=("en", "ja"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if not os.path.isdir(args.design):
        print("tables.py: no design directory at %s" % args.design)
        return 2
    quality = args.quality if args.quality is not None else lib.default_quality_dir(args.design)
    project = lib.Project(args.design, quality)
    glossary = lib.Glossary()
    requests = True
    if args.reports:
        targets = []
        requests = False
        for path in args.reports:
            rel = os.path.relpath(os.path.abspath(path), os.path.abspath(args.design)).replace(os.sep, "/")
            if rel.startswith(".."):
                rel = path.replace(os.sep, "/")
            if rel == lib.REQUESTS_DOC:
                requests = True
                continue
            if rel not in project.reports:
                print("tables.py: no report %s in %s" % (rel, args.design))
                return 2
            targets.append(rel)
    elif args.skill:
        targets = reports_for_skill(project, args.skill)
    else:
        targets = list(project.reports)
    requests = requests and (project.request_doc is not None or bool(project.of("QCR", active_only=False)))
    changed = 0
    failed = 0
    if requests:
        conflicts = answer_conflicts(project)
        for ident, line, message in conflicts:
            failed += 1
            print("%s:%d: %s; the document was not rewritten" % (lib.REQUESTS_DOC, line, message))
        new_text = render_requests(project, glossary, args.lang)
        if not conflicts and new_text != project.request_doc:
            changed += 1
            if args.dry_run:
                print("%s: out of date" % lib.REQUESTS_DOC)
            else:
                with open(os.path.join(args.design, lib.REQUESTS_DOC), "w", encoding="utf-8") as f:
                    f.write(new_text)
                print("%s: rewritten" % lib.REQUESTS_DOC)
    for rel in targets:
        text = project.reports[rel]
        new_text, problems, tables = render_report(project, glossary, rel, text, args.lang)
        for line, message in problems:
            failed += 1
            print("%s:%d: %s" % (rel, line, message))
        if new_text != text:
            changed += 1
            if args.dry_run:
                print("%s: tables out of date" % rel)
            else:
                with open(os.path.join(args.design, rel), "w", encoding="utf-8") as f:
                    f.write(new_text)
                print("%s: tables rewritten" % rel)
    if not targets and not requests:
        print("tables.py: no report to write")
    elif not changed and not failed:
        checked = (["%d report(s)" % len(targets)] if targets else []) + (["the request document"] if requests else [])
        print("tables.py: %s checked; everything generated is up to date" % " and ".join(checked))
    if failed:
        return 1
    return 1 if (args.dry_run and changed) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
