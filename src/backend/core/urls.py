"""URL configuration for the core app."""

from django.conf import settings
from django.urls import include, path, re_path

from lasuite.oidc_login.urls import urlpatterns as oidc_urls
from lasuite.oidc_resource_server.urls import urlpatterns as oidc_resource_server_urls
from rest_framework.routers import DefaultRouter

from core.api import (
    dashboard,
    labels,
    notifications,
    page_links,
    people,
    profiles,
    publishing,
    signin_methods,
    viewsets,
    visibility,
    workspaces,
)
from core.external_api import viewsets as external_api_viewsets

# - Main endpoints
router = DefaultRouter()
router.register("documents", viewsets.DocumentViewSet, basename="documents")
router.register("users", viewsets.UserViewSet, basename="users")
router.register("workspaces", workspaces.WorkspaceViewSet, basename="workspaces")
router.register("spaces", workspaces.SpaceViewSet, basename="spaces")
router.register(
    "notifications", notifications.NotificationViewSet, basename="notifications"
)

# - Routes nested under a workspace
workspace_related_router = DefaultRouter()
workspace_related_router.register(
    "accesses", workspaces.WorkspaceAccessViewSet, basename="workspace_accesses"
)
workspace_related_router.register(
    "groups", workspaces.GroupViewSet, basename="workspace_groups"
)

# - Routes nested under a group
group_related_router = DefaultRouter()
group_related_router.register(
    "members", workspaces.GroupMembershipViewSet, basename="group_members"
)

# - Routes nested under a document
document_related_router = DefaultRouter()
document_related_router.register(
    "accesses",
    viewsets.DocumentAccessViewSet,
    basename="document_accesses",
)
document_related_router.register(
    "invitations",
    viewsets.InvitationViewset,
    basename="invitations",
)
document_related_router.register(
    "threads",
    viewsets.ThreadViewSet,
    basename="threads",
)
document_related_router.register(
    "ask-for-access",
    viewsets.DocumentAskForAccessViewSet,
    basename="ask_for_access",
)

thread_related_router = DefaultRouter()
thread_related_router.register(
    "comments",
    viewsets.CommentViewSet,
    basename="comments",
)

# - Resource server routes
external_api_router = DefaultRouter()
external_api_router.register(
    "documents",
    external_api_viewsets.ResourceServerDocumentViewSet,
    basename="resource_server_documents",
)
external_api_router.register(
    "users",
    external_api_viewsets.ResourceServerUserViewSet,
    basename="resource_server_users",
)


urlpatterns = [
    path(
        f"api/{settings.API_VERSION}/",
        include(
            [
                # before the router, whose users/<id>/ would take them
                path(
                    "users/me/sign-in-methods/",
                    signin_methods.SignInMethodsView.as_view(),
                ),
                path(
                    "users/me/sign-in-methods/<slug:provider>/",
                    signin_methods.SignInMethodView.as_view(),
                ),
                path(
                    "users/me/sign-in-methods/<slug:provider>/add/",
                    signin_methods.AddSignInAccountView.as_view(),
                ),
                path(
                    "users/me/sign-in-methods/<slug:provider>/accounts/<uuid:identity_id>/",
                    signin_methods.SignInAccountView.as_view(),
                ),
                path("users/me/hints/", signin_methods.HintsView.as_view()),
                path(
                    "documents/<uuid:pk>/space-links/",
                    page_links.PageSpaceLinksView.as_view(),
                ),
                path(
                    "documents/<uuid:pk>/space-links/<uuid:link_id>/",
                    page_links.PageSpaceLinkView.as_view(),
                ),
                path("profiles/me/", profiles.MyProfileView.as_view()),
                path("profiles/<uuid:user_id>/", profiles.ProfileView.as_view()),
                path("labels/", labels.LabelListView.as_view()),
                path("labels/cloud/", labels.LabelCloudView.as_view()),
                path("labels/<str:name>/", labels.LabelDetailView.as_view()),
                path(
                    "documents/<uuid:resource_id>/labels/",
                    labels.DocumentLabelsView.as_view(),
                ),
                path(
                    "workspaces/<uuid:workspace_id>/labels/",
                    labels.WorkspaceLabelsView.as_view(),
                ),
                path(
                    "workspaces/discover/",
                    workspaces.WorkspaceDirectoryView.as_view(),
                ),
                path(
                    "workspaces/<uuid:workspace_id>/ask-to-join/",
                    workspaces.AskToJoinView.as_view(),
                ),
                path(
                    "documents/<uuid:resource_id>/visibility/",
                    visibility.DocumentVisibilityView.as_view(),
                ),
                path(
                    "documents/<uuid:pk>/make-independent/",
                    page_links.MakePageIndependentView.as_view(),
                ),
                *router.urls,
                *oidc_urls,
                path("groups/", workspaces.GrantableTeamsView.as_view()),
                path("people/", people.KnownPeopleView.as_view()),
                path("people/<uuid:user_id>/", people.PersonCardView.as_view()),
                path("teams/<str:team>/", people.TeamCardView.as_view()),
                path("join/<str:token>/", workspaces.JoinWorkspaceView.as_view()),
                path("dashboard/layout/", dashboard.DashboardLayoutView.as_view()),
                path("dashboard/recent/", dashboard.DashboardRecentView.as_view()),
                path("dashboard/assigned/", dashboard.DashboardAssignedView.as_view()),
                path(
                    "documents/<uuid:resource_id>/assignments/",
                    dashboard.DocumentAssignmentsView.as_view(),
                ),
                path(
                    "documents/<uuid:resource_id>/publication/",
                    publishing.DocumentPublicationView.as_view(),
                ),
                path(
                    "spaces/<uuid:resource_id>/wiki/",
                    publishing.SpaceWikiView.as_view(),
                ),
                path(
                    "spaces/<uuid:resource_id>/wiki/release/",
                    publishing.SpaceWikiReleaseView.as_view(),
                ),
                path("wiki/<slug:slug>/", publishing.PublicWikiView.as_view()),
                path("wiki/<slug:slug>/search/", publishing.WikiSearchView.as_view()),
                path(
                    "wiki/<slug:slug>/pages/<uuid:page_id>/",
                    publishing.WikiPageView.as_view(),
                ),
                path("wiki-hosts/<str:host>/", publishing.WikiHostView.as_view()),
                path("tls-allowed/", publishing.TlsAllowedView.as_view()),
                path(
                    "workspaces/<uuid:resource_id>/publication-log/",
                    publishing.PublicationLogView.as_view(),
                ),
                re_path(
                    r"^workspaces/(?P<resource_id>[0-9a-z-]*)/",
                    include(workspace_related_router.urls),
                ),
                re_path(
                    r"^groups/(?P<resource_id>[0-9a-z-]*)/",
                    include(group_related_router.urls),
                ),
                re_path(
                    r"^documents/(?P<resource_id>[0-9a-z-]*)/",
                    include(document_related_router.urls),
                ),
                re_path(
                    r"^documents/(?P<resource_id>[0-9a-z-]*)/threads/(?P<thread_id>[0-9a-z-]*)/",
                    include(thread_related_router.urls),
                ),
                path(
                    "user-reconciliations/<str:user_type>/<uuid:confirmation_id>/",
                    viewsets.ReconciliationConfirmView.as_view(),
                ),
            ]
        ),
    ),
    path(f"api/{settings.API_VERSION}/config/", viewsets.ConfigView.as_view()),
    # Public keys validating the tokens we issue to call external services.
    # Nested under "api/" because this is the only prefix routed to the backend
    # by the ingress, a root "/.well-known/" would be served by the frontend.
    path(
        f"api/{settings.API_VERSION}/jwks",
        viewsets.JWKSView.as_view(),
        name="jwks",
    ),
]

if settings.OIDC_RESOURCE_SERVER_ENABLED:
    # - Routes nested under a document in external API
    external_api_document_related_router = DefaultRouter()

    document_access_config = settings.EXTERNAL_API.get("document_access", {})
    if document_access_config.get("enabled", False):
        external_api_document_related_router.register(
            "accesses",
            external_api_viewsets.ResourceServerDocumentAccessViewSet,
            basename="resource_server_document_accesses",
        )

    document_invitation_config = settings.EXTERNAL_API.get("document_invitation", {})
    if document_invitation_config.get("enabled", False):
        external_api_document_related_router.register(
            "invitations",
            external_api_viewsets.ResourceServerInvitationViewSet,
            basename="resource_server_document_invitations",
        )

    urlpatterns.append(
        path(
            f"external_api/{settings.API_VERSION}/",
            include(
                [
                    *external_api_router.urls,
                    re_path(
                        r"^documents/(?P<resource_id>[0-9a-z-]*)/",
                        include(external_api_document_related_router.urls),
                    ),
                ]
            ),
        )
    )

    if settings.OIDC_RS_PRIVATE_KEY_STR:
        # Served under "external_api/" alongside the rest of the resource
        # server, so that it does not collide with the JWKS of the tokens we
        # issue, which lives at "api/<version>/jwks".
        urlpatterns.append(
            path(
                f"external_api/{settings.API_VERSION}/",
                include([*oidc_resource_server_urls]),
            )
        )
