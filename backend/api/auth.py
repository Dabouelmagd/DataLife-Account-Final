from fastapi import APIRouter, HTTPException, Depends, Header
from motor.motor_asyncio import AsyncIOMotorClient
from models.user import UserCreate, UserLogin, Token, User, UserResponse
from models.company import CompanyCreate, CompanyResponse
from services.auth_service import create_access_token, verify_token
from services.user_service import (
    create_user, 
    authenticate_user, 
    get_user_by_email,
    user_to_response
)
from services.company_service import create_company, get_company_by_email
import os
import asyncio
import resend
from typing import Optional
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
    
    # Create first user as General Manager
    user_data = UserCreate(
        email=user_email,
        password=user_password,
        full_name=user_full_name,
        company_id=company.id,
        role="General Manager"
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


@router.post("/reset-password")
async def reset_password(request_data: dict):
    """
    Reset user password and return new temporary password
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
    
    # Update password in database
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"password": hashed_password.decode('utf-8')}}
    )
    
    # In production, you would send this via email
    # For now, we return it directly
    return {
        "message": "Password reset successful",
        "new_password": new_password,
        "email": email
    }

    )

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