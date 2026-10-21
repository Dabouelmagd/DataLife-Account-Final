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


# ============ SIMPLE VIEW: overview + combined movements ============
# Read-only. Both read the same collections the add/cancel routes write
# (projects, project_expenses, project_revenues, attachments); nothing stored
# changes shape. Cancelled items stay listed but count for nothing, exactly
# like /{project_id}/financials.

def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _money_summary(budget: float, revenue: float, expenses: float) -> dict:
    budget = _num(budget)
    return {
        "budget": round(budget, 2),
        "revenue": round(revenue, 2),
        "expenses": round(expenses, 2),
        "profit": round(revenue - expenses, 2),
        "remaining": round(budget - expenses, 2) if budget > 0 else None,
        "spent_pct": round(expenses / budget * 100, 1) if budget > 0 else None,
    }


async def projects_overview(company_id: str) -> dict:
    """Every project of this company with its revenue / expenses to date."""
    projects = await db.projects.find({"company_id": company_id}, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    sums = {}
    for kind, coll in (("expenses", db.project_expenses), ("revenue", db.project_revenues)):
        async for it in coll.find({"company_id": company_id, "status": {"$ne": "cancelled"}},
                                  {"_id": 0, "project_id": 1, "amount": 1}):
            row = sums.setdefault(it.get("project_id"), {"expenses": 0.0, "revenue": 0.0})
            row[kind] += _num(it.get("amount"))
    out, tot = [], {"budget": 0.0, "revenue": 0.0, "expenses": 0.0}
    for p in projects:
        s = sums.get(p.get("id"), {"expenses": 0.0, "revenue": 0.0})
        m = _money_summary(p.get("budget"), s["revenue"], s["expenses"])
        tot["budget"] += m["budget"]; tot["revenue"] += m["revenue"]; tot["expenses"] += m["expenses"]
        out.append({"id": p.get("id"), "name": p.get("name"), "client_name": p.get("client_name") or "",
                    "status": p.get("status") or "planning", "start_date": p.get("start_date"),
                    "end_date": p.get("end_date"), "notes": p.get("notes") or "",
                    "description": p.get("description") or "", "progress": p.get("progress", 0), **m})
    return {"projects": out, "totals": {k: round(v, 2) for k, v in tot.items()} |
            {"profit": round(tot["revenue"] - tot["expenses"], 2), "count": len(out)}}


async def project_movements(company_id: str, project_id: str, kind: Optional[str] = None) -> dict:
    """One list of a project's revenues and expenses, newest first, with totals."""
    project = await db.projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
    q = {"project_id": project_id, "company_id": company_id}
    rows = []
    for k, coll in (("expense", db.project_expenses), ("revenue", db.project_revenues)):
        async for it in coll.find(q, {"_id": 0}):
            rows.append((k, it))
    ids = [it["id"] for _, it in rows if it.get("id")]
    files = {}
    if ids:
        async for a in db.attachments.find(
                {"company_id": company_id, "entity_type": {"$in": ["project_expense", "project_revenue"]},
                 "entity_id": {"$in": ids}}, {"_id": 0, "id": 1, "entity_id": 1, "filename": 1}):
            files.setdefault(a["entity_id"], []).append({"id": a["id"], "filename": a.get("filename")})
    revenue = sum(_num(it.get("amount")) for k, it in rows if k == "revenue" and it.get("status") != "cancelled")
    expenses = sum(_num(it.get("amount")) for k, it in rows if k == "expense" and it.get("status") != "cancelled")
    movements = [{
        "id": it.get("id"), "kind": k, "date": it.get("date"), "description": it.get("description") or "",
        "amount": round(_num(it.get("amount")), 2), "category": it.get("category"),
        "party": (it.get("vendor") if k == "expense" else it.get("customer")) or "",
        "paid_from": it.get("paid_from"), "paid_from_code": it.get("paid_from_code"),
        "paid_from_name": it.get("paid_from_name") or "", "payment_method": it.get("payment_method"),
        "account_code": it.get("account_code"), "account_name": it.get("account_name"),
        "journal_entry_number": it.get("journal_entry_number"), "status": it.get("status") or "posted",
        "cancel_reason": it.get("cancel_reason"), "created_at": it.get("created_at"),
        "attachments": files.get(it.get("id"), []),
    } for k, it in rows if kind in (None, "", k)]
    movements.sort(key=lambda m: (str(m["date"] or ""), str(m["created_at"] or "")), reverse=True)
    return {
        "project": {"id": project["id"], "name": project.get("name"), "client_name": project.get("client_name") or "",
                    "status": project.get("status") or "planning", "start_date": project.get("start_date"),
                    "end_date": project.get("end_date"), "notes": project.get("notes") or "",
                    "description": project.get("description") or "", "budget": _num(project.get("budget"))},
        "summary": _money_summary(project.get("budget"), revenue, expenses) | {
            "count": len([m for m in movements if m["status"] != "cancelled"])},
        "movements": movements,
    }


@router.get("/all/overview")
async def get_projects_overview(authorization: Optional[str] = Header(None)):
    """قائمة المشاريع مع الإيرادات والمصروفات والربح ونسبة صرف الميزانية."""
    user_data = await verify_token_from_header(authorization)
    return await projects_overview(user_data.get("company_id"))


@router.get("/{project_id}/movements")
async def get_project_movements(project_id: str, kind: Optional[str] = None,
                                authorization: Optional[str] = Header(None)):
    """كل حركات المشروع (إيرادات ومصروفات) في جدول واحد مع الملخص."""
    user_data = await verify_token_from_header(authorization)
    return await project_movements(user_data.get("company_id"), project_id,
                                   kind if kind in ("revenue", "expense") else None)


# ============ PROJECT EXPENSES ============

async def _posted_entry_for(company_id: str, doc_type: str, doc_id: str):
    """The journal entry a project expense/revenue produced, if it was posted."""
    return await db.journal_entries.find_one(
        {"company_id": company_id, "source_document_type": doc_type,
         "source_document_id": doc_id, "status": {"$in": ["posted", "POSTED"]}},
        {"_id": 0, "id": 1, "entry_number": 1})


async def _add_item(kind: str, project_id: str, data: dict, authorization: Optional[str]):
    """Save a project expense / revenue together with its posted journal entry."""
    from services.project_posting import post_item
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    project = await db.projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
    try:
        amount = float(data.get("amount") or 0)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="المبلغ غير صحيح")
    item = {
        "id": generate_id("exp_" if kind == "expense" else "rev_"),
        "project_id": project_id, "company_id": company_id,
        "category": data.get("category") or ("other" if kind == "expense" else "payment"),
        "description": str(data.get("description") or "").strip(),
        "amount": amount,
        "date": str(data.get("date") or datetime.now(timezone.utc).date().isoformat())[:10],
        "vendor": data.get("vendor", "") if kind == "expense" else None,
        "customer": data.get("customer", "") if kind == "revenue" else None,
        "reference_number": data.get("reference_number", ""),
        "invoice_number": data.get("invoice_number", "") if kind == "revenue" else None,
        "notes": data.get("notes", ""),
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # older clients sent payment_method cash / bank
    source = data.get("paid_from") or {"cash": "cash", "bank": "account:162"}.get(data.get("payment_method"), "")
    try:
        posting = await post_item(db, company_id, user_data.get("user_id"), kind=kind, project=project,
                                  item=item, source=source, account_id=data.get("account_id") or None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    item.update(posting)
    item["payment_method"] = "cash" if posting["paid_from_code"] == "161" else \
        ("bank" if posting["paid_from_code"].startswith("16") else "account")
    await (db.project_expenses if kind == "expense" else db.project_revenues).insert_one(dict(item))
    await update_project_financials(project_id)
    return {**item, "message": f"تم التسجيل وترحيل القيد {posting['journal_entry_number']}"}


@router.get("/{project_id}/money-options")
async def project_money_options(project_id: str, kind: str = "expense",
                                authorization: Optional[str] = Header(None)):
    """Choices for the add form: where money comes from / goes, and the
    account each category books to in this company's chart."""
    from services.project_posting import money_options, chart, account_for, EXPENSE_ACCOUNTS, REVENUE_ACCOUNTS
    user_data = await verify_token_from_header(authorization)
    cid = user_data.get("company_id")
    if not await db.projects.find_one({"id": project_id, "company_id": cid}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="المشروع غير موجود")
    kind = "revenue" if kind == "revenue" else "expense"
    ch = await chart(db, cid)
    cats = {}
    for cat in (EXPENSE_ACCOUNTS if kind == "expense" else REVENUE_ACCOUNTS):
        a = account_for(ch, kind, cat)
        if a:
            cats[cat] = {"account_id": a["id"], "account_code": a["account_code"], "account_name": a["account_name"]}
    want = kind
    accounts = [{"id": a["id"], "account_code": c, "account_name": a["account_name"]}
                for c, a in sorted(ch.items())
                if str(getattr(a.get("account_type"), "value", a.get("account_type"))) == want
                and not (a.get("is_header") or a.get("account_category") == "header")]
    return {"sources": await money_options(db, cid, kind), "categories": cats, "accounts": accounts}


async def _cancel_item(kind: str, project_id: str, item_id: str, body: Optional[dict],
                       authorization: Optional[str]):
    from services.project_posting import cancel_item
    user_data = await verify_token_from_header(authorization)
    cid = user_data.get("company_id")
    coll = db.project_expenses if kind == "expense" else db.project_revenues
    item = await coll.find_one({"id": item_id, "project_id": project_id, "company_id": cid}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="غير موجود")
    if item.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="مُلغى من قبل")
    reason = str((body or {}).get("reason") or "").strip()
    if len(reason) < 3:
        raise HTTPException(status_code=400, detail="اكتب سبب الإلغاء")
    try:
        r = await cancel_item(db, cid, user_data.get("user_id"), kind, item, reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await update_project_financials(project_id)
    return {"message": "تم الإلغاء" + (f" بقيد عكسي {r['reversal_entry_number']}" if r["reversal_entry_number"] else ""), **r}


@router.post("/{project_id}/expenses/{expense_id}/cancel")
async def cancel_project_expense(project_id: str, expense_id: str, body: Optional[dict] = None,
                                 authorization: Optional[str] = Header(None)):
    """إلغاء مصروف مرحّل بقيد عكسي بنفس تاريخه."""
    return await _cancel_item("expense", project_id, expense_id, body, authorization)


@router.post("/{project_id}/revenues/{revenue_id}/cancel")
async def cancel_project_revenue(project_id: str, revenue_id: str, body: Optional[dict] = None,
                                 authorization: Optional[str] = Header(None)):
    """إلغاء إيراد مرحّل بقيد عكسي بنفس تاريخه."""
    return await _cancel_item("revenue", project_id, revenue_id, body, authorization)


@router.post("/{project_id}/expenses")
async def add_project_expense(
    project_id: str,
    expense_data: dict,
    authorization: Optional[str] = Header(None)
):
    """إضافة مصروف للمشروع — يُرحَّل قيده في نفس اللحظة."""
    return await _add_item("expense", project_id, expense_data, authorization)


@router.get("/categories/expenses")
async def get_expense_categories():
    """Get all expense categories"""
    return EXPENSE_CATEGORIES


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
    
    # The entry is already in the ledger: changing the amount here would leave
    # the project report and the ledger saying different things. Descriptive
    # fields stay editable; money does not.
    posted = await _posted_entry_for(company_id, "project_expense", expense_id)
    money = {"amount", "category", "payment_method", "date"}
    if posted and money & set(update_data or {}):
        raise HTTPException(status_code=400,
                            detail=f"المصروف مُرحّل بالقيد رقم {posted.get('entry_number')} — "
                                   f"لا يمكن تعديل المبلغ أو التصنيف أو التاريخ؛ سجّل قيداً عكسياً أو مصروفاً مصححاً")

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
    
    posted = await _posted_entry_for(company_id, "project_expense", expense_id)
    if posted:
        raise HTTPException(status_code=400,
                            detail=f"المصروف مُرحّل بالقيد رقم {posted.get('entry_number')} — "
                                   f"لا يمكن حذفه؛ القيد سيبقى في الدفتر بلا مستند")

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
    """إضافة إيراد للمشروع — يُرحَّل قيده في نفس اللحظة."""
    return await _add_item("revenue", project_id, revenue_data, authorization)


@router.get("/categories/revenues")
async def get_revenue_categories():
    """Get all revenue categories"""
    return REVENUE_CATEGORIES


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
    
    posted = await _posted_entry_for(company_id, "project_revenue", revenue_id)
    money = {"amount", "category", "payment_method", "date"}
    if posted and money & set(update_data or {}):
        raise HTTPException(status_code=400,
                            detail=f"الإيراد مُرحّل بالقيد رقم {posted.get('entry_number')} — "
                                   f"لا يمكن تعديل المبلغ أو التاريخ؛ أصدر إشعاراً دائناً أو قيداً عكسياً")

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
    
    posted = await _posted_entry_for(company_id, "project_revenue", revenue_id)
    if posted:
        raise HTTPException(status_code=400,
                            detail=f"الإيراد مُرحّل بالقيد رقم {posted.get('entry_number')} — لا يمكن حذفه")

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
        {"project_id": project_id, "status": {"$ne": "cancelled"}},   # a cancelled item is reversed in the books
        {"amount": 1}
    ).to_list(length=None)
    total_expenses = sum(e.get("amount", 0) for e in expenses)
    
    # Calculate total revenues
    revenues = await db.project_revenues.find(
        {"project_id": project_id, "status": {"$ne": "cancelled"}},   # a cancelled item is reversed in the books
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
    
    # Get expenses — strictly from project_expenses collection
    expenses = await db.project_expenses.find(
        {"project_id": project_id, "company_id": company_id},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    # Safety: filter out any document that has revenue markers
    expenses = [e for e in expenses if not e.get("invoice_number") or e.get("amount", 0) > 0]
    
    # Get revenues — strictly from project_revenues collection
    revenues = await db.project_revenues.find(
        {"project_id": project_id, "company_id": company_id},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    # cancelled items stay listed (with their reversal) but count for nothing
    all_expenses, all_revenues = expenses, revenues
    expenses = [e for e in expenses if e.get("status") != "cancelled"]
    revenues = [r for r in revenues if r.get("status") != "cancelled"]

    # does the ledger agree? the project's posted entries, net of reversals
    ledger = {"project_expense": 0.0, "project_revenue": 0.0}
    posted_ids = set()
    async for je in db.journal_entries.find(
            {"company_id": company_id, "source_document_type": {"$in": list(ledger)},
             "status": "posted", "source_document_id": {"$in": [i["id"] for i in all_expenses + all_revenues]}},
            {"_id": 0, "source_document_type": 1, "total_debit": 1, "source_document_id": 1}):
        ledger[je["source_document_type"]] += float(je.get("total_debit") or 0)
        posted_ids.add(je.get("source_document_id"))

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
        "ledger_check": {
            "expenses_in_ledger": round(ledger["project_expense"], 2),
            "revenues_in_ledger": round(ledger["project_revenue"], 2),
            "unposted": [i["id"] for i in expenses + revenues if i["id"] not in posted_ids],
        },
        "expenses": {
            "items": all_expenses,
            "by_category": expenses_by_category,
            "total": total_expenses,
            "categories": EXPENSE_CATEGORIES
        },
        "revenues": {
            "items": all_revenues,
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
        {"company_id": company_id, "status": {"$ne": "cancelled"}},   # reversed in the books
        {"_id": 0, "project_id": 1, "amount": 1, "category": 1}
    ).to_list(length=None)
    
    all_revenues = await db.project_revenues.find(
        {"company_id": company_id, "status": {"$ne": "cancelled"}},
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

