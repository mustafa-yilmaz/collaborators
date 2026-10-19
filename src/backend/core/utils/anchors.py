"""Where in a document a mention or a notification points to."""

import re
import uuid

CELL_ANCHOR_RE = re.compile(
    r"^cell:[0-9a-f-]{36}:[0-9a-f-]{36}:[0-9a-f-]{36}$", re.IGNORECASE
)


def is_valid_anchor(anchor_id):
    """A block id (UUID) or a Loop table cell ("cell:<table>:<row>:<column>")."""
    if not isinstance(anchor_id, str):
        return False
    if CELL_ANCHOR_RE.match(anchor_id):
        return True
    try:
        uuid.UUID(anchor_id)
    except ValueError:
        return False
    return True
