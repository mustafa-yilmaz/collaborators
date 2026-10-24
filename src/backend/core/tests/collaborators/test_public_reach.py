"""
Tests for what is public, and to whom: nothing of a page, a space or a hidden
workspace reaches those who may not see it (titles, names, files), and what
is public reaches everyone it should.
"""

from io import BytesIO
from uuid import uuid4

from django.core.files.storage import default_storage

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import publishing
from core.choices import WorkspaceRoleChoices, WorkspaceVisibilityChoices
from core.enums import DocumentAttachmentStatus

pytestmark = pytest.mark.django_db


def client_for(user=None):
    """An API client, logged in as the user if one is given."""
    client = APIClient()
    if user:
        client.force_login(user)
    return client


def fresh(user):
    """Reload a user so its cached teams are recomputed."""
    return models.User.objects.get(pk=user.pk)


def workspace_of(space, owner, **kwargs):
    """A workspace, home of the space, owned by `owner`."""
    workspace = models.Workspace.objects.create(name="Secret Lab", **kwargs)
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    models.SpaceWorkspaceLink.objects.create(
        space=space, workspace=workspace, is_home=True
    )
    return workspace


def public_space(owner, **kwargs):
    """A public space, readable signed out."""
    return factories.DocumentFactory(
        users=[(owner, "owner")],
        kind="space",
        title="Handbook",
        link_reach="public",
        link_role="reader",
        **kwargs,
    )


def stored_file(document):
    """A file attached to the document, ready to be served."""
    key = f"{document.id!s}/attachments/{uuid4()!s}.png"
    default_storage.connection.meta.client.put_object(
        Bucket=default_storage.bucket_name,
        Key=key,
        Body=BytesIO(b"pixels"),
        ContentType="image/png",
        Metadata={"status": DocumentAttachmentStatus.READY},
    )
    document.attachments = [*document.attachments, key]
    document.save()
    return key


def media_auth(key, user=None):
    """Whether the user may load the file (the web server asks this)."""
    return (
        client_for(user)
        .get(
            "/api/v1.0/documents/media-auth/",
            HTTP_X_ORIGINAL_URL=f"http://localhost/media/{key}",
        )
        .status_code
    )


# -- Files


def test_files_of_pages_kept_private_stay_private():
    """A public space's files are public; those of a page kept private aren't."""
    owner = factories.UserFactory()
    space = public_space(owner)
    page = factories.DocumentFactory(parent=space, link_reach="restricted")
    private = factories.DocumentFactory(
        parent=space, link_reach="restricted", keep_private=True
    )
    below = factories.DocumentFactory(parent=private, link_reach="restricted")

    assert media_auth(stored_file(page)) == 200
    for document in (private, below):
        key = stored_file(document)
        assert media_auth(key) == 403
        assert media_auth(key, factories.UserFactory()) == 403
        # Roles still reach it
        assert media_auth(key, owner) == 200


def test_a_wiki_logo_is_only_the_spaces_own_file():
    """A logo can't lead elsewhere ("../"), nor make another page's file public."""
    owner = factories.UserFactory()
    space = public_space(owner)
    other = factories.DocumentFactory(link_reach="restricted")
    key = stored_file(other)
    tricky = f"http://localhost/media/{space.id}/attachments/../../{key}"

    response = client_for(owner).put(
        f"/api/v1.0/spaces/{space.id}/wiki/",
        {"slug": "handbook", "logo": tricky},
        format="json",
    )
    assert response.status_code == 400
    # Even saved as such (before the check), it opens nothing
    space.wiki_slug, space.wiki_logo = "handbook", tricky
    space.save()
    assert publishing.is_wiki_file(key) is False
    assert media_auth(key) == 403

    own = f"http://localhost/media/{space.id}/attachments/logo.png"
    response = client_for(owner).put(
        f"/api/v1.0/spaces/{space.id}/wiki/",
        {"slug": "handbook", "logo": own},
        format="json",
    )
    assert response.status_code == 200
    assert publishing.is_wiki_file(f"{space.id}/attachments/logo.png")


# -- Hidden workspaces


def test_a_hidden_workspace_stays_unnamed(settings):
    """Its public space, its wiki and its address don't tell its name."""
    settings.COLLABORATORS_WIKI_BASE_DOMAIN = "collaborators.community"
    settings.COLLABORATORS_APP_HOSTS = ["collaborators.community"]
    owner, outsider = factories.UserFactory(), factories.UserFactory()
    space = public_space(owner)
    workspace = workspace_of(space, owner, slug="secret-lab")
    url = f"/api/v1.0/documents/{space.id}/"

    for user in (None, outsider):
        assert client_for(user).get(url).json()["home_workspace"] is None
    assert client_for(owner).get(url).json()["home_workspace"]["name"] == "Secret Lab"
    listed = client_for(outsider).get(f"/api/v1.0/spaces/{space.id}/").json()
    assert listed["linked_workspaces"] == []

    # Its address, while it publishes no wiki: not there at all
    host = "/api/v1.0/wiki-hosts/secret-lab.collaborators.community/"
    tls = "/api/v1.0/tls-allowed/?domain=secret-lab.collaborators.community"
    assert client_for().get(host).status_code == 404
    assert client_for().get(tls).status_code == 404

    # Publishing a wiki there: the wikis show, the name doesn't
    space.wiki_slug = "handbook"
    space.save()
    response = client_for().get(host).json()
    assert response["workspace"]["name"] is None
    assert [wiki["slug"] for wiki in response["wikis"]] == ["handbook"]
    assert client_for().get(tls).status_code == 200
    wiki = client_for().get("/api/v1.0/wiki/handbook/").json()
    assert wiki["workspace"] is None
    assert wiki["workspace_slug"] is None
    publication = client_for().get(f"/api/v1.0/documents/{space.id}/publication/")
    assert publication.json()["wiki"]["workspace_slug"] is None

    # Findable, it is named
    workspace.visibility = WorkspaceVisibilityChoices.PUBLIC
    workspace.save()
    assert client_for().get(url).json()["home_workspace"]["name"] == "Secret Lab"
    assert client_for().get(host).json()["workspace"]["name"] == "Secret Lab"
    assert client_for().get("/api/v1.0/wiki/handbook/").json()["workspace"] == (
        "Secret Lab"
    )


# -- Linked pages


def test_a_space_in_the_trashbin_links_nothing():
    """Its members no longer read the pages linked into it."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    home = factories.DocumentFactory(
        kind="space", link_reach="restricted", users=[(owner, "owner")]
    )
    page = factories.DocumentFactory(parent=home, link_reach="restricted")
    linking = factories.DocumentFactory(
        kind="space", link_reach="restricted", users=[(member, "reader")]
    )
    models.PageSpaceLink.objects.create(page=page, space=linking)
    url = f"/api/v1.0/documents/{page.id}/"
    assert client_for(fresh(member)).get(url).status_code == 200

    linking.soft_delete()
    assert client_for(fresh(member)).get(url).status_code == 403


def test_pages_kept_private_below_a_linked_page_are_listed_to_its_readers():
    """What a linking space's members may open, they also see in the tree."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    home = factories.DocumentFactory(
        kind="space", link_reach="restricted", users=[(owner, "owner")]
    )
    page = factories.DocumentFactory(parent=home, link_reach="restricted")
    private = factories.DocumentFactory(
        parent=page, link_reach="restricted", keep_private=True
    )
    linking = factories.DocumentFactory(
        kind="space", link_reach="restricted", users=[(member, "reader")]
    )
    models.PageSpaceLink.objects.create(page=page, space=linking)
    member = fresh(member)

    assert client_for(member).get(f"/api/v1.0/documents/{private.id}/").status_code == (
        200
    )
    children = client_for(member).get(f"/api/v1.0/documents/{page.id}/children/")
    assert [child["id"] for child in children.json()["results"]] == [str(private.id)]


def test_linked_pages_name_their_home_only_to_its_readers():
    """A linked page's home space is named to those who can open it."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    home = factories.DocumentFactory(
        kind="space",
        title="Board",
        link_reach="restricted",
        users=[(owner, "owner")],
    )
    page = factories.DocumentFactory(parent=home, title="Minutes")
    linking = factories.DocumentFactory(
        kind="space",
        link_reach="restricted",
        users=[(owner, "owner"), (member, "reader")],
    )
    models.PageSpaceLink.objects.create(page=page, space=linking)
    url = f"/api/v1.0/spaces/{linking.id}/linked-pages/"

    assert client_for(fresh(member)).get(url).json()[0]["home"] is None
    assert client_for(owner).get(url).json()[0]["home"]["title"] == "Board"


# -- Titles and labels


def test_search_doesnt_name_a_private_space_holding_a_public_page():
    """A public page of a private space is found, without its space's title."""
    owner, other = factories.UserFactory(), factories.UserFactory()
    space = factories.DocumentFactory(
        kind="space",
        title="Mergers",
        link_reach="restricted",
        users=[(owner, "owner")],
    )
    factories.DocumentFactory(
        parent=space, title="Press release", link_reach="authenticated"
    )

    pages = (
        client_for(other).get("/api/v1.0/search/?q=press").json()["visible"]["pages"]
    )
    assert [(page["title"], page["context"]) for page in pages] == [
        ("Press release", "")
    ]
    pages = (
        client_for(owner).get("/api/v1.0/search/?q=press").json()["involved"]["pages"]
    )
    assert pages[0]["context"] == "Mergers"


def test_labels_to_pick_from_are_those_of_what_one_can_see():
    """A label used only on private pages isn't suggested to others."""
    owner, other = factories.UserFactory(), factories.UserFactory()
    private = factories.DocumentFactory(
        link_reach="restricted", users=[(owner, "owner")]
    )
    public = factories.DocumentFactory(link_reach="authenticated")
    secret = models.Label.get_or_create_named("Acquisition", owner)
    shared = models.Label.get_or_create_named("Acoustics", owner)
    models.DocumentLabel.objects.create(document=private, label=secret)
    models.DocumentLabel.objects.create(document=public, label=shared)

    def names(user):
        response = client_for(user).get("/api/v1.0/labels/?q=ac")
        return [label["name"] for label in response.json()]

    assert names(other) == ["Acoustics"]
    assert sorted(names(owner)) == ["Acoustics", "Acquisition"]


def test_starred_pages_leave_once_they_cant_be_opened():
    """A page starred, then closed to the user, is no longer listed."""
    owner, reader = factories.UserFactory(), factories.UserFactory()
    page = factories.DocumentFactory(
        title="Plans", link_reach="restricted", users=[(owner, "owner")]
    )
    access = models.DocumentAccess.objects.create(
        document=page, user=reader, role="reader"
    )
    models.DocumentFavorite.objects.create(document=page, user=reader)

    def starred():
        response = client_for(fresh(reader)).get(
            "/api/v1.0/collaborations/?view=starred"
        )
        return [item["title"] for item in response.json()["pages"]]

    assert starred() == ["Plans"]
    access.delete()
    assert starred() == []
    page.link_reach = "authenticated"
    page.save()
    assert starred() == ["Plans"]


def test_unknown_logo_ids_are_refused_quietly():
    """A file address that names no document opens nothing."""
    assert publishing.is_wiki_file(f"not-an-id/attachments/{uuid4()}.png") is False


# -- Settings that kept or removed access quietly


def team(kind, workspace):
    """A workspace's team string."""
    return models.make_team(kind, workspace.id)


def visibility(user, document, **data):
    """Read, or change when data is given, who can see the document."""
    url = f"/api/v1.0/documents/{document.id}/visibility/"
    if not data:
        return client_for(user).get(url)
    return client_for(user).put(url, data, format="json")


def test_a_page_placed_in_a_workspace_keeps_its_members():
    """Its members can't be shut out from "Who can see this?"."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme")
    for user in (owner, member):
        models.WorkspaceAccess.objects.create(workspace=workspace, user=user)
    page = factories.DocumentFactory(users=[(owner, "owner")], link_reach="restricted")
    response = client_for(owner).post(
        f"/api/v1.0/documents/{page.id}/move-to-workspace/",
        {"workspace_id": str(workspace.id)},
        format="json",
    )
    assert response.status_code == 200
    members = team(models.TEAM_WORKSPACE, workspace)

    state = visibility(owner, page).json()
    assert state["value"] == members
    assert "invited" not in state["options"]
    assert visibility(owner, page, value="invited").status_code == 400

    assert visibility(owner, page, value="public").status_code == 200
    assert visibility(owner, page, value=members).status_code == 200
    assert page.accesses.filter(team=members).exists()
    response = client_for(fresh(member)).get(f"/api/v1.0/documents/{page.id}/")
    assert response.status_code == 200


def test_a_spaces_setting_leaves_other_workspaces_grants_alone():
    """Choosing its home's members keeps what a sharing workspace granted."""
    owner = factories.UserFactory()
    space = factories.DocumentFactory(
        kind="space", link_reach="restricted", users=[(owner, "owner")]
    )
    home = workspace_of(space, owner)
    partner = models.Workspace.objects.create(name="Partner")
    models.SpaceWorkspaceLink.objects.create(space=space, workspace=partner)
    models.DocumentAccess.objects.create(
        document=space, team=team(models.TEAM_WORKSPACE, partner), role="reader"
    )

    response = visibility(owner, space, value=team(models.TEAM_WORKSPACE, home))
    assert response.status_code == 200
    teams = set(space.accesses.values_list("team", flat=True))
    assert team(models.TEAM_WORKSPACE, partner) in teams
    assert team(models.TEAM_WORKSPACE, home) in teams
    # Narrowed again, the home's members go, the partner's stay
    assert visibility(owner, space, value="invited").status_code == 200
    teams = set(space.accesses.values_list("team", flat=True))
    assert team(models.TEAM_WORKSPACE, home) not in teams
    assert team(models.TEAM_WORKSPACE, partner) in teams


def test_a_live_wiki_stays_public_and_read_only():
    """Neither setting makes it editable by anyone, nor empties it."""
    owner = factories.UserFactory()
    space = public_space(owner, wiki_slug="handbook")

    response = visibility(owner, space, value="public", link_role="editor")
    assert response.status_code == 400
    url = f"/api/v1.0/documents/{space.id}/link-configuration/"
    for data in (
        {"link_reach": "restricted"},
        {"link_reach": "public", "link_role": "editor"},
    ):
        response = client_for(owner).put(url, data, format="json")
        assert response.status_code == 400
    space.refresh_from_db()
    assert (space.link_reach, space.link_role) == ("public", "reader")
    assert client_for().get("/api/v1.0/wiki/handbook/").status_code == 200


# -- Leaving a workspace, moving


def test_leaving_a_workspace_takes_its_roles_below_too():
    """Made independent, or unshared, no role a workspace gave stays inside."""
    owner = factories.UserFactory()
    space = factories.DocumentFactory(
        kind="space", link_reach="restricted", users=[(owner, "owner")]
    )
    home = workspace_of(space, owner)
    partner = models.Workspace.objects.create(name="Partner")
    models.WorkspaceAccess.objects.create(
        workspace=partner, user=owner, role=WorkspaceRoleChoices.ADMIN
    )
    models.SpaceWorkspaceLink.objects.create(space=space, workspace=partner)
    group = models.Group.objects.create(workspace=home, name="Board")
    page = factories.DocumentFactory(parent=space, link_reach="restricted")
    below = factories.DocumentFactory(parent=page, link_reach="restricted")
    models.DocumentAccess.objects.create(
        document=page, team=team(models.TEAM_WORKSPACE, partner), role="reader"
    )
    models.DocumentAccess.objects.create(
        document=below, team=team(models.TEAM_WORKSPACE, home), role="reader"
    )
    models.DocumentAccess.objects.create(document=below, team=group.team)

    response = client_for(owner).delete(
        f"/api/v1.0/spaces/{space.id}/links/",
        {"workspace_id": str(partner.id)},
        format="json",
    )
    assert response.status_code == 204
    assert not page.accesses.filter(team__isnull=False).exists()
    assert below.accesses.count() == 2

    response = client_for(owner).post(f"/api/v1.0/spaces/{space.id}/make-independent/")
    assert response.status_code == 200
    assert not models.DocumentAccess.objects.filter(
        document__path__startswith=space.path, team__startswith="workspace"
    ).exists()
    assert not below.accesses.exists()


def test_a_placed_page_moved_under_another_leaves_its_workspace():
    """Under another page it follows that page; on top it keeps its members."""
    owner = factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    page = factories.DocumentFactory(users=[(owner, "owner")])
    client_for(owner).post(
        f"/api/v1.0/documents/{page.id}/move-to-workspace/",
        {"workspace_id": str(workspace.id)},
        format="json",
    )
    other = factories.DocumentFactory(users=[(owner, "owner")])

    # Reordered among top pages, it stays in the workspace, with its members
    response = client_for(owner).post(
        f"/api/v1.0/documents/{page.id}/move/",
        {"target_document_id": str(other.id), "position": "left"},
        format="json",
    )
    assert response.status_code == 200
    assert page.workspace_links.exists()
    assert page.accesses.filter(team=team(models.TEAM_WORKSPACE, workspace)).exists()

    response = client_for(owner).post(
        f"/api/v1.0/documents/{page.id}/move/",
        {"target_document_id": str(other.id), "position": "last-child"},
        format="json",
    )
    assert response.status_code == 200
    assert not page.workspace_links.exists()
    assert not page.accesses.filter(team__startswith="workspace").exists()


def test_moving_public_pages_into_a_workspace_follows_its_policy():
    """Only its administrators publish: others can't bring public pages in."""
    member, admin = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(
        name="Acme", publishing_policy="workspace_admins"
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=admin, role=WorkspaceRoleChoices.ADMIN
    )

    for user in (member, admin):
        space = public_space(user)
        response = client_for(user).post(
            f"/api/v1.0/spaces/{space.id}/move-to-workspace/",
            {"workspace_id": str(workspace.id)},
            format="json",
        )
        assert response.status_code == (403 if user == member else 200)

        page = factories.DocumentFactory(
            users=[(user, "owner")], link_reach="restricted"
        )
        factories.DocumentFactory(parent=page, link_reach="public")
        response = client_for(user).post(
            f"/api/v1.0/documents/{page.id}/move-to-workspace/",
            {"workspace_id": str(workspace.id)},
            format="json",
        )
        assert response.status_code == (403 if user == member else 200)


# -- Pages linked into a public space


def linked_into(space):
    """A page of a private space, with a page below and one kept private."""
    owner = factories.UserFactory()
    home = factories.DocumentFactory(
        kind="space", title="Board", link_reach="restricted", users=[(owner, "owner")]
    )
    page = factories.DocumentFactory(
        parent=home, title="Minutes", link_reach="restricted"
    )
    below = factories.DocumentFactory(
        parent=page, title="March", link_reach="restricted"
    )
    private = factories.DocumentFactory(
        parent=page, title="Pay", link_reach="restricted", keep_private=True
    )
    models.PageSpaceLink.objects.create(page=page, space=space)
    return home, page, below, private


def opens(document, user=None):
    """Whether the user can open the document."""
    return (
        client_for(user).get(f"/api/v1.0/documents/{document.id}/").status_code == 200
    )


def test_a_page_linked_into_a_public_space_is_public_through_it():
    """It and its pages are public, down to a page kept private; not its home."""
    space = public_space(factories.UserFactory())
    home, page, below, private = linked_into(space)

    for user in (None, factories.UserFactory()):
        assert opens(page, user) and opens(below, user)
        assert not opens(private, user)
        assert not opens(home, user)
    response = client_for().get(f"/api/v1.0/spaces/{space.id}/linked-pages/")
    assert response.status_code == 200
    assert [link["page"]["title"] for link in response.json()] == ["Minutes"]
    children = client_for().get(f"/api/v1.0/documents/{page.id}/children/")
    assert [child["title"] for child in children.json()["results"]] == ["March"]
    assert media_auth(stored_file(below)) == 200
    assert media_auth(stored_file(private)) == 403
    # Read-only, as the space's link
    response = client_for().get(f"/api/v1.0/documents/{page.id}/").json()
    assert response["abilities"]["update"] is False


def test_a_page_linked_into_a_space_open_to_everyone_signed_in():
    """Signed in, anyone reads it; signed out, nobody."""
    space = factories.DocumentFactory(kind="space", link_reach="authenticated")
    _home, page, below, _private = linked_into(space)

    assert not opens(page) and not opens(below)
    assert opens(page, factories.UserFactory())
    assert opens(below, factories.UserFactory())


def test_a_linked_page_stops_being_public_with_its_space():
    """Closed, trashed or unlinked, the space no longer opens the page."""
    space = public_space(factories.UserFactory())
    _home, page, _below, _private = linked_into(space)
    assert opens(page)

    space.link_reach = "restricted"
    space.save()
    assert not opens(page)
    space.link_reach = "public"
    space.save()
    assert opens(page)

    space.soft_delete()
    assert not opens(page)
    space.restore()
    assert opens(page)

    models.PageSpaceLink.objects.filter(page=page).delete()
    assert not opens(page)
