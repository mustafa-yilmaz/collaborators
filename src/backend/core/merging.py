"""
Collaborators: one person with two accounts merges them into one.

From the sign-in methods page, the person signed in (the account kept)
adds another Google or Microsoft account (core.identities); when that
account already opens a separate Collaborators account, signing in with it
proved it is theirs, and merging it is offered. Once they confirm,
everything of the other account moves over and the other account goes:

- page and space accesses (the higher role kept where both had one), pages
  made, favourites, comments, reactions, mentions, assignments;
- workspace memberships (the higher role kept), join requests, groups (a
  manager stays one), labels, invitations sent, notifications;
- the profile, if the account kept has none; its other sign-in accounts;
- its account at the sign-in server opens the account kept from now on.

Never between different people: only the person who can sign in with both
accounts merges them. An account suspended, protected, or at a higher level
than the one kept isn't merged (merge the other way). Logged.
"""

import time

from django.db import transaction
from django.utils.translation import gettext_lazy as _

from core import models, platform_roles
from core.choices import PlatformLogActionChoices, RoleChoices, WorkspaceRoleChoices
from core.tasks.access import reset_service_connections_on_commit

PROPOSAL_SESSION_KEY = "collaborators_merge_proposal"
# Time to confirm
TIMEOUT_SECONDS = 15 * 60


class MergeError(Exception):
    """A merge that can't be done, with why, to show."""


def account_of(sub, email):
    """The Collaborators account a sign-in server account opens, if any."""
    user = models.User.objects.filter(sub=sub).first() if sub else None
    if user is None and sub:
        identity = (
            models.SignInIdentity.objects.filter(sub=sub).select_related("user").first()
        )
        user = identity.user if identity else None
    if user is None and email:
        user = models.User.objects.filter(email__iexact=email).first()
    return user


def refusal(keep, gone):
    """Why the other account can't be merged into the one kept, if it can't."""
    if gone.suspended_at or not gone.is_active:
        return _("That account is suspended: it can't be merged.")
    if gone.platform_protected:
        return _("That account is a protected owner's: it can't be merged.")
    if platform_roles.rank(gone.platform_level) > platform_roles.rank(
        keep.platform_level
    ):
        return _(
            "That account has a higher level on the platform: sign in with it "
            "and merge this one into it instead."
        )
    return None


def propose(request, keep, gone, provider):
    """Offer, in this browser, to merge the other account into the one kept."""
    request.session[PROPOSAL_SESSION_KEY] = {
        "keep": str(keep.pk),
        "gone": str(gone.pk),
        "provider": provider,
        "at": time.time(),
    }


def proposal(request):
    """The merge waiting for confirmation in this browser, if any."""
    proposed = request.session.get(PROPOSAL_SESSION_KEY)
    if (
        not proposed
        or proposed.get("keep") != str(request.user.pk)
        or time.time() - proposed.get("at", 0) > TIMEOUT_SECONDS
    ):
        return None
    gone = models.User.objects.filter(pk=proposed["gone"]).first()
    if gone is None:
        return None
    return proposed, gone


def summary(gone):
    """What the other account brings, to show before confirming."""
    return {
        "id": str(gone.id),
        "full_name": gone.full_name or "",
        "email": gone.email or "",
        "pages": models.DocumentAccess.objects.filter(
            user=gone, role=RoleChoices.OWNER
        ).count(),
        "shared_with_it": models.DocumentAccess.objects.filter(user=gone)
        .exclude(role=RoleChoices.OWNER)
        .count(),
        "workspaces": models.WorkspaceAccess.objects.filter(user=gone).count(),
        "groups": models.GroupMembership.objects.filter(user=gone).count(),
    }


def _move_unique(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    model, field, gone, keep, others, *, keep_better=None
):
    """
    Move rows of a model unique per (user, …): where the account kept has
    its own already, it is kept (`keep_better` may improve it from the
    other's) and the other's goes.
    """
    for row in model.objects.filter(**{field: gone}):
        twin = model.objects.filter(
            **{field: keep}, **{name: getattr(row, name) for name in others}
        ).first()
        if twin is None:
            setattr(row, field, keep)
            row.save(update_fields=[field])
        else:
            if keep_better:
                keep_better(twin, row)
            row.delete()


def _higher_role(choices):
    def better(twin, row):
        role = choices.max(twin.role, row.role)
        if role != twin.role:
            twin.role = role
            twin.save(update_fields=["role"])

    return better


def _manager(twin, row):
    if row.is_manager and not twin.is_manager:
        twin.is_manager = True
        twin.save(update_fields=["is_manager"])


# Rows only pointing at the account (no "one per person" rule)
SIMPLE = [
    (models.Document, "creator"),
    (models.Thread, "creator"),
    (models.Thread, "resolved_by"),
    (models.Comment, "user"),
    (models.Mention, "mentioned_user"),
    (models.Mention, "mentioned_by_user"),
    (models.Invitation, "issuer"),
    (models.WorkspaceInvitation, "issuer"),
    (models.Group, "created_by"),
    (models.Label, "created_by"),
    (models.DocumentLabel, "added_by"),
    (models.WorkspaceLabel, "added_by"),
    (models.PageSpaceLink, "created_by"),
    (models.Notification, "recipient"),
    (models.Notification, "actor"),
    (models.TableAssignment, "assigned_by"),
    (models.WikiRelease, "published_by"),
    (models.PublicationLog, "actor"),
    (models.PlatformLog, "actor"),
    (models.PlatformLog, "target"),
    (models.ContentReport, "reporter"),
    (models.ContentReport, "resolved_by"),
    (models.BlockedEmail, "blocked_by"),
    (models.SignInIdentity, "user"),
]


def merge(keep, gone, provider):
    """Move everything of the other account to the one kept; it goes."""
    if gone.pk == keep.pk:
        raise MergeError(_("That is this account."))
    reason = refusal(keep, gone)
    if reason:
        raise MergeError(reason)
    gone_name = platform_roles.display_name(gone)
    gone_email = gone.email or ""
    # What it signs in with at the sign-in server (its email there)
    gone_sub = gone.sub
    documents = set(
        models.DocumentAccess.objects.filter(user=gone).values_list(
            "document_id", flat=True
        )
    )
    with transaction.atomic():
        _move_unique(
            models.DocumentAccess,
            "user",
            gone,
            keep,
            ["document_id"],
            keep_better=_higher_role(RoleChoices),
        )
        _move_unique(
            models.WorkspaceAccess,
            "user",
            gone,
            keep,
            ["workspace_id"],
            keep_better=_higher_role(WorkspaceRoleChoices),
        )
        _move_unique(
            models.GroupMembership,
            "user",
            gone,
            keep,
            ["group_id"],
            keep_better=_manager,
        )
        for model, others in [
            (models.DocumentFavorite, ["document_id"]),
            (models.LinkTrace, ["document_id"]),
            (models.DocumentAskForAccess, ["document_id"]),
            (models.WorkspaceFavorite, ["workspace_id"]),
            (models.WorkspaceJoinRequest, ["workspace_id"]),
            (models.TableAssignment, ["document_id", "anchor_id"]),
        ]:
            field = "assignee" if model is models.TableAssignment else "user"
            _move_unique(model, field, gone, keep, others)
        for model, field in SIMPLE:
            model.objects.filter(**{field: gone}).update(**{field: keep})
        reactions = models.Reaction.users.through
        for link in reactions.objects.filter(user=gone):
            if not reactions.objects.filter(
                user=keep, reaction_id=link.reaction_id
            ).exists():
                reactions.objects.create(user=keep, reaction_id=link.reaction_id)
        if not hasattr(keep, "profile") and hasattr(gone, "profile"):
            models.UserProfile.objects.filter(user=gone).update(user=keep)
        # What the providers vouch for, both accounts' together
        organizations = list(keep.collaborator_organizations or [])
        for organization in gone.collaborator_organizations or []:
            if organization not in organizations:
                organizations.append(organization)
        keep.collaborator_organizations = organizations
        keep.save(update_fields=["collaborator_organizations", "updated_at"])
        platform_roles.log(
            PlatformLogActionChoices.MERGED,
            keep,
            keep,
            merged=gone_name,
            source="app",
        )
        gone.delete()
        # The other account at the sign-in server opens this one from now on
        if gone_sub:
            models.SignInIdentity.objects.get_or_create(
                sub=gone_sub,
                defaults={"user": keep, "provider": provider, "account": gone_email},
            )
        models.User.refresh_teams(keep.pk)
    for document_id in documents:
        reset_service_connections_on_commit(document_id)
