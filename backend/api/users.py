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
import os
import asyncio
import resend
from dotenv import load_dotenv

load_dotenv()

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@datalifeaccount.com")

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
    send_invite: bool = True,
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
    
    # Store original password for email
    original_password = user_data.password
    
    # Create user
    user = await create_user(db, user_data, user_data.password)
    
    # Send invitation email
    if send_invite and resend.api_key:
        try:
            # Get company name
            company = await db.companies.find_one({"id": current_user.get("company_id")})
            company_name = company.get("name", "DataLife Account") if company else "DataLife Account"
            inviter_name = current_user.get("full_name", "المدير")
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; text-align: center;">DataLife Account</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #333; text-align: center;">🎉 مرحباً بك في الفريق!</h2>
                    <p style="color: #666; font-size: 16px; text-align: center;">
                        تمت دعوتك للانضمام إلى <strong>{company_name}</strong> على منصة DataLife Account
                    </p>
                    <p style="color: #666; font-size: 14px; text-align: center;">
                        تمت الدعوة بواسطة: <strong>{inviter_name}</strong>
                    </p>
                    
                    <div style="background: #fff; border: 2px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #667eea; margin-top: 0; text-align: center;">بيانات الدخول</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">البريد الإلكتروني:</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">{user_data.email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">كلمة المرور:</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">{original_password}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; color: #666;">الصلاحية:</td>
                                <td style="padding: 10px; color: #333; font-weight: bold;">{user_data.role}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="https://datalifeaccount.com/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            تسجيل الدخول الآن
                        </a>
                    </div>
                    
                    <p style="color: #999; font-size: 12px; text-align: center;">
                        ⚠️ يرجى تغيير كلمة المرور بعد أول تسجيل دخول للحفاظ على أمان حسابك
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="color: #999; font-size: 11px; text-align: center;">
                        هذا البريد الإلكتروني تم إرساله تلقائياً من DataLife Account<br>
                        © 2024 DataLife Account. جميع الحقوق محفوظة.
                    </p>
                </div>
            </div>
            """
            
            params = {
                "from": SENDER_EMAIL,
                "to": [user_data.email],
                "subject": f"🎉 دعوة للانضمام إلى {company_name} - DataLife Account",
                "html": html_content
            }
            
            await asyncio.to_thread(resend.Emails.send, params)
        except Exception as e:
            # Log error but don't fail the user creation
            print(f"Failed to send invitation email: {e}")
    
    return user_to_response(user)

@router.post("/{user_id}/resend-invite")
async def resend_invitation(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resend invitation email to a user"""
    check_user_permission(current_user.get("role"), "edit")
    
    # Get user
    user = await db.users.find_one({"id": user_id, "company_id": current_user.get("company_id")})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not resend.api_key:
        raise HTTPException(status_code=500, detail="Email service not configured")
    
    try:
        # Generate new temporary password
        import secrets
        import string
        import bcrypt
        
        alphabet = string.ascii_letters + string.digits
        new_password = ''.join(secrets.choice(alphabet) for _ in range(10))
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update password in database
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "password": hashed.decode('utf-8'),
                "password_hash": hashed.decode('utf-8')
            }}
        )
        
        # Get company name
        company = await db.companies.find_one({"id": current_user.get("company_id")})
        company_name = company.get("name", "DataLife Account") if company else "DataLife Account"
        inviter_name = current_user.get("full_name", "المدير")
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; text-align: center;">DataLife Account</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; text-align: center;">📧 إعادة إرسال الدعوة</h2>
                <p style="color: #666; font-size: 16px; text-align: center;">
                    تم إعادة إرسال دعوتك للانضمام إلى <strong>{company_name}</strong>
                </p>
                
                <div style="background: #fff; border: 2px solid #667eea; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #667eea; margin-top: 0; text-align: center;">بيانات الدخول الجديدة</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">البريد الإلكتروني:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">{user.get('email')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #666;">كلمة المرور الجديدة:</td>
                            <td style="padding: 10px; color: #333; font-weight: bold;">{new_password}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://datalifeaccount.com/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        تسجيل الدخول الآن
                    </a>
                </div>
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    تم الإرسال بواسطة: {inviter_name}
                </p>
            </div>
        </div>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [user.get('email')],
            "subject": f"📧 إعادة إرسال دعوة - {company_name}",
            "html": html_content
        }
        
        await asyncio.to_thread(resend.Emails.send, params)
        
        return {"message": "Invitation resent successfully", "email": user.get('email')}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

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


# Photo upload endpoint
from fastapi import File, UploadFile
import os
from pathlib import Path

@router.post("/{user_id}/upload-photo")
async def upload_user_photo(
    user_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload profile photo for a user"""
    # Check if user has permission (can only edit own photo or if they're a manager)
    is_manager = current_user.get("role") in ['General Manager', 'CEO', 'Board Chairman']
    if user_id != current_user.get("user_id") and not is_manager:
        raise HTTPException(status_code=403, detail="Cannot upload photo for other users")
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Create uploads directory if it doesn't exist
    upload_dir = Path("/app/frontend/public/uploads/users")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename
    file_extension = file.filename.split('.')[-1]
    filename = f"{user_id}.{file_extension}"
    file_path = upload_dir / filename
    
    # Save file
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Update user profile_photo_url in database
    photo_url = f"/uploads/users/{filename}"
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"profile_photo_url": photo_url}}
    )
    
    return {"message": "Photo uploaded successfully", "photo_url": photo_url}

from pydantic import BaseModel

class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

@router.put("/{user_id}")
async def update_user_details(
    user_id: str,
    update_data: UserUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update user details"""
    # Check permissions
    is_manager = current_user.get("role") in ['General Manager', 'CEO', 'Board Chairman', 'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة']
    is_own_account = user_id == current_user.get("user_id")
    
    # Users can only edit their own name/email, managers can edit everything
    if not is_manager and not is_own_account:
        raise HTTPException(status_code=403, detail="Cannot modify other users")
    
    # Only managers can change roles
    if update_data.role and not is_manager:
        raise HTTPException(status_code=403, detail="Only managers can change roles")
    
    # Get user
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check company isolation
    if user.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Cannot modify users from other companies")
    
    # Build update dict
    update_dict = {}
    if update_data.full_name:
        update_dict["full_name"] = update_data.full_name
    if update_data.email:
        # Check if email is already taken
        existing = await db.users.find_one({"email": update_data.email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        update_dict["email"] = update_data.email
    if update_data.role and is_manager:
        if update_data.role not in ROLE_PERMISSIONS:
            raise HTTPException(status_code=400, detail="Invalid role")
        update_dict["role"] = update_data.role
    
    # Update user
    if update_dict:
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_dict}
        )
    
    # Get updated user
    updated_user = await db.users.find_one({"id": user_id})
    # Handle password field mapping
    if 'password' in updated_user and 'password_hash' not in updated_user:
        updated_user['password_hash'] = updated_user.pop('password')
    from models.user import User
    return user_to_response(User(**updated_user))


from pydantic import BaseModel as PydanticBaseModel
from typing import List as TypeList

class PermissionsUpdateRequest(PydanticBaseModel):
    permissions: TypeList[str]


@router.put("/{user_id}/permissions")
async def update_user_permissions_endpoint(
    user_id: str,
    permissions_data: PermissionsUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a user's permissions (requires manager role)"""
    # Check if current user has permission to manage users
    is_manager = current_user.get("role") in ['General Manager', 'CEO', 'Board Chairman', 'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة']
    if not is_manager:
        raise HTTPException(status_code=403, detail="Only managers can update permissions")
    
    # Get the user to update
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check company isolation - manager can only update users in their company
    if user.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Cannot modify users from other companies")
    
    # Validate permissions
    valid_permission_ids = ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 
                           'projects', 'analytics', 'settings', 'users', 'approvals']
    
    for perm in permissions_data.permissions:
        if perm not in valid_permission_ids:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {perm}")
    
    # Update permissions
    from datetime import datetime
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "permissions": permissions_data.permissions,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {
        "user_id": user_id,
        "full_name": user.get("full_name"),
        "permissions": permissions_data.permissions,
        "message": "Permissions updated successfully"
    }


