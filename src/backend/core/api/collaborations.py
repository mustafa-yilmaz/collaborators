"""
Collaborators: "My collaborations" in the left panel. Each view lists three
kinds of places a collaborator is involved in:

- workspaces;
- spaces outside any workspace (independent spaces);
- pages outside any workspace or space (independent pages).

    GET /api/v1.0/collaborations/?view=owned|recent|shared|starred
    POST, DELETE /api/v1.0/workspaces/<id>/favorite/ — star a workspace

owned: what the collaborator owns (created). recent: the latest they are
involved in, a few of each. shared: what others let them into (not owned).
starred: what they starred.
"""

from django.db.models import Exists, Max, OuterRef, Q
from django.db.models.functions import Coalesce, Greatest

import rest_framework as drf
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions

# "Recent": how many of each kind
RECENT_SIZE = 6
# The other views: a safety bound only
LIST_SIZE = 200

VIEWS = ("owned", "recent", "shared", "starred")


def _top_documents(user):
    """Top-level pages and spaces of the user's reach, not deleted."""
    reachable = models.DocumentAccess.objects.filter(
        Q(user=user) | Q(team__in=user.teams), document=OuterRef("pk")
    )
    owned = models.DocumentAccess.objects.filter(
        user=user, role=choices.RoleChoices.OWNER, document=OuterRef("pk")
    )
    starred = models.DocumentFavorite.objects.filter(user=user, document=OuterRef("pk"))
    return (
        models.Document.objects.filter(
            depth=1,
            ancestors_deleted_at__isnull=True,
            deleted_at__isnull=True,
            workspace_links__isnull=True,
        )
        .annotate(
            is_reachable=Exists(reachable),
            is_owned=Exists(owned),
            is_favorite=Exists(starred),
        )
        # Collaborators: a starred page stays listed only while it can be
        # opened (its link, or a space it is linked into)
        .filter(
            Q(is_reachable=True)
            | Q(is_favorite=True)
            & (
                ~Q(link_reach=choices.LinkReachChoices.RESTRICTED)
                | Exists(models.linked_reader_access(user))
            )
        )
    )


def _document(document):
    return {
        "id": str(document.id),
        "title": document.title or "",
        "kind": document.kind,
        "updated_at": document.updated_at,
        "is_owned": document.is_owned,
        "is_favorite": document.is_favorite,
    }


def _workspaces(user):
    """The workspaces the user belongs to, with their latest activity."""
    starred = models.WorkspaceFavorite.objects.filter(
        user=user, workspace=OuterRef("pk")
    )
    return (
        models.Workspace.objects.filter(accesses__user=user)
        .annotate(
            last_activity=Greatest(
                "updated_at",
                Coalesce(Max("space_links__space__updated_at"), "updated_at"),
            ),
            is_favorite=Exists(starred),
        )
        .distinct()
    )


def _workspace(workspace, user):
    role = workspace.accesses.filter(user=user).values_list("role", flat=True).first()
    return {
        "id": str(workspace.id),
        "name": workspace.name,
        "slug": workspace.slug,
        "role": role,
        "updated_at": workspace.last_activity,
        "is_favorite": workspace.is_favorite,
    }


class CollaborationsView(APIView):
    """One of the views of "My collaborations"."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Workspaces, independent spaces and independent pages of one view."""
        user = request.user
        view = request.query_params.get("view") or "recent"
        if view not in VIEWS:
            raise drf.exceptions.ValidationError({"view": ", ".join(VIEWS)})

        workspaces = _workspaces(user)
        documents = _top_documents(user)
        owned_workspaces = models.WorkspaceAccess.objects.filter(
            user=user, role=choices.WorkspaceRoleChoices.OWNER
        ).values("workspace_id")
        if view == "owned":
            workspaces = workspaces.filter(id__in=owned_workspaces)
            documents = documents.filter(is_owned=True)
        elif view == "shared":
            workspaces = workspaces.exclude(id__in=owned_workspaces)
            documents = documents.filter(is_reachable=True, is_owned=False)
        elif view == "starred":
            workspaces = workspaces.filter(is_favorite=True)
            documents = documents.filter(is_favorite=True)

        size = RECENT_SIZE if view == "recent" else LIST_SIZE
        if view == "recent":
            workspaces = workspaces.order_by("-last_activity")
            spaces = documents.filter(kind=choices.DocumentKindChoices.SPACE)
            pages = documents.exclude(kind=choices.DocumentKindChoices.SPACE)
            spaces = spaces.order_by("-updated_at")
            pages = pages.order_by("-updated_at")
        else:
            workspaces = workspaces.order_by("name")
            spaces = documents.filter(kind=choices.DocumentKindChoices.SPACE)
            pages = documents.exclude(kind=choices.DocumentKindChoices.SPACE)
            spaces = spaces.order_by("title")
            pages = pages.order_by("-updated_at")

        return drf.response.Response(
            {
                "view": view,
                "workspaces": [_workspace(item, user) for item in workspaces[:size]],
                "spaces": [_document(item) for item in spaces[:size]],
                "pages": [_document(item) for item in pages[:size]],
            }
        )


class WorkspaceFavoriteView(APIView):
    """Star a workspace one belongs to, or not any more."""

    permission_classes = [permissions.IsAuthenticated]

    def _workspace(self, request, workspace_id):
        workspace = models.Workspace.objects.filter(id=workspace_id).first()
        if workspace is None or workspace.get_role(request.user) is None:
            raise drf.exceptions.NotFound()
        return workspace

    def post(self, request, workspace_id):
        """Star it."""
        workspace = self._workspace(request, workspace_id)
        models.WorkspaceFavorite.objects.get_or_create(
            user=request.user, workspace=workspace
        )
        return drf.response.Response({"is_favorite": True})

    def delete(self, request, workspace_id):
        """Unstar it."""
        workspace = self._workspace(request, workspace_id)
        models.WorkspaceFavorite.objects.filter(
            user=request.user, workspace=workspace
        ).delete()
        return drf.response.Response({"is_favorite": False})
