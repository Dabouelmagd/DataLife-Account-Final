from pydantic import BaseModel
from typing import List, Dict

# Define role permissions
ROLE_PERMISSIONS = {
    "General Manager": {
        "modules": ["dashboard", "hr", "financial", "inventory", "reports", "analytics"],
        "permissions": {
            "hr": ["view", "create", "edit", "delete"],
            "financial": ["view", "create", "edit", "delete"],
            "inventory": ["view", "create", "edit", "delete"],
            "reports": ["view", "export"],
            "analytics": ["view"],
            "users": ["view", "create", "edit", "delete", "assign_roles"]
        }
    },
    "HR Manager": {
        "modules": ["dashboard", "hr", "reports"],
        "permissions": {
            "hr": ["view", "create", "edit", "delete"],
            "reports": ["view", "export"],
            "users": ["view"]
        }
    },
    "Financial Manager": {
        "modules": ["dashboard", "financial", "reports", "analytics"],
        "permissions": {
            "financial": ["view", "create", "edit", "delete"],
            "reports": ["view", "export"],
            "analytics": ["view"],
            "users": ["view"]
        }
    },
    "Accountant": {
        "modules": ["dashboard", "financial", "reports"],
        "permissions": {
            "financial": ["view"],
            "reports": ["view", "export"],
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