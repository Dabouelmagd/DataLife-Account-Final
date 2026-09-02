"""
Equity & Dividends Engine — محرك حقوق الملكية وتوزيعات الأرباح
قانون الشركات المصري رقم 159 لسنة 1981
قانون الضريبة على الدخل 91/2005

1. الاحتياطي القانوني   — 5% من صافي الأرباح حتى 50% من رأس المال
2. الاحتياطي العام      — نسبة اختيارية يقررها مجلس الإدارة
3. توزيعات الأرباح      — إقرار + ضريبة حجب (10% أو 5% للبورصة)
4. سداد التوزيعات       — صرف الأرباح للمساهمين بعد حسم الضريبة
5. تقرير حقوق الملكية  — جدول حركة حقوق الملكية (Statement of Equity)
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/equity", tags=["Equity & Dividends"])

# ── Constants ─────────────────────────────────────────────────
LEGAL_RESERVE_RATE   = 0.05   # 5% من صافي الأرباح
LEGAL_RESERVE_CAP    = 0.50   # 50% من رأس المال المدفوع
DIVIDEND_TAX_NORMAL  = 0.10   # 10% — شركات عادية
DIVIDEND_TAX_LISTED  = 0.05   # 5%  — شركات مقيدة بالبورصة

# ── Account codes ─────────────────────────────────────────────
ACC = {
    "retained":       "213",   # الأرباح المرحلة
    "legal_reserve":  "216",   # الاحتياطي القانوني
    "general_reserve":"217",   # الاحتياطي العام
    "div_payable":    "2151",  # أرباح مستحقة للمساهمين (صافي)
    "div_tax":        "2152",  # ضريبة توزيعات مستحقة
    "paid_in_capital":"211",   # رأس المال المدفوع
    "partners_cur":   "212",   # جاري الشركاء
    "bank":           "112",
    "net_income":     "413",   # صافي الربح (من قائمة الدخل)
}


async def get_acc(company_id, code):
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id, code, debit=0.0, credit=0.0, desc=""):
    acc = await get_acc(company_id, code)
    return {"line_id": str(uuid.uuid4()), "entry_id": None,
            "account_id": acc["id"], "account_code": code,
            "account_name": acc.get("account_name", f"حساب {code}"),
            "debit": round(debit, 2), "credit": round(credit, 2),
            "description": desc}


async def post_je(company_id, user_id, date_str, description, lines, src_id=None):
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="equity", source_document_id=src_id,
        created_by=user_id)
    r = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(r["id"], user_id)
    return r["id"]


def balanced(lines):
    td = round(sum(l["debit"] for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    return abs(td - tc) < 0.01, td, tc


async def get_account_balance(company_id, code, as_of=None):
    """رصيد حساب تراكمي حتى تاريخ محدد"""
    q = {"company_id": company_id, "status": "posted"}
    if as_of:
        q["entry_date"] = {"$lte": as_of}
    pipeline = [
        {"$match": q}, {"$unwind": "$lines"},
        {"$match": {"lines.account_code": {"$regex": f"^{code}"}}},
        {"$group": {"_id": None,
                    "debit":  {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"}}},
    ]
    r = await db.journal_entries.aggregate(pipeline).to_list(1)
    if not r:
        return 0.0
    d, c = float(r[0]["debit"]), float(r[0]["credit"])
    return round(c - d, 2)   # حقوق الملكية: رصيد دائن طبيعي


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class LegalReserveRequest(BaseModel):
    fiscal_year:  int
    net_profit:   float
    date_str:     str
    notes:        Optional[str] = None


class GeneralReserveRequest(BaseModel):
    fiscal_year:  int
    amount:       float
    date_str:     str
    notes:        Optional[str] = None


class DividendRequest(BaseModel):
    fiscal_year:     int
    gross_dividend:  float        # إجمالي الأرباح المقرر توزيعها
    is_listed:       bool = False # مقيدة بالبورصة؟ (5% vs 10%)
    declaration_date: str
    payment_date:    Optional[str] = None
    payment_method:  str = "bank"  # bank | partners_account
    notes:           Optional[str] = None


# ══════════════════════════════════════════════════════════════
# 1. الاحتياطي القانوني — LEGAL RESERVE
# ══════════════════════════════════════════════════════════════

@router.post("/legal-reserve")
async def create_legal_reserve(
    req: LegalReserveRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    تكوين الاحتياطي القانوني
    قانون 159/1981: 5% من صافي الأرباح حتى يبلغ 50% من رأس المال

    القيد:
    Dr م/213 الأرباح المرحلة
    Cr م/216 الاحتياطي القانوني
    """
    company_id = current_user["company_id"]

    if req.net_profit <= 0:
        raise HTTPException(400, "صافي الربح يجب أن يكون موجباً")

    # Current legal reserve balance
    current_reserve  = await get_account_balance(company_id, ACC["legal_reserve"])
    paid_in_capital  = await get_account_balance(company_id, ACC["paid_in_capital"])
    reserve_cap      = round(paid_in_capital * LEGAL_RESERVE_CAP, 2)
    reserve_gap      = round(max(reserve_cap - current_reserve, 0), 2)

    if reserve_gap <= 0:
        return {
            "message":   f"✅ الاحتياطي القانوني بلغ حده الأقصى — لا يلزم تكوين إضافي",
            "current_reserve": current_reserve,
            "reserve_cap":     reserve_cap,
            "paid_in_capital": paid_in_capital,
        }

    # Required = 5% of net profit, but not more than remaining gap
    required = round(req.net_profit * LEGAL_RESERVE_RATE, 2)
    actual   = round(min(required, reserve_gap), 2)

    reserve_id = str(uuid.uuid4())
    lines = await asyncio.gather(
        je_line(company_id, ACC["retained"], debit=actual,
                desc=f"تكوين احتياطي قانوني {req.fiscal_year} — 5% × {req.net_profit:,.0f}"),
        je_line(company_id, ACC["legal_reserve"], credit=actual,
                desc=f"الاحتياطي القانوني {req.fiscal_year} (قانون 159/1981)"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.date_str,
        f"احتياطي قانوني {req.fiscal_year}", list(lines), reserve_id)

    ok, td, tc = balanced(list(lines))

    # Save record
    rec = {
        "id": reserve_id, "company_id": company_id,
        "type": "legal_reserve", "fiscal_year": req.fiscal_year,
        "net_profit": req.net_profit, "rate": LEGAL_RESERVE_RATE,
        "required_amount": required, "actual_amount": actual,
        "capped": actual < required,
        "reserve_before": current_reserve,
        "reserve_after":  round(current_reserve + actual, 2),
        "reserve_cap":    reserve_cap,
        "je_id": je_id, "date": req.date_str, "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.equity_transactions.insert_one(rec); rec.pop("_id", None)

    return {
        "message":   f"✅ تم تكوين الاحتياطي القانوني {req.fiscal_year}",
        "calculation": {
            "net_profit":       req.net_profit,
            "rate":             "5%",
            "required":         required,
            "actual":           actual,
            "capped_reason":    f"الاحتياطي وصل {current_reserve:,.0f} من {reserve_cap:,.0f}" if actual < required else None,
        },
        "journal": {
            "id":       je_id,
            "debit":    f"م/{ACC['retained']} الأرباح المرحلة       {actual:,.2f}",
            "credit":   f"م/{ACC['legal_reserve']} الاحتياطي القانوني  {actual:,.2f}",
            "balanced": ok,
        },
        "reserve_position": {
            "before": current_reserve,
            "after":  round(current_reserve + actual, 2),
            "cap":    reserve_cap,
            "pct_of_capital": round((current_reserve+actual)/paid_in_capital*100,1)
                               if paid_in_capital > 0 else 0,
        },
        "law": "قانون الشركات المصري 159/1981 — المادة 40",
        "record": rec,
    }


# ══════════════════════════════════════════════════════════════
# 2. الاحتياطي العام — GENERAL RESERVE
# ══════════════════════════════════════════════════════════════

@router.post("/general-reserve")
async def create_general_reserve(
    req: GeneralReserveRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    تكوين الاحتياطي العام (اختياري — بقرار مجلس الإدارة)

    القيد:
    Dr م/213 الأرباح المرحلة
    Cr م/217 الاحتياطي العام
    """
    company_id = current_user["company_id"]
    if req.amount <= 0:
        raise HTTPException(400, "مبلغ الاحتياطي يجب أن يكون موجباً")

    res_id = str(uuid.uuid4())
    lines = await asyncio.gather(
        je_line(company_id, ACC["retained"], debit=req.amount,
                desc=f"تكوين احتياطي عام {req.fiscal_year} — بقرار مجلس الإدارة"),
        je_line(company_id, ACC["general_reserve"], credit=req.amount,
                desc=f"الاحتياطي العام {req.fiscal_year}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.date_str,
        f"احتياطي عام {req.fiscal_year}", list(lines), res_id)

    ok, td, tc = balanced(list(lines))
    await db.equity_transactions.insert_one({
        "id": res_id, "company_id": company_id, "type": "general_reserve",
        "fiscal_year": req.fiscal_year, "amount": req.amount,
        "je_id": je_id, "date": req.date_str, "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "message": f"✅ تم تكوين الاحتياطي العام {req.fiscal_year}",
        "journal": {
            "id":       je_id,
            "debit":    f"م/{ACC['retained']} الأرباح المرحلة     {req.amount:,.2f}",
            "credit":   f"م/{ACC['general_reserve']} الاحتياطي العام {req.amount:,.2f}",
            "balanced": ok,
        },
    }


# ══════════════════════════════════════════════════════════════
# 3. إقرار توزيعات الأرباح — DIVIDEND DECLARATION
# ══════════════════════════════════════════════════════════════

@router.post("/dividends/declare")
async def declare_dividends(
    req: DividendRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إقرار توزيعات أرباح على المساهمين

    معدل الضريبة:
    - شركات عادية: 10% (قانون 91/2005)
    - مقيدة بالبورصة: 5%

    القيد:
    Dr م/213 الأرباح المرحلة
    Cr م/2151 أرباح أسهم مستحقة التوزيع (صافي)
    Cr م/2152 ضريبة توزيعات مستحقة

    """
    company_id = current_user["company_id"]

    tax_rate   = DIVIDEND_TAX_LISTED if req.is_listed else DIVIDEND_TAX_NORMAL
    tax_amount = round(req.gross_dividend * tax_rate, 2)
    net_div    = round(req.gross_dividend - tax_amount, 2)
    div_id     = str(uuid.uuid4())

    lines = await asyncio.gather(
        je_line(company_id, ACC["retained"], debit=req.gross_dividend,
                desc=f"توزيعات أرباح {req.fiscal_year} — إقرار"),
        je_line(company_id, ACC["div_payable"], credit=net_div,
                desc=f"أرباح أسهم مستحقة للمساهمين (بعد الضريبة)"),
        je_line(company_id, ACC["div_tax"], credit=tax_amount,
                desc=f"ضريبة توزيعات أرباح {tax_rate*100:.0f}% — مستحقة لمصلحة الضرائب"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.declaration_date,
        f"إقرار توزيعات أرباح {req.fiscal_year}", list(lines), div_id)

    ok, td, tc = balanced(list(lines))

    div_rec = {
        "id": div_id, "company_id": company_id,
        "type": "dividend_declaration", "fiscal_year": req.fiscal_year,
        "gross_dividend": req.gross_dividend,
        "tax_rate":       tax_rate,
        "tax_amount":     tax_amount,
        "net_dividend":   net_div,
        "is_listed":      req.is_listed,
        "status":         "declared",
        "declaration_date": req.declaration_date,
        "payment_date":   req.payment_date,
        "payment_method": req.payment_method,
        "declare_je_id":  je_id,
        "pay_je_id":      None,
        "notes":          req.notes,
        "created_at":     datetime.now(timezone.utc).isoformat(),
    }
    await db.equity_transactions.insert_one(div_rec); div_rec.pop("_id", None)

    return {
        "message":   f"✅ تم إقرار توزيعات الأرباح {req.fiscal_year}",
        "div_id":    div_id,
        "calculation": {
            "gross_dividend": req.gross_dividend,
            "tax_rate":       f"{tax_rate*100:.0f}%",
            "tax_type":       "5% — شركات مقيدة بالبورصة" if req.is_listed
                              else "10% — شركات غير مقيدة",
            "tax_amount":     tax_amount,
            "net_to_shareholders": net_div,
        },
        "journal": {
            "id":      je_id,
            "debit":   f"م/{ACC['retained']} الأرباح المرحلة         {req.gross_dividend:,.2f}",
            "credits": [
                f"م/{ACC['div_payable']} أرباح أسهم مستحقة (صافي)  {net_div:,.2f}",
                f"م/{ACC['div_tax']}     ضريبة توزيعات مستحقة       {tax_amount:,.2f}",
            ],
            "balanced": ok,
        },
        "law": f"قانون 91/2005 — ضريبة توزيعات {tax_rate*100:.0f}%",
    }


# ══════════════════════════════════════════════════════════════
# 4. سداد التوزيعات — DIVIDEND PAYMENT
# ══════════════════════════════════════════════════════════════

@router.post("/dividends/{div_id}/pay")
async def pay_dividends(div_id: str, data: dict,
                        current_user: dict = Depends(get_current_user)):
    """
    صرف الأرباح للمساهمين وتسوية ضريبة التوزيعات

    قيد السداد للمساهمين:
    Dr م/2151 أرباح أسهم مستحقة
    Cr م/112  البنك / م/212 جاري الشركاء

    قيد سداد الضريبة لمصلحة الضرائب:
    Dr م/2152 ضريبة توزيعات مستحقة
    Cr م/112  البنك
    """
    company_id  = current_user["company_id"]
    pay_date    = data.get("date", date.today().isoformat())
    pay_tax_now = data.get("pay_tax", True)

    div = await db.equity_transactions.find_one(
        {"id": div_id, "company_id": company_id,
         "type": "dividend_declaration"}, {"_id": 0})
    if not div:
        raise HTTPException(404, "قرار التوزيعات غير موجود")
    if div.get("status") == "paid":
        raise HTTPException(400, "التوزيعات مدفوعة بالفعل")

    net_div    = float(div["net_dividend"])
    tax_amount = float(div["tax_amount"])
    method     = div.get("payment_method","bank")
    cr_code    = ACC["bank"] if method == "bank" else ACC["partners_cur"]
    cr_name    = "البنك" if method == "bank" else "جاري الشركاء"

    # Payment lines
    lines = await asyncio.gather(
        je_line(company_id, ACC["div_payable"], debit=net_div,
                desc=f"سداد أرباح أسهم {div['fiscal_year']} للمساهمين"),
        je_line(company_id, cr_code, credit=net_div,
                desc=f"تحويل أرباح الأسهم للمساهمين — {cr_name}"),
    )
    lines = list(lines)

    # Tax payment
    if pay_tax_now and tax_amount > 0:
        lines += list(await asyncio.gather(
            je_line(company_id, ACC["div_tax"], debit=tax_amount,
                    desc=f"سداد ضريبة توزيعات {div['fiscal_year']} لمصلحة الضرائب"),
            je_line(company_id, ACC["bank"], credit=tax_amount,
                    desc="تحويل ضريبة التوزيعات لمصلحة الضرائب"),
        ))

    je_id = await post_je(company_id, current_user["user_id"], pay_date,
        f"سداد توزيعات أرباح {div['fiscal_year']}", lines, div_id)

    ok, td, tc = balanced(lines)
    await db.equity_transactions.update_one(
        {"id": div_id},
        {"$set": {"status": "paid", "pay_je_id": je_id, "paid_date": pay_date}}
    )

    return {
        "message":    f"✅ تم سداد توزيعات أرباح {div['fiscal_year']}",
        "net_paid":   net_div,
        "tax_paid":   tax_amount if pay_tax_now else 0,
        "total_paid": round(net_div + (tax_amount if pay_tax_now else 0), 2),
        "journal": {
            "id":       je_id,
            "shareholders": {
                "debit":  f"م/{ACC['div_payable']} أرباح مستحقة  {net_div:,.2f}",
                "credit": f"م/{cr_code} {cr_name}               {net_div:,.2f}",
            },
            "tax": {
                "debit":  f"م/{ACC['div_tax']} ضريبة مستحقة  {tax_amount:,.2f}",
                "credit": f"م/{ACC['bank']} بنك              {tax_amount:,.2f}",
            } if pay_tax_now else None,
            "balanced": ok,
        },
    }


# ══════════════════════════════════════════════════════════════
# 5. تقرير حقوق الملكية — EQUITY STATEMENT
# ══════════════════════════════════════════════════════════════

@router.get("/statement/{fiscal_year}")
async def equity_statement(
    fiscal_year: int,
    current_user: dict = Depends(get_current_user)
):
    """
    قائمة التغيرات في حقوق الملكية
    Statement of Changes in Equity — EAS 1

    تُظهِر: رأس المال + الاحتياطيات + الأرباح المرحلة + التوزيعات
    """
    company_id = current_user["company_id"]
    prev_end   = f"{fiscal_year-1}-12-31"
    curr_end   = f"{fiscal_year}-12-31"

    async def bal(code, as_of):
        return await get_account_balance(company_id, code, as_of)

    # Opening balances
    (cap_open, legal_open, gen_open, ret_open) = await asyncio.gather(
        bal(ACC["paid_in_capital"], prev_end),
        bal(ACC["legal_reserve"],   prev_end),
        bal(ACC["general_reserve"], prev_end),
        bal(ACC["retained"],        prev_end),
    )

    # Current year movements
    (cap_curr, legal_curr, gen_curr, ret_curr,
     div_declared, div_tax_curr) = await asyncio.gather(
        bal(ACC["paid_in_capital"], curr_end),
        bal(ACC["legal_reserve"],   curr_end),
        bal(ACC["general_reserve"], curr_end),
        bal(ACC["retained"],        curr_end),
        bal(ACC["div_payable"],     curr_end),
        bal(ACC["div_tax"],         curr_end),
    )

    # Net income for year = change in retained + dividends + reserves
    legal_added  = round(legal_curr - legal_open, 2)
    gen_added    = round(gen_curr   - gen_open,   2)
    ret_change   = round(ret_curr   - ret_open,   2)

    # Dividends declared this year (from equity_transactions)
    div_recs = await db.equity_transactions.find({
        "company_id": company_id,
        "type": "dividend_declaration",
        "fiscal_year": fiscal_year,
    }, {"_id": 0}).to_list(None)
    total_dividends = round(sum(float(d.get("gross_dividend",0)) for d in div_recs), 2)

    # Net income = retained change + legal reserve added + general reserve + dividends
    net_income = round(ret_change + legal_added + gen_added + total_dividends, 2)

    # Legal reserve check
    cap_now = cap_curr
    legal_reserve_cap  = round(cap_now * LEGAL_RESERVE_CAP, 2)
    legal_reserve_now  = legal_curr
    reserve_pct        = round(legal_reserve_now / cap_now * 100, 1) if cap_now > 0 else 0
    reserve_reached_cap = legal_reserve_now >= legal_reserve_cap

    def equity_row(label, open_bal, movement, close_bal, is_total=False):
        return {"component": label, "opening": round(open_bal,2),
                "movement": round(movement,2), "closing": round(close_bal,2),
                "is_total": is_total}

    rows = [
        equity_row("رأس المال المدفوع",    cap_open,   round(cap_curr-cap_open,2),   cap_curr),
        equity_row("الاحتياطي القانوني",   legal_open, legal_added,                  legal_curr),
        equity_row("الاحتياطي العام",      gen_open,   gen_added,                    gen_curr),
        equity_row("الأرباح المرحلة",      ret_open,   ret_change,                   ret_curr),
    ]
    total_open  = round(cap_open  + legal_open  + gen_open  + ret_open,  2)
    total_close = round(cap_curr  + legal_curr  + gen_curr  + ret_curr,  2)
    rows.append(equity_row("إجمالي حقوق الملكية", total_open,
                            round(total_close-total_open,2), total_close, True))

    return {
        "title":         f"قائمة التغيرات في حقوق الملكية — {fiscal_year}",
        "standard":      "المعيار المحاسبي المصري 1 (EAS 1)",
        "fiscal_year":   fiscal_year,
        "rows":          rows,
        "net_income":    net_income,
        "dividends_declared": total_dividends,
        "legal_reserve_status": {
            "current_amount":  legal_reserve_now,
            "cap_amount":      legal_reserve_cap,
            "percentage":      f"{reserve_pct:.1f}% من رأس المال",
            "reached_cap":     reserve_reached_cap,
            "remaining_to_cap": max(round(legal_reserve_cap - legal_reserve_now, 2), 0),
            "note": (
                "✅ بلغ الاحتياطي القانوني الحد الأقصى (50%) — لا يُكوَّن مزيد"
                if reserve_reached_cap else
                f"⚠️ الاحتياطي القانوني {reserve_pct:.0f}% — يتطلب استمرار التكوين"
            ),
        },
        "dividend_summary": [
            {"fiscal_year": d["fiscal_year"], "gross": d["gross_dividend"],
             "net": d["net_dividend"], "tax": d["tax_amount"], "status": d["status"]}
            for d in div_recs
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/history")
async def equity_history(
    year: Optional[int] = None,
    tx_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """سجل حركات حقوق الملكية"""
    q = {"company_id": current_user["company_id"]}
    if year:    q["fiscal_year"] = year
    if tx_type: q["type"] = tx_type
    recs = await db.equity_transactions.find(q, {"_id": 0}).sort("created_at",-1).to_list(None)
    return {"transactions": recs, "total": len(recs)}
