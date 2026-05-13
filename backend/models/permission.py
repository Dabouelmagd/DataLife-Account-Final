from pydantic import BaseModel
from typing import List, Dict

# Define role permissions
ROLE_PERMISSIONS = {
    # ========================================
    # Super Admin - صلاحيات كاملة على كل شيء
    # ========================================
    "Super Admin": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite", "approve"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    # ========================================
    # الأدوار الإدارية العليا (صلاحيات كاملة)
    # ========================================
    "General Manager": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    "مدير عام": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    "CEO": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    "المدير التنفيذي": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    "Board Chairman": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    "رئيس مجلس الإدارة": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics", "projects", "invoices", "purchases", "settings", "users", "approvals"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "financial": ["view", "create", "edit", "delete", "send", "print"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export", "print"],
            "analytics": ["view", "export"],
            "projects": ["view", "create", "edit", "delete"],
            "invoices": ["view", "create", "edit", "delete", "send", "print"],
            "purchases": ["view", "create", "edit", "delete", "send"],
            "settings": ["view", "edit"],
            "users": ["view", "create", "edit", "delete", "assign_roles", "invite"],
            "approvals": ["view", "approve", "reject"]
        }
    },
    
    # ========================================
    # الأدوار الإدارية المتوسطة (إضافة، تعديل، إرسال)
    # ========================================
    "Financial Manager": {
        "modules": ["dashboard", "financial", "reports", "analytics", "invoices", "purchases"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit", "send", "print"],
            "reports": ["view", "export", "print"],
            "analytics": ["view"],
            "invoices": ["view", "create", "edit", "send", "print"],
            "purchases": ["view", "create", "edit", "send"],
            "users": ["view"]
        }
    },
    "المدير المالي": {
        "modules": ["dashboard", "financial", "reports", "analytics", "invoices", "purchases"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit", "send", "print"],
            "reports": ["view", "export", "print"],
            "analytics": ["view"],
            "invoices": ["view", "create", "edit", "send", "print"],
            "purchases": ["view", "create", "edit", "send"],
            "users": ["view"]
        }
    },
    "Chief Accountant": {
        "modules": ["dashboard", "financial", "reports", "invoices"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit", "send", "print"],
            "reports": ["view", "export", "print"],
            "invoices": ["view", "create", "edit", "send", "print"],
            "users": ["view"]
        }
    },
    "رئيس الحسابات": {
        "modules": ["dashboard", "financial", "reports", "invoices"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit", "send", "print"],
            "reports": ["view", "export", "print"],
            "invoices": ["view", "create", "edit", "send", "print"],
            "users": ["view"]
        }
    },
    
    # ========================================
    # مدير الموارد البشرية (HR فقط)
    # ========================================
    "HR Manager": {
        "modules": ["dashboard", "hr"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "users": ["view"]
        }
    },
    "مدير الموارد البشرية": {
        "modules": ["dashboard", "hr"],
        "permissions": {
            "dashboard": ["view"],
            "hr": ["view", "create", "edit", "delete", "send"],
            "users": ["view"]
        }
    },
    
    # ========================================
    # مدير المشاريع (المشروعات والمهام فقط)
    # ========================================
    "Project Manager": {
        "modules": ["dashboard", "projects"],
        "permissions": {
            "dashboard": ["view"],
            "projects": ["view", "create", "edit", "delete"],
            "users": ["view"]
        }
    },
    "مدير المشاريع": {
        "modules": ["dashboard", "projects"],
        "permissions": {
            "dashboard": ["view"],
            "projects": ["view", "create", "edit", "delete"],
            "users": ["view"]
        }
    },
    
    # ========================================
    # الأدوار التنفيذية (المالية + طباعة التقارير)
    # ========================================
    "Accountant": {
        "modules": ["dashboard", "financial", "reports"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit"],
            "reports": ["view", "print"],
            "users": []
        }
    },
    "محاسب": {
        "modules": ["dashboard", "financial", "reports"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit"],
            "reports": ["view", "print"],
            "users": []
        }
    },
    "Employee": {
        "modules": ["dashboard", "financial", "reports"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit"],
            "reports": ["view", "print"],
            "users": []
        }
    },
    "موظف": {
        "modules": ["dashboard", "financial", "reports"],
        "permissions": {
            "dashboard": ["view"],
            "financial": ["view", "create", "edit"],
            "reports": ["view", "print"],
            "users": []
        }
    }
}

class RolePermissions(BaseModel):
    role: str
    modules: List[str]
    permissions: Dict[str, List[str]]

def get_role_permissions(role: str) -> RolePermissions:
    """Get permissions for a specific role"""
    if role not in ROLE_PERMISSIONS:
        return RolePermissions(role="", modules=[], permissions={})
    
    role_data = ROLE_PERMISSIONS[role]
    return RolePermissions(
        role=role,
        modules=role_data["modules"],
        permissions=role_data["permissions"]
    )

def has_permission(role: str, module: str, action: str) -> bool:
    """Check if a role has permission for a specific action on a module"""
    if role not in ROLE_PERMISSIONS:
        return False
    
    permissions = ROLE_PERMISSIONS[role]["permissions"]
    if module not in permissions:
        return False
    
    return action in permissions[module]
