"""
Trade Finance & Advanced EAS Engine
محرك التمويل التجاري والمعايير المحاسبية المتقدمة

أ. خطابات الضمان (Letters of Guarantee — LGs)
   - إصدار + غطاء بنكي + قيد نظامي (Off-Balance-Sheet)
   - تجديد + تخفيض + إلغاء/استرداد

ب. عقود الإيجار التمويلي — المعيار المصري 49 / IFRS 16
   - إثبات العقد: حق استخدام الأصل + التزام الإيجار
   - جدول استحقاق شهري: فائدة + إهلاك + سداد
"""
import uuid, asyncio, math
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/trade-finance", tags=["Trade Finance"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    # خطابات الضمان
    "lg_margin":       "1361",  # غطاء خطاب الضمان المحتجز
    "lg_fees_prepaid": "2311",  # مصاريف إصدار مدفوعة مقدماً
    "lg_fees_exp":     "3321",  # مصروف عمولات إصدار
    "lg_memo_dr":      "9111",  # التزام خطاب ضمان صادر (نظامي)
    "lg_memo_cr":      "9112",  # التزام البنك (نظامي مقابل)
    "bank":            "112",
    # EAS 49 — Lease
    "rou_asset":       "1561",  # أصل حق الاستخدام
    "rou_acc_dep":     "1562",  # مجمع إهلاك ROU
    "lease_lt":        "2611",  # التزام إيجار — طويل الأجل
    "lease_st":        "2612",  # التزام إيجار — قصير الأجل (جاري)
    "dep_exp":         "3411",  # مصروف إهلاك ROU
    "interest_exp":    "3412",  # مصروف فوائد تمويلية
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


def check_balance(lines: list) -> tuple:
    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    return td, tc, abs(td - tc) < 0.01


# ══════════════════════════════════════════════════════════════
# أ. LETTERS OF GUARANTEE — خطابات الضمان
# ══════════════════════════════════════════════════════════════

LG_TYPES = {
    "preliminary":   "ابتدائي",
    "performance":   "حسن التنفيذ (نهائي)",
    "advance":       "ضمان دفعة مقدمة",
    "warranty":      "ضمان صيانة",
    "customs":       "ضمان جمركي",
}


class IssueLGRequest(BaseModel):
    lg_type:         str   # preliminary | performance | advance | warranty | customs
    beneficiary:     str   # المستفيد
    project_id:      Optional[str] = None
    amount:          float  # قيمة خطاب الضمان
    margin_amount:   float  # الغطاء النقدي المحتجز (قد يساوي amount أو أقل)
    commission_rate: float = 0.005  # عمولة إصدار (0.5% افتراضي)
    issue_date:      str
    expiry_date:     str
    bank_account:    str = "112"
    reference:       Optional[str] = None
    notes:           Optional[str] = None


@router.post("/letters-of-guarantee")
async def issue_letter_of_guarantee(
    req: IssueLGRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إصدار خطاب ضمان مع حجز الغطاء البنكي

    القيد أ — الغطاء النقدي والعمولة:
    Dr م/1361 غطاء خطابات الضمان   ← الغطاء المحتجز
    Dr م/3321 مصاريف عمولات بنكية  ← عمولة الإصدار
    Cr م/112 البنك الجاري           ← إجمالي المدفوع

    القيد ب — الالتزام النظامي (Off-Balance-Sheet):
    Dr م/9111 التزامات خطابات ضمان صادرة  ← قيمة الضمان
    Cr م/9112 التزامات البنك عن خطابات ضمان ← مقابل نظامي
    """
    company_id  = current_user["company_id"]
    lg_id       = str(uuid.uuid4())
    commission  = round(req.amount * req.commission_rate, 2)
    total_paid  = round(req.margin_amount + commission, 2)

    # ── القيد أ: الغطاء النقدي والعمولة ─────────────────────
    lines_a = await asyncio.gather(
        je_line(company_id, ACC["lg_margin"], debit=req.margin_amount,
                desc=f"غطاء خطاب ضمان {LG_TYPES.get(req.lg_type,'')} — {req.beneficiary}"),
        je_line(company_id, ACC["lg_fees_exp"], debit=commission,
                desc=f"عمولة إصدار خطاب ضمان ({req.commission_rate*100:.2f}%)"),
        je_line(company_id, req.bank_account, credit=total_paid,
                desc=f"خصم من البنك — خطاب ضمان لـ {req.beneficiary}"),
    )
    je_a_id = await post_je(company_id, current_user["user_id"], req.issue_date,
        f"إصدار خطاب ضمان {LG_TYPES.get(req.lg_type,'')} — {req.beneficiary}",
        list(lines_a), lg_id)

    # ── القيد ب: الالتزام النظامي (خارج الميزانية) ───────────
    lines_b = await asyncio.gather(
        je_line(company_id, ACC["lg_memo_dr"], debit=req.amount,
                desc=f"التزام خطاب ضمان صادر — {req.beneficiary} — {req.expiry_date}"),
        je_line(company_id, ACC["lg_memo_cr"], credit=req.amount,
                desc=f"التزام البنك عن خطاب ضمان — {req.reference or lg_id[:8]}"),
    )
    je_b_id = await post_je(company_id, current_user["user_id"], req.issue_date,
        f"قيد نظامي — خطاب ضمان {LG_TYPES.get(req.lg_type,'')} — {req.beneficiary}",
        list(lines_b), lg_id)

    # Save LG record
    lg = {
        "id": lg_id, "company_id": company_id,
        "lg_type":       req.lg_type,
        "lg_type_ar":    LG_TYPES.get(req.lg_type,""),
        "beneficiary":   req.beneficiary,
        "project_id":    req.project_id,
        "amount":        req.amount,
        "margin_amount": req.margin_amount,
        "commission":    commission,
        "commission_rate": req.commission_rate,
        "total_paid":    total_paid,
        "issue_date":    req.issue_date,
        "expiry_date":   req.expiry_date,
        "status":        "active",  # active | expired | cancelled | claimed
        "reference":     req.reference,
        "notes":         req.notes,
        "issue_je_id":   je_a_id,
        "memo_je_id":    je_b_id,
        "created_at":    datetime.now(timezone.utc).isoformat(),
    }
    await db.letters_of_guarantee.insert_one(lg); lg.pop("_id", None)

    td_a, tc_a, bal_a = check_balance(list(lines_a))
    td_b, tc_b, bal_b = check_balance(list(lines_b))

    return {
        "message":   f"✅ تم إصدار خطاب الضمان — {req.beneficiary}",
        "lg_id":     lg_id,
        "lg":        lg,
        "journals": {
            "cash_margin": {
                "id": je_a_id,
                "debit":  f"م/1361 غطاء ضمان {req.margin_amount:,.2f} + م/3321 عمولة {commission:,.2f}",
                "credit": f"م/112 البنك {total_paid:,.2f}",
                "balanced": bal_a,
            },
            "memo_entry": {
                "id": je_b_id,
                "note": "قيد نظامي خارج الميزانية — للمراقبة والإفصاح فقط",
                "debit":  f"م/9111 التزام خطاب ضمان {req.amount:,.2f}",
                "credit": f"م/9112 التزام البنك {req.amount:,.2f}",
                "balanced": bal_b,
            },
        },
    }


@router.put("/letters-of-guarantee/{lg_id}/release")
async def release_letter_of_guarantee(
    lg_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    استرداد / إلغاء خطاب الضمان بعد انتهاء المشروع

    القيد أ — استرداد الغطاء:
    Dr م/112 البنك الجاري
    Cr م/1361 غطاء خطابات الضمان

    القيد ب — عكس القيد النظامي:
    Dr م/9112 التزامات البنك (عكس)
    Cr م/9111 التزامات خطابات ضمان (عكس)
    """
    company_id   = current_user["company_id"]
    release_date = data.get("date", date.today().isoformat())
    reason       = data.get("reason", "انتهاء المشروع")

    lg = await db.letters_of_guarantee.find_one(
        {"id": lg_id, "company_id": company_id}, {"_id": 0})
    if not lg:
        raise HTTPException(404, "خطاب الضمان غير موجود")
    if lg["status"] not in ("active", "expired"):
        raise HTTPException(400, f"لا يمكن استرداد خطاب بحالة '{lg['status']}'")

    margin = float(lg["margin_amount"])
    amount = float(lg["amount"])

    # ── القيد أ: استرداد الغطاء ──────────────────────────────
    lines_a = await asyncio.gather(
        je_line(company_id, "112", debit=margin,
                desc=f"استرداد غطاء خطاب ضمان — {lg['beneficiary']} — {reason}"),
        je_line(company_id, ACC["lg_margin"], credit=margin,
                desc=f"إقفال غطاء خطاب ضمان — {lg['lg_type_ar']}"),
    )
    je_release_id = await post_je(company_id, current_user["user_id"], release_date,
        f"استرداد خطاب ضمان — {lg['beneficiary']}", list(lines_a), lg_id)

    # ── القيد ب: عكس القيد النظامي ───────────────────────────
    lines_b = await asyncio.gather(
        je_line(company_id, ACC["lg_memo_cr"], debit=amount,
                desc=f"عكس التزام البنك — خطاب ضمان {lg['beneficiary']}"),
        je_line(company_id, ACC["lg_memo_dr"], credit=amount,
                desc=f"عكس التزام خطاب ضمان — {lg['beneficiary']}"),
    )
    je_reverse_id = await post_je(company_id, current_user["user_id"], release_date,
        f"عكس قيد نظامي — خطاب ضمان {lg['beneficiary']}", list(lines_b), lg_id)

    await db.letters_of_guarantee.update_one(
        {"id": lg_id},
        {"$set": {"status": "cancelled", "release_date": release_date,
                  "release_reason": reason,
                  "release_je_id": je_release_id,
                  "reverse_memo_je_id": je_reverse_id}}
    )
    return {
        "message": f"✅ تم استرداد خطاب الضمان — {lg['beneficiary']}",
        "released_margin": margin,
        "journals": {
            "release": {"id": je_release_id,
                        "debit": f"م/112 بنك {margin:,.2f}",
                        "credit": f"م/1361 غطاء ضمان {margin:,.2f}"},
            "reverse_memo": {"id": je_reverse_id,
                             "note": "عكس القيد النظامي",
                             "debit":  f"م/9112 التزام البنك {amount:,.2f}",
                             "credit": f"م/9111 التزام خطاب ضمان {amount:,.2f}"},
        },
    }


@router.get("/letters-of-guarantee")
async def list_lgs(
    status: Optional[str] = None,
    lg_type: Optional[str] = None,
    project_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status:     q["status"]     = status
    if lg_type:    q["lg_type"]    = lg_type
    if project_id: q["project_id"] = project_id

    lgs = await db.letters_of_guarantee.find(q, {"_id": 0}).sort("issue_date", -1).to_list(None)
    total_margin   = round(sum(float(l.get("margin_amount",0)) for l in lgs if l["status"]=="active"), 2)
    total_exposure = round(sum(float(l.get("amount",0)) for l in lgs if l["status"]=="active"), 2)

    return {
        "letters": lgs, "total": len(lgs),
        "summary": {
            "active_count":          sum(1 for l in lgs if l["status"]=="active"),
            "total_margin_locked":   total_margin,
            "total_exposure":        total_exposure,
            "off_balance_note":      "الالتزامات النظامية تُفصَح في الإيضاحات ولا تظهر في الميزانية",
        }
    }


# ══════════════════════════════════════════════════════════════
# ب. FINANCE LEASE — المعيار المصري 49 / IFRS 16
# ══════════════════════════════════════════════════════════════

class LeaseContractRequest(BaseModel):
    asset_name:        str
    asset_type:        str = "equipment"  # equipment | vehicle | building | land
    lease_start:       str
    lease_term_months: int
    monthly_payment:   float
    interest_rate:     float   # معدل الفائدة الضمني السنوي (0.12 = 12%)
    initial_direct_costs: float = 0.0   # تكاليف مباشرة أولية
    lessor_name:       str = ""
    notes:             Optional[str] = None


def calc_pv(payment: float, rate_monthly: float, n_months: int) -> float:
    """
    القيمة الحالية لمدفوعات الإيجار — Present Value
    PV = PMT × [1 - (1+r)^-n] / r
    """
    if rate_monthly == 0:
        return round(payment * n_months, 2)
    pv = payment * (1 - (1 + rate_monthly) ** -n_months) / rate_monthly
    return round(pv, 2)


def build_amortization_schedule(
    pv: float, payment: float, rate_monthly: float, n_months: int, start_date: str
) -> list:
    """
    جدول استهلاك التزام الإيجار (Lease Amortization Schedule)
    كل شهر: الفائدة = رصيد × معدل | السداد = القسط - الفائدة
    """
    schedule = []
    balance   = pv
    period_dt = date.fromisoformat(start_date)

    for i in range(1, n_months + 1):
        interest    = round(balance * rate_monthly, 2)
        principal   = round(payment - interest, 2)
        # Last payment: settle remaining balance
        if i == n_months:
            principal = round(balance, 2)
            payment_actual = round(balance + interest, 2)
        else:
            payment_actual = payment
        new_balance = round(balance - principal, 2)

        schedule.append({
            "period":        i,
            "period_date":   period_dt.isoformat(),
            "opening_balance": round(balance, 2),
            "payment":       payment_actual,
            "interest":      interest,
            "principal":     principal,
            "closing_balance": new_balance,
            "posted":        False,
            "je_id":         None,
        })
        balance    = new_balance
        period_dt  = period_dt + relativedelta(months=1)

    return schedule


@router.post("/leases")
async def create_lease_contract(
    req: LeaseContractRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إثبات عقد إيجار تمويلي — المعيار المصري 49 / IFRS 16

    القيد أ — إثبات العقد:
    Dr م/1561 أصل حق الاستخدام (القيمة الحالية + تكاليف مباشرة)
    Cr م/2611 التزامات عقود الإيجار — طويل الأجل (القيمة الحالية)

    يُنشئ جدول استهلاك شهري تلقائياً
    """
    company_id   = current_user["company_id"]
    lease_id     = str(uuid.uuid4())
    rate_monthly = req.interest_rate / 12

    # Calculate Present Value of lease payments
    pv = calc_pv(req.monthly_payment, rate_monthly, req.lease_term_months)
    rou_cost = round(pv + req.initial_direct_costs, 2)
    monthly_dep = round(rou_cost / req.lease_term_months, 2)

    # ── القيد: إثبات العقد ───────────────────────────────────
    lines = await asyncio.gather(
        je_line(company_id, ACC["rou_asset"], debit=rou_cost,
                desc=f"أصل حق استخدام — {req.asset_name} ({req.lease_term_months} شهر)"),
        je_line(company_id, ACC["lease_lt"], credit=pv,
                desc=f"التزام إيجار تمويلي — {req.lessor_name or req.asset_name}"),
    )
    # Initial direct costs debit (if any)
    if req.initial_direct_costs > 0:
        lines = list(lines)
        lines.append(await je_line(
            company_id, ACC["lease_lt"], credit=req.initial_direct_costs,
            desc="تكاليف مباشرة أولية — تُضاف لأصل الإيجار"))
        # Flip: initial direct costs come from bank usually
        lines[-1]["credit"] = 0
        lines.append(await je_line(
            company_id, "112", credit=req.initial_direct_costs,
            desc="تكاليف مباشرة أولية مدفوعة"))

    je_id = await post_je(company_id, current_user["user_id"], req.lease_start,
        f"إثبات عقد إيجار تمويلي — {req.asset_name}", list(lines), lease_id)

    # Build amortization schedule
    schedule = build_amortization_schedule(
        pv, req.monthly_payment, rate_monthly,
        req.lease_term_months, req.lease_start
    )

    lease = {
        "id": lease_id, "company_id": company_id,
        "asset_name":        req.asset_name,
        "asset_type":        req.asset_type,
        "lessor_name":       req.lessor_name,
        "lease_start":       req.lease_start,
        "lease_term_months": req.lease_term_months,
        "monthly_payment":   req.monthly_payment,
        "interest_rate":     req.interest_rate,
        "rate_monthly":      round(rate_monthly, 6),
        "present_value":     pv,
        "initial_direct_costs": req.initial_direct_costs,
        "rou_asset_cost":    rou_cost,
        "monthly_depreciation": monthly_dep,
        "total_interest":    round(sum(s["interest"] for s in schedule), 2),
        "total_payments":    round(sum(s["payment"] for s in schedule), 2),
        "remaining_balance": pv,
        "accumulated_dep":   0.0,
        "status":            "active",
        "schedule":          schedule,
        "inception_je_id":   je_id,
        "notes":             req.notes,
        "created_at":        datetime.now(timezone.utc).isoformat(),
    }
    await db.lease_contracts.insert_one(lease); lease.pop("_id", None)
    lease["schedule"] = schedule[:3]  # preview first 3 months

    td, tc, balanced = check_balance(list(lines))
    return {
        "message":       f"✅ تم إثبات عقد الإيجار — {req.asset_name}",
        "lease_id":      lease_id,
        "lease_summary": {
            "asset_name":       req.asset_name,
            "lease_term":       f"{req.lease_term_months} شهر",
            "present_value":    pv,
            "rou_asset_cost":   rou_cost,
            "monthly_payment":  req.monthly_payment,
            "monthly_dep":      monthly_dep,
            "total_interest":   round(sum(s["interest"] for s in schedule), 2),
            "interest_rate":    f"{req.interest_rate*100:.1f}%",
        },
        "journal": {
            "id":       je_id,
            "debit":    f"م/1561 أصل حق الاستخدام {rou_cost:,.2f}",
            "credit":   f"م/2611 التزام إيجار {pv:,.2f}",
            "balanced": balanced,
        },
        "schedule_preview": schedule[:3],
        "law": "المعيار المحاسبي المصري 49 / IFRS 16",
    }


@router.post("/leases/{lease_id}/monthly-entry")
async def post_monthly_lease_entry(
    lease_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    قيد الاستحقاق الشهري لعقد الإيجار التمويلي

    القيد:
    Dr م/3411 مصروف إهلاك أصول حق الاستخدام
    Dr م/3412 مصروف فوائد تمويلية
    Cr م/1562 مجمع إهلاك أصول حق الاستخدام
    Cr م/2611 التزامات عقود إيجار (الفائدة المستحقة)
    Cr م/112 البنك (القسط المدفوع)
    """
    company_id = current_user["company_id"]
    period     = int(data.get("period", 1))   # رقم الشهر (1, 2, 3...)
    date_str   = data.get("date", date.today().isoformat())

    lease = await db.lease_contracts.find_one(
        {"id": lease_id, "company_id": company_id}, {"_id": 0})
    if not lease:
        raise HTTPException(404, "عقد الإيجار غير موجود")
    if lease["status"] != "active":
        raise HTTPException(400, f"العقد في حالة '{lease['status']}'")

    schedule   = lease.get("schedule", [])
    slot_idx   = period - 1
    if slot_idx < 0 or slot_idx >= len(schedule):
        raise HTTPException(400, f"الفترة {period} خارج نطاق العقد")

    slot = schedule[slot_idx]
    if slot.get("posted"):
        raise HTTPException(400, f"الفترة {period} مُرحَّلة بالفعل (قيد: {slot.get('je_id')})")

    interest   = float(slot["interest"])
    principal  = float(slot["principal"])
    payment    = float(slot["payment"])
    dep_amount = float(lease["monthly_depreciation"])
    asset_name = lease["asset_name"]

    # ── القيد الشهري ──────────────────────────────────────────
    # مدين
    lines = [
        await je_line(company_id, ACC["dep_exp"], debit=dep_amount,
                      desc=f"إهلاك أصل حق الاستخدام — {asset_name} — الفترة {period}"),
        await je_line(company_id, ACC["interest_exp"], debit=interest,
                      desc=f"فائدة تمويلية — {asset_name} — الفترة {period}"),
    ]
    # دائن: مجمع إهلاك + سداد القسط
    lines += [
        await je_line(company_id, ACC["rou_acc_dep"], credit=dep_amount,
                      desc=f"مجمع إهلاك — {asset_name}"),
        await je_line(company_id, "112", credit=payment,
                      desc=f"سداد قسط إيجار {period}/{lease['lease_term_months']} — {asset_name}"),
    ]
    # الفائدة المستحقة تُقلِّل الالتزام بقدر الفائدة فقط (الباقي رأس المال)
    # net_liability_reduction = principal (payment - interest)

    td, tc, balanced = check_balance(lines)
    if not balanced:
        # Adjust: add liability reduction as separate line
        diff = round(td - tc, 2)
        if diff > 0:
            lines.append(await je_line(
                company_id, ACC["lease_lt"], credit=diff,
                desc=f"تسوية التزام إيجار — فترة {period}"))
        else:
            lines.append(await je_line(
                company_id, ACC["lease_lt"], debit=abs(diff),
                desc=f"تسوية التزام إيجار — فترة {period}"))

    td, tc, balanced = check_balance(lines)
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"استحقاق إيجار شهري — {asset_name} — الفترة {period}", lines, lease_id)

    # Update schedule + balances
    schedule[slot_idx]["posted"]    = True
    schedule[slot_idx]["je_id"]     = je_id
    schedule[slot_idx]["post_date"] = date_str

    new_balance = float(slot["closing_balance"])
    new_acc_dep = round(float(lease.get("accumulated_dep", 0)) + dep_amount, 2)

    await db.lease_contracts.update_one(
        {"id": lease_id},
        {"$set": {
            f"schedule.{slot_idx}.posted":    True,
            f"schedule.{slot_idx}.je_id":     je_id,
            f"schedule.{slot_idx}.post_date": date_str,
            "remaining_balance": new_balance,
            "accumulated_dep":   new_acc_dep,
            "status": "settled" if new_balance < 0.01 else "active",
        }}
    )

    return {
        "message":   f"✅ تم ترحيل قيد الفترة {period} — {asset_name}",
        "period":    period,
        "journal_entry_id": je_id,
        "amounts": {
            "depreciation": dep_amount,
            "interest":     interest,
            "principal":    principal,
            "payment":      payment,
        },
        "balances": {
            "remaining_lease_liability": new_balance,
            "accumulated_depreciation":  new_acc_dep,
        },
        "journal_lines": {
            "debit":  [
                f"م/{ACC['dep_exp']} إهلاك ROU  {dep_amount:,.2f}",
                f"م/{ACC['interest_exp']} فائدة {interest:,.2f}",
            ],
            "credit": [
                f"م/{ACC['rou_acc_dep']} مجمع إهلاك  {dep_amount:,.2f}",
                f"م/112 بنك (قسط)          {payment:,.2f}",
            ],
            "balanced": balanced,
        },
    }


@router.post("/leases/{lease_id}/run-all-pending")
async def run_all_pending_entries(
    lease_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """تشغيل جميع القيود الشهرية المعلقة دفعة واحدة"""
    company_id = current_user["company_id"]
    as_of_date = data.get("as_of_date", date.today().isoformat())

    lease = await db.lease_contracts.find_one(
        {"id": lease_id, "company_id": company_id}, {"_id": 0})
    if not lease:
        raise HTTPException(404, "العقد غير موجود")

    schedule = lease.get("schedule", [])
    pending = [s for s in schedule if not s.get("posted") and s["period_date"] <= as_of_date]

    posted_count = 0
    for slot in pending:
        try:
            await post_monthly_lease_entry(
                lease_id,
                {"period": slot["period"], "date": slot["period_date"]},
                current_user
            )
            posted_count += 1
        except HTTPException:
            break  # Stop on first error

    return {
        "message":      f"تم ترحيل {posted_count} قيد شهري",
        "posted_count": posted_count,
        "pending_left": len(pending) - posted_count,
    }


@router.get("/leases/{lease_id}/schedule")
async def get_lease_schedule(
    lease_id: str,
    current_user: dict = Depends(get_current_user)
):
    """جدول استهلاك عقد الإيجار كاملاً"""
    lease = await db.lease_contracts.find_one(
        {"id": lease_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not lease:
        raise HTTPException(404, "العقد غير موجود")

    schedule = lease.get("schedule", [])
    total_interest   = round(sum(s["interest"] for s in schedule), 2)
    total_principal  = round(sum(s["principal"] for s in schedule), 2)
    total_payments   = round(sum(s["payment"] for s in schedule), 2)
    posted_count     = sum(1 for s in schedule if s.get("posted"))

    return {
        "lease_id":    lease_id,
        "asset_name":  lease["asset_name"],
        "rou_cost":    lease["rou_asset_cost"],
        "pv":          lease["present_value"],
        "rate":        f"{lease['interest_rate']*100:.1f}%",
        "term_months": lease["lease_term_months"],
        "schedule":    schedule,
        "totals": {
            "total_payments":   total_payments,
            "total_principal":  total_principal,
            "total_interest":   total_interest,
            "posted":           posted_count,
            "remaining":        len(schedule) - posted_count,
            "remaining_balance": lease.get("remaining_balance", 0),
        }
    }


@router.get("/leases")
async def list_leases(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    leases = await db.lease_contracts.find(q, {"_id": 0, "schedule": 0}).to_list(None)
    return {
        "leases":            leases,
        "total":             len(leases),
        "total_rou_assets":  round(sum(float(l.get("rou_asset_cost",0)) for l in leases), 2),
        "total_liabilities": round(sum(float(l.get("remaining_balance",0)) for l in leases), 2),
    }
