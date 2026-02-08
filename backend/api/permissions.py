"""
Permissions API - Single source of truth for roles and permissions
This API provides role definitions and permission configurations to the frontend.
"""

from fastapi import APIRouter
from typing import Dict, List, Any
from models.permission import ROLE_PERMISSIONS

router = APIRouter(prefix="/api/permissions", tags=["permissions"])

# Available modules with their metadata
AVAILABLE_MODULES = [
    {"id": "dashboard", "name_ar": "لوحة التحكم", "name_en": "Dashboard", "icon": "Home"},
    {"id": "hr", "name_ar": "الموارد البشرية", "name_en": "Human Resources", "icon": "Users"},
    {"id": "financial", "name_ar": "المالية", "name_en": "Financial", "icon": "DollarSign"},
    {"id": "invoices", "name_ar": "الفواتير", "name_en": "Invoices", "icon": "FileText"},
    {"id": "purchases", "name_ar": "المشتريات", "name_en": "Purchases", "icon": "ShoppingCart"},
    {"id": "projects", "name_ar": "المشاريع والمهام", "name_en": "Projects & Tasks", "icon": "FolderKanban"},
    {"id": "reports", "name_ar": "التقارير", "name_en": "Reports", "icon": "FileBarChart"},
    {"id": "analytics", "name_ar": "التحليلات", "name_en": "Analytics", "icon": "BarChart3"},
    {"id": "inventory", "name_ar": "المخزون", "name_en": "Inventory", "icon": "Package"},
    {"id": "settings", "name_ar": "الإعدادات", "name_en": "Settings", "icon": "Settings"},
    {"id": "users", "name_ar": "إدارة المستخدمين", "name_en": "User Management", "icon": "UserCog"},
    {"id": "approvals", "name_ar": "الموافقات", "name_en": "Approvals", "icon": "CheckCircle"}
]

# Available roles with their metadata
AVAILABLE_ROLES = [
    # Top Management
    {"value": "رئيس مجلس الإدارة", "value_en": "Board Chairman", "label_ar": "رئيس مجلس الإدارة", "label_en": "Board Chairman", "category": "top_management"},
    {"value": "مدير عام", "value_en": "General Manager", "label_ar": "المدير العام", "label_en": "General Manager", "category": "top_management"},
    {"value": "المدير التنفيذي", "value_en": "CEO", "label_ar": "المدير التنفيذي", "label_en": "CEO", "category": "top_management"},
    # Middle Management
    {"value": "المدير المالي", "value_en": "Financial Manager", "label_ar": "المدير المالي", "label_en": "Finance Director", "category": "middle_management"},
    {"value": "رئيس الحسابات", "value_en": "Chief Accountant", "label_ar": "رئيس الحسابات", "label_en": "Chief Accountant", "category": "middle_management"},
    {"value": "مدير الموارد البشرية", "value_en": "HR Manager", "label_ar": "مدير الموارد البشرية", "label_en": "HR Manager", "category": "middle_management"},
    {"value": "مدير المشاريع", "value_en": "Project Manager", "label_ar": "مدير المشاريع", "label_en": "Project Manager", "category": "middle_management"},
    # Staff
    {"value": "محاسب", "value_en": "Accountant", "label_ar": "محاسب", "label_en": "Accountant", "category": "staff"},
    {"value": "موظف", "value_en": "Employee", "label_ar": "موظف", "label_en": "Employee", "category": "staff"}
]

# Top management roles that have full access
TOP_MANAGEMENT_ROLES = [
    "رئيس مجلس الإدارة", "Board Chairman",
    "مدير عام", "General Manager", 
    "المدير التنفيذي", "CEO"
]

# Available actions
AVAILABLE_ACTIONS = [
    {"id": "view", "name_ar": "عرض", "name_en": "View"},
    {"id": "create", "name_ar": "إضافة", "name_en": "Create"},
    {"id": "edit", "name_ar": "تعديل", "name_en": "Edit"},
    {"id": "delete", "name_ar": "حذف", "name_en": "Delete"},
    {"id": "send", "name_ar": "إرسال", "name_en": "Send"},
    {"id": "print", "name_ar": "طباعة", "name_en": "Print"},
    {"id": "export", "name_ar": "تصدير", "name_en": "Export"},
    {"id": "approve", "name_ar": "موافقة", "name_en": "Approve"},
    {"id": "reject", "name_ar": "رفض", "name_en": "Reject"},
    {"id": "assign_roles", "name_ar": "تعيين الأدوار", "name_en": "Assign Roles"},
    {"id": "invite", "name_ar": "دعوة", "name_en": "Invite"}
]


@router.get("/config")
async def get_permissions_config() -> Dict[str, Any]:
    """
    Get the complete permissions configuration.
    This is the single source of truth for the frontend.
    """
    return {
        "modules": AVAILABLE_MODULES,
        "roles": AVAILABLE_ROLES,
        "actions": AVAILABLE_ACTIONS,
        "top_management_roles": TOP_MANAGEMENT_ROLES,
        "role_permissions": {
            role: {
                "modules": data["modules"],
                "permissions": data["permissions"]
            }
            for role, data in ROLE_PERMISSIONS.items()
        }
    }


@router.get("/roles")
async def get_available_roles() -> List[Dict[str, Any]]:
    """Get all available roles"""
    return AVAILABLE_ROLES


@router.get("/modules")
async def get_available_modules() -> List[Dict[str, Any]]:
    """Get all available modules"""
    return AVAILABLE_MODULES


@router.get("/role/{role_name}")
async def get_role_permissions(role_name: str) -> Dict[str, Any]:
    """Get permissions for a specific role"""
    if role_name in ROLE_PERMISSIONS:
        return {
            "role": role_name,
            "modules": ROLE_PERMISSIONS[role_name]["modules"],
            "permissions": ROLE_PERMISSIONS[role_name]["permissions"]
        }
    return {"role": role_name, "modules": [], "permissions": {}}


@router.get("/check/{role_name}/{module}/{action}")
async def check_permission(role_name: str, module: str, action: str) -> Dict[str, bool]:
    """Check if a role has a specific permission"""
    if role_name not in ROLE_PERMISSIONS:
        return {"has_permission": False}
    
    permissions = ROLE_PERMISSIONS[role_name].get("permissions", {})
    module_perms = permissions.get(module, [])
    
    return {"has_permission": action in module_perms}
