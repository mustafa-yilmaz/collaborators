"""Loop tables are part of a document's searchable text."""

import pycrdt

from core.utils.yjs import yjs_to_text


def make_update():
    """A document with a paragraph and a Loop table, as the editor writes it."""
    doc = pycrdt.Doc()
    fragment = doc.get("document-store", type=pycrdt.XmlFragment)
    fragment.children.append(
        pycrdt.XmlElement("paragraph", {}, [pycrdt.XmlText("Intro")])
    )

    tables = doc.get("loop-tables", type=pycrdt.Map)
    table = pycrdt.Map()
    tables["table-1"] = table
    table["columns"] = pycrdt.Array(
        [
            pycrdt.Map({"id": "c1", "name": "Task", "type": "text"}),
            pycrdt.Map({"id": "c2", "name": "Priority", "type": "label"}),
            pycrdt.Map({"id": "c3", "name": "Owner", "type": "person"}),
            pycrdt.Map({"id": "c4", "name": "Budget", "type": "number"}),
        ]
    )
    table["labelGroups"] = pycrdt.Map()
    table["rows"] = pycrdt.Array(
        [
            pycrdt.Map(
                {
                    "id": "r1",
                    "cells": pycrdt.Map(
                        {
                            "c1": pycrdt.Text("Write the proposal"),
                            "c2": "high",
                            "c3": [
                                {"kind": "group", "id": "group:x", "label": "Q4 Launch"}
                            ],
                            "c4": 1200,
                        }
                    ),
                }
            )
        ]
    )
    return doc.get_update()


def test_utils_yjs_to_text_includes_loop_tables():
    """Column names and the values of every cell are searchable."""
    text = yjs_to_text(make_update())

    assert text.startswith("Intro")
    for expected in [
        "Task",
        "Priority",
        "Write the proposal",
        "High",
        "Q4 Launch",
        "1200",
    ]:
        assert expected in text
