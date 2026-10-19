"""
One "Who can see this?" setting for pages and spaces, on top of what Docs
already has:

- "public": anyone on the internet (the link reach "public");
- "platform": everyone signed in to Collaborators ("authenticated");
- "workspace:<id>": the members of a workspace the space belongs to (a
  reader role for the team "workspace:<id>");
- "space": for a page inside a space, the people of the space (the page
  follows its space);
- "invited": only the people and groups given a role.

A page inside a space can't be hidden from the space's people (accesses
flow down from the space): it would have to leave the space first.

GET, PUT /api/v1.0/documents/<id>/visibility/ {value, link_role}
"""

from django.db import transaction
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions, publishing

PUBLIC = "public"
PLATFORM = "platform"
SPACE = "space"
INVITED = "invited"
WORKSPACE_PREFIX = f"{models.TEAM_WORKSPACE}:"

LINK_ROLES = (
    choices.LinkRoleChoices.READER,
    choices.LinkRoleChoices.COMMENTER,
    choices.LinkRoleChoices.EDITOR,
)


def _space_of(document):
    """The space a document is in (or is), if any."""
    root = document if document.is_root() else document.get_root()
    return root if root.is_space else None


def _workspaces_of(space):
    """The workspaces a space belongs to: its home first."""
    if space is None:
        return []
    return [
        link.workspace
        for link in space.workspace_links.select_related("workspace").order_by(
            "-is_home", "created_at"
        )
    ]


def _workspace_teams(document):
    """The workspace teams given a reader role on the document itself."""
    return list(
        document.accesses.filter(
            team__startswith=WORKSPACE_PREFIX, role=choices.RoleChoices.READER
        ).values_list("team", flat=True)
    )


def describe(document, user):
    """The current choice, the choices offered, and whether one can change it."""
    space = _space_of(document)
    in_space = space is not None and document != space
    workspaces = _workspaces_of(space)
    reach = document.computed_link_reach
    teams = _workspace_teams(document)

    if reach == choices.LinkReachChoices.PUBLIC:
        value = PUBLIC
    elif reach == choices.LinkReachChoices.AUTHENTICATED:
        value = PLATFORM
    elif teams:
        value = teams[0]
    elif in_space:
        value = SPACE
    else:
        value = INVITED

    options = [PUBLIC, PLATFORM]
    options += [f"{WORKSPACE_PREFIX}{workspace.id}" for workspace in workspaces]
    options.append(SPACE if in_space else INVITED)

    return {
        "value": value,
        "link_role": document.computed_link_role
        if value in (PUBLIC, PLATFORM)
        else choices.LinkRoleChoices.READER,
        "options": options,
        "workspaces": {
            f"{WORKSPACE_PREFIX}{workspace.id}": workspace.name
            for workspace in workspaces
        },
        "space": {"id": str(space.id), "title": space.title} if in_space else None,
        "can_change": document.get_role(user) in choices.PRIVILEGED_ROLES
        and not document.ancestors_deleted_at,
    }


class DocumentVisibilityView(APIView):
    """Read and change who can see a page or a space."""

    permission_classes = [permissions.IsAuthenticated]

    def _document(self, user, resource_id):
        document = models.Document.objects.filter(
            pk=resource_id, ancestors_deleted_at__isnull=True
        ).first()
        if document is None or not document.get_abilities(user).get("retrieve"):
            raise drf.exceptions.NotFound()
        return document

    def get(self, request, resource_id):
        """The current choice and the ones offered."""
        document = self._document(request.user, resource_id)
        return drf.response.Response(describe(document, request.user))

    def put(self, request, resource_id):
        """Apply a choice: link reach, workspace roles and keeping private."""
        user = request.user
        document = self._document(user, resource_id)
        state = describe(document, user)
        if not state["can_change"]:
            raise drf.exceptions.PermissionDenied()
        value = request.data.get("value")
        if value not in state["options"]:
            raise drf.exceptions.ValidationError(
                {"value": _("This choice isn't available here.")}
            )
        link_role = request.data.get("link_role") or choices.LinkRoleChoices.READER
        if link_role not in LINK_ROLES:
            raise drf.exceptions.ValidationError({"link_role": _("Unknown role.")})

        was_public = document.link_reach == choices.LinkReachChoices.PUBLIC
        # A space published live as a wiki shows its public pages: narrowing
        # it would quietly empty the wiki
        if (
            value != PUBLIC
            and document.is_space
            and document.wiki_slug
            and document.wiki_release_id is None
            and was_public
        ):
            raise drf.exceptions.ValidationError(
                {
                    "value": _(
                        "This space is published as a public wiki: unpublish "
                        "the wiki first (Publish to the web, below)."
                    )
                }
            )
        if (
            value == PUBLIC
            and not was_public
            and not publishing.can_publish(user, document)
        ):
            raise drf.exceptions.PermissionDenied(
                _("Your workspace only lets its administrators publish.")
            )

        reach = {
            PUBLIC: choices.LinkReachChoices.PUBLIC,
            PLATFORM: choices.LinkReachChoices.AUTHENTICATED,
        }.get(value, choices.LinkReachChoices.RESTRICTED)
        in_space = state["space"] is not None
        with transaction.atomic():
            # The workspace roles this setting gave go, but the one chosen
            document.accesses.filter(
                team__startswith=WORKSPACE_PREFIX, role=choices.RoleChoices.READER
            ).exclude(team=value).delete()
            if value.startswith(WORKSPACE_PREFIX):
                access = document.accesses.filter(team=value).first()
                if access is None:
                    models.DocumentAccess.objects.create(
                        document=document, team=value, role=choices.RoleChoices.READER
                    )

            document.link_reach = reach
            document.link_role = (
                link_role if value in (PUBLIC, PLATFORM) else document.link_role
            )
            fields = ["link_reach", "link_role", "updated_at"]
            if in_space:
                # A sub-page narrower than its space stops following the
                # space's link (public pages and "same as the space" follow it)
                document.keep_private = value not in (PUBLIC, SPACE)
                fields.append("keep_private")
            # saving the link definition has the collaboration server re-check
            # who may read the page and the ones below it
            document.save(update_fields=fields)

        is_public = reach == choices.LinkReachChoices.PUBLIC
        if is_public != was_public:
            publishing.log_publication(
                document,
                user,
                choices.PublicationActionChoices.PAGE_PUBLISHED
                if is_public
                else choices.PublicationActionChoices.PAGE_UNPUBLISHED,
            )
        # A fresh instance: the computed link definition is cached
        document = models.Document.objects.get(pk=document.pk)
        return drf.response.Response(describe(document, user))
