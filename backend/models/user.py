from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
import uuid

# Default permissions for each role
DEFAULT_PERMISSIONS = {
    # Top Management — full access
    'General Manager': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals', 'subscription', 'admin-dashboard'],
    'CEO': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals', 'subscription', 'admin-dashboard'],
    'Board Chairman': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals', 'subscription', 'admin-dashboard'],
    'رئيس مجلس الإدارة': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals', 'subscription', 'admin-dashboard'],
    'المدير التنفيذي': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals', 'subscription', 'admin-dashboard'],
    'مدير عام': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'projects', 'analytics', 'settings', 'users', 'approvals', 'subscription', 'admin-dashboard'],
    # Department Managers
    'Financial Manager': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'approvals'],
    'المدير المالي': ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 'approvals'],
    'Chief Accountant': ['dashboard', 'financial', 'invoices', 'purchases'],
    'رئيس الحسابات': ['dashboard', 'financial', 'invoices', 'purchases'],
    'HR Manager': ['dashboard', 'hr', 'approvals', 'users'],
    'مدير الموارد البشرية': ['dashboard', 'hr', 'approvals', 'users'],
    'Accountant': ['dashboard', 'financial', 'invoices'],
    'محاسب': ['dashboard', 'financial', 'invoices'],
    'Project Manager': ['dashboard', 'projects', 'approvals'],
    'مدير المشاريع': ['dashboard', 'projects', 'approvals'],
    # Employee — ESS only (no company data access)
    'Employee': ['ess'],
    'موظف': ['ess'],
}

# All available modules/permissions
ALL_PERMISSIONS = [
    {'id': 'dashboard',       'name_en': 'Dashboard',          'name_ar': 'لوحة التحكم',          'category': 'core'},
    {'id': 'hr',              'name_en': 'Human Resources',    'name_ar': 'الموارد البشرية',       'category': 'departments'},
    {'id': 'financial',       'name_en': 'Financial',          'name_ar': 'الإدارة المالية',       'category': 'departments'},
    {'id': 'invoices',        'name_en': 'Invoices',           'name_ar': 'الفواتير',              'category': 'departments'},
    {'id': 'purchases',       'name_en': 'Purchases',          'name_ar': 'المشتريات',             'category': 'departments'},
    {'id': 'projects',        'name_en': 'Projects',           'name_ar': 'المشاريع',              'category': 'departments'},
    {'id': 'analytics',       'name_en': 'Analytics',          'name_ar': 'التحليلات',             'category': 'reports'},
    {'id': 'settings',        'name_en': 'Settings',           'name_ar': 'الإعدادات',             'category': 'admin'},
    {'id': 'users',           'name_en': 'User Management',    'name_ar': 'إدارة المستخدمين',     'category': 'admin'},
    {'id': 'approvals',       'name_en': 'Approvals',          'name_ar': 'الموافقات',             'category': 'core'},
    {'id': 'subscription',    'name_en': 'Subscription',       'name_ar': 'الاشتراك والفواتير',    'category': 'admin'},
    {'id': 'admin-dashboard', 'name_en': 'Admin Dashboard',    'name_ar': 'لوحة الأدمن',          'category': 'admin'},
    # ESS — Employee Self-Service only (no company data)
    {'id': 'ess',             'name_en': 'Self-Service Portal','name_ar': 'بوابة الخدمة الذاتية', 'category': 'employee'},
]

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    full_name: str
    company_id: Optional[str] = None  # None for Platform Admin
    role: str  # General Manager, CEO (Chief Executive Officer), Board Chairman, Financial Manager, Chief Accountant, HR Manager, Accountant
    permissions: List[str] = Field(default_factory=list)  # List of permission IDs
    profile_photo: Optional[str] = None  # URL to profile photo
    is_active: bool = True
    is_platform_admin: bool = False  # True for Super Admin with no company
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
    company_id: Optional[str] = None  # None for Platform Admin
    role: str
    permissions: List[str] = []  # List of permission IDs
    profile_photo: Optional[str] = None  # URL to profile photo
    is_active: bool
    is_platform_admin: bool = False  # True for Super Admin
    created_at: str
    subscription_code: Optional[str] = None  # Subscription/Company code for display

class UserPermissionsUpdate(BaseModel):
    permissions: List[str]  # List of permission IDs to set

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse