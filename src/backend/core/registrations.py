"""
Collaborators: new collaborators wait for a platform administrator to let
them in (COLLABORATORS_SIGNUP_APPROVAL).

Platform administrators are staff users. The people signing in with an email
of COLLABORATORS_PLATFORM_ADMIN_EMAILS that their identity provider verified
become platform administrators, let in at once, so a platform never waits
for an administrator it doesn't have.

A newcomer waiting (pending) or declined stays signed in but counts as
signed out everywhere except for reading who they are (users/me/), see
`core.authentication.backends.SessionAuthentication`. They and the
administrators are told by email, and the administrators in their inbox.
"""

import logging

from django.conf import settings
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from core import joining, models
from core.choices import RegistrationStatusChoices

logger = logging.getLogger(__name__)

APPROVED = RegistrationStatusChoices.APPROVED
PENDING = RegistrationStatusChoices.PENDING
DECLINED = RegistrationStatusChoices.DECLINED


def is_admin_email(user):
    """Whether the user's verified email makes them a platform administrator."""
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


def platform_admins():
    """The administrators who decide on registrations."""
    return models.User.objects.filter(
        is_staff=True, is_active=True, registration_status=APPROVED
    )


def check_sign_in(user, is_new_user):
    """
    At each sign-in: make a platform administrator of a listed email; put a
    newcomer on the waiting list when registrations need approval, and tell
    them and the administrators.
    """
    if is_admin_email(user):
        if not user.is_staff or user.registration_status != APPROVED:
            user.is_staff = True
            user.registration_status = APPROVED
            user.save(update_fields=["is_staff", "registration_status", "updated_at"])
            _clear_signup_notifications(user)
        return
    if not is_new_user or not settings.COLLABORATORS_SIGNUP_APPROVAL:
        return
    # Invited by email: the inviter vouches for them
    if models.User.objects.filter(pk=user.pk, collaborator_invited=True).exists():
        return
    user.registration_status = PENDING
    user.save(update_fields=["registration_status", "updated_at"])
    for admin in platform_admins():
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
    """Once decided, the registration leaves every administrator's inbox."""
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
