"""
The in-app "Sign-in methods" page: the providers a collaborator signs in
with, and removing one. Connecting another provider goes through sign-in
(Keycloak's "idp_link" action, started by the frontend). More Google or
Microsoft accounts can be added (see `core.identities`), and another
account of one's own merged into this one (see `core.merging`).

Also the dashboard hints about them, closed for good one by one: the
welcome note of a new account, and the suggestion to connect another
sign-in method.
"""

from django.conf import settings
from django.utils.translation import gettext_lazy as _

import rest_framework as drf
from rest_framework import status
from rest_framework.views import APIView

from core import identities, joining, merging
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
    connected (with the account it's connected to, and any more accounts of
    it added); and, once, what happened to the account last added.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """List the providers, connected or not."""
        links, has_password = _methods(_user_id(request))
        more = list(request.user.sign_in_identities.all())
        return drf.response.Response(
            {
                "methods": [
                    {
                        "provider": provider,
                        "connected": provider in links,
                        "account": links.get(provider, ""),
                        "more_accounts": [
                            {"id": str(identity.id), "account": identity.account}
                            for identity in more
                            if identity.provider == provider
                        ],
                        "can_add_accounts": provider in links
                        and provider in identities.MULTI_ACCOUNT_PROVIDERS,
                    }
                    for provider in settings.COLLABORATORS_SIGNIN_PROVIDERS
                ],
                # The development test accounts sign in with a password too
                "has_password": has_password,
                "notice": identities.pop_notice(request),
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
        count = len(links) + int(has_password) + request.user.sign_in_identities.count()
        if count <= 1:
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


class AddSignInAccountView(APIView):
    """
    POST /users/me/sign-in-methods/<provider>/add/ {"next": "<app URL>"} —
    start adding another account of this provider; returns {"url"} to go to.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, provider):
        """Start adding an account."""
        if (
            provider not in identities.MULTI_ACCOUNT_PROVIDERS
            or provider not in settings.COLLABORATORS_SIGNIN_PROVIDERS
        ):
            raise drf.exceptions.NotFound()
        try:
            url = identities.start_adding(
                request, provider, str(request.data.get("next") or "/")
            )
        except identities.CantAddError as err:
            raise drf.exceptions.ValidationError(
                {"provider": _("Sign out and in again, then add the account.")}
            ) from err
        return drf.response.Response({"url": url})


class StartMergeView(APIView):
    """
    POST /users/me/merge/start/ {"provider", "next"} — start merging another
    account of one's own: returns {"url"} to go to, to sign in with it.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        """Start a merge."""
        provider = request.data.get("provider")
        if (
            provider not in merging.MERGE_PROVIDERS
            or provider not in settings.COLLABORATORS_SIGNIN_PROVIDERS
        ):
            raise drf.exceptions.ValidationError(
                {"provider": _("Choose how you sign in with the other account.")}
            )
        try:
            url = merging.start(request, provider, str(request.data.get("next") or "/"))
        except merging.MergeError as err:
            raise drf.exceptions.ValidationError({"detail": str(err)}) from err
        return drf.response.Response({"url": url})


class MergeView(APIView):
    """
    GET    /users/me/merge/ — the merge waiting for confirmation (what the
           other account brings), and, once, why one wasn't proposed;
    POST   /users/me/merge/ — merge it into this one;
    DELETE /users/me/merge/ — don't.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """What waits, if anything."""
        waiting = merging.proposal(request)
        return drf.response.Response(
            {
                "proposal": merging.summary(waiting[1]) if waiting else None,
                "notice": merging.pop_notice(request),
            }
        )

    def post(self, request):
        """Merge the other account into this one; it goes."""
        waiting = merging.proposal(request)
        if waiting is None:
            raise drf.exceptions.ValidationError(
                {"detail": _("Sign in with the other account again to merge it.")}
            )
        proposed, gone = waiting
        name = gone.full_name or gone.email
        try:
            merging.merge(request.user, gone, proposed["provider"])
        except merging.MergeError as err:
            raise drf.exceptions.ValidationError({"detail": str(err)}) from err
        request.session.pop(merging.PROPOSAL_SESSION_KEY, None)
        return drf.response.Response({"merged": name})

    def delete(self, request):
        """Forget the merge waiting."""
        request.session.pop(merging.PROPOSAL_SESSION_KEY, None)
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


class SignInAccountView(APIView):
    """DELETE /users/me/sign-in-methods/<provider>/accounts/<id>/ — remove one."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, provider, identity_id):
        """It no longer opens this account."""
        deleted, _count = request.user.sign_in_identities.filter(
            pk=identity_id, provider=provider
        ).delete()
        if not deleted:
            raise drf.exceptions.NotFound()
        joining.merge_organizations(request.user)
        return drf.response.Response(status=status.HTTP_204_NO_CONTENT)


HINTS = ("welcome", "connect-accounts")


class HintsView(APIView):
    """
    GET  /users/me/hints/ — the dashboard hints closed for good
    POST /users/me/hints/ {"hint": "welcome" | "connect-accounts"} — close one
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Which hints are closed."""
        return drf.response.Response(
            {"dismissed": request.user.collaborator_dismissed_hints}
        )

    def post(self, request):
        """Close a hint for good."""
        hint = request.data.get("hint")
        if hint not in HINTS:
            raise drf.exceptions.ValidationError({"hint": _("Unknown hint.")})
        user = request.user
        if hint not in user.collaborator_dismissed_hints:
            user.collaborator_dismissed_hints = [
                *user.collaborator_dismissed_hints,
                hint,
            ]
            user.save(update_fields=["collaborator_dismissed_hints", "updated_at"])
        return drf.response.Response({"dismissed": user.collaborator_dismissed_hints})
