"""
More than one Google or Microsoft account opening a collaborator's account.

Keycloak links one account per provider to a person. Any other one is a
separate Keycloak user, which a SignInIdentity sends to the collaborator
when it signs in (by its `sub`).

Adding one, from the sign-in methods page: the Keycloak session ends (the
app's stays), then sign-in starts with that provider, whose account chooser
lets the person pick the other account. Back in the app, the account signed
in with is recorded as theirs, unless it already opens a separate
Collaborators account.
"""

import time
from urllib.parse import urlencode

from django.conf import settings
from django.urls import reverse

from core import models

# Providers whose several accounts may open one collaborator's account
MULTI_ACCOUNT_PROVIDERS = ("google", "microsoft")

ADDING_SESSION_KEY = "collaborators_adding_identity"
NOTICE_SESSION_KEY = "collaborators_identity_notice"
# Time to pick the account at the provider
ADDING_TIMEOUT_SECONDS = 15 * 60

ADDED = "added"
ALREADY = "already"
SEPARATE = "separate"


class CantAddError(Exception):
    """Adding an account can't start."""


def start_adding(request, provider, next_url):
    """
    Remember that the signed-in collaborator adds an account of this
    provider, and return where to send them: Keycloak's sign-out, which
    comes back to sign in with that provider.
    """
    logout_endpoint = settings.OIDC_OP_LOGOUT_ENDPOINT
    id_token = request.session.get("oidc_id_token")
    if not logout_endpoint or not id_token:
        raise CantAddError()
    request.session[ADDING_SESSION_KEY] = {
        "user": str(request.user.pk),
        "provider": provider,
        "at": time.time(),
    }
    sign_in = (
        request.build_absolute_uri(reverse("oidc_authentication_init"))
        + "?"
        + urlencode({"kc_idp_hint": provider, "next": next_url})
    )
    return (
        logout_endpoint
        + "?"
        + urlencode({"id_token_hint": id_token, "post_logout_redirect_uri": sign_in})
    )


def pending_addition(request):
    """The account being added in this browser, if any (once)."""
    if request is None or not hasattr(request, "session"):
        return None
    adding = request.session.pop(ADDING_SESSION_KEY, None)
    if not adding or time.time() - adding.get("at", 0) > ADDING_TIMEOUT_SECONDS:
        return None
    return adding


def finish_adding(request, adding, sub, email):
    """
    Record the account just signed in with as one more of the collaborator's.
    Return (user, identity, outcome): the identity it signs in as (None for
    the collaborator's own account, or one not added).
    """
    user = models.User.objects.filter(pk=adding["user"], is_active=True).first()
    if user is None:
        return None, None, None
    provider = adding["provider"]
    identity = models.SignInIdentity.objects.filter(sub=sub).first()
    if sub == user.sub or (identity and identity.user_id == user.pk):
        outcome = ALREADY
    elif identity or models.User.objects.filter(sub=sub).exists():
        outcome = SEPARATE
        identity = None
    else:
        identity = models.SignInIdentity.objects.create(
            user=user, provider=provider, sub=sub, account=email or ""
        )
        outcome = ADDED
    request.session[NOTICE_SESSION_KEY] = {
        "outcome": outcome,
        "provider": provider,
        "account": email or "",
    }
    return user, identity, outcome


def pop_notice(request):
    """What happened to the last account added, to say it once."""
    return request.session.pop(NOTICE_SESSION_KEY, None)
