"""
Tests for joining without an invitation: workspaces open to a verified email
domain, join links, what signing in records, and email invitations off.
"""

import pytest
from rest_framework.test import APIClient

from core import factories, models
from core.authentication.backends import OIDCAuthenticationBackend
from core.choices import WorkspaceRoleChoices
from core.joining import join_by_domain

pytestmark = pytest.mark.django_db


def client_for(user=None):
    """An API client, logged in as the user if one is given."""
    client = APIClient()
    if user:
        client.force_login(user)
    return client


def workspace_with_admin(email="ada@acme.org", verified=True):
    """A workspace owned by an admin with the given email."""
    admin = factories.UserFactory(email=email, collaborator_email_verified=verified)
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=admin, role=WorkspaceRoleChoices.OWNER
    )
    return workspace, admin


# -- Joining by domain


def test_join_by_domain_needs_a_verified_email_at_the_domain():
    """Verified emails at the domain join, with the organisation group."""
    workspace, _admin = workspace_with_admin()
    group = models.Group.objects.create(
        workspace=workspace, name="Acme staff", kind="organization"
    )
    workspace.join_domains = ["acme.org"]
    workspace.join_group = group
    workspace.save()
    verified = factories.UserFactory(
        email="bo@acme.org", collaborator_email_verified=True
    )
    unverified = factories.UserFactory(
        email="cy@acme.org", collaborator_email_verified=False
    )
    elsewhere = factories.UserFactory(
        email="di@other.org", collaborator_email_verified=True
    )

    assert join_by_domain(verified) == [workspace]
    assert join_by_domain(verified) == []  # already a member
    assert join_by_domain(unverified) == []
    assert join_by_domain(elsewhere) == []

    assert workspace.get_role(verified) == WorkspaceRoleChoices.MEMBER
    assert group.memberships.filter(user=verified).exists()
    assert workspace.get_role(unverified) is None


def test_signing_in_records_the_verified_email_and_joins():
    """The identity provider's email_verified claim is kept, then used."""
    workspace, _admin = workspace_with_admin()
    workspace.join_domains = ["acme.org"]
    workspace.save()
    user = factories.UserFactory(email="bo@acme.org")
    backend = OIDCAuthenticationBackend()

    backend.collaborators_user_info = {"email_verified": True}
    backend.collaborators_after_sign_in(user)

    user.refresh_from_db()
    assert user.collaborator_email_verified is True
    assert workspace.get_role(user) == WorkspaceRoleChoices.MEMBER

    backend.collaborators_user_info = {}
    backend.collaborators_after_sign_in(user)
    user.refresh_from_db()
    assert user.collaborator_email_verified is False


def test_admins_open_their_own_domain_only():
    """An admin opens the domain of their verified email, nothing else."""
    workspace, admin = workspace_with_admin()
    url = f"/api/v1.0/workspaces/{workspace.id}/"

    response = client_for(admin).patch(
        url, {"join_domains": ["Acme.org", "@acme.org"]}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["join_domains"] == ["acme.org"]

    for domains in (["gmail.com"], ["other.org"], ["not a domain"]):
        response = client_for(admin).patch(
            url, {"join_domains": domains}, format="json"
        )
        assert response.status_code == 400, domains


def test_unverified_admins_and_members_cant_open_domains():
    """An unverified email proves nothing; members can't change it."""
    workspace, admin = workspace_with_admin(verified=False)
    member = factories.UserFactory(
        email="bo@acme.org", collaborator_email_verified=True
    )
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    url = f"/api/v1.0/workspaces/{workspace.id}/"

    assert (
        client_for(admin)
        .patch(url, {"join_domains": ["acme.org"]}, format="json")
        .status_code
        == 400
    )
    assert (
        client_for(member)
        .patch(url, {"join_domains": ["acme.org"]}, format="json")
        .status_code
        == 403
    )


def test_join_group_must_be_of_the_workspace():
    """The organisation group comes from the workspace itself."""
    workspace, admin = workspace_with_admin()
    other, _ = workspace_with_admin(email="ed@else.org")
    foreign = models.Group.objects.create(workspace=other, name="Else")

    response = client_for(admin).patch(
        f"/api/v1.0/workspaces/{workspace.id}/",
        {"join_group": str(foreign.id)},
        format="json",
    )

    assert response.status_code == 400


# -- Join links


def test_join_link_lifecycle():
    """Admins turn a link on; anyone sees where it leads; signed in, they join."""
    workspace, admin = workspace_with_admin()
    member = factories.UserFactory()
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    newcomer = factories.UserFactory()
    link_url = f"/api/v1.0/workspaces/{workspace.id}/join-link/"

    assert client_for(member).post(link_url).status_code == 403
    token = client_for(admin).post(link_url).json()["join_token"]
    assert token

    # Only admins see the secret
    members_view = client_for(member).get("/api/v1.0/workspaces/").json()
    assert members_view[0]["join_token"] is None

    preview = client_for().get(f"/api/v1.0/join/{token}/").json()
    assert preview["name"] == "Acme"
    assert preview["is_member"] is False
    assert client_for().post(f"/api/v1.0/join/{token}/").status_code == 401

    joined = client_for(newcomer).post(f"/api/v1.0/join/{token}/").json()
    assert joined["is_member"] is True
    assert workspace.get_role(newcomer) == WorkspaceRoleChoices.MEMBER

    client_for(admin).delete(link_url)
    assert client_for().get(f"/api/v1.0/join/{token}/").status_code == 404


# -- Email invitations


def test_email_invitations_are_off():
    """Documents are shared with people who have an account, not by email."""
    owner = factories.UserFactory()
    document = factories.DocumentFactory(users=[(owner, "owner")])

    response = client_for(owner).post(
        f"/api/v1.0/documents/{document.id}/invitations/",
        {"email": "new@example.com", "role": "reader"},
        format="json",
    )

    assert response.status_code == 403
    assert not models.Invitation.objects.exists()
