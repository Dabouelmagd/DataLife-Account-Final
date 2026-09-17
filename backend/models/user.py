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
    # ── صلاحيات العملاء (Company Users) ───────────────────────────
    {'id': 'dashboard',       'name_en': 'Dashboard',          'name_ar': 'لوحة التحكم',          'category': 'client_core',    'scope': 'client'},
    {'id': 'hr',              'name_en': 'Human Resources',    'name_ar': 'الموارد البشرية',       'category': 'client_dept',    'scope': 'client'},
    {'id': 'hr_admin',        'name_en': 'HR Admin',           'name_ar': 'HR إداري',              'category': 'client_dept',    'scope': 'client'},
    {'id': 'hr_financial',    'name_en': 'HR Financial',       'name_ar': 'HR مالي',               'category': 'client_dept',    'scope': 'client'},
    {'id': 'financial',       'name_en': 'Financial',          'name_ar': 'الإدارة المالية',       'category': 'client_dept',    'scope': 'client'},
    {'id': 'invoices',        'name_en': 'Invoices',           'name_ar': 'الفواتير الإلكترونية',  'category': 'client_dept',    'scope': 'client'},
    {'id': 'purchases',       'name_en': 'Purchases',          'name_ar': 'المشتريات',             'category': 'client_dept',    'scope': 'client'},
    {'id': 'projects',        'name_en': 'Projects',           'name_ar': 'المشاريع',              'category': 'client_dept',    'scope': 'client'},
    {'id': 'inventory',       'name_en': 'Inventory',          'name_ar': 'المخزون',               'category': 'client_dept',    'scope': 'client'},
    {'id': 'analytics',       'name_en': 'Analytics',          'name_ar': 'التحليلات',             'category': 'client_reports', 'scope': 'client'},
    {'id': 'reports',         'name_en': 'Reports',            'name_ar': 'التقارير',              'category': 'client_reports', 'scope': 'client'},
    {'id': 'approvals',       'name_en': 'Approvals',          'name_ar': 'الموافقات',             'category': 'client_core',    'scope': 'client'},
    {'id': 'settings',        'name_en': 'Settings',           'name_ar': 'الإعدادات',             'category': 'client_admin',   'scope': 'client'},
    {'id': 'users',           'name_en': 'User Management',    'name_ar': 'إدارة المستخدمين',     'category': 'client_admin',   'scope': 'client'},
    {'id': 'billing',         'name_en': 'Billing',            'name_ar': 'الفواتير والمدفوعات',   'category': 'client_admin',   'scope': 'client'},
    {'id': 'ess',             'name_en': 'Self-Service Portal','name_ar': 'بوابة الخدمة الذاتية', 'category': 'client_ess',     'scope': 'client'},

    # ── صلاحيات المنصة (Super Admin / DataLife) ────────────────────
    {'id': 'platform_companies',   'name_en': 'Manage Companies',  'name_ar': 'إدارة الشركات',        'category': 'platform_mgmt', 'scope': 'platform'},
    {'id': 'platform_users',       'name_en': 'Manage All Users',  'name_ar': 'إدارة كل المستخدمين',  'category': 'platform_mgmt', 'scope': 'platform'},
    {'id': 'platform_subscriptions','name_en': 'Subscriptions',    'name_ar': 'إدارة الاشتراكات',     'category': 'platform_mgmt', 'scope': 'platform'},
    {'id': 'platform_payments',    'name_en': 'Payments',          'name_ar': 'المدفوعات والمعاملات',  'category': 'platform_mgmt', 'scope': 'platform'},
    {'id': 'platform_codes',       'name_en': 'Activation Codes',  'name_ar': 'أكواد التفعيل',        'category': 'platform_mgmt', 'scope': 'platform'},
    {'id': 'platform_monitor',     'name_en': 'System Monitor',    'name_ar': 'مراقبة النظام',        'category': 'platform_sys',  'scope': 'platform'},
    {'id': 'platform_audit',       'name_en': 'Audit Log',         'name_ar': 'سجل التدقيق',          'category': 'platform_sys',  'scope': 'platform'},
    {'id': 'platform_messages',    'name_en': 'Messages',          'name_ar': 'الرسائل والإشعارات',   'category': 'platform_sys',  'scope': 'platform'},
    {'id': 'admin-dashboard',      'name_en': 'Platform Dashboard','name_ar': 'لوحة إدارة المنصة',   'category': 'platform_sys',  'scope': 'platform'},
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