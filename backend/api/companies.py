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

@router.get("/{company_id}")
async def get_company(
    company_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get company details — user must belong to this company"""
    if current_user.get("company_id") != company_id:
        # SuperAdmin can view any company
        user_role = current_user.get("role", "")
        if user_role not in ["Super Admin", "superadmin", "admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Enrich with subscription data
    sub = await db.subscriptions.find_one(
        {"company_id": company_id, "status": "active"},
        {"_id": 0}
    )
    if sub:
        company["active_subscription"] = {
            "plan": sub.get("plan"),
            "end_date": sub.get("end_date"),
            "amount_paid": sub.get("amount_paid"),
        }
        company["subscription_plan"] = sub.get("plan", company.get("subscription_plan", "trial"))
        company["subscription_status"] = "active"
        company["subscription_expires_at"] = sub.get("end_date")
    
    # Calculate trial days remaining
    from datetime import datetime, timezone
    trial_end = company.get("trial_ends_at") or company.get("subscription_expires_at")
    if trial_end:
        try:
            from dateutil import parser as dparser
            end_dt = dparser.parse(str(trial_end))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=timezone.utc)
            days_left = (end_dt - datetime.now(timezone.utc)).days
            company["trial_days_remaining"] = max(0, days_left)
            company["trial_expired"] = days_left < 0
        except:
            pass
    
    return company


@router.put("/{company_id}")
async def update_company(
    company_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update company details"""
    if current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    allowed_roles = [
        "General Manager", "CEO", "Board Chairman", "Super Admin",
        "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "superadmin"
    ]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Fields allowed to update
    allowed_fields = [
        "name", "contact_email", "phone", "address", "city", "country",
        "tax_number", "commercial_register", "website", "description",
        "industry", "employee_count", "fiscal_year_start"
    ]
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    from datetime import datetime, timezone
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return company


# ── INDUSTRY ADDONS ─────────────────────────────────────────────────────

INDUSTRY_ADDONS_CATALOG = {
    "ads":           {"name": "Advertising",      "name_ar": "الإعلانات",          "price": 299},
    "construction":  {"name": "Construction",      "name_ar": "المقاولات",           "price": 399},
    "manufacturing": {"name": "Manufacturing",     "name_ar": "المصانع والإنتاج",    "price": 599},
    "medical":       {"name": "Medical",           "name_ar": "الطبية والصيدليات",  "price": 349},
    "real_estate":   {"name": "Real Estate",       "name_ar": "العقارات",            "price": 299},
    "restaurants":   {"name": "Restaurants",       "name_ar": "المطاعم والضيافة",   "price": 249},
    "education":     {"name": "Education",         "name_ar": "التعليم والمدارس",   "price": 199},
    "retail":        {"name": "Retail",            "name_ar": "التجزئة والمتاجر",   "price": 249},
    "logistics":     {"name": "Logistics",         "name_ar": "اللوجستيات والشحن",  "price": 399},
}

@router.get("/addons/catalog")
async def get_addons_catalog():
    """List all available industry addons"""
    return {"addons": [{"key": k, **v} for k, v in INDUSTRY_ADDONS_CATALOG.items()]}

@router.get("/{company_id}/addons")
async def get_company_addons(company_id: str, authorization: Optional[str] = Header(None)):
    """Get active industry addons for a company"""
    user = await get_current_user(authorization)
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return {"addons": company.get("industry_addons", [])}

@router.post("/{company_id}/addons")
async def add_industry_addon(
    company_id: str,
    data: dict,
    authorization: Optional[str] = Header(None)
):
    """Add an industry specialization addon to a company"""
    user = await get_current_user(authorization)
    addon_key = data.get("addon_key")
    if not addon_key or addon_key not in INDUSTRY_ADDONS_CATALOG:
        raise HTTPException(status_code=400, detail="Invalid addon key")
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Check not already added
    existing = company.get("industry_addons", [])
    if any(a["key"] == addon_key for a in existing):
        raise HTTPException(status_code=400, detail="Addon already active")
    
    addon_info = INDUSTRY_ADDONS_CATALOG[addon_key]
    new_addon = {
        "key": addon_key,
        "name": addon_info["name"],
        "name_ar": addon_info["name_ar"],
        "price": addon_info["price"],
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.companies.update_one(
        {"id": company_id},
        {"$push": {"industry_addons": new_addon},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Log the addon
    await db.activity_logs.insert_one({
        "company_id": company_id,
        "user_id": user.get("user_id"),
        "action": "add_industry_addon",
        "details": f"Added industry addon: {addon_info['name_ar']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "addon": new_addon, "message": f"تم إضافة تخصص {addon_info['name_ar']} بنجاح"}

@router.delete("/{company_id}/addons/{addon_key}")
async def remove_industry_addon(
    company_id: str,
    addon_key: str,
    authorization: Optional[str] = Header(None)
):
    """Remove an industry specialization addon"""
    user = await get_current_user(authorization)
    await db.companies.update_one(
        {"id": company_id},
        {"$pull": {"industry_addons": {"key": addon_key}},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": "تم إزالة التخصص"}
