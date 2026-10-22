"""
Tests for profiles and the audience of each piece of them.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models

pytestmark = pytest.mark.django_db


def client_for(user=None):
    """An API client, logged in as the user if given."""
    client = APIClient()
    if user:
        client.force_login(user)
    return client


def colleagues():
    """Two people sharing a workspace, and a stranger."""
    owner = factories.UserFactory(full_name="Ada Lovelace")
    colleague, stranger = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme")
    for user in (owner, colleague):
        models.WorkspaceAccess.objects.create(workspace=workspace, user=user)
    return owner, colleague, stranger, workspace


def test_each_piece_shows_to_its_audience():
    """Defaults: most pieces for the platform, location and email for colleagues."""
    owner, colleague, stranger, workspace = colleagues()
    for name in ("Climate", "AI"):
        models.Label.get_or_create_named(name)
    client_for(owner).put(
        "/api/v1.0/profiles/me/",
        {
            "headline": "Grant writer",
            "location": "Lyon",
            "interests": ["Climate", "climate", "#AI"],
        },
        format="json",
    )
    url = f"/api/v1.0/profiles/{owner.id}/"

    seen_by_colleague = client_for(colleague).get(url).json()
    assert seen_by_colleague["full_name"] == "Ada Lovelace"
    assert seen_by_colleague["headline"] == "Grant writer"
    assert seen_by_colleague["location"] == "Lyon"
    assert seen_by_colleague["email"] == owner.email
    assert seen_by_colleague["interests"] == ["AI", "Climate"]
    assert seen_by_colleague["workspaces"] == [
        {"id": str(workspace.id), "name": "Acme"}
    ]

    seen_by_stranger = client_for(stranger).get(url).json()
    assert seen_by_stranger["headline"] == "Grant writer"
    assert seen_by_stranger["location"] == ""
    assert seen_by_stranger["email"] == ""
    assert seen_by_stranger["workspaces"] == []
    # what is kept from them is named, without its content
    assert seen_by_stranger["hidden"] == ["location", "email"]
    assert seen_by_colleague["hidden"] == []

    # signed out: nothing is public by default, so the profile is hidden
    assert client_for().get(url).status_code == 404


def test_public_pieces_and_the_name_floor():
    """Public pieces show to anyone; the name can't be hidden from colleagues."""
    owner, colleague, stranger, _workspace = colleagues()
    response = client_for(owner).put(
        "/api/v1.0/profiles/me/",
        {
            "bio": "Hello",
            "visibility": {
                "name": {"level": "public"},
                "bio": {"level": "public"},
            },
        },
        format="json",
    )
    assert response.json()["visibility"]["name"]["level"] == "public"
    url = f"/api/v1.0/profiles/{owner.id}/"
    anonymous = client_for().get(url).json()
    assert (anonymous["full_name"], anonymous["bio"]) == ("Ada Lovelace", "Hello")
    assert anonymous["headline"] == ""  # platform only

    # chosen spaces only: colleagues still see the name, strangers nothing
    space = factories.DocumentFactory(kind="space", link_reach="restricted")
    client_for(owner).put(
        "/api/v1.0/profiles/me/",
        {"visibility": {"name": {"level": "selected", "spaces": [str(space.id)]}}},
        format="json",
    )
    assert client_for(colleague).get(url).json()["full_name"] == "Ada Lovelace"
    assert client_for(stranger).get(url).status_code == 404

    models.DocumentAccess.objects.create(document=space, user=stranger)
    assert client_for(stranger).get(url).status_code == 200


def test_my_profile_validates_and_offers_choices():
    """Bad audiences and addresses are refused; choices list one's workspaces."""
    owner, _colleague, _stranger, workspace = colleagues()
    url = "/api/v1.0/profiles/me/"

    state = client_for(owner).get(url).json()
    assert state["workspace_choices"] == [{"id": str(workspace.id), "name": "Acme"}]
    assert state["visibility"]["email"] == {
        "level": "colleagues",
        "workspaces": [],
        "spaces": [],
    }

    bad = client_for(owner).put(
        url, {"visibility": {"bio": {"level": "everyone"}}}, format="json"
    )
    assert bad.status_code == 400
    bad = client_for(owner).put(url, {"website": "not a site"}, format="json")
    assert bad.status_code == 400
    good = client_for(owner).put(url, {"website": "example.org"}, format="json")
    assert good.json()["website"] == "https://example.org"
    assert client_for().get(url).status_code == 401


def test_profile_lists_what_each_item_lets_the_viewer_see():
    """Workspaces, spaces and pages by their own visibility, not a setting."""
    owner, colleague, stranger, _workspace = colleagues()
    public_space = factories.DocumentFactory(
        kind="space",
        title="Open space",
        link_reach="public",
        users=[(owner, "owner")],
    )
    private_page = factories.DocumentFactory(
        title="Private plan", link_reach="restricted", users=[(owner, "owner")]
    )
    models.DocumentAccess.objects.create(
        document=private_page, user=colleague, role="reader"
    )
    open_workspace = models.Workspace.objects.create(
        name="Open guild", visibility="platform"
    )
    models.WorkspaceAccess.objects.create(workspace=open_workspace, user=owner)
    client_for(owner).put(
        "/api/v1.0/profiles/me/", {"headline": "Grant writer"}, format="json"
    )
    url = f"/api/v1.0/profiles/{owner.id}/"

    seen_by_colleague = client_for(colleague).get(url).json()
    assert seen_by_colleague["spaces"] == [
        {"id": str(public_space.id), "title": "Open space"}
    ]
    assert seen_by_colleague["pages"] == [
        {"id": str(private_page.id), "title": "Private plan"}
    ]
    assert [item["name"] for item in seen_by_colleague["workspaces"]] == [
        "Acme",
        "Open guild",
    ]

    seen_by_stranger = client_for(stranger).get(url).json()
    assert [item["title"] for item in seen_by_stranger["spaces"]] == ["Open space"]
    assert seen_by_stranger["pages"] == []
    assert [item["name"] for item in seen_by_stranger["workspaces"]] == ["Open guild"]


def test_interests_are_labels_already_used():
    """A profile picks among existing labels; it makes none."""
    owner = factories.UserFactory()
    models.Label.get_or_create_named("Climate")
    response = client_for(owner).put(
        "/api/v1.0/profiles/me/",
        {"interests": ["#climate", "Brand new idea"]},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["interests"] == ["Climate"]
    assert not models.Label.objects.filter(key="brand new idea").exists()


def test_the_email_shown_is_one_of_the_owners_addresses():
    """Merged accounts bring more addresses; any other is refused."""
    owner, colleague, _stranger, _workspace = colleagues()
    models.SignInIdentity.objects.create(
        user=owner, provider="google", sub="g-2", account="ada@home.example"
    )
    me = client_for(owner).get("/api/v1.0/profiles/me/").json()
    assert me["email_choices"] == [owner.email, "ada@home.example"]

    response = client_for(owner).put(
        "/api/v1.0/profiles/me/", {"shown_email": "ada@home.example"}, format="json"
    )
    assert response.status_code == 200
    seen = client_for(colleague).get(f"/api/v1.0/profiles/{owner.id}/").json()
    assert seen["email"] == "ada@home.example"

    response = client_for(owner).put(
        "/api/v1.0/profiles/me/", {"shown_email": "else@example.com"}, format="json"
    )
    assert response.status_code == 400
