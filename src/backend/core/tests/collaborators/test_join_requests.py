"""
Tests for the joining extras: admins approving who joins, and joining by
organisation (a Google Workspace domain, a Microsoft tenant).
"""

import base64
import json
from unittest import mock

import pytest
import responses
from rest_framework.test import APIClient

from core import factories, joining, models
from core.authentication.backends import OIDCAuthenticationBackend
from core.choices import WorkspaceRoleChoices

pytestmark = pytest.mark.django_db

ORG = {"id": "google:acme.org", "name": "acme.org"}


def client_for(user):
    """An API client logged in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def workspace_with_admin(**fields):
    """A workspace owned by an admin."""
    admin = factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Acme", **fields)
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=admin, role=WorkspaceRoleChoices.OWNER
    )
    return workspace, admin


def id_token(claims):
    """An unsigned ID token carrying these claims."""
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=")
    return f"e30.{payload.decode()}.sig"


# -- Admins approve who joins


def test_join_link_asks_the_admins_when_they_approve():
    """With approval on, the link makes a request and notifies the admins."""
    workspace, admin = workspace_with_admin(join_approval=True, join_token="t" * 43)
    newcomer = factories.UserFactory(full_name="Bo")

    response = client_for(newcomer).post(f"/api/v1.0/join/{'t' * 43}/")

    assert response.status_code == 200
    assert response.json()["is_member"] is False
    assert response.json()["request_status"] == "pending"
    notification = models.Notification.objects.get(recipient=admin)
    assert notification.kind == "join_request"
    assert notification.workspace == workspace
    assert notification.actor == newcomer

    # asking again changes nothing
    client_for(newcomer).post(f"/api/v1.0/join/{'t' * 43}/")
    assert models.Notification.objects.filter(recipient=admin).count() == 1

    inbox = client_for(admin).get("/api/v1.0/notifications/").json()
    assert inbox[0]["kind"] == "join_request"
    assert inbox[0]["document"] is None
    assert inbox[0]["workspace"] == {"id": str(workspace.id), "name": "Acme"}


def test_admins_approve_or_decline():
    """Approving lets the person in and tells them; declining is remembered."""
    workspace, admin = workspace_with_admin(join_approval=True)
    group = models.Group.objects.create(workspace=workspace, name="Staff")
    bo, cy = factories.UserFactory(), factories.UserFactory()
    joining.admit(workspace, bo, group)
    joining.admit(workspace, cy)
    url = f"/api/v1.0/workspaces/{workspace.id}/join-requests/"

    listed = client_for(admin).get(url).json()
    assert [item["user"]["id"] for item in listed] == [str(bo.id), str(cy.id)]
    assert (
        client_for(admin)
        .get(f"/api/v1.0/workspaces/{workspace.id}/")
        .json()["pending_join_requests"]
        == 2
    )

    response = client_for(admin).post(f"{url}{listed[0]['id']}/approve/")
    assert response.status_code == 204
    assert workspace.accesses.filter(user=bo).exists()
    assert group.memberships.filter(user=bo).exists()
    assert models.Notification.objects.get(recipient=bo).kind == "join_approved"
    # the request leaves the admins' inbox once answered
    assert not models.Notification.objects.filter(recipient=admin, actor=bo).exists()

    response = client_for(admin).post(f"{url}{listed[1]['id']}/decline/")
    assert response.status_code == 204
    assert not workspace.accesses.filter(user=cy).exists()
    assert joining.request_status(workspace, cy) == "declined"
    assert joining.admit(workspace, cy) is None  # not asked again
    assert client_for(admin).get(url).json() == []


def test_only_admins_see_and_answer_join_requests():
    """Members can't list or answer requests."""
    workspace, _admin = workspace_with_admin(join_approval=True)
    member = factories.UserFactory()
    models.WorkspaceAccess.objects.create(workspace=workspace, user=member)
    joining.admit(workspace, factories.UserFactory())
    join_request = workspace.join_requests.get()
    url = f"/api/v1.0/workspaces/{workspace.id}/join-requests/"

    assert client_for(member).get(url).status_code == 403
    assert (
        client_for(member).post(f"{url}{join_request.id}/approve/").status_code == 403
    )
    detail = client_for(member).get(f"/api/v1.0/workspaces/{workspace.id}/").json()
    assert detail["join_approval"] is False
    assert detail["pending_join_requests"] == 0


def test_domain_joining_waits_for_approval():
    """Approval also holds back joining by email domain."""
    workspace, _admin = workspace_with_admin(
        join_approval=True, join_domains=["acme.org"]
    )
    user = factories.UserFactory(email="bo@acme.org", collaborator_email_verified=True)

    assert joining.join_by_domain(user) == []
    assert workspace.join_requests.get().via == "domain"


# -- Joining by organisation


def test_organizations_from_claims():
    """A Google Workspace domain and a work Microsoft tenant count; personal don't."""
    assert joining.organizations_from_claims("google", {"hd": "Acme.org"}) == [ORG]
    assert joining.organizations_from_claims("google", {"email": "a@gmail.com"}) == []
    assert joining.organizations_from_claims(
        "microsoft", {"tid": "t-1", "preferred_username": "a@contoso.com"}
    ) == [{"id": "microsoft:t-1", "name": "contoso.com"}]
    assert (
        joining.organizations_from_claims(
            "microsoft", {"tid": joining.MICROSOFT_CONSUMERS_TENANT}
        )
        == []
    )


@responses.activate
def test_signing_in_reads_the_organizations_and_joins(settings):
    """The stored Google token gives the Workspace domain; it opens the workspace."""
    settings.COLLABORATORS_KEYCLOAK_URL = "http://keycloak"
    settings.COLLABORATORS_KEYCLOAK_REALM = "impress"
    settings.COLLABORATORS_SIGNIN_PROVIDERS = ["google", "microsoft", "linkedin"]
    responses.get(
        "http://keycloak/realms/impress/broker/google/token",
        json={"access_token": "x", "id_token": id_token({"hd": "acme.org"})},
    )
    responses.get(
        "http://keycloak/realms/impress/broker/microsoft/token",
        status=400,
        json={"errorMessage": "not linked"},
    )
    workspace, _admin = workspace_with_admin(join_organizations=[ORG])
    user = factories.UserFactory()
    backend = OIDCAuthenticationBackend()
    backend.collaborators_user_info = {"email_verified": True}
    backend.collaborators_access_token = "user-token"

    backend.collaborators_after_sign_in(user)

    user.refresh_from_db()
    assert user.collaborator_organizations == [ORG]
    assert workspace.accesses.filter(user=user).exists()
    assert responses.calls[0].request.headers["Authorization"] == "Bearer user-token"


def test_keycloak_errors_keep_the_known_organizations(settings):
    """When Keycloak can't be asked, what was known stays."""
    settings.COLLABORATORS_KEYCLOAK_URL = "http://keycloak"
    settings.COLLABORATORS_KEYCLOAK_REALM = "impress"
    user = factories.UserFactory(collaborator_organizations=[ORG])
    with mock.patch(
        "core.services.keycloak.provider_id_token_claims",
        side_effect=joining.keycloak.KeycloakError,
    ):
        joining.read_organizations(user, "user-token")
    user.refresh_from_db()
    assert user.collaborator_organizations == [ORG]


def test_admins_open_their_own_organizations_only():
    """An admin adds an organisation they signed in with, not another."""
    workspace, admin = workspace_with_admin()
    admin.collaborator_organizations = [ORG]
    admin.save()
    url = f"/api/v1.0/workspaces/{workspace.id}/"

    detail = client_for(admin).get(url).json()
    assert detail["join_organization_choices"] == [ORG]

    response = client_for(admin).patch(
        url, {"join_organizations": ["microsoft:other"]}, format="json"
    )
    assert response.status_code == 400

    response = client_for(admin).patch(
        url, {"join_organizations": ["google:acme.org"]}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["join_organizations"] == [ORG]

    # another admin, of another organisation, keeps it
    other = factories.UserFactory()
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=other, role=WorkspaceRoleChoices.ADMIN
    )
    response = client_for(other).patch(
        url,
        {"join_organizations": ["google:acme.org"], "join_approval": True},
        format="json",
    )
    assert response.status_code == 200
    workspace.refresh_from_db()
    assert workspace.join_organizations == [ORG]
    assert workspace.join_approval is True
