"""
API endpoints for the structure Collaborators adds on top of documents:
workspaces, their members and groups, and spaces.

A space is a root document of kind "space": its pages are its descendants, so
they inherit its accesses. Groups and workspaces are granted on documents as
teams (see `core.models.make_team`), which is how existing team accesses
already work.
"""

from django.db import transaction
from django.db.models import Count, Q
from django.utils.functional import cached_property
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions
from core.api.serializers import ListDocumentSerializer, UserSerializer
from core.utils.treebeard import create_tree_node_with_retry

# pylint: disable=abstract-method,too-many-ancestors

# -- Serializers


class WorkspaceSerializer(serializers.ModelSerializer):
    """Serialize workspaces."""

    abilities = serializers.SerializerMethodField(read_only=True)
    user_role = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = models.Workspace
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "abilities",
            "user_role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "slug",
            "abilities",
            "user_role",
            "created_at",
            "updated_at",
        ]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the workspace."""
        return instance.get_abilities(self.context["request"].user)

    def get_user_role(self, instance):
        """Return the role of the logged-in user in the workspace."""
        return instance.get_role(self.context["request"].user)


class WorkspaceAccessSerializer(serializers.ModelSerializer):
    """Serialize the members of a workspace."""

    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=models.User.objects.all(), write_only=True, source="user"
    )

    class Meta:
        model = models.WorkspaceAccess
        fields = ["id", "user", "user_id", "role", "created_at"]
        read_only_fields = ["id", "created_at"]

    def update(self, instance, validated_data):
        """The member of an access can't be changed, only its role."""
        validated_data.pop("user", None)
        return super().update(instance, validated_data)


class GroupSerializer(serializers.ModelSerializer):
    """Serialize groups."""

    abilities = serializers.SerializerMethodField(read_only=True)
    nb_members = serializers.IntegerField(read_only=True)
    team = serializers.CharField(read_only=True)

    class Meta:
        model = models.Group
        fields = [
            "id",
            "workspace",
            "name",
            "kind",
            "description",
            "team",
            "nb_members",
            "abilities",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "workspace",
            "team",
            "nb_members",
            "abilities",
            "created_at",
        ]

    def get_abilities(self, instance) -> dict:
        """Return abilities of the logged-in user on the group."""
        return instance.get_abilities(self.context["request"].user)


class GroupMembershipSerializer(serializers.ModelSerializer):
    """Serialize the members of a group."""

    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=models.User.objects.all(), write_only=True, source="user"
    )

    class Meta:
        model = models.GroupMembership
        fields = ["id", "user", "user_id", "is_manager", "created_at"]
        read_only_fields = ["id", "created_at"]

    def update(self, instance, validated_data):
        """The member of a membership can't be changed, only its manager flag."""
        validated_data.pop("user", None)
        return super().update(instance, validated_data)


class SpaceSerializer(ListDocumentSerializer):
    """Serialize spaces, with the workspaces they are placed in."""

    linked_workspaces = serializers.SerializerMethodField(read_only=True)

    class Meta(ListDocumentSerializer.Meta):
        fields = [*ListDocumentSerializer.Meta.fields, "linked_workspaces"]
        read_only_fields = fields

    def get_linked_workspaces(self, instance):
        """All the workspaces the space appears in, its home first."""
        return [
            {
                "id": str(link.workspace.id),
                "name": link.workspace.name,
                "slug": link.workspace.slug,
                "is_home": link.is_home,
            }
            for link in instance.workspace_links.select_related("workspace")
        ]


class SpaceCreateSerializer(serializers.Serializer):
    """Validate the creation of a space."""

    title = serializers.CharField(max_length=255)
    workspace_id = serializers.UUIDField(required=False, allow_null=True)
    visibility = serializers.ChoiceField(
        choices=choices.SpaceVisibilityChoices.choices,
        default=choices.SpaceVisibilityChoices.INVITED,
    )
    editor_user_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    editor_group_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )

    def validate(self, attrs):
        """Check the workspace membership and the editors."""
        user = self.context["request"].user
        workspace = None

        if attrs.get("workspace_id"):
            workspace = models.Workspace.objects.filter(
                id=attrs["workspace_id"]
            ).first()
            if workspace is None or workspace.get_role(user) is None:
                raise serializers.ValidationError(
                    {"workspace_id": _("You are not a member of this workspace.")}
                )
        elif attrs["visibility"] == choices.SpaceVisibilityChoices.WORKSPACE:
            raise serializers.ValidationError(
                {"visibility": _("An independent space has no workspace members.")}
            )

        users = list(models.User.objects.filter(id__in=attrs["editor_user_ids"]))
        if len(users) != len(set(attrs["editor_user_ids"])):
            raise serializers.ValidationError(
                {"editor_user_ids": _("Some of these collaborators don't exist.")}
            )

        groups = list(models.Group.objects.filter(id__in=attrs["editor_group_ids"]))
        if len(groups) != len(set(attrs["editor_group_ids"])) or any(
            workspace is None or group.workspace_id != workspace.id for group in groups
        ):
            raise serializers.ValidationError(
                {"editor_group_ids": _("Groups must belong to the space's workspace.")}
            )

        attrs["workspace"] = workspace
        attrs["editor_users"] = users
        attrs["editor_groups"] = groups
        return attrs


class WorkspaceGrantSerializer(serializers.Serializer):
    """A role granted on a space to a group or to all members of a workspace."""

    team = serializers.CharField(max_length=100)
    role = serializers.ChoiceField(
        choices=[role for role in choices.RoleChoices.choices if role[0] != "owner"],
        default=choices.RoleChoices.READER,
    )


# -- Helpers


def get_team_workspace_id(team):
    """Return the id of the workspace a team string belongs to, or None."""
    kind, obj_id = models.parse_team(team)
    if kind in (models.TEAM_WORKSPACE, models.TEAM_WORKSPACE_ADMINS):
        return obj_id
    if kind == models.TEAM_GROUP:
        return (
            models.Group.objects.filter(id=obj_id)
            .values_list("workspace_id", flat=True)
            .first()
        )
    return None


def get_workspace_teams(workspace):
    """All the team strings that belong to a workspace."""
    return [
        models.make_team(models.TEAM_WORKSPACE, workspace.id),
        models.make_team(models.TEAM_WORKSPACE_ADMINS, workspace.id),
        *[
            models.make_team(models.TEAM_GROUP, group_id)
            for group_id in workspace.groups.values_list("id", flat=True)
        ],
    ]


def place_space_in_workspace(space, workspace):
    """Make a workspace the home of a space; its administrators own the space."""
    models.SpaceWorkspaceLink.objects.update_or_create(
        space=space, workspace=workspace, defaults={"is_home": True}
    )
    models.DocumentAccess.objects.update_or_create(
        document=space,
        team=models.make_team(models.TEAM_WORKSPACE_ADMINS, workspace.id),
        defaults={"role": choices.RoleChoices.OWNER},
    )


def is_workspace_admin(workspace, user):
    """True if the user owns or administers the workspace."""
    return workspace.get_role(user) in choices.WORKSPACE_PRIVILEGED_ROLES


# -- Viewsets


class WorkspaceViewSet(viewsets.ModelViewSet):
    """
    Workspaces of the logged-in collaborator.

    GET /api/v1.0/workspaces/ — the workspaces I belong to
    POST /api/v1.0/workspaces/ — create a workspace, I become its owner
    GET, PATCH, DELETE /api/v1.0/workspaces/<id>/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceSerializer
    pagination_class = None

    def get_queryset(self):
        """Only the workspaces the user belongs to."""
        return models.Workspace.objects.filter(
            accesses__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        """The creator becomes the owner of the workspace."""
        with transaction.atomic():
            workspace = serializer.save()
            models.WorkspaceAccess.objects.create(
                workspace=workspace,
                user=self.request.user,
                role=choices.WorkspaceRoleChoices.OWNER,
            )

    def perform_update(self, serializer):
        """Only administrators can rename a workspace."""
        if not is_workspace_admin(serializer.instance, self.request.user):
            raise drf.exceptions.PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        """Only owners delete a workspace; its spaces become independent."""
        if instance.get_role(self.request.user) != choices.WorkspaceRoleChoices.OWNER:
            raise drf.exceptions.PermissionDenied()
        with transaction.atomic():
            models.DocumentAccess.objects.filter(
                team__in=get_workspace_teams(instance)
            ).delete()
            instance.delete()


class WorkspaceNestedMixin:
    """Resolve the workspace of a nested route and check membership."""

    @cached_property
    def workspace(self):
        """The workspace in the URL, if the user belongs to it."""
        workspace = models.Workspace.objects.filter(
            id=self.kwargs["resource_id"]
        ).first()
        if workspace is None or workspace.get_role(self.request.user) is None:
            raise drf.exceptions.NotFound()
        return workspace

    def check_workspace_admin(self):
        """Raise unless the user administers the workspace."""
        if not is_workspace_admin(self.workspace, self.request.user):
            raise drf.exceptions.PermissionDenied()


class WorkspaceAccessViewSet(WorkspaceNestedMixin, viewsets.ModelViewSet):
    """
    Members of a workspace. Members can list them; administrators add existing
    collaborators, change roles and remove members; anyone can leave.

    /api/v1.0/workspaces/<resource_id>/accesses/[<id>/]
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WorkspaceAccessSerializer
    pagination_class = None

    def get_queryset(self):
        """Members of the workspace in the URL."""
        return self.workspace.accesses.select_related("user").order_by(
            "user__full_name", "user__email"
        )

    def _check_role_change(self, role):
        """Only owners can make or unmake owners."""
        if (
            role == choices.WorkspaceRoleChoices.OWNER
            and self.workspace.get_role(self.request.user)
            != choices.WorkspaceRoleChoices.OWNER
        ):
            raise drf.exceptions.PermissionDenied(
                _("Only an owner can make someone an owner.")
            )

    def _check_not_last_owner(self, access):
        """A workspace always keeps at least one owner."""
        if (
            access.role == choices.WorkspaceRoleChoices.OWNER
            and self.workspace.accesses.filter(
                role=choices.WorkspaceRoleChoices.OWNER
            ).count()
            == 1
        ):
            raise drf.exceptions.ValidationError(
                {"role": _("A workspace must keep at least one owner.")}
            )

    def perform_create(self, serializer):
        """Administrators add existing collaborators."""
        self.check_workspace_admin()
        self._check_role_change(serializer.validated_data.get("role"))
        serializer.save(workspace=self.workspace)

    def perform_update(self, serializer):
        """Administrators change roles."""
        self.check_workspace_admin()
        new_role = serializer.validated_data.get("role", serializer.instance.role)
        self._check_role_change(new_role)
        self._check_role_change(serializer.instance.role)
        if new_role != choices.WorkspaceRoleChoices.OWNER:
            self._check_not_last_owner(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        """Administrators remove members; members can leave."""
        if instance.user_id != self.request.user.id:
            self.check_workspace_admin()
            self._check_role_change(instance.role)
        self._check_not_last_owner(instance)
        with transaction.atomic():
            models.GroupMembership.objects.filter(
                group__workspace=self.workspace, user_id=instance.user_id
            ).delete()
            instance.delete()


class GroupViewSet(WorkspaceNestedMixin, viewsets.ModelViewSet):
    """
    Groups of a workspace. Members can list them; administrators manage them.

    /api/v1.0/workspaces/<resource_id>/groups/[<id>/]
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GroupSerializer
    pagination_class = None

    def get_queryset(self):
        """Groups of the workspace in the URL, with their size."""
        return self.workspace.groups.annotate(nb_members=Count("memberships"))

    def perform_create(self, serializer):
        """Administrators create groups."""
        self.check_workspace_admin()
        serializer.save(workspace=self.workspace)

    def perform_update(self, serializer):
        """Administrators rename groups."""
        self.check_workspace_admin()
        serializer.save()

    def perform_destroy(self, instance):
        """Administrators delete groups, and the accesses granted to them."""
        self.check_workspace_admin()
        with transaction.atomic():
            models.DocumentAccess.objects.filter(team=instance.team).delete()
            instance.delete()


class GroupMembershipViewSet(viewsets.ModelViewSet):
    """
    Members of a group. Workspace members can list them; workspace
    administrators and group managers add and remove them.

    /api/v1.0/groups/<resource_id>/members/[<id>/]
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = GroupMembershipSerializer
    pagination_class = None

    @cached_property
    def group(self):
        """The group in the URL, if the user belongs to its workspace."""
        group = (
            models.Group.objects.filter(id=self.kwargs["resource_id"])
            .select_related("workspace")
            .first()
        )
        if group is None or group.workspace.get_role(self.request.user) is None:
            raise drf.exceptions.NotFound()
        return group

    def get_queryset(self):
        """Members of the group in the URL."""
        return self.group.memberships.select_related("user").order_by(
            "user__full_name", "user__email"
        )

    def _check_manager(self):
        if not self.group.get_abilities(self.request.user)["manage_members"]:
            raise drf.exceptions.PermissionDenied()

    def perform_create(self, serializer):
        """Only members of the workspace can join its groups."""
        self._check_manager()
        user = serializer.validated_data["user"]
        if self.group.workspace.get_role(user) is None:
            raise drf.exceptions.ValidationError(
                {"user_id": _("Add this collaborator to the workspace first.")}
            )
        serializer.save(group=self.group)

    def perform_update(self, serializer):
        """Only workspace administrators appoint group managers."""
        if not is_workspace_admin(self.group.workspace, self.request.user):
            raise drf.exceptions.PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        """Managers remove members; members can leave."""
        if instance.user_id != self.request.user.id:
            self._check_manager()
        instance.delete()


class GrantableTeamsView(APIView):
    """
    GET /api/v1.0/groups/?document_id=<id>&q=<text>

    The groups and workspaces the logged-in user can grant a role to on a
    document: those of the workspaces its space is placed in and that the user
    belongs to. Independent pages and spaces have none.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Search grantable teams."""
        document = models.Document.objects.filter(
            id=request.query_params.get("document_id")
        ).first()
        if document is None:
            return drf.response.Response([])

        root = document if document.is_root() else document.get_root()
        workspaces = models.Workspace.objects.filter(
            space_links__space=root, accesses__user=request.user
        ).distinct()
        query = (request.query_params.get("q") or "").strip().lower()

        results = []
        for workspace in workspaces:
            label = str(_("All members of {name}")).format(name=workspace.name)
            if not query or query in label.lower():
                results.append(
                    {
                        "team": models.make_team(models.TEAM_WORKSPACE, workspace.id),
                        "label": label,
                        "kind": "workspace",
                        "workspace": {"id": str(workspace.id), "name": workspace.name},
                    }
                )
            groups = workspace.groups.all()
            if query:
                groups = groups.filter(name__icontains=query)
            results.extend(
                {
                    "team": group.team,
                    "label": group.name,
                    "kind": group.kind,
                    "workspace": {"id": str(workspace.id), "name": workspace.name},
                }
                for group in groups[:20]
            )
        return drf.response.Response(results)


class SpaceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Spaces: root documents of kind "space" holding pages.

    GET /api/v1.0/spaces/?workspace=<id> — spaces placed in a workspace
    GET /api/v1.0/spaces/?independent=true — my independent spaces
    POST /api/v1.0/spaces/ — create a space (see SpaceCreateSerializer)
    POST /api/v1.0/spaces/<id>/move-to-workspace/ — give an independent space a home
    POST, DELETE /api/v1.0/spaces/<id>/links/ — share a space with another workspace
    GET, POST, DELETE /api/v1.0/spaces/<id>/workspace-grants/ — roles a linked
        workspace grants to its own groups on the space

    Everything else about a space (title, content, pages, sharing, deletion)
    goes through the documents API, as a space is a document.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SpaceSerializer
    pagination_class = None

    def get_queryset(self):
        """Spaces readable by the user, through an access or their link."""
        user = self.request.user
        return (
            models.Document.objects.filter(
                kind=choices.DocumentKindChoices.SPACE,
                ancestors_deleted_at__isnull=True,
            )
            .filter(
                Q(accesses__user=user)
                | Q(accesses__team__in=user.teams)
                | ~Q(link_reach=choices.LinkReachChoices.RESTRICTED)
            )
            .distinct()
            .order_by("title")
        )

    def filter_queryset(self, queryset):
        """Filter by workspace, or keep independent spaces with a direct access."""
        user = self.request.user
        workspace_id = self.request.query_params.get("workspace")
        if workspace_id:
            workspace = models.Workspace.objects.filter(id=workspace_id).first()
            if workspace is None or workspace.get_role(user) is None:
                return queryset.none()
            return queryset.filter(workspace_links__workspace=workspace)

        if self.request.query_params.get("independent") in ("true", "1"):
            return queryset.filter(workspace_links__isnull=True).filter(
                Q(accesses__user=user) | Q(accesses__team__in=user.teams)
            )

        return queryset

    def get_object(self):
        """A space the user can read."""
        space = super().get_object()
        if not space.get_abilities(self.request.user)["retrieve"]:
            raise drf.exceptions.NotFound()
        return space

    def create(self, request, *args, **kwargs):
        """Create a space with its visibility and its editors."""
        create_serializer = SpaceCreateSerializer(
            data=request.data, context=self.get_serializer_context()
        )
        create_serializer.is_valid(raise_exception=True)
        data = create_serializer.validated_data
        workspace = data["workspace"]
        visibility = data["visibility"]
        is_public = visibility == choices.SpaceVisibilityChoices.PUBLIC

        with transaction.atomic():
            space = create_tree_node_with_retry(
                lambda: models.Document.add_root(
                    creator=request.user,
                    title=data["title"],
                    kind=choices.DocumentKindChoices.SPACE,
                    link_reach=choices.LinkReachChoices.PUBLIC
                    if is_public
                    else choices.LinkReachChoices.RESTRICTED,
                    link_role=choices.LinkRoleChoices.READER,
                )
            )
            models.DocumentAccess.objects.create(
                document=space, user=request.user, role=choices.RoleChoices.OWNER
            )
            if workspace is not None:
                place_space_in_workspace(space, workspace)
                if visibility == choices.SpaceVisibilityChoices.WORKSPACE:
                    models.DocumentAccess.objects.create(
                        document=space,
                        team=models.make_team(models.TEAM_WORKSPACE, workspace.id),
                        role=choices.RoleChoices.READER,
                    )
            for user in data["editor_users"]:
                if user.id != request.user.id:
                    models.DocumentAccess.objects.create(
                        document=space, user=user, role=choices.RoleChoices.EDITOR
                    )
            for group in data["editor_groups"]:
                models.DocumentAccess.objects.create(
                    document=space, team=group.team, role=choices.RoleChoices.EDITOR
                )

        serializer = self.get_serializer(space)
        return drf.response.Response(serializer.data, status=status.HTTP_201_CREATED)

    @drf.decorators.action(detail=True, methods=["post"], url_path="move-to-workspace")
    def move_to_workspace(self, request, *args, **kwargs):
        """The owner of an independent space places it in one of their workspaces."""
        space = self.get_object()
        if space.get_role(request.user) != choices.RoleChoices.OWNER:
            raise drf.exceptions.PermissionDenied()
        if space.workspace_links.exists():
            raise drf.exceptions.ValidationError(
                {"workspace_id": _("This space already belongs to a workspace.")}
            )
        workspace = models.Workspace.objects.filter(
            id=request.data.get("workspace_id")
        ).first()
        if workspace is None or workspace.get_role(request.user) is None:
            raise drf.exceptions.ValidationError(
                {"workspace_id": _("You are not a member of this workspace.")}
            )
        with transaction.atomic():
            place_space_in_workspace(space, workspace)
        return drf.response.Response(self.get_serializer(space).data)

    def _get_home_workspace(self, space):
        link = space.workspace_links.filter(is_home=True).first()
        return link.workspace if link else None

    @drf.decorators.action(detail=True, methods=["post", "delete"], url_path="links")
    def links(self, request, *args, **kwargs):
        """
        POST {workspace_id}: home administrators share the space with another
        workspace they belong to.
        DELETE {workspace_id}: home administrators, or the administrators of
        the linked workspace, stop sharing it. The roles that workspace granted
        on the space are removed with the link.
        """
        # The administrators of a linked workspace may have no role on the
        # space itself: permissions are checked below, per method.
        space = get_object_or_404_space(kwargs["pk"])
        home = self._get_home_workspace(space)
        workspace = models.Workspace.objects.filter(
            id=request.data.get("workspace_id")
        ).first()
        if home is None or workspace is None or workspace.id == home.id:
            raise drf.exceptions.ValidationError(
                {"workspace_id": _("Choose another workspace than the space's home.")}
            )
        is_home_admin = is_workspace_admin(home, request.user)

        if request.method == "POST":
            if not is_home_admin:
                raise drf.exceptions.PermissionDenied()
            if workspace.get_role(request.user) is None:
                raise drf.exceptions.ValidationError(
                    {"workspace_id": _("You are not a member of this workspace.")}
                )
            models.SpaceWorkspaceLink.objects.get_or_create(
                space=space, workspace=workspace, defaults={"is_home": False}
            )
            return drf.response.Response(
                self.get_serializer(space).data, status=status.HTTP_201_CREATED
            )

        if not (is_home_admin or is_workspace_admin(workspace, request.user)):
            raise drf.exceptions.PermissionDenied()
        with transaction.atomic():
            models.DocumentAccess.objects.filter(
                document=space, team__in=get_workspace_teams(workspace)
            ).delete()
            models.SpaceWorkspaceLink.objects.filter(
                space=space, workspace=workspace, is_home=False
            ).delete()
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)

    @drf.decorators.action(
        detail=True, methods=["get", "post", "delete"], url_path="workspace-grants"
    )
    def workspace_grants(self, request, *args, **kwargs):
        """
        The administrators of a workspace the space is shared with grant roles
        on it to their own groups, or to all their members, without needing a
        role on the space themselves.

        GET: the grants of the workspaces the user administers
        POST {team, role}: grant (owner excepted)
        DELETE {team}: revoke
        """
        space = get_object_or_404_space(kwargs["pk"])

        if request.method == "GET":
            administered = [
                link.workspace
                for link in space.workspace_links.select_related("workspace")
                if is_workspace_admin(link.workspace, request.user)
            ]
            teams = [
                team
                for workspace in administered
                for team in get_workspace_teams(workspace)
            ]
            grants = space.accesses.filter(team__in=teams).exclude(
                team__startswith=f"{models.TEAM_WORKSPACE_ADMINS}:"
            )
            return drf.response.Response(
                [
                    {
                        "team": access.team,
                        "label": models.get_team_label(access.team),
                        "role": access.role,
                    }
                    for access in grants
                ]
            )

        serializer = WorkspaceGrantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team = serializer.validated_data["team"]
        workspace_id = get_team_workspace_id(team)
        kind, _obj_id = models.parse_team(team)
        link = (
            space.workspace_links.filter(workspace_id=workspace_id)
            .select_related("workspace")
            .first()
        )
        if (
            link is None
            or kind == models.TEAM_WORKSPACE_ADMINS
            or not is_workspace_admin(link.workspace, request.user)
        ):
            raise drf.exceptions.PermissionDenied()

        if request.method == "POST":
            access, _created = models.DocumentAccess.objects.update_or_create(
                document=space,
                team=team,
                defaults={"role": serializer.validated_data["role"]},
            )
            return drf.response.Response(
                {
                    "team": access.team,
                    "label": models.get_team_label(access.team),
                    "role": access.role,
                },
                status=status.HTTP_201_CREATED,
            )

        space.accesses.filter(team=team).delete()
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


def get_object_or_404_space(pk):
    """Any non deleted space, whatever the user's role on it."""
    space = models.Document.objects.filter(
        pk=pk,
        kind=choices.DocumentKindChoices.SPACE,
        ancestors_deleted_at__isnull=True,
    ).first()
    if space is None:
        raise drf.exceptions.NotFound()
    return space
