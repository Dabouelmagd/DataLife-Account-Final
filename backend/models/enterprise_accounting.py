"""
Enterprise Accounting Models — Egyptian ERP Grade
Models for: Tax Brackets, Employee Insurance, Cost Centers,
            Progress Claims, Medical Services, ETA E-Invoice
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
import uuid
from datetime import datetime


# ══════════════════════════════════════════════
# 1. Dynamic Tax Brackets (payroll_tax_brackets)
# ══════════════════════════════════════════════
class TaxBracket(BaseModel):
    """شريحة ضريبية — قابلة للتعديل دون تغيير الكود"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: Optional[str] = None   # None = global default
    tax_year: int                       # السنة الضريبية
    bracket_order: int                  # ترتيب الشريحة
    range_min: float                    # الحد الأدنى للشريحة السنوية
    range_max: Optional[float] = None   # الحد الأقصى (None = لا نهاية)
    rate: float                         # النسبة % (مثال: 0.10 = 10%)
    bracket_discount: float = 0.0       # الخصم التراكمي: tax = income*rate - discount
    description: Optional[str] = None   # وصف الشريحة
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

# ══════════════════════════════════════════════════════════════════
# الشرائح الضريبية المصرية — قانون 91/2005 وتعديلاته 2023
# قابلة للتعديل عبر API دون تغيير الكود (No Hardcoding)
#
# طريقة حساب الخصم (bracket_discount):
#   الضريبة = الدخل السنوي × النسبة − الخصم
#   مثال: دخل 50,000 → ضريبة = 50,000 × 15% − 5,025 = 2,475
#
# Column: bracket_discount = (الحد الأقصى × النسبة) - الضريبة التراكمية
# This avoids iterating all brackets — O(1) lookup after finding the right bracket
# ══════════════════════════════════════════════════════════════════
DEFAULT_TAX_BRACKETS_2024 = [
    # order  range_min   range_max   rate    bracket_discount  description
    TaxBracket(tax_year=2024, bracket_order=1,
        range_min=0,       range_max=21000,
        rate=0.000, bracket_discount=0,
        description="معفاة — ما دون الإعفاء الضريبي الشخصي (21,000 ج.م)"),
    TaxBracket(tax_year=2024, bracket_order=2,
        range_min=21001,   range_max=30000,
        rate=0.025, bracket_discount=525,
        description="2.5% — الشريحة الأولى (21,001 – 30,000)"),
    TaxBracket(tax_year=2024, bracket_order=3,
        range_min=30001,   range_max=45000,
        rate=0.100, bracket_discount=2775,
        description="10% — الشريحة الثانية (30,001 – 45,000)"),
    TaxBracket(tax_year=2024, bracket_order=4,
        range_min=45001,   range_max=60000,
        rate=0.150, bracket_discount=5025,
        description="15% — الشريحة الثالثة (45,001 – 60,000)"),
    TaxBracket(tax_year=2024, bracket_order=5,
        range_min=60001,   range_max=200000,
        rate=0.200, bracket_discount=8025,
        description="20% — الشريحة الرابعة (60,001 – 200,000)"),
    TaxBracket(tax_year=2024, bracket_order=6,
        range_min=200001,  range_max=400000,
        rate=0.225, bracket_discount=13025,
        description="22.5% — الشريحة الخامسة (200,001 – 400,000)"),
    TaxBracket(tax_year=2024, bracket_order=7,
        range_min=400001,  range_max=None,
        rate=0.275, bracket_discount=33025,
        description="27.5% — الشريحة السادسة (>400,000) — تعديل 2023"),
]

# السنة الضريبية الحالية
CURRENT_TAX_YEAR = 2024
# الإعفاء الشخصي السنوي (ج.م)
PERSONAL_EXEMPTION = 21000


# ══════════════════════════════════════════════
# 2. Employee Insurance Profile
# ══════════════════════════════════════════════
class EmployeeInsuranceProfile(BaseModel):
    """ملف التأمين الضريبي للموظف
    
    Equivalent to SQL: employee_tax_insurance_profiles
        employee_id        BIGINT PK          → employee_id
        national_id        VARCHAR(14) UNIQUE → national_id (validated: 14 digits)
        is_insured         BOOLEAN            → is_insured
        insured_salary     DECIMAL(12,2)      → insured_basic_salary (= أجر الاشتراك)
        gross_salary       DECIMAL(12,2)      → gross_salary
        allowances_tax_exempt DECIMAL(12,2)  → allowances_tax_exempt
        medical_insurance_deduction DECIMAL  → medical_insurance_deduction
        bank_account_iban  VARCHAR(34)        → bank_account_iban (IBAN format)
    
    Laws:
        قانون التأمينات الاجتماعية 148/2019
        قانون الضريبة على الدخل 91/2005 م.38 (الوعاء الضريبي)
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str                            # PK (FK → employees)
    company_id: str
    # ── SQL: national_id VARCHAR(14) UNIQUE ──────────────────
    national_id: str                            # الرقم القومي — 14 رقم (يُفرض تفرده في DB)
    # ── SQL: is_insured BOOLEAN ──────────────────────────────
    is_insured: bool = True                     # هل الموظف مؤمن عليه؟
    # ── SQL: insured_salary DECIMAL(12,2) ────────────────────
    # = أجر الاشتراك التأميني (بين الحد الأدنى 1400 والحد الأقصى 12600 ج.م)
    insured_basic_salary: float = 0.0           # SQL field: insured_salary
    insured_salary: float = 0.0                 # alias for SQL compatibility
    insured_variable_salary: float = 0.0        # الأجر المتغير للاشتراك
    # ── SQL: gross_salary DECIMAL(12,2) ──────────────────────
    gross_salary: float = 0.0                   # الأجر الشامل الفعلي (للوعاء الضريبي)
    # ── SQL: allowances_tax_exempt DECIMAL(12,2) ─────────────
    # بدلات معفاة من الضريبة (مثل: بدل طبيعة العمل، السفر، التمثيل)
    allowances_tax_exempt: float = 0.0
    # ── SQL: medical_insurance_deduction DECIMAL(12,2) ───────
    # اشتراكات التأمين الطبي الخاص — تُخصم من الوعاء الضريبي (م.38 قانون 91/2005)
    medical_insurance_deduction: float = 0.0
    # ── Extensions (beyond SQL schema) ───────────────────────
    pension_deduction: float = 0.0              # اشتراكات صندوق المعاشات الخاص
    # ── SQL: bank_account_iban VARCHAR(34) ───────────────────
    # IBAN مصري يبدأ بـ EG ويتكون من 29 رقماً
    bank_account_iban: Optional[str] = None     # مثال: EG380019000500000000263180002
    bank_name: Optional[str] = None
    insurance_start_date: Optional[str] = None
    insurance_number: Optional[str] = None      # رقم التأمين الاجتماعي
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None
    
    def get_taxable_base_monthly(self) -> float:
        """
        حساب الوعاء الضريبي الشهري
        قانون 91/2005 م.38:
        الوعاء = الأجر الشامل - التأمينات الاجتماعية - البدلات المعفاة - التأمين الطبي الخاص
        """
        insured = self.insured_basic_salary or self.insured_salary or self.gross_salary
        from math import floor
        si_min, si_max = 1400, 12600
        insurable = min(max(insured, si_min), si_max)
        emp_si = round(insurable * 0.11, 2)  # 11% حصة الموظف
        
        taxable = (
            self.gross_salary
            - emp_si
            - self.allowances_tax_exempt
            - self.medical_insurance_deduction
            - self.pension_deduction
        )
        return max(taxable, 0)
    
    def get_insurable_salary(self) -> float:
        """أجر الاشتراك الفعلي (بين الحد الأدنى والأقصى)"""
        base = self.insured_basic_salary or self.insured_salary or self.gross_salary
        return min(max(base, 1400), 12600)


# ══════════════════════════════════════════════
# 3. Cost Centers
# ══════════════════════════════════════════════
class CostCenter(BaseModel):
    """مركز التكلفة — للتحليل الإداري"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    code: str                            # رمز المركز
    name_ar: str
    name_en: Optional[str] = None
    parent_id: Optional[str] = None      # للهيكل الشجري
    center_type: str = "department"      # department | project | region | product
    budget: float = 0.0                  # الميزانية المخصصة
    manager_id: Optional[str] = None     # المسؤول
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ══════════════════════════════════════════════
# 4. Progress Claims — قطاع المقاولات
# ══════════════════════════════════════════════
class ClaimType(str, Enum):
    OWNER = "owner"               # مستخلص للمالك
    SUBCONTRACTOR = "subcontractor"  # مستخلص من مقاول الباطن

class ProgressClaim(BaseModel):
    """مستخلص الأعمال — المعيار المحاسبي المصري رقم 8"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    project_id: str
    claim_type: ClaimType
    partner_id: str                       # المالك أو مقاول الباطن
    partner_name: str
    claim_number: int                     # رقم المستخلص التسلسلي
    claim_date: str
    period_from: str                      # فترة الأعمال المنجزة من
    period_to: str                        # فترة الأعمال المنجزة إلى
    # المبالغ
    gross_amount: float                   # إجمالي قيمة المستخلص
    previous_claims: float = 0.0          # المستخلصات السابقة
    current_claim: float = 0.0            # المستخلص الحالي
    # الخصومات
    retention_percentage: float = 10.0   # نسبة تأمين الأعمال (5-10%)
    retention_amount: float = 0.0        # مبلغ التأمين المحتجز
    advance_payment_deducted: float = 0.0  # خصم الدفعة المقدمة
    previous_retention_released: float = 0.0  # تأمين محرر من مستخلصات سابقة
    # ضرائب
    vat_rate: float = 0.05               # ضريبة القيمة المضافة (5% جدول مقاولات — قانون VAT م.54)
    vat_amount: float = 0.0
    withholding_tax_rate: float = 0.01   # ضريبة الخصم والتحصيل (1% توريدات)
    withholding_tax_amount: float = 0.0
    # الصافي
    # تفاصيل تنفيذ المستخلص
    ar_amount: float = 0.0               # إجمالي المطلوب من العميل (net + VAT)
    boq_items_executed: Optional[list] = []  # [{boq_item_id, executed_qty, amount}]
    completed_percentage: float = 0.0   # نسبة الإنجاز الإجمالية
    net_payable: float = 0.0            # الصافي المستحق
    # حالة المستخلص
    status: str = "draft"                # draft | submitted | approved | paid
    journal_entry_id: Optional[str] = None  # القيد المحاسبي المرتبط
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ══════════════════════════════════════════════
# 5. BOQ Items — بنود المقايسة
# ══════════════════════════════════════════════
class BOQItem(BaseModel):
    """بند مقايسة — Bill of Quantities"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    company_id: str
    item_number: str                # رقم البند
    description_ar: str             # وصف البند
    description_en: Optional[str] = None
    unit: str                       # وحدة القياس
    unit_price: float               # سعر الوحدة
    planned_qty: float              # الكمية المخططة
    executed_qty: float = 0.0       # الكمية المنفذة
    planned_amount: float = 0.0     # المبلغ المخطط
    executed_amount: float = 0.0    # المبلغ المنفذ
    cost_center_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None

    @property
    def remaining_qty(self) -> float:
        return max(self.planned_qty - self.executed_qty, 0)

    @property
    def completion_pct(self) -> float:
        return round((self.executed_qty / self.planned_qty * 100), 1) if self.planned_qty > 0 else 0


# ══════════════════════════════════════════════
# 6. Medical Services Log — القطاع الطبي
# ══════════════════════════════════════════════
class MedicalService(BaseModel):
    """سجل الخدمة الطبية — فصل حصة المستشفى عن أتعاب الأطباء"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str                      # معرف المستشفى/المركز الطبي
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    service_date: str
    service_type: str                    # consultation | surgery | lab | radiology | inpatient
    service_description: str
    # تفاصيل التسعير
    total_amount: float                  # إجمالي الفاتورة
    hospital_share: float               # حصة المستشفى
    doctor_share: float                 # أمانة الطبيب الاستشاري
    # مصادر الدفع
    patient_copay: float = 0.0          # المدفوع نقداً من المريض
    insurance_company_id: Optional[str] = None
    insurance_company_name: Optional[str] = None
    insurance_claim_amount: float = 0.0  # المطالبة لشركة التأمين
    insurance_approval_number: Optional[str] = None
    # ضريبة الأطباء
    doctor_withholding_tax: float = 0.0  # ضريبة خصم 5% على أتعاب الأطباء
    doctor_net_payment: float = 0.0      # صافي المسدد للطبيب
    # القيد المحاسبي
    journal_entry_id: Optional[str] = None
    status: str = "pending"             # pending | billed | paid | cancelled
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ══════════════════════════════════════════════
# 7. Currencies & Exchange Rates
# ══════════════════════════════════════════════
class Currency(BaseModel):
    """العملات"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str                 # EGP, USD, EUR, SAR, AED
    name_ar: str
    name_en: str
    symbol: str               # ج.م, $, €
    is_base: bool = False     # العملة الأساسية للشركة
    decimal_places: int = 2
    is_active: bool = True

class ExchangeRate(BaseModel):
    """أسعار الصرف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    from_currency: str        # من عملة
    to_currency: str          # إلى عملة
    rate: float               # سعر الصرف
    rate_date: str            # تاريخ السعر
    source: str = "manual"    # manual | CBE (البنك المركزي المصري)
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

DEFAULT_CURRENCIES = [
    Currency(code="EGP", name_ar="الجنيه المصري",     name_en="Egyptian Pound",  symbol="ج.م", is_base=True),
    Currency(code="USD", name_ar="الدولار الأمريكي",  name_en="US Dollar",       symbol="$"),
    Currency(code="EUR", name_ar="اليورو",             name_en="Euro",            symbol="€"),
    Currency(code="SAR", name_ar="الريال السعودي",     name_en="Saudi Riyal",     symbol="ر.س"),
    Currency(code="AED", name_ar="الدرهم الإماراتي",   name_en="UAE Dirham",      symbol="د.إ"),
    Currency(code="GBP", name_ar="الجنيه الإسترليني",  name_en="British Pound",   symbol="£"),
]


# ══════════════════════════════════════════════
# 8. ETA E-Invoice Extended Fields
# ══════════════════════════════════════════════
class ETAItemCodeType(str, Enum):
    GS1 = "GS1"   # للسلع المادية
    EGS = "EGS"   # للخدمات والسلع بدون باركود دولي

class ETAInvoiceStatus(str, Enum):
    PENDING   = "Pending"
    VALID     = "Valid"
    INVALID   = "Invalid"
    CANCELLED = "Cancelled"
    REJECTED  = "Rejected"

class ETAInvoiceFields(BaseModel):
    """حقول الفاتورة الإلكترونية المصرية — مصلحة الضرائب ETA"""
    eta_uuid: Optional[str] = None              # UUID من مصلحة الضرائب
    eta_submission_id: Optional[str] = None     # معرف التقديم
    eta_status: ETAInvoiceStatus = ETAInvoiceStatus.PENDING
    eta_submission_date: Optional[str] = None   # تاريخ الإرسال
    eta_item_code_type: ETAItemCodeType = ETAItemCodeType.EGS
    eta_long_id: Optional[str] = None           # المعرف الطويل
    eta_hash_key: Optional[str] = None          # hash للتحقق
    eta_receipt_number: Optional[str] = None    # رقم الإيصال من ETA
    eta_internal_id: Optional[str] = None       # المعرف الداخلي للفاتورة
    eta_issuer_type: str = "B"                  # B (Business) | P (Person)
    eta_receiver_type: str = "B"
    eta_document_type: str = "I"               # I (Invoice) | C (Credit) | D (Debit)
    eta_document_type_version: str = "1.0"
