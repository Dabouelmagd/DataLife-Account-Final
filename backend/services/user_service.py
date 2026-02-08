from motor.motor_asyncio import AsyncIOMotorClient
from models.user import User, UserCreate, UserResponse, DEFAULT_PERMISSIONS, ALL_PERMISSIONS
from services.auth_service import hash_password, verify_password
from typing import Optional, List

def get_default_permissions_for_role(role: str) -> List[str]:
    """Get default permissions for a given role"""
    return DEFAULT_PERMISSIONS.get(role, ['dashboard'])

async def create_user(db: AsyncIOMotorClient, user_data: UserCreate, password: str) -> User:
    """Create a new user"""
    user_dict = user_data.dict(exclude={'password'})
    user_dict['password_hash'] = hash_password(password)
    
    # Set default permissions based on role
    role = user_dict.get('role', 'Accountant')
    user_dict['permissions'] = get_default_permissions_for_role(role)
    
    user = User(**user_dict)
    await db.users.insert_one(user.dict())
    return user

async def get_user_by_id(db: AsyncIOMotorClient, user_id: str) -> Optional[User]:
    """Get a user by ID"""
    user_data = await db.users.find_one({"id": user_id})
    if user_data:
        # Handle both 'password' and 'password_hash' field names
        if 'password' in user_data and 'password_hash' not in user_data:
            user_data['password_hash'] = user_data.pop('password')
        # Ensure permissions field exists
        if 'permissions' not in user_data:
            user_data['permissions'] = get_default_permissions_for_role(user_data.get('role', 'Accountant'))
        return User(**user_data)
    return None

async def get_user_by_email(db: AsyncIOMotorClient, email: str) -> Optional[User]:
    """Get a user by email"""
    user_data = await db.users.find_one({"email": email})
    if user_data:
        # Handle both 'password' and 'password_hash' field names
        if 'password' in user_data and 'password_hash' not in user_data:
            user_data['password_hash'] = user_data.pop('password')
        # Ensure permissions field exists
        if 'permissions' not in user_data:
            user_data['permissions'] = get_default_permissions_for_role(user_data.get('role', 'Accountant'))
        return User(**user_data)
    return None

async def authenticate_user(db: AsyncIOMotorClient, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password"""
    import logging
    logger = logging.getLogger(__name__)
    
    # First, get raw user data to check password field format
    user_data = await db.users.find_one({"email": email})
    if not user_data:
        logger.warning(f"User not found: {email}")
        return None
    
    # Get the stored password - check both fields
    stored_password_hash = user_data.get('password_hash')
    stored_password = user_data.get('password')
    
    logger.info(f"Auth attempt for: {email}")
    logger.info(f"Has password_hash: {bool(stored_password_hash)}")
    logger.info(f"Has password: {bool(stored_password)}")
    
    # Try password_hash first, then password field
    passwords_to_try = []
    if stored_password_hash:
        passwords_to_try.append(stored_password_hash)
    if stored_password and stored_password != stored_password_hash:
        passwords_to_try.append(stored_password)
    
    if not passwords_to_try:
        logger.warning(f"No password stored for: {email}")
        return None
    
    password_valid = False
    
    for stored_pwd in passwords_to_try:
        # Try bcrypt verification
        try:
            if verify_password(password, stored_pwd):
                password_valid = True
                logger.info(f"Bcrypt verification successful for: {email}")
                break
        except Exception as e:
            logger.warning(f"Bcrypt verification failed: {e}")
        
        # Try plain text comparison (legacy)
        if stored_pwd == password:
            password_valid = True
            logger.info(f"Plain text match for: {email}")
            # Update to hashed password for security
            try:
                hashed = hash_password(password)
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"password_hash": hashed}}
                )
                logger.info(f"Updated password hash for: {email}")
            except Exception as e:
                logger.error(f"Failed to update password hash: {e}")
            break
    
    if not password_valid:
        logger.warning(f"Invalid password for: {email}")
        return None
    
    # Now get the user object
    user = await get_user_by_email(db, email)
    return user

async def get_users_by_company(db: AsyncIOMotorClient, company_id: str) -> List[User]:
    """Get all users in a company"""
    users_data = await db.users.find({"company_id": company_id}).to_list(length=1000)
    users = []
    for user_data in users_data:
        # Ensure permissions field exists
        if 'permissions' not in user_data:
            user_data['permissions'] = get_default_permissions_for_role(user_data.get('role', 'Accountant'))
        users.append(User(**user_data))
    return users

async def update_user_role(db: AsyncIOMotorClient, user_id: str, role: str) -> Optional[User]:
    """Update a user's role"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"role": role}}
    )
    
    if result.modified_count > 0:
        return await get_user_by_id(db, user_id)
    return None

async def deactivate_user(db: AsyncIOMotorClient, user_id: str) -> bool:
    """Deactivate a user"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": False}}
    )
    
    return result.modified_count > 0

async def update_user_permissions(db: AsyncIOMotorClient, user_id: str, permissions: List[str]) -> Optional[User]:
    """Update a user's permissions"""
    from datetime import datetime
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "permissions": permissions,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    if result.modified_count > 0 or result.matched_count > 0:
        return await get_user_by_id(db, user_id)
    return None

async def activate_user(db: AsyncIOMotorClient, user_id: str) -> bool:
    """Activate a user"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_active": True}}
    )
    return result.modified_count > 0

def user_to_response(user: User, subscription_code: str = None) -> UserResponse:
    """Convert User model to UserResponse"""
    # Get permissions, defaulting to role-based if not set
    permissions = user.permissions if user.permissions else get_default_permissions_for_role(user.role)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_id=user.company_id,
        role=user.role,
        permissions=permissions,
        profile_photo=getattr(user, 'profile_photo', None),
        is_active=user.is_active,
        created_at=user.created_at if isinstance(user.created_at, str) else user.created_at.isoformat(),
        subscription_code=subscription_code or user.company_id[:8].upper()  # First 8 chars of company_id as subscription code
    )