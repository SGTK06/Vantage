import logging
from typing import Callable

from google.genai import types

from app.analytics import compute_user_spending_analytics

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

    return [
        get_spending_overview,
        get_vendor_spending,
        get_category_spending,
        get_monthly_spending,
        get_largest_invoice,
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
