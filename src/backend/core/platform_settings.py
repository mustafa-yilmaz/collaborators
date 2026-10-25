"""
Collaborators: the settings platform owners change in the app. Each one not
set here follows the server's own (its environment):

- signup_approval: newcomers wait for a manager to let them in
  (COLLABORATORS_SIGNUP_APPROVAL, see core.registrations);
- email_invitations: workspaces, spaces and pages invite people by email
  (COLLABORATORS_EMAIL_INVITATIONS).

Every change goes to the platform log.
"""

from django.conf import settings

from core import models, platform_roles
from core.choices import PlatformLogActionChoices

# Each setting, and the server setting it overrides
SETTINGS = {
    "signup_approval": "COLLABORATORS_SIGNUP_APPROVAL",
    "email_invitations": "COLLABORATORS_EMAIL_INVITATIONS",
}


def _row():
    return models.PlatformSettings.objects.first()


def get(name):
    """A setting's value: the platform's own, else the server's."""
    row = _row()
    value = getattr(row, name) if row else None
    return getattr(settings, SETTINGS[name]) if value is None else value


def describe():
    """Each setting: its value, the server's, and whether it is set here."""
    row = _row()
    described = {}
    for name, server_name in SETTINGS.items():
        own = getattr(row, name) if row else None
        server = getattr(settings, server_name)
        described[name] = {
            "value": server if own is None else own,
            "server_default": server,
            "set_here": own is not None,
        }
    return described


def update(values, actor):
    """
    Change some settings (true or false; null follows the server again),
    and log what changed.
    """
    row = _row() or models.PlatformSettings()
    changes = {}
    for name, value in values.items():
        if name not in SETTINGS:
            raise ValueError(f"Unknown setting: {name}")
        if value is not None and not isinstance(value, bool):
            raise ValueError(f"{name}: true, false or null")
        if getattr(row, name) != value:
            changes[name] = [getattr(row, name), value]
            setattr(row, name, value)
    if not changes:
        return {}
    row.updated_by = actor
    row.save()
    platform_roles.log(
        PlatformLogActionChoices.SETTINGS_CHANGED,
        None,
        actor,
        target_name="",
        changes=changes,
    )
    return changes
