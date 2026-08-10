from fastapi import APIRouter, HTTPException, Depends, Header, Query
from models.financial_data import JournalEntry, TreasuryTransaction, BankTransaction, Customer, Supplier
from services.auth_service import verify_token
from typing import Optional, List
from database import get_database

router = APIRouter(prefix="/api/financial", tags=["financial"])
db = get_database()

# Default pagination settings
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 1000

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload

# Journal Entries
@router.get("/journal-entries")
async def get_journal_entries(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get journal entries for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.journal_entries.count_documents({"company_id": company_id})
    entries = await db.journal_entries.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": entries,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/journal-entries")
async def create_journal_entry(entry: JournalEntry, current_user: dict = Depends(get_current_user)):
    """Create new journal entry"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    entry.company_id = current_user.get("company_id")
    from services.accounting_service import AccountingService
    service = AccountingService(db)
    result = await service.create_journal_entry(entry)
    # Auto-post journal entry so it reflects in balance sheet immediately
    if result.get("id"):
        try:
            await service.post_journal_entry(result["id"], current_user.get("user_id"))
        except Exception as e:
            pass  # Entry created but not posted — user can post manually
    return {"message": "Journal entry created successfully", "id": result.get("id")}

# Treasury
@router.get("/treasury")
async def get_treasury_transactions(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get treasury transactions for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.treasury_transactions.count_documents({"company_id": company_id})
    transactions = await db.treasury_transactions.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": transactions,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/treasury")
async def create_treasury_transaction(transaction: TreasuryTransaction, current_user: dict = Depends(get_current_user)):
    """Create new treasury transaction"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    transaction.company_id = current_user.get("company_id")
    await db.treasury_transactions.insert_one(transaction.dict())
    return {"message": "Treasury transaction created successfully", "id": transaction.id}

# Bank
@router.get("/bank")
async def get_bank_transactions(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get bank transactions for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.bank_transactions.count_documents({"company_id": company_id})
    transactions = await db.bank_transactions.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": transactions,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/bank")
async def create_bank_transaction(transaction: BankTransaction, current_user: dict = Depends(get_current_user)):
    """Create new bank transaction"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    transaction.company_id = current_user.get("company_id")
    await db.bank_transactions.insert_one(transaction.dict())
    return {"message": "Bank transaction created successfully", "id": transaction.id}

# Customers
@router.get("/customers")
async def get_customers(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get customers for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.customers.count_documents({"company_id": company_id})
    customers = await db.customers.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": customers,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/customers")
async def create_customer(customer: Customer, current_user: dict = Depends(get_current_user)):
    """Create new customer"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    customer.company_id = current_user.get("company_id")
    await db.customers.insert_one(customer.dict())
    return {"message": "Customer created successfully", "id": customer.id}

# Suppliers
@router.get("/suppliers")
async def get_suppliers(
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE)
):
    """Get suppliers for the user's company with pagination"""
    company_id = current_user.get("company_id")
    skip = (page - 1) * limit
    
    total = await db.suppliers.count_documents({"company_id": company_id})
    suppliers = await db.suppliers.find(
        {"company_id": company_id},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(length=limit)
    
    return {
        "data": suppliers,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": (total + limit - 1) // limit}
    }

@router.post("/suppliers")
async def create_supplier(supplier: Supplier, current_user: dict = Depends(get_current_user)):
    """Create new supplier"""
    allowed_roles = ["General Manager", "CEO", "Board Chairman", "Financial Manager", "Chief Accountant",
                     "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "المدير المالي", "رئيس الحسابات"]
    if current_user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    supplier.company_id = current_user.get("company_id")
    await db.suppliers.insert_one(supplier.dict())
    return {"message": "Supplier created successfully", "id": supplier.id}


# ══════════════════════════════════════════════════════════════════════════════
# FIXED ASSETS — الأصول الثابتة وحساب الإهلاك
# قانون الضرائب المصري 91/2005 وتعديلاته
# ══════════════════════════════════════════════════════════════════════════════

EGYPTIAN_DEPRECIATION_RATES = {
    "buildings":  {"rate": 0.05,  "method": "straight_line", "name_ar": "المباني والإنشاءات"},
    "machinery":  {"rate": 0.10,  "method": "straight_line", "name_ar": "الآلات والمعدات"},
    "vehicles":   {"rate": 0.25,  "method": "declining",     "name_ar": "السيارات ووسائل النقل"},
    "computers":  {"rate": 0.50,  "method": "declining",     "name_ar": "أجهزة الحاسب الآلي"},
    "furniture":  {"rate": 0.10,  "method": "straight_line", "name_ar": "الأثاث والديكور"},
    "software":   {"rate": 0.33,  "method": "straight_line", "name_ar": "البرامج والتراخيص"},
    "land":       {"rate": 0.00,  "method": "none",          "name_ar": "الأراضي"},
    "leasehold":  {"rate": 0.10,  "method": "straight_line", "name_ar": "تحسينات المباني المستأجرة"},
    "goodwill":   {"rate": 0.10,  "method": "straight_line", "name_ar": "الشهرة التجارية"},
    "other":      {"rate": 0.10,  "method": "straight_line", "name_ar": "أصول أخرى"},
}

def _calculate_depreciation(asset: dict, as_of_date: str) -> dict:
    from datetime import date
    try:
        service_date = date.fromisoformat(asset.get("service_date", asset.get("purchase_date", "2024-01-01")))
        as_of = date.fromisoformat(as_of_date[:10])
    except:
        return {"accumulated_depreciation": 0, "book_value": asset.get("cost", 0), "years_used": 0, "annual_depreciation": 0}
    cost = float(asset.get("cost", 0))
    salvage = float(asset.get("salvage_value", 0))
    rate = float(asset.get("depreciation_rate", 0))
    method = asset.get("depreciation_method", "straight_line")
    depreciable = cost - salvage
    if rate == 0 or cost == 0 or as_of < service_date:
        return {"accumulated_depreciation": 0, "book_value": cost, "years_used": 0, "annual_depreciation": 0}
    years = (as_of - service_date).days / 365.25
    if method == "straight_line":
        annual = depreciable * rate
        accumulated = min(annual * years, depreciable)
    elif method == "declining":
        book = cost; accumulated = 0; y = 0
        while y < years:
            portion = min(1.0, years - y)
            dep_year = book * rate * portion
            accumulated += dep_year; book -= dep_year; y += 1
            if book <= salvage: break
        accumulated = min(accumulated, depreciable)
        annual = (cost - accumulated) * rate if (cost - accumulated) > salvage else 0
    else:
        accumulated = 0; annual = 0
    return {
        "accumulated_depreciation": round(accumulated, 2),
        "book_value": round(cost - accumulated, 2),
        "years_used": round(years, 2),
        "annual_depreciation": round(depreciable * rate if method == "straight_line" else (cost - accumulated) * rate, 2),
    }

@router.get("/assets")
async def get_fixed_assets(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    from datetime import date
    assets = await db.fixed_assets.find({"company_id": company_id}, {"_id": 0}).sort("purchase_date", -1).to_list(10000)
    for asset in assets:
        asset["calculated_depreciation"] = _calculate_depreciation(asset, date.today().isoformat())
    return assets

@router.post("/assets")
async def create_fixed_asset(asset_data: dict, current_user: dict = Depends(get_current_user)):
    import uuid as _uuid
    from datetime import datetime, timezone
    company_id = current_user.get("company_id")
    asset_type = asset_data.get("asset_type", "other")
    dep_info = EGYPTIAN_DEPRECIATION_RATES.get(asset_type, EGYPTIAN_DEPRECIATION_RATES["other"])
    cost = float(asset_data.get("cost", 0))
    salvage_value = float(asset_data.get("salvage_value", 0))
    count = await db.fixed_assets.count_documents({"company_id": company_id})
    asset_code = f"FA-{str(count + 1).zfill(4)}"
    asset = {
        "id": str(_uuid.uuid4()), "company_id": company_id,
        "asset_code": asset_code, "name": asset_data.get("name"),
        "description": asset_data.get("description", ""),
        "asset_type": asset_type, "asset_type_ar": dep_info["name_ar"],
        "cost": cost, "salvage_value": salvage_value,
        "depreciable_amount": cost - salvage_value,
        "depreciation_method": asset_data.get("depreciation_method", dep_info["method"]),
        "depreciation_rate": float(asset_data.get("depreciation_rate", dep_info["rate"])),
        "useful_life_years": asset_data.get("useful_life_years", round(1/dep_info["rate"]) if dep_info["rate"] > 0 else 0),
        "purchase_date": asset_data.get("purchase_date"),
        "service_date": asset_data.get("service_date", asset_data.get("purchase_date")),
        "disposal_date": None, "serial_number": asset_data.get("serial_number", ""),
        "supplier_name": asset_data.get("supplier_name", ""),
        "location": asset_data.get("location", ""), "department": asset_data.get("department", ""),
        "status": "active", "accumulated_depreciation": 0.0, "book_value": cost,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fixed_assets.insert_one(asset.copy())
    import uuid
    # Map asset type to account code
    asset_account_map = {
        "buildings": "112", "machinery": "114", "vehicles": "113",
        "computers": "116", "furniture": "115", "software": "116",
        "land": "111", "leasehold": "115", "goodwill": "116", "other": "116"
    }
    asset_acc_code = asset_account_map.get(asset_type, "116")
    await db.journal_entries.insert_one({
        "id": str(uuid.uuid4()), "company_id": company_id,
        "date": asset_data.get("purchase_date"),
        "description": f"شراء أصل ثابت: {asset['name']} ({asset_code})",
        "debit_account": dep_info["name_ar"],
        "debit_account_code": asset_acc_code,
        "credit_account": "النقدية بالبنوك الجارية",
        "credit_account_code": "162",
        "amount": cost, "type": "journal", "reference": asset_code, "source": "asset_purchase",
        "status": "posted",
    })
    return asset

@router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, update_data: dict, current_user: dict = Depends(get_current_user)):
    from datetime import datetime, timezone
    company_id = current_user.get("company_id")
    update_data.pop("id", None); update_data.pop("company_id", None)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.fixed_assets.update_one({"id": asset_id, "company_id": company_id}, {"$set": update_data})
    return await db.fixed_assets.find_one({"id": asset_id}, {"_id": 0})

@router.post("/assets/depreciation/run")
async def run_depreciation(request_data: dict, current_user: dict = Depends(get_current_user)):
    import uuid as _uuid
    from datetime import datetime, timezone
    company_id = current_user.get("company_id")
    period = request_data.get("period", datetime.now(timezone.utc).strftime("%Y-%m"))
    period_date = f"{period}-28"
    assets = await db.fixed_assets.find({"company_id": company_id, "status": "active"}, {"_id": 0}).to_list(10000)
    entries_created = []; total_depreciation = 0
    for asset in assets:
        dep = _calculate_depreciation(asset, period_date)
        monthly_dep = round(dep.get("annual_depreciation", 0) / 12, 2)
        if monthly_dep <= 0: continue
        await db.journal_entries.insert_one({
            "id": str(_uuid.uuid4()), "company_id": company_id,
            "date": f"{period}-28",
            "description": f"إهلاك {period}: {asset['name']} ({asset['asset_code']})",
            "debit_account": "إهلاكات الأصول الإدارية",
            "debit_account_code": "333",
            "credit_account": f"مجمع إهلاك — {asset.get('asset_type_ar', 'أصول')}",
            "credit_account_code": "222",
            "amount": monthly_dep, "type": "journal", "source": "depreciation",
            "asset_id": asset["id"], "period": period,
        })
        entries_created.append({"asset": asset["name"], "monthly_depreciation": monthly_dep})
        total_depreciation += monthly_dep
        await db.fixed_assets.update_one({"id": asset["id"]}, {
            "$inc": {"accumulated_depreciation": monthly_dep},
            "$set": {"book_value": max(0, dep["book_value"] - monthly_dep),
                     "updated_at": datetime.now(timezone.utc).isoformat()}
        })
    return {"period": period, "assets_processed": len(entries_created),
            "total_monthly_depreciation": round(total_depreciation, 2), "entries": entries_created}

@router.get("/assets/depreciation-rates")
async def get_depreciation_rates(current_user: dict = Depends(get_current_user)):
    return [{"key": k, **v, "useful_life_years": round(1/v["rate"]) if v["rate"] > 0 else 0}
            for k, v in EGYPTIAN_DEPRECIATION_RATES.items()]

@router.get("/assets/depreciation/schedule/{asset_id}")
async def get_depreciation_schedule(asset_id: str, current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id")
    asset = await db.fixed_assets.find_one({"id": asset_id, "company_id": company_id}, {"_id": 0})
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    from datetime import date
    try:
        start = date.fromisoformat(asset.get("service_date", asset.get("purchase_date", "2024-01-01")))
    except: return []
    cost = float(asset.get("cost", 0)); salvage = float(asset.get("salvage_value", 0))
    rate = float(asset.get("depreciation_rate", 0.1)); method = asset.get("depreciation_method", "straight_line")
    useful_life = asset.get("useful_life_years", round(1/rate) if rate > 0 else 10)
    schedule = []; book_value = cost; accumulated = 0
    for year in range(int(useful_life) + 1):
        if year == 0:
            schedule.append({"year": 0, "label": "بداية الخدمة", "opening_value": cost, "depreciation": 0, "accumulated": 0, "closing_value": cost})
            continue
        if book_value <= salvage: break
        dep = round((cost-salvage)*rate, 2) if method == "straight_line" else round(book_value*rate, 2)
        dep = min(dep, book_value - salvage)
        accumulated += dep; book_value -= dep
        schedule.append({"year": year, "label": f"السنة {year} ({start.year+year})",
            "opening_value": round(book_value+dep, 2), "depreciation": dep,
            "accumulated": round(accumulated, 2), "closing_value": round(book_value, 2)})
    return {"asset": asset["name"], "asset_code": asset["asset_code"], "schedule": schedule}

# ══ Egyptian Tax ══
EGYPTIAN_INCOME_TAX_BRACKETS = [
    {"from": 0,        "to": 40000,     "rate": 0.00},
    {"from": 40000,    "to": 55000,     "rate": 0.025},
    {"from": 55000,    "to": 70000,     "rate": 0.10},
    {"from": 70000,    "to": 200000,    "rate": 0.15},
    {"from": 200000,   "to": 400000,    "rate": 0.20},
    {"from": 400000,   "to": 1200000,   "rate": 0.225},
    {"from": 1200000,  "to": 999999999, "rate": 0.275},
]
PERSONAL_EXEMPTION_ANNUAL = 15000
SOCIAL_INSURANCE_EMPLOYEE_RATE = 0.11
SOCIAL_INSURANCE_EMPLOYER_RATE = 0.185
INSURANCE_MIN_WAGE = 2700
INSURANCE_MAX_WAGE = 11800
STAMP_DUTY_RATE = 0.0025

def _calc_income_tax_annual(annual_income: float) -> dict:
    taxable = max(0, annual_income - PERSONAL_EXEMPTION_ANNUAL)
    tax = 0.0; breakdown = []
    for bracket in EGYPTIAN_INCOME_TAX_BRACKETS:
        if taxable <= 0: break
        portion = min(taxable, bracket["to"] - bracket["from"])
        bracket_tax = portion * bracket["rate"]
        tax += bracket_tax
        breakdown.append({"from": bracket["from"], "to": bracket["to"],
            "rate": bracket["rate"], "taxable_portion": round(portion, 2), "tax": round(bracket_tax, 2)})
        taxable -= portion
    return {"annual_tax": round(tax, 2), "monthly_tax": round(tax/12, 2), "breakdown": breakdown}

@router.post("/tax/payroll-calculate")
async def calculate_payroll_tax(employee_data: dict, current_user: dict = Depends(get_current_user)):
    gross_monthly = float(employee_data.get("gross_monthly_salary", 0))
    allowances = float(employee_data.get("fixed_allowances", 0))
    variable = float(employee_data.get("variable_pay", 0))
    total_gross = gross_monthly + allowances + variable
    annual_gross = total_gross * 12
    insurance_base = max(INSURANCE_MIN_WAGE, min(gross_monthly, INSURANCE_MAX_WAGE))
    employee_insurance = round(insurance_base * SOCIAL_INSURANCE_EMPLOYEE_RATE, 2)
    employer_insurance = round(insurance_base * SOCIAL_INSURANCE_EMPLOYER_RATE, 2)
    tax_base_annual = annual_gross - (employee_insurance * 12)
    income_tax = _calc_income_tax_annual(tax_base_annual)
    stamp_duty = round(total_gross * STAMP_DUTY_RATE, 2)
    net_monthly = total_gross - employee_insurance - income_tax["monthly_tax"] - stamp_duty
    return {
        "gross_monthly": round(total_gross, 2), "annual_gross": round(annual_gross, 2),
        "social_insurance": {"employee_contribution": employee_insurance, "employer_contribution": employer_insurance, "insurance_base": insurance_base},
        "income_tax": {"annual_tax": income_tax["annual_tax"], "monthly_tax": income_tax["monthly_tax"],
            "tax_base_annual": round(tax_base_annual, 2), "bracket_breakdown": income_tax["breakdown"]},
        "stamp_duty": {"monthly": stamp_duty},
        "net_monthly": round(net_monthly, 2),
        "total_employer_cost": round(total_gross + employer_insurance, 2),
        "legal_reference": "قانون 91/2005 معدلاً بالقانون 26/2023 · قانون التأمين الاجتماعي 148/2019",
    }

@router.post("/tax/calculate-vat")
async def calculate_vat(data: dict, current_user: dict = Depends(get_current_user)):
    amount = float(data.get("amount", 0))
    vat_inclusive = data.get("vat_inclusive", False)
    vat_rate = float(data.get("vat_rate", 0.14))
    if vat_inclusive:
        net_amount = round(amount / (1 + vat_rate), 2)
        vat_amount = round(amount - net_amount, 2)
    else:
        net_amount = amount
        vat_amount = round(amount * vat_rate, 2)
    return {"net_amount": net_amount, "vat_rate": vat_rate, "vat_amount": vat_amount, "total_with_vat": round(net_amount + vat_amount, 2)}

@router.post("/tax/withholding-calculate")
async def calculate_withholding_tax(data: dict, current_user: dict = Depends(get_current_user)):
    service_type = data.get("service_type", "services")
    amount = float(data.get("amount", 0))
    WITHHOLDING_RATES = {
        "services":    {"rate": 0.01, "name": "الخدمات العامة"},
        "contracting": {"rate": 0.02, "name": "المقاولات والتوريدات"},
        "commission":  {"rate": 0.05, "name": "العمولات والوساطة"},
        "rent":        {"rate": 0.05, "name": "إيجار العقارات"},
        "professional":{"rate": 0.05, "name": "الأتعاب المهنية"},
        "dividends":   {"rate": 0.10, "name": "الأرباح الموزعة"},
        "non_resident":{"rate": 0.20, "name": "المدفوعات لغير المقيمين"},
    }
    wh_info = WITHHOLDING_RATES.get(service_type, WITHHOLDING_RATES["services"])
    tax_amount = round(amount * wh_info["rate"], 2)
    return {"gross_amount": amount, "service_type": service_type, "service_name": wh_info["name"],
            "withholding_rate": wh_info["rate"], "tax_withheld": tax_amount,
            "net_payment": round(amount - tax_amount, 2),
            "legal_reference": "قانون الضرائب 91/2005 المادة 59"}

@router.get("/tax/income-tax-brackets")
async def get_income_tax_brackets(current_user: dict = Depends(get_current_user)):
    return {"brackets": EGYPTIAN_INCOME_TAX_BRACKETS,
            "personal_exemption_annual": PERSONAL_EXEMPTION_ANNUAL,
            "social_insurance_rates": {"employee": SOCIAL_INSURANCE_EMPLOYEE_RATE,
                "employer": SOCIAL_INSURANCE_EMPLOYER_RATE,
                "min_wage": INSURANCE_MIN_WAGE, "max_wage": INSURANCE_MAX_WAGE},
            "stamp_duty_rate": STAMP_DUTY_RATE,
            "legal_reference": "قانون 91/2005 معدلاً بالقانون 26/2023"}
