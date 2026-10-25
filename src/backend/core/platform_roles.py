"""
Collaborators: the levels of the platform, each with the rights of the
levels below it:

- collaborator: anyone with an account;
- platform manager: decides on registrations (core.registrations) and reads
  the list of everyone on the platform;
- platform administrator: will suspend and remove accounts, handle content
  reports and appoint managers;
- platform owner: appoints administrators and owners; full /admin/ rights
  (a superuser; one made with createsuperuser counts as an owner).

Every change of level is written to the platform log.
"""

from django.db.models import Q

from core import models
from core.choices import PlatformLogActionChoices, PlatformRoleChoices

COLLABORATOR = PlatformRoleChoices.COLLABORATOR
MANAGER = PlatformRoleChoices.MANAGER
ADMINISTRATOR = PlatformRoleChoices.ADMINISTRATOR
OWNER = PlatformRoleChoices.OWNER

# Lowest first
LEVELS = [COLLABORATOR, MANAGER, ADMINISTRATOR, OWNER]


def rank(role):
    """The position of a level, the lowest being 0."""
    return LEVELS.index(role) if role in LEVELS else 0


def has_level(user, role):
    """Whether the user is at this level or above."""
    if not user or not user.is_authenticated or not user.is_active:
        return False
    return rank(user.platform_level) >= rank(role)


def at_level(role):
    """The active accounts at this level or above."""
    # Superusers are owners: at every level
    return models.User.objects.filter(
        Q(platform_role__in=LEVELS[rank(role) :]) | Q(is_superuser=True),
        is_active=True,
    )


def _name(user):
    if user is None:
        return ""
    return f"{user.full_name} <{user.email}>" if user.full_name else user.email or ""


def log(action, target, actor=None, **details):
    """Write one entry of the platform log."""
    return models.PlatformLog.objects.create(
        action=action,
        actor=actor,
        actor_name=_name(actor),
        target=target,
        target_name=_name(target),
        details=details,
    )


def set_role(user, role, actor=None, source="app"):
    """
    Put someone at a level, and log it. Owners alone open /admin/ (they are
    its superusers); the other levels act in the app only.
    """
    if role not in LEVELS:
        raise ValueError(f"Unknown platform level: {role}")
    previous = user.platform_level
    is_owner = role == OWNER
    if (
        previous == role
        and user.platform_role == role
        and user.is_superuser == is_owner
        and user.is_staff == is_owner
    ):
        return False
    user.platform_role = role
    user.is_superuser = is_owner
    user.is_staff = is_owner
    user.save(update_fields=["platform_role", "is_superuser", "is_staff", "updated_at"])
    if previous != role:
        log(
            PlatformLogActionChoices.ROLE_CHANGED,
            user,
            actor,
            previous=previous,
            role=role,
            source=source,
        )
    return True
