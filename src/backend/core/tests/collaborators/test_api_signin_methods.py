"""Tests for the in-app Sign-in methods page (Keycloak's admin API mocked)."""

from unittest import mock

import pytest
from rest_framework.test import APIClient

from core import factories
from core.services import keycloak

pytestmark = pytest.mark.django_db

URL = "/api/v1.0/users/me/sign-in-methods/"


@pytest.fixture(name="configured")
def fixture_configured(settings):
    """Keycloak's admin API is set up, with three providers offered."""
    settings.COLLABORATORS_KEYCLOAK_URL = "http://keycloak.test"
    settings.COLLABORATORS_KEYCLOAK_REALM = "collaborators"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_ID = "collaborators-backend"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_SECRET = "secret"
    settings.COLLABORATORS_SIGNIN_PROVIDERS = ["google", "microsoft", "linkedin"]


def client_for(user):
    """An API client logged in as the user."""
    client = APIClient()
    client.force_login(user)
    return client


def test_sign_in_methods_list_each_provider(configured):  # pylint: disable=unused-argument
    """Connected providers show the account they're connected to."""
    user = factories.UserFactory(email="ada@x.test")
    with (
        mock.patch.object(keycloak, "find_user_id", return_value="kc-1") as find,
        mock.patch.object(
            keycloak,
            "sign_in_methods",
            return_value=({"google": "ada@gmail.test"}, False),
        ),
    ):
        response = client_for(user).get(URL)

    find.assert_called_once_with("ada@x.test")
    assert response.json() == {
        "methods": [
            {"provider": "google", "connected": True, "account": "ada@gmail.test"},
            {"provider": "microsoft", "connected": False, "account": ""},
            {"provider": "linkedin", "connected": False, "account": ""},
        ],
        "has_password": False,
    }


def test_sign_in_methods_never_disconnect_the_last_one(configured):  # pylint: disable=unused-argument
    """One method left: it stays; two: one can go."""
    user = factories.UserFactory()
    with (
        mock.patch.object(keycloak, "find_user_id", return_value="kc-1"),
        mock.patch.object(
            keycloak, "sign_in_methods", return_value=({"google": ""}, False)
        ),
        mock.patch.object(keycloak, "unlink") as unlink,
    ):
        response = client_for(user).delete(f"{URL}google/")
    assert response.status_code == 400
    unlink.assert_not_called()

    with (
        mock.patch.object(keycloak, "find_user_id", return_value="kc-1"),
        mock.patch.object(
            keycloak,
            "sign_in_methods",
            return_value=({"google": "", "linkedin": ""}, False),
        ),
        mock.patch.object(keycloak, "unlink") as unlink,
    ):
        response = client_for(user).delete(f"{URL}google/")
        missing = client_for(user).delete(f"{URL}microsoft/")
    assert response.status_code == 204
    unlink.assert_called_once_with("kc-1", "google")
    assert missing.status_code == 404


def test_sign_in_methods_with_a_password_can_drop_every_provider(configured):  # pylint: disable=unused-argument
    """The development test accounts also sign in with a password."""
    user = factories.UserFactory()
    with (
        mock.patch.object(keycloak, "find_user_id", return_value="kc-1"),
        mock.patch.object(
            keycloak, "sign_in_methods", return_value=({"google": ""}, True)
        ),
        mock.patch.object(keycloak, "unlink") as unlink,
    ):
        response = client_for(user).delete(f"{URL}google/")
    assert response.status_code == 204
    unlink.assert_called_once()


def test_sign_in_methods_unavailable(settings):
    """Without the admin API, or with Keycloak down, the page says so."""
    settings.COLLABORATORS_KEYCLOAK_URL = ""
    user = factories.UserFactory()
    assert client_for(user).get(URL).status_code == 404

    settings.COLLABORATORS_KEYCLOAK_URL = "http://keycloak.test"
    settings.COLLABORATORS_KEYCLOAK_REALM = "collaborators"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_ID = "collaborators-backend"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_SECRET = "secret"
    with mock.patch.object(
        keycloak, "find_user_id", side_effect=keycloak.KeycloakError()
    ):
        assert client_for(user).get(URL).status_code == 500
    assert APIClient().get(URL).status_code == 401


def test_keycloak_client_reads_links_and_password(settings):
    """The service asks the admin API with a cached service token."""
    settings.COLLABORATORS_KEYCLOAK_URL = "http://keycloak.test/"
    settings.COLLABORATORS_KEYCLOAK_REALM = "collaborators"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_ID = "collaborators-backend"
    settings.COLLABORATORS_KEYCLOAK_CLIENT_SECRET = "secret"
    token = mock.Mock(ok=True, status_code=200)
    token.json.return_value = {"access_token": "t", "expires_in": 300}

    def answer(method, url, **_kwargs):
        body = (
            [{"identityProvider": "google", "userName": "ada@gmail.test"}]
            if url.endswith("/federated-identity")
            else [{"type": "password"}]
        )
        return mock.Mock(ok=True, status_code=200, content=b"x", json=lambda: body)

    with (
        mock.patch("core.services.keycloak.requests.post", return_value=token) as post,
        mock.patch(
            "core.services.keycloak.requests.request", side_effect=answer
        ) as req,
    ):
        links, has_password = keycloak.sign_in_methods("kc-1")
        keycloak.sign_in_methods("kc-1")

    assert links == {"google": "ada@gmail.test"}
    assert has_password is True
    # one token for both calls
    post.assert_called_once()
    assert post.call_args.args[0] == (
        "http://keycloak.test/realms/collaborators/protocol/openid-connect/token"
    )
    assert req.call_args_list[0].args[1] == (
        "http://keycloak.test/admin/realms/collaborators/users/kc-1/federated-identity"
    )


# -- Dashboard hints


def test_hints_close_for_good():
    """A closed hint stays closed; unknown hints are refused."""
    user = factories.UserFactory()
    client = client_for(user)
    url = "/api/v1.0/users/me/hints/"

    assert client.get(url).json() == {"dismissed": []}
    assert client.post(url, {"hint": "welcome"}, format="json").json() == {
        "dismissed": ["welcome"]
    }
    client.post(url, {"hint": "welcome"}, format="json")
    client.post(url, {"hint": "connect-accounts"}, format="json")
    assert client.get(url).json() == {"dismissed": ["welcome", "connect-accounts"]}
    assert client.post(url, {"hint": "other"}, format="json").status_code == 400
    assert APIClient().get(url).status_code == 401
