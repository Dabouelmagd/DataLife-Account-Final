from fastapi import APIRouter, HTTPException, Depends, Header
from models.company import CompanyResponse
from services.auth_service import verify_token
from services.company_service import get_company_by_id
from typing import Optional

router = APIRouter(prefix="/api/companies", tags=["companies"])

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
        subscription_status=company.subscription_status,
        created_at=company.created_at
    )