"""
Tests for publishing to the web: pages kept private, spaces published as
wikis, the publishing policy of workspaces and their publishing log.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.choices import PublishingPolicyChoices, WorkspaceRoleChoices

pytestmark = pytest.mark.django_db


def client_for(user=None):
    """An API client, logged in as the user if one is given."""
    client = APIClient()
    if user:
        client.force_login(user)
    return client


def public_space(owner, **kwargs):
    """A public space with a page, a page kept private and a page below it."""
    space = factories.DocumentFactory(
        users=[(owner, "owner")],
        kind="space",
        title="Handbook",
        link_reach="public",
        link_role="reader",
        **kwargs,
    )
    page = factories.DocumentFactory(
        parent=space, title="Welcome", link_reach="restricted"
    )
    private = factories.DocumentFactory(
        parent=space, title="Salaries", link_reach="restricted", keep_private=True
    )
    below = factories.DocumentFactory(
        parent=private, title="2026", link_reach="restricted"
    )
    return space, page, private, below


def in_workspace(space, owner, policy=PublishingPolicyChoices.SPACE_ADMINS):
    """Give the space a home workspace with the given publishing policy."""
    workspace = models.Workspace.objects.create(name="Acme", publishing_policy=policy)
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    models.SpaceWorkspaceLink.objects.create(
        space=space, workspace=workspace, is_home=True
    )
    return workspace


# -- Keep private


def test_keep_private_cuts_public_access_for_anonymous_readers():
    """A page kept private, and what is below it, is not public any more."""
    owner = factories.UserFactory()
    _space, page, private, below = public_space(owner)

    anonymous = client_for()
    assert anonymous.get(f"/api/v1.0/documents/{page.id}/").status_code == 200
    assert anonymous.get(f"/api/v1.0/documents/{private.id}/").status_code == 401
    assert anonymous.get(f"/api/v1.0/documents/{below.id}/").status_code == 401

    # People invited to the space still read it
    assert (
        client_for(owner).get(f"/api/v1.0/documents/{private.id}/").status_code == 200
    )


def test_keep_private_hidden_from_children_and_tree():
    """Anonymous readers don't see private pages in lists of sub-pages."""
    owner = factories.UserFactory()
    space, page, _private, _below = public_space(owner)

    children = client_for().get(f"/api/v1.0/documents/{space.id}/children/").json()
    assert [child["title"] for child in children["results"]] == ["Welcome"]

    tree = client_for().get(f"/api/v1.0/documents/{page.id}/tree/").json()
    assert [child["title"] for child in tree["children"]] == ["Welcome"]

    owner_children = (
        client_for(owner).get(f"/api/v1.0/documents/{space.id}/children/").json()
    )
    assert len(owner_children["results"]) == 2


def test_keep_private_change_is_reported_to_the_collaboration_server():
    """Keeping a page private is a change of who may read it."""
    owner = factories.UserFactory()
    _space, page, _private, _below = public_space(owner)
    page = models.Document.objects.get(pk=page.pk)

    page.keep_private = True

    assert page.link_definition_changed()


def test_publication_settings():
    """Admins of a page keep it private or let search engines index it."""
    owner, reader = factories.UserFactory.create_batch(2)
    space, page, _private, _below = public_space(owner)
    models.DocumentAccess.objects.create(document=space, user=reader, role="reader")
    url = f"/api/v1.0/documents/{page.id}/publication/"

    state = client_for().get(url).json()
    assert state["is_public"] is True
    assert state["indexable"] is False
    assert state["can_publish"] is False

    response = client_for(owner).put(
        url, {"allow_indexing": True, "keep_private": True}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["keep_private"] is True
    assert response.json()["is_public"] is False

    assert (
        client_for(reader).put(url, {"keep_private": False}, format="json").status_code
        == 403
    )
    root = client_for(owner).put(
        f"/api/v1.0/documents/{space.id}/publication/",
        {"keep_private": True},
        format="json",
    )
    assert root.status_code == 400


# -- Wikis


def test_publish_space_as_wiki_and_read_it_signed_out():
    """A wiki is public, read-only, and lists its pages without private ones."""
    owner = factories.UserFactory()
    space, page, _private, _below = public_space(owner)
    space.link_reach = "restricted"
    space.save()

    response = client_for(owner).put(
        f"/api/v1.0/spaces/{space.id}/wiki/",
        {"slug": "Team Handbook", "accent": "#0b7a75", "allow_indexing": True},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["slug"] == "team-handbook"
    space.refresh_from_db()
    assert (space.link_reach, space.link_role) == ("public", "reader")

    wiki = client_for().get("/api/v1.0/wiki/team-handbook/").json()
    assert wiki["title"] == "Handbook"
    assert wiki["accent"] == "#0b7a75"
    assert wiki["can_edit"] is False
    assert wiki["tree"] == [{"id": str(page.id), "title": "Welcome", "children": []}]

    state = client_for().get(f"/api/v1.0/documents/{page.id}/publication/").json()
    assert state["wiki"]["slug"] == "team-handbook"
    assert state["indexable"] is True


def test_wiki_addresses_are_unique_and_unpublishing_closes_the_space():
    """
    Two wikis can't share an address; unpublishing closes the wiki.
    Collaborators: the space gets back its reach from before the wiki.
    """
    owner = factories.UserFactory()
    space, *_ = public_space(owner)
    other = factories.DocumentFactory(users=[(owner, "owner")], kind="space")
    client = client_for(owner)
    client.put(
        f"/api/v1.0/spaces/{space.id}/wiki/", {"slug": "handbook"}, format="json"
    )

    taken = client.put(
        f"/api/v1.0/spaces/{other.id}/wiki/", {"slug": "handbook"}, format="json"
    )
    assert taken.status_code == 400
    # the app's page addresses are not wiki addresses
    for reserved in ("page", "docs"):
        response = client.put(
            f"/api/v1.0/spaces/{other.id}/wiki/", {"slug": reserved}, format="json"
        )
        assert response.status_code == 400

    assert client.delete(f"/api/v1.0/spaces/{space.id}/wiki/").status_code == 204
    assert client_for().get("/api/v1.0/wiki/handbook/").status_code == 404
    space.refresh_from_db()
    # it was public before being published as a wiki
    assert space.link_reach == "public"


def test_wiki_needs_a_space_and_its_admins():
    """Only the admins of a space publish it; pages aren't wikis."""
    owner, editor = factories.UserFactory.create_batch(2)
    space, page, *_ = public_space(owner)
    models.DocumentAccess.objects.create(document=space, user=editor, role="editor")

    assert (
        client_for(editor)
        .put(f"/api/v1.0/spaces/{space.id}/wiki/", {"slug": "x"}, format="json")
        .status_code
        == 403
    )
    assert (
        client_for(owner)
        .put(f"/api/v1.0/spaces/{page.id}/wiki/", {"slug": "x"}, format="json")
        .status_code
        == 404
    )


# -- Publishing policy and log


def test_workspace_admins_only_policy():
    """A space owner can't publish when only workspace admins may."""
    owner, space_owner = factories.UserFactory.create_batch(2)
    space = factories.DocumentFactory(
        users=[(space_owner, "owner")], kind="space", link_reach="restricted"
    )
    workspace = in_workspace(space, owner, PublishingPolicyChoices.WORKSPACE_ADMINS)
    models.WorkspaceAccess.objects.create(workspace=workspace, user=space_owner)

    denied = client_for(space_owner).put(
        f"/api/v1.0/documents/{space.id}/link-configuration/",
        {"link_reach": "public", "link_role": "reader"},
        format="json",
    )
    assert denied.status_code == 403
    wiki = client_for(space_owner).put(
        f"/api/v1.0/spaces/{space.id}/wiki/", {"slug": "acme"}, format="json"
    )
    assert wiki.status_code == 403

    # Restricting stays possible, and workspace admins publish
    models.DocumentAccess.objects.create(
        document=space, user=owner, role="administrator"
    )
    allowed = client_for(owner).put(
        f"/api/v1.0/documents/{space.id}/link-configuration/",
        {"link_reach": "public", "link_role": "reader"},
        format="json",
    )
    assert allowed.status_code == 200


def test_publication_log_for_workspace_admins():
    """Publishing and unpublishing are logged; admins read the log."""
    owner, member = factories.UserFactory.create_batch(2)
    space = factories.DocumentFactory(
        users=[(owner, "owner")], kind="space", title="Plans", link_reach="restricted"
    )
    workspace = in_workspace(space, owner)
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    client = client_for(owner)
    client.put(
        f"/api/v1.0/documents/{space.id}/link-configuration/",
        {"link_reach": "public", "link_role": "reader"},
        format="json",
    )
    client.put(f"/api/v1.0/spaces/{space.id}/wiki/", {"slug": "plans"}, format="json")
    client.delete(f"/api/v1.0/spaces/{space.id}/wiki/")

    log = client.get(f"/api/v1.0/workspaces/{workspace.id}/publication-log/").json()

    assert [entry["action"] for entry in log] == [
        "wiki_unpublished",
        "wiki_published",
        "page_published",
    ]
    assert log[0]["document"]["title"] == "Plans"
    assert (
        client_for(member)
        .get(f"/api/v1.0/workspaces/{workspace.id}/publication-log/")
        .status_code
        == 403
    )


def test_tls_allowed_only_for_our_addresses(settings):
    """Certificates for the app, workspaces and published wikis' domains only."""
    settings.COLLABORATORS_WIKI_BASE_DOMAIN = "collaborators.community"
    settings.COLLABORATORS_APP_HOSTS = ["collaborators.community"]
    # Collaborators: a findable workspace (a hidden one's address only serves
    # the wikis it publishes)
    models.Workspace.objects.create(name="Acme", slug="acme", visibility="platform")
    factories.DocumentFactory(
        kind="space",
        link_reach="public",
        wiki_slug="handbook",
        wiki_domain="help.example.org",
    )
    client = APIClient()

    def allowed(domain):
        return client.get(f"/api/v1.0/tls-allowed/?domain={domain}").status_code

    assert allowed("collaborators.community") == 200
    assert allowed("acme.collaborators.community") == 200
    assert allowed("help.example.org") == 200
    assert allowed("nope.collaborators.community") == 404
    assert allowed("a.b.collaborators.community") == 404
    assert allowed("evil.example.com") == 404
