"""Tests for the people a collaborator works with (mentions without typing)."""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_people_lists_close_people_without_a_minimum_length():
    """Co-members and people sharing a page show, filtered by any text."""
    # (a fixed email: a random one could match the letters searched below)
    user = factories.UserFactory(full_name="Ada Lovelace", email="ada@z.test")
    sharer = factories.UserFactory(full_name="Bo Li", email="bo@x.test")
    co_member = factories.UserFactory(full_name="Cy Ng", email="cy@y.test")
    stranger = factories.UserFactory(full_name="Bo Stranger")
    factories.DocumentFactory(users=[(user, "owner"), (sharer, "editor")])
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(workspace=workspace, user=user)
    models.WorkspaceAccess.objects.create(workspace=workspace, user=co_member)
    client = APIClient()
    client.force_login(user)

    everyone = client.get("/api/v1.0/people/").json()
    # Oneself first, then the people around
    assert everyone[0]["id"] == str(user.id)
    assert {person["id"] for person in everyone} == {
        str(user.id),
        str(sharer.id),
        str(co_member.id),
    }

    by_letter = client.get("/api/v1.0/people/?q=b").json()
    assert [person["id"] for person in by_letter] == [str(sharer.id)]
    myself = client.get("/api/v1.0/people/?q=ada").json()
    assert [person["id"] for person in myself] == [str(user.id)]
    assert str(stranger.id) not in {person["id"] for person in everyone}


def test_people_shows_a_newcomer_to_everyone_on_the_page_at_once():
    """Sharing a page with someone puts them in the owner's list right away."""
    owner = factories.UserFactory()
    newcomer = factories.UserFactory()
    document = factories.DocumentFactory(users=[(owner, "owner")])
    client = APIClient()
    client.force_login(owner)
    # The owner's list is computed (and kept) before the page is shared
    assert str(newcomer.id) not in {
        person["id"] for person in client.get("/api/v1.0/people/").json()
    }

    factories.UserDocumentAccessFactory(document=document, user=newcomer)

    assert str(newcomer.id) in {
        person["id"] for person in client.get("/api/v1.0/people/").json()
    }


def test_people_needs_authentication():
    """Only signed-in collaborators have people around them."""
    assert APIClient().get("/api/v1.0/people/").status_code == 401


def test_person_card_for_someone_one_works_with():
    """Name, email, shared workspaces and their groups there."""
    me, ada = factories.UserFactory(), factories.UserFactory(full_name="Ada L")
    acme = models.Workspace.objects.create(name="Acme")
    other = models.Workspace.objects.create(name="Other")
    for user in (me, ada):
        models.WorkspaceAccess.objects.create(workspace=acme, user=user)
    models.WorkspaceAccess.objects.create(workspace=other, user=ada)
    q4 = models.Group.objects.create(workspace=acme, name="Q4")
    hidden = models.Group.objects.create(workspace=other, name="Hidden")
    for group in (q4, hidden):
        models.GroupMembership.objects.create(group=group, user=ada)
    client = APIClient()
    client.force_login(me)

    card = client.get(f"/api/v1.0/people/{ada.id}/").json()

    assert card["known"] is True
    assert card["full_name"] == "Ada L"
    assert card["email"] == ada.email
    assert card["workspaces"] == [{"id": str(acme.id), "name": "Acme"}]
    assert card["groups"] == [{"id": str(q4.id), "name": "Q4"}]


def test_person_card_of_a_stranger_shows_only_the_name():
    """No email nor workspaces for someone one doesn't work with."""
    me, stranger = factories.UserFactory(), factories.UserFactory(full_name="Zed")
    client = APIClient()
    client.force_login(me)

    card = client.get(f"/api/v1.0/people/{stranger.id}/").json()

    assert card["known"] is False
    assert card["full_name"] == "Zed"
    assert card["email"] == ""
    assert card["workspaces"] == []
    assert APIClient().get(f"/api/v1.0/people/{stranger.id}/").status_code == 401
