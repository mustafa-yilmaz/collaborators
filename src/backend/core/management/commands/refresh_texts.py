"""
Read the text of the pages whose text was never read, or changed since, from
the collaboration server, for the search:

    python manage.py refresh_texts
"""

from django.core.management.base import BaseCommand
from django.db.models import F, Q

from core import models
from core.tasks.wiki import refresh_text


class Command(BaseCommand):
    """Refresh the stored text of the pages that need it."""

    help = __doc__

    def handle(self, *args, **options):
        stale = models.Document.objects.filter(
            ancestors_deleted_at__isnull=True
        ).filter(
            Q(text_updated_at__isnull=True) | Q(text_updated_at__lt=F("updated_at"))
        )
        count = 0
        for document in stale.iterator():
            if refresh_text(document) is not None:
                count += 1
        self.stdout.write(f"Read the text of {count} pages")
