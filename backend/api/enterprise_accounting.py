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
    return await verify_token(authorization)


# ══════════════════════════════════════════
# TAX BRACKETS — Dynamic (no hardcoding)
# ══════════════════════════════════════════
@router.get("/tax-brackets")
async def get_tax_brackets(year: int = 2024, current_user: dict = Depends(get_user)):
    company_id = current_user.get("company_id")
    brackets = await db.payroll_tax_brackets.find(
        {"tax_year": year, "$or": [{"company_id": company_id}, {"company_id": None}]},
        {"_id": 0}
    ).sort("bracket_order", 1).to_list(length=20)

    if not brackets:
        # Seed default brackets
        for b in DEFAULT_TAX_BRACKETS_2024:
            d = b.dict()
            d["id"] = str(uuid.uuid4())
            await db.payroll_tax_brackets.insert_one(d)
        brackets = [b.dict() for b in DEFAULT_TAX_BRACKETS_2024]

    return {"brackets": brackets, "tax_year": year}

@router.put("/tax-brackets/{bracket_id}")
async def update_tax_bracket(bracket_id: str, data: dict, current_user: dict = Depends(get_user)):
    """تحديث شريحة ضريبية — Super Admin أو مدير مالي"""
    await db.payroll_tax_brackets.update_one(
        {"id": bracket_id},
        {"$set": {**data, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Bracket updated"}


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
@router.get("/progress-claims/{project_id}")
async def get_progress_claims(project_id: str, current_user: dict = Depends(get_user)):
    claims = await db.progress_claims.find(
        {"project_id": project_id, "company_id": current_user.get("company_id")},
        {"_id": 0}
    ).sort("claim_number", 1).to_list(length=100)
    return {"claims": claims}

@router.post("/progress-claims")
async def create_progress_claim(data: dict, current_user: dict = Depends(get_user)):
    company_id = current_user.get("company_id")
    data["company_id"] = company_id
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()

    # Auto-calculate amounts
    gross   = float(data.get("gross_amount", 0))
    prev    = float(data.get("previous_claims", 0))
    current = gross - prev
    ret_pct = float(data.get("retention_percentage", 10)) / 100
    ret_amt = round(current * ret_pct, 2)
    adv_ded = float(data.get("advance_payment_deducted", 0))
    # قانون VAT المصري: المادة 54 — خدمات المقاولات تخضع لجدول 5% (ليس 14%)
    # إلا إذا كانت مقاولات خاصة معينة تخضع 14% — يمكن التغيير حسب طبيعة العقد
    vat_rate = float(data.get("vat_rate", 0.05))   # 5% جدول مقاولات (default)
    # قانون 91/2005 م.59: خصم وتحصيل = 1% مقاولات/توريدات | 3% خدمات
    wht_rate = float(data.get("withholding_tax_rate", 0.01))  # 1% مقاولات (default)
    vat_amt = round(current * vat_rate, 2)
    wht_amt = round(current * wht_rate, 2)
    # المعيار المحاسبي المصري رقم 8: صافي المستحق = القيمة - المحتجزات - الخصومات
    # VAT is a SEPARATE obligation — not added to net receivable
    net     = round(current - ret_amt - adv_ded - wht_amt, 2)
    # Total invoice (AR): net + VAT
    ar_amount = round(net + vat_amt, 2)

    data.update({
        "current_claim": round(current, 2),
        "retention_amount": ret_amt,
        "vat_amount": vat_amt,
        "withholding_tax_amount": wht_amt,
        "net_payable": net,
    })

    await db.progress_claims.insert_one(data)
    data.pop("_id", None)

    # Auto-post journal entry for owner claim
    if data.get("claim_type") == "owner":
        from services.accounting_service import AccountingService
        svc = AccountingService(db)
        accounts = await svc.get_all_accounts(company_id, True)
        acc_map = {a["account_code"]: a for a in accounts}

        def acc(code):
            return acc_map.get(code, {})

        recv_acc = acc("131")  # العملاء — مستخلصات جارية
        ret_acc  = acc("141")  # أصول ضمان محتجزة
        wht_acc  = acc("138")  # ضريبة خصم محتجزة
        rev_acc  = acc("414")  # إيرادات مقاولات
        vat_acc  = acc("260")  # VAT مخرجات

        # ══ القيد المحاسبي — المعيار المصري رقم 8 ══════════════════
        # مدين: ح/العملاء (صافي + VAT) | ح/ضمان محتجز | ح/خصم وتحصيل
        # دائن: ح/إيرادات مقاولات (القيمة قبل الضرائب) | ح/VAT مخرجات
        adv_pay_acc = acc_map.get("147")  # ح/مقبوضات مقدمة (استرداد الدفعة المقدمة)
        
        lines = []
        # مدين 1: ح/العملاء - مستخلصات جارية (صافي + VAT)
        if recv_acc:
            lines.append({"account_id":recv_acc["id"],"account_code":"131",
                "account_name":recv_acc.get("account_name","العملاء — مستخلصات جارية"),
                "debit":ar_amount,"credit":0,
                "description":f"مستخلص رقم {data.get('claim_number')} — صافي مستحق القبض",
                "project_id":data.get("project_id"),
                "partner_type":"customer","partner_id":data.get("partner_id")})
        # مدين 2: ح/أصول — تأمين أعمال لدى الغير (محتجز ضمان)
        if ret_acc and ret_amt > 0:
            lines.append({"account_id":ret_acc["id"],"account_code":"141",
                "account_name":ret_acc.get("account_name","تأمين أعمال لدى الغير"),
                "debit":ret_amt,"credit":0,
                "description":f"ضمان حسن التنفيذ محتجز {data.get('retention_percentage')}%",
                "project_id":data.get("project_id")})
        # مدين 3: ح/مصلحة الضرائب — خصم وتحصيل (1% محتجز من المالك)
        if wht_acc and wht_amt > 0:
            lines.append({"account_id":wht_acc["id"],"account_code":"138",
                "account_name":wht_acc.get("account_name","مصلحة الضرائب — خصم وتحصيل"),
                "debit":wht_amt,"credit":0,
                "description":f"ضريبة خصم وتحصيل {round(wht_rate*100,1)}% على المقاولات",
                "project_id":data.get("project_id")})
        # مدين 4: ح/مقبوضات مقدمة (استرداد دفعة مقدمة إن وجدت)
        if adv_ded > 0 and adv_pay_acc:
            lines.append({"account_id":adv_pay_acc["id"],"account_code":"147",
                "account_name":"مقبوضات مقدمة — استرداد",
                "debit":0,"credit":adv_ded,
                "description":"استرداد دفعة مقدمة من المستخلص",
                "project_id":data.get("project_id")})
        # دائن 1: ح/إيرادات أعمال المقاولات (قيمة المستخلص الحالي قبل الضرائب)
        if rev_acc:
            lines.append({"account_id":rev_acc["id"],"account_code":"414",
                "account_name":rev_acc.get("account_name","إيرادات أعمال المقاولات"),
                "debit":0,"credit":current,
                "description":f"إيراد مستخلص أعمال رقم {data.get('claim_number')} — {data.get('partner_name','')}",
                "project_id":data.get("project_id")})
        # دائن 2: ح/مصلحة الضرائب — ضريبة القيمة المضافة مخرجات
        if vat_acc and vat_amt > 0:
            lines.append({"account_id":vat_acc["id"],"account_code":"260",
                "account_name":vat_acc.get("account_name","ضريبة القيمة المضافة — مخرجات"),
                "debit":0,"credit":vat_amt,
                "description":f"VAT مخرجات {round(vat_rate*100,0)}% على مستخلص المقاولات",
                "project_id":data.get("project_id")})
        
        # التحقق من التوازن: مدين = دائن
        total_d = round(sum(l["debit"]  for l in lines), 2)
        total_c = round(sum(l["credit"] for l in lines), 2)
        
        if lines:
            je = {
                "id": str(uuid.uuid4()), "company_id": company_id,
                "entry_date": data.get("claim_date"), "entry_number": 0,
                "description": f"مستخلص أعمال رقم {data.get('claim_number')} — {data.get('partner_name','')} (المعيار المصري 8)",
                "lines": lines, "total_debit": total_d, "total_credit": total_c,
                "status": "draft", "source_document_type": "claim", "source_document_id": data["id"],
                "created_by": current_user.get("user_id","system"),
            }
            await db.journal_entries.insert_one(je)
            je_id = je["id"]
            await db.progress_claims.update_one({"id": data["id"]}, {"$set": {"journal_entry_id": je_id}})

    return {"message": "Progress claim created", "claim": data}




# ══════════════════════════════════════════════════════════════
# SUBCONTRACTOR CLAIMS — مستخلصات مقاولي الباطن (القيد ب)
# المعيار المصري 8 | قانون 91/2005 م.59
# ══════════════════════════════════════════════════════════════

@router.post("/subcontractor-claims")
async def create_subcontractor_claim(data: dict, current_user: dict = Depends(get_user)):
    """
    إثبات مستخلص مقاول الباطن (Subcontractor Claim)
    
    القيد المحاسبي:
    من مذكورين:
       حـ/ تكاليف المقاولات — مقاولي الباطن   (gross_amount)
       حـ/ مصلحة الضرائب — VAT مدخلات       (vat_amount — قابل للخصم)
    إلى مذكورين:
       حـ/ أرصدة دائنة — مقاولي الباطن       (net_payable)
       حـ/ مصلحة الضرائب — خصم وتحصيل       (wht_amount — 1% أو 3%)
       حـ/ خصومات دائنة — تأمين حسن التنفيذ  (retention_amount)
    """
    company_id = current_user.get("company_id")
    data["company_id"] = company_id
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()
    data["claim_type"] = "subcontractor"
    
    # ── الحسابات المالية ──────────────────────────────────
    gross      = float(data.get("gross_amount", 0))
    prev_claims= float(data.get("previous_claims", 0))
    current_claim = gross - prev_claims  # قيمة المستخلص الحالي
    
    # نسبة ضمان حسن التنفيذ (عادة 5–10% من المقاول الباطن)
    ret_pct    = float(data.get("retention_percentage", 10)) / 100
    ret_amt    = round(current_claim * ret_pct, 2)
    
    # الدفعة المقدمة للاسترداد إن وجدت
    adv_recovery = float(data.get("advance_recovery", 0))
    
    # VAT — قانون VAT المادة 54: 5% جدول أو 14% حسب طبيعة العقد
    vat_rate   = float(data.get("vat_rate", 0.05))   # 5% جدول مقاولات
    vat_amt    = round(current_claim * vat_rate, 2)
    
    # خصم وتحصيل — قانون 91/2005 م.59:
    #   1% للمقاولات والتوريدات
    #   3% للخدمات
    wht_type   = data.get("wht_type", "contracts")  # contracts | services
    wht_rate   = 0.03 if wht_type == "services" else 0.01
    if data.get("withholding_tax_rate"):
        wht_rate = float(data.get("withholding_tax_rate"))
    wht_amt    = round(current_claim * wht_rate, 2)
    
    # صافي المستحق للمقاول الباطن
    net_payable = round(current_claim - ret_amt - adv_recovery - wht_amt, 2)
    
    data.update({
        "current_claim":          round(current_claim, 2),
        "retention_amount":       ret_amt,
        "vat_amount":             vat_amt,
        "withholding_tax_amount": wht_amt,
        "withholding_tax_rate":   wht_rate,
        "advance_recovery":       adv_recovery,
        "net_payable":            net_payable,
        "ar_amount":              round(net_payable + vat_amt, 2),
    })
    
    await db.progress_claims.insert_one(data)
    data.pop("_id", None)
    
    # ── القيد المحاسبي ────────────────────────────────────
    from services.accounting_service import AccountingService
    svc       = AccountingService(db)
    accounts  = await svc.get_all_accounts(company_id, True)
    acc_map   = {a["account_code"]: a for a in accounts}
    
    def acc(code, name_default):
        a = acc_map.get(code, {})
        return a.get("id"), code, a.get("account_name", name_default)
    
    cost_id,  cost_code,  cost_name  = acc("521", "تكاليف مقاولات — مقاولي الباطن")
    vat_in_id,vatin_code, vatin_name = acc("153", "ضريبة القيمة المضافة — مدخلات")
    pay_id,   pay_code,   pay_name   = acc("212", "أرصدة دائنة — مقاولو الباطن")
    wht_id,   wht_code,   wht_name   = acc("261", "مصلحة الضرائب — خصم وتحصيل")
    ret_id,   ret_code,   ret_name   = acc("259", "خصومات دائنة — ضمان حسن التنفيذ")
    adv_id,   adv_code,   adv_name   = acc("147", "مقبوضات مقدمة — استرداد")
    
    lines_je = []
    
    # ── مدين ──────────────────────────────────────────────
    # مدين 1: ح/تكاليف المقاولات — مقاولي الباطن
    if cost_id:
        lines_je.append({
            "account_id": cost_id, "account_code": cost_code, "account_name": cost_name,
            "debit": round(current_claim, 2), "credit": 0,
            "description": f"تكلفة مستخلص مقاول الباطن رقم {data.get('claim_number','')} — {data.get('partner_name','')}",
            "project_id": data.get("project_id"),
            "partner_type": "subcontractor", "partner_id": data.get("partner_id")
        })
    
    # مدين 2: ح/مصلحة الضرائب — VAT مدخلات (قابل للخصم)
    if vat_in_id and vat_amt > 0:
        lines_je.append({
            "account_id": vat_in_id, "account_code": vatin_code, "account_name": vatin_name,
            "debit": vat_amt, "credit": 0,
            "description": f"VAT مدخلات {round(vat_rate*100,0)}% على مستخلص مقاول الباطن",
            "project_id": data.get("project_id")
        })
    
    # ── دائن ──────────────────────────────────────────────
    # دائن 1: ح/أرصدة دائنة — مقاولو الباطن (صافي المستحق + VAT)
    # المقاول الباطن يُصدر فاتورة بسعر + VAT — لذا المطلوب له = صافي + VAT
    sub_ap = round(net_payable + vat_amt, 2)
    if pay_id:
        lines_je.append({
            "account_id": pay_id, "account_code": pay_code, "account_name": pay_name,
            "debit": 0, "credit": sub_ap,
            "description": f"مستحق لمقاول الباطن {data.get('partner_name','')} (صافي + VAT)",
            "project_id": data.get("project_id"),
            "partner_type": "subcontractor", "partner_id": data.get("partner_id")
        })
    
    # دائن 2: ح/مصلحة الضرائب — خصم وتحصيل (1% أو 3%)
    if wht_id and wht_amt > 0:
        lines_je.append({
            "account_id": wht_id, "account_code": wht_code, "account_name": wht_name,
            "debit": 0, "credit": wht_amt,
            "description": f"ضريبة خصم وتحصيل {round(wht_rate*100,0)}% — {'مقاولات' if wht_type=='contracts' else 'خدمات'}",
            "project_id": data.get("project_id")
        })
    
    # دائن 3: ح/خصومات دائنة — تأمين حسن التنفيذ محتجز
    if ret_id and ret_amt > 0:
        lines_je.append({
            "account_id": ret_id, "account_code": ret_code, "account_name": ret_name,
            "debit": 0, "credit": ret_amt,
            "description": f"ضمان حسن التنفيذ محتجز {data.get('retention_percentage',10)}% من مقاول الباطن",
            "project_id": data.get("project_id")
        })
    
    # دائن 4: ح/مقبوضات مقدمة — استرداد دفعة مقدمة إن وجدت
    if adv_id and adv_recovery > 0:
        lines_je.append({
            "account_id": adv_id, "account_code": adv_code, "account_name": adv_name,
            "debit": 0, "credit": adv_recovery,
            "description": "استرداد دفعة مقدمة من مقاول الباطن",
            "project_id": data.get("project_id")
        })
    
    # ── التحقق من التوازن والحفظ ──────────────────────────
    if lines_je:
        total_d = round(sum(l["debit"]  for l in lines_je), 2)
        total_c = round(sum(l["credit"] for l in lines_je), 2)
        diff = abs(total_d - total_c)
        
        if diff > 0.01:
            import logging
            logging.warning(f"Subcontractor claim imbalance: debit={total_d}, credit={total_c}")
        
        je = {
            "id": str(uuid.uuid4()), "company_id": company_id,
            "entry_date": data.get("claim_date", datetime.now().strftime("%Y-%m-%d")),
            "entry_number": 0,
            "description": (
                f"مستخلص مقاول الباطن رقم {data.get('claim_number','')} — "
                f"{data.get('partner_name','')} (المعيار المصري 8)"
            ),
            "lines": lines_je,
            "total_debit": total_d, "total_credit": total_c,
            "status": "draft",
            "source_document_type": "subcontractor_claim",
            "source_document_id": data["id"],
            "created_by": current_user.get("user_id", "system"),
        }
        je_id = (await db.journal_entries.insert_one(je)).inserted_id
        await db.progress_claims.update_one(
            {"id": data["id"]},
            {"$set": {"journal_entry_id": je["id"], "je_balanced": diff <= 0.01}}
        )
    
    return {
        "message": "تم إثبات مستخلص مقاول الباطن بنجاح",
        "claim": data,
        "journal_summary": {
            "debit_cost":        round(current_claim, 2),
            "debit_vat_input":   vat_amt,
            "credit_payable":    net_payable,
            "credit_wht":        wht_amt,
            "credit_retention":  ret_amt,
            "credit_adv_recovery": adv_recovery,
            "balanced":          diff <= 0.01 if lines_je else True,
            "wht_type":          wht_type,
            "wht_rate_pct":      round(wht_rate * 100, 1)
        }
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
    bank_id,   bank_code,   bank_name    = acct("112", "البنك")
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
    bank_id,   bank_code,   bank_name    = acct("112", "البنك")
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
