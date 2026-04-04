"""
Payroll Integration Models
نماذج الرواتب المتكاملة مع المحاسبة
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class PayrollStatus(str, Enum):
    """حالة مسير الرواتب"""
    DRAFT = "draft"
    CALCULATED = "calculated"
    APPROVED = "approved"
    PAID = "paid"
    CANCELLED = "cancelled"


class AllowanceType(str, Enum):
    """أنواع البدلات"""
    HOUSING = "housing"                 # بدل سكن
    TRANSPORTATION = "transportation"   # بدل انتقال
    PHONE = "phone"                     # بدل هاتف
    MEAL = "meal"                       # بدل وجبات
    OVERTIME = "overtime"               # عمل إضافي
    BONUS = "bonus"                     # مكافأة
    COMMISSION = "commission"           # عمولة
    OTHER = "other"                     # أخرى


class DeductionType(str, Enum):
    """أنواع الخصومات"""
    SOCIAL_INSURANCE = "social_insurance"   # تأمينات اجتماعية
    INCOME_TAX = "income_tax"               # ضريبة كسب العمل
    LOAN = "loan"                           # سُلفة
    ADVANCE = "advance"                     # سلفة مقدمة
    ABSENCE = "absence"                     # خصم غياب
    LATE = "late"                           # خصم تأخير
    PENALTY = "penalty"                     # جزاء/غرامة
    OTHER = "other"                         # أخرى


class LoanStatus(str, Enum):
    """حالة السُلفة"""
    PENDING = "pending"
    APPROVED = "approved"
    ACTIVE = "active"
    PAID = "paid"
    REJECTED = "rejected"


# ==========================================
# Employee Loan (السُلف)
# ==========================================

class EmployeeLoan(BaseModel):
    """سُلفة موظف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    
    loan_number: str
    loan_date: str
    amount: float
    installments: int                   # عدد الأقساط
    installment_amount: float           # قيمة القسط
    paid_amount: float = 0.0            # المبلغ المسدد
    remaining_amount: float = 0.0       # المتبقي
    
    start_month: str                    # شهر بداية الخصم
    status: LoanStatus = LoanStatus.PENDING
    
    reason: Optional[str] = None
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


# ==========================================
# Payroll Item (بند الراتب)
# ==========================================

class PayrollAllowance(BaseModel):
    """بدل في الراتب"""
    allowance_type: AllowanceType
    name: str
    name_en: Optional[str] = None
    amount: float
    is_taxable: bool = True             # خاضع للضريبة
    account_id: Optional[str] = None    # حساب المصروف


class PayrollDeduction(BaseModel):
    """خصم من الراتب"""
    deduction_type: DeductionType
    name: str
    name_en: Optional[str] = None
    amount: float
    reference_id: Optional[str] = None  # مرجع (مثل رقم السلفة)
    account_id: Optional[str] = None    # حساب الخصم


# ==========================================
# Employee Payroll (راتب الموظف)
# ==========================================

class EmployeePayroll(BaseModel):
    """راتب موظف شهري"""
    employee_id: str
    employee_name: str
    department: Optional[str] = None
    position: Optional[str] = None
    
    # الراتب الأساسي
    basic_salary: float = 0.0
    
    # البدلات
    allowances: List[PayrollAllowance] = []
    total_allowances: float = 0.0
    
    # الخصومات
    deductions: List[PayrollDeduction] = []
    total_deductions: float = 0.0
    
    # إجمالي الراتب
    gross_salary: float = 0.0           # الراتب الإجمالي (الأساسي + البدلات)
    net_salary: float = 0.0             # صافي الراتب (بعد الخصومات)
    
    # أيام العمل
    working_days: int = 30
    actual_days: int = 30
    absence_days: int = 0
    overtime_hours: float = 0.0
    
    notes: Optional[str] = None


# ==========================================
# Payroll Run (مسير الرواتب)
# ==========================================

class PayrollRun(BaseModel):
    """مسير الرواتب الشهري"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    payroll_number: str
    month: str                          # الشهر (YYYY-MM)
    year: int
    month_number: int
    
    status: PayrollStatus = PayrollStatus.DRAFT
    
    # الموظفين
    employees: List[EmployeePayroll] = []
    total_employees: int = 0
    
    # الإجماليات
    total_basic_salary: float = 0.0
    total_allowances: float = 0.0
    total_gross_salary: float = 0.0
    total_deductions: float = 0.0
    total_net_salary: float = 0.0
    
    # تفاصيل الخصومات
    total_social_insurance: float = 0.0
    total_income_tax: float = 0.0
    total_loans: float = 0.0
    total_other_deductions: float = 0.0
    
    # القيد المحاسبي
    journal_entry_id: Optional[str] = None
    journal_entry_number: Optional[str] = None
    
    # طريقة الدفع
    payment_method: str = "bank_transfer"  # bank_transfer, cash, check
    payment_date: Optional[str] = None
    bank_account_id: Optional[str] = None
    
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    calculated_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None


# ==========================================
# End of Service (نهاية الخدمة)
# ==========================================

class EndOfServiceStatus(str, Enum):
    PENDING = "pending"
    CALCULATED = "calculated"
    APPROVED = "approved"
    PAID = "paid"


class EndOfService(BaseModel):
    """تسوية نهاية خدمة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    employee_id: str
    employee_name: str
    
    settlement_number: str
    settlement_date: str
    
    # معلومات الخدمة
    hire_date: str
    end_date: str
    years_of_service: float
    months_of_service: int
    
    # الراتب
    last_basic_salary: float
    last_gross_salary: float
    
    # المستحقات
    end_of_service_amount: float = 0.0  # مكافأة نهاية الخدمة
    remaining_vacation_days: int = 0
    vacation_compensation: float = 0.0   # بدل إجازات متبقية
    other_entitlements: float = 0.0      # مستحقات أخرى
    total_entitlements: float = 0.0
    
    # المستقطعات
    pending_loans: float = 0.0           # سُلف مستحقة
    other_deductions: float = 0.0
    total_deductions: float = 0.0
    
    # صافي التسوية
    net_settlement: float = 0.0
    
    status: EndOfServiceStatus = EndOfServiceStatus.PENDING
    
    journal_entry_id: Optional[str] = None
    
    termination_reason: Optional[str] = None
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


# ==========================================
# Payroll Settings (إعدادات الرواتب)
# ==========================================

class PayrollSettings(BaseModel):
    """إعدادات الرواتب"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # نسب التأمينات
    employee_social_insurance_rate: float = 11.0     # نسبة التأمينات على الموظف
    company_social_insurance_rate: float = 18.75    # نسبة التأمينات على الشركة
    
    # حدود التأمينات
    social_insurance_min_wage: float = 1400.0       # الحد الأدنى للأجر التأميني
    social_insurance_max_wage: float = 12600.0      # الحد الأقصى للأجر التأميني
    
    # ضريبة كسب العمل (شرائح)
    income_tax_brackets: List[dict] = [
        {"from": 0, "to": 15000, "rate": 0},
        {"from": 15000, "to": 30000, "rate": 2.5},
        {"from": 30000, "to": 45000, "rate": 10},
        {"from": 45000, "to": 60000, "rate": 15},
        {"from": 60000, "to": 200000, "rate": 20},
        {"from": 200000, "to": 400000, "rate": 22.5},
        {"from": 400000, "to": 999999999, "rate": 25}
    ]
    
    # الإعفاء الضريبي الشخصي
    personal_exemption: float = 15000.0
    
    # معدل الساعة الإضافية
    overtime_rate: float = 1.5                      # 150% من الساعة العادية
    overtime_rate_holiday: float = 2.0              # 200% في العطلات
    
    # مكافأة نهاية الخدمة
    eos_rate_first_5_years: float = 0.5             # نصف شهر عن كل سنة
    eos_rate_after_5_years: float = 1.0             # شهر كامل بعد 5 سنوات
    
    # الحسابات المحاسبية
    salaries_expense_account: Optional[str] = None      # حساب مصروف الرواتب
    allowances_expense_account: Optional[str] = None    # حساب مصروف البدلات
    social_insurance_expense_account: Optional[str] = None  # تأمينات حصة الشركة
    social_insurance_payable_account: Optional[str] = None  # تأمينات مستحقة
    income_tax_payable_account: Optional[str] = None    # ضريبة مستحقة
    salaries_payable_account: Optional[str] = None      # رواتب مستحقة
    bank_account: Optional[str] = None                  # الحساب البنكي
    loans_receivable_account: Optional[str] = None      # سُلف مستحقة
    eos_provision_account: Optional[str] = None         # مخصص نهاية الخدمة
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)
