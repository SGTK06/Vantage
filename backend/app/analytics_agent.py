import logging
from datetime import date, timedelta
from typing import Callable

from google.genai import types

from app.analytics import (
    compute_item_spending,
    compute_item_spending_change,
    compute_recurring_items,
    compute_user_spending_analytics,
)

logger = logging.getLogger(__name__)

ANALYST_MODEL = "gemini-3.5-flash-lite"


def build_analytics_tools(user_id: str, supabase_client) -> list[Callable]:
    """Build read-only Gemini tools scoped to one authenticated user's data."""
    cache = {}

    def get_analytics():
        if "analytics" not in cache:
            cache["analytics"] = compute_user_spending_analytics(
                user_id=user_id,
                supabase_client=supabase_client,
                top_n_vendors=10,
            )
        return cache["analytics"]

    def get_spending_overview() -> dict:
        """Get the user's high-level expense overview: total spend, invoice count, average invoice, vendor count, active category count, tax paid, and discounts received."""
        data = get_analytics()
        return {
            "total_spend": data.total_spend,
            "invoice_count": data.invoice_count,
            "average_invoice_amount": data.average_invoice_amount,
            "vendor_count": data.vendor_count,
            "active_categories_count": data.active_categories_count,
            "total_tax_paid": data.total_tax_paid,
            "total_discount_received": data.total_discount_received,
        }

    def get_vendor_spending() -> list[dict]:
        """Get vendors ranked by total spend, including invoice counts and share of spend."""
        return [item.model_dump() for item in get_analytics().top_vendors]

    def get_category_spending() -> list[dict]:
        """Get spending grouped by product category, including item counts and share of categorized spend."""
        return [item.model_dump() for item in get_analytics().category_breakdown]

    def get_monthly_spending() -> list[dict]:
        """Get the chronological monthly spending trend with spend totals and invoice counts."""
        return [item.model_dump() for item in get_analytics().monthly_trend]

    def get_largest_invoice() -> dict:
        """Get the largest invoice and its vendor, invoice number, amount, and date."""
        largest = get_analytics().largest_invoice
        return largest.model_dump() if largest else {"message": "No invoices are available."}

    def get_item_spending(days: int = 14, item_name: str = "", start_date: str = "", end_date: str = "") -> dict:
        """Find the user's highest-spend line items. Use days for a rolling period, or provide ISO start_date and end_date for an exact date range; use item_name to focus on one item."""
        if start_date and end_date:
            try:
                resolved_start = date.fromisoformat(start_date)
                resolved_end = date.fromisoformat(end_date)
            except ValueError as exc:
                raise ValueError("start_date and end_date must use YYYY-MM-DD format") from exc
            if resolved_start > resolved_end:
                raise ValueError("start_date must be on or before end_date")
        else:
            period_days = max(1, min(int(days), 3650))
            resolved_end = date.today()
            resolved_start = resolved_end - timedelta(days=period_days - 1)
        return compute_item_spending(
            user_id=user_id,
            supabase_client=supabase_client,
            start_date=resolved_start,
            end_date=resolved_end,
            item_name=item_name.strip() or None,
            top_n=10,
        )

    def get_recurring_items(minimum_months: int = 3) -> dict:
        """Find items purchased in at least the requested number of distinct calendar months. Use minimum_months=3 for recurring purchases."""
        return compute_recurring_items(
            user_id=user_id,
            supabase_client=supabase_client,
            minimum_months=max(2, min(int(minimum_months), 24)),
            top_n=10,
        )

    def get_item_spending_change(days: int = 30) -> dict:
        """Compare item spending in the latest rolling period with the immediately preceding period of the same length."""
        return compute_item_spending_change(
            user_id=user_id,
            supabase_client=supabase_client,
            days=max(1, min(int(days), 365)),
        )

    def get_item_purchase_history(item_name: str, months: int = 12) -> dict:
        """Get recent purchases, spend, vendors, and dates for one named item over a rolling number of months."""
        period_months = max(1, min(int(months), 36))
        end_date = date.today()
        start_date = end_date - timedelta(days=(period_months * 31) - 1)
        return compute_item_spending(
            user_id=user_id,
            supabase_client=supabase_client,
            start_date=start_date,
            end_date=end_date,
            item_name=item_name,
            top_n=1,
        )

    return [
        get_spending_overview,
        get_vendor_spending,
        get_category_spending,
        get_monthly_spending,
        get_largest_invoice,
        get_item_spending,
        get_recurring_items,
        get_item_spending_change,
        get_item_purchase_history,
    ]


def ask_analytics_agent(question: str, user_id: str, supabase_client) -> str:
    """Answer an expense question using Gemini tools scoped to the current user."""
    from app.categorizer import get_genai_client

    client = get_genai_client()
    tools = build_analytics_tools(user_id, supabase_client)
    system_instruction = """
You are Vantage Analyst, a concise expense analyst for small and medium businesses.
Answer questions about the user's business spending using the provided tools.
Always use the relevant tool before making claims about amounts, trends, vendors, or categories.
Use get_item_spending for item-level questions and rolling timeframes such as "last 2 weeks"; it defaults to 14 days. For explicit calendar ranges, pass ISO start_date and end_date.
Use get_recurring_items for recurring or monthly-purchase questions; an item is recurring only when it appears in at least three distinct calendar months unless the user asks for another threshold.
Use get_item_spending_change for questions about what increased or decreased between comparable periods.
Use get_item_purchase_history for follow-up questions about one named item.
Always state the analyzed date range for period-based answers and distinguish total item spend from quantity purchased.
Never invent data, infer missing values as facts, expose internal implementation details, or discuss another user's data.
Explain the key takeaway first, then include a short supporting breakdown when useful.
Use clear currency formatting and plain language. If there is not enough data, say so and suggest what the user can do next.
Keep responses under 180 words unless the user explicitly asks for detail.
"""

    try:
        response = client.models.generate_content(
            model=ANALYST_MODEL,
            contents=question,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools,
            ),
        )
        return (response.text or "I couldn't find an insight for that question.").strip()
    except Exception as exc:
        logger.exception("Analytics agent request failed")
        raise RuntimeError(f"Analytics agent request failed: {exc}") from exc
