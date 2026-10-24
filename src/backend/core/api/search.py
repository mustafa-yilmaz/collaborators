"""
Collaborators: one search for everything, behind every search box.

    GET /api/v1.0/search/?q=<text>&size=<per group>

Workspaces, spaces, pages and labels whose name, title, description or text
match, in two groups:

- involved: what the collaborator is part of (a member of the workspace, a
  role on the page or above it, a label on such things);
- visible: what they are not part of yet but may see (findable workspaces,
  pages and spaces open by their link, labels on such things).
"""

from django.db.models import Exists, OuterRef, Q
from django.db.models.functions import Left, Length

import rest_framework as drf
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions

MIN_LENGTH = 2
DEFAULT_SIZE = 5
MAX_SIZE = 50
# Pages not involved are checked one by one: how many candidates at most
VISIBLE_CANDIDATES = 4


def snippet(text, query, around=60):
    """A few words of the text around the first match, or ""."""
    if not text:
        return ""
    index = text.lower().find(query.lower())
    if index < 0:
        return ""
    start = max(0, index - around)
    end = min(len(text), index + len(query) + around)
    return (
        ("…" if start else "")
        + " ".join(text[start:end].split())
        + ("…" if end < len(text) else "")
    )


def _document(document, query, user):
    root = document if document.is_root() else document.get_root()
    in_title = query.lower() in (document.title or "").lower()
    return {
        "id": str(document.id),
        "title": document.title or "",
        "kind": document.kind,
        # Where it is: the space (or top page) holding it. Collaborators: not
        # named to those who can't open it (a public page in a private space)
        "context": ""
        if root.pk == document.pk or not root.get_abilities(user).get("retrieve")
        else (root.title or ""),
        "snippet": "" if in_title else snippet(document.text_content, query),
        "updated_at": document.updated_at,
    }


def _workspace(workspace):
    return {
        "id": str(workspace.id),
        "name": workspace.name,
        "slug": workspace.slug,
        "description": workspace.description or "",
    }


def _split(documents, query, size, user):
    spaces = [d for d in documents if d.kind == choices.DocumentKindChoices.SPACE]
    pages = [d for d in documents if d.kind != choices.DocumentKindChoices.SPACE]
    return (
        [_document(d, query, user) for d in spaces[:size]],
        [_document(d, query, user) for d in pages[:size]],
    )


def _labels(query, member_of, has_role, size):
    """Labels on what one is part of, then those on what is open to them."""
    labels = models.Label.objects.filter(name__icontains=query).order_by("name")
    on_mine = Q(workspaces__workspace_id__in=member_of) | Q(
        documents__document__in=models.Document.objects.filter(Exists(has_role)).values(
            "pk"
        )
    )
    on_open = Q(
        workspaces__workspace__visibility__in=[
            choices.WorkspaceVisibilityChoices.PUBLIC,
            choices.WorkspaceVisibilityChoices.PLATFORM,
        ]
    ) | Q(
        documents__document__link_reach__in=[
            choices.LinkReachChoices.PUBLIC,
            choices.LinkReachChoices.AUTHENTICATED,
        ]
    )
    involved_labels = list(labels.filter(on_mine).distinct()[:size])
    visible_labels = list(
        labels.filter(on_open)
        .exclude(pk__in=[label.pk for label in involved_labels])
        .exclude(on_mine)
        .distinct()[:size]
    )
    return involved_labels, visible_labels


class SearchView(APIView):
    """Search everything one is part of, and everything open to them."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Workspaces, spaces, pages and labels matching `q`, in two groups."""
        user = request.user
        query = (request.query_params.get("q") or "").strip()
        try:
            size = min(MAX_SIZE, max(1, int(request.query_params.get("size", ""))))
        except ValueError:
            size = DEFAULT_SIZE
        empty = {"workspaces": [], "spaces": [], "pages": [], "labels": []}
        if len(query) < MIN_LENGTH:
            return drf.response.Response(
                {"q": query, "involved": empty, "visible": dict(empty)}
            )

        # -- Workspaces
        member_of = models.WorkspaceAccess.objects.filter(user=user).values(
            "workspace_id"
        )
        workspace_match = Q(name__icontains=query) | Q(description__icontains=query)
        involved_workspaces = models.Workspace.objects.filter(
            workspace_match, id__in=member_of
        ).order_by("name")[:size]
        visible_workspaces = (
            models.Workspace.objects.filter(workspace_match)
            .filter(
                visibility__in=[
                    choices.WorkspaceVisibilityChoices.PUBLIC,
                    choices.WorkspaceVisibilityChoices.PLATFORM,
                ]
            )
            .exclude(id__in=member_of)
            .order_by("name")[:size]
        )

        # -- Spaces and pages: a role on them or above them is being involved
        has_role = models.DocumentAccess.objects.filter(
            Q(user=user) | Q(team__in=user.teams),
            document__path=Left(OuterRef("path"), Length("document__path")),
        )
        documents = (
            models.Document.objects.filter(
                ancestors_deleted_at__isnull=True, deleted_at__isnull=True
            )
            .filter(Q(title__icontains=query) | Q(text_content__icontains=query))
            .annotate(involved=Exists(has_role))
            .order_by("-updated_at")
        )
        mine = list(documents.filter(involved=True)[: size * 2])
        others = [
            document
            for document in documents.filter(involved=False)[
                : size * 2 * VISIBLE_CANDIDATES
            ]
            if document.get_abilities(user).get("retrieve")
        ]
        involved_spaces, involved_pages = _split(mine, query, size, user)
        visible_spaces, visible_pages = _split(others, query, size, user)

        involved_labels, visible_labels = _labels(query, member_of, has_role, size)

        return drf.response.Response(
            {
                "q": query,
                "involved": {
                    "workspaces": [_workspace(w) for w in involved_workspaces],
                    "spaces": involved_spaces,
                    "pages": involved_pages,
                    "labels": [label.name for label in involved_labels],
                },
                "visible": {
                    "workspaces": [_workspace(w) for w in visible_workspaces],
                    "spaces": visible_spaces,
                    "pages": visible_pages,
                    "labels": [label.name for label in visible_labels],
                },
            }
        )
