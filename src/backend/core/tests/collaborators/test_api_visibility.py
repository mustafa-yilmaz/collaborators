"""
Tests for the one "Who can see this?" setting of pages and spaces.
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


def fresh(user):
    """Reload a user so its cached teams are recomputed."""
    return models.User.objects.get(pk=user.pk)


def url(document):
    """Where a document's visibility is."""
    return f"/api/v1.0/documents/{document.id}/visibility/"


def workspace_space(owner, member):
    """A space of a workspace, restricted, with a page inside."""
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    space = factories.DocumentFactory(
        kind="space",
        title="Engineering",
        link_reach="restricted",
        users=[(owner, "owner")],
    )
    models.SpaceWorkspaceLink.objects.create(
        space=space, workspace=workspace, is_home=True
    )
    page = factories.DocumentFactory(parent=space, link_reach="restricted")
    return workspace, space, page


def test_a_space_offers_public_platform_workspace_and_invited():
    """The choices of a space, and opening it to its workspace."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    workspace, space, _page = workspace_space(owner, member)
    team = f"workspace:{workspace.id}"

    state = client_for(owner).get(url(space)).json()
    assert state["value"] == "invited"
    assert state["options"] == ["public", "platform", team, "invited"]
    assert state["workspaces"] == {team: "Acme"}
    assert state["can_change"] is True
    assert space.get_role(fresh(member)) is None

    state = client_for(owner).put(url(space), {"value": team}, format="json").json()
    assert state["value"] == team
    assert space.get_role(fresh(member)) == "reader"

    state = client_for(owner).put(url(space), {"value": "invited"}, format="json")
    assert state.json()["value"] == "invited"
    assert space.get_role(fresh(member)) is None


def test_a_page_in_a_space_follows_it_or_opens_further():
    """A sub-page offers "same as the space", not "invited"."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    _workspace, space, page = workspace_space(owner, member)

    state = client_for(owner).get(url(page)).json()
    assert state["value"] == "space"
    assert state["options"][-1] == "space"
    assert "invited" not in state["options"]
    assert state["space"] == {"id": str(space.id), "title": "Engineering"}

    response = client_for(owner).put(
        url(page), {"value": "platform", "link_role": "commenter"}, format="json"
    )
    assert response.json()["value"] == "platform"
    assert response.json()["link_role"] == "commenter"
    page.refresh_from_db()
    assert (page.link_reach, page.keep_private) == ("authenticated", True)

    client_for(owner).put(url(page), {"value": "space"}, format="json")
    page.refresh_from_db()
    assert (page.link_reach, page.keep_private) == ("restricted", False)


def test_a_public_space_page_narrowed_to_the_platform():
    """Under a public space, "platform" keeps the page off the internet."""
    owner = factories.UserFactory()
    space = factories.DocumentFactory(
        kind="space", link_reach="public", users=[(owner, "owner")]
    )
    page = factories.DocumentFactory(parent=space, link_reach="restricted")
    assert client_for(owner).get(url(page)).json()["value"] == "public"

    client_for(owner).put(url(page), {"value": "platform"}, format="json")

    page.refresh_from_db()
    assert page.computed_link_reach == "authenticated"


def test_an_independent_page_has_no_workspace_choice():
    """Public, platform or invited only; readers can't change it."""
    owner, reader = factories.UserFactory(), factories.UserFactory()
    page = factories.DocumentFactory(
        link_reach="restricted", users=[(owner, "owner"), (reader, "reader")]
    )

    state = client_for(owner).get(url(page)).json()
    assert state["options"] == ["public", "platform", "invited"]

    assert client_for(reader).get(url(page)).json()["can_change"] is False
    response = client_for(reader).put(url(page), {"value": "public"}, format="json")
    assert response.status_code == 403
    response = client_for(owner).put(url(page), {"value": "workspace:x"}, format="json")
    assert response.status_code == 400
    response = client_for(owner).put(url(page), {"value": "public"}, format="json")
    assert response.json()["value"] == "public"
    assert models.PublicationLog.objects.filter(document=page).exists()


# -- Finding workspaces


def test_discover_lists_findable_workspaces_only():
    """Public ones for anyone; platform ones when signed in; never hidden ones."""
    owner, someone = factories.UserFactory(), factories.UserFactory()
    for name, visibility in (
        ("Open Acme", "public"),
        ("Platform Co", "platform"),
        ("Secret Ltd", "hidden"),
    ):
        workspace = models.Workspace.objects.create(name=name, visibility=visibility)
        models.WorkspaceAccess.objects.create(
            workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
        )

    anonymous = APIClient().get("/api/v1.0/workspaces/discover/").json()
    assert [w["name"] for w in anonymous] == ["Open Acme"]

    signed_in = client_for(someone).get("/api/v1.0/workspaces/discover/").json()
    assert [w["name"] for w in signed_in] == ["Open Acme", "Platform Co"]
    assert signed_in[0]["member_count"] == 1
    assert signed_in[0]["is_member"] is False

    found = client_for(someone).get("/api/v1.0/workspaces/discover/?q=platform")
    assert [w["name"] for w in found.json()] == ["Platform Co"]


def test_asking_to_join_from_the_directory_needs_an_admin():
    """Always a request, even without approval turned on; hidden: not found."""
    owner, someone = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme", visibility="platform")
    hidden = models.Workspace.objects.create(name="Secret")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )

    response = client_for(someone).post(
        f"/api/v1.0/workspaces/{workspace.id}/ask-to-join/"
    )

    assert response.json()["request_status"] == "pending"
    assert not workspace.accesses.filter(user=someone).exists()
    assert workspace.join_requests.get().via == "directory"
    assert models.Notification.objects.get(recipient=owner).kind == "join_request"
    assert (
        client_for(someone)
        .post(f"/api/v1.0/workspaces/{hidden.id}/ask-to-join/")
        .status_code
        == 404
    )


def test_only_admins_change_a_workspace_visibility():
    """Admins set it; members can't."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    detail = f"/api/v1.0/workspaces/{workspace.id}/"

    assert (
        client_for(member)
        .patch(detail, {"visibility": "public"}, format="json")
        .status_code
        == 403
    )
    response = client_for(owner).patch(detail, {"visibility": "public"}, format="json")
    assert response.json()["visibility"] == "public"


def test_a_live_wiki_space_stays_public_until_unpublished():
    """Narrowing a space published as a live wiki is refused."""
    owner = factories.UserFactory()
    space = factories.DocumentFactory(
        kind="space",
        link_reach="public",
        wiki_slug="handbook",
        users=[(owner, "owner")],
    )

    response = client_for(owner).put(url(space), {"value": "invited"}, format="json")

    assert response.status_code == 400
    space.refresh_from_db()
    assert space.link_reach == "public"
