"""
Tests for labels on workspaces, spaces and pages, and the label cloud.
"""

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


def test_editors_label_a_page_with_one_shared_vocabulary():
    """Labels are reused whatever their case; readers can't change them."""
    editor, reader = factories.UserFactory(), factories.UserFactory()
    page = factories.DocumentFactory(
        link_reach="restricted", users=[(editor, "editor"), (reader, "reader")]
    )
    other = factories.DocumentFactory(users=[(editor, "owner")])
    url = f"/api/v1.0/documents/{page.id}/labels/"

    response = client_for(editor).put(
        url, {"names": ["Climate", "#AI", " climate ", "open  data"]}, format="json"
    )
    assert response.json() == {
        "names": ["Climate", "AI", "open data"],
        "can_edit": True,
    }
    client_for(editor).put(
        f"/api/v1.0/documents/{other.id}/labels/", {"names": ["ai"]}, format="json"
    )
    assert models.Label.objects.count() == 3
    assert list(other.labels.values_list("label__name", flat=True)) == ["AI"]

    assert client_for(reader).get(url).json()["can_edit"] is False
    assert client_for(reader).put(url, {"names": []}, format="json").status_code == 403

    client_for(editor).put(url, {"names": ["AI"]}, format="json")
    assert client_for(editor).get(url).json()["names"] == ["AI"]


def test_admins_label_their_workspace():
    """Only workspace administrators change its labels."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    url = f"/api/v1.0/workspaces/{workspace.id}/labels/"

    assert (
        client_for(member).put(url, {"names": ["x"]}, format="json").status_code == 403
    )
    response = client_for(owner).put(url, {"names": ["Research"]}, format="json")
    assert response.json() == {"names": ["Research"], "can_edit": True}


def test_the_cloud_counts_only_what_one_can_see():
    """Hidden pages and workspaces don't show in someone else's cloud."""
    me, other = factories.UserFactory(), factories.UserFactory()
    mine = factories.DocumentFactory(link_reach="restricted", users=[(me, "owner")])
    shared = factories.DocumentFactory(
        link_reach="restricted", users=[(me, "reader"), (other, "owner")]
    )
    hidden = factories.DocumentFactory(
        link_reach="restricted", users=[(other, "owner")]
    )
    secret_ws = models.Workspace.objects.create(name="Secret")
    open_ws = models.Workspace.objects.create(name="Open", visibility="platform")
    for document, names in (
        (mine, ["AI", "Climate"]),
        (shared, ["AI"]),
        (hidden, ["Secret project"]),
    ):
        for name in names:
            models.DocumentLabel.objects.create(
                document=document, label=models.Label.get_or_create_named(name)
            )
    for workspace, name in ((secret_ws, "Hidden ws"), (open_ws, "Climate")):
        models.WorkspaceLabel.objects.create(
            workspace=workspace, label=models.Label.get_or_create_named(name)
        )

    cloud = client_for(me).get("/api/v1.0/labels/cloud/").json()

    assert cloud == [{"name": "AI", "count": 2}, {"name": "Climate", "count": 2}]

    detail = client_for(me).get("/api/v1.0/labels/climate/").json()
    assert detail["name"] == "Climate"
    assert [w["name"] for w in detail["workspaces"]] == ["Open"]
    assert [p["id"] for p in detail["pages"]] == [str(mine.id)]

    picked = client_for(me).get("/api/v1.0/labels/?q=cl").json()
    assert [label["name"] for label in picked] == ["Climate"]
