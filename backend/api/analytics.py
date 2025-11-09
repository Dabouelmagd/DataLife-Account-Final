from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from services.auth_service import verify_token
from database import db
from datetime import datetime, timedelta
from collections import defaultdict


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
    journal_entries = await db.journal_entries.find({"company_id": company_id}).to_list(length=None)
    treasury_transactions = await db.treasury.find({"company_id": company_id}).to_list(length=None)
    bank_transactions = await db.bank.find({"company_id": company_id}).to_list(length=None)
    customers = await db.customers.find({"company_id": company_id}).to_list(length=None)
    suppliers = await db.suppliers.find({"company_id": company_id}).to_list(length=None)
    
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
    
    # Get all HR data
    employees = await db.employees.find({"company_id": company_id}).to_list(length=None)
    allowances = await db.allowances.find({"company_id": company_id}).to_list(length=None)
    deductions = await db.deductions.find({"company_id": company_id}).to_list(length=None)
    leaves = await db.leaves.find({"company_id": company_id}).to_list(length=None)
    attendance = await db.attendance.find({"company_id": company_id}).to_list(length=None)
    
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
