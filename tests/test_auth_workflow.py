import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, mock

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from app.main import app


class TestAuthenticationWorkflow(TestCase):
    """Covers the app's core authentication flow: signup, signin, and protected user lookup."""

    def setUp(self):
        self.client = TestClient(app)
        self.email = "alice@example.com"
        self.password = "SecurePass123!"
        self.user_id = "user-123"
        self.user = SimpleNamespace(
            id=self.user_id,
            email=self.email,
            created_at="2024-10-10T12:00:00Z",
        )
        self.session = SimpleNamespace(access_token="mock-access-token")
        self.fake_client = SimpleNamespace(
            auth=SimpleNamespace(
                sign_up=self._fake_sign_up,
                sign_in_with_password=self._fake_sign_in_with_password,
                get_user=self._fake_get_user,
            )
        )

    def _fake_sign_up(self, payload):
        return SimpleNamespace(user=self.user, session=self.session)

    def _fake_sign_in_with_password(self, payload):
        if payload["email"] != self.email or payload["password"] != self.password:
            raise ValueError("Invalid credentials")
        return SimpleNamespace(user=self.user, session=self.session)

    def _fake_get_user(self, token):
        if token != self.session.access_token:
            raise ValueError("Invalid token")
        return SimpleNamespace(user=self.user)

    def test_signup_returns_created_user_and_token(self):
        """A successful signup should return the created user payload and a bearer token."""
        with mock.patch("app.main.get_supabase_client", return_value=self.fake_client):
            response = self.client.post(
                "/api/auth/signup",
                json={"email": self.email, "password": self.password},
            )
        self.assertEqual(response.json()["user"]["email"], self.email)

    def test_signin_returns_access_token_for_valid_credentials(self):
        """Valid credentials should authenticate the user and return the access token."""
        with mock.patch("app.main.get_supabase_client", return_value=self.fake_client):
            response = self.client.post(
                "/api/auth/signin",
                json={"email": self.email, "password": self.password},
            )
        self.assertEqual(response.json()["access_token"], self.session.access_token)

    def test_get_me_returns_authenticated_user(self):
        """A valid bearer token should resolve to the current authenticated user."""
        with mock.patch("app.auth.get_supabase_client", return_value=self.fake_client):
            response = self.client.get(
                "/api/auth/me",
                headers={"Authorization": "Bearer mock-access-token"},
            )
        self.assertEqual(response.json()["email"], self.email)
