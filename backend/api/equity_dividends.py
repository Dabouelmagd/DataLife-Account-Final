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
from dependencies import get_current_user

router = APIRouter(prefix="/api/equity", tags=["Equity & Dividends"])

# ── Constants ─────────────────────────────────────────────────
LEGAL_RESERVE_RATE   = 0.05   # 5% من صافي الأرباح
LEGAL_RESERVE_CAP    = 0.50   # 50% من رأس المال المدفوع
DIVIDEND_TAX_NORMAL  = 0.10   # 10% — شركات عادية
DIVIDEND_TAX_LISTED  = 0.05   # 5%  — شركات مقيدة بالبورصة

# ── Account codes ─────────────────────────────────────────────
ACC = {
    "retained":       "213",   # الأرباح المرحلة
    "legal_reserve":  "221",   # الاحتياطي القانوني
    "general_reserve":"217",   # الاحتياطي العام
    "div_payable":    "256",  # أرباح مستحقة للمساهمين (صافي)
    "div_tax":        "2542",  # ضريبة توزيعات مستحقة
    # التزامات قانون 159/1981 عند التوزيع — لم تكن مسجَّلة إطلاقاً
    "emp_share":      "267",   # حصة العاملين في الأرباح
    "board_rem":      "268",   # مكافآت أعضاء مجلس الإدارة
    "paid_in_capital":"211",   # رأس المال المدفوع
    "partners_cur":   "212",   # جاري الشركاء
    "bank":           "162",
    # 413 is "مردودات ومسموحات المبيعات" — a contra-revenue account. Retained
    # earnings is where a distribution comes from.
    "net_income":     "213",   # الأرباح (الخسائر) المرحلة
}


async def get_acc(company_id, code):
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    # the old fallback invented an account whose id was the bare code: the
    # entry was saved and then failed at posting (500) — or never reached a report
    if not a:
        raise HTTPException(400, f"الحساب {code} غير موجود في دليل الحسابات — أضفه قبل تسجيل القيد")
    if a.get("is_header") or a.get("allow_posting") is False or a.get("account_category") == "header":
        raise HTTPException(400, f"الحساب {code} «{a.get('account_name')}» حساب تجميعي لا يقبل قيوداً")
    return a


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
    try:
        r = await svc.create_journal_entry(entry)
        await svc.post_journal_entry(r["id"], user_id)
    except ValueError as e:
        raise HTTPException(400, str(e))   # closed period, unbalanced… — not a 500
    return r["id"]


def balanced(lines):
    td = round(sum(l["debit"] for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    return abs(td - tc) < 0.01, td, tc


async def get_account_balance(company_id, code, as_of=None):
    """رصيد حساب دائن الطبيعة حتى تاريخ — من دفتر الأستاذ العام (المرحَّل فعلاً)

    It matched journal lines with regex ^code, so "21" would sweep in every
    account starting with 21 and a code like "221" any future "2211"; and it
    read journal_entries rather than the ledger. Exact account, ledger rows.
    """
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0, "id": 1})
    if not acc:
        return 0.0
    q = {"company_id": company_id, "account_id": acc["id"]}
    if as_of:
        q["entry_date"] = {"$lte": as_of}
    d = c = 0.0
    async for r in db.general_ledger.find(q, {"_id": 0, "debit": 1, "credit": 1}):
        d += float(r.get("debit") or 0)
        c += float(r.get("credit") or 0)
    return round(c - d, 2)   # حقوق الملكية والالتزامات: رصيد دائن طبيعي


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class LegalReserveRequest(BaseModel):
    fiscal_year:  int
    net_profit:   float
    date_str:     str
    # Law 159/1981 art. 40 caps the legal reserve at half of the ISSUED
    # capital; the chart only holds paid-up capital (211), so the issued
    # amount can be given here (falls back to the 211 balance)
    issued_capital: Optional[float] = None
    # rates kept configurable — the articles of association may require more
    reserve_rate: float = LEGAL_RESERVE_RATE
    reserve_cap_rate: float = LEGAL_RESERVE_CAP
    notes:        Optional[str] = None


class GeneralReserveRequest(BaseModel):
    fiscal_year:  int
    amount:       float
    date_str:     str
    notes:        Optional[str] = None


class DividendRequest(BaseModel):
    fiscal_year:     int
    gross_dividend:  float        # إجمالي الأرباح المقرر توزيعها
    # التزامات قانون 159/1981 تُخصم قبل حصة المساهمين — لم تكن مسجَّلة إطلاقاً
    employees_share: float = 0.0      # حصة العاملين في الأرباح
    board_remuneration: float = 0.0   # مكافآت أعضاء مجلس الإدارة
    is_listed:       bool = False # مقيدة بالبورصة؟ (5% vs 10%)
    dividend_tax_rate: Optional[float] = None   # override (treaty / exemption) — default 10% / 5%
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
    preview: bool = Query(False),
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
    if not (0 < req.reserve_rate <= 1) or not (0 < req.reserve_cap_rate <= 1):
        raise HTTPException(400, "نسبة الاحتياطي أو الحد الأقصى غير صحيحة")
    # one legal-reserve appropriation per year — a second call stacked another 5%
    if await db.equity_transactions.find_one(
            {"company_id": company_id, "type": "legal_reserve", "fiscal_year": req.fiscal_year}):
        raise HTTPException(400, f"تم تكوين الاحتياطي القانوني لسنة {req.fiscal_year} بالفعل")

    # Current legal reserve balance
    current_reserve  = await get_account_balance(company_id, ACC["legal_reserve"])
    paid_in_capital  = await get_account_balance(company_id, ACC["paid_in_capital"])
    capital_base     = round(float(req.issued_capital), 2) if req.issued_capital else paid_in_capital
    if capital_base <= 0:
        raise HTTPException(400, "لا يوجد رأس مال مسجل (211) — سجّل رأس المال أو أدخل رأس المال المصدر")
    reserve_cap      = round(capital_base * req.reserve_cap_rate, 2)
    reserve_gap      = round(max(reserve_cap - current_reserve, 0), 2)

    if reserve_gap <= 0:
        return {
            "message":   f"✅ الاحتياطي القانوني بلغ حده الأقصى — لا يلزم تكوين إضافي",
            "current_reserve": current_reserve,
            "reserve_cap":     reserve_cap,
            "paid_in_capital": paid_in_capital,
        }

    # Required = 5% of net profit, but not more than remaining gap
    required = round(req.net_profit * req.reserve_rate, 2)
    actual   = round(min(required, reserve_gap), 2)

    reserve_id = str(uuid.uuid4())
    lines = await asyncio.gather(
        je_line(company_id, ACC["retained"], debit=actual,
                desc=f"تكوين احتياطي قانوني {req.fiscal_year} — {req.reserve_rate*100:g}% × {req.net_profit:,.0f}"),
        je_line(company_id, ACC["legal_reserve"], credit=actual,
                desc=f"الاحتياطي القانوني {req.fiscal_year} (قانون 159/1981)"),
    )
    if preview:
        return {"preview": True, "lines": list(lines), "required": required, "actual": actual,
                "reserve_before": current_reserve, "reserve_cap": reserve_cap, "capital_base": capital_base}
    je_id = await post_je(company_id, current_user["user_id"], req.date_str,
        f"احتياطي قانوني {req.fiscal_year}", list(lines), reserve_id)

    ok, td, tc = balanced(list(lines))

    # Save record
    rec = {
        "id": reserve_id, "company_id": company_id,
        "type": "legal_reserve", "fiscal_year": req.fiscal_year,
        "net_profit": req.net_profit, "rate": req.reserve_rate,
        "capital_base": capital_base,
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
            "rate":             f"{req.reserve_rate*100:g}%",
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
            "pct_of_capital": round((current_reserve+actual)/capital_base*100,1)
                               if capital_base > 0 else 0,
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
    preview: bool = Query(False),
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
    req.amount = round(req.amount, 2)

    res_id = str(uuid.uuid4())
    lines = await asyncio.gather(
        je_line(company_id, ACC["retained"], debit=req.amount,
                desc=f"تكوين احتياطي عام {req.fiscal_year} — بقرار مجلس الإدارة"),
        je_line(company_id, ACC["general_reserve"], credit=req.amount,
                desc=f"الاحتياطي العام {req.fiscal_year}"),
    )
    if preview:
        return {"preview": True, "lines": list(lines)}
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
    preview: bool = Query(False),
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
    if req.dividend_tax_rate is not None:
        if not (0 <= req.dividend_tax_rate <= 1):
            raise HTTPException(400, "نسبة ضريبة التوزيعات غير صحيحة")
        tax_rate = req.dividend_tax_rate
    req.gross_dividend = round(float(req.gross_dividend or 0), 2)
    if req.gross_dividend <= 0:
        raise HTTPException(400, "إجمالي المبلغ المقرر توزيعه يجب أن يكون موجباً")
    if req.payment_method not in ("bank", "partners_account"):
        raise HTTPException(400, "طريقة الصرف غير صحيحة (bank / partners_account)")
    emp_share = round(float(req.employees_share or 0), 2)
    board_rem = round(float(req.board_remuneration or 0), 2)
    if emp_share < 0 or board_rem < 0:
        raise HTTPException(400, "حصة العاملين ومكافآت المجلس لا يمكن أن تكون سالبة")
    if emp_share + board_rem > req.gross_dividend:
        raise HTTPException(400, "حصة العاملين ومكافآت المجلس تتجاوز إجمالي المُوزَّع")
    # الضريبة على حصة المساهمين وحدها — الحصة والمكافآت ليستا توزيعات أرباح
    shareholders = round(req.gross_dividend - emp_share - board_rem, 2)
    tax_amount = round(shareholders * tax_rate, 2)
    net_div    = round(shareholders - tax_amount, 2)
    div_id     = str(uuid.uuid4())

    # Warnings only — the general assembly decides the figures; we flag the
    # usual Law 159/1981 checks instead of blocking (articles may differ).
    warnings = []
    retained_bal = await get_account_balance(company_id, ACC["retained"], req.declaration_date)
    if req.gross_dividend > retained_bal:
        warnings.append(f"المبلغ الموزَّع ({req.gross_dividend:,.2f}) أكبر من رصيد الأرباح المرحلة "
                        f"({retained_bal:,.2f}) — تأكد من إقفال أرباح السنة في حساب 213 قبل التوزيع")
    if shareholders > 0 and emp_share < round(shareholders * 0.10, 2):
        warnings.append("حصة العاملين أقل من 10% من الأرباح الموزعة على المساهمين — "
                        "قانون 159/1981 م.41 (بحد أقصى مجموع الأجور السنوية)")
    if board_rem > round(shareholders * 0.10, 2):
        warnings.append("مكافأة مجلس الإدارة تتجاوز 10% من الأرباح الموزعة — راجع النظام الأساسي")

    # zero lines are dropped: a 0% tax (exemption) or a distribution wholly to
    # employees produced a 0/0 line, which the ledger refuses
    lines = [l for l in await asyncio.gather(
        je_line(company_id, ACC["retained"], debit=req.gross_dividend,
                desc=f"توزيعات أرباح {req.fiscal_year} — إقرار"),
        *([je_line(company_id, ACC["div_payable"], credit=net_div,
                   desc="أرباح مستحقة للمساهمين (بعد الضريبة)")] if net_div else []),
        *([je_line(company_id, ACC["div_tax"], credit=tax_amount,
                   desc=f"ضريبة توزيعات أرباح {tax_rate*100:g}% — مستحقة لمصلحة الضرائب")] if tax_amount else []),
        *([je_line(company_id, ACC["emp_share"], credit=emp_share,
                   desc="حصة العاملين في الأرباح — قانون 159/1981")] if emp_share else []),
        *([je_line(company_id, ACC["board_rem"], credit=board_rem,
                   desc="مكافآت أعضاء مجلس الإدارة")] if board_rem else []),
    )]
    ok, td, tc = balanced(lines)
    if not ok:
        raise HTTPException(400, f"قيد التوزيع غير متوازن (مدين {td} / دائن {tc})")
    if preview:
        return {"preview": True, "lines": lines, "warnings": warnings,
                "calculation": {"gross_dividend": req.gross_dividend, "employees_share": emp_share,
                                "board_remuneration": board_rem, "shareholders_share": shareholders,
                                "tax_rate": tax_rate, "tax_amount": tax_amount, "net_to_shareholders": net_div}}
    je_id = await post_je(company_id, current_user["user_id"], req.declaration_date,
        f"إقرار توزيعات أرباح {req.fiscal_year}", lines, div_id)

    ok, td, tc = balanced(list(lines))

    div_rec = {
        "id": div_id, "company_id": company_id,
        "type": "dividend_declaration", "fiscal_year": req.fiscal_year,
        "employees_share": emp_share,
        "board_remuneration": board_rem,
        "shareholders_share": shareholders,
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
            "employees_share": emp_share,
            "board_remuneration": board_rem,
            "shareholders_share": shareholders,
            "tax_rate":       f"{tax_rate*100:.0f}%",
            "tax_type":       "5% — شركات مقيدة بالبورصة" if req.is_listed
                              else "10% — شركات غير مقيدة",
            "tax_amount":     tax_amount,
            "net_to_shareholders": net_div,
        },
        "journal": {
            "id":      je_id,
            "debit":   f"م/{ACC['retained']} الأرباح المرحلة         {req.gross_dividend:,.2f}",
            "lines":   list(lines),
            "balanced": ok,
        },
        "law": f"قانون 91/2005 — ضريبة توزيعات {tax_rate*100:.0f}%",
        "warnings": warnings,
    }


# ══════════════════════════════════════════════════════════════
# 4. سداد التوزيعات — DIVIDEND PAYMENT
# ══════════════════════════════════════════════════════════════

@router.post("/dividends/{div_id}/pay")
async def pay_dividends(div_id: str, data: dict,
                        preview: bool = Query(False),
                        current_user: dict = Depends(get_current_user)):
    """
    صرف التوزيعات المستحقة — كل بند مرة واحدة:
      المساهمون:      Dr 256 أرباح مستحقة         Cr 162 البنك / 212 جاري الشركاء
      ضريبة التوزيعات: Dr 2542 ضريبة توزيعات مستحقة Cr 162 البنك
      حصة العاملين:    Dr 267                      Cr 162 البنك
      مكافآت المجلس:   Dr 268                      Cr 162 البنك
    Previously only the shareholders and the tax could be paid, and the
    declaration was then marked "paid" — the tax (if deferred), the employees'
    share and the board remuneration could never be settled from here.
    """
    company_id  = current_user["company_id"]
    pay_date    = data.get("date") or date.today().isoformat()
    want = {
        "shareholders": bool(data.get("pay_shareholders", True)),
        "tax":          bool(data.get("pay_tax", True)),
        "employees":    bool(data.get("pay_employees", False)),
        "board":        bool(data.get("pay_board", False)),
    }

    div = await db.equity_transactions.find_one(
        {"id": div_id, "company_id": company_id,
         "type": "dividend_declaration"}, {"_id": 0})
    if not div:
        raise HTTPException(404, "قرار التوزيعات غير موجود")
    paid = dict(div.get("paid_parts") or {})
    if div.get("status") == "paid" and not paid:
        # declarations paid by the old code: shareholders + tax were settled
        paid = {"shareholders": True, "tax": True}

    method  = data.get("payment_method") or div.get("payment_method", "bank")
    if method not in ("bank", "partners_account"):
        raise HTTPException(400, "طريقة الصرف غير صحيحة")
    cr_code = ACC["bank"] if method == "bank" else ACC["partners_cur"]
    cr_name = "البنك" if method == "bank" else "جاري الشركاء"
    fy = div["fiscal_year"]
    parts = {
        "shareholders": (ACC["div_payable"], float(div.get("net_dividend") or 0), cr_code,
                         f"صرف أرباح {fy} للمساهمين — {cr_name}"),
        "tax":          (ACC["div_tax"], float(div.get("tax_amount") or 0), ACC["bank"],
                         f"سداد ضريبة توزيعات {fy} لمصلحة الضرائب"),
        "employees":    (ACC["emp_share"], float(div.get("employees_share") or 0), ACC["bank"],
                         f"صرف حصة العاملين في أرباح {fy}"),
        "board":        (ACC["board_rem"], float(div.get("board_remuneration") or 0), ACC["bank"],
                         f"صرف مكافآت مجلس الإدارة عن {fy}"),
    }
    lines, now_paid = [], []
    for key, (dr, amt, cr, desc) in parts.items():
        if not want[key] or paid.get(key) or round(amt, 2) <= 0:
            continue
        lines += [await je_line(company_id, dr, debit=amt, desc=desc),
                  await je_line(company_id, cr, credit=amt, desc=desc)]
        now_paid.append(key)
    if not lines:
        raise HTTPException(400, "لا توجد بنود مستحقة للصرف بالاختيارات المحددة")
    ok, td, tc = balanced(lines)
    if preview:
        return {"preview": True, "lines": lines, "parts": now_paid, "total": td}

    je_id = await post_je(company_id, current_user["user_id"], pay_date,
        f"صرف توزيعات أرباح {fy}", lines, div_id)
    for k in now_paid:
        paid[k] = True
    outstanding = [k for k, (_, amt, _, _) in parts.items() if round(amt, 2) > 0 and not paid.get(k)]
    await db.equity_transactions.update_one(
        {"id": div_id, "company_id": company_id},
        {"$set": {"status": "paid" if not outstanding else "partially_paid",
                  "paid_parts": paid, "pay_je_id": je_id, "paid_date": pay_date},
         "$push": {"payment_je_ids": je_id}}
    )
    return {
        "message":    f"✅ تم صرف {len(now_paid)} بند من توزيعات {fy}",
        "paid_parts": now_paid,
        "outstanding": outstanding,
        "total_paid": td,
        "journal": {"id": je_id, "lines": lines, "balanced": ok},
    }


# ══════════════════════════════════════════════════════════════
# 4b. رأس المال — CAPITAL CONTRIBUTION
# ══════════════════════════════════════════════════════════════

class CapitalRequest(BaseModel):
    amount:     float
    date_str:   str
    method:     str = "bank"     # bank | cash | partners_account
    notes:      Optional[str] = None


@router.post("/capital")
async def add_capital(req: CapitalRequest, preview: bool = Query(False),
                      current_user: dict = Depends(get_current_user)):
    """
    زيادة / سداد رأس المال المدفوع
    Dr 162 البنك / 161 الخزينة / 212 جاري الشركاء — Cr 211 رأس المال المدفوع
    (there was no way to record capital here, so the legal-reserve cap — half
    the capital — read 0 until capital was entered by a manual journal)
    """
    company_id = current_user["company_id"]
    amount = round(float(req.amount or 0), 2)
    if amount <= 0:
        raise HTTPException(400, "مبلغ رأس المال يجب أن يكون موجباً")
    src = {"bank": (ACC["bank"], "البنك"), "cash": ("161", "الخزينة"),
           "partners_account": (ACC["partners_cur"], "جاري الشركاء")}.get(req.method)
    if not src:
        raise HTTPException(400, "طريقة السداد غير صحيحة")
    lines = [await je_line(company_id, src[0], debit=amount, desc=f"سداد رأس مال — {src[1]}"),
             await je_line(company_id, ACC["paid_in_capital"], credit=amount, desc="زيادة رأس المال المدفوع")]
    if preview:
        return {"preview": True, "lines": lines}
    cap_id = str(uuid.uuid4())
    je_id = await post_je(company_id, current_user["user_id"], req.date_str,
                          "زيادة رأس المال المدفوع", lines, cap_id)
    rec = {"id": cap_id, "company_id": company_id, "type": "capital",
           "fiscal_year": int(req.date_str[:4]) if req.date_str[:4].isdigit() else None,
           "amount": amount, "method": req.method, "je_id": je_id, "date": req.date_str,
           "notes": req.notes, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.equity_transactions.insert_one(rec); rec.pop("_id", None)
    return {"message": "✅ تم تسجيل زيادة رأس المال", "journal": {"id": je_id, "lines": lines}, "record": rec}


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
