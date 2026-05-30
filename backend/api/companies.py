from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File
from models.company import CompanyResponse
from services.auth_service import verify_token
from services.company_service import get_company_by_id
from typing import Optional
import shutil
import os
from pathlib import Path

router = APIRouter(prefix="/api/companies", tags=["companies"])

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("/app/uploads/logos")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Get database instance
from database import get_database
db = get_database()

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload

@router.get("/current", response_model=None)
async def get_current_company(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's company details"""
    company_id = current_user.get("company_id")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return company


@router.get("/{company_id}/plan-modules")
async def get_company_plan_modules(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Return the list of modules unlocked by the company's subscription plan."""
    from models.plan_modules import get_allowed_modules, PLAN_DISPLAY
    from datetime import datetime, timedelta

    if current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")

    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    plan = company.get("subscription_plan") or "trial"
    allowed = get_allowed_modules(plan)
    display = PLAN_DISPLAY.get(plan.lower().strip(), PLAN_DISPLAY["trial"])

    # Trial countdown: 14 days from company creation + any referral bonus days
    trial_info = None
    if plan.lower() == "trial":
        created_raw = company.get("created_at")
        try:
            created_dt = datetime.fromisoformat(created_raw) if isinstance(created_raw, str) else created_raw
        except Exception:
            created_dt = datetime.utcnow()
        if not created_dt:
            created_dt = datetime.utcnow()
        base_days = 14
        bonus_days = int(company.get("trial_extension_days") or 0)
        ends_at = created_dt + timedelta(days=base_days + bonus_days)
        days_remaining = max(0, (ends_at - datetime.utcnow()).days)
        trial_info = {
            "is_trial": True,
            "trial_ends_at": ends_at.isoformat(),
            "days_remaining": days_remaining,
            "expired": days_remaining == 0,
            "bonus_days": bonus_days,
        }

    return {
        "plan": plan,
        "plan_label_en": display["en"],
        "plan_label_ar": display["ar"],
        "allowed_modules": allowed,
        "trial": trial_info,
    }

@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get company details"""
    # Check if user belongs to this company
    if current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    company = await get_company_by_id(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    return CompanyResponse(
        id=company.id,
        name=company.name,
        industry=company.industry,
        size=company.size,
        contact_email=company.contact_email,
        phone=company.phone,
        address=company.address,
        logo_url=company.logo_url,
        subscription_status=company.subscription_status,
        created_at=company.created_at if isinstance(company.created_at, str) else company.created_at.isoformat()
    )

@router.post("/{company_id}/upload-logo")
async def upload_logo(
    company_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload company logo - stores as Base64 in database"""
    import base64
    
    # Check if user belongs to this company
    if current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if user has permission (only General Manager, CEO, Board Chairman)
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only company administrators can upload logo")
    
    # Validate file type - accept all image types
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Read file content
    try:
        file_content = await file.read()
        
        # Check file size (max 5MB)
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size too large (max 5MB)")
        
        # Convert to Base64 data URL
        base64_data = base64.b64encode(file_content).decode('utf-8')
        logo_data_url = f"data:{file.content_type};base64,{base64_data}"
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    
    # Update company logo_url in database (store as data URL)
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"logo_url": logo_data_url}}
    )
    
    return {"message": "Logo uploaded successfully", "logo_url": logo_data_url}