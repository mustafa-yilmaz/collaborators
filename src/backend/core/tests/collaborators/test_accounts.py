"""
Collaborators: platform administrators suspend, reinstate and remove
accounts; platform owners block emails (core.accounts).
"""

from io import StringIO
from unittest import mock

from django.core import mail
from django.core.exceptions import SuspiciousOperation
from django.core.management import CommandError, call_command

import pytest
from rest_framework.test import APIClient

from core import accounts, factories, models
from core.authentication.backends import OIDCAuthenticationBackend
from core.services import keycloak

pytestmark = pytest.mark.django_db

PEOPLE = "/api/v1.0/platform/people/"
BLOCKED = "/api/v1.0/platform/blocked/"


@pytest.fixture(name="sign_in_server")
def fixture_sign_in_server():
    """The sign-in server's admin API, recorded instead of called."""
    with (
        mock.patch.object(keycloak, "is_configured", return_value=True),
        mock.patch.object(keycloak, "set_enabled") as set_enabled,
        mock.patch.object(keycloak, "delete_user") as delete_user,
        # Accounts there are found by email: "kc:<email>"
        mock.patch.object(
            keycloak, "find_user_id", side_effect=lambda email: f"kc:{email}"
        ) as find,
    ):
        yield mock.Mock(set_enabled=set_enabled, delete_user=delete_user, find=find)


def _client(user):
    client = APIClient()
    client.force_login(user)
    return client


def _administrator():
    return factories.UserFactory(platform_role="administrator", full_name="Ada")


def _owner():
    return factories.UserFactory(is_superuser=True, full_name="Olga")


def _protected_owner():
    return factories.UserFactory(
        platform_role="owner",
        is_superuser=True,
        platform_protected=True,
        full_name="Pia",
    )


def test_one_acts_only_below_ones_level():
    """Administrators act on managers and collaborators; owners also on them."""
    owner = _owner()
    administrator = _administrator()
    manager = factories.UserFactory(platform_role="manager")
    collaborator = factories.UserFactory()

    assert accounts.can_manage(administrator, manager)
    assert accounts.can_manage(administrator, collaborator)
    assert not accounts.can_manage(administrator, administrator)
    assert not accounts.can_manage(administrator, owner)
    assert accounts.can_manage(owner, administrator)
    assert not accounts.can_manage(owner, _owner())
    assert not accounts.can_manage(manager, collaborator)


@pytest.mark.usefixtures("sign_in_server")
def test_only_administrators_and_owners_act_on_accounts():
    """A manager may not; nobody acts on their own level or on themselves."""
    administrator = _administrator()
    collaborator = factories.UserFactory()
    other_administrator = _administrator()
    manager = factories.UserFactory(platform_role="manager")

    url = f"{PEOPLE}{collaborator.id}/suspend/"
    assert _client(manager).post(url).status_code == 403
    assert (
        _client(administrator)
        .post(f"{PEOPLE}{other_administrator.id}/suspend/")
        .status_code
        == 403
    )
    assert (
        _client(administrator).post(f"{PEOPLE}{administrator.id}/suspend/").status_code
        == 403
    )
    assert APIClient().post(url).status_code == 401


def test_suspending_signs_them_out_everywhere(sign_in_server):
    """Inactive here, disabled there (each account), logged and told."""
    administrator = _administrator()
    # Their sub is their email, as on collaborators.community
    target = factories.UserFactory(
        email="tom@example.org", sub="tom@example.org", full_name="Tom"
    )
    models.SignInIdentity.objects.create(
        user=target, provider="google", sub="g-2", account="Tom.Work@example.org"
    )
    target_client = _client(target)
    assert target_client.get("/api/v1.0/users/me/").status_code == 200

    response = _client(administrator).post(
        f"{PEOPLE}{target.id}/suspend/", {"reason": "Spam"}, format="json"
    )

    assert response.status_code == 200
    assert response.json() == {"sign_in_server": "done"}
    target.refresh_from_db()
    assert not target.is_active and target.suspended_at
    assert sign_in_server.set_enabled.call_args_list == [
        mock.call("kc:tom@example.org", False),
        mock.call("kc:tom.work@example.org", False),
    ]
    # Their session no longer counts
    assert target_client.get("/api/v1.0/users/me/").status_code == 401
    entry = models.PlatformLog.objects.get(action="suspended")
    assert entry.actor == administrator and entry.target == target
    assert entry.details == {"reason": "Spam", "sign_in_server": "done"}
    assert mail.outbox[-1].to == [target.email]
    assert "Spam" in mail.outbox[-1].body

    again = _client(administrator).post(f"{PEOPLE}{target.id}/suspend/")
    assert again.status_code == 400


def test_reinstating_lets_them_in_again(sign_in_server):
    """Active again, enabled there, logged and told; never while blocked."""
    administrator = _administrator()
    target = factories.UserFactory(email="tom@example.org")
    accounts.suspend(target, administrator)

    response = _client(administrator).post(f"{PEOPLE}{target.id}/reinstate/")

    assert response.status_code == 200
    target.refresh_from_db()
    assert target.is_active and target.suspended_at is None
    sign_in_server.set_enabled.assert_called_with("kc:tom@example.org", True)
    assert models.PlatformLog.objects.filter(action="reinstated").count() == 1

    accounts.suspend(target, administrator)
    models.BlockedEmail.objects.create(email=target.email.lower())
    blocked = _client(administrator).post(f"{PEOPLE}{target.id}/reinstate/")
    assert blocked.status_code == 400
    assert "blocked" in blocked.json()["detail"]


def test_an_account_missing_at_the_sign_in_server_is_nothing_there(sign_in_server):
    """Not found there by email: done here, nothing to change there."""
    sign_in_server.find.side_effect = None
    sign_in_server.find.return_value = None
    target = factories.UserFactory()
    assert accounts.suspend(target, _administrator()) == accounts.NONE
    sign_in_server.set_enabled.assert_not_called()


def test_the_sign_in_server_failing_is_told(sign_in_server):
    """The account is suspended here all the same."""
    sign_in_server.set_enabled.side_effect = keycloak.KeycloakError("down")
    target = factories.UserFactory()
    assert accounts.suspend(target, _administrator()) == accounts.FAILED
    target.refresh_from_db()
    assert target.suspended_at


@pytest.mark.usefixtures("sign_in_server")
def test_the_list_shows_suspended_people_and_what_one_may_do():
    """Suspended people stay listed; can_manage says who one may act on."""
    administrator = _administrator()
    suspended = factories.UserFactory()
    accounts.suspend(suspended, administrator)
    owner = _owner()
    client = _client(administrator)

    results = {item["id"]: item for item in client.get(PEOPLE).json()["results"]}
    assert results[str(suspended.id)]["suspended"] is True
    assert results[str(suspended.id)]["can_manage"] is True
    assert results[str(owner.id)]["can_manage"] is False
    assert results[str(administrator.id)]["can_manage"] is False

    only = client.get(PEOPLE + "?account=suspended").json()["results"]
    assert [item["id"] for item in only] == [str(suspended.id)]
    active = client.get(PEOPLE + "?account=active").json()["results"]
    assert str(suspended.id) not in [item["id"] for item in active]


def _owned_alone(target):
    """A page they alone own with someone else's page below it, and more."""
    page = factories.DocumentFactory(title="Roadmap", users=[(target, "owner")])
    below = factories.DocumentFactory(parent=page, title="Notes")
    shared = factories.DocumentFactory(
        title="Shared", users=[(target, "owner"), (factories.UserFactory(), "owner")]
    )
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=target, role="owner"
    )
    return page, below, shared, workspace


@pytest.mark.usefixtures("sign_in_server")
def test_removal_preview_tells_what_would_be_left_without_owner():
    """The pages and workspaces nobody else owns."""
    administrator = _administrator()
    target = factories.UserFactory()
    page, _below, _shared, workspace = _owned_alone(target)

    preview = _client(administrator).get(f"{PEOPLE}{target.id}/removal/").json()

    assert preview["pages"] == [{"id": str(page.id), "title": "Roadmap"}]
    assert preview["pages_count"] == 1
    assert preview["pages_with_subpages"] == 2
    assert preview["workspaces"] == [{"id": str(workspace.id), "name": "Acme"}]


def test_removing_hands_their_pages_over(sign_in_server):
    """The recipient owns what they owned alone; they are gone, there too."""
    administrator = _administrator()
    recipient = factories.UserFactory(full_name="Rita")
    target = factories.UserFactory(email="tom@example.org", full_name="Tom")
    page, below, shared, workspace = _owned_alone(target)
    email = target.email

    response = _client(administrator).post(
        f"{PEOPLE}{target.id}/remove/",
        {"pages": "hand_over", "recipient": str(recipient.id), "reason": "Left"},
        format="json",
    )

    assert response.status_code == 200
    assert not models.User.objects.filter(id=target.id).exists()
    assert models.DocumentAccess.objects.get(document=page, user=recipient).role == (
        "owner"
    )
    assert models.Document.objects.filter(id=below.id).exists()
    assert models.Document.objects.filter(id=shared.id).exists()
    assert (
        models.WorkspaceAccess.objects.get(workspace=workspace, user=recipient).role
        == "owner"
    )
    sign_in_server.delete_user.assert_called_once_with("kc:tom@example.org")
    entry = models.PlatformLog.objects.get(action="removed")
    assert entry.target is None
    assert entry.target_name == f"Tom <{email}>"
    assert entry.details["pages"] == "hand_over"
    assert entry.details["pages_count"] == 1
    assert entry.details["recipient"] == f"Rita <{recipient.email}>"
    assert entry.details["sign_in_server"] == "done"
    assert mail.outbox[-1].to == [email]


@pytest.mark.usefixtures("sign_in_server")
def test_removing_can_delete_their_pages_but_never_their_workspaces():
    """Their pages go (with what is below); a workspace goes to its admin."""
    administrator = _administrator()
    target = factories.UserFactory()
    page, below, shared, workspace = _owned_alone(target)
    workspace_admin = factories.UserFactory()
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=workspace_admin, role="administrator"
    )

    response = _client(administrator).post(
        f"{PEOPLE}{target.id}/remove/", {"pages": "delete"}, format="json"
    )

    assert response.status_code == 200
    assert not models.Document.objects.filter(id__in=[page.id, below.id]).exists()
    assert models.Document.objects.filter(id=shared.id).exists()
    assert (
        models.WorkspaceAccess.objects.get(
            workspace=workspace, user=workspace_admin
        ).role
        == "owner"
    )


@pytest.mark.usefixtures("sign_in_server")
def test_a_workspace_without_anyone_else_goes_to_whoever_removes():
    """Nobody else in it: the administrator removing them owns it."""
    administrator = _administrator()
    target = factories.UserFactory()
    workspace = models.Workspace.objects.create(name="Solo")
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=target, role="owner"
    )
    accounts.remove(target, administrator, pages=accounts.DELETE)
    assert (
        models.WorkspaceAccess.objects.get(workspace=workspace, user=administrator).role
        == "owner"
    )


@pytest.mark.usefixtures("sign_in_server")
def test_removing_needs_a_recipient_and_blocking_needs_an_owner():
    """No recipient to hand over to; an administrator asking to block."""
    administrator = _administrator()
    target = factories.UserFactory()
    client = _client(administrator)

    no_recipient = client.post(
        f"{PEOPLE}{target.id}/remove/", {"pages": "hand_over"}, format="json"
    )
    assert no_recipient.status_code == 400
    self_recipient = client.post(
        f"{PEOPLE}{target.id}/remove/",
        {"pages": "hand_over", "recipient": str(target.id)},
        format="json",
    )
    assert self_recipient.status_code == 400
    block = client.post(
        f"{PEOPLE}{target.id}/remove/",
        {"pages": "delete", "block": True},
        format="json",
    )
    assert block.status_code == 400
    assert models.User.objects.filter(id=target.id).exists()


@pytest.mark.usefixtures("sign_in_server")
def test_an_owner_removes_and_blocks():
    """Removed and blocked: the email can't come back."""
    owner = _owner()
    target = factories.UserFactory(email="Tom@Example.org")
    response = _client(owner).post(
        f"{PEOPLE}{target.id}/remove/",
        {"pages": "delete", "block": True, "reason": "Abuse"},
        format="json",
    )
    assert response.status_code == 200
    blocked = models.BlockedEmail.objects.get()
    assert blocked.email == "tom@example.org"
    assert blocked.reason == "Abuse"
    assert accounts.is_blocked("TOM@example.org")


def test_owners_block_emails_with_or_without_accounts(sign_in_server):
    """No account yet: disabled at the sign-in server; an account: suspended."""
    owner = _owner()
    client = _client(owner)

    newcomer = client.post(
        BLOCKED, {"email": " New@Example.org ", "reason": "Spam"}, format="json"
    )
    assert newcomer.status_code == 201
    assert newcomer.json()["email"] == "new@example.org"
    assert newcomer.json()["has_account"] is False
    sign_in_server.set_enabled.assert_called_with("kc:new@example.org", False)

    member = factories.UserFactory(email="member@example.org")
    assert client.post(BLOCKED, {"email": member.email}, format="json").status_code == (
        201
    )
    member.refresh_from_db()
    assert member.suspended_at

    assert [item["email"] for item in client.get(BLOCKED).json()] == [
        "member@example.org",
        "new@example.org",
    ]
    actions = list(
        models.PlatformLog.objects.filter(action="blocked").values_list(
            "target_name", flat=True
        )
    )
    assert sorted(actions) == ["member@example.org", "new@example.org"]


@pytest.mark.usefixtures("sign_in_server")
def test_blocking_is_for_owners_and_never_of_owners():
    """Administrators can't; an owner's email or one's own can't be blocked."""
    owner = _owner()
    other_owner = _owner()
    administrator = _administrator()
    assert (
        _client(administrator)
        .post(BLOCKED, {"email": "x@example.org"}, format="json")
        .status_code
        == 403
    )
    client = _client(owner)
    assert (
        client.post(BLOCKED, {"email": other_owner.email}, format="json").status_code
        == 400
    )
    assert (
        client.post(BLOCKED, {"email": owner.email}, format="json").status_code == 400
    )
    assert client.post(BLOCKED, {"email": "nope"}, format="json").status_code == 400
    client.post(BLOCKED, {"email": "x@example.org"}, format="json")
    again = client.post(BLOCKED, {"email": "X@example.org"}, format="json")
    assert again.status_code == 400


def test_unblocking_lets_the_email_in_but_keeps_a_suspension(sign_in_server):
    """The email may sign in again; a suspended account stays suspended."""
    owner = _owner()
    member = factories.UserFactory(email="member@example.org")
    accounts.block_email(member.email, owner)
    blocked = models.BlockedEmail.objects.get()

    response = _client(owner).delete(f"{BLOCKED}{blocked.id}/")

    assert response.status_code == 204
    assert not accounts.is_blocked(member.email)
    member.refresh_from_db()
    assert member.suspended_at
    assert models.PlatformLog.objects.filter(action="unblocked").count() == 1

    # Without an account here, the sign-in server's account is enabled again
    accounts.block_email("x@example.org", owner)
    accounts.unblock_email(models.BlockedEmail.objects.get(), owner)
    sign_in_server.set_enabled.assert_called_with("kc:x@example.org", True)


def test_a_blocked_email_cannot_sign_in():
    """Refused at sign-in, account or not."""
    models.BlockedEmail.objects.create(email="tom@example.org")
    backend = OIDCAuthenticationBackend()
    with (
        mock.patch.object(
            backend,
            "get_userinfo",
            return_value={"sub": "kc-1", "email": "Tom@example.org"},
        ),
        pytest.raises(SuspiciousOperation),
    ):
        backend.get_or_create_user("access", "id", {})
    assert not models.User.objects.filter(email__iexact="tom@example.org").exists()


def test_the_keycloak_client_disables_signs_out_and_deletes(settings):
    """Disabled: signed out too; a missing account is nothing to change."""
    settings.COLLABORATORS_KEYCLOAK_URL = "http://keycloak.test"
    settings.COLLABORATORS_KEYCLOAK_REALM = "collaborators"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_ID = "collaborators-backend"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_SECRET = "secret"
    token = mock.Mock(ok=True, status_code=200)
    token.json.return_value = {"access_token": "t", "expires_in": 300}
    calls = []

    def answer(method, url, **kwargs):
        calls.append((method, url.split("/collaborators")[-1], kwargs.get("json")))
        status = 404 if "/users/gone" in url else 204
        return mock.Mock(ok=status < 400, status_code=status, content=b"")

    with (
        mock.patch("core.services.keycloak.requests.post", return_value=token),
        mock.patch("core.services.keycloak.requests.request", side_effect=answer),
    ):
        keycloak.set_enabled("kc-1", False)
        keycloak.set_enabled("kc-1", True)
        keycloak.delete_user("kc-1")
        keycloak.set_enabled("gone", True)
        keycloak.delete_user("gone")

    assert calls[:4] == [
        ("put", "/users/kc-1", {"enabled": False}),
        ("post", "/users/kc-1/logout", None),
        ("put", "/users/kc-1", {"enabled": True}),
        ("delete", "/users/kc-1", None),
    ]


def test_administrators_appoint_managers_and_owners_any_level():
    """Up to manager for an administrator, any level for an owner."""
    administrator = _administrator()
    owner = _owner()
    collaborator = factories.UserFactory()
    manager = factories.UserFactory(platform_role="manager")

    assert accounts.levels_one_may_give(administrator, collaborator) == [
        "collaborator",
        "manager",
    ]
    assert accounts.levels_one_may_give(administrator, manager) == [
        "collaborator",
        "manager",
    ]
    assert not accounts.levels_one_may_give(administrator, _administrator())
    assert accounts.levels_one_may_give(owner, administrator) == [
        "collaborator",
        "manager",
        "administrator",
        "owner",
    ]
    # Another owner: protected owners alone; never oneself
    assert not accounts.levels_one_may_give(owner, _owner())
    assert accounts.levels_one_may_give(_protected_owner(), _owner()) == [
        "collaborator",
        "manager",
        "administrator",
        "owner",
    ]
    assert not accounts.levels_one_may_give(owner, owner)


@pytest.mark.usefixtures("sign_in_server")
def test_no_level_for_a_suspended_or_waiting_account():
    """Reinstated or let in first."""
    owner = _owner()
    suspended = factories.UserFactory()
    accounts.suspend(suspended, owner)
    waiting = factories.UserFactory(registration_status="pending")
    assert not accounts.levels_one_may_give(owner, suspended)
    assert not accounts.levels_one_may_give(owner, waiting)


def test_appointing_through_the_api_is_logged_and_told():
    """The level changes, the log says who did it, they get an email."""
    administrator = _administrator()
    collaborator = factories.UserFactory()
    client = _client(administrator)
    url = f"{PEOPLE}{collaborator.id}/level/"

    response = client.post(url, {"role": "manager"}, format="json")

    assert response.status_code == 200
    assert response.json() == {"platform_role": "manager"}
    collaborator.refresh_from_db()
    assert collaborator.platform_role == "manager"
    entry = models.PlatformLog.objects.get(action="role_changed", target=collaborator)
    assert entry.actor == administrator
    assert entry.details["source"] == "app"
    assert mail.outbox[-1].to == [collaborator.email]
    assert "Manager" in mail.outbox[-1].body

    # Not above what one may give, nor the same level again
    assert client.post(url, {"role": "administrator"}, format="json").status_code == 400
    assert client.post(url, {"role": "manager"}, format="json").status_code == 400
    assert (
        _client(factories.UserFactory(platform_role="manager"))
        .post(url, {"role": "collaborator"}, format="json")
        .status_code
        == 403
    )


def test_an_owner_appoints_another_owner():
    """An owner opens /admin/ too."""
    owner = _owner()
    administrator = _administrator()
    response = _client(owner).post(
        f"{PEOPLE}{administrator.id}/level/", {"role": "owner"}, format="json"
    )
    assert response.status_code == 200
    administrator.refresh_from_db()
    assert administrator.is_superuser and administrator.platform_level == "owner"


def test_the_list_says_which_levels_one_may_give():
    """Each row carries the levels the viewer may give."""
    administrator = _administrator()
    collaborator = factories.UserFactory()
    results = {
        item["id"]: item
        for item in _client(administrator).get(PEOPLE).json()["results"]
    }
    assert results[str(collaborator.id)]["levels_you_may_give"] == [
        "collaborator",
        "manager",
    ]
    assert results[str(administrator.id)]["levels_you_may_give"] == []


def test_a_protected_owner_makes_another_owner_a_collaborator_again():
    """The way back down, through the API; no longer superuser; logged."""
    owner = _protected_owner()
    other = factories.UserFactory(platform_role="owner", is_superuser=True)
    client = _client(owner)

    response = client.post(
        f"{PEOPLE}{other.id}/level/", {"role": "collaborator"}, format="json"
    )

    assert response.status_code == 200
    other.refresh_from_db()
    assert other.platform_level == "collaborator"
    assert not other.is_superuser and not other.is_staff
    entry = models.PlatformLog.objects.get(action="role_changed", target=other)
    assert entry.details["previous"] == "owner"
    assert entry.actor == owner
    # Never one's own level, and still no suspending another owner
    assert (
        client.post(
            f"{PEOPLE}{owner.id}/level/", {"role": "manager"}, format="json"
        ).status_code
        == 403
    )
    third = _owner()
    assert client.post(f"{PEOPLE}{third.id}/suspend/").status_code == 403


def test_the_list_offers_levels_on_another_owners_row():
    """A protected owner sees Level on another owner's row, not Suspend/Remove."""
    owner = _protected_owner()
    other = _owner()
    row = next(
        item
        for item in _client(owner).get(PEOPLE).json()["results"]
        if item["id"] == str(other.id)
    )
    assert row["can_manage"] is False
    assert row["levels_you_may_give"] == [
        "collaborator",
        "manager",
        "administrator",
        "owner",
    ]


def test_nobody_changes_a_protected_owners_level_in_the_app():
    """Not another protected owner, not an owner, not themselves."""
    first = _protected_owner()
    second = _protected_owner()
    owner = _owner()
    assert not accounts.levels_one_may_give(first, second)
    assert not accounts.levels_one_may_give(owner, first)
    assert not accounts.levels_one_may_give(first, first)
    response = _client(first).post(
        f"{PEOPLE}{second.id}/level/", {"role": "collaborator"}, format="json"
    )
    assert response.status_code == 403
    second.refresh_from_db()
    assert second.platform_level == "owner"


def test_an_owner_who_is_not_protected_never_lowers_an_owner():
    """They make owners, but lower none."""
    owner = _owner()
    other = _owner()
    collaborator = factories.UserFactory()
    client = _client(owner)
    assert (
        client.post(
            f"{PEOPLE}{other.id}/level/", {"role": "collaborator"}, format="json"
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"{PEOPLE}{collaborator.id}/level/", {"role": "owner"}, format="json"
        ).status_code
        == 200
    )


def test_set_platform_role_protects_owners():
    """--protected for owners only; --unprotected takes it back; logged."""
    user = factories.UserFactory(email="pia@example.org")
    out = StringIO()
    call_command("set_platform_role", user.email, "owner", "--protected", stdout=out)
    user.refresh_from_db()
    assert user.platform_protected and user.platform_level == "owner"
    assert "protected" in out.getvalue()
    assert models.PlatformLog.objects.filter(
        target=user, details__protected=True
    ).exists()
    with pytest.raises(CommandError):
        call_command("set_platform_role", user.email, "manager", "--protected")
    call_command(
        "set_platform_role", user.email, "owner", "--unprotected", stdout=StringIO()
    )
    user.refresh_from_db()
    assert not user.platform_protected
