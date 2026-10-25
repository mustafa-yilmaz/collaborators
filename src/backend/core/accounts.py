"""
Collaborators: what platform administrators and owners do to accounts (see
core.platform_roles for the levels):

- **suspend** an account: it is inactive (signed out of the app at once) and
  disabled at the sign-in server, until **reinstated**;
- **remove** an account: from the platform and the sign-in server, the pages
  and workspaces it alone owns handed over to someone, or its pages deleted;
- **block** an email (owners only): nobody signs in with it, whether or not
  it has an account yet; an account with it is suspended.

One acts only on people below one's own level, never on oneself. Every
action goes to the platform log; the people suspended, reinstated or removed
are told by email.
"""

import logging
import operator
from functools import reduce

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from core import models, platform_roles, registrations
from core.choices import (
    PlatformLogActionChoices,
    RoleChoices,
    WorkspaceRoleChoices,
)
from core.services import keycloak

logger = logging.getLogger(__name__)

HAND_OVER = "hand_over"
DELETE = "delete"

# What became of the accounts at the sign-in server
DONE = "done"
FAILED = "failed"
NOT_CONFIGURED = "not configured"
NONE = "none"


class AccountError(Exception):
    """An action that can't be done, with why, to show."""


def can_manage(actor, target):
    """Whether the actor may suspend or remove the target."""
    return (
        actor.pk != target.pk
        and platform_roles.has_level(actor, platform_roles.ADMINISTRATOR)
        and platform_roles.rank(actor.platform_level)
        > platform_roles.rank(target.platform_level)
    )


def normalize(email):
    """An email as blocked emails keep it."""
    return (email or "").strip().lower()


def is_blocked(email):
    """Whether nobody may sign in with this email."""
    email = normalize(email)
    return bool(email) and models.BlockedEmail.objects.filter(email=email).exists()


def _sign_in_ids(user):
    """The accounts of the sign-in server opening this collaborator's."""
    ids = [user.sub] if user.sub else []
    ids += list(user.sign_in_identities.values_list("sub", flat=True))
    return ids


def _at_sign_in_server(ids, action):
    """Do something to each of these accounts of the sign-in server."""
    if not ids:
        return NONE
    if not keycloak.is_configured():
        return NOT_CONFIGURED
    try:
        for keycloak_id in ids:
            action(keycloak_id)
    except keycloak.KeycloakError:
        logger.exception("The sign-in server refused an account change")
        return FAILED
    return DONE


def _with_reason(message, reason):
    if not reason:
        return message
    return f"{message} " + _("Reason: {reason}").format(reason=reason)


def suspend(target, actor, reason=""):
    """Sign them out and keep them out until reinstated; tell them."""
    if target.suspended_at:
        raise AccountError(_("This account is already suspended."))
    target.is_active = False
    target.suspended_at = timezone.now()
    target.save(update_fields=["is_active", "suspended_at", "updated_at"])
    server = _at_sign_in_server(
        _sign_in_ids(target),
        lambda keycloak_id: keycloak.set_enabled(keycloak_id, False),
    )
    platform_roles.log(
        PlatformLogActionChoices.SUSPENDED,
        target,
        actor,
        reason=reason,
        sign_in_server=server,
    )
    registrations.send_email(
        target,
        _("Your account is suspended"),
        _with_reason(
            _(
                "A platform administrator suspended your Collaborators "
                "account: you can't sign in until it is reinstated."
            ),
            reason,
        ),
    )
    return server


def reinstate(target, actor):
    """Let a suspended account in again; tell them."""
    if not target.suspended_at:
        raise AccountError(_("This account is not suspended."))
    if is_blocked(target.email):
        raise AccountError(_("This email is blocked: unblock it first."))
    target.is_active = True
    target.suspended_at = None
    target.save(update_fields=["is_active", "suspended_at", "updated_at"])
    server = _at_sign_in_server(
        _sign_in_ids(target),
        lambda keycloak_id: keycloak.set_enabled(keycloak_id, True),
    )
    platform_roles.log(
        PlatformLogActionChoices.REINSTATED, target, actor, sign_in_server=server
    )
    registrations.send_email(
        target,
        _("Your account is reinstated"),
        _("Your Collaborators account is active again: you can sign in."),
        "/",
        _("Open Collaborators"),
    )
    return server


def owned_alone(target):
    """
    The pages (with what is below them) and the workspaces nobody else owns:
    removing the account would leave them without an owner.
    """
    owned = set(
        models.DocumentAccess.objects.filter(
            user=target, role=RoleChoices.OWNER
        ).values_list("document_id", flat=True)
    )
    # Another person or a group owning it too
    shared = set(
        models.DocumentAccess.objects.filter(
            document_id__in=owned, role=RoleChoices.OWNER
        )
        .exclude(user=target)
        .values_list("document_id", flat=True)
    )
    documents = models.Document.objects.filter(id__in=owned - shared)
    workspaces_owned = set(
        models.WorkspaceAccess.objects.filter(
            user=target, role=WorkspaceRoleChoices.OWNER
        ).values_list("workspace_id", flat=True)
    )
    workspaces_shared = set(
        models.WorkspaceAccess.objects.filter(
            workspace_id__in=workspaces_owned, role=WorkspaceRoleChoices.OWNER
        )
        .exclude(user=target)
        .values_list("workspace_id", flat=True)
    )
    workspaces = models.Workspace.objects.filter(
        id__in=workspaces_owned - workspaces_shared
    )
    return documents, workspaces


def removal_preview(target):
    """What removing them would leave without an owner."""
    documents, workspaces = owned_alone(target)
    paths = list(documents.values_list("path", flat=True))
    below = 0
    if paths:
        below = models.Document.objects.filter(
            reduce(operator.or_, (Q(path__startswith=path) for path in paths))
        ).count()
    return {
        "pages": [
            {"id": str(document.id), "title": document.title or ""}
            for document in documents.order_by("title")[:20]
        ],
        "pages_count": len(paths),
        # The pages with everything below them, whoever made those
        "pages_with_subpages": below,
        "workspaces": [
            {"id": str(workspace.id), "name": workspace.name}
            for workspace in workspaces.order_by("name")
        ],
    }


def _workspace_heir(workspace, target, actor, recipient):
    """Who owns a workspace the removed person owned alone."""
    if recipient is not None:
        return recipient
    # Its administrators first, then its members, the longest there first
    accesses = (
        models.WorkspaceAccess.objects.filter(workspace=workspace, user__is_active=True)
        .exclude(user=target)
        .select_related("user")
    )
    for role in (WorkspaceRoleChoices.ADMIN, WorkspaceRoleChoices.MEMBER):
        access = accesses.filter(role=role).order_by("created_at").first()
        if access:
            return access.user
    return actor


def remove(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    target, actor, *, pages=HAND_OVER, recipient=None, reason="", block=False
):
    """
    Remove the account from the platform and the sign-in server. The pages
    it alone owns go to the recipient, or are deleted for good (with what is
    below them); the workspaces it alone owns always go to someone: the
    recipient, else their next administrator or member, else the actor.
    """
    if pages not in (HAND_OVER, DELETE):
        raise AccountError(_("Choose what becomes of their pages."))
    if pages == HAND_OVER:
        if recipient is None:
            raise AccountError(_("Choose who receives their pages."))
        if recipient.pk == target.pk or not recipient.is_active:
            raise AccountError(_("Their pages can't go to this person."))
    else:
        recipient = None
    if block and not platform_roles.has_level(actor, platform_roles.OWNER):
        raise AccountError(_("Only owners block emails."))

    documents, workspaces = owned_alone(target)
    sign_in_ids = _sign_in_ids(target)
    email = target.email
    with transaction.atomic():
        heirs = {}
        if recipient is not None:
            for document in documents:
                models.DocumentAccess.objects.update_or_create(
                    document=document,
                    user=recipient,
                    defaults={"role": RoleChoices.OWNER},
                )
        for workspace in workspaces:
            heir = _workspace_heir(workspace, target, actor, recipient)
            models.WorkspaceAccess.objects.update_or_create(
                workspace=workspace,
                user=heir,
                defaults={"role": WorkspaceRoleChoices.OWNER},
            )
            heirs[workspace.name] = platform_roles.display_name(heir)
        entry = platform_roles.log(
            PlatformLogActionChoices.REMOVED,
            target,
            actor,
            reason=reason,
            pages=pages,
            pages_count=documents.count(),
            recipient=platform_roles.display_name(recipient),
            workspaces=heirs,
        )
        registrations.send_email(
            target,
            _("Your account was removed"),
            _with_reason(
                _("A platform administrator removed your Collaborators account."),
                reason,
            ),
        )
        # Deletes their accesses, and the pages they still own alone
        target.delete()
        if block:
            block_email(email, actor, reason)
    server = _at_sign_in_server(sign_in_ids, keycloak.delete_user)
    # The entry in memory still points at the deleted account
    models.PlatformLog.objects.filter(pk=entry.pk).update(
        details={**entry.details, "sign_in_server": server}
    )
    return server


def block_email(email, actor, reason=""):
    """
    Owners only: nobody signs in with this email any more; an account with
    it is suspended, and so is its account at the sign-in server.
    """
    if not platform_roles.has_level(actor, platform_roles.OWNER):
        raise AccountError(_("Only owners block emails."))
    email = normalize(email)
    if not email or "@" not in email:
        raise AccountError(_("Enter an email."))
    users = list(models.User.objects.filter(email__iexact=email))
    if any(not can_manage(actor, user) for user in users):
        raise AccountError(_("This email is one of an owner or your own."))
    _blocked, created = models.BlockedEmail.objects.get_or_create(
        email=email, defaults={"reason": reason, "blocked_by": actor}
    )
    if not created:
        raise AccountError(_("This email is already blocked."))
    for user in users:
        if not user.suspended_at:
            suspend(user, actor, reason)
    server = NONE
    if not users:
        # Someone without an account here may still have one there
        server = _sign_in_server_by_email(email, enabled=False)
    platform_roles.log(
        PlatformLogActionChoices.BLOCKED,
        users[0] if users else None,
        actor,
        target_name=email,
        reason=reason,
        sign_in_server=server,
    )


def unblock_email(blocked, actor):
    """
    Owners only: the email may sign in again. A suspended account with it
    stays suspended until reinstated.
    """
    if not platform_roles.has_level(actor, platform_roles.OWNER):
        raise AccountError(_("Only owners block emails."))
    email = blocked.email
    blocked.delete()
    users = models.User.objects.filter(email__iexact=email)
    server = NONE
    if not users.exists():
        server = _sign_in_server_by_email(email, enabled=True)
    platform_roles.log(
        PlatformLogActionChoices.UNBLOCKED,
        users.first(),
        actor,
        target_name=email,
        sign_in_server=server,
    )


def _sign_in_server_by_email(email, enabled):
    """Enable or disable the sign-in server's account with this email, if any."""
    if not keycloak.is_configured():
        return NOT_CONFIGURED
    try:
        keycloak_id = keycloak.find_user_id(email)
        if keycloak_id is None:
            return NONE
        keycloak.set_enabled(keycloak_id, enabled)
    except keycloak.KeycloakError:
        logger.exception("The sign-in server refused an account change")
        return FAILED
    return DONE
