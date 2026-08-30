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
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "EG"
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
    subtotal: float = 0.0                  # المجموع قبل الضريبة
    tax_amount: float = 0.0                # مبلغ الضريبة
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
    exchange_rate: float = 1.0
    payment_terms: PaymentTerms = PaymentTerms.CASH
    
    # Lines
    lines: List[InvoiceLine] = []
    
    # Adjustments (Discounts & Additions)
    adjustments: List[InvoiceAdjustment] = []
    
    # Totals
    subtotal: float = 0.0                  # المجموع قبل الخصم والضريبة
    total_discount: float = 0.0            # إجمالي خصم الأسطر
    total_after_discount: float = 0.0      # المجموع بعد خصم الأسطر
    total_tax: float = 0.0                 # إجمالي الضريبة
    
    # Invoice Level Adjustments
    total_invoice_discount: float = 0.0    # إجمالي خصومات الفاتورة
    total_invoice_addition: float = 0.0    # إجمالي إضافات الفاتورة
    
    grand_total: float = 0.0               # الإجمالي الكلي
    amount_paid: float = 0.0               # المبلغ المدفوع
    amount_due: float = 0.0                # المبلغ المتبقي
    
    # Status
    status: DocumentStatus = DocumentStatus.DRAFT
    
    # References
    reference: Optional[str] = None        # مرجع خارجي
    converted_from_id: Optional[str] = None  # محول من (عرض سعر)
    journal_entry_id: Optional[str] = None   # قيد اليومية
    
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
    payment_method: PaymentMethod = PaymentMethod.CASH
    reference: Optional[str] = None
    bank_account: Optional[str] = None
    notes: Optional[str] = None
    journal_entry_id: Optional[str] = None
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
    """حساب مجاميع سطر الفاتورة"""
    # المجموع الفرعي = الكمية × سعر الوحدة
    line.subtotal = line.quantity * line.unit_price
    
    # حساب الخصم
    if line.discount_percent > 0:
        line.discount_amount = line.subtotal * (line.discount_percent / 100)
    
    # المجموع بعد الخصم
    after_discount = line.subtotal - line.discount_amount
    
    # حساب الضريبة
    if line.tax_type == TaxType.VAT:
        line.tax_amount = after_discount * (line.tax_rate / 100)
    else:
        line.tax_amount = 0
    
    # المجموع الكلي
    line.total = after_discount + line.tax_amount
    
    return line


def calculate_invoice_totals(invoice: Invoice) -> Invoice:
    """حساب مجاميع الفاتورة مع الخصومات والإضافات"""
    # حساب مجاميع الأسطر
    invoice.subtotal = sum(line.subtotal for line in invoice.lines)
    invoice.total_discount = sum(line.discount_amount for line in invoice.lines)
    invoice.total_after_discount = invoice.subtotal - invoice.total_discount
    invoice.total_tax = sum(line.tax_amount for line in invoice.lines)
    
    # حساب الخصومات والإضافات على مستوى الفاتورة
    total_invoice_discount = 0.0
    total_invoice_addition = 0.0
    
    for adj in invoice.adjustments:
        # تحديد قاعدة الحساب
        if adj.base == AdjustmentBase.BEFORE_TAX:
            base_amount = invoice.total_after_discount
        else:  # AFTER_TAX
            base_amount = invoice.total_after_discount + invoice.total_tax
        
        # حساب قيمة التعديل
        if adj.calculation_type == AdjustmentCalculation.PERCENTAGE:
            adj.calculated_amount = base_amount * (adj.value / 100)
        else:  # FIXED
            adj.calculated_amount = adj.value
        
        # تصنيف التعديل
        if adj.adjustment_type == AdjustmentType.DISCOUNT:
            total_invoice_discount += adj.calculated_amount
        else:  # ADDITION
            total_invoice_addition += adj.calculated_amount
    
    invoice.total_invoice_discount = round(total_invoice_discount, 2)
    invoice.total_invoice_addition = round(total_invoice_addition, 2)
    
    # الإجمالي الكلي = (المجموع بعد خصم الأسطر + الضريبة) - خصومات الفاتورة + إضافات الفاتورة
    invoice.grand_total = round(
        invoice.total_after_discount + invoice.total_tax - 
        invoice.total_invoice_discount + invoice.total_invoice_addition, 
        2
    )
    invoice.amount_due = round(invoice.grand_total - invoice.amount_paid, 2)
    
    return invoice


def generate_qr_code_data(invoice: Invoice, company_name: str) -> str:
    """توليد بيانات QR Code للفاتورة الإلكترونية"""
    import base64
    
    # TLV format for Saudi/Egyptian e-invoice
    def tlv_encode(tag: int, value: str) -> bytes:
        value_bytes = value.encode('utf-8')
        return bytes([tag, len(value_bytes)]) + value_bytes
    
    data = b''
    data += tlv_encode(1, company_name)                    # اسم البائع
    data += tlv_encode(2, invoice.party_tax_id or '')      # الرقم الضريبي
    data += tlv_encode(3, invoice.document_date)           # تاريخ الفاتورة
    data += tlv_encode(4, f"{invoice.grand_total:.2f}")    # الإجمالي
    data += tlv_encode(5, f"{invoice.total_tax:.2f}")      # الضريبة
    
    return base64.b64encode(data).decode('utf-8')



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
