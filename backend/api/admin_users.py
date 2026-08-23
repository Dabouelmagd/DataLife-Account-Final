"""
Admin Users API
إدارة المستخدمين
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

from .admin_common import (
    db, ADMIN_ROLES, ALL_SYSTEM_PERMISSIONS,
    verify_admin, log_admin_audit, get_current_timestamp,
    format_user_response
)

router = APIRouter(prefix="/api/admin", tags=["admin-users"])


@router.get("/all-users")
async def get_all_users(authorization: Optional[str] = Header(None)):
    """Get all users in the system"""
    await verify_admin(authorization)
    
    users = await db.users.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).to_list(length=None)
    
    # Enrich with company info
    for user in users:
        company_id = user.get("company_id")
        if company_id:
            company = await db.companies.find_one(
                {"id": company_id},
                {"_id": 0, "name": 1, "company_code": 1}
            )
            user["company_name"] = company.get("name") if company else "Unknown"
            user["company_code"] = company.get("company_code") if company else None
    
    return users


@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get user permissions"""
    await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": user_id,
        "permissions": user.get("permissions", []),
        "role": user.get("role"),
        "all_available_permissions": ALL_SYSTEM_PERMISSIONS
    }


@router.put("/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: str,
    permissions_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update user permissions"""
    admin_user = await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_permissions = permissions_data.get("permissions", [])
    
    # Validate permissions
    valid_permissions = [p for p in new_permissions if p in ALL_SYSTEM_PERMISSIONS]
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "permissions": valid_permissions,
            "updated_at": get_current_timestamp()
        }}
    )
    
    await log_admin_audit(
        action="user_permissions_updated",
        entity_type="user",
        user_data=admin_user,
        target_user_id=user_id,
        target_user_email=user.get("email"),
        new_permissions=valid_permissions
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "permissions": valid_permissions
    }


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    role_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update user role"""
    admin_user = await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_role = role_data.get("role", "")
    old_role = user.get("role", "")
    
    update_data = {
        "role": new_role,
        "updated_at": get_current_timestamp()
    }
    
    # If upgrading to admin role, give full permissions
    if new_role in ADMIN_ROLES:
        update_data["permissions"] = ALL_SYSTEM_PERMISSIONS
        update_data["is_platform_admin"] = True
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    await log_admin_audit(
        action="user_role_updated",
        entity_type="user",
        user_data=admin_user,
        target_user_id=user_id,
        old_role=old_role,
        new_role=new_role
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "role": new_role
    }


@router.put("/users/{user_id}/toggle")
async def toggle_user_status(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Enable/disable a user"""
    admin_user = await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent disabling yourself
    if user.get("email") == admin_user.get("email"):
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    
    current_status = user.get("is_active", True)
    new_status = not current_status
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "is_active": new_status,
            "updated_at": get_current_timestamp()
        }}
    )
    
    await log_admin_audit(
        action="user_status_toggled",
        entity_type="user",
        user_data=admin_user,
        target_user_id=user_id,
        target_user_email=user.get("email"),
        old_status=current_status,
        new_status=new_status
    )
    
    return {
        "success": True,
        "user_id": user_id,
        "is_active": new_status
    }


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a user"""
    admin_user = await verify_admin(authorization)
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting yourself
    if user.get("email") == admin_user.get("email"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Prevent deleting super admins (extra protection)
    if user.get("is_platform_admin") or user.get("role") == "Super Admin":
        raise HTTPException(status_code=403, detail="Cannot delete Super Admin accounts")
    
    user_email = user.get("email")
    user_name = user.get("name")
    company_id = user.get("company_id")
    
    await db.users.delete_one({"id": user_id})
    
    await log_admin_audit(
        action="user_deleted",
        entity_type="user",
        user_data=admin_user,
        deleted_user_id=user_id,
        deleted_user_email=user_email,
        deleted_user_name=user_name,
        company_id=company_id
    )
    
    return {
        "success": True,
        "message": f"User {user_email} deleted successfully"
    }


@router.get("/roles")
async def get_available_roles(authorization: Optional[str] = Header(None)):
    """Get available roles"""
    await verify_admin(authorization)
    
    roles = [
        {"id": "Super Admin", "name_ar": "مدير النظام", "level": 1},
        {"id": "General Manager", "name_ar": "مدير عام", "level": 2},
        {"id": "CEO", "name_ar": "المدير التنفيذي", "level": 2},
        {"id": "Financial Manager", "name_ar": "المدير المالي", "level": 3},
        {"id": "HR Manager", "name_ar": "مدير الموارد البشرية", "level": 3},
        {"id": "Department Manager", "name_ar": "مدير قسم", "level": 4},
        {"id": "Accountant", "name_ar": "محاسب", "level": 5},
        {"id": "Employee", "name_ar": "موظف", "level": 6},
    ]
    return roles


@router.get("/permissions")
async def get_all_permissions(authorization: Optional[str] = Header(None)):
    """Get all available permissions organized by category"""
    await verify_admin(authorization)
    
    permissions = [
        # ── الأساسيات ─────────────────────────────────────────
        {"id": "dashboard",       "name_en": "Dashboard",           "name_ar": "لوحة التحكم",         "category": "basics",    "category_ar": "الأساسيات"},
        {"id": "reports",         "name_en": "Reports & Export",    "name_ar": "التقارير والتصدير",    "category": "basics",    "category_ar": "الأساسيات"},
        {"id": "analytics",       "name_en": "Analytics",           "name_ar": "التحليلات",            "category": "basics",    "category_ar": "الأساسيات"},
        {"id": "approvals",       "name_en": "Approvals",           "name_ar": "الموافقات",            "category": "basics",    "category_ar": "الأساسيات"},
        # ── الموارد البشرية ────────────────────────────────────
        {"id": "hr",              "name_en": "HR (View)",           "name_ar": "الموارد البشرية",      "category": "hr",        "category_ar": "الموارد البشرية"},
        {"id": "hr_admin",        "name_en": "HR (Admin)",          "name_ar": "إدارة الموارد البشرية","category": "hr",        "category_ar": "الموارد البشرية"},
        {"id": "hr_financial",    "name_en": "HR Financial",        "name_ar": "المالية والرواتب",     "category": "hr",        "category_ar": "الموارد البشرية"},
        # ── المالية والمحاسبة ──────────────────────────────────
        {"id": "financial",       "name_en": "Financial",           "name_ar": "المالية والمحاسبة",    "category": "financial", "category_ar": "المالية والمحاسبة"},
        {"id": "invoices",        "name_en": "Invoices & ETA",      "name_ar": "الفواتير وـ ETA",      "category": "financial", "category_ar": "المالية والمحاسبة"},
        {"id": "purchases",       "name_en": "Purchases",           "name_ar": "المشتريات",            "category": "financial", "category_ar": "المالية والمحاسبة"},
        {"id": "billing",         "name_en": "Billing",             "name_ar": "الفوترة والدفع",       "category": "financial", "category_ar": "المالية والمحاسبة"},
        # ── المخزون والمبيعات ──────────────────────────────────
        {"id": "inventory",       "name_en": "Inventory",           "name_ar": "المخزون",              "category": "operations","category_ar": "المخزون والمبيعات"},
        {"id": "projects",        "name_en": "Projects",            "name_ar": "المشاريع",             "category": "operations","category_ar": "المخزون والمبيعات"},
        # ── الإدارة والإعدادات ─────────────────────────────────
        {"id": "users",           "name_en": "User Management",     "name_ar": "إدارة المستخدمين",    "category": "admin",     "category_ar": "الإدارة"},
        {"id": "settings",        "name_en": "Settings",            "name_ar": "الإعدادات",            "category": "admin",     "category_ar": "الإدارة"},
        {"id": "companies",       "name_en": "Companies",           "name_ar": "الشركات",              "category": "admin",     "category_ar": "الإدارة"},
        {"id": "subscriptions",   "name_en": "Subscriptions",       "name_ar": "الاشتراكات",           "category": "admin",     "category_ar": "الإدارة"},
        {"id": "audit_logs",      "name_en": "Audit Logs",          "name_ar": "سجل التدقيق",          "category": "admin",     "category_ar": "الإدارة"},
        {"id": "system_settings", "name_en": "System Settings",     "name_ar": "إعدادات النظام",       "category": "admin",     "category_ar": "الإدارة"},
        {"id": "admin",           "name_en": "Full Admin",          "name_ar": "صلاحيات كاملة",       "category": "admin",     "category_ar": "الإدارة"},
        {"id": "support",         "name_en": "Support",             "name_ar": "الدعم الفني",          "category": "admin",     "category_ar": "الإدارة"},
    ]
    return permissions
