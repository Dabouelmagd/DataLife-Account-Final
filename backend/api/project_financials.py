from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/projects", tags=["project-financials"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def verify_token_from_header(authorization: str):
    """Verify token from authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user_data


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


# ============ EXPENSE CATEGORIES ============
EXPENSE_CATEGORIES = {
    "materials": {"name_en": "Raw Materials", "name_ar": "مواد خام"},
    "labor": {"name_en": "Labor Costs", "name_ar": "أجور عمالة"},
    "equipment": {"name_en": "Equipment & Tools", "name_ar": "معدات وأدوات"},
    "administrative": {"name_en": "Administrative", "name_ar": "مصاريف إدارية"},
    "transport": {"name_en": "Transportation", "name_ar": "نقل ومواصلات"},
    "subcontractor": {"name_en": "Subcontractor", "name_ar": "مقاول من الباطن"},
    "utilities": {"name_en": "Utilities", "name_ar": "مرافق (كهرباء/ماء)"},
    "other": {"name_en": "Other Expenses", "name_ar": "مصاريف أخرى"}
}

# ============ REVENUE CATEGORIES ============
REVENUE_CATEGORIES = {
    "payment": {"name_en": "Client Payment", "name_ar": "دفعة من العميل"},
    "advance": {"name_en": "Advance Payment", "name_ar": "دفعة مقدمة"},
    "milestone": {"name_en": "Milestone Payment", "name_ar": "دفعة مستخلص"},
    "final": {"name_en": "Final Payment", "name_ar": "دفعة ختامية"},
    "retention": {"name_en": "Retention Release", "name_ar": "إفراج عن ضمان"},
    "other": {"name_en": "Other Revenue", "name_ar": "إيرادات أخرى"}
}


# ============ PROJECT EXPENSES ============

@router.post("/{project_id}/expenses")
async def add_project_expense(
    project_id: str,
    expense_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Add expense to a project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Verify project exists
    project = await db.projects.find_one({"id": project_id, "company_id": company_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    expense = {
        "id": generate_id("exp_"),
        "project_id": project_id,
        "company_id": company_id,
        "category": expense_data.get("category", "other"),
        "description": expense_data.get("description", ""),
        "amount": float(expense_data.get("amount", 0)),
        "date": expense_data.get("date", datetime.now(timezone.utc).date().isoformat()),
        "reference_number": expense_data.get("reference_number", ""),
        "vendor": expense_data.get("vendor", ""),
        "payment_method": expense_data.get("payment_method", "cash"),  # cash, bank, check
        "notes": expense_data.get("notes", ""),
        "attachments": expense_data.get("attachments", []),
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.project_expenses.insert_one(expense)
    if "_id" in expense:
        del expense["_id"]
    
    # Create journal entry for expense — يظهر في دفتر الأستاذ والميزانية
    project = await db.projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    project_name = project.get("name", project_id) if project else project_id
    cat_info = EXPENSE_CATEGORIES.get(expense.get("category", "other"), {})
    cat_name = cat_info.get("name_ar", "مصروف مشروع")
    credit_account = "البنك" if expense.get("payment_method", "cash") == "bank" else "الخزينة"
    import uuid as _uuid_exp
    # Map expense category to account code
    exp_account_map = {
        "labor": "312", "materials": "311", "equipment": "313",
        "overhead": "313", "subcontract": "312", "travel": "332",
        "utilities": "332", "other": "332"
    }
    exp_code = exp_account_map.get(expense.get("category","other"), "332")
    credit_code = "162" if expense.get("payment_method","cash") == "bank" else "161"
    import uuid as _uuid_exp2
    from services.accounting_service import AccountingService as _ACS
    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    _svc = _ACS(db)
    exp_acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": exp_code})
    cre_acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": credit_code})
    
    # Build proper lines[] format — posts to General Ledger + Trial Balance
    exp_amount = expense.get("amount", 0)
    je_lines = []
    if exp_acc:
        je_lines.append(JournalEntryLine(
            account_id=exp_acc["id"], account_code=exp_code,
            account_name=exp_acc.get("account_name", cat_name),
            debit=exp_amount, credit=0,
            description=f"مصروف مشروع: {expense.get('description', cat_name)}",
            project_id=project_id
        ))
    if cre_acc:
        je_lines.append(JournalEntryLine(
            account_id=cre_acc["id"], account_code=credit_code,
            account_name=cre_acc.get("account_name", credit_account),
            debit=0, credit=exp_amount,
            description=f"سداد مصروف مشروع ({credit_account})",
            project_id=project_id
        ))
    
    if je_lines:
        next_num = await _svc.get_next_entry_number(company_id)
        je_obj = JournalEntry(
            company_id=company_id,
            entry_number=next_num,
            entry_date=expense.get("date"),
            description=f"مصروف مشروع ({project_name}): {expense.get('description', cat_name)}",
            lines=je_lines,
            total_debit=exp_amount,
            total_credit=exp_amount,
            status=JournalEntryStatus.POSTED,
            source_document_type="project_expense",
            source_document_id=expense.get("id"),
            created_by=user_data.get("user_id","system"),
            fiscal_year=expense.get("date","")[:4],
            period=expense.get("date","")[:7],
        )
        je_dict = await _svc.create_journal_entry(je_obj)
        # Post to general_ledger — يظهر في الأستاذ العام + ميزان المراجعة + الميزانية
        try:
            await _svc.post_journal_entry(je_dict["id"], user_data.get("user_id","system"))
        except Exception as e:
            # If already posted or error, update balances manually
            try:
                if exp_acc: await _svc.update_account_balance(exp_acc["id"], exp_amount, 0)
                if cre_acc: await _svc.update_account_balance(cre_acc["id"], 0, exp_amount)
            except: pass

    # Update project total expenses
    await update_project_financials(project_id)
    
    return expense


@router.get("/{project_id}/expenses")
async def get_project_expenses(
    project_id: str,
    category: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all expenses for a project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {"project_id": project_id, "company_id": company_id}
    if category:
        query["category"] = category
    
    expenses = await db.project_expenses.find(query, {"_id": 0}).sort("date", -1).to_list(length=None)
    
    # Calculate totals by category
    totals_by_category = {}
    total_expenses = 0
    for exp in expenses:
        cat = exp.get("category", "other")
        amount = exp.get("amount", 0)
        totals_by_category[cat] = totals_by_category.get(cat, 0) + amount
        total_expenses += amount
    
    return {
        "expenses": expenses,
        "totals_by_category": totals_by_category,
        "total_expenses": total_expenses,
        "categories": EXPENSE_CATEGORIES
    }


@router.put("/{project_id}/expenses/{expense_id}")
async def update_project_expense(
    project_id: str,
    expense_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update a project expense"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    allowed_fields = ["category", "description", "amount", "date", "reference_number", 
                      "vendor", "payment_method", "notes", "attachments"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    if "amount" in update_fields:
        update_fields["amount"] = float(update_fields["amount"])
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.project_expenses.update_one(
        {"id": expense_id, "project_id": project_id, "company_id": company_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    await update_project_financials(project_id)
    
    return {"success": True}


@router.delete("/{project_id}/expenses/{expense_id}")
async def delete_project_expense(
    project_id: str,
    expense_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a project expense"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    result = await db.project_expenses.delete_one(
        {"id": expense_id, "project_id": project_id, "company_id": company_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    await update_project_financials(project_id)
    
    return {"success": True}


# ============ PROJECT REVENUES ============

@router.post("/{project_id}/revenues")
async def add_project_revenue(
    project_id: str,
    revenue_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Add revenue to a project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Verify project exists
    project = await db.projects.find_one({"id": project_id, "company_id": company_id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    revenue = {
        "id": generate_id("rev_"),
        "project_id": project_id,
        "company_id": company_id,
        "category": revenue_data.get("category", "payment"),
        "description": revenue_data.get("description", ""),
        "amount": float(revenue_data.get("amount", 0)),
        "date": revenue_data.get("date", datetime.now(timezone.utc).date().isoformat()),
        "invoice_number": revenue_data.get("invoice_number", ""),
        "payment_method": revenue_data.get("payment_method", "bank"),  # cash, bank, check
        "notes": revenue_data.get("notes", ""),
        "attachments": revenue_data.get("attachments", []),
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.project_revenues.insert_one(revenue)
    if "_id" in revenue:
        del revenue["_id"]
    
    # Create journal entry for revenue — يظهر في دفتر الأستاذ والميزانية
    project = await db.projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    project_name = project.get("name", project_id) if project else project_id
    rev_cat = REVENUE_CATEGORIES.get(revenue.get("category", "other"), {})
    rev_name = rev_cat.get("name_ar", "إيراد مشروع")
    debit_account = "البنك" if revenue.get("payment_method", "bank") == "bank" else "الخزينة"
    import uuid as _uuid_rev
    debit_code = "162" if revenue.get("payment_method","bank") == "bank" else "161"
    from services.accounting_service import AccountingService as _ACS2
    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    _svc2 = _ACS2(db)
    deb_acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": debit_code})
    rev_acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": "412"})
    
    # Build proper lines[] format — posts to General Ledger + Trial Balance + Balance Sheet
    rev_amount = revenue.get("amount", 0)
    rev_lines = []
    if deb_acc:
        rev_lines.append(JournalEntryLine(
            account_id=deb_acc["id"], account_code=debit_code,
            account_name=deb_acc.get("account_name", debit_account),
            debit=rev_amount, credit=0,
            description=f"تحصيل إيراد مشروع ({debit_account})",
            project_id=project_id
        ))
    if rev_acc:
        rev_lines.append(JournalEntryLine(
            account_id=rev_acc["id"], account_code="412",
            account_name=rev_acc.get("account_name", "إيرادات المشاريع"),
            debit=0, credit=rev_amount,
            description=f"إيراد مشروع: {revenue.get('description', rev_name)}",
            project_id=project_id
        ))
    
    if rev_lines:
        next_num2 = await _svc2.get_next_entry_number(company_id)
        rev_je_obj = JournalEntry(
            company_id=company_id,
            entry_number=next_num2,
            entry_date=revenue.get("date"),
            description=f"إيراد مشروع ({project_name}): {revenue.get('description', rev_name)}",
            lines=rev_lines,
            total_debit=rev_amount,
            total_credit=rev_amount,
            status=JournalEntryStatus.POSTED,
            source_document_type="project_revenue",
            source_document_id=revenue.get("id"),
            created_by=user_data.get("user_id","system"),
            fiscal_year=revenue.get("date","")[:4],
            period=revenue.get("date","")[:7],
        )
        rev_je_dict = await _svc2.create_journal_entry(rev_je_obj)
        # Post to general_ledger — يظهر في الأستاذ العام + ميزان المراجعة + الميزانية
        try:
            await _svc2.post_journal_entry(rev_je_dict["id"], user_data.get("user_id","system"))
        except Exception as e:
            try:
                if deb_acc: await _svc2.update_account_balance(deb_acc["id"], rev_amount, 0)
                if rev_acc: await _svc2.update_account_balance(rev_acc["id"], 0, rev_amount)
            except: pass

    # Update project total revenues
    await update_project_financials(project_id)
    
    return revenue


@router.get("/{project_id}/revenues")
async def get_project_revenues(
    project_id: str,
    category: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all revenues for a project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {"project_id": project_id, "company_id": company_id}
    if category:
        query["category"] = category
    
    revenues = await db.project_revenues.find(query, {"_id": 0}).sort("date", -1).to_list(length=None)
    
    # Calculate totals by category
    totals_by_category = {}
    total_revenues = 0
    for rev in revenues:
        cat = rev.get("category", "payment")
        amount = rev.get("amount", 0)
        totals_by_category[cat] = totals_by_category.get(cat, 0) + amount
        total_revenues += amount
    
    return {
        "revenues": revenues,
        "totals_by_category": totals_by_category,
        "total_revenues": total_revenues,
        "categories": REVENUE_CATEGORIES
    }


@router.put("/{project_id}/revenues/{revenue_id}")
async def update_project_revenue(
    project_id: str,
    revenue_id: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update a project revenue"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    allowed_fields = ["category", "description", "amount", "date", "invoice_number", 
                      "payment_method", "notes", "attachments"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    if "amount" in update_fields:
        update_fields["amount"] = float(update_fields["amount"])
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.project_revenues.update_one(
        {"id": revenue_id, "project_id": project_id, "company_id": company_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Revenue not found")
    
    await update_project_financials(project_id)
    
    return {"success": True}


@router.delete("/{project_id}/revenues/{revenue_id}")
async def delete_project_revenue(
    project_id: str,
    revenue_id: str,
    authorization: Optional[str] = Header(None)
):
    """Delete a project revenue"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    result = await db.project_revenues.delete_one(
        {"id": revenue_id, "project_id": project_id, "company_id": company_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Revenue not found")
    
    await update_project_financials(project_id)
    
    return {"success": True}


# ============ PROJECT FINANCIAL SUMMARY ============

async def update_project_financials(project_id: str):
    """Update project's financial totals"""
    # Calculate total expenses
    expenses = await db.project_expenses.find(
        {"project_id": project_id},
        {"amount": 1}
    ).to_list(length=None)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    
    # Calculate total revenues
    revenues = await db.project_revenues.find(
        {"project_id": project_id},
        {"amount": 1}
    ).to_list(length=None)
    total_revenues = sum(r.get("amount", 0) for r in revenues)
    
    # Calculate profit/loss
    profit_loss = total_revenues - total_expenses
    
    # Update project
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "total_expenses": total_expenses,
            "total_revenues": total_revenues,
            "profit_loss": profit_loss,
            "financial_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )


@router.get("/{project_id}/financials")
async def get_project_financials(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get complete financial summary for a project"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Get project
    project = await db.projects.find_one(
        {"id": project_id, "company_id": company_id},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get expenses
    expenses = await db.project_expenses.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    # Get revenues
    revenues = await db.project_revenues.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    # Calculate totals
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    total_revenues = sum(r.get("amount", 0) for r in revenues)
    profit_loss = total_revenues - total_expenses
    budget = project.get("budget", 0)
    budget_remaining = budget - total_expenses if budget > 0 else 0
    budget_usage_percent = (total_expenses / budget * 100) if budget > 0 else 0
    
    # Expenses by category
    expenses_by_category = {}
    for exp in expenses:
        cat = exp.get("category", "other")
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + exp.get("amount", 0)
    
    # Revenues by category
    revenues_by_category = {}
    for rev in revenues:
        cat = rev.get("category", "payment")
        revenues_by_category[cat] = revenues_by_category.get(cat, 0) + rev.get("amount", 0)
    
    # Monthly breakdown
    monthly_data = {}
    for exp in expenses:
        month = exp.get("date", "")[:7]  # YYYY-MM
        if month not in monthly_data:
            monthly_data[month] = {"expenses": 0, "revenues": 0}
        monthly_data[month]["expenses"] += exp.get("amount", 0)
    
    for rev in revenues:
        month = rev.get("date", "")[:7]
        if month not in monthly_data:
            monthly_data[month] = {"expenses": 0, "revenues": 0}
        monthly_data[month]["revenues"] += rev.get("amount", 0)
    
    return {
        "project": {
            "id": project.get("id"),
            "name": project.get("name"),
            "budget": budget,
            "status": project.get("status"),
            "start_date": project.get("start_date"),
            "end_date": project.get("end_date")
        },
        "summary": {
            "total_expenses": total_expenses,
            "total_revenues": total_revenues,
            "profit_loss": profit_loss,
            "profit_margin": round((profit_loss / total_revenues * 100), 2) if total_revenues > 0 else 0,
            "budget_remaining": budget_remaining,
            "budget_usage_percent": round(budget_usage_percent, 2)
        },
        "expenses": {
            "items": expenses,
            "by_category": expenses_by_category,
            "total": total_expenses,
            "categories": EXPENSE_CATEGORIES
        },
        "revenues": {
            "items": revenues,
            "by_category": revenues_by_category,
            "total": total_revenues,
            "categories": REVENUE_CATEGORIES
        },
        "monthly_breakdown": monthly_data
    }


@router.get("/all/financials-summary")
async def get_all_projects_financials(
    authorization: Optional[str] = Header(None)
):
    """Get financial summary for all projects"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Get all projects
    projects = await db.projects.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # Get all expenses and revenues
    all_expenses = await db.project_expenses.find(
        {"company_id": company_id},
        {"_id": 0, "project_id": 1, "amount": 1, "category": 1}
    ).to_list(length=None)
    
    all_revenues = await db.project_revenues.find(
        {"company_id": company_id},
        {"_id": 0, "project_id": 1, "amount": 1, "category": 1}
    ).to_list(length=None)
    
    # Calculate per-project totals
    project_expenses = {}
    project_revenues = {}
    
    for exp in all_expenses:
        pid = exp.get("project_id")
        project_expenses[pid] = project_expenses.get(pid, 0) + exp.get("amount", 0)
    
    for rev in all_revenues:
        pid = rev.get("project_id")
        project_revenues[pid] = project_revenues.get(pid, 0) + rev.get("amount", 0)
    
    # Build summary for each project
    project_summaries = []
    total_all_expenses = 0
    total_all_revenues = 0
    
    for project in projects:
        pid = project.get("id")
        expenses = project_expenses.get(pid, 0)
        revenues = project_revenues.get(pid, 0)
        profit_loss = revenues - expenses
        
        total_all_expenses += expenses
        total_all_revenues += revenues
        
        project_summaries.append({
            "id": pid,
            "name": project.get("name"),
            "status": project.get("status"),
            "budget": project.get("budget", 0),
            "total_expenses": expenses,
            "total_revenues": revenues,
            "profit_loss": profit_loss,
            "progress": project.get("progress", 0)
        })
    
    # Sort by profit/loss
    project_summaries.sort(key=lambda x: x["profit_loss"], reverse=True)
    
    return {
        "projects": project_summaries,
        "totals": {
            "total_projects": len(projects),
            "total_expenses": total_all_expenses,
            "total_revenues": total_all_revenues,
            "total_profit_loss": total_all_revenues - total_all_expenses,
            "profitable_projects": len([p for p in project_summaries if p["profit_loss"] > 0]),
            "loss_projects": len([p for p in project_summaries if p["profit_loss"] < 0])
        }
    }


# ============ CATEGORIES ENDPOINTS ============

@router.get("/categories/expenses")
async def get_expense_categories():
    """Get all expense categories"""
    return EXPENSE_CATEGORIES


@router.get("/categories/revenues")
async def get_revenue_categories():
    """Get all revenue categories"""
    return REVENUE_CATEGORIES
