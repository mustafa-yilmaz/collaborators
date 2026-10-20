"""
Collaborators: the registrations platform administrators decide on (see
core.registrations).

    GET  /api/v1.0/registrations/?status=pending|declined
    POST /api/v1.0/registrations/<user id>/approve/
    POST /api/v1.0/registrations/<user id>/decline/
"""

import rest_framework as drf
from rest_framework.views import APIView

from core import models, registrations
from core.api import permissions


class IsPlatformAdmin(permissions.IsAuthenticated):
    """Only platform administrators (staff users) decide on registrations."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.is_staff


def _registration(user):
    return {
        "id": str(user.id),
        "full_name": user.full_name or "",
        "email": user.email or "",
        "email_verified": user.collaborator_email_verified,
        "status": user.registration_status,
        "created_at": user.created_at,
    }


class RegistrationListView(APIView):
    """The newcomers waiting (default), or those declined, oldest first."""

    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        """List the registrations of one status."""
        status = request.query_params.get("status") or registrations.PENDING
        if status not in (registrations.PENDING, registrations.DECLINED):
            raise drf.exceptions.ValidationError({"status": "pending or declined"})
        users = models.User.objects.filter(
            registration_status=status, is_active=True
        ).order_by("created_at")
        return drf.response.Response([_registration(user) for user in users])


class RegistrationDecisionView(APIView):
    """Approve or decline one registration (a declined one can be approved)."""

    permission_classes = [IsPlatformAdmin]
    decision = None

    def post(self, request, user_id):
        """Let the newcomer in, or say no; they are told by email."""
        user = models.User.objects.filter(
            id=user_id,
            registration_status__in=[registrations.PENDING, registrations.DECLINED],
        ).first()
        if user is None:
            raise drf.exceptions.NotFound()
        if self.decision == "approve":
            registrations.approve(user, request.user)
        elif user.registration_status == registrations.PENDING:
            registrations.decline(user)
        return drf.response.Response(_registration(user))
