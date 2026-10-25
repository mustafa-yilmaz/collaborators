"""
Collaborators: the platform as its managers, administrators and owners see
it (see core.platform_roles).

    GET /api/v1.0/platform/people/?q=&role=&status=&page=
"""

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

import rest_framework as drf
from rest_framework import serializers
from rest_framework.generics import ListAPIView

from core import models, platform_roles
from core.api.registrations import IsPlatformManager
from core.choices import PlatformRoleChoices, RegistrationStatusChoices, RoleChoices


class PeoplePagination(drf.pagination.PageNumberPagination):
    """Fifty people a page."""

    page_size = 50


class PlatformPersonSerializer(serializers.ModelSerializer):
    """Someone on the platform, with their level and what they take part in."""

    email_verified = serializers.BooleanField(source="collaborator_email_verified")
    platform_role = serializers.CharField(source="platform_level")
    workspaces = serializers.IntegerField(source="nb_workspaces")
    pages = serializers.IntegerField(source="nb_pages")

    class Meta:
        model = models.User
        fields = [
            "id",
            "full_name",
            "email",
            "email_verified",
            "platform_role",
            "registration_status",
            "created_at",
            "last_login",
            "workspaces",
            "pages",
        ]
        read_only_fields = fields


def _count(queryset):
    """A count per person, as a subquery: no join multiplies the others."""
    return Coalesce(
        Subquery(
            queryset.values("user")
            .annotate(total=Count("pk", distinct=True))
            .values("total"),
            output_field=IntegerField(),
        ),
        0,
    )


class PlatformPeopleView(ListAPIView):
    """
    Everyone with an account, newest first, for platform managers and above:
    found by name or email, at one level, or with one registration status.
    """

    permission_classes = [IsPlatformManager]
    serializer_class = PlatformPersonSerializer
    pagination_class = PeoplePagination

    def get_queryset(self):
        params = self.request.query_params
        people = models.User.objects.filter(is_device=False, is_active=True)
        query = (params.get("q") or "").strip()
        if query:
            people = people.filter(
                Q(full_name__unaccent__icontains=query) | Q(email__icontains=query)
            )
        role = params.get("role")
        if role:
            if role not in PlatformRoleChoices.values:
                raise drf.exceptions.ValidationError({"role": "unknown level"})
            if role == platform_roles.OWNER:
                people = people.filter(Q(platform_role=role) | Q(is_superuser=True))
            else:
                people = people.filter(platform_role=role, is_superuser=False)
        status = params.get("status")
        if status:
            if status not in RegistrationStatusChoices.values:
                raise drf.exceptions.ValidationError({"status": "unknown status"})
            people = people.filter(registration_status=status)
        return people.annotate(
            nb_workspaces=_count(
                models.WorkspaceAccess.objects.filter(user=OuterRef("pk"))
            ),
            nb_pages=_count(
                models.DocumentAccess.objects.filter(
                    user=OuterRef("pk"),
                    role=RoleChoices.OWNER,
                    document__deleted_at__isnull=True,
                    document__ancestors_deleted_at__isnull=True,
                )
            ),
        ).order_by("-created_at")
