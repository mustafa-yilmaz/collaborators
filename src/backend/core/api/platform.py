"""
Collaborators: the platform as its managers, administrators and owners see
it (see core.platform_roles), and what they do to accounts (core.accounts).

    GET    /api/v1.0/platform/people/?q=&role=&status=&account=&page=
    POST   /api/v1.0/platform/people/<id>/suspend/      {reason}
    POST   /api/v1.0/platform/people/<id>/reinstate/
    GET    /api/v1.0/platform/people/<id>/removal/      what removing leaves
    POST   /api/v1.0/platform/people/<id>/remove/       {pages, recipient, reason, block}
    POST   /api/v1.0/platform/people/<id>/level/        {role}
    GET    /api/v1.0/platform/blocked/                  (owners)
    POST   /api/v1.0/platform/blocked/                  {email, reason} (owners)
    DELETE /api/v1.0/platform/blocked/<id>/             (owners)
"""

from django.db.models import Count, IntegerField, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

import rest_framework as drf
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.views import APIView

from core import accounts, models, platform_roles
from core.api import permissions
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
    suspended = serializers.SerializerMethodField()
    # The requester may suspend or remove them
    can_manage = serializers.SerializerMethodField()
    # The levels the requester may put them at
    levels_you_may_give = serializers.SerializerMethodField()

    def get_suspended(self, person):
        """Suspended until reinstated."""
        return person.suspended_at is not None

    def get_can_manage(self, person):
        """Below the requester's level, and not the requester."""
        return accounts.can_manage(self.context["request"].user, person)

    def get_levels_you_may_give(self, person):
        """Up to manager for an administrator, any for an owner."""
        return accounts.levels_one_may_give(self.context["request"].user, person)

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
            "suspended",
            "can_manage",
            "levels_you_may_give",
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
    found by name or email, at one level, with one registration status, or
    active or suspended.
    """

    permission_classes = [IsPlatformManager]
    serializer_class = PlatformPersonSerializer
    pagination_class = PeoplePagination

    def get_queryset(self):
        params = self.request.query_params
        # The suspended ones too (other inactive accounts are merged ones)
        people = models.User.objects.filter(
            Q(is_active=True) | Q(suspended_at__isnull=False), is_device=False
        )
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
        account = params.get("account")
        if account == "active":
            people = people.filter(suspended_at__isnull=True)
        elif account == "suspended":
            people = people.filter(suspended_at__isnull=False)
        elif account:
            raise drf.exceptions.ValidationError({"account": "active or suspended"})
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


class IsPlatformAdministrator(permissions.IsAuthenticated):
    """Platform administrators and owners."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and platform_roles.has_level(
            request.user, platform_roles.ADMINISTRATOR
        )


class IsPlatformOwner(permissions.IsAuthenticated):
    """Platform owners."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and platform_roles.has_level(
            request.user, platform_roles.OWNER
        )


def _reason(request):
    return str(request.data.get("reason") or "").strip()[:500]


class AccountActionView(APIView):
    """Suspend, reinstate, remove or appoint someone below one's level."""

    permission_classes = [IsPlatformAdministrator]
    action = None

    def _target(self, request, user_id):
        target = (
            models.User.objects.filter(id=user_id, is_device=False)
            .filter(Q(is_active=True) | Q(suspended_at__isnull=False))
            .first()
        )
        if target is None:
            raise drf.exceptions.NotFound()
        if not accounts.can_manage(request.user, target):
            raise drf.exceptions.PermissionDenied(
                "Only people below your own level, never yourself."
            )
        return target

    def get(self, request, user_id):
        """What removing them would leave without an owner."""
        if self.action != "remove":
            raise drf.exceptions.MethodNotAllowed("GET")
        return drf.response.Response(
            accounts.removal_preview(self._target(request, user_id))
        )

    def post(self, request, user_id):
        """Do it, and say what became of the sign-in server's account."""
        target = self._target(request, user_id)
        try:
            if self.action == "suspend":
                server = accounts.suspend(target, request.user, _reason(request))
            elif self.action == "reinstate":
                server = accounts.reinstate(target, request.user)
            elif self.action == "level":
                accounts.appoint(target, request.user, request.data.get("role"))
                return drf.response.Response({"platform_role": target.platform_level})
            else:
                recipient = None
                recipient_id = request.data.get("recipient")
                if recipient_id:
                    recipient = models.User.objects.filter(
                        id=recipient_id, is_active=True
                    ).first()
                    if recipient is None:
                        raise accounts.AccountError("This person can't receive pages.")
                server = accounts.remove(
                    target,
                    request.user,
                    pages=request.data.get("pages") or accounts.HAND_OVER,
                    recipient=recipient,
                    reason=_reason(request),
                    block=bool(request.data.get("block")),
                )
        except accounts.AccountError as err:
            raise drf.exceptions.ValidationError({"detail": str(err)}) from err
        return drf.response.Response({"sign_in_server": server})


def _blocked(blocked):
    return {
        "id": str(blocked.id),
        "email": blocked.email,
        "reason": blocked.reason,
        "blocked_by": platform_roles.display_name(blocked.blocked_by),
        "created_at": blocked.created_at,
        # Someone with an account here
        "has_account": models.User.objects.filter(email__iexact=blocked.email).exists(),
    }


class BlockedEmailListView(APIView):
    """The blocked emails, newest first; block one more."""

    permission_classes = [IsPlatformOwner]

    def get(self, request):
        """List them."""
        return drf.response.Response(
            [_blocked(blocked) for blocked in models.BlockedEmail.objects.all()]
        )

    def post(self, request):
        """Block an email, with or without an account here."""
        try:
            accounts.block_email(
                request.data.get("email"), request.user, _reason(request)
            )
        except accounts.AccountError as err:
            raise drf.exceptions.ValidationError({"detail": str(err)}) from err
        blocked = models.BlockedEmail.objects.get(
            email=accounts.normalize(request.data.get("email"))
        )
        return drf.response.Response(_blocked(blocked), status=201)


class BlockedEmailView(APIView):
    """Unblock an email."""

    permission_classes = [IsPlatformOwner]

    def delete(self, request, blocked_id):
        """It may sign in again."""
        blocked = models.BlockedEmail.objects.filter(id=blocked_id).first()
        if blocked is None:
            raise drf.exceptions.NotFound()
        accounts.unblock_email(blocked, request.user)
        return drf.response.Response(status=204)
