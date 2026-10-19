"""
Joining workspaces without an invitation: when signing in, by the domain of a
verified email address or by an organisation (a Google Workspace, a Microsoft
tenant); or with a workspace's join link. A workspace may ask its admins to
approve each person first.
"""

import logging
import re
import secrets

from django.conf import settings
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from core import models
from core.choices import (
    WORKSPACE_PRIVILEGED_ROLES,
    JoinRequestStatusChoices,
    JoinViaChoices,
    WorkspaceRoleChoices,
)
from core.services import keycloak

logger = logging.getLogger(__name__)

# The tenant of all personal Microsoft accounts: it says nothing about an
# organisation
MICROSOFT_CONSUMERS_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"

JOINED = "joined"
REQUESTED = "requested"

DOMAIN_RE = re.compile(
    r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)

# Domains anyone can get an address at: they say nothing about a person's
# organisation, so a workspace can't be joined through them
PUBLIC_EMAIL_DOMAINS = {
    "aol.com",
    "fastmail.com",
    "gmail.com",
    "gmx.com",
    "gmx.de",
    "gmx.net",
    "googlemail.com",
    "hey.com",
    "hotmail.co.uk",
    "hotmail.com",
    "hotmail.fr",
    "icloud.com",
    "live.com",
    "mac.com",
    "mail.com",
    "mail.ru",
    "me.com",
    "msn.com",
    "outlook.com",
    "privaterelay.appleid.com",
    "proton.me",
    "protonmail.com",
    "qq.com",
    "tutanota.com",
    "web.de",
    "yahoo.co.uk",
    "yahoo.com",
    "yahoo.fr",
    "yandex.com",
    "yandex.ru",
    "zoho.com",
}


def email_domain(email):
    """The lowercase domain of an email address, or None."""
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[1].strip().lower() or None


def check_join_domain(domain, admin):
    """
    Return the domain, cleaned, if the admin may open the workspace to it.

    The admin proves the domain is theirs: their own verified email is at it
    (or at one of its subdomains). Public email domains are refused.
    """
    domain = (domain or "").strip().lower().lstrip("@")
    if not DOMAIN_RE.match(domain):
        raise ValueError(_("%(domain)s is not a domain name.") % {"domain": domain})
    if domain in PUBLIC_EMAIL_DOMAINS:
        raise ValueError(
            _("Anyone can get an address at %(domain)s, so it can't be used.")
            % {"domain": domain}
        )
    own = email_domain(admin.email)
    if (
        not admin.collaborator_email_verified
        or own is None
        or not (own == domain or own.endswith(f".{domain}"))
    ):
        raise ValueError(_("Use the domain of your own verified email address."))
    return domain


def join(workspace, user, group=None):
    """Make the user a member of the workspace; True if they just joined."""
    with transaction.atomic():
        _access, created = models.WorkspaceAccess.objects.get_or_create(
            workspace=workspace,
            user=user,
            defaults={"role": WorkspaceRoleChoices.MEMBER},
        )
        if created and group is not None:
            models.GroupMembership.objects.get_or_create(group=group, user=user)
        models.WorkspaceJoinRequest.objects.filter(
            workspace=workspace, user=user
        ).delete()
    return created


def admit(workspace, user, group=None, via=JoinViaChoices.LINK, always_ask=False):
    """
    Let the user in, or, when the workspace's admins approve who joins (or
    `always_ask`, for a request from "Discover workspaces"), ask them (once:
    a pending or declined request isn't made again). Return JOINED,
    REQUESTED, or None when nothing changed.
    """
    if workspace.accesses.filter(user=user).exists():
        return None
    if not workspace.join_approval and not always_ask:
        return JOINED if join(workspace, user, group) else None
    _join_request, created = models.WorkspaceJoinRequest.objects.get_or_create(
        workspace=workspace, user=user, defaults={"via": via, "group": group}
    )
    if not created:
        return None
    for admin_id in workspace.accesses.filter(
        role__in=WORKSPACE_PRIVILEGED_ROLES
    ).values_list("user_id", flat=True):
        models.Notification.objects.create(
            recipient_id=admin_id,
            actor=user,
            kind=models.Notification.KIND_JOIN_REQUEST,
            workspace=workspace,
        )
    return REQUESTED


def request_status(workspace, user):
    """ "pending", "declined", or None: where the user's request to join stands."""
    if not user.is_authenticated:
        return None
    return (
        models.WorkspaceJoinRequest.objects.filter(workspace=workspace, user=user)
        .values_list("status", flat=True)
        .first()
    )


def approve(join_request, admin):
    """Let the person in, and tell them."""
    workspace = join_request.workspace
    if join(workspace, join_request.user, join_request.group):
        models.Notification.objects.create(
            recipient=join_request.user,
            actor=admin,
            kind=models.Notification.KIND_JOIN_APPROVED,
            workspace=workspace,
        )
    _clear_request_notifications(join_request)


def decline(join_request):
    """Say no; the request is kept so it isn't made again."""
    join_request.status = JoinRequestStatusChoices.DECLINED
    join_request.save(update_fields=["status", "updated_at"])
    _clear_request_notifications(join_request)


def _clear_request_notifications(join_request):
    """Once answered, the request leaves the other admins' inboxes too."""
    models.Notification.objects.filter(
        kind=models.Notification.KIND_JOIN_REQUEST,
        workspace=join_request.workspace,
        actor=join_request.user,
    ).delete()


def join_by_domain(user):
    """
    Add the user to the workspaces open to the domain of their email, when
    their identity provider verified it (or ask their admins). Return the
    workspaces just joined.
    """
    domain = email_domain(user.email)
    if not user.collaborator_email_verified or domain is None:
        return []
    return [
        workspace
        for workspace in models.Workspace.objects.filter(
            join_domains__contains=[domain]
        ).select_related("join_group")
        if admit(workspace, user, workspace.join_group, JoinViaChoices.DOMAIN) == JOINED
    ]


# -- Organisations: a Google Workspace, a Microsoft tenant


def organizations_from_claims(provider, claims):
    """The organisation an ID token of this provider vouches for, if any."""
    if not claims:
        return []
    if provider == "google" and claims.get("hd"):
        domain = str(claims["hd"]).lower()
        return [{"id": f"google:{domain}", "name": domain}]
    tenant = claims.get("tid")
    if provider == "microsoft" and tenant and tenant != MICROSOFT_CONSUMERS_TENANT:
        name = email_domain(claims.get("preferred_username") or claims.get("email"))
        return [{"id": f"microsoft:{tenant}", "name": name or tenant}]
    return []


def read_organizations(user, access_token, identity=None):
    """
    Record the organisations the identity providers vouch for, from the ID
    tokens Keycloak stored for the account just signed in with: the user's
    own, or one more sign-in identity of theirs. Keep what was known if
    Keycloak can't be asked.
    """
    if not (
        access_token
        and settings.COLLABORATORS_KEYCLOAK_URL
        and settings.COLLABORATORS_KEYCLOAK_REALM
    ):
        return
    organizations = []
    try:
        for provider in ("google", "microsoft"):
            if provider not in settings.COLLABORATORS_SIGNIN_PROVIDERS:
                continue
            organizations += organizations_from_claims(
                provider, keycloak.provider_id_token_claims(access_token, provider)
            )
    except keycloak.KeycloakError:
        logger.warning("Could not read the organisations of %s", user.pk)
        return
    if identity is not None:
        if organizations != identity.organizations:
            identity.organizations = organizations
            identity.save(update_fields=["organizations", "updated_at"])
    elif organizations != user.collaborator_own_organizations:
        user.collaborator_own_organizations = organizations
        models.User.objects.filter(pk=user.pk).update(
            collaborator_own_organizations=organizations
        )
    merge_organizations(user)


def merge_organizations(user):
    """The organisations of the user's own account and of its other identities."""
    merged = list(user.collaborator_own_organizations or [])
    for organizations in user.sign_in_identities.values_list(
        "organizations", flat=True
    ):
        for organization in organizations or []:
            if all(item["id"] != organization["id"] for item in merged):
                merged.append(organization)
    if merged != user.collaborator_organizations:
        models.User.objects.filter(pk=user.pk).update(collaborator_organizations=merged)
        user.collaborator_organizations = merged


def join_by_organization(user):
    """
    Add the user to the workspaces open to their organisations (or ask their
    admins). Return the workspaces just joined.
    """
    joined = []
    for organization in user.collaborator_organizations or []:
        for workspace in models.Workspace.objects.filter(
            join_organizations__contains=[{"id": organization["id"]}]
        ).select_related("join_group"):
            if (
                admit(
                    workspace, user, workspace.join_group, JoinViaChoices.ORGANIZATION
                )
                == JOINED
            ):
                joined.append(workspace)
    return joined


def check_join_organizations(ids, admin, current):
    """
    The organisations, as [{"id", "name"}], an admin may open the workspace
    to: their own, and those already there.
    """
    known = {
        item["id"]: item
        for item in [*(current or []), *(admin.collaborator_organizations or [])]
    }
    cleaned = []
    for organization_id in ids:
        if organization_id not in known:
            raise ValueError(
                _("Use an organisation you signed in with: %(id)s")
                % {"id": organization_id}
            )
        if all(item["id"] != organization_id for item in cleaned):
            cleaned.append(known[organization_id])
    return cleaned


def new_join_token():
    """A secret for a join link."""
    return secrets.token_urlsafe(32)
