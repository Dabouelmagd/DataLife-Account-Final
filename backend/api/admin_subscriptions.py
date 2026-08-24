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
    """Get all subscriptions — including free trial companies"""
    await verify_admin(authorization)

    # 1. Get paid subscriptions from subscriptions collection
    query = {}
    if status and status not in ("trial", "free"):
        query["status"] = status

    paid_subs = await db.subscriptions.find(query, {"_id": 0}).to_list(length=None)

    # Build set of company_ids already covered
    covered_ids = {s.get("company_id") for s in paid_subs}

    # 2. Get ALL companies and build synthetic subscription records
    #    for those not already in the subscriptions collection
    all_companies = await db.companies.find(
        {}, {"_id": 0, "id": 1, "name": 1, "email": 1, "company_code": 1,
             "subscription_status": 1, "subscription_plan": 1,
             "trial_ends_at": 1, "subscription_expires_at": 1,
             "created_at": 1}
    ).to_list(length=None)

    synthetic_subs = []
    for c in all_companies:
        if c.get("id") in covered_ids:
            continue  # already in paid_subs
        sub_status = c.get("subscription_status", "trial")
        sub_plan   = c.get("subscription_plan", "trial")
        end_date   = c.get("subscription_expires_at") or c.get("trial_ends_at")
        # Calculate trial end date if missing (14 days from company creation)
        if not end_date and sub_plan in ("trial", "free"):
            created = c.get("created_at")
            if created:
                try:
                    if isinstance(created, str):
                        from dateutil import parser as dparser
                        created_dt = dparser.parse(created)
                    else:
                        created_dt = created
                    end_date = (created_dt + timedelta(days=14)).isoformat()
                except Exception:
                    pass
        synthetic_subs.append({
            "id": f"syn_{c.get('id', '')}",
            "company_id":    c.get("id"),
            "company_name":  c.get("name"),
            "company_email": c.get("email"),
            "company_code":  c.get("company_code"),
            "plan":   sub_plan,
            "status": sub_status,
            "end_date":    end_date,
            "start_date":  c.get("created_at", "")[:10] if c.get("created_at") else None,
            "amount": 0,
            "is_synthetic": True,   # flag for frontend
        })

    # 3. Enrich paid_subs with company info
    for sub in paid_subs:
        company_id = sub.get("company_id")
        if company_id:
            company = await db.companies.find_one(
                {"id": company_id},
                {"_id": 0, "name": 1, "email": 1, "company_code": 1}
            )
            if company:
                sub["company_name"]  = company.get("name")
                sub["company_email"] = company.get("email")
                sub["company_code"]  = company.get("company_code")

    # 4. Merge and filter
    subscriptions = paid_subs + synthetic_subs

    # Status filter
    if status:
        if status == "trial":
            subscriptions = [s for s in subscriptions
                             if s.get("plan") in ("trial", "free") or s.get("status") in ("trial", "free")]
        elif status == "active":
            subscriptions = [s for s in subscriptions if s.get("status") == "active"]
        elif status == "expired":
            subscriptions = [s for s in subscriptions if s.get("status") == "expired"]
        elif status == "suspended":
            subscriptions = [s for s in subscriptions if s.get("status") == "suspended"]
    
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
    """Get all activation codes with company info"""
    await verify_admin(authorization)
    
    codes = await db.activation_codes.find({}, {"_id": 0}).to_list(length=None)
    
    # Enrich with company info if code was used
    companies = await db.companies.find({}, {"_id": 0, "id": 1, "name": 1, "company_code": 1}).to_list(None)
    
    # Map code -> company
    code_company = {}
    for c in companies:
        used_code = c.get("activation_code_used") or c.get("subscription_code")
        if used_code:
            code_company[used_code] = c.get("name", "")
    
    # Also check subscriptions collection
    subs = await db.subscriptions.find({}, {"_id": 0, "activation_code_used": 1, "company_id": 1}).to_list(None)
    company_map = {c["id"]: c.get("name", "") for c in companies}
    for s in subs:
        used = s.get("activation_code_used")
        if used:
            code_company[used] = company_map.get(s.get("company_id", ""), "")
    
    result = []
    for code in codes:
        enriched = dict(code)
        # Fill company_name if missing but code was used
        if not enriched.get("company_name") and code.get("code") in code_company:
            enriched["company_name"] = code_company[code["code"]]
        result.append(enriched)
    
    return result


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
    
    prefix = code_data.get("prefix", "DL").upper()[:4]
    suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    code = f"{prefix}-{suffix}"
    
    activation_code = {
        "code": code,
        "plan": plan,
        "duration": duration,
        "max_uses": max_uses,
        "used_count": 0,
        "is_active": True,
        "notes": notes,
        "company_name":    code_data.get("company_name", ""),
        "company_code":    code_data.get("company_code", ""),
        "contract_start":  code_data.get("contract_start", ""),
        "contract_end":    code_data.get("contract_end", ""),
        "discount_percent": code_data.get("discount_percent", 0),
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
        prefix = bulk_data.get("prefix", "DL").upper()[:4]
        suffix = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        code = f"{prefix}-{suffix}"
        
        activation_code = {
            "code": code,
            "plan": plan,
            "duration": duration,
            "max_uses": 1,
            "used_count": 0,
            "is_active": True,
            "company_name": bulk_data.get("company_name", ""),
            "contract_start": bulk_data.get("contract_start", ""),
            "contract_end": bulk_data.get("contract_end", ""),
            "discount_percent": bulk_data.get("discount_percent", 0),
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


@router.post("/send-renewal-reminders")
async def send_renewal_reminders(authorization: Optional[str] = Header(None)):
    """Super Admin: إرسال تذكيرات التجديد للشركات التي اشتراكها ينتهي خلال 7 أيام"""
    await verify_admin(authorization)

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    in_7days = (now + timedelta(days=7)).isoformat()
    in_3days = (now + timedelta(days=3)).isoformat()

    subs = await db.subscriptions.find({
        "status": "active",
        "end_date": {"$lte": in_7days, "$gte": now.isoformat()}
    }).to_list(length=None)

    sent = 0
    for sub in subs:
        try:
            company = await db.companies.find_one({"id": sub.get("company_id")}, {"_id": 0})
            if not company or not company.get("email"): continue
            end_date = sub.get("end_date", "")[:10]
            days_left = (datetime.fromisoformat(sub["end_date"].replace("Z","")) - now).days
            from services.professional_email_service import send_renewal_reminder_email
            await send_renewal_reminder_email(
                company_name=company.get("name", ""),
                email=company.get("email"),
                plan=sub.get("plan", ""),
                days_left=max(1, days_left),
                end_date=end_date,
            )
            sent += 1
        except Exception:
            continue

    return {"message": f"تم إرسال {sent} تذكير", "sent": sent, "total": len(subs)}
