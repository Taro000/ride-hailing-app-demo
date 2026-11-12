"""Read the YAML that the design chain writes, with no third-party packages.

The design and quality items, design-context.yaml, context.yaml and the OpenAPI
and AsyncAPI documents use a small part of YAML: block and flow collections,
plain, quoted and block scalars, comments, anchors and aliases. This reader
handles that part, rejects what it does not handle with the line and column,
and notes what a general YAML library would accept silently:

- a plain value followed by a comment on the same line (" #"), which is how a
  value is cut off when its text contains " #";
- a key written twice in one mapping, whose first value a library drops.

Unquoted scalars resolve as in YAML 1.2 (null, true and false, integers and
floats); dates and everything else stay strings.
"""

import bisect
import re

__all__ = ["YAMLError", "Note", "Document", "load", "load_file"]


class YAMLError(Exception):
    def __init__(self, message, line, column):
        Exception.__init__(self, "line %d, column %d: %s" % (line, column, message))
        self.message = message
        self.line = line
        self.column = column


class Note(object):
    """Something the reader noticed in a file that parses."""

    __slots__ = ("kind", "line", "column", "path", "text")

    def __init__(self, kind, line, column, path, text):
        self.kind = kind  # "comment-after-value" | "duplicate-key"
        self.line = line
        self.column = column
        self.path = path
        self.text = text


class Document(object):
    __slots__ = ("data", "notes", "key_lines")

    def __init__(self, data, notes, key_lines):
        self.data = data
        self.notes = notes
        self.key_lines = key_lines  # top-level key -> line number


def load(text):
    """Parse one YAML document and return a Document. Raises YAMLError."""
    return _Parser(text).parse()


def load_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return load(f.read())


_NULLS = ("", "~", "null", "Null", "NULL")
_TRUE = ("true", "True", "TRUE")
_FALSE = ("false", "False", "FALSE")
_INT = re.compile(r"[-+]?[0-9]+\Z")
_HEX = re.compile(r"0x[0-9a-fA-F]+\Z")
_OCT = re.compile(r"0o[0-7]+\Z")
_FLOAT = re.compile(r"[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?\Z")
_INF = re.compile(r"[-+]?\.(inf|Inf|INF)\Z")
_NAN = re.compile(r"\.(nan|NaN|NAN)\Z")
_STANDARD_TAGS = ("!!str", "!!int", "!!float", "!!bool", "!!null", "!!map", "!!seq",
                  "!!timestamp", "!!binary")
_ESCAPES = {
    "0": "\0", "a": "\a", "b": "\b", "t": "\t", "\t": "\t", "n": "\n", "v": "\v",
    "f": "\f", "r": "\r", "e": "\x1b", " ": " ", '"': '"', "/": "/", "\\": "\\",
    "N": "\x85", "_": "\xa0", "L": " ", "P": " ",
}
_HEX_ESCAPES = {"x": 2, "u": 4, "U": 8}
_NOT_PLAIN_START = set("-?:,[]{}#&*!|>'\"%@`")
_FLOW_INDICATORS = set(",[]{}")
_QUOTE_HINT = "; quote the value if it is text"


def resolve(text):
    if text in _NULLS:
        return None
    if text in _TRUE:
        return True
    if text in _FALSE:
        return False
    if _INT.match(text):
        return int(text)
    if _HEX.match(text):
        return int(text[2:], 16)
    if _OCT.match(text):
        return int(text[2:], 8)
    if _FLOAT.match(text):
        return float(text)
    if _INF.match(text):
        return float("-inf") if text.startswith("-") else float("inf")
    if _NAN.match(text):
        return float("nan")
    return text


def _path_text(path):
    out = ""
    for part in path:
        if isinstance(part, int):
            out += "[%d]" % part
        else:
            out += ("." if out else "") + str(part)
    return out


class _Parser(object):
    def __init__(self, text):
        if text.startswith("﻿"):
            text = text[1:]
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        if not text.endswith("\n"):
            text += "\n"
        self.s = text
        self.n = len(text)
        self.i = 0
        self.starts = [0] + [m.end() for m in re.finditer("\n", text)][:-1]
        self.notes = []
        self.key_lines = {}
        self.anchors = {}

    # positions

    def lc(self, i):
        k = bisect.bisect_right(self.starts, i) - 1
        return k + 1, i - self.starts[k] + 1

    def col(self, i):
        return i - self.starts[bisect.bisect_right(self.starts, i) - 1]

    def error(self, message, i=None):
        line, column = self.lc(self.i if i is None else min(i, self.n - 1))
        raise YAMLError(message, line, column)

    def ch(self, i=None):
        i = self.i if i is None else i
        return self.s[i] if i < self.n else ""

    def line_end(self, i):
        j = self.s.find("\n", i)
        return self.n if j < 0 else j

    def is_blank(self, c):
        return c in (" ", "\t", "\n", "")

    # lines

    def indent_at(self, start):
        """Indentation of the line that starts at `start`; tabs before content are errors."""
        j = start
        while self.ch(j) == " ":
            j += 1
        if self.ch(j) == "\t":
            k = j
            while self.ch(k) in (" ", "\t"):
                k += 1
            if self.ch(k) not in ("\n", "#", ""):
                self.error("a tab in the indentation; indent with spaces", j)
        return j - start

    def content_line(self, start):
        """Start of the first line at or after `start` that holds content, or None."""
        while start < self.n:
            end = self.line_end(start)
            stripped = self.s[start:end].strip(" \t")
            if stripped and not stripped.startswith("#"):
                return start
            start = end + 1
        return None

    def next_line(self):
        """From the end of a node, check the rest of the line and find the next content line."""
        j = self.i
        while self.ch(j) in (" ", "\t"):
            j += 1
        c = self.ch(j)
        if c == "#":
            if j == self.i and j > 0 and self.s[j - 1] not in (" ", "\t", "\n"):
                self.error("unexpected '#' right after the value" + _QUOTE_HINT, j)
            j = self.line_end(j)
        elif c not in ("\n", ""):
            self.error("unexpected text after the value" + _QUOTE_HINT, j)
        self.i = j
        return self.content_line(j + 1)

    def at_document_marker(self, i):
        if self.col(i) != 0:
            return False
        return (self.s.startswith("---", i) or self.s.startswith("...", i)) and self.is_blank(self.ch(i + 3))

    def is_seq_entry(self, i):
        return self.ch(i) == "-" and self.is_blank(self.ch(i + 1))

    # document

    def parse(self):
        start = self.content_line(0)
        while start is not None and self.ch(start) == "%":
            start = self.content_line(self.line_end(start) + 1)
        root = None
        if start is not None:
            self.i = start
            if self.s.startswith("---", start) and self.is_blank(self.ch(start + 3)):
                self.i = start + 3
                root = self.block_value(-1, ())
            else:
                if self.indent_at(start) != 0:
                    self.error("the document does not start at column 1", start)
                root = self.block_node(-1, ())
            nxt = self.next_line()
            if nxt is not None:
                if self.s.startswith("...", nxt) and self.is_blank(self.ch(nxt + 3)):
                    self.i = nxt + 3
                    nxt = self.next_line()
                if nxt is not None:
                    if self.s.startswith("---", nxt) and self.col(nxt) == 0:
                        self.error("more than one document in a file is not supported", nxt)
                    self.error("unexpected content; check the indentation", nxt + self.indent_at(nxt))
        return Document(root, self.notes, self.key_lines)

    # block structure

    def block_value(self, parent_indent, path, indentless=False, in_entry=False):
        """The value after 'key:' or '-', inline or on the following lines."""
        while self.ch() in (" ", "\t"):
            self.i += 1
        anchor, tag = self.properties()
        c = self.ch()
        if c in ("\n", "") or c == "#":
            if c == "#" and self.s[self.i - 1] not in (" ", "\t"):
                self.error("unexpected '#'" + _QUOTE_HINT)
            nxt = self.next_line()
            node = None
            if nxt is not None:
                ind = self.indent_at(nxt)
                if self.at_document_marker(nxt):
                    pass
                elif ind > parent_indent:
                    self.i = nxt + ind
                    node = self.block_node(parent_indent, path, tag)
                elif indentless and ind == parent_indent and self.is_seq_entry(nxt + ind):
                    self.i = nxt + ind
                    node = self.block_sequence(ind, path)
            return self.register(anchor, node)
        node = self.inline_node(parent_indent, path, tag, in_entry)
        return self.register(anchor, node)

    def block_node(self, parent_indent, path, tag=None):
        """A node that starts where the content of a line starts."""
        col = self.col(self.i)
        if self.is_seq_entry(self.i):
            return self.block_sequence(col, path)
        anchor, more_tag = self.properties()
        tag = more_tag or tag
        if self.ch() in ("\n", "#"):
            # properties alone on a line, then the node on the next lines
            node = self.block_value(parent_indent, path)
            return self.register(anchor, node)
        node = self.inline_node(parent_indent, path, tag, True)
        return self.register(anchor, node)

    def inline_node(self, parent_indent, path, tag, in_entry):
        c = self.ch()
        start = self.i
        if c == "*":
            return self.alias()
        if c in "|>":
            return self.block_scalar(parent_indent)
        if c in "[{":
            node = self.flow_collection(path)
            j = self.i
            while self.ch(j) in (" ", "\t"):
                j += 1
            if self.ch(j) == ":":
                self.error("a flow collection as a mapping key is not supported", j)
            return node
        if self.is_seq_entry(self.i):
            if not in_entry:
                self.error("a sequence entry is not allowed here; start the list on the next line")
            return self.block_sequence(self.col(self.i), path)
        if c == "?" and self.is_blank(self.ch(self.i + 1)):
            self.error("explicit mapping keys ('? ') are not supported")
        if self.looks_like_key(self.i):
            if not in_entry:
                self.error("a mapping value is not allowed here" + _QUOTE_HINT, self.colon_of_key(self.i))
            return self.block_mapping(self.col(self.i), path)
        if c in "'\"":
            value = self.quoted()
            return value
        return self.plain(parent_indent, path, tag, start)

    def colon_of_key(self, i):
        end = self.line_end(i)
        j = self.s.find(": ", i, end)
        return j if j >= 0 else i

    def looks_like_key(self, i):
        """Whether a mapping key starts at i: a quoted or plain scalar followed by ':'."""
        c = self.ch(i)
        end = self.line_end(i)
        if c in "'\"":
            j = self.skip_quoted_line(i, end)
            if j is None:
                return False
            while self.ch(j) in (" ", "\t"):
                j += 1
            return self.ch(j) == ":" and self.is_blank(self.ch(j + 1))
        if c in _NOT_PLAIN_START and not (c in "-?:" and not self.is_blank(self.ch(i + 1))):
            return False
        j = i
        while j < end:
            cj = self.s[j]
            if cj == ":" and self.is_blank(self.ch(j + 1)):
                return True
            if cj == "#" and j > i and self.s[j - 1] in (" ", "\t"):
                return False
            j += 1
        return False

    def skip_quoted_line(self, i, end):
        q = self.s[i]
        j = i + 1
        while j < end:
            c = self.s[j]
            if q == "'" and c == "'":
                if self.ch(j + 1) == "'":
                    j += 2
                    continue
                return j + 1
            if q == '"' and c == "\\":
                j += 2
                continue
            if q == '"' and c == '"':
                return j + 1
            j += 1
        return None

    def block_mapping(self, col, path):
        result = {}
        while True:
            key_start = self.i
            key = self.mapping_key()
            try:
                duplicate = key in result
            except TypeError:
                self.error("a mapping key that is not a scalar is not supported", key_start)
            if duplicate:
                line, column = self.lc(key_start)
                self.notes.append(Note("duplicate-key", line, column, _path_text(path + (key,)), str(key)))
            if not path:
                self.key_lines.setdefault(key, self.lc(key_start)[0])
            value = self.block_value(col, path + (key,), indentless=True)
            if key == "<<" and isinstance(value, (dict, list)):
                for part in value if isinstance(value, list) else [value]:
                    if isinstance(part, dict):
                        for k, v in part.items():
                            result.setdefault(k, v)
            else:
                result[key] = value
            nxt = self.next_line()
            if nxt is None:
                return result
            ind = self.indent_at(nxt)
            if ind < col or self.at_document_marker(nxt):
                return result
            if ind > col:
                self.error("bad indentation: deeper than the keys of this mapping", nxt + ind)
            if self.is_seq_entry(nxt + ind):
                self.error("a list entry at the indentation of the keys; indent it under its key", nxt + ind)
            self.i = nxt + ind
            if not self.looks_like_key(self.i):
                self.error("expected a 'key: value' line at this indentation", self.i)

    def mapping_key(self):
        c = self.ch()
        if c in "'\"":
            key = self.quoted()
        else:
            end = self.line_end(self.i)
            j = self.i
            while j < end and not (self.s[j] == ":" and self.is_blank(self.ch(j + 1))):
                j += 1
            raw = self.s[self.i:j].rstrip(" \t")
            if raw.startswith(("&", "!")):
                self.error("anchors and tags on mapping keys are not supported")
            key = resolve(raw)
            self.i = j
        while self.ch() in (" ", "\t"):
            self.i += 1
        if self.ch() != ":":
            self.error("expected ':' after the key")
        self.i += 1
        return key

    def block_sequence(self, col, path):
        result = []
        while True:
            self.i += 1  # the '-'
            result.append(self.block_value(col, path + (len(result),), in_entry=True))
            nxt = self.next_line()
            if nxt is None:
                return result
            ind = self.indent_at(nxt)
            if ind < col or self.at_document_marker(nxt):
                return result
            if ind > col:
                self.error("bad indentation: deeper than the entries of this list", nxt + ind)
            if not self.is_seq_entry(nxt + ind):
                return result
            self.i = nxt + ind

    # node properties

    def properties(self):
        anchor = tag = None
        while True:
            c = self.ch()
            if c == "&" and anchor is None:
                j = self.i + 1
                while not self.is_blank(self.ch(j)) and self.ch(j) not in _FLOW_INDICATORS:
                    j += 1
                anchor = self.s[self.i + 1:j]
                if not anchor:
                    self.error("an empty anchor" + _QUOTE_HINT)
                self.i = j
            elif c == "!" and tag is None:
                j = self.i + 1
                while not self.is_blank(self.ch(j)):
                    j += 1
                tag = self.s[self.i:j]
                if tag not in _STANDARD_TAGS:
                    self.error("unknown tag '%s'" % tag + _QUOTE_HINT)
                self.i = j
            else:
                return anchor, tag
            while self.ch() in (" ", "\t"):
                self.i += 1

    def register(self, anchor, node):
        if anchor is not None:
            self.anchors[anchor] = node
        return node

    def alias(self):
        j = self.i + 1
        while not self.is_blank(self.ch(j)) and self.ch(j) not in _FLOW_INDICATORS:
            j += 1
        name = self.s[self.i + 1:j]
        if name not in self.anchors:
            self.error("undefined alias '*%s'" % name + _QUOTE_HINT)
        self.i = j
        return self.anchors[name]

    # scalars

    def plain(self, parent_indent, path, tag, start):
        c = self.ch()
        if c in _NOT_PLAIN_START and not (c in "-?:" and not self.is_blank(self.ch(self.i + 1))):
            self.error("a value cannot start with '%s'" % c + _QUOTE_HINT)
        text, stop = self.plain_line(False)
        lines = [text]
        breaks = [0]
        while stop == "eol":
            j = self.i + 1
            blank = 0
            while j < self.n:
                end = self.line_end(j)
                if self.s[j:end].strip(" \t"):
                    break
                blank += 1
                j = end + 1
            if j >= self.n:
                break
            ind = self.indent_at(j)
            first = self.ch(j + ind)
            if ind <= parent_indent or first == "#" or self.at_document_marker(j):
                break
            self.i = j + ind
            text, stop = self.plain_line(False)
            lines.append(text)
            breaks.append(blank)
        if stop == "colon":
            self.error("a ': ' inside a value starts a mapping" + _QUOTE_HINT)
        value = lines[0]
        for k in range(1, len(lines)):
            value += ("\n" * breaks[k]) if breaks[k] else " "
            value += lines[k]
        resolved = value if tag == "!!str" else resolve(value)
        if stop == "comment" and isinstance(resolved, str):
            line, column = self.lc(self.i)
            self.notes.append(Note("comment-after-value", line, column, _path_text(path), value))
        return resolved

    def plain_line(self, flow):
        """Scan one line of a plain scalar. Leaves self.i at the stop."""
        j = self.i
        end = self.line_end(j)
        while j < end:
            c = self.s[j]
            if c == ":":
                nxt = self.ch(j + 1)
                if self.is_blank(nxt) or (flow and nxt in _FLOW_INDICATORS):
                    text = self.s[self.i:j].rstrip(" \t")
                    self.i = j
                    return text, "colon"
            elif c == "#" and j > self.i and self.s[j - 1] in (" ", "\t"):
                text = self.s[self.i:j].rstrip(" \t")
                self.i = j
                return text, "comment"
            elif flow and c in _FLOW_INDICATORS:
                text = self.s[self.i:j].rstrip(" \t")
                self.i = j
                return text, "flow"
            j += 1
        text = self.s[self.i:end].rstrip(" \t")
        self.i = end
        return text, "eol"

    def quoted(self):
        q = self.ch()
        self.i += 1
        out = []
        while True:
            c = self.ch()
            if c == "":
                self.error("a quoted value is not closed")
            if q == "'" and c == "'":
                if self.ch(self.i + 1) == "'":
                    out.append("'")
                    self.i += 2
                    continue
                self.i += 1
                return "".join(out)
            if q == '"' and c == '"':
                self.i += 1
                return "".join(out)
            if q == '"' and c == "\\":
                e = self.ch(self.i + 1)
                if e == "\n":
                    self.i += 2
                    while self.ch() in (" ", "\t"):
                        self.i += 1
                    continue
                if e in _ESCAPES:
                    out.append(_ESCAPES[e])
                    self.i += 2
                    continue
                if e in _HEX_ESCAPES:
                    size = _HEX_ESCAPES[e]
                    digits = self.s[self.i + 2:self.i + 2 + size]
                    if len(digits) != size or not re.match(r"[0-9a-fA-F]+\Z", digits):
                        self.error("a bad escape in a double-quoted value")
                    out.append(chr(int(digits, 16)))
                    self.i += 2 + size
                    continue
                self.error("an unknown escape '\\%s' in a double-quoted value" % e)
            if c == "\n":
                while out and out[-1] in (" ", "\t"):
                    out.pop()
                breaks = 0
                while self.ch() == "\n":
                    breaks += 1
                    self.i += 1
                    while self.ch() in (" ", "\t"):
                        self.i += 1
                if self.at_document_marker(self.i):
                    self.error("a document marker inside a quoted value")
                out.append(" " if breaks == 1 else "\n" * (breaks - 1))
                continue
            out.append(c)
            self.i += 1

    def block_scalar(self, parent_indent):
        style = self.ch()
        self.i += 1
        chomp = ""
        increment = 0
        for _ in range(2):
            c = self.ch()
            if c in "+-" and not chomp:
                chomp = c
                self.i += 1
            elif c.isdigit() and c != "0" and not increment:
                increment = int(c)
                self.i += 1
        j = self.i
        while self.ch(j) in (" ", "\t"):
            j += 1
        if self.ch(j) == "#" and j > self.i:
            j = self.line_end(j)
        if self.ch(j) not in ("\n", ""):
            self.error("expected a line break after '%s'" % style + _QUOTE_HINT, j)
        base = max(parent_indent, 0)
        start = j + 1
        indent = base + increment if increment else None
        lines = []
        last_end = j
        k = start
        while k < self.n:
            end = self.line_end(k)
            raw = self.s[k:end]
            if not raw.strip(" "):
                if "\t" in raw and indent is not None and raw[:indent].strip(" "):
                    break
                lines.append(None)
                k = end + 1
                continue
            ind = len(raw) - len(raw.lstrip(" "))
            if indent is None:
                if ind <= parent_indent:
                    break
                indent = ind
            if ind < indent:
                break
            lines.append(raw[indent:])
            last_end = end
            k = end + 1
        trailing = 0
        while lines and lines[-1] is None:
            lines.pop()
            trailing += 1
        if style == "|":
            text = "\n".join("" if line is None else line for line in lines)
        else:
            text = ""
            previous = None  # None | "normal" | "more"
            pending = 0
            for line in lines:
                if line is None:
                    pending += 1
                    continue
                kind = "more" if line[:1] in (" ", "\t") else "normal"
                if previous is None:
                    text += "\n" * pending
                elif previous == "normal" and kind == "normal":
                    text += ("\n" * pending) if pending else " "
                else:
                    text += "\n" * (pending + 1)
                text += line
                previous = kind
                pending = 0
        if lines and chomp != "-":
            text += "\n"
            if chomp == "+":
                text += "\n" * trailing
        elif not lines and chomp == "+":
            text = "\n" * trailing
        if lines:
            self.i = last_end
        else:
            self.i = j
        return text

    # flow collections

    def skip_flow_space(self):
        while True:
            c = self.ch()
            if c in (" ", "\t", "\n"):
                self.i += 1
            elif c == "#" and (self.i == 0 or self.s[self.i - 1] in (" ", "\t", "\n")):
                self.i = self.line_end(self.i)
            elif c == "":
                self.error("a flow collection ('[' or '{') is not closed")
            else:
                return

    def flow_collection(self, path):
        opener = self.ch()
        closer = "]" if opener == "[" else "}"
        self.i += 1
        result = [] if opener == "[" else {}
        while True:
            self.skip_flow_space()
            if self.ch() == closer:
                self.i += 1
                return result
            key_start = self.i
            index = len(result)
            node = self.flow_node(path + ((index,) if opener == "[" else ("?",)))
            self.skip_flow_space()
            if self.ch() == ":":
                self.i += 1
                self.skip_flow_space()
                if self.ch() in (",", closer):
                    value = None
                else:
                    value = self.flow_node(path + ((index, node) if opener == "[" else (node,)))
                    self.skip_flow_space()
                if opener == "[":
                    node = {node: value}
                else:
                    self.put_flow(result, node, value, path, key_start)
                    node = None
            elif opener == "{":
                self.put_flow(result, node, None, path, key_start)
                node = None
            if opener == "[":
                result.append(node)
            c = self.ch()
            if c == ",":
                self.i += 1
                continue
            if c == closer:
                self.i += 1
                return result
            self.error("expected ',' or '%s' in a flow collection" % closer + _QUOTE_HINT)

    def put_flow(self, result, key, value, path, key_start):
        try:
            duplicate = key in result
        except TypeError:
            self.error("a mapping key that is not a scalar is not supported", key_start)
        if duplicate:
            line, column = self.lc(key_start)
            self.notes.append(Note("duplicate-key", line, column, _path_text(path + (key,)), str(key)))
        result[key] = value

    def flow_node(self, path):
        anchor, tag = self.properties()
        c = self.ch()
        if c in "[{":
            return self.register(anchor, self.flow_collection(path))
        if c in "'\"":
            return self.register(anchor, self.quoted())
        if c == "*":
            return self.alias()
        if c in ",]}":
            return self.register(anchor, None)
        if c in _NOT_PLAIN_START and not (c in "-?:" and not self.is_blank(self.ch(self.i + 1))):
            self.error("a value cannot start with '%s'" % c + _QUOTE_HINT)
        text, stop = self.plain_line(True)
        lines = [text]
        while stop == "eol":
            j = self.i + 1
            blank = 0
            while j < self.n and not self.s[j:self.line_end(j)].strip(" \t"):
                blank += 1
                j = self.line_end(j) + 1
            k = j
            while self.ch(k) in (" ", "\t"):
                k += 1
            if self.ch(k) in ("#", "") or self.ch(k) in _FLOW_INDICATORS or self.ch(k) == ":":
                self.i = k
                stop = "flow"
                break
            self.i = k
            text, stop = self.plain_line(True)
            lines.append(("\n" * blank if blank else " ") + text)
        value = "".join(lines)
        resolved = value if tag == "!!str" else resolve(value)
        if stop == "comment" and isinstance(resolved, str):
            line, column = self.lc(self.i)
            self.notes.append(Note("comment-after-value", line, column, _path_text(path), value))
        return self.register(anchor, resolved)
