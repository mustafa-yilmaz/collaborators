"""Yjs document conversion utilities."""

import base64
import re

import pycrdt
from bs4 import BeautifulSoup

from core import enums


def yjs_to_xml(update):
    """Extract xml from a raw yjs update."""

    doc = pycrdt.Doc()
    doc.apply_update(update)
    return str(doc.get("document-store", type=pycrdt.XmlFragment))


def base64_yjs_to_xml(base64_string):
    """Extract xml from base64 yjs document."""

    return yjs_to_xml(base64.b64decode(base64_string))


# Loop tables keep their data next to the document fragment, see
# frontend .../custom-blocks/loop-table/model.ts
LOOP_TABLES_KEY = "loop-tables"
# Mentions inside Text cells: "@[Label](user:<id>)", searched as "@Label"
LOOP_MENTION_RE = re.compile(r"@\[([^\]]+)\]\((user|group|page):[^)]+\)")
BUILTIN_LABELS = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "not-started": "Not started",
    "in-progress": "In progress",
    "done": "Done",
}


def _loop_table_labels(table):
    """Label option ids of a table mapped to their names."""
    labels = dict(BUILTIN_LABELS)
    groups = table.get("labelGroups")
    if isinstance(groups, pycrdt.Map):
        for group in groups.values():
            for option in group.get("options") or []:
                labels[option.get("id")] = option.get("label", "")
    return labels


def _loop_cell_texts(value, column_type, labels):
    """Yield the searchable texts of one cell."""
    if isinstance(value, pycrdt.Text):
        # "@Label" for people and groups, a linked page as its title
        yield LOOP_MENTION_RE.sub(
            lambda match: match[1] if match[2] == "page" else f"@{match[1]}",
            str(value),
        )
    elif column_type == "label" and value:
        yield labels.get(value, "")
    elif column_type == "person" and isinstance(value, (list, tuple)):
        yield from (str(person.get("label", "")) for person in value)
    elif isinstance(value, (str, int, float)) and value != "":
        yield str(value)


def _loop_table_texts(table):
    """Yield the searchable texts of a Loop table: column names and values."""
    labels = _loop_table_labels(table)
    columns = table.get("columns")
    column_types = {}
    if isinstance(columns, pycrdt.Array):
        for column in columns:
            column_types[column.get("id")] = column.get("type")
            yield str(column.get("name") or "")

    rows = table.get("rows")
    if not isinstance(rows, pycrdt.Array):
        return
    for row in rows:
        cells = row.get("cells")
        if isinstance(cells, pycrdt.Map):
            for column_id, value in cells.items():
                yield from _loop_cell_texts(value, column_types.get(column_id), labels)


def loop_tables_text(doc):
    """The text of every Loop table of a pycrdt document."""
    tables = doc.get(LOOP_TABLES_KEY, type=pycrdt.Map)
    return " ".join(
        text
        for table in tables.values()
        if isinstance(table, pycrdt.Map)
        for text in _loop_table_texts(table)
        if text
    )


def yjs_to_text(update):
    """Extract text from a raw yjs update, Loop tables included."""

    doc = pycrdt.Doc()
    doc.apply_update(update)
    xml = str(doc.get("document-store", type=pycrdt.XmlFragment))
    soup = BeautifulSoup(xml, "lxml-xml")
    text = soup.get_text(separator=" ", strip=True)
    tables_text = loop_tables_text(doc)
    return f"{text} {tables_text}".strip() if tables_text else text


def base64_yjs_to_text(base64_string):
    """Extract text from base64 yjs document."""

    return yjs_to_text(base64.b64decode(base64_string))


def extract_attachments(content):
    """Helper method to extract media paths from a document's content."""
    if not content:
        return []

    xml_content = base64_yjs_to_xml(content)
    return re.findall(enums.MEDIA_STORAGE_URL_EXTRACT, xml_content)


def extract_attachments_from_update(update):
    """Helper method to extract media paths from a raw yjs update."""
    if not update:
        return []

    return re.findall(enums.MEDIA_STORAGE_URL_EXTRACT, yjs_to_xml(update))
