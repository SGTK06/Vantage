import os
import time

import pandas as pd
from llama_cloud import LlamaCloud

from data_models import Invoice


client = LlamaCloud(api_key=os.environ["LLAMA_CLOUD_API_KEY"])

EXTRACT_CONFIG = {
    "data_schema": Invoice.model_json_schema(),
    "extraction_target": "per_doc",
    "tier": "cost_effective",  # use "agentic" for scanned/complex layouts
    "cite_sources": True,       # optional: adds source citations per field
}


# ---------------------------------------------------------------------------
# Extract a single invoice
# ---------------------------------------------------------------------------

def extract_invoice(pdf_path: str, timeout_seconds: float = 180, poll_interval: float = 2.0) -> Invoice:
    file_obj = client.files.create(file=pdf_path, purpose="extract")

    job = client.extract.create(file_input=file_obj.id, configuration=EXTRACT_CONFIG)

    start = time.monotonic()
    while job.status not in ("COMPLETED", "FAILED", "CANCELLED"):
        if time.monotonic() - start > timeout_seconds:
            raise TimeoutError(f"Extraction for {pdf_path} timed out (status: {job.status})")
        time.sleep(poll_interval)
        job = client.extract.get(job.id)

    if job.status != "COMPLETED":
        raise RuntimeError(f"Extraction failed for {pdf_path}: {job.error_message}")

    return Invoice.model_validate(job.extract_result)


# ---------------------------------------------------------------------------
# Flatten into two relational tables: invoices + line_items
# for inserting into a SQL DB (invoices 1 -> N line_items).
# ---------------------------------------------------------------------------

def flatten_invoices(invoices: dict[str, Invoice]) -> tuple[pd.DataFrame, pd.DataFrame]:
    """invoices: mapping of source filename -> Invoice object."""
    invoice_rows = []
    line_item_rows = []

    for source_file, inv in invoices.items():
        invoice_rows.append({
            "source_file": source_file,
            "invoice_number": inv.invoice_number,
            "supplier_name": inv.supplier_name,
            "customer_name": inv.customer_name,
            "invoice_date": inv.invoice_date,
            "due_date": inv.due_date,
            "currency": inv.currency,
            "subtotal": inv.subtotal,
            "tax_amount": inv.tax_amount,
            "discount_amount": inv.discount_amount,
            "total_amount": inv.total_amount,
        })
        for idx, li in enumerate(inv.line_items, start=1):
            line_item_rows.append({
                "invoice_number": inv.invoice_number,
                "source_file": source_file,
                "line_no": idx,
                "description": li.description,
                "quantity": li.quantity,
                "unit_cost": li.unit_cost,
                "total_cost": li.total_cost,
            })

    return pd.DataFrame(invoice_rows), pd.DataFrame(line_item_rows)