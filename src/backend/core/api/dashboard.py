"""
What the Collaborators dashboard needs from the server.

GET, PUT  /api/v1.0/dashboard/layout/    — the collaborator's card layout
GET       /api/v1.0/dashboard/recent/    — recently updated pages I can read
GET       /api/v1.0/dashboard/assigned/  — table rows assigned to me or my groups
POST, DELETE /api/v1.0/documents/<id>/assignments/ — keep the assignments
    index in step with the Person cells of a page's Loop tables
"""

from django.db.models import Q

import rest_framework as drf
from rest_framework import serializers, status
from rest_framework.views import APIView

from core import choices, models, notifications
from core.api import permissions
from core.api.utils import filter_root_paths
from core.utils.anchors import is_valid_anchor

DASHBOARD_MAX_CARDS = 30
RECENT_SIZE = 8
ASSIGNED_SIZE = 20

# pylint: disable=abstract-method


class LayoutCardSerializer(serializers.Serializer):
    """One card of the dashboard, in the order shown."""

    id = serializers.RegexField(r"^[a-z0-9-]{1,40}$")
    hidden = serializers.BooleanField(default=False)
    collapsed = serializers.BooleanField(default=False)
    # Shown across both columns rather than in one
    wide = serializers.BooleanField(default=False)


class DashboardLayoutView(APIView):
    """The collaborator's own dashboard layout, kept on the server."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """The saved layout; empty means the default one."""
        return drf.response.Response(request.user.collaborator_dashboard or [])

    def put(self, request):
        """Save the layout."""
        serializer = LayoutCardSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        cards = serializer.validated_data[:DASHBOARD_MAX_CARDS]
        request.user.collaborator_dashboard = cards
        request.user.save(update_fields=["collaborator_dashboard", "updated_at"])
        return drf.response.Response(cards)


def readable_roots(user):
    """Paths of the topmost documents the user reaches by an access or a link."""
    access_ids = models.DocumentAccess.objects.filter(
        Q(user=user) | Q(team__in=user.teams)
    ).values_list("document_id", flat=True)
    traced_ids = (
        models.LinkTrace.objects.filter(user=user)
        .exclude(document__link_reach=choices.LinkReachChoices.RESTRICTED)
        .values_list("document_id", flat=True)
    )
    paths = models.Document.objects.filter(
        Q(id__in=access_ids) | Q(id__in=traced_ids),
        ancestors_deleted_at__isnull=True,
    ).values_list("path", flat=True)
    return filter_root_paths(list(paths))


class DashboardRecentView(APIView):
    """Pages (and spaces) recently updated, among those I can read."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """The latest updated documents, with the space they are in."""
        roots = readable_roots(request.user)
        if not roots:
            return drf.response.Response([])
        in_my_trees = Q()
        for path in roots:
            in_my_trees |= Q(path__startswith=path)
        documents = list(
            models.Document.objects.filter(
                in_my_trees, ancestors_deleted_at__isnull=True
            ).order_by("-updated_at")[:RECENT_SIZE]
        )
        steplen = models.Document.steplen
        spaces = {
            space.path: space
            for space in models.Document.objects.filter(
                path__in={doc.path[:steplen] for doc in documents},
                kind=choices.DocumentKindChoices.SPACE,
            )
        }
        return drf.response.Response(
            [
                {
                    "id": str(doc.id),
                    "title": doc.title,
                    "kind": doc.kind,
                    "excerpt": doc.excerpt or "",
                    "updated_at": doc.updated_at,
                    "space": (
                        {
                            "id": str(spaces[doc.path[:steplen]].id),
                            "title": spaces[doc.path[:steplen]].title,
                        }
                        if doc.path[:steplen] in spaces and not doc.is_space
                        else None
                    ),
                }
                for doc in documents
            ]
        )


class DashboardAssignedView(APIView):
    """What is assigned to me or one of my groups: table rows, or page blocks."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """The latest assignments on pages I can still read."""
        user = request.user
        assignments = (
            models.TableAssignment.objects.filter(
                Q(assignee=user) | Q(team__in=user.teams),
                document__ancestors_deleted_at__isnull=True,
            )
            .select_related("document", "assigned_by")
            .order_by("-updated_at")
        )
        results = []
        for assignment in assignments[: ASSIGNED_SIZE * 2]:
            if assignment.document.get_role(user) is None:
                continue
            results.append(
                {
                    "id": str(assignment.id),
                    "document": {
                        "id": str(assignment.document.id),
                        "title": assignment.document.title,
                    },
                    "anchor_id": assignment.anchor_id,
                    "row_label": assignment.row_label,
                    "team_label": (
                        models.get_team_label(assignment.team)
                        if assignment.team
                        else None
                    ),
                    "assigned_by": (
                        assignment.assigned_by.full_name or assignment.assigned_by.email
                        if assignment.assigned_by
                        else None
                    ),
                    "updated_at": assignment.updated_at,
                }
            )
            if len(results) == ASSIGNED_SIZE:
                break
        return drf.response.Response(results)


class AssignmentSerializer(serializers.Serializer):
    """
    A person or a group set in, or removed from, a Person cell, or assigned
    a block of the page (a mention marked as an assignment).
    """

    # A table cell, or a block anywhere in the page (to-do items...)
    anchor_id = serializers.CharField(max_length=200)

    def validate_anchor_id(self, value):
        """A Loop table cell or a page block."""
        if not is_valid_anchor(value):
            raise serializers.ValidationError("Unknown place in the page.")
        return value

    assignee_id = serializers.PrimaryKeyRelatedField(
        queryset=models.User.objects.filter(is_active=True),
        required=False,
        allow_null=True,
        default=None,
    )
    team = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    row_label = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )

    def validate(self, attrs):
        """A person or a group, not both."""
        if bool(attrs.get("assignee_id")) == bool(attrs.get("team")):
            raise serializers.ValidationError("Assign either a user or a group.")
        if attrs.get("team") and models.parse_team(attrs["team"])[0] is None:
            raise serializers.ValidationError({"team": "Unknown group."})
        return attrs


class DocumentAssignmentsView(APIView):
    """Record (and notify) or remove an assignment in a page: a table's row or any block."""

    permission_classes = [permissions.IsAuthenticated]

    def _document(self, request, resource_id):
        document = models.Document.objects.filter(
            pk=resource_id, ancestors_deleted_at__isnull=True
        ).first()
        if document is None or document.get_role(request.user) is None:
            raise drf.exceptions.NotFound()
        if not document.get_abilities(request.user)["update"]:
            raise drf.exceptions.PermissionDenied()
        return document

    def post(self, request, resource_id):
        """Someone was set in a Person cell: index it and notify them."""
        document = self._document(request, resource_id)
        serializer = AssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        assignee = data["assignee_id"]

        assignment, created = models.TableAssignment.objects.update_or_create(
            document=document,
            anchor_id=data["anchor_id"],
            assignee=assignee,
            team=data["team"],
            defaults={"row_label": data["row_label"], "assigned_by": request.user},
        )
        if created:
            if assignee is None:
                notifications.mention_team(
                    document,
                    request.user,
                    data["team"],
                    data["anchor_id"],
                    reason="assignment",
                )
            elif notifications.can_be_notified(document, assignee, False):
                mention = models.Mention.objects.create(
                    document=document,
                    anchor_id=data["anchor_id"],
                    mentioned_user=assignee,
                    mentioned_by_user=request.user,
                    reason="assignment",
                )
                notifications.notify(mention)
        return drf.response.Response(
            {"id": str(assignment.id)},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, resource_id):
        """Someone was removed from a Person cell."""
        document = self._document(request, resource_id)
        serializer = AssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        models.TableAssignment.objects.filter(
            document=document,
            anchor_id=data["anchor_id"],
            assignee=data["assignee_id"],
            team=data["team"],
        ).delete()
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


# The lists of "My collaborations" one can reorder (the trash stays last)
SIDEBAR_ITEMS = (
    "recent",
    "notifications",
    # The Search screen (formerly "Explore")
    "explore",
    "owned",
    "shared",
    "starred",
)


class SidebarOrderView(APIView):
    """
    GET, PUT /api/v1.0/dashboard/sidebar/ — the order of the lists of "My
    collaborations" in the left panel, chosen by the collaborator.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """The saved order; empty means the default one."""
        return drf.response.Response(request.user.collaborator_sidebar or [])

    def put(self, request):
        """Save an order: known items, each once."""
        order = request.data
        if (
            not isinstance(order, list)
            or len(set(order)) != len(order)
            or any(item not in SIDEBAR_ITEMS for item in order)
        ):
            raise drf.exceptions.ValidationError({"order": ", ".join(SIDEBAR_ITEMS)})
        request.user.collaborator_sidebar = order
        request.user.save(update_fields=["collaborator_sidebar", "updated_at"])
        return drf.response.Response(order)


class SidebarSideView(APIView):
    """
    GET, PUT /api/v1.0/dashboard/sidebar/side/ — {"side": "left" | "right"}:
    which side of the screen the left panel stands on, mirrored on the right.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """The side chosen, left until one moves it."""
        return drf.response.Response({"side": request.user.collaborator_sidebar_side})

    def put(self, request):
        """Move the panel to a side."""
        side = request.data.get("side") if isinstance(request.data, dict) else None
        if side not in ("left", "right"):
            raise drf.exceptions.ValidationError({"side": "left, right"})
        request.user.collaborator_sidebar_side = side
        request.user.save(update_fields=["collaborator_sidebar_side", "updated_at"])
        return drf.response.Response({"side": side})
