"""Collaborators: the return from the sign-in server after signing in."""

import logging

from django.http import HttpResponseRedirect

from lasuite.oidc_login.views import (
    OIDCAuthenticationCallbackView as LaSuiteOIDCAuthenticationCallbackView,
)

logger = logging.getLogger(__name__)


class OIDCAuthenticationCallbackView(LaSuiteOIDCAuthenticationCallbackView):
    """
    The sign-in server sometimes sends a second return for one sign-in (a
    provider redirecting twice, a second click, the browser repeating the
    request): Keycloak answers it "authentication_expired", as that sign-in
    is already finished. Like any error, it signed the person out (just
    signed in by the first return) and spent the sign-in's state (so a first
    return arriving after it failed): a dashboard loading, then empty.

    That answer now changes nothing: the person stays signed in (or the
    sign-in still waiting for its return can finish), and is sent on.
    """

    def get(self, request):
        """Let a repeated return through untouched; the rest as before."""
        if (
            request.GET.get("error") == "temporarily_unavailable"
            and request.GET.get("error_description") == "authentication_expired"
        ):
            logger.info("A repeated return from the sign-in server, ignored")
            if request.user.is_authenticated:
                return HttpResponseRedirect(self.success_url)
            return HttpResponseRedirect(self.failure_url)
        return super().get(request)
