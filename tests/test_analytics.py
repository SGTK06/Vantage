import sys
from pathlib import Path
from types import SimpleNamespace
from datetime import date
from unittest import TestCase

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.analytics import (
    compute_item_spending,
    compute_recurring_items,
    compute_user_spending_analytics,
)


class FakeInvoiceQuery:
    """Minimal chainable Supabase query fake for spending analytics tests."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.ordering = None

    def select(self, fields):
        self.selected_fields = fields
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def order(self, field, desc=False):
        self.ordering = (field, desc)
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class FakeSupabase:
    """Supabase fake exposing the invoice query used by analytics."""

    def __init__(self, rows):
        self.query = FakeInvoiceQuery(rows)

    def table(self, name):
        if name != "invoices":
            raise AssertionError(f"Unexpected table: {name}")
        return self.query


class TestSpendingAnalytics(TestCase):
    """Documents the aggregation contract for user spending statistics."""

    def test_empty_invoice_result_returns_zeroed_analytics(self):
        """An account without invoices should receive a complete zero-value response."""
        supabase = FakeSupabase([])

        result = compute_user_spending_analytics("user-1", supabase)

        self.assertEqual(result.total_spend, 0.0)
        self.assertEqual(result.invoice_count, 0)
        self.assertEqual(result.vendor_count, 0)
        self.assertEqual(result.active_categories_count, 0)
        self.assertIsNone(result.top_vendor_name)
        self.assertIsNone(result.top_category_name)
        self.assertEqual(result.top_vendors, [])
        self.assertEqual(result.category_breakdown, [])
        self.assertEqual(result.monthly_trend, [])
        self.assertIsNone(result.largest_invoice)

    def test_aggregates_invoice_totals_and_groups(self):
        """Invoice totals should drive vendor, category, monthly, tax, and largest-invoice statistics."""
        supabase = FakeSupabase([
            {
                "invoice_number": "INV-2",
                "supplier_name": "Fallback Vendor",
                "invoice_date": "2024-01-15",
                "total_amount": 80,
                "tax_amount": 8,
                "discount_amount": 2,
                "line_items": [
                    {"description": "Keyboard", "quantity": 2, "unit_cost": 20,
                     "product_categories": {"name": "IT Hardware"}},
                    {"description": "Paper", "total_cost": 40, "product_categories": {}},
                ],
            },
            {
                "invoice_number": "INV-1",
                "invoice_date": "2023-12-20",
                "uploaded_at": "2023-12-21T10:00:00",
                "total_amount": 120.126,
                "tax_amount": 12.5,
                "discount_amount": 0,
                "vendors": {"name": "Acme"},
                "line_items": [
                    {"description": "Monitor", "total_cost": 120,
                     "product_categories": {"name": "IT Hardware"}},
                ],
            },
        ])

        result = compute_user_spending_analytics("user-1", supabase)

        self.assertEqual(supabase.query.filters, [("user_id", "user-1")])
        self.assertEqual(supabase.query.ordering, ("invoice_date", True))
        self.assertEqual(result.total_spend, 200.13)
        self.assertEqual(result.average_invoice_amount, 100.06)
        self.assertEqual(result.total_tax_paid, 20.5)
        self.assertEqual(result.total_discount_received, 2.0)
        self.assertEqual(result.top_vendor_name, "Acme")
        self.assertEqual(result.top_vendor_spend, 120.13)
        self.assertEqual(result.vendor_count, 2)
        self.assertEqual(result.top_category_name, "IT Hardware")
        self.assertEqual(result.top_category_spend, 160.0)
        self.assertEqual(result.top_category_share, 80.0)
        self.assertEqual(result.category_breakdown[1].category_name, "Uncategorized")
        self.assertEqual([(item.month, item.total_spend) for item in result.monthly_trend],
                         [("2023-12", 120.13), ("2024-01", 80.0)])
        self.assertEqual(result.largest_invoice.invoice_number, "INV-1")
        self.assertEqual(result.largest_invoice.vendor_name, "Acme")
        self.assertEqual(result.largest_invoice.amount, 120.126)

    def test_top_n_vendors_and_missing_dates_use_fallbacks(self):
        """Top vendors should be limited while missing vendor and date fields remain representable."""
        supabase = FakeSupabase([
            {"supplier_name": "A", "total_amount": 50, "uploaded_at": "2024-03-01T00:00:00"},
            {"supplier_name": "B", "total_amount": 30},
            {"total_amount": 20},
        ])

        result = compute_user_spending_analytics("user-2", supabase, top_n_vendors=2)

        self.assertEqual([vendor.vendor_name for vendor in result.top_vendors], ["A", "B"])
        self.assertEqual(result.vendor_count, 3)
        self.assertEqual(result.top_vendors[0].spend_percentage, 50.0)
        self.assertEqual(result.monthly_trend[-1].month, "Unspecified")
        self.assertEqual(result.largest_invoice.vendor_name, "A")

    def test_item_spending_uses_invoice_date_and_normalizes_descriptions(self):
        supabase = FakeSupabase([
            {
                "id": "invoice-1",
                "invoice_date": "2024-01-05",
                "vendors": {"name": "Acme"},
                "line_items": [
                    {"description": " Paper  ", "quantity": 2, "unit_cost": 4,
                     "product_categories": {"name": "Office"}},
                ],
            },
            {
                "id": "invoice-2",
                "invoice_date": "2024-01-20",
                "vendors": {"name": "Beta"},
                "line_items": [
                    {"description": "paper", "total_cost": 10,
                     "product_categories": {"name": "Office"}},
                ],
            },
            {
                "id": "invoice-outside",
                "invoice_date": "2024-02-01",
                "line_items": [{"description": "Paper", "total_cost": 100}],
            },
        ])

        result = compute_item_spending(
            "user-1", supabase, date(2024, 1, 1), date(2024, 1, 31)
        )

        self.assertEqual(result["start_date"], "2024-01-01")
        self.assertEqual(result["matched_item_count"], 1)
        self.assertEqual(result["items"][0]["item_name"], "Paper")
        self.assertEqual(result["items"][0]["total_spend"], 18.0)
        self.assertEqual(result["items"][0]["purchase_count"], 2)
        self.assertEqual(result["items"][0]["invoice_count"], 2)
        self.assertEqual(result["items"][0]["vendors"], ["Acme", "Beta"])

    def test_recurring_items_require_three_distinct_months(self):
        rows = []
        for index, month in enumerate(("2024-01", "2024-02", "2024-04"), start=1):
            line_items = [{"description": "Monthly hosting", "total_cost": 25}]
            if month == "2024-01":
                line_items.append({"description": "One-off item", "total_cost": 100})
            rows.append({
                "id": f"invoice-{index}",
                "invoice_date": f"{month}-10",
                "line_items": line_items,
            })

        result = compute_recurring_items("user-1", FakeSupabase(rows))

        self.assertEqual(result["matched_item_count"], 1)
        self.assertEqual(result["items"][0]["item_name"], "Monthly hosting")
        self.assertEqual(result["items"][0]["distinct_months"], 3)
        self.assertEqual(result["items"][0]["total_spend"], 75.0)
