from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

# ============================================================================
# Auth Schemas
# ============================================================================

class AuthCredentials(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    created_at: Optional[str] = None

class AuthResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
    message: Optional[str] = None


# ============================================================================
# Product Category Schemas
# ============================================================================

class ProductCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProductCategoryResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    created_at: Optional[str] = None


# ============================================================================
# Invoice & Line Item Schemas
# (Unified models used for both LlamaExtract OCR schema and API validation)
# ============================================================================

class LineItem(BaseModel):
    description: str = Field(description="Description or name of the line item / product / service")
    quantity: Optional[float] = Field(None, description="Quantity billed for this line item")
    unit_cost: Optional[float] = Field(None, description="Price per single unit, before line total")
    total_cost: Optional[float] = Field(None, description="Total price for this line (quantity x unit_cost)")
    category_id: Optional[str] = Field(None, description="Database UUID for the matched product category")
    category_name: Optional[str] = Field(None, description="Name of the product category")


class Invoice(BaseModel):
    supplier_name: str = Field(description="Name of the vendor/supplier issuing the invoice")
    supplier_address: Optional[str] = Field(None, description="Supplier's postal/business address")
    customer_name: Optional[str] = Field(None, description="Name of the customer being billed")
    invoice_number: str = Field(description="Unique invoice identifier / reference number")
    invoice_date: Optional[str] = Field(None, description="Date the invoice was issued (YYYY-MM-DD if possible)")
    due_date: Optional[str] = Field(None, description="Payment due date")
    currency: Optional[str] = Field("USD", description="Currency code, e.g. USD, MYR, EUR")
    subtotal: Optional[float] = Field(None, description="Sum of line items before tax/discount")
    tax_amount: Optional[float] = Field(None, description="Total tax amount, if stated separately")
    discount_amount: Optional[float] = Field(None, description="Total discount applied, if any")
    total_amount: float = Field(description="Final total amount due on the invoice")
    line_items: List[LineItem] = Field(default_factory=list, description="All billed line items / table rows")


# Type aliases for backwards compatibility
LineItemData = LineItem
InvoiceExtractData = Invoice
