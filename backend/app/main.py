import time
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import FRONTEND_URL
from app.auth import get_current_user
from app.supabase_client import get_supabase_client
from app.schemas import AuthCredentials, AuthResponse, UserResponse

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

# --- Invoice Endpoints ---

@app.post("/api/invoices/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file provided",
        )

    user_id = current_user.id
    timestamp = int(time.time() * 1000)
    file_path = f"{user_id}/{timestamp}_{file.filename}"

    supabase = get_supabase_client()

    # Upload to Supabase Storage
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

    # Insert into database table
    try:
        db_resp = supabase.table("invoices").insert({
            "user_id": user_id,
            "file_path": file_path,
            "file_name": file.filename,
        }).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database record creation failed: {str(e)}",
        )

    return {
        "message": "Invoice uploaded successfully",
        "data": db_resp.data[0] if db_resp.data else {
            "user_id": user_id,
            "file_path": file_path,
            "file_name": file.filename,
        }
    }

@app.get("/api/invoices")
async def list_invoices(current_user=Depends(get_current_user)):
    user_id = current_user.id
    supabase = get_supabase_client()
    try:
        db_resp = (
            supabase.table("invoices")
            .select("*")
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