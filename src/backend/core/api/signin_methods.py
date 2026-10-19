"""
The in-app "Sign-in methods" page: the providers a collaborator signs in
with, and removing one. Connecting another provider goes through sign-in
(Keycloak's "idp_link" action, started by the frontend).
"""

from django.conf import settings
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import status
from rest_framework.views import APIView

from core.api import permissions
from core.services import keycloak


def _user_id(request):
    """The collaborator's Keycloak id, or an error the page can show."""
    if not keycloak.is_configured():
        raise drf.exceptions.NotFound(_("Sign-in methods are managed elsewhere."))
    try:
        user_id = keycloak.find_user_id(request.user.email or "")
    except keycloak.KeycloakError as err:
        raise drf.exceptions.APIException(
            _("Your sign-in methods can't be read right now.")
        ) from err
    if user_id is None:
        raise drf.exceptions.NotFound(_("Your account isn't known to sign-in."))
    return user_id


def _methods(user_id):
    try:
        return keycloak.sign_in_methods(user_id)
    except keycloak.KeycloakError as err:
        raise drf.exceptions.APIException(
            _("Your sign-in methods can't be read right now.")
        ) from err


class SignInMethodsView(APIView):
    """
    GET /users/me/sign-in-methods/ — each provider offered, and whether it's
    connected (with the account it's connected to).
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List the providers, connected or not."""
        links, has_password = _methods(_user_id(request))
        return drf.response.Response(
            {
                "methods": [
                    {
                        "provider": provider,
                        "connected": provider in links,
                        "account": links.get(provider, ""),
                    }
                    for provider in settings.COLLABORATORS_SIGNIN_PROVIDERS
                ],
                # The development test accounts sign in with a password too
                "has_password": has_password,
            }
        )


class SignInMethodView(APIView):
    """DELETE /users/me/sign-in-methods/<provider>/ — never the last one."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, provider):
        """Disconnect a provider."""
        user_id = _user_id(request)
        links, has_password = _methods(user_id)
        if provider not in links:
            raise drf.exceptions.NotFound()
        if len(links) + int(has_password) <= 1:
            raise drf.exceptions.ValidationError(
                {
                    "provider": _(
                        "This is your only way to sign in: connect another one first."
                    )
                }
            )
        try:
            keycloak.unlink(user_id, provider)
        except keycloak.KeycloakError as err:
            raise drf.exceptions.APIException(
                _("This sign-in method can't be disconnected right now.")
            ) from err
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)
