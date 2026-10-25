"""
Let a collaborator in from the command line, and optionally make them a
platform manager (who decides on the others' registrations):

    python manage.py approve_registration ada@example.org --manager
"""

from django.core.management.base import BaseCommand, CommandError

from core import models, platform_roles, registrations


class Command(BaseCommand):
    """Approve a registration by email."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument(
            "--manager",
            "--admin",
            dest="manager",
            action="store_true",
            help="Also make them a platform manager (--admin is its former name).",
        )

    def handle(self, *args, **options):
        user = models.User.objects.filter(email__iexact=options["email"]).first()
        if user is None:
            raise CommandError("Nobody signed in with this email yet.")
        if user.registration_status != registrations.APPROVED:
            registrations.approve(user, None)
        if options["manager"] and not platform_roles.has_level(
            user, platform_roles.MANAGER
        ):
            platform_roles.set_role(user, platform_roles.MANAGER, source="command")
        self.stdout.write(f"{user.email}: approved, {user.get_platform_role_display()}")
