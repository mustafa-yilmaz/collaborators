"""
Tests for the dashboard API: layout preference, recent pages, and the index
of table assignments behind "Assigned to me".
"""

from uuid import uuid4

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.choices import WorkspaceRoleChoices

pytestmark = pytest.mark.django_db


def client_for(user):
    """An API client logged in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def cell():
    """A Loop table cell anchor."""
    return f"cell:{uuid4()}:{uuid4()}:{uuid4()}"


# -- Layout


def test_api_dashboard_layout_is_personal_and_saved():
    """Each collaborator keeps their own layout."""
    user, other = factories.UserFactory.create_batch(2)
    layout = [
        {"id": "assigned", "hidden": False, "collapsed": True, "wide": False},
        {"id": "recent", "hidden": True, "collapsed": False, "wide": True},
    ]

    response = client_for(user).put(
        "/api/v1.0/dashboard/layout/", layout, format="json"
    )

    assert response.status_code == 200
    assert client_for(user).get("/api/v1.0/dashboard/layout/").json() == layout
    assert client_for(other).get("/api/v1.0/dashboard/layout/").json() == []


def test_api_dashboard_layout_rejects_odd_card_ids():
    """Card ids are short slugs."""
    user = factories.UserFactory()

    response = client_for(user).put(
        "/api/v1.0/dashboard/layout/",
        [{"id": "<script>", "hidden": False, "collapsed": False}],
        format="json",
    )

    assert response.status_code == 400


def test_api_dashboard_needs_authentication():
    """The dashboard is for signed-in collaborators."""
    for url in ["layout", "recent", "assigned"]:
        assert APIClient().get(f"/api/v1.0/dashboard/{url}/").status_code == 401


# -- Recent


def test_api_dashboard_recent_includes_pages_inside_spaces():
    """Pages in my spaces are listed with their space; others' pages aren't."""
    user, other = factories.UserFactory.create_batch(2)
    space = factories.DocumentFactory(
        users=[(user, "editor")], kind="space", title="Engineering"
    )
    page = factories.DocumentFactory(parent=space, title="Roadmap")
    factories.DocumentFactory(
        users=[(other, "owner")], title="Secret", link_reach="restricted"
    )

    results = client_for(user).get("/api/v1.0/dashboard/recent/").json()

    by_title = {item["title"]: item for item in results}
    assert set(by_title) == {"Engineering", "Roadmap"}
    assert by_title["Roadmap"]["space"] == {"id": str(space.id), "title": "Engineering"}
    assert by_title["Engineering"]["space"] is None
    assert by_title["Roadmap"]["id"] == str(page.id)


# -- Assignments


def test_api_assignments_index_and_notify_once():
    """Assigning someone indexes the row and notifies them once."""
    author, assignee = factories.UserFactory.create_batch(2)
    document = factories.DocumentFactory(
        users=[(author, "editor"), (assignee, "reader")], title="Plan"
    )
    anchor = cell()
    url = f"/api/v1.0/documents/{document.id}/assignments/"
    payload = {
        "anchor_id": anchor,
        "assignee_id": str(assignee.id),
        "row_label": "Write the proposal",
    }

    assert client_for(author).post(url, payload, format="json").status_code == 201
    assert client_for(author).post(url, payload, format="json").status_code == 200

    assert models.Notification.objects.filter(kind="assignment").count() == 1
    assigned = client_for(assignee).get("/api/v1.0/dashboard/assigned/").json()
    assert [
        (a["row_label"], a["document"]["title"], a["anchor_id"]) for a in assigned
    ] == [("Write the proposal", "Plan", anchor)]


def test_api_assignments_of_any_block_of_a_page():
    """A to-do item, or any block, can be assigned, then done and removed."""
    author, assignee = factories.UserFactory.create_batch(2)
    document = factories.DocumentFactory(
        users=[(author, "editor"), (assignee, "reader")], title="Plan"
    )
    url = f"/api/v1.0/documents/{document.id}/assignments/"
    block = str(uuid4())
    payload = {
        "anchor_id": block,
        "assignee_id": str(assignee.id),
        "row_label": "Book the room @Bob",
    }

    assert client_for(author).post(url, payload, format="json").status_code == 201
    assigned = client_for(assignee).get("/api/v1.0/dashboard/assigned/").json()
    assert [(a["row_label"], a["anchor_id"]) for a in assigned] == [
        ("Book the room @Bob", block)
    ]
    assert models.Notification.objects.filter(kind="assignment").count() == 1

    # Ticked off: the to-do item's assignment is removed
    client_for(author).delete(url, payload, format="json")
    assert client_for(assignee).get("/api/v1.0/dashboard/assigned/").json() == []

    # Only a block or a table cell
    bad = {**payload, "anchor_id": "somewhere"}
    assert client_for(author).post(url, bad, format="json").status_code == 400


def test_api_assignments_to_my_groups_and_removal():
    """Rows assigned to my group show up; removing the assignment clears them."""
    author, member = factories.UserFactory.create_batch(2)
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=author, role=WorkspaceRoleChoices.OWNER
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    models.GroupMembership.objects.create(group=group, user=member)
    document = factories.DocumentFactory(users=[(author, "editor"), (member, "reader")])
    url = f"/api/v1.0/documents/{document.id}/assignments/"
    payload = {"anchor_id": cell(), "team": group.team, "row_label": "Launch"}

    client_for(author).post(url, payload, format="json")
    assigned = client_for(member).get("/api/v1.0/dashboard/assigned/").json()
    assert [(a["row_label"], a["team_label"]) for a in assigned] == [
        ("Launch", "Q4 (Acme)")
    ]

    response = client_for(author).delete(url, payload, format="json")
    assert response.status_code == 204
    assert client_for(member).get("/api/v1.0/dashboard/assigned/").json() == []


def test_api_assignments_need_edit_rights():
    """Readers can't change who is assigned."""
    reader, other = factories.UserFactory.create_batch(2)
    document = factories.DocumentFactory(
        users=[(reader, "reader"), (other, "reader")], link_reach="restricted"
    )

    response = client_for(reader).post(
        f"/api/v1.0/documents/{document.id}/assignments/",
        {"anchor_id": cell(), "assignee_id": str(other.id)},
        format="json",
    )

    assert response.status_code == 403


def test_api_assigned_hides_pages_i_lost_access_to():
    """An assignment on a page I can no longer read is not listed."""
    author, assignee = factories.UserFactory.create_batch(2)
    document = factories.DocumentFactory(
        users=[(author, "editor"), (assignee, "reader")], link_reach="restricted"
    )
    client_for(author).post(
        f"/api/v1.0/documents/{document.id}/assignments/",
        {"anchor_id": cell(), "assignee_id": str(assignee.id)},
        format="json",
    )
    document.accesses.filter(user=assignee).delete()

    assert client_for(assignee).get("/api/v1.0/dashboard/assigned/").json() == []


# -- The order of the lists of "My collaborations"


def test_api_sidebar_order_is_kept_per_collaborator():
    """Saved, read back at the next visit; other people keep their own."""
    me, other = factories.UserFactory.create_batch(2)
    url = "/api/v1.0/dashboard/sidebar/"
    order = [
        "starred",
        "recent",
        "notifications",
        "labels",
        "explore",
        "owned",
        "shared",
    ]

    assert client_for(me).get(url).json() == []
    assert client_for(me).put(url, order, format="json").status_code == 200

    assert client_for(me).get(url).json() == order
    assert client_for(other).get(url).json() == []


def test_api_sidebar_order_takes_known_items_once():
    """The trash is not reorderable; nothing unknown nor twice."""
    me = factories.UserFactory()
    url = "/api/v1.0/dashboard/sidebar/"
    for order in (["trashbin"], ["recent", "recent"], "recent"):
        assert client_for(me).put(url, order, format="json").status_code == 400
