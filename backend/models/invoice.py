"""
نظام الفواتير الإلكترونية
E-Invoice System

يدعم:
- فواتير البيع والشراء
- عروض الأسعار
- أوامر الشراء
- الفاتورة الإلكترونية المصرية (ETA)
- QR Code
- ربط مع القيود المحاسبية
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class DocumentType(str, Enum):
    """أنواع المستندات"""
    SALES_INVOICE = "sales_invoice"           # فاتورة بيع
    PURCHASE_INVOICE = "purchase_invoice"     # فاتورة شراء
    SALES_QUOTATION = "sales_quotation"       # عرض سعر
    PURCHASE_ORDER = "purchase_order"         # أمر شراء
    CREDIT_NOTE = "credit_note"               # إشعار دائن
    DEBIT_NOTE = "debit_note"                 # إشعار مدين


class DocumentStatus(str, Enum):
    """حالة المستند"""
    DRAFT = "draft"               # مسودة
    PENDING = "pending"           # معلق
    APPROVED = "approved"         # معتمد
    SENT = "sent"                 # مرسل
    PAID = "paid"                 # مدفوع
    PARTIALLY_PAID = "partially_paid"  # مدفوع جزئياً
    CANCELLED = "cancelled"       # ملغي
    CONVERTED = "converted"       # محول (عرض سعر → فاتورة)


class PaymentTerms(str, Enum):
    """شروط الدفع"""
    CASH = "cash"                 # نقداً
    NET_7 = "net_7"               # خلال 7 أيام
    NET_15 = "net_15"             # خلال 15 يوم
    NET_30 = "net_30"             # خلال 30 يوم
    NET_60 = "net_60"             # خلال 60 يوم
    NET_90 = "net_90"             # خلال 90 يوم
    CUSTOM = "custom"             # مخصص


class TaxType(str, Enum):
    """نوع الضريبة"""
    VAT = "vat"                   # ضريبة القيمة المضافة
    EXEMPT = "exempt"             # معفى
    ZERO_RATED = "zero_rated"     # صفري


class Currency(str, Enum):
    """العملات"""
    EGP = "EGP"    # جنيه مصري
    SAR = "SAR"    # ريال سعودي
    AED = "AED"    # درهم إماراتي
    USD = "USD"    # دولار أمريكي
    EUR = "EUR"    # يورو
    GBP = "GBP"    # جنيه إسترليني
    KWD = "KWD"    # دينار كويتي
    QAR = "QAR"    # ريال قطري
    BHD = "BHD"    # دينار بحريني
    OMR = "OMR"    # ريال عماني


# ==========================================
# Customer / Supplier Models
# ==========================================

class Party(BaseModel):
    """العميل أو المورد"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    party_type: str  # "customer" or "supplier"
    name: str
    name_en: Optional[str] = None
    tax_id: Optional[str] = None           # الرقم الضريبي
    commercial_register: Optional[str] = None  # السجل التجاري
    address: Optional[str] = None          # الشارع
    city: Optional[str] = None             # المدينة / المنطقة
    governate: Optional[str] = None        # المحافظة — مطلوبة للفاتورة الإلكترونية
    building_number: Optional[str] = None  # رقم المبنى — مطلوب للفاتورة الإلكترونية
    national_id: Optional[str] = None      # الرقم القومي (للأفراد فوق الحد)
    country: str = "EG"                    # ISO-3166 alpha-2 (EG, SA, US…)
    # ── عميل أجنبي / منطقة حرة — يحددان فئة ضريبة القيمة المضافة الافتراضية ──
    is_foreign: bool = False               # خارج مصر → تصدير (V001) ومستلم من النوع F
    free_zone: bool = False                # منطقة حرة / استثمارية → V002
    foreign_tax_id: Optional[str] = None   # رقم التسجيل الضريبي في بلده (للمستلم F)
    passport_number: Optional[str] = None  # لفرد أجنبي
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    credit_limit: float = 0.0
    payment_terms: PaymentTerms = PaymentTerms.CASH
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==========================================
# Product / Service Models
# ==========================================

class Product(BaseModel):
    """المنتج أو الخدمة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    code: str                              # كود المنتج
    name: str
    name_en: Optional[str] = None
    description: Optional[str] = None
    unit: str = "unit"                     # الوحدة (قطعة، كيلو، متر، ساعة)
    unit_price: float = 0.0
    cost_price: float = 0.0
    # ── ETA Item Code (SQL: eta_item_code_type ENUM(GS1/EGS)) ──────
    item_code: Optional[str] = None          # كود السلعة/الخدمة (GS1 barcode أو EGS code)
    item_code_type: Optional[str] = "EGS"   # GS1 (دولي) | EGS (مصري محلي) — مطلوب من ETA
    unit_type: Optional[str] = "EA"         # وحدة القياس بكود ETA (EA=عدد, KGM=كيلو, MTR=متر)
    tax_type: TaxType = TaxType.VAT
    tax_rate: float = 14.0                 # نسبة الضريبة (14% في مصر)
    eta_code: Optional[str] = None         # كود ETA للفاتورة الإلكترونية
    is_service: bool = False
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==========================================
# Invoice Line Item
# ==========================================

class VatCategory(str, Enum):
    """فئة ضريبة القيمة المضافة على السطر"""
    STANDARD = "standard"         # خاضع بالسعر العام (14%) أو بسعر آخر
    EXPORT = "export"             # تصدير — سعر صفر
    FREE_ZONE = "free_zone"       # بيع لمنطقة حرة — سعر صفر
    EXEMPT = "exempt"             # معفى
    NON_TAXABLE = "non_taxable"   # غير خاضع


# ETA tax types (code table "Tax Types"): T1 VAT, T2 table tax (%), T3 table tax
# (fixed), T4 withholding (subtracted), T5 stamp duty (%), T6 stamp duty
# (fixed), T7 entertainment, T8 resource development, T9 service charge,
# T10 municipality, T11 medical insurance, T12 other.
TAXES_IN_VAT_BASE = {"T2", "T3"}            # VAT is charged on net + table tax
TAXES_DEDUCTED = {"T4"}                     # withholding reduces the line total
TAXES_FIXED = {"T3", "T6"}                  # an amount, not a rate
TABLE_TAX_TYPES = {"T2", "T3"}
STAMP_TAX_TYPES = {"T5", "T6"}


class LineTax(BaseModel):
    """ضريبة أخرى على السطر (جدول / دمغة / خصم وتحصيل …) بأكواد المنظومة"""
    tax_type: str                          # T2 | T3 | T4 | T5 | T6 | … T12
    sub_type: Optional[str] = None         # e.g. Tbl01, Tbl02, ST01, ST02, W001
    rate: float = 0.0                      # % for rate types
    amount: float = 0.0                    # computed (rate types) or entered (T3/T6)


def vat_category_of(line) -> str:
    cat = getattr(line, "vat_category", None) if not isinstance(line, dict) else line.get("vat_category")
    cat = getattr(cat, "value", cat)
    if cat:
        return str(cat)
    tt = getattr(line, "tax_type", None) if not isinstance(line, dict) else line.get("tax_type")
    tt = str(getattr(tt, "value", tt) or "vat")
    return {"exempt": "exempt", "zero_rated": "export"}.get(tt, "standard")


def default_vat_category(party: Optional[dict], document_type: str = "sales_invoice") -> Optional[str]:
    """From the customer's flags: free zone → free_zone, abroad → export.
    Only sales-side documents; an import's VAT is paid at customs, not here."""
    party = party or {}
    if document_type not in ("sales_invoice", "credit_note", "debit_note", "sales_quotation"):
        return None
    if party.get("free_zone"):
        return VatCategory.FREE_ZONE.value
    if party.get("is_foreign") or str(party.get("country") or "EG").upper()[:2] != "EG":
        return VatCategory.EXPORT.value
    return None


class InvoiceLine(BaseModel):
    """سطر الفاتورة"""
    line_number: int
    product_id: Optional[str] = None
    product_code: Optional[str] = None
    description: str
    unit: str = "unit"
    quantity: float = 1.0
    unit_price: float = 0.0
    discount_percent: float = 0.0
    discount_amount: float = 0.0
    tax_type: TaxType = TaxType.VAT
    tax_rate: float = 14.0
    # before-tax invoice discount spread onto this line pro-rata to its net
    # (calculate_invoice_totals sets it). It reduces the VAT base, and the ETA
    # document reports it as part of the line discount.
    invoice_discount: float = 0.0
    vat_category: Optional[VatCategory] = None   # None → from tax_type
    other_taxes: List[LineTax] = []        # ضريبة الجدول / الدمغة / …
    subtotal: float = 0.0                  # المجموع قبل الضريبة
    net_amount: float = 0.0                # الصافي بعد كل الخصومات (قبل الضرائب)
    vat_base: float = 0.0                  # وعاء القيمة المضافة = الصافي + ضريبة الجدول
    tax_amount: float = 0.0                # مبلغ ضريبة القيمة المضافة (T1)
    other_taxes_amount: float = 0.0        # الضرائب الأخرى المضافة (عدا T4)
    withholding_amount: float = 0.0        # T4 المخصومة من السطر
    total: float = 0.0                     # المجموع الكلي
    eta_code: Optional[str] = None         # كود ETA


# ==========================================
# Invoice Adjustments (Discounts & Additions)
# ==========================================

class AdjustmentType(str, Enum):
    """نوع التعديل"""
    DISCOUNT = "discount"           # خصم
    ADDITION = "addition"           # إضافة

class AdjustmentCategory(str, Enum):
    """تصنيف التعديل"""
    SHIPPING = "shipping"                   # رسوم شحن
    SERVICE_FEE = "service_fee"             # رسوم خدمة
    TABLE_TAX = "table_tax"                 # ضريبة جدول
    CONTRACT_DISCOUNT = "contract_discount" # خصم تعاقد
    EARLY_PAYMENT = "early_payment"         # خصم الدفع المبكر
    VOLUME_DISCOUNT = "volume_discount"     # خصم كمية
    PROMOTIONAL = "promotional"             # خصم ترويجي
    INSURANCE = "insurance"                 # تأمين
    HANDLING = "handling"                   # رسوم مناولة
    CUSTOM = "custom"                       # مخصص

class AdjustmentCalculation(str, Enum):
    """طريقة الحساب"""
    PERCENTAGE = "percentage"       # نسبة مئوية
    FIXED = "fixed"                 # مبلغ ثابت

class AdjustmentBase(str, Enum):
    """أساس الحساب"""
    BEFORE_TAX = "before_tax"       # قبل الضريبة
    AFTER_TAX = "after_tax"         # بعد الضريبة

class InvoiceAdjustment(BaseModel):
    """خصم أو إضافة على الفاتورة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    adjustment_type: AdjustmentType         # خصم أو إضافة
    category: AdjustmentCategory = AdjustmentCategory.CUSTOM  # تصنيف
    name: str                               # اسم التعديل
    name_en: Optional[str] = None
    calculation_type: AdjustmentCalculation = AdjustmentCalculation.PERCENTAGE
    value: float = 0.0                      # القيمة (نسبة أو مبلغ)
    base: AdjustmentBase = AdjustmentBase.BEFORE_TAX
    calculated_amount: float = 0.0          # المبلغ المحسوب
    notes: Optional[str] = None


# ==========================================
# Invoice Model
# ==========================================

class Invoice(BaseModel):
    """الفاتورة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # Document Info
    document_type: DocumentType
    document_number: str                   # رقم الفاتورة
    document_date: str                     # تاريخ الفاتورة
    due_date: Optional[str] = None         # تاريخ الاستحقاق
    
    # Party Info
    party_id: str                          # العميل أو المورد
    party_name: str
    party_tax_id: Optional[str] = None
    party_address: Optional[str] = None
    
    # Financial Info
    currency: Currency = Currency.EGP
    # EGP per one unit of `currency` on the document date. This is the
    # invoice's carrying rate: the entry is posted at it and payments settle
    # AR/AP at it. Month-end revaluation never overwrites it (it is stored in
    # db.fx_revaluations and reversed on the 1st of the next month).
    exchange_rate: float = 1.0
    settle_amount_egp: Optional[float] = None  # AR/AP the entry booked, in EGP
    settled_egp: float = 0.0                   # AR/AP closed by payments, in EGP
    payment_terms: PaymentTerms = PaymentTerms.CASH
    
    # Lines
    lines: List[InvoiceLine] = []
    
    # Adjustments (Discounts & Additions)
    adjustments: List[InvoiceAdjustment] = []
    
    # Totals
    subtotal: float = 0.0                  # المجموع قبل الخصم والضريبة
    total_discount: float = 0.0            # إجمالي خصم الأسطر
    total_after_discount: float = 0.0      # المجموع بعد خصم الأسطر
    total_tax: float = 0.0                 # إجمالي ضريبة القيمة المضافة (T1)
    total_table_tax: float = 0.0           # ضريبة الجدول (T2 + T3)
    total_stamp_tax: float = 0.0           # ضريبة الدمغة النسبية / النوعية (T5 + T6)
    total_other_taxes: float = 0.0         # كل الضرائب الأخرى المضافة (جدول + دمغة + …)
    total_line_withholding: float = 0.0    # T4 على الأسطر
    
    # Invoice Level Adjustments
    # before-tax discounts are spread onto the lines (they are inside
    # total_discount and reduce VAT); this is the before-tax part, for display
    total_before_tax_discount: float = 0.0
    total_invoice_discount: float = 0.0    # خصومات بعد الضريبة على الإجمالي
    total_invoice_addition: float = 0.0    # إجمالي إضافات الفاتورة
    
    grand_total: float = 0.0               # الإجمالي الكلي
    amount_paid: float = 0.0               # المبلغ المدفوع
    amount_due: float = 0.0                # المبلغ المتبقي
    
    # Status
    status: DocumentStatus = DocumentStatus.DRAFT
    
    # References
    reference: Optional[str] = None        # مرجع خارجي
    converted_from_id: Optional[str] = None  # محول من (عرض سعر)
    # إشعار دائن/مدين: الفاتورة الأصلية وسببه
    original_invoice_id: Optional[str] = None
    original_invoice_number: Optional[str] = None
    credit_reason: Optional[str] = None
    restock: bool = True                     # ترجع البضاعة للمخزون؟
    credited_amount: float = 0.0             # ما صدر مقابل هذه الفاتورة من إشعارات
    journal_entry_id: Optional[str] = None   # قيد اليومية
    # مركز التكلفة / الفرع والمشروع — يُنسخان على كل سطر في قيد الفاتورة
    # (والتكلفة والسداد) حتى تُستخرج قائمة دخل لكل مركز/فرع دون اختلاط.
    cost_center_id: Optional[str] = None
    project_id: Optional[str] = None
    
    # ══ ETA E-Invoicing — Egyptian Tax Authority (مصلحة الضرائب) ══════
    # SQL: ALTER TABLE sales_invoices ADD COLUMN:
    #   eta_uuid VARCHAR(100)          — المعرف الفريد من مصلحة الضرائب
    #   eta_submission_id VARCHAR(100) — معرف الإرسال (submissionId / UUID)
    #   eta_status ENUM(Pending/Valid/Invalid/Cancelled)
    #   eta_item_code_type ENUM(GS1/EGS)
    
    # SQL: eta_uuid VARCHAR(100) NULL
    eta_uuid: Optional[str] = None              # UUID المستند من ETA (documentUUID)
    # SQL: eta_submission_id VARCHAR(100) NULL
    eta_submission_id: Optional[str] = None     # معرف الإرسال (submissionUUID)
    # SQL: eta_status ENUM('Pending','Valid','Invalid','Cancelled') DEFAULT 'Pending'
    eta_status: Optional[str] = "Pending"       # Pending|Valid|Invalid|Cancelled|Submitted|Rejected
    # SQL: eta_item_code_type ENUM('GS1','EGS') NOT NULL
    eta_item_code_type: Optional[str] = "EGS"  # GS1 (دولي) | EGS (مصري محلي)
    # Extended ETA fields (beyond SQL schema)
    eta_long_id: Optional[str] = None           # المعرف الطويل من ETA
    eta_hash_key: Optional[str] = None          # Hash للتحقق من سلامة المستند
    eta_submission_date: Optional[str] = None   # تاريخ الإرسال
    eta_cancelled_date: Optional[str] = None    # تاريخ الإلغاء
    eta_rejection_reason: Optional[str] = None  # سبب الرفض
    
    # QR Code
    qr_code: Optional[str] = None
    
    # Notes
    notes: Optional[str] = None
    internal_notes: Optional[str] = None
    
    # Audit
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    approved_by: Optional[str] = None
    approved_at: Optional[str] = None


# ==========================================
# Payment Model
# ==========================================

class PaymentMethod(str, Enum):
    """طرق الدفع"""
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHECK = "check"
    CREDIT_CARD = "credit_card"
    MOBILE_WALLET = "mobile_wallet"


class Payment(BaseModel):
    """سداد الفاتورة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    invoice_id: str
    payment_date: str
    amount: float
    # خصم نقدي (تعجيل دفع) مسموح به / مكتسب عند السداد — in the invoice
    # currency. Settles AR/AP with the amount; VAT is NOT reduced by it.
    discount_amount: float = 0.0
    payment_method: PaymentMethod = PaymentMethod.CASH
    reference: Optional[str] = None
    bank_account: Optional[str] = None
    notes: Optional[str] = None
    journal_entry_id: Optional[str] = None
    # ── Multi-currency: amount is in the INVOICE currency ──────
    currency: Optional[str] = None           # copied from the invoice
    exchange_rate: Optional[float] = None    # EGP per unit on the payment date (None → looked up)
    amount_egp: Optional[float] = None       # cash/bank side in EGP (amount × payment rate)
    settled_egp: Optional[float] = None      # AR/AP closed in EGP (at the invoice's carrying rate)
    fx_difference: Optional[float] = None    # + gain / − loss posted to 432 / 33611
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==========================================
# Invoice Sequence
# ==========================================

class InvoiceSequence(BaseModel):
    """تسلسل أرقام الفواتير"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    document_type: DocumentType
    prefix: str                            # البادئة (مثل INV-)
    current_number: int = 0
    year: int
    format: str = "{prefix}{year}{number:05d}"  # التنسيق


# ==========================================
# ETA Settings (Egyptian Tax Authority)
# ==========================================

class ETASettings(BaseModel):
    """إعدادات الفاتورة الإلكترونية المصرية"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    tax_id: Optional[str] = None
    activity_code: Optional[str] = None
    branch_id: str = "0"
    is_production: bool = False
    api_base_url: str = "https://api.invoicing.eta.gov.eg/api/v1"
    token_url: str = "https://id.eta.gov.eg/connect/token"
    is_enabled: bool = False
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==========================================
# Response Models
# ==========================================

class InvoiceResponse(BaseModel):
    id: str
    document_type: str
    document_number: str
    document_date: str
    party_name: str
    grand_total: float
    amount_due: float
    status: str
    currency: str


class PartyResponse(BaseModel):
    id: str
    name: str
    party_type: str
    tax_id: Optional[str]
    phone: Optional[str]
    email: Optional[str]


class ProductResponse(BaseModel):
    id: str
    code: str
    name: str
    unit_price: float
    tax_rate: float


# ==========================================
# Default Units
# ==========================================

UNITS = [
    {"code": "EA", "name_ar": "قطعة", "name_en": "Each"},
    {"code": "KG", "name_ar": "كيلوجرام", "name_en": "Kilogram"},
    {"code": "G", "name_ar": "جرام", "name_en": "Gram"},
    {"code": "L", "name_ar": "لتر", "name_en": "Liter"},
    {"code": "M", "name_ar": "متر", "name_en": "Meter"},
    {"code": "M2", "name_ar": "متر مربع", "name_en": "Square Meter"},
    {"code": "M3", "name_ar": "متر مكعب", "name_en": "Cubic Meter"},
    {"code": "HR", "name_ar": "ساعة", "name_en": "Hour"},
    {"code": "DAY", "name_ar": "يوم", "name_en": "Day"},
    {"code": "BOX", "name_ar": "صندوق", "name_en": "Box"},
    {"code": "PKT", "name_ar": "عبوة", "name_en": "Packet"},
    {"code": "SET", "name_ar": "طقم", "name_en": "Set"},
]


# ==========================================
# Helper Functions
# ==========================================

def calculate_line_totals(line: InvoiceLine) -> InvoiceLine:
    """حساب مجاميع سطر الفاتورة — كل مبلغ مقرّب لقرشين.

    Amounts were stored unrounded (3 × 33.333 → 99.999, tax 13.99986), so an
    invoice, its entry and the ETA submission disagreed by fractions of a
    piastre and the totals shown never matched the sum of the lines.

    ETA order of calculation:
      net      = sales total − line discount − share of before-tax invoice discount
      T3       = fixed amount;  T2 = (net + T3) × rate      (table tax)
      T1 (VAT) = (net + T2 + T3) × rate                     (standard lines only)
      T5       = net × rate;    T6 = fixed amount            (stamp, not in VAT base)
      T4       = net × rate, subtracted
      total    = net + T1 + all other taxes − T4
    """
    line.subtotal = round(line.quantity * line.unit_price, 2)
    if line.discount_percent > 0:
        line.discount_amount = line.subtotal * (line.discount_percent / 100)
    line.discount_amount = round(line.discount_amount or 0, 2)
    line.invoice_discount = round(line.invoice_discount or 0, 2)
    net = round(line.subtotal - line.discount_amount - line.invoice_discount, 2)
    line.net_amount = net

    cat = vat_category_of(line)
    if line.vat_category is None:
        line.vat_category = VatCategory(cat)
    taxes = sorted(line.other_taxes or [], key=lambda t: 0 if t.tax_type.upper() in TAXES_FIXED else 1)
    in_base = added = withheld = 0.0
    t3 = sum(round(t.amount or 0, 2) for t in taxes if t.tax_type.upper() == "T3")
    for t in taxes:
        t.tax_type = t.tax_type.upper()
        if t.tax_type in TAXES_FIXED:
            t.amount = round(t.amount or 0, 2)
        elif t.tax_type == "T2":
            t.amount = round((net + t3) * (t.rate or 0) / 100, 2)
        else:
            t.amount = round(net * (t.rate or 0) / 100, 2)
        if t.tax_type in TAXES_DEDUCTED:
            withheld += t.amount
        else:
            added += t.amount
            if t.tax_type in TAXES_IN_VAT_BASE:
                in_base += t.amount
    line.other_taxes = taxes
    line.vat_base = round(net + in_base, 2)
    if line.tax_type == TaxType.VAT and cat == VatCategory.STANDARD.value:
        line.tax_amount = round(line.vat_base * (line.tax_rate / 100), 2)
    else:
        # export / free zone / exempt / non-taxable: no VAT, whatever the rate typed
        line.tax_amount = 0
        if cat != VatCategory.STANDARD.value:
            line.tax_rate = 0.0
    line.other_taxes_amount = round(added, 2)
    line.withholding_amount = round(withheld, 2)
    line.total = round(net + line.tax_amount + added - withheld, 2)
    return line


def _spread_before_tax_discount(invoice: "Invoice", amount: float) -> None:
    """Allocate a before-tax invoice discount to the lines pro-rata to each
    line's net (after its own discount); the rounding piastre goes on the
    largest line so the shares add up exactly."""
    nets = [round(l.subtotal - l.discount_amount, 2) for l in invoice.lines]
    base = round(sum(nets), 2)
    for l in invoice.lines:
        l.invoice_discount = 0.0
    if amount <= 0 or base <= 0:
        return
    amount = min(round(amount, 2), base)
    shares = [round(amount * n / base, 2) for n in nets]
    diff = round(amount - sum(shares), 2)
    if diff:
        i = max(range(len(nets)), key=lambda k: nets[k])
        shares[i] = round(shares[i] + diff, 2)
    for l, s in zip(invoice.lines, shares):
        l.invoice_discount = s


def calculate_invoice_totals(invoice: Invoice) -> Invoice:
    """حساب مجاميع الفاتورة مع الخصومات والإضافات

    A discount granted BEFORE tax reduces the taxable value (Law 67/2016): it
    is spread onto the lines as a line discount, so VAT is computed on the
    reduced net (10% on 1,000 → VAT 126, total 1,026 — it used to be 140 /
    1,040). An AFTER-tax discount stays on the grand total and the VAT is not
    touched."""
    def _is(v, enum_val):
        return getattr(v, "value", v) == enum_val.value

    # 1) before-tax discounts, measured on the lines' own net
    own_net = round(sum(round(l.subtotal - l.discount_amount, 2) for l in invoice.lines), 2)
    before_disc = 0.0
    has_before = False
    for adj in invoice.adjustments:
        if _is(adj.adjustment_type, AdjustmentType.DISCOUNT) and _is(adj.base, AdjustmentBase.BEFORE_TAX):
            has_before = True
            if _is(adj.calculation_type, AdjustmentCalculation.PERCENTAGE):
                adj.calculated_amount = round(own_net * (adj.value / 100), 2)
            else:
                adj.calculated_amount = round(adj.value, 2)
            before_disc += adj.calculated_amount
    if has_before:
        _spread_before_tax_discount(invoice, round(before_disc, 2))
        for i, line in enumerate(invoice.lines):
            invoice.lines[i] = calculate_line_totals(line)
    invoice.total_before_tax_discount = round(sum(l.invoice_discount for l in invoice.lines), 2)

    # حساب مجاميع الأسطر
    invoice.subtotal = round(sum(line.subtotal for line in invoice.lines), 2)
    invoice.total_discount = round(sum(line.discount_amount + line.invoice_discount for line in invoice.lines), 2)
    invoice.total_after_discount = round(invoice.subtotal - invoice.total_discount, 2)
    invoice.total_tax = round(sum(line.tax_amount for line in invoice.lines), 2)
    invoice.total_table_tax = round(sum(t.amount for l in invoice.lines for t in l.other_taxes
                                        if t.tax_type in TABLE_TAX_TYPES), 2)
    invoice.total_stamp_tax = round(sum(t.amount for l in invoice.lines for t in l.other_taxes
                                        if t.tax_type in STAMP_TAX_TYPES), 2)
    invoice.total_other_taxes = round(sum(l.other_taxes_amount for l in invoice.lines), 2)
    invoice.total_line_withholding = round(sum(l.withholding_amount for l in invoice.lines), 2)
    gross = round(invoice.total_after_discount + invoice.total_tax
                  + invoice.total_other_taxes - invoice.total_line_withholding, 2)

    # 2) after-tax discounts and all additions, on the grand total
    total_invoice_discount = 0.0
    total_invoice_addition = 0.0
    
    for adj in invoice.adjustments:
        is_discount = _is(adj.adjustment_type, AdjustmentType.DISCOUNT)
        if is_discount and _is(adj.base, AdjustmentBase.BEFORE_TAX):
            continue                                   # already in the lines
        base_amount = invoice.total_after_discount if _is(adj.base, AdjustmentBase.BEFORE_TAX) else gross
        
        # حساب قيمة التعديل
        if _is(adj.calculation_type, AdjustmentCalculation.PERCENTAGE):
            adj.calculated_amount = round(base_amount * (adj.value / 100), 2)
        else:  # FIXED
            adj.calculated_amount = round(adj.value, 2)
        
        # تصنيف التعديل
        if is_discount:
            total_invoice_discount += adj.calculated_amount
        else:  # ADDITION
            total_invoice_addition += adj.calculated_amount
    
    invoice.total_invoice_discount = round(total_invoice_discount, 2)
    invoice.total_invoice_addition = round(total_invoice_addition, 2)
    
    # الإجمالي = الصافي + القيمة المضافة + الضرائب الأخرى − الخصم من المنبع
    #           − خصومات بعد الضريبة + إضافات الفاتورة
    invoice.grand_total = round(gross - invoice.total_invoice_discount + invoice.total_invoice_addition, 2)
    invoice.amount_due = round(invoice.grand_total - invoice.amount_paid, 2)
    
    return invoice


def generate_qr_code_data(invoice: Invoice, company_name: str, company_tax_id: str = "") -> str:
    """نص رمز QR قبل إرسال الفاتورة للمنظومة.

    It was the Saudi ZATCA TLV layout with the CUSTOMER's tax id in the
    seller's place. An Egyptian e-invoice's QR is the link to the invoice on
    the tax authority's portal, which exists only after submission (see
    services/eta_document.public_url — the submit step replaces this). Until
    then the code carries a readable summary with the seller's own number.
    """
    return "\n".join([
        company_name or "",
        f"الرقم الضريبي: {company_tax_id}" if company_tax_id else "",
        f"{invoice.document_number} — {invoice.document_date}",
        f"الإجمالي: {invoice.grand_total:.2f} {getattr(invoice.currency, 'value', invoice.currency)}",
        f"الضريبة: {invoice.total_tax:.2f}",
    ]).replace("\n\n", "\n")


# ==========================================
# Currency & Exchange Rate Models
# ==========================================

# قائمة العملات المدعومة مع تفاصيلها
CURRENCIES = {
    "EGP": {
        "code": "EGP",
        "name_ar": "جنيه مصري",
        "name_en": "Egyptian Pound",
        "symbol": "ج.م",
        "symbol_en": "EGP",
        "decimal_places": 2,
        "is_default": True
    },
    "USD": {
        "code": "USD",
        "name_ar": "دولار أمريكي",
        "name_en": "US Dollar",
        "symbol": "$",
        "symbol_en": "$",
        "decimal_places": 2,
        "is_default": False
    },
    "EUR": {
        "code": "EUR",
        "name_ar": "يورو",
        "name_en": "Euro",
        "symbol": "€",
        "symbol_en": "€",
        "decimal_places": 2,
        "is_default": False
    },
    "SAR": {
        "code": "SAR",
        "name_ar": "ريال سعودي",
        "name_en": "Saudi Riyal",
        "symbol": "ر.س",
        "symbol_en": "SAR",
        "decimal_places": 2,
        "is_default": False
    },
    "AED": {
        "code": "AED",
        "name_ar": "درهم إماراتي",
        "name_en": "UAE Dirham",
        "symbol": "د.إ",
        "symbol_en": "AED",
        "decimal_places": 2,
        "is_default": False
    },
    "GBP": {
        "code": "GBP",
        "name_ar": "جنيه إسترليني",
        "name_en": "British Pound",
        "symbol": "£",
        "symbol_en": "£",
        "decimal_places": 2,
        "is_default": False
    },
    "KWD": {
        "code": "KWD",
        "name_ar": "دينار كويتي",
        "name_en": "Kuwaiti Dinar",
        "symbol": "د.ك",
        "symbol_en": "KWD",
        "decimal_places": 3,
        "is_default": False
    },
    "QAR": {
        "code": "QAR",
        "name_ar": "ريال قطري",
        "name_en": "Qatari Riyal",
        "symbol": "ر.ق",
        "symbol_en": "QAR",
        "decimal_places": 2,
        "is_default": False
    },
    "BHD": {
        "code": "BHD",
        "name_ar": "دينار بحريني",
        "name_en": "Bahraini Dinar",
        "symbol": "د.ب",
        "symbol_en": "BHD",
        "decimal_places": 3,
        "is_default": False
    },
    "OMR": {
        "code": "OMR",
        "name_ar": "ريال عماني",
        "name_en": "Omani Rial",
        "symbol": "ر.ع",
        "symbol_en": "OMR",
        "decimal_places": 3,
        "is_default": False
    }
}


class ExchangeRate(BaseModel):
    """سعر الصرف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    from_currency: str = "EGP"          # العملة الأساسية
    to_currency: str                     # العملة المستهدفة
    rate: float                          # سعر الصرف
    effective_date: str                  # تاريخ السريان
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    created_by: Optional[str] = None


class CompanyCurrency(BaseModel):
    """إعدادات العملات للشركة"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    base_currency: str = "EGP"           # العملة الأساسية
    enabled_currencies: List[str] = ["EGP"]  # العملات المفعلة
    auto_update_rates: bool = False      # تحديث تلقائي لأسعار الصرف
    last_rate_update: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


def convert_currency(amount: float, from_currency: str, to_currency: str, rate: float) -> float:
    """تحويل المبلغ من عملة لأخرى"""
    if from_currency == to_currency:
        return amount
    return round(amount * rate, 2)


def get_currency_info(currency_code: str) -> dict:
    """الحصول على معلومات العملة"""
    return CURRENCIES.get(currency_code, CURRENCIES["EGP"])
