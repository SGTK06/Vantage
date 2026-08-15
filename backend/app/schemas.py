from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any

# --- Auth Schemas ---

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

# --- Invoice & Line Item Schemas ---

class LineItemData(BaseModel):
    description: str
    quantity: Optional[float] = None
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None

class InvoiceExtractData(BaseModel):
    supplier_name: str
    supplier_address: Optional[str] = None
    customer_name: Optional[str] = None
    invoice_number: str
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    currency: Optional[str] = "USD"
    subtotal: Optional[float] = None
    tax_amount: Optional[float] = None
    discount_amount: Optional[float] = None
    total_amount: float
    line_items: List[LineItemData] = []
