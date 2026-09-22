"""
Admin Common Utilities
الأدوات المشتركة للوحة التحكم
"""

import os
import secrets
import string
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, Header
from motor.motor_asyncio import AsyncIOMotorClient

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


def generate_company_code(length: int = 8) -> str:
    """Generate a unique company code"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(length))


def get_current_timestamp() -> str:
    """Get current UTC timestamp in ISO format"""
    return datetime.now(timezone.utc).isoformat()


# Platform (DataLife) administrators only. ADMIN_ROLES above contains COMPANY
# roles (General Manager, CEO...) and must never grant platform access.
PLATFORM_ADMIN_ROLES = ['Super Admin']


async def verify_admin(authorization: str) -> dict:
    """Verify a PLATFORM administrator.

    Previously:
    - company roles (General Manager, CEO, المدير التنفيذي...) and a user-level
      "admin" permission passed — any customer's manager could approve payments,
      grant subscriptions and change any user's role in any company;
    - if the JWT failed to decode, the raw header was looked up as a user id
      (or stored token): sending someone's user id authenticated as them with no
      secret at all;
    - the 403 was raised inside `try: ... except Exception: pass` and swallowed.
    Now: a valid, unexpired JWT is required, and the user must be a Super Admin
    or carry is_platform_admin.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    token = authorization[7:] if authorization.startswith("Bearer ") else authorization
    from services.auth_service import verify_token as _vt
    payload = _vt(token)
    if not payload or not payload.get("user_id"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if not user or user.get("is_active") is False:
        raise HTTPException(status_code=401, detail="Invalid authorization")
    if user.get("role") not in PLATFORM_ADMIN_ROLES and user.get("is_platform_admin") is not True:
        raise HTTPException(status_code=403, detail="Platform administrator access required")
    return user


async def log_admin_audit(action: str, entity_type: str, user_data: dict, **kwargs):
    """Log admin action for audit trail"""
    try:
        audit_log = {
            "action": action,
            "entity_type": entity_type,
            "user_id": user_data.get("id"),
            "user_email": user_data.get("email"),
            "user_name": user_data.get("name", "Unknown"),
            "timestamp": get_current_timestamp(),
            "details": kwargs
        }
        await db.admin_audit_logs.insert_one(audit_log)
    except Exception as e:
        print(f"Failed to log audit: {e}")


def format_user_response(user: dict) -> dict:
    """Format user data for API response, excluding sensitive fields"""
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "company_id": user.get("company_id"),
        "permissions": user.get("permissions", []),
        "is_active": user.get("is_active", True),
        "is_platform_admin": user.get("is_platform_admin", False),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login")
    }


def format_company_response(company: dict) -> dict:
    """Format company data for API response"""
    return {
        "id": company.get("id"),
        "company_id": company.get("company_id") or company.get("id"),
        "name": company.get("name"),
        "name_ar": company.get("name_ar"),
        "email": company.get("email"),
        "company_code": company.get("company_code"),
        "is_active": company.get("is_active", True),
        "subscription_plan": company.get("subscription_plan"),
        "subscription_end": company.get("subscription_end"),
        "created_at": company.get("created_at"),
        "users_count": company.get("users_count", 0)
    }
