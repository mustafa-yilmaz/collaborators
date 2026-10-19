"""
Tests for pages moving freely between spaces: linking a page into more
spaces (whose members then read it), making a page or a space independent,
and moving a page into a space.
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


def links_url(page):
    """Where a page's space links are."""
    return f"/api/v1.0/documents/{page.id}/space-links/"


def test_linking_a_page_lets_the_other_space_read_it():
    """Linked into Design, the Engineering page is readable by Design's members."""
    owner, designer = factories.UserFactory(), factories.UserFactory()
    engineering = factories.DocumentFactory(
        kind="space",
        title="Engineering",
        link_reach="restricted",
        users=[(owner, "owner")],
    )
    page = factories.DocumentFactory(
        parent=engineering, title="Roadmap", link_reach="restricted"
    )
    subpage = factories.DocumentFactory(
        parent=page, title="Q4", link_reach="restricted"
    )
    design = factories.DocumentFactory(
        kind="space",
        title="Design",
        link_reach="restricted",
        users=[(owner, "editor"), (designer, "reader")],
    )
    assert client_for(designer).get(f"/api/v1.0/documents/{page.id}/").status_code in (
        401,
        403,
        404,
    )

    response = client_for(owner).post(
        links_url(page), {"space_id": str(design.id)}, format="json"
    )
    assert response.status_code == 201

    designer = fresh(designer)
    for document in (page, subpage):
        response = client_for(designer).get(f"/api/v1.0/documents/{document.id}/")
        assert response.status_code == 200
        assert response.json()["abilities"]["update"] is False
    # it doesn't open the rest of Engineering
    assert (
        client_for(designer).get(f"/api/v1.0/documents/{engineering.id}/").status_code
        != 200
    )

    listed = client_for(designer).get(f"/api/v1.0/spaces/{design.id}/linked-pages/")
    assert listed.json() == [
        {
            "link_id": str(models.PageSpaceLink.objects.get().id),
            "page": {"id": str(page.id), "title": "Roadmap"},
            "home": {"id": str(engineering.id), "title": "Engineering"},
        }
    ]

    detail = client_for(owner).get(links_url(page)).json()
    assert detail["home"] == {"id": str(engineering.id), "title": "Engineering"}
    assert [link["space"]["title"] for link in detail["links"]] == ["Design"]
    assert detail["can_link"] is True


def test_linking_needs_page_rights_and_editing_in_the_space():
    """Readers can't link; nor into a space one can't edit, nor its home."""
    owner, reader = factories.UserFactory(), factories.UserFactory()
    home = factories.DocumentFactory(
        kind="space", users=[(owner, "owner"), (reader, "reader")]
    )
    page = factories.DocumentFactory(parent=home)
    read_only = factories.DocumentFactory(kind="space", users=[(owner, "reader")])
    editable = factories.DocumentFactory(
        kind="space", users=[(owner, "editor"), (reader, "editor")]
    )

    assert (
        client_for(reader)
        .post(links_url(page), {"space_id": str(editable.id)}, format="json")
        .status_code
        == 403
    )
    for space in (read_only, home):
        response = client_for(owner).post(
            links_url(page), {"space_id": str(space.id)}, format="json"
        )
        assert response.status_code == 400


def test_unlinking_by_the_space_admins():
    """An administrator of the linking space can remove the page from it."""
    owner, admin = factories.UserFactory(), factories.UserFactory()
    home = factories.DocumentFactory(kind="space", users=[(owner, "owner")])
    page = factories.DocumentFactory(parent=home)
    other = factories.DocumentFactory(kind="space", users=[(admin, "administrator")])
    link = models.PageSpaceLink.objects.create(page=page, space=other)

    response = client_for(admin).delete(f"{links_url(page)}{link.id}/")

    assert response.status_code == 204
    assert not models.PageSpaceLink.objects.exists()


def test_making_a_page_independent():
    """It leaves its space with its subpages; whoever does it owns it."""
    owner, member = factories.UserFactory(), factories.UserFactory()
    space = factories.DocumentFactory(
        kind="space",
        link_reach="restricted",
        users=[(owner, "owner"), (member, "editor")],
    )
    page = factories.DocumentFactory(
        parent=space, title="Notes", link_reach="restricted"
    )
    subpage = factories.DocumentFactory(parent=page)

    assert (
        client_for(member)
        .post(f"/api/v1.0/documents/{page.id}/make-independent/")
        .status_code
        == 403
    )
    response = client_for(owner).post(
        f"/api/v1.0/documents/{page.id}/make-independent/"
    )

    assert response.status_code == 200
    page.refresh_from_db()
    subpage.refresh_from_db()
    assert page.is_root()
    assert subpage.get_parent() == page
    assert page.get_role(owner) == "owner"
    assert page.get_role(member) is None
    independent = client_for(owner).get("/api/v1.0/documents/?independent=true")
    assert [d["title"] for d in independent.json()["results"]] == ["Notes"]


def test_moving_into_a_space_it_was_linked_into_drops_the_link():
    """Once at home in a space, the page isn't linked there any more."""
    owner = factories.UserFactory()
    space = factories.DocumentFactory(kind="space", users=[(owner, "owner")])
    page = factories.DocumentFactory(users=[(owner, "owner")])
    models.PageSpaceLink.objects.create(page=page, space=space)

    response = client_for(owner).post(
        f"/api/v1.0/documents/{page.id}/move/",
        {"target_document_id": str(space.id), "position": "last-child"},
        format="json",
    )

    assert response.status_code == 200
    page.refresh_from_db()
    assert page.get_parent() == space
    assert not models.PageSpaceLink.objects.exists()


def test_making_a_space_independent():
    """A home admin takes it out of its workspaces and owns it."""
    admin, member = factories.UserFactory(), factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=admin, role=WorkspaceRoleChoices.ADMIN
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    created = client_for(admin).post(
        "/api/v1.0/spaces/",
        {
            "title": "Engineering",
            "workspace_id": str(workspace.id),
            "visibility": "workspace",
        },
        format="json",
    )
    space = models.Document.objects.get(pk=created.json()["id"])
    assert space.get_role(fresh(member)) == "reader"

    response = client_for(fresh(member)).post(
        f"/api/v1.0/spaces/{space.id}/make-independent/"
    )
    assert response.status_code == 403

    response = client_for(fresh(admin)).post(
        f"/api/v1.0/spaces/{space.id}/make-independent/"
    )

    assert response.status_code == 200
    assert not space.workspace_links.exists()
    assert space.get_role(fresh(admin)) == "owner"
    assert space.get_role(fresh(member)) is None
