from typing import List, Dict, Any, Optional
from collections import defaultdict
from datetime import date, timedelta
import re
from app.data_models import (
    SpendingAnalyticsResponse,
    VendorSpendStat,
    CategorySpendStat,
    MonthlySpendStat,
    LargestInvoiceStat,
)

def compute_user_spending_analytics(
    user_id: str,
    supabase_client,
    top_n_vendors: int = 5,
) -> SpendingAnalyticsResponse:
    """Computes comprehensive spending statistics for the authenticated user from Supabase."""
    # 1. Fetch all user invoices with related vendors, line items & product categories
    res = (
        supabase_client.table("invoices")
        .select("*, vendors(*), line_items(*, product_categories(*))")
        .eq("user_id", user_id)
        .order("invoice_date", desc=True)
        .execute()
    )

    invoices = res.data or []

    if not invoices:
        return SpendingAnalyticsResponse(
            total_spend=0.0,
            invoice_count=0,
            average_invoice_amount=0.0,
            vendor_count=0,
            active_categories_count=0,
            top_category_name=None,
            top_category_spend=0.0,
            top_category_share=0.0,
            top_vendor_name=None,
            top_vendor_spend=0.0,
            total_tax_paid=0.0,
            total_discount_received=0.0,
            top_vendors=[],
            category_breakdown=[],
            monthly_trend=[],
            largest_invoice=None,
        )

    total_spend = 0.0
    total_tax = 0.0
    total_discount = 0.0
    vendor_spends: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "count": 0})
    category_spends: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "count": 0})
    monthly_spends: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"total": 0.0, "count": 0})
    
    largest_inv_obj: Optional[Dict[str, Any]] = None
    largest_inv_amount = -1.0

    for inv in invoices:
        amt = float(inv.get("total_amount") or 0.0)
        tax = float(inv.get("tax_amount") or 0.0)
        disc = float(inv.get("discount_amount") or 0.0)

        total_spend += amt
        total_tax += tax
        total_discount += disc

        # Track largest single invoice
        if amt > largest_inv_amount:
            largest_inv_amount = amt
            v_name = (inv.get("vendors") or {}).get("name") or inv.get("supplier_name") or "Unknown Vendor"
            largest_inv_obj = {
                "invoice_number": inv.get("invoice_number", "—"),
                "vendor_name": v_name,
                "amount": amt,
                "date": inv.get("invoice_date"),
            }

        # Group by Vendor
        vendor_name = (inv.get("vendors") or {}).get("name") or inv.get("supplier_name") or "Unknown Vendor"
        vendor_spends[vendor_name]["total"] += amt
        vendor_spends[vendor_name]["count"] += 1

        # Group by Month
        inv_date = inv.get("invoice_date") or (inv.get("uploaded_at") or "")[:10]
        month_key = inv_date[:7] if len(inv_date) >= 7 else "Unspecified"
        monthly_spends[month_key]["total"] += amt
        monthly_spends[month_key]["count"] += 1

        # Group Line Items by Product Category
        line_items = inv.get("line_items") or []
        for li in line_items:
            cat_name = (li.get("product_categories") or {}).get("name") or "Uncategorized"
            li_cost = float(li.get("total_cost") or (float(li.get("quantity") or 1) * float(li.get("unit_cost") or 0)))
            category_spends[cat_name]["total"] += li_cost
            category_spends[cat_name]["count"] += 1

    invoice_count = len(invoices)
    avg_invoice = round(total_spend / invoice_count, 2) if invoice_count > 0 else 0.0

    # Format Top N Vendors
    sorted_vendors = sorted(vendor_spends.items(), key=lambda x: x[1]["total"], reverse=True)
    top_vendors_list = []
    for v_name, stat in sorted_vendors[:top_n_vendors]:
        pct = round((stat["total"] / total_spend * 100), 1) if total_spend > 0 else 0.0
        top_vendors_list.append(
            VendorSpendStat(
                vendor_name=v_name,
                total_spend=round(stat["total"], 2),
                invoice_count=stat["count"],
                spend_percentage=pct,
            )
        )

    top_vendor_name = sorted_vendors[0][0] if sorted_vendors else None
    top_vendor_spend = round(sorted_vendors[0][1]["total"], 2) if sorted_vendors else 0.0

    # Format Category Breakdown
    sorted_categories = sorted(category_spends.items(), key=lambda x: x[1]["total"], reverse=True)
    category_breakdown_list = []
    
    # Calculate sum of line item totals to calculate accurate category percentage share
    total_items_cost = sum(stat["total"] for _, stat in sorted_categories) or total_spend

    for c_name, stat in sorted_categories:
        pct = round((stat["total"] / total_items_cost * 100), 1) if total_items_cost > 0 else 0.0
        category_breakdown_list.append(
            CategorySpendStat(
                category_name=c_name,
                total_spend=round(stat["total"], 2),
                item_count=stat["count"],
                spend_percentage=pct,
            )
        )

    top_category_name = sorted_categories[0][0] if sorted_categories else None
    top_category_spend = round(sorted_categories[0][1]["total"], 2) if sorted_categories else 0.0
    top_category_share = category_breakdown_list[0].spend_percentage if category_breakdown_list else 0.0

    # Format Monthly Timeline Trend (Sorted chronologically)
    valid_months = [m for m in monthly_spends.keys() if m != "Unspecified"]
    sorted_months = sorted(valid_months)
    if "Unspecified" in monthly_spends:
        sorted_months.append("Unspecified")

    monthly_trend_list = [
        MonthlySpendStat(
            month=m,
            total_spend=round(monthly_spends[m]["total"], 2),
            invoice_count=monthly_spends[m]["count"],
        )
        for m in sorted_months
    ]

    return SpendingAnalyticsResponse(
        total_spend=round(total_spend, 2),
        invoice_count=invoice_count,
        average_invoice_amount=avg_invoice,
        vendor_count=len(vendor_spends),
        active_categories_count=len(category_spends),
        top_category_name=top_category_name,
        top_category_spend=top_category_spend,
        top_category_share=top_category_share,
        top_vendor_name=top_vendor_name,
        top_vendor_spend=top_vendor_spend,
        total_tax_paid=round(total_tax, 2),
        total_discount_received=round(total_discount, 2),
        top_vendors=top_vendors_list,
        category_breakdown=category_breakdown_list,
        monthly_trend=monthly_trend_list,
        largest_invoice=LargestInvoiceStat(**largest_inv_obj) if largest_inv_obj else None,
    )


def _fetch_user_invoice_records(user_id: str, supabase_client) -> list[dict]:
    """Fetch invoice and line-item records for read-only analytics tools."""
    response = (
        supabase_client.table("invoices")
        .select("*, vendors(*), line_items(*, product_categories(*))")
        .eq("user_id", user_id)
        .execute()
    )
    return response.data or []


def _effective_invoice_date(invoice: dict) -> Optional[date]:
    """Use invoice date first, falling back to the upload date when needed."""
    raw_date = invoice.get("invoice_date") or (invoice.get("uploaded_at") or "")[:10]
    try:
        return date.fromisoformat(str(raw_date)[:10])
    except (TypeError, ValueError):
        return None


def _normalize_item_description(description: Any) -> str:
    normalized = re.sub(r"\s+", " ", str(description or "").strip().lower())
    return normalized


def _line_item_cost(line_item: dict) -> float:
    total_cost = line_item.get("total_cost")
    if total_cost is not None:
        return float(total_cost or 0.0)
    quantity = float(line_item.get("quantity") or 1.0)
    unit_cost = float(line_item.get("unit_cost") or 0.0)
    return quantity * unit_cost


def compute_item_spending(
    user_id: str,
    supabase_client,
    start_date: date,
    end_date: date,
    item_name: Optional[str] = None,
    top_n: int = 10,
) -> dict:
    """Compute item-level spending for an inclusive date range."""
    target = _normalize_item_description(item_name) if item_name else None
    grouped: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "item_name": "",
            "total_spend": 0.0,
            "purchase_count": 0,
            "invoice_ids": set(),
            "total_quantity": 0.0,
            "unit_costs": [],
            "last_purchase_date": None,
            "vendors": set(),
            "categories": set(),
        }
    )

    for invoice in _fetch_user_invoice_records(user_id, supabase_client):
        invoice_date = _effective_invoice_date(invoice)
        if not invoice_date or invoice_date < start_date or invoice_date > end_date:
            continue

        vendor_name = (invoice.get("vendors") or {}).get("name") or invoice.get("supplier_name") or "Unknown Vendor"
        for line_item in invoice.get("line_items") or []:
            normalized = _normalize_item_description(line_item.get("description"))
            if not normalized or (target and normalized != target):
                continue

            stat = grouped[normalized]
            stat["item_name"] = stat["item_name"] or str(line_item.get("description")).strip()
            stat["total_spend"] += _line_item_cost(line_item)
            stat["purchase_count"] += 1
            stat["invoice_ids"].add(invoice.get("id") or invoice.get("invoice_number") or str(invoice_date))
            stat["total_quantity"] += float(line_item.get("quantity") or 1.0)
            if line_item.get("unit_cost") is not None:
                stat["unit_costs"].append(float(line_item.get("unit_cost") or 0.0))
            stat["last_purchase_date"] = max(stat["last_purchase_date"] or invoice_date, invoice_date)
            stat["vendors"].add(vendor_name)
            category_name = (line_item.get("product_categories") or {}).get("name")
            if category_name:
                stat["categories"].add(category_name)

    results = []
    for stat in grouped.values():
        results.append({
            "item_name": stat["item_name"],
            "total_spend": round(stat["total_spend"], 2),
            "purchase_count": stat["purchase_count"],
            "invoice_count": len(stat["invoice_ids"]),
            "total_quantity": round(stat["total_quantity"], 2),
            "average_unit_cost": round(sum(stat["unit_costs"]) / len(stat["unit_costs"]), 2) if stat["unit_costs"] else 0.0,
            "last_purchase_date": stat["last_purchase_date"].isoformat() if stat["last_purchase_date"] else None,
            "vendors": sorted(stat["vendors"]),
            "categories": sorted(stat["categories"]),
        })

    results.sort(key=lambda item: item["total_spend"], reverse=True)
    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "item_name_filter": item_name,
        "items": results[:max(1, min(top_n, 50))],
        "matched_item_count": len(results),
    }


def compute_recurring_items(
    user_id: str,
    supabase_client,
    minimum_months: int = 3,
    top_n: int = 10,
) -> dict:
    """Find normalized line items purchased in at least N distinct calendar months."""
    grouped: Dict[str, Dict[str, Any]] = defaultdict(
        lambda: {
            "item_name": "",
            "months": set(),
            "total_spend": 0.0,
            "purchase_count": 0,
            "total_quantity": 0.0,
            "first_purchase_date": None,
            "last_purchase_date": None,
            "vendors": set(),
        }
    )

    for invoice in _fetch_user_invoice_records(user_id, supabase_client):
        invoice_date = _effective_invoice_date(invoice)
        if not invoice_date:
            continue
        vendor_name = (invoice.get("vendors") or {}).get("name") or invoice.get("supplier_name") or "Unknown Vendor"
        for line_item in invoice.get("line_items") or []:
            normalized = _normalize_item_description(line_item.get("description"))
            if not normalized:
                continue
            stat = grouped[normalized]
            stat["item_name"] = stat["item_name"] or str(line_item.get("description")).strip()
            stat["months"].add(invoice_date.strftime("%Y-%m"))
            stat["total_spend"] += _line_item_cost(line_item)
            stat["purchase_count"] += 1
            stat["total_quantity"] += float(line_item.get("quantity") or 1.0)
            stat["first_purchase_date"] = min(stat["first_purchase_date"] or invoice_date, invoice_date)
            stat["last_purchase_date"] = max(stat["last_purchase_date"] or invoice_date, invoice_date)
            stat["vendors"].add(vendor_name)

    results = []
    for stat in grouped.values():
        if len(stat["months"]) < max(2, minimum_months):
            continue
        results.append({
            "item_name": stat["item_name"],
            "distinct_months": len(stat["months"]),
            "purchase_months": sorted(stat["months"]),
            "purchase_count": stat["purchase_count"],
            "total_quantity": round(stat["total_quantity"], 2),
            "total_spend": round(stat["total_spend"], 2),
            "average_monthly_spend": round(stat["total_spend"] / len(stat["months"]), 2),
            "first_purchase_date": stat["first_purchase_date"].isoformat(),
            "last_purchase_date": stat["last_purchase_date"].isoformat(),
            "vendors": sorted(stat["vendors"]),
        })

    results.sort(key=lambda item: (item["distinct_months"], item["total_spend"]), reverse=True)
    return {
        "minimum_months": minimum_months,
        "items": results[:max(1, min(top_n, 50))],
        "matched_item_count": len(results),
    }


def compute_item_spending_change(
    user_id: str,
    supabase_client,
    days: int = 30,
) -> dict:
    """Compare item spending in the latest rolling period with the preceding period."""
    period_days = max(1, min(days, 365))
    end_date = date.today()
    current_start = end_date - timedelta(days=period_days - 1)
    previous_end = current_start - timedelta(days=1)
    previous_start = previous_end - timedelta(days=period_days - 1)
    current = compute_item_spending(user_id, supabase_client, current_start, end_date, top_n=50)["items"]
    previous = compute_item_spending(user_id, supabase_client, previous_start, previous_end, top_n=50)["items"]
    current_by_item = {_normalize_item_description(item["item_name"]): item["total_spend"] for item in current}
    previous_by_item = {_normalize_item_description(item["item_name"]): item["total_spend"] for item in previous}
    changes = []
    for normalized in set(current_by_item) | set(previous_by_item):
        current_spend = current_by_item.get(normalized, 0.0)
        previous_spend = previous_by_item.get(normalized, 0.0)
        change = current_spend - previous_spend
        percentage = round((change / previous_spend) * 100, 1) if previous_spend else None
        display_name = next((item["item_name"] for item in current + previous if _normalize_item_description(item["item_name"]) == normalized), normalized)
        changes.append({
            "item_name": display_name,
            "current_spend": round(current_spend, 2),
            "previous_spend": round(previous_spend, 2),
            "change": round(change, 2),
            "percentage_change": percentage,
        })
    changes.sort(key=lambda item: abs(item["change"]), reverse=True)
    return {
        "current_start_date": current_start.isoformat(),
        "current_end_date": end_date.isoformat(),
        "previous_start_date": previous_start.isoformat(),
        "previous_end_date": previous_end.isoformat(),
        "items": changes[:10],
    }
