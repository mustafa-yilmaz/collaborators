"""
Joining workspaces without an invitation: by the domain of a verified email
address, when signing in, or with a workspace's join link.
"""

import re
import secrets

from django.db import transaction
from django.utils.translation import gettext_lazy as _

from core import models
from core.choices import WorkspaceRoleChoices

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
    return created


def join_by_domain(user):
    """
    Add the user to the workspaces open to the domain of their email, when
    their identity provider verified it. Return the workspaces just joined.
    """
    domain = email_domain(user.email)
    if not user.collaborator_email_verified or domain is None:
        return []
    return [
        workspace
        for workspace in models.Workspace.objects.filter(
            join_domains__contains=[domain]
        ).select_related("join_group")
        if join(workspace, user, workspace.join_group)
    ]


def new_join_token():
    """A secret for a join link."""
    return secrets.token_urlsafe(32)
