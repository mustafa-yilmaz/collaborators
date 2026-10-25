"""
Put a collaborator at a level of the platform from the command line
(logged, without an actor):

    python manage.py set_platform_role ada@example.org owner

Levels: collaborator, manager, administrator, owner (core.platform_roles).
"""

from django.core.management.base import BaseCommand, CommandError

from core import models, platform_roles


class Command(BaseCommand):
    """Change someone's platform level by email."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("role", choices=platform_roles.LEVELS)

    def handle(self, *args, **options):
        users = models.User.objects.filter(email__iexact=options["email"])
        if not users.exists():
            raise CommandError("Nobody signed in with this email yet.")
        if users.count() > 1:
            raise CommandError("Several accounts have this email; use /admin/.")
        user = users.get()
        changed = platform_roles.set_role(user, options["role"], source="command")
        self.stdout.write(
            f"{user.email}: {user.get_platform_role_display()}"
            f"{'' if changed else ' (unchanged)'}"
        )
