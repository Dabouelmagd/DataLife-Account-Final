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
    company_id = current_user.get("company_id")
    # `**data` straight from the body: a body with company_id raised TypeError
    # (500), and id/created_at/is_active could be forced by the caller. Take
    # only the editable fields. center_type "branch" marks a branch (فرع).
    allowed = {"code", "name_ar", "name_en", "parent_id", "center_type", "budget", "manager_id"}
    clean = {k: v for k, v in (data or {}).items() if k in allowed}
    if not str(clean.get("code") or "").strip() or not str(clean.get("name_ar") or "").strip():
        raise HTTPException(400, "رمز المركز واسمه مطلوبان")
    clean["code"] = str(clean["code"]).strip()
    # a duplicate code made two branches indistinguishable in every report
    if await db.cost_centers.find_one({"company_id": company_id, "code": clean["code"],
                                       "is_active": True}, {"_id": 1}):
        raise HTTPException(400, f"يوجد مركز تكلفة بالرمز {clean['code']}")
    if clean.get("parent_id") and not await db.cost_centers.find_one(
            {"company_id": company_id, "id": clean["parent_id"]}, {"_id": 1}):
        raise HTTPException(400, "المركز الأب غير موجود")
    try:
        center = CostCenter(company_id=company_id, **clean)
    except Exception:
        raise HTTPException(400, "بيانات مركز التكلفة غير صحيحة")
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

# Revenue account per service type. 416 used to be the outpatient account, but
# in this chart 416 is "engineering & professional consulting revenue" — clinic
# income landed in an engineering account. Outpatient now goes to 415.
SERVICE_REVENUE_ACCOUNTS = {
    "inpatient":    ("415", "إيرادات الخدمات الطبية"),
    "outpatient":   ("415", "إيرادات الخدمات الطبية"),
    "surgery":      ("417", "إيرادات غرف العمليات والجراحة"),
    "lab":          ("418", "إيرادات المختبر والتحاليل"),
    "radiology":    ("419", "إيرادات الأشعة والتصوير"),
    "pharmacy":     ("420", "إيرادات الصيدلية"),
    "other":        ("415", "إيرادات الخدمات الطبية"),
}
# 148 «شركات التأمين الطبي والجهات المتعاقدة» comes with the medical pack. The
# insurer's share used to be debited to 134, which here is employee advances.
INSURER_RECEIVABLE = "148"
DOCTORS_PAYABLE = "264"          # أمانات أطباء استشاريين مستحقة
WHT_PAYABLE = "261"              # ضريبة الخصم والتحصيل المستقطعة


def _money(v, label):
    try:
        x = round(float(v or 0), 2)
    except (TypeError, ValueError):
        raise HTTPException(400, f"{label}: قيمة غير رقمية")
    if x < 0:
        raise HTTPException(400, f"{label} لا يقبل قيمة سالبة")
    return x


@router.post("/medical-services")
async def create_medical_service(data: dict, current_user: dict = Depends(get_user)):
    """
    القيد أ — تقديم الخدمة الطبية (نقدي وتأمين طبي)

    من مذكورين:
       حـ/ الخزينة 161 / البنك 162       (دفعة المريض)
       حـ/ شركات التأمين الطبي 148        (الحصة المغطاة تأمينياً)
    إلى مذكورين:
       حـ/ إيرادات الخدمات الطبية 415-420 (حصة المستشفى/العيادة فقط)
       حـ/ أمانات أطباء استشاريين 264     (حصة كل طبيب — التزام عليه، ليست إيراداً)

    What was wrong before: the whole request body was stored as the record;
    the entry was written straight into journal_entries as a draft that was
    never posted (so it reached no report), any line whose account was missing
    was silently dropped, and an unbalanced entry was saved with a warning in
    the log. Hospital share was whatever the client sent, even when
    hospital + doctors did not equal what the patient and insurer paid.
    Now the amounts must reconcile, every account must exist, and the entry is
    created and posted through AccountingService — or nothing is saved.

    ضريبة الخصم تُحجز عند سداد الأتعاب (القيد ب) بنسبة من جدول الخصم والتحصيل.
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id", "system")

    copay   = _money(data.get("patient_copay"), "دفعة المريض")
    ins_amt = _money(data.get("insurance_claim_amount"), "حصة التأمين")
    total   = round(copay + ins_amt, 2)
    if total <= 0:
        raise HTTPException(400, "قيمة الخدمة صفر — أدخل دفعة المريض و/أو حصة التأمين")
    if data.get("total_amount") not in (None, "") and abs(_money(data["total_amount"], "الإجمالي") - total) > 0.01:
        raise HTTPException(400, f"الإجمالي {data['total_amount']} لا يساوي دفعة المريض + التأمين ({total:,.2f})")

    doctors_in = data.get("doctors") or []
    if not doctors_in and data.get("doctor_share"):
        doctors_in = [{"doctor_id": data.get("doctor_id"), "doctor_name": data.get("doctor_name"),
                       "share": data.get("doctor_share"), "wht_rate": data.get("doctor_wht_rate")}]
    doctors = []
    for d in doctors_in:
        share = _money(d.get("share"), "حصة الطبيب")
        if share <= 0:
            continue
        if not (d.get("doctor_id") or d.get("doctor_name")):
            raise HTTPException(400, "حصة طبيب بدون اسم أو كود الطبيب")
        # the rate comes from the same withholding table as the rest of the
        # system (0/1/3/5%); professional fees default to 5%
        rate = _rate(d["wht_rate"], tuple(WHT_RATES.values()), "الخصم والتحصيل") \
            if d.get("wht_rate") not in (None, "") else WHT_RATES["professional"]
        doctors.append({"doctor_id": str(d.get("doctor_id") or ""), "doctor_name": str(d.get("doctor_name") or "")[:120],
                        "share": share, "wht_rate": rate, "wht_amount": round(share * rate, 2),
                        "net_payment": round(share - round(share * rate, 2), 2),
                        "paid_amount": 0.0, "status": "pending"})
    total_doc = round(sum(d["share"] for d in doctors), 2)
    if total_doc > total:
        raise HTTPException(400, f"حصص الأطباء {total_doc:,.2f} أكبر من قيمة الخدمة {total:,.2f}")
    hosp_share = round(total - total_doc, 2)
    if data.get("hospital_share") not in (None, "") and abs(_money(data["hospital_share"], "حصة المستشفى") - hosp_share) > 0.01:
        raise HTTPException(400, (f"حصة المستشفى {float(data['hospital_share']):,.2f} + حصص الأطباء {total_doc:,.2f} "
                                  f"لا تساوي ما دفعه المريض والتأمين ({total:,.2f})"))

    payment_method = data.get("payment_method", "cash")
    if payment_method not in ("cash", "bank", "insurance"):
        raise HTTPException(400, "payment_method: cash | bank | insurance")
    svc_type = data.get("service_type") or "other"
    if svc_type not in SERVICE_REVENUE_ACCOUNTS:
        raise HTTPException(400, "service_type: " + " | ".join(SERVICE_REVENUE_ACCOUNTS))
    rev_code = SERVICE_REVENUE_ACCOUNTS[svc_type][0]
    if ins_amt > 0 and not await db.chart_of_accounts.find_one(
            {"company_id": company_id, "account_code": INSURER_RECEIVABLE}, {"_id": 0, "id": 1}):
        raise HTTPException(400, "حساب شركات التأمين الطبي 148 غير موجود — فعّل الباقة الطبية من إعدادات الشركة")

    service_id = str(uuid.uuid4())
    service_date = data.get("service_date") or datetime.now().strftime("%Y-%m-%d")
    patient = str(data.get("patient_name") or "")[:120]
    desc = str(data.get("service_description") or "")[:200]
    spec = [
        (("162",) if payment_method == "bank" else ("161",), copay, 0,
         f"دفعة المريض {patient}", {"partner_type": "patient", "partner_id": data.get("patient_id")}),
        ((INSURER_RECEIVABLE,), ins_amt, 0, f"مطالبة تأمين — {data.get('insurance_company_name', '')}",
         {"partner_type": "insurance", "partner_id": data.get("insurance_company_id")}),
        ((rev_code,), 0, hosp_share, f"إيراد خدمة {desc} — حصة المنشأة", None),
    ] + [((DOCTORS_PAYABLE,), 0, d["share"], f"أتعاب د. {d['doctor_name']} مستحقة (قبل الضريبة)",
          {"partner_type": "doctor", "partner_id": d["doctor_id"] or None}) for d in doctors]
    je = await _post_claim_entry(company_id, user_id, service_date,
                                 f"خدمة طبية — {desc} — مريض: {patient}"[:200], spec,
                                 "medical_service", service_id)

    record = {
        "id": service_id, "company_id": company_id,
        "patient_id": data.get("patient_id"), "patient_name": patient,
        "service_date": service_date, "service_type": svc_type, "service_description": desc,
        "payment_method": payment_method,
        "insurance_company_id": data.get("insurance_company_id"),
        "insurance_company_name": data.get("insurance_company_name"),
        "total_amount": total, "patient_copay": copay, "insurance_claim_amount": ins_amt,
        "hospital_share": hosp_share, "doctors": doctors, "total_doctor_share": total_doc,
        "status": "pending", "journal_entry_id": je["id"], "je_balanced": True,
        "created_by": user_id, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.medical_services.insert_one(dict(record))

    return {
        "message": "تم تسجيل الخدمة الطبية وترحيل قيدها",
        "service": record,
        "financial_summary": {
            "total_amount": total, "hospital_share": hosp_share, "total_doctor_share": total_doc,
            "doctors_count": len(doctors), "patient_copay": copay, "insurance_amount": ins_amt,
            "totals_match": True,
        },
        "journal_summary": {
            "journal_entry_id": je["id"],
            "debit_cash_or_bank": copay, "debit_insurance_ar": ins_amt,
            "credit_hospital_revenue": hosp_share, "credit_doctor_trust": total_doc,
            "je_balanced": True,
            "note": "ضريبة الخصم تُحجز عند سداد الأتعاب — POST /api/enterprise/doctor-payment",
        },
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
            {"doctors.status": {"$in": ["pending", "partial"]}},
            {"status": {"$in": ["pending","billed"]}, "doctor_net_payment": {"$gt": 0}}
        ]
    
    services = await db.medical_services.find(q, {"_id": 0}).sort("service_date", -1).to_list(200)
    
    pending_by_doctor = {}
    for svc in services:
        for doc in (svc.get("doctors") or []):
            # what is still owed: a part-paid share used to vanish from the list
            # (only "pending" counted) or, before, was listed in full again
            if doc.get("status") in ("pending", "partial"):
                did = doc.get("doctor_id", "unknown")
                if doctor_id and did != doctor_id:
                    continue
                if did not in pending_by_doctor:
                    pending_by_doctor[did] = {"doctor_id": did, "doctor_name": doc.get("doctor_name",""),
                                               "total_pending": 0, "services": []}
                share = round(float(doc.get("share", 0)) - float(doc.get("paid_amount", 0) or 0), 2)
                wht   = round(share * float(doc.get("wht_rate", 0.05)), 2)
                pending_by_doctor[did]["total_pending"] = round(pending_by_doctor[did]["total_pending"] + share - wht, 2)
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
    القيد ب — سداد أتعاب طبيب عن خدمة مسجلة

    من حـ/ أمانات أطباء استشاريين 264   (المبلغ المسدد قبل الضريبة)
       إلى حـ/ ضريبة الخصم والتحصيل 261  (بنسبة الطبيب من جدول الخصم: 0/1/3/5%)
       إلى حـ/ البنك 162 / الخزينة 161    (الصافي للطبيب)

    Before: any amount could be paid to any doctor id, with or without a
    service, as often as asked — 264 was debited for fees never accrued; a
    "non_resident" type forced a 10% rate that is not in the withholding table;
    and the entry was an unposted draft built without checking accounts. Now
    the payment is against a doctor's share in a service, cannot exceed what is
    still owed, and is posted through AccountingService.
    """
    company_id = current_user.get("company_id")
    user_id = current_user.get("user_id", "system")
    service_id, doctor_id = data.get("service_id"), str(data.get("doctor_id") or "")
    if not service_id or not doctor_id:
        raise HTTPException(400, "حدد الخدمة (service_id) والطبيب (doctor_id) — الأتعاب تُسدد عن خدمة مسجلة")
    if data.get("doctor_type") == "non_resident":
        raise HTTPException(400, "طبيب غير مقيم: ضريبته ليست ضمن جدول الخصم والتحصيل — سجّل القيد يدوياً بعد مراجعة المحاسب")
    svc = await db.medical_services.find_one({"id": service_id, "company_id": company_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "الخدمة غير موجودة")
    docs = svc.get("doctors") or []
    doc = next((d for d in docs if str(d.get("doctor_id") or "") == doctor_id), None)
    if not doc:
        raise HTTPException(404, "الطبيب ليس له حصة في هذه الخدمة")
    remaining = round(float(doc.get("share", 0)) - float(doc.get("paid_amount", 0) or 0), 2)
    if remaining <= 0:
        raise HTTPException(400, "أتعاب هذا الطبيب عن هذه الخدمة مسددة بالكامل")
    gross_amt = _money(data.get("gross_amount") or remaining, "مبلغ الأتعاب")
    if gross_amt <= 0 or gross_amt > remaining + 0.01:
        raise HTTPException(400, f"المبلغ يجب أن يكون بين 0 و المتبقي للطبيب ({remaining:,.2f})")
    wht_rate = _rate(data["wht_rate"], tuple(WHT_RATES.values()), "الخصم والتحصيل") \
        if data.get("wht_rate") not in (None, "") else float(doc.get("wht_rate", WHT_RATES["professional"]))
    wht_amt = round(gross_amt * wht_rate, 2)
    net_pay = round(gross_amt - wht_amt, 2)
    payment_method = data.get("payment_method", "bank")
    if payment_method not in ("bank", "cash"):
        raise HTTPException(400, "payment_method: bank | cash")
    doctor_name = doc.get("doctor_name", "")
    pay_date = data.get("payment_date") or datetime.now().strftime("%Y-%m-%d")
    payment_id = str(uuid.uuid4())

    je = await _post_claim_entry(company_id, user_id, pay_date,
                                 f"سداد أتعاب د. {doctor_name} — ضريبة خصم {wht_rate*100:g}%", [
        ((DOCTORS_PAYABLE,), gross_amt, 0, f"إقفال أمانة د. {doctor_name}",
         {"partner_type": "doctor", "partner_id": doctor_id}),
        ((WHT_PAYABLE,), 0, wht_amt, f"ضريبة خصم وتحصيل {wht_rate*100:g}% — د. {doctor_name}", None),
        (("161",) if payment_method == "cash" else ("162",), 0, net_pay,
         f"صافي أتعاب د. {doctor_name}", {"partner_type": "doctor", "partner_id": doctor_id}),
    ], "doctor_payment", payment_id)

    payment_record = {
        "id": payment_id, "company_id": company_id, "service_id": service_id,
        "doctor_id": doctor_id, "doctor_name": doctor_name,
        "gross_amount": gross_amt, "wht_rate": wht_rate, "wht_amount": wht_amt, "net_payment": net_pay,
        "payment_method": payment_method, "payment_date": pay_date,
        "journal_entry_id": je["id"], "je_balanced": True,
        "created_at": datetime.now(timezone.utc).isoformat(), "created_by": user_id,
    }
    await db.doctor_payments.insert_one(dict(payment_record))
    paid_total = round(float(doc.get("paid_amount", 0) or 0) + gross_amt, 2)
    doc["paid_amount"] = paid_total
    doc["wht_deducted"] = round(float(doc.get("wht_deducted", 0) or 0) + wht_amt, 2)
    doc["status"] = "paid" if paid_total >= float(doc.get("share", 0)) - 0.01 else "partial"
    doc["paid_at"] = pay_date
    await db.medical_services.update_one({"id": service_id, "company_id": company_id},
                                         {"$set": {"doctors": docs}})

    return {
        "message": f"تم سداد أتعاب د. {doctor_name} وترحيل القيد",
        "payment": payment_record,
        "journal_summary": {
            "journal_entry_id": je["id"],
            "debit_trust_closed": gross_amt, "credit_wht_payable": wht_amt,
            "credit_bank_or_cash": net_pay, "wht_rate_pct": round(wht_rate * 100, 1),
            "remaining_for_doctor": round(float(doc.get("share", 0)) - paid_total, 2),
            "balanced": True,
        },
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
        {"id": service_id, "company_id": current_user.get("company_id")},
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
