"""
Collaborators: the AI assistants a collaborator connected to Collaborators
through its MCP server (core.api.mcp), as the sign-in server records their
approvals.

    GET    /api/v1.0/users/me/assistants/             the address to connect, and those connected
    DELETE /api/v1.0/users/me/assistants/<client>/    disconnect one
"""

from django.conf import settings
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import status
from rest_framework.views import APIView

from core.api import mcp, permissions
from core.services import keycloak


def _keycloak_user(request):
    if not keycloak.is_configured():
        return None
    try:
        return keycloak.find_user_id(request.user.email or "")
    except keycloak.KeycloakError as err:
        raise drf.exceptions.APIException(
            _("Your assistants can't be read right now.")
        ) from err


def _ours(client_id):
    """The app's own clients, never shown as assistants."""
    return client_id in {
        settings.OIDC_RP_CLIENT_ID,
        settings.COLLABORATORS_KEYCLOAK_CLIENT_ID,
        "account",
        "account-console",
        "broker",
    }


class AssistantsView(APIView):
    """The address to connect an assistant to, and the assistants connected."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List them."""
        user_id = _keycloak_user(request)
        connected = []
        if user_id:
            try:
                approvals = keycloak.consents(user_id)
            except keycloak.KeycloakError as err:
                raise drf.exceptions.APIException(
                    _("Your assistants can't be read right now.")
                ) from err
            for approval in approvals:
                client_id = approval.get("clientId") or ""
                if not client_id or _ours(client_id):
                    continue
                connected.append(
                    {
                        "client_id": client_id,
                        "name": mcp.client_name(client_id) or client_id,
                        "approved_at": approval.get("createdDate"),
                        "last_updated_at": approval.get("lastUpdatedDate"),
                    }
                )
        return drf.response.Response(
            {"mcp_url": mcp.resource_url(), "assistants": connected}
        )


class AssistantView(APIView):
    """Disconnect an assistant: its approval and tokens go."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, client_id):
        """Withdraw the approval."""
        if _ours(client_id):
            raise drf.exceptions.NotFound()
        user_id = _keycloak_user(request)
        if user_id is None:
            raise drf.exceptions.NotFound()
        try:
            keycloak.revoke_consent(user_id, client_id)
        except keycloak.KeycloakError as err:
            raise drf.exceptions.APIException(
                _("The assistant can't be disconnected right now.")
            ) from err
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)
