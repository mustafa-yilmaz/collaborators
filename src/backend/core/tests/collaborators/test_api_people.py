"""Tests for the people a collaborator works with (mentions without typing)."""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def test_people_lists_close_people_without_a_minimum_length():
    """Co-members and people sharing a page show, filtered by any text."""
    user = factories.UserFactory(full_name="Ada Lovelace")
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


def test_people_needs_authentication():
    """Only signed-in collaborators have people around them."""
    assert APIClient().get("/api/v1.0/people/").status_code == 401
