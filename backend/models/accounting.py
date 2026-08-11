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
    """تصنيفات الحسابات - Egyptian Standard Chart of Accounts"""
    # الأصول - Assets
    HEADER = "header"                         # حساب رئيسي تجميعي (View/Header)
    CURRENT_ASSET = "current_asset"           # أصول متداولة
    FIXED_ASSET = "fixed_asset"               # أصول ثابتة
    NON_CURRENT_ASSET = "non_current_asset"   # أصول غير متداولة
    CASH = "cash"                             # نقدية
    BANK = "bank"                             # بنوك
    RECEIVABLE = "receivable"                 # ذمم مدينة
    PREPAYMENT = "prepayment"                 # مدفوعات مقدمة
    INVENTORY = "inventory"                   # مخزون
    # الخصوم - Liabilities
    CURRENT_LIABILITY = "current_liability"   # خصوم متداولة
    NON_CURRENT_LIABILITY = "non_current_liability"  # خصوم غير متداولة
    LONG_TERM_LIABILITY = "long_term_liability"  # خصوم طويلة الأجل
    PAYABLE = "payable"                       # ذمم دائنة
    # حقوق الملكية - Equity
    CAPITAL = "capital"                       # رأس المال
    EQUITY = "equity"                         # حقوق ملكية
    RETAINED_EARNINGS = "retained_earnings"   # أرباح محتجزة
    RESERVES = "reserves"                     # احتياطيات ومخصصات
    # الإيرادات - Revenue
    OPERATING_REVENUE = "operating_revenue"   # إيرادات تشغيلية
    INCOME = "income"                         # إيرادات
    OTHER_REVENUE = "other_revenue"           # إيرادات أخرى
    CONTRA_INCOME = "contra_income"           # إيرادات مقابلة (مردودات)
    # المصروفات - Expenses
    OPERATING_EXPENSE = "operating_expense"   # مصروفات تشغيلية
    ADMIN_EXPENSE = "admin_expense"           # مصروفات إدارية
    SELLING_EXPENSE = "selling_expense"       # مصروفات بيعية وتسويقية
    FINANCE_COST = "finance_cost"             # مصروفات تمويلية وفوائد
    COGS = "cogs"                             # تكلفة البضاعة المباعة / تكلفة الأعمال
    OTHER_EXPENSE = "other_expense"           # مصروفات أخرى
    EXPENSE = "expense"                       # مصروفات عامة


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
    """سطر في القيد اليومي — Enterprise Double-Entry Ledger"""
    account_id: str                          # معرف الحساب
    account_code: str                        # رقم الحساب
    account_name: str                        # اسم الحساب
    debit: float = 0.0                       # مدين (DECIMAL 18,4)
    credit: float = 0.0                      # دائن (DECIMAL 18,4)
    description: Optional[str] = None        # وصف السطر
    # ── Enterprise Fields ──
    cost_center_id: Optional[str] = None     # مركز التكلفة
    project_id: Optional[str] = None         # المشروع (للمقاولات والهندسة)
    partner_type: Optional[str] = None       # customer | vendor | employee | doctor
    partner_id: Optional[str] = None         # معرف الطرف الخارجي
    currency_id: Optional[str] = "EGP"      # رمز العملة
    exchange_rate: float = 1.0               # سعر الصرف مقابل العملة الأساسية
    debit_foreign: float = 0.0               # المدين بالعملة الأجنبية
    credit_foreign: float = 0.0             # الدائن بالعملة الأجنبية


class JournalEntryStatus(str, Enum):
    """حالة القيد"""
    DRAFT = "draft"           # مسودة
    POSTED = "posted"         # مرحّل
    REVERSED = "reversed"     # معكوس


class JournalEntry(BaseModel):
    """القيد اليومي — Immutable Double-Entry Ledger (Enterprise Grade)"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    entry_number: int               # رقم القيد التسلسلي (AUTO-INCREMENT per company)
    entry_date: str                 # تاريخ القيد (accounting date)
    posting_date: Optional[str] = None  # تاريخ الترحيل الفعلي
    reference: Optional[str] = None     # مرجع المستند (رقم فاتورة، إيصال)
    description: str                    # وصف القيد
    lines: List[JournalEntryLine]       # سطور القيد (يجب أن يتوازن)
    total_debit: float = 0.0            # إجمالي المدين (محسوب تلقائياً)
    total_credit: float = 0.0           # إجمالي الدائن (محسوب تلقائياً)
    status: JournalEntryStatus = JournalEntryStatus.DRAFT
    # ── Source Document Linking ──
    source_document_type: Optional[str] = "manual"   # manual|payroll|invoice|claim|medical_service
    source_document_id: Optional[str] = None          # ID المستند المصدر
    # ── Immutability & Reversal ──
    is_reversal: bool = False            # هل هذا قيد عكسي؟
    reversal_of: Optional[str] = None   # ID القيد الأصلي المعكوس
    reversal_date: Optional[str] = None
    # ── Approval Workflow ──
    created_by: str                     # منشئ القيد
    approved_by: Optional[str] = None  # معتمد القيد
    approved_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    posted_at: Optional[str] = None
    posted_by: Optional[str] = None
    # ── Audit Trail ──
    narration: Optional[str] = None     # شرح تفصيلي للقيد
    fiscal_year: Optional[str] = None   # السنة المالية
    period: Optional[str] = None        # الفترة المحاسبية (YYYY-MM)


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
# Default Chart of Accounts - Egyptian Standard
# دليل الحسابات المصري القياسي
# ==========================================

DEFAULT_ACCOUNTS = [
    # ==========================================
    # 1 - الأصول (Assets)
    # ==========================================
    {"code": "1", "name": "الأصول", "name_en": "Assets", "type": AccountType.ASSET, "category": AccountCategory.HEADER, "is_system": True, "is_header": True},
    
    # 11 - الأصول غير المتداولة (Non-Current Assets)
    {"code": "11", "name": "الأصول غير المتداولة", "name_en": "Non-Current Assets", "type": AccountType.ASSET, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "1"},
    
    # 111 - الأراضي
    {"code": "111", "name": "الأراضي", "name_en": "Land", "type": AccountType.ASSET, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "11"},
    {"code": "11101", "name": "أراضي منشآت ومباني", "name_en": "Building Land", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "111"},
    {"code": "11102", "name": "أراضي زراعية ومحاجر", "name_en": "Agricultural Land & Quarries", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "111"},
    
    # 112-116 - الأصول الثابتة الأخرى
    {"code": "112", "name": "مباني وإنشاءات", "name_en": "Buildings & Constructions", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "11"},
    {"code": "113", "name": "سيارات ووسائل نقل", "name_en": "Vehicles & Transportation", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "11"},
    {"code": "114", "name": "آلات ومعدات إنتاج", "name_en": "Machinery & Production Equipment", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "11"},
    {"code": "115", "name": "أثاث وتجهيزات مكتبية", "name_en": "Furniture & Office Equipment", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "11"},
    {"code": "116", "name": "أجهزة كمبيوتر وبرمجيات", "name_en": "Computer & Software", "type": AccountType.ASSET, "category": AccountCategory.FIXED_ASSET, "parent_code": "11"},
    
    # 12 - المخزون (Inventory)
    {"code": "12", "name": "المخزون", "name_en": "Inventory", "type": AccountType.ASSET, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "1"},
    {"code": "121", "name": "مخزون الخامات والمواد الأولية", "name_en": "Raw Materials Inventory", "type": AccountType.ASSET, "category": AccountCategory.INVENTORY, "parent_code": "12"},
    {"code": "122", "name": "مخزون الإنتاج التام", "name_en": "Finished Goods Inventory", "type": AccountType.ASSET, "category": AccountCategory.INVENTORY, "parent_code": "12"},
    {"code": "123", "name": "مخزون بضاعة بالطريق / اعتمادات", "name_en": "Goods in Transit / LC", "type": AccountType.ASSET, "category": AccountCategory.INVENTORY, "parent_code": "12"},
    {"code": "124", "name": "مخزون قطع غيار ومهمات", "name_en": "Spare Parts & Supplies Inventory", "type": AccountType.ASSET, "category": AccountCategory.INVENTORY, "parent_code": "12"},
    
    # 13 - المدينون والأرصدة المدينة (Receivables)
    {"code": "13", "name": "المدينون والأرصدة المدينة الأخرى", "name_en": "Receivables & Other Debit Balances", "type": AccountType.ASSET, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "1"},
    {"code": "131", "name": "العملاء", "name_en": "Accounts Receivable (Customers)", "type": AccountType.ASSET, "category": AccountCategory.RECEIVABLE, "parent_code": "13", "is_system": True},
    {"code": "132", "name": "أوراق القبض", "name_en": "Notes Receivable", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13"},
    {"code": "133", "name": "عهد الموظفين النقدية", "name_en": "Employee Cash Custody", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13"},
    {"code": "134", "name": "سلف الموظفين", "name_en": "Employee Advances", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13"},
    {"code": "135", "name": "مصروفات مدفوعة مقدماً", "name_en": "Prepaid Expenses", "type": AccountType.ASSET, "category": AccountCategory.PREPAYMENT, "parent_code": "13"},
    {"code": "136", "name": "إيرادات مستحقة", "name_en": "Accrued Revenue", "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13"},
    
    # 14 - مشروعات تحت التنفيذ
    {"code": "14", "name": "مشروعات تحت التنفيذ", "name_en": "Projects Under Construction", "type": AccountType.ASSET, "category": AccountCategory.NON_CURRENT_ASSET, "parent_code": "1"},
    
    # 16 - النقدية وما في حكمها (Cash & Cash Equivalents)
    {"code": "16", "name": "النقدية وما في حكمها", "name_en": "Cash & Cash Equivalents", "type": AccountType.ASSET, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "1"},
    {"code": "161", "name": "النقدية بالصندوق (الخزينة الرئيسية)", "name_en": "Cash on Hand (Main Treasury)", "type": AccountType.ASSET, "category": AccountCategory.CASH, "parent_code": "16", "is_system": True},
    {"code": "162", "name": "النقدية بالبنوك الجارية", "name_en": "Bank Current Accounts", "type": AccountType.ASSET, "category": AccountCategory.BANK, "parent_code": "16", "is_system": True},
    
    # ==========================================
    # 2 - الالتزامات وحقوق الملكية (Liabilities & Equity)
    # ==========================================
    {"code": "2", "name": "الالتزامات وحقوق الملكية", "name_en": "Liabilities & Equity", "type": AccountType.LIABILITY, "category": AccountCategory.HEADER, "is_system": True, "is_header": True},
    
    # 21 - حقوق الملكية (Equity)
    {"code": "21", "name": "حقوق الملكية", "name_en": "Equity", "type": AccountType.EQUITY, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "2"},
    {"code": "211", "name": "رأس المال المدفوع", "name_en": "Paid-up Capital", "type": AccountType.EQUITY, "category": AccountCategory.CAPITAL, "parent_code": "21", "is_system": True},
    {"code": "212", "name": "جاري الشركاء", "name_en": "Partners' Current Account", "type": AccountType.EQUITY, "category": AccountCategory.EQUITY, "parent_code": "21"},
    {"code": "213", "name": "الأرباح (الخسائر) المرحلة", "name_en": "Retained Earnings (Losses)", "type": AccountType.EQUITY, "category": AccountCategory.RETAINED_EARNINGS, "parent_code": "21", "is_system": True},
    
    # 22 - المخصصات والاحتياطيات (Provisions & Reserves)
    {"code": "22", "name": "المخصصات والاحتياطيات", "name_en": "Provisions & Reserves", "type": AccountType.LIABILITY, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "2"},
    {"code": "221", "name": "احتياطي قانوني وعام", "name_en": "Legal & General Reserve", "type": AccountType.EQUITY, "category": AccountCategory.RESERVES, "parent_code": "22"},
    
    # 222 - مجمعات الإهلاك (Accumulated Depreciation)
    {"code": "222", "name": "مجمعات الإهلاك", "name_en": "Accumulated Depreciation", "type": AccountType.CONTRA_ASSET, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "22"},
    {"code": "22201", "name": "مجمع إهلاك مباني وإنشاءات", "name_en": "Accumulated Depreciation - Buildings", "type": AccountType.CONTRA_ASSET, "category": AccountCategory.NON_CURRENT_LIABILITY, "parent_code": "222"},
    {"code": "22202", "name": "مجمع إهلاك آلات ومعدات", "name_en": "Accumulated Depreciation - Machinery", "type": AccountType.CONTRA_ASSET, "category": AccountCategory.NON_CURRENT_LIABILITY, "parent_code": "222"},
    {"code": "22203", "name": "مجمع إهلاك سيارات ووسائل نقل", "name_en": "Accumulated Depreciation - Vehicles", "type": AccountType.CONTRA_ASSET, "category": AccountCategory.NON_CURRENT_LIABILITY, "parent_code": "222"},
    {"code": "22204", "name": "مجمع إهلاك أثاث وأجهزة", "name_en": "Accumulated Depreciation - Furniture & Equipment", "type": AccountType.CONTRA_ASSET, "category": AccountCategory.NON_CURRENT_LIABILITY, "parent_code": "222"},
    
    {"code": "223", "name": "مخصص مكافأة نهاية الخدمة", "name_en": "End of Service Provision", "type": AccountType.LIABILITY, "category": AccountCategory.NON_CURRENT_LIABILITY, "parent_code": "22"},
    
    # 24 - القروض والتسهيلات (Loans & Facilities)
    {"code": "24", "name": "القروض والتسهيلات", "name_en": "Loans & Facilities", "type": AccountType.LIABILITY, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "2"},
    {"code": "241", "name": "قروض بنكية طويلة الأجل", "name_en": "Long-term Bank Loans", "type": AccountType.LIABILITY, "category": AccountCategory.NON_CURRENT_LIABILITY, "parent_code": "24"},
    {"code": "242", "name": "تسهيلات ائتمانية وسحب على المكشوف", "name_en": "Credit Facilities & Overdraft", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "24"},
    
    # 25 - الدائنون والأرصدة الدائنة (Payables)
    {"code": "25", "name": "الدائنون والأرصدة الدائنة الأخرى", "name_en": "Payables & Other Credit Balances", "type": AccountType.LIABILITY, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "2"},
    {"code": "251", "name": "الموردون", "name_en": "Accounts Payable (Suppliers)", "type": AccountType.LIABILITY, "category": AccountCategory.PAYABLE, "parent_code": "25", "is_system": True},
    {"code": "252", "name": "أوراق الدفع", "name_en": "Notes Payable", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25"},
    {"code": "253", "name": "مصروفات مستحقة (أجور، إيجارات)", "name_en": "Accrued Expenses (Wages, Rent)", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25"},
    {"code": "254", "name": "الضرائب المستحقة (قيمة مضافة، خصم)", "name_en": "Taxes Payable (VAT, Withholding)", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    {"code": "255", "name": "التأمينات الاجتماعية المستحقة", "name_en": "Social Insurance Payable", "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    
    # ==========================================
    # 3 - المصروفات (Expenses)
    # ==========================================
    {"code": "3", "name": "المصروفات", "name_en": "Expenses", "type": AccountType.EXPENSE, "category": AccountCategory.HEADER, "is_system": True, "is_header": True},
    
    # 31 - تكلفة النشاط / تكلفة المبيعات (COGS)
    {"code": "31", "name": "تكلفة النشاط / تكلفة المبيعات", "name_en": "Cost of Sales / COGS", "type": AccountType.EXPENSE, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "3"},
    {"code": "311", "name": "تكلفة الخامات والمواد المستهلكة", "name_en": "Cost of Raw Materials Consumed", "type": AccountType.EXPENSE, "category": AccountCategory.COGS, "parent_code": "31"},
    {"code": "312", "name": "أجور تشغيلية مباشرة", "name_en": "Direct Labor Cost", "type": AccountType.EXPENSE, "category": AccountCategory.COGS, "parent_code": "31"},
    {"code": "313", "name": "مصروفات وإهلاكات تشغيلية", "name_en": "Operating Expenses & Depreciation", "type": AccountType.EXPENSE, "category": AccountCategory.COGS, "parent_code": "31"},
    
    # 33 - المصروفات الإدارية والعمومية (G&A Expenses)
    {"code": "33", "name": "المصروفات الإدارية والعمومية", "name_en": "General & Administrative Expenses", "type": AccountType.EXPENSE, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "3"},
    {"code": "331", "name": "رواتب وأجور إدارية", "name_en": "Administrative Salaries & Wages", "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33", "is_system": True},
    {"code": "332", "name": "مصروفات خدمية (كهرباء، مياه، بريد)", "name_en": "Utilities Expense (Electricity, Water, Mail)", "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},
    {"code": "333", "name": "إهلاكات الأصول الإدارية", "name_en": "Administrative Assets Depreciation", "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},
    {"code": "334", "name": "مصروفات وعمولات بنكية", "name_en": "Bank Charges & Commissions", "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},
    
    # 34 - المصروفات البيعية والتسويقية (Selling & Marketing Expenses)
    {"code": "34", "name": "المصروفات البيعية والتسويقية", "name_en": "Selling & Marketing Expenses", "type": AccountType.EXPENSE, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "3"},
    {"code": "341", "name": "دعاية وإعلان", "name_en": "Advertising & Promotion", "type": AccountType.EXPENSE, "category": AccountCategory.SELLING_EXPENSE, "parent_code": "34"},
    {"code": "342", "name": "عمولات بيعية", "name_en": "Sales Commissions", "type": AccountType.EXPENSE, "category": AccountCategory.SELLING_EXPENSE, "parent_code": "34"},
    {"code": "343", "name": "مصاريف نقل المبيعات", "name_en": "Sales Freight Expenses", "type": AccountType.EXPENSE, "category": AccountCategory.SELLING_EXPENSE, "parent_code": "34"},
    
    # ==========================================
    # 4 - الإيرادات (Revenue)
    # ==========================================
    {"code": "4", "name": "الإيرادات", "name_en": "Revenue", "type": AccountType.REVENUE, "category": AccountCategory.HEADER, "is_system": True, "is_header": True},
    
    # 41 - إيرادات النشاط الأساسي (Operating Revenue)
    {"code": "41", "name": "إيرادات النشاط الأساسي", "name_en": "Operating Revenue", "type": AccountType.REVENUE, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "4"},
    {"code": "411", "name": "إيراد مبيعات بضائع", "name_en": "Sales Revenue - Goods", "type": AccountType.REVENUE, "category": AccountCategory.INCOME, "parent_code": "41", "is_system": True},
    {"code": "412", "name": "إيراد تقديم خدمات / تشغيل للغير", "name_en": "Service Revenue / Contract Work", "type": AccountType.REVENUE, "category": AccountCategory.INCOME, "parent_code": "41"},
    {"code": "413", "name": "مردودات ومسموحات المبيعات", "name_en": "Sales Returns & Allowances", "type": AccountType.EXPENSE, "category": AccountCategory.CONTRA_INCOME, "parent_code": "41"},
    
    # 42 - الإيرادات الأخرى والتحويلية (Other Revenue)
    {"code": "42", "name": "الإيرادات الأخرى والتحويلية", "name_en": "Other & Miscellaneous Revenue", "type": AccountType.REVENUE, "category": AccountCategory.HEADER, "is_header": True, "parent_code": "4"},
    {"code": "421", "name": "أرباح رأسمالية", "name_en": "Capital Gains", "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE, "parent_code": "42"},
    {"code": "422", "name": "إيرادات فوائد دائنة", "name_en": "Interest Income", "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE, "parent_code": "42"},
    {"code": "423", "name": "إيرادات متنوعة أخرى", "name_en": "Other Miscellaneous Revenue", "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE, "parent_code": "42"},

    # ==========================================
    # حسابات مكملة — الدليل المصري الكامل
    # ==========================================

    # الاستثمارات قصيرة الأجل
    {"code": "15", "name": "الاستثمارات قصيرة الأجل", "name_en": "Short-term Investments",
     "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "is_header": True, "parent_code": "1"},
    {"code": "151", "name": "أوراق مالية متداولة", "name_en": "Marketable Securities",
     "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "15"},
    {"code": "163", "name": "شيكات برسم التحصيل", "name_en": "Checks Under Collection",
     "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "16"},

    # حقوق الملكية — إضافية
    {"code": "214", "name": "الأرباح الموزعة", "name_en": "Dividends Paid",
     "type": AccountType.EQUITY, "category": AccountCategory.EQUITY, "parent_code": "21"},
    {"code": "215", "name": "احتياطي إعادة التقييم", "name_en": "Revaluation Reserve",
     "type": AccountType.EQUITY, "category": AccountCategory.EQUITY, "parent_code": "21"},

    # الدائنون — إضافية
    {"code": "23", "name": "الدائنون قصيرو الأجل", "name_en": "Short-term Creditors",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "is_header": True, "parent_code": "2"},
    {"code": "231", "name": "دائنون تجاريون", "name_en": "Trade Creditors",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "23"},
    {"code": "256", "name": "أرباح موزعة مستحقة", "name_en": "Dividends Payable",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25"},
    {"code": "257", "name": "إيرادات مقدمة (دفعات مقدمة من عملاء)", "name_en": "Deferred Revenue",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25"},

    # المصروفات التمويلية
    {"code": "32", "name": "المصروفات التمويلية", "name_en": "Finance Costs",
     "type": AccountType.EXPENSE, "category": AccountCategory.FINANCE_COST, "is_header": True, "parent_code": "3"},
    {"code": "321", "name": "فوائد وعمولات بنكية مدينة", "name_en": "Bank Interest & Charges",
     "type": AccountType.EXPENSE, "category": AccountCategory.FINANCE_COST, "parent_code": "32"},

    # مصروفات إدارية إضافية
    {"code": "335", "name": "إيجارات ومدفوعات إيجار", "name_en": "Rent & Lease Payments",
     "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},
    {"code": "336", "name": "مصروفات قانونية ومهنية", "name_en": "Legal & Professional Fees",
     "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},
    {"code": "337", "name": "بدل سفر وانتقالات", "name_en": "Travel & Transportation",
     "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},
    {"code": "338", "name": "مصروفات تأمين", "name_en": "Insurance Expenses",
     "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33"},

    # مصروفات بيعية إضافية
    {"code": "344", "name": "مصروفات عينات وعروض تجارية", "name_en": "Samples & Promotion",
     "type": AccountType.EXPENSE, "category": AccountCategory.SELLING_EXPENSE, "parent_code": "34"},

    # إيرادات مشاريع
    {"code": "43", "name": "إيرادات مشاريع وتشغيل", "name_en": "Projects & Operations Revenue",
     "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE, "is_header": True, "parent_code": "4"},
    {"code": "431", "name": "إيرادات مقاولات وتشغيل للغير", "name_en": "Contracting Revenue",
     "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE, "parent_code": "43"},
    {"code": "432", "name": "أرباح فروق عملة أجنبية", "name_en": "Foreign Exchange Gains",
     "type": AccountType.REVENUE, "category": AccountCategory.OTHER_REVENUE, "parent_code": "43"},
    # ══════════════════════════════════════════════════
    # حسابات القانون المصري — قانون 148/2019 و91/2005
    # ══════════════════════════════════════════════════

    # ── أصول: ضرائب مدخلات وضمانات ──
    {"code": "137", "name": "ضريبة المدخلات (VAT قابلة للاسترداد)", "name_en": "VAT Input (Recoverable)",
     "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13", "is_system": True},
    {"code": "138", "name": "ضريبة الخصم والتحصيل المحتجزة (1%/3%)", "name_en": "Withholding Tax Retained by Others",
     "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13", "is_system": True},
    {"code": "141", "name": "أصول ضمان محتجزة لدى العملاء (Retention)", "name_en": "Retention Receivable",
     "type": AccountType.ASSET, "category": AccountCategory.CURRENT_ASSET, "parent_code": "13"},

    # ── خصوم: صناديق واستقطاعات إجبارية ──
    {"code": "258", "name": "صندوق إعانة الطوارئ للعمال مستحق (1%)", "name_en": "Emergency Workers Fund Payable (1%)",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    {"code": "259", "name": "صندوق تكريم الشهداء والمفقودين (0.05%)", "name_en": "Martyrs Fund Payable (0.05%)",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    {"code": "260", "name": "ضريبة القيمة المضافة المخرجات (VAT Output)", "name_en": "VAT Output (Payable)",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    {"code": "261", "name": "ضريبة الخصم والتحصيل المستقطعة", "name_en": "Withholding Tax Payable (1%/3%/5%)",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    {"code": "262", "name": "المساهمة التكافلية — التأمين الصحي الشامل (0.25%)", "name_en": "UHI Solidarity Contribution Payable (0.25%)",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25", "is_system": True},
    {"code": "263", "name": "ضمان حسن التنفيذ محتجز — مقاولو الباطن", "name_en": "Retention Payable — Subcontractors",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25"},
    {"code": "264", "name": "أمانات أطباء استشاريين مستحقة", "name_en": "Consultant Doctors Fees Payable",
     "type": AccountType.LIABILITY, "category": AccountCategory.CURRENT_LIABILITY, "parent_code": "25"},

    # ── تكاليف: قطاع الإنشاءات والمقاولات ──
    {"code": "315", "name": "تكلفة مقاولي الباطن", "name_en": "Subcontractor Costs",
     "type": AccountType.EXPENSE, "category": AccountCategory.COGS, "parent_code": "31"},
    {"code": "316", "name": "تكاليف إنشاءات — مواد ومستلزمات الموقع", "name_en": "Construction — Site Materials",
     "type": AccountType.EXPENSE, "category": AccountCategory.COGS, "parent_code": "31"},
    {"code": "317", "name": "تكاليف إنشاءات — أجور عمال الموقع", "name_en": "Construction — Site Labor",
     "type": AccountType.EXPENSE, "category": AccountCategory.COGS, "parent_code": "31"},

    # ── مصروفات: الصناديق والمساهمات الإجبارية ──
    {"code": "339", "name": "مصروفات صندوق إعانة الطوارئ (1% من أجر الاشتراك)", "name_en": "Emergency Workers Fund Expense (1%)",
     "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33", "is_system": True},
    {"code": "340", "name": "مصروفات التأمين الصحي الشامل — حصة الشركة (0.25%)", "name_en": "UHI Solidarity Contribution Expense (0.25%)",
     "type": AccountType.EXPENSE, "category": AccountCategory.ADMIN_EXPENSE, "parent_code": "33", "is_system": True},

    # ── إيرادات: قطاعات متخصصة ──
    {"code": "414", "name": "إيرادات مقاولات وإنشاءات (مستخلصات)", "name_en": "Construction & Contracting Revenue (Progress Claims)",
     "type": AccountType.REVENUE, "category": AccountCategory.OPERATING_REVENUE, "parent_code": "41"},
    {"code": "415", "name": "إيرادات الخدمات الطبية", "name_en": "Medical Services Revenue",
     "type": AccountType.REVENUE, "category": AccountCategory.OPERATING_REVENUE, "parent_code": "41"},
    {"code": "416", "name": "إيرادات استشارات هندسية ومهنية", "name_en": "Engineering & Professional Consulting Revenue",
     "type": AccountType.REVENUE, "category": AccountCategory.OPERATING_REVENUE, "parent_code": "41"},
]
