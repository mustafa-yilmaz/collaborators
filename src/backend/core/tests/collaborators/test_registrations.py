"""Collaborators: platform administrators approve new registrations."""

from django.core import mail

import pytest
from rest_framework.test import APIClient

from core import factories, models, registrations

pytestmark = pytest.mark.django_db


@pytest.fixture(name="approval")
def fixture_approval(settings):
    """Registrations need approval; admin@example.org is an administrator."""
    settings.COLLABORATORS_SIGNUP_APPROVAL = True
    settings.COLLABORATORS_PLATFORM_ADMIN_EMAILS = ["Admin@example.org"]
    return settings


def _admin():
    return factories.UserFactory(is_staff=True, full_name="Ada Admin")


def _client(user):
    client = APIClient()
    client.force_login(user)
    return client


@pytest.mark.usefixtures("approval")
def test_a_newcomer_waits_and_everyone_is_told():
    """Pending, the administrators are notified and emailed, so is the newcomer."""
    admin = _admin()
    newcomer = factories.UserFactory(full_name="Nina New")

    registrations.check_sign_in(newcomer, is_new_user=True)

    newcomer.refresh_from_db()
    assert newcomer.registration_status == registrations.PENDING
    notification = models.Notification.objects.get(recipient=admin)
    assert notification.kind == models.Notification.KIND_SIGNUP
    assert notification.actor == newcomer
    assert sorted(message.to[0] for message in mail.outbox) == sorted(
        [admin.email, newcomer.email]
    )


def test_without_approval_newcomers_are_let_in(settings):
    """The setting off, nobody waits."""
    settings.COLLABORATORS_SIGNUP_APPROVAL = False
    newcomer = factories.UserFactory()

    registrations.check_sign_in(newcomer, is_new_user=True)

    newcomer.refresh_from_db()
    assert newcomer.registration_status == registrations.APPROVED
    assert not mail.outbox


@pytest.mark.usefixtures("approval")
def test_a_listed_verified_email_makes_a_platform_administrator():
    """Let in at once, even after waiting; an unverified email isn't enough."""
    unverified = factories.UserFactory(email="admin@example.org")
    registrations.check_sign_in(unverified, is_new_user=True)
    unverified.refresh_from_db()
    assert unverified.registration_status == registrations.PENDING
    assert not unverified.is_staff

    # Their provider verified it at a later sign-in
    unverified.collaborator_email_verified = True
    registrations.check_sign_in(unverified, is_new_user=False)
    unverified.refresh_from_db()
    assert unverified.registration_status == registrations.APPROVED
    assert unverified.is_staff


@pytest.mark.usefixtures("approval")
def test_a_waiting_newcomer_counts_as_signed_out():
    """They read who they are and where they stand, and nothing else."""
    newcomer = factories.UserFactory(registration_status=registrations.PENDING)
    factories.DocumentFactory(users=[newcomer])
    client = _client(newcomer)

    me = client.get("/api/v1.0/users/me/")
    assert me.status_code == 200
    assert me.json()["registration_status"] == "pending"
    assert me.json()["is_platform_admin"] is False
    # Not even their own page: the list is that of someone signed out
    assert client.get("/api/v1.0/documents/").json()["count"] == 0
    assert client.get("/api/v1.0/workspaces/").status_code == 401


@pytest.mark.usefixtures("approval")
def test_administrators_list_and_approve():
    """Approved: let in, told, joins what their domain opens, inboxes cleared."""
    admin = _admin()
    newcomer = factories.UserFactory(email="nina@acme.org")
    newcomer.collaborator_email_verified = True
    newcomer.save()
    registrations.check_sign_in(newcomer, is_new_user=True)
    workspace = models.Workspace.objects.create(name="Acme", join_domains=["acme.org"])
    mail.outbox.clear()
    client = _client(admin)

    pending = client.get("/api/v1.0/registrations/").json()
    assert [item["email"] for item in pending] == ["nina@acme.org"]
    assert pending[0]["email_verified"] is True

    response = client.post(f"/api/v1.0/registrations/{newcomer.id}/approve/")

    assert response.status_code == 200
    newcomer.refresh_from_db()
    assert newcomer.registration_status == registrations.APPROVED
    assert workspace.accesses.filter(user=newcomer).exists()
    assert not models.Notification.objects.filter(
        kind=models.Notification.KIND_SIGNUP
    ).exists()
    assert (
        models.Notification.objects.get(recipient=newcomer).kind
        == models.Notification.KIND_SIGNUP_APPROVED
    )
    assert [message.to for message in mail.outbox] == [[newcomer.email]]
    assert _client(newcomer).get("/api/v1.0/workspaces/").status_code == 200
    assert client.get("/api/v1.0/registrations/").json() == []


@pytest.mark.usefixtures("approval")
def test_administrators_decline_and_can_approve_later():
    """Declined: told, still kept out, listed apart and can still be let in."""
    admin = _admin()
    newcomer = factories.UserFactory(registration_status=registrations.PENDING)
    client = _client(admin)

    client.post(f"/api/v1.0/registrations/{newcomer.id}/decline/")

    newcomer.refresh_from_db()
    assert newcomer.registration_status == registrations.DECLINED
    assert [message.to for message in mail.outbox] == [[newcomer.email]]
    assert _client(newcomer).get("/api/v1.0/workspaces/").status_code == 401
    assert client.get("/api/v1.0/registrations/").json() == []
    declined = client.get("/api/v1.0/registrations/?status=declined").json()
    assert [item["id"] for item in declined] == [str(newcomer.id)]

    client.post(f"/api/v1.0/registrations/{newcomer.id}/approve/")
    newcomer.refresh_from_db()
    assert newcomer.registration_status == registrations.APPROVED


@pytest.mark.usefixtures("approval")
def test_only_platform_administrators_decide():
    """Others can't list, approve or decline; someone let in isn't listed."""
    member = factories.UserFactory()
    newcomer = factories.UserFactory(registration_status=registrations.PENDING)
    client = _client(member)

    assert client.get("/api/v1.0/registrations/").status_code == 403
    assert (
        client.post(f"/api/v1.0/registrations/{newcomer.id}/approve/").status_code
        == 403
    )
    assert APIClient().get("/api/v1.0/registrations/").status_code == 401
    assert (
        _client(_admin())
        .post(f"/api/v1.0/registrations/{member.id}/approve/")
        .status_code
        == 404
    )


@pytest.mark.usefixtures("approval")
def test_an_email_that_cannot_be_sent_does_not_fail(monkeypatch):
    """Without a mail server, the decision still goes through."""

    def broken(*args, **kwargs):
        raise OSError("no mail server")

    monkeypatch.setattr(models.User, "send_email", broken)
    newcomer = factories.UserFactory(registration_status=registrations.PENDING)

    response = _client(_admin()).post(f"/api/v1.0/registrations/{newcomer.id}/approve/")

    assert response.status_code == 200
