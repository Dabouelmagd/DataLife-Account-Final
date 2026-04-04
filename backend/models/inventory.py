"""
Professional Inventory Management Models
نماذج إدارة المخزون الاحترافية
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, date
from enum import Enum
import uuid


# ==========================================
# Enums
# ==========================================

class MovementType(str, Enum):
    """نوع حركة المخزون"""
    PURCHASE = "purchase"           # شراء
    SALES = "sales"                 # بيع
    TRANSFER_IN = "transfer_in"     # تحويل وارد
    TRANSFER_OUT = "transfer_out"   # تحويل صادر
    ADJUSTMENT_IN = "adjustment_in" # تسوية إضافة
    ADJUSTMENT_OUT = "adjustment_out"  # تسوية نقص
    RETURN_IN = "return_in"         # مرتجع من العميل
    RETURN_OUT = "return_out"       # مرتجع للمورد
    PRODUCTION_IN = "production_in" # إنتاج وارد
    PRODUCTION_OUT = "production_out"  # مواد خام للإنتاج
    DAMAGE = "damage"               # تالف
    EXPIRED = "expired"             # منتهي الصلاحية
    OPENING = "opening"             # رصيد افتتاحي


class ValuationMethod(str, Enum):
    """طريقة تقييم المخزون"""
    FIFO = "fifo"           # الأول في الأول خارج
    LIFO = "lifo"           # الأخير في الأول خارج
    AVERAGE = "average"     # المتوسط المرجح
    SPECIFIC = "specific"   # التكلفة المحددة


class ProductType(str, Enum):
    """نوع المنتج"""
    INVENTORY = "inventory"     # صنف مخزني
    SERVICE = "service"         # خدمة
    CONSUMABLE = "consumable"   # مستهلك


class TrackingType(str, Enum):
    """نوع التتبع"""
    NONE = "none"               # بدون تتبع
    BATCH = "batch"             # رقم دفعة
    SERIAL = "serial"          # رقم تسلسلي
    EXPIRY = "expiry"          # تاريخ صلاحية


# ==========================================
# Warehouse (المخزن)
# ==========================================

class Warehouse(BaseModel):
    """المخزن/المستودع"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    code: str                           # كود المخزن
    name: str                           # اسم المخزن
    name_en: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None    # مدير المخزن
    manager_name: Optional[str] = None
    is_active: bool = True
    is_default: bool = False            # المخزن الافتراضي
    allow_negative: bool = False        # السماح بالسالب
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================
# Category (التصنيف)
# ==========================================

class Category(BaseModel):
    """تصنيف المنتجات"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    code: str
    name: str
    name_en: Optional[str] = None
    parent_id: Optional[str] = None     # التصنيف الأب
    level: int = 1                      # مستوى التصنيف
    path: str = ""                      # المسار الكامل
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================
# Unit of Measure (وحدة القياس)
# ==========================================

class UnitOfMeasure(BaseModel):
    """وحدة القياس"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    code: str                           # كود الوحدة
    name: str                           # اسم الوحدة
    name_en: Optional[str] = None
    symbol: str                         # الرمز (كجم، م، قطعة)
    is_base: bool = False               # وحدة أساسية
    base_unit_id: Optional[str] = None  # الوحدة الأساسية
    conversion_factor: float = 1.0      # معامل التحويل
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ProductUnit(BaseModel):
    """وحدات المنتج"""
    unit_id: str
    unit_name: str
    unit_symbol: str
    conversion_factor: float = 1.0      # كرتونة = 12 قطعة
    barcode: Optional[str] = None
    purchase_price: float = 0.0
    sale_price: float = 0.0
    is_default_purchase: bool = False
    is_default_sale: bool = False


# ==========================================
# Product (المنتج)
# ==========================================

class Product(BaseModel):
    """المنتج/الصنف"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # معلومات أساسية
    code: str                           # كود الصنف
    sku: Optional[str] = None           # SKU
    barcode: Optional[str] = None       # الباركود الرئيسي
    name: str                           # اسم الصنف
    name_en: Optional[str] = None
    description: Optional[str] = None
    
    # التصنيف
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_path: Optional[str] = None
    
    # النوع والتتبع
    product_type: ProductType = ProductType.INVENTORY
    tracking_type: TrackingType = TrackingType.NONE
    
    # الوحدات
    base_unit_id: str                   # الوحدة الأساسية
    base_unit_name: str
    base_unit_symbol: str
    units: List[ProductUnit] = []       # وحدات إضافية
    
    # الأسعار
    cost_price: float = 0.0             # سعر التكلفة
    sale_price: float = 0.0             # سعر البيع
    min_sale_price: float = 0.0         # أقل سعر بيع
    
    # الضرائب
    tax_rate: float = 14.0              # نسبة الضريبة
    is_taxable: bool = True
    
    # المخزون
    valuation_method: ValuationMethod = ValuationMethod.AVERAGE
    reorder_level: float = 0.0          # حد إعادة الطلب
    reorder_qty: float = 0.0            # كمية إعادة الطلب
    min_stock: float = 0.0              # الحد الأدنى
    max_stock: float = 0.0              # الحد الأقصى
    
    # الصلاحية
    has_expiry: bool = False
    shelf_life_days: int = 0            # مدة الصلاحية بالأيام
    expiry_alert_days: int = 30         # تنبيه قبل الصلاحية
    
    # الصور
    image_url: Optional[str] = None
    images: List[str] = []
    
    # ETA (الضرائب المصرية)
    eta_code: Optional[str] = None
    eta_description: Optional[str] = None
    
    # الحالة
    is_active: bool = True
    is_purchasable: bool = True         # قابل للشراء
    is_saleable: bool = True            # قابل للبيع
    
    # البيانات الوصفية
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None


# ==========================================
# Stock (رصيد المخزون)
# ==========================================

class Stock(BaseModel):
    """رصيد المخزون لمنتج في مخزن"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    product_id: str
    product_code: str
    product_name: str
    warehouse_id: str
    warehouse_name: str
    
    # الكميات
    quantity: float = 0.0               # الكمية المتاحة
    reserved_qty: float = 0.0           # الكمية المحجوزة
    available_qty: float = 0.0          # الكمية المتاحة للبيع
    
    # التكلفة
    unit_cost: float = 0.0              # متوسط تكلفة الوحدة
    total_value: float = 0.0            # إجمالي القيمة
    
    # الحالة
    last_movement_date: Optional[datetime] = None
    last_count_date: Optional[datetime] = None
    
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================
# Stock Movement (حركة المخزون)
# ==========================================

class StockMovement(BaseModel):
    """حركة المخزون"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    # رقم الحركة
    movement_number: str
    movement_date: str
    movement_type: MovementType
    
    # المنتج
    product_id: str
    product_code: str
    product_name: str
    
    # المخازن
    warehouse_id: str                   # المخزن المصدر أو الوجهة
    warehouse_name: str
    from_warehouse_id: Optional[str] = None  # في حالة التحويل
    from_warehouse_name: Optional[str] = None
    to_warehouse_id: Optional[str] = None
    to_warehouse_name: Optional[str] = None
    
    # الكميات
    quantity: float
    unit_id: str
    unit_name: str
    base_quantity: float                # الكمية بالوحدة الأساسية
    
    # التكلفة
    unit_cost: float = 0.0
    total_cost: float = 0.0
    
    # الأرصدة
    balance_before: float = 0.0
    balance_after: float = 0.0
    
    # التتبع
    batch_number: Optional[str] = None
    serial_numbers: List[str] = []
    expiry_date: Optional[str] = None
    
    # المرجع
    reference_type: Optional[str] = None    # invoice, transfer, adjustment
    reference_id: Optional[str] = None
    reference_number: Optional[str] = None
    
    # ملاحظات
    notes: Optional[str] = None
    
    # البيانات الوصفية
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    created_by_name: Optional[str] = None


# ==========================================
# Stock Transfer (تحويل مخزني)
# ==========================================

class TransferStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    IN_TRANSIT = "in_transit"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TransferLine(BaseModel):
    """سطر التحويل"""
    line_number: int
    product_id: str
    product_code: str
    product_name: str
    quantity: float
    unit_id: str
    unit_name: str
    received_qty: float = 0.0
    notes: Optional[str] = None


class StockTransfer(BaseModel):
    """تحويل مخزني"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    transfer_number: str
    transfer_date: str
    status: TransferStatus = TransferStatus.DRAFT
    
    from_warehouse_id: str
    from_warehouse_name: str
    to_warehouse_id: str
    to_warehouse_name: str
    
    lines: List[TransferLine] = []
    
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None


# ==========================================
# Stock Adjustment (تسوية مخزنية)
# ==========================================

class AdjustmentReason(str, Enum):
    COUNT = "count"             # جرد
    DAMAGE = "damage"           # تلف
    THEFT = "theft"             # سرقة
    EXPIRED = "expired"         # انتهاء صلاحية
    CORRECTION = "correction"   # تصحيح
    OTHER = "other"             # أخرى


class AdjustmentLine(BaseModel):
    """سطر التسوية"""
    line_number: int
    product_id: str
    product_code: str
    product_name: str
    system_qty: float           # الكمية في النظام
    actual_qty: float           # الكمية الفعلية
    difference: float           # الفرق
    unit_cost: float
    total_cost: float
    reason: AdjustmentReason = AdjustmentReason.COUNT
    notes: Optional[str] = None


class StockAdjustment(BaseModel):
    """تسوية مخزنية"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    adjustment_number: str
    adjustment_date: str
    warehouse_id: str
    warehouse_name: str
    
    adjustment_type: Literal["increase", "decrease", "count"]
    status: Literal["draft", "approved", "cancelled"] = "draft"
    
    lines: List[AdjustmentLine] = []
    
    total_increase: float = 0.0
    total_decrease: float = 0.0
    net_adjustment: float = 0.0
    
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None


# ==========================================
# Batch / Serial (الدفعات والأرقام التسلسلية)
# ==========================================

class Batch(BaseModel):
    """دفعة منتج"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    product_id: str
    warehouse_id: str
    
    batch_number: str
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    
    initial_qty: float
    current_qty: float
    unit_cost: float
    
    supplier_id: Optional[str] = None
    supplier_batch: Optional[str] = None
    
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SerialNumber(BaseModel):
    """رقم تسلسلي"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    product_id: str
    warehouse_id: str
    batch_id: Optional[str] = None
    
    serial_number: str
    status: Literal["available", "sold", "reserved", "damaged"] = "available"
    
    purchase_date: Optional[str] = None
    purchase_cost: float = 0.0
    sale_date: Optional[str] = None
    sale_price: float = 0.0
    
    warranty_expiry: Optional[str] = None
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ==========================================
# Inventory Count (الجرد)
# ==========================================

class CountStatus(str, Enum):
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class CountLine(BaseModel):
    """سطر الجرد"""
    product_id: str
    product_code: str
    product_name: str
    system_qty: float
    counted_qty: Optional[float] = None
    difference: float = 0.0
    unit_cost: float = 0.0
    variance_value: float = 0.0
    counted_by: Optional[str] = None
    counted_at: Optional[datetime] = None
    notes: Optional[str] = None


class InventoryCount(BaseModel):
    """جرد المخزون"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    
    count_number: str
    count_date: str
    warehouse_id: str
    warehouse_name: str
    
    count_type: Literal["full", "partial", "cycle"] = "full"
    status: CountStatus = CountStatus.DRAFT
    
    category_id: Optional[str] = None   # للجرد الجزئي
    
    lines: List[CountLine] = []
    
    total_items: int = 0
    counted_items: int = 0
    total_variance: float = 0.0
    
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str
    completed_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
