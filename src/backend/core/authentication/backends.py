"""Authentication Backends for the Impress core app."""

import logging
import os

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from lasuite.marketing.tasks import create_or_update_contact
from lasuite.oidc_login.backends import (
    OIDCAuthenticationBackend as LaSuiteOIDCAuthenticationBackend,
)
from rest_framework.authentication import (
    SessionAuthentication as BaseSessionAuthentication,
)

from core import identities, joining, models, registrations
from core.models import DuplicateEmailError, User
from core.utils.analytics import PosthogEventName, posthog_capture

logger = logging.getLogger(__name__)


# Settings renamed warnings
if os.environ.get("USER_OIDC_FIELDS_TO_FULLNAME"):
    logger.warning(
        "USER_OIDC_FIELDS_TO_FULLNAME has been renamed to "
        "OIDC_USERINFO_FULLNAME_FIELDS please update your settings."
    )

if os.environ.get("USER_OIDC_FIELD_TO_SHORTNAME"):
    logger.warning(
        "USER_OIDC_FIELD_TO_SHORTNAME has been renamed to "
        "OIDC_USERINFO_SHORTNAME_FIELD please update your settings."
    )


class OIDCAuthenticationBackend(LaSuiteOIDCAuthenticationBackend):
    """Custom OpenID Connect (OIDC) Authentication Backend.

    This class overrides the default OIDC Authentication Backend to accommodate differences
    in the User and Identity models, and handles signed and/or encrypted UserInfo response.
    """

    def get_extra_claims(self, user_info):
        """
        Return extra claims from user_info.

        Args:
          user_info (dict): The user information dictionary.

        Returns:
          dict: A dictionary of extra claims.
        """
        return {
            "full_name": self.compute_full_name(user_info),
            "short_name": user_info.get(settings.OIDC_USERINFO_SHORTNAME_FIELD),
        }

    def get_userinfo(self, access_token, id_token, payload):
        """Keep the user info: whether the email is verified is read later."""
        if getattr(self, "collaborators_access_token", None) == access_token:
            return self.collaborators_user_info
        user_info = super().get_userinfo(access_token, id_token, payload)
        self.collaborators_user_info = user_info
        # To read the organisations the identity providers vouch for
        self.collaborators_access_token = access_token
        return user_info

    def get_or_create_user(self, access_token, id_token, payload):
        """
        Another Google or Microsoft account of a collaborator opens theirs;
        one being added from the sign-in methods page is recorded first.
        """
        user_info = self.get_userinfo(access_token, id_token, payload)
        sub = user_info.get("sub")
        adding = identities.pending_addition(getattr(self, "request", None))
        if sub and adding:
            user, identity, outcome = identities.finish_adding(
                self.request, adding, sub, user_info.get("email")
            )
            if user is not None:
                # Not added: the account signed in with opens another
                # Collaborators account, whose details aren't this one's
                if outcome != identities.SEPARATE:
                    self.collaborators_after_sign_in(user, identity)
                return user
        self.collaborators_identity = None
        return super().get_or_create_user(access_token, id_token, payload)

    def get_existing_user(self, sub, email):
        """
        Fetch the existing user by sub, or the collaborator whose other
        account this is (same query); else by email.
        """
        if sub:
            users = list(
                self.UserModel.objects.filter(
                    Q(sub=sub) | Q(sign_in_identities__sub=sub)
                ).distinct()[:2]
            )
            own = [user for user in users if user.sub == sub]
            if own:
                return own[0]
            if users:
                self.collaborators_identity = models.SignInIdentity.objects.get(sub=sub)
                return users[0]
        try:
            return self.UserModel.objects.get_user_by_email(email)
        except DuplicateEmailError as err:
            raise SuspiciousOperation(err.message) from err

    def update_user_if_needed(self, user, claims):
        """Another account's details (its email, name) aren't the user's."""
        if getattr(self, "collaborators_identity", None) is not None:
            return
        super().update_user_if_needed(user, claims)

    def post_get_or_create_user(self, user, claims, is_new_user):
        """
        Post-processing after user creation or retrieval.

        Args:
          user (User): The user instance.
          claims (dict): The claims dictionary.
          is_new_user (bool): Indicates if the user was newly created.

        Returns:
        - None

        """

        if is_new_user and settings.SIGNUP_NEW_USER_TO_MARKETING_EMAIL:
            create_or_update_contact.delay(
                email=user.email, attributes={"DOCS_SOURCE": ["SIGNIN"]}
            )

        if user:
            posthog_capture(PosthogEventName.USER_LOGIN, user)
            self.collaborators_after_sign_in(
                user, getattr(self, "collaborators_identity", None), is_new_user
            )

    def collaborators_after_sign_in(self, user, identity=None, is_new_user=False):
        """
        Record whether the identity provider verified the email and which
        organisations the providers vouch for, and join the workspaces open to
        them (or ask their admins). Signed in with another of the user's
        accounts (`identity`), its email isn't the user's: only its
        organisations count. A newcomer waiting for a platform administrator
        joins nothing until let in (see core.registrations).
        """
        if identity is None:
            user_info = getattr(self, "collaborators_user_info", None) or {}
            verified = user_info.get("email_verified") is True
            if user.collaborator_email_verified != verified:
                User.objects.filter(pk=user.pk).update(
                    collaborator_email_verified=verified
                )
                user.collaborator_email_verified = verified
            registrations.check_sign_in(user, is_new_user)
        joining.read_organizations(
            user, getattr(self, "collaborators_access_token", None), identity
        )
        if user.registration_status != registrations.APPROVED:
            return
        joining.join_by_domain(user)
        joining.join_by_organization(user)


class SessionAuthentication(BaseSessionAuthentication):
    """
    SessionAuthentication that yields a 401 (instead of 403) for unauthenticated requests.

    DRF chooses between 401 and 403 based on whether the first authentication class returns a
    truthy `authenticate_header`. The stock `SessionAuthentication` does not implement it
    (it inherits `BaseAuthentication.authenticate_header`, which returns `None`), so anonymous
    requests get a misleading 403. Returning a value restores the correct 401, signalling that the
    client may authenticate and retry.
    """

    def authenticate_header(self, request):
        """Return a non-empty challenge so DRF responds with 401 rather than 403."""
        return "Session"

    def authenticate(self, request):
        """
        Collaborators: a newcomer not let in yet (core.registrations) counts as
        signed out, except to read who they are and where their registration
        stands.
        """
        result = super().authenticate(request)
        if result is None:
            return None
        user = result[0]
        if getattr(
            user, "registration_status", registrations.APPROVED
        ) != registrations.APPROVED and not request.path.endswith(
            REGISTRATION_OPEN_PATHS
        ):
            return None
        return result


# What a newcomer waiting for approval may still call
REGISTRATION_OPEN_PATHS = ("/users/me/",)
