"""
Collaborators: a repeated return from the sign-in server for a finished
sign-in ("authentication_expired") no longer signs the person out.
"""

import pytest
from rest_framework.test import APIClient

from core import factories

pytestmark = pytest.mark.django_db

CALLBACK = "/api/v1.0/callback/"
EXPIRED = "?error=temporarily_unavailable&error_description=authentication_expired"


def _with_state(client, state):
    session = client.session
    session["oidc_states"] = {state: {"nonce": "n", "code_verifier": None}}
    session.save()


def test_a_repeated_return_keeps_one_signed_in():
    """Just signed in, the duplicate leads on; the person stays signed in."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    _with_state(client, "pending")

    response = client.get(f"{CALLBACK}{EXPIRED}&state=done")

    assert response.status_code == 302
    assert client.get("/api/v1.0/users/me/").status_code == 200
    # A sign-in still waiting for its return keeps its state
    assert "pending" in client.session["oidc_states"]


def test_a_repeated_return_first_leaves_the_sign_in_to_finish():
    """Arriving before the real return, it doesn't spend the state."""
    client = APIClient()
    _with_state(client, "s1")

    response = client.get(f"{CALLBACK}{EXPIRED}&state=s1")

    assert response.status_code == 302
    assert "s1" in client.session["oidc_states"]


def test_other_errors_still_sign_out():
    """A refused sign-in, say, signs out as before and spends the state."""
    client = APIClient()
    client.force_login(factories.UserFactory())
    _with_state(client, "s1")

    response = client.get(f"{CALLBACK}?error=access_denied&state=s1")

    assert response.status_code == 302
    assert client.get("/api/v1.0/users/me/").status_code == 401
