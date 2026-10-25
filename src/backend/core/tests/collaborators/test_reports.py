"""
Collaborators: pages reported to platform administrators, who dismiss the
reports or take the pages down; settings platform owners change in the app.
"""

from unittest import mock

from django.core import mail

import pytest
from rest_framework.test import APIClient

from core import factories, models, platform_settings, registrations, reports

pytestmark = pytest.mark.django_db

REPORTS = "/api/v1.0/platform/reports/"
SETTINGS = "/api/v1.0/platform/settings/"


@pytest.fixture(autouse=True)
def fixture_page_text():
    """The collaboration server's text of a page, without the server."""
    with mock.patch.object(reports, "page_text", return_value="Buy cheap pills"):
        yield


def _client(user):
    client = APIClient()
    client.force_login(user)
    return client


def _administrator():
    return factories.UserFactory(platform_role="administrator", full_name="Ada")


def _report(document, reporter, reason="spam", details=""):
    return _client(reporter).post(
        f"/api/v1.0/documents/{document.id}/report/",
        {"reason": reason, "details": details},
        format="json",
    )


def test_a_reader_reports_a_page_and_administrators_are_told():
    """Kept with its text; administrators (not managers) notified and emailed."""
    administrator = _administrator()
    owner = factories.UserFactory(is_superuser=True)
    factories.UserFactory(platform_role="manager")
    reader = factories.UserFactory(full_name="Rita")
    page = factories.DocumentFactory(title="Offers", users=[(reader, "reader")])

    response = _report(page, reader, "spam", "Ads everywhere")

    assert response.status_code == 201
    report = models.ContentReport.objects.get()
    assert report.document == page
    assert report.document_title == "Offers"
    assert report.excerpt == "Buy cheap pills"
    assert report.reporter_name == f"Rita <{reader.email}>"
    assert report.details == "Ads everywhere"
    assert report.status == "open"
    assert set(
        models.Notification.objects.filter(kind="report").values_list(
            "recipient", flat=True
        )
    ) == {administrator.id, owner.id}
    assert sorted(message.to[0] for message in mail.outbox) == sorted(
        [administrator.email, owner.email]
    )


def test_one_reports_only_what_one_reads_once_with_a_reason():
    """A page one can't read is not found; a reason is needed; once is enough."""
    reader = factories.UserFactory()
    page = factories.DocumentFactory(users=[(reader, "reader")])
    private = factories.DocumentFactory(link_reach="restricted")

    assert _report(private, reader).status_code == 404
    assert _report(page, reader, "because").status_code == 400
    assert _report(page, reader).status_code == 201
    again = _report(page, reader)
    assert again.status_code == 400
    assert "already" in again.json()["detail"]
    assert (
        APIClient()
        .post(f"/api/v1.0/documents/{page.id}/report/", {"reason": "spam"})
        .status_code
        == 401
    )


def test_reports_are_for_administrators_and_owners():
    """A manager may not see them."""
    assert (
        _client(factories.UserFactory(platform_role="manager")).get(REPORTS).status_code
        == 403
    )
    assert _client(_administrator()).get(REPORTS).status_code == 200


def test_reports_list_what_administrators_need():
    """The page, its owners, the text kept, who reported and why."""
    owner = factories.UserFactory(full_name="Otto")
    reader = factories.UserFactory()
    page = factories.DocumentFactory(
        title="Offers", users=[(owner, "owner"), (reader, "reader")]
    )
    _report(page, reader, "abuse", "Insults")

    item = _client(_administrator()).get(REPORTS).json()[0]

    assert item["document"]["id"] == str(page.id)
    assert item["document"]["owners"] == [f"Otto <{owner.email}>"]
    assert item["document"]["taken_down"] is False
    assert item["excerpt"] == "Buy cheap pills"
    assert item["reason"] == "abuse"
    assert item["details"] == "Insults"
    assert item["status"] == "open"


def test_dismissing_tells_the_reporter_and_empties_the_inbox():
    """Decided, logged; the reporter is told, the notification goes."""
    administrator = _administrator()
    reader = factories.UserFactory()
    page = factories.DocumentFactory(users=[(reader, "reader")])
    _report(page, reader)
    report = models.ContentReport.objects.get()
    mail.outbox.clear()

    response = _client(administrator).post(
        f"{REPORTS}{report.id}/dismiss/", {"note": "Fine"}, format="json"
    )

    assert response.status_code == 200
    assert response.json()["status"] == "dismissed"
    assert response.json()["resolved_by"] == f"Ada <{administrator.email}>"
    assert not models.Notification.objects.filter(kind="report").exists()
    assert models.PlatformLog.objects.filter(action="report_dismissed").exists()
    assert [message.to[0] for message in mail.outbox] == [reader.email]
    assert (
        _client(administrator).post(f"{REPORTS}{report.id}/dismiss/").status_code == 400
    )
    assert _client(administrator).get(REPORTS + "?status=decided").json()[0][
        "id"
    ] == str(report.id)


def test_taking_down_trashes_the_page_for_good_and_tells_everyone():
    """In the trash with its pages below; its owners can't restore it."""
    administrator = _administrator()
    owner = factories.UserFactory()
    first = factories.UserFactory()
    second = factories.UserFactory()
    page = factories.DocumentFactory(
        users=[(owner, "owner"), (first, "reader"), (second, "reader")]
    )
    below = factories.DocumentFactory(parent=page)
    _report(page, first)
    _report(page, second, "abuse")
    report = models.ContentReport.objects.order_by("created_at").first()
    mail.outbox.clear()

    response = _client(administrator).post(
        f"{REPORTS}{report.id}/take-down/", {"note": "Spam"}, format="json"
    )

    assert response.status_code == 200
    page.refresh_from_db()
    below.refresh_from_db()
    assert page.deleted_at and page.taken_down_at
    assert below.ancestors_deleted_at
    # Every open report of the page is decided at once
    assert set(models.ContentReport.objects.values_list("status", flat=True)) == {
        "taken_down"
    }
    assert sorted(message.to[0] for message in mail.outbox) == sorted(
        [owner.email, first.email, second.email]
    )
    assert "Spam" in next(m.body for m in mail.outbox if m.to == [owner.email])
    restore = _client(owner).post(f"/api/v1.0/documents/{page.id}/restore/")
    assert restore.status_code == 400
    assert "took this page down" in restore.json()["detail"]


def test_an_administrator_puts_a_page_back():
    """Restored from the trash, and its owners may delete it again."""
    administrator = _administrator()
    reader = factories.UserFactory()
    page = factories.DocumentFactory(users=[(reader, "reader")])
    _report(page, reader)
    report = models.ContentReport.objects.get()
    client = _client(administrator)
    client.post(f"{REPORTS}{report.id}/take-down/")

    response = client.post(f"{REPORTS}{report.id}/put-back/")

    assert response.status_code == 200
    page.refresh_from_db()
    assert page.deleted_at is None and page.taken_down_at is None
    assert models.PlatformLog.objects.filter(action="put_back").exists()
    assert client.post(f"{REPORTS}{report.id}/put-back/").status_code == 400


def test_settings_are_for_owners_and_follow_the_server_until_set(settings):
    """Owners change them; empty, they follow the environment; logged."""
    settings.COLLABORATORS_SIGNUP_APPROVAL = True
    settings.COLLABORATORS_EMAIL_INVITATIONS = True
    owner = factories.UserFactory(is_superuser=True)
    assert _client(_administrator()).get(SETTINGS).status_code == 403
    client = _client(owner)

    assert client.get(SETTINGS).json()["signup_approval"] == {
        "value": True,
        "server_default": True,
        "set_here": False,
    }
    response = client.patch(SETTINGS, {"signup_approval": False}, format="json")
    assert response.status_code == 200
    assert response.json()["signup_approval"]["value"] is False
    assert response.json()["signup_approval"]["set_here"] is True
    assert platform_settings.get("signup_approval") is False
    entry = models.PlatformLog.objects.get(action="settings_changed")
    assert entry.actor == owner
    assert entry.details == {"changes": {"signup_approval": [None, False]}}

    # Null: the server's own again
    client.patch(SETTINGS, {"signup_approval": None}, format="json")
    assert platform_settings.get("signup_approval") is True
    assert client.patch(SETTINGS, {"nope": True}, format="json").status_code == 400
    assert (
        client.patch(SETTINGS, {"signup_approval": "yes"}, format="json").status_code
        == 400
    )


def test_settings_change_what_the_platform_does(settings):
    """Approval of newcomers and invitations by email follow them."""
    settings.COLLABORATORS_SIGNUP_APPROVAL = False
    settings.COLLABORATORS_EMAIL_INVITATIONS = True
    owner = factories.UserFactory(is_superuser=True)
    platform_settings.update({"signup_approval": True}, owner)
    newcomer = factories.UserFactory()

    registrations.check_sign_in(newcomer, is_new_user=True)
    newcomer.refresh_from_db()
    assert newcomer.registration_status == "pending"

    platform_settings.update({"email_invitations": False}, owner)
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(workspace=workspace, user=owner, role="owner")
    response = _client(owner).post(
        f"/api/v1.0/workspaces/{workspace.id}/invitations/",
        {"email": "new@example.org"},
        format="json",
    )
    assert response.status_code == 403
