"""
Let a collaborator in from the command line, and optionally make them a
platform administrator (who decides on the others' registrations):

    python manage.py approve_registration ada@example.org --admin
"""

from django.core.management.base import BaseCommand, CommandError

from core import models, registrations


class Command(BaseCommand):
    """Approve a registration by email."""

    help = __doc__

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument(
            "--admin",
            action="store_true",
            help="Also make them a platform administrator.",
        )

    def handle(self, *args, **options):
        user = models.User.objects.filter(email__iexact=options["email"]).first()
        if user is None:
            raise CommandError("Nobody signed in with this email yet.")
        if user.registration_status != registrations.APPROVED:
            registrations.approve(user, None)
        if options["admin"] and not user.is_staff:
            user.is_staff = True
            user.save(update_fields=["is_staff", "updated_at"])
        self.stdout.write(
            f"{user.email}: approved{', platform administrator' if user.is_staff else ''}"
        )
