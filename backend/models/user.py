from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    full_name: str
    company_id: str
    role: str  # General Manager, CEO (Chief Executive Officer), Board Chairman, Financial Manager, Chief Accountant, HR Manager, Accountant
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow().isoformat())

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_id: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    company_id: str
    role: str
    is_active: bool
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse