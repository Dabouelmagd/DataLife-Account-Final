"""
Enterprise Accounting API
- Dynamic Tax Brackets
- Employee Insurance Profiles
- Cost Centers
- Progress Claims (Contracting)
- Medical Services
- Currencies
- Immutability enforcement
"""

from fastapi import APIRouter, Depends, HTTPException
from services.auth_service import verify_token
from fastapi import Header
from typing import Optional
from database import db
from datetime import datetime, timezone
import uuid
from models.enterprise_accounting import (
    TaxBracket, DEFAULT_TAX_BRACKETS_2024,
    EmployeeInsuranceProfile,
    CostCenter,
    ProgressClaim,
    BOQItem,
    MedicalService,
    Currency, DEFAULT_CURRENCIES,
    ExchangeRate,
)

router = APIRouter(prefix="/api/enterprise", tags=["enterprise-accounting"])

async def get_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return verify_token((authorization or '').replace('Bearer ',''))


# ══════════════════════════════════════════
# TAX BRACKETS — Dynamic (no hardcoding)
# ══════════════════════════════════════════
@router.get("/tax-brackets")
async def get_tax_brackets(year: int = 2026, current_user: dict = Depends(get_user)):
    """شرائح ضريبة كسب العمل — القانون 7/2024، من نفس المصدر الذي تحسب به الرواتب.

    This endpoint used to seed and serve its own 2024 table (which no payroll
    calculation read) and let any user PUT arbitrary fields into it.
    """
    from services.egypt_payroll import brackets_table, PERSONAL_EXEMPTION, PHASE_OUT
    return {"brackets": brackets_table(), "tax_year": year, "personal_exemption": PERSONAL_EXEMPTION,
            "phase_out": [{"income_above": a, "taxed_from_bracket_ending": e} for a, e in PHASE_OUT],
            "source": "قانون 91/2005 المعدل بالقانون 7/2024",
            "editable": False}


@router.put("/tax-brackets/{bracket_id}")
async def update_tax_bracket(bracket_id: str, data: dict, current_user: dict = Depends(get_user)):
    """الشرائح يحددها القانون ولا تُعدَّل من حساب الشركة."""
    raise HTTPException(status_code=405, detail="شرائح الضريبة يحددها القانون ولا تُعدَّل من الشركة — "
                        "حدود التأمينات والإعفاء تُضبط من الرواتب ← الإعدادات")


# ══════════════════════════════════════════
# EMPLOYEE INSURANCE PROFILES
# ══════════════════════════════════════════
@router.get("/insurance-profile/{employee_id}")
async def get_insurance_profile(employee_id: str, current_user: dict = Depends(get_user)):
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": current_user.get("company_id")},
        {"_id": 0}
    )
    if not profile:
        # Return defaults from employee record
        emp = await db.employees.find_one({"id": employee_id}, {"_id": 0})
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        return {
            "employee_id": employee_id,
            "insured_basic_salary": emp.get("basic_salary", 0),
            "gross_salary": emp.get("basic_salary", 0),
            "is_insured": True,
            "allowances_tax_exempt": 0,
        }
    return profile

@router.post("/insurance-profile")
async def create_insurance_profile(data: dict, current_user: dict = Depends(get_user)):
    data["company_id"] = current_user.get("company_id")
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.employee_insurance_profiles.replace_one(
        {"employee_id": data["employee_id"], "company_id": data["company_id"]},
        data, upsert=True
    )
    return {"message": "Insurance profile saved", "id": data["id"]}


# ══════════════════════════════════════════
# COST CENTERS
# ══════════════════════════════════════════
@router.get("/cost-centers")
async def get_cost_centers(current_user: dict = Depends(get_user)):
    centers = await db.cost_centers.find(
        {"company_id": current_user.get("company_id"), "is_active": True},
        {"_id": 0}
    ).sort("code", 1).to_list(length=200)
    return {"cost_centers": centers}

@router.post("/cost-centers")
async def create_cost_center(data: dict, current_user: dict = Depends(get_user)):
    center = CostCenter(company_id=current_user.get("company_id"), **data)
    d = center.dict()
    await db.cost_centers.insert_one(d)
    d.pop("_id", None)
    return d


# ══════════════════════════════════════════
# PROGRESS CLAIMS — مستخلصات المقاولات
# ══════════════════════════════════════════
@router.get("/progress-claims")
async def list_all_claims(claim_type: Optional[str] = None, current_user: dict = Depends(get_user)):
    """كل مستخلصات الشركة (المالك ومقاولي الباطن)، الأحدث أولاً."""
    q = {"company_id": current_user.get("company_id")}
    if claim_type in ("owner", "subcontractor"):
        q["claim_type"] = claim_type
    claims = await db.progress_claims.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return {"claims": claims}


@router.get("/progress-claims/{project_id}")
async def get_progress_claims(project_id: str, current_user: dict = Depends(get_user)):
    claims = await db.progress_claims.find(
        {"project_id": project_id, "company_id": current_user.get("company_id")},
        {"_id": 0}
    ).sort("claim_number", 1).to_list(length=100)
    return {"claims": claims}

# ── rates ────────────────────────────────────────────────────
# Law 91/2005 art. 59 (withholding on payments to residents):
#   contracts & supplies 1% | services 3% | professional fees / commissions 5%
WHT_RATES = {"none": 0.0, "contracts": 0.01, "services": 0.03, "professional": 0.05}
# VAT on contracting: 5% table tax (Law 67/2016 schedule) or the 14% general rate
VAT_RATES = (0.0, 0.05, 0.14)


def _rate(value, allowed, label):
    """Accept 0.05 or 5 for 5%; refuse anything the law does not use."""
    r = float(value)
    if r >= 1:            # 1, 3, 5, 14 mean percent; no rate here is 100%
        r = r / 100
    r = round(r, 4)
    if r not in allowed:
        pct = "، ".join(f"{a*100:g}%" for a in allowed)
        raise HTTPException(400, f"نسبة {label} غير صحيحة — المسموح: {pct}")
    return r


def _wht_rate(data: dict, default_type: str) -> tuple:
    if data.get("withholding_tax_rate") not in (None, ""):
        r = _rate(data["withholding_tax_rate"], tuple(WHT_RATES.values()), "الخصم والتحصيل")
        kind = next(k for k, v in WHT_RATES.items() if v == r)
        return r, kind
    kind = data.get("wht_type") or default_type
    if kind not in WHT_RATES:
        raise HTTPException(400, "wht_type: none | contracts | services | professional")
    return WHT_RATES[kind], kind


async def _post_claim_entry(company_id: str, user_id: str, date: str, description: str,
                            spec: list, source_type: str, source_id: str) -> dict:
    """spec: [(codes, debit, credit, text, extra)] — codes is a tuple of
    acceptable account codes, first found wins. Every line must find its
    account and the entry must balance, or nothing is saved: the old code
    skipped any line whose account was missing (521, a code that does not
    exist) and saved unbalanced drafts."""
    from models.accounting import JournalEntry, JournalEntryLine
    from services.accounting_service import AccountingService
    svc = AccountingService(db)
    by_code = {a["account_code"]: a for a in await svc.get_all_accounts(company_id, True)}
    lines = []
    for codes, debit, credit, text, extra in spec:
        debit, credit = round(debit or 0, 2), round(credit or 0, 2)
        if not debit and not credit:
            continue
        acc = next((by_code[c] for c in codes if c in by_code), None)
        if not acc:
            raise HTTPException(400, f"الحساب {' أو '.join(codes)} غير موجود في دليل الحسابات — "
                                     "أضفه أو شغّل مزامنة الحسابات الافتراضية")
        lines.append(JournalEntryLine(account_id=acc["id"], account_code=acc["account_code"],
                                      account_name=acc["account_name"], debit=debit, credit=credit,
                                      description=text, **(extra or {})))
    dr = round(sum(l.debit for l in lines), 2)
    cr = round(sum(l.credit for l in lines), 2)
    if abs(dr - cr) > 0.01:
        raise HTTPException(400, f"القيد غير متوازن (مدين {dr} / دائن {cr}) — راجع الأرقام")
    entry = JournalEntry(company_id=company_id, entry_number=0, entry_date=date, description=description,
                         lines=lines, source_document_type=source_type, source_document_id=source_id,
                         created_by=user_id)
    je = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(je["id"], user_id)
    return {"id": je["id"], "debit": dr, "credit": cr}


@router.post("/progress-claims")
async def create_progress_claim(data: dict, current_user: dict = Depends(get_user)):
    """مستخلص للمالك (claim_type=owner) — المعيار المصري 8.

    من مذكورين:  العملاء (الصافي + VAT) | ضمان محتجز لدى العميل | خصم وتحصيل محتجز
                 | الدفعات المقدمة المستلمة (تُستهلك من المستخلص)
    إلى مذكورين: إيرادات المقاولات (قيمة المستخلص الحالي) | VAT مخرجات

    The advance deducted used to be CREDITED to 257, so the entry was out by
    twice the advance. Using the advance reduces what the customer paid in
    advance — a debit to 257.
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id", "system")
    data["company_id"] = company_id
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data.setdefault("claim_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    gross = float(data.get("gross_amount", 0) or 0)
    prev = float(data.get("previous_claims", 0) or 0)
    current = round(gross - prev, 2)
    if current <= 0:
        raise HTTPException(400, "قيمة المستخلص الحالي (الإجمالي − السابق) يجب أن تكون أكبر من صفر")
    ret_pct = float(data.get("retention_percentage", 10) or 0)
    ret_amt = round(current * ret_pct / 100, 2)
    adv_ded = round(float(data.get("advance_payment_deducted", 0) or 0), 2)
    vat_rate = _rate(data.get("vat_rate", 0.05), VAT_RATES, "ضريبة القيمة المضافة")
    wht_rate, wht_kind = _wht_rate(data, "contracts")
    vat_amt = round(current * vat_rate, 2)
    wht_amt = round(current * wht_rate, 2)
    net = round(current - ret_amt - adv_ded - wht_amt, 2)
    if net < 0:
        raise HTTPException(400, "المحتجزات والدفعة المقدمة والخصم أكبر من قيمة المستخلص")
    ar_amount = round(net + vat_amt, 2)

    data.update({"current_claim": current, "retention_amount": ret_amt, "vat_rate": vat_rate,
                 "vat_amount": vat_amt, "withholding_tax_rate": wht_rate, "wht_type": wht_kind,
                 "withholding_tax_amount": wht_amt, "net_payable": net, "ar_amount": ar_amount})

    je = None
    if data.get("claim_type", "owner") == "owner":
        data["claim_type"] = "owner"
        no, party = data.get("claim_number", ""), data.get("partner_name", "")
        proj = {"project_id": data.get("project_id")}
        je = await _post_claim_entry(company_id, user_id, data["claim_date"],
            f"مستخلص أعمال رقم {no} — {party} (المعيار المصري 8)", [
                (("131",), ar_amount, 0, f"مستخلص رقم {no} — صافي مستحق القبض",
                 {**proj, "partner_type": "customer", "partner_id": data.get("partner_id")}),
                (("141",), ret_amt, 0, f"ضمان حسن التنفيذ محتجز {ret_pct:g}%", proj),
                (("138",), wht_amt, 0, f"خصم وتحصيل {wht_rate*100:g}% محتجز لدى المالك", proj),
                (("257",), adv_ded, 0, "استهلاك دفعة مقدمة مستلمة من المالك", proj),
                (("414", "431", "412"), 0, current, f"إيراد مستخلص أعمال رقم {no} — {party}", proj),
                (("260",), 0, vat_amt, f"ضريبة القيمة المضافة {vat_rate*100:g}% على المستخلص", proj),
            ], "claim", data["id"])
        data["journal_entry_id"] = je["id"]

    await db.progress_claims.insert_one(data)
    data.pop("_id", None)
    return {"message": "Progress claim created", "claim": data,
            "journal_entry_id": je["id"] if je else None}


# ══════════════════════════════════════════════════════════════
# SUBCONTRACTOR CLAIMS — مستخلصات مقاولي الباطن (القيد ب)
# المعيار المصري 8 | قانون 91/2005 م.59
# ══════════════════════════════════════════════════════════════

@router.post("/subcontractor-claims")
async def create_subcontractor_claim(data: dict, current_user: dict = Depends(get_user)):
    """
    إثبات مستخلص مقاول الباطن

    من مذكورين:  تكلفة مقاولي الباطن 315 (قيمة المستخلص) | VAT مدخلات 137
    إلى مذكورين: مقاولو الباطن — دائنون 243/251 (الصافي + VAT)
                 | خصم وتحصيل مستحق للمصلحة 261 | ضمان محتجز لمقاولي الباطن 263
                 | دفعات مقدمة لمقاولي الباطن 1351 (استرداد)

    Fixed: the cost went to 521 (no such account, so the line was dropped),
    the amount owed to the subcontractor went to 212 — the PARTNERS' current
    account — retention to 259 (the martyrs' fund) and the advance recovery
    to 257 (advances received from customers).
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id", "system")
    data["company_id"] = company_id
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["claim_type"] = "subcontractor"
    data.setdefault("claim_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))

    gross = float(data.get("gross_amount", 0) or 0)
    prev_claims = float(data.get("previous_claims", 0) or 0)
    current_claim = round(gross - prev_claims, 2)
    if current_claim <= 0:
        raise HTTPException(400, "قيمة المستخلص الحالي (الإجمالي − السابق) يجب أن تكون أكبر من صفر")
    ret_pct = float(data.get("retention_percentage", 10) or 0)
    ret_amt = round(current_claim * ret_pct / 100, 2)
    adv_recovery = round(float(data.get("advance_recovery", 0) or 0), 2)
    vat_rate = _rate(data.get("vat_rate", 0.05), VAT_RATES, "ضريبة القيمة المضافة")
    vat_amt = round(current_claim * vat_rate, 2)
    wht_rate, wht_type = _wht_rate(data, "contracts")
    wht_amt = round(current_claim * wht_rate, 2)
    net_payable = round(current_claim - ret_amt - adv_recovery - wht_amt, 2)
    if net_payable < 0:
        raise HTTPException(400, "المحتجزات والدفعة المقدمة والخصم أكبر من قيمة المستخلص")
    sub_ap = round(net_payable + vat_amt, 2)

    data.update({"current_claim": current_claim, "retention_amount": ret_amt, "vat_rate": vat_rate,
                 "vat_amount": vat_amt, "withholding_tax_amount": wht_amt, "withholding_tax_rate": wht_rate,
                 "wht_type": wht_type, "advance_recovery": adv_recovery, "net_payable": net_payable,
                 "ar_amount": sub_ap})

    no, party = data.get("claim_number", ""), data.get("partner_name", "")
    proj = {"project_id": data.get("project_id")}
    je = await _post_claim_entry(company_id, user_id, data["claim_date"],
        f"مستخلص مقاول الباطن رقم {no} — {party} (المعيار المصري 8)", [
            (("315",), current_claim, 0, f"تكلفة مستخلص مقاول الباطن رقم {no} — {party}",
             {**proj, "partner_type": "vendor", "partner_id": data.get("partner_id")}),
            (("137",), vat_amt, 0, f"ضريبة مدخلات {vat_rate*100:g}% على مستخلص مقاول الباطن", proj),
            (("243", "251"), 0, sub_ap, f"مستحق لمقاول الباطن {party} (الصافي + الضريبة)",
             {**proj, "partner_type": "vendor", "partner_id": data.get("partner_id")}),
            (("261",), 0, wht_amt, f"خصم وتحصيل {wht_rate*100:g}% مستحق لمصلحة الضرائب", proj),
            (("263",), 0, ret_amt, f"ضمان حسن التنفيذ محتجز {ret_pct:g}% من مقاول الباطن", proj),
            (("1351", "135"), 0, adv_recovery, "استرداد دفعة مقدمة لمقاول الباطن", proj),
        ], "subcontractor_claim", data["id"])
    data["journal_entry_id"] = je["id"]
    data["je_balanced"] = True

    await db.progress_claims.insert_one(data)
    data.pop("_id", None)
    return {
        "message": "تم إثبات مستخلص مقاول الباطن بنجاح",
        "claim": data,
        "journal_summary": {
            "debit_cost": current_claim, "debit_vat_input": vat_amt,
            "credit_payable": sub_ap, "credit_wht": wht_amt, "credit_retention": ret_amt,
            "credit_adv_recovery": adv_recovery, "balanced": True,
            "wht_type": wht_type, "wht_rate_pct": round(wht_rate * 100, 1),
        },
    }


@router.get("/subcontractor-claims/{project_id}")
async def get_subcontractor_claims(project_id: str, current_user: dict = Depends(get_user)):
    """Get all subcontractor claims for a project"""
    claims = await db.progress_claims.find(
        {"project_id": project_id, "company_id": current_user.get("company_id"),
         "claim_type": "subcontractor"},
        {"_id": 0}
    ).sort("claim_number", 1).to_list(length=200)
    
    total_cost     = sum(c.get("current_claim", 0) for c in claims)
    total_vat_in   = sum(c.get("vat_amount", 0) for c in claims)
    total_wht      = sum(c.get("withholding_tax_amount", 0) for c in claims)
    total_retention= sum(c.get("retention_amount", 0) for c in claims)
    total_net      = sum(c.get("net_payable", 0) for c in claims)
    
    return {
        "claims": claims,
        "summary": {
            "count": len(claims),
            "total_cost": round(total_cost, 2),
            "total_vat_input": round(total_vat_in, 2),
            "total_wht_deducted": round(total_wht, 2),
            "total_retention_held": round(total_retention, 2),
            "total_net_payable": round(total_net, 2),
        }
    }

# ════════════════════════════════════════════════════════════════
# BOQ — بنود المقايسة (Bill of Quantities)
# project_boq table: CRUD + executed qty update
# ════════════════════════════════════════════════════════════════

@router.post("/boq")
async def create_boq_item(data: dict, current_user: dict = Depends(get_user)):
    """إضافة بند مقايسة جديد لمشروع"""
    from models.enterprise_accounting import BOQItem
    company_id = current_user.get("company_id")
    if not data.get("project_id"):
        raise HTTPException(status_code=400, detail="project_id مطلوب")
    item = BOQItem(**{**data, "company_id": company_id})
    item.planned_amount = round(item.planned_qty * item.unit_price, 2)
    d = item.dict(); d.pop("_id", None)
    await db.project_boq.insert_one(d)
    return {"message": "تم إضافة بند المقايسة", "item": d}


@router.get("/boq/{project_id}")
async def get_boq(
    project_id: str,
    page: int = 1, limit: int = 50,
    current_user: dict = Depends(get_user)
):
    """قائمة بنود المقايسة لمشروع مع إجماليات"""
    company_id = current_user.get("company_id")
    q = {"project_id": project_id, "company_id": company_id}
    total = await db.project_boq.count_documents(q)
    items = await db.project_boq.find(q, {"_id": 0}).sort(
        "item_number", 1
    ).skip((page-1)*limit).limit(limit).to_list(None)
    
    total_planned   = sum(i.get("planned_amount",   0) for i in items)
    total_executed  = sum(i.get("executed_amount",  0) for i in items)
    completion_pct  = round(total_executed / total_planned * 100, 1) if total_planned else 0
    
    return {
        "items": items, "total": total, "page": page, "limit": limit,
        "summary": {
            "total_planned_amount":  round(total_planned,  2),
            "total_executed_amount": round(total_executed, 2),
            "completion_percentage": completion_pct,
            "remaining_amount": round(total_planned - total_executed, 2),
        }
    }


@router.put("/boq/{boq_item_id}")
async def update_boq_item(boq_item_id: str, data: dict, current_user: dict = Depends(get_user)):
    """تعديل بند مقايسة — سعر أو كمية"""
    if not await db.project_boq.find_one({"id": boq_item_id, "company_id": current_user.get("company_id")}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="BOQ item not found")
    from datetime import datetime, timezone
    if "unit_price" in data or "planned_qty" in data:
        item = await db.project_boq.find_one({"id": boq_item_id}, {"_id": 0})
        if item:
            up  = data.get("unit_price",  item.get("unit_price",  0))
            qty = data.get("planned_qty", item.get("planned_qty", 0))
            data["planned_amount"] = round(up * qty, 2)
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.project_boq.update_one({"id": boq_item_id}, {"$set": data})
    return {"message": "تم تعديل بند المقايسة"}


@router.put("/boq/{boq_item_id}/executed-qty")
async def update_executed_qty(
    boq_item_id: str,
    data: dict,
    current_user: dict = Depends(get_user)
):
    """تحديث الكمية المنفذة لبند المقايسة عند إعداد المستخلص"""
    if not await db.project_boq.find_one({"id": boq_item_id, "company_id": current_user.get("company_id")}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="BOQ item not found")
    item = await db.project_boq.find_one({"id": boq_item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="البند غير موجود")
    new_exec_qty = float(data.get("executed_qty", 0))
    if new_exec_qty < 0:
        raise HTTPException(status_code=400, detail="الكمية المنفذة لا يمكن أن تكون سالبة")
    planned = float(item.get("planned_qty", 0))
    if new_exec_qty > planned * 1.1:  # allow 10% tolerance
        raise HTTPException(status_code=400,
            detail=f"الكمية المنفذة ({new_exec_qty}) تتجاوز المخططة ({planned}) بأكثر من 10%")
    exec_amount = round(new_exec_qty * float(item.get("unit_price", 0)), 2)
    from datetime import datetime, timezone
    await db.project_boq.update_one(
        {"id": boq_item_id},
        {"$set": {
            "executed_qty":    new_exec_qty,
            "executed_amount": exec_amount,
            "updated_at":      datetime.now(timezone.utc).isoformat()
        }}
    )
    return {
        "message": "تم تحديث الكمية المنفذة",
        "executed_qty": new_exec_qty,
        "executed_amount": exec_amount,
        "completion_pct": round(new_exec_qty / planned * 100, 1) if planned else 0
    }


@router.delete("/boq/{boq_item_id}")
async def delete_boq_item(boq_item_id: str, current_user: dict = Depends(get_user)):
    """حذف بند مقايسة (قبل البدء في التنفيذ فقط)"""
    if not await db.project_boq.find_one({"id": boq_item_id, "company_id": current_user.get("company_id")}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="BOQ item not found")
    item = await db.project_boq.find_one({"id": boq_item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="البند غير موجود")
    if float(item.get("executed_qty", 0)) > 0:
        raise HTTPException(status_code=400,
            detail="لا يمكن حذف بند تم تنفيذ جزء منه")
    await db.project_boq.delete_one({"id": boq_item_id})
    return {"message": "تم حذف البند"}


# ════════════════════════════════════════════════════════════════
# PROGRESS CLAIMS STATUS WORKFLOW
# draft → submitted → approved → paid
# ════════════════════════════════════════════════════════════════

@router.put("/progress-claims/{claim_id}/status")
async def update_claim_status(
    claim_id: str,
    data: dict,
    current_user: dict = Depends(get_user)
):
    """تحديث حالة المستخلص: draft → submitted → approved → paid"""
    VALID_TRANSITIONS = {
        "draft":     ["submitted"],
        "submitted": ["approved", "draft"],  # can return to draft for correction
        "approved":  ["paid"],
        "paid":      [],  # terminal state
    }
    claim = await db.progress_claims.find_one(
        {"id": claim_id, "company_id": current_user.get("company_id")}, {"_id": 0}
    )
    if not claim:
        raise HTTPException(status_code=404, detail="المستخلص غير موجود")
    
    current_status = claim.get("status", "draft")
    new_status     = data.get("status")
    
    if new_status not in VALID_TRANSITIONS.get(current_status, []):
        raise HTTPException(status_code=400,
            detail=f"لا يمكن الانتقال من '{current_status}' إلى '{new_status}'")
    
    from datetime import datetime, timezone
    update = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if new_status == "submitted":
        update["submitted_by"] = current_user["user_id"]
        update["submitted_at"] = datetime.now(timezone.utc).isoformat()
    elif new_status == "approved":
        update["approved_by"] = current_user["user_id"]
        update["approved_at"] = datetime.now(timezone.utc).isoformat()
    elif new_status == "paid":
        update["paid_by"] = current_user["user_id"]
        update["paid_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.progress_claims.update_one({"id": claim_id}, {"$set": update})
    
    # Update BOQ executed quantities when claim is approved
    if new_status == "approved":
        for boq_exec in claim.get("boq_items_executed", []):
            boq_id   = boq_exec.get("boq_item_id")
            exec_qty = float(boq_exec.get("executed_qty", 0))
            if boq_id and exec_qty > 0:
                item = await db.project_boq.find_one({"id": boq_id}, {"_id": 0})
                if item:
                    new_qty    = float(item.get("executed_qty", 0)) + exec_qty
                    exec_amount = round(new_qty * float(item.get("unit_price", 0)), 2)
                    await db.project_boq.update_one(
                        {"id": boq_id},
                        {"$set": {"executed_qty": new_qty, "executed_amount": exec_amount}}
                    )
    
    return {"message": f"تم تحديث حالة المستخلص إلى '{new_status}'", "status": new_status}


@router.get("/progress-claims-list")
async def list_progress_claims(
    project_id: str = None,
    claim_type: str = None,
    status: str = None,
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_user)
):
    """قائمة المستخلصات مع pagination وفلترة"""
    q = {"company_id": current_user.get("company_id")}
    if project_id: q["project_id"] = project_id
    if claim_type: q["claim_type"]  = claim_type
    if status:     q["status"]      = status
    total  = await db.progress_claims.count_documents(q)
    claims = await db.progress_claims.find(q, {"_id": 0}).sort(
        "claim_date", -1
    ).skip((page-1)*limit).limit(limit).to_list(None)
    
    total_gross    = sum(c.get("gross_amount",  0) for c in claims)
    total_vat      = sum(c.get("vat_amount",    0) for c in claims)
    total_ret      = sum(c.get("retention_amount",        0) for c in claims)
    total_wht      = sum(c.get("withholding_tax_amount",  0) for c in claims)
    total_net      = sum(c.get("net_payable",   0) for c in claims)
    
    return {
        "claims": claims, "total": total, "page": page, "limit": limit,
        "summary": {
            "total_gross":     round(total_gross, 2),
            "total_vat":       round(total_vat,   2),
            "total_retention": round(total_ret,   2),
            "total_wht":       round(total_wht,   2),
            "total_net":       round(total_net,   2),
        }
    }


# ════════════════════════════════════════════════════════════════
# MEDICAL SERVICES — القطاع الطبي والمستشفيات
# القيد أ: تقديم خدمة طبية (نقدي + تأمين)
# القيد ب: سداد أتعاب الأطباء
# ════════════════════════════════════════════════════════════════

SERVICE_REVENUE_ACCOUNTS = {
    "inpatient":    ("415", "إيرادات إقامة — المرضى الداخليين"),
    "outpatient":   ("416", "إيرادات عيادات خارجية"),
    "surgery":      ("417", "إيرادات غرف العمليات والجراحة"),
    "lab":          ("418", "إيرادات مختبر وتحاليل"),
    "radiology":    ("419", "إيرادات أشعة وتصوير"),
    "pharmacy":     ("420", "إيرادات صيدلية"),
    "other":        ("415", "إيرادات خدمات طبية أخرى"),
}

@router.post("/medical-services")
async def create_medical_service(data: dict, current_user: dict = Depends(get_user)):
    """
    القيد أ — تقديم الخدمة الطبية (نقدي وتأمين طبي)
    
    من مذكورين:
       حـ/ الخزينة / البنك          (الدفعة النقدية من المريض)
       حـ/ مدينو شركات التأمين       (الحصة المغطاة تأمينياً)
    إلى مذكورين:
       حـ/ إيرادات الخدمات الطبية   (حصة المستشفى — بحسب نوع الخدمة)
       حـ/ أمانات أطباء استشاريين   (إجمالي حصة الأطباء — قبل خصم الضريبة)
    
    ملاحظة: ضريبة الخصم 5% تُحجز عند سداد الأتعاب (القيد ب) وليس هنا
    """
    company_id = current_user.get("company_id")
    data["company_id"] = company_id
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()

    # ── المبالغ الأساسية ──────────────────────────────
    total_amount = float(data.get("total_amount", 0))
    copay        = float(data.get("patient_copay", 0))        # دفعة المريض النقدية
    ins_amt      = float(data.get("insurance_claim_amount", 0)) # تغطية التأمين
    hosp_share   = float(data.get("hospital_share", 0))       # حصة المستشفى
    
    # متعدد الأطباء — يقبل قائمة [{doctor_id, doctor_name, share, wht_rate}]
    doctors = data.get("doctors", [])
    if not doctors and data.get("doctor_share", 0):
        # backward-compat: single doctor
        wht_rate_single = float(data.get("doctor_wht_rate", 0.05))
        doctors = [{
            "doctor_id":   data.get("doctor_id", ""),
            "doctor_name": data.get("doctor_name", ""),
            "share":       float(data.get("doctor_share", 0)),
            "wht_rate":    wht_rate_single,  # 5% أتعاب / 10% غير مقيم
        }]
    
    total_doc_share = sum(float(d.get("share", 0)) for d in doctors)
    
    # تخزين بيانات الأطباء المحسوبة
    doctors_computed = []
    for doc in doctors:
        share    = float(doc.get("share", 0))
        wht_rate = float(doc.get("wht_rate", 0.05))
        wht_amt  = round(share * wht_rate, 2)
        net_pay  = round(share - wht_amt, 2)
        doctors_computed.append({**doc,
            "wht_amount": wht_amt,
            "net_payment": net_pay,
            "status": "pending"  # لم يُسدَّد بعد
        })
    
    data["doctors"] = doctors_computed
    data["total_doctor_share"] = round(total_doc_share, 2)
    
    await db.medical_services.insert_one(data)
    data.pop("_id", None)
    
    # ── القيد المحاسبي (أ) ──────────────────────────────────────
    from services.accounting_service import AccountingService
    svc      = AccountingService(db)
    accounts = await svc.get_all_accounts(company_id, True)
    by_code  = {a["account_code"]: a for a in accounts}
    
    def acct(code, name_default):
        a = by_code.get(code, {})
        return a.get("id"), code, a.get("account_name", name_default)
    
    svc_type     = data.get("service_type", "other")
    rev_code, rev_name_default = SERVICE_REVENUE_ACCOUNTS.get(svc_type, SERVICE_REVENUE_ACCOUNTS["other"])
    
    cash_id,   cash_code,   cash_name    = acct("161", "الخزينة / الصندوق النقدي")
    bank_id,   bank_code,   bank_name    = acct("162", "البنك")
    ins_id,    ins_code,    ins_name     = acct("134", "مدينو شركات التأمين الطبي")
    rev_id,    rev_code2,   rev_name     = acct(rev_code, rev_name_default)
    trust_id,  trust_code,  trust_name   = acct("264", "أمانات أطباء استشاريين")
    
    payment_method = data.get("payment_method", "cash")  # cash | bank | insurance
    
    lines_je = []
    
    # ── مدين ─────────────────────────────────────────────────────
    # مدين 1: الخزينة / البنك (دفعة المريض النقدية أو المباشرة)
    if copay > 0:
        if payment_method == "bank" and bank_id:
            lines_je.append({"account_id": bank_id, "account_code": bank_code,
                "account_name": bank_name, "debit": copay, "credit": 0,
                "description": f"دفعة المريض {data.get('patient_name','')} عبر البنك",
                "partner_type": "patient", "partner_id": data.get("patient_id")})
        elif cash_id:
            lines_je.append({"account_id": cash_id, "account_code": cash_code,
                "account_name": cash_name, "debit": copay, "credit": 0,
                "description": f"دفعة المريض {data.get('patient_name','')} نقداً",
                "partner_type": "patient", "partner_id": data.get("patient_id")})
    
    # مدين 2: مدينو شركات التأمين الطبي (الحصة المغطاة)
    if ins_amt > 0 and ins_id:
        lines_je.append({"account_id": ins_id, "account_code": ins_code,
            "account_name": ins_name, "debit": ins_amt, "credit": 0,
            "description": f"مطالبة تأمين — {data.get('insurance_company_name','')}",
            "partner_type": "insurance", "partner_id": data.get("insurance_company_id")})
    
    # ── دائن ─────────────────────────────────────────────────────
    # دائن 1: إيرادات الخدمات الطبية (حصة المستشفى)
    if hosp_share > 0 and rev_id:
        lines_je.append({"account_id": rev_id, "account_code": rev_code2,
            "account_name": rev_name, "debit": 0, "credit": hosp_share,
            "description": f"إيراد خدمة {data.get('service_description','')} — حصة المستشفى"})
    
    # دائن 2: أمانات أطباء استشاريين (إجمالي حصة الأطباء — GROSS, before WHT)
    # ⚠️ WHT لا يُحجز هنا — يُحجز عند سداد الأتعاب (القيد ب)
    if total_doc_share > 0 and trust_id:
        doc_names = ", ".join(d.get("doctor_name","") for d in doctors_computed)
        lines_je.append({"account_id": trust_id, "account_code": trust_code,
            "account_name": trust_name, "debit": 0, "credit": total_doc_share,
            "description": f"أتعاب أطباء مستحقة — {doc_names} (إجمالي قبل الضريبة)"})
    
    # ── التحقق من التوازن ──────────────────────────────────────
    total_d = round(sum(l["debit"]  for l in lines_je), 2)
    total_c = round(sum(l["credit"] for l in lines_je), 2)
    diff    = abs(total_d - total_c)
    
    if lines_je:
        je = {
            "id": str(uuid.uuid4()), "company_id": company_id,
            "entry_date": data.get("service_date", datetime.now().strftime("%Y-%m-%d")),
            "entry_number": 0,
            "description": f"خدمة طبية — {data.get('service_description','')} — مريض: {data.get('patient_name','')}",
            "lines": lines_je,
            "total_debit": total_d, "total_credit": total_c,
            "status": "draft",
            "source_document_type": "medical_service",
            "source_document_id": data["id"],
            "created_by": current_user.get("user_id", "system"),
        }
        await db.journal_entries.insert_one(je)
        await db.medical_services.update_one(
            {"id": data["id"]},
            {"$set": {"journal_entry_id": je["id"], "je_balanced": diff <= 0.01}}
        )
    
    # ── Validate totals match (patient_copay + insurance = hospital + doctors) ──
    debit_total  = round(copay + ins_amt, 2)
    credit_total = round(hosp_share + total_doc_share, 2)
    totals_match = abs(debit_total - credit_total) <= 0.01
    if not totals_match:
        import logging
        logging.warning(
            f"Medical service financial mismatch: "
            f"Dr(copay+ins)={debit_total} ≠ Cr(hosp+doc)={credit_total}"
        )
    
    return {
        "message": "تم تسجيل الخدمة الطبية بنجاح",
        "service": data,
        "financial_summary": {
            "total_amount":      round(copay + ins_amt, 2),
            "hospital_share":    hosp_share,
            "total_doctor_share": total_doc_share,
            "doctors_count":     len(doctors_computed),
            "patient_copay":     copay,
            "insurance_amount":  ins_amt,
            "totals_match":      totals_match,
        },
        "journal_summary": {
            "debit_cash_or_bank":     copay if payment_method != "insurance" else 0,
            "debit_insurance_ar":     ins_amt,
            "credit_hospital_revenue": hosp_share,
            "credit_doctor_trust":    total_doc_share,
            "je_balanced":            diff <= 0.01,
            "note": "ضريبة الخصم 5% تُحجز عند سداد الأتعاب — استخدم POST /doctor-payment"
        }
    }


@router.get("/medical-services")
async def get_medical_services(
    patient_id: str = None,
    insurance_company_id: str = None,
    service_type: str = None,
    date_from: str = None,
    date_to: str = None,
    page: int = 1,
    limit: int = 25,
    current_user: dict = Depends(get_user)
):
    """قائمة الخدمات الطبية مع pagination"""
    q = {"company_id": current_user.get("company_id")}
    if patient_id:         q["patient_id"]          = patient_id
    if insurance_company_id: q["insurance_company_id"] = insurance_company_id
    if service_type:       q["service_type"]         = service_type
    if date_from:          q.setdefault("service_date", {})["$gte"] = date_from
    if date_to:            q.setdefault("service_date", {})["$lte"] = date_to
    
    total    = await db.medical_services.count_documents(q)
    services = await db.medical_services.find(q, {"_id": 0}).sort(
        "service_date", -1
    ).skip((page-1)*limit).limit(limit).to_list(length=None)
    
    return {"services": services, "total": total, "page": page, "limit": limit}


@router.get("/medical-services/pending-doctors")
async def get_pending_doctor_payments(
    doctor_id: str = None,
    current_user: dict = Depends(get_user)
):
    """قائمة الأطباء الذين لم تُسدَّد أتعابهم بعد"""
    q = {"company_id": current_user.get("company_id")}
    if doctor_id:
        q["$or"] = [{"doctor_id": doctor_id},
                    {"doctors.doctor_id": doctor_id}]
    else:
        q["$or"] = [
            {"doctors.status": "pending"},
            {"status": {"$in": ["pending","billed"]}, "doctor_net_payment": {"$gt": 0}}
        ]
    
    services = await db.medical_services.find(q, {"_id": 0}).sort("service_date", -1).to_list(200)
    
    pending_by_doctor = {}
    for svc in services:
        for doc in (svc.get("doctors") or []):
            if doc.get("status") == "pending":
                did = doc.get("doctor_id", "unknown")
                if did not in pending_by_doctor:
                    pending_by_doctor[did] = {"doctor_id": did, "doctor_name": doc.get("doctor_name",""),
                                               "total_pending": 0, "services": []}
                share = float(doc.get("share", 0))
                wht   = round(share * float(doc.get("wht_rate", 0.05)), 2)
                pending_by_doctor[did]["total_pending"] += (share - wht)
                pending_by_doctor[did]["services"].append({
                    "service_id": svc["id"],
                    "service_date": svc.get("service_date"),
                    "gross": share, "wht": wht, "net": share - wht
                })
    
    return {
        "pending_doctors": list(pending_by_doctor.values()),
        "total_doctors": len(pending_by_doctor),
        "total_amount": round(sum(d["total_pending"] for d in pending_by_doctor.values()), 2)
    }


@router.get("/medical-services/{service_id}")
async def get_medical_service(service_id: str, current_user: dict = Depends(get_user)):
    svc = await db.medical_services.find_one(
        {"id": service_id, "company_id": current_user.get("company_id")}, {"_id": 0}
    )
    if not svc:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")
    return svc


@router.post("/doctor-payment")
async def pay_doctor(data: dict, current_user: dict = Depends(get_user)):
    """
    القيد ب — سداد أتعاب الأطباء الخارجيين / الاستشاريين
    
    من حـ/ أمانات أطباء استشاريين (264)
       إلى حـ/ مصلحة الضرائب — خصم وتحصيل (261)  [5% أو 10% حسب الإقامة]
       إلى حـ/ البنك / الخزينة                      [صافي المسدد للطبيب]
    
    يمكن سداد طبيب واحد أو عدة أطباء من خدمة واحدة أو متعددة
    """
    company_id = current_user.get("company_id")
    
    # تحديد مصدر الدفع
    service_id  = data.get("service_id")
    doctor_id   = data.get("doctor_id")
    doctor_name = data.get("doctor_name", "")
    gross_amt   = float(data.get("gross_amount", 0))  # إجمالي أتعاب الطبيب
    
    # نوع الطبيب يحدد نسبة الخصم
    # قانون 91/2005 م.59: 5% استشاري مقيم | 10% غير مقيم
    doctor_type = data.get("doctor_type", "resident")  # resident | non_resident
    wht_rate    = 0.10 if doctor_type == "non_resident" else float(data.get("wht_rate", 0.05))
    wht_amt     = round(gross_amt * wht_rate, 2)
    net_pay     = round(gross_amt - wht_amt, 2)
    payment_method = data.get("payment_method", "bank")  # bank | cash
    
    # تسجيل الدفعة
    payment_record = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "service_id":   service_id,
        "doctor_id":    doctor_id, "doctor_name": doctor_name,
        "gross_amount": gross_amt, "wht_rate":    wht_rate,
        "wht_amount":   wht_amt,   "net_payment": net_pay,
        "doctor_type":  doctor_type,
        "payment_method": payment_method,
        "payment_date": data.get("payment_date", datetime.now().strftime("%Y-%m-%d")),
        "created_at":   datetime.now(timezone.utc).isoformat(),
        "created_by":   current_user.get("user_id", "system"),
    }
    await db.doctor_payments.insert_one(payment_record)
    payment_record.pop("_id", None)
    
    # تحديث حالة الطبيب في الخدمة الأصلية
    if service_id and doctor_id:
        svc = await db.medical_services.find_one(
            {"id": service_id, "company_id": company_id}, {"_id": 0}
        )
        if svc:
            docs = svc.get("doctors", [])
            for doc in docs:
                if doc.get("doctor_id") == doctor_id:
                    doc["status"]       = "paid"
                    doc["paid_at"]      = payment_record["payment_date"]
                    doc["wht_deducted"] = wht_amt
            await db.medical_services.update_one(
                {"id": service_id}, {"$set": {"doctors": docs}}
            )
    
    # ── القيد المحاسبي (ب) ──────────────────────────────────────
    from services.accounting_service import AccountingService
    svc_acc  = AccountingService(db)
    accounts = await svc_acc.get_all_accounts(company_id, True)
    by_code  = {a["account_code"]: a for a in accounts}
    
    def acct(code, name_default):
        a = by_code.get(code, {})
        return a.get("id"), code, a.get("account_name", name_default)
    
    trust_id,  trust_code,  trust_name   = acct("264", "أمانات أطباء استشاريين")
    wht_id,    wht_code,    wht_name     = acct("261", "مصلحة الضرائب — خصم وتحصيل")
    bank_id,   bank_code,   bank_name    = acct("162", "البنك")
    cash_id,   cash_code,   cash_name    = acct("161", "الخزينة / الصندوق النقدي")
    
    lines_je = []
    
    # مدين: أمانات أطباء استشاريين (إقفال الأمانة)
    if trust_id and gross_amt > 0:
        lines_je.append({
            "account_id": trust_id, "account_code": trust_code, "account_name": trust_name,
            "debit": gross_amt, "credit": 0,
            "description": f"إقفال أمانة د. {doctor_name} — سداد الأتعاب",
            "partner_type": "doctor", "partner_id": doctor_id
        })
    
    # دائن 1: مصلحة الضرائب — ضريبة خصم مهن حرة
    if wht_id and wht_amt > 0:
        wht_label = "غير مقيم 10%" if doctor_type == "non_resident" else "مقيم 5%"
        lines_je.append({
            "account_id": wht_id, "account_code": wht_code, "account_name": wht_name,
            "debit": 0, "credit": wht_amt,
            "description": f"ضريبة خصم مهن حرة {wht_label} — د. {doctor_name}"
        })
    
    # دائن 2: البنك / الخزينة (الصافي المسدد للطبيب)
    if net_pay > 0:
        if payment_method == "cash" and cash_id:
            lines_je.append({
                "account_id": cash_id, "account_code": cash_code, "account_name": cash_name,
                "debit": 0, "credit": net_pay,
                "description": f"صافي أتعاب د. {doctor_name} — نقداً"
            })
        elif bank_id:
            lines_je.append({
                "account_id": bank_id, "account_code": bank_code, "account_name": bank_name,
                "debit": 0, "credit": net_pay,
                "description": f"صافي أتعاب د. {doctor_name} — تحويل بنكي"
            })
    
    # ── التحقق من التوازن ──────────────────────────────────────
    total_d = round(sum(l["debit"]  for l in lines_je), 2)
    total_c = round(sum(l["credit"] for l in lines_je), 2)
    diff    = abs(total_d - total_c)
    
    if lines_je:
        je = {
            "id": str(uuid.uuid4()), "company_id": company_id,
            "entry_date": payment_record["payment_date"],
            "entry_number": 0,
            "description": f"سداد أتعاب د. {doctor_name} — ضريبة {round(wht_rate*100)}%",
            "lines": lines_je,
            "total_debit": total_d, "total_credit": total_c,
            "status": "draft",
            "source_document_type": "doctor_payment",
            "source_document_id": payment_record["id"],
            "created_by": current_user.get("user_id", "system"),
        }
        await db.journal_entries.insert_one(je)
        await db.doctor_payments.update_one(
            {"id": payment_record["id"]},
            {"$set": {"journal_entry_id": je["id"], "je_balanced": diff <= 0.01}}
        )
    
    return {
        "message": f"تم سداد أتعاب د. {doctor_name} بنجاح",
        "payment": payment_record,
        "journal_summary": {
            "debit_trust_closed": gross_amt,
            "credit_wht_payable": wht_amt,
            "credit_bank_or_cash": net_pay,
            "wht_rate_pct": round(wht_rate * 100, 1),
            "doctor_type": doctor_type,
            "balanced": diff <= 0.01
        }
    }


@router.put("/medical-services/{service_id}/status")
async def update_medical_service_status(
    service_id: str,
    data: dict,
    current_user: dict = Depends(get_user)
):
    """تحديث حالة الخدمة الطبية: pending → billed → paid → cancelled"""
    VALID_TRANSITIONS = {
        "pending":   ["billed", "cancelled"],
        "billed":    ["paid", "pending"],
        "paid":      [],
        "cancelled": [],
    }
    svc = await db.medical_services.find_one(
        {"id": service_id, "company_id": current_user.get("company_id")}, {"_id": 0}
    )
    if not svc:
        raise HTTPException(status_code=404, detail="الخدمة غير موجودة")
    current_status = svc.get("status", "pending")
    new_status = data.get("status")
    if new_status not in VALID_TRANSITIONS.get(current_status, []):
        raise HTTPException(status_code=400,
            detail=f"لا يمكن الانتقال من '{current_status}' إلى '{new_status}'")
    from datetime import datetime, timezone
    await db.medical_services.update_one(
        {"id": service_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"تم تحديث حالة الخدمة إلى '{new_status}'"}


@router.get("/doctor-payments")
async def get_doctor_payments(
    doctor_id: str = None,
    service_id: str = None,
    status: str = None,
    page: int = 1,
    limit: int = 25,
    current_user: dict = Depends(get_user)
):
    """سجل مدفوعات الأطباء"""
    q = {"company_id": current_user.get("company_id")}
    if doctor_id:  q["doctor_id"]  = doctor_id
    if service_id: q["service_id"] = service_id
    
    total    = await db.doctor_payments.count_documents(q)
    payments = await db.doctor_payments.find(q, {"_id": 0}).sort(
        "payment_date", -1
    ).skip((page-1)*limit).limit(limit).to_list(length=None)
    
    return {"payments": payments, "total": total, "page": page, "limit": limit}


# ══════════════════════════════════════════
# CURRENCIES
# ══════════════════════════════════════════
@router.get("/currencies")
async def get_currencies(current_user: dict = Depends(get_user)):
    currencies = await db.currencies.find({}, {"_id": 0}).to_list(length=50)
    if not currencies:
        for c in DEFAULT_CURRENCIES:
            await db.currencies.insert_one(c.dict())
        currencies = [c.dict() for c in DEFAULT_CURRENCIES]
    return {"currencies": currencies}

@router.post("/exchange-rates")
async def add_exchange_rate(data: dict, current_user: dict = Depends(get_user)):
    data["company_id"] = current_user.get("company_id")
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.exchange_rates.insert_one(data)
    data.pop("_id", None)
    return data

@router.get("/exchange-rates")
async def get_exchange_rates(current_user: dict = Depends(get_user)):
    rates = await db.exchange_rates.find(
        {"company_id": current_user.get("company_id")},
        {"_id": 0}
    ).sort("rate_date", -1).limit(50).to_list(length=50)
    return {"rates": rates}


# ══════════════════════════════════════════
# IMMUTABILITY REPORT
# ══════════════════════════════════════════
@router.get("/audit/immutability-check")
async def check_immutability(current_user: dict = Depends(get_user)):
    """تقرير سلامة دفتر الأستاذ — فحص القيود غير المتوازنة"""
    company_id = current_user.get("company_id")
    entries = await db.journal_entries.find(
        {"company_id": company_id, "status": "posted"},
        {"_id": 0, "id": 1, "entry_number": 1, "total_debit": 1, "total_credit": 1, "entry_date": 1}
    ).to_list(length=10000)

    issues = []
    for e in entries:
        diff = abs(float(e.get("total_debit",0)) - float(e.get("total_credit",0)))
        if diff > 0.01:
            issues.append({
                "entry_id": e["id"],
                "entry_number": e.get("entry_number"),
                "date": e.get("entry_date"),
                "debit": e.get("total_debit"),
                "credit": e.get("total_credit"),
                "difference": round(diff, 4),
            })

    return {
        "total_posted": len(entries),
        "balanced": len(entries) - len(issues),
        "unbalanced": len(issues),
        "issues": issues,
        "integrity": "✅ سليم" if not issues else f"⚠️ {len(issues)} قيد غير متوازن"
    }
