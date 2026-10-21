"""
Tests for who finds, sees and invites whom: people sharing a workspace, a
space or a page, and those who let everyone find them.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = [
    pytest.mark.django_db,
    pytest.mark.usefixtures("people_privacy"),
]


@pytest.fixture(name="people_privacy")
def fixture_people_privacy(settings):
    """Collaborators' rule on (Docs' own tests run without it)."""
    settings.COLLABORATORS_PEOPLE_PRIVACY = True


def client_for(user):
    """An API client logged in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def search(user, query):
    """The names the user search finds."""
    response = client_for(user).get(f"/api/v1.0/users/?q={query}")
    assert response.status_code == 200
    return sorted(item["full_name"] for item in response.json())


def test_search_finds_only_people_sharing_something():
    """A space and a page under it count as shared; the same domain doesn't."""
    me = factories.UserFactory(full_name="Me Myself", email="me@acme.org")
    colleague = factories.UserFactory(full_name="Ada Lovelace", email="a@x.org")
    factories.UserFactory(full_name="Ada Stranger", email="ada@acme.org")
    space = factories.DocumentFactory(kind="space", users=[(me, "owner")])
    factories.DocumentFactory(parent=space, users=[(colleague, "reader")])

    assert search(me, "Ada") == ["Ada Lovelace"]
    assert search(colleague, "Myself") == ["Me Myself"]


def test_search_finds_groups_and_workspace_co_members():
    """A page shared with a group: its members; a workspace: its members."""
    me, grouped, member = factories.UserFactory.create_batch(3)
    me.full_name, grouped.full_name, member.full_name = "Me", "Grace G", "Gail W"
    for user in (me, grouped, member):
        user.save()
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    models.WorkspaceAccess.objects.create(workspace=workspace, user=grouped)
    group = models.Group.objects.create(workspace=workspace, name="Q4")
    models.GroupMembership.objects.create(group=group, user=grouped)
    page = factories.DocumentFactory(users=[(me, "owner")])
    models.DocumentAccess.objects.create(
        document=page, team=models.make_team(models.TEAM_GROUP, group.id), role="reader"
    )

    assert search(me, "Gra") == ["Grace G"]
    assert search(me, "Gail") == []
    models.WorkspaceAccess.objects.create(workspace=workspace, user=me)
    assert search(me, "Gail") == ["Gail W"]


def test_search_finds_who_lets_everyone_find_them():
    """Their profile's reach: everyone on Collaborators."""
    me = factories.UserFactory()
    open_person = factories.UserFactory(full_name="Olga Open")
    assert search(me, "Olga") == []

    client_for(open_person).put(
        "/api/v1.0/profiles/me/", {"reach": "platform"}, format="json"
    )
    assert search(me, "Olga") == ["Olga Open"]


def test_an_email_finds_only_someone_one_may_see():
    """Otherwise nothing tells whether it has an account: invite it by email."""
    me = factories.UserFactory()
    stranger = factories.UserFactory(email="stranger@example.com")
    url = "/api/v1.0/users/?q=stranger@example.com"
    assert client_for(me).get(url).json() == []

    factories.DocumentFactory(users=[(me, "owner"), (stranger, "reader")])
    assert [item["id"] for item in client_for(me).get(url).json()] == [str(stranger.id)]


def test_one_cannot_add_a_stranger_by_name():
    """Neither to a page nor to a workspace."""
    me, stranger = factories.UserFactory.create_batch(2)
    page = factories.DocumentFactory(users=[(me, "owner")])
    response = client_for(me).post(
        f"/api/v1.0/documents/{page.id}/accesses/",
        {"user_id": str(stranger.id), "role": "reader"},
        format="json",
    )
    assert response.status_code == 400
    assert "user_id" in response.json()

    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(workspace=workspace, user=me, role="owner")
    response = client_for(me).post(
        f"/api/v1.0/workspaces/{workspace.id}/accesses/",
        {"user_id": str(stranger.id), "role": "member"},
        format="json",
    )
    assert response.status_code == 400


def test_profile_pieces_stay_within_the_reach():
    """'Everyone on Collaborators' means colleagues until the reach is wider."""
    owner, stranger = factories.UserFactory.create_batch(2)
    client_for(owner).put(
        "/api/v1.0/profiles/me/", {"headline": "Grant writer"}, format="json"
    )
    url = f"/api/v1.0/profiles/{owner.id}/"
    assert client_for(stranger).get(url).status_code == 404

    client_for(owner).put(
        "/api/v1.0/profiles/me/", {"reach": "platform"}, format="json"
    )
    assert client_for(stranger).get(url).json()["headline"] == "Grant writer"
    assert client_for(owner).get("/api/v1.0/profiles/me/").json()["reach"] == "platform"


def test_my_collaborators_lists_colleagues_then_open_people():
    """With the workspaces shared; strangers stay out."""
    me = factories.UserFactory(full_name="Me")
    colleague = factories.UserFactory(full_name="Zoe Colleague")
    open_person = factories.UserFactory(full_name="Abe Open")
    factories.UserFactory(full_name="Sam Stranger")
    models.UserProfile.objects.create(user=open_person, reach="platform")
    workspace = models.Workspace.objects.create(name="Acme")
    for user in (me, colleague):
        models.WorkspaceAccess.objects.create(workspace=workspace, user=user)

    people = client_for(me).get("/api/v1.0/people/directory/").json()

    assert [person["full_name"] for person in people] == [
        "Zoe Colleague",
        "Abe Open",
    ]
    assert people[0]["is_colleague"] is True
    assert people[0]["workspaces"] == ["Acme"]
    assert people[1]["is_colleague"] is False
    found = client_for(me).get("/api/v1.0/people/directory/?q=abe").json()
    assert [person["full_name"] for person in found] == ["Abe Open"]
