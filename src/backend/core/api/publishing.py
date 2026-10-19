"""
Publishing to the web: a page's publishing settings, spaces published as
public wikis, the public wiki reader, and the publishing log of a workspace.

A page is public when its link reach is public (set in the share dialog). A
space published as a wiki is a public space with a slug: anyone can read it at
/wiki/<slug>, with its tree of pages. Pages kept private inherit no link
access from above, so they stay out of both.
"""

import re

from django.db import transaction
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions

# pylint: disable=abstract-method

ACCENT_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def home_workspace(document):
    """The home workspace of the space holding the document, if any."""
    root = document if document.is_root() else document.get_root()
    link = (
        models.SpaceWorkspaceLink.objects.filter(space=root, is_home=True)
        .select_related("workspace")
        .first()
    )
    return link.workspace if link else None


def can_publish(user, document, abilities=None):
    """
    Whether the user may publish the document to the web: they manage its
    link, and the workspace holding it lets them publish.
    """
    abilities = abilities or document.get_abilities(user)
    if not abilities["link_configuration"]:
        return False
    workspace = home_workspace(document)
    if (
        workspace is not None
        and workspace.publishing_policy
        == choices.PublishingPolicyChoices.WORKSPACE_ADMINS
    ):
        return workspace.get_role(user) in choices.WORKSPACE_PRIVILEGED_ROLES
    return True


def log_publication(document, user, action, **details):
    """Write an entry of the publishing log."""
    models.PublicationLog.objects.create(
        document=document,
        workspace=home_workspace(document),
        actor=user if user.is_authenticated else None,
        action=action,
        details=details,
    )


def published_wiki(document):
    """The wiki the document belongs to, when its space is published as one."""
    root = document if document.is_root() else document.get_root()
    if (
        root.kind != choices.DocumentKindChoices.SPACE
        or not root.wiki_slug
        or root.link_reach != choices.LinkReachChoices.PUBLIC
    ):
        return None
    return root


# -- A page's publishing settings


class PublicationSerializer(serializers.Serializer):
    """The publishing settings one can change on a page."""

    keep_private = serializers.BooleanField(required=False)
    allow_indexing = serializers.BooleanField(required=False)


class DocumentPublicationView(APIView):
    """
    GET  /documents/<id>/publication/ — is the page public, in a wiki, indexed?
    PUT  /documents/<id>/publication/ {keep_private, allow_indexing}
    """

    permission_classes = [AllowAny]

    def _document(self, resource_id):
        document = models.Document.objects.filter(
            pk=resource_id, ancestors_deleted_at__isnull=True
        ).first()
        if document is None:
            raise drf.exceptions.NotFound()
        return document

    def _state(self, document, user):
        abilities = document.get_abilities(user)
        if not abilities["retrieve"]:
            raise (
                drf.exceptions.PermissionDenied()
                if user.is_authenticated
                else drf.exceptions.NotAuthenticated()
            )
        is_public = document.computed_link_reach == choices.LinkReachChoices.PUBLIC
        wiki = published_wiki(document) if is_public else None
        return {
            "is_public": is_public,
            "keep_private": document.keep_private,
            "allow_indexing": document.allow_indexing,
            # search engines may index the page itself, or its whole wiki
            "indexable": is_public
            and (document.allow_indexing or bool(wiki and wiki.allow_indexing)),
            "wiki": {
                "space_id": str(wiki.id),
                "slug": wiki.wiki_slug,
                "accent": wiki.wiki_accent,
                "title": wiki.title,
            }
            if wiki
            else None,
            "can_configure": abilities["link_configuration"],
            "can_publish": can_publish(user, document, abilities),
        }

    def get(self, request, resource_id):
        """Tell how the page is published."""
        document = self._document(resource_id)
        return drf.response.Response(self._state(document, request.user))

    def put(self, request, resource_id):
        """Keep a page private, or let search engines index it."""
        document = self._document(resource_id)
        abilities = document.get_abilities(request.user)
        if not abilities["link_configuration"]:
            raise drf.exceptions.PermissionDenied()
        serializer = PublicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "keep_private" in data and document.is_root():
            raise drf.exceptions.ValidationError(
                {"keep_private": _("Only sub-pages can be kept private.")}
            )
        if data.get("allow_indexing") and not can_publish(
            request.user, document, abilities
        ):
            raise drf.exceptions.PermissionDenied(
                _("Your workspace only lets its administrators publish.")
            )

        for field, value in data.items():
            setattr(document, field, value)
        if data:
            # saving keep_private has the collaboration server re-check who
            # may still read the page and the ones below it
            document.save(update_fields=[*data, "updated_at"])
        return drf.response.Response(self._state(document, request.user))


# -- Spaces published as wikis


class WikiSerializer(serializers.Serializer):
    """Publish a space as a wiki."""

    slug = serializers.CharField(max_length=100)
    accent = serializers.CharField(max_length=7, required=False, allow_blank=True)
    allow_indexing = serializers.BooleanField(required=False, default=False)

    def validate_slug(self, value):
        """Addresses are lowercase words separated by dashes, and unique."""
        slug = slugify(value)[:100]
        if not slug:
            raise serializers.ValidationError(_("Choose an address for the wiki."))
        taken = models.Document.objects.filter(wiki_slug=slug).exclude(
            pk=self.context["space"].pk
        )
        if taken.exists():
            raise serializers.ValidationError(
                _("This address is taken by another wiki.")
            )
        return slug

    def validate_accent(self, value):
        """A colour such as #3e3ba0, or none."""
        if value and not ACCENT_RE.match(value):
            raise serializers.ValidationError(_("Use a colour such as #3e3ba0."))
        return value


class SpaceWikiView(APIView):
    """
    PUT    /spaces/<id>/wiki/ {slug, accent, allow_indexing} — publish, or update
    DELETE /spaces/<id>/wiki/ — unpublish: the space is private again
    """

    permission_classes = [permissions.IsAuthenticated]

    def _space(self, request, resource_id):
        space = models.Document.objects.filter(
            pk=resource_id,
            kind=choices.DocumentKindChoices.SPACE,
            ancestors_deleted_at__isnull=True,
        ).first()
        if space is None or not space.get_abilities(request.user)["retrieve"]:
            raise drf.exceptions.NotFound()
        if not can_publish(request.user, space):
            raise drf.exceptions.PermissionDenied(
                _("You can't publish this space to the web.")
            )
        return space

    def put(self, request, resource_id):
        """Publish the space as a public, read-only wiki."""
        space = self._space(request, resource_id)
        serializer = WikiSerializer(data=request.data, context={"space": space})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        was_published = bool(space.wiki_slug) and (
            space.link_reach == choices.LinkReachChoices.PUBLIC
        )

        space.wiki_slug = data["slug"]
        space.wiki_accent = data.get("accent", space.wiki_accent)
        space.allow_indexing = data["allow_indexing"]
        # a wiki is read-only for everybody who isn't invited to edit
        space.link_reach = choices.LinkReachChoices.PUBLIC
        space.link_role = choices.LinkRoleChoices.READER
        with transaction.atomic():
            space.save(
                update_fields=[
                    "wiki_slug",
                    "wiki_accent",
                    "allow_indexing",
                    "link_reach",
                    "link_role",
                    "updated_at",
                ]
            )
            log_publication(
                space,
                request.user,
                choices.PublicationActionChoices.WIKI_UPDATED
                if was_published
                else choices.PublicationActionChoices.WIKI_PUBLISHED,
                slug=space.wiki_slug,
            )
        return drf.response.Response(
            {
                "slug": space.wiki_slug,
                "accent": space.wiki_accent,
                "allow_indexing": space.allow_indexing,
            }
        )

    def delete(self, request, resource_id):
        """Take the wiki down; only invited people can read the space again."""
        space = self._space(request, resource_id)
        slug = space.wiki_slug
        space.wiki_slug = None
        space.link_reach = choices.LinkReachChoices.RESTRICTED
        with transaction.atomic():
            space.save(update_fields=["wiki_slug", "link_reach", "updated_at"])
            log_publication(
                space,
                request.user,
                choices.PublicationActionChoices.WIKI_UNPUBLISHED,
                slug=slug,
            )
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


# -- The public wiki reader


def wiki_tree(space):
    """
    The pages of a wiki, nested, leaving out the pages kept private (unless
    published on their own) and everything below them.
    """
    pages = (
        space.get_descendants()
        .filter(ancestors_deleted_at__isnull=True)
        .only("id", "title", "path", "depth", "keep_private", "link_reach")
        .order_by("path")
    )
    steplen = models.Document.steplen
    nodes = {space.path: {"children": []}}
    for page in pages:
        parent = nodes.get(page.path[:-steplen])
        if parent is None:
            continue  # below a page left out
        if page.keep_private and page.link_reach != choices.LinkReachChoices.PUBLIC:
            continue
        node = {"id": str(page.id), "title": page.title or "", "children": []}
        parent["children"].append(node)
        nodes[page.path] = node
    return nodes[space.path]["children"]


class PublicWikiView(APIView):
    """GET /wiki/<slug>/ — a published wiki and its tree of pages, for anyone."""

    permission_classes = [AllowAny]

    def get(self, request, slug):
        """Return the wiki's space and its pages."""
        space = models.Document.objects.filter(
            wiki_slug=slug,
            kind=choices.DocumentKindChoices.SPACE,
            link_reach=choices.LinkReachChoices.PUBLIC,
            ancestors_deleted_at__isnull=True,
        ).first()
        if space is None:
            raise drf.exceptions.NotFound()
        workspace = home_workspace(space)
        return drf.response.Response(
            {
                "id": str(space.id),
                "slug": space.wiki_slug,
                "title": space.title or "",
                "accent": space.wiki_accent,
                "allow_indexing": space.allow_indexing,
                "workspace": workspace.name if workspace else None,
                "updated_at": space.updated_at,
                "can_edit": request.user.is_authenticated
                and space.get_abilities(request.user)["update"],
                "tree": wiki_tree(space),
            }
        )


# -- The publishing log of a workspace


class PublicationLogView(APIView):
    """GET /workspaces/<id>/publication-log/ — for the workspace's admins."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, resource_id):
        """The latest publishing events in the workspace."""
        workspace = models.Workspace.objects.filter(pk=resource_id).first()
        if workspace is None or workspace.get_role(request.user) is None:
            raise drf.exceptions.NotFound()
        if workspace.get_role(request.user) not in choices.WORKSPACE_PRIVILEGED_ROLES:
            raise drf.exceptions.PermissionDenied()
        entries = workspace.publication_logs.select_related("actor", "document")[:100]
        return drf.response.Response(
            [
                {
                    "id": str(entry.id),
                    "action": entry.action,
                    "created_at": entry.created_at,
                    "actor": entry.actor.full_name or entry.actor.email
                    if entry.actor
                    else None,
                    "document": {
                        "id": str(entry.document_id),
                        "title": entry.document.title or "",
                        "kind": entry.document.kind,
                    },
                    "details": entry.details,
                }
                for entry in entries
            ]
        )
