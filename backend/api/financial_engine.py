"""
Advanced Financial Engine — المحرك المالي المتقدم
المعيار المحاسبي المصري رقم 13 (العملات الأجنبية)

1. FX Realized   — فروق عملة محققة (عند السداد)
2. FX Unrealized — فروق عملة غير محققة (إعادة تقييم نهاية الفترة)
3. Year-End Closing — إقفال سنوي (إيرادات / مصروفات → أرباح مرحلة)
4. Inter-Company — قيود تسوية بين الشركات التابعة
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService
from dependencies import get_current_user

router = APIRouter(prefix="/api/financial-engine", tags=["Financial Engine"])


# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "fx_gain":          "432",  # أرباح فروق عملة محققة
    "fx_loss":          "33611",  # خسائر فروق عملة محققة
    "fx_unrealized_gain": "432",# أرباح فروق عملة غير محققة (نفس الحساب — مميّز بالوصف)
    # was 334 (bank charges & commissions): every unrealized loss landed in bank fees
    "fx_unrealized_loss": "33611",
    "pnl":              "214",  # حساب الأرباح والخسائر
    "retained_earnings":"213",  # الأرباح (الخسائر) المرحلة
    "bank":             "162",
    "ar":               "131",
    "ap":               "251",
    "ic_receivable":    "136",  # مديونية شركات شقيقة (استحقاقات)
    "ic_payable":       "253",  # التزامات لشركات شقيقة
}

REVENUE_PATTERN  = "^4"   # حسابات الإيرادات (4xxx)
EXPENSE_PATTERN  = "^3"   # حسابات المصروفات (3xxx)


async def get_company(company_id: str) -> dict:
    return await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}


async def get_rate(company_id: str, currency: str, as_of: str) -> float:
    """EGP per 1 unit of foreign currency — the one shared lookup (services/fx.py)
    that reads every format the rate screens save. This used to read only
    {currency, date}, which the currencies screen never writes."""
    from services.fx import rate_on
    return await rate_on(db, company_id, currency, as_of)


async def get_acc(company_id: str, code: str) -> dict:
    """The company's account, or an Arabic 400. It used to fall back to a stub
    {"id": code}: the entry then pointed at an account that does not exist
    and posting either failed or the amount vanished from every report."""
    from services.fx import strict_account
    return await strict_account(db, company_id, code)


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="",
                  fx_currency=None, fx_amount=None, fx_rate=None) -> dict:
    acc = await get_acc(company_id, code)
    line = {
        "line_id":      str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit":  round(debit,  2),
        "credit": round(credit, 2),
        "description": desc,
    }
    if fx_currency and str(fx_currency).upper() != "EGP":
        # the JournalEntryLine multi-currency fields (the old keys were dropped by the model)
        line["currency_id"]    = str(fx_currency).upper()
        line["exchange_rate"]  = float(fx_rate or 1)
        line["debit_foreign"]  = round(float(fx_amount or 0), 2) if debit else 0.0
        line["credit_foreign"] = round(float(fx_amount or 0), 2) if credit else 0.0
    return line


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None,
                  source_type: str = "manual", reference: str = None,
                  is_reversal: bool = False, reversal_of: str = None) -> str:
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines, reference=reference,
        source_document_type=source_type, source_document_id=src_id,
        is_reversal=is_reversal, reversal_of=reversal_of,
        created_by=user_id,
    )
    try:
        result = await svc.create_journal_entry(entry)
        await svc.post_journal_entry(result["id"], user_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return result["id"]


# ══════════════════════════════════════════════════════════════
# 1. REALIZED FX GAIN/LOSS — فروق عملة محققة (عند السداد)
#    المعيار المحاسبي المصري رقم 13
# ══════════════════════════════════════════════════════════════

@router.post("/fx/realized")
async def record_realized_fx(data: dict,
                              current_user: dict = Depends(get_current_user)):
    """
    تسجيل فرق العملة المحقق عند سداد فاتورة أجنبية

    مثال: فاتورة مورد 10,000 USD سُجِّلت بسعر 30 ج.م
           سُدِّدت بسعر 31 ج.م (فرق خسارة 10,000)

    القيد عند السداد:
    Dr م/251 الموردون              300,000  (بالسعر الأصلي)
    Dr م/334 خسارة فرق عملة       10,000   (الفرق السلبي)
    Cr م/112 البنك                 310,000  (بالسعر الفعلي)

    أو عند الربح:
    Dr م/251 الموردون              310,000  (بالسعر الأصلي)
    Cr م/112 البنك                 300,000  (بالسعر الفعلي)
    Cr م/432 ربح فرق عملة          10,000
    """
    company_id      = current_user["company_id"]
    invoice_id      = data.get("invoice_id")
    currency        = data.get("currency", "USD")
    foreign_amount  = float(data.get("foreign_amount", 0))
    original_rate   = float(data.get("original_rate", 0))  # سعر يوم الفاتورة
    payment_rate    = float(data.get("payment_rate",  0))   # سعر يوم السداد
    payment_date    = data.get("payment_date", date.today().isoformat())
    direction       = data.get("direction", "payable")  # payable | receivable

    if invoice_id:
        inv = await db.invoices.find_one({"id": invoice_id, "company_id": company_id},
                                         {"_id": 0, "currency": 1})
        if inv and str(inv.get("currency") or "EGP").upper() != "EGP":
            # record_payment already posts the realized difference in the
            # payment entry; posting it here too would count it twice
            raise HTTPException(400, "فروق العملة المحققة لفواتير العملة الأجنبية تُرحَّل تلقائياً "
                                     "عند تسجيل السداد على الفاتورة — لا تُسجَّل يدوياً")
    if foreign_amount <= 0:
        raise HTTPException(400, "المبلغ بالعملة الأجنبية يجب أن يكون أكبر من صفر")
    if original_rate <= 0:
        raise HTTPException(400, "أدخل سعر الصرف الأصلي (سعر يوم الفاتورة)")
    if payment_rate <= 0:
        payment_rate = await get_rate(company_id, currency, payment_date)

    egp_original = round(foreign_amount * original_rate, 2)
    egp_payment  = round(foreign_amount * payment_rate,  2)
    fx_diff      = round(egp_payment - egp_original, 2)
    is_gain      = (fx_diff < 0 if direction == "payable" else fx_diff > 0)
    abs_diff     = abs(fx_diff)

    lines = []
    if direction == "payable":
        # سداد مورد أجنبي
        # Dr الموردون (بالسعر الأصلي)
        lines.append(await je_line(
            company_id, ACC["ap"], debit=egp_original,
            desc=f"إقفال ذمة مورد — {foreign_amount:,.2f} {currency} × {original_rate}",
            fx_currency=currency, fx_amount=foreign_amount, fx_rate=original_rate
        ))
        if fx_diff > 0:
            # خسارة: سعر السداد أعلى → ندفع أكثر
            lines.append(await je_line(
                company_id, ACC["fx_loss"], debit=abs_diff,
                desc=f"خسارة فرق عملة — {currency} من {original_rate} إلى {payment_rate}"))
        elif fx_diff < 0:
            # ربح: سعر السداد أقل → ندفع أقل
            lines.append(await je_line(
                company_id, ACC["fx_gain"], credit=abs_diff,
                desc=f"ربح فرق عملة — {currency} من {original_rate} إلى {payment_rate}"))
        # Cr البنك (بالسعر الفعلي)
        lines.append(await je_line(
            company_id, ACC["bank"], credit=egp_payment,
            desc=f"سداد {foreign_amount:,.2f} {currency} × {payment_rate}",
            fx_currency=currency, fx_amount=foreign_amount, fx_rate=payment_rate
        ))
    else:
        # تحصيل من عميل أجنبي
        lines.append(await je_line(
            company_id, ACC["bank"], debit=egp_payment,
            desc=f"تحصيل {foreign_amount:,.2f} {currency} × {payment_rate}",
            fx_currency=currency, fx_amount=foreign_amount, fx_rate=payment_rate
        ))
        if fx_diff > 0:
            # ربح: عملنا بسعر أعلى
            lines.append(await je_line(
                company_id, ACC["ar"], credit=egp_original,
                desc=f"إقفال ذمة عميل — {foreign_amount:,.2f} {currency} × {original_rate}"))
            lines.append(await je_line(
                company_id, ACC["fx_gain"], credit=abs_diff,
                desc=f"ربح فرق عملة — {currency} من {original_rate} إلى {payment_rate}"))
        elif fx_diff < 0:
            # خسارة: حصّلنا بسعر أقل
            lines.append(await je_line(
                company_id, ACC["fx_loss"], debit=abs_diff,
                desc=f"خسارة فرق عملة — {currency}"))
            lines.append(await je_line(
                company_id, ACC["ar"], credit=egp_original,
                desc=f"إقفال ذمة عميل — {foreign_amount:,.2f} {currency} × {original_rate}"))
        else:
            lines.append(await je_line(
                company_id, ACC["ar"], credit=egp_original,
                desc=f"إقفال ذمة عميل — {foreign_amount:,.2f} {currency}"))

    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)

    je_id = await post_je(company_id, current_user["user_id"], payment_date,
        f"فرق عملة محقق — {currency} — {'ربح' if is_gain else 'خسارة'} {abs_diff:,.2f} ج.م",
        lines, invoice_id)

    return {
        "message":     f"تم تسجيل فرق العملة المحقق",
        "currency":    currency,
        "fx_type":     "realized",
        "direction":   direction,
        "original_rate": original_rate,
        "payment_rate":  payment_rate,
        "egp_original":  egp_original,
        "egp_payment":   egp_payment,
        "fx_diff":       fx_diff,
        "fx_nature":     "ربح" if is_gain else "خسارة",
        "journal": {"id": je_id, "debit": td, "credit": tc,
                    "balanced": abs(td - tc) < 0.01},
        "law": "المعيار المحاسبي المصري رقم 13 — فروق العملة الأجنبية",
    }


# ══════════════════════════════════════════════════════════════
# 2. UNREALIZED FX REVALUATION — فروق عملة غير محققة
#    إعادة تقييم الأرصدة في نهاية الفترة
# ══════════════════════════════════════════════════════════════

def _cc(v) -> str:
    """Currency code from a str, or an Enum the driver stored as-is."""
    return str(getattr(v, "value", v) or "EGP").upper()


def _month_bounds(month: str):
    """'2026-10' → ('2026-10-31', '2026-11-01')."""
    import calendar
    y, m = int(month[:4]), int(month[5:7])
    last = f"{y:04d}-{m:02d}-{calendar.monthrange(y, m)[1]:02d}"
    ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
    return last, f"{ny:04d}-{nm:02d}-01"


async def _open_foreign_on(inv: dict, as_of: str) -> float:
    """What was still open on an invoice at `as_of`, in its own currency:
    the net owed less payments and credit/debit notes dated on or before it.
    The old revaluation used grand_total, so a half-paid invoice was revalued
    in full."""
    owed = float(inv.get("settle_amount") or inv.get("grand_total") or 0)
    paid = 0.0
    async for p in db.payments.find({"invoice_id": inv["id"], "company_id": inv["company_id"]},
                                    {"_id": 0, "amount": 1, "payment_date": 1}):
        if str(p.get("payment_date") or "")[:10] <= as_of:
            paid += float(p.get("amount") or 0)
    noted = 0.0
    async for n in db.invoices.find({"original_invoice_id": inv["id"], "company_id": inv["company_id"],
                                     "status": {"$nin": ["draft", "cancelled"]}},
                                    {"_id": 0, "grand_total": 1, "document_date": 1}):
        if str(n.get("document_date") or "")[:10] <= as_of:
            noted += float(n.get("grand_total") or 0)
    return round(owed - paid - noted, 2)


async def _foreign_account_balance(company_id: str, account_id: str, as_of: str):
    """(foreign balance, EGP book balance) of a foreign-currency bank/cash
    account from its posted journal lines up to `as_of` (debit − credit)."""
    foreign = egp = 0.0
    async for je in db.journal_entries.find(
            {"company_id": company_id, "status": {"$in": ["posted", "reversed"]},
             "entry_date": {"$lte": as_of}, "lines.account_id": account_id},
            {"_id": 0, "lines": 1}):
        for l in je.get("lines", []):
            if l.get("account_id") != account_id:
                continue
            egp += float(l.get("debit") or 0) - float(l.get("credit") or 0)
            foreign += float(l.get("debit_foreign") or 0) - float(l.get("credit_foreign") or 0)
    return round(foreign, 2), round(egp, 2)


@router.post("/fx/revalue")
async def revalue_foreign_balances(data: dict,
                                   current_user: dict = Depends(get_current_user)):
    """
    إعادة تقييم أرصدة العملات الأجنبية في نهاية الشهر — معيار المحاسبة المصري 13
    (العملاء والموردون بعملة أجنبية + حسابات البنوك/الخزائن بعملة أجنبية)

    body: {"month": "YYYY-MM"} (أو "date") — اختياري "currency" لعملة واحدة

    - الرصيد المفتوح فقط (بعد السداد والإشعارات حتى آخر الشهر) × سعر الإقفال
    - العملاء/البنوك (أصول): ارتفاع السعر ربح ← م/432، انخفاضه خسارة ← م/33611
    - الموردون (التزام): ارتفاع السعر خسارة ← م/33611، انخفاضه ربح ← م/432
    - سعر الفاتورة الأصلي لا يتغيّر — يُحفظ التقييم في fx_revaluations
    - قيد عكسي تلقائي أول يوم من الشهر التالي
    - تشغيل واحد فقط لكل شركة وشهر
    """
    company_id = current_user["company_id"]
    user_id    = current_user["user_id"]
    month = str(data.get("month") or data.get("date") or date.today().isoformat())[:7]
    try:
        revalue_date, reversal_date = _month_bounds(month)
    except (ValueError, IndexError):
        raise HTTPException(400, "الشهر غير صحيح — استخدم الصيغة YYYY-MM")
    only = str(data.get("currency") or "").upper() or None

    # one run per company + month: claim the month atomically, refuse a second run
    run_id = str(uuid.uuid4())
    prior = await db.fx_revaluations.find_one_and_update(
        {"company_id": company_id, "month": month},
        {"$setOnInsert": {"id": run_id, "company_id": company_id, "month": month,
                          "status": "running", "created_by": user_id,
                          "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True)
    if prior:
        raise HTTPException(400, f"تمت إعادة تقييم العملات لشهر {month} بالفعل "
                                 f"(القيد {prior.get('journal_entry_id') or '—'}) — لا يُعاد التشغيل مرتين")

    async def _release():
        await db.fx_revaluations.delete_one({"company_id": company_id, "month": month, "id": run_id})

    try:
        ar, ap = await get_acc(company_id, ACC["ar"]), await get_acc(company_id, ACC["ap"])
        gain_acc = await get_acc(company_id, ACC["fx_unrealized_gain"])
        loss_acc = await get_acc(company_id, ACC["fx_unrealized_loss"])

        inv_q = {"company_id": company_id,
                 "document_type": {"$in": ["sales_invoice", "purchase_invoice"]},
                 "currency": {"$nin": [None, "", "EGP"]},
                 "status": {"$nin": ["draft", "cancelled"]},
                 "journal_entry_id": {"$nin": [None, ""]},
                 "document_date": {"$lte": revalue_date}}
        if only:
            inv_q["currency"] = only
        invoices = await db.invoices.find(inv_q, {"_id": 0}).to_list(None)

        acc_q = {"company_id": company_id, "currency_id": {"$nin": [None, "", "EGP"]},
                 "account_type": "asset", "is_active": {"$ne": False}}
        if only:
            acc_q["currency_id"] = only
        fx_accounts = [a for a in await db.chart_of_accounts.find(acc_q, {"_id": 0}).to_list(None)
                       if not a.get("is_header")]

        currencies = sorted({_cc(i["currency"]) for i in invoices} |
                            {_cc(a["currency_id"]) for a in fx_accounts})
        if not currencies:
            await _release()
            return {"message": "لا توجد أرصدة بعملات أجنبية لإعادة تقييمها", "month": month}
        rates = {c: await get_rate(company_id, c, revalue_date) for c in currencies}

        items, lines = [], []
        total_gain = total_loss = 0.0

        def _post(acc_line, diff, is_asset, text):
            """diff = new EGP − book EGP of the balance. Asset up / liability
            down is a gain; asset down / liability up is a loss."""
            nonlocal total_gain, total_loss
            gain = (diff > 0) == is_asset
            amt = round(abs(diff), 2)
            lines.append({"account_id": acc_line["id"], "account_code": acc_line["account_code"],
                          "account_name": acc_line["account_name"],
                          # asset: debit when it rises; liability: credit when it rises
                          "debit": amt if (diff > 0) == is_asset else 0.0,
                          "credit": 0.0 if (diff > 0) == is_asset else amt,
                          "description": text})
            if gain:
                total_gain += amt
            else:
                total_loss += amt
            return "gain" if gain else "loss"

        for inv in invoices:
            cur = _cc(inv["currency"])
            open_fc = await _open_foreign_on(inv, revalue_date)
            if open_fc <= 0.004:
                continue
            book_rate = float(inv.get("exchange_rate") or 1)
            book_egp, new_egp = round(open_fc * book_rate, 2), round(open_fc * rates[cur], 2)
            diff = round(new_egp - book_egp, 2)
            if abs(diff) < 0.01:
                continue
            is_ar = inv["document_type"] == "sales_invoice"
            nature = _post(ar if is_ar else ap, diff, is_ar,
                           f"إعادة تقييم {'عميل' if is_ar else 'مورد'} — فاتورة {inv.get('document_number', '')} "
                           f"{open_fc:,.2f} {cur} من {book_rate} إلى {rates[cur]}")
            items.append({"kind": "receivable" if is_ar else "payable", "invoice_id": inv["id"],
                          "document_number": inv.get("document_number"), "party_name": inv.get("party_name"),
                          "currency": cur, "open_foreign": open_fc, "book_rate": book_rate,
                          "closing_rate": rates[cur], "book_egp": book_egp, "new_egp": new_egp,
                          "adjustment": diff, "nature": nature})

        for acc in fx_accounts:
            cur = _cc(acc["currency_id"])
            fc, book_egp = await _foreign_account_balance(company_id, acc["id"], revalue_date)
            if abs(fc) < 0.005 and abs(book_egp) < 0.005:
                continue
            new_egp = round(fc * rates[cur], 2)
            diff = round(new_egp - book_egp, 2)
            if abs(diff) < 0.01:
                continue
            nature = _post(acc, diff, True,
                           f"إعادة تقييم {acc['account_name']} — {fc:,.2f} {cur} بسعر {rates[cur]}")
            items.append({"kind": "account", "account_id": acc["id"], "account_code": acc["account_code"],
                          "account_name": acc["account_name"], "currency": cur, "open_foreign": fc,
                          "book_egp": book_egp, "closing_rate": rates[cur], "new_egp": new_egp,
                          "adjustment": diff, "nature": nature})

        if not lines:
            await _release()
            return {"message": "لا فروق عملة غير محققة — الأرصدة مُقيَّمة بسعر الإقفال",
                    "month": month, "rates": rates}

        total_gain, total_loss = round(total_gain, 2), round(total_loss, 2)
        if total_gain:
            lines.append({"account_id": gain_acc["id"], "account_code": gain_acc["account_code"],
                          "account_name": gain_acc["account_name"], "debit": 0.0, "credit": total_gain,
                          "description": f"أرباح فروق عملة غير محققة — إعادة تقييم {month}"})
        if total_loss:
            lines.append({"account_id": loss_acc["id"], "account_code": loss_acc["account_code"],
                          "account_name": loss_acc["account_name"], "debit": total_loss, "credit": 0.0,
                          "description": f"خسائر فروق عملة غير محققة — إعادة تقييم {month}"})

        rate_txt = "، ".join(f"{c} {r}" for c, r in rates.items())
        je_id = await post_je(company_id, user_id, revalue_date,
                              f"إعادة تقييم العملات الأجنبية — {month} ({rate_txt})", lines,
                              src_id=run_id, source_type="adjustment", reference=f"FXREV-{month}")
        # auto-reversal on the 1st of next month: balances go back to the
        # carrying rate, so a payment next month realizes the full difference
        # against the invoice rate without counting this month's part twice
        rev_lines = [{**l, "debit": l["credit"], "credit": l["debit"],
                      "description": "عكس: " + l["description"]} for l in lines]
        rev_id = await post_je(company_id, user_id, reversal_date,
                               f"عكس إعادة تقييم العملات — {month}", rev_lines,
                               src_id=run_id, source_type="adjustment", reference=f"FXREV-{month}-R",
                               is_reversal=True, reversal_of=je_id)
    except Exception:
        await _release()
        raise

    run = {"revalue_date": revalue_date, "reversal_date": reversal_date, "rates": rates,
           "items": items, "total_gain": total_gain, "total_loss": total_loss,
           "net": round(total_gain - total_loss, 2), "journal_entry_id": je_id,
           "reversal_entry_id": rev_id, "status": "posted",
           "posted_at": datetime.now(timezone.utc).isoformat()}
    await db.fx_revaluations.update_one({"company_id": company_id, "month": month, "id": run_id},
                                        {"$set": run})
    return {
        "message": f"تمت إعادة تقييم {len(items)} رصيد بعملات أجنبية لشهر {month}",
        "id": run_id, "month": month, **run,
        "law": "المعيار المحاسبي المصري 13 — الأرصدة النقدية بالعملة الأجنبية تُقيَّم بسعر الإقفال",
    }


@router.get("/fx/revaluations")
async def list_fx_revaluations(current_user: dict = Depends(get_current_user)):
    """سجل تشغيلات إعادة تقييم العملات للشركة (الأحدث أولاً)."""
    runs = await db.fx_revaluations.find(
        {"company_id": current_user["company_id"], "status": "posted"},
        {"_id": 0, "items": 0}).sort("month", -1).to_list(240)
    return {"runs": runs, "total": len(runs)}


@router.get("/fx/revaluations/{month}")
async def get_fx_revaluation(month: str, current_user: dict = Depends(get_current_user)):
    run = await db.fx_revaluations.find_one(
        {"company_id": current_user["company_id"], "month": month[:7]}, {"_id": 0})
    if not run:
        raise HTTPException(404, "لا توجد إعادة تقييم لهذا الشهر")
    return run


# ══════════════════════════════════════════════════════════════
# 3. YEAR-END CLOSING ENGINE — الإقفال السنوي
# ══════════════════════════════════════════════════════════════

@router.post("/year-end/close")
async def year_end_closing(data: dict,
                           current_user: dict = Depends(get_current_user)):
    """
    إقفال نهاية السنة المالية — 3 مراحل:

    المرحلة أ — إقفال الإيرادات:
      Dr كل حسابات الإيرادات (4xxx)  ← بأرصدتها
      Cr م/214 حساب الأرباح والخسائر

    المرحلة ب — إقفال المصروفات:
      Dr م/214 حساب الأرباح والخسائر
      Cr كل حسابات المصروفات (3xxx)  ← بأرصدتها

    المرحلة ج — ترحيل صافي الربح/الخسارة:
      Dr م/214 حساب الأرباح والخسائر  ← بصافي الربح
      Cr م/213 الأرباح المرحلة

      أو عند الخسارة:
      Dr م/213 الأرباح المرحلة
      Cr م/214 حساب الأرباح والخسائر
    """
    company_id  = current_user["company_id"]
    fiscal_year = int(data.get("fiscal_year", date.today().year))
    close_date  = data.get("close_date", f"{fiscal_year}-12-31")
    confirmed   = data.get("confirmed", False)

    if not confirmed:
        # Preview mode — calculate without posting
        preview = await _calculate_closing(company_id, fiscal_year, close_date)
        return {
            "message":    "معاينة الإقفال — لم يُنفَّذ بعد",
            "confirmed":  False,
            "preview":    preview,
            "next_step":  "أرسل confirmed=true لتنفيذ الإقفال الفعلي",
        }

    # ── Check not already closed ────────────────────────────
    existing = await db.year_end_closings.find_one(
        {"company_id": company_id, "fiscal_year": fiscal_year})
    if existing:
        raise HTTPException(400, f"السنة {fiscal_year} مُقفَلة بالفعل")

    svc = AccountingService(db)
    accounts = await svc.get_all_accounts(company_id, True)
    by_code  = {a["account_code"]: a for a in accounts}

    def acc(code, name_fb):
        a = by_code.get(code, {})
        return a.get("id", code), code, a.get("account_name", name_fb)

    # ── جمع أرصدة نهاية السنة من قيود الأستاذ ─────────────
    year_start = f"{fiscal_year}-01-01"
    year_end   = f"{fiscal_year}-12-31"

    async def sum_account(pattern, side):
        pipeline = [
            {"$match": {"company_id": company_id, "status": "posted",
                        "entry_date": {"$gte": year_start, "$lte": year_end}}},
            {"$unwind": "$lines"},
            {"$match": {"lines.account_code": {"$regex": pattern}}},
            {"$group": {"_id": "$lines.account_code",
                        "name": {"$first": "$lines.account_name"},
                        "debit": {"$sum": "$lines.debit"},
                        "credit": {"$sum": "$lines.credit"}}}
        ]
        return await db.journal_entries.aggregate(pipeline).to_list(None)

    revenue_accs  = await sum_account(REVENUE_PATTERN,  "credit")
    expense_accs  = await sum_account(EXPENSE_PATTERN,  "debit")

    pnl_id, pnl_code, pnl_name   = acc("214", "حساب الأرباح والخسائر")
    ret_id, ret_code, ret_name    = acc("213", "الأرباح (الخسائر) المرحلة")

    lines_a = []  # إقفال الإيرادات
    lines_b = []  # إقفال المصروفات
    total_revenue = total_expense = 0.0

    # ── المرحلة أ: إقفال الإيرادات → حـ/214 ────────────────
    for rev in revenue_accs:
        net = rev["credit"] - rev["debit"]
        if net <= 0:
            continue
        a = by_code.get(rev["_id"], {})
        lines_a.append({
            "line_id": str(uuid.uuid4()), "entry_id": None,
            "account_id":   a.get("id", rev["_id"]),
            "account_code": rev["_id"],
            "account_name": rev["name"],
            "debit": round(net, 2), "credit": 0,
            "description": f"إقفال إيراد {fiscal_year}",
        })
        total_revenue += net

    if total_revenue > 0:
        lines_a.append(await je_line(
            company_id, "214", credit=round(total_revenue, 2),
            desc=f"إجمالي الإيرادات {fiscal_year}"))
        je_a_id = await post_je(company_id, current_user["user_id"], close_date,
            f"إقفال الإيرادات — السنة المالية {fiscal_year}", lines_a)
    else:
        je_a_id = None

    # ── المرحلة ب: إقفال المصروفات → حـ/214 ────────────────
    for exp in expense_accs:
        net = exp["debit"] - exp["credit"]
        if net <= 0:
            continue
        a = by_code.get(exp["_id"], {})
        lines_b.append({
            "line_id": str(uuid.uuid4()), "entry_id": None,
            "account_id":   a.get("id", exp["_id"]),
            "account_code": exp["_id"],
            "account_name": exp["name"],
            "debit": 0, "credit": round(net, 2),
            "description": f"إقفال مصروف {fiscal_year}",
        })
        total_expense += net

    if total_expense > 0:
        lines_b.append(await je_line(
            company_id, "214", debit=round(total_expense, 2),
            desc=f"إجمالي المصروفات {fiscal_year}"))
        je_b_id = await post_je(company_id, current_user["user_id"], close_date,
            f"إقفال المصروفات — السنة المالية {fiscal_year}", lines_b)
    else:
        je_b_id = None

    # ── المرحلة ج: ترحيل صافي الربح إلى الأرباح المرحلة ───
    net_income = round(total_revenue - total_expense, 2)

    if net_income > 0:
        lines_c = await asyncio.gather(
            je_line(company_id, "214", debit=net_income,
                    desc=f"إقفال حـ/أرباح وخسائر → أرباح مرحلة {fiscal_year}"),
            je_line(company_id, "213", credit=net_income,
                    desc=f"ترحيل صافي الربح {fiscal_year:,} إلى الأرباح المرحلة"),
        )
    else:
        lines_c = await asyncio.gather(
            je_line(company_id, "213", debit=abs(net_income),
                    desc=f"ترحيل صافي الخسارة {fiscal_year}"),
            je_line(company_id, "214", credit=abs(net_income),
                    desc=f"إقفال حـ/أرباح وخسائر — خسارة {fiscal_year}"),
        )
    je_c_id = await post_je(company_id, current_user["user_id"], close_date,
        f"ترحيل صافي {'الربح' if net_income >= 0 else 'الخسارة'} — {fiscal_year}",
        list(lines_c))

    # Save closing record
    await db.year_end_closings.insert_one({
        "company_id": company_id, "fiscal_year": fiscal_year,
        "close_date": close_date,
        "total_revenue": round(total_revenue, 2),
        "total_expense": round(total_expense, 2),
        "net_income":    net_income,
        "je_revenue_id": je_a_id, "je_expense_id": je_b_id, "je_closing_id": je_c_id,
        "closed_by": current_user["user_id"],
        "closed_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "message":       f"✅ تم إقفال السنة المالية {fiscal_year}",
        "fiscal_year":   fiscal_year,
        "close_date":    close_date,
        "financial_summary": {
            "total_revenue":   round(total_revenue, 2),
            "total_expense":   round(total_expense, 2),
            "net_income":      net_income,
            "result":          "ربح" if net_income >= 0 else "خسارة",
        },
        "journal_entries": {
            "closing_revenues":  je_a_id,
            "closing_expenses":  je_b_id,
            "retained_earnings": je_c_id,
        },
        "next_steps": [
            f"افتح السنة المالية {fiscal_year+1}",
            "تحقق من رصيد م/213 الأرباح المرحلة",
            "اعكس قيود فروق العملة غير المحققة في أول {fiscal_year+1}",
        ]
    }


async def _calculate_closing(company_id: str, fiscal_year: int, close_date: str) -> dict:
    """Preview closing without posting"""
    year_start = f"{fiscal_year}-01-01"
    year_end   = f"{fiscal_year}-12-31"

    async def total(pattern, side):
        r = await db.journal_entries.aggregate([
            {"$match": {"company_id": company_id, "status": "posted",
                        "entry_date": {"$gte": year_start, "$lte": year_end}}},
            {"$unwind": "$lines"},
            {"$match": {"lines.account_code": {"$regex": pattern}}},
            {"$group": {"_id": None, "total": {"$sum": f"$lines.{side}"}}}
        ]).to_list(1)
        return round(r[0]["total"] if r else 0, 2)

    rev = await total(REVENUE_PATTERN, "credit")
    exp = await total(EXPENSE_PATTERN, "debit")
    return {
        "fiscal_year":   fiscal_year,
        "total_revenue": rev,
        "total_expense": exp,
        "net_income":    round(rev - exp, 2),
        "result":        "ربح" if rev >= exp else "خسارة",
    }


@router.get("/year-end/status")
async def get_closing_status(current_user: dict = Depends(get_current_user)):
    """حالة إقفال السنوات المالية"""
    closings = await db.year_end_closings.find(
        {"company_id": current_user["company_id"]}, {"_id": 0}
    ).sort("fiscal_year", -1).to_list(10)
    return {"closings": closings}


# ══════════════════════════════════════════════════════════════
# 4. INTER-COMPANY TRANSACTIONS — قيود بين الشركات
# ══════════════════════════════════════════════════════════════

class InterCompanyRequest(BaseModel):
    to_company_id:    str           # الشركة المستلِمة
    amount:           float
    currency:         str = "EGP"
    transaction_type: str = "loan"  # loan | service | asset_transfer | dividend
    description:      str
    date:             str
    exchange_rate:    float = 1.0


@router.post("/inter-company")
async def inter_company_transaction(req: InterCompanyRequest,
                                    current_user: dict = Depends(get_current_user)):
    """
    قيود التسوية بين الشركات التابعة (Inter-Company)

    الشركة المُرسِلة:
      Dr م/136 مديونية شركة شقيقة — [اسم الشركة المستلِمة]
      Cr م/112 البنك / م/412 إيراد خدمات

    الشركة المستلِمة (قيد مقابل):
      Dr م/332 مصروف [خدمة / قرض] — [اسم الشركة المُرسِلة]
      Cr م/253 التزام لشركة شقيقة
    """
    from_company_id = current_user["company_id"]
    to_company_id   = req.to_company_id

    if from_company_id == to_company_id:
        raise HTTPException(400, "لا يمكن التحويل بين نفس الشركة")

    # Validate to_company exists
    to_company = await db.companies.find_one({"id": to_company_id}, {"_id": 0})
    if not to_company:
        raise HTTPException(404, f"الشركة {to_company_id} غير موجودة")

    from_company = await get_company(from_company_id)
    egp_amount = round(req.amount * req.exchange_rate, 2)

    # ── قيد الشركة المُرسِلة ──────────────────────────────────
    type_config = {
        "loan":           ("136", "إيرادات فوائد", "412", "قرض مُعطى"),
        "service":        ("136", "إيراد خدمات مُقدَّمة", "412", "خدمة مُقدَّمة"),
        "asset_transfer": ("136", "تحويل أصل", "112", "تحويل أصل"),
        "dividend":       ("136", "توزيع أرباح", "213", "أرباح مُوزَّعة"),
    }
    ic_rec_code, ic_rec_name, cr_code, desc_suffix = type_config.get(
        req.transaction_type, type_config["service"])

    lines_from = await asyncio.gather(
        je_line(from_company_id, ic_rec_code, debit=egp_amount,
                desc=f"مديونية {to_company.get('name','')} — {req.description}"),
        je_line(from_company_id, cr_code, credit=egp_amount,
                desc=f"{desc_suffix} لـ {to_company.get('name','')} — {req.description}"),
    )
    je_from_id = await post_je(from_company_id, current_user["user_id"], req.date,
        f"معاملة بين شركات — {from_company.get('name','')} → {to_company.get('name','')}",
        list(lines_from))

    # ── قيد الشركة المستلِمة (تلقائي) ────────────────────────
    dr_code_to = {
        "loan":    "321",  # فوائد وعمولات بنكية مدينة (كان 334: مصروفات بنكية)
        "service": "332",  # مصروف خدمة
        "asset_transfer": "112",
        "dividend": "213",
    }.get(req.transaction_type, "332")

    lines_to = await asyncio.gather(
        je_line(to_company_id, dr_code_to, debit=egp_amount,
                desc=f"{req.description} — من {from_company.get('name','')}"),
        je_line(to_company_id, "253", credit=egp_amount,
                desc=f"التزام لـ {from_company.get('name','')} — {req.description}"),
    )
    je_to_id = await post_je(to_company_id, current_user["user_id"], req.date,
        f"معاملة بين شركات — من {from_company.get('name','')}",
        list(lines_to))

    # Save inter-company record
    ic_record = {
        "id": str(uuid.uuid4()),
        "from_company_id": from_company_id, "from_company_name": from_company.get("name",""),
        "to_company_id":   to_company_id,   "to_company_name":   to_company.get("name",""),
        "amount":          req.amount,  "currency": req.currency,
        "exchange_rate":   req.exchange_rate, "egp_amount": egp_amount,
        "transaction_type": req.transaction_type,
        "description":     req.description, "date": req.date,
        "je_from_id":      je_from_id,  "je_to_id": je_to_id,
        "created_by":      current_user["user_id"],
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.inter_company_transactions.insert_one(ic_record); ic_record.pop("_id", None)

    return {
        "message":       f"✅ تم إنشاء قيدَي التسوية بين الشركتين",
        "transaction":   ic_record,
        "journal_entries": {
            f"from_{from_company_id}": je_from_id,
            f"to_{to_company_id}":     je_to_id,
        },
        "elimination_note": "تُستبعَد هذه الأرصدة عند إعداد القوائم المالية الموحَّدة",
    }


@router.get("/inter-company/balance")
async def inter_company_balance(current_user: dict = Depends(get_current_user)):
    """أرصدة المعاملات البينية للمراجعة والاستبعاد"""
    company_id = current_user["company_id"]
    txns = await db.inter_company_transactions.find(
        {"$or": [{"from_company_id": company_id}, {"to_company_id": company_id}]},
        {"_id": 0}
    ).sort("date", -1).to_list(None)

    receivable = sum(t["egp_amount"] for t in txns if t["from_company_id"] == company_id)
    payable    = sum(t["egp_amount"] for t in txns if t["to_company_id"]   == company_id)

    return {
        "company_id": company_id,
        "ic_receivable": round(receivable, 2),
        "ic_payable":    round(payable, 2),
        "net_position":  round(receivable - payable, 2),
        "transactions":  txns,
    }


# ══════════════════════════════════════════════════════════════
# FISCAL PERIOD MANAGEMENT — إدارة الفترات المالية
# TC-JE-07: منع الترحيل في فترات مغلقة
# ══════════════════════════════════════════════════════════════

PERIOD_REOPEN_ROLES = ["رئيس مجلس الإدارة", "Board Chairman", "General Manager", "مدير عام", "CEO",
                       "المدير التنفيذي", "Super Admin", "المدير المالي", "CFO"]
PERIOD_CLOSE_ROLES = PERIOD_REOPEN_ROLES + ["رئيس الحسابات", "Chief Accountant"]


@router.post("/periods/close")
async def close_fiscal_period(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    إغلاق فترة مالية — يمنع أي ترحيل بتاريخ داخلها

    بعد الإغلاق: أي قيد بتاريخ في هذه الفترة يُرفَض بـ:
    "الفترة المالية YYYY-MM مغلقة — لا يمكن الترحيل إليها"
    """
    company_id = current_user["company_id"]
    year  = int(data.get("year",  date.today().year))
    month = int(data.get("month", date.today().month))
    period = f"{year}-{month:02d}"
    reason = data.get("reason", "إغلاق شهري روتيني")
    # Who may close: owners and the finance heads. Anyone could close before.
    if current_user.get("role") not in PERIOD_CLOSE_ROLES:
        raise HTTPException(403, "إقفال الفترات المالية مقصور على الإدارة والمدير المالي ورئيس الحسابات")
    import calendar as _cal
    last_day = date(year, month, _cal.monthrange(year, month)[1])
    if last_day >= date.today():
        raise HTTPException(400, f"لا يمكن إقفال الفترة {period} قبل انتهائها ({last_day.isoformat()})")
    # Drafts dated inside the period could never be posted once it is closed.
    drafts = await db.journal_entries.find(
        {"company_id": company_id, "status": "draft",
         "entry_date": {"$gte": f"{period}-01", "$lte": f"{period}-31\uffff"}},
        {"_id": 0, "entry_number": 1, "description": 1}).to_list(20)
    if drafts:
        raise HTTPException(400, {"message": f"في الفترة {period} قيود مسودة غير مرحّلة — رحّلها أو احذفها قبل الإقفال",
                                  "drafts": drafts})

    # Check not already closed
    existing = await db.financial_periods.find_one(
        {"company_id": company_id, "year": year, "month": month}, {"_id": 0})
    if existing and existing.get("status") == "closed":
        return {
            "message": f"الفترة {period} مغلقة بالفعل منذ {existing.get('closed_at','')}",
            "period": existing
        }

    now = datetime.now(timezone.utc).isoformat()
    fp = {
        "company_id":  company_id,
        "year":        year,
        "month":       month,
        "period":      period,
        "status":      "closed",
        "reason":      reason,
        "closed_by":   current_user["user_id"],
        "closed_at":   now,
        "reopened_by": None,
        "reopened_at": None,
    }
    await db.financial_periods.replace_one(
        {"company_id": company_id, "year": year, "month": month},
        fp, upsert=True
    )
    return {
        "message":   f"✅ تم إغلاق الفترة المالية {period}",
        "period":    period,
        "effect":    "أي قيد بتاريخ في هذه الفترة سيُرفَض عند الترحيل",
        "test_case": "TC-JE-07: POST /journal-entries/post بتاريخ 2024-06-15 → 400 مغلقة",
    }


@router.post("/periods/reopen")
async def reopen_fiscal_period(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    إعادة فتح فترة مالية مغلقة — يتطلب صلاحية محاسب أول / مدير مالي
    يُسجَّل في سجل التدقيق
    """
    company_id = current_user["company_id"]
    # Reopening changes figures that may already have been filed: stricter than closing.
    if current_user.get("role") not in PERIOD_REOPEN_ROLES:
        raise HTTPException(403, "إعادة فتح فترة مالية مقصورة على الإدارة والمدير المالي")
    year  = int(data.get("year"))
    month = int(data.get("month"))
    period = f"{year}-{month:02d}"
    justification = data.get("justification","")

    if not justification:
        raise HTTPException(400, "يجب ذكر مبرر إعادة الفتح")

    now = datetime.now(timezone.utc).isoformat()
    await db.financial_periods.update_one(
        {"company_id": company_id, "year": year, "month": month},
        {"$set": {"status": "open", "reopened_by": current_user["user_id"],
                  "reopened_at": now, "reopen_justification": justification}},
        upsert=True
    )
    # Audit log
    await db.audit_trail.insert_one({
        "company_id":  company_id, "action": "period.reopened",
        "period":      period, "user_id": current_user["user_id"],
        "justification": justification, "timestamp": now,
    })
    return {
        "message":      f"⚠️ تم إعادة فتح الفترة {period} — مُسجَّل في سجل التدقيق",
        "period":       period,
        "reopened_by":  current_user["user_id"],
        "justification": justification,
    }


@router.get("/periods")
async def list_fiscal_periods(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """قائمة الفترات المالية وحالتها"""
    q = {"company_id": current_user["company_id"]}
    if year: q["year"] = year
    periods = await db.financial_periods.find(
        q, {"_id": 0}
    ).sort([("year",-1),("month",-1)]).to_list(None)

    return {
        "periods": periods,
        "total":   len(periods),
        "closed":  sum(1 for p in periods if p.get("status")=="closed"),
        "open":    sum(1 for p in periods if p.get("status")!="closed"),
    }
