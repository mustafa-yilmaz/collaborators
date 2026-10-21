"""Collaborators: the views of "My collaborations" in the left panel."""

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


def view(user, name):
    """Titles and names listed by a view."""
    data = client_for(user).get(f"/api/v1.0/collaborations/?view={name}").json()
    return (
        [item["name"] for item in data["workspaces"]],
        [item["title"] for item in data["spaces"]],
        [item["title"] for item in data["pages"]],
    )


@pytest.fixture(name="world")
def fixture_world():
    """
    Ada owns Acme, a space and a page; Bob shared his space, page and his
    workspace with her. A space inside Acme and a sub-page are not listed.
    """
    ada, bob = factories.UserFactory(), factories.UserFactory()
    acme = models.Workspace.objects.create(name="Acme", slug="acme")
    beta = models.Workspace.objects.create(name="Beta", slug="beta")
    models.WorkspaceAccess.objects.create(
        workspace=acme, user=ada, role=WorkspaceRoleChoices.OWNER
    )
    models.WorkspaceAccess.objects.create(
        workspace=beta, user=bob, role=WorkspaceRoleChoices.OWNER
    )
    models.WorkspaceAccess.objects.create(workspace=beta, user=ada)
    factories.DocumentFactory(
        kind="space", title="Ada space", users=[(ada, "owner")]
    )
    own_page = factories.DocumentFactory(title="Ada page", users=[(ada, "owner")])
    factories.DocumentFactory(parent=own_page, title="Sub-page")
    bob_space = factories.DocumentFactory(
        kind="space", title="Bob space", users=[(bob, "owner"), (ada, "editor")]
    )
    bob_page = factories.DocumentFactory(
        title="Bob page", users=[(bob, "owner"), (ada, "reader")]
    )
    in_acme = factories.DocumentFactory(
        kind="space", title="Acme space", users=[(ada, "owner")]
    )
    models.SpaceWorkspaceLink.objects.create(
        space=in_acme, workspace=acme, is_home=True
    )
    return {
        "ada": ada,
        "acme": acme,
        "beta": beta,
        "bob_space": bob_space,
        "bob_page": bob_page,
        "own_page": own_page,
    }


def test_owned_lists_what_i_created(world):
    """My workspaces, independent spaces and pages; nothing inside them."""
    assert view(world["ada"], "owned") == (["Acme"], ["Ada space"], ["Ada page"])


def test_shared_lists_what_others_let_me_into(world):
    """Not what I own."""
    assert view(world["ada"], "shared") == (["Beta"], ["Bob space"], ["Bob page"])


def test_recent_lists_a_few_of_everything(world):
    """Mine and shared, the latest first."""
    workspaces, spaces, pages = view(world["ada"], "recent")
    assert set(workspaces) == {"Acme", "Beta"}
    assert set(spaces) == {"Ada space", "Bob space"}
    assert set(pages) == {"Ada page", "Bob page"}


def test_starred_lists_what_i_starred(world):
    """Workspaces are starred from here, spaces and pages as before."""
    ada = world["ada"]
    client = client_for(ada)
    assert view(ada, "starred") == ([], [], [])

    response = client.post(f"/api/v1.0/workspaces/{world['beta'].id}/favorite/")
    assert response.json() == {"is_favorite": True}
    models.DocumentFavorite.objects.create(user=ada, document=world["bob_page"])

    assert view(ada, "starred") == (["Beta"], [], ["Bob page"])
    data = client.get("/api/v1.0/collaborations/?view=starred").json()
    assert data["workspaces"][0]["is_favorite"] is True

    client.delete(f"/api/v1.0/workspaces/{world['beta'].id}/favorite/")
    assert view(ada, "starred") == ([], [], ["Bob page"])


def test_only_my_workspaces_can_be_starred_and_views_are_known():
    """Someone else's workspace isn't found; an unknown view is refused."""
    user = factories.UserFactory()
    other = models.Workspace.objects.create(name="Other", slug="other")
    client = client_for(user)

    assert client.post(f"/api/v1.0/workspaces/{other.id}/favorite/").status_code == 404
    assert client.get("/api/v1.0/collaborations/?view=everything").status_code == 400
    assert APIClient().get("/api/v1.0/collaborations/").status_code == 401
