import json
import logging
import os
import re
import tempfile
import time
from typing import List, Optional
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from app.config import FRONTEND_URL
from app.auth import get_current_user, security
from app.supabase_client import get_authenticated_supabase_client, get_supabase_client
from app.data_models import (
    AuthCredentials,
    AuthResponse,
    UserResponse,
    InvoiceExtractData,
    ProductCategoryCreate,
    ProductCategoryResponse,
    SpendingAnalyticsResponse,
)
from app.invoice_handler import extract_invoice
from app.categorizer import categorize_line_items_pipeline, get_text_embedding
from app.analytics import compute_user_spending_analytics
from app.analytics_agent import ask_analytics_agent

logger = logging.getLogger(__name__)

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

# --- Product Categories Endpoints ---

@app.get("/api/categories", response_model=List[ProductCategoryResponse])
def get_categories(
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    supabase = get_authenticated_supabase_client(credentials.credentials)
    try:
        res = supabase.table("product_categories").select("id, user_id, name, description, created_at").eq("user_id", current_user.id).order("name").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch product categories: {str(e)}",
        )

@app.post("/api/categories", response_model=ProductCategoryResponse)
def create_category(
    payload: ProductCategoryCreate,
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Category name cannot be empty")

    desc = payload.description or ""
    # Generate embedding vector via Google gemini-embedding-001
    try:
        embedding_vec = get_text_embedding(f"{name}: {desc}")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding with gemini-embedding-001: {str(e)}",
        )

    supabase = get_authenticated_supabase_client(credentials.credentials)
    try:
        insert_res = supabase.table("product_categories").insert({
            "user_id": current_user.id,
            "name": name,
            "description": desc,
            "embedding": embedding_vec,
        }).execute()

        if not insert_res.data:
            raise RuntimeError("Failed to create product category in Supabase")

        created = insert_res.data[0]
        return ProductCategoryResponse(
            id=created["id"],
            user_id=created.get("user_id"),
            name=created["name"],
            description=created.get("description"),
            created_at=str(created.get("created_at")),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error saving category: {str(e)}",
        )

# --- Spending Analytics Endpoint ---

@app.get("/api/analytics/spending", response_model=SpendingAnalyticsResponse)
def get_spending_analytics(
    top_n: int = Query(5, ge=1, le=50, description="Top N vendors to retrieve"),
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    supabase = get_authenticated_supabase_client(credentials.credentials)
    try:
        return compute_user_spending_analytics(
            user_id=current_user.id,
            supabase_client=supabase,
            top_n_vendors=top_n,
        )
    except Exception as e:
        logger.error(f"Error computing spending analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute spending analytics: {str(e)}",
        )

@app.post("/api/analytics/insights")
def get_analytics_insight(
    payload: dict,
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    question = str(payload.get("question") or "").strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please enter a question about your spending.",
        )
    if len(question) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questions must be 500 characters or fewer.",
        )

    supabase = get_authenticated_supabase_client(credentials.credentials)
    try:
        answer = ask_analytics_agent(
            question=question,
            user_id=current_user.id,
            supabase_client=supabase,
        )
        return {"answer": answer}
    except Exception as e:
        logger.error(f"Error generating analytics insight: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The analyst is temporarily unavailable. Please try again.",
        )

# --- Invoice OCR, Categorization & Confirm Endpoints ---

@app.post("/api/invoices/parse", response_model=InvoiceExtractData)
async def parse_invoice(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Parses PDF with LlamaParse OCR, then categorizes items via Supabase gemini-embedding-001 vector search + Gemma LLM."""
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR Extraction failed: {str(e)}",
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    # Run AI categorization on line items
    raw_extracted_dict = extracted.model_dump()
    line_items_raw = raw_extracted_dict.get("line_items", [])
    
    if line_items_raw:
        supabase = get_authenticated_supabase_client(credentials.credentials)
        try:
            categorized_line_items = categorize_line_items_pipeline(
                line_items=line_items_raw,
                user_id=current_user.id,
                supabase_client=supabase,
            )
            raw_extracted_dict["line_items"] = categorized_line_items
        except Exception as e:
            logger.error(f"Categorization error in pipeline: {e}")
            for item in line_items_raw:
                if not item.get("category_name"):
                    item["category_name"] = "General"
            raw_extracted_dict["line_items"] = line_items_raw

    return InvoiceExtractData.model_validate(raw_extracted_dict)

@app.post("/api/invoices/confirm")
async def confirm_and_save_invoice(
    file: UploadFile = File(...),
    invoice_data_str: str = Form(...),
    current_user=Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Uploads PDF to Supabase storage and stores vendor, invoice & line items in the database."""
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
    safe_filename = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(file.filename))
    file_path = f"{user_id}/{timestamp}_{safe_filename}"

    supabase = get_authenticated_supabase_client(credentials.credentials)

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

    # 2. Find or create Vendor record
    vendor_id = None
    if validated_data.supplier_name:
        try:
            vendor_select = supabase.table("vendors").select("id").eq("user_id", user_id).eq("name", validated_data.supplier_name.strip()).execute()
            if vendor_select.data and len(vendor_select.data) > 0:
                vendor_id = vendor_select.data[0]["id"]
            else:
                vendor_insert = supabase.table("vendors").insert({
                    "user_id": user_id,
                    "name": validated_data.supplier_name.strip(),
                    "address": validated_data.supplier_address,
                }).execute()
                if vendor_insert.data and len(vendor_insert.data) > 0:
                    vendor_id = vendor_insert.data[0]["id"]
        except Exception as e:
            logger.warning(f"Vendor resolution warning: {e}")

    # 3. Insert Invoice Metadata into Database
    try:
        invoice_insert_payload = {
            "user_id": user_id,
            "vendor_id": vendor_id,
            "file_path": file_path,
            "file_name": file.filename,
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

        # 4. Insert Line Items into Database with Category IDs
        if validated_data.line_items:
            line_item_rows = []
            for idx, item in enumerate(validated_data.line_items, start=1):
                cat_id = item.category_id

                # If category_name provided but no category_id, find or create category
                if not cat_id and item.category_name:
                    cat_name = item.category_name.strip()
                    try:
                        cat_find = supabase.table("product_categories").select("id").eq("user_id", user_id).eq("name", cat_name).execute()
                        if cat_find.data and len(cat_find.data) > 0:
                            cat_id = cat_find.data[0]["id"]
                        else:
                            emb = get_text_embedding(cat_name)
                            cat_create = supabase.table("product_categories").insert({
                                "user_id": user_id,
                                "name": cat_name,
                                "embedding": emb,
                            }).execute()
                            if cat_create.data:
                                cat_id = cat_create.data[0]["id"]
                    except Exception as e:
                        logger.warning(f"Category creation warning during confirm: {e}")

                line_item_rows.append({
                    "invoice_id": invoice_id,
                    "category_id": cat_id,
                    "line_no": idx,
                    "description": item.description,
                    "quantity": item.quantity,
                    "unit_cost": item.unit_cost,
                    "total_cost": item.total_cost,
                })

            if line_item_rows:
                supabase.table("line_items").insert(line_item_rows).execute()

        return {
            "message": "Invoice and extracted categorized data saved successfully",
            "invoice_id": invoice_id,
            "data": saved_invoice,
        }
    except Exception as e:
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
            .select("*, vendors(*), line_items(*, product_categories(*))")
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
