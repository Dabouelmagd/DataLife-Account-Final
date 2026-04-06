from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
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
    
    # Enrich with company info
    for sub in subscriptions:
        company = await db.companies.find_one({"id": sub.get("company_id")}, {"_id": 0, "name": 1, "contact_email": 1})
        if company:
            sub["company_name"] = company.get("name", "Unknown")
            sub["company_email"] = company.get("contact_email", "")
    
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


@router.get("/companies")
async def get_all_companies(authorization: Optional[str] = Header(None)):
    """Get all companies with subscription info"""
    await verify_admin(authorization)
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(length=None)
    
    # Enrich with subscription and user count
    for company in companies:
        company_id = company.get("id")
        
        # Get subscription
        subscription = await db.subscriptions.find_one(
            {"company_id": company_id}, 
            {"_id": 0}
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
        {'id': 'financial', 'name_en': 'Financial', 'name_ar': 'الإدارة المالية'},
        {'id': 'invoices', 'name_en': 'Invoices', 'name_ar': 'الفواتير'},
        {'id': 'purchases', 'name_en': 'Purchases', 'name_ar': 'المشتريات'},
        {'id': 'projects', 'name_en': 'Projects', 'name_ar': 'المشاريع'},
        {'id': 'analytics', 'name_en': 'Analytics', 'name_ar': 'التحليلات'},
        {'id': 'settings', 'name_en': 'Settings', 'name_ar': 'الإعدادات'},
        {'id': 'users', 'name_en': 'User Management', 'name_ar': 'إدارة المستخدمين'},
        {'id': 'approvals', 'name_en': 'Approvals', 'name_ar': 'الموافقات'},
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
    
    # Validate permissions
    valid_permission_ids = ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 
                           'projects', 'analytics', 'settings', 'users', 'approvals']
    
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
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام']
    if user_data.get('role') not in super_admin_roles:
        raise HTTPException(status_code=403, detail="Super Admin access required")
    
    # Get all users
    users = await db.users.find(
        {},
        {"_id": 0, "password": 0, "password_hash": 0}  # Exclude sensitive fields
    ).to_list(length=5000)
    
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
    """Delete a user - Super Admin only"""
    user_data = await verify_admin(authorization)
    
    # Verify Super Admin role
    super_admin_roles = ['Super Admin', 'مدير النظام', 'General Manager', 'مدير عام', 'CEO', 'المدير التنفيذي']
    if user_data.get('role') not in super_admin_roles:
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
