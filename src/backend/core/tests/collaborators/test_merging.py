"""
Collaborators: one person merges another account of theirs into the one
they are signed in with (core.merging).
"""

import time

import pytest
from rest_framework.test import APIClient

from core import factories, merging, models

pytestmark = pytest.mark.django_db

MERGE = "/api/v1.0/users/me/merge/"


def _client(user, proposal_for=None):
    client = APIClient()
    client.force_login(user)
    if proposal_for is not None:
        session = client.session
        session[merging.PROPOSAL_SESSION_KEY] = {
            "keep": str(user.pk),
            "gone": str(proposal_for.pk),
            "provider": "linkedin",
            "at": time.time(),
        }
        session.save()
    return client


def test_merging_moves_everything_and_the_other_account_goes():
    """Accesses (the higher role), memberships, groups, the rest; logged."""
    keep = factories.UserFactory(full_name="Ada", email="ada@example.org")
    gone = factories.UserFactory(
        full_name="Ada Work", email="ada@work.example", sub="ada@work.example"
    )
    own = factories.DocumentFactory(users=[(gone, "owner")])
    both = factories.DocumentFactory(users=[(keep, "reader"), (gone, "editor")])
    workspace = models.Workspace.objects.create(name="Acme")
    models.WorkspaceAccess.objects.create(workspace=workspace, user=keep)
    models.WorkspaceAccess.objects.create(
        workspace=workspace, user=gone, role="administrator"
    )
    group = models.Group.objects.create(workspace=workspace, name="Team")
    models.GroupMembership.objects.create(group=group, user=gone, is_manager=True)
    models.DocumentFavorite.objects.create(document=both, user=keep)
    models.DocumentFavorite.objects.create(document=both, user=gone)
    models.Notification.objects.create(recipient=gone, document=own)
    models.UserProfile.objects.create(user=gone, headline="Engineer")
    models.SignInIdentity.objects.create(
        user=gone, provider="google", sub="g-2", account="ada@second.example"
    )
    gone.collaborator_organizations = [{"id": "google:work.example", "name": "W"}]
    gone.save()

    merging.merge(keep, gone, "linkedin")

    assert not models.User.objects.filter(pk=gone.pk).exists()
    assert models.DocumentAccess.objects.get(document=own, user=keep).role == "owner"
    assert models.DocumentAccess.objects.get(document=both, user=keep).role == "editor"
    assert (
        models.WorkspaceAccess.objects.get(workspace=workspace, user=keep).role
        == "administrator"
    )
    assert models.GroupMembership.objects.get(group=group, user=keep).is_manager
    assert models.DocumentFavorite.objects.filter(document=both).count() == 1
    assert models.Notification.objects.get().recipient == keep
    keep.refresh_from_db()
    assert keep.profile.headline == "Engineer"
    assert keep.collaborator_organizations == [
        {"id": "google:work.example", "name": "W"}
    ]
    # Its accounts at the sign-in server open the account kept
    assert set(keep.sign_in_identities.values_list("sub", flat=True)) == {
        "g-2",
        "ada@work.example",
    }
    assert any(team.startswith("workspace") for team in keep.teams)
    entry = models.PlatformLog.objects.get(action="merged")
    assert entry.target == keep
    assert entry.details["merged"] == "Ada Work <ada@work.example>"


def test_the_account_kept_keeps_its_own_profile():
    """Both have one: the kept account's stays."""
    keep = factories.UserFactory()
    gone = factories.UserFactory()
    models.UserProfile.objects.create(user=keep, headline="Mine")
    models.UserProfile.objects.create(user=gone, headline="Other")
    merging.merge(keep, gone, "google")
    keep.refresh_from_db()
    assert keep.profile.headline == "Mine"


@pytest.mark.parametrize(
    "gone_fields",
    [
        {"is_active": False, "suspended_at": "2026-10-20T10:00:00Z"},
        {"platform_role": "owner", "platform_protected": True},
        {"platform_role": "manager"},
    ],
)
def test_some_accounts_are_never_merged(gone_fields):
    """Suspended, a protected owner's, or at a higher level than the kept one."""
    keep = factories.UserFactory()
    gone = factories.UserFactory(**gone_fields)
    assert merging.refusal(keep, gone)
    with pytest.raises(merging.MergeError):
        merging.merge(keep, gone, "google")
    assert models.User.objects.filter(pk=gone.pk).exists()


def test_the_api_shows_confirms_and_cancels_a_merge():
    """What the other account brings; merged on confirmation; or forgotten."""
    keep = factories.UserFactory()
    gone = factories.UserFactory(full_name="Ada Work")
    factories.DocumentFactory(users=[(gone, "owner")])
    client = _client(keep, proposal_for=gone)

    shown = client.get(MERGE).json()
    assert shown["proposal"]["id"] == str(gone.id)
    assert shown["proposal"]["pages"] == 1

    response = client.post(MERGE)
    assert response.status_code == 200
    assert response.json() == {"merged": "Ada Work"}
    assert not models.User.objects.filter(pk=gone.pk).exists()
    assert client.get(MERGE).json()["proposal"] is None
    assert client.post(MERGE).status_code == 400

    other = factories.UserFactory()
    client = _client(keep, proposal_for=other)
    assert client.delete(MERGE).status_code == 204
    assert client.get(MERGE).json()["proposal"] is None
    assert models.User.objects.filter(pk=other.pk).exists()


def test_a_proposal_belongs_to_the_account_it_was_made_for():
    """Another account signed in this browser sees none."""
    keep = factories.UserFactory()
    gone = factories.UserFactory()
    client = _client(keep, proposal_for=gone)
    stranger = factories.UserFactory()
    client.force_login(stranger)
    assert client.get(MERGE).json()["proposal"] is None
    assert client.post(MERGE).status_code == 400
