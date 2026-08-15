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
from app.data_models import Invoice
from app.main import app


class TestInvoiceEndpoints(TestCase):
    """Covers request validation and persistence-facing behavior of invoice endpoints."""

    def setUp(self):
        self.client = TestClient(app)
        self.user = SimpleNamespace(id="user-1", email="alice@example.com")
        app.dependency_overrides[get_current_user] = lambda: self.user

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_parse_rejects_non_pdf_uploads(self):
        """The parse endpoint should reject files whose extension is not PDF."""
        response = self.client.post("/api/invoices/parse", files={"file": ("invoice.txt", b"text", "text/plain")})
        self.assertEqual(response.status_code, 400)

    def test_parse_rejects_empty_pdf_uploads(self):
        """The parse endpoint should reject an empty PDF before invoking extraction."""
        response = self.client.post("/api/invoices/parse", files={"file": ("invoice.pdf", b"", "application/pdf")})
        self.assertEqual(response.status_code, 400)

    def test_confirm_rejects_invalid_invoice_payload(self):
        """The confirm endpoint should reject malformed extracted invoice data."""
        response = self.client.post(
            "/api/invoices/confirm",
            headers={"Authorization": "Bearer user-token"},
            files={"file": ("invoice.pdf", b"pdf", "application/pdf")},
            data={"invoice_data_str": "{not-json"},
        )
        self.assertEqual(response.status_code, 400)

    def test_parse_returns_structured_extraction(self):
        """A valid PDF should return the structured invoice produced by extraction."""
        extracted = Invoice(supplier_name="Acme", invoice_number="INV-1", total_amount=100)
        with mock.patch("app.main.extract_invoice", return_value=extracted):
            response = self.client.post("/api/invoices/parse", files={"file": ("invoice.pdf", b"pdf", "application/pdf")})
        self.assertEqual(response.json()["invoice_number"], "INV-1")

    def test_list_invoices_filters_by_authenticated_user(self):
        """The dashboard query should return the authenticated user's invoice data."""
        fake_table = mock.MagicMock()
        fake_table.select.return_value.eq.return_value.order.return_value.execute.return_value = SimpleNamespace(
            data=[{"id": "invoice-1", "user_id": "user-1"}]
        )
        fake_supabase = SimpleNamespace(table=mock.Mock(return_value=fake_table))
        with mock.patch("app.main.get_authenticated_supabase_client", return_value=fake_supabase):
            response = self.client.get("/api/invoices", headers={"Authorization": "Bearer user-token"})
        self.assertEqual(response.json()["data"][0]["user_id"], "user-1")
