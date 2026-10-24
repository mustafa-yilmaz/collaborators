"""
Labels on workspaces, spaces and pages: one shared vocabulary for the whole
platform, and a cloud of the labels of what each collaborator can see.

GET /api/v1.0/labels/?q=<text>              — labels to pick from, most used first
GET /api/v1.0/labels/cloud/                 — {name, count} of what I can see
GET /api/v1.0/labels/<name>/                — the workspaces, spaces and pages
                                              labelled so that I can see
GET, PUT /api/v1.0/documents/<id>/labels/   — {names}: a page's or a space's
GET, PUT /api/v1.0/workspaces/<id>/labels/  — {names}: a workspace's
"""

from collections import Counter

from django.db import transaction
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions

MAX_LABELS = 20
CLOUD_SIZE = 60
# Labelled documents looked at, newest first: a bound, not a feature
CANDIDATES = 2000


def _names(labels):
    return [label.name for label in labels]


def _clean_names(raw):
    """The names given, normalized and without duplicates (any case)."""
    if not isinstance(raw, list):
        raise drf.exceptions.ValidationError({"names": _("Expected a list.")})
    names, keys = [], set()
    for item in raw:
        name = models.Label.normalize(item)
        if name and name.lower() not in keys:
            keys.add(name.lower())
            names.append(name)
    if len(names) > MAX_LABELS:
        raise drf.exceptions.ValidationError(
            {"names": _("At most %(max)s labels.") % {"max": MAX_LABELS}}
        )
    return names


def _set_labels(owner_field, owner, through, names, user):
    """Make the labels of a workspace or a document exactly these names."""
    with transaction.atomic():
        labels = [models.Label.get_or_create_named(name, user) for name in names]
        through.objects.filter(**{owner_field: owner}).exclude(
            label__in=labels
        ).delete()
        for label in labels:
            through.objects.get_or_create(
                **{owner_field: owner, "label": label}, defaults={"added_by": user}
            )
    return labels


def visible_documents(user, documents):
    """The documents among these the user can open."""
    return [
        document
        for document in documents
        if document.ancestors_deleted_at is None
        and document.get_abilities(user).get("retrieve")
    ]


def visible_workspaces(user):
    """Workspaces the user belongs to, or that anyone signed in can find."""
    return models.Workspace.objects.filter(
        Q(accesses__user=user)
        | Q(
            visibility__in=[
                choices.WorkspaceVisibilityChoices.PUBLIC,
                choices.WorkspaceVisibilityChoices.PLATFORM,
            ]
        )
    ).distinct()


class LabelListView(APIView):
    """Labels to pick from, most used first."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """
        Labels matching the text typed. Collaborators: those on what the user
        can see, counted there (a label only on private pages isn't shown).
        """
        user = request.user
        query = models.Label.normalize(request.query_params.get("q")).lower()
        labels = models.Label.objects.all()
        if query:
            labels = labels.filter(key__contains=query)
        documents = (
            models.Document.objects.filter(
                labels__label__in=labels, ancestors_deleted_at__isnull=True
            )
            .distinct()
            .order_by("-updated_at")[:CANDIDATES]
        )
        visible = {document.id for document in visible_documents(user, documents)}
        counts = Counter()
        names = {}
        for link in models.DocumentLabel.objects.filter(
            document_id__in=visible, label__in=labels
        ).select_related("label"):
            counts[link.label.key] += 1
            names[link.label.key] = link.label.name
        for link in models.WorkspaceLabel.objects.filter(
            workspace__in=visible_workspaces(user), label__in=labels
        ).select_related("label"):
            counts[link.label.key] += 1
            names[link.label.key] = link.label.name
        return drf.response.Response(
            [
                {"name": names[key], "count": count}
                for key, count in sorted(
                    counts.items(), key=lambda item: (-item[1], item[0])
                )[:20]
            ]
        )


class LabelCloudView(APIView):
    """The labels of what the user can see, with how often each is used."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """{name, count}, the most used first."""
        user = request.user
        counts = Counter()
        names = {}
        documents = (
            models.Document.objects.filter(
                labels__isnull=False, ancestors_deleted_at__isnull=True
            )
            .distinct()
            .order_by("-updated_at")[:CANDIDATES]
        )
        visible = {document.id for document in visible_documents(user, documents)}
        for link in models.DocumentLabel.objects.filter(
            document_id__in=visible
        ).select_related("label"):
            counts[link.label.key] += 1
            names[link.label.key] = link.label.name
        for link in models.WorkspaceLabel.objects.filter(
            workspace__in=visible_workspaces(user)
        ).select_related("label"):
            counts[link.label.key] += 1
            names[link.label.key] = link.label.name
        return drf.response.Response(
            [
                {"name": names[key], "count": count}
                for key, count in sorted(
                    counts.items(), key=lambda item: (-item[1], item[0])
                )[:CLOUD_SIZE]
            ]
        )


class LabelDetailView(APIView):
    """What carries a label, among what the user can see."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, name):
        """The workspaces, spaces and pages with this label."""
        user = request.user
        label = models.Label.objects.filter(
            key=models.Label.normalize(name).lower()
        ).first()
        if label is None:
            raise drf.exceptions.NotFound()
        documents = visible_documents(
            user,
            models.Document.objects.filter(
                labels__label=label, ancestors_deleted_at__isnull=True
            ).order_by("-updated_at")[:200],
        )
        workspaces = visible_workspaces(user).filter(labels__label=label)
        return drf.response.Response(
            {
                "name": label.name,
                "workspaces": [
                    {"id": str(ws.id), "name": ws.name, "slug": ws.slug}
                    for ws in workspaces.order_by("name")
                ],
                "spaces": [
                    {"id": str(doc.id), "title": doc.title}
                    for doc in documents
                    if doc.is_space
                ],
                "pages": [
                    {"id": str(doc.id), "title": doc.title}
                    for doc in documents
                    if not doc.is_space
                ],
            }
        )


class DocumentLabelsView(APIView):
    """A page's or a space's labels; those who can edit it change them."""

    # Collaborators: the labels of what is public show signed out too
    permission_classes = [permissions.IsAuthenticatedOrSafe]

    def _document(self, user, resource_id):
        document = models.Document.objects.filter(
            pk=resource_id, ancestors_deleted_at__isnull=True
        ).first()
        if document is None or not document.get_abilities(user).get("retrieve"):
            raise drf.exceptions.NotFound()
        return document

    def _state(self, document, user):
        return {
            "names": _names(
                models.Label.objects.filter(documents__document=document).order_by(
                    "documents__created_at"
                )
            ),
            "can_edit": bool(document.get_abilities(user).get("partial_update")),
        }

    def get(self, request, resource_id):
        """The labels."""
        document = self._document(request.user, resource_id)
        return drf.response.Response(self._state(document, request.user))

    def put(self, request, resource_id):
        """Replace the labels with {names}."""
        document = self._document(request.user, resource_id)
        if not document.get_abilities(request.user).get("partial_update"):
            raise drf.exceptions.PermissionDenied()
        names = _clean_names(request.data.get("names"))
        _set_labels("document", document, models.DocumentLabel, names, request.user)
        return drf.response.Response(self._state(document, request.user))


class WorkspaceLabelsView(APIView):
    """A workspace's labels; its administrators change them."""

    # Collaborators: a public workspace's labels show signed out too
    permission_classes = [permissions.IsAuthenticatedOrSafe]

    def _workspace(self, user, workspace_id):
        workspace = models.Workspace.objects.filter(id=workspace_id).first()
        if workspace is None or not workspace.is_shown_to(user):
            raise drf.exceptions.NotFound()
        return workspace

    def _state(self, workspace, user):
        return {
            "names": _names(
                models.Label.objects.filter(workspaces__workspace=workspace).order_by(
                    "workspaces__created_at"
                )
            ),
            "can_edit": workspace.get_role(user) in choices.WORKSPACE_PRIVILEGED_ROLES,
        }

    def get(self, request, workspace_id):
        """The labels."""
        workspace = self._workspace(request.user, workspace_id)
        return drf.response.Response(self._state(workspace, request.user))

    def put(self, request, workspace_id):
        """Replace the labels with {names}."""
        workspace = self._workspace(request.user, workspace_id)
        if workspace.get_role(request.user) not in choices.WORKSPACE_PRIVILEGED_ROLES:
            raise drf.exceptions.PermissionDenied()
        names = _clean_names(request.data.get("names"))
        _set_labels("workspace", workspace, models.WorkspaceLabel, names, request.user)
        return drf.response.Response(self._state(workspace, request.user))
