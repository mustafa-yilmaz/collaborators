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
