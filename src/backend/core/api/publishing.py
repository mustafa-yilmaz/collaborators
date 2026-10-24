"""
Publishing to the web: a page's publishing settings, spaces published as
public wikis, the public wiki reader, and the publishing log of a workspace.

A page is public when its link reach is public (set in the share dialog). A
space published as a wiki is a public space with a slug: anyone can read it at
/wiki/<slug>, with its tree of pages. Pages kept private inherit no link
access from above, so they stay out of both.

A wiki shows its live pages, or a fixed version of them (a release): then the
pages themselves are not public, and readers get the release's copy. A wiki
can also be read at <workspace>.<base domain>/<slug>, and at a domain of its
own.
"""

import base64
import re
import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Q
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from core import choices, models
from core.api import permissions
from core.api.filters import remove_accents
from core.services.yhub_services import YHubError, YHubService
from core.tasks.wiki import ensure_texts, refresh_text_task
from core.utils.yjs import yjs_to_text

# pylint: disable=abstract-method

ACCENT_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
DOMAIN_RE = re.compile(
    r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$"
)
SEARCH_LIMIT = 30


def home_workspace(document):
    """The home workspace of the space holding the document, if any."""
    root = document if document.is_root() else document.get_root()
    link = (
        models.SpaceWorkspaceLink.objects.filter(space=root, is_home=True)
        .select_related("workspace")
        .first()
    )
    return link.workspace if link else None


def is_live_wiki(document):
    """Collaborators: a space published as a wiki showing its live pages."""
    return (
        document.is_space
        and bool(document.wiki_slug)
        and document.wiki_release_id is None
        and document.link_reach == choices.LinkReachChoices.PUBLIC
    )


def check_live_wiki_link(document, link_reach, link_role):
    """
    Collaborators: a live wiki stays public and read-only for those not
    invited, whichever setting changes its link (unpublishing comes first).
    """
    if not is_live_wiki(document):
        return
    if link_reach != choices.LinkReachChoices.PUBLIC:
        raise drf.exceptions.ValidationError(
            {
                "link_reach": _(
                    "This space is published as a public wiki: unpublish "
                    "the wiki first (Publish to the web, below)."
                )
            }
        )
    if link_role != choices.LinkRoleChoices.READER:
        raise drf.exceptions.ValidationError(
            {"link_role": _("A public wiki is read-only for those not invited.")}
        )


def may_publish_in(user, workspace):
    """Collaborators: whether the workspace lets the user publish."""
    return (
        workspace.publishing_policy != choices.PublishingPolicyChoices.WORKSPACE_ADMINS
        or workspace.get_role(user) in choices.WORKSPACE_PRIVILEGED_ROLES
    )


def check_public_moving_in(user, document, workspace):
    """
    Collaborators: moving public pages into a workspace that lets only its
    administrators publish, needs to be one of them (or to close them first).
    """
    is_public = models.Document.objects.filter(
        path__startswith=document.path,
        link_reach=choices.LinkReachChoices.PUBLIC,
        ancestors_deleted_at__isnull=True,
    ).exists()
    if is_public and not may_publish_in(user, workspace):
        raise drf.exceptions.PermissionDenied(
            _(
                "This workspace only lets its administrators publish: make "
                "it non-public first, or ask one of them."
            )
        )


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


def shown_slug(workspace, user):
    """Collaborators: a workspace's address, for those who may know it."""
    return workspace.slug if workspace and workspace.is_shown_to(user) else None


def is_published(space):
    """A wiki is published live (public pages) or as a fixed version."""
    return bool(space.wiki_slug) and (
        space.link_reach == choices.LinkReachChoices.PUBLIC
        or space.wiki_release_id is not None
    )


def published_wiki(document):
    """The wiki the document belongs to, when its space is published as one."""
    root = document if document.is_root() else document.get_root()
    if root.kind != choices.DocumentKindChoices.SPACE or not is_published(root):
        return None
    return root


RESERVED_WIKI_SLUGS = {"page", "space", "workspace", "docs"}


def published_space(slug):
    """The space published as a wiki at this address, or a 404."""
    space = (
        models.Document.objects.filter(
            Q(link_reach=choices.LinkReachChoices.PUBLIC)
            | Q(wiki_release__isnull=False),
            wiki_slug=slug,
            kind=choices.DocumentKindChoices.SPACE,
            ancestors_deleted_at__isnull=True,
        )
        .select_related("wiki_release")
        .first()
    )
    if space is None:
        raise drf.exceptions.NotFound()
    return space


def is_wiki_file(key):
    """
    Whether anyone may load this file: it belongs to the fixed version of a
    published wiki, or it is a published wiki's logo.
    """
    published = Q(wiki_slug__isnull=False, ancestors_deleted_at__isnull=True)
    # Collaborators: the logo is the space's own file, under /media/
    logo = Q(wiki_logo__endswith=f"/media/{key}")
    try:
        logo &= Q(pk=uuid.UUID(key.split("/")[0]))
    except ValueError:
        logo = Q(pk__in=[])
    return models.Document.objects.filter(
        published & (Q(wiki_release__attachments__contains=[key]) | logo)
    ).exists()


def flatten(tree):
    """The ids of the pages of a tree, in order."""
    for node in tree:
        yield node["id"]
        yield from flatten(node["children"])


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
        wiki = published_wiki(document)
        if wiki is not None and not is_public and not wiki.wiki_release_id:
            wiki = None
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
                "logo": wiki.wiki_logo,
                "domain": wiki.wiki_domain,
                "workspace_slug": shown_slug(home_workspace(wiki), user),
                "released_at": wiki.wiki_release.created_at
                if wiki.wiki_release
                else None,
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
    # The address of an image attached to the space, or none
    logo = serializers.CharField(max_length=500, required=False, allow_blank=True)
    # A domain of its own, e.g. help.example.com, or none
    domain = serializers.CharField(max_length=253, required=False, allow_blank=True)

    def validate_logo(self, value):
        """
        The logo is an image attached to the space itself. Collaborators: the
        whole address is checked, not a part of it, so a logo can't lead to
        the file of another page (with "../" for instance).
        """
        space_id = re.escape(str(self.context["space"].pk))
        if value and not re.fullmatch(
            rf"(https?://[^/?#]+)?/media/{space_id}/attachments/[\w-]+\.\w+",
            value,
        ):
            raise serializers.ValidationError(_("Upload the logo to the space first."))
        return value

    def validate_domain(self, value):
        """A domain of its own, not one of Collaborators', and unique."""
        domain = value.strip().lower().rstrip(".")
        if not domain:
            return None
        base = settings.COLLABORATORS_WIKI_BASE_DOMAIN
        if (
            not DOMAIN_RE.match(domain)
            or domain in settings.COLLABORATORS_APP_HOSTS
            or domain == base
            or domain.endswith(f".{base}")
        ):
            raise serializers.ValidationError(
                _("Use a domain of your own, such as help.example.com.")
            )
        taken = models.Document.objects.filter(wiki_domain=domain).exclude(
            pk=self.context["space"].pk
        )
        if taken.exists():
            raise serializers.ValidationError(_("This domain is used by another wiki."))
        return domain

    def validate_slug(self, value):
        """Addresses are lowercase words separated by dashes, and unique."""
        slug = slugify(value)[:100]
        if not slug:
            raise serializers.ValidationError(_("Choose an address for the wiki."))
        # the app's page addresses (/page/<id>/, formerly /docs/<id>/) stay
        # the app's on a wiki's own address too
        if slug in RESERVED_WIKI_SLUGS:
            raise serializers.ValidationError(
                _("This address is used by the platform: choose another one.")
            )
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
        if "logo" in data:
            space.wiki_logo = data["logo"]
        if "domain" in data:
            space.wiki_domain = data["domain"]
        # a live wiki is read-only for everybody who isn't invited to edit;
        # with a fixed version, its pages stay private
        if space.wiki_release_id is None:
            space.link_reach = choices.LinkReachChoices.PUBLIC
            space.link_role = choices.LinkRoleChoices.READER
        with transaction.atomic():
            space.save(
                update_fields=[
                    "wiki_slug",
                    "wiki_accent",
                    "allow_indexing",
                    "wiki_logo",
                    "wiki_domain",
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
        if not was_published:
            # its pages' text, for the wiki's search
            for page_id in [space.pk, *flatten(wiki_tree(space))]:
                transaction.on_commit(
                    lambda page_id=page_id: refresh_text_task.delay(str(page_id))
                )
        return drf.response.Response(
            {
                "slug": space.wiki_slug,
                "accent": space.wiki_accent,
                "allow_indexing": space.allow_indexing,
                "logo": space.wiki_logo,
                "domain": space.wiki_domain,
            }
        )

    def delete(self, request, resource_id):
        """Take the wiki down; only invited people can read the space again."""
        space = self._space(request, resource_id)
        slug = space.wiki_slug
        space.wiki_slug = None
        space.wiki_release = None
        space.link_reach = choices.LinkReachChoices.RESTRICTED
        with transaction.atomic():
            space.save(
                update_fields=[
                    "wiki_slug",
                    "wiki_release",
                    "link_reach",
                    "updated_at",
                ]
            )
            log_publication(
                space,
                request.user,
                choices.PublicationActionChoices.WIKI_UNPUBLISHED,
                slug=slug,
            )
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


class SpaceWikiReleaseView(SpaceWikiView):
    """
    POST   /spaces/<id>/wiki/release/ — publish the pages as they are now: a
           fixed version readers see until the next one; the pages
           themselves are no longer public
    DELETE /spaces/<id>/wiki/release/ — show the live pages again
    """

    def post(self, request, resource_id):
        """Copy every page of the wiki, as it is now, into a new release."""
        space = self._space(request, resource_id)
        if not space.wiki_slug:
            raise drf.exceptions.ValidationError(
                {"detail": _("Publish the space as a wiki first.")}
            )
        tree = wiki_tree(space)
        page_ids = [str(space.pk), *flatten(tree)]
        pages = {
            str(page.pk): page
            for page in models.Document.objects.filter(pk__in=page_ids)
        }
        service = YHubService(user=request.user)
        contents = {}
        try:
            for page_id in page_ids:
                contents[page_id] = service.get_ydoc(pages[page_id]) or b""
        except YHubError as err:
            raise drf.exceptions.APIException(
                _("The pages could not be read. Try again in a moment.")
            ) from err

        with transaction.atomic():
            release = models.WikiRelease.objects.create(
                space=space, published_by=request.user, tree=tree
            )
            attachments = set()
            for page_id in page_ids:
                page = pages[page_id]
                default_storage.save(
                    release.content_key(page_id), ContentFile(contents[page_id])
                )
                release.pages[page_id] = {
                    "title": page.title or "",
                    "text": yjs_to_text(contents[page_id]) if contents[page_id] else "",
                }
                attachments.update(page.attachments or [])
            release.attachments = sorted(attachments)
            release.save(update_fields=["pages", "attachments", "updated_at"])
            space.wiki_release = release
            space.link_reach = choices.LinkReachChoices.RESTRICTED
            space.save(update_fields=["wiki_release", "link_reach", "updated_at"])
            log_publication(
                space,
                request.user,
                choices.PublicationActionChoices.WIKI_RELEASED,
                slug=space.wiki_slug,
                pages=len(page_ids),
            )
        return drf.response.Response(
            {"released_at": release.created_at}, status=status.HTTP_201_CREATED
        )

    def delete(self, request, resource_id):
        """Readers see the live pages again, which become public again."""
        space = self._space(request, resource_id)
        if space.wiki_release_id is None:
            return drf.response.Response(status=status.HTTP_204_NO_CONTENT)
        space.wiki_release = None
        space.link_reach = choices.LinkReachChoices.PUBLIC
        space.link_role = choices.LinkRoleChoices.READER
        with transaction.atomic():
            space.save(
                update_fields=["wiki_release", "link_reach", "link_role", "updated_at"]
            )
            log_publication(
                space,
                request.user,
                choices.PublicationActionChoices.WIKI_LIVE,
                slug=space.wiki_slug,
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
        space = published_space(slug)
        workspace = home_workspace(space)
        # Collaborators: a hidden workspace stays unnamed
        if workspace is not None and not workspace.is_shown_to(request.user):
            workspace = None
        release = space.wiki_release
        return drf.response.Response(
            {
                "id": str(space.id),
                "slug": space.wiki_slug,
                "title": (release.pages.get(str(space.id), {}).get("title"))
                if release
                else space.title or "",
                "accent": space.wiki_accent,
                "logo": space.wiki_logo,
                "domain": space.wiki_domain,
                "allow_indexing": space.allow_indexing,
                "workspace": workspace.name if workspace else None,
                "workspace_slug": workspace.slug if workspace else None,
                "updated_at": release.created_at if release else space.updated_at,
                # A fixed version: its pages are read from the release
                "released_at": release.created_at if release else None,
                "can_edit": request.user.is_authenticated
                and space.get_abilities(request.user)["update"],
                "tree": release.tree if release else wiki_tree(space),
            }
        )


def snippet(text, query):
    """The words around the first place the text matches the query."""
    plain = remove_accents(text).lower()
    index = plain.find(query)
    if index < 0:
        return text[:160].strip()
    start = max(0, index - 60)
    end = min(len(text), index + len(query) + 100)
    # start on a word
    if start:
        space = text.find(" ", start)
        start = space + 1 if 0 <= space < index else start
    return (
        ("…" if start else "")
        + " ".join(text[start:end].split())
        + ("…" if end < len(text) else "")
    )


class WikiSearchView(APIView):
    """GET /wiki/<slug>/search/?q= — pages whose title or text match."""

    permission_classes = [AllowAny]

    def get(self, request, slug):
        """Titles first, then texts, in the order of the wiki."""
        space = published_space(slug)
        query = remove_accents((request.query_params.get("q") or "").strip()).lower()
        if len(query) < 2:
            return drf.response.Response([])
        release = space.wiki_release
        if release:
            page_ids = [str(space.pk), *flatten(release.tree)]
            entries = [
                (
                    page_id,
                    release.pages.get(page_id, {}).get("title", ""),
                    release.pages.get(page_id, {}).get("text", ""),
                )
                for page_id in page_ids
            ]
        else:
            page_ids = [str(space.pk), *flatten(wiki_tree(space))]
            documents = {
                str(document.pk): document
                for document in models.Document.objects.filter(pk__in=page_ids)
            }
            ensure_texts(documents.values())
            entries = [
                (
                    page_id,
                    documents[page_id].title or "",
                    documents[page_id].text_content or "",
                )
                for page_id in page_ids
                if page_id in documents
            ]

        in_title, in_text = [], []
        for page_id, title, text in entries:
            if query in remove_accents(title).lower():
                in_title.append(
                    {"id": page_id, "title": title, "snippet": snippet(text, query)}
                )
            elif query in remove_accents(text).lower():
                in_text.append(
                    {"id": page_id, "title": title, "snippet": snippet(text, query)}
                )
        return drf.response.Response((in_title + in_text)[:SEARCH_LIMIT])


class WikiPageView(APIView):
    """
    GET /wiki/<slug>/pages/<id>/ — a page of a wiki's fixed version, with its
    content (a Yjs update, base64 encoded), for anyone.
    """

    permission_classes = [AllowAny]

    def get(self, request, slug, page_id):
        """Return the page as the release holds it."""
        space = published_space(slug)
        release = space.wiki_release
        page = release.pages.get(str(page_id)) if release else None
        if page is None:
            raise drf.exceptions.NotFound()
        try:
            with default_storage.open(release.content_key(page_id), "rb") as file:
                content = file.read()
        except (FileNotFoundError, OSError) as err:
            raise drf.exceptions.NotFound() from err
        return drf.response.Response(
            {
                "id": str(page_id),
                "title": page["title"],
                "released_at": release.created_at,
                "content": base64.b64encode(content).decode(),
            }
        )


class WikiHostView(APIView):
    """
    GET /wiki-hosts/<host>/ — what a wiki address shows: a wiki's own domain,
    or a workspace's address (<workspace>.<base domain>) and its wikis.
    """

    permission_classes = [AllowAny]

    def get(self, request, host):
        """Resolve the address."""
        host = host.lower().split(":")[0].rstrip(".")
        base = settings.COLLABORATORS_WIKI_BASE_DOMAIN
        published = Q(
            Q(link_reach=choices.LinkReachChoices.PUBLIC)
            | Q(wiki_release__isnull=False),
            wiki_slug__isnull=False,
            kind=choices.DocumentKindChoices.SPACE,
            ancestors_deleted_at__isnull=True,
        )
        if host.endswith(f".{base}") and host.count(".") == base.count(".") + 1:
            workspace = models.Workspace.objects.filter(
                slug=host[: -len(base) - 1]
            ).first()
            if workspace is None:
                raise drf.exceptions.NotFound()
            spaces = models.Document.objects.filter(
                published,
                workspace_links__workspace=workspace,
                workspace_links__is_home=True,
            ).order_by("title")
            # Collaborators: a hidden workspace's address shows only the
            # wikis it publishes, never its name; with none, it isn't there
            is_shown = workspace.is_shown_to(request.user)
            if not is_shown and not spaces.exists():
                raise drf.exceptions.NotFound()
            return drf.response.Response(
                {
                    "kind": "workspace",
                    "workspace": {
                        "name": workspace.name if is_shown else None,
                        "slug": workspace.slug,
                    },
                    "wikis": [
                        {"slug": space.wiki_slug, "title": space.title or ""}
                        for space in spaces
                    ],
                }
            )
        space = models.Document.objects.filter(published, wiki_domain=host).first()
        if space is None:
            raise drf.exceptions.NotFound()
        return drf.response.Response({"kind": "domain", "slug": space.wiki_slug})


class TlsAllowedView(APIView):
    """
    GET /tls-allowed/?domain=<host> — whether the web server may get an HTTPS
    certificate for this address (asked by Caddy's on-demand TLS): the app's
    own addresses, a workspace's address, or a published wiki's own domain.
    200 if so, 404 otherwise, so nobody makes the server ask for certificates
    of domains that aren't ours.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """Allow or refuse the address."""
        host = (request.query_params.get("domain") or "").lower().rstrip(".")
        base = settings.COLLABORATORS_WIKI_BASE_DOMAIN
        allowed = host in settings.COLLABORATORS_APP_HOSTS or host in (
            base,
            settings.COLLABORATORS_WIKI_DOMAIN_TARGET,
        )
        if (
            not allowed
            and host.endswith(f".{base}")
            and host.count(".") == base.count(".") + 1
        ):
            # Collaborators: not the addresses of hidden workspaces, unless
            # they publish wikis there
            allowed = (
                models.Workspace.objects.filter(slug=host[: -len(base) - 1])
                .filter(
                    ~Q(visibility=choices.WorkspaceVisibilityChoices.HIDDEN)
                    | Q(
                        space_links__is_home=True,
                        space_links__space__wiki_slug__isnull=False,
                        space_links__space__ancestors_deleted_at__isnull=True,
                    )
                )
                .exists()
            )
        if not allowed and host:
            allowed = models.Document.objects.filter(
                wiki_domain=host,
                wiki_slug__isnull=False,
                ancestors_deleted_at__isnull=True,
            ).exists()
        if not allowed:
            raise drf.exceptions.NotFound()
        return drf.response.Response({"domain": host})


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
