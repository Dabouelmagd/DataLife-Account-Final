from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid

# Default permissions for each role
DEFAULT_PERMISSIONS = {
    'General Manager': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals'],
    'CEO': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals'],
    'Board Chairman': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals'],
    'رئيس مجلس الإدارة': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals'],
    'المدير التنفيذي': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals'],
    'مدير عام': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals'],
    'Financial Manager': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'approvals'],
    'Chief Accountant': ['dashboard', 'financial', 'invoices', 'purchases'],
    'HR Manager': ['dashboard', 'hr', 'approvals'],
    'Accountant': ['dashboard', 'financial', 'invoices'],
}

# All available modules/permissions
ALL_PERMISSIONS = [
    {'id': 'dashboard', 'name_en': 'Dashboard', 'name_ar': 'لوحة التحكم'},
    {'id': 'hr', 'name_en': 'Human Resources', 'name_ar': 'الموارد البشرية'},
    {'id': 'financial', 'name_en': 'Financial', 'name_ar': 'الإدارة المالية'},
    {'id': 'invoices', 'name_en': 'Invoices', 'name_ar': 'الفواتير'},
    {'id': 'purchases', 'name_en': 'Purchases', 'name_ar': 'المشتريات'},
    {'id': 'projects', 'name_en': 'Projects', 'name_ar': 'المشاريع'},
    {'id': 'analytics', 'name_en': 'Analytics', 'name_ar': 'التحليلات'},
    {'id': 'settings', 'name_en': 'Settings', 'name_ar': 'الإعدادات'},
    {'id': 'users', 'name_en': 'User Management', 'name_ar': 'إدارة المستخدمين'},
    {'id': 'approvals', 'name_en': 'Approvals', 'name_ar': 'الموافقات'},
]

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    full_name: str
    company_id: str
    role: str  # General Manager, CEO (Chief Executive Officer), Board Chairman, Financial Manager, Chief Accountant, HR Manager, Accountant
    permissions: List[str] = Field(default_factory=list)  # List of permission IDs
    profile_photo: Optional[str] = None  # URL to profile photo
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
    permissions: List[str] = []  # List of permission IDs
    is_active: bool
    created_at: str
    subscription_code: Optional[str] = None  # Subscription/Company code for display

class UserPermissionsUpdate(BaseModel):
    permissions: List[str]  # List of permission IDs to set

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse