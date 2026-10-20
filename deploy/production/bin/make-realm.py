"""
The production Keycloak realm, made from the development one
(docker/auth/realm.json): renamed "collaborators", without the development
test accounts, signing in through the providers only, and its app client
("collaborators") limited to the app's address with a secret of its own.

    APP_HOST=collaborators.community OIDC_CLIENT_SECRET=… \\
        python3 make-realm.py docker/auth/realm.json > collaborators-realm.json

The providers (Google, Microsoft, LinkedIn) and the rest are set afterwards by
bin/setup-keycloak.sh, as in development.
"""

import json
import os
import sys

APP = os.environ["APP_HOST"]
SECRET = os.environ["OIDC_CLIENT_SECRET"]

realm = json.load(open(sys.argv[1], encoding="utf-8"))

realm["realm"] = "collaborators"
# No accounts: they are made by signing in with a provider
realm.pop("users", None)
realm.pop("identityProviders", None)
realm.pop("identityProviderMappers", None)
realm.pop("smtpServer", None)
realm.update(
    {
        "displayName": "Collaborators",
        "sslRequired": "external",
        "registrationAllowed": False,
        "resetPasswordAllowed": False,
        "rememberMe": True,
        "verifyEmail": True,
        "loginWithEmailAllowed": True,
        "duplicateEmailsAllowed": False,
        "bruteForceProtected": True,
    }
)

# The default role is named after the realm: default-roles-collaborators
old_default = "default-roles-impress"
for role in realm.get("roles", {}).get("realm", []):
    if role.get("name") == old_default:
        role["name"] = "default-roles-collaborators"
if realm.get("defaultRole", {}).get("name") == old_default:
    realm["defaultRole"]["name"] = "default-roles-collaborators"

# Its roles are filed under the client's name; ids are kept, roles refer to them
client_roles = realm.get("roles", {}).get("client", {})
if "impress" in client_roles:
    client_roles["collaborators"] = client_roles.pop("impress")

for client in realm.get("clients", []):
    # Keycloak's own consoles, addressed by the realm's name
    for key in ("baseUrl", "rootUrl", "adminUrl"):
        if client.get(key):
            client[key] = client[key].replace("/impress/", "/collaborators/")
    client["redirectUris"] = [
        uri.replace("/impress/", "/collaborators/")
        for uri in client.get("redirectUris", [])
    ]
    if client["clientId"] != "impress":
        continue
    client["clientId"] = "collaborators"
    client["name"] = "Collaborators"
    client["secret"] = SECRET
    client["rootUrl"] = f"https://{APP}"
    client["baseUrl"] = f"https://{APP}"
    client["redirectUris"] = [f"https://{APP}/*"]
    client["webOrigins"] = [f"https://{APP}"]
    attributes = client.setdefault("attributes", {})
    # Signing out comes back to the app (its redirect addresses)
    attributes["post.logout.redirect.uris"] = "+"
    attributes.pop("client.secret.creation.time", None)

json.dump(realm, sys.stdout, indent=2, ensure_ascii=False)
