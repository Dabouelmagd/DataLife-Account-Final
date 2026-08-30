from fastapi.responses import JSONResponse
from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from services.auth_service import verify_token
from database import db
from datetime import datetime, timedelta
import asyncio
from collections import defaultdict


# ── Cache helper for analytics responses ───────────────
def cached_response(data: dict, max_age: int = 300) -> JSONResponse:
    """Return analytics data with 5-minute browser cache (300s default)"""
    return JSONResponse(
        content=data,
        headers={"Cache-Control": f"private, max-age={max_age}, stale-while-revalidate=60"}
    )


router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def get_analytics_overview(
    period: str = "monthly",  # daily, monthly, yearly
    authorization: Optional[str] = Header(None)
):
    """
    Get overview analytics for dashboard
    Includes: total employees, total customers, total suppliers, inventory value, 
    total revenue, total expenses, financial summary
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    
    # Calculate date ranges based on period
    now = datetime.utcnow()
    if period == "daily":
        start_date = now - timedelta(days=1)
    elif period == "monthly":
        start_date = now - timedelta(days=30)
    else:  # yearly
        start_date = now - timedelta(days=365)
    
    # HR Analytics
    total_employees = await db.employees.count_documents({"company_id": company_id})
    total_allowances = await db.allowances.count_documents({"company_id": company_id})
    total_deductions = await db.deductions.count_documents({"company_id": company_id})
    total_leaves = await db.leaves.count_documents({"company_id": company_id})
    
    # Financial Analytics
    total_customers = await db.customers.count_documents({"company_id": company_id})
    total_suppliers = await db.suppliers.count_documents({"company_id": company_id})
    
    # Journal Entries for revenue/expenses
    journal_entries = await db.journal_entries.find({"company_id": company_id}).to_list(length=None)
    total_revenue = sum(entry.get('credit', 0) for entry in journal_entries if entry.get('credit', 0) > 0)
    total_expenses = sum(entry.get('debit', 0) for entry in journal_entries if entry.get('debit', 0) > 0)
    
    # Inventory Analytics
    inventory_items = await db.inventory_items.find({"company_id": company_id}).to_list(length=None)
    total_inventory_value = sum(item.get('total_value', 0) for item in inventory_items)
    total_inventory_items = len(inventory_items)
    low_stock_items = sum(1 for item in inventory_items if item.get('status') == 'low-stock')
    
    # Calculate growth rates (compare with previous period)
    prev_start_date = start_date - (now - start_date)
    
    return {
        "period": period,
        "hr_analytics": {
            "total_employees": total_employees,
            "total_allowances": total_allowances,
            "total_deductions": total_deductions,
            "total_leaves": total_leaves
        },
        "financial_analytics": {
            "total_customers": total_customers,
            "total_suppliers": total_suppliers,
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_profit": total_revenue - total_expenses,
            "profit_margin": ((total_revenue - total_expenses) / total_revenue * 100) if total_revenue > 0 else 0
        },
        "inventory_analytics": {
            "total_items": total_inventory_items,
            "total_value": total_inventory_value,
            "low_stock_items": low_stock_items,
            "in_stock_items": total_inventory_items - low_stock_items
        }
    }


@router.get("/financial")
async def get_financial_analytics(
    period: str = "monthly",
    authorization: Optional[str] = Header(None)
):
    """
    Get detailed financial analytics
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    
    # Get all financial data
    journal_entries, treasury_transactions, bank_transactions, customers, suppliers = await asyncio.gather(
        db.journal_entries.find({"company_id": company_id}).to_list(length=None),
        db.treasury.find({"company_id": company_id}).to_list(length=None),
        db.bank.find({"company_id": company_id}).to_list(length=None),
        db.customers.find({"company_id": company_id}).to_list(length=None),
        db.suppliers.find({"company_id": company_id}).to_list(length=None),
    )
    
    # Calculate revenue by month
    revenue_by_month = defaultdict(float)
    expenses_by_month = defaultdict(float)
    
    for entry in journal_entries:
        if 'date' in entry:
            try:
                if isinstance(entry['date'], str):
                    date = datetime.fromisoformat(entry['date'])
                else:
                    date = entry['date']
                month_key = date.strftime("%Y-%m")
                
                if entry.get('credit', 0) > 0:
                    revenue_by_month[month_key] += entry.get('credit', 0)
                if entry.get('debit', 0) > 0:
                    expenses_by_month[month_key] += entry.get('debit', 0)
            except:
                pass
    
    # Convert to lists for frontend
    revenue_data = [{"month": k, "amount": v} for k, v in sorted(revenue_by_month.items())]
    expenses_data = [{"month": k, "amount": v} for k, v in sorted(expenses_by_month.items())]
    
    # Customer balances
    customer_balances = [
        {
            "name": c.get('name', 'Unknown'),
            "balance": c.get('balance', 0)
        }
        for c in customers
    ]
    
    # Supplier balances
    supplier_balances = [
        {
            "name": s.get('name', 'Unknown'),
            "balance": s.get('balance', 0)
        }
        for s in suppliers
    ]
    
    return {
        "revenue_by_month": revenue_data[-12:],  # Last 12 months
        "expenses_by_month": expenses_data[-12:],
        "customer_balances": customer_balances[:10],  # Top 10
        "supplier_balances": supplier_balances[:10],
        "total_customers": len(customers),
        "total_suppliers": len(suppliers),
        "total_revenue": sum(revenue_by_month.values()),
        "total_expenses": sum(expenses_by_month.values())
    }


@router.get("/hr")
async def get_hr_analytics(
    period: str = "monthly",
    authorization: Optional[str] = Header(None)
):
    """
    Get detailed HR analytics
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    
    # Get all HR data in PARALLEL
    employees, allowances, deductions, leaves, attendance = await asyncio.gather(
        db.employees.find({"company_id": company_id}).to_list(length=None),
        db.allowances.find({"company_id": company_id}).to_list(length=None),
        db.deductions.find({"company_id": company_id}).to_list(length=None),
        db.leaves.find({"company_id": company_id}).to_list(length=None),
        db.attendance.find({"company_id": company_id}).to_list(length=None),
    )
    
    # Employees by department
    department_count = defaultdict(int)
    for emp in employees:
        dept = emp.get('department', 'Unknown')
        department_count[dept] += 1
    
    department_data = [{"department": k, "count": v} for k, v in department_count.items()]
    
    # Salary distribution
    salary_ranges = {"0-5000": 0, "5000-10000": 0, "10000-15000": 0, "15000+": 0}
    for emp in employees:
        salary = emp.get('salary', 0)
        if salary < 5000:
            salary_ranges["0-5000"] += 1
        elif salary < 10000:
            salary_ranges["5000-10000"] += 1
        elif salary < 15000:
            salary_ranges["10000-15000"] += 1
        else:
            salary_ranges["15000+"] += 1
    
    # Leave types
    leave_types = defaultdict(int)
    for leave in leaves:
        leave_type = leave.get('leave_type', 'Unknown')
        leave_types[leave_type] += 1
    
    leave_data = [{"type": k, "count": v} for k, v in leave_types.items()]
    
    # Attendance statistics
    attendance_by_month = defaultdict(lambda: {"present": 0, "absent": 0})
    for att in attendance:
        if 'date' in att:
            try:
                if isinstance(att['date'], str):
                    date = datetime.fromisoformat(att['date'])
                else:
                    date = att['date']
                month_key = date.strftime("%Y-%m")
                
                status = att.get('status', 'present')
                if status == 'present':
                    attendance_by_month[month_key]["present"] += 1
                else:
                    attendance_by_month[month_key]["absent"] += 1
            except:
                pass
    
    attendance_data = [
        {
            "month": k,
            "present": v["present"],
            "absent": v["absent"]
        }
        for k, v in sorted(attendance_by_month.items())
    ]
    
    return {
        "total_employees": len(employees),
        "department_distribution": department_data,
        "salary_distribution": [{"range": k, "count": v} for k, v in salary_ranges.items()],
        "leave_statistics": leave_data,
        "attendance_data": attendance_data[-12:],  # Last 12 months
        "total_allowances": len(allowances),
        "total_deductions": len(deductions),
        "total_leaves": len(leaves)
    }


@router.get("/inventory")
async def get_inventory_analytics(
    period: str = "monthly",
    authorization: Optional[str] = Header(None)
):
    """
    Get detailed inventory analytics
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    
    # Get all inventory items
    items = await db.inventory_items.find({"company_id": company_id}).to_list(length=None)
    
    # Category distribution
    category_count = defaultdict(int)
    category_value = defaultdict(float)
    for item in items:
        category = item.get('category', 'Unknown')
        category_count[category] += 1
        category_value[category] += item.get('total_value', 0)
    
    category_data = [
        {
            "category": k,
            "count": category_count[k],
            "value": category_value[k]
        }
        for k in category_count.keys()
    ]
    
    # Status distribution
    status_count = {"in-stock": 0, "low-stock": 0}
    for item in items:
        status = item.get('status', 'in-stock')
        status_count[status] += 1
    
    # Top items by value
    top_items = sorted(items, key=lambda x: x.get('total_value', 0), reverse=True)[:10]
    top_items_data = [
        {
            "name": item.get('name', 'Unknown'),
            "value": item.get('total_value', 0),
            "quantity": item.get('quantity', 0)
        }
        for item in top_items
    ]
    
    # Low stock alerts
    low_stock_items = [
        {
            "name": item.get('name', 'Unknown'),
            "quantity": item.get('quantity', 0),
            "min_stock": item.get('min_stock', 0)
        }
        for item in items if item.get('status') == 'low-stock'
    ]
    
    return {
        "total_items": len(items),
        "total_value": sum(item.get('total_value', 0) for item in items),
        "category_distribution": category_data,
        "status_distribution": [{"status": k, "count": v} for k, v in status_count.items()],
        "top_items_by_value": top_items_data,
        "low_stock_alerts": low_stock_items,
        "in_stock_count": status_count["in-stock"],
        "low_stock_count": status_count["low-stock"]
    }


@router.get("/financial-reports")
async def get_financial_reports(
    period_type: str = "year",  # year, quarter, month, custom
    year: Optional[int] = None,
    quarter: Optional[int] = None,
    month: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    compare: bool = False,
    authorization: Optional[str] = Header(None)
):
    """
    Get financial reports with advanced date filtering
    
    period_type: year, quarter, month, custom
    year: Year to filter (e.g., 2024)
    quarter: Quarter number (1-4)
    month: Month number (1-12)
    start_date: Custom start date (ISO format)
    end_date: Custom end date (ISO format)
    compare: Compare with previous period
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    company_id = user_data.get("company_id")
    now = datetime.utcnow()
    
    # Determine date range based on period type
    if period_type == "custom" and start_date and end_date:
        try:
            filter_start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            filter_end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            raise HTTPException(status_code=400, detail="Invalid date format")
    elif period_type == "year":
        filter_year = year or now.year
        filter_start = datetime(filter_year, 1, 1)
        filter_end = datetime(filter_year, 12, 31, 23, 59, 59)
    elif period_type == "quarter":
        filter_year = year or now.year
        filter_quarter = quarter or ((now.month - 1) // 3 + 1)
        quarter_start_month = (filter_quarter - 1) * 3 + 1
        filter_start = datetime(filter_year, quarter_start_month, 1)
        if filter_quarter == 4:
            filter_end = datetime(filter_year, 12, 31, 23, 59, 59)
        else:
            filter_end = datetime(filter_year, quarter_start_month + 3, 1) - timedelta(seconds=1)
    elif period_type == "month":
        filter_year = year or now.year
        filter_month = month or now.month
        filter_start = datetime(filter_year, filter_month, 1)
        if filter_month == 12:
            filter_end = datetime(filter_year + 1, 1, 1) - timedelta(seconds=1)
        else:
            filter_end = datetime(filter_year, filter_month + 1, 1) - timedelta(seconds=1)
    else:
        # Default to current year
        filter_start = datetime(now.year, 1, 1)
        filter_end = datetime(now.year, 12, 31, 23, 59, 59)
    
    # Calculate previous period for comparison
    period_duration = filter_end - filter_start
    prev_start = filter_start - period_duration - timedelta(days=1)
    prev_end = filter_start - timedelta(seconds=1)
    
    # Get financial data with date filter
    async def get_period_data(start, end):
        # Journal Entries
        journal_entries = await db.journal_entries.find({"company_id": company_id}).to_list(length=None)
        
        # Filter by date
        filtered_entries = []
        for entry in journal_entries:
            if 'date' in entry:
                try:
                    if isinstance(entry['date'], str):
                        entry_date = datetime.fromisoformat(entry['date'].replace('Z', '+00:00'))
                    else:
                        entry_date = entry['date']
                    
                    if start <= entry_date <= end:
                        filtered_entries.append(entry)
                except:
                    pass
        
        # Calculate totals
        total_revenue = sum(e.get('credit', 0) for e in filtered_entries if e.get('credit', 0) > 0)
        total_expenses = sum(e.get('debit', 0) for e in filtered_entries if e.get('debit', 0) > 0)
        net_profit = total_revenue - total_expenses
        
        # Revenue by category
        revenue_by_category = defaultdict(float)
        expenses_by_category = defaultdict(float)
        
        for entry in filtered_entries:
            category = entry.get('category', 'Other')
            if entry.get('credit', 0) > 0:
                revenue_by_category[category] += entry.get('credit', 0)
            if entry.get('debit', 0) > 0:
                expenses_by_category[category] += entry.get('debit', 0)
        
        # Monthly breakdown
        monthly_data = defaultdict(lambda: {"revenue": 0, "expenses": 0, "profit": 0})
        for entry in filtered_entries:
            if 'date' in entry:
                try:
                    if isinstance(entry['date'], str):
                        entry_date = datetime.fromisoformat(entry['date'].replace('Z', '+00:00'))
                    else:
                        entry_date = entry['date']
                    month_key = entry_date.strftime("%Y-%m")
                    
                    if entry.get('credit', 0) > 0:
                        monthly_data[month_key]["revenue"] += entry.get('credit', 0)
                    if entry.get('debit', 0) > 0:
                        monthly_data[month_key]["expenses"] += entry.get('debit', 0)
                    monthly_data[month_key]["profit"] = monthly_data[month_key]["revenue"] - monthly_data[month_key]["expenses"]
                except:
                    pass
        
        return {
            "total_revenue": total_revenue,
            "total_expenses": total_expenses,
            "net_profit": net_profit,
            "profit_margin": round((net_profit / total_revenue * 100), 2) if total_revenue > 0 else 0,
            "revenue_by_category": [{"category": k, "amount": v} for k, v in revenue_by_category.items()],
            "expenses_by_category": [{"category": k, "amount": v} for k, v in expenses_by_category.items()],
            "monthly_breakdown": [
                {"month": k, **v} for k, v in sorted(monthly_data.items())
            ],
            "transactions_count": len(filtered_entries)
        }
    
    # Get current period data
    current_data = await get_period_data(filter_start, filter_end)
    
    # Get comparison data if requested
    comparison_data = None
    growth_rates = None
    if compare:
        comparison_data = await get_period_data(prev_start, prev_end)
        
        # Calculate growth rates
        prev_revenue = comparison_data["total_revenue"] or 1
        prev_expenses = comparison_data["total_expenses"] or 1
        prev_profit = comparison_data["net_profit"] or 1
        
        growth_rates = {
            "revenue_growth": round(((current_data["total_revenue"] - comparison_data["total_revenue"]) / prev_revenue * 100), 2),
            "expenses_growth": round(((current_data["total_expenses"] - comparison_data["total_expenses"]) / prev_expenses * 100), 2),
            "profit_growth": round(((current_data["net_profit"] - comparison_data["net_profit"]) / abs(prev_profit) * 100), 2) if prev_profit != 0 else 0
        }
    
    return {
        "period": {
            "type": period_type,
            "start_date": filter_start.isoformat(),
            "end_date": filter_end.isoformat(),
            "year": year or filter_start.year,
            "quarter": quarter,
            "month": month
        },
        "current": current_data,
        "comparison": comparison_data,
        "growth_rates": growth_rates
    }


# ─── NEW COMPREHENSIVE ANALYTICS ──────────────────────────────────────────────

@router.get("/payroll")
async def get_payroll_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    """Payroll analytics — salary costs, run history, department costs"""
    user_data = _get_user(authorization)
    company_id = user_data.get("company_id")
    start_date = _start_date(period)

    runs = await db.payroll_runs.find(
        {"company_id": company_id, "created_at": {"$gte": start_date.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)

    employees = await db.employees.find({"company_id": company_id}, {"_id": 0}).to_list(None)

    total_gross = sum(r.get("total_gross", 0) for r in runs)
    total_net   = sum(r.get("total_net", 0) for r in runs)
    total_tax   = sum(r.get("total_tax", 0) for r in runs)
    total_ins   = sum(r.get("total_insurance", 0) for r in runs)

    # Monthly cost trend
    monthly = {}
    for r in runs:
        m = (r.get("created_at") or "")[:7]
        if m:
            monthly[m] = monthly.get(m, 0) + r.get("total_gross", 0)
    monthly_trend = [{"month": k, "amount": v} for k, v in sorted(monthly.items())]

    # Department salary distribution
    dept_cost = {}
    for emp in employees:
        dept = emp.get("department", "other")
        dept_cost[dept] = dept_cost.get(dept, 0) + emp.get("basic_salary", 0)
    dept_data = [{"department": k, "salary": v} for k, v in dept_cost.items()]

    return {
        "period": period,
        "total_gross": total_gross,
        "total_net": total_net,
        "total_tax": total_tax,
        "total_insurance": total_ins,
        "total_employees": len(employees),
        "runs_count": len(runs),
        "monthly_trend": monthly_trend,
        "department_costs": dept_data,
    }


@router.get("/projects")
async def get_projects_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    """Projects & Tasks analytics"""
    user_data = _get_user(authorization)
    company_id = user_data.get("company_id")

    projects = await db.projects.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    tasks    = await db.tasks.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    expenses = await db.project_expenses.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    revenues = await db.project_revenues.find({"company_id": company_id}, {"_id": 0}).to_list(None)

    # Status distribution
    status_count = {}
    for p in projects:
        s = p.get("status", "active")
        status_count[s] = status_count.get(s, 0) + 1

    # Task completion
    total_tasks     = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.get("status") == "completed")
    overdue_tasks   = sum(1 for t in tasks if t.get("due_date") and t.get("status") != "completed" and t.get("due_date") < datetime.utcnow().date().isoformat())

    # Financial summary
    total_exp = sum(e.get("amount", 0) for e in expenses)
    total_rev = sum(r.get("amount", 0) for r in revenues)

    # Budget usage per project
    budget_data = []
    for p in projects[:10]:
        pid = p.get("id")
        exp = sum(e.get("amount", 0) for e in expenses if e.get("project_id") == pid)
        budget = p.get("budget", 0)
        budget_data.append({
            "name": p.get("name", ""),
            "budget": budget,
            "spent": exp,
            "progress": p.get("progress", 0),
        })

    return {
        "total_projects": len(projects),
        "status_distribution": [{"status": k, "count": v} for k, v in status_count.items()],
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "overdue_tasks": overdue_tasks,
        "completion_rate": round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0,
        "total_expenses": total_exp,
        "total_revenues": total_rev,
        "net_profit": total_rev - total_exp,
        "budget_usage": budget_data,
    }


@router.get("/sales")
async def get_sales_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    """Sales & CRM analytics"""
    user_data = _get_user(authorization)
    company_id = user_data.get("company_id")
    start_date = _start_date(period)

    customers = await db.customers.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    invoices  = await db.invoices.find(
        {"company_id": company_id, "created_at": {"$gte": start_date.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(None)

    # Invoice status breakdown
    status_count = {}
    for inv in invoices:
        s = inv.get("status", "draft")
        status_count[s] = status_count.get(s, 0) + 1

    # Monthly revenue trend
    monthly = {}
    for inv in invoices:
        if inv.get("status") in ("paid", "accepted", "approved"):
            m = (inv.get("created_at") or "")[:7]
            if m:
                monthly[m] = monthly.get(m, 0) + inv.get("total_amount", inv.get("total", 0))
    monthly_trend = [{"month": k, "revenue": v} for k, v in sorted(monthly.items())]

    total_invoiced = sum(inv.get("total_amount", inv.get("total", 0)) for inv in invoices)
    total_paid     = sum(inv.get("total_amount", inv.get("total", 0)) for inv in invoices if inv.get("status") in ("paid", "accepted"))
    total_pending  = total_invoiced - total_paid

    return {
        "total_customers": len(customers),
        "total_invoices": len(invoices),
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "collection_rate": round(total_paid / total_invoiced * 100, 1) if total_invoiced else 0,
        "status_distribution": [{"status": k, "count": v} for k, v in status_count.items()],
        "monthly_trend": monthly_trend,
    }


@router.get("/attendance")
async def get_attendance_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    """Attendance analytics"""
    user_data = _get_user(authorization)
    company_id = user_data.get("company_id")
    start_date = _start_date(period)

    records = await db.attendance.find(
        {"company_id": company_id, "date": {"$gte": start_date.date().isoformat()}},
        {"_id": 0}
    ).sort("date", -1).to_list(None)

    employees = await db.employees.find({"company_id": company_id}, {"_id": 0, "id": 1, "name": 1}).to_list(None)
    emp_names = {e["id"]: e.get("name", "") for e in employees}

    # Daily attendance trend
    daily = {}
    for r in records:
        d = r.get("date", "")[:10]
        if d not in daily:
            daily[d] = {"present": 0, "absent": 0, "late": 0}
        status = r.get("status", "present")
        if status in daily[d]:
            daily[d][status] += 1
        else:
            daily[d]["present"] += 1
    daily_trend = [{"date": k, **v} for k, v in sorted(daily.items())]

    # Employee attendance rate
    emp_att = {}
    for r in records:
        eid = r.get("employee_id", "")
        if eid not in emp_att:
            emp_att[eid] = {"present": 0, "absent": 0, "late": 0, "total": 0}
        emp_att[eid]["total"] += 1
        emp_att[eid][r.get("status", "present")] = emp_att[eid].get(r.get("status", "present"), 0) + 1

    emp_rates = sorted([
        {"name": emp_names.get(eid, eid), "rate": round(d["present"]/d["total"]*100, 1) if d["total"] else 0, "total": d["total"]}
        for eid, d in emp_att.items()
    ], key=lambda x: x["rate"])

    total = len(records)
    present = sum(1 for r in records if r.get("status", "present") == "present")
    absent  = sum(1 for r in records if r.get("status") == "absent")
    late    = sum(1 for r in records if r.get("status") == "late")

    return {
        "total_records": total,
        "present": present,
        "absent": absent,
        "late": late,
        "attendance_rate": round(present / total * 100, 1) if total else 0,
        "daily_trend": daily_trend[-30:],
        "employee_rates": emp_rates[:10],
        "worst_attendance": emp_rates[:5],
    }


def _get_user(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    from services.auth_service import verify_token
    user = verify_token(authorization.split(" ")[1])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def _start_date(period):
    now = datetime.utcnow()
    if period == "daily":   return now - timedelta(days=1)
    elif period == "monthly": return now - timedelta(days=30)
    elif period == "yearly":  return now - timedelta(days=365)
    elif period == "quarterly": return now - timedelta(days=90)
    return now - timedelta(days=30)


# ─── ADDITIONAL COMPREHENSIVE ANALYTICS ────────────────────────────────────────

@router.get("/purchases")
async def get_purchases_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id"); sd = _start_date(period)
    q = {"company_id": company_id, "created_at": {"$gte": sd.isoformat()}}

    purchases  = await db.purchases.find(q, {"_id": 0}).to_list(None)
    pos        = await db.purchase_orders.find(q, {"_id": 0}).to_list(None)
    suppliers  = await db.suppliers.find({"company_id": company_id}, {"_id": 0}).to_list(None)

    total_purch  = sum(p.get("total", p.get("total_amount", 0)) for p in purchases)
    total_pos    = sum(po.get("total", 0) for po in pos)
    paid_purch   = sum(p.get("amount_paid", p.get("total", 0)) for p in purchases if p.get("status") in ("paid","received"))
    pending_purch = total_purch - paid_purch

    monthly = {}
    for p in purchases:
        m = (p.get("created_at") or "")[:7]
        if m: monthly[m] = monthly.get(m, 0) + p.get("total", 0)
    monthly_trend = [{"month": k, "amount": v} for k, v in sorted(monthly.items())]

    by_supplier = {}
    for p in purchases:
        s = p.get("supplier_name", p.get("supplier_id", "أخرى"))
        by_supplier[s] = by_supplier.get(s, 0) + p.get("total", 0)
    top_suppliers = sorted([{"name": k, "amount": v} for k, v in by_supplier.items()], key=lambda x: -x["amount"])[:10]

    status_count = {}
    for p in purchases:
        st = p.get("status", "draft")
        status_count[st] = status_count.get(st, 0) + 1

    return {
        "total_suppliers": len(suppliers), "total_purchases": len(purchases),
        "total_pos": len(pos), "total_amount": total_purch, "total_pos_amount": total_pos,
        "paid": paid_purch, "pending": pending_purch,
        "monthly_trend": monthly_trend, "top_suppliers": top_suppliers,
        "status_distribution": [{"status": k, "count": v} for k, v in status_count.items()]
    }


@router.get("/treasury")
async def get_treasury_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id"); sd = _start_date(period)
    q = {"company_id": company_id, "date": {"$gte": sd.date().isoformat()}}

    treasury_txs = await db.treasury_transactions.find(q, {"_id": 0}).to_list(None)
    bank_txs     = await db.bank_transactions.find(q, {"_id": 0}).to_list(None)
    treasury     = await db.treasury.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    bank_accs    = await db.bank_accounts.find({"company_id": company_id}, {"_id": 0}).to_list(None)

    treas_balance = sum(t.get("balance", t.get("current_balance", 0)) for t in treasury)
    bank_balance  = sum(b.get("balance", b.get("current_balance", 0)) for b in bank_accs)

    treas_in  = sum(t.get("amount", 0) for t in treasury_txs if t.get("type") in ("in", "receipt", "deposit"))
    treas_out = sum(t.get("amount", 0) for t in treasury_txs if t.get("type") in ("out", "payment", "withdrawal"))
    bank_in   = sum(t.get("amount", 0) for t in bank_txs if t.get("transaction_type") in ("credit", "deposit", "in"))
    bank_out  = sum(t.get("amount", 0) for t in bank_txs if t.get("transaction_type") in ("debit", "withdrawal", "out"))

    daily = {}
    for t in treasury_txs + bank_txs:
        d = (t.get("date") or "")[:10]
        if d:
            if d not in daily: daily[d] = {"in": 0, "out": 0}
            if t.get("type") in ("in","receipt","deposit","credit"): daily[d]["in"] += t.get("amount", 0)
            else: daily[d]["out"] += t.get("amount", 0)
    daily_trend = [{"date": k, **v} for k, v in sorted(daily.items())]

    return {
        "treasury_balance": treas_balance, "bank_balance": bank_balance,
        "total_balance": treas_balance + bank_balance,
        "treasury_in": treas_in, "treasury_out": treas_out,
        "bank_in": bank_in, "bank_out": bank_out,
        "total_in": treas_in + bank_in, "total_out": treas_out + bank_out,
        "daily_trend": daily_trend[-30:],
        "bank_accounts": [{"name": b.get("bank_name", b.get("name","")), "balance": b.get("balance", 0)} for b in bank_accs],
    }


@router.get("/assets")
async def get_assets_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id")
    assets = await db.fixed_assets.find({"company_id": company_id}, {"_id": 0}).to_list(None)

    total_cost = sum(a.get("cost", a.get("purchase_price", 0)) for a in assets)
    total_dep  = sum(a.get("accumulated_depreciation", a.get("total_depreciation", 0)) for a in assets)
    net_value  = total_cost - total_dep

    by_type = {}
    for a in assets:
        t = a.get("asset_type", a.get("type", "other"))
        if t not in by_type: by_type[t] = {"cost": 0, "count": 0, "depreciation": 0}
        by_type[t]["cost"] += a.get("cost", a.get("purchase_price", 0))
        by_type[t]["depreciation"] += a.get("accumulated_depreciation", 0)
        by_type[t]["count"] += 1
    by_type_data = [{"type": k, **v, "net_value": v["cost"]-v["depreciation"]} for k, v in by_type.items()]

    status_count = {}
    for a in assets:
        s = a.get("status", "active")
        status_count[s] = status_count.get(s, 0) + 1

    return {
        "total_assets": len(assets), "total_cost": total_cost,
        "total_depreciation": total_dep, "net_value": net_value,
        "depreciation_rate": round(total_dep/total_cost*100,1) if total_cost else 0,
        "by_type": by_type_data,
        "status_distribution": [{"status": k, "count": v} for k, v in status_count.items()],
        "assets": sorted(assets, key=lambda x: -x.get("cost", 0))[:10]
    }


@router.get("/eta")
async def get_eta_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id"); sd = _start_date(period)
    q = {"company_id": company_id, "created_at": {"$gte": sd.isoformat()}}

    invoices   = await db.invoices.find(q, {"_id": 0}).to_list(None)
    subs_q = {"company_id": company_id, "submitted_at": {"$gte": sd.isoformat()}}
    eta_subs   = await db.eta_submissions.find(subs_q, {"_id": 0}).to_list(None)

    total_val  = sum(i.get("total_amount", i.get("total", 0)) for i in invoices)
    submitted  = [s for s in eta_subs if s.get("status") in ("submitted","accepted","valid")]
    rejected   = [s for s in eta_subs if s.get("status") in ("rejected","invalid")]

    by_status = {}
    for i in invoices:
        s = i.get("status","draft")
        by_status[s] = by_status.get(s, 0) + 1

    by_type = {}
    for i in invoices:
        t = i.get("document_type", i.get("type","invoice"))
        by_type[t] = by_type.get(t, 0) + 1

    monthly = {}
    for i in invoices:
        m = (i.get("created_at") or "")[:7]
        if m: monthly[m] = monthly.get(m, 0) + i.get("total_amount", i.get("total", 0))
    monthly_trend = [{"month": k, "amount": v} for k, v in sorted(monthly.items())]

    return {
        "total_invoices": len(invoices), "total_value": total_val,
        "eta_submitted": len(eta_subs), "eta_accepted": len(submitted), "eta_rejected": len(rejected),
        "acceptance_rate": round(len(submitted)/len(eta_subs)*100,1) if eta_subs else 0,
        "status_distribution": [{"status": k, "count": v} for k, v in by_status.items()],
        "type_distribution": [{"type": k, "count": v} for k, v in by_type.items()],
        "monthly_trend": monthly_trend,
    }


@router.get("/stock")
async def get_stock_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id"); sd = _start_date(period)
    q_date = {"company_id": company_id, "created_at": {"$gte": sd.isoformat()}}

    movements  = await db.stock_movements.find(q_date, {"_id": 0}).to_list(None)
    items      = await db.inventory_items.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    warehouses = await db.warehouses.find({"company_id": company_id}, {"_id": 0}).to_list(None)

    total_in  = sum(m.get("quantity", 0) for m in movements if m.get("type") in ("in","purchase","transfer_in","adjustment_in"))
    total_out = sum(m.get("quantity", 0) for m in movements if m.get("type") in ("out","sale","transfer_out","adjustment_out"))

    by_type = {}
    for m in movements:
        t = m.get("type","other")
        by_type[t] = by_type.get(t, 0) + m.get("quantity", 0)

    monthly = {}
    for m in movements:
        mo = (m.get("created_at") or "")[:7]
        if mo:
            if mo not in monthly: monthly[mo] = {"in": 0, "out": 0}
            key = "in" if m.get("type") in ("in","purchase","transfer_in") else "out"
            monthly[mo][key] += m.get("quantity", 0)
    monthly_trend = [{"month": k, **v} for k, v in sorted(monthly.items())]

    wh_data = []
    for wh in warehouses:
        wh_items = [i for i in items if i.get("warehouse_id") == wh.get("id")]
        wh_data.append({"name": wh.get("name",""), "items": len(wh_items), "value": sum(i.get("total_value",0) for i in wh_items)})

    low_stock = [i for i in items if i.get("quantity",0) <= i.get("min_quantity",0)]
    return {
        "total_items": len(items), "total_movements": len(movements),
        "total_in": total_in, "total_out": total_out,
        "total_value": sum(i.get("total_value",0) for i in items),
        "low_stock_count": len(low_stock),
        "movement_types": [{"type": k, "qty": v} for k, v in by_type.items()],
        "monthly_trend": monthly_trend,
        "warehouses": wh_data,
        "low_stock_items": low_stock[:10],
    }


@router.get("/loans")
async def get_loans_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id"); sd = _start_date(period)

    loans    = await db.employee_loans.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    eos      = await db.end_of_service.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    overtime = await db.overtime_records.find(
        {"company_id": company_id, "created_at": {"$gte": sd.isoformat()}}, {"_id": 0}
    ).to_list(None)

    total_loans    = sum(l.get("amount", 0) for l in loans)
    paid_loans     = sum(l.get("paid_amount", 0) for l in loans)
    remaining_loans = total_loans - paid_loans
    active_loans   = [l for l in loans if l.get("status") == "active"]

    total_ot_hours = sum(o.get("hours", 0) for o in overtime)
    total_ot_amount = sum(o.get("amount", 0) for o in overtime)

    total_eos = sum(e.get("total_amount", e.get("gratuity", 0)) for e in eos)

    loan_status = {}
    for l in loans:
        s = l.get("status", "active")
        loan_status[s] = loan_status.get(s, 0) + 1

    return {
        "total_loans": len(loans), "total_loan_amount": total_loans,
        "paid_amount": paid_loans, "remaining_amount": remaining_loans,
        "active_loans": len(active_loans),
        "total_overtime_hours": total_ot_hours, "total_overtime_amount": total_ot_amount,
        "total_eos_cases": len(eos), "total_eos_amount": total_eos,
        "loan_status": [{"status": k, "count": v} for k, v in loan_status.items()],
        "recent_loans": sorted(loans, key=lambda x: x.get("created_at",""), reverse=True)[:10],
    }


@router.get("/leaves")
async def get_leaves_analytics(period: str = "monthly", authorization: Optional[str] = Header(None)):
    user_data = _get_user(authorization); company_id = user_data.get("company_id"); sd = _start_date(period)
    q = {"company_id": company_id, "created_at": {"$gte": sd.isoformat()}}

    leaves    = await db.leaves.find(q, {"_id": 0}).to_list(None)
    employees = await db.employees.find({"company_id": company_id}, {"_id": 0, "id":1, "name":1, "department":1}).to_list(None)
    emp_map   = {e["id"]: e for e in employees}

    total_days = sum(l.get("days", l.get("duration", 1)) for l in leaves)

    by_type = {}
    for l in leaves:
        t = l.get("type", l.get("leave_type", "other"))
        if t not in by_type: by_type[t] = {"count": 0, "days": 0}
        by_type[t]["count"] += 1
        by_type[t]["days"] += l.get("days", 1)

    by_status = {}
    for l in leaves:
        s = l.get("status", "pending")
        by_status[s] = by_status.get(s, 0) + 1

    by_dept = {}
    for l in leaves:
        emp = emp_map.get(l.get("employee_id", ""), {})
        dept = emp.get("department", "other")
        if dept not in by_dept: by_dept[dept] = {"count": 0, "days": 0}
        by_dept[dept]["count"] += 1
        by_dept[dept]["days"] += l.get("days", 1)

    monthly = {}
    for l in leaves:
        m = (l.get("created_at") or "")[:7]
        if m: monthly[m] = monthly.get(m, 0) + l.get("days", 1)
    monthly_trend = [{"month": k, "days": v} for k, v in sorted(monthly.items())]

    return {
        "total_requests": len(leaves), "total_days": total_days,
        "approved": sum(1 for l in leaves if l.get("status") == "approved"),
        "pending": sum(1 for l in leaves if l.get("status") == "pending"),
        "rejected": sum(1 for l in leaves if l.get("status") == "rejected"),
        "by_type": [{"type": k, **v} for k, v in by_type.items()],
        "by_status": [{"status": k, "count": v} for k, v in by_status.items()],
        "by_department": [{"department": k, **v} for k, v in by_dept.items()],
        "monthly_trend": monthly_trend,
    }
