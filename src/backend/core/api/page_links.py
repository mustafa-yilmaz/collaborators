"""
Pages moving freely between spaces: a page keeps one home (its space, or none
for an independent page) and can be linked into other spaces, shown there as
"Linked from …"; and a page can leave its space to be independent again.

GET, POST /api/v1.0/documents/<id>/space-links/ — where the page is linked
    ({space_id} to link it into one more space)
DELETE /api/v1.0/documents/<id>/space-links/<link id>/ — unlink it
POST /api/v1.0/documents/<id>/make-independent/ — take it out of its space

Moving a page into a space goes through the documents API ("move").
"""

from django.db import transaction
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import status
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions

EDITING_ROLES = (
    choices.RoleChoices.EDITOR,
    choices.RoleChoices.ADMIN,
    choices.RoleChoices.OWNER,
)


def readable_page(user, page_id):
    """A page (not a space) the user can open, or 404."""
    page = models.Document.objects.filter(
        pk=page_id, ancestors_deleted_at__isnull=True
    ).first()
    if page is None or page.is_space or not page.get_abilities(user).get("retrieve"):
        raise drf.exceptions.NotFound()
    return page


def can_manage_page(user, page):
    """Owners and administrators of a page decide where it is shown."""
    return page.get_role(user) in choices.PRIVILEGED_ROLES


def describe(document):
    """Id and title, enough to show and open a page or a space."""
    return {"id": str(document.id), "title": document.title}


def home_space(page):
    """The space a page belongs to, or None for an independent page."""
    root = page if page.is_root() else page.get_root()
    return root if root.is_space else None


class PageSpaceLinksView(APIView):
    """Where a page is shown besides its home, and linking it into more spaces."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        """The page's home space and the spaces it's linked into."""
        user = request.user
        page = readable_page(user, pk)
        manages = can_manage_page(user, page)
        home = home_space(page)
        return drf.response.Response(
            {
                "home": describe(home) if home else None,
                "links": [
                    {
                        "id": str(link.id),
                        "space": describe(link.space),
                        "can_unlink": manages
                        or link.space.get_role(user) in choices.PRIVILEGED_ROLES,
                    }
                    for link in page.space_links.select_related("space")
                    if link.space.ancestors_deleted_at is None
                    and link.space.get_abilities(user).get("retrieve")
                ],
                "can_link": manages,
                "can_make_independent": manages and home is not None,
            }
        )

    def post(self, request, pk):
        """
        Link the page into a space: by an owner or administrator of the page,
        into a space where they can edit (its members then read the page).
        """
        user = request.user
        page = readable_page(user, pk)
        if not can_manage_page(user, page):
            raise drf.exceptions.PermissionDenied()
        space = models.Document.objects.filter(
            pk=request.data.get("space_id"),
            kind=choices.DocumentKindChoices.SPACE,
            ancestors_deleted_at__isnull=True,
        ).first()
        if space is None or space.get_role(user) not in EDITING_ROLES:
            raise drf.exceptions.ValidationError(
                {"space_id": _("Choose a space where you can edit.")}
            )
        if space == home_space(page):
            raise drf.exceptions.ValidationError(
                {"space_id": _("This page already belongs to this space.")}
            )
        link, _created = models.PageSpaceLink.objects.get_or_create(
            page=page, space=space, defaults={"created_by": user}
        )
        return drf.response.Response(
            {"id": str(link.id), "space": describe(space)},
            status=status.HTTP_201_CREATED,
        )


class PageSpaceLinkView(APIView):
    """Unlinking a page from a space: the page's managers or the space's."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, link_id):
        """The page stays in its home; it's no longer shown in that space."""
        user = request.user
        link = (
            models.PageSpaceLink.objects.filter(pk=link_id, page_id=pk)
            .select_related("page", "space")
            .first()
        )
        if link is None:
            raise drf.exceptions.NotFound()
        if not (
            can_manage_page(user, link.page)
            or link.space.get_role(user) in choices.PRIVILEGED_ROLES
        ):
            raise drf.exceptions.PermissionDenied()
        link.delete()
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


class MakePageIndependentView(APIView):
    """
    Take a page (with its subpages) out of its space or parent page: it
    becomes an independent page owned by whoever does it. Its accesses don't
    follow (they came from the space): it can be shared again, or linked back
    into spaces.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Move the page to the top level."""
        user = request.user
        page = readable_page(user, pk)
        if not can_manage_page(user, page):
            raise drf.exceptions.PermissionDenied()
        # A page placed directly in a workspace leaves it
        if page.is_root() and page.workspace_links.exists():
            with transaction.atomic():
                take_page_out_of_workspaces(page)
                models.DocumentAccess.objects.update_or_create(
                    document=page,
                    user=user,
                    defaults={"role": choices.RoleChoices.OWNER},
                )
            return drf.response.Response({"id": str(page.id)})
        if page.is_root():
            raise drf.exceptions.ValidationError(
                {"document": _("This page is already independent.")}
            )
        with transaction.atomic():
            page.move(page.get_root(), pos="last-sibling")
            page.refresh_from_db()
            page.accesses.all().delete()
            page.invitations.all().delete()
            models.DocumentAccess.objects.create(
                document=page, user=user, role=choices.RoleChoices.OWNER
            )
        return drf.response.Response({"id": str(page.id)})


def take_page_out_of_workspaces(page):
    """A top-level page leaves the workspaces it was placed in, and their roles."""
    workspace_ids = list(page.workspace_links.values_list("workspace_id", flat=True))
    page.workspace_links.all().delete()
    page.accesses.filter(
        team__in=[
            models.make_team(kind, workspace_id)
            for workspace_id in workspace_ids
            for kind in (models.TEAM_WORKSPACE, models.TEAM_WORKSPACE_ADMINS)
        ]
    ).delete()


class MovePageToWorkspaceView(APIView):
    """
    POST /api/v1.0/documents/<id>/move-to-workspace/ {workspace_id}

    Place a page directly in a workspace, in none of its spaces: it becomes a
    top-level page (with its subpages) whose home is the workspace. Its
    members can read it and its administrators manage it, as for a space;
    the page can be shared further as usual.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        """Move the page into the workspace."""
        user = request.user
        page = readable_page(user, pk)
        if not can_manage_page(user, page):
            raise drf.exceptions.PermissionDenied()
        workspace = models.Workspace.objects.filter(
            id=request.data.get("workspace_id")
        ).first()
        if workspace is None or workspace.get_role(user) is None:
            raise drf.exceptions.ValidationError(
                {"workspace_id": _("You are not a member of this workspace.")}
            )
        if page.is_root() and page.workspace_links.filter(workspace=workspace).exists():
            raise drf.exceptions.ValidationError(
                {"workspace_id": _("This page is already in this workspace.")}
            )
        with transaction.atomic():
            if not page.is_root():
                # Out of its space or parent page first: its accesses came
                # from there and don't follow
                page.move(page.get_root(), pos="last-sibling")
                page.refresh_from_db()
                page.accesses.all().delete()
                page.invitations.all().delete()
                models.DocumentAccess.objects.create(
                    document=page, user=user, role=choices.RoleChoices.OWNER
                )
            else:
                take_page_out_of_workspaces(page)
            models.SpaceWorkspaceLink.objects.create(
                space=page, workspace=workspace, is_home=True
            )
            models.DocumentAccess.objects.update_or_create(
                document=page,
                team=models.make_team(models.TEAM_WORKSPACE_ADMINS, workspace.id),
                defaults={"role": choices.RoleChoices.OWNER},
            )
            models.DocumentAccess.objects.get_or_create(
                document=page,
                team=models.make_team(models.TEAM_WORKSPACE, workspace.id),
                defaults={"role": choices.RoleChoices.READER},
            )
        return drf.response.Response(
            {
                "id": str(page.id),
                "workspace": {"id": str(workspace.id), "name": workspace.name},
            }
        )
