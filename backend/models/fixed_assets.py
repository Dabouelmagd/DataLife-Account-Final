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
    SOFTWARE        = "software"         # برامج ونظم معلومات (50% ضريبياً)
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
    # asset_type → (method, rate, first_year_allowance)
    # Art. 25: buildings 5% SL; intangibles 10% SL; computers, information
    # systems and software 50% declining; every other asset 25% declining.
    # Art. 27: new machinery/equipment used in production get an EXTRA 30% of
    # cost in their first year — deducted first, the 25% then applies to the
    # remaining 70% (year 1 = 30% + 70% × 25% = 47.5% of cost).
    "buildings":   ("straight_line",    0.05,  None),    # 5% قسط ثابت
    "intangible":  ("straight_line",    0.10,  None),    # 10% قسط ثابت
    "goodwill":    ("straight_line",    0.10,  None),    # legacy key — أصل معنوي
    "computers":   ("declining_balance", 0.50,  None),   # 50% متناقص
    "software":    ("declining_balance", 0.50,  None),   # برامج ونظم معلومات 50%
    "machinery":   ("declining_balance", 0.25,  0.30),   # 25% متناقص + 30% إضافية سنة أولى (آلات جديدة)
    "vehicles":    ("declining_balance", 0.25,  None),   # 25% متناقص
    "furniture":   ("declining_balance", 0.25,  None),   # 25% متناقص
    "leasehold":   ("declining_balance", 0.25,  None),   # legacy key — باقي الأصول
    "other":       ("declining_balance", 0.25,  None),   # باقي الأصول 25%
    "land":        (None,               0.00,  None),    # لا إهلاك
    "wip":         (None,               0.00,  None),    # لا إهلاك حتى التشغيل
}

# Account codes — must match DEFAULT_ACCOUNTS in models/accounting.py.
# The old map pointed at 151-157, which in the chart are "أوراق مالية متداولة"
# (151), "أصول العقود" (152) and codes that do not exist (153-157): a building
# was posted as marketable securities and most purchases failed. Fixed assets
# live under 11 (112-116, land 11101); accumulated depreciation under 222.
# 222 itself is a header (no postings), so intangibles get their own codes
# (117 / 22205) — those are not in the default chart yet, and posting is
# refused with a clear message until they are added (or the user picks a code).
ASSET_ACCOUNTS = {
    "buildings":  {"asset": "112",   "accum_dep": "22201", "dep_exp": "333"},
    "machinery":  {"asset": "114",   "accum_dep": "22202", "dep_exp": "313"},   # production → cost of activity
    "computers":  {"asset": "116",   "accum_dep": "22204", "dep_exp": "333"},   # 22204 = أثاث وأجهزة
    "software":   {"asset": "116",   "accum_dep": "22204", "dep_exp": "333"},
    "vehicles":   {"asset": "113",   "accum_dep": "22203", "dep_exp": "333"},
    "furniture":  {"asset": "115",   "accum_dep": "22204", "dep_exp": "333"},
    "intangible": {"asset": "117",   "accum_dep": "22205", "dep_exp": "333"},
    "land":       {"asset": "11101", "accum_dep": None,    "dep_exp": None},   # 111 is a header
    "wip":        {"asset": "1491",   "accum_dep": None,    "dep_exp": None},
}

# Fixed assets bought but not yet in use. "14" is a header in the chart (it
# refuses postings) and 142 is real-estate development, so a dedicated child
# account is needed; until it exists only "ready for use" purchases can post.
WIP_ACCOUNT_CODE = "1491"   # 143 is the contracting pack's unbilled revenue

# Assets created by the older /api/financial/assets screen share the same
# collection with other type keys; map them so they still depreciate/dispose.
LEGACY_TYPE_ACCOUNTS = {
    "software":  {"asset": "116", "accum_dep": "22204", "dep_exp": "333"},
    "goodwill":  {"asset": "116", "accum_dep": "22204", "dep_exp": "333"},
    "leasehold": {"asset": "115", "accum_dep": "22204", "dep_exp": "333"},
    "other":     {"asset": "116", "accum_dep": "22204", "dep_exp": "333"},
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
            # الإهلاك الإضافي 30% سنة أولى للآلات الجديدة — إضافةً إلى الـ25% على الباقي
            if year_of_use == 1 and self.is_new_productive and accel_rate:
                allowance = self.purchase_cost * accel_rate
                return round(allowance + (self.purchase_cost - allowance) * rate, 2)
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
    catchup_depreciation: float = 0.0       # إهلاك حتى تاريخ الاستبعاد رُحِّل مع الاستبعاد
    accumulated_dep_tax: float = 0.0        # مجمع الإهلاك الضريبي عند الاستبعاد
    tax_book_value:  float = 0.0            # الأساس الضريبي عند الاستبعاد
    tax_gain_loss:   float = 0.0            # ربح/(خسارة) ضريبية = العائد − الأساس الضريبي
    journal_entry_id: Optional[str] = None
    notes:           Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
