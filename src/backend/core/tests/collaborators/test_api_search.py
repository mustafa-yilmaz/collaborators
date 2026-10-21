"""Collaborators: the one search, in two groups."""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.choices import WorkspaceVisibilityChoices

pytestmark = pytest.mark.django_db


def search(user, query, size=5):
    """The search's answer for the user."""
    client = APIClient()
    client.force_login(user)
    return client.get(f"/api/v1.0/search/?q={query}&size={size}").json()


def titles(group):
    """The names or titles of a group's items, by kind."""
    return {
        "workspaces": [item["name"] for item in group["workspaces"]],
        "spaces": [item["title"] for item in group["spaces"]],
        "pages": [item["title"] for item in group["pages"]],
        "labels": group["labels"],
    }


def test_search_splits_mine_from_what_is_open_to_me():
    """Mine: member, role on the page or above; open: findable, link open."""
    me, other = factories.UserFactory.create_batch(2)
    acme = models.Workspace.objects.create(name="Grant Acme", slug="acme")
    models.WorkspaceAccess.objects.create(workspace=acme, user=me)
    models.Workspace.objects.create(
        name="Grant Beta", slug="beta", visibility=WorkspaceVisibilityChoices.PLATFORM
    )
    models.Workspace.objects.create(name="Grant Hidden", slug="hidden")
    space = factories.DocumentFactory(
        kind="space",
        title="Grant space",
        link_reach="restricted",
        users=[(me, "owner")],
    )
    page = factories.DocumentFactory(parent=space, title="Notes")
    page.text_content = "We write the grant proposal together."
    page.save()
    factories.DocumentFactory(
        title="Open grant call", link_reach="authenticated", users=[(other, "owner")]
    )
    factories.DocumentFactory(
        title="Private grant", link_reach="restricted", users=[(other, "owner")]
    )
    label = models.Label.get_or_create_named("grants")
    models.DocumentLabel.objects.create(document=space, label=label)

    result = search(me, "grant")

    assert titles(result["involved"]) == {
        "workspaces": ["Grant Acme"],
        "spaces": ["Grant space"],
        "pages": ["Notes"],
        "labels": ["grants"],
    }
    notes = result["involved"]["pages"][0]
    assert notes["context"] == "Grant space"
    assert "grant proposal" in notes["snippet"]
    assert titles(result["visible"]) == {
        "workspaces": ["Grant Beta"],
        "spaces": [],
        "pages": ["Open grant call"],
        "labels": [],
    }


def test_search_needs_two_letters_and_a_sign_in():
    """Too short: nothing; signed out: refused."""
    me = factories.UserFactory()
    factories.DocumentFactory(title="A", users=[(me, "owner")])
    result = search(me, "a")
    assert result["involved"]["pages"] == []
    assert APIClient().get("/api/v1.0/search/?q=grant").status_code == 401
