"""
Petty Cash Engine — محرك دورة العهد النقدية
المستديمة (Imprest) والمؤقتة (Temporary Advance)

المراحل الثلاث:
1. صرف العهدة (Fund Disbursement)
   Dr م/1331 أو م/1332 عهد نقدية — اسم الأمين
   Cr م/161 خزينة / م/112 بنك

2. استعاضة العهدة (Fund Replenishment)
   Dr مصروفات متنوعة (بوفيه، وقود، صيانة...)
   Cr م/161 خزينة / م/112 بنك

3. تصفية وإغلاق العهدة (Settlement & Closing)
   Dr مصروفات (الفواتير المتبقية)
   Dr م/161 خزينة (المبلغ المُعاد)
   Cr م/1331 أو م/1332 عهد نقدية (إقفال)
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

router = APIRouter(prefix="/api/petty-cash", tags=["Petty Cash"])

# ── Account codes ─────────────────────────────────────────────
ACC = {
    "imprest":   "1331",  # عهد نقدية مستديمة
    "temporary": "1332",  # عهد نقدية مؤقتة
    "petty_exp": "336",   # مصروفات نثرية عامة
    "buffet":    "3361",  # بوفيه وضيافة
    "fuel":      "3362",  # وقود ومواصلات
    "maint":     "3363",  # صيانة طارئة
    "misc_exp":  "332",   # مصروفات خدمية متنوعة
    "main_cash": "161",   # خزينة رئيسية
    "bank":      "112",   # بنك
}

# Sub-expense categories
EXPENSE_ACCOUNTS = {
    "buffet":      ("3361", "مصروفات بوفيه وضيافة"),
    "fuel":        ("3362", "مصروفات وقود ومواصلات"),
    "maintenance": ("3363", "مصروفات صيانة طارئة"),
    "stationery":  ("332",  "مصروفات قرطاسية ومطبوعات"),
    "cleaning":    ("332",  "مصروفات نظافة"),
    "misc":        ("336",  "مصروفات نثرية متنوعة"),
    "transport":   ("3362", "مصروفات نقل وتوصيل"),
    "repairs":     ("3363", "مصروفات إصلاح طارئ"),
}


async def get_acc(company_id: str, code: str) -> dict:
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id":      str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit":  round(debit, 2), "credit": round(credit, 2),
        "description": desc,
    }


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None) -> str:
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="petty_cash", source_document_id=src_id,
        created_by=user_id,
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], user_id)
    return result["id"]


def check_balance(lines: list) -> bool:
    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    return abs(td - tc) < 0.01


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class OpenFundRequest(BaseModel):
    custodian_name:  str
    custodian_id:    Optional[str] = None   # employee_id
    fund_type:       str = "imprest"        # imprest | temporary
    amount:          float
    purpose:         str
    date_str:        str
    source:          str = "main_cash"      # main_cash | bank
    notes:           Optional[str] = None


class ReplenishmentItem(BaseModel):
    category:    str   # buffet | fuel | maintenance | misc ...
    description: str
    amount:      float
    receipt_ref: Optional[str] = None


class ReplenishRequest(BaseModel):
    fund_id:   str
    date_str:  str
    items:     List[ReplenishmentItem]
    source:    str = "main_cash"
    notes:     Optional[str] = None


class SettleRequest(BaseModel):
    fund_id:       str
    date_str:      str
    expense_items: List[ReplenishmentItem]  # فواتير متبقية لم تُصرَف بعد
    cash_returned: float = 0.0              # المبلغ المُعاد للخزينة
    notes:         Optional[str] = None


# ══════════════════════════════════════════════════════════════
# 1. صرف العهدة — OPEN FUND
# ══════════════════════════════════════════════════════════════

@router.post("/funds")
async def open_petty_cash_fund(
    req: OpenFundRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    صرف العهدة النقدية لأمين العهدة

    المستديمة (Imprest): مبلغ ثابت يُستعاض دورياً
    المؤقتة (Temporary):  مبلغ لمهمة محددة يُغلَق بعدها

    القيد:
    Dr م/1331 أو م/1332 عهد نقدية — [اسم الأمين]  ← المبلغ المصروف
    Cr م/161 الخزينة الرئيسية / م/112 البنك         ← المصدر
    """
    company_id = current_user["company_id"]
    fund_id    = str(uuid.uuid4())

    if req.amount <= 0:
        raise HTTPException(400, "مبلغ العهدة يجب أن يكون موجباً")
    if req.fund_type not in ("imprest", "temporary"):
        raise HTTPException(400, "fund_type: imprest | temporary")

    acc_code    = ACC["imprest"] if req.fund_type == "imprest" else ACC["temporary"]
    acc_name_ar = "عهدة نقدية مستديمة" if req.fund_type == "imprest" else "عهدة نقدية مؤقتة"
    src_code    = ACC["main_cash"] if req.source == "main_cash" else ACC["bank"]
    src_name_ar = "الخزينة الرئيسية" if req.source == "main_cash" else "البنك"

    lines = await asyncio.gather(
        je_line(company_id, acc_code, debit=req.amount,
                desc=f"{acc_name_ar} — {req.custodian_name} — {req.purpose}"),
        je_line(company_id, src_code, credit=req.amount,
                desc=f"صرف عهدة نقدية لـ {req.custodian_name}"),
    )
    je_id = await post_je(
        company_id, current_user["user_id"], req.date_str,
        f"صرف عهدة نقدية — {req.custodian_name}", list(lines), fund_id
    )

    fund = {
        "id":             fund_id,
        "company_id":     company_id,
        "custodian_name": req.custodian_name,
        "custodian_id":   req.custodian_id,
        "fund_type":      req.fund_type,
        "fund_type_ar":   acc_name_ar,
        "original_amount": req.amount,
        "current_balance": req.amount,   # ينخفض مع الإنفاق
        "total_spent":    0.0,
        "total_replenished": 0.0,
        "purpose":        req.purpose,
        "source":         req.source,
        "account_code":   acc_code,
        "status":         "open",
        "open_date":      req.date_str,
        "close_date":     None,
        "open_je_id":     je_id,
        "replenishments": [],
        "notes":          req.notes,
        "created_at":     datetime.now(timezone.utc).isoformat(),
        "created_by":     current_user["user_id"],
    }
    await db.petty_cash_funds.insert_one(fund)
    fund.pop("_id", None)

    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)

    return {
        "message":   f"✅ تم صرف العهدة النقدية لـ {req.custodian_name}",
        "fund_id":   fund_id,
        "fund":      fund,
        "journal": {
            "id":       je_id,
            "debit":    f"م/{acc_code} {acc_name_ar}  {req.amount:,.2f}",
            "credit":   f"م/{src_code} {src_name_ar}  {req.amount:,.2f}",
            "balanced": abs(td - tc) < 0.01,
        },
    }


# ══════════════════════════════════════════════════════════════
# 2. استعاضة العهدة — REPLENISHMENT
# ══════════════════════════════════════════════════════════════

@router.post("/funds/{fund_id}/replenish")
async def replenish_petty_cash(
    fund_id: str,
    req: ReplenishRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    استعاضة العهدة النقدية (تعبئة ما تم إنفاقه بعد تقديم الفواتير)

    يُصرَف من الخزينة الرئيسية / البنك مباشرة لتغطية المصروفات

    القيد:
    Dr مصروفات متنوعة (بوفيه، وقود، صيانة...) ← قيمة الفواتير
    Cr م/161 الخزينة الرئيسية / م/112 البنك    ← المبلغ المصروف للاستعاضة
    """
    company_id = current_user["company_id"]

    fund = await db.petty_cash_funds.find_one(
        {"id": fund_id, "company_id": company_id}, {"_id": 0})
    if not fund:
        raise HTTPException(404, "العهدة غير موجودة")
    if fund["status"] != "open":
        raise HTTPException(400, f"العهدة في حالة '{fund['status']}' — لا يمكن الاستعاضة")

    total_amount = round(sum(float(i.amount) for i in req.items), 2)
    if total_amount <= 0:
        raise HTTPException(400, "إجمالي مبالغ الاستعاضة يجب أن يكون موجباً")

    src_code    = ACC["main_cash"] if req.source == "main_cash" else ACC["bank"]
    src_name_ar = "الخزينة الرئيسية" if req.source == "main_cash" else "البنك"

    # Build expense lines (مدين)
    exp_lines = []
    for item in req.items:
        exp_acc_code, exp_acc_name = EXPENSE_ACCOUNTS.get(
            item.category, (ACC["petty_exp"], "مصروفات نثرية"))
        exp_lines.append(await je_line(
            company_id, exp_acc_code, debit=float(item.amount),
            desc=f"{item.description} — إيصال: {item.receipt_ref or '-'}"
        ))

    # Credit: source
    src_line = await je_line(
        company_id, src_code, credit=total_amount,
        desc=f"استعاضة عهدة {fund['custodian_name']} — {len(req.items)} بند"
    )

    all_lines = exp_lines + [src_line]
    rep_id    = str(uuid.uuid4())
    je_id     = await post_je(
        company_id, current_user["user_id"], req.date_str,
        f"استعاضة عهدة نقدية — {fund['custodian_name']}", all_lines, rep_id
    )

    # Build replenishment record
    rep_record = {
        "id":           rep_id,
        "date":         req.date_str,
        "items":        [i.dict() for i in req.items],
        "total_amount": total_amount,
        "source":       req.source,
        "je_id":        je_id,
        "notes":        req.notes,
        "created_at":   datetime.now(timezone.utc).isoformat(),
    }

    new_balance = round(float(fund["current_balance"]) - total_amount + total_amount, 2)
    # Note: استعاضة تعيد الرصيد للقيمة الأصلية
    new_balance = float(fund["original_amount"])  # Imprest: restored to original
    new_spent   = round(float(fund.get("total_spent",0)) + total_amount, 2)
    new_rep     = round(float(fund.get("total_replenished",0)) + total_amount, 2)

    await db.petty_cash_funds.update_one(
        {"id": fund_id},
        {"$set": {
            "current_balance":    new_balance,
            "total_spent":        new_spent,
            "total_replenished":  new_rep,
        },
        "$push": {"replenishments": rep_record}}
    )

    td = round(sum(l["debit"] for l in all_lines), 2)
    tc = round(sum(l["credit"] for l in all_lines), 2)

    return {
        "message":     f"✅ تم استعاضة العهدة — {total_amount:,.2f} ج.م",
        "fund_id":     fund_id,
        "replenishment_id": rep_id,
        "total_amount": total_amount,
        "items_count":  len(req.items),
        "new_balance":  new_balance,
        "journal": {
            "id":       je_id,
            "debits":   [f"م/{l['account_code']} {l['account_name']}  {l['debit']:,.2f}"
                         for l in exp_lines],
            "credit":   f"م/{src_code} {src_name_ar}  {total_amount:,.2f}",
            "balanced": abs(td - tc) < 0.01,
        },
    }


# ══════════════════════════════════════════════════════════════
# 3. تصفية وإغلاق العهدة — SETTLEMENT & CLOSING
# ══════════════════════════════════════════════════════════════

@router.post("/funds/{fund_id}/settle")
async def settle_petty_cash(
    fund_id: str,
    req: SettleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    تصفية وإغلاق العهدة النقدية

    عند انتهاء الغرض (خاصةً المؤقتة):
    - تسجيل الفواتير المتبقية كمصروفات
    - استرداد المبلغ المتبقي للخزينة
    - إقفال حساب العهدة

    القيد:
    Dr مصروفات (الفواتير المتبقية)
    Dr م/161 خزينة / م/112 بنك (المبلغ المُعاد نقداً)
    Cr م/1331 أو م/1332 عهد نقدية  ← إقفال الحساب
    """
    company_id = current_user["company_id"]

    fund = await db.petty_cash_funds.find_one(
        {"id": fund_id, "company_id": company_id}, {"_id": 0})
    if not fund:
        raise HTTPException(404, "العهدة غير موجودة")
    if fund["status"] == "closed":
        raise HTTPException(400, "العهدة مُغلَقة بالفعل")

    total_expenses = round(sum(float(i.amount) for i in req.expense_items), 2)
    cash_returned  = round(float(req.cash_returned), 2)
    total_credit   = round(total_expenses + cash_returned, 2)
    fund_balance   = round(float(fund.get("current_balance", fund["original_amount"])), 2)

    # Validate: expenses + returned = current balance (within rounding)
    if abs(total_credit - fund_balance) > 1.0:
        raise HTTPException(400,
            f"المصروفات {total_expenses:,.2f} + المُعاد {cash_returned:,.2f} = {total_credit:,.2f} "
            f"≠ رصيد العهدة {fund_balance:,.2f} — تحقق من المبالغ"
        )

    settle_id   = str(uuid.uuid4())
    acc_code    = fund.get("account_code", ACC["imprest"])
    acc_name_ar = fund.get("fund_type_ar", "عهدة نقدية")
    src_code    = ACC["main_cash"] if fund.get("source") == "main_cash" else ACC["bank"]

    all_lines = []

    # Expense lines (مدين)
    for item in req.expense_items:
        exp_acc_code, exp_acc_name = EXPENSE_ACCOUNTS.get(
            item.category, (ACC["petty_exp"], "مصروفات نثرية"))
        all_lines.append(await je_line(
            company_id, exp_acc_code, debit=float(item.amount),
            desc=f"{item.description} — تصفية العهدة — {item.receipt_ref or ''}"
        ))

    # Cash returned to treasury (مدين)
    if cash_returned > 0:
        all_lines.append(await je_line(
            company_id, src_code, debit=cash_returned,
            desc=f"إعادة نقدية من عهدة {fund['custodian_name']}"
        ))

    # Close fund account (دائن) — إقفال حساب العهدة
    all_lines.append(await je_line(
        company_id, acc_code, credit=fund_balance,
        desc=f"إقفال {acc_name_ar} — {fund['custodian_name']}"
    ))

    je_id = await post_je(
        company_id, current_user["user_id"], req.date_str,
        f"تصفية وإغلاق عهدة — {fund['custodian_name']}", all_lines, settle_id
    )

    td = round(sum(l["debit"]  for l in all_lines), 2)
    tc = round(sum(l["credit"] for l in all_lines), 2)

    # Update fund status
    await db.petty_cash_funds.update_one(
        {"id": fund_id},
        {"$set": {
            "status":         "closed",
            "current_balance": 0.0,
            "close_date":     req.date_str,
            "settle_je_id":   je_id,
            "settlement": {
                "id":             settle_id,
                "expense_items":  [i.dict() for i in req.expense_items],
                "total_expenses": total_expenses,
                "cash_returned":  cash_returned,
                "je_id":          je_id,
                "settled_at":     datetime.now(timezone.utc).isoformat(),
            }
        }}
    )

    return {
        "message":       f"✅ تم تصفية وإغلاق العهدة — {fund['custodian_name']}",
        "fund_id":       fund_id,
        "settlement_id": settle_id,
        "summary": {
            "original_amount":   fund["original_amount"],
            "total_expenses":    total_expenses,
            "cash_returned":     cash_returned,
            "total_reconciled":  round(total_expenses + cash_returned, 2),
        },
        "journal": {
            "id":       je_id,
            "debits":   (
                [f"م/{EXPENSE_ACCOUNTS.get(i.category,(ACC['petty_exp'],''))[0]} "
                 f"{i.description}  {i.amount:,.2f}" for i in req.expense_items] +
                ([f"م/{src_code} خزينة (مُعاد)  {cash_returned:,.2f}"]
                 if cash_returned > 0 else [])
            ),
            "credit":   f"م/{acc_code} {acc_name_ar}  {fund_balance:,.2f}",
            "balanced": abs(td - tc) < 0.01,
        },
        "status": "closed",
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/funds")
async def list_funds(
    status: Optional[str] = None,
    fund_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """قائمة العهد النقدية مع ملخص الأرصدة"""
    q = {"company_id": current_user["company_id"]}
    if status:    q["status"]    = status
    if fund_type: q["fund_type"] = fund_type

    funds = await db.petty_cash_funds.find(
        q, {"_id": 0, "replenishments": 0, "settlement": 0}
    ).sort("created_at", -1).to_list(None)

    total_open   = round(sum(float(f.get("current_balance",0))
                             for f in funds if f["status"]=="open"), 2)
    total_imprest= sum(1 for f in funds
                       if f["fund_type"]=="imprest" and f["status"]=="open")
    total_temp   = sum(1 for f in funds
                       if f["fund_type"]=="temporary" and f["status"]=="open")

    return {
        "funds":          funds,
        "total":          len(funds),
        "open_balance":   total_open,
        "imprest_open":   total_imprest,
        "temporary_open": total_temp,
        "note":           "رصيد العهد المفتوحة يُعتبَر أصلاً متداولاً في الميزانية",
    }


@router.get("/funds/{fund_id}")
async def get_fund(fund_id: str, current_user: dict = Depends(get_current_user)):
    """تفاصيل عهدة نقدية محددة مع كل الحركات"""
    fund = await db.petty_cash_funds.find_one(
        {"id": fund_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not fund:
        raise HTTPException(404, "العهدة غير موجودة")
    return fund


@router.get("/funds/{fund_id}/statement")
async def fund_statement(fund_id: str, current_user: dict = Depends(get_current_user)):
    """كشف حساب العهدة النقدية الكامل"""
    company_id = current_user["company_id"]
    fund = await db.petty_cash_funds.find_one(
        {"id": fund_id, "company_id": company_id}, {"_id": 0})
    if not fund:
        raise HTTPException(404, "العهدة غير موجودة")

    reps = fund.get("replenishments", [])
    total_items = sum(len(r.get("items",[])) for r in reps)
    total_rep   = sum(float(r.get("total_amount",0)) for r in reps)

    # Category breakdown
    cat_totals: dict = {}
    for rep in reps:
        for item in rep.get("items",[]):
            cat = item.get("category","misc")
            cat_totals[cat] = cat_totals.get(cat, 0) + float(item.get("amount",0))

    return {
        "fund_id":        fund_id,
        "custodian":      fund["custodian_name"],
        "fund_type":      fund["fund_type_ar"],
        "status":         fund["status"],
        "original_amount": fund["original_amount"],
        "current_balance": fund.get("current_balance", 0),
        "total_spent":     fund.get("total_spent", 0),
        "total_replenished": fund.get("total_replenished", 0),
        "replenishments_count": len(reps),
        "total_receipts_count": total_items,
        "category_breakdown": [
            {"category": k, "total": round(v, 2),
             "account": EXPENSE_ACCOUNTS.get(k,("",""))[0]}
            for k, v in sorted(cat_totals.items(), key=lambda x: -x[1])
        ],
        "replenishments": reps,
        "settlement":     fund.get("settlement"),
    }


@router.get("/summary")
async def petty_cash_summary(current_user: dict = Depends(get_current_user)):
    """ملخص جميع العهد النقدية للشركة"""
    company_id = current_user["company_id"]
    funds = await db.petty_cash_funds.find(
        {"company_id": company_id}, {"_id": 0, "replenishments": 0}
    ).to_list(None)

    open_funds   = [f for f in funds if f["status"]=="open"]
    closed_funds = [f for f in funds if f["status"]=="closed"]
    total_open_balance = round(sum(float(f.get("current_balance",0)) for f in open_funds), 2)

    return {
        "total_funds":        len(funds),
        "open_funds":         len(open_funds),
        "closed_funds":       len(closed_funds),
        "total_open_balance": total_open_balance,
        "by_type": {
            "imprest_open":   sum(1 for f in open_funds if f["fund_type"]=="imprest"),
            "temporary_open": sum(1 for f in open_funds if f["fund_type"]=="temporary"),
        },
        "open_funds_detail":  [
            {"custodian": f["custodian_name"], "type": f["fund_type_ar"],
             "balance": f.get("current_balance",0), "since": f["open_date"]}
            for f in open_funds
        ],
        "note": f"إجمالي العهد المفتوحة: {total_open_balance:,.2f} ج.م أصول متداولة",
    }
