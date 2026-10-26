"""
Collaborators: the AI assistants a collaborator connects to Collaborators
through its MCP server (core.api.mcp), shown on the sign-in methods page:
Claude, ChatGPT and Gemini, each connected or not, and any other one.

An assistant is approved at the sign-in server; it is **connected** while
it also has a live session there (its tokens), and **not in use** once
that session is gone: the assistant revoked its tokens as its connector was
removed (if it does), or it went unused long enough for the session to
expire. When it last did something comes from the MCP server's own record.

    GET    /api/v1.0/users/me/assistants/             the address, the three, the others
    DELETE /api/v1.0/users/me/assistants/<client>/    disconnect one (its approval goes)
"""

from urllib.parse import urlparse

from django.conf import settings
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import status
from rest_framework.views import APIView

from core import models
from core.api import mcp, permissions
from core.services import keycloak

# The assistants offered first, recognised by their name, else by where
# their sign-in returns (Gemini's command-line tool returns to localhost)
TOOLS = [
    {
        "id": "claude",
        "name": "Claude",
        "words": ["claude"],
        "hosts": ["claude.ai", "claude.com"],
    },
    {
        "id": "chatgpt",
        "name": "ChatGPT",
        "words": ["chatgpt", "openai"],
        "hosts": ["chatgpt.com", "openai.com"],
    },
    {
        "id": "gemini",
        "name": "Gemini",
        "words": ["gemini"],
        "hosts": ["gemini.google.com", "localhost", "127.0.0.1"],
    },
]


def tool_of(info):
    """Which of the three an approved client is, or None."""
    name = (info.get("name") or "").lower()
    for tool in TOOLS:
        if any(word in name for word in tool["words"]):
            return tool["id"]
    hosts = {urlparse(uri).hostname for uri in info.get("redirect_uris") or []}
    for tool in TOOLS:
        if hosts & set(tool["hosts"]):
            return tool["id"]
    return None


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


def _approved(request, user_id):
    """Each assistant the account approved, with its state."""
    last_used = dict(
        models.AssistantUse.objects.filter(user=request.user).values_list(
            "client_id", "last_used_at"
        )
    )
    approved = []
    for approval in keycloak.consents(user_id):
        client_id = approval.get("clientId") or ""
        if not client_id or _ours(client_id):
            continue
        info = keycloak.client_info(client_id) or {"name": client_id}
        approved.append(
            {
                "client_id": client_id,
                "name": info.get("name") or client_id,
                "tool": tool_of(info),
                "connected": bool(info.get("id"))
                and keycloak.has_session(user_id, info["id"]),
                "approved_at": approval.get("createdDate"),
                "last_used_at": last_used.get(client_id),
            }
        )
    return approved


class AssistantsView(APIView):
    """The address to connect an assistant to, the three, and any other."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Each of Claude, ChatGPT and Gemini, connected or not; the others."""
        user_id = _keycloak_user(request)
        try:
            approved = _approved(request, user_id) if user_id else []
        except keycloak.KeycloakError as err:
            raise drf.exceptions.APIException(
                _("Your assistants can't be read right now.")
            ) from err
        tools = []
        for tool in TOOLS:
            mine = [item for item in approved if item["tool"] == tool["id"]]
            tools.append({"id": tool["id"], "name": tool["name"], "approvals": mine})
        return drf.response.Response(
            {
                "mcp_url": mcp.resource_url(),
                "tools": tools,
                "others": [item for item in approved if item["tool"] is None],
            }
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
        models.AssistantUse.objects.filter(
            user=request.user, client_id=client_id
        ).delete()
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)
