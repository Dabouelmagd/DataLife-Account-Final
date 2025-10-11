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
UPLOAD_DIR = Path("/app/frontend/public/uploads/logos")
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
    """Upload company logo"""
    # Check if user belongs to this company
    if current_user.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if user has permission (only General Manager, CEO, Board Chairman)
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Only company administrators can upload logo")
    
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Generate unique filename
    file_extension = file.filename.split(".")[-1]
    new_filename = f"{company_id}.{file_extension}"
    file_path = UPLOAD_DIR / new_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Update company logo_url in database
    logo_url = f"/uploads/logos/{new_filename}"
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"logo_url": logo_url}}
    )
    
    return {"message": "Logo uploaded successfully", "logo_url": logo_url}