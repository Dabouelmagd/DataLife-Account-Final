"""
Deferred Tax Engine — محرك الضريبة المؤجلة وضريبة أرباح الشركات
المعيار المحاسبي المصري 24 (EAS 24 / IAS 12)

معدل ضريبة الدخل المصري: 22.5% (قانون 91/2005 وتعديلاته)

الفروق المؤقتة الرئيسية:
1. فروق الإهلاك: المحاسبي (القسط الثابت) vs الضريبي (المتسارع)
2. المخصصات غير المعترف بها ضريبياً (ECL, نهاية الخدمة, قضايا)
3. فروق تقييم الأصول (إعادة التقييم، انخفاض القيمة)

الحسابات:
- الضريبة الجارية: مصروف × 22.5% على الربح الضريبي
- DTA: مخصصات × 22.5% (ستُخصَم ضريبياً مستقبلاً)
- DTL: فروق إهلاك × 22.5% (ستُضاف ضريبياً مستقبلاً)
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/deferred-tax", tags=["Deferred Tax EAS24"])

# ══════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════
EGYPTIAN_TAX_RATE = 0.225  # 22.5% — قانون الضريبة على الدخل 91/2005

# Account codes
ACC = {
    "dta":             "156",   # أصول ضريبية مؤجلة
    "tax_payable":     "2601",  # ضريبة أرباح مستحقة
    "dtl":             "2602",  # التزامات ضريبية مؤجلة
    "current_tax_exp": "3351",  # مصروف ضريبة الدخل الجارية
    "deferred_tax_exp":"3352",  # مصروف الضريبة المؤجلة
    "deferred_tax_inc":"4351",  # إيراد انعكاس ضريبة مؤجلة
    "retained":        "213",
    "bank":            "112",
}

# Non-deductible provisions (create DTA when charged, reverse when settled)
DTA_PROVISIONS = {
    "223":  "مخصص مكافأة نهاية الخدمة",
    "224":  "مخصص خسائر ائتمانية ECL",
    "226":  "مخصص هبوط قيمة مخزون",
    "227":  "مخصص قضايا والتزامات محتملة",
}

# Depreciation: tax rates per asset type (قانون 91/2005 م.25)
TAX_DEPRECIATION_RATES = {
    "buildings":   0.05,   # 5%  المباني
    "machines":    0.10,   # 10% آلات ومعدات (القسط المتناقص)
    "vehicles":    0.10,   # 10% سيارات
    "furniture":   0.25,   # 25% أثاث
    "computers":   1.00,   # 100% حاسبات ومعدات تقنية (سنة واحدة)
    "other":       0.10,   # 10% أخرى
}


async def get_acc(company_id: str, code: str) -> dict:
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit": round(debit, 2), "credit": round(credit, 2),
        "description": desc,
    }


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None) -> str:
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="manual", source_document_id=src_id,
        created_by=user_id,
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], user_id)
    return result["id"]


# ══════════════════════════════════════════════════════════════
# 1. CURRENT INCOME TAX — ضريبة الدخل الجارية
# ══════════════════════════════════════════════════════════════

class CurrentTaxRequest(BaseModel):
    fiscal_year:       int
    accounting_profit: float  # الربح المحاسبي (من قائمة الدخل)
    # Adjustments to reach taxable income
    add_back_provisions:    float = 0.0   # مخصصات غير معترف بها ضريبياً (تُضاف)
    add_back_depreciation:  float = 0.0   # إهلاك محاسبي يُلغى ويُستعاض عنه بالضريبي
    tax_depreciation:       float = 0.0   # الإهلاك الضريبي المسموح (يُخصَم)
    add_back_penalties:     float = 0.0   # غرامات وعقوبات غير مقبولة ضريبياً
    other_add_backs:        float = 0.0   # إضافات أخرى
    other_deductions:       float = 0.0   # خصومات أخرى مسموحة
    prior_year_losses:      float = 0.0   # خسائر سنوات سابقة مُرحَّلة
    date_str:          str
    notes:             Optional[str] = None


@router.post("/current-tax")
async def calculate_current_tax(
    req: CurrentTaxRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    احتساب وتسجيل ضريبة الدخل الجارية

    الربح الضريبي = الربح المحاسبي
                   + المخصصات غير المعترف بها
                   + الإهلاك المحاسبي (يُلغى)
                   - الإهلاك الضريبي (يُستبدَل)
                   + غرامات غير مقبولة
                   - خسائر سنوات سابقة
                   ─────────────────────────
                   = وعاء الضريبة

    الضريبة المستحقة = وعاء × 22.5%

    القيد:
    Dr م/3351 مصروف ضريبة الدخل الجارية
    Cr م/2601 ضريبة أرباح تجارية وصناعية مستحقة
    """
    company_id = current_user["company_id"]
    tax_id     = str(uuid.uuid4())

    # ── حساب الربح الضريبي ───────────────────────────────────
    taxable_income = (
        req.accounting_profit
        + req.add_back_provisions    # مخصصات → تُضاف
        + req.add_back_depreciation  # إهلاك محاسبي → يُلغى ويُضاف
        - req.tax_depreciation       # إهلاك ضريبي → يُخصَم
        + req.add_back_penalties     # غرامات → تُضاف
        + req.other_add_backs
        - req.other_deductions
        - req.prior_year_losses      # خسائر سابقة → تُخصَم
    )
    taxable_income = round(max(taxable_income, 0), 2)  # لا ضريبة على خسارة

    current_tax = round(taxable_income * EGYPTIAN_TAX_RATE, 2)
    effective_rate = round(current_tax / req.accounting_profit * 100, 2) \
                     if req.accounting_profit > 0 else 0

    je_id = None
    if current_tax > 0:
        lines = await asyncio.gather(
            je_line(company_id, ACC["current_tax_exp"], debit=current_tax,
                    desc=f"ضريبة دخل جارية {req.fiscal_year} — وعاء {taxable_income:,.0f} × 22.5%"),
            je_line(company_id, ACC["tax_payable"], credit=current_tax,
                    desc=f"ضريبة أرباح تجارية وصناعية مستحقة — {req.fiscal_year}"),
        )
        je_id = await post_je(company_id, current_user["user_id"], req.date_str,
            f"ضريبة الدخل الجارية {req.fiscal_year}", list(lines), tax_id)

    # Save record
    record = {
        "id":              tax_id,
        "company_id":      company_id,
        "fiscal_year":     req.fiscal_year,
        "type":            "current_tax",
        "accounting_profit": req.accounting_profit,
        "adjustments": {
            "add_provisions":     req.add_back_provisions,
            "add_accounting_dep": req.add_back_depreciation,
            "deduct_tax_dep":     req.tax_depreciation,
            "add_penalties":      req.add_back_penalties,
            "other_add_backs":    req.other_add_backs,
            "other_deductions":   req.other_deductions,
            "prior_losses":       req.prior_year_losses,
        },
        "taxable_income":  taxable_income,
        "tax_rate":        f"{EGYPTIAN_TAX_RATE*100:.1f}%",
        "current_tax":     current_tax,
        "effective_rate":  f"{effective_rate:.2f}%",
        "journal_entry_id": je_id,
        "notes":           req.notes,
        "date":            req.date_str,
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.deferred_tax_records.insert_one(record)
    record.pop("_id", None)

    return {
        "message":        f"✅ تم احتساب ضريبة الدخل الجارية {req.fiscal_year}",
        "calculation": {
            "accounting_profit": req.accounting_profit,
            "add_back_provisions": req.add_back_provisions,
            "add_back_dep_accounting": req.add_back_depreciation,
            "deduct_dep_tax":   req.tax_depreciation,
            "add_penalties":    req.add_back_penalties,
            "deduct_prior_losses": req.prior_year_losses,
            "taxable_income":   taxable_income,
            "tax_rate":         f"{EGYPTIAN_TAX_RATE*100:.1f}%",
            "current_tax":      current_tax,
            "effective_rate":   f"{effective_rate:.2f}%",
        },
        "journal": {
            "id":     je_id,
            "debit":  f"م/{ACC['current_tax_exp']} مصروف ضريبة جارية  {current_tax:,.2f}",
            "credit": f"م/{ACC['tax_payable']} ضريبة أرباح مستحقة     {current_tax:,.2f}",
        },
        "law": "قانون الضريبة على الدخل 91/2005 — معدل 22.5%",
        "record": record,
    }


# ══════════════════════════════════════════════════════════════
# 2. DEFERRED TAX ASSET — الأصل الضريبي المؤجل
#    ينشأ عند المخصصات غير المعترف بها ضريبياً
# ══════════════════════════════════════════════════════════════

class DTARequest(BaseModel):
    fiscal_year:   int
    date_str:      str
    provisions: List[dict]
    # [{account_code, name, amount, provision_type}]
    # Provision types: ecl | gratuity | inventory | contingency | other
    notes:         Optional[str] = None


@router.post("/deferred-tax-asset")
async def create_dta(
    req: DTARequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إثبات أصل ضريبي مؤجل (Deferred Tax Asset)

    ينشأ عند تحميل مخصصات لا يعترف بها القانون الضريبي الآن
    لكنها ستُخصَم ضريبياً في المستقبل عند التحقق الفعلي

    أمثلة:
    - مخصص مكافأة نهاية الخدمة: لا يُخصَم ضريبياً إلا عند الصرف
    - مخصص ECL: لا يُخصَم إلا عند الإعدام الفعلي
    - مخصص قضايا: لا يُخصَم إلا عند الحكم النهائي

    الفرق المؤقت = المبلغ المحمَّل محاسبياً (غير معترف به ضريبياً الآن)
    DTA = الفرق المؤقت × 22.5%

    القيد:
    Dr م/156 أصول ضريبية مؤجلة
    Cr م/4351 إيراد ضريبة مؤجلة (يُخفِّض مصروف الضريبة الإجمالي)
    """
    company_id = current_user["company_id"]
    dta_id     = str(uuid.uuid4())

    total_temporary_diff = round(sum(float(p.get("amount",0)) for p in req.provisions), 2)
    total_dta            = round(total_temporary_diff * EGYPTIAN_TAX_RATE, 2)

    if total_dta <= 0:
        raise HTTPException(400, "مجموع الفروق المؤقتة يجب أن يكون موجباً")

    # Get existing DTA balance
    existing = await db.deferred_tax_records.find_one(
        {"company_id": company_id, "fiscal_year": req.fiscal_year,
         "type": "dta"}, {"_id": 0}
    )
    existing_dta   = float(existing.get("dta_amount", 0)) if existing else 0.0
    dta_adjustment = round(total_dta - existing_dta, 2)

    je_id = None
    if abs(dta_adjustment) > 0.01:
        if dta_adjustment > 0:
            # Increase DTA — Dr DTA | Cr Deferred Tax Income
            lines = await asyncio.gather(
                je_line(company_id, ACC["dta"], debit=dta_adjustment,
                        desc=f"أصل ضريبي مؤجل — فروق مؤقتة {req.fiscal_year}"),
                je_line(company_id, ACC["deferred_tax_inc"], credit=dta_adjustment,
                        desc=f"إيراد ضريبة مؤجلة — انعكاس مستقبلي للضريبة"),
            )
        else:
            # Decrease DTA (provisions settled) — Dr Deferred Tax Exp | Cr DTA
            lines = await asyncio.gather(
                je_line(company_id, ACC["deferred_tax_exp"], debit=abs(dta_adjustment),
                        desc=f"انعكاس أصل ضريبي مؤجل — {req.fiscal_year}"),
                je_line(company_id, ACC["dta"], credit=abs(dta_adjustment),
                        desc=f"تخفيض أصل ضريبي مؤجل"),
            )
        je_id = await post_je(company_id, current_user["user_id"], req.date_str,
            f"أصل ضريبي مؤجل (DTA) — {req.fiscal_year}", list(lines), dta_id)

    # Breakdown per provision type
    provisions_detail = []
    for p in req.provisions:
        amt  = float(p.get("amount", 0))
        dta_p = round(amt * EGYPTIAN_TAX_RATE, 2)
        provisions_detail.append({
            "account_code":    p.get("account_code",""),
            "provision_name":  p.get("name", DTA_PROVISIONS.get(p.get("account_code",""),"")),
            "provision_type":  p.get("provision_type","other"),
            "temporary_diff":  amt,
            "dta_amount":      dta_p,
            "tax_rate":        f"{EGYPTIAN_TAX_RATE*100:.1f}%",
            "note":            "سيُخصَم ضريبياً عند التحقق الفعلي",
        })

    record = {
        "id":              dta_id, "company_id": company_id,
        "fiscal_year":     req.fiscal_year, "type": "dta",
        "date":            req.date_str,
        "provisions":      provisions_detail,
        "total_temporary_diff": total_temporary_diff,
        "tax_rate":        EGYPTIAN_TAX_RATE,
        "dta_amount":      total_dta,
        "prior_dta":       existing_dta,
        "adjustment":      dta_adjustment,
        "journal_entry_id": je_id,
        "notes":           req.notes,
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.deferred_tax_records.replace_one(
        {"company_id": company_id, "fiscal_year": req.fiscal_year, "type": "dta"},
        record, upsert=True
    )
    record.pop("_id", None)

    return {
        "message": f"✅ تم إثبات الأصل الضريبي المؤجل — {req.fiscal_year}",
        "provisions_detail": provisions_detail,
        "summary": {
            "total_temporary_differences": total_temporary_diff,
            "tax_rate":       f"{EGYPTIAN_TAX_RATE*100:.1f}%",
            "total_dta":      total_dta,
            "prior_dta":      existing_dta,
            "adjustment":     dta_adjustment,
        },
        "journal": {
            "id":     je_id,
            "debit":  f"م/{ACC['dta']} أصول ضريبية مؤجلة  {dta_adjustment:,.2f}",
            "credit": f"م/{ACC['deferred_tax_inc']} إيراد ضريبة مؤجلة  {dta_adjustment:,.2f}",
        } if dta_adjustment > 0 else {
            "id":     je_id,
            "debit":  f"م/{ACC['deferred_tax_exp']} مصروف ضريبة مؤجلة  {abs(dta_adjustment):,.2f}",
            "credit": f"م/{ACC['dta']} أصول ضريبية مؤجلة  {abs(dta_adjustment):,.2f}",
        },
        "standard": "EAS 24 / IAS 12 — Deferred Tax Asset",
        "record":    record,
    }


# ══════════════════════════════════════════════════════════════
# 3. DEFERRED TAX LIABILITY — الالتزام الضريبي المؤجل
#    ينشأ عند الإهلاك الضريبي المتسارع
# ══════════════════════════════════════════════════════════════

class DTLRequest(BaseModel):
    fiscal_year:       int
    date_str:          str
    assets: List[dict]
    # [{asset_name, asset_type, cost, accounting_dep, tax_dep_rate_override?}]
    notes:             Optional[str] = None


@router.post("/deferred-tax-liability")
async def create_dtl(
    req: DTLRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إثبات التزام ضريبي مؤجل (Deferred Tax Liability)

    ينشأ عند استخدام إهلاك ضريبي أعلى من المحاسبي
    (الإهلاك الضريبي المتسارع بموجب قانون 91/2005 م.25)

    الفرق المؤقت = الإهلاك الضريبي - الإهلاك المحاسبي
    DTL = الفرق المؤقت × 22.5%

    القيد:
    Dr م/3352 مصروف ضريبة مؤجلة (يُثقِّل ضريبة الدخل الإجمالية)
    Cr م/2602 التزامات ضريبية مؤجلة
    """
    company_id = current_user["company_id"]
    dtl_id     = str(uuid.uuid4())

    assets_detail = []
    total_temp_diff = 0.0

    for asset in req.assets:
        cost       = float(asset.get("cost", 0))
        acc_dep    = float(asset.get("accounting_dep", 0))
        asset_type = asset.get("asset_type", "other")

        # Tax depreciation rate from law (or override)
        tax_rate   = float(asset.get("tax_dep_rate_override") or
                           TAX_DEPRECIATION_RATES.get(asset_type, 0.10))
        tax_dep    = round(cost * tax_rate, 2)

        # For computers: 100% first year → full cost deductible
        if asset_type == "computers":
            tax_dep = cost

        temp_diff  = round(tax_dep - acc_dep, 2)  # + means DTL
        dtl_asset  = round(max(temp_diff, 0) * EGYPTIAN_TAX_RATE, 2)
        dta_asset  = round(max(-temp_diff, 0) * EGYPTIAN_TAX_RATE, 2)  # if acc_dep > tax_dep

        assets_detail.append({
            "asset_name":       asset.get("asset_name",""),
            "asset_type":       asset_type,
            "cost":             cost,
            "accounting_dep":   acc_dep,
            "tax_dep_rate":     f"{tax_rate*100:.0f}%",
            "tax_dep":          tax_dep,
            "temp_difference":  temp_diff,
            "dtl_amount":       dtl_asset,
            "dta_amount":       dta_asset,
            "note":             (
                "فرق مؤقت موجب → التزام ضريبي مؤجل (إهلاك ضريبي > محاسبي)"
                if temp_diff > 0 else
                "فرق مؤقت سالب → أصل ضريبي مؤجل (إهلاك محاسبي > ضريبي)"
                if temp_diff < 0 else "لا فرق"
            ),
        })
        total_temp_diff += temp_diff

    total_dtl = round(max(total_temp_diff, 0) * EGYPTIAN_TAX_RATE, 2)
    total_dta  = round(max(-total_temp_diff, 0) * EGYPTIAN_TAX_RATE, 2)
    net_deferred = round(total_dtl - total_dta, 2)  # positive = net liability

    # Get prior year balance
    existing = await db.deferred_tax_records.find_one(
        {"company_id": company_id, "fiscal_year": req.fiscal_year, "type": "dtl"},
        {"_id": 0}
    )
    prior_dtl  = float(existing.get("dtl_amount", 0)) if existing else 0.0
    adjustment = round(net_deferred - prior_dtl, 2)

    je_id = None
    if abs(adjustment) > 0.01:
        if adjustment > 0:
            # Increase DTL
            lines = await asyncio.gather(
                je_line(company_id, ACC["deferred_tax_exp"], debit=adjustment,
                        desc=f"مصروف ضريبة مؤجلة — فرق إهلاك ضريبي {req.fiscal_year}"),
                je_line(company_id, ACC["dtl"], credit=adjustment,
                        desc=f"التزام ضريبي مؤجل — إهلاك ضريبي متسارع"),
            )
        else:
            # Decrease DTL (reversal)
            lines = await asyncio.gather(
                je_line(company_id, ACC["dtl"], debit=abs(adjustment),
                        desc=f"انعكاس التزام ضريبي مؤجل — {req.fiscal_year}"),
                je_line(company_id, ACC["deferred_tax_exp"], credit=abs(adjustment),
                        desc=f"إيراد انعكاس ضريبة مؤجلة — {req.fiscal_year}"),
            )
        je_id = await post_je(company_id, current_user["user_id"], req.date_str,
            f"التزام ضريبي مؤجل (DTL) — {req.fiscal_year}", list(lines), dtl_id)

    record = {
        "id": dtl_id, "company_id": company_id,
        "fiscal_year": req.fiscal_year, "type": "dtl",
        "date": req.date_str,
        "assets": assets_detail,
        "total_temp_diff": round(total_temp_diff, 2),
        "tax_rate":        EGYPTIAN_TAX_RATE,
        "dtl_amount":      total_dtl,
        "net_deferred":    net_deferred,
        "prior_dtl":       prior_dtl,
        "adjustment":      adjustment,
        "journal_entry_id": je_id,
        "notes":           req.notes,
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.deferred_tax_records.replace_one(
        {"company_id": company_id, "fiscal_year": req.fiscal_year, "type": "dtl"},
        record, upsert=True
    )
    record.pop("_id", None)

    return {
        "message":    f"✅ تم إثبات الالتزام الضريبي المؤجل — {req.fiscal_year}",
        "assets_detail": assets_detail,
        "summary": {
            "total_temp_diff": round(total_temp_diff, 2),
            "dtl_gross":       total_dtl,
            "dta_gross":       total_dta,
            "net_deferred":    net_deferred,
            "adjustment":      adjustment,
            "tax_rate":        f"{EGYPTIAN_TAX_RATE*100:.1f}%",
        },
        "journal": {
            "id":     je_id,
            "debit":  f"م/{ACC['deferred_tax_exp']} مصروف ضريبة مؤجلة  {abs(adjustment):,.2f}",
            "credit": f"م/{ACC['dtl']} التزامات ضريبية مؤجلة            {abs(adjustment):,.2f}",
        } if adjustment > 0 else {
            "id":     je_id,
            "note":   "انعكاس التزام ضريبي",
            "debit":  f"م/{ACC['dtl']} التزامات ضريبية مؤجلة  {abs(adjustment):,.2f}",
            "credit": f"م/{ACC['deferred_tax_exp']} إيراد انعكاس  {abs(adjustment):,.2f}",
        },
        "standard": "EAS 24 / IAS 12 — Deferred Tax Liability",
        "tax_rates_reference": TAX_DEPRECIATION_RATES,
        "record":   record,
    }


# ══════════════════════════════════════════════════════════════
# 4. FULL TAX DISCLOSURE — الإفصاح الضريبي الكامل
# ══════════════════════════════════════════════════════════════

@router.get("/disclosure/{fiscal_year}")
async def tax_disclosure(
    fiscal_year: int,
    current_user: dict = Depends(get_current_user)
):
    """
    الإفصاح الكامل عن ضريبة الدخل (EAS 24)
    يُظهر: الضريبة الجارية + المؤجلة + التسوية مع المعدل الفعلي
    """
    company_id = current_user["company_id"]

    records = await db.deferred_tax_records.find(
        {"company_id": company_id, "fiscal_year": fiscal_year}, {"_id": 0}
    ).to_list(None)

    current = next((r for r in records if r["type"] == "current_tax"), {})
    dta     = next((r for r in records if r["type"] == "dta"),          {})
    dtl     = next((r for r in records if r["type"] == "dtl"),          {})

    accounting_profit = float(current.get("accounting_profit", 0))
    current_tax_exp   = float(current.get("current_tax", 0))
    dta_income        = float(dta.get("dta_amount", 0))      # يُخفِّض الضريبة
    dtl_expense       = float(dtl.get("net_deferred", 0))    # يزيد الضريبة
    total_tax_expense = round(current_tax_exp - dta_income + dtl_expense, 2)
    effective_rate    = round(total_tax_expense / accounting_profit * 100, 2) \
                        if accounting_profit > 0 else 0
    statutory_rate    = EGYPTIAN_TAX_RATE * 100

    return {
        "fiscal_year":    fiscal_year,
        "standard":       "EAS 24 / IAS 12 — إفصاح ضريبة الدخل",
        "statutory_rate": f"{statutory_rate:.1f}%",
        "tax_expense_components": {
            "current_tax":       current_tax_exp,
            "deferred_tax_dta":  round(-dta_income, 2),  # negative = benefit
            "deferred_tax_dtl":  dtl_expense,
            "total_tax_expense": total_tax_expense,
        },
        "balance_sheet": {
            "deferred_tax_asset":    float(dta.get("dta_amount", 0)),
            "deferred_tax_liability": float(dtl.get("dtl_amount", 0)),
            "net_deferred_position": round(
                float(dta.get("dta_amount",0)) - float(dtl.get("dtl_amount",0)), 2),
        },
        "rate_reconciliation": {
            "accounting_profit":     accounting_profit,
            "statutory_rate":        f"{statutory_rate:.1f}%",
            "expected_tax":          round(accounting_profit * EGYPTIAN_TAX_RATE, 2),
            "actual_tax_expense":    total_tax_expense,
            "effective_rate":        f"{effective_rate:.2f}%",
            "difference_reason": (
                "فروق مؤقتة ناشئة عن إهلاك متسارع ومخصصات"
                if abs(effective_rate - statutory_rate) > 0.5
                else "المعدل الفعلي مقارب للمعدل النظامي"
            ),
        },
        "temporary_differences": {
            "dta_sources":  dta.get("provisions", []),
            "dtl_sources":  dtl.get("assets", []),
        },
        "current_tax_detail": current.get("adjustments", {}),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/pay-tax")
async def pay_income_tax(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    سداد ضريبة الدخل لمصلحة الضرائب

    Dr م/2601 ضريبة أرباح تجارية مستحقة
    Cr م/112 البنك
    """
    company_id = current_user["company_id"]
    amount     = float(data.get("amount", 0))
    date_str   = data.get("date", date.today().isoformat())
    year       = data.get("fiscal_year", date.today().year)

    if amount <= 0:
        raise HTTPException(400, "مبلغ السداد يجب أن يكون موجباً")

    lines = await asyncio.gather(
        je_line(company_id, ACC["tax_payable"], debit=amount,
                desc=f"سداد ضريبة أرباح تجارية وصناعية — {year}"),
        je_line(company_id, ACC["bank"], credit=amount,
                desc=f"تحويل بنكي لمصلحة الضرائب — {year}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"سداد ضريبة الدخل {year}", list(lines))

    return {
        "message":  f"✅ تم تسجيل سداد ضريبة الدخل {amount:,.2f} ج.م",
        "year":     year,
        "journal":  {"id": je_id,
                     "debit":  f"م/{ACC['tax_payable']} ضريبة مستحقة  {amount:,.2f}",
                     "credit": f"م/{ACC['bank']} البنك                  {amount:,.2f}"},
    }


@router.get("/records/{fiscal_year}")
async def list_tax_records(
    fiscal_year: int,
    current_user: dict = Depends(get_current_user)
):
    records = await db.deferred_tax_records.find(
        {"company_id": current_user["company_id"], "fiscal_year": fiscal_year},
        {"_id": 0}
    ).to_list(None)
    return {"fiscal_year": fiscal_year, "records": records, "count": len(records)}
