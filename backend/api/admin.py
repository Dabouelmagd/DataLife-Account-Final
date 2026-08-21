"""
Admin Dashboard Core API
الواجهات الأساسية للوحة إدارة النظام
Contains: dashboard stats, diagnostics, fix-all, transactions, notifications,
          company users, subscription status, sync, audit logs, system overview
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
import asyncio
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from collections import defaultdict
import secrets
import string
from pydantic import BaseModel

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


# ===========================================
# Helper Functions
# ===========================================

async def log_admin_audit(action, entity_type, user_data, **kwargs):
    """Helper to log admin actions"""
    try:
        from api.audit_log import log_audit
        performed_by_name = user_data.get('full_name')
        performed_by_email = user_data.get('email')
        if not performed_by_name and user_data.get('user_id'):
            admin_user = await db.users.find_one({"id": user_data.get('user_id')})
            if admin_user:
                performed_by_name = admin_user.get('full_name', 'Unknown')
                performed_by_email = admin_user.get('email', performed_by_email)
        await log_audit(
            action=action, entity_type=entity_type,
            performed_by_id=user_data.get('user_id'),
            performed_by_name=performed_by_name or 'Unknown',
            performed_by_email=performed_by_email or 'Unknown',
            company_id=user_data.get('company_id'), **kwargs
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
    return user_data


# ===========================================
# Utility Endpoints
# ===========================================

@router.post("/fix-all-issues")
async def fix_all_production_issues(secret_key: str = None):
    """Master fix endpoint - fixes all common issues in production."""
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    results = {"super_admins_fixed": 0, "companies_fixed": 0, "codes_generated": 0, "permissions_updated": 0, "details": []}
    
    try:
        super_admin_emails = ["dalia@datalifeai.com", "info@datalifeai.com"]
        for email in super_admin_emails:
            user = await db.users.find_one({"email": email.lower()})
            if user:
                await db.users.update_one(
                    {"email": email.lower()},
                    {"$set": {
                        "permissions": ALL_SYSTEM_PERMISSIONS,
                        "role": "Super Admin" if user.get("role") not in ["Super Admin", "رئيس مجلس الإدارة"] else user.get("role"),
                        "is_active": True, "is_platform_admin": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                results["super_admins_fixed"] += 1
                results["details"].append(f"Fixed Super Admin: {email}")
        
        companies = await db.companies.find({}).to_list(length=500)
        for company in companies:
            update_data = {}
            if not company.get("company_code"):
                update_data["company_code"] = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
                results["codes_generated"] += 1
            if company.get("is_active") is None:
                update_data["is_active"] = True
            if update_data:
                update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
                await db.companies.update_one({"id": company["id"]}, {"$set": update_data})
                results["companies_fixed"] += 1
        
        results["success"] = True
        results["message"] = "All issues fixed successfully!"
    except Exception as e:
        results["success"] = False
        results["error"] = str(e)
    
    return results


@router.get("/diagnostic")
async def run_diagnostic(secret_key: str = None):
    """Run a diagnostic check on the system."""
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    diagnostic = {"companies": [], "super_admins": [], "subscriptions": [], "issues": []}
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=100)
    for c in companies:
        diagnostic["companies"].append({
            "name": c.get("name"), "id": c.get("id"),
            "code": c.get("company_code", "MISSING!"),
            "is_active": c.get("is_active"), "email": c.get("contact_email")
        })
        if not c.get("company_code"):
            diagnostic["issues"].append(f"Company '{c.get('name')}' has no code")
    
    admins = await db.users.find({
        "$or": [{"role": "Super Admin"}, {"role": "رئيس مجلس الإدارة"},
                {"email": "dalia@datalifeai.com"}, {"email": "info@datalifeai.com"}]
    }, {"_id": 0, "password_hash": 0}).to_list(length=20)
    
    for admin in admins:
        diagnostic["super_admins"].append({
            "email": admin.get("email"), "role": admin.get("role"),
            "permissions_count": len(admin.get("permissions", [])),
            "is_active": admin.get("is_active"), "is_platform_admin": admin.get("is_platform_admin")
        })
    
    subs = await db.subscriptions.find({}, {"_id": 0}).to_list(length=100)
    for s in subs:
        diagnostic["subscriptions"].append({
            "company_id": s.get("company_id"), "plan": s.get("plan"),
            "status": s.get("status"), "end_date": s.get("end_date")
        })
    
    diagnostic["total_companies"] = len(companies)
    diagnostic["total_subscriptions"] = len(subs)
    diagnostic["total_issues"] = len(diagnostic["issues"])
    return diagnostic


# ===========================================
# Dashboard Stats
# ===========================================

@router.get("/dashboard")
async def get_admin_dashboard(authorization: Optional[str] = Header(None)):
    """Get admin dashboard statistics"""
    user_data = await verify_admin(authorization)
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    users = await db.users.find({}, {"_id": 0}).to_list(length=None)
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(length=None)
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(length=None)
    activation_codes = await db.activation_codes.find({}, {"_id": 0}).to_list(length=None)
    
    total_revenue = sum(t.get('amount_egp', 0) for t in transactions if t.get('payment_status') == 'paid')
    monthly_revenue = sum(
        t.get('amount_egp', 0) for t in transactions 
        if t.get('payment_status') == 'paid' and t.get('created_at', '').startswith(datetime.now().strftime('%Y-%m'))
    )
    
    plan_breakdown = defaultdict(int)
    for sub in subscriptions:
        if sub.get('status') == 'active':
            plan_breakdown[sub.get('plan', 'unknown')] += 1
    
    recent_transactions = sorted(
        [t for t in transactions if t.get('payment_status') == 'paid'],
        key=lambda x: x.get('created_at', ''), reverse=True
    )[:10]
    
    now = datetime.now(timezone.utc)
    expiring_soon = []
    for sub in subscriptions:
        if sub.get('status') == 'active' and sub.get('end_date'):
            try:
                end_date = datetime.fromisoformat(sub['end_date'].replace('Z', '+00:00'))
                days_left = (end_date - now).days
                if 0 < days_left <= 30:
                    expiring_soon.append({
                        "company_id": sub.get('company_id'), "plan": sub.get('plan'),
                        "days_left": days_left, "end_date": sub.get('end_date')
                    })
            except:
                pass
    
    return {
        "statistics": {
            "total_companies": len(companies), "total_users": len(users),
            "active_subscriptions": len([s for s in subscriptions if s.get('status') == 'active']),
            "total_revenue": total_revenue, "monthly_revenue": monthly_revenue,
            "activation_codes_count": len(activation_codes),
            "active_codes": len([c for c in activation_codes if c.get('is_active', False)])
        },
        "plan_breakdown": [{"plan": plan, "count": count} for plan, count in plan_breakdown.items()],
        "recent_transactions": recent_transactions,
        "expiring_soon": sorted(expiring_soon, key=lambda x: x['days_left'])[:10]
    }


# ===========================================
# Transactions
# ===========================================

@router.get("/transactions")
async def get_all_transactions(status: Optional[str] = None, authorization: Optional[str] = Header(None)):
    """Get all payment transactions — from multiple collections"""
    await verify_admin(authorization)

    results = []

    # 1. From payment_transactions collection
    query = {}
    if status:
        query["payment_status"] = status
    tx = await db.payment_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    results.extend(tx)

    # 2. From subscription_payments collection
    sp_query = {}
    if status == "paid":
        sp_query["is_paid"] = True
    elif status == "pending":
        sp_query["is_paid"] = False
    sp = await db.subscription_payments.find(sp_query, {"_id": 0}).sort("created_at", -1).to_list(None)
    for p in sp:
        results.append({
            "id": p.get("id"),
            "user_email": p.get("company_email") or p.get("user_email"),
            "plan": p.get("plan", ""),
            "amount_egp": p.get("amount", 0),
            "payment_status": "paid" if p.get("is_paid") else "pending",
            "payment_method": p.get("payment_method"),
            "created_at": p.get("created_at") or p.get("payment_date"),
        })

    # 3. From subscriptions collection (as transactions)
    if not results:
        subs = await db.subscriptions.find({}, {"_id": 0}).sort("created_at", -1).to_list(None)
        companies = await db.companies.find({}, {"_id": 0, "id": 1, "email": 1, "contact_email": 1}).to_list(None)
        company_email = {c["id"]: c.get("email") or c.get("contact_email", "") for c in companies}
        for s in subs:
            pstatus = "paid" if s.get("status") == "active" and s.get("amount_paid", 0) > 0 else "pending"
            if status and status != pstatus:
                continue
            results.append({
                "id": s.get("id"),
                "user_email": company_email.get(s.get("company_id"), ""),
                "plan": s.get("plan", ""),
                "amount_egp": s.get("amount_paid", 0),
                "payment_status": pstatus,
                "payment_method": s.get("payment_method", ""),
                "created_at": s.get("created_at"),
            })

    results.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return results


# ===========================================
# Company Users & Subscription Status
# ===========================================

@router.get("/companies/{company_id}/users")
async def get_company_users(company_id: str, authorization: Optional[str] = Header(None)):
    """Get all users for a specific company"""
    await verify_admin(authorization)
    return await db.users.find(
        {"company_id": company_id}, {"_id": 0, "password_hash": 0, "password": 0}
    ).to_list(length=None)


class SubscriptionStatusUpdate(BaseModel):
    subscription_status: str

@router.put("/companies/{company_id}/subscription")
async def update_company_subscription(company_id: str, data: SubscriptionStatusUpdate, authorization: Optional[str] = Header(None)):
    """Update company subscription status"""
    await verify_admin(authorization)
    
    valid_statuses = ['trial', 'active', 'expired', 'suspended']
    if data.subscription_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"subscription_status": data.subscription_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    await db.subscriptions.update_one(
        {"company_id": company_id},
        {"$set": {"status": data.subscription_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    status_names = {'trial': 'تجريبي', 'active': 'نشط', 'expired': 'منتهي', 'suspended': 'معلق'}
    return {
        "company_id": company_id, "company_name": company.get("name"),
        "subscription_status": data.subscription_status,
        "message": f"تم تحديث حالة الاشتراك إلى {status_names.get(data.subscription_status, data.subscription_status)}"
    }


# ===========================================
# Notifications
# ===========================================

@router.post("/send-notification")
async def send_notification(request_data: dict, authorization: Optional[str] = Header(None)):
    """Send notification/email to company or user"""
    await verify_admin(authorization)
    
    target_type = request_data.get("target_type")
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
    
    emails = list(set(filter(None, emails)))
    
    await db.notifications.insert_one({
        "target_type": target_type, "target_id": target_id,
        "subject": subject, "message": message,
        "emails_sent": emails, "sent_at": datetime.now(timezone.utc).isoformat(), "sent_by": "admin"
    })
    
    return {"success": True, "emails_sent": len(emails), "recipients": emails}


# ===========================================
# Sync Companies
# ===========================================

@router.post("/sync-all-companies")
async def sync_all_companies(authorization: Optional[str] = Header(None)):
    """Sync all companies status with their users - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    if user_data.get('role') not in ['Super Admin', 'مدير النظام', 'رئيس مجلس الإدارة']:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    companies = await db.companies.find({}).to_list(length=500)
    synced = []
    deleted_count = 0
    
    for company in companies:
        company_id = company.get("id")
        if company.get("is_active") is None:
            await db.companies.update_one({"id": company_id}, {"$set": {"is_active": True}})
        
        subscription = await db.subscriptions.find_one({"company_id": company_id, "status": "active"})
        if subscription:
            await db.companies.update_one({"id": company_id}, {"$set": {"is_active": True}})
            await db.users.update_many({"company_id": company_id}, {"$set": {"is_active": True}})
            synced.append({"company": company.get("name", "Unknown"), "status": "active"})
        
        # Clean duplicate subscriptions
        active_sub = await db.subscriptions.find_one({"company_id": company_id, "status": "active"})
        if active_sub:
            result = await db.subscriptions.delete_many({
                "company_id": company_id, "id": {"$ne": active_sub.get("id")}
            })
            deleted_count += result.deleted_count
    
    return {"success": True, "synced_companies": len(synced), "deleted_duplicate_subscriptions": deleted_count, "details": synced}


# ===========================================
# Audit Logs & System Overview
# ===========================================



@router.get("/companies")
async def get_all_companies(authorization: Optional[str] = Header(None)):
    """Get all companies with subscription and user count for SuperAdmin overview"""
    await verify_admin(authorization)

    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(length=None)
    users = await db.users.find({}, {"_id": 0}).to_list(length=None)

    # Index subscriptions and user counts by company_id
    sub_map = {s["company_id"]: s for s in subscriptions if "company_id" in s}
    user_counts = {}
    for u in users:
        cid = u.get("company_id")
        if cid:
            user_counts[cid] = user_counts.get(cid, 0) + 1

    result = []
    for c in companies:
        cid = c.get("id")
        sub = sub_map.get(cid, {})
        result.append({
            **c,
            "subscription": {
                "plan":       sub.get("plan", "free"),
                "status":     sub.get("status", "inactive"),
                "start_date": sub.get("start_date"),
                "end_date":   sub.get("end_date"),
            },
            "user_count": user_counts.get(cid, 0),
        })

    return result


@router.get("/all-users")
async def get_all_users(authorization: Optional[str] = Header(None)):
    """Get all users across all companies for SuperAdmin"""
    await verify_admin(authorization)

    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(length=None)
    companies = await db.companies.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(length=None)
    company_names = {c["id"]: c.get("name", "") for c in companies}

    result = []
    for u in users:
        result.append({
            **u,
            "company_name": company_names.get(u.get("company_id"), ""),
        })

    return result


@router.put("/companies/{company_id}/toggle")
async def toggle_company_status(company_id: str, authorization: Optional[str] = Header(None)):
    """Toggle company active/suspended status"""
    await verify_admin(authorization)

    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    new_status = not company.get("is_active", True)
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"is_active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "is_active": new_status}



# ─── Payment Methods Settings ──────────────────────────────────────────────────

@router.get("/payment-settings")
async def get_payment_settings(authorization: Optional[str] = Header(None)):
    """Get configured payment methods (instapay number, vodafone, bank, etc.)"""
    await verify_admin(authorization)
    settings = await db.system_settings.find_one({"key": "payment_methods"}, {"_id": 0})
    if not settings:
        return {
            "key": "payment_methods",
            "methods": [
                {"id": "instapay",      "label_ar": "InstaPay",        "label_en": "InstaPay",      "icon": "📱", "account": "00201006008552",     "active": True },
                {"id": "vodafone_cash", "label_ar": "فودافون كاش",     "label_en": "Vodafone Cash", "icon": "📲", "account": "00201012625529",     "active": True },
                {"id": "bank_transfer", "label_ar": "تحويل بنكي",      "label_en": "Bank Transfer", "icon": "🏦", "account": "بنك القاهرة — 12345678", "active": True },
                {"id": "credit_card",   "label_ar": "بطاقة ائتمانية",  "label_en": "Credit Card",   "icon": "💳", "account": "Visa / Mastercard", "active": False},
                {"id": "cash",          "label_ar": "نقدي",             "label_en": "Cash",          "icon": "💵", "account": "",                  "active": True },
            ]
        }
    return settings


@router.put("/payment-settings")
async def update_payment_settings(data: dict, authorization: Optional[str] = Header(None)):
    """Update payment methods configuration"""
    await verify_admin(authorization)
    await db.system_settings.update_one(
        {"key": "payment_methods"},
        {"$set": {**data, "key": "payment_methods", "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True}


# ─── System Guide / Manual ─────────────────────────────────────────────────────

@router.get("/system-guide")
async def get_system_guide(authorization: Optional[str] = Header(None)):
    """Get the editable system guide/manual for superadmin"""
    await verify_admin(authorization)
    guide = await db.system_settings.find_one({"key": "system_guide"}, {"_id": 0})
    if not guide:
        return {
            "key": "system_guide",
            "sections": [
                {"id": "getting-started", "title_ar": "البداية السريعة",    "title_en": "Getting Started",   "content_ar": "سجّل شركتك واختر خطتك المناسبة.", "content_en": "Register your company and choose a plan.", "order": 1},
                {"id": "hr",              "title_ar": "الموارد البشرية",     "title_en": "Human Resources",   "content_ar": "إدارة الموظفين والرواتب والحضور.", "content_en": "Manage employees, payroll and attendance.", "order": 2},
                {"id": "financial",       "title_ar": "المحاسبة المالية",    "title_en": "Financial",         "content_ar": "108 حساب وفق الدليل المصري.", "content_en": "108 accounts per Egyptian standard.", "order": 3},
            ],
            "updated_at": None
        }
    return guide


@router.put("/system-guide")
async def update_system_guide(data: dict, authorization: Optional[str] = Header(None)):
    """Update system guide content"""
    await verify_admin(authorization)
    await db.system_settings.update_one(
        {"key": "system_guide"},
        {"$set": {**data, "key": "system_guide", "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"success": True}


# ─── Outreach Messages to Clients ──────────────────────────────────────────────

@router.post("/outreach/send")
async def send_outreach_message(data: dict, authorization: Optional[str] = Header(None)):
    """Send outreach emails to companies — partial or all"""
    await verify_admin(authorization)

    scope        = data.get("scope", "all")          # "all" | "partial" | "plan" | "trial"
    company_ids  = data.get("company_ids", [])        # used when scope="partial"
    plan_filter  = data.get("plan_filter")             # used when scope="plan"
    subject_ar   = data.get("subject_ar", "")
    subject_en   = data.get("subject_en", "")
    body_ar      = data.get("body_ar", "")
    body_en      = data.get("body_en", "")
    reason       = data.get("reason", "general")      # general|update|warning|offer|maintenance
    send_ar      = data.get("send_ar", True)
    send_en      = data.get("send_en", True)

    # Determine target companies
    if scope == "all":
        query = {"is_active": {"$ne": False}}
    elif scope == "partial":
        query = {"id": {"$in": company_ids}}
    elif scope == "trial":
        subs = await db.subscriptions.find({"plan": "trial", "status": "active"}, {"_id": 0, "company_id": 1}).to_list(None)
        cids = [s["company_id"] for s in subs]
        query = {"id": {"$in": cids}}
    elif scope == "plan" and plan_filter:
        subs = await db.subscriptions.find({"plan": plan_filter, "status": "active"}, {"_id": 0, "company_id": 1}).to_list(None)
        cids = [s["company_id"] for s in subs]
        query = {"id": {"$in": cids}}
    else:
        query = {"is_active": {"$ne": False}}

    companies = await db.companies.find(query, {"_id": 0}).to_list(length=None)

    import resend, os
    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    sender_email = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")

    sent_count  = 0
    failed_list = []

    for company in companies:
        email = company.get("contact_email") or company.get("email")
        if not email:
            continue
        try:
            # Build HTML email
            subject = subject_ar if send_ar else subject_en
            body    = body_ar    if send_ar else body_en
            if send_ar and send_en:
                body = f"{body_ar}\n\n---\n\n{body_en}"

            html = f"""
            <div dir="rtl" style="font-family:Cairo,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <div style="background:linear-gradient(135deg,#0f1729,#28376B);padding:20px;border-radius:12px;margin-bottom:20px">
                <h1 style="color:#fff;margin:0;font-size:22px">داتا لايف أكونت</h1>
              </div>
              <div style="background:#f8fafc;border-radius:12px;padding:24px;white-space:pre-wrap;line-height:1.8;color:#1e293b">
                {body}
              </div>
              <p style="color:#94a3b8;font-size:12px;margin-top:20px;text-align:center">
                datalifeaccount.com | info@datalifeai.com
              </p>
            </div>"""

            if resend.api_key:
                resend.Emails.send({
                    "from":    f"DataLife Account <{sender_email}>",
                    "to":      [email],
                    "subject": subject_ar if send_ar else subject_en,
                    "html":    html,
                })
            sent_count += 1
        except Exception as ex:
            failed_list.append({"email": email, "error": str(ex)})

    # Log outreach
    await db.outreach_logs.insert_one({
        "scope":     scope,
        "reason":    reason,
        "subject_ar": subject_ar,
        "subject_en": subject_en,
        "sent_count": sent_count,
        "failed":     len(failed_list),
        "target_count": len(companies),
        "created_at":  datetime.now(timezone.utc).isoformat(),
    })

    return {"success": True, "sent": sent_count, "failed": len(failed_list), "failed_list": failed_list[:10]}


@router.get("/outreach/logs")
async def get_outreach_logs(authorization: Optional[str] = Header(None)):
    """Get history of outreach messages sent"""
    await verify_admin(authorization)
    logs = await db.outreach_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return logs




@router.put("/companies/{company_id}/code")
async def change_company_code(
    company_id: str,
    data: dict,
    authorization: Optional[str] = Header(None)
):
    """Change a company's identifying code"""
    await verify_admin(authorization)

    new_code = data.get("company_code", "").strip().upper()
    if not new_code:
        raise HTTPException(status_code=400, detail="Code cannot be empty")

    # Check if code already taken by another company
    existing = await db.companies.find_one({"company_code": new_code, "id": {"$ne": company_id}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Code '{new_code}' already used by another company")

    await db.companies.update_one(
        {"id": company_id},
        {"$set": {"company_code": new_code, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "company_code": new_code}

@router.get("/audit-logs")
async def get_all_audit_logs(
    authorization: Optional[str] = Header(None),
    company_id: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = 100, skip: int = 0
):
    """Get all audit logs across all companies"""
    await verify_admin(authorization)
    
    query = {}
    if company_id:
        query["company_id"] = company_id
    if action_type:
        query["action"] = action_type
    
    logs = await db.audit_log.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
    total = await db.audit_log.count_documents(query)
    
    for log in logs:
        if log.get("company_id"):
            company = await db.companies.find_one({"id": log["company_id"]}, {"_id": 0, "name": 1})
            log["company_name"] = company.get("name", "Unknown") if company else "Unknown"
    
    return {"logs": logs, "total": total, "limit": limit, "skip": skip}


@router.get("/company-activity/{company_id}")
async def get_company_activity(company_id: str, authorization: Optional[str] = Header(None), limit: int = 50):
    """Get all activity for a specific company"""
    await verify_admin(authorization)
    
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    audit_logs = await db.audit_log.find({"company_id": company_id}, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(length=limit)
    users = await db.users.find({"company_id": company_id}, {"_id": 0, "password_hash": 0}).to_list(length=100)
    subscription = await db.subscriptions.find_one({"company_id": company_id}, {"_id": 0})
    invoices = await db.invoices.find({"company_id": company_id}, {"_id": 0, "total_amount": 1, "status": 1, "created_at": 1}).sort("created_at", -1).limit(20).to_list(length=20)
    projects = await db.projects.find({"company_id": company_id}, {"_id": 0, "name": 1, "status": 1, "created_at": 1}).sort("created_at", -1).limit(20).to_list(length=20)
    
    return {
        "company": company, "users": users, "subscription": subscription,
        "recent_activity": audit_logs, "recent_invoices": invoices, "recent_projects": projects,
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
    await verify_admin(authorization)
    
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"is_active": True})
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    total_subscriptions = await db.subscriptions.count_documents({})
    active_subscriptions = await db.subscriptions.count_documents({"status": "active"})
    total_codes = await db.activation_codes.count_documents({})
    active_codes = await db.activation_codes.count_documents({"is_active": True})
    
    plan_pipeline = [{"$match": {"status": "active"}}, {"$group": {"_id": "$plan", "count": {"$sum": 1}}}]
    plans = await db.subscriptions.aggregate(plan_pipeline).to_list(length=10)
    
    return {
        "companies": {"total": total_companies, "active": active_companies, "inactive": total_companies - active_companies},
        "users": {"total": total_users, "active": active_users, "inactive": total_users - active_users},
        "subscriptions": {"total": total_subscriptions, "active": active_subscriptions, "by_plan": {p["_id"]: p["count"] for p in plans if p["_id"]}},
        "codes": {"total": total_codes, "active": active_codes}
    }
