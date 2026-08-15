import json
import os
import re
import tempfile
import time
from typing import List, Optional
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from app.config import FRONTEND_URL
from app.auth import get_current_user, security
from app.supabase_client import get_authenticated_supabase_client, get_supabase_client
from app.schemas import AuthCredentials, AuthResponse, UserResponse, InvoiceExtractData
from app.invoice_handler import extract_invoice

app = FastAPI(title="Vantage API")

origins = [
    origin.strip() for origin in FRONTEND_URL.split(",") if origin.strip()
]
if not origins:
    origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

# --- Authentication Endpoints ---

@app.post("/api/auth/signup", response_model=AuthResponse)
def sign_up(credentials: AuthCredentials):
    supabase = get_supabase_client()
    try:
        res = supabase.auth.sign_up({
            "email": credentials.email,
            "password": credentials.password,
        })

        user_data = None
        if res.user:
            user_data = UserResponse(
                id=res.user.id,
                email=res.user.email,
                created_at=str(res.user.created_at) if res.user.created_at else None,
            )

        access_token = res.session.access_token if res.session else None

        return AuthResponse(
            access_token=access_token,
            user=user_data,
            message="Signup successful. Please confirm your email if verification is required." if not access_token else "Signup successful."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@app.post("/api/auth/signin", response_model=AuthResponse)
def sign_in(credentials: AuthCredentials):
    supabase = get_supabase_client()
    try:
        res = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password,
        })

        if not res.session or not res.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
            )

        user_data = UserResponse(
            id=res.user.id,
            email=res.user.email,
            created_at=str(res.user.created_at) if res.user.created_at else None,
        )

        return AuthResponse(
            access_token=res.session.access_token,
            user=user_data,
            message="Login successful."
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user=Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=str(current_user.created_at) if current_user.created_at else None,
    )

# --- Invoice OCR & Confirm Endpoints ---

@app.post("/api/invoices/parse", response_model=InvoiceExtractData)
async def parse_invoice(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    """Parses an uploaded PDF file with LlamaParse OCR and returns extracted structured data."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported for parsing.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file provided.",
        )

    # Save to a temporary file for LlamaCloud extraction
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
        tmp_file.write(file_bytes)
        tmp_path = tmp_file.name

    try:
        extracted = extract_invoice(tmp_path)
        return extracted
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR Extraction failed: {str(e)}",
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/api/invoices/confirm")
async def confirm_and_save_invoice(
    file: UploadFile = File(...),
    invoice_data_str: str = Form(...),
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Uploads the original PDF to Supabase storage and stores verified invoice & line items in the database."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    try:
        raw_json = json.loads(invoice_data_str)
        validated_data = InvoiceExtractData.model_validate(raw_json)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid invoice payload: {str(e)}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file provided",
        )

    user_id = current_user.id
    timestamp = int(time.time() * 1000)
    # Keep the object key inside the user's folder even if a client submits a
    # filename containing path separators or control characters.
    safe_filename = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(file.filename))
    file_path = f"{user_id}/{timestamp}_{safe_filename}"

    # Authentication in get_current_user validates the JWT. This request-
    # scoped client forwards the same JWT so Storage/PostgREST apply auth.uid()
    # and the configured RLS policies see the user rather than anon.
    supabase = get_authenticated_supabase_client(credentials.credentials)
    invoice_id = None

    # 1. Upload original PDF to Supabase Storage
    try:
        supabase.storage.from_("invoices").upload(
            file_path,
            file_bytes,
            {"content-type": "application/pdf"}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage upload failed: {str(e)}",
        )

    # 2. Insert Invoice Metadata into Database
    try:
        invoice_insert_payload = {
            "user_id": user_id,
            "file_path": file_path,
            "file_name": file.filename,
            "supplier_name": validated_data.supplier_name,
            "supplier_address": validated_data.supplier_address,
            "customer_name": validated_data.customer_name,
            "invoice_number": validated_data.invoice_number,
            "invoice_date": validated_data.invoice_date or None,
            "due_date": validated_data.due_date or None,
            "currency": validated_data.currency or "USD",
            "subtotal": validated_data.subtotal,
            "tax_amount": validated_data.tax_amount,
            "discount_amount": validated_data.discount_amount,
            "total_amount": validated_data.total_amount,
        }
        db_resp = supabase.table("invoices").insert(invoice_insert_payload).execute()
        if not db_resp.data:
            raise RuntimeError("Database did not return inserted invoice record")

        saved_invoice = db_resp.data[0]
        invoice_id = saved_invoice["id"]

        # 3. Insert Line Items into Database
        if validated_data.line_items:
            line_item_rows = [
                {
                    "invoice_id": invoice_id,
                    "line_no": idx,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_cost": item.unit_cost,
                    "total_cost": item.total_cost,
                }
                for idx, item in enumerate(validated_data.line_items, start=1)
            ]
            line_items_resp = supabase.table("line_items").insert(line_item_rows).execute()
            if not line_items_resp.data or len(line_items_resp.data) != len(line_item_rows):
                raise RuntimeError("Database did not return all inserted line items")

        return {
            "message": "Invoice and extracted data saved successfully",
            "invoice_id": invoice_id,
            "data": saved_invoice,
        }
    except Exception as e:
        # Storage and database writes cannot share a transaction. Compensate
        # for partial success so retries do not accumulate orphaned objects.
        if invoice_id:
            try:
                supabase.table("invoices").delete().eq("id", invoice_id).execute()
            except Exception:
                pass
        try:
            supabase.storage.from_("invoices").remove([file_path])
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database record creation failed: {str(e)}",
        )

@app.get("/api/invoices")
async def list_invoices(
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    user_id = current_user.id
    supabase = get_authenticated_supabase_client(credentials.credentials)
    try:
        db_resp = (
            supabase.table("invoices")
            .select("*, line_items(*)")
            .eq("user_id", user_id)
            .order("uploaded_at", desc=True)
            .execute()
        )
        return {"data": db_resp.data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch invoices: {str(e)}",
        )
