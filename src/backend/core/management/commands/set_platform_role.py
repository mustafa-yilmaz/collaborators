"""
Put a collaborator at a level of the platform from the command line
(logged, without an actor):

    python manage.py set_platform_role ada@example.org owner --protected

Levels: collaborator, manager, administrator, owner (core.platform_roles).
--protected (owners only) makes a protected owner: nobody changes their
level in the app, and they alone change other owners'; --unprotected takes
it back.
"""

from django.core.management.base import BaseCommand, CommandError

from core import models, platform_roles


class Command(BaseCommand):
    """Change someone's platform level by email."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("role", choices=platform_roles.LEVELS)
        protection = parser.add_mutually_exclusive_group()
        protection.add_argument("--protected", action="store_true")
        protection.add_argument("--unprotected", action="store_true")

    def handle(self, *args, **options):
        users = models.User.objects.filter(email__iexact=options["email"])
        if not users.exists():
            raise CommandError("Nobody signed in with this email yet.")
        if users.count() > 1:
            raise CommandError("Several accounts have this email; use /admin/.")
        user = users.get()
        if options["protected"] and options["role"] != platform_roles.OWNER:
            raise CommandError("Only owners are protected.")
        changed = platform_roles.set_role(user, options["role"], source="command")
        protected = options["role"] == platform_roles.OWNER and user.platform_protected
        if options["protected"]:
            protected = True
        elif options["unprotected"]:
            protected = False
        if protected != user.platform_protected:
            user.platform_protected = protected
            user.save(update_fields=["platform_protected", "updated_at"])
            platform_roles.log(
                models.PlatformLogActionChoices.ROLE_CHANGED,
                user,
                protected=protected,
                source="command",
            )
            changed = True
        self.stdout.write(
            f"{user.email}: {user.get_platform_role_display()}"
            f"{', protected' if user.platform_protected else ''}"
            f"{'' if changed else ' (unchanged)'}"
        )
