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

Above the user's approval threshold (approval bands / approval_limit in
/api/approvals) the voucher is saved as pending_approval with NO entry; the
approvals engine calls post_pending_voucher() when the request is approved.
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


async def _resolve_source(company_id: str, source: str):
    """(source_code, source_label, bank doc | None) for 'cash' or a bank account id."""
    bank = None
    if source == "cash":
        return CASH_CODE, "الخزينة", None
    try:
        bank = await db.bank_accounts.find_one({"_id": ObjectId(source), "company_id": company_id})
    except Exception:
        bank = None
    if not bank:
        raise HTTPException(400, "الحساب البنكي غير موجود")
    label = f"{bank.get('bank_name', '')} {bank.get('account_number', '')}".strip()
    return bank.get("linked_account_code") or "162", label, bank


async def _post_voucher(company_id: str, user_id: str, number: str, date: str, amount: float,
                        counter: dict, source: str, beneficiary: str, description: str,
                        reference: Optional[str]) -> dict:
    """Post the entry (and the bank withdrawal). Raises HTTPException when it
    cannot — nothing is written in that case."""
    source_code, source_label, bank = await _resolve_source(company_id, source)
    source_acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": source_code}, {"_id": 0})
    if not source_acc:
        raise HTTPException(400, f"حساب {source_code} غير موجود في شجرة الحسابات")
    balance = await _ledger_balance(company_id, source_acc)
    if source == "cash" and amount > balance + 0.005:
        raise HTTPException(400, f"رصيد الخزينة {balance:,.2f} لا يكفي لصرف {amount:,.2f}")
    desc = f"سند صرف {number} — {beneficiary}: {description}"[:200]

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
            "transaction_type": "withdrawal", "amount": amount, "description": description,
            "reference": reference or number, "beneficiary": beneficiary,
            "counter_account_code": counter["account_code"], "auto_create_journal": False,
            "transaction_number": number, "bank_name": bank.get("bank_name"),
            "account_number": bank.get("account_number"), "transaction_date": date,
            "journal_entry_id": entry["id"], "journal_entry_number": entry.get("entry_number"),
            "status": "posted", "created_at": datetime.now(timezone.utc), "created_by": user_id,
        }
        txn_id = str((await db.bank_transactions.insert_one(txn)).inserted_id)
    warning = None
    if bank and amount > balance + 0.005:
        warning = f"رصيد البنك في الدفتر كان {balance:,.2f} — الحساب أصبح مكشوفاً"
    return {"journal_entry_id": entry["id"],
            "journal_entry_number": entry.get("entry_number_str") or entry.get("entry_number"),
            "bank_transaction_id": txn_id, "warning": warning}


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

    source_code, source_label, bank = await _resolve_source(company_id, v.source)
    source_acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": source_code}, {"_id": 0})
    if not source_acc:
        raise HTTPException(400, f"حساب {source_code} غير موجود في شجرة الحسابات")
    if source_acc["id"] == counter["id"]:
        raise HTTPException(400, "الحساب المقابل هو نفس حساب الصرف")

    # above the user's approval threshold: saved, but nothing is posted until approved
    from api.approvals import approval_required
    need = await approval_required(company_id, "expense", amount, user_id)

    balance = await _ledger_balance(company_id, source_acc)
    if v.source == "cash" and amount > balance + 0.005 and not need["required"]:
        raise HTTPException(400, f"رصيد الخزينة {balance:,.2f} لا يكفي لصرف {amount:,.2f}")

    year = date[:4]
    seq = await db.counters.find_one_and_update(
        {"_id": f"payment_voucher:{company_id}:{year}"}, {"$inc": {"seq": 1}},
        upsert=True, return_document=True)
    number = f"PV-{year}-{int((seq or {}).get('seq', 1)):04d}"

    voucher = {
        "id": number, "number": number, "company_id": company_id, "date": date,
        "source": "cash" if v.source == "cash" else "bank", "bank_account_id": str(bank["_id"]) if bank else None,
        "source_ref": v.source,
        "source_label": source_label, "source_account_code": source_code,
        "counter_account_id": counter["id"], "counter_account_code": counter["account_code"],
        "counter_account_name": counter["account_name"], "beneficiary": v.beneficiary,
        "description": v.description, "reference": v.reference, "amount": amount,
        "journal_entry_id": None, "journal_entry_number": None,
        "bank_transaction_id": None, "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if need["required"]:
        from api.approvals import gate_document
        req = await gate_document(
            company_id, user_id, current_user.get("full_name"), "expense", amount,
            "payment_voucher", number, f"سند صرف {number} — {v.beneficiary}",
            description=v.description,
            data={"source": source_label, "counter_account": counter["account_name"]},
            role=current_user.get("role"))
        if req:
            voucher.update(status="pending_approval", approval_request_id=req["id"],
                           approval_band=req.get("band_label"))
            await db.payment_vouchers.insert_one(dict(voucher))
            return {"message": f"السند {number} يتجاوز حد الاعتماد — حُفظ بانتظار الموافقة ولم يُرحَّل بعد",
                    "voucher": voucher, "pending_approval": True}

    posted = await _post_voucher(company_id, user_id, number, date, amount, counter, v.source,
                                 v.beneficiary, v.description, v.reference)
    warning = posted.pop("warning")
    voucher.update(status="posted", **posted)
    await db.payment_vouchers.insert_one(dict(voucher))
    return {"message": f"تم الصرف وترحيل القيد {voucher['journal_entry_number']}", "voucher": voucher,
            **({"warning": warning} if warning else {})}


async def post_pending_voucher(company_id: str, number: str, request_id: Optional[str] = None,
                               approver_id: Optional[str] = None) -> dict:
    """Called by the approvals engine when the voucher's request is approved:
    post the entry now. Only the request the voucher opened can release it."""
    q = {"id": number, "company_id": company_id, "status": "pending_approval"}
    if request_id:
        q["approval_request_id"] = request_id
    v = await db.payment_vouchers.find_one(q, {"_id": 0})
    if not v:
        return {}
    # claim it first so two approvals cannot post it twice
    claim = await db.payment_vouchers.update_one(q, {"$set": {"status": "posting"}})
    if not claim.modified_count:
        return {}
    try:
        counter = await db.chart_of_accounts.find_one(
            {"company_id": company_id, "id": v["counter_account_id"]}, {"_id": 0})
        if not counter:
            raise HTTPException(400, "الحساب المقابل لم يعد موجوداً")
        posted = await _post_voucher(company_id, v.get("created_by"), number, v["date"], float(v["amount"]),
                                     counter, v.get("source_ref") or (v.get("bank_account_id") or "cash"),
                                     v.get("beneficiary", ""), v.get("description", ""), v.get("reference"))
    except Exception:
        await db.payment_vouchers.update_one({"id": number, "company_id": company_id, "status": "posting"},
                                             {"$set": {"status": "pending_approval"}})
        raise
    posted.pop("warning", None)
    await db.payment_vouchers.update_one(
        {"id": number, "company_id": company_id},
        {"$set": {**posted, "status": "posted", "approved_by": approver_id,
                  "approved_at": datetime.now(timezone.utc).isoformat()}})
    return posted


@router.post("/{number}/post")
async def retry_post(number: str, current_user: dict = Depends(get_current_user)):
    """Re-try posting an approved voucher whose entry failed at approval time
    (e.g. the cash box did not cover it then)."""
    await _require_finance(current_user)
    company_id = current_user["company_id"]
    v = await db.payment_vouchers.find_one({"id": number, "company_id": company_id}, {"_id": 0})
    if not v or v.get("status") != "post_failed":
        raise HTTPException(400, "السند ليس معتمداً بانتظار الترحيل")
    req = await db.approval_requests.find_one(
        {"id": v.get("approval_request_id"), "company_id": company_id, "status": "approved"}, {"_id": 1})
    if not req:
        raise HTTPException(400, "السند غير معتمد")
    await db.payment_vouchers.update_one({"id": number, "company_id": company_id, "status": "post_failed"},
                                         {"$set": {"status": "pending_approval"}})
    try:
        posted = await post_pending_voucher(company_id, number, v.get("approval_request_id"),
                                            current_user.get("user_id"))
    except Exception as e:
        await db.payment_vouchers.update_one(
            {"id": number, "company_id": company_id, "status": "pending_approval"},
            {"$set": {"status": "post_failed", "post_error": getattr(e, "detail", None) or str(e)}})
        raise
    return {"message": f"تم ترحيل القيد {posted.get('journal_entry_number')}", **posted}
