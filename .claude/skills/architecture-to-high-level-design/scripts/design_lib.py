"""Load the design chain's items and the quality chain's items, for check.py and tables.py.

Only the Python standard library is used. YAML is read with yaml_lite.
"""

import glob
import os
import re

import yaml_lite

STAGE_SKILLS = {  # in the order the stages run; stage 2b runs between stages 2 and 3
    1: "requirements-to-architecture-drivers",
    2: "architecture-drivers-to-architecture",
    "2b": "architecture-to-technical-policy",
    3: "architecture-to-high-level-design",
    4: "high-level-design-to-detailed-design",
}
REVIEW_SKILL = "design-review"
SKILLS = list(STAGE_SKILLS.values()) + [REVIEW_SKILL]
SKILL_STAGE = dict((v, k) for k, v in STAGE_SKILLS.items())
DEC_STAGES = {"architecture": 2, "technical-policy": "2b", "high-level-design": 3, "detailed-design": 4}
POL_SCOPES = ["technology", "repository", "testing", "pipeline-and-code", "specs", "implementation-feedback"]

DESIGN_DIRS = [("drv", "DRV"), ("dec", "DEC"), ("elm", "ELM"), ("pol", "POL"), ("ifc", "IFC"), ("dat", "DAT"),
               ("mod", "MOD"), ("hnd", "HND"), ("fnd", "FND"), ("das", "DAS"), ("qcr", "QCR")]
IMPLEMENTATION = "implementation"  # a hand-off's `to` when the code decides it
REQUESTS_DOC = "quality-chain-requests.md"  # the request document, written whole by tables.py from qcr/
QUALITY_STAGE_SKILLS = {
    1: "cuj-to-quality-in-use",
    2: "quality-in-use-to-functional-requirements",
    3: "functional-requirements-to-product-quality",
    4: "product-quality-to-slo",
}
# the quality-chain stage that writes each kind of chain item (QAS: the stage in the file)
QUALITY_HOME_STAGE = {"USR": 1, "CUJ": 1, "CON": 1, "EXT": 1, "OPF": 1, "DIN": 1, "KGI": 1, "OUT": 1, "QIU": 1,
                      "KPI": 1, "FR": 2, "FRP": 2, "QR": 3, "NFR": 4, "SLI": 4, "EBP": 4}
CONTEXT_LISTS = [("technology_constraints", "TC"), ("project_constraints", "PC"), ("teams", "TEAM"),
                 ("anticipated_changes", "CHG"), ("stakeholders", "STK")]
QUALITY_DIRS = [("qiu", "QIU"), ("kpi", "KPI"), ("fr", "FR"), ("frp", "FRP"), ("qr", "QR"),
                ("nfr", "NFR"), ("sli", "SLI"), ("ebp", "EBP"), ("qas", "QAS")]
QUALITY_CONTEXT_LISTS = [("constraints", "CON"), ("external_systems", "EXT"), ("design_inputs", "DIN"),
                         ("kgis", "KGI"), ("outcomes", "OUT"), ("users", "USR"), ("cujs", "CUJ"),
                         ("operational_facts", "OPF")]

DESIGN_PREFIXES = [p for _, p in DESIGN_DIRS] + [p for _, p in CONTEXT_LISTS]
QUALITY_PREFIXES = [p for _, p in QUALITY_DIRS] + [p for _, p in QUALITY_CONTEXT_LISTS]
ALL_PREFIXES = DESIGN_PREFIXES + QUALITY_PREFIXES
ID_RE = re.compile(r"(%s)-([0-9]{2,})\Z" % "|".join(ALL_PREFIXES))
MENTION_RE = re.compile(r"(?<![A-Za-z0-9_-])(%s)-([0-9]{2,})(?![0-9])"
                        % "|".join(sorted(ALL_PREFIXES, key=len, reverse=True)))

REPORTS = [
    ("1-architecture-drivers.md", "stage", 1),
    ("2-architecture.md", "stage", 2),
    ("2b-technical-policy.md", "stage", "2b"),
    ("3-high-level-design.md", "stage", 3),
    ("4-detailed-design.md", "index", 4),
]
REVIEW_REPORTS = {"2-architecture.md": 2, "2b-technical-policy.md": "2b", "3-high-level-design.md": 3}


def prefix_of(ident):
    m = ID_RE.match(ident) if isinstance(ident, str) else None
    return m.group(1) if m else None


def is_id(value):
    return prefix_of(value) is not None


def mentions(text):
    """IDs written in full in a text, in order of appearance, without repeats."""
    if not isinstance(text, str):
        return []
    seen = []
    for m in MENTION_RE.finditer(text):
        ident = m.group(0)
        if ident not in seen:
            seen.append(ident)
    return seen


def strings_in(value, skip=()):
    """Every string inside a YAML value, with the path to it; paths in `skip` are left out."""
    out = []

    def walk(v, path):
        if path in skip:
            return
        if isinstance(v, str):
            out.append((path, v))
        elif isinstance(v, dict):
            for k, x in v.items():
                walk(x, path + (str(k),))
        elif isinstance(v, list):
            for x in v:
                walk(x, path + ("[]",))

    walk(value, ())
    return out


def as_list(value):
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return list(value)
    return [value]


class Item(object):
    """One design or quality item: a file, or an entry of design-context.yaml or context.yaml."""

    def __init__(self, ident, chain, path, data, line=1, key_lines=None):
        self.id = ident
        self.prefix = prefix_of(ident)
        self.chain = chain  # "design" | "quality"
        self.path = path  # relative to the design or quality directory
        self.data = data if isinstance(data, dict) else {}
        self.line = line
        self.key_lines = key_lines or {}

    def get(self, key, default=None):
        return self.data.get(key, default)

    @property
    def status(self):
        status = self.data.get("status")
        return status if isinstance(status, str) else "active"

    @property
    def retired(self):
        return self.status == "retired"

    @property
    def is_entry(self):
        return self.prefix in ("TC", "PC", "TEAM", "CHG", "STK") or self.prefix in dict(QUALITY_CONTEXT_LISTS).values()

    def line_of(self, key):
        if self.is_entry:
            return self.line
        return self.key_lines.get(key, 1)

    def title(self):
        for key in ("title", "name", "statement", "change", "role", "fact"):
            value = self.data.get(key)
            if isinstance(value, str) and value:
                return value
        return ""


class SourceFile(object):
    def __init__(self, path, rel, chain):
        self.path = path
        self.rel = rel
        self.chain = chain
        self.document = None
        self.error = None
        self.text = ""

    def read(self):
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self.text = f.read()
        except (OSError, UnicodeDecodeError) as e:
            self.error = yaml_lite.YAMLError("cannot read the file: %s" % e, 1, 1)
            return self
        try:
            self.document = yaml_lite.load(self.text)
        except yaml_lite.YAMLError as e:
            self.error = e
        return self

    @property
    def data(self):
        return self.document.data if self.document else None


class Project(object):
    def __init__(self, design_dir, quality_dir=None):
        self.design_dir = os.path.normpath(design_dir)
        self.quality_dir = os.path.normpath(quality_dir) if quality_dir else None
        self.items = {}
        self.files = []  # every YAML file read, design and quality
        self.duplicates = []  # (item, earlier item)
        self.specs = {}  # rel path -> SourceFile
        self.reports = {}  # rel path -> text
        self.request_doc = None  # the text of quality-chain-requests.md, when it exists
        self.context = None  # design-context.yaml SourceFile
        self.quality_context = None
        self._load()

    # loading

    def _add(self, item):
        if item.id in self.items:
            self.duplicates.append((item, self.items[item.id]))
            return
        self.items[item.id] = item

    def _read(self, path, rel, chain):
        f = SourceFile(path, rel, chain).read()
        self.files.append(f)
        return f

    def _load_dir(self, root, sub, chain):
        for path in sorted(glob.glob(os.path.join(root, sub, "*.yaml"))):
            rel = os.path.relpath(path, root).replace(os.sep, "/")
            f = self._read(path, rel, chain)
            data = f.data
            if not isinstance(data, dict):
                continue
            ident = data.get("id")
            if not isinstance(ident, str) or not is_id(ident):
                ident = os.path.splitext(os.path.basename(path))[0]
            if not is_id(ident):
                continue
            self._add(Item(ident, chain, rel, data, 1, f.document.key_lines))

    def _load_entries(self, f, lists, chain):
        data = f.data
        if not isinstance(data, dict):
            return
        lines = entry_lines(f.text)
        for key, prefix in lists:
            for entry in as_list(data.get(key)):
                if isinstance(entry, dict) and isinstance(entry.get("id"), str) and is_id(entry["id"]):
                    self._add(Item(entry["id"], chain, f.rel, entry, lines.get(entry["id"], 1)))

    def _load(self):
        d = self.design_dir
        for sub, _ in DESIGN_DIRS:
            self._load_dir(d, sub, "design")
        context_path = os.path.join(d, "design-context.yaml")
        if os.path.exists(context_path):
            self.context = self._read(context_path, "design-context.yaml", "design")
            self._load_entries(self.context, CONTEXT_LISTS, "design")
        for path in sorted(glob.glob(os.path.join(d, "ifc", "specs", "*"))):
            if os.path.isfile(path) and path.endswith((".yaml", ".yml", ".json")):
                rel = os.path.relpath(path, d).replace(os.sep, "/")
                self.specs[rel] = self._read(path, rel, "design")
        for rel in report_paths(d):
            with open(os.path.join(d, rel), "r", encoding="utf-8") as f:
                self.reports[rel] = f.read()
        requests_path = os.path.join(d, REQUESTS_DOC)
        if os.path.exists(requests_path):
            with open(requests_path, "r", encoding="utf-8") as f:
                self.request_doc = f.read()
        q = self.quality_dir
        if q and os.path.isdir(q):
            for sub, _ in QUALITY_DIRS:
                self._load_dir(q, sub, "quality")
            qc = os.path.join(q, "context.yaml")
            if os.path.exists(qc):
                self.quality_context = self._read(qc, "context.yaml", "quality")
                self._load_entries(self.quality_context, QUALITY_CONTEXT_LISTS, "quality")

    # queries

    @property
    def has_quality(self):
        return bool(self.quality_dir and os.path.isdir(self.quality_dir))

    def of(self, prefix, active_only=True):
        out = [i for i in self.items.values() if i.prefix == prefix and (not active_only or not i.retired)]
        return sorted(out, key=lambda i: id_key(i.id))

    def get(self, ident):
        return self.items.get(ident)

    def design_items(self):
        return [i for i in self.items.values() if i.chain == "design"]

    def components(self):
        return [e for e in self.of("ELM") if e.get("kind") == "component"]

    def modules_of(self, component, active_only=True):
        return [m for m in self.of("MOD", active_only) if m.get("component") == component]

    def stage4_decisions_of(self, component):
        ids = set()
        for m in self.modules_of(component):
            ids.update(x for x in as_list(m.get("decisions")) if isinstance(x, str))
        return [d for d in self.of("DEC") if d.id in ids and d.get("stage") == "detailed-design"]

    def stage_items(self, stage, component=None):
        """The active items a stage writes (for stage 4, those of one component)."""
        skill = STAGE_SKILLS.get(stage)
        handoffs = [h for h in self.of("HND") if h.get("from") == skill
                    and (stage != 4 or not component or h.get("component") == component)]
        return self.stage_own_items(stage, component) + handoffs

    def stage_own_items(self, stage, component=None):
        if stage == 1:
            return self.of("DRV") + [i for p in ("TC", "PC", "TEAM", "CHG", "STK") for i in self.of(p)]
        if stage == 2:
            return [d for d in self.of("DEC") if d.get("stage") == "architecture"] + self.of("ELM")
        if stage == "2b":
            return self.of("POL") + [d for d in self.of("DEC") if d.get("stage") == "technical-policy"]
        if stage == 3:
            decisions = [d for d in self.of("DEC") if d.get("stage") == "high-level-design"]
            return self.of("IFC") + self.of("DAT") + decisions
        if stage == 4:
            if component:
                return self.modules_of(component) + self.stage4_decisions_of(component)
            return self.of("MOD") + [d for d in self.of("DEC") if d.get("stage") == "detailed-design"]
        return []

    def premises(self, item):
        return [p for p in as_list(item.get("premises")) if isinstance(p, str)]

    def is_open_assumption(self, ident):
        it = self.get(ident)
        return it is not None and it.prefix in ("DAS", "QAS") and it.status == "open"

    def dependents(self, ident):
        """Design items that depend on an assumption: their premises name it (design-context entries: their source)."""
        out = []
        for it in self.design_items():
            if it.retired or it.prefix == "DAS":
                continue
            if it.is_entry:
                if ident in mentions(it.get("source")):
                    out.append(it)
            elif ident in self.premises(it):
                out.append(it)
        return sorted(out, key=lambda i: id_key(i.id))

    def requests_on(self, ident):
        """The requests to the quality chain, open or answered, whose targets name a chain item."""
        return [q for q in self.of("QCR", active_only=False)
                if q.status in ("open", "answered") and ident in as_list(q.get("targets"))]

    def quality_stage_of(self, ident):
        """The quality-chain stage that writes a chain item, or None."""
        prefix = prefix_of(ident)
        if prefix == "QAS":
            it = self.get(ident)
            stage = str(it.get("stage")) if it is not None else ""
            return int(stage) if stage in ("1", "2", "3", "4") else None
        return QUALITY_HOME_STAGE.get(prefix)

    def citing(self, ident):
        """Design items whose basis_note cites an ID in full."""
        out = []
        for it in self.design_items():
            if it.id != ident and ident in mentions(it.get("basis_note")):
                out.append(it)
        return sorted(out, key=lambda i: id_key(i.id))

    def nfrs_of_kind(self, kind):
        """The quality chain's active NFRs of one kind: slo, gate, audit or monitor."""
        return [n for n in self.of("NFR") if n.get("kind") == kind]

    def nfr_bindings(self, field):
        """{NFR ID: [POL IDs]}: the NFRs that the active policies bind in `field` (gate_bindings, audit_bindings)."""
        out = {}
        for pol in self.of("POL"):
            for binding in as_list(pol.get(field)):
                nfr = binding.get("nfr") if isinstance(binding, dict) else None
                if isinstance(nfr, str) and pol.id not in out.get(nfr, []):
                    out.setdefault(nfr, []).append(pol.id)
        return out

    def schema_handoffs(self, ident):
        """The hand-offs that leave the schema of an interface to implementation: addressed to implementation, not
        retired, with the interface in their origin."""
        return [h for h in self.of("HND") if h.get("to") == IMPLEMENTATION and ident in as_list(h.get("origin"))]

    def component_of_finding(self, finding):
        """The components a finding addressed to stage 4 concerns."""
        out = set()
        raised_in = finding.get("raised_in")
        m = re.search(r"(ELM-[0-9]{2,})\.md\Z", raised_in) if isinstance(raised_in, str) else None
        if m:
            out.add(m.group(1))
        for t in as_list(finding.get("targets")):
            it = self.get(t) if isinstance(t, str) else None
            if it is None:
                continue
            if it.prefix == "ELM":
                out.add(it.id)
            elif it.prefix == "MOD" and isinstance(it.get("component"), str):
                out.add(it.get("component"))
            elif it.prefix == "DEC" and it.get("stage") == "detailed-design":
                for c in self.components():
                    if it in self.stage4_decisions_of(c.id):
                        out.add(c.id)
        return out

    def owner(self, item):
        """The skill that writes an item."""
        p = item.prefix
        if p in ("DRV", "TC", "PC", "TEAM", "CHG", "STK"):
            return STAGE_SKILLS[1]
        if p == "ELM":
            return STAGE_SKILLS[2]
        if p == "POL":
            return STAGE_SKILLS["2b"]
        if p in ("IFC", "DAT"):
            return STAGE_SKILLS[3]
        if p == "MOD":
            return STAGE_SKILLS[4]
        if p == "DEC":
            return STAGE_SKILLS.get(DEC_STAGES.get(item.get("stage")))
        if p in ("DAS", "QCR"):
            return das_owner(item.get("stage"))
        if p == "FND":
            raised_by = item.get("raised_by")
            return raised_by if raised_by in SKILLS + [IMPLEMENTATION] else None
        if p == "HND":
            sender = item.get("from")
            return sender if sender in STAGE_SKILLS.values() else None
        return None


def stage_key(stage):
    """The key of STAGE_SKILLS for a stage written as 1, "2", "2b"; None when there is no such stage."""
    text = str(stage)
    if text.isdigit() and int(text) in STAGE_SKILLS:
        return int(text)
    return text if text in STAGE_SKILLS else None


def das_owner(stage):
    stage = str(stage)
    if stage_key(stage) is not None:
        return STAGE_SKILLS[stage_key(stage)]
    if stage.startswith("review-") and stage_key(stage[len("review-"):]) in (2, "2b", 3, 4):
        return REVIEW_SKILL
    return None


def path_owner(rel):
    """The skill that writes a file under docs/design, from its path alone; None when it depends on the content."""
    if rel == "design-context.yaml" or rel.startswith("drv/") or rel == "1-architecture-drivers.md":
        return STAGE_SKILLS[1]
    if rel.startswith("elm/") or rel == "2-architecture.md":
        return STAGE_SKILLS[2]
    if rel.startswith("pol/") or rel == "2b-technical-policy.md":
        return STAGE_SKILLS["2b"]
    if rel.startswith(("ifc/", "dat/")) or rel == "3-high-level-design.md":
        return STAGE_SKILLS[3]
    if rel.startswith(("mod/", "4-detailed-design")):
        return STAGE_SKILLS[4]
    if rel.startswith("reviews/"):
        return REVIEW_SKILL
    return None


def id_key(ident):
    m = ID_RE.match(ident or "")
    if not m:
        return (ident or "", 0)
    return (m.group(1), int(m.group(2)))


def entry_lines(text):
    """Line numbers of the '- id: XX-nn' entries of a file with lists of entries."""
    out = {}
    for n, line in enumerate(text.split("\n"), 1):
        m = re.match(r"\s*-\s*(?:\{\s*)?id:\s*['\"]?([A-Z]+-[0-9]+)", line)
        if m and m.group(1) not in out:
            out[m.group(1)] = n
        m = re.match(r"\s+id:\s*['\"]?([A-Z]+-[0-9]+)", line)
        if m and m.group(1) not in out:
            out[m.group(1)] = n
    return out


def report_paths(design_dir):
    out = []
    for rel, _, _ in REPORTS:
        if os.path.exists(os.path.join(design_dir, rel)):
            out.append(rel)
    for path in sorted(glob.glob(os.path.join(design_dir, "4-detailed-design", "*.md"))):
        out.append(os.path.relpath(path, design_dir).replace(os.sep, "/"))
    for path in sorted(glob.glob(os.path.join(design_dir, "reviews", "*.md"))):
        out.append(os.path.relpath(path, design_dir).replace(os.sep, "/"))
    return out


class ReportContext(object):
    def __init__(self, rel, kind, stage, component=None):
        self.rel = rel
        self.kind = kind  # "stage" | "index" | "review"
        self.stage = stage
        self.component = component

    @property
    def owner(self):
        return REVIEW_SKILL if self.kind == "review" else STAGE_SKILLS[self.stage]


def report_context(rel):
    for path, kind, stage in REPORTS:
        if rel == path:
            return ReportContext(rel, kind, stage)
    m = re.match(r"4-detailed-design/(ELM-[0-9]{2,})\.md\Z", rel)
    if m:
        return ReportContext(rel, "stage", 4, m.group(1))
    m = re.match(r"reviews/(2-architecture|2b-technical-policy|3-high-level-design)\.md\Z", rel)
    if m:
        return ReportContext(rel, "review", REVIEW_REPORTS[m.group(1) + ".md"])
    m = re.match(r"reviews/4-detailed-design-(ELM-[0-9]{2,})\.md\Z", rel)
    if m:
        return ReportContext(rel, "review", 4, m.group(1))
    return None


def default_quality_dir(design_dir):
    """The quality chain's directory: read_from.quality_chain in design-context.yaml, else docs/quality."""
    path = os.path.join(design_dir, "design-context.yaml")
    if os.path.exists(path):
        try:
            data = yaml_lite.load_file(path).data
        except (yaml_lite.YAMLError, OSError, UnicodeDecodeError):
            data = None
        if isinstance(data, dict):
            read_from = data.get("read_from")
            if isinstance(read_from, dict) and "quality_chain" in read_from:
                value = read_from.get("quality_chain")
                if not value:
                    return None
                for base in (os.getcwd(), os.path.dirname(os.path.dirname(os.path.abspath(design_dir)))):
                    candidate = os.path.join(base, str(value))
                    if os.path.isdir(candidate):
                        return candidate
                return os.path.join(os.getcwd(), str(value))
    for candidate in (os.path.join(os.path.dirname(os.path.abspath(design_dir)), "quality"), "docs/quality"):
        if os.path.isdir(candidate):
            return candidate
    return None


# the glossary, for writing enum values in the working language

def glossary_path():
    here = os.path.dirname(os.path.abspath(__file__))
    for candidate in (os.path.join(here, "..", "references", "glossary.md"), os.path.join(here, "..", "glossary.md")):
        if os.path.exists(candidate):
            return os.path.normpath(candidate)
    return None


def _norm(text):
    return re.sub(r"\s+", "-", text.strip().lower())


class Glossary(object):
    """English and Japanese terms from glossary.md, keyed by the row's label and the value."""

    def __init__(self, path=None):
        self.terms = {}  # label -> {normalized value: (english, japanese)}
        path = path or glossary_path()
        if path:
            with open(path, "r", encoding="utf-8") as f:
                self._parse(f.read())

    def _parse(self, text):
        for line in text.split("\n"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) != 2 or not line.strip().startswith("|") or cells[0] in ("English", "---"):
                continue
            en, ja = cells
            en_label, en_values = _split_label(en)
            ja_label, ja_values = _split_label(ja)
            en_list = [v.strip() for v in en_values.split(" / ")]
            ja_list = [v.strip() for v in ja_values.split(" / ")]
            if len(en_list) != len(ja_list):
                continue
            label = re.sub(r"\s*\(.*?\)", "", en_label).strip().lower()
            for e, j in zip(en_list, ja_list):
                e_clean = re.sub(r"\s*\(.*?\)", "", e).strip()
                self.terms.setdefault(label, {}).setdefault(_norm(e_clean), (e_clean, j))
                if label:
                    self.terms.setdefault("", {}).setdefault(_norm(e_clean), (e_clean, j))

    def term(self, label, value, lang):
        if value is None:
            return None
        text = str(value)
        key = _norm(text)
        for lab in (label, ""):
            found = self.terms.get(lab, {}).get(key)
            if found:
                return found[1] if lang == "ja" else found[0]
        return text

    def value_of(self, label, text):
        """The English value of a term written in either language, or None."""
        text = (text or "").strip()
        for lab in (label, ""):
            for key, (e, j) in self.terms.get(lab, {}).items():
                if text in (e, j) or _norm(text) == key:
                    return key
        return None


def _split_label(cell):
    if ": " in cell:
        label, values = cell.split(": ", 1)
        return label, values
    return "", cell
