from fastapi import APIRouter, HTTPException, Depends, Header
from models.user import UserCreate, UserResponse
from models.permission import get_role_permissions, ROLE_PERMISSIONS
from services.auth_service import verify_token
from services.user_service import (
    create_user,
    get_users_by_company,
    get_user_by_email,
    update_user_role,
    deactivate_user,
    user_to_response
)
from typing import Optional, List

router = APIRouter(prefix="/api/users", tags=["users"])

# Get database instance
from database import get_database
db = get_database()

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload

def check_user_permission(user_role: str, required_permission: str):
    """Check if user has required permission"""
    if user_role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=403, detail="Invalid role")
    
    permissions = ROLE_PERMISSIONS[user_role]["permissions"]
    if "users" not in permissions or required_permission not in permissions["users"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

@router.post("/", response_model=UserResponse)
async def add_user(
    user_data: UserCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new user to the company (requires General Manager role)"""
    # Check if current user has permission to add users
    check_user_permission(current_user.get("role"), "create")
    
    # Check if user already exists
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Validate role
    if user_data.role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(ROLE_PERMISSIONS.keys())}")
    
    # Set company_id to current user's company
    user_data.company_id = current_user.get("company_id")
    
    # Create user
    user = await create_user(db, user_data, user_data.password)
    
    return user_to_response(user)

@router.get("/", response_model=List[UserResponse])
async def list_company_users(
    current_user: dict = Depends(get_current_user)
):
    """List all users in the current user's company"""
    users = await get_users_by_company(db, current_user.get("company_id"))
    
    return [user_to_response(user) for user in users]

@router.put("/{user_id}/role", response_model=UserResponse)
async def update_role(
    user_id: str,
    role: str,
    current_user: dict = Depends(get_current_user)
):
    """Update a user's role (requires General Manager role)"""
    # Check if current user has permission to assign roles
    check_user_permission(current_user.get("role"), "assign_roles")
    
    # Validate role
    if role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(ROLE_PERMISSIONS.keys())}")
    
    # Update role
    user = await update_user_role(db, user_id, role)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if updated user belongs to same company
    if user.company_id != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Cannot modify users from other companies")
    
    return user_to_response(user)

@router.delete("/{user_id}")
async def remove_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Deactivate a user (requires General Manager role)"""
    # Check if current user has permission to delete users
    check_user_permission(current_user.get("role"), "delete")
    
    # Cannot delete yourself
    if user_id == current_user.get("user_id"):
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    
    # Deactivate user
    success = await deactivate_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deactivated successfully"}

@router.get("/roles", response_model=List[str])
async def list_roles():
    """List all available roles"""
    return list(ROLE_PERMISSIONS.keys())

@router.get("/permissions/{role}")
async def get_permissions(role: str):
    """Get permissions for a specific role"""
    if role not in ROLE_PERMISSIONS:
        raise HTTPException(status_code=404, detail="Role not found")
    
    return get_role_permissions(role)
