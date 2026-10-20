"""
Profiles: what collaborators tell about themselves, each piece shown to the
audience they chose (public, everyone on Collaborators, the people they work
with, or the members of chosen workspaces and spaces). A profile can't be
fully hidden: the name is always shown to the people one works with.

GET /api/v1.0/profiles/<user id>/  — what the viewer may see (anyone)
GET, PUT /api/v1.0/profiles/me/    — one's own profile and its settings
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.db.models import Q
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions
from core.utils.users import users_sharing_documents_with

AUDIENCES = [choice.value for choice in models.ProfileAudience]
TEXT_FIELDS = {
    "headline": 120,
    "organization": 120,
    "location": 120,
    "bio": 2000,
}
MAX_INTERESTS = 20


def profile_of(user):
    """The user's profile, made empty the first time."""
    profile, _created = models.UserProfile.objects.get_or_create(user=user)
    return profile


class Viewer:
    """How a viewer relates to a profile's owner, computed as needed."""

    def __init__(self, owner, viewer):
        self.owner = owner
        self.viewer = viewer
        self.is_self = viewer.is_authenticated and viewer.id == owner.id

    @cached_property
    def is_colleague(self):
        """Shares a workspace or a page with the owner."""
        if not self.viewer.is_authenticated:
            return False
        return self.is_self or self.owner.id in users_sharing_documents_with(
            self.viewer.id
        )

    def is_in(self, workspace_ids, space_ids):
        """A member of one of these workspaces, or has a role on these spaces."""
        if not self.viewer.is_authenticated:
            return False
        if (
            workspace_ids
            and models.WorkspaceAccess.objects.filter(
                user=self.viewer, workspace_id__in=workspace_ids
            ).exists()
        ):
            return True
        return any(
            space.get_role(self.viewer) is not None
            for space in models.Document.objects.filter(
                id__in=space_ids,
                kind=choices.DocumentKindChoices.SPACE,
                ancestors_deleted_at__isnull=True,
            )
        )

    def can_see(self, profile, field):
        """Whether the viewer may see this piece of the profile."""
        if self.is_self:
            return True
        audience = profile.audience(field)
        level = audience["level"]
        if level == models.ProfileAudience.PUBLIC:
            return True
        if level == models.ProfileAudience.PLATFORM:
            return self.viewer.is_authenticated
        if level == models.ProfileAudience.COLLEAGUES:
            return self.is_colleague
        return self.is_in(audience["workspaces"], audience["spaces"]) or (
            # the name can't be hidden from the people one works with
            field == "name" and self.is_colleague
        )


def visible_workspaces_of(owner, viewer):
    """The owner's workspaces that the viewer may know about."""
    workspaces = models.Workspace.objects.filter(accesses__user=owner)
    if viewer.is_authenticated:
        workspaces = workspaces.filter(
            Q(accesses__user=viewer)
            | Q(
                visibility__in=[
                    choices.WorkspaceVisibilityChoices.PUBLIC,
                    choices.WorkspaceVisibilityChoices.PLATFORM,
                ]
            )
        )
    else:
        workspaces = workspaces.filter(
            visibility=choices.WorkspaceVisibilityChoices.PUBLIC
        )
    return [
        {"id": str(workspace.id), "name": workspace.name}
        for workspace in workspaces.distinct().order_by("name")
    ]


def describe(owner, viewer):
    """The profile as the viewer may see it; None if hidden from them."""
    profile = profile_of(owner)
    relation = Viewer(owner, viewer)
    if not relation.can_see(profile, "name"):
        return None
    shown = {field: relation.can_see(profile, field) for field in models.PROFILE_FIELDS}
    return {
        "id": str(owner.id),
        "full_name": owner.full_name or "",
        "is_me": relation.is_self,
        "headline": profile.headline if shown["headline"] else "",
        "organization": profile.organization if shown["organization"] else "",
        "location": profile.location if shown["location"] else "",
        "bio": profile.bio if shown["bio"] else "",
        "website": profile.website if shown["website"] else "",
        "email": (owner.email or "") if shown["email"] else "",
        "interests": [label.name for label in profile.interests.order_by("key")]
        if shown["interests"]
        else [],
        "workspaces": visible_workspaces_of(owner, viewer)
        if shown["workspaces"]
        else [],
    }


class ProfileView(APIView):
    """Someone's profile, as much as the viewer may see."""

    permission_classes = [drf.permissions.AllowAny]

    def get(self, request, user_id):
        """The visible pieces; 404 when the profile is hidden from the viewer."""
        owner = models.User.objects.filter(id=user_id, is_active=True).first()
        if owner is None:
            raise drf.exceptions.NotFound()
        data = describe(owner, request.user)
        if data is None:
            raise drf.exceptions.NotFound()
        return drf.response.Response(data)


class MyProfileView(APIView):
    """One's own profile: every piece, who sees it, and what one can choose."""

    permission_classes = [permissions.IsAuthenticated]

    def _state(self, user):
        profile = profile_of(user)
        return {
            **describe(user, user),
            "visibility": {
                field: profile.audience(field) for field in models.PROFILE_FIELDS
            },
            # what "Chosen workspaces and spaces" can name
            "workspace_choices": [
                {"id": str(workspace.id), "name": workspace.name}
                for workspace in models.Workspace.objects.filter(
                    accesses__user=user
                ).order_by("name")
            ],
            "space_choices": [
                {"id": str(space.id), "title": space.title}
                for space in models.Document.objects.filter(
                    Q(accesses__user=user) | Q(accesses__team__in=user.teams),
                    kind=choices.DocumentKindChoices.SPACE,
                    ancestors_deleted_at__isnull=True,
                )
                .distinct()
                .order_by("title")
            ],
        }

    def get(self, request):
        """One's whole profile and its settings."""
        return drf.response.Response(self._state(request.user))

    def put(self, request):
        """Change the pieces given, their audiences, and the interests."""
        user = request.user
        profile = profile_of(user)
        data = request.data
        errors = {}
        _apply_texts(profile, data, errors)
        if "visibility" in data:
            _apply_visibility(profile, data["visibility"], user, errors)
        if errors:
            raise drf.exceptions.ValidationError(errors)

        with transaction.atomic():
            profile.save()
            if "interests" in data:
                _set_interests(profile, data["interests"], user)
        return drf.response.Response(self._state(user))


def _apply_texts(profile, data, errors):
    """The text pieces given, and the website as a web address."""
    for field, max_length in TEXT_FIELDS.items():
        if field in data:
            value = str(data[field] or "").strip()
            if len(value) > max_length:
                errors[field] = _("Too long.")
            setattr(profile, field, value)
    if "website" not in data:
        return
    website = str(data["website"] or "").strip()
    if website and not website.startswith(("https://", "http://")):
        website = f"https://{website}"
    if website:
        try:
            URLValidator(schemes=["http", "https"])(website)
        except DjangoValidationError:
            errors["website"] = _("Enter a web address.")
    profile.website = website


def _apply_visibility(profile, settings, user, errors):
    """Who sees each piece given; chosen workspaces must be one's own."""
    mine = {
        str(pk)
        for pk in models.Workspace.objects.filter(accesses__user=user).values_list(
            "id", flat=True
        )
    }
    visibility = {}
    for field, setting in (settings or {}).items():
        if field not in models.PROFILE_FIELDS or not isinstance(setting, dict):
            continue
        if setting.get("level") not in AUDIENCES:
            errors["visibility"] = _("Unknown audience.")
            continue
        visibility[field] = {
            "level": setting["level"],
            "workspaces": [
                str(pk) for pk in setting.get("workspaces") or [] if str(pk) in mine
            ],
            "spaces": [str(pk) for pk in setting.get("spaces") or []],
        }
    profile.visibility = {**(profile.visibility or {}), **visibility}


def _set_interests(profile, raw_names, user):
    """The interests, as labels of the shared vocabulary."""
    names = []
    for raw in raw_names or []:
        name = models.Label.normalize(raw)
        if name and name.lower() not in {other.lower() for other in names}:
            names.append(name)
    profile.interests.set(
        [models.Label.get_or_create_named(name, user) for name in names[:MAX_INTERESTS]]
    )
