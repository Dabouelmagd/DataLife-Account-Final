"""
Admin Companies API
إدارة الشركات
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
import secrets
import string
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from .admin_common import (
    db, ADMIN_ROLES, ALL_SYSTEM_PERMISSIONS, 
    verify_admin, log_admin_audit, generate_company_code, 
    get_current_timestamp, format_company_response
)

router = APIRouter(prefix="/api/admin", tags=["admin-companies"])


@router.get("/companies")
async def get_all_companies(authorization: Optional[str] = Header(None)):
    """Get all companies with subscription info"""
    await verify_admin(authorization)
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    
    # Enrich with subscription and user count
    for company in companies:
        company_id = company.get("id")
        
        # Ensure is_active has a value
        if company.get("is_active") is None:
            company["is_active"] = True
            await db.companies.update_one(
                {"id": company_id},
                {"$set": {"is_active": True}}
            )
        
        # Ensure company_code exists
        if not company.get("company_code"):
            new_code = generate_company_code()
            company["company_code"] = new_code
            await db.companies.update_one(
                {"id": company_id},
                {"$set": {"company_code": new_code}}
            )
        
        # Get subscription (only active ones)
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id, "status": "active"}, 
            {"_id": 0}
        )
        if not subscription:
            subscription = await db.subscriptions.find_one(
                {"company_id": company_id}, 
                {"_id": 0},
                sort=[("created_at", -1)]
            )
        company["subscription"] = subscription
        
        # Get user count
        user_count = await db.users.count_documents({"company_id": company_id})
        company["user_count"] = user_count
        
        # Get active users count
        active_users = await db.users.count_documents({"company_id": company_id, "is_active": True})
        company["active_users"] = active_users
    
    return companies


@router.get("/companies/{company_id}")
async def get_company_details(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get detailed company information"""
    user = await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get subscription
    subscription = await db.subscriptions.find_one(
        {"company_id": company_id, "status": "active"},
        {"_id": 0}
    )
    if not subscription:
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
    
    # Get users
    users = await db.users.find(
        {"company_id": company_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(length=100)
    
    # Get recent activity
    recent_activity = await db.audit_logs.find(
        {"company_id": company_id}
    ).sort("timestamp", -1).limit(20).to_list(length=20)
    
    for log in recent_activity:
        log["_id"] = str(log["_id"])
    
    return {
        "company": company,
        "subscription": subscription,
        "users": users,
        "user_count": len(users),
        "recent_activity": recent_activity
    }


@router.put("/companies/{company_id}/toggle")
async def toggle_company_status(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable a company (suspends all users)"""
    user = await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    current_status = company.get("is_active", True)
    new_status = not current_status
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": get_current_timestamp()
        }}
    )
    
    # Update all users in this company
    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"is_active": new_status}}
    )
    
    # Log audit
    await log_admin_audit(
        action="company_status_toggled",
        entity_type="company",
        user_data=user,
        company_id=company_id,
        company_name=company.get("name"),
        old_status=current_status,
        new_status=new_status
    )
    
    return {
        "success": True,
        "company_id": company_id,
        "is_active": new_status,
        "message": f"Company {'activated' if new_status else 'deactivated'} successfully"
    }


@router.put("/companies/{company_id}/settings")
async def update_company_settings(
    company_id: str,
    settings: dict,
    authorization: Optional[str] = Header(None)
):
    """Update company settings"""
    user = await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Allowed fields to update
    allowed_fields = [
        "name", "name_ar", "email", "phone", "address",
        "tax_number", "commercial_register", "logo_url",
        "settings", "max_users", "features"
    ]
    
    update_data = {k: v for k, v in settings.items() if k in allowed_fields}
    update_data["updated_at"] = get_current_timestamp()
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    await log_admin_audit(
        action="company_settings_updated",
        entity_type="company",
        user_data=user,
        company_id=company_id,
        updated_fields=list(update_data.keys())
    )
    
    return {"success": True, "message": "Company settings updated"}


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a company and all related data"""
    user = await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_name = company.get("name", "Unknown")
    
    # Delete all related data
    await db.users.delete_many({"company_id": company_id})
    await db.subscriptions.delete_many({"company_id": company_id})
    await db.employees.delete_many({"company_id": company_id})
    await db.invoices.delete_many({"company_id": company_id})
    await db.companies.delete_one({"id": company_id})
    
    await log_admin_audit(
        action="company_deleted",
        entity_type="company",
        user_data=user,
        company_id=company_id,
        company_name=company_name
    )
    
    return {"success": True, "message": f"Company {company_name} deleted"}


@router.put("/companies/{company_id}/regenerate-code")
async def regenerate_company_code(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Regenerate company code"""
    user = await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    new_code = generate_company_code()
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "company_code": new_code,
            "updated_at": get_current_timestamp()
        }}
    )
    
    await log_admin_audit(
        action="company_code_regenerated",
        entity_type="company",
        user_data=user,
        company_id=company_id,
        new_code=new_code
    )
    
    return {"success": True, "new_code": new_code}


@router.get("/all-company-codes")
async def get_all_company_codes(authorization: Optional[str] = Header(None)):
    """Get all company codes for reference"""
    await verify_admin(authorization)
    
    companies = await db.companies.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "company_code": 1, "is_active": 1}
    ).to_list(length=None)
    
    return companies


@router.post("/companies/{company_id}/sync-status")
async def sync_company_status(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Sync company status with subscription"""
    user = await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get active subscription
    subscription = await db.subscriptions.find_one(
        {"company_id": company_id, "status": "active"},
        {"_id": 0}
    )
    
    if subscription:
        # Check if subscription is expired
        end_date_str = subscription.get("end_date")
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                if end_date < datetime.now(timezone.utc):
                    # Subscription expired
                    await db.subscriptions.update_one(
                        {"id": subscription.get("id")},
                        {"$set": {"status": "expired"}}
                    )
                    subscription = None
            except:
                pass
    
    # Determine company status
    should_be_active = subscription is not None
    
    if company.get("is_active") != should_be_active:
        await db.companies.update_one(
            {"id": company_id},
            {"$set": {
                "is_active": should_be_active,
                "updated_at": get_current_timestamp()
            }}
        )
    
    return {
        "success": True,
        "company_id": company_id,
        "is_active": should_be_active,
        "has_active_subscription": subscription is not None
    }
