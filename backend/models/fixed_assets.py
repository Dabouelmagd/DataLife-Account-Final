"""
Fixed Assets Engine — محرك الأصول الثابتة
قانون الضرائب المصري 91/2005 المادتان 25 و26
المعيار المحاسبي المصري للأصول الثابتة
"""
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid


# ══════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════

class AssetType(str, Enum):
    BUILDINGS       = "buildings"        # مباني وإنشاءات
    MACHINERY       = "machinery"        # آلات ومعدات إنتاجية
    COMPUTERS       = "computers"        # حواسب ونظم معلومات
    VEHICLES        = "vehicles"         # سيارات ووسائل نقل
    FURNITURE       = "furniture"        # أثاث وأجهزة
    INTANGIBLE      = "intangible"       # أصول معنوية (شهرة، برمجيات)
    LAND            = "land"             # أراضٍ (لا تُهلَك)
    WIP             = "wip"              # مشروعات تحت التنفيذ


class DepreciationMethod(str, Enum):
    """طرق الإهلاك المحاسبي"""
    STRAIGHT_LINE    = "straight_line"    # القسط الثابت
    DECLINING_BALANCE= "declining_balance"# القسط المتناقص (أساس الإهلاك)
    UNITS_OF_PRODUCTION = "units_of_production"  # وحدات الإنتاج


class AssetStatus(str, Enum):
    ACTIVE      = "active"      # قيد الاستخدام
    WIP         = "wip"         # تحت التنفيذ / لم يُشغَّل بعد
    DISPOSED    = "disposed"    # مُستبعَد (بيع أو إتلاف)
    IDLE        = "idle"        # خارج الخدمة مؤقتاً
    FULLY_DEP   = "fully_depreciated"  # مُستهلَك بالكامل


# ══════════════════════════════════════════════════════════════
# TAX DEPRECIATION RULES — قانون 91/2005 المواد 25-26
# ══════════════════════════════════════════════════════════════
TAX_DEPRECIATION_RULES = {
    # asset_type → (method, rate, accelerated_rate_year1)
    "buildings":   ("straight_line",    0.05,  None),    # 5% قسط ثابت
    "intangible":  ("straight_line",    0.10,  None),    # 10% قسط ثابت
    "computers":   ("declining_balance", 0.50,  None),   # 50% متناقص
    "machinery":   ("declining_balance", 0.25,  0.30),   # 25% متناقص (30% سنة أولى)
    "vehicles":    ("declining_balance", 0.25,  None),   # 25% متناقص
    "furniture":   ("declining_balance", 0.25,  None),   # 25% متناقص
    "land":        (None,               0.00,  None),    # لا إهلاك
    "wip":         (None,               0.00,  None),    # لا إهلاك حتى التشغيل
}

# Account codes (Egyptian Standard Chart of Accounts)
ASSET_ACCOUNTS = {
    "buildings":  {"asset": "151",  "accum_dep": "22201", "dep_exp": "313"},
    "machinery":  {"asset": "152",  "accum_dep": "22202", "dep_exp": "313"},
    "computers":  {"asset": "153",  "accum_dep": "22202", "dep_exp": "313"},
    "vehicles":   {"asset": "154",  "accum_dep": "22203", "dep_exp": "313"},
    "furniture":  {"asset": "155",  "accum_dep": "22204", "dep_exp": "333"},
    "intangible": {"asset": "156",  "accum_dep": "222",   "dep_exp": "333"},
    "land":       {"asset": "157",  "accum_dep": None,    "dep_exp": None},
    "wip":        {"asset": "14",   "accum_dep": None,    "dep_exp": None},
}


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class FixedAsset(BaseModel):
    """محرك الأصول الثابتة — Fixed Asset"""
    id:             str   = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id:     str
    asset_code:     str                          # رقم الأصل (AUTO or manual)
    asset_name:     str                          # اسم الأصل
    asset_type:     AssetType                    # نوع الأصل
    status:         AssetStatus = AssetStatus.WIP

    # ── الأرقام المالية ─────────────────────────────────────
    purchase_cost:  float                        # تكلفة الشراء
    salvage_value:  float = 0.0                  # القيمة التخريدية
    useful_life_years: Optional[float] = None   # العمر الإنتاجي (للقسط الثابت)

    # ── طرق الإهلاك ─────────────────────────────────────────
    dep_method:     DepreciationMethod = DepreciationMethod.STRAIGHT_LINE
    accounting_rate: Optional[float] = None     # نسبة الإهلاك المحاسبي
    tax_method:     Optional[str] = None        # طريقة الإهلاك الضريبي (auto from TAX_RULES)
    tax_rate:       Optional[float] = None      # نسبة الإهلاك الضريبي (auto from TAX_RULES)
    is_new_productive: bool = False              # جديد مستخدم في الإنتاج (للإهلاك المعجل 30%)

    # ── أرصدة متراكمة ──────────────────────────────────────
    accumulated_dep_accounting: float = 0.0    # مجمع الإهلاك المحاسبي
    accumulated_dep_tax:        float = 0.0    # مجمع الإهلاك الضريبي
    net_book_value:             float = 0.0    # القيمة الدفترية الصافية
    tax_book_value:             float = 0.0    # القيمة الدفترية الضريبية

    # ── التواريخ ─────────────────────────────────────────────
    purchase_date:      str                     # تاريخ الشراء
    commissioning_date: Optional[str] = None   # تاريخ التشغيل (يبدأ الإهلاك بعده)
    disposal_date:      Optional[str] = None   # تاريخ الاستبعاد

    # ── ربط بالمحاسبة ────────────────────────────────────────
    asset_account_code:   Optional[str] = None  # م/151 مباني مثلاً
    accum_dep_acc_code:   Optional[str] = None  # م/22201
    dep_expense_acc_code: Optional[str] = None  # م/313
    cost_center_id:       Optional[str] = None
    project_id:           Optional[str] = None

    # ── بيانات إضافية ────────────────────────────────────────
    serial_number:  Optional[str] = None
    location:       Optional[str] = None
    supplier_id:    Optional[str] = None
    purchase_invoice_id: Optional[str] = None
    description:    Optional[str] = None
    notes:          Optional[str] = None

    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: Optional[str] = None

    def get_depreciable_base(self) -> float:
        """القيمة القابلة للإهلاك = التكلفة - القيمة التخريدية"""
        return max(self.purchase_cost - self.salvage_value, 0)

    def get_annual_accounting_dep(self) -> float:
        """الإهلاك المحاسبي السنوي"""
        base = self.get_depreciable_base()
        if self.dep_method == DepreciationMethod.STRAIGHT_LINE:
            if self.accounting_rate:
                return round(base * self.accounting_rate, 2)
            if self.useful_life_years:
                return round(base / self.useful_life_years, 2)
        elif self.dep_method == DepreciationMethod.DECLINING_BALANCE:
            nbv = self.net_book_value if self.net_book_value > 0 else base
            if self.accounting_rate:
                return round(nbv * self.accounting_rate, 2)
        return 0.0

    def get_annual_tax_dep(self, year_of_use: int = 1) -> float:
        """
        الإهلاك الضريبي السنوي — قانون 91/2005 المادتان 25 و26
        year_of_use: سنة الاستخدام (1=أول سنة — للإهلاك المعجل)
        """
        rule = TAX_DEPRECIATION_RULES.get(self.asset_type.value, (None, 0.0, None))
        method, rate, accel_rate = rule

        if method is None or rate == 0:
            return 0.0

        if method == "straight_line":
            return round(self.purchase_cost * rate, 2)

        elif method == "declining_balance":
            # الإهلاك المعجل: 30% سنة أولى للآلات الجديدة المستخدمة في الإنتاج
            if year_of_use == 1 and self.is_new_productive and accel_rate:
                return round(self.purchase_cost * accel_rate, 2)
            # باقي السنوات: على أساس القيمة الدفترية الضريبية
            tax_base = self.tax_book_value if self.tax_book_value > 0 else self.purchase_cost
            return round(tax_base * rate, 2)

        return 0.0


class DepreciationEntry(BaseModel):
    """قيد الإهلاك الشهري / السنوي"""
    id:              str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id:      str
    asset_id:        str
    asset_name:      str
    period:          str                    # "2026-01" شهر/سنة
    dep_type:        str = "accounting"     # accounting | tax
    accounting_dep:  float = 0.0           # الإهلاك المحاسبي
    tax_dep:         float = 0.0           # الإهلاك الضريبي
    timing_diff:     float = 0.0           # الفرق الزمني (accounting - tax)
    journal_entry_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


class AssetDisposal(BaseModel):
    """قيد استبعاد / بيع الأصل"""
    id:              str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id:      str
    asset_id:        str
    disposal_date:   str
    disposal_type:   str = "sale"           # sale | scrapped | donation | exchange
    sale_proceeds:   float = 0.0            # عائد البيع
    net_book_value:  float = 0.0            # القيمة الدفترية الصافية
    gain_loss:       float = 0.0            # ربح أو (خسارة) رأسمالية
    journal_entry_id: Optional[str] = None
    notes:           Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
