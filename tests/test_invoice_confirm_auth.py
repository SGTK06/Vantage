import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, mock

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from fastapi.testclient import TestClient
from app.auth import get_current_user
from app.main import app


class FakeStorageBucket:
    def __init__(self):
        self.uploads = []
        self.removals = []

    def upload(self, path, content, options):
        self.uploads.append((path, content, options))

    def remove(self, paths):
        self.removals.extend(paths)


class FakeTable:
    def __init__(self, table_name):
        self.table_name = table_name
        self.payload = None
        self.deleted_id = None

    def insert(self, payload):
        self.payload = payload
        return self

    def select(self, *_):
        return self

    def delete(self):
        return self

    def eq(self, column, value):
        if column == "id":
            self.deleted_id = value
        return self

    def execute(self):
        if self.table_name == "invoices":
            return SimpleNamespace(data=[{"id": "invoice-1", "user_id": "user-1"}])
        return SimpleNamespace(data=self.payload if isinstance(self.payload, list) else [])


class FakeSupabase:
    def __init__(self):
        self.storage_bucket = FakeStorageBucket()
        self.tables = {}
        self.storage = SimpleNamespace(from_=lambda _: self.storage_bucket)

    def table(self, name):
        self.tables.setdefault(name, FakeTable(name))
        return self.tables[name]


class TestInvoiceConfirmAuth(TestCase):
    def setUp(self):
        self.user = SimpleNamespace(id="user-1", email="alice@example.com")
        app.dependency_overrides[get_current_user] = lambda: self.user
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()

    def _confirm_invoice(self):
        fake_supabase = FakeSupabase()
        invoice = {
            "supplier_name": "Acme",
            "invoice_number": "INV-1",
            "total_amount": 100,
            "line_items": [],
        }

        with mock.patch("app.main.get_authenticated_supabase_client", return_value=fake_supabase) as get_client:
            response = self.client.post(
                "/api/invoices/confirm",
                headers={"Authorization": "Bearer user-token"},
                files={"file": ("invoice.pdf", b"pdf", "application/pdf")},
                data={"invoice_data_str": str(invoice).replace("'", '"')},
            )

        return response, fake_supabase, get_client

    def test_confirm_saves_invoice_successfully(self):
        """A valid PDF and invoice payload should be accepted and saved."""
        response, _, _ = self._confirm_invoice()
        self.assertEqual(response.status_code, 200, response.text)

    def test_confirm_forwards_validated_bearer_token_to_supabase_client(self):
        """The validated bearer token should be forwarded to the request-scoped client."""
        _, _, get_client = self._confirm_invoice()
        get_client.assert_called_once_with("user-token")

    def test_confirm_scopes_uploaded_file_to_the_authenticated_user(self):
        """The stored invoice record should retain the authenticated user's identifier."""
        _, fake_supabase, _ = self._confirm_invoice()
        self.assertEqual(fake_supabase.tables["invoices"].payload["user_id"], "user-1")
