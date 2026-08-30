"""
Fixed Assets Engine API — محرك الأصول الثابتة
قانون الضرائب المصري 91/2005 المادتان 25 و26
"""
import uuid, asyncio
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query

from database import db
from api.users import get_current_user
from models.fixed_assets import (
    FixedAsset, DepreciationEntry, AssetDisposal,
    AssetType, DepreciationMethod, AssetStatus,
    TAX_DEPRECIATION_RULES, ASSET_ACCOUNTS
)
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/fixed-assets", tags=["Fixed Assets"])


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

async def get_account(company_id: str, code: str):
    """Get account by code for journal lines"""
    return await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )


async def make_je_line(company_id: str, code: str, name_fallback: str,
                       debit: float = 0, credit: float = 0, desc: str = "") -> dict:
    acc = await get_account(company_id, code)
    return {
        "line_id":       str(uuid.uuid4()),
        "account_id":    acc["id"] if acc else code,
        "account_code":  code,
        "account_name":  acc["account_name"] if acc else name_fallback,
        "debit":  debit,
        "credit": credit,
        "description": desc,
    }


# ══════════════════════════════════════════════════════════════
# ASSET COUNTER
# ══════════════════════════════════════════════════════════════

async def next_asset_code(company_id: str, asset_type: str) -> str:
    """Generate sequential asset code: BLDG-0001, MACH-0001, etc."""
    PREFIX = {
        "buildings": "BLDG", "machinery": "MACH", "computers": "COMP",
        "vehicles": "VEH",  "furniture": "FURN", "intangible": "INTA",
        "land": "LAND",     "wip": "WIP",
    }
    prefix = PREFIX.get(asset_type, "ASST")
    counter = await db.asset_counters.find_one_and_update(
        {"company_id": company_id, "asset_type": asset_type},
        {"$inc": {"last_number": 1}},
        upsert=True, return_document=True
    )
    return f"{prefix}-{counter['last_number']:04d}"


# ══════════════════════════════════════════════════════════════
# 1. PURCHASE ASSET — قيد شراء الأصل
# ══════════════════════════════════════════════════════════════

@router.post("/")
async def create_fixed_asset(data: dict, current_user: dict = Depends(get_current_user)):
    """
    شراء أصل ثابت وإضافته — القيد المحاسبي:

    أ. عند الشراء (قيد تحت التنفيذ WIP):
       مدين: مشروعات تحت التنفيذ م/14
       دائن: البنك / الموردون

    ب. عند التشغيل (تحويل لأصل ثابت):
       مدين: الأصل الثابت م/151-157
       دائن: مشروعات تحت التنفيذ م/14
    """
    company_id = current_user["company_id"]
    asset_type = data.get("asset_type", "machinery")

    # ── Auto-fill tax rules ──────────────────────────────────
    rule = TAX_DEPRECIATION_RULES.get(asset_type, (None, 0.0, None))
    tax_method, tax_rate, _ = rule

    acc_codes = ASSET_ACCOUNTS.get(asset_type, ASSET_ACCOUNTS["machinery"])

    asset = FixedAsset(
        company_id            = company_id,
        asset_code            = await next_asset_code(company_id, asset_type),
        asset_type            = AssetType(asset_type),
        asset_account_code    = acc_codes["asset"],
        accum_dep_acc_code    = acc_codes["accum_dep"],
        dep_expense_acc_code  = acc_codes["dep_exp"],
        tax_method            = tax_method,
        tax_rate              = tax_rate,
        net_book_value        = data.get("purchase_cost", 0),
        tax_book_value        = data.get("purchase_cost", 0),
        **{k: v for k, v in data.items()
           if k not in ("asset_type", "company_id")}
    )

    await db.fixed_assets.insert_one(asset.dict())
    asset_dict = asset.dict(); asset_dict.pop("_id", None)

    # ── Purchase Journal Entry ──────────────────────────────
    purchase_cost = float(data.get("purchase_cost", 0))
    payment_method = data.get("payment_method", "bank")  # bank | credit
    bank_code   = "112"   # البنك
    creditor_code = "251"  # الموردون

    # القيد أ: شراء وإضافة للمشروعات تحت التنفيذ
    wip_code = "14"
    pay_line_code = bank_code if payment_method == "bank" else creditor_code
    pay_line_name = "البنك" if payment_method == "bank" else "الموردون"

    lines = await asyncio.gather(
        make_je_line(company_id, wip_code,      "مشروعات تحت التنفيذ",
                     debit=purchase_cost, desc=f"شراء {asset.asset_name} — إضافة للأصول"),
        make_je_line(company_id, pay_line_code, pay_line_name,
                     credit=purchase_cost, desc=f"سداد تكلفة {asset.asset_name}"),
    )

    svc = AccountingService(db)
    entry = JournalEntry(
        company_id           = company_id,
        entry_number         = 0,
        entry_date           = data.get("purchase_date", datetime.now().strftime("%Y-%m-%d")),
        description          = f"شراء أصل: {asset.asset_name} — {asset.asset_code}",
        lines                = lines,
        source_document_type = "manual",
        source_document_id   = asset.id,
        created_by           = current_user["user_id"],
    )
    je_result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(je_result["id"], current_user["user_id"])

    # Update asset with journal entry id
    await db.fixed_assets.update_one(
        {"id": asset.id},
        {"$set": {"purchase_journal_id": je_result["id"]}}
    )

    return {
        "message":   "تم تسجيل الأصل الثابت بنجاح",
        "asset":     asset_dict,
        "tax_info": {
            "tax_method":    tax_method,
            "tax_rate_pct":  f"{tax_rate*100:.0f}%" if tax_rate else "لا إهلاك",
            "is_accelerated": asset.is_new_productive and asset_type == "machinery",
        },
        "journal_entry_id": je_result["id"],
    }


# ══════════════════════════════════════════════════════════════
# 2. COMMISSION ASSET — قيد تحويل من تحت التنفيذ للأصول
# ══════════════════════════════════════════════════════════════

@router.put("/{asset_id}/commission")
async def commission_asset(
    asset_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    تشغيل الأصل (الانتقال من WIP للإنتاج):
    مدين: الأصل الثابت م/151-157
    دائن: مشروعات تحت التنفيذ م/14
    """
    company_id = current_user["company_id"]
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": company_id}, {"_id": 0}
    )
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    if asset.get("status") == AssetStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="الأصل مُشغَّل بالفعل")

    commission_date = data.get("date", datetime.now().strftime("%Y-%m-%d"))

    # Journal: WIP → Fixed Asset
    cost = float(asset["purchase_cost"])
    lines = await asyncio.gather(
        make_je_line(company_id, asset["asset_account_code"], f"أصل: {asset['asset_name']}",
                     debit=cost, desc=f"تشغيل الأصل {asset['asset_name']}"),
        make_je_line(company_id, "14", "مشروعات تحت التنفيذ",
                     credit=cost, desc=f"إقفال تحت التنفيذ — {asset['asset_name']}"),
    )

    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=commission_date,
        description=f"تشغيل الأصل: {asset['asset_name']} — {asset['asset_code']}",
        lines=lines, source_document_type="manual",
        source_document_id=asset_id, created_by=current_user["user_id"],
    )
    je_result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(je_result["id"], current_user["user_id"])

    # Update asset status
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {
            "status":             AssetStatus.ACTIVE,
            "commissioning_date": commission_date,
            "commission_je_id":   je_result["id"],
            "updated_at":         datetime.now(timezone.utc).isoformat(),
        }}
    )

    return {"message": "تم تشغيل الأصل وبدء الإهلاك", "journal_entry_id": je_result["id"]}


# ══════════════════════════════════════════════════════════════
# 3. DEPRECIATION ENGINE — محرك الإهلاك
# ══════════════════════════════════════════════════════════════

def calc_accounting_dep(asset: dict, months: int = 12) -> float:
    """حساب الإهلاك المحاسبي (سنوي أو شهري)"""
    cost    = float(asset.get("purchase_cost", 0))
    salvage = float(asset.get("salvage_value", 0))
    base    = max(cost - salvage, 0)
    method  = asset.get("dep_method", "straight_line")
    rate    = float(asset.get("accounting_rate") or 0)
    life    = float(asset.get("useful_life_years") or 0)
    nbv     = float(asset.get("net_book_value", base))
    accum   = float(asset.get("accumulated_dep_accounting", 0))

    if method == "straight_line":
        annual = base * rate if rate else (base / life if life else 0)
    elif method == "declining_balance":
        annual = nbv * rate if rate else 0
    else:
        annual = 0

    # Don't over-depreciate
    remaining = base - accum
    annual = min(annual, remaining)
    monthly = round(annual / 12, 2)
    return round(monthly * months, 2) if months != 12 else round(annual, 2)


def calc_tax_dep(asset: dict, year_of_use: int = 1) -> float:
    """
    حساب الإهلاك الضريبي — قانون 91/2005 م.25-26
    """
    asset_type = asset.get("asset_type", "machinery")
    cost       = float(asset.get("purchase_cost", 0))
    tax_bv     = float(asset.get("tax_book_value", cost))
    is_new     = bool(asset.get("is_new_productive", False))
    accum_tax  = float(asset.get("accumulated_dep_tax", 0))

    rule = TAX_DEPRECIATION_RULES.get(asset_type, (None, 0.0, None))
    method, rate, accel = rule

    if method is None or rate == 0:
        return 0.0

    if method == "straight_line":
        annual = cost * rate
    elif method == "declining_balance":
        if year_of_use == 1 and is_new and accel:
            annual = cost * accel  # الإهلاك المعجل 30%
        else:
            annual = tax_bv * rate
    else:
        annual = 0

    remaining_tax = cost - accum_tax
    return round(min(annual, remaining_tax), 2)


@router.post("/run-depreciation")
async def run_depreciation(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    تشغيل دورة الإهلاك لكل الأصول لشهر/سنة معينة

    القيد المحاسبي لكل أصل:
    مدين: مصروف إهلاك (اسم الأصل)  م/313 أو م/333
    دائن: مجمع إهلاك (اسم الأصل)   م/22201-22204
    """
    company_id = current_user["company_id"]
    period     = data.get("period")     # "2026-01"
    period_type = data.get("type", "monthly")  # monthly | annual

    if not period:
        raise HTTPException(status_code=400, detail="period مطلوب (مثال: '2026-01')")

    # Get all active assets
    assets = await db.fixed_assets.find(
        {"company_id": company_id, "status": AssetStatus.ACTIVE},
        {"_id": 0}
    ).to_list(None)

    if not assets:
        return {"message": "لا توجد أصول نشطة", "entries_created": 0}

    svc = AccountingService(db)
    entries_created = 0
    results = []

    for asset in assets:
        # Skip non-depreciable
        asset_type = asset.get("asset_type", "machinery")
        rule = TAX_DEPRECIATION_RULES.get(asset_type, (None, 0, None))
        if rule[0] is None:
            continue

        # Check if already processed this period
        existing = await db.depreciation_entries.find_one(
            {"asset_id": asset["id"], "period": period}
        )
        if existing:
            continue

        # Calculate depreciation
        months = 1 if period_type == "monthly" else 12
        acc_dep = calc_accounting_dep(asset, months)

        # Year of use for tax depreciation
        commission_date = asset.get("commissioning_date", asset.get("purchase_date", ""))
        if commission_date:
            from datetime import date
            try:
                comm_y = int(commission_date[:4])
                period_y = int(period[:4])
                year_of_use = max(period_y - comm_y + 1, 1)
            except Exception:
                year_of_use = 1
        else:
            year_of_use = 1

        tax_dep = calc_tax_dep(asset, year_of_use)
        timing_diff = round(acc_dep - tax_dep, 2)

        if acc_dep <= 0:
            continue

        # ── Journal Entry ──────────────────────────────────
        dep_exp_code  = asset.get("dep_expense_acc_code", "313")
        accum_dep_code = asset.get("accum_dep_acc_code", "22202")

        lines = await asyncio.gather(
            make_je_line(company_id, dep_exp_code, f"مصروف إهلاك — {asset['asset_name']}",
                         debit=acc_dep,
                         desc=f"إهلاك {asset['asset_name']} — {period} ({period_type})"),
            make_je_line(company_id, accum_dep_code, f"مجمع إهلاك — {asset['asset_name']}",
                         credit=acc_dep,
                         desc=f"مجمع إهلاك {asset['asset_name']} — {period}"),
        )

        entry = JournalEntry(
            company_id=company_id, entry_number=0,
            entry_date=f"{period}-01" if len(period) == 7 else period,
            description=f"إهلاك {period_type} — {asset['asset_name']} ({asset['asset_code']})",
            lines=lines, source_document_type="manual",
            source_document_id=asset["id"], created_by=current_user["user_id"],
        )
        je_result = await svc.create_journal_entry(entry)
        await svc.post_journal_entry(je_result["id"], current_user["user_id"])

        # Update asset balances
        new_accum = round(float(asset.get("accumulated_dep_accounting", 0)) + acc_dep, 2)
        new_nbv   = round(float(asset.get("purchase_cost", 0)) - new_accum, 2)
        new_accum_tax = round(float(asset.get("accumulated_dep_tax", 0)) + tax_dep, 2)
        new_tax_bv    = round(float(asset.get("purchase_cost", 0)) - new_accum_tax, 2)

        status = AssetStatus.FULLY_DEP if new_nbv <= 0 else AssetStatus.ACTIVE

        await db.fixed_assets.update_one(
            {"id": asset["id"]},
            {"$set": {
                "accumulated_dep_accounting": new_accum,
                "accumulated_dep_tax":        new_accum_tax,
                "net_book_value":             max(new_nbv, 0),
                "tax_book_value":             max(new_tax_bv, 0),
                "status":                     status,
                "updated_at":                 datetime.now(timezone.utc).isoformat(),
            }}
        )

        # Save depreciation record
        dep_entry = DepreciationEntry(
            company_id=company_id, asset_id=asset["id"],
            asset_name=asset["asset_name"], period=period,
            accounting_dep=acc_dep, tax_dep=tax_dep, timing_diff=timing_diff,
            journal_entry_id=je_result["id"],
        )
        await db.depreciation_entries.insert_one(dep_entry.dict())

        entries_created += 1
        results.append({
            "asset_code":     asset["asset_code"],
            "asset_name":     asset["asset_name"],
            "accounting_dep": acc_dep,
            "tax_dep":        tax_dep,
            "timing_diff":    timing_diff,
            "new_nbv":        max(new_nbv, 0),
            "year_of_use":    year_of_use,
        })

    total_acc = sum(r["accounting_dep"] for r in results)
    total_tax = sum(r["tax_dep"]        for r in results)
    return {
        "message":         f"تم إثبات إهلاك {entries_created} أصل لفترة {period}",
        "period":          period,
        "entries_created": entries_created,
        "totals": {
            "accounting_depreciation": round(total_acc, 2),
            "tax_depreciation":        round(total_tax, 2),
            "timing_difference":       round(total_acc - total_tax, 2),
        },
        "details": results,
    }


# ══════════════════════════════════════════════════════════════
# 4. ASSET DISPOSAL — قيد الاستبعاد / البيع
# ══════════════════════════════════════════════════════════════

@router.post("/{asset_id}/dispose")
async def dispose_asset(
    asset_id: str,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    استبعاد أو بيع الأصل — القيد المحاسبي:

    مدين: البنك / الخزينة      (عائد البيع)
    مدين: مجمع الإهلاك          (المتراكم حتى تاريخ البيع)
    مدين: خسارة بيع أصول        (إن كان هناك خسارة)
    دائن: الأصل الثابت           (القيمة الدفترية الأصلية)
    دائن: أرباح بيع أصول        (إن كان هناك ربح)
    """
    company_id = current_user["company_id"]
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": company_id}, {"_id": 0}
    )
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    if asset.get("status") == AssetStatus.DISPOSED:
        raise HTTPException(status_code=400, detail="الأصل مُستبعَد بالفعل")

    disposal_date  = data.get("date", datetime.now().strftime("%Y-%m-%d"))
    sale_proceeds  = float(data.get("sale_proceeds", 0))
    disposal_type  = data.get("disposal_type", "sale")  # sale | scrapped

    cost           = float(asset.get("purchase_cost", 0))
    accum_dep      = float(asset.get("accumulated_dep_accounting", 0))
    nbv            = round(cost - accum_dep, 2)
    gain_loss      = round(sale_proceeds - nbv, 2)

    asset_acc_code = asset.get("asset_account_code", "152")
    accum_dep_code = asset.get("accum_dep_acc_code", "22202")
    asset_name     = asset.get("asset_name", "الأصل")

    lines = []

    # مدين: البنك (عائد البيع)
    if sale_proceeds > 0:
        lines.append(await make_je_line(
            company_id, "112", "البنك",
            debit=sale_proceeds, desc=f"عائد بيع {asset_name}"))

    # مدين: مجمع الإهلاك (إقفال المتراكم)
    if accum_dep > 0:
        lines.append(await make_je_line(
            company_id, accum_dep_code, f"مجمع إهلاك — {asset_name}",
            debit=accum_dep, desc=f"إقفال مجمع إهلاك {asset_name}"))

    # مدين: خسارة رأسمالية (إن وجدت)
    if gain_loss < 0:
        lines.append(await make_je_line(
            company_id, "422", "خسائر بيع أصول ثابتة",
            debit=abs(gain_loss), desc=f"خسارة بيع {asset_name}"))

    # دائن: الأصل الثابت (إقفال القيمة الأصلية)
    lines.append(await make_je_line(
        company_id, asset_acc_code, f"أصل: {asset_name}",
        credit=cost, desc=f"استبعاد {asset_name} من الأصول الثابتة"))

    # دائن: أرباح رأسمالية (إن وجدت)
    if gain_loss > 0:
        lines.append(await make_je_line(
            company_id, "421", "أرباح بيع أصول ثابتة",
            credit=gain_loss, desc=f"ربح رأسمالي — بيع {asset_name}"))

    # Balance check
    td = round(sum(l.get("debit",  0) for l in lines), 2)
    tc = round(sum(l.get("credit", 0) for l in lines), 2)

    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=disposal_date,
        description=f"استبعاد أصل: {asset_name} ({asset['asset_code']}) — {'بيع' if disposal_type=='sale' else 'إتلاف'}",
        lines=lines, source_document_type="manual",
        source_document_id=asset_id, created_by=current_user["user_id"],
    )
    je_result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(je_result["id"], current_user["user_id"])

    # Update asset
    await db.fixed_assets.update_one(
        {"id": asset_id},
        {"$set": {
            "status": AssetStatus.DISPOSED,
            "disposal_date": disposal_date,
            "disposal_je_id": je_result["id"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Save disposal record
    disposal = AssetDisposal(
        company_id=company_id, asset_id=asset_id,
        disposal_date=disposal_date, disposal_type=disposal_type,
        sale_proceeds=sale_proceeds, net_book_value=nbv,
        gain_loss=gain_loss, journal_entry_id=je_result["id"],
    )
    await db.asset_disposals.insert_one(disposal.dict())

    return {
        "message":  f"تم استبعاد الأصل بنجاح — {'ربح' if gain_loss>=0 else 'خسارة'} رأسمالية",
        "asset_id": asset_id,
        "financials": {
            "cost":          cost,
            "accumulated_dep": accum_dep,
            "net_book_value":  nbv,
            "sale_proceeds":   sale_proceeds,
            "gain_loss":       gain_loss,
            "type":            "ربح رأسمالي" if gain_loss > 0 else "خسارة رأسمالية",
        },
        "journal": {"id": je_result["id"], "balanced": abs(td - tc) < 0.01},
    }


# ══════════════════════════════════════════════════════════════
# 5. READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/")
async def list_assets(
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1, limit: int = 25,
    current_user: dict = Depends(get_current_user)
):
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if asset_type: q["asset_type"] = asset_type
    if status:     q["status"]     = status
    total  = await db.fixed_assets.count_documents(q)
    assets = await db.fixed_assets.find(q, {"_id": 0}).sort(
        "asset_code", 1).skip((page-1)*limit).limit(limit).to_list(None)
    
    total_cost = sum(float(a.get("purchase_cost", 0)) for a in assets)
    total_dep  = sum(float(a.get("accumulated_dep_accounting", 0)) for a in assets)
    total_nbv  = sum(float(a.get("net_book_value", 0)) for a in assets)

    return {
        "assets": assets, "total": total, "page": page, "limit": limit,
        "summary": {
            "total_cost":   round(total_cost, 2),
            "total_accum_dep": round(total_dep, 2),
            "total_nbv":    round(total_nbv, 2),
        }
    }


@router.get("/depreciation-schedule/{asset_id}")
async def get_depreciation_schedule(
    asset_id: str,
    years: int = Query(5, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """جدول الإهلاك المستقبلي للأصل — محاسبي وضريبي"""
    company_id = current_user["company_id"]
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": company_id}, {"_id": 0}
    )
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")

    schedule = []
    cost        = float(asset.get("purchase_cost", 0))
    nbv         = float(asset.get("net_book_value", cost))
    tax_bv      = float(asset.get("tax_book_value", cost))
    accum_acc   = float(asset.get("accumulated_dep_accounting", 0))
    accum_tax   = float(asset.get("accumulated_dep_tax", 0))
    commission  = asset.get("commissioning_date", asset.get("purchase_date", ""))
    start_year  = int(commission[:4]) if commission else 2025

    for yr in range(1, years + 1):
        year = start_year + yr - 1
        acc_dep = calc_accounting_dep(asset, 12)
        tax_dep = calc_tax_dep(asset, yr)

        # Cap
        acc_dep = min(acc_dep, max(nbv - float(asset.get("salvage_value", 0)), 0))
        tax_dep = min(tax_dep, tax_bv)

        accum_acc += acc_dep
        accum_tax += tax_dep
        nbv       = max(cost - accum_acc, 0)
        tax_bv    = max(cost - accum_tax, 0)

        schedule.append({
            "year":              year,
            "accounting_dep":    round(acc_dep, 2),
            "tax_dep":           round(tax_dep, 2),
            "timing_difference": round(acc_dep - tax_dep, 2),
            "accum_dep_accounting": round(accum_acc, 2),
            "accum_dep_tax":        round(accum_tax, 2),
            "net_book_value":    round(nbv, 2),
            "tax_book_value":    round(tax_bv, 2),
        })
        if nbv <= 0 and tax_bv <= 0:
            break

    return {"asset": asset.get("asset_name"), "schedule": schedule}


@router.get("/depreciation-history/{asset_id}")
async def get_depreciation_history(
    asset_id: str,
    current_user: dict = Depends(get_current_user)
):
    entries = await db.depreciation_entries.find(
        {"asset_id": asset_id, "company_id": current_user["company_id"]}, {"_id": 0}
    ).sort("period", 1).to_list(None)
    return {"entries": entries, "total": len(entries)}


@router.get("/{asset_id}")
async def get_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")
    return asset


@router.put("/{asset_id}")
async def update_asset(
    asset_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """تعديل بيانات الأصل (قبل التشغيل فقط للحقول المالية)"""
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": current_user["company_id"]}, {"_id": 0}
    )
    if not asset:
        raise HTTPException(status_code=404, detail="الأصل غير موجود")

    # Protect financial fields after commissioning
    PROTECTED_AFTER_COMMISSION = {"purchase_cost", "salvage_value", "dep_method", "asset_type"}
    if asset.get("status") == AssetStatus.ACTIVE:
        blocked = PROTECTED_AFTER_COMMISSION & set(data.keys())
        if blocked:
            raise HTTPException(status_code=400,
                detail=f"لا يمكن تعديل {blocked} بعد تشغيل الأصل")

    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fixed_assets.update_one({"id": asset_id}, {"$set": data})
    return {"message": "تم تعديل الأصل"}
