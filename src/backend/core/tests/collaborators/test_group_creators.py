"""
Tests for groups managed by their creators: any member creates a team and
manages it like an administrator, and people move or are copied between the
groups one manages.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.choices import WorkspaceRoleChoices

pytestmark = pytest.mark.django_db


def make_workspace(owner, members=()):
    """A workspace with its owner and members."""
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    for user in members:
        models.WorkspaceAccess.objects.create(workspace=workspace, user=user)
    return workspace


def client_for(user):
    """An API client logged in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def test_the_creator_manages_their_group():
    """A member who creates a team renames it, appoints managers and deletes it."""
    owner, creator, other, someone = factories.UserFactory.create_batch(4)
    workspace = make_workspace(owner, members=[creator, other, someone])
    url = f"/api/v1.0/workspaces/{workspace.id}/groups/"

    created = client_for(creator).post(url, {"name": "Q4"}).json()
    assert created["created_by"]["id"] == str(creator.id)
    assert created["abilities"]["update"] is True
    group_url = f"{url}{created['id']}/"

    # another member can't
    assert client_for(other).patch(group_url, {"name": "X"}).status_code == 403
    assert (
        client_for(creator).patch(group_url, {"name": "Q4 Launch"}).status_code == 200
    )

    members_url = f"/api/v1.0/groups/{created['id']}/members/"
    added = client_for(creator).post(members_url, {"user_id": str(someone.id)})
    assert added.status_code == 201
    response = client_for(creator).patch(
        f"{members_url}{added.json()['id']}/", {"is_manager": True}, format="json"
    )
    assert response.status_code == 200

    assert client_for(other).delete(group_url).status_code == 403
    assert client_for(creator).delete(group_url).status_code == 204


def test_move_and_copy_members_between_groups():
    """People move (or are copied) between the groups one manages."""
    owner, creator, ada, bo = factories.UserFactory.create_batch(4)
    workspace = make_workspace(owner, members=[creator, ada, bo])
    first = models.Group.objects.create(
        workspace=workspace, name="First", created_by=creator
    )
    second = models.Group.objects.create(
        workspace=workspace, name="Second", created_by=creator
    )
    for user in (ada, bo):
        models.GroupMembership.objects.create(group=first, user=user)
    url = f"/api/v1.0/groups/{first.id}/members/transfer/"

    response = client_for(creator).post(
        url,
        {"user_ids": [str(ada.id)], "to_group_id": str(second.id), "mode": "copy"},
        format="json",
    )
    assert response.json() == {"count": 1}
    assert set(first.memberships.values_list("user_id", flat=True)) == {ada.id, bo.id}
    assert list(second.memberships.values_list("user_id", flat=True)) == [ada.id]

    response = client_for(creator).post(
        url,
        {"user_ids": [str(ada.id), str(bo.id)], "to_group_id": str(second.id)},
        format="json",
    )
    assert response.json() == {"count": 2}
    assert not first.memberships.exists()
    assert set(second.memberships.values_list("user_id", flat=True)) == {ada.id, bo.id}
    # their teams follow
    assert second.team in models.User.objects.get(pk=bo.pk).teams
    assert first.team not in models.User.objects.get(pk=bo.pk).teams


def test_moving_needs_rights_on_both_groups():
    """Into someone else's group: refused; between workspaces: refused."""
    owner, creator, ada = factories.UserFactory.create_batch(3)
    workspace = make_workspace(owner, members=[creator, ada])
    mine = models.Group.objects.create(
        workspace=workspace, name="Mine", created_by=creator
    )
    theirs = models.Group.objects.create(
        workspace=workspace, name="Theirs", created_by=owner
    )
    elsewhere = models.Group.objects.create(
        workspace=make_workspace(creator), name="Elsewhere", created_by=creator
    )
    models.GroupMembership.objects.create(group=mine, user=ada)
    url = f"/api/v1.0/groups/{mine.id}/members/transfer/"

    for target, status in ((theirs, 403), (elsewhere, 400), (mine, 400)):
        response = client_for(creator).post(
            url,
            {"user_ids": [str(ada.id)], "to_group_id": str(target.id)},
            format="json",
        )
        assert response.status_code == status
    assert mine.memberships.filter(user=ada).exists()

    # the workspace's administrators can, between any groups
    response = client_for(owner).post(
        url, {"user_ids": [str(ada.id)], "to_group_id": str(theirs.id)}, format="json"
    )
    assert response.status_code == 200
    assert theirs.memberships.filter(user=ada).exists()
