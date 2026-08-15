"""
Schema for Invoice extraction pipeline using LlamaExtract.

Extracts:
  - Document-level fields: supplier, invoice number, date, totals, etc.
  - Line-item table: item, quantity, unit cost, total cost per line.

"""

import os
import time
from pathlib import Path
from typing import List, Optional

import pandas as pd
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Schema
#    - Nested List[LineItem] is what tells LlamaExtract to pull the table.
#    - Field descriptions matter a lot: they're the instructions the
#      extraction model uses, so be specific.
# ---------------------------------------------------------------------------

class LineItem(BaseModel):
    description: str = Field(description="Description or name of the line item / product / service")
    quantity: Optional[float] = Field(None, description="Quantity billed for this line item")
    unit_cost: Optional[float] = Field(None, description="Price per single unit, before line total")
    total_cost: Optional[float] = Field(None, description="Total price for this line (quantity x unit_cost)")


class Invoice(BaseModel):
    supplier_name: str = Field(description="Name of the vendor/supplier issuing the invoice")
    supplier_address: Optional[str] = Field(None, description="Supplier's postal/business address")
    customer_name: Optional[str] = Field(None, description="Name of the customer being billed")
    invoice_number: str = Field(description="Unique invoice identifier / reference number")
    invoice_date: Optional[str] = Field(None, description="Date the invoice was issued (YYYY-MM-DD if possible)")
    due_date: Optional[str] = Field(None, description="Payment due date")
    currency: Optional[str] = Field(None, description="Currency code, e.g. USD, MYR, EUR")
    subtotal: Optional[float] = Field(None, description="Sum of line items before tax/discount")
    tax_amount: Optional[float] = Field(None, description="Total tax amount, if stated separately")
    discount_amount: Optional[float] = Field(None, description="Total discount applied, if any")
    total_amount: float = Field(description="Final total amount due on the invoice")
    line_items: List[LineItem] = Field(default_factory=list, description="All billed line items / table rows")

