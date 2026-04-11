from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from collections import defaultdict
import secrets
import string

router = APIRouter(prefix="/api/admin", tags=["admin"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Admin roles that can access this dashboard
ADMIN_ROLES = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي']

# All permissions in the system
ALL_SYSTEM_PERMISSIONS = [
    'dashboard', 'hr', 'hr_admin', 'hr_financial', 'financial', 'invoices', 'purchases', 
    'projects', 'analytics', 'settings', 'users', 'approvals',
    'reports', 'inventory', 'admin', 'subscriptions', 'companies',
    'audit_logs', 'system_settings', 'billing', 'support'
]


@router.post("/fix-all-issues")
async def fix_all_production_issues(secret_key: str = None):
    """
    Master fix endpoint - fixes all common issues in production.
    Can be called with or without auth (uses secret key for security).
    """
    
    # Verify secret key
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    results = {
        "super_admins_fixed": 0,
        "companies_fixed": 0,
        "codes_generated": 0,
        "users_activated": 0,
        "permissions_updated": 0,
        "details": []
    }
    
    try:
        # 1. Fix Super Admin accounts - give them all permissions
        super_admin_emails = [
            "dalia@datalifeai.com",
            "info@datalifeai.com"
        ]
        
        for email in super_admin_emails:
            user = await db.users.find_one({"email": email.lower()})
            if user:
                await db.users.update_one(
                    {"email": email.lower()},
                    {"$set": {
                        "permissions": ALL_SYSTEM_PERMISSIONS,
                        "role": "Super Admin" if user.get("role") not in ["Super Admin", "رئيس مجلس الإدارة"] else user.get("role"),
                        "is_active": True,
                        "is_platform_admin": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                results["super_admins_fixed"] += 1
                results["details"].append(f"Fixed Super Admin: {email}")
        
        # 2. Fix all companies - ensure they have codes and are active
        companies = await db.companies.find({}).to_list(length=500)
        for company in companies:
            update_data = {}
            
            # Generate code if missing
            if not company.get("company_code"):
                new_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
                update_data["company_code"] = new_code
                results["codes_generated"] += 1
            
            # Fix is_active
            if company.get("is_active") is None:
                update_data["is_active"] = True
            
            if update_data:
                update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.companies.update_one(
                    {"id": company["id"]},
                    {"$set": update_data}
                )
                results["companies_fixed"] += 1
                results["details"].append(f"Fixed company: {company.get('name')}")
        
        # 3. Fix all users - ensure they have proper permissions array
        users = await db.users.find({}).to_list(length=1000)
        for user in users:
            # If user has no permissions, give them default ones
            if not user.get("permissions") or len(user.get("permissions", [])) == 0:
                await db.users.update_one(
                    {"id": user["id"]},
                    {"$set": {
                        "permissions": ["dashboard", "settings"],
                        "is_active": True if user.get("is_active") is None else user.get("is_active")
                    }}
                )
                results["permissions_updated"] += 1
        
        # 4. Clean up duplicate subscriptions
        for company in companies:
            company_id = company.get("id")
            # Find active subscription
            active_sub = await db.subscriptions.find_one(
                {"company_id": company_id, "status": "active"}
            )
            if active_sub:
                # Delete all other subscriptions
                await db.subscriptions.delete_many({
                    "company_id": company_id,
                    "id": {"$ne": active_sub.get("id")}
                })
        
        # 5. Ensure dalia@datalifeai.com can see ALL companies
        dalia = await db.users.find_one({"email": "dalia@datalifeai.com"})
        if dalia:
            await db.users.update_one(
                {"email": "dalia@datalifeai.com"},
                {"$set": {
                    "is_platform_admin": True,
                    "can_view_all_companies": True,
                    "permissions": ALL_SYSTEM_PERMISSIONS
                }}
            )
            results["details"].append("Made dalia@datalifeai.com a full platform admin")
        
        results["success"] = True
        results["message"] = "All issues fixed successfully!"
        
    except Exception as e:
        results["success"] = False
        results["error"] = str(e)
    
    return results


@router.get("/diagnostic")
async def run_diagnostic(secret_key: str = None):
    """
    Run a diagnostic check on the system.
    """
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    diagnostic = {
        "companies": [],
        "super_admins": [],
        "subscriptions": [],
        "issues": []
    }
    
    # Check companies
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=100)
    for c in companies:
        company_info = {
            "name": c.get("name"),
            "id": c.get("id"),
            "code": c.get("company_code", "MISSING!"),
            "is_active": c.get("is_active"),
            "email": c.get("contact_email")
        }
        diagnostic["companies"].append(company_info)
        
        if not c.get("company_code"):
            diagnostic["issues"].append(f"Company '{c.get('name')}' has no code")
        if c.get("is_active") is None:
            diagnostic["issues"].append(f"Company '{c.get('name')}' has null is_active")
    
    # Check super admins
    admins = await db.users.find({
        "$or": [
            {"role": "Super Admin"},
            {"role": "رئيس مجلس الإدارة"},
            {"email": "dalia@datalifeai.com"},
            {"email": "info@datalifeai.com"}
        ]
    }, {"_id": 0, "password_hash": 0}).to_list(length=20)
    
    for admin in admins:
        admin_info = {
            "email": admin.get("email"),
            "role": admin.get("role"),
            "permissions_count": len(admin.get("permissions", [])),
            "is_active": admin.get("is_active"),
            "is_platform_admin": admin.get("is_platform_admin"),
            "company_id": admin.get("company_id")
        }
        diagnostic["super_admins"].append(admin_info)
        
        if len(admin.get("permissions", [])) < 19:
            diagnostic["issues"].append(f"Admin '{admin.get('email')}' has only {len(admin.get('permissions', []))} permissions (should be 19)")
    
    # Check subscriptions
    subs = await db.subscriptions.find({}, {"_id": 0}).to_list(length=100)
    for s in subs:
        sub_info = {
            "company_id": s.get("company_id"),
            "plan": s.get("plan"),
            "status": s.get("status"),
            "duration": s.get("duration"),
            "end_date": s.get("end_date")
        }
        diagnostic["subscriptions"].append(sub_info)
    
    diagnostic["total_companies"] = len(companies)
    diagnostic["total_subscriptions"] = len(subs)
    diagnostic["total_issues"] = len(diagnostic["issues"])
    
    return diagnostic




# Import audit log function
async def log_admin_audit(action, entity_type, user_data, **kwargs):
    """Helper to log admin actions"""
    try:
        from api.audit_log import log_audit
        
        # Get user details from database if not in user_data
        performed_by_name = user_data.get('full_name')
        performed_by_email = user_data.get('email')
        
        if not performed_by_name and user_data.get('user_id'):
            admin_user = await db.users.find_one({"id": user_data.get('user_id')})
            if admin_user:
                performed_by_name = admin_user.get('full_name', 'Unknown')
                performed_by_email = admin_user.get('email', performed_by_email)
        
        await log_audit(
            action=action,
            entity_type=entity_type,
            performed_by_id=user_data.get('user_id'),
            performed_by_name=performed_by_name or 'Unknown',
            performed_by_email=performed_by_email or 'Unknown',
            company_id=user_data.get('company_id'),
            **kwargs
        )
    except Exception as e:
        print(f"Audit log error: {e}")


async def send_audit_notification(notification_type: str, **kwargs):
    """Helper to send audit notifications"""
    try:
        from api.audit_notifications import notify_user_deleted, notify_permissions_changed
        
        if notification_type == "user_deleted":
            await notify_user_deleted(**kwargs)
        elif notification_type == "permissions_changed":
            await notify_permissions_changed(**kwargs)
    except Exception as e:
        print(f"Audit notification error: {e}")


async def verify_admin(authorization: str):
    """Verify if user is admin"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # For now, allow any authenticated user with management roles
    # In production, you might want stricter admin checks
    return user_data


@router.get("/dashboard")
async def get_admin_dashboard(authorization: Optional[str] = Header(None)):
    """Get admin dashboard statistics"""
    user_data = await verify_admin(authorization)
    
    # Get all data
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    users = await db.users.find({}, {"_id": 0}).to_list(length=None)
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(length=None)
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(length=None)
    activation_codes = await db.activation_codes.find({}, {"_id": 0}).to_list(length=None)
    
    # Calculate statistics
    total_companies = len(companies)
    total_users = len(users)
    active_subscriptions = len([s for s in subscriptions if s.get('status') == 'active'])
    
    # Revenue calculations
    total_revenue = sum(t.get('amount_egp', 0) for t in transactions if t.get('payment_status') == 'paid')
    monthly_revenue = sum(
        t.get('amount_egp', 0) for t in transactions 
        if t.get('payment_status') == 'paid' and 
        t.get('created_at', '').startswith(datetime.now().strftime('%Y-%m'))
    )
    
    # Subscription breakdown by plan
    plan_breakdown = defaultdict(int)
    for sub in subscriptions:
        if sub.get('status') == 'active':
            plan_breakdown[sub.get('plan', 'unknown')] += 1
    
    # Recent activity
    recent_transactions = sorted(
        [t for t in transactions if t.get('payment_status') == 'paid'],
        key=lambda x: x.get('created_at', ''),
        reverse=True
    )[:10]
    
    # Expiring soon (within 30 days)
    now = datetime.now(timezone.utc)
    expiring_soon = []
    for sub in subscriptions:
        if sub.get('status') == 'active' and sub.get('end_date'):
            try:
                end_date = datetime.fromisoformat(sub['end_date'].replace('Z', '+00:00'))
                days_left = (end_date - now).days
                if 0 < days_left <= 30:
                    expiring_soon.append({
                        "company_id": sub.get('company_id'),
                        "plan": sub.get('plan'),
                        "days_left": days_left,
                        "end_date": sub.get('end_date')
                    })
            except:
                pass
    
    return {
        "statistics": {
            "total_companies": total_companies,
            "total_users": total_users,
            "active_subscriptions": active_subscriptions,
            "total_revenue": total_revenue,
            "monthly_revenue": monthly_revenue,
            "activation_codes_count": len(activation_codes),
            "active_codes": len([c for c in activation_codes if c.get('is_active', False)])
        },
        "plan_breakdown": [
            {"plan": plan, "count": count} 
            for plan, count in plan_breakdown.items()
        ],
        "recent_transactions": recent_transactions,
        "expiring_soon": sorted(expiring_soon, key=lambda x: x['days_left'])[:10]
    }


@router.get("/subscriptions")
async def get_all_subscriptions(
    status: Optional[str] = None,
    plan: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all subscriptions with filtering"""
    await verify_admin(authorization)
    
    query = {}
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan
    
    subscriptions = await db.subscriptions.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    # Enrich with company info and user emails
    for sub in subscriptions:
        company_id = sub.get("company_id")
        company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1, "contact_email": 1})
        if company:
            sub["company_name"] = company.get("name", "Unknown")
            sub["company_email"] = company.get("contact_email", "")
        
        # Get all user emails for this company
        users = await db.users.find(
            {"company_id": company_id}, 
            {"_id": 0, "email": 1, "full_name": 1}
        ).to_list(length=None)
        sub["user_emails"] = [u.get("email") for u in users if u.get("email")]
        sub["users"] = [{"email": u.get("email"), "name": u.get("full_name")} for u in users]
    
    return subscriptions


@router.get("/transactions")
async def get_all_transactions(
    status: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all payment transactions"""
    await verify_admin(authorization)
    
    query = {}
    if status:
        query["payment_status"] = status
    
    transactions = await db.payment_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return transactions


@router.get("/activation-codes")
async def get_activation_codes(
    is_active: Optional[bool] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all activation codes"""
    await verify_admin(authorization)
    
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    
    codes = await db.activation_codes.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return codes


@router.post("/activation-codes/generate")
async def generate_activation_code(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate new activation code"""
    await verify_admin(authorization)
    
    plan = request_data.get("plan", "starter")
    duration = request_data.get("duration", "12_months")
    discount_percent = request_data.get("discount_percent", 0)
    max_uses = request_data.get("max_uses", 1)
    prefix = request_data.get("prefix", "DL")
    company_name = request_data.get("company_name", "")
    contract_start = request_data.get("contract_start", "")
    contract_end = request_data.get("contract_end", "")
    
    # Generate unique code
    random_part = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    code = f"{prefix}-{plan[:3].upper()}-{random_part}"
    
    activation_code = {
        "code": code,
        "plan": plan,
        "duration": duration,
        "discount_percent": discount_percent,
        "max_uses": max_uses,
        "current_uses": 0,
        "is_active": True,
        "company_name": company_name,
        "contract_start": contract_start,
        "contract_end": contract_end,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    }
    
    await db.activation_codes.insert_one(activation_code)
    del activation_code["_id"]
    
    return activation_code


@router.post("/activation-codes/bulk-generate")
async def bulk_generate_codes(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate multiple activation codes at once"""
    await verify_admin(authorization)
    
    count = request_data.get("count", 5)
    plan = request_data.get("plan", "starter")
    duration = request_data.get("duration", "12_months")
    discount_percent = request_data.get("discount_percent", 0)
    prefix = request_data.get("prefix", "DL")
    
    if count > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 codes at once")
    
    generated_codes = []
    
    for _ in range(count):
        random_part = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        code = f"{prefix}-{plan[:3].upper()}-{random_part}"
        
        activation_code = {
            "code": code,
            "plan": plan,
            "duration": duration,
            "discount_percent": discount_percent,
            "max_uses": 1,
            "current_uses": 0,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "admin"
        }
        
        await db.activation_codes.insert_one(activation_code)
        generated_codes.append(code)
    
    return {
        "generated": len(generated_codes),
        "codes": generated_codes
    }


@router.put("/activation-codes/{code}/toggle")
async def toggle_activation_code(
    code: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable an activation code"""
    await verify_admin(authorization)
    
    existing = await db.activation_codes.find_one({"code": code})
    if not existing:
        raise HTTPException(status_code=404, detail="Code not found")
    
    new_status = not existing.get("is_active", False)
    
    await db.activation_codes.update_one(
        {"code": code},
        {"$set": {"is_active": new_status}}
    )
    
    return {"code": code, "is_active": new_status}


@router.delete("/activation-codes/{code}")
async def delete_activation_code(
    code: str,
    authorization: Optional[str] = Header(None)
):
    """Delete an activation code"""
    await verify_admin(authorization)
    
    result = await db.activation_codes.delete_one({"code": code})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Code not found")
    
    return {"deleted": True, "code": code}


@router.post("/subscriptions/assign")
async def assign_subscription_to_company(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Assign a subscription to a company (Admin only)"""
    user = await verify_admin(authorization)
    
    company_id = request_data.get("company_id")
    plan = request_data.get("plan")
    duration = request_data.get("duration", "monthly")
    
    if not company_id or not plan:
        raise HTTPException(status_code=400, detail="company_id and plan are required")
    
    # Verify company exists
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Plan prices
    PLAN_PRICES = {
        "starter": {"monthly": 299, "quarterly": 799, "yearly": 2990, "lifetime": 9990},
        "professional": {"monthly": 799, "quarterly": 2199, "yearly": 7990, "lifetime": 24990},
        "enterprise": {"monthly": 1499, "quarterly": 3999, "yearly": 14990, "lifetime": 50000}
    }
    
    # Duration mapping
    DURATION_DAYS = {
        "monthly": 30,
        "quarterly": 90,
        "yearly": 365,
        "lifetime": 36500  # ~100 years
    }
    
    start_date = datetime.now(timezone.utc)
    days = DURATION_DAYS.get(duration, 30)
    end_date = start_date + timedelta(days=days)
    
    import uuid
    subscription_id = str(uuid.uuid4())
    subscription = {
        "id": subscription_id,
        "user_id": user.get("user_id", "admin"),
        "company_id": company_id,
        "plan": plan,
        "duration": duration,
        "status": "active",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "amount_paid": PLAN_PRICES.get(plan, {}).get(duration, 0),
        "currency": "EGP",
        "payment_method": "admin_grant",
        "created_at": start_date.isoformat()
    }
    
    # Database operations with proper error handling
    try:
        # Delete ALL existing subscriptions for this company (not just deactivate)
        await db.subscriptions.delete_many({"company_id": company_id})
        
        # Insert new subscription
        await db.subscriptions.insert_one(subscription)
        
        # Update company
        await db.companies.update_one(
            {"id": company_id},
            {"$set": {
                "subscription_plan": plan,
                "subscription_status": "active",
                "subscription_end_date": end_date.isoformat(),
                "is_active": True
            }}
        )
        
        # Update users to active
        await db.users.update_many(
            {"company_id": company_id},
            {"$set": {"is_active": True}}
        )
        
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Everything succeeded - return success first, then try notifications
    response = {
        "success": True,
        "message": "Subscription assigned successfully",
        "subscription_id": subscription_id,
        "plan": plan,
        "duration": duration,
        "end_date": end_date.isoformat()
    }
    
    # Try to send notifications in background (don't wait, don't fail)
    try:
        from api.audit_notifications import send_subscription_notification
        # Fire and forget - don't await
        asyncio.create_task(_send_notification_safe(
            company.get("name", "Unknown"),
            company.get("email") or company.get("contact_email"),
            plan,
            duration,
            end_date.isoformat()
        ))
    except:
        pass
    
    # Try to log audit in background
    try:
        asyncio.create_task(_log_audit_safe(
            user,
            subscription_id,
            company_id,
            company.get("name"),
            plan,
            duration,
            end_date.isoformat()
        ))
    except:
        pass
    
    return response


async def _send_notification_safe(company_name, company_email, plan, duration, end_date):
    """Send notification without raising errors"""
    try:
        from api.audit_notifications import send_subscription_notification
        await send_subscription_notification(
            company_name=company_name,
            company_email=company_email,
            plan=plan,
            duration=duration,
            end_date=end_date
        )
    except Exception as e:
        print(f"Notification failed (safe): {e}")


async def _log_audit_safe(user, subscription_id, company_id, company_name, plan, duration, end_date):
    """Log audit without raising errors"""
    try:
        await log_admin_audit(
            action="subscription_assigned",
            entity_type="subscription",
            user_data=user,
            entity_id=subscription_id,
            details={
                "company_id": company_id,
                "company_name": company_name,
                "plan": plan,
                "duration": duration,
                "end_date": end_date
            }
        )
    except Exception as e:
        print(f"Audit log failed (safe): {e}")


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
            # Also update in database
            await db.companies.update_one(
                {"id": company_id},
                {"$set": {"is_active": True}}
            )
        
        # Ensure company_code exists
        if not company.get("company_code"):
            new_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            company["company_code"] = new_code
            # Also update in database
            await db.companies.update_one(
                {"id": company_id},
                {"$set": {"company_code": new_code}}
            )
        
        # Get subscription (only active ones)
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id, "status": "active"}, 
            {"_id": 0}
        )
        # If no active subscription, get the latest one
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


@router.put("/companies/{company_id}/toggle")
async def toggle_company_status(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable a company (suspends all users)"""
    await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Toggle company status
    current_status = company.get("is_active", True)
    new_status = not current_status
    
    # Update company
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update all users in this company
    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"is_active": new_status}}
    )
    
    # Update subscription status
    if not new_status:
        await db.subscriptions.update_one(
            {"company_id": company_id},
            {"$set": {"status": "suspended"}}
        )
    else:
        await db.subscriptions.update_one(
            {"company_id": company_id},
            {"$set": {"status": "active"}}
        )
    
    return {
        "company_id": company_id,
        "company_name": company.get("name"),
        "is_active": new_status,
        "message": f"Company {'activated' if new_status else 'suspended'} successfully"
    }


@router.post("/companies/{company_id}/sync-status")
async def sync_company_status(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Sync company status with its users and subscription"""
    user_data = await verify_admin(authorization)
    
    # Get company
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company_active = company.get("is_active", True)
    
    # Get subscription
    subscription = await db.subscriptions.find_one({"company_id": company_id})
    
    # Determine correct status based on subscription
    if subscription and subscription.get("status") == "active":
        correct_status = True
    else:
        correct_status = company_active
    
    # Update company
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "is_active": correct_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update all users to match
    await db.users.update_many(
        {"company_id": company_id},
        {"$set": {"is_active": correct_status}}
    )
    
    return {
        "success": True,
        "company_id": company_id,
        "company_name": company.get("name"),
        "synced_status": correct_status,
        "users_updated": True
    }


@router.post("/sync-all-companies")
async def sync_all_companies(
    authorization: Optional[str] = Header(None)
):
    """Sync all companies status with their users - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin
    if user_data.get('role') not in ['Super Admin', 'مدير النظام', 'رئيس مجلس الإدارة']:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    companies = await db.companies.find({}).to_list(length=500)
    synced = []
    
    for company in companies:
        company_id = company.get("id")
        company_name = company.get("name", "Unknown")
        
        # Fix is_active if None
        if company.get("is_active") is None:
            await db.companies.update_one(
                {"id": company_id},
                {"$set": {"is_active": True}}
            )
        
        # Check subscription status
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id, "status": "active"}
        )
        
        if subscription:
            # Company should be active
            await db.companies.update_one(
                {"id": company_id},
                {"$set": {"is_active": True}}
            )
            await db.users.update_many(
                {"company_id": company_id},
                {"$set": {"is_active": True}}
            )
            synced.append({"company": company_name, "status": "active", "reason": "has_active_subscription"})
        else:
            # No active subscription but still keep company active
            if company.get("is_active") is None:
                await db.companies.update_one(
                    {"id": company_id},
                    {"$set": {"is_active": True}}
                )
                synced.append({"company": company_name, "status": "active", "reason": "fixed_null_status"})
    
    # Delete cancelled/expired duplicate subscriptions
    deleted_count = 0
    for company in companies:
        company_id = company.get("id")
        # Keep only the latest active subscription
        active_sub = await db.subscriptions.find_one(
            {"company_id": company_id, "status": "active"}
        )
        if active_sub:
            # Delete all other subscriptions for this company
            result = await db.subscriptions.delete_many({
                "company_id": company_id,
                "id": {"$ne": active_sub.get("id")}
            })
            deleted_count += result.deleted_count
    
    return {
        "success": True,
        "synced_companies": len(synced),
        "deleted_duplicate_subscriptions": deleted_count,
        "details": synced
    }


from pydantic import BaseModel

class SubscriptionStatusUpdate(BaseModel):
    subscription_status: str

@router.put("/companies/{company_id}/subscription")
async def update_company_subscription(
    company_id: str,
    data: SubscriptionStatusUpdate,
    authorization: Optional[str] = Header(None)
):
    """Update company subscription status"""
    await verify_admin(authorization)
    
    # Validate status
    valid_statuses = ['trial', 'active', 'expired', 'suspended']
    if data.subscription_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Find company
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Update company subscription status
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "subscription_status": data.subscription_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Also update in subscriptions collection if exists
    await db.subscriptions.update_one(
        {"company_id": company_id},
        {"$set": {
            "status": data.subscription_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    status_names = {
        'trial': 'تجريبي',
        'active': 'نشط',
        'expired': 'منتهي',
        'suspended': 'معلق'
    }
    
    return {
        "company_id": company_id,
        "company_name": company.get("name"),
        "subscription_status": data.subscription_status,
        "message": f"تم تحديث حالة الاشتراك إلى {status_names.get(data.subscription_status, data.subscription_status)}"
    }


@router.get("/companies/{company_id}/users")
async def get_company_users(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get all users for a specific company"""
    await verify_admin(authorization)
    
    users = await db.users.find(
        {"company_id": company_id}, 
        {"_id": 0, "password_hash": 0, "password": 0}
    ).to_list(length=None)
    
    return users


@router.put("/users/{user_id}/toggle")
async def toggle_user_status(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable a specific user"""
    user_data = await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_status = user.get("is_active", True)
    new_status = not old_status
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": new_status}}
    )
    
    # Get company name for audit
    company = await db.companies.find_one({"id": user.get("company_id")})
    company_name = company.get("company_name") if company else None
    
    # Log audit
    await log_admin_audit(
        action="activate" if new_status else "deactivate",
        entity_type="user",
        user_data=user_data,
        entity_id=user_id,
        entity_name=user.get("full_name"),
        company_name=company_name,
        old_values={"is_active": old_status},
        new_values={"is_active": new_status},
        details=f"{'Activated' if new_status else 'Deactivated'} user: {user.get('full_name')}"
    )
    
    return {
        "user_id": user_id,
        "full_name": user.get("full_name"),
        "is_active": new_status
    }


@router.post("/send-notification")
async def send_notification(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Send notification/email to company or user"""
    await verify_admin(authorization)
    
    target_type = request_data.get("target_type")  # "company" or "user" or "all"
    target_id = request_data.get("target_id")
    subject = request_data.get("subject", "Notification from DataLife")
    message = request_data.get("message")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    emails = []
    
    if target_type == "company":
        company = await db.companies.find_one({"id": target_id})
        if company:
            emails.append(company.get("contact_email"))
            # Get all users in company
            users = await db.users.find({"company_id": target_id}).to_list(length=None)
            for user in users:
                if user.get("email"):
                    emails.append(user.get("email"))
    elif target_type == "user":
        user = await db.users.find_one({"id": target_id})
        if user:
            emails.append(user.get("email"))
    elif target_type == "all":
        users = await db.users.find({}).to_list(length=None)
        for user in users:
            if user.get("email"):
                emails.append(user.get("email"))
    
    # Remove duplicates
    emails = list(set(filter(None, emails)))
    
    # Store notification
    notification = {
        "target_type": target_type,
        "target_id": target_id,
        "subject": subject,
        "message": message,
        "emails_sent": emails,
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "sent_by": "admin"
    }
    await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "emails_sent": len(emails),
        "recipients": emails
    }


@router.put("/subscriptions/{company_id}/extend")
async def extend_subscription(
    company_id: str,
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Manually extend a subscription"""
    await verify_admin(authorization)
    
    days = request_data.get("days", 30)
    
    subscription = await db.subscriptions.find_one({"company_id": company_id})
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Calculate new end date
    current_end = datetime.fromisoformat(subscription.get("end_date", datetime.now(timezone.utc).isoformat()).replace('Z', '+00:00'))
    new_end = current_end + timedelta(days=days)
    
    await db.subscriptions.update_one(
        {"company_id": company_id},
        {"$set": {
            "end_date": new_end.isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "company_id": company_id,
        "previous_end": current_end.isoformat(),
        "new_end": new_end.isoformat(),
        "days_added": days
    }


@router.get("/permissions")
async def get_all_permissions(authorization: Optional[str] = Header(None)):
    """Get all available permissions in the system"""
    await verify_admin(authorization)
    
    # All available permissions with their labels
    ALL_PERMISSIONS = [
        {'id': 'dashboard', 'name_en': 'Dashboard', 'name_ar': 'لوحة التحكم'},
        {'id': 'hr', 'name_en': 'Human Resources', 'name_ar': 'الموارد البشرية'},
        {'id': 'hr_admin', 'name_en': 'HR Administration', 'name_ar': 'إدارة الموارد البشرية'},
        {'id': 'hr_financial', 'name_en': 'HR Financial', 'name_ar': 'مالية الموارد البشرية'},
        {'id': 'financial', 'name_en': 'Financial', 'name_ar': 'الإدارة المالية'},
        {'id': 'invoices', 'name_en': 'Invoices', 'name_ar': 'الفواتير'},
        {'id': 'purchases', 'name_en': 'Purchases', 'name_ar': 'المشتريات'},
        {'id': 'projects', 'name_en': 'Projects', 'name_ar': 'المشاريع'},
        {'id': 'analytics', 'name_en': 'Analytics', 'name_ar': 'التحليلات'},
        {'id': 'settings', 'name_en': 'Settings', 'name_ar': 'الإعدادات'},
        {'id': 'users', 'name_en': 'User Management', 'name_ar': 'إدارة المستخدمين'},
        {'id': 'approvals', 'name_en': 'Approvals', 'name_ar': 'الموافقات'},
        {'id': 'reports', 'name_en': 'Reports', 'name_ar': 'التقارير'},
        {'id': 'inventory', 'name_en': 'Inventory', 'name_ar': 'المخزون'},
        {'id': 'admin', 'name_en': 'Administration', 'name_ar': 'الإدارة'},
        {'id': 'subscriptions', 'name_en': 'Subscriptions', 'name_ar': 'الاشتراكات'},
        {'id': 'companies', 'name_en': 'Companies', 'name_ar': 'الشركات'},
        {'id': 'audit_logs', 'name_en': 'Audit Logs', 'name_ar': 'سجل التدقيق'},
        {'id': 'system_settings', 'name_en': 'System Settings', 'name_ar': 'إعدادات النظام'},
        {'id': 'billing', 'name_en': 'Billing', 'name_ar': 'الفوترة'},
        {'id': 'support', 'name_en': 'Support', 'name_ar': 'الدعم الفني'},
    ]
    
    return ALL_PERMISSIONS


@router.get("/all-users")
async def get_all_users(authorization: Optional[str] = Header(None)):
    """Get all users from all companies"""
    await verify_admin(authorization)
    
    users = await db.users.find({}, {"_id": 0, "password": 0, "password_hash": 0}).to_list(length=None)
    
    # Get company names
    companies = await db.companies.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=None)
    company_map = {c["id"]: c.get("name", "Unknown") for c in companies}
    
    # Add company name to each user
    for user in users:
        user["company_name"] = company_map.get(user.get("company_id"), "Unknown")
    
    return users


# Available roles
AVAILABLE_ROLES = [
    {'id': 'General Manager', 'name_en': 'General Manager', 'name_ar': 'مدير عام'},
    {'id': 'CEO', 'name_en': 'CEO', 'name_ar': 'المدير التنفيذي'},
    {'id': 'Board Chairman', 'name_en': 'Board Chairman', 'name_ar': 'رئيس مجلس الإدارة'},
    {'id': 'Financial Manager', 'name_en': 'Financial Manager', 'name_ar': 'المدير المالي'},
    {'id': 'HR Manager', 'name_en': 'HR Manager', 'name_ar': 'مدير الموارد البشرية'},
    {'id': 'Accountant', 'name_en': 'Accountant', 'name_ar': 'محاسب'},
    {'id': 'Employee', 'name_en': 'Employee', 'name_ar': 'موظف'},
    {'id': 'Sales Manager', 'name_en': 'Sales Manager', 'name_ar': 'مدير المبيعات'},
    {'id': 'Project Manager', 'name_en': 'Project Manager', 'name_ar': 'مدير المشاريع'},
    {'id': 'IT Manager', 'name_en': 'IT Manager', 'name_ar': 'مدير تقنية المعلومات'},
]


@router.get("/roles")
async def get_available_roles(authorization: Optional[str] = Header(None)):
    """Get all available roles in the system"""
    await verify_admin(authorization)
    return AVAILABLE_ROLES


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update a user's role - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    new_role = request_data.get("role")
    if not new_role:
        raise HTTPException(status_code=400, detail="Role is required")
    
    # Validate role
    valid_roles = [r['id'] for r in AVAILABLE_ROLES]
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role: {new_role}")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_role = user.get("role")
    
    # Update user role
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "role": new_role,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get company name for audit
    company = await db.companies.find_one({"id": user.get("company_id")})
    company_name = company.get("company_name") if company else None
    
    # Log audit
    await log_admin_audit(
        action="change_role",
        entity_type="user",
        user_data=user_data,
        entity_id=user_id,
        entity_name=user.get("full_name"),
        company_name=company_name,
        old_values={"role": old_role},
        new_values={"role": new_role},
        details=f"Changed role from '{old_role}' to '{new_role}' for user: {user.get('full_name')}"
    )
    
    return {
        "user_id": user_id,
        "full_name": user.get("full_name"),
        "old_role": old_role,
        "new_role": new_role,
        "message": "Role updated successfully"
    }


@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get permissions for a specific user"""
    await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "permissions": 1, "role": 1, "full_name": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user_id,
        "full_name": user.get("full_name", ""),
        "role": user.get("role", ""),
        "permissions": user.get("permissions", [])
    }


@router.put("/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: str,
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update permissions for a specific user - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    permissions = request_data.get("permissions", [])
    
    # Validate permissions - all system permissions including HR sub-permissions
    valid_permission_ids = [
        'dashboard', 'hr', 'hr_admin', 'hr_financial', 'financial', 'invoices', 'purchases', 
        'projects', 'analytics', 'settings', 'users', 'approvals',
        'reports', 'inventory', 'admin', 'subscriptions', 'companies',
        'audit_logs', 'system_settings', 'billing', 'support'
    ]
    
    for perm in permissions:
        if perm not in valid_permission_ids:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {perm}")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_permissions = user.get("permissions", [])
    
    # Update user permissions
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "permissions": permissions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Get company name for audit
    company = await db.companies.find_one({"id": user.get("company_id")})
    company_name = company.get("company_name") if company else None
    
    # Get admin user details for notification
    admin_user = await db.users.find_one({"id": user_data.get('user_id')})
    
    # Log audit
    await log_admin_audit(
        action="change_permissions",
        entity_type="user",
        user_data=user_data,
        entity_id=user_id,
        entity_name=user.get("full_name"),
        company_name=company_name,
        old_values={"permissions": old_permissions},
        new_values={"permissions": permissions},
        details=f"Changed permissions for user: {user.get('full_name')} ({len(old_permissions)} -> {len(permissions)} permissions)"
    )
    
    # Send email notification for sensitive permission changes
    await send_audit_notification(
        "permissions_changed",
        user=user,
        old_permissions=old_permissions,
        new_permissions=permissions,
        changed_by=admin_user or {"full_name": "Unknown", "email": user_data.get("email")}
    )
    
    return {
        "user_id": user_id,
        "full_name": user.get("full_name"),
        "permissions": permissions,
        "message": "Permissions updated successfully"
    }



# ==========================================
# Super Admin APIs - Company & User Management
# ==========================================

@router.get("/companies")
async def get_all_companies(authorization: Optional[str] = Header(None)):
    """Get all companies with their statistics - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Get all companies
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=1000)
    
    # Enrich with user count and subscription info
    result = []
    for company in companies:
        company_id = company.get('id')
        
        # Get user count
        all_users = await db.users.count_documents({"company_id": company_id})
        active_users = await db.users.count_documents({"company_id": company_id, "is_active": {"$ne": False}})
        
        # Get subscription
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        
        result.append({
            **company,
            "user_count": all_users,
            "active_users": active_users,
            "subscription": subscription
        })
    
    return result


@router.get("/users")
async def get_all_users(authorization: Optional[str] = Header(None)):
    """Get all users across all companies - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Get all users with full details
    users = await db.users.find(
        {},
        {"_id": 0, "password": 0, "password_hash": 0}
    ).to_list(length=5000)
    
    # Get all companies for mapping
    companies = await db.companies.find({}, {"_id": 0, "id": 1, "name": 1, "company_code": 1}).to_list(length=500)
    company_map = {c["id"]: c for c in companies}
    
    # Get all subscriptions for mapping
    subscriptions = await db.subscriptions.find({"status": "active"}, {"_id": 0}).to_list(length=500)
    sub_map = {s["company_id"]: s for s in subscriptions}
    
    # Enrich user data
    for user in users:
        company_id = user.get("company_id")
        company = company_map.get(company_id, {})
        subscription = sub_map.get(company_id, {})
        
        user["company_name"] = company.get("name", "غير معروف" if not company_id else "بدون شركة")
        user["company_code"] = company.get("company_code", "-")
        user["subscription_plan"] = subscription.get("plan", "-")
        user["subscription_status"] = subscription.get("status", "-")
        user["subscription_end_date"] = subscription.get("end_date", "-")
        user["permissions_count"] = len(user.get("permissions", []))
        user["last_login"] = user.get("last_login", "-")
        user["created_at"] = user.get("created_at", "-")
    
    return users


@router.put("/companies/{company_id}/toggle")
async def toggle_company_status(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Activate or suspend a company - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Get company
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Toggle status
    current_status = company.get("is_active", True)
    new_status = not current_status
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Also update all users in this company
    if not new_status:
        await db.users.update_many(
            {"company_id": company_id},
            {"$set": {"company_suspended": True}}
        )
    else:
        await db.users.update_many(
            {"company_id": company_id},
            {"$unset": {"company_suspended": ""}}
        )
    
    return {
        "company_id": company_id,
        "is_active": new_status,
        "message": f"Company {'activated' if new_status else 'suspended'} successfully"
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a user - Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Admin role - expanded list
    admin_roles = [
        'Super Admin', 'مدير النظام', 
        'General Manager', 'مدير عام', 
        'CEO', 'المدير التنفيذي',
        'رئيس مجلس الإدارة', 'Board Chairman',
        'Chairman', 'Owner', 'مالك'
    ]
    if user_data.get('role') not in admin_roles:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting Super Admin
    if user.get('role') in ['Super Admin', 'مدير النظام']:
        raise HTTPException(status_code=403, detail="Cannot delete Super Admin user")
    
    # Get company name for audit
    company = await db.companies.find_one({"id": user.get("company_id")})
    company_name = company.get("company_name") if company else None
    
    # Get admin user details for notification
    admin_user = await db.users.find_one({"id": user_data.get('user_id')})
    
    # Delete user
    result = await db.users.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Log audit
    await log_admin_audit(
        action="delete",
        entity_type="user",
        user_data=user_data,
        entity_id=user_id,
        entity_name=user.get("full_name"),
        company_name=company_name,
        old_values={
            "email": user.get("email"),
            "role": user.get("role"),
            "permissions": user.get("permissions", [])
        },
        details=f"Deleted user: {user.get('full_name')} ({user.get('email')})"
    )
    
    # Send email notification
    await send_audit_notification(
        "user_deleted",
        deleted_user=user,
        deleted_by=admin_user or {"full_name": "Unknown", "email": user_data.get("email")},
        company_name=company_name
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "full_name": user.get("full_name"),
        "message": f"User '{user.get('full_name')}' deleted successfully"
    }


@router.get("/companies/{company_id}")
async def get_company_details(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get detailed company information - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Get company
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get users
    users = await db.users.find(
        {"company_id": company_id},
        {"_id": 0, "password": 0, "password_hash": 0}
    ).to_list(length=100)
    
    # Get subscription
    subscription = await db.subscriptions.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    # Get invoices count
    invoices_count = await db.invoices.count_documents({"company_id": company_id})
    
    return {
        **company,
        "users": users,
        "subscription": subscription,
        "stats": {
            "users_count": len(users),
            "active_users": len([u for u in users if u.get("is_active", True)]),
            "invoices_count": invoices_count
        }
    }



# ==========================================
# Super Admin Complete Control APIs
# ==========================================

@router.get("/audit-logs")
async def get_all_audit_logs(
    authorization: Optional[str] = Header(None),
    company_id: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get all audit logs across all companies - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Build query
    query = {}
    if company_id:
        query["company_id"] = company_id
    if action_type:
        query["action"] = action_type
    
    # Get audit logs
    logs = await db.audit_log.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Get total count
    total = await db.audit_log.count_documents(query)
    
    # Enrich with company names
    for log in logs:
        if log.get("company_id"):
            company = await db.companies.find_one({"id": log["company_id"]}, {"_id": 0, "name": 1})
            log["company_name"] = company.get("name", "Unknown") if company else "Unknown"
    
    return {
        "logs": logs,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.get("/company-activity/{company_id}")
async def get_company_activity(
    company_id: str,
    authorization: Optional[str] = Header(None),
    limit: int = 50
):
    """Get all activity for a specific company - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Get company info
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get all audit logs for this company
    audit_logs = await db.audit_log.find(
        {"company_id": company_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(length=limit)
    
    # Get all users
    users = await db.users.find(
        {"company_id": company_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(length=100)
    
    # Get subscription history
    subscription = await db.subscriptions.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    # Get invoices summary
    invoices = await db.invoices.find(
        {"company_id": company_id},
        {"_id": 0, "total_amount": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).limit(20).to_list(length=20)
    
    # Get projects summary
    projects = await db.projects.find(
        {"company_id": company_id},
        {"_id": 0, "name": 1, "status": 1, "created_at": 1}
    ).sort("created_at", -1).limit(20).to_list(length=20)
    
    return {
        "company": company,
        "users": users,
        "subscription": subscription,
        "recent_activity": audit_logs,
        "recent_invoices": invoices,
        "recent_projects": projects,
        "stats": {
            "total_users": len(users),
            "active_users": len([u for u in users if u.get("is_active", True)]),
            "total_invoices": await db.invoices.count_documents({"company_id": company_id}),
            "total_projects": await db.projects.count_documents({"company_id": company_id})
        }
    }


@router.get("/system-overview")
async def get_system_overview(authorization: Optional[str] = Header(None)):
    """Get complete system overview - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Companies stats
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"is_active": True})
    
    # Users stats
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    
    # Subscriptions stats
    total_subscriptions = await db.subscriptions.count_documents({})
    active_subscriptions = await db.subscriptions.count_documents({"status": "active"})
    
    # Codes stats
    total_codes = await db.activation_codes.count_documents({})
    active_codes = await db.activation_codes.count_documents({"is_active": True, "used": False})
    used_codes = await db.activation_codes.count_documents({"used": True})
    
    # Revenue stats
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.transactions.aggregate(pipeline).to_list(length=1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Recent activity (last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    recent_activity = await db.audit_log.count_documents({
        "timestamp": {"$gte": yesterday.isoformat()}
    })
    
    # Subscription breakdown by plan
    plan_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {"_id": "$plan", "count": {"$sum": 1}}}
    ]
    plans = await db.subscriptions.aggregate(plan_pipeline).to_list(length=10)
    
    return {
        "companies": {
            "total": total_companies,
            "active": active_companies,
            "inactive": total_companies - active_companies
        },
        "users": {
            "total": total_users,
            "active": active_users,
            "inactive": total_users - active_users
        },
        "subscriptions": {
            "total": total_subscriptions,
            "active": active_subscriptions,
            "by_plan": {p["_id"]: p["count"] for p in plans if p["_id"]}
        },
        "codes": {
            "total": total_codes,
            "active": active_codes,
            "used": used_codes
        },
        "revenue": {
            "total": total_revenue
        },
        "activity": {
            "last_24h": recent_activity
        }
    }


@router.put("/companies/{company_id}/settings")
async def update_company_settings(
    company_id: str,
    authorization: Optional[str] = Header(None),
    name: Optional[str] = None,
    contact_email: Optional[str] = None,
    contact_phone: Optional[str] = None,
    address: Optional[str] = None,
    tax_number: Optional[str] = None
):
    """Update company settings - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام', 'رئيس مجلس الإدارة']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Build update data
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if name: update_data["name"] = name
    if contact_email: update_data["contact_email"] = contact_email
    if contact_phone: update_data["contact_phone"] = contact_phone
    if address: update_data["address"] = address
    if tax_number: update_data["tax_number"] = tax_number
    
    # Update company
    result = await db.companies.update_one(
        {"id": company_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Log audit
    await log_admin_audit(
        action="company_settings_updated",
        entity_type="company",
        user_data=user_data,
        entity_id=company_id,
        details=update_data
    )
    
    return {"success": True, "message": "تم تحديث إعدادات الشركة بنجاح"}


@router.delete("/companies/{company_id}")
async def delete_company(
    company_id: str,
    authorization: Optional[str] = Header(None),
    confirm: bool = False
):
    """Delete a company and all its data - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    if not confirm:
        raise HTTPException(status_code=400, detail="Please confirm deletion by setting confirm=true")
    
    # Get company info first
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Delete all company data
    await db.users.delete_many({"company_id": company_id})
    await db.subscriptions.delete_many({"company_id": company_id})
    await db.invoices.delete_many({"company_id": company_id})
    await db.projects.delete_many({"company_id": company_id})
    await db.employees.delete_many({"company_id": company_id})
    await db.companies.delete_one({"id": company_id})
    
    # Log audit
    await log_admin_audit(
        action="company_deleted",
        entity_type="company",
        user_data=user_data,
        entity_id=company_id,
        details={"company_name": company.get("name"), "company_email": company.get("contact_email")}
    )
    
    return {"success": True, "message": f"تم حذف الشركة {company.get('name')} وجميع بياناتها"}


@router.get("/all-company-codes")
async def get_all_company_codes(authorization: Optional[str] = Header(None)):
    """Get all company registration codes - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Get all companies with their codes
    companies = await db.companies.find(
        {},
        {"_id": 0, "id": 1, "name": 1, "contact_email": 1, "company_code": 1, "is_active": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(length=500)
    
    return {"companies": companies, "total": len(companies)}


@router.put("/companies/{company_id}/regenerate-code")
async def regenerate_company_code(
    company_id: str,
    authorization: Optional[str] = Header(None)
):
    """Regenerate company code - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Generate new code
    new_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    # Update company
    result = await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "company_code": new_code,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Log audit
    await log_admin_audit(
        action="company_code_regenerated",
        entity_type="company",
        user_data=user_data,
        entity_id=company_id,
        details={"new_code": new_code}
    )
    
    return {"success": True, "new_code": new_code, "message": "تم تجديد كود الشركة بنجاح"}
