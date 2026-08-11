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
    vat_rate= float(data.get("vat_rate", 0.14))
    wht_rate= float(data.get("withholding_tax_rate", 0.01))
    vat_amt = round(current * vat_rate, 2)
    wht_amt = round(current * wht_rate, 2)
    net     = round(current - ret_amt - adv_ded - wht_amt + vat_amt, 2)

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

        lines = []
        if recv_acc: lines.append({"account_id":recv_acc["id"],"account_code":"131","account_name":recv_acc.get("account_name","العملاء"),"debit":net,"credit":0,"description":"صافي المستخلص مستحق القبض","project_id":data.get("project_id"),"partner_type":"customer","partner_id":data.get("partner_id")})
        if ret_acc:  lines.append({"account_id":ret_acc["id"],"account_code":"141","account_name":ret_acc.get("account_name","ضمان محتجز"),"debit":ret_amt,"credit":0,"description":f"تأمين أعمال محتجز {data.get('retention_percentage')}%","project_id":data.get("project_id")})
        if wht_acc:  lines.append({"account_id":wht_acc["id"],"account_code":"138","account_name":wht_acc.get("account_name","خصم وتحصيل"),"debit":wht_amt,"credit":0,"description":"ضريبة خصم وتحصيل 1% محتجزة","project_id":data.get("project_id")})
        if rev_acc:  lines.append({"account_id":rev_acc["id"],"account_code":"414","account_name":rev_acc.get("account_name","إيرادات مقاولات"),"debit":0,"credit":current,"description":f"إيراد مستخلص رقم {data.get('claim_number')}","project_id":data.get("project_id")})
        if vat_acc:  lines.append({"account_id":vat_acc["id"],"account_code":"260","account_name":vat_acc.get("account_name","VAT Output"),"debit":0,"credit":vat_amt,"description":"ضريبة القيمة المضافة مخرجات","project_id":data.get("project_id")})

        if lines:
            je = {
                "id": str(uuid.uuid4()), "company_id": company_id,
                "entry_date": data.get("claim_date"), "entry_number": 0,
                "description": f"مستخلص أعمال رقم {data.get('claim_number')} — {data.get('partner_name','')}",
                "lines": lines, "total_debit": net+ret_amt+wht_amt, "total_credit": current+vat_amt,
                "status": "draft", "source_document_type": "claim", "source_document_id": data["id"],
                "created_by": current_user.get("user_id","system"),
            }
            await db.journal_entries.insert_one(je)
            je_id = je["id"]
            await db.progress_claims.update_one({"id": data["id"]}, {"$set": {"journal_entry_id": je_id}})

    return {"message": "Progress claim created", "claim": data}


# ══════════════════════════════════════════
# MEDICAL SERVICES — القطاع الطبي
# ══════════════════════════════════════════
@router.post("/medical-services")
async def create_medical_service(data: dict, current_user: dict = Depends(get_user)):
    company_id = current_user.get("company_id")
    data["company_id"] = company_id
    data["id"] = str(uuid.uuid4())
    data["created_at"] = datetime.now(timezone.utc).isoformat()

    # Auto-calculate doctor withholding tax 5%
    doc_share = float(data.get("doctor_share", 0))
    wht = round(doc_share * 0.05, 2)
    data["doctor_withholding_tax"] = wht
    data["doctor_net_payment"] = round(doc_share - wht, 2)

    await db.medical_services.insert_one(data)
    data.pop("_id", None)

    # Auto-post journal entry
    from services.accounting_service import AccountingService
    svc = AccountingService(db)
    accounts = await svc.get_all_accounts(company_id, True)
    acc_map = {a["account_code"]: a for a in accounts}
    def acc(code): return acc_map.get(code, {})

    cash_acc = acc("161"); recv_acc = acc("131"); rev_acc = acc("415")
    doc_pay_acc = acc("264"); wht_pay_acc = acc("261")

    total   = float(data.get("total_amount", 0))
    hosp    = float(data.get("hospital_share", 0))
    copay   = float(data.get("patient_copay", 0))
    ins_amt = float(data.get("insurance_claim_amount", 0))

    lines = []
    if cash_acc and copay > 0: lines.append({"account_id":cash_acc["id"],"account_code":"161","account_name":"الخزينة","debit":copay,"credit":0,"description":"مدفوع نقداً من المريض","partner_type":"customer","partner_id":data.get("patient_id")})
    if recv_acc and ins_amt > 0: lines.append({"account_id":recv_acc["id"],"account_code":"131","account_name":"مدينو التأمين","debit":ins_amt,"credit":0,"description":"مطالبة شركة التأمين","partner_type":"customer","partner_id":data.get("insurance_company_id")})
    if rev_acc: lines.append({"account_id":rev_acc["id"],"account_code":"415","account_name":"إيرادات طبية","debit":0,"credit":hosp,"description":"حصة المستشفى من الخدمة الطبية"})
    if doc_pay_acc and doc_share > 0: lines.append({"account_id":doc_pay_acc["id"],"account_code":"264","account_name":"أمانات أطباء","debit":0,"credit":doc_share,"description":f"أتعاب د. {data.get('doctor_name','')} مستحقة","partner_type":"doctor","partner_id":data.get("doctor_id")})
    if wht_pay_acc and wht > 0: lines.append({"account_id":wht_pay_acc["id"],"account_code":"261","account_name":"خصم وتحصيل مستحق","debit":0,"credit":wht,"description":"ضريبة خصم 5% على أتعاب الطبيب"})

    if lines:
        je = {
            "id": str(uuid.uuid4()), "company_id": company_id,
            "entry_date": data.get("service_date"), "entry_number": 0,
            "description": f"خدمة طبية — {data.get('service_description','')}",
            "lines": lines, "total_debit": copay+ins_amt, "total_credit": hosp+doc_share,
            "status": "draft", "source_document_type": "medical_service", "source_document_id": data["id"],
            "created_by": current_user.get("user_id","system"),
        }
        await db.journal_entries.insert_one(je)
        await db.medical_services.update_one({"id": data["id"]}, {"$set": {"journal_entry_id": je["id"]}})

    return {"message": "Medical service recorded", "service": data}


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
