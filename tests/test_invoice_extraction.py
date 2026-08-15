import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, mock

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.invoice_handler import extract_invoice


class ExtractClient:
    """Small fake LlamaCloud client used to exercise extraction polling."""

    def __init__(self, statuses, result=None, error_message=None):
        self.statuses = iter(statuses)
        self.result = result or {}
        self.error_message = error_message
        self.files = SimpleNamespace(create=lambda **_: SimpleNamespace(id="file-1"))
        self.extract = SimpleNamespace(create=self.create_job, get=self.get_job)

    def create_job(self, **_):
        return SimpleNamespace(
            id="job-1",
            status=next(self.statuses),
            extract_result=self.result,
            error_message=self.error_message,
        )

    def get_job(self, _):
        return SimpleNamespace(
            id="job-1",
            status=next(self.statuses),
            extract_result=self.result,
            error_message=self.error_message,
        )


class TestInvoiceExtraction(TestCase):
    """Covers the LlamaCloud extraction lifecycle and its failure boundaries."""

    def test_extract_invoice_returns_validated_invoice_after_polling(self):
        """A completed extraction job should be converted into an Invoice model."""
        result = {"supplier_name": "Acme", "invoice_number": "INV-1", "total_amount": 100}
        client = ExtractClient(["IN_PROGRESS", "COMPLETED"], result=result)
        with mock.patch("app.invoice_handler.get_llama_client", return_value=client), \
             mock.patch("app.invoice_handler.time.sleep"):
            invoice = extract_invoice("invoice.pdf", poll_interval=0)
        self.assertEqual(invoice.invoice_number, "INV-1")

    def test_extract_invoice_raises_for_failed_job(self):
        """A terminal failed extraction should expose the provider error."""
        client = ExtractClient(["FAILED"], error_message="Unreadable PDF")
        with mock.patch("app.invoice_handler.get_llama_client", return_value=client):
            with self.assertRaisesRegex(RuntimeError, "Unreadable PDF"):
                extract_invoice("invoice.pdf")

    def test_extract_invoice_raises_when_polling_times_out(self):
        """An extraction that remains pending beyond its deadline should time out."""
        client = ExtractClient(["IN_PROGRESS"])
        with mock.patch("app.invoice_handler.get_llama_client", return_value=client), \
             mock.patch("app.invoice_handler.time.monotonic", side_effect=[0, 2]):
            with self.assertRaisesRegex(TimeoutError, "timed out"):
                extract_invoice("invoice.pdf", timeout_seconds=1, poll_interval=0)
