"""
Collaborators: new collaborators wait for a platform manager (or someone
above, see core.platform_roles) to let them in
(COLLABORATORS_SIGNUP_APPROVAL).

The people signing in with an email of COLLABORATORS_PLATFORM_ADMIN_EMAILS
that their identity provider verified become platform managers at least,
let in at once, so a platform never waits for a manager it doesn't have.

A newcomer waiting (pending) or declined stays signed in but counts as
signed out everywhere except for reading who they are (users/me/), see
`core.authentication.backends.SessionAuthentication`. They and the
managers are told by email, and the managers in their inbox.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from core import joining, models, platform_roles, platform_settings
from core.choices import RegistrationStatusChoices

logger = logging.getLogger(__name__)

APPROVED = RegistrationStatusChoices.APPROVED
PENDING = RegistrationStatusChoices.PENDING
DECLINED = RegistrationStatusChoices.DECLINED


def is_manager_email(user):
    """Whether the user's verified email makes them a platform manager."""
    emails = {
        email.strip().lower()
        for email in settings.COLLABORATORS_PLATFORM_ADMIN_EMAILS
        if email.strip()
    }
    return (
        user.collaborator_email_verified
        and bool(user.email)
        and user.email.lower() in emails
    )


def platform_managers():
    """The managers (and those above them) who decide on registrations."""
    return platform_roles.at_level(platform_roles.MANAGER).filter(
        registration_status=APPROVED
    )


def check_sign_in(user, is_new_user):
    """
    At each sign-in: make a platform manager of a listed email; put a
    newcomer on the waiting list when registrations need approval, and tell
    them and the managers.
    """
    if is_manager_email(user):
        if not platform_roles.has_level(user, platform_roles.MANAGER):
            platform_roles.set_role(user, platform_roles.MANAGER, source="settings")
        if user.registration_status != APPROVED:
            user.registration_status = APPROVED
            user.save(update_fields=["registration_status", "updated_at"])
            _clear_signup_notifications(user)
        return
    if not is_new_user or not platform_settings.get("signup_approval"):
        return
    # Invited by email: the inviter vouches for them
    if models.User.objects.filter(pk=user.pk, collaborator_invited=True).exists():
        return
    user.registration_status = PENDING
    user.save(update_fields=["registration_status", "updated_at"])
    for admin in platform_managers():
        models.Notification.objects.create(
            recipient=admin, actor=user, kind=models.Notification.KIND_SIGNUP
        )
        send_email(
            admin,
            _("New registration to approve"),
            _("{name} ({email}) registered and waits for your approval.").format(
                name=user.full_name or user.email, email=user.email
            ),
            "/registrations/",
            _("See the registrations"),
        )
    send_email(
        user,
        _("Your registration was received"),
        _(
            "Thank you for registering. An administrator will review your "
            "registration; you will receive an email once it is accepted."
        ),
    )


def approve(user, admin):
    """Let the newcomer in, join what their email opens, and tell them."""
    with transaction.atomic():
        user.registration_status = APPROVED
        user.save(update_fields=["registration_status", "updated_at"])
        _clear_signup_notifications(user)
        models.Notification.objects.create(
            recipient=user, actor=admin, kind=models.Notification.KIND_SIGNUP_APPROVED
        )
    # The workspaces open to their verified email's domain or organisation,
    # which signing in skipped while they waited
    joining.join_by_domain(user)
    joining.join_by_organization(user)
    send_email(
        user,
        _("Your registration is accepted"),
        _("Welcome! Your account is active: you can now sign in and collaborate."),
        "/",
        _("Open Collaborators"),
    )


def decline(user):
    """Say no, and tell them; they stay unable to use the platform."""
    user.registration_status = DECLINED
    user.save(update_fields=["registration_status", "updated_at"])
    _clear_signup_notifications(user)
    send_email(
        user,
        _("Your registration was not accepted"),
        _(
            "An administrator did not accept your registration. If you think "
            "this is a mistake, please contact the platform's administrators."
        ),
    )


def _clear_signup_notifications(user):
    """Once decided, the registration leaves every manager's inbox."""
    models.Notification.objects.filter(
        kind=models.Notification.KIND_SIGNUP, actor=user
    ).delete()


def send_email(recipient, subject, message, path=None, button_label=None):
    """
    Email one person, never failing the request: an unreachable or missing
    mail server is logged.
    """
    link = f"{settings.EMAIL_URL_APP or ''}{path}" if path else ""
    context = {"title": subject, "message": message}
    if link:
        context.update({"link": link, "button_label": button_label or link})
    try:
        recipient.send_email(subject, context, recipient.language)
    except Exception:  # pylint: disable=broad-exception-caught
        logger.exception("Registration email to %s was not sent", recipient.email)
