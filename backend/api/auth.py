from fastapi import APIRouter, HTTPException, Depends, Header
from motor.motor_asyncio import AsyncIOMotorClient
from models.user import UserCreate, UserLogin, Token, User, UserResponse, UserPermissionsUpdate, ALL_PERMISSIONS
from models.company import CompanyCreate, CompanyResponse
from services.auth_service import create_access_token, verify_token
from services.user_service import (
    create_user, 
    authenticate_user, 
    get_user_by_email,
    get_user_by_id,
    user_to_response,
    update_user_permissions,
    get_default_permissions_for_role
)
from services.company_service import create_company, get_company_by_email
import os
import asyncio
import resend
from typing import Optional, List
from dotenv import load_dotenv

load_dotenv()

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Get database instance
from database import get_database
db = get_database()

@router.post("/register-company", response_model=Token)
async def register_company(
    company_data: CompanyCreate,
    user_email: str,
    user_password: str,
    user_full_name: str
):
    """
    Register a new company along with the first user (General Manager).
    This is called after free trial registration.
    """
    # Check if company already exists
    existing_company = await get_company_by_email(db, company_data.contact_email)
    if existing_company:
        raise HTTPException(status_code=400, detail="Company with this email already exists")
    
    # Check if user already exists
    existing_user = await get_user_by_email(db, user_email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Create company
    company = await create_company(db, company_data)
    
    # Create first user as Board Chairman (مؤسس الشركة)
    user_data = UserCreate(
        email=user_email,
        password=user_password,
        full_name=user_full_name,
        company_id=company.id,
        role="رئيس مجلس الإدارة"
    )
    
    user = await create_user(db, user_data, user_password)
    
    # Create access token
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "company_id": user.company_id,
            "role": user.role
        }
    )
    
    user_response = user_to_response(user)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login with email and password"""
    user = await authenticate_user(db, credentials.email, credentials.password)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
    
    # Create access token
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "company_id": user.company_id,
            "role": user.role
        }
    )
    
    user_response = user_to_response(user)
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_response
    )


@router.post("/reset-password")
async def reset_password(request_data: dict):
    """
    Reset user password and send new password via email
    """
    email = request_data.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Check if user exists
    user = await get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User with this email not found")
    
    # Generate new temporary password
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    new_password = ''.join(secrets.choice(alphabet) for _ in range(10))
    
    # Hash new password
    import bcrypt
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update password in database (update both fields for compatibility)
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "password": hashed_password.decode('utf-8'),
            "password_hash": hashed_password.decode('utf-8')
        }}
    )
    
    # Send email with new password
    try:
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; text-align: center;">DataLife Account</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; text-align: center;">إعادة تعيين كلمة المرور</h2>
                <p style="color: #666; font-size: 16px; text-align: center;">
                    تم إعادة تعيين كلمة المرور الخاصة بك بنجاح.
                </p>
                <div style="background: #fff; border: 2px dashed #667eea; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                    <p style="color: #333; margin: 0 0 10px 0; font-size: 14px;">كلمة المرور الجديدة:</p>
                    <p style="color: #667eea; font-size: 24px; font-weight: bold; margin: 0; letter-spacing: 2px;">{new_password}</p>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center;">
                    يرجى تغيير كلمة المرور بعد تسجيل الدخول للحفاظ على أمان حسابك.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #999; font-size: 11px; text-align: center;">
                    هذا البريد الإلكتروني تم إرساله تلقائياً من DataLife Account
                </p>
            </div>
        </div>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": "إعادة تعيين كلمة المرور - DataLife Account",
            "html": html_content
        }
        
        # Send email asynchronously
        await asyncio.to_thread(resend.Emails.send, params)
        
        return {
            "message": "Password reset successful. New password sent to your email.",
            "message_ar": "تم إعادة تعيين كلمة المرور بنجاح. تم إرسال كلمة المرور الجديدة إلى بريدك الإلكتروني.",
            "email": email
        }
    except Exception as e:
        # If email fails, still return success but with the password (fallback)
        return {
            "message": "Password reset successful",
            "message_ar": "تم إعادة تعيين كلمة المرور بنجاح",
            "new_password": new_password,
            "email": email,
            "email_error": str(e)
        }

@router.post("/set-password")
async def set_user_password(request_data: dict):
    """Set a specific password for a user (admin use only)"""
    email = request_data.get("email")
    new_password = request_data.get("password")
    admin_key = request_data.get("admin_key")
    
    # Admin key from environment variable
    expected_admin_key = os.environ.get("ADMIN_KEY", "")
    if not expected_admin_key or admin_key != expected_admin_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")
    
    if not email or not new_password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Get user
    user = await get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash new password
    import bcrypt
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update password in database
    await db.users.update_one(
        {"id": user.id},
        {"$set": {
            "password": hashed_password.decode('utf-8'),
            "password_hash": hashed_password.decode('utf-8')
        }}
    )
    
    return {
        "message": "Password updated successfully",
        "email": email
    }

@router.post("/change-password")
async def change_password(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Change user's own password (requires current password)"""
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
    
    current_password = request_data.get("current_password")
    new_password = request_data.get("new_password")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password are required")
    
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Get user from database
    user_id = payload.get("user_id")
    user_doc = await db.users.find_one({"id": user_id})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    stored_password = user_doc.get("password") or user_doc.get("password_hash")
    if not stored_password:
        raise HTTPException(status_code=400, detail="User has no password set")
    
    import bcrypt
    if not bcrypt.checkpw(current_password.encode('utf-8'), stored_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Hash new password
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
    
    # Update password
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "password": hashed_password.decode('utf-8'),
            "password_hash": hashed_password.decode('utf-8')
        }}
    )
    
    return {
        "message": "Password changed successfully",
        "message_ar": "تم تغيير كلمة المرور بنجاح"
    }

@router.get("/verify", response_model=UserResponse)
async def verify_user_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token and return user info"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    # Extract token from "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get user from database
    from services.user_service import get_user_by_id
    user = await get_user_by_id(db, payload.get("user_id"))
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
    
    return user_to_response(user)


@router.post("/debug-user")
async def debug_user(request_data: dict):
    """Debug endpoint to check user status in database"""
    email = request_data.get("email")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Get raw user data
    user_data = await db.users.find_one({"email": email}, {"_id": 0})
    
    if not user_data:
        return {"found": False, "message": "User not found"}
    
    # Check password fields
    has_password = "password" in user_data
    has_password_hash = "password_hash" in user_data
    
    password_info = {}
    if has_password:
        pwd = user_data.get("password", "")
        password_info["password_field"] = {
            "exists": True,
            "length": len(pwd),
            "starts_with_$2": pwd.startswith("$2") if pwd else False
        }
    if has_password_hash:
        pwd_hash = user_data.get("password_hash", "")
        password_info["password_hash_field"] = {
            "exists": True,
            "length": len(pwd_hash),
            "starts_with_$2": pwd_hash.startswith("$2") if pwd_hash else False
        }
    
    return {
        "found": True,
        "email": email,
        "is_active": user_data.get("is_active"),
        "role": user_data.get("role"),
        "company_id": user_data.get("company_id"),
        "password_info": password_info
    }


@router.post("/force-reset-password")
async def force_reset_password(request_data: dict):
    """Force reset password for a user - sets a known password"""
    email = request_data.get("email")
    new_password = request_data.get("new_password", "DataLife@2024")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    
    # Check if user exists
    user_data = await db.users.find_one({"email": email})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Hash new password using auth_service function
    from services.auth_service import hash_password
    hashed_password = hash_password(new_password)
    
    # Update password in database - set both fields
    result = await db.users.update_one(
        {"email": email},
        {
            "$set": {
                "password_hash": hashed_password
            },
            "$unset": {
                "password": ""
            }
        }
    )
    
    return {
        "success": result.modified_count > 0,
        "message": f"Password reset for {email}",
        "new_password": new_password
    }


# Admin roles that can manage permissions
ADMIN_ROLES = ['General Manager', 'CEO', 'Board Chairman', 'رئيس مجلس الإدارة', 'المدير التنفيذي', 'مدير عام']

@router.get("/permissions/all")
async def get_all_permissions():
    """Get list of all available permissions/modules"""
    return {"permissions": ALL_PERMISSIONS}

@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get permissions for a specific user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get target user
    target_user = await get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get permissions, defaulting to role-based if not set
    permissions = target_user.permissions if target_user.permissions else get_default_permissions_for_role(target_user.role)
    
    return {
        "user_id": user_id,
        "role": target_user.role,
        "permissions": permissions,
        "all_permissions": ALL_PERMISSIONS
    }

@router.put("/users/{user_id}/permissions")
async def update_permissions(
    user_id: str,
    permissions_data: UserPermissionsUpdate,
    authorization: Optional[str] = Header(None)
):
    """Update permissions for a specific user (Admin only)"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get current user (the one making the request)
    current_user = await get_user_by_id(db, payload.get("user_id"))
    if not current_user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Check if current user has admin privileges
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=403, 
            detail="Only General Manager, CEO, or Board Chairman can modify permissions"
        )
    
    # Get target user
    target_user = await get_user_by_id(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")
    
    # Check if they're in the same company
    if current_user.company_id != target_user.company_id:
        raise HTTPException(status_code=403, detail="Cannot modify users from other companies")
    
    # Cannot modify permissions of other admins (only self or lower roles)
    if target_user.role in ADMIN_ROLES and target_user.id != current_user.id:
        raise HTTPException(
            status_code=403, 
            detail="Cannot modify permissions of other administrators"
        )
    
    # Validate permissions
    valid_permission_ids = [p['id'] for p in ALL_PERMISSIONS]
    for perm in permissions_data.permissions:
        if perm not in valid_permission_ids:
            raise HTTPException(status_code=400, detail=f"Invalid permission: {perm}")
    
    # Update permissions
    updated_user = await update_user_permissions(db, user_id, permissions_data.permissions)
    if not updated_user:
        raise HTTPException(status_code=500, detail="Failed to update permissions")
    
    return {
        "success": True,
        "message": "Permissions updated successfully",
        "user_id": user_id,
        "permissions": permissions_data.permissions
    }


# ==========================================
# Super Admin Initialization
# ==========================================

@router.post("/init-super-admin")
async def initialize_super_admin(
    secret_key: str,
    email: str = "superadmin@datalife.com",
    password: str = "SuperAdmin@2024",
    full_name: str = "Super Admin"
):
    """
    Initialize Super Admin account for production.
    Protected by secret key.
    """
    import uuid
    from passlib.context import CryptContext
    from datetime import datetime, timezone
    
    # Verify secret key (use environment variable or hardcoded for now)
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    # Check if super admin already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        return {
            "success": False,
            "message": "Super Admin already exists",
            "email": email
        }
    
    # Hash password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password_hash = pwd_context.hash(password)
    
    # Create super admin
    super_admin = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": password_hash,
        "full_name": full_name,
        "company_id": None,  # Platform admin - not tied to any company
        "role": "Super Admin",
        "permissions": ALL_PERMISSIONS,
        "is_active": True,
        "is_platform_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(super_admin)
    
    return {
        "success": True,
        "message": "Super Admin created successfully",
        "email": email,
        "note": "Please change the password after first login"
    }


@router.get("/check-super-admin")
async def check_super_admin_exists():
    """Check if Super Admin exists in the database"""
    super_admin = await db.users.find_one({"role": "Super Admin"})
    
    if super_admin:
        return {
            "exists": True,
            "email": super_admin.get("email"),
            "is_active": super_admin.get("is_active", True)
        }
    
    return {
        "exists": False,
        "message": "No Super Admin found. Use /api/auth/init-super-admin to create one."
    }


@router.post("/reset-super-admin-password")
async def reset_super_admin_password(
    secret_key: str,
    new_password: str = "SuperAdmin@2024"
):
    """
    Reset Super Admin password.
    Protected by secret key.
    """
    from passlib.context import CryptContext
    from datetime import datetime, timezone
    
    # Verify secret key
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret key")
    
    # Find super admin
    super_admin = await db.users.find_one({"role": "Super Admin"})
    if not super_admin:
        raise HTTPException(status_code=404, detail="Super Admin not found")
    
    # Hash new password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password_hash = pwd_context.hash(new_password)
    
    # Update password
    await db.users.update_one(
        {"role": "Super Admin"},
        {"$set": {
            "password_hash": password_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "Super Admin password has been reset successfully",
        "email": super_admin.get("email"),
        "note": "You can now login with the new password"
    }


@router.post("/admin-reset-password")
async def admin_reset_password(
    email: str,
    secret_key: str,
    new_password: str
):
    """
    Reset any admin user's password.
    Protected by secret key.
    """
    from passlib.context import CryptContext
    from datetime import datetime, timezone
    
    # Verify secret key
    INIT_SECRET = os.environ.get("SUPER_ADMIN_INIT_SECRET", "DataLife@SuperAdmin@Init@2026")
    
    if secret_key != INIT_SECRET:
        raise HTTPException(status_code=403, detail="المفتاح السري غير صحيح / Invalid secret key")
    
    # Find user by email
    user = await db.users.find_one({"email": email.lower().strip()})
    if not user:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود / User not found")
    
    # Validate password length
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="كلمة المرور يجب أن تكون 6 أحرف على الأقل / Password must be at least 6 characters")
    
    # Hash new password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password_hash = pwd_context.hash(new_password)
    
    # Update password
    await db.users.update_one(
        {"email": email.lower().strip()},
        {"$set": {
            "password_hash": password_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "message": "تم تغيير كلمة المرور بنجاح / Password changed successfully",
        "email": email
    }


# ==========================================
# OTP-based Password Reset (Email Verification)
# ==========================================

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import string
from datetime import datetime, timezone, timedelta

# In-memory OTP storage (in production, use Redis or database)
otp_storage = {}

def generate_otp(length=6):
    """Generate a random OTP"""
    return ''.join(random.choices(string.digits, k=length))

async def send_otp_email(email: str, otp: str, user_name: str = ""):
    """Send OTP via SMTP"""
    smtp_host = os.environ.get("SMTP_HOST", "gtxm1001.siteground.biz")
    smtp_port = int(os.environ.get("SMTP_PORT", 465))
    smtp_email = os.environ.get("SMTP_EMAIL", "info@datalifeai.com")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")
    
    if not smtp_password:
        raise Exception("SMTP password not configured")
    
    # Create message
    msg = MIMEMultipart('alternative')
    msg['Subject'] = 'رمز إعادة تعيين كلمة المرور - DataLife Account'
    msg['From'] = f"DataLife Account <{smtp_email}>"
    msg['To'] = email
    
    # HTML email content
    html_content = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #f59e0b, #ea580c); padding: 30px; text-align: center; }}
            .header h1 {{ color: white; margin: 0; font-size: 24px; }}
            .content {{ padding: 40px 30px; text-align: center; }}
            .otp-box {{ background: linear-gradient(135deg, #1e293b, #334155); color: white; font-size: 36px; font-weight: bold; letter-spacing: 10px; padding: 20px 40px; border-radius: 12px; display: inline-block; margin: 20px 0; }}
            .message {{ color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }}
            .warning {{ color: #dc2626; font-size: 14px; margin-top: 20px; }}
            .footer {{ background-color: #f8fafc; padding: 20px; text-align: center; color: #64748b; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 DataLife Account</h1>
            </div>
            <div class="content">
                <p class="message">مرحباً{' ' + user_name if user_name else ''},</p>
                <p class="message">لقد طلبت إعادة تعيين كلمة المرور الخاصة بك. استخدم الرمز التالي:</p>
                <div class="otp-box">{otp}</div>
                <p class="message">هذا الرمز صالح لمدة <strong>10 دقائق</strong> فقط.</p>
                <p class="warning">⚠️ إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.</p>
            </div>
            <div class="footer">
                <p>© 2026 DataLife AI Services - جميع الحقوق محفوظة</p>
                <p>هذا البريد تم إرساله تلقائياً، يرجى عدم الرد عليه</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Plain text version
    text_content = f"""
    مرحباً {user_name},
    
    رمز إعادة تعيين كلمة المرور الخاص بك هو: {otp}
    
    هذا الرمز صالح لمدة 10 دقائق فقط.
    
    إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.
    
    DataLife Account
    """
    
    msg.attach(MIMEText(text_content, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_content, 'html', 'utf-8'))
    
    # Send email
    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_email, smtp_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"SMTP Error: {e}")
        raise e


@router.post("/request-password-reset")
async def request_password_reset(email: str):
    """
    Request password reset - sends OTP to email
    """
    email = email.lower().strip()
    
    # Check if user exists
    user = await db.users.find_one({"email": email})
    if not user:
        # Return success anyway to prevent email enumeration
        return {
            "success": True,
            "message": "إذا كان البريد الإلكتروني مسجلاً، سيتم إرسال رمز التحقق"
        }
    
    # Generate OTP
    otp = generate_otp()
    
    # Store OTP with expiration (10 minutes)
    otp_storage[email] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
        "attempts": 0
    }
    
    # Send OTP via email
    try:
        await send_otp_email(email, otp, user.get("full_name", ""))
        return {
            "success": True,
            "message": "تم إرسال رمز التحقق إلى بريدك الإلكتروني"
        }
    except Exception as e:
        print(f"Failed to send OTP email: {e}")
        raise HTTPException(
            status_code=500, 
            detail="فشل في إرسال البريد الإلكتروني. يرجى المحاولة لاحقاً"
        )


@router.post("/verify-otp-reset-password")
async def verify_otp_and_reset_password(
    email: str,
    otp: str,
    new_password: str
):
    """
    Verify OTP and reset password
    """
    from passlib.context import CryptContext
    
    email = email.lower().strip()
    
    # Check if OTP exists
    if email not in otp_storage:
        raise HTTPException(status_code=400, detail="لم يتم طلب إعادة تعيين كلمة المرور لهذا البريد")
    
    stored_data = otp_storage[email]
    
    # Check if OTP is expired
    if datetime.now(timezone.utc) > stored_data["expires_at"]:
        del otp_storage[email]
        raise HTTPException(status_code=400, detail="انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد")
    
    # Check attempts (max 5)
    if stored_data["attempts"] >= 5:
        del otp_storage[email]
        raise HTTPException(status_code=400, detail="تم تجاوز عدد المحاولات المسموح بها. يرجى طلب رمز جديد")
    
    # Verify OTP
    if stored_data["otp"] != otp:
        otp_storage[email]["attempts"] += 1
        remaining = 5 - otp_storage[email]["attempts"]
        raise HTTPException(
            status_code=400, 
            detail=f"رمز التحقق غير صحيح. المحاولات المتبقية: {remaining}"
        )
    
    # OTP is valid - reset password
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    password_hash = pwd_context.hash(new_password)
    
    # Update password in database
    result = await db.users.update_one(
        {"email": email},
        {"$set": {
            "password_hash": password_hash,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    
    # Clear OTP
    del otp_storage[email]
    
    return {
        "success": True,
        "message": "تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول"
    }


@router.get("/check-otp-status")
async def check_otp_status(email: str):
    """
    Check if there's a pending OTP for this email
    """
    email = email.lower().strip()
    
    if email not in otp_storage:
        return {"has_pending_otp": False}
    
    stored_data = otp_storage[email]
    
    # Check if expired
    if datetime.now(timezone.utc) > stored_data["expires_at"]:
        del otp_storage[email]
        return {"has_pending_otp": False}
    
    remaining_seconds = (stored_data["expires_at"] - datetime.now(timezone.utc)).total_seconds()
    
    return {
        "has_pending_otp": True,
        "remaining_seconds": int(remaining_seconds),
        "attempts_remaining": 5 - stored_data["attempts"]
    }
