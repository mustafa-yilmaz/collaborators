"""
The text of pages, for the full-text search of published wikis and of the
platform (core.api.search).

The collaboration server owns the content of the pages; their text is read
back from it and kept on the document (`text_content`) when a page changes,
or when a wiki is published (manage.py refresh_texts reads them all).
"""

from logging import getLogger

from django.db import transaction
from django.utils import timezone

from core import models
from core.services.yhub_services import YHubError, YHubService
from core.utils.yjs import yjs_to_text

from impress.celery_app import app

logger = getLogger(__name__)


def refresh_text(document):
    """Read the document's text from the collaboration server, and keep it."""
    try:
        update = YHubService().get_ydoc(document)
    except YHubError as err:
        logger.warning("No text for document %s: %s", document.pk, err)
        return None
    text = yjs_to_text(update) if update else ""
    now = timezone.now()
    models.Document.objects.filter(pk=document.pk).update(
        text_content=text, text_updated_at=now
    )
    document.text_content = text
    document.text_updated_at = now
    return text


@app.task
def refresh_text_task(document_id):
    """Celery task: refresh the text of a document."""
    document = models.Document.objects.filter(pk=document_id).first()
    if document is not None:
        refresh_text(document)


def is_in_published_wiki(document_id):
    """Whether the document is a page (or the home) of a published wiki."""
    document = models.Document.objects.filter(pk=document_id).only("path").first()
    if document is None:
        return False
    return models.Document.objects.filter(
        path=document.path[: models.Document.steplen], wiki_slug__isnull=False
    ).exists()


def refresh_text_on_commit(document_id):
    """
    Once the transaction is done, refresh the text of a page: for the
    full-text search of published wikis, and for the platform's search
    (core.api.search), so of every page.
    """
    transaction.on_commit(lambda: refresh_text_task.delay(str(document_id)))


def ensure_texts(documents, limit=30):
    """
    Read the text of pages never read, or changed since, right away (a few
    at most): the search of a wiki published before texts were kept works
    from its first use.
    """
    stale = [
        document
        for document in documents
        if document.text_updated_at is None
        or document.text_updated_at < document.updated_at
    ]
    for document in stale[:limit]:
        refresh_text(document)
