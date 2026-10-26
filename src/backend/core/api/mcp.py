"""
Collaborators: the MCP server people connect their own AI assistant to
(Claude, ChatGPT, Gemini…), at `<app>/mcp` — MCP's "streamable HTTP"
transport, stateless: JSON-RPC requests POSTed, each answered in JSON.

    POST /mcp                                     initialize, ping, tools/list, tools/call
    GET  /.well-known/oauth-protected-resource[/mcp]   where to sign in

Every request carries an access token from the sign-in server (Keycloak):
the assistant registered there on its own and the person signed in and
approved it. The token names the person (by email, as signing in does);
without one, the answer says where to get it. What the assistant may do is
in core.assistants: find the pages the person can edit, and add their input
to one.
"""

import json
import logging
from functools import lru_cache

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.utils.translation import gettext as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

import jwt

from core import assistants, merging, registrations
from core.services import keycloak
from core.services.converter_services import ServiceUnavailableError
from core.services.yhub_services import YHubError

logger = logging.getLogger(__name__)

# Newest first; an older one asked for is answered in kind
PROTOCOL_VERSIONS = ("2025-11-25", "2025-06-18", "2025-03-26")

TOOLS = [
    {
        "name": "find_pages",
        "title": "Find pages",
        "description": (
            "Find the Collaborators pages the user can add input to (pages "
            "they can edit), most recently changed first. Optionally filter "
            "by words of the title."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Words of the page's title (optional)",
                }
            },
        },
        "annotations": {"readOnlyHint": True},
    },
    {
        "name": "add_input_to_page",
        "title": "Add input to a page",
        "description": (
            "Add the user's input at the end of an existing Collaborators page "
            "they can edit. It goes in as a closed toggle heading titled with "
            "the user's name and email; nothing else on the page changes. "
            "Write the input in Markdown (headings, lists, tables, links)."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "page_id": {
                    "type": "string",
                    "description": "The page's id, as find_pages gives it",
                },
                "text": {
                    "type": "string",
                    "description": "The input, in Markdown",
                },
                "assistant_name": {
                    "type": "string",
                    "description": "Your name as an assistant, e.g. Claude",
                },
            },
            "required": ["page_id", "text"],
        },
        "annotations": {"destructiveHint": False, "idempotentHint": False},
    },
]


def resource_url():
    """The MCP server's address, which tokens must be meant for."""
    return settings.COLLABORATORS_MCP_RESOURCE or (
        f"{(settings.EMAIL_URL_APP or '').rstrip('/')}/mcp"
    )


def issuer():
    """The sign-in server's realm, which issues the tokens."""
    endpoint = settings.OIDC_OP_AUTHORIZATION_ENDPOINT or ""
    return endpoint.rsplit("/protocol/", 1)[0]


def _metadata_url():
    base = resource_url().rsplit("/mcp", 1)[0]
    return f"{base}/.well-known/oauth-protected-resource"


@require_http_methods(["GET"])
def protected_resource_metadata(_request):
    """Where an assistant signs in to use this server (RFC 9728)."""
    return JsonResponse(
        {
            "resource": resource_url(),
            "authorization_servers": [issuer()],
            "bearer_methods_supported": ["header"],
            "scopes_supported": ["openid", "email", "profile"],
            "resource_name": "Collaborators",
        }
    )


@lru_cache(maxsize=1)
def _jwks():
    return jwt.PyJWKClient(settings.OIDC_OP_JWKS_ENDPOINT, cache_keys=True)


def _unauthorized(error=None):
    challenge = f'Bearer resource_metadata="{_metadata_url()}"'
    if error:
        challenge += f', error="{error}"'
    response = JsonResponse({"error": error or "unauthorized"}, status=401)
    response["WWW-Authenticate"] = challenge
    return response


def person_of(token):
    """The person a valid token names, and the token's claims; else None."""
    try:
        key = _jwks().get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=resource_url(),
            issuer=issuer(),
        )
    except (jwt.PyJWTError, ValueError) as err:
        logger.info("MCP token refused: %s", err)
        return None, None
    user = merging.account_of(claims.get("sub"), claims.get("email"))
    if (
        user is None
        or not user.is_active
        or user.registration_status != registrations.APPROVED
    ):
        return None, claims
    return user, claims


@lru_cache(maxsize=256)
def _known_client_name(client_id):
    # Only names found are kept: a failed lookup is tried again next time
    name = keycloak.client_name(client_id)
    if not name:
        raise LookupError(client_id)
    return name


def client_name(client_id):
    """The name an assistant registered under at the sign-in server, or ""."""
    if not client_id:
        return ""
    try:
        return _known_client_name(client_id)
    except LookupError, keycloak.KeycloakError:
        return ""


def _result(request_id, result):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id, code, message):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def _text(text, is_error=False, structured=None):
    result = {"content": [{"type": "text", "text": text}], "isError": is_error}
    if structured is not None:
        result["structuredContent"] = structured
    return result


def _call_tool(user, claims, name, arguments):
    """Run one tool as the person; errors become a result the model reads."""
    if name == "find_pages":
        pages = assistants.editable_pages(user, arguments.get("query") or "")
        if not pages:
            return _text(_("No page you can edit matches."), structured={"pages": []})
        return _text(json.dumps(pages, ensure_ascii=False), structured={"pages": pages})
    if name == "add_input_to_page":
        assistant = (arguments.get("assistant_name") or "").strip() or client_name(
            claims.get("azp") or ""
        )
        try:
            page = assistants.add_input(
                user, arguments.get("page_id"), arguments.get("text"), assistant
            )
        except assistants.InputError as err:
            return _text(str(err), is_error=True)
        except ServiceUnavailableError, YHubError:
            logger.exception("MCP input not added")
            return _text(_("The input could not be added right now."), is_error=True)
        return _text(
            _("Added to “{title}”: {url}").format(title=page["title"], url=page["url"]),
            structured={"page": page},
        )
    return None


def _initialize(_user, _claims, params):
    asked = params.get("protocolVersion")
    return {
        "protocolVersion": asked
        if asked in PROTOCOL_VERSIONS
        else PROTOCOL_VERSIONS[0],
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {
            "name": "collaborators",
            "title": "Collaborators",
            "version": "1.0",
        },
        "instructions": (
            "Collaborators is where the user's teams write pages together. "
            "You can find the pages the user can edit, and add the user's "
            "input to one of them; it appears at the end of the page, in a "
            "toggle heading with their name. Ask which page when unsure."
        ),
    }


def _tools_call(user, claims, params):
    return _call_tool(user, claims, params.get("name"), params.get("arguments") or {})


METHODS = {
    "initialize": _initialize,
    "ping": lambda _user, _claims, _params: {},
    "tools/list": lambda _user, _claims, _params: {"tools": TOOLS},
    "tools/call": _tools_call,
}


def _handle(user, claims, message):
    """Answer one JSON-RPC message; None for a notification."""
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return _error(None, -32600, "Invalid request")
    request_id = message.get("id")
    if request_id is None:
        # notifications (initialized, cancelled…): nothing to answer
        return None
    method = METHODS.get(message.get("method"))
    if method is None:
        return _error(request_id, -32601, "Method not found")
    result = method(user, claims, message.get("params") or {})
    if result is None:
        return _error(request_id, -32602, "Unknown tool")
    return _result(request_id, result)


@csrf_exempt
@require_http_methods(["POST", "GET", "DELETE"])
def mcp_endpoint(request):
    """The MCP server: one JSON-RPC message per request, answered in JSON."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return _unauthorized()
    user, claims = person_of(header.removeprefix("Bearer ").strip())
    if user is None:
        return _unauthorized("invalid_token")
    if request.method != "POST":
        # stateless: no stream to open, no session to end
        return HttpResponse(status=405, headers={"Allow": "POST"})
    try:
        message = json.loads(request.body or b"")
    except ValueError:
        return JsonResponse(_error(None, -32700, "Parse error"), status=400)
    answer = _handle(user, claims, message)
    if answer is None:
        return HttpResponse(status=202)
    return JsonResponse(answer)
