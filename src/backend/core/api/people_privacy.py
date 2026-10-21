"""
Collaborators: people find, see and invite each other by name only when they
share a workspace, a space or a page, or when one lets everyone find them
(the "reach" of their profile). Anyone can still be invited by email.
"""

from django.conf import settings
from django.utils.translation import gettext_lazy as _

import rest_framework as drf

from core.utils.users import can_find


def check_can_find(viewer, user):
    """Refuse adding someone the viewer may not see: invite them by email."""
    if user is None or not settings.COLLABORATORS_PEOPLE_PRIVACY:
        return
    if not can_find(viewer.id, user.id):
        raise drf.exceptions.ValidationError(
            {"user_id": _("Invite this person by email instead.")}
        )
