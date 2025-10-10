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
        return User(**user_data)
    return None

async def get_user_by_email(db: AsyncIOMotorClient, email: str) -> Optional[User]:
    """Get a user by email"""
    user_data = await db.users.find_one({"email": email})
    if user_data:
        return User(**user_data)
    return None

async def authenticate_user(db: AsyncIOMotorClient, email: str, password: str) -> Optional[User]:
    """Authenticate a user with email and password"""
    user = await get_user_by_email(db, email)
    if not user:
        return None
    
    if not verify_password(password, user.password_hash):
        return None
    
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