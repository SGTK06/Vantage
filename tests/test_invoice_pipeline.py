import sys
from pathlib import Path
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.data_models import Invoice
from app.schemas import InvoiceExtractData


class TestInvoiceSchemas(TestCase):
    """Documents the validation boundary between extracted invoice data and API data."""

    def test_invoice_model_keeps_nested_line_items(self):
        """A valid extracted invoice should produce typed nested line-item models."""
        invoice = Invoice.model_validate({
            "supplier_name": "Acme",
            "invoice_number": "INV-1",
            "total_amount": 125.5,
            "line_items": [{"description": "Hosting", "quantity": 1, "unit_cost": 125.5}],
        })
        self.assertEqual(invoice.line_items[0].description, "Hosting")

    def test_api_invoice_schema_rejects_missing_total(self):
        """The API schema should reject parsed payloads without a final total."""
        with self.assertRaises(ValueError):
            InvoiceExtractData.model_validate({"supplier_name": "Acme", "invoice_number": "INV-1"})
