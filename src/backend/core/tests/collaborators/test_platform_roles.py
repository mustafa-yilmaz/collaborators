"""
Collaborators: the levels of the platform (collaborator, manager,
administrator, owner), their log, and the list of everyone for managers.
"""

import importlib
from io import StringIO

from django.apps import apps
from django.core.management import CommandError, call_command

import pytest
from rest_framework.test import APIClient

from core import factories, models, platform_roles, registrations

pytestmark = pytest.mark.django_db

PEOPLE_URL = "/api/v1.0/platform/people/"


def _client(user):
    client = APIClient()
    client.force_login(user)
    return client


def test_each_level_has_the_rights_of_those_below():
    """A level counts as every lower one; a superuser is an owner."""
    manager = factories.UserFactory(platform_role="manager")
    administrator = factories.UserFactory(platform_role="administrator")
    superuser = factories.UserFactory(is_superuser=True)
    collaborator = factories.UserFactory()

    assert platform_roles.has_level(manager, platform_roles.MANAGER)
    assert not platform_roles.has_level(manager, platform_roles.ADMINISTRATOR)
    assert platform_roles.has_level(administrator, platform_roles.MANAGER)
    assert not platform_roles.has_level(administrator, platform_roles.OWNER)
    assert superuser.platform_level == platform_roles.OWNER
    assert platform_roles.has_level(superuser, platform_roles.OWNER)
    assert not platform_roles.has_level(collaborator, platform_roles.MANAGER)
    assert set(platform_roles.at_level(platform_roles.MANAGER)) == {
        manager,
        administrator,
        superuser,
    }


def test_an_inactive_account_has_no_level():
    """A deactivated manager decides on nothing."""
    manager = factories.UserFactory(platform_role="manager", is_active=False)
    assert not platform_roles.has_level(manager, platform_roles.MANAGER)
    assert not platform_roles.at_level(platform_roles.MANAGER).exists()


def test_owners_alone_open_the_admin_site_and_changes_are_logged():
    """An owner is a superuser; another level is not; each change is logged."""
    actor = factories.UserFactory(is_superuser=True, full_name="Olga Owner")
    user = factories.UserFactory(full_name="Ada")

    assert platform_roles.set_role(user, platform_roles.OWNER, actor=actor)
    user.refresh_from_db()
    assert user.platform_role == "owner"
    assert user.is_superuser and user.is_staff

    assert platform_roles.set_role(user, platform_roles.ADMINISTRATOR, actor=actor)
    user.refresh_from_db()
    assert user.platform_role == "administrator"
    assert not user.is_superuser and not user.is_staff

    entries = list(
        models.PlatformLog.objects.filter(target=user).order_by("created_at")
    )
    assert [entry.details for entry in entries] == [
        {"previous": "collaborator", "role": "owner", "source": "app"},
        {"previous": "owner", "role": "administrator", "source": "app"},
    ]
    assert entries[0].actor == actor
    assert entries[0].actor_name == f"Olga Owner <{actor.email}>"
    assert entries[0].target_name == f"Ada <{user.email}>"


def test_an_unchanged_level_is_not_logged():
    """Setting the level one has writes nothing."""
    user = factories.UserFactory(platform_role="manager")
    assert not platform_roles.set_role(user, platform_roles.MANAGER)
    assert not models.PlatformLog.objects.exists()
    with pytest.raises(ValueError):
        platform_roles.set_role(user, "god")


def test_the_log_keeps_names_when_accounts_go():
    """A removed account leaves its name in the log."""
    user = factories.UserFactory(full_name="Gone")
    platform_roles.set_role(user, platform_roles.MANAGER)
    email = user.email
    user.delete()
    entry = models.PlatformLog.objects.get()
    assert entry.target is None
    assert entry.target_name == f"Gone <{email}>"


def test_users_me_tells_ones_level():
    """users/me/ gives the level, an owner for a superuser."""
    assert (
        _client(factories.UserFactory(platform_role="manager"))
        .get("/api/v1.0/users/me/")
        .json()["platform_role"]
        == "manager"
    )
    assert (
        _client(factories.UserFactory(is_superuser=True))
        .get("/api/v1.0/users/me/")
        .json()["platform_role"]
        == "owner"
    )


def test_registrations_are_decided_by_managers_and_above():
    """Managers, administrators and owners decide; collaborators don't."""
    newcomer = factories.UserFactory(registration_status=registrations.PENDING)
    assert (
        _client(factories.UserFactory()).get("/api/v1.0/registrations/").status_code
        == 403
    )
    for role in ("manager", "administrator", "owner"):
        response = _client(factories.UserFactory(platform_role=role)).get(
            "/api/v1.0/registrations/"
        )
        assert response.status_code == 200
        assert [item["id"] for item in response.json()] == [str(newcomer.id)]


def test_registrations_reach_managers_and_above(settings):
    """Everyone from manager up is notified of a newcomer, no collaborator."""
    settings.COLLABORATORS_SIGNUP_APPROVAL = True
    manager = factories.UserFactory(platform_role="manager")
    owner = factories.UserFactory(is_superuser=True)
    factories.UserFactory()
    newcomer = factories.UserFactory()

    registrations.check_sign_in(newcomer, is_new_user=True)

    assert set(
        models.Notification.objects.filter(
            kind=models.Notification.KIND_SIGNUP
        ).values_list("recipient", flat=True)
    ) == {manager.id, owner.id}


def test_people_of_the_platform_are_for_managers_and_above():
    """Signed out: 401; a collaborator: 403; a manager reads everyone."""
    assert APIClient().get(PEOPLE_URL).status_code == 401
    assert _client(factories.UserFactory()).get(PEOPLE_URL).status_code == 403
    assert (
        _client(factories.UserFactory(platform_role="manager"))
        .get(PEOPLE_URL)
        .status_code
        == 200
    )


def test_people_of_the_platform_with_what_they_take_part_in():
    """Newest first, with their level, registration and counts."""
    manager = factories.UserFactory(platform_role="manager")
    # Made before them: their creators come after them in the list
    documents = factories.DocumentFactory.create_batch(3)
    person = factories.UserFactory(
        full_name="Zoë Zeta", collaborator_email_verified=True
    )
    for document, role in zip(documents, ["owner", "owner", "reader"], strict=True):
        models.DocumentAccess.objects.create(document=document, user=person, role=role)
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(workspace=workspace, user=person)
    # Neither devices nor deactivated accounts are listed
    device = factories.UserFactory(is_device=True)
    inactive = factories.UserFactory(is_active=False)

    response = _client(manager).get(PEOPLE_URL)

    assert response.status_code == 200
    body = response.json()
    listed = [item["id"] for item in body["results"]]
    assert str(device.id) not in listed and str(inactive.id) not in listed
    assert listed.index(str(person.id)) < listed.index(str(manager.id))
    first = next(item for item in body["results"] if item["id"] == str(person.id))
    assert first["id"] == str(person.id)
    assert first["full_name"] == "Zoë Zeta"
    assert first["email"] == person.email
    assert first["email_verified"] is True
    assert first["platform_role"] == "collaborator"
    assert first["registration_status"] == "approved"
    assert first["pages"] == 2
    assert first["workspaces"] == 1
    assert body["results"][-1]["platform_role"] == "manager"


def test_people_of_the_platform_found_by_name_level_and_status():
    """By name (accents aside) or email, by level, by registration status."""
    manager = factories.UserFactory(platform_role="manager", full_name="Mia")
    zoe = factories.UserFactory(full_name="Zoë", email="zoe@example.org")
    waiting = factories.UserFactory(registration_status=registrations.PENDING)
    owner = factories.UserFactory(is_superuser=True)
    client = _client(manager)

    def ids(query):
        return {item["id"] for item in client.get(PEOPLE_URL + query).json()["results"]}

    assert ids("?q=zoe") == {str(zoe.id)}
    assert ids("?q=ZOE@EXAMPLE") == {str(zoe.id)}
    assert ids("?role=owner") == {str(owner.id)}
    assert ids("?role=manager") == {str(manager.id)}
    assert ids("?status=pending") == {str(waiting.id)}
    assert client.get(PEOPLE_URL + "?role=god").status_code == 400
    assert client.get(PEOPLE_URL + "?status=maybe").status_code == 400


def test_people_of_the_platform_come_fifty_a_page():
    """The list is paged."""
    manager = factories.UserFactory(platform_role="manager")
    factories.UserFactory.create_batch(50)
    first = _client(manager).get(PEOPLE_URL).json()
    assert first["count"] == 51
    assert len(first["results"]) == 50
    assert first["next"]


def test_set_platform_role_command():
    """Put someone at a level by email, logged as coming from the command."""
    user = factories.UserFactory(email="ada@example.org")
    out = StringIO()
    call_command("set_platform_role", "ADA@example.org", "owner", stdout=out)
    user.refresh_from_db()
    assert user.platform_level == "owner" and user.is_superuser
    assert out.getvalue().strip() == "ada@example.org: Owner"
    assert models.PlatformLog.objects.get(target=user).details["source"] == "command"
    with pytest.raises(CommandError):
        call_command("set_platform_role", "nobody@example.org", "manager")


@pytest.mark.parametrize("flag", ["--manager", "--admin"])
def test_approve_registration_can_make_a_manager(flag):
    """approve_registration --manager (or its former --admin)."""
    user = factories.UserFactory(registration_status=registrations.PENDING)
    call_command("approve_registration", user.email, flag, stdout=StringIO())
    user.refresh_from_db()
    assert user.registration_status == registrations.APPROVED
    assert user.platform_role == "manager"
    assert not user.is_staff


def test_the_migration_gives_staff_their_levels():
    """Superusers become owners; other staff managers, out of /admin/."""
    staff = factories.UserFactory(is_staff=True)
    superuser = factories.UserFactory(is_staff=True, is_superuser=True)
    collaborator = factories.UserFactory()
    migration = importlib.import_module(
        "core.migrations.0061_collaborators_platform_levels"
    )

    migration.set_levels(apps, None)

    staff.refresh_from_db()
    superuser.refresh_from_db()
    collaborator.refresh_from_db()
    assert (staff.platform_role, staff.is_staff) == ("manager", False)
    assert (superuser.platform_role, superuser.is_staff) == ("owner", True)
    assert collaborator.platform_role == "collaborator"
    assert models.PlatformLog.objects.count() == 2
