"""
Admin Subscriptions API
إدارة الاشتراكات
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
import secrets
import string
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

from .admin_common import (
    db, verify_admin, log_admin_audit, 
    get_current_timestamp, generate_company_code
)

router = APIRouter(prefix="/api/admin", tags=["admin-subscriptions"])


@router.get("/subscriptions")
async def get_all_subscriptions(
    authorization: Optional[str] = Header(None),
    status: str = None,
    search: str = None
):
    """Get all subscriptions"""
    await verify_admin(authorization)
    
    query = {}
    if status:
        query["status"] = status
    
    subscriptions = await db.subscriptions.find(query, {"_id": 0}).to_list(length=None)
    
    # Enrich with company info
    for sub in subscriptions:
        company_id = sub.get("company_id")
        if company_id:
            company = await db.companies.find_one(
                {"id": company_id},
                {"_id": 0, "name": 1, "email": 1, "company_code": 1}
            )
            if company:
                sub["company_name"] = company.get("name")
                sub["company_email"] = company.get("email")
                sub["company_code"] = company.get("company_code")
    
    # Filter by search if provided
    if search:
        search_lower = search.lower()
        subscriptions = [
            s for s in subscriptions 
            if search_lower in s.get("company_name", "").lower() or
               search_lower in s.get("company_email", "").lower() or
               search_lower in s.get("company_code", "").lower()
        ]
    
    return subscriptions


@router.post("/subscriptions/assign")
async def assign_subscription_to_company(
    subscription_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Assign or update subscription for a company"""
    user = await verify_admin(authorization)
    
    company_id = subscription_data.get("company_id")
    plan = subscription_data.get("plan", "basic")
    duration = subscription_data.get("duration", "monthly")
    
    # Find company
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_name = company.get("name", "Unknown")
    company_email = company.get("email", "")
    
    # Calculate end date based on duration
    now = datetime.now(timezone.utc)
    
    if duration == "lifetime":
        end_date = datetime(2099, 12, 31, tzinfo=timezone.utc)
    elif duration == "yearly":
        end_date = now + timedelta(days=365)
    elif duration == "6months":
        end_date = now + timedelta(days=180)
    elif duration == "3months":
        end_date = now + timedelta(days=90)
    else:  # monthly
        end_date = now + timedelta(days=30)
    
    subscription_id = f"sub_{secrets.token_hex(8)}"
    
    # Deactivate existing subscriptions
    await db.subscriptions.update_many(
        {"company_id": company_id},
        {"$set": {"status": "replaced"}}
    )
    
    # Create new subscription
    new_subscription = {
        "id": subscription_id,
        "company_id": company_id,
        "plan": plan,
        "duration": duration,
        "status": "active",
        "start_date": now.isoformat(),
        "end_date": end_date.isoformat(),
        "created_at": now.isoformat(),
        "created_by": user.get("email"),
        "features": get_plan_features(plan)
    }
    
    await db.subscriptions.insert_one(new_subscription)
    
    # Update company
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "is_active": True,
            "subscription_plan": plan,
            "subscription_end": end_date.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Activate all users
    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"is_active": True}}
    )
    
    # Log audit
    await log_admin_audit(
        action="subscription_assigned",
        entity_type="subscription",
        user_data=user,
        subscription_id=subscription_id,
        company_id=company_id,
        company_name=company_name,
        plan=plan,
        duration=duration,
        end_date=end_date.isoformat()
    )
    
    return {
        "success": True,
        "subscription_id": subscription_id,
        "company_id": company_id,
        "company_name": company_name,
        "plan": plan,
        "duration": duration,
        "end_date": end_date.isoformat(),
        "message": f"Subscription assigned to {company_name}"
    }


@router.put("/subscriptions/{company_id}/extend")
async def extend_subscription(
    company_id: str,
    extension_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Extend an existing subscription"""
    user = await verify_admin(authorization)
    
    # Find active subscription
    subscription = await db.subscriptions.find_one(
        {"company_id": company_id, "status": "active"}
    )
    
    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found")
    
    days = extension_data.get("days", 30)
    
    # Calculate new end date
    current_end = subscription.get("end_date")
    if current_end:
        try:
            end_date = datetime.fromisoformat(current_end.replace('Z', '+00:00'))
        except:
            end_date = datetime.now(timezone.utc)
    else:
        end_date = datetime.now(timezone.utc)
    
    new_end_date = end_date + timedelta(days=days)
    
    await db.subscriptions.update_one(
        {"id": subscription.get("id")},
        {"$set": {
            "end_date": new_end_date.isoformat(),
            "updated_at": get_current_timestamp()
        }}
    )
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "subscription_end": new_end_date.isoformat(),
            "updated_at": get_current_timestamp()
        }}
    )
    
    await log_admin_audit(
        action="subscription_extended",
        entity_type="subscription",
        user_data=user,
        company_id=company_id,
        days_added=days,
        new_end_date=new_end_date.isoformat()
    )
    
    return {
        "success": True,
        "new_end_date": new_end_date.isoformat(),
        "days_added": days
    }


# ===========================================
# Activation Codes
# ===========================================

@router.get("/activation-codes")
async def get_activation_codes(authorization: Optional[str] = Header(None)):
    """Get all activation codes"""
    await verify_admin(authorization)
    
    codes = await db.activation_codes.find({}, {"_id": 0}).to_list(length=None)
    return codes


@router.post("/activation-codes/generate")
async def generate_activation_code(
    code_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate a new activation code"""
    user = await verify_admin(authorization)
    
    plan = code_data.get("plan", "basic")
    duration = code_data.get("duration", "monthly")
    max_uses = code_data.get("max_uses", 1)
    notes = code_data.get("notes", "")
    
    code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(12))
    
    activation_code = {
        "code": code,
        "plan": plan,
        "duration": duration,
        "max_uses": max_uses,
        "used_count": 0,
        "is_active": True,
        "notes": notes,
        "created_at": get_current_timestamp(),
        "created_by": user.get("email")
    }
    
    await db.activation_codes.insert_one(activation_code)
    
    await log_admin_audit(
        action="activation_code_generated",
        entity_type="activation_code",
        user_data=user,
        code=code,
        plan=plan,
        duration=duration
    )
    
    return {
        "success": True,
        "code": code,
        "plan": plan,
        "duration": duration
    }


@router.post("/activation-codes/bulk-generate")
async def bulk_generate_codes(
    bulk_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate multiple activation codes"""
    user = await verify_admin(authorization)
    
    count = bulk_data.get("count", 10)
    plan = bulk_data.get("plan", "basic")
    duration = bulk_data.get("duration", "monthly")
    
    codes = []
    for _ in range(min(count, 100)):  # Max 100 codes at once
        code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(12))
        
        activation_code = {
            "code": code,
            "plan": plan,
            "duration": duration,
            "max_uses": 1,
            "used_count": 0,
            "is_active": True,
            "created_at": get_current_timestamp(),
            "created_by": user.get("email")
        }
        
        await db.activation_codes.insert_one(activation_code)
        codes.append(code)
    
    return {
        "success": True,
        "codes": codes,
        "count": len(codes)
    }


@router.put("/activation-codes/{code}/toggle")
async def toggle_activation_code(
    code: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable an activation code"""
    user = await verify_admin(authorization)
    
    activation_code = await db.activation_codes.find_one({"code": code})
    if not activation_code:
        raise HTTPException(status_code=404, detail="Code not found")
    
    new_status = not activation_code.get("is_active", True)
    
    await db.activation_codes.update_one(
        {"code": code},
        {"$set": {"is_active": new_status}}
    )
    
    return {"success": True, "is_active": new_status}


@router.delete("/activation-codes/{code}")
async def delete_activation_code(
    code: str,
    authorization: Optional[str] = Header(None)
):
    """Delete an activation code"""
    user = await verify_admin(authorization)
    
    result = await db.activation_codes.delete_one({"code": code})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    
    return {"success": True, "message": "Code deleted"}


# ===========================================
# Helper Functions
# ===========================================

def get_plan_features(plan: str) -> dict:
    """Get features for a subscription plan"""
    plans = {
        "basic": {
            "max_users": 5,
            "max_invoices": 100,
            "modules": ["dashboard", "hr", "invoices"],
            "support": "email"
        },
        "professional": {
            "max_users": 25,
            "max_invoices": 1000,
            "modules": ["dashboard", "hr", "financial", "invoices", "inventory"],
            "support": "email,phone"
        },
        "enterprise": {
            "max_users": -1,  # Unlimited
            "max_invoices": -1,
            "modules": "all",
            "support": "priority"
        }
    }
    return plans.get(plan, plans["basic"])
