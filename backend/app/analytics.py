from typing import List, Dict, Any, Optional
from collections import defaultdict
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
