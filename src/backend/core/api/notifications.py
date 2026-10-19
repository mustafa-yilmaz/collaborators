"""
The notification inbox of the logged-in collaborator: mentions, mentions of
their groups, assignments in Loop tables, and requests to join a workspace
(for its admins) and their approval.

GET  /api/v1.0/notifications/?unread=true  — latest notifications
GET  /api/v1.0/notifications/unread-count/
POST /api/v1.0/notifications/<id>/read/
POST /api/v1.0/notifications/read-all/
GET, PATCH /api/v1.0/notifications/preferences/  — {"email": bool}
"""

from django.db.models import Q
from django.utils import timezone

import rest_framework as drf
from rest_framework import mixins, serializers, viewsets

from core import models
from core.api import permissions

# pylint: disable=too-many-ancestors

INBOX_SIZE = 50


class NotificationSerializer(serializers.ModelSerializer):
    """Serialize inbox entries with what is needed to show and open them."""

    actor = serializers.SerializerMethodField()
    document = serializers.SerializerMethodField()
    workspace = serializers.SerializerMethodField()
    team_label = serializers.SerializerMethodField()

    class Meta:
        model = models.Notification
        fields = [
            "id",
            "kind",
            "actor",
            "document",
            "workspace",
            "anchor_id",
            "thread_id",
            "team",
            "team_label",
            "created_at",
            "read_at",
        ]
        read_only_fields = fields

    def get_actor(self, instance):
        """Who mentioned or assigned."""
        if instance.actor is None:
            return None
        return {
            "id": str(instance.actor.id),
            "full_name": instance.actor.full_name or instance.actor.email,
        }

    def get_document(self, instance):
        """Where."""
        if instance.document is None:
            return None
        return {"id": str(instance.document.id), "title": instance.document.title}

    def get_workspace(self, instance):
        """The workspace someone asks to join, or was let in."""
        if instance.workspace is None:
            return None
        return {"id": str(instance.workspace.id), "name": instance.workspace.name}

    def get_team_label(self, instance):
        """The group the recipient was reached through, if any."""
        return models.get_team_label(instance.team) if instance.team else None


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """The logged-in collaborator's notifications."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = None

    def get_queryset(self):
        """Only my notifications, on documents that still exist."""
        queryset = models.Notification.objects.filter(
            Q(document__isnull=True) | Q(document__ancestors_deleted_at__isnull=True),
            recipient=self.request.user,
        ).select_related("actor", "document", "workspace")
        if self.request.query_params.get("unread") in ("true", "1"):
            queryset = queryset.filter(read_at__isnull=True)
        return queryset

    def list(self, request, *args, **kwargs):
        """The latest notifications only."""
        serializer = self.get_serializer(self.get_queryset()[:INBOX_SIZE], many=True)
        return drf.response.Response(serializer.data)

    @drf.decorators.action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """How many notifications are unread, for the bell's badge."""
        count = self.get_queryset().filter(read_at__isnull=True).count()
        return drf.response.Response({"count": count})

    @drf.decorators.action(detail=True, methods=["post"], url_path="read")
    def read(self, request, pk=None):
        """Mark one notification as read."""
        notification = self.get_queryset().filter(pk=pk).first()
        if notification is None:
            raise drf.exceptions.NotFound()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at", "updated_at"])
        return drf.response.Response(self.get_serializer(notification).data)

    @drf.decorators.action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request):
        """Mark every notification as read."""
        self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return drf.response.Response(status=drf.status.HTTP_204_NO_CONTENT)

    @drf.decorators.action(
        detail=False, methods=["get", "patch"], url_path="preferences"
    )
    def preferences(self, request):
        """Whether notifications are also sent by email."""
        user = request.user
        if request.method == "PATCH":
            email = request.data.get("email")
            if not isinstance(email, bool):
                raise drf.exceptions.ValidationError({"email": "Must be a boolean."})
            user.collaborator_email_notifications = email
            user.save(update_fields=["collaborator_email_notifications", "updated_at"])
        return drf.response.Response({"email": user.collaborator_email_notifications})
