"""URL configuration for the impress project"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path, re_path

from drf_spectacular.views import (
    SpectacularJSONAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

from core.api import mcp

urlpatterns = [
    path("admin/", admin.site.urls),
    # Collaborators: the MCP server for people's own AI assistants
    path("mcp", mcp.mcp_endpoint, name="mcp"),
    path(
        ".well-known/oauth-protected-resource",
        mcp.protected_resource_metadata,
        name="mcp-resource-metadata",
    ),
    path(
        ".well-known/oauth-protected-resource/mcp",
        mcp.protected_resource_metadata,
    ),
    path("", include("core.urls")),
]

# Serve the Prometheus metrics only when they are enabled for this environment
# (PROMETHEUS_METRICS_ENABLED=1). Outside of /api/ on purpose, so that the ingress
# of the application does not publish them, and behind a bearer token
# (core.middleware.PrometheusAuthMiddleware) — see documentation/metrics.md.
if settings.PROMETHEUS_METRICS_ENABLED:
    from core.metrics import metrics_view
    from core.middleware import METRICS_PATH

    urlpatterns += [
        path(METRICS_PATH.lstrip("/"), metrics_view, name="prometheus-metrics")
    ]

# Serve the django-silk profiling UI at /silk/ only when profiling is enabled
# for this environment (SILK_ENABLED=1). The view itself is further gated behind
# a staff session by SILKY_AUTHENTICATION / SILKY_AUTHORISATION.
if settings.SILK_ENABLED:
    urlpatterns += [path("silk/", include("silk.urls", namespace="silk"))]

if settings.DEBUG:
    urlpatterns = (
        urlpatterns
        + staticfiles_urlpatterns()
        + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    )


if settings.USE_SWAGGER or settings.DEBUG:
    urlpatterns += [
        path(
            f"api/{settings.API_VERSION}/swagger.json",
            SpectacularJSONAPIView.as_view(
                api_version=settings.API_VERSION,
                urlconf="core.urls",
            ),
            name="client-api-schema",
        ),
        path(
            f"api/{settings.API_VERSION}/swagger/",
            SpectacularSwaggerView.as_view(url_name="client-api-schema"),
            name="swagger-ui-schema",
        ),
        re_path(
            f"api/{settings.API_VERSION}/redoc/",
            SpectacularRedocView.as_view(url_name="client-api-schema"),
            name="redoc-schema",
        ),
    ]
