from motor.motor_asyncio import AsyncIOMotorClient
from models.user import User, UserCreate, UserResponse
from services.auth_service import hash_password, verify_password
from typing import Optional, List

async def create_user(db: AsyncIOMotorClient, user_data: UserCreate, password: str) -> User:
    """Create a new user"""
    user_dict = user_data.dict(exclude={'password'})
    user_dict['password_hash'] = hash_password(password)
    
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
        return User(**user_data)
    return None

async def get_user_by_email(db: AsyncIOMotorClient, email: str) -> Optional[User]:
    """Get a user by email"""
    user_data = await db.users.find_one({"email": email})
    if user_data:
        # Handle both 'password' and 'password_hash' field names
        if 'password' in user_data and 'password_hash' not in user_data:
            user_data['password_hash'] = user_data.pop('password')
        return User(**user_data)
    return None

async def authenticate_user(db: AsyncIOMotorClient, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password"""
    # First, get raw user data to check password field format
    user_data = await db.users.find_one({"email": email})
    if not user_data:
        return None
    
    # Get the stored password (could be in different fields or formats)
    stored_password = user_data.get('password_hash') or user_data.get('password')
    
    if not stored_password:
        return None
    
    # Check if password is hashed or plain text
    password_valid = False
    
    # Try bcrypt verification first (for hashed passwords)
    try:
        password_valid = verify_password(password, stored_password)
    except Exception:
        pass
    
    # If bcrypt failed, check if it's plain text (legacy support)
    if not password_valid and stored_password == password:
        password_valid = True
        # Optionally: Update to hashed password for security
        # await db.users.update_one(
        #     {"email": email},
        #     {"$set": {"password_hash": hash_password(password)}, "$unset": {"password": ""}}
        # )
    
    if not password_valid:
        return None
    
    # Now get the user object
    user = await get_user_by_email(db, email)
    return user

async def get_users_by_company(db: AsyncIOMotorClient, company_id: str) -> List[User]:
    """Get all users in a company"""
    users = await db.users.find({"company_id": company_id}).to_list(length=1000)
    return [User(**user) for user in users]

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

def user_to_response(user: User) -> UserResponse:
    """Convert User model to UserResponse"""
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        company_id=user.company_id,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at if isinstance(user.created_at, str) else user.created_at.isoformat()
    )