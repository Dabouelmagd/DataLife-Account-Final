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

from pydantic import BaseModel, EmailStr

class InviteEmployeeRequest(BaseModel):
    full_name: str
    email: str
    role: str = "موظف"
    permissions: List[str] = ["dashboard"]
    company_id: str = None

@router.post("/invite")
async def invite_employee(
    invite_data: InviteEmployeeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Invite a new employee to the company"""
    # Check if current user has permission to add users
    check_user_permission(current_user.get("role"), "create")
    
    # Check if user already exists
    existing_user = await get_user_by_email(db, invite_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="البريد الإلكتروني مسجل مسبقاً" if True else "User with this email already exists")
    
    # Validate role
    if invite_data.role not in ROLE_PERMISSIONS:
        # Add role to permissions if not exists (allow custom roles)
        pass
    
    # Generate temporary password
    import secrets
    import string
    import bcrypt
    from datetime import datetime
    import uuid
    
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))
    hashed = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
    
    # Create user
    user_id = str(uuid.uuid4())
    company_id = current_user.get("company_id")
    
    new_user = {
        "id": user_id,
        "email": invite_data.email,
        "full_name": invite_data.full_name,
        "password_hash": hashed.decode('utf-8'),
        "role": invite_data.role,
        "company_id": company_id,
        "is_active": True,
        "permissions": invite_data.permissions,
        "created_at": datetime.utcnow().isoformat(),
        "invited_by": current_user.get("user_id")
    }
    
    await db.users.insert_one(new_user)
    
    # Send invitation email
    try:
        # Get company name
        company = await db.companies.find_one({"id": company_id})
        company_name = company.get("name", "DataLife Account") if company else "DataLife Account"
        inviter_name = current_user.get("full_name", "المدير")
        
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; text-align: center;">🎉 دعوة للانضمام</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; text-align: center;">مرحباً {invite_data.full_name}!</h2>
                <p style="color: #666; font-size: 16px; text-align: center;">
                    تمت دعوتك للانضمام إلى <strong>{company_name}</strong> على منصة DataLife Account
                </p>
                <p style="color: #666; font-size: 14px; text-align: center;">
                    تمت الدعوة بواسطة: <strong>{inviter_name}</strong>
                </p>
                
                <div style="background: #fff; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #10b981; margin-top: 0; text-align: center;">بيانات الدخول</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666; width: 40%;">البريد الإلكتروني:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold;">{invite_data.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">كلمة المرور المؤقتة:</td>
                            <td style="padding: 10px; border-bottom: 1px solid #eee; color: #333; font-weight: bold; font-family: monospace; background: #f0f0f0; border-radius: 4px;">{temp_password}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; color: #666;">الدور الوظيفي:</td>
                            <td style="padding: 10px; color: #333; font-weight: bold;">{invite_data.role}</td>
                        </tr>
                    </table>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="https://datalifeaccount.com/login" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        تسجيل الدخول الآن
                    </a>
                </div>
                
                <p style="color: #ff6b6b; font-size: 14px; text-align: center; background: #fff0f0; padding: 10px; border-radius: 8px;">
                    ⚠️ يرجى تغيير كلمة المرور بعد تسجيل الدخول الأول
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    هذه الرسالة مرسلة من نظام DataLife Account<br>
                    إذا لم تكن تتوقع هذه الدعوة، يرجى تجاهل هذا البريد
                </p>
            </div>
        </div>
        """
        
        if resend.api_key:
            params = {
                "from": SENDER_EMAIL,
                "to": [invite_data.email],
                "subject": f"🎉 دعوة للانضمام إلى {company_name}",
                "html": html_content
            }
            
            await asyncio.to_thread(resend.Emails.send, params)
    except Exception as e:
        # User created but email failed - still return success
        pass
    
    return {
        "message": "تم إرسال الدعوة بنجاح",
        "user_id": user_id,
        "email": invite_data.email
    }

from fastapi import UploadFile, File
import shutil
import uuid as uuid_module
from datetime import datetime, timezone

@router.post("/upload-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload user profile photo"""
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="نوع الملف غير مدعوم. يرجى رفع صورة (JPEG, PNG, GIF, WEBP)")
    
    # Create uploads directory if not exists
    upload_dir = "/app/uploads/photos"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    unique_filename = f"{current_user.get('user_id')}_{uuid_module.uuid4().hex[:8]}.{file_ext}"
    file_path = os.path.join(upload_dir, unique_filename)
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"فشل حفظ الملف: {str(e)}")
    
    # Generate URL path
    photo_url = f"/uploads/photos/{unique_filename}"
    
    # Update user in database
    await db.users.update_one(
        {"id": current_user.get("user_id")},
        {"$set": {
            "profile_photo": photo_url,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "message": "تم رفع الصورة بنجاح",
        "photo_url": photo_url
    }

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


@router.get("/pending")
async def get_pending_users(current_user: dict = Depends(get_current_user)):
    """List users who joined via subscription code and await approval"""
    check_user_permission(current_user.get("role"), "view")

    company_id = current_user.get("company_id")
    pending = await db.users.find(
        {"company_id": company_id, "pending_approval": True},
        {"_id": 0, "password": 0, "password_hash": 0}
    ).to_list(length=1000)

    return pending


@router.post("/{user_id}/approve")
async def approve_pending_user(
    user_id: str,
    request_data: dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Approve a pending user and optionally set role + permissions."""
    check_user_permission(current_user.get("role"), "edit")

    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if user_doc.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Cannot manage users from other companies")
    if not user_doc.get("pending_approval"):
        raise HTTPException(status_code=400, detail="User is not pending approval")

    update_data = {
        "pending_approval": False,
        "is_active": True,
    }
    if request_data:
        if request_data.get("role") and request_data["role"] in ROLE_PERMISSIONS:
            update_data["role"] = request_data["role"]
        if isinstance(request_data.get("permissions"), list):
            update_data["permissions"] = request_data["permissions"]

    await db.users.update_one({"id": user_id}, {"$set": update_data})
    return {"message": "User approved", "user_id": user_id}


@router.post("/{user_id}/reject")
async def reject_pending_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject a pending user (deletes the join request)."""
    check_user_permission(current_user.get("role"), "delete")

    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    if user_doc.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Cannot manage users from other companies")
    if not user_doc.get("pending_approval"):
        raise HTTPException(status_code=400, detail="User is not pending approval")

    await db.users.delete_one({"id": user_id})
    return {"message": "Join request rejected"}


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
                           'projects', 'reports', 'analytics', 'inventory', 'settings', 'users', 'approvals']
    
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


