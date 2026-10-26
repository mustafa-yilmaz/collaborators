"""
The providers (Google, Microsoft, LinkedIn) an account signs in with, as
Keycloak holds them, for the in-app "Sign-in methods" page.

The backend talks to Keycloak's admin API with a service client of its own
(COLLABORATORS_KEYCLOAK_*), which may read users and remove their links to
providers; it also disables, signs out and deletes the accounts platform
administrators suspend or remove (core.accounts). Connecting a provider is
not done here: the app starts Keycloak's "idp_link" action at sign-in, where
the person proves the account is theirs.

At sign-in, the backend also reads the ID tokens Keycloak stored from the
providers (with the person's own access token), for the organisation they
vouch for: a Google Workspace domain ("hd"), a Microsoft tenant ("tid").
"""

import base64
import json

from django.conf import settings
from django.core.cache import cache

import requests

TIMEOUT = 10
TOKEN_CACHE_KEY = "collaborators-keycloak-admin-token"  # noqa: S105 (a cache key)


class KeycloakError(Exception):
    """Keycloak could not be reached, or refused the request."""


def is_configured():
    """Whether the admin API can be used."""
    return bool(
        settings.COLLABORATORS_KEYCLOAK_URL
        and settings.COLLABORATORS_KEYCLOAK_REALM
        and settings.COLLABORATORS_KEYCLOAK_CLIENT_ID
        and settings.COLLABORATORS_KEYCLOAK_CLIENT_SECRET
    )


def _realm_url(admin=False):
    base = settings.COLLABORATORS_KEYCLOAK_URL.rstrip("/")
    realm = settings.COLLABORATORS_KEYCLOAK_REALM
    return f"{base}/admin/realms/{realm}" if admin else f"{base}/realms/{realm}"


def _token():
    """A token of the service client, kept until shortly before it expires."""
    token = cache.get(TOKEN_CACHE_KEY)
    if token:
        return token
    try:
        response = requests.post(
            f"{_realm_url()}/protocol/openid-connect/token",
            data={
                "grant_type": "client_credentials",
                "client_id": settings.COLLABORATORS_KEYCLOAK_CLIENT_ID,
                "client_secret": settings.COLLABORATORS_KEYCLOAK_CLIENT_SECRET,
            },
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        body = response.json()
    except (requests.RequestException, ValueError) as err:
        raise KeycloakError("No token for the Keycloak admin API") from err
    cache.set(
        TOKEN_CACHE_KEY,
        body["access_token"],
        max(int(body.get("expires_in", 60)) - 30, 1),
    )
    return body["access_token"]


def _request(method, path, missing_ok=False, **kwargs):
    try:
        response = requests.request(
            method,
            f"{_realm_url(admin=True)}{path}",
            headers={"Authorization": f"Bearer {_token()}"},
            timeout=TIMEOUT,
            **kwargs,
        )
    except requests.RequestException as err:
        raise KeycloakError(f"Keycloak unreachable for {path}") from err
    if missing_ok and response.status_code == 404:
        return None
    if response.status_code == 401:
        # an expired token kept a little too long: get a new one, once
        cache.delete(TOKEN_CACHE_KEY)
    if not response.ok:
        raise KeycloakError(f"Keycloak answered {response.status_code} for {path}")
    return response.json() if response.content else None


def find_user_id(email):
    """The Keycloak id of the account with this email (unique in the realm)."""
    users = _request("get", "/users", params={"email": email, "exact": "true"})
    matching = [
        user
        for user in users or []
        if (user.get("email") or "").lower() == email.lower()
    ]
    return matching[0]["id"] if matching else None


def sign_in_methods(user_id):
    """The providers linked to the account, and whether it has a password."""
    links = _request("get", f"/users/{user_id}/federated-identity") or []
    credentials = _request("get", f"/users/{user_id}/credentials") or []
    return (
        {link["identityProvider"]: link.get("userName") or "" for link in links},
        any(credential.get("type") == "password" for credential in credentials),
    )


def unlink(user_id, provider):
    """Remove a provider from the account."""
    _request("delete", f"/users/{user_id}/federated-identity/{provider}")


def set_enabled(user_id, enabled):
    """
    Let the account sign in, or not; disabled, its sessions end too. An
    account missing there has nothing to change.
    """
    _request("put", f"/users/{user_id}", missing_ok=True, json={"enabled": enabled})
    if not enabled:
        _request("post", f"/users/{user_id}/logout", missing_ok=True)


def delete_user(user_id):
    """Delete the account (already gone is fine)."""
    _request("delete", f"/users/{user_id}", missing_ok=True)


def client_info(client_id):
    """A client's name and sign-in return addresses, or None."""
    clients = _request("get", "/clients", params={"clientId": client_id}) or []
    if not clients:
        return None
    return {
        "id": clients[0].get("id"),
        "name": clients[0].get("name") or clients[0].get("clientId") or "",
        "redirect_uris": clients[0].get("redirectUris") or [],
    }


def client_name(client_id):
    """The name a client (an assistant that registered) goes by, or None."""
    info = client_info(client_id)
    return info["name"] if info else None


def consents(user_id):
    """
    The clients (assistants) the account approved: [{clientId, createdDate,
    lastUpdatedDate, grantedClientScopes, …}].
    """
    return _request("get", f"/users/{user_id}/consents") or []


def has_session(user_id, client_uuid):
    """
    Whether the account has a live session with this client: an offline one
    (its refresh tokens), or an online one. An assistant revoking its tokens
    when its connector is removed ends it; so does a long idle time.
    """
    offline = _request(
        "get", f"/users/{user_id}/offline-sessions/{client_uuid}", missing_ok=True
    )
    if offline:
        return True
    online = _request("get", f"/users/{user_id}/sessions") or []
    return any(client_uuid in (session.get("clients") or {}) for session in online)


def revoke_consent(user_id, client_id):
    """Withdraw an approval (and the tokens that came with it)."""
    _request("delete", f"/users/{user_id}/consents/{client_id}", missing_ok=True)


def provider_id_token_claims(access_token, provider):
    """
    The claims of the ID token Keycloak stored at the person's last sign-in
    with this provider, or None (not linked, no token stored yet).

    The token came to Keycloak straight from the provider's token endpoint,
    and to us straight from Keycloak: its signature isn't checked again.
    """
    try:
        response = requests.get(
            f"{_realm_url()}/broker/{provider}/token",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=TIMEOUT,
        )
    except requests.RequestException as err:
        raise KeycloakError(f"Keycloak unreachable for the {provider} token") from err
    if response.status_code in (400, 403, 404):
        # not linked to this provider, or nothing stored
        return None
    if not response.ok:
        raise KeycloakError(
            f"Keycloak answered {response.status_code} for the {provider} token"
        )
    try:
        id_token = response.json().get("id_token")
        if not id_token:
            return None
        payload = id_token.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except ValueError, IndexError, AttributeError:
        return None
