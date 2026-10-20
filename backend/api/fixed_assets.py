"""
Fixed Assets Engine API — محرك الأصول الثابتة
قانون الضرائب المصري 91/2005 المادتان 25 و26
"""
import uuid, calendar, re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from database import db
from models.fixed_assets import (
    FixedAsset, DepreciationEntry, AssetDisposal,
    AssetType, DepreciationMethod, AssetStatus,
    TAX_DEPRECIATION_RULES, ASSET_ACCOUNTS, WIP_ACCOUNT_CODE, LEGACY_TYPE_ACCOUNTS,
)
from models.accounting import JournalEntry
from services.accounting_service import AccountingService
from dependencies import get_current_user

router = APIRouter(prefix="/api/fixed-assets", tags=["Fixed Assets"])

PAYMENT_ACCOUNTS = {"bank": ("162", "البنك"), "cash": ("161", "الخزينة"), "credit": ("251", "الموردون")}
NON_DEPRECIABLE = {"land", "wip"}


def _r2(x) -> float:
    return round(float(x or 0), 2)


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

async def require_account(company_id: str, code: str, label: str = "") -> dict:
    """The account must exist in this company's chart and accept postings.

    The old helper fell back to the bare code as account_id when the account
    was missing, so the entry was saved and then failed at posting with a 500
    (or, for headers, landed on a total line the reports skip).
    """
    if not code:
        raise HTTPException(400, f"لم يُحدَّد حساب {label} للأصل")
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": str(code)}, {"_id": 0})
    if not acc:
        raise HTTPException(400, f"الحساب {code} ({label}) غير موجود في دليل الحسابات — أضفه أولاً أو اختر حساباً آخر")
    if acc.get("is_header") or acc.get("allow_posting") is False or acc.get("account_category") == "header":
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name')}» حساب تجميعي لا يقبل قيوداً — اختر حساباً فرعياً")
    return acc


def je_line(acc: dict, debit: float = 0, credit: float = 0, desc: str = "") -> dict:
    return {
        "line_id": str(uuid.uuid4()),
        "account_id": acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", ""),
        "debit": _r2(debit), "credit": _r2(credit),
        "description": desc,
    }


async def post_entry(company_id: str, user_id: str, entry_date: str, description: str,
                     lines: list, source_id: str) -> str:
    svc = AccountingService(db)
    td = round(sum(l["debit"] for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    if td != tc:
        raise HTTPException(400, f"القيد غير متوازن (مدين {td} / دائن {tc})")
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=entry_date,
        description=description, lines=lines,
        source_document_type="manual", source_document_id=source_id,
        created_by=user_id,
    )
    try:
        res = await svc.create_journal_entry(entry)
        await svc.post_journal_entry(res["id"], user_id)
    except ValueError as e:
        # closed period / header account etc. — a user problem, not a 500
        raise HTTPException(400, str(e))
    return res["id"]


def normalize(asset: dict) -> dict:
    """Assets created by /api/financial/assets use name/cost/accumulated_depreciation
    in the same collection; this engine read only its own field names, so those
    assets crashed the depreciation run (KeyError asset_name) or showed as zero."""
    a = dict(asset)
    a.setdefault("asset_name", a.get("name") or "")
    if a.get("purchase_cost") is None:
        a["purchase_cost"] = float(a.get("cost") or 0)
    if a.get("accumulated_dep_accounting") is None:
        a["accumulated_dep_accounting"] = float(a.get("accumulated_depreciation") or 0)
    if a.get("net_book_value") is None:
        a["net_book_value"] = _r2(a["purchase_cost"] - a["accumulated_dep_accounting"])
    if not a.get("accounting_rate") and a.get("depreciation_rate"):
        a["accounting_rate"] = float(a["depreciation_rate"])
    if not a.get("dep_method") and a.get("depreciation_method"):
        a["dep_method"] = "declining_balance" if a["depreciation_method"] == "declining" else "straight_line"
    if not a.get("commissioning_date") and a.get("service_date"):
        a["commissioning_date"] = a["service_date"]
    t = a.get("asset_type") or "other"
    codes = ASSET_ACCOUNTS.get(t) or LEGACY_TYPE_ACCOUNTS.get(t) or LEGACY_TYPE_ACCOUNTS["other"]
    a.setdefault("asset_account_code", None)
    a["asset_account_code"] = a["asset_account_code"] or codes["asset"]
    a["accum_dep_acc_code"] = a.get("accum_dep_acc_code") or codes["accum_dep"]
    a["dep_expense_acc_code"] = a.get("dep_expense_acc_code") or codes["dep_exp"]
    return a


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


def _num(data: dict, key: str, default=None, minimum: float = 0.0):
    v = data.get(key, default)
    if v in (None, ""):
        return default
    try:
        v = float(v)
    except (TypeError, ValueError):
        raise HTTPException(400, f"قيمة غير صحيحة للحقل {key}")
    if v < minimum:
        raise HTTPException(400, f"الحقل {key} لا يقبل قيمة سالبة")
    return v


# ══════════════════════════════════════════════════════════════
# 1. PURCHASE ASSET — قيد شراء الأصل
# ══════════════════════════════════════════════════════════════

# Fields a user may supply. The old code spread the whole request body into the
# model (**data), so a client could set status, accumulated depreciation, book
# values or the id — and sending net_book_value or asset_code crashed the call
# with "multiple values for keyword argument".
CREATE_FIELDS = {
    "asset_name", "purchase_date", "useful_life_years", "dep_method", "accounting_rate",
    "is_new_productive", "serial_number", "location", "supplier_id", "purchase_invoice_id",
    "description", "notes", "cost_center_id", "project_id",
}


async def _resolve_create(company_id: str, data: dict) -> dict:
    """Validate a create request and resolve every account it will touch."""
    asset_type = data.get("asset_type", "machinery")
    if asset_type not in {t.value for t in AssetType}:
        raise HTTPException(400, "نوع الأصل غير معروف")
    name = (data.get("asset_name") or "").strip()
    if not name:
        raise HTTPException(400, "اسم الأصل مطلوب")
    cost = _num(data, "purchase_cost", 0)
    if not cost or cost <= 0:
        raise HTTPException(400, "تكلفة الشراء يجب أن تكون أكبر من صفر")
    salvage = _num(data, "salvage_value", 0) or 0
    if salvage >= cost and asset_type not in NON_DEPRECIABLE:
        raise HTTPException(400, "القيمة التخريدية يجب أن تكون أقل من التكلفة")
    if not data.get("purchase_date"):
        raise HTTPException(400, "تاريخ الشراء مطلوب")
    pay = data.get("payment_method", "bank")
    if pay not in PAYMENT_ACCOUNTS:
        raise HTTPException(400, "طريقة السداد غير صحيحة (bank / cash / credit)")
    # Buildings, machines… are usually bought ready to use; the WIP leg is only
    # for assets still being built/installed (WIP type is always under construction).
    in_service = bool(data.get("in_service", True)) and asset_type != "wip"

    codes = ASSET_ACCOUNTS[asset_type]
    asset_code_acc = data.get("asset_account_code") or codes["asset"]
    accum_code = data.get("accum_dep_acc_code") or codes["accum_dep"]
    exp_code = data.get("dep_expense_acc_code") or codes["dep_exp"]

    asset_acc = await require_account(company_id, asset_code_acc, "الأصل")
    if getattr(asset_acc.get("account_type"), "value", asset_acc.get("account_type")) != "asset":
        raise HTTPException(400, f"الحساب {asset_code_acc} ليس حساب أصول")
    accum_acc = exp_acc = None
    if asset_type not in NON_DEPRECIABLE:
        accum_acc = await require_account(company_id, accum_code, "مجمع الإهلاك")
        exp_acc = await require_account(company_id, exp_code, "مصروف الإهلاك")
        if getattr(exp_acc.get("account_type"), "value", exp_acc.get("account_type")) != "expense":
            raise HTTPException(400, f"الحساب {exp_code} ليس حساب مصروفات")
    wip_acc = None
    if not in_service:
        wip_acc = asset_acc if asset_type == "wip" else await require_account(
            company_id, WIP_ACCOUNT_CODE, "مشروعات تحت التنفيذ — أصول ثابتة")
    pay_code, pay_name = PAYMENT_ACCOUNTS[pay]
    pay_acc = await require_account(company_id, pay_code, pay_name)
    return dict(asset_type=asset_type, name=name, cost=_r2(cost), salvage=_r2(salvage),
                in_service=in_service, asset_acc=asset_acc, accum_acc=accum_acc,
                exp_acc=exp_acc, wip_acc=wip_acc, pay_acc=pay_acc)


def _purchase_lines(r: dict) -> list:
    debit_acc = r["asset_acc"] if r["in_service"] else r["wip_acc"]
    return [
        je_line(debit_acc, debit=r["cost"], desc=f"شراء {r['name']}"
                + ("" if r["in_service"] else " — تحت التنفيذ")),
        je_line(r["pay_acc"], credit=r["cost"], desc=f"سداد تكلفة {r['name']}"),
    ]


@router.post("/preview")
async def preview_fixed_asset(data: dict, current_user: dict = Depends(get_current_user)):
    """معاينة قيد الشراء قبل الحفظ — لا يحفظ شيئاً"""
    r = await _resolve_create(current_user["company_id"], data)
    rule = TAX_DEPRECIATION_RULES.get(r["asset_type"], (None, 0.0, None))
    return {"lines": _purchase_lines(r), "in_service": r["in_service"],
            "tax_method": rule[0], "tax_rate": rule[1]}


@router.post("/")
async def create_fixed_asset(data: dict, current_user: dict = Depends(get_current_user)):
    """
    شراء أصل ثابت وإضافته — القيد المحاسبي:
      جاهز للاستخدام:  مدين الأصل (112-116 / 11101)  — دائن البنك/الخزينة/الموردون
      تحت التنفيذ:     مدين 1491 مشروعات تحت التنفيذ  — دائن البنك/الخزينة/الموردون
                       ثم عند التشغيل: مدين الأصل — دائن 1491
    """
    company_id = current_user["company_id"]
    r = await _resolve_create(company_id, data)
    asset_type = r["asset_type"]
    rule = TAX_DEPRECIATION_RULES.get(asset_type, (None, 0.0, None))
    tax_method, tax_rate, _ = rule

    fields = {k: data[k] for k in CREATE_FIELDS if k in data and data[k] not in (None, "")}
    fields["asset_name"] = r["name"]
    if "dep_method" in fields and fields["dep_method"] not in {m.value for m in DepreciationMethod}:
        raise HTTPException(400, "طريقة الإهلاك غير صحيحة")
    for k in ("useful_life_years", "accounting_rate"):
        if k in fields:
            fields[k] = _num(fields, k)
    if fields.get("accounting_rate") and fields["accounting_rate"] > 1:
        fields["accounting_rate"] = fields["accounting_rate"] / 100   # entered as a percentage

    asset = FixedAsset(
        company_id=company_id,
        asset_code=await next_asset_code(company_id, asset_type),
        asset_type=AssetType(asset_type),
        status=AssetStatus.ACTIVE if r["in_service"] else AssetStatus.WIP,
        purchase_cost=r["cost"], salvage_value=r["salvage"],
        commissioning_date=data["purchase_date"] if r["in_service"] else None,
        asset_account_code=r["asset_acc"]["account_code"],
        accum_dep_acc_code=r["accum_acc"]["account_code"] if r["accum_acc"] else None,
        dep_expense_acc_code=r["exp_acc"]["account_code"] if r["exp_acc"] else None,
        tax_method=tax_method, tax_rate=tax_rate,
        net_book_value=r["cost"], tax_book_value=r["cost"],
        **fields,
    )
    doc = asset.model_dump(mode="json")
    if r["wip_acc"]:
        doc["wip_account_code"] = r["wip_acc"]["account_code"]
    await db.fixed_assets.insert_one(dict(doc))

    try:
        je_id = await post_entry(
            company_id, current_user["user_id"], data["purchase_date"],
            f"شراء أصل: {asset.asset_name} — {asset.asset_code}", _purchase_lines(r), asset.id)
    except Exception:
        # don't leave an asset in the register that has no purchase entry
        await db.fixed_assets.delete_one({"id": asset.id, "company_id": company_id})
        raise
    await db.fixed_assets.update_one({"id": asset.id, "company_id": company_id},
                                     {"$set": {"purchase_journal_id": je_id}})
    doc["purchase_journal_id"] = je_id
    return {
        "message": "تم تسجيل الأصل الثابت بنجاح",
        "asset": doc,
        "tax_info": {
            "tax_method": tax_method,
            "tax_rate_pct": f"{tax_rate*100:.0f}%" if tax_rate else "لا إهلاك",
            "is_accelerated": asset.is_new_productive and asset_type == "machinery",
        },
        "journal_entry_id": je_id,
    }


# ══════════════════════════════════════════════════════════════
# 2. COMMISSION ASSET — قيد تحويل من تحت التنفيذ للأصول
# ══════════════════════════════════════════════════════════════

@router.put("/{asset_id}/commission")
async def commission_asset(asset_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """
    تشغيل الأصل (الانتقال من تحت التنفيذ للإنتاج):
    مدين: الأصل الثابت — دائن: مشروعات تحت التنفيذ م/1491
    """
    company_id = current_user["company_id"]
    asset = await db.fixed_assets.find_one({"id": asset_id, "company_id": company_id}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "الأصل غير موجود")
    # only an asset under construction can be commissioned (the old check
    # allowed re-commissioning a fully-depreciated or disposed asset)
    if asset.get("status") != AssetStatus.WIP.value:
        raise HTTPException(400, "الأصل ليس تحت التنفيذ — لا يحتاج تشغيلاً")
    asset = normalize(asset)
    commission_date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
    target_type = data.get("asset_type") or asset.get("asset_type")
    if asset.get("asset_type") == "wip":
        # a WIP-type project becomes a real asset type on commissioning
        if target_type in (None, "wip") or target_type not in ASSET_ACCOUNTS:
            raise HTTPException(400, "حدّد نوع الأصل النهائي عند التشغيل (مباني، آلات، ...)")
    cost = _r2(asset["purchase_cost"])
    codes = ASSET_ACCOUNTS[target_type]
    asset_acc = await require_account(company_id,
        data.get("asset_account_code") or (asset["asset_account_code"] if asset.get("asset_type") != "wip" else codes["asset"]), "الأصل")
    wip_acc = await require_account(company_id, asset.get("wip_account_code") or WIP_ACCOUNT_CODE, "مشروعات تحت التنفيذ")
    if asset_acc["account_code"] == wip_acc["account_code"]:
        raise HTTPException(400, "حساب الأصل النهائي لا يمكن أن يكون حساب تحت التنفيذ")
    updates = {}
    if asset.get("asset_type") == "wip":
        rule = TAX_DEPRECIATION_RULES.get(target_type, (None, 0.0, None))
        accum = await require_account(company_id, codes["accum_dep"], "مجمع الإهلاك") if codes["accum_dep"] else None
        exp = await require_account(company_id, codes["dep_exp"], "مصروف الإهلاك") if codes["dep_exp"] else None
        updates.update({"asset_type": target_type, "asset_account_code": asset_acc["account_code"],
                        "accum_dep_acc_code": accum["account_code"] if accum else None,
                        "dep_expense_acc_code": exp["account_code"] if exp else None,
                        "tax_method": rule[0], "tax_rate": rule[1]})

    lines = [
        je_line(asset_acc, debit=cost, desc=f"تشغيل الأصل {asset['asset_name']}"),
        je_line(wip_acc, credit=cost, desc=f"إقفال تحت التنفيذ — {asset['asset_name']}"),
    ]
    je_id = await post_entry(company_id, current_user["user_id"], commission_date,
                             f"تشغيل الأصل: {asset['asset_name']} — {asset.get('asset_code','')}", lines, asset_id)
    updates.update({"status": AssetStatus.ACTIVE.value, "commissioning_date": commission_date,
                    "commission_je_id": je_id, "updated_at": datetime.now(timezone.utc).isoformat()})
    await db.fixed_assets.update_one({"id": asset_id, "company_id": company_id}, {"$set": updates})
    return {"message": "تم تشغيل الأصل وبدء الإهلاك", "journal_entry_id": je_id}


# ══════════════════════════════════════════════════════════════
# 3. DEPRECIATION ENGINE — محرك الإهلاك
# ══════════════════════════════════════════════════════════════

def calc_accounting_dep(asset: dict, months: int = 12) -> float:
    """حساب الإهلاك المحاسبي لعدد من الشهور"""
    cost    = float(asset.get("purchase_cost", 0) or 0)
    salvage = float(asset.get("salvage_value", 0) or 0)
    base    = max(cost - salvage, 0)
    method  = asset.get("dep_method") or "straight_line"
    rate    = float(asset.get("accounting_rate") or 0)
    life    = float(asset.get("useful_life_years") or 0)
    # An asset saved without a rate or a useful life depreciated by ZERO,
    # silently, for ever — it simply never appeared in any run. Fall back to
    # the tax rule for its own type; land and WIP have no rule and stay at 0,
    # which is correct for them (the law forbids depreciating land).
    if not rate and not life:
        _rule = TAX_DEPRECIATION_RULES.get(asset.get("asset_type", ""), (None, 0.0, None))
        if _rule[0]:
            method = _rule[0]
            rate = float(_rule[1] or 0)
    accum = float(asset.get("accumulated_dep_accounting", 0) or 0)
    nbv   = cost - accum

    if method == "straight_line":
        annual = base * rate if rate else (base / life if life else 0)
    elif method == "declining_balance":
        annual = nbv * rate if rate else 0
    else:
        annual = 0

    remaining = max(base - accum, 0)
    amount = annual * months / 12
    return round(min(amount, remaining), 2)


def calc_tax_dep(asset: dict, year_of_use: int = 1, months: int = 12) -> float:
    """الإهلاك الضريبي — قانون 91/2005 م.25-26 (سنوي، يُوزَّع على الشهور في التشغيل الشهري)"""
    asset_type = asset.get("asset_type", "machinery")
    cost       = float(asset.get("purchase_cost", 0) or 0)
    tax_bv     = float(asset.get("tax_book_value", cost) or 0)
    is_new     = bool(asset.get("is_new_productive", False))
    accum_tax  = float(asset.get("accumulated_dep_tax", 0) or 0)

    method, rate, accel = TAX_DEPRECIATION_RULES.get(asset_type, (None, 0.0, None))
    if method is None or rate == 0:
        return 0.0
    if method == "straight_line":
        annual = cost * rate
    elif method == "declining_balance":
        annual = cost * accel if (year_of_use == 1 and is_new and accel) else tax_bv * rate
    else:
        annual = 0
    # a monthly run used to book the full ANNUAL tax depreciation every month
    # (12x the allowance), which inflated the timing difference and the DTL
    amount = annual * months / 12
    return round(min(amount, max(cost - accum_tax, 0)), 2)


def _period_info(period: str):
    """'2026-03' → monthly, '2026' → annual. Returns (kind, year, month, last_day)."""
    if re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", period or ""):
        y, m = int(period[:4]), int(period[5:7])
        return "monthly", y, m, f"{period}-{calendar.monthrange(y, m)[1]:02d}"
    if re.fullmatch(r"\d{4}", period or ""):
        return "annual", int(period), 12, f"{period}-12-31"
    raise HTTPException(400, "الفترة يجب أن تكون شهراً (2026-03) أو سنة (2026)")


async def _plan_depreciation(company_id: str, period: str):
    kind, py, pm, entry_date = _period_info(period)
    assets = await db.fixed_assets.find(
        {"company_id": company_id, "status": AssetStatus.ACTIVE.value}, {"_id": 0}).to_list(None)
    plan, skipped = [], []
    for raw in assets:
        asset = normalize(raw)
        name = asset["asset_name"]
        if asset.get("asset_type") in NON_DEPRECIABLE:
            continue
        start = (asset.get("commissioning_date") or asset.get("purchase_date") or "")[:7]
        try:
            sy, sm = int(start[:4]), int(start[5:7])
        except Exception:
            sy, sm = py, 1
        if (sy, sm) > (py, pm) or (kind == "annual" and sy > py):
            skipped.append({"asset": name, "reason": "قبل تاريخ بدء التشغيل"}); continue
        # one period posted once; an annual run and monthly runs of the same
        # year used to be allowed together, depreciating the asset twice
        prev = await db.depreciation_entries.find(
            {"company_id": company_id, "asset_id": asset["id"],
             "period": {"$in": [period, str(py)]} if kind == "monthly" else {"$regex": f"^{py}"}},
            {"_id": 0, "period": 1}).to_list(None)
        legacy = [p for p in (asset.get("depreciated_periods") or [])
                  if p == period or (kind == "annual" and str(p).startswith(str(py)))]
        if prev or legacy:
            skipped.append({"asset": name, "reason": "سبق إهلاك هذه الفترة"}); continue

        months = 1 if kind == "monthly" else (12 - sm + 1 if sy == py else 12)
        acc_dep = calc_accounting_dep(asset, months)
        year_of_use = max(py - sy + 1, 1)
        tax_dep = calc_tax_dep(asset, year_of_use, months)
        if acc_dep <= 0:
            skipped.append({"asset": name, "reason": "مُهلَك بالكامل أو لا يوجد معدل إهلاك"}); continue
        try:
            exp_acc = await require_account(company_id, asset["dep_expense_acc_code"], "مصروف الإهلاك")
            accum_acc = await require_account(company_id, asset["accum_dep_acc_code"], "مجمع الإهلاك")
        except HTTPException as e:
            # one asset with a bad account must not stop (or half-post) the run
            skipped.append({"asset": name, "reason": e.detail}); continue
        plan.append({"asset": asset, "acc_dep": acc_dep, "tax_dep": tax_dep, "months": months,
                     "year_of_use": year_of_use, "exp_acc": exp_acc, "accum_acc": accum_acc})
    return kind, entry_date, plan, skipped


@router.post("/depreciation-preview")
async def preview_depreciation(data: dict, current_user: dict = Depends(get_current_user)):
    """معاينة قيود الإهلاك لفترة — لا يرحّل شيئاً"""
    period = str(data.get("period") or "")
    kind, entry_date, plan, skipped = await _plan_depreciation(current_user["company_id"], period)
    return {
        "period": period, "type": kind, "entry_date": entry_date, "skipped": skipped,
        "assets": [{
            "asset_id": p["asset"]["id"], "asset_code": p["asset"].get("asset_code"),
            "asset_name": p["asset"]["asset_name"], "accounting_dep": p["acc_dep"],
            "tax_dep": p["tax_dep"], "months": p["months"],
            "lines": [je_line(p["exp_acc"], debit=p["acc_dep"], desc="مصروف إهلاك"),
                      je_line(p["accum_acc"], credit=p["acc_dep"], desc="مجمع إهلاك")],
        } for p in plan],
        "total": round(sum(p["acc_dep"] for p in plan), 2),
    }


@router.post("/run-depreciation")
async def run_depreciation(data: dict, current_user: dict = Depends(get_current_user)):
    """
    تشغيل دورة الإهلاك لكل الأصول النشطة لشهر (2026-01) أو سنة (2026)
    القيد لكل أصل: مدين مصروف الإهلاك (313/333) — دائن مجمع الإهلاك (22201-22205)
    """
    company_id = current_user["company_id"]
    period = str(data.get("period") or "")
    if not period:
        raise HTTPException(400, "الفترة مطلوبة (مثال: 2026-01 أو 2026)")
    kind, entry_date, plan, skipped = await _plan_depreciation(company_id, period)
    if not plan:
        return {"message": "لا توجد أصول تحتاج إهلاكاً لهذه الفترة", "period": period,
                "entries_created": 0, "skipped": skipped, "details": [],
                "totals": {"accounting_depreciation": 0, "tax_depreciation": 0, "timing_difference": 0}}

    results = []
    for p in plan:
        asset, acc_dep, tax_dep = p["asset"], p["acc_dep"], p["tax_dep"]
        lines = [
            je_line(p["exp_acc"], debit=acc_dep, desc=f"إهلاك {asset['asset_name']} — {period}"),
            je_line(p["accum_acc"], credit=acc_dep, desc=f"مجمع إهلاك {asset['asset_name']} — {period}"),
        ]
        try:
            je_id = await post_entry(company_id, current_user["user_id"], entry_date,
                                     f"إهلاك {period} — {asset['asset_name']} ({asset.get('asset_code','')})",
                                     lines, asset["id"])
        except HTTPException as e:
            skipped.append({"asset": asset["asset_name"], "reason": e.detail}); continue

        cost = float(asset["purchase_cost"])
        base = max(cost - float(asset.get("salvage_value") or 0), 0)
        new_accum = _r2(float(asset["accumulated_dep_accounting"]) + acc_dep)
        new_accum_tax = _r2(float(asset.get("accumulated_dep_tax") or 0) + tax_dep)
        new_nbv = _r2(cost - new_accum)
        # with a salvage value the book value never reaches 0, so the old
        # "nbv <= 0" test never marked such assets as fully depreciated
        status = AssetStatus.FULLY_DEP.value if new_accum >= base - 0.005 else AssetStatus.ACTIVE.value
        sets = {"accumulated_dep_accounting": new_accum, "accumulated_dep_tax": new_accum_tax,
                "net_book_value": max(new_nbv, 0), "tax_book_value": max(_r2(cost - new_accum_tax), 0),
                "status": status, "last_depreciation_period": period,
                "updated_at": datetime.now(timezone.utc).isoformat()}
        if "accumulated_depreciation" in asset:     # keep the legacy screen's fields in step
            sets.update({"accumulated_depreciation": new_accum, "book_value": max(new_nbv, 0)})
        await db.fixed_assets.update_one({"id": asset["id"], "company_id": company_id}, {"$set": sets})
        await db.depreciation_entries.insert_one(DepreciationEntry(
            company_id=company_id, asset_id=asset["id"], asset_name=asset["asset_name"],
            period=period, accounting_dep=acc_dep, tax_dep=tax_dep,
            timing_diff=_r2(acc_dep - tax_dep), journal_entry_id=je_id).model_dump())
        results.append({"asset_code": asset.get("asset_code"), "asset_name": asset["asset_name"],
                        "accounting_dep": acc_dep, "tax_dep": tax_dep,
                        "timing_diff": _r2(acc_dep - tax_dep), "new_nbv": max(new_nbv, 0),
                        "year_of_use": p["year_of_use"], "journal_entry_id": je_id})

    total_acc = sum(r["accounting_dep"] for r in results)
    total_tax = sum(r["tax_dep"] for r in results)
    return {
        "message": f"تم إثبات إهلاك {len(results)} أصل لفترة {period}",
        "period": period, "entries_created": len(results),
        "totals": {"accounting_depreciation": round(total_acc, 2),
                   "tax_depreciation": round(total_tax, 2),
                   "timing_difference": round(total_acc - total_tax, 2)},
        "details": results, "skipped": skipped,
    }


# ══════════════════════════════════════════════════════════════
# 4. ASSET DISPOSAL — قيد الاستبعاد / البيع
# ══════════════════════════════════════════════════════════════

async def _disposal_lines(company_id: str, asset: dict, data: dict):
    sale_proceeds = _num(data, "sale_proceeds", 0) or 0
    disposal_type = data.get("disposal_type", "sale")
    if disposal_type not in ("sale", "scrapped"):
        raise HTTPException(400, "نوع الاستبعاد غير صحيح (sale / scrapped)")
    if disposal_type == "scrapped":
        sale_proceeds = 0.0
    receipt = data.get("receipt_method", "bank")
    if receipt not in ("bank", "cash"):
        raise HTTPException(400, "طريقة التحصيل غير صحيحة (bank / cash)")
    cost = _r2(asset["purchase_cost"])
    accum_dep = _r2(asset["accumulated_dep_accounting"])
    nbv = _r2(cost - accum_dep)
    gain_loss = _r2(sale_proceeds - nbv)
    name = asset["asset_name"]
    # an asset still under construction carries its cost in the WIP account,
    # not in the fixed-asset account the old code always credited
    if asset.get("status") == AssetStatus.WIP.value:
        credit_acc = await require_account(company_id, asset.get("wip_account_code") or WIP_ACCOUNT_CODE, "مشروعات تحت التنفيذ")
    else:
        credit_acc = await require_account(company_id, asset["asset_account_code"], "الأصل")
    lines = []
    if sale_proceeds > 0:
        code, label = PAYMENT_ACCOUNTS[receipt]
        lines.append(je_line(await require_account(company_id, code, label), debit=sale_proceeds, desc=f"عائد بيع {name}"))
    if accum_dep > 0:
        lines.append(je_line(await require_account(company_id, asset["accum_dep_acc_code"], "مجمع الإهلاك"),
                             debit=accum_dep, desc=f"إقفال مجمع إهلاك {name}"))
    if gain_loss < 0:
        lines.append(je_line(await require_account(company_id, "3364", "خسائر رأسمالية"),
                             debit=abs(gain_loss), desc=f"خسارة استبعاد {name}"))
    lines.append(je_line(credit_acc, credit=cost, desc=f"استبعاد {name} من الأصول الثابتة"))
    if gain_loss > 0:
        lines.append(je_line(await require_account(company_id, "421", "أرباح رأسمالية"),
                             credit=gain_loss, desc=f"ربح رأسمالي — بيع {name}"))
    return lines, dict(cost=cost, accumulated_dep=accum_dep, net_book_value=nbv,
                       sale_proceeds=_r2(sale_proceeds), gain_loss=gain_loss, disposal_type=disposal_type)


async def _get_for_disposal(company_id: str, asset_id: str) -> dict:
    asset = await db.fixed_assets.find_one({"id": asset_id, "company_id": company_id}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "الأصل غير موجود")
    if asset.get("status") == AssetStatus.DISPOSED.value:
        raise HTTPException(400, "الأصل مُستبعَد بالفعل")
    return normalize(asset)


@router.post("/{asset_id}/dispose-preview")
async def preview_disposal(asset_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """معاينة قيد الاستبعاد/البيع — لا يحفظ"""
    asset = await _get_for_disposal(current_user["company_id"], asset_id)
    lines, fin = await _disposal_lines(current_user["company_id"], asset, data)
    return {"lines": lines, "financials": fin}


@router.post("/{asset_id}/dispose")
async def dispose_asset(asset_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """
    استبعاد أو بيع الأصل:
    مدين البنك/الخزينة (العائد) + مدين مجمع الإهلاك + مدين خسائر رأسمالية 3364
    دائن الأصل (التكلفة) + دائن أرباح رأسمالية 421
    """
    company_id = current_user["company_id"]
    asset = await _get_for_disposal(company_id, asset_id)
    disposal_date = data.get("date") or datetime.now().strftime("%Y-%m-%d")
    lines, fin = await _disposal_lines(company_id, asset, data)
    je_id = await post_entry(
        company_id, current_user["user_id"], disposal_date,
        f"استبعاد أصل: {asset['asset_name']} ({asset.get('asset_code','')}) — {'بيع' if fin['disposal_type']=='sale' else 'إتلاف'}",
        lines, asset_id)
    await db.fixed_assets.update_one({"id": asset_id, "company_id": company_id}, {"$set": {
        "status": AssetStatus.DISPOSED.value, "disposal_date": disposal_date, "disposal_je_id": je_id,
        "net_book_value": 0, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.asset_disposals.insert_one(AssetDisposal(
        company_id=company_id, asset_id=asset_id, disposal_date=disposal_date,
        disposal_type=fin["disposal_type"], sale_proceeds=fin["sale_proceeds"],
        net_book_value=fin["net_book_value"], gain_loss=fin["gain_loss"],
        journal_entry_id=je_id, notes=data.get("notes")).model_dump())
    g = fin["gain_loss"]
    return {
        "message": f"تم استبعاد الأصل بنجاح — {'ربح' if g > 0 else 'خسارة' if g < 0 else 'لا ربح ولا خسارة'} رأسمالية",
        "asset_id": asset_id,
        "financials": {**fin, "type": "ربح رأسمالي" if g > 0 else "خسارة رأسمالية" if g < 0 else "تعادل"},
        "journal": {"id": je_id, "balanced": True},
    }


# ══════════════════════════════════════════════════════════════
# 5. READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/")
async def list_assets(
    asset_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=500),
    current_user: dict = Depends(get_current_user)
):
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if asset_type: q["asset_type"] = asset_type
    if status:     q["status"] = status
    total = await db.fixed_assets.count_documents(q)
    assets = [normalize(a) for a in await db.fixed_assets.find(q, {"_id": 0}).sort(
        "asset_code", 1).skip((page-1)*limit).limit(limit).to_list(None)]
    # totals over the whole register, not just the page on screen
    every = [normalize(a) for a in await db.fixed_assets.find(
        {**q, "status": {"$ne": AssetStatus.DISPOSED.value}} if not status else q,
        {"_id": 0, "purchase_cost": 1, "cost": 1, "accumulated_dep_accounting": 1,
         "accumulated_depreciation": 1, "net_book_value": 1, "asset_type": 1}).to_list(None)]
    return {
        "assets": assets, "total": total, "page": page, "limit": limit,
        "summary": {
            "total_cost": _r2(sum(float(a["purchase_cost"]) for a in every)),
            "total_accum_dep": _r2(sum(float(a["accumulated_dep_accounting"]) for a in every)),
            "total_nbv": _r2(sum(float(a["net_book_value"]) for a in every)),
        },
    }


@router.get("/depreciation-schedule/{asset_id}")
async def get_depreciation_schedule(
    asset_id: str, years: int = Query(5, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """جدول الإهلاك المستقبلي للأصل — محاسبي وضريبي"""
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "الأصل غير موجود")
    sim = normalize(asset)
    sim.setdefault("accumulated_dep_tax", 0)
    sim.setdefault("tax_book_value", sim["purchase_cost"])
    commission = sim.get("commissioning_date") or sim.get("purchase_date") or ""
    start_year = int(commission[:4]) if commission[:4].isdigit() else datetime.now().year
    cost = float(sim["purchase_cost"])
    schedule = []
    for yr in range(1, years + 1):
        # each year is computed on the balances left by the previous one (the
        # old loop re-used the starting balances, so declining-balance years
        # were all identical and the schedule never declined)
        acc_dep = calc_accounting_dep(sim, 12)
        tax_dep = calc_tax_dep(sim, yr, 12)
        sim["accumulated_dep_accounting"] = _r2(sim["accumulated_dep_accounting"] + acc_dep)
        sim["accumulated_dep_tax"] = _r2(float(sim["accumulated_dep_tax"]) + tax_dep)
        sim["net_book_value"] = _r2(cost - sim["accumulated_dep_accounting"])
        sim["tax_book_value"] = _r2(cost - sim["accumulated_dep_tax"])
        schedule.append({
            "year": start_year + yr - 1,
            "accounting_dep": acc_dep, "tax_dep": tax_dep,
            "timing_difference": _r2(acc_dep - tax_dep),
            "accum_dep_accounting": sim["accumulated_dep_accounting"],
            "accum_dep_tax": sim["accumulated_dep_tax"],
            "net_book_value": sim["net_book_value"], "tax_book_value": sim["tax_book_value"],
        })
        if acc_dep <= 0 and tax_dep <= 0:
            break
    return {"asset": sim["asset_name"], "schedule": schedule}


@router.get("/depreciation-history/{asset_id}")
async def get_depreciation_history(asset_id: str, current_user: dict = Depends(get_current_user)):
    entries = await db.depreciation_entries.find(
        {"asset_id": asset_id, "company_id": current_user["company_id"]}, {"_id": 0}
    ).sort("period", 1).to_list(None)
    return {"entries": entries, "total": len(entries)}


@router.get("/{asset_id}")
async def get_asset(asset_id: str, current_user: dict = Depends(get_current_user)):
    asset = await db.fixed_assets.find_one(
        {"id": asset_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "الأصل غير موجود")
    return normalize(asset)


# descriptive fields can always change; depreciation settings only until the
# first depreciation is posted; cost/type/asset account never (the purchase
# entry is already posted with them — dispose and re-register instead).
# The old endpoint did $set with the raw body: any field, including
# company_id, status or accumulated depreciation, could be overwritten.
EDITABLE_ALWAYS = {"asset_name", "serial_number", "location", "description", "notes",
                   "cost_center_id", "project_id", "supplier_id"}
EDITABLE_BEFORE_DEP = {"useful_life_years", "accounting_rate", "dep_method", "salvage_value",
                       "dep_expense_acc_code", "is_new_productive"}


@router.put("/{asset_id}")
async def update_asset(asset_id: str, data: dict, current_user: dict = Depends(get_current_user)):
    """تعديل بيانات الأصل"""
    company_id = current_user["company_id"]
    asset = await db.fixed_assets.find_one({"id": asset_id, "company_id": company_id}, {"_id": 0})
    if not asset:
        raise HTTPException(404, "الأصل غير موجود")
    asset = normalize(asset)
    blocked = {"purchase_cost", "asset_type", "asset_account_code", "accum_dep_acc_code"} & set(data)
    if blocked:
        raise HTTPException(400, "لا يمكن تعديل التكلفة أو النوع أو حساب الأصل بعد ترحيل قيد الشراء — استبعد الأصل وأعد تسجيله")
    sets = {k: data[k] for k in EDITABLE_ALWAYS if k in data}
    dep_changes = {k: data[k] for k in EDITABLE_BEFORE_DEP if k in data}
    if dep_changes:
        if float(asset["accumulated_dep_accounting"]) > 0 or asset.get("status") == AssetStatus.DISPOSED.value:
            raise HTTPException(400, "لا يمكن تعديل إعدادات الإهلاك بعد ترحيل إهلاك على الأصل")
        for k in ("useful_life_years", "accounting_rate", "salvage_value"):
            if k in dep_changes:
                dep_changes[k] = _num(dep_changes, k, 0)
        if dep_changes.get("accounting_rate", 0) > 1:
            dep_changes["accounting_rate"] = dep_changes["accounting_rate"] / 100
        if "dep_method" in dep_changes and dep_changes["dep_method"] not in {m.value for m in DepreciationMethod}:
            raise HTTPException(400, "طريقة الإهلاك غير صحيحة")
        if "salvage_value" in dep_changes and dep_changes["salvage_value"] >= float(asset["purchase_cost"]):
            raise HTTPException(400, "القيمة التخريدية يجب أن تكون أقل من التكلفة")
        if dep_changes.get("dep_expense_acc_code"):
            acc = await require_account(company_id, dep_changes["dep_expense_acc_code"], "مصروف الإهلاك")
            if getattr(acc.get("account_type"), "value", acc.get("account_type")) != "expense":
                raise HTTPException(400, "حساب مصروف الإهلاك يجب أن يكون حساب مصروفات")
        sets.update(dep_changes)
    if not sets:
        raise HTTPException(400, "لا توجد حقول قابلة للتعديل")
    sets["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fixed_assets.update_one({"id": asset_id, "company_id": company_id}, {"$set": sets})
    return {"message": "تم تعديل الأصل"}
