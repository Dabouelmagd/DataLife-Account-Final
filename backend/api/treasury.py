"""
Treasury & Cash Management — إدارة الخزينة والشيكات
دورة الشيكات الكاملة وفق الممارسة المحاسبية المصرية

الشيكات الوارده (من العملاء):
  استلام → إيداع للتحصيل → تحصيل | ارتداد

الشيكات الصادرة (للموردين):
  إصدار → صرف من البنك
"""
import uuid, asyncio
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService
from dependencies import get_current_user

router = APIRouter(prefix="/api/treasury", tags=["Treasury & Cheques"])


# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES (Egyptian Standard Chart of Accounts)
# ══════════════════════════════════════════════════════════════
ACC = {
    "cash":             "161",  # الخزينة
    "bank":             "162",  # البنك الجاري
    "ar":               "131",  # العملاء
    "ap":               "251",  # الموردون
    "notes_receivable": "132",  # أوراق القبض (شيكات واردة)
    "under_collection": "163",  # شيكات برسم التحصيل
    "returned_checks":  "1311",  # شيكات مرتدة
    "bounce_fees_exp":  "334",  # مصاريف ارتداد الشيكات
    "notes_payable":    "252",  # أوراق الدفع (شيكات صادرة)
    "bank_charges_exp": "334",  # مصروفات وعمولات بنكية (332 is utilities)
}


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

async def get_acc(company_id: str, code: str) -> dict:
    """Account by code. A missing account used to come back as a stub whose id
    was the code itself, so the entry posted to an account no report could see."""
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )
    if not acc:
        raise HTTPException(400, f"الحساب {code} غير موجود في دليل الحسابات — أضفه أولاً أو اختر حساباً آخر")
    if acc.get("is_header") or acc.get("account_category") == "header" or acc.get("allow_posting") is False:
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name', '')}» حساب تجميعي لا يقبل قيوداً")
    return acc


# 163 (cheques under collection) and 165/1651 (LC / LG margins) sit under 16
# but are not money the company can spend or a bank can debit
NOT_MONEY_CODES = {"163", "165", "1651"}


async def get_bank_acc(company_id: str, code: str) -> dict:
    """The account a cheque is deposited to / drawn on must be a postable
    bank or cash account (16x)."""
    code = str(code or "").strip()
    if not code:
        raise HTTPException(400, "اختر حساب البنك")
    acc = await get_acc(company_id, code)
    ok = code.startswith("16") and code not in NOT_MONEY_CODES and (
        acc.get("account_category") in ("bank", "cash") or str(acc.get("parent_code") or "") in ("161", "162"))
    if not ok:
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name', '')}» ليس حساب بنك أو خزينة (16x)")
    return acc


def check_amount(amount) -> float:
    try:
        amount = round(float(amount), 2)
    except (TypeError, ValueError):
        raise HTTPException(400, "مبلغ الشيك غير صالح")
    if amount <= 0:
        raise HTTPException(400, "مبلغ الشيك يجب أن يكون أكبر من صفر")
    return amount


async def allocate_to_invoices(company_id: str, party_id: str, doc_type: str,
                               amount: float, cheque_id: str, date: str):
    """Apply the cheque to the party's open invoices (no extra entry — the
    cheque's own entry settled the receivable / payable)."""
    from services.invoice_service import InvoiceService
    return await InvoiceService(db).apply_external_payment(
        company_id, party_id, doc_type, amount, "cheque", cheque_id, date)


async def unallocate_from_invoices(company_id: str, cheque_id: str) -> int:
    """Undo allocate_to_invoices: the invoices this cheque paid are open again."""
    n = 0
    async for inv in db.invoices.find({"company_id": company_id, "allocations.ref_id": cheque_id}, {"_id": 0}):
        mine = round(sum(float(a.get("amount") or 0) for a in inv.get("allocations") or []
                         if a.get("ref_id") == cheque_id), 2)
        base = inv.get("settle_amount") or inv.get("grand_total") or 0
        paid = round(max(float(inv.get("amount_paid") or 0) - mine, 0), 2)
        await db.invoices.update_one({"id": inv["id"], "company_id": company_id}, {
            "$set": {"amount_paid": paid, "amount_due": round(max(base - paid, 0), 2),
                     "status": "partially_paid" if paid > 0.004 else "approved",
                     "updated_at": datetime.now(timezone.utc).isoformat()},
            "$pull": {"allocations": {"ref_id": cheque_id}}})
        n += 1
    return n


async def je_line(company_id: str, code: str, debit=0.0, credit=0.0, desc="",
                  partner_type: str = None, partner_id: str = None) -> dict:
    acc = await get_acc(company_id, code)
    return {
        "partner_type": partner_type,
        "partner_id":   partner_id,
        "line_id":      str(uuid.uuid4()),
        "entry_id":     None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit":        round(debit, 2),
        "credit":       round(credit, 2),
        "description":  desc,
    }


async def post_je(company_id: str, user_id: str, date: str,
                  description: str, lines: list, src_id: str = None) -> str:
    """Create and post a journal entry, return entry id"""
    svc = AccountingService(db)
    # Set entry_id on lines
    entry_id_tmp = str(uuid.uuid4())
    for l in lines:
        l["entry_id"] = entry_id_tmp
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date,
        description=description, lines=lines,
        source_document_type="manual", source_document_id=src_id,
        created_by=user_id,
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], user_id)
    return result["id"]


async def cheque_seq(company_id: str, direction: str) -> str:
    """Atomic cheque number: CHQ-IN-0001 or CHQ-OUT-0001"""
    counter = await db.cheque_counters.find_one_and_update(
        {"company_id": company_id, "direction": direction},
        {"$inc": {"last": 1}}, upsert=True, return_document=True
    )
    prefix = "CHQ-IN" if direction == "incoming" else "CHQ-OUT"
    return f"{prefix}-{counter['last']:04d}"


# ══════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ══════════════════════════════════════════════════════════════

class ReceiveChequeRequest(BaseModel):
    customer_id:    str
    customer_name:  str
    amount:         float
    cheque_number:  str
    cheque_date:    str            # تاريخ استحقاق الشيك (آجل)
    receive_date:   str            # تاريخ الاستلام الفعلي
    bank_name:      Optional[str] = None   # بنك العميل
    notes:          Optional[str] = None

class IssueChequeRequest(BaseModel):
    supplier_id:    str
    supplier_name:  str
    amount:         float
    cheque_number:  str
    cheque_date:    str            # تاريخ الاستحقاق
    issue_date:     str            # تاريخ الإصدار
    bank_account_code: str = "162"
    notes:          Optional[str] = None

class DepositRequest(BaseModel):
    cheque_id:      Optional[str] = None
    deposit_date:   str
    bank_account_code: str = "162"
    notes:          Optional[str] = None

class CollectRequest(BaseModel):
    cheque_id:      Optional[str] = None
    collection_date: str
    bank_account_code: Optional[str] = None   # default: the bank it was deposited to

class BounceRequest(BaseModel):
    cheque_id:      Optional[str] = None
    bounce_date:    str
    bounce_reason:  str = "عدم كفاية الرصيد"
    bounce_fees:    float = 0.0            # مصاريف ارتداد الشيك

class ClearOutgoingRequest(BaseModel):
    cheque_id:      Optional[str] = None
    clear_date:     str
    bank_account_code: Optional[str] = None   # default: the bank it was drawn on

class CancelIssuedRequest(BaseModel):
    cheque_id:      Optional[str] = None
    cancel_date:    str
    reason:         str = "إلغاء / إيقاف صرف الشيك"


# ══════════════════════════════════════════════════════════════
# 1. استلام شيك من عميل
#    Dr أوراق قبض (132) | Cr العملاء (131)
# ══════════════════════════════════════════════════════════════

@router.post("/cheques/receive")
async def receive_cheque(req: ReceiveChequeRequest,
                         current_user: dict = Depends(get_current_user)):
    """
    استلام شيك آجل من عميل

    القيد: من حـ/ أوراق قبض (132) ← إلى حـ/ العملاء (131)
    """
    company_id = current_user["company_id"]
    req.amount = check_amount(req.amount)
    cheque_id  = str(uuid.uuid4())

    # ── القيد المحاسبي ────────────────────────────────────────
    lines = await asyncio.gather(
        je_line(company_id, ACC["notes_receivable"], debit=req.amount,
                desc=f"استلام شيك {req.cheque_number} من {req.customer_name}",
                partner_type="customer", partner_id=req.customer_id),
        je_line(company_id, ACC["ar"], credit=req.amount,
                desc=f"تسوية ذمة {req.customer_name} — شيك {req.cheque_number}",
                partner_type="customer", partner_id=req.customer_id),
    )
    ref        = await cheque_seq(company_id, "incoming")
    je_id = await post_je(company_id, current_user["user_id"], req.receive_date,
        f"استلام شيك {ref} من {req.customer_name}", lines, cheque_id)

    # ── حفظ بيانات الشيك ─────────────────────────────────────
    cheque = {
        "id": cheque_id, "ref": ref, "company_id": company_id,
        "direction": "incoming", "status": "received",
        "customer_id": req.customer_id, "customer_name": req.customer_name,
        "amount": req.amount, "cheque_number": req.cheque_number,
        "cheque_date": req.cheque_date, "receive_date": req.receive_date,
        "bank_name": req.bank_name, "notes": req.notes,
        "receive_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cheques.insert_one(cheque); cheque.pop("_id", None)
    # apply it to the customer's open sales invoices (no extra entry — the
    # receipt entry above is what settled the receivable)
    cheque["allocations"], cheque["unallocated"] = await allocate_to_invoices(
        company_id, req.customer_id, "sales_invoice", req.amount, cheque_id, req.receive_date)
    await db.cheques.update_one({"id": cheque_id, "company_id": company_id},
                                {"$set": {"allocations": cheque["allocations"]}})

    return {
        "message": f"تم تسجيل الشيك {ref} — مستحق في {req.cheque_date}",
        "cheque":  cheque,
        "journal": {
            "id": je_id,
            "debit":  f"م/{ACC['notes_receivable']} أوراق قبض  +{req.amount:,.2f}",
            "credit": f"م/{ACC['ar']} العملاء           -{req.amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# 2. إيداع الشيك للتحصيل بالبنك
#    Dr شيكات برسم التحصيل (233) | Cr أوراق قبض (132)
# ══════════════════════════════════════════════════════════════

@router.put("/cheques/{cheque_id}/deposit")
async def deposit_cheque(cheque_id: str, req: DepositRequest,
                         current_user: dict = Depends(get_current_user)):
    """
    إيداع الشيك للتحصيل بالبنك (لم يُحصَّل بعد)

    القيد: من حـ/ شيكات برسم التحصيل (233) ← إلى حـ/ أوراق قبض (132)
    """
    company_id = current_user["company_id"]
    cheque = await db.cheques.find_one(
        {"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not cheque:
        raise HTTPException(404, "الشيك غير موجود")
    if cheque["status"] != "received":
        raise HTTPException(400, f"الشيك في حالة '{cheque['status']}' — يجب أن يكون 'received'")

    amount = cheque["amount"]
    bank_acc = await get_bank_acc(company_id, req.bank_account_code)
    lines = await asyncio.gather(
        je_line(company_id, ACC["under_collection"], debit=amount,
                desc=f"إيداع شيك {cheque['cheque_number']} للتحصيل — {cheque['customer_name']}"),
        je_line(company_id, ACC["notes_receivable"], credit=amount,
                desc=f"إقفال أوراق قبض — شيك {cheque['cheque_number']}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.deposit_date,
        f"إيداع شيك {cheque['ref']} للتحصيل", lines, cheque_id)

    await db.cheques.update_one({"id": cheque_id, "company_id": company_id}, {"$set": {
        "status": "under_collection", "deposit_date": req.deposit_date,
        "bank_account_code": bank_acc["account_code"], "deposit_je_id": je_id,
    }})
    return {
        "message": "تم إيداع الشيك للتحصيل — في انتظار التحصيل الفعلي",
        "journal": {
            "id": je_id,
            "debit":  f"م/{ACC['under_collection']} شيكات برسم التحصيل  +{amount:,.2f}",
            "credit": f"م/{ACC['notes_receivable']} أوراق قبض            -{amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# 3. تحصيل الشيك في الحساب البنكي
#    Dr البنك الجاري (112) | Cr شيكات برسم التحصيل (233)
# ══════════════════════════════════════════════════════════════

@router.put("/cheques/{cheque_id}/collect")
async def collect_cheque(cheque_id: str, req: CollectRequest,
                         current_user: dict = Depends(get_current_user)):
    """
    تحصيل الشيك فعلياً في الحساب البنكي

    القيد: من حـ/ البنك الجاري (112) ← إلى حـ/ شيكات برسم التحصيل (233)
    """
    company_id = current_user["company_id"]
    cheque = await db.cheques.find_one(
        {"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not cheque:
        raise HTTPException(404, "الشيك غير موجود")
    if cheque["status"] != "under_collection":
        raise HTTPException(400, f"الشيك في حالة '{cheque['status']}' — يجب إيداعه أولاً")

    amount = cheque["amount"]
    bank_code = (await get_bank_acc(company_id, req.bank_account_code
                                    or cheque.get("bank_account_code") or ACC["bank"]))["account_code"]
    lines = await asyncio.gather(
        je_line(company_id, bank_code, debit=amount,
                desc=f"تحصيل شيك {cheque['cheque_number']} — {cheque['customer_name']}"),
        je_line(company_id, ACC["under_collection"], credit=amount,
                desc=f"إقفال شيكات برسم التحصيل — شيك {cheque['cheque_number']}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.collection_date,
        f"تحصيل شيك {cheque['ref']} — {cheque['customer_name']}", lines, cheque_id)

    await db.cheques.update_one({"id": cheque_id, "company_id": company_id}, {"$set": {
        "status": "collected", "collection_date": req.collection_date, "collect_je_id": je_id,
        "bank_account_code": bank_code,
    }})
    return {
        "message": "✅ تم تحصيل الشيك في الحساب البنكي",
        "journal": {
            "id": je_id,
            "debit":  f"م/{bank_code} البنك الجاري          +{amount:,.2f}",
            "credit": f"م/{ACC['under_collection']} شيكات برسم التحصيل -{amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# 4. ارتداد الشيك (رفض السداد)
#    Dr شيكات مرتدة (1311) [العميل] | Cr شيكات برسم التحصيل (163) أو أوراق قبض (132)
#    + Dr مصاريف بنكية (334) | Cr بنك الإيداع — لمصاريف الرفض
# ══════════════════════════════════════════════════════════════

@router.put("/cheques/{cheque_id}/bounce")
async def bounce_cheque(cheque_id: str, req: BounceRequest,
                        current_user: dict = Depends(get_current_user)):
    """
    ارتداد الشيك (رفض السداد من البنك)

    القيد أ: من حـ/ شيكات مرتدة (1311) ← إلى حـ/ شيكات برسم التحصيل (163)
            (أو أوراق قبض 132 إن لم يُودَع بعد) — والعميل على سطر 1311
    القيد ب: من حـ/ مصروفات بنكية (334) ← إلى حـ/ بنك الإيداع   [إن وجدت مصاريف]
    """
    company_id = current_user["company_id"]
    cheque = await db.cheques.find_one(
        {"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not cheque:
        raise HTTPException(404, "الشيك غير موجود")
    if cheque["status"] not in ("under_collection", "received"):
        raise HTTPException(400, f"لا يمكن ارتداد شيك في حالة '{cheque['status']}'")

    amount = cheque["amount"]
    fees = round(float(req.bounce_fees or 0), 2)
    if fees < 0:
        raise HTTPException(400, "مصاريف الارتداد لا تكون سالبة")
    fee_bank = None
    if fees > 0:
        fee_bank = (await get_bank_acc(company_id, cheque.get("bank_account_code") or ACC["bank"]))["account_code"]
    # Determine which intermediate account to reverse
    credit_acc = ACC["under_collection"] if cheque["status"] == "under_collection" else ACC["notes_receivable"]
    credit_name = "شيكات برسم التحصيل" if cheque["status"] == "under_collection" else "أوراق قبض"

    # ── القيد أ: إعادة الشيك للعميل ─────────────────────────
    lines_a = await asyncio.gather(
        je_line(company_id, ACC["returned_checks"], debit=amount,
                desc=f"ارتداد شيك {cheque['cheque_number']} — {cheque.get('customer_name', '')} — {req.bounce_reason}",
                partner_type="customer", partner_id=cheque.get("customer_id")),
        je_line(company_id, credit_acc, credit=amount,
                desc=f"إقفال {credit_name} — شيك {cheque['cheque_number']} مرتد"),
    )
    je_a_id = await post_je(company_id, current_user["user_id"], req.bounce_date,
        f"ارتداد شيك {cheque['ref']} — {req.bounce_reason}", lines_a, cheque_id)

    je_b_id = None
    # ── القيد ب: مصاريف ارتداد الشيك ────────────────────────
    if fees > 0:
        lines_b = await asyncio.gather(
            je_line(company_id, ACC["bounce_fees_exp"], debit=fees,
                    desc=f"مصاريف ارتداد شيك {cheque['cheque_number']}"),
            je_line(company_id, fee_bank, credit=fees,
                    desc="خصم مصاريف الارتداد من البنك"),
        )
        je_b_id = await post_je(company_id, current_user["user_id"], req.bounce_date,
            f"مصاريف ارتداد شيك {cheque['ref']}", lines_b, cheque_id)

    await db.cheques.update_one({"id": cheque_id, "company_id": company_id}, {"$set": {
        "status": "bounced", "bounce_date": req.bounce_date,
        "bounce_reason": req.bounce_reason, "bounce_fees": fees,
        "bounce_je_id": je_a_id, "bounce_fees_je_id": je_b_id,
    }})
    # the customer owes again (Dr 1311 above), so the invoices are unpaid again
    await unallocate_from_invoices(company_id, cheque_id)

    return {
        "message": f"تم تسجيل ارتداد الشيك — {req.bounce_reason}",
        "journals": [
            {"id": je_a_id, "desc": "إعادة الذمة للعميل",
             "debit": f"م/{ACC['returned_checks']} شيكات مرتدة +{amount:,.2f}",
             "credit": f"م/{credit_acc} {credit_name} -{amount:,.2f}"},
            {"id": je_b_id, "desc": "مصاريف الارتداد",
             "debit": f"م/{ACC['bounce_fees_exp']} مصاريف ارتداد +{fees:,.2f}",
             "credit": f"م/{fee_bank} البنك -{fees:,.2f}"
             } if je_b_id else None,
        ]
    }


# ══════════════════════════════════════════════════════════════
# 5. إصدار شيك لمورد
#    Dr الموردون (251) | Cr أوراق دفع (252)
# ══════════════════════════════════════════════════════════════

@router.post("/cheques/issue")
async def issue_cheque(req: IssueChequeRequest,
                       current_user: dict = Depends(get_current_user)):
    """
    إصدار شيك آجل لمورد

    القيد: من حـ/ الموردون (251) ← إلى حـ/ أوراق دفع (252)
    """
    company_id = current_user["company_id"]
    req.amount = check_amount(req.amount)
    req.bank_account_code = (await get_bank_acc(company_id, req.bank_account_code))["account_code"]
    cheque_id  = str(uuid.uuid4())

    lines = await asyncio.gather(
        je_line(company_id, ACC["ap"], debit=req.amount,
                desc=f"سداد ذمة {req.supplier_name} بشيك {req.cheque_number}",
                partner_type="vendor", partner_id=req.supplier_id),
        je_line(company_id, ACC["notes_payable"], credit=req.amount,
                desc=f"شيك صادر {req.cheque_number} لـ {req.supplier_name} — مستحق {req.cheque_date}",
                partner_type="vendor", partner_id=req.supplier_id),
    )
    ref        = await cheque_seq(company_id, "outgoing")
    je_id = await post_je(company_id, current_user["user_id"], req.issue_date,
        f"إصدار شيك {ref} لـ {req.supplier_name}", lines, cheque_id)

    cheque = {
        "id": cheque_id, "ref": ref, "company_id": company_id,
        "direction": "outgoing", "status": "issued",
        "supplier_id": req.supplier_id, "supplier_name": req.supplier_name,
        "amount": req.amount, "cheque_number": req.cheque_number,
        "cheque_date": req.cheque_date, "issue_date": req.issue_date,
        "bank_account_code": req.bank_account_code, "notes": req.notes,
        "issue_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.cheques.insert_one(cheque); cheque.pop("_id", None)
    cheque["allocations"], _ = await allocate_to_invoices(
        company_id, req.supplier_id, "purchase_invoice", req.amount, cheque_id, req.issue_date)
    await db.cheques.update_one({"id": cheque_id, "company_id": company_id},
                                {"$set": {"allocations": cheque["allocations"]}})

    return {
        "message": f"تم تسجيل الشيك الصادر {ref} — مستحق في {req.cheque_date}",
        "cheque": cheque,
        "journal": {
            "id": je_id,
            "debit":  f"م/{ACC['ap']} الموردون           +{req.amount:,.2f}",
            "credit": f"م/{ACC['notes_payable']} أوراق دفع -{req.amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# 6. صرف الشيك من حساب الشركة
#    Dr أوراق دفع (252) | Cr البنك الجاري (112)
# ══════════════════════════════════════════════════════════════

@router.put("/cheques/{cheque_id}/clear-outgoing")
async def clear_outgoing_cheque(cheque_id: str, req: ClearOutgoingRequest,
                                current_user: dict = Depends(get_current_user)):
    """
    صرف الشيك الصادر من الحساب البنكي (عند تقديمه للصرف)

    القيد: من حـ/ أوراق دفع (252) ← إلى حـ/ البنك الجاري (112)
    """
    company_id = current_user["company_id"]
    cheque = await db.cheques.find_one(
        {"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not cheque:
        raise HTTPException(404, "الشيك غير موجود")
    if cheque["direction"] != "outgoing":
        raise HTTPException(400, "هذا الـ endpoint للشيكات الصادرة فقط")
    if cheque["status"] != "issued":
        raise HTTPException(400, f"الشيك في حالة '{cheque['status']}' — يجب أن يكون 'issued'")

    amount = cheque["amount"]
    bank_code = (await get_bank_acc(company_id, req.bank_account_code
                                    or cheque.get("bank_account_code") or ACC["bank"]))["account_code"]

    lines = await asyncio.gather(
        je_line(company_id, ACC["notes_payable"], debit=amount,
                desc=f"إقفال أوراق دفع — شيك {cheque['cheque_number']} صُرف"),
        je_line(company_id, bank_code, credit=amount,
                desc=f"صرف شيك {cheque['cheque_number']} لـ {cheque['supplier_name']}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.clear_date,
        f"صرف شيك {cheque['ref']} — {cheque['supplier_name']}", lines, cheque_id)

    await db.cheques.update_one({"id": cheque_id, "company_id": company_id}, {"$set": {
        "status": "cleared", "clear_date": req.clear_date, "clear_je_id": je_id,
        "bank_account_code": bank_code,
    }})
    return {
        "message": "✅ تم صرف الشيك من الحساب البنكي",
        "journal": {
            "id": je_id,
            "debit":  f"م/{ACC['notes_payable']} أوراق دفع  +{amount:,.2f}",
            "credit": f"م/{bank_code} البنك الجاري  -{amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# 7. إلغاء / إيقاف صرف شيك صادر لم يُصرف
#    Dr أوراق دفع (252) | Cr الموردون (251)
# ══════════════════════════════════════════════════════════════

@router.put("/cheques/{cheque_id}/cancel")
async def cancel_issued_cheque(cheque_id: str, req: CancelIssuedRequest,
                               current_user: dict = Depends(get_current_user)):
    """
    إلغاء شيك صادر لم يُصرف بعد (إيقاف صرف / شيك تالف / استرداد من المورد)

    القيد: من حـ/ أوراق دفع (252) ← إلى حـ/ الموردون (251) — الدين يعود للمورد
    """
    company_id = current_user["company_id"]
    cheque = await db.cheques.find_one(
        {"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not cheque:
        raise HTTPException(404, "الشيك غير موجود")
    if cheque.get("direction") != "outgoing":
        raise HTTPException(400, "الإلغاء للشيكات الصادرة فقط — الشيك الوارد يُسجَّل مرتداً")
    if cheque["status"] != "issued":
        raise HTTPException(400, f"لا يمكن إلغاء شيك في حالة '{cheque['status']}' — الإلغاء للشيكات التي لم تُصرف بعد")

    amount = cheque["amount"]
    lines = await asyncio.gather(
        je_line(company_id, ACC["notes_payable"], debit=amount,
                desc=f"إلغاء شيك صادر {cheque['cheque_number']} — {req.reason}",
                partner_type="vendor", partner_id=cheque.get("supplier_id")),
        je_line(company_id, ACC["ap"], credit=amount,
                desc=f"إعادة ذمة {cheque.get('supplier_name', '')} — شيك {cheque['cheque_number']} ملغى",
                partner_type="vendor", partner_id=cheque.get("supplier_id")),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.cancel_date,
        f"إلغاء شيك صادر {cheque['ref']} — {req.reason}", lines, cheque_id)

    res = await db.cheques.update_one(
        {"id": cheque_id, "company_id": company_id, "status": "issued"},
        {"$set": {"status": "cancelled", "cancel_date": req.cancel_date,
                  "cancel_reason": req.reason, "cancel_je_id": je_id}})
    if not res.modified_count:
        raise HTTPException(409, "تغيّرت حالة الشيك أثناء الإلغاء — راجع القيود")
    await unallocate_from_invoices(company_id, cheque_id)
    return {
        "message": "تم إلغاء الشيك الصادر وإعادة المبلغ لحساب المورد",
        "journal": {
            "id": je_id,
            "debit":  f"م/{ACC['notes_payable']} أوراق دفع  +{amount:,.2f}",
            "credit": f"م/{ACC['ap']} الموردون  -{amount:,.2f}",
        }
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/cheques")
async def list_cheques(
    direction: Optional[str] = Query(None, description="incoming | outgoing"),
    status: Optional[str] = Query(None),
    due_before: Optional[str] = Query(None),
    page: int = 1, limit: int = 25,
    current_user: dict = Depends(get_current_user)
):
    """قائمة الشيكات مع ملخص مالي"""
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if direction:   q["direction"]   = direction
    if status:      q["status"]      = status
    if due_before:  q["cheque_date"] = {"$lte": due_before}

    total  = await db.cheques.count_documents(q)
    cheques = await db.cheques.find(q, {"_id": 0}).sort(
        "cheque_date", 1).skip((page-1)*limit).limit(limit).to_list(None)

    incoming = [c for c in cheques if c["direction"] == "incoming"]
    outgoing = [c for c in cheques if c["direction"] == "outgoing"]
    pending  = [c for c in incoming if c["status"] in ("received","under_collection")]

    return {
        "cheques": cheques, "total": total, "page": page, "limit": limit,
        "summary": {
            "incoming_total": round(sum(c["amount"] for c in incoming), 2),
            "outgoing_total": round(sum(c["amount"] for c in outgoing), 2),
            "pending_collection": round(sum(c["amount"] for c in pending), 2),
            "status_breakdown": {
                "received":         sum(1 for c in cheques if c["status"]=="received"),
                "under_collection": sum(1 for c in cheques if c["status"]=="under_collection"),
                "collected":        sum(1 for c in cheques if c["status"]=="collected"),
                "bounced":          sum(1 for c in cheques if c["status"]=="bounced"),
                "issued":           sum(1 for c in cheques if c["status"]=="issued"),
                "cleared":          sum(1 for c in cheques if c["status"]=="cleared"),
                "cancelled":        sum(1 for c in cheques if c["status"]=="cancelled"),
            }
        }
    }


@router.get("/cheques/due-soon")
async def get_due_cheques(
    days: int = Query(7, description="أيام للاستحقاق"),
    current_user: dict = Depends(get_current_user)
):
    """شيكات مستحقة التحصيل/الدفع خلال N يوم"""
    from datetime import date, timedelta
    today = date.today().isoformat()
    due_limit = (date.today() + timedelta(days=days)).isoformat()
    company_id = current_user["company_id"]

    cheques = await db.cheques.find({
        "company_id": company_id,
        "cheque_date": {"$gte": today, "$lte": due_limit},
        "status": {"$in": ["received","under_collection","issued"]},
    }, {"_id": 0}).sort("cheque_date", 1).to_list(None)

    return {
        "due_within_days": days,
        "count": len(cheques),
        "total": round(sum(c["amount"] for c in cheques), 2),
        "cheques": cheques,
    }


@router.get("/cheques/{cheque_id}")
async def get_cheque(cheque_id: str, current_user: dict = Depends(get_current_user)):
    cheque = await db.cheques.find_one(
        {"id": cheque_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not cheque:
        raise HTTPException(404, "الشيك غير موجود")
    return cheque


