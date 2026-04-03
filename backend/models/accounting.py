"""
نظام المحاسبة الاحترافي
Professional Accounting System

يتبع معايير المحاسبة:
- الأصول والمصروفات والمسحوبات: تزيد بالمدين، تنقص بالدائن
- الخصوم وحقوق الملكية والإيرادات: تزيد بالدائن، تنقص بالمدين
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class AccountType(str, Enum):
    """أنواع الحسابات المحاسبية"""
    ASSET = "asset"                    # الأصول
    LIABILITY = "liability"            # الخصوم
    EQUITY = "equity"                  # حقوق الملكية
    REVENUE = "revenue"                # الإيرادات
    EXPENSE = "expense"                # المصروفات
    CONTRA_ASSET = "contra_asset"      # الأصول المقابلة (مثل مجمع الإهلاك)
    CONTRA_LIABILITY = "contra_liability"
    CONTRA_EQUITY = "contra_equity"


class AccountCategory(str, Enum):
    """تصنيفات الحسابات"""
    # الأصول
    CURRENT_ASSET = "current_asset"           # أصول متداولة
    FIXED_ASSET = "fixed_asset"               # أصول ثابتة
    # الخصوم
    CURRENT_LIABILITY = "current_liability"   # خصوم متداولة
    LONG_TERM_LIABILITY = "long_term_liability"  # خصوم طويلة الأجل
    # حقوق الملكية
    CAPITAL = "capital"                       # رأس المال
    RETAINED_EARNINGS = "retained_earnings"   # أرباح محتجزة
    # الإيرادات
    OPERATING_REVENUE = "operating_revenue"   # إيرادات تشغيلية
    OTHER_REVENUE = "other_revenue"           # إيرادات أخرى
    # المصروفات
    OPERATING_EXPENSE = "operating_expense"   # مصروفات تشغيلية
    ADMIN_EXPENSE = "admin_expense"           # مصروفات إدارية
    OTHER_EXPENSE = "other_expense"           # مصروفات أخرى


class ChartOfAccount(BaseModel):
    """دليل الحسابات - Chart of Accounts"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    account_code: str               # رقم الحساب (مثل 1001)
    account_name: str               # اسم الحساب
    account_name_en: Optional[str] = None  # الاسم بالإنجليزية
    account_type: AccountType       # نوع الحساب
    account_category: AccountCategory  # تصنيف الحساب
    parent_account_id: Optional[str] = None  # الحساب الأب (للحسابات الفرعية)
    is_active: bool = True
    is_system: bool = False         # حساب نظام لا يمكن حذفه
    opening_balance: float = 0.0    # الرصيد الافتتاحي
    current_balance: float = 0.0    # الرصيد الحالي
    description: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class JournalEntryLine(BaseModel):
    """سطر في القيد اليومي"""
    account_id: str                 # معرف الحساب
    account_code: str               # رقم الحساب
    account_name: str               # اسم الحساب
    debit: float = 0.0              # مدين
    credit: float = 0.0             # دائن
    description: Optional[str] = None  # وصف السطر


class JournalEntryStatus(str, Enum):
    """حالة القيد"""
    DRAFT = "draft"           # مسودة
    POSTED = "posted"         # مرحّل
    REVERSED = "reversed"     # معكوس


class JournalEntry(BaseModel):
    """القيد اليومي - Journal Entry"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    entry_number: int               # رقم القيد التسلسلي
    entry_date: str                 # تاريخ القيد
    reference: Optional[str] = None  # المرجع (رقم فاتورة، إيصال، إلخ)
    description: str                # وصف القيد
    lines: List[JournalEntryLine]   # سطور القيد
    total_debit: float = 0.0        # إجمالي المدين
    total_credit: float = 0.0       # إجمالي الدائن
    status: JournalEntryStatus = JournalEntryStatus.DRAFT
    created_by: str                 # معرف المستخدم
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    posted_at: Optional[str] = None
    posted_by: Optional[str] = None


class LedgerEntry(BaseModel):
    """قيد في دفتر الأستاذ - Ledger Entry"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    account_id: str
    journal_entry_id: str
    entry_date: str
    description: str
    debit: float = 0.0
    credit: float = 0.0
    balance: float = 0.0            # الرصيد بعد العملية
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class FiscalYear(BaseModel):
    """السنة المالية"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    name: str                       # اسم السنة المالية
    start_date: str
    end_date: str
    is_closed: bool = False
    is_current: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class FiscalPeriod(BaseModel):
    """الفترة المحاسبية (شهر)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    fiscal_year_id: str
    period_number: int              # رقم الفترة (1-12)
    name: str                       # اسم الفترة
    start_date: str
    end_date: str
    is_closed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==========================================
# Response Models
# ==========================================

class AccountResponse(BaseModel):
    id: str
    account_code: str
    account_name: str
    account_name_en: Optional[str]
    account_type: str
    account_category: str
    current_balance: float
    is_active: bool


class JournalEntryResponse(BaseModel):
    id: str
    entry_number: int
    entry_date: str
    reference: Optional[str]
    description: str
    lines: List[JournalEntryLine]
    total_debit: float
    total_credit: float
    status: str
    created_at: str


class TrialBalanceItem(BaseModel):
    """بند في ميزان المراجعة"""
    account_code: str
    account_name: str
    account_type: str
    debit: float = 0.0
    credit: float = 0.0


class IncomeStatementItem(BaseModel):
    """بند في قائمة الدخل"""
    account_code: str
    account_name: str
    amount: float


class BalanceSheetItem(BaseModel):
    """بند في الميزانية العمومية"""
    account_code: str
    account_name: str
    amount: float


# ==========================================
# Helper Functions
# ==========================================

def get_account_nature(account_type: AccountType) -> str:
    """
    تحديد طبيعة الحساب (مدين أو دائن)
    """
    debit_nature = [AccountType.ASSET, AccountType.EXPENSE, AccountType.CONTRA_LIABILITY, AccountType.CONTRA_EQUITY]
    if account_type in debit_nature:
        return "debit"
    return "credit"


def determine_journal_side(account_type: AccountType, action: str) -> str:
    """
    تحديد الجانب الصحيح من قيد اليومية
    action: "increase" أو "decrease"
    """
    debit_accounts = [AccountType.ASSET, AccountType.EXPENSE, AccountType.CONTRA_LIABILITY, AccountType.CONTRA_EQUITY]
    
    if account_type in debit_accounts:
        return "debit" if action == "increase" else "credit"
    else:
        return "credit" if action == "increase" else "debit"


# ==========================================
# Default Chart of Accounts
# ==========================================

DEFAULT_ACCOUNTS = [
    # الأصول المتداولة (1000-1999)
    {"code": "1000", "name": "الأصول", "name_en": "Assets", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "is_system": True},
    {"code": "1100", "name": "النقدية والبنوك", "name_en": "Cash & Banks", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET},
    {"code": "1101", "name": "الصندوق (الخزينة)", "name_en": "Cash on Hand", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET},
    {"code": "1102", "name": "البنك", "name_en": "Bank Account", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET},
    {"code": "1200", "name": "العملاء (المدينون)", "name_en": "Accounts Receivable", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET},
    {"code": "1300", "name": "المخزون", "name_en": "Inventory", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET},
    {"code": "1400", "name": "مصروفات مدفوعة مقدماً", "name_en": "Prepaid Expenses", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET},
    
    # الأصول الثابتة (1500-1999)
    {"code": "1500", "name": "الأصول الثابتة", "name_en": "Fixed Assets", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET},
    {"code": "1501", "name": "الأراضي", "name_en": "Land", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET},
    {"code": "1502", "name": "المباني", "name_en": "Buildings", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET},
    {"code": "1503", "name": "السيارات", "name_en": "Vehicles", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET},
    {"code": "1504", "name": "الأثاث والمعدات", "name_en": "Furniture & Equipment", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET},
    {"code": "1505", "name": "أجهزة الكمبيوتر", "name_en": "Computer Equipment", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET},
    {"code": "1600", "name": "مجمع الإهلاك", "name_en": "Accumulated Depreciation", "type": AccountType.CONTRA_ASSET, "category": AccountCategory.FIXED_ASSET},
    
    # الخصوم المتداولة (2000-2499)
    {"code": "2000", "name": "الخصوم", "name_en": "Liabilities", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "is_system": True},
    {"code": "2100", "name": "الموردون (الدائنون)", "name_en": "Accounts Payable", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY},
    {"code": "2200", "name": "أوراق الدفع", "name_en": "Notes Payable", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY},
    {"code": "2300", "name": "الرواتب المستحقة", "name_en": "Salaries Payable", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY},
    {"code": "2400", "name": "الضرائب المستحقة", "name_en": "Taxes Payable", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY},
    {"code": "2500", "name": "إيرادات مقدمة", "name_en": "Unearned Revenue", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY},
    
    # الخصوم طويلة الأجل (2500-2999)
    {"code": "2600", "name": "القروض طويلة الأجل", "name_en": "Long-term Loans", "type": AccountType.LIABILITY, "category": AccountCategory.LONG_TERM_LIABILITY},
    
    # حقوق الملكية (3000-3999)
    {"code": "3000", "name": "حقوق الملكية", "name_en": "Equity", "type": AccountType.EQUITY, "category": AccountCategory.CAPITAL, "is_system": True},
    {"code": "3100", "name": "رأس المال", "name_en": "Capital", "type": AccountType.EQUITY, "category": AccountCategory.CAPITAL},
    {"code": "3200", "name": "الأرباح المحتجزة", "name_en": "Retained Earnings", "type": AccountType.EQUITY, "category": AccountCategory.RETAINED_EARNINGS},
    {"code": "3300", "name": "المسحوبات الشخصية", "name_en": "Drawings", "type": AccountType.CONTRA_EQUITY, "category": AccountCategory.CAPITAL},
    
    # الإيرادات (4000-4999)
    {"code": "4000", "name": "الإيرادات", "name_en": "Revenue", "type": AccountType.REVENUE, "category": AccountCategory.OPERATING_REVENUE, "is_system": True},
    {"code": "4100", "name": "إيرادات المبيعات", "name_en": "Sales Revenue", "type": AccountType.REVENUE, "category": AccountCategory.OPERATING_REVENUE},
    {"code": "4200", "name": "إيرادات الخدمات", "name_en": "Service Revenue", "type": AccountType.REVENUE, "category": AccountCategory.OPERATING_REVENUE},
    {"code": "4300", "name": "خصم مسموح به", "name_en": "Sales Discount", "type": AccountType.CONTRA_EQUITY, "category": AccountCategory.OPERATING_REVENUE},
    {"code": "4400", "name": "مردودات المبيعات", "name_en": "Sales Returns", "type": AccountType.CONTRA_EQUITY, "category": AccountCategory.OPERATING_REVENUE},
    {"code": "4900", "name": "إيرادات أخرى", "name_en": "Other Revenue", "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE},
    
    # المصروفات (5000-5999)
    {"code": "5000", "name": "المصروفات", "name_en": "Expenses", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE, "is_system": True},
    {"code": "5100", "name": "تكلفة البضاعة المباعة", "name_en": "Cost of Goods Sold", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5200", "name": "مصروفات الرواتب", "name_en": "Salaries Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5300", "name": "مصروفات الإيجار", "name_en": "Rent Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5400", "name": "مصروفات الكهرباء", "name_en": "Electricity Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5500", "name": "مصروفات المياه", "name_en": "Water Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5600", "name": "مصروفات الاتصالات", "name_en": "Telecommunications Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5700", "name": "مصروفات الصيانة", "name_en": "Maintenance Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5800", "name": "مصروفات الإهلاك", "name_en": "Depreciation Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OPERATING_EXPENSE},
    {"code": "5900", "name": "مصروفات التأمين", "name_en": "Insurance Expense", "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE},
    {"code": "5910", "name": "مصروفات إدارية", "name_en": "Administrative Expense", "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE},
    {"code": "5920", "name": "مصروفات بنكية", "name_en": "Bank Charges", "type": AccountType.EXPENSE, "category": AccountCategory.OTHER_EXPENSE},
    {"code": "5990", "name": "مصروفات متنوعة", "name_en": "Miscellaneous Expense", "type": AccountType.EXPENSE, "category": AccountCategory.OTHER_EXPENSE},
]
