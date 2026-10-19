"""
Tests for the Collaborators structure API: workspaces, members, groups, and
how groups and workspaces reach documents through team accesses.
"""

import pytest
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from core import factories, models
from core.choices import RoleChoices, WorkspaceRoleChoices

pytestmark = pytest.mark.django_db


def make_workspace(owner, name="Acme", members=(), admins=()):
    """Create a workspace with its owner, members and administrators."""
    workspace = models.Workspace.objects.create(name=name)
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    for user in members:
        models.WorkspaceAccess.objects.create(workspace=workspace, user=user)
    for user in admins:
        models.WorkspaceAccess.objects.create(
            workspace=workspace, user=user, role=WorkspaceRoleChoices.ADMIN
        )
    return workspace


def client_for(user):
    """An API client logged in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


# -- Teams


def test_models_user_teams_lists_groups_workspaces_and_administered_workspaces():
    """A user's teams come from their groups and workspaces."""
    owner, member = factories.UserFactory.create_batch(2)
    workspace = make_workspace(owner, members=[member])
    group = models.Group.objects.create(workspace=workspace, name="Q4 Launch")
    models.GroupMembership.objects.create(group=group, user=member)

    assert sorted(models.User.objects.get(pk=member.pk).teams) == sorted(
        [f"group:{group.id}", f"workspace:{workspace.id}"]
    )
    assert sorted(models.User.objects.get(pk=owner.pk).teams) == sorted(
        [f"workspace:{workspace.id}", f"workspace-admins:{workspace.id}"]
    )


def test_models_group_access_gives_its_role_on_descendants():
    """A role granted to a group on a space applies to its pages."""
    owner, member, outsider = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[member, outsider])
    group = models.Group.objects.create(workspace=workspace, name="Q4 Launch")
    models.GroupMembership.objects.create(group=group, user=member)
    space = factories.DocumentFactory(kind="space", link_reach="restricted")
    page = factories.DocumentFactory(parent=space)
    models.DocumentAccess.objects.create(
        document=space, team=group.team, role=RoleChoices.EDITOR
    )

    assert page.get_role(models.User.objects.get(pk=member.pk)) == RoleChoices.EDITOR
    assert page.get_role(models.User.objects.get(pk=outsider.pk)) is None


def test_models_document_space_must_be_root():
    """A space can't sit under another document."""
    root = factories.DocumentFactory()
    with pytest.raises(ValidationError):
        factories.DocumentFactory(parent=root, kind="space")


# -- Workspaces


def test_api_workspaces_create_makes_the_creator_owner():
    """Any collaborator can create a workspace and owns it."""
    user = factories.UserFactory()

    response = client_for(user).post("/api/v1.0/workspaces/", {"name": "Acme Corp"})

    assert response.status_code == 201
    workspace = models.Workspace.objects.get()
    assert workspace.slug == "acme-corp"
    assert workspace.get_role(user) == WorkspaceRoleChoices.OWNER
    assert response.json()["user_role"] == "owner"


def test_api_workspaces_list_only_mine():
    """Collaborators only see the workspaces they belong to."""
    user, other = factories.UserFactory.create_batch(2)
    mine = make_workspace(user, name="Mine")
    make_workspace(other, name="Theirs")

    response = client_for(user).get("/api/v1.0/workspaces/")

    assert [w["id"] for w in response.json()] == [str(mine.id)]


def test_api_workspaces_update_needs_admin():
    """Members can't rename a workspace; administrators can."""
    owner, member, admin = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[member], admins=[admin])
    url = f"/api/v1.0/workspaces/{workspace.id}/"

    assert client_for(member).patch(url, {"name": "X"}).status_code == 403
    assert client_for(admin).patch(url, {"name": "Acme 2"}).status_code == 200


def test_api_workspaces_destroy_removes_its_team_accesses():
    """Deleting a workspace removes the roles its teams had on documents."""
    owner = factories.UserFactory()
    workspace = make_workspace(owner)
    space = factories.DocumentFactory(kind="space")
    models.DocumentAccess.objects.create(
        document=space, team=f"workspace:{workspace.id}", role="reader"
    )

    response = client_for(owner).delete(f"/api/v1.0/workspaces/{workspace.id}/")

    assert response.status_code == 204
    assert not space.accesses.filter(team__startswith="workspace:").exists()


# -- Workspace members


def test_api_workspace_accesses_admin_adds_existing_collaborator():
    """Administrators add existing collaborators; members can't."""
    owner, member, newcomer = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[member])
    url = f"/api/v1.0/workspaces/{workspace.id}/accesses/"

    response = client_for(member).post(url, {"user_id": str(newcomer.id)})
    assert response.status_code == 403

    response = client_for(owner).post(url, {"user_id": str(newcomer.id)})
    assert response.status_code == 201
    assert workspace.get_role(newcomer) == WorkspaceRoleChoices.MEMBER


def test_api_workspace_accesses_only_owner_makes_owners():
    """An administrator can't promote someone to owner."""
    owner, admin, member = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[member], admins=[admin])
    access = workspace.accesses.get(user=member)

    response = client_for(admin).patch(
        f"/api/v1.0/workspaces/{workspace.id}/accesses/{access.id}/",
        {"role": "owner"},
    )

    assert response.status_code == 403


def test_api_workspace_accesses_keep_one_owner():
    """The last owner can neither leave nor be demoted."""
    owner = factories.UserFactory()
    workspace = make_workspace(owner)
    access = workspace.accesses.get(user=owner)
    url = f"/api/v1.0/workspaces/{workspace.id}/accesses/{access.id}/"

    assert client_for(owner).delete(url).status_code == 400
    assert client_for(owner).patch(url, {"role": "member"}).status_code == 400


def test_api_workspace_accesses_member_can_leave_and_leaves_groups():
    """Leaving a workspace also leaves its groups."""
    owner, member = factories.UserFactory.create_batch(2)
    workspace = make_workspace(owner, members=[member])
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    models.GroupMembership.objects.create(group=group, user=member)
    access = workspace.accesses.get(user=member)

    response = client_for(member).delete(
        f"/api/v1.0/workspaces/{workspace.id}/accesses/{access.id}/"
    )

    assert response.status_code == 204
    assert not group.memberships.exists()


def test_api_workspace_accesses_hidden_from_outsiders():
    """Non members get a 404 on a workspace's members."""
    owner, outsider = factories.UserFactory.create_batch(2)
    workspace = make_workspace(owner)

    response = client_for(outsider).get(
        f"/api/v1.0/workspaces/{workspace.id}/accesses/"
    )

    assert response.status_code == 404


# -- Groups


def test_api_groups_admins_manage_groups():
    """Administrators create organizations; members create teams only."""
    owner, member = factories.UserFactory.create_batch(2)
    workspace = make_workspace(owner, members=[member])
    url = f"/api/v1.0/workspaces/{workspace.id}/groups/"

    assert (
        client_for(member).post(url, {"name": "Q4", "kind": "organization"}).status_code
        == 400
    )
    response = client_for(owner).post(url, {"name": "Acme", "kind": "organization"})
    assert response.status_code == 201
    assert response.json()["team"].startswith("group:")
    assert client_for(member).post(url, {"name": "Q4"}).status_code == 201

    listed = client_for(member).get(url).json()
    assert [(g["name"], g["kind"], g["nb_members"]) for g in listed] == [
        ("Acme", "organization", 0),
        ("Q4", "team", 0),
    ]


def test_api_groups_destroy_removes_its_accesses():
    """Deleting a group removes the roles it had on documents."""
    owner = factories.UserFactory()
    workspace = make_workspace(owner)
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    document = factories.DocumentFactory()
    models.DocumentAccess.objects.create(document=document, team=group.team)

    response = client_for(owner).delete(
        f"/api/v1.0/workspaces/{workspace.id}/groups/{group.id}/"
    )

    assert response.status_code == 204
    assert not document.accesses.filter(team=group.team).exists()


def test_api_group_members_must_belong_to_the_workspace():
    """Only workspace members can join its groups."""
    owner, member, outsider = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[member])
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    url = f"/api/v1.0/groups/{group.id}/members/"

    assert client_for(owner).post(url, {"user_id": str(member.id)}).status_code == 201
    assert client_for(owner).post(url, {"user_id": str(outsider.id)}).status_code == 400


def test_api_group_members_managers_can_add_members():
    """Group managers manage members without being workspace admins."""
    owner, manager, member = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[manager, member])
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    models.GroupMembership.objects.create(group=group, user=manager, is_manager=True)
    url = f"/api/v1.0/groups/{group.id}/members/"

    response = client_for(manager).post(url, {"user_id": str(member.id)})

    assert response.status_code == 201
    assert client_for(member).post(url, {"user_id": str(owner.id)}).status_code == 403


def test_api_workspaces_my_teams():
    """A collaborator can read their own teams."""
    owner, member = factories.UserFactory.create_batch(2)
    workspace = make_workspace(owner, members=[member])
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    models.GroupMembership.objects.create(group=group, user=member)

    response = client_for(member).get("/api/v1.0/workspaces/my-teams/")

    assert sorted(response.json()) == sorted(
        [f"group:{group.id}", f"workspace:{workspace.id}"]
    )


def test_api_users_search_finds_workspace_members_by_name():
    """Members of my workspaces are found by name, without sharing a document."""
    owner = factories.UserFactory(full_name="Owner Person", email="o@a.test")
    member = factories.UserFactory(full_name="Grace Hopper", email="g@b.test")
    make_workspace(owner, members=[member])

    response = client_for(owner).get("/api/v1.0/users/?q=Grace")

    assert [user["id"] for user in response.json()] == [str(member.id)]
