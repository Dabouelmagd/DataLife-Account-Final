"""
سند صرف — صرف مبلغ من الخزينة أو من حساب بنكي.

One form for every payment that leaves the company's cash: pick where the
money comes from (the cash box, or one of the company's bank accounts), who
it goes to and what it is for (the counter account), and the amount. The
voucher is saved together with a POSTED journal entry:

    Dr  counter account (expense, supplier, advance, partner …)
    Cr  cash box 161  /  the bank's linked account (162 …)

A bank payment is also recorded as a withdrawal on that bank account, so the
bank page's balance per bank and the ledger move together. Nothing is saved
if the entry cannot be posted — a voucher without its entry is a payment the
books never saw.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from api.users import get_current_user
from database import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payment-vouchers", tags=["سندات الصرف"])

CASH_CODE = "161"
DEBIT_TYPES = {"asset", "expense", "contra_liability", "contra_equity"}
MANAGER_ROLES = ("Super Admin", "مدير النظام", "رئيس مجلس الإدارة", "Board Chairman",
                 "مدير عام", "General Manager", "المدير المالي", "CFO", "محاسب", "Accountant")


class VoucherIn(BaseModel):
    source: str = Field(..., description="'cash' أو معرّف الحساب البنكي")
    amount: float = Field(..., gt=0)
    date: Optional[str] = None
    counter_account_id: str
    beneficiary: str = Field(..., min_length=2, max_length=150)
    description: str = Field(..., min_length=3, max_length=300)
    reference: Optional[str] = Field(None, max_length=80)


def _kind(t) -> str:
    return str(getattr(t, "value", t) or "").lower()


async def _require_finance(user: dict):
    u = await db.users.find_one({"id": user.get("user_id")}, {"_id": 0}) or {}
    if u.get("role") in MANAGER_ROLES or u.get("is_platform_admin"):
        return
    try:
        from services.route_permissions import effective_permissions
        perms = effective_permissions(u)
    except Exception:
        perms = set(u.get("permissions") or [])
    if not ({"financial", "bank", "treasury"} & set(perms)):
        raise HTTPException(403, "صرف المبالغ يحتاج صلاحية الإدارة المالية")


async def _ledger_balance(company_id: str, account: dict) -> float:
    rows = await db.general_ledger.aggregate([
        {"$match": {"company_id": company_id, "account_id": account["id"]}},
        {"$group": {"_id": None, "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}]).to_list(1)
    d, c = (rows[0]["d"], rows[0]["c"]) if rows else (0, 0)
    op = float(account.get("opening_balance") or 0)
    return round(op + (d - c if _kind(account.get("account_type")) in DEBIT_TYPES else c - d), 2)


async def _sources(company_id: str) -> list:
    """Where money can be paid from: the cash box and each bank account."""
    chart = {a["account_code"]: a async for a in db.chart_of_accounts.find(
        {"company_id": company_id}, {"_id": 0})}
    out = []
    if CASH_CODE in chart:
        out.append({"id": "cash", "label": chart[CASH_CODE]["account_name"], "kind": "cash",
                    "account_code": CASH_CODE,
                    "balance": await _ledger_balance(company_id, chart[CASH_CODE])})
    async for b in db.bank_accounts.find({"company_id": company_id, "is_active": {"$ne": False}}):
        code = b.get("linked_account_code") or "162"
        acc = chart.get(code)
        if not acc:
            continue
        out.append({"id": str(b["_id"]), "label": f"{b.get('bank_name', '')} — {b.get('account_number', '')}",
                    "kind": "bank", "account_code": code,
                    # all banks linked to one ledger account share its balance
                    "balance": await _ledger_balance(company_id, acc)})
    return out


@router.get("/sources")
async def list_sources(current_user: dict = Depends(get_current_user)):
    await _require_finance(current_user)
    return {"sources": await _sources(current_user["company_id"])}


@router.get("")
async def list_vouchers(limit: int = Query(100, le=500), current_user: dict = Depends(get_current_user)):
    await _require_finance(current_user)
    rows = await db.payment_vouchers.find(
        {"company_id": current_user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"vouchers": rows, "total": len(rows)}


@router.post("")
async def create_voucher(v: VoucherIn, current_user: dict = Depends(get_current_user)):
    await _require_finance(current_user)
    company_id = current_user["company_id"]
    user_id = current_user.get("user_id")
    date = (v.date or datetime.now(timezone.utc).strftime("%Y-%m-%d"))[:10]
    if date > datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        raise HTTPException(400, "تاريخ السند في المستقبل — الصرف يُسجَّل بتاريخ حدوثه")
    amount = round(v.amount, 2)

    counter = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "id": v.counter_account_id}, {"_id": 0})
    if not counter:
        raise HTTPException(400, "الحساب المقابل غير موجود")
    if counter.get("is_header") or counter.get("account_category") == "header":
        raise HTTPException(400, f"«{counter['account_name']}» حساب تجميعي — اختر حساباً فرعياً تحته")

    bank = None
    if v.source == "cash":
        source_code, source_label = CASH_CODE, "الخزينة"
    else:
        try:
            bank = await db.bank_accounts.find_one({"_id": ObjectId(v.source), "company_id": company_id})
        except Exception:
            bank = None
        if not bank:
            raise HTTPException(400, "الحساب البنكي غير موجود")
        source_code = bank.get("linked_account_code") or "162"
        source_label = f"{bank.get('bank_name', '')} {bank.get('account_number', '')}".strip()
    source_acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": source_code}, {"_id": 0})
    if not source_acc:
        raise HTTPException(400, f"حساب {source_code} غير موجود في شجرة الحسابات")
    if source_acc["id"] == counter["id"]:
        raise HTTPException(400, "الحساب المقابل هو نفس حساب الصرف")

    balance = await _ledger_balance(company_id, source_acc)
    if v.source == "cash" and amount > balance + 0.005:
        raise HTTPException(400, f"رصيد الخزينة {balance:,.2f} لا يكفي لصرف {amount:,.2f}")

    year = date[:4]
    seq = await db.counters.find_one_and_update(
        {"_id": f"payment_voucher:{company_id}:{year}"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=True)
    number = f"PV-{year}-{int((seq or {}).get('seq', 1)):04d}"
    desc = f"سند صرف {number} — {v.beneficiary}: {v.description}"[:200]

    from services.import_documents import post_two_line_entry
    try:
        entry = await post_two_line_entry(db, company_id, user_id, date, counter["account_code"],
                                          source_code, amount, desc, "payment_voucher", number)
    except Exception as e:
        raise HTTPException(400, f"تعذّر ترحيل القيد — لم يُحفظ السند: {e}")

    txn_id = None
    if bank:
        txn = {
            "company_id": company_id, "bank_account_id": str(bank["_id"]),
            "transaction_type": "withdrawal", "amount": amount, "description": v.description,
            "reference": v.reference or number, "beneficiary": v.beneficiary,
            "counter_account_code": counter["account_code"], "auto_create_journal": False,
            "transaction_number": number, "bank_name": bank.get("bank_name"),
            "account_number": bank.get("account_number"), "transaction_date": date,
            "journal_entry_id": entry["id"], "journal_entry_number": entry.get("entry_number"),
            "status": "posted", "created_at": datetime.now(timezone.utc), "created_by": user_id,
        }
        txn_id = str((await db.bank_transactions.insert_one(txn)).inserted_id)

    voucher = {
        "id": number, "number": number, "company_id": company_id, "date": date,
        "source": "cash" if v.source == "cash" else "bank", "bank_account_id": str(bank["_id"]) if bank else None,
        "source_label": source_label, "source_account_code": source_code,
        "counter_account_id": counter["id"], "counter_account_code": counter["account_code"],
        "counter_account_name": counter["account_name"], "beneficiary": v.beneficiary,
        "description": v.description, "reference": v.reference, "amount": amount,
        "journal_entry_id": entry["id"], "journal_entry_number": entry.get("entry_number_str") or entry.get("entry_number"),
        "bank_transaction_id": txn_id, "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_vouchers.insert_one(dict(voucher))
    warning = None
    if bank and amount > balance + 0.005:
        warning = f"رصيد البنك في الدفتر كان {balance:,.2f} — الحساب أصبح مكشوفاً"
    return {"message": f"تم الصرف وترحيل القيد {voucher['journal_entry_number']}", "voucher": voucher,
            **({"warning": warning} if warning else {})}
