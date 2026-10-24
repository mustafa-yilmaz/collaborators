"""
Tests for the wiki extras: full-text search, a fixed version (release), a
logo, a domain of its own, and wiki addresses.
"""

import base64
from unittest import mock

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.api import publishing
from core.choices import WorkspaceRoleChoices
from core.services.yhub_services import YHubService
from core.tasks import wiki as wiki_tasks

pytestmark = pytest.mark.django_db

TEXTS = {
    "Handbook": "Start here.",
    "Welcome": "Our holiday policy gives everyone thirty days off each year.",
    "Salaries": "Confidential pay grid.",
}


@pytest.fixture(autouse=True)
def collaboration_server():
    """The content of a page is its text, as bytes; read as text again."""
    with (
        mock.patch.object(
            YHubService,
            "get_ydoc",
            autospec=True,
            side_effect=lambda _self, document: TEXTS.get(document.title, "").encode(),
        ),
        mock.patch.object(wiki_tasks, "yjs_to_text", lambda update: update.decode()),
        mock.patch.object(publishing, "yjs_to_text", lambda update: update.decode()),
    ):
        yield


def client_for(user=None):
    """An API client, logged in as the user if one is given."""
    client = APIClient()
    if user:
        client.force_login(user)
    return client


def published_wiki(owner, slug="handbook"):
    """A space published as a wiki, with a page and a page kept private."""
    space = factories.DocumentFactory(
        users=[(owner, "owner")], kind="space", title="Handbook"
    )
    page = factories.DocumentFactory(
        parent=space, title="Welcome", link_reach="restricted"
    )
    private = factories.DocumentFactory(
        parent=space, title="Salaries", link_reach="restricted", keep_private=True
    )
    response = client_for(owner).put(
        f"/api/v1.0/spaces/{space.id}/wiki/", {"slug": slug}, format="json"
    )
    assert response.status_code == 200
    return space, page, private


# -- Full-text search


def test_wiki_search_reads_the_text_of_pages():
    """Words of a page's text find it, with the words around; not private ones."""
    owner = factories.UserFactory()
    _space, page, _private = published_wiki(owner)

    results = client_for().get("/api/v1.0/wiki/handbook/search/?q=hóliday").json()

    assert [result["id"] for result in results] == [str(page.id)]
    assert "holiday policy" in results[0]["snippet"]
    # A page kept private is never found, by its title or its text
    assert client_for().get("/api/v1.0/wiki/handbook/search/?q=pay").json() == []
    assert client_for().get("/api/v1.0/wiki/handbook/search/?q=salar").json() == []
    # Too short to search
    assert client_for().get("/api/v1.0/wiki/handbook/search/?q=o").json() == []


def test_wiki_search_lists_title_matches_first():
    """A page named after the words comes before pages that only mention them."""
    owner = factories.UserFactory()
    space, page, _private = published_wiki(owner)
    TEXTS["Handbook"] = "See the Welcome page."
    try:
        results = client_for().get("/api/v1.0/wiki/handbook/search/?q=welcome").json()
    finally:
        TEXTS["Handbook"] = "Start here."

    assert [result["id"] for result in results] == [str(page.id), str(space.id)]


def test_wiki_pages_text_is_kept_when_they_change():
    """The text is read again only for the pages of a published wiki."""
    owner = factories.UserFactory()
    _space, page, _private = published_wiki(owner)
    other = factories.DocumentFactory(users=[(owner, "owner")])

    assert wiki_tasks.is_in_published_wiki(page.id)
    assert not wiki_tasks.is_in_published_wiki(other.id)

    wiki_tasks.refresh_text(page)
    page.refresh_from_db()
    assert page.text_content == TEXTS["Welcome"]
    assert page.text_updated_at is not None


# -- A fixed version


def test_publish_a_fixed_version():
    """Readers see the pages as they were; the live pages stop being public."""
    owner = factories.UserFactory()
    space, page, _private = published_wiki(owner)
    page.attachments = [f"{page.id}/attachments/image.png"]
    page.save()

    response = client_for(owner).post(f"/api/v1.0/spaces/{space.id}/wiki/release/")
    assert response.status_code == 201

    space.refresh_from_db()
    assert space.link_reach == "restricted"
    # The live page is not public any more...
    assert client_for().get(f"/api/v1.0/documents/{page.id}/").status_code == 401
    # ...edits made from now on don't show in the wiki
    page.title = "Welcome (draft)"
    page.save()

    wiki = client_for().get("/api/v1.0/wiki/handbook/").json()
    assert wiki["released_at"] is not None
    assert wiki["tree"] == [{"id": str(page.id), "title": "Welcome", "children": []}]

    copy = client_for().get(f"/api/v1.0/wiki/handbook/pages/{page.id}/").json()
    assert copy["title"] == "Welcome"
    assert base64.b64decode(copy["content"]).decode() == TEXTS["Welcome"]
    results = client_for().get("/api/v1.0/wiki/handbook/search/?q=holiday").json()
    assert [result["title"] for result in results] == ["Welcome"]

    # Its images may be loaded by anyone
    assert publishing.is_wiki_file(f"{page.id}/attachments/image.png")
    assert not publishing.is_wiki_file(f"{page.id}/attachments/other.png")

    # Live again: the pages are public again
    response = client_for(owner).delete(f"/api/v1.0/spaces/{space.id}/wiki/release/")
    assert response.status_code == 204
    space.refresh_from_db()
    assert space.link_reach == "public"
    assert client_for().get("/api/v1.0/wiki/handbook/").json()["released_at"] is None
    assert (
        client_for().get(f"/api/v1.0/wiki/handbook/pages/{page.id}/").status_code == 404
    )
    actions = list(
        models.PublicationLog.objects.filter(document=space).values_list(
            "action", flat=True
        )
    )
    assert actions[:2] == ["wiki_live", "wiki_released"]


def test_only_the_wiki_publishers_release_it():
    """A reader can't publish a fixed version."""
    owner = factories.UserFactory()
    reader = factories.UserFactory()
    space, _page, _private = published_wiki(owner)
    factories.UserDocumentAccessFactory(document=space, user=reader, role="reader")

    response = client_for(reader).post(f"/api/v1.0/spaces/{space.id}/wiki/release/")

    assert response.status_code == 403


# -- Logo and domain


def test_wiki_logo_is_an_image_of_the_space():
    """The logo comes from the space's files, and anyone may load it."""
    owner = factories.UserFactory()
    space, _page, _private = published_wiki(owner)
    client = client_for(owner)
    logo = f"http://localhost:8083/media/{space.id}/attachments/logo.png"

    elsewhere = client.put(
        f"/api/v1.0/spaces/{space.id}/wiki/",
        {"slug": "handbook", "logo": "https://example.com/logo.png"},
        format="json",
    )
    assert elsewhere.status_code == 400

    response = client.put(
        f"/api/v1.0/spaces/{space.id}/wiki/",
        {"slug": "handbook", "logo": logo},
        format="json",
    )
    assert response.status_code == 200
    assert client_for().get("/api/v1.0/wiki/handbook/").json()["logo"] == logo
    assert publishing.is_wiki_file(f"{space.id}/attachments/logo.png")


def test_wiki_domain_of_its_own(settings):
    """A domain is checked, unique, and leads to its wiki."""
    settings.COLLABORATORS_WIKI_BASE_DOMAIN = "collaborators.community"
    owner = factories.UserFactory()
    space, _page, _private = published_wiki(owner)
    other, *_ = published_wiki(owner, slug="other")
    client = client_for(owner)

    for wrong in ["not a domain", "acme.collaborators.community", "localhost"]:
        response = client.put(
            f"/api/v1.0/spaces/{space.id}/wiki/",
            {"slug": "handbook", "domain": wrong},
            format="json",
        )
        assert response.status_code == 400, wrong

    response = client.put(
        f"/api/v1.0/spaces/{space.id}/wiki/",
        {"slug": "handbook", "domain": "Help.Example.com."},
        format="json",
    )
    assert response.json()["domain"] == "help.example.com"
    taken = client.put(
        f"/api/v1.0/spaces/{other.id}/wiki/",
        {"slug": "other", "domain": "help.example.com"},
        format="json",
    )
    assert taken.status_code == 400

    host = client_for().get("/api/v1.0/wiki-hosts/help.example.com/").json()
    assert host == {"kind": "domain", "slug": "handbook"}
    assert (
        client_for().get("/api/v1.0/wiki-hosts/unknown.example.com/").status_code == 404
    )


def test_wiki_address_of_a_workspace(settings):
    """<workspace>.<base domain> lists the workspace's wikis."""
    settings.COLLABORATORS_WIKI_BASE_DOMAIN = "collaborators.community"
    owner = factories.UserFactory()
    space, _page, _private = published_wiki(owner)
    # Collaborators: findable, so its address shows its name too
    workspace = models.Workspace.objects.create(
        name="Acme", slug="acme", visibility="public"
    )
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=owner, role=WorkspaceRoleChoices.OWNER
    )
    models.SpaceWorkspaceLink.objects.create(
        space=space, workspace=workspace, is_home=True
    )

    host = client_for().get("/api/v1.0/wiki-hosts/acme.collaborators.community/")

    assert host.json() == {
        "kind": "workspace",
        "workspace": {"name": "Acme", "slug": "acme"},
        "wikis": [{"slug": "handbook", "title": "Handbook"}],
    }
    assert (
        client_for().get("/api/v1.0/wiki/handbook/").json()["workspace_slug"] == "acme"
    )
    assert (
        client_for()
        .get("/api/v1.0/wiki-hosts/nobody.collaborators.community/")
        .status_code
        == 404
    )
