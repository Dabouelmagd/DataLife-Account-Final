"""
HR Management API - Deductions, Allowances, Shifts
إدارة الموارد البشرية - الخصومات، البدلات، الورديات
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Query
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import uuid

from database import db
from services.auth_service import verify_token

router = APIRouter(prefix="/api/hr", tags=["HR Management"])


# ==========================================
# Authentication Helper
# ==========================================

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


# ==========================================
# Pydantic Models
# ==========================================

class DeductionCreate(BaseModel):
    employee_id: str
    category: str  # absence, late, penalty, loan, insurance, tax, other
    amount: float
    date: str
    reason: Optional[str] = None

class DeductionUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    deduction_date: Optional[str] = None
    reason: Optional[str] = None

class AllowanceCreate(BaseModel):
    employee_id: str
    category: str  # overtime, housing, transport, phone, meal, bonus, commission, other
    amount: float
    hours: Optional[float] = None
    rate: Optional[float] = None
    date: str
    notes: Optional[str] = None

class AllowanceUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = None
    hours: Optional[float] = None
    rate: Optional[float] = None
    allowance_date: Optional[str] = None
    notes: Optional[str] = None

class ShiftCreate(BaseModel):
    name: str
    name_ar: Optional[str] = None
    type: str  # morning, evening, night, split, flexible
    start_time: str
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    break_duration: Optional[int] = 60
    working_hours: float = 8
    working_days: List[str] = ["sunday", "monday", "tuesday", "wednesday", "thursday"]
    overtime_rate: float = 1.5
    holiday_rate: float = 2.0
    night_rate: float = 1.25
    overtime_starts_after: int = 8
    allow_late_minutes: int = 15
    deduct_after_late: bool = True
    is_active: bool = True

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    name_ar: Optional[str] = None
    type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    break_duration: Optional[int] = None
    working_hours: Optional[float] = None
    working_days: Optional[List[str]] = None
    overtime_rate: Optional[float] = None
    holiday_rate: Optional[float] = None
    night_rate: Optional[float] = None
    overtime_starts_after: Optional[int] = None
    allow_late_minutes: Optional[int] = None
    deduct_after_late: Optional[bool] = None
    is_active: Optional[bool] = None


# ==========================================
# Helper Functions
# ==========================================

def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    result = {k: v for k, v in doc.items() if k != '_id'}
    return result


async def get_employee_info(employee_id: str, company_id: str):
    """Get employee name and code"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": company_id
    }, {"_id": 0, "id": 1, "name": 1, "name_en": 1, "employee_code": 1})
    return employee


# ==========================================
# DEDUCTIONS ENDPOINTS
# ==========================================

@router.get("/deductions")
async def get_deductions(
    month: Optional[str] = None,  # Format: YYYY-MM
    employee_id: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all deductions for the company"""
    query = {"company_id": current_user["company_id"]}
    
    if month:
        # Filter by month (date starts with YYYY-MM)
        query["date"] = {"$regex": f"^{month}"}
    
    if employee_id:
        query["employee_id"] = employee_id
    
    if category:
        query["category"] = category
    
    deductions = await db.hr_deductions.find(query, {"_id": 0}).sort("date", -1).to_list(length=500)
    
    # Enrich with employee info
    for ded in deductions:
        emp = await get_employee_info(ded.get("employee_id"), current_user["company_id"])
        if emp:
            ded["employee_name"] = emp.get("name")
            ded["employee_code"] = emp.get("employee_code")
    
    return deductions


@router.get("/deductions/{deduction_id}")
async def get_deduction(
    deduction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific deduction"""
    deduction = await db.hr_deductions.find_one({
        "id": deduction_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    
    if not deduction:
        raise HTTPException(status_code=404, detail="الخصم غير موجود")
    
    # Enrich with employee info
    emp = await get_employee_info(deduction.get("employee_id"), current_user["company_id"])
    if emp:
        deduction["employee_name"] = emp.get("name")
        deduction["employee_code"] = emp.get("employee_code")
    
    return deduction


@router.post("/deductions")
async def create_deduction(
    data: DeductionCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new deduction"""
    # Verify employee exists
    employee = await get_employee_info(data.employee_id, current_user["company_id"])
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    deduction_id = str(uuid.uuid4())[:8].upper()
    
    deduction = {
        "id": f"DED-{deduction_id}",
        "company_id": current_user["company_id"],
        "employee_id": data.employee_id,
        "category": data.category,
        "amount": data.amount,
        "date": data.date,
        "reason": data.reason,
        "created_by": current_user["user_id"],
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.hr_deductions.insert_one(deduction)
    
    return {
        "message": "تم إضافة الخصم بنجاح",
        "id": deduction["id"],
        "deduction": serialize_doc(deduction)
    }


@router.put("/deductions/{deduction_id}")
async def update_deduction(
    deduction_id: str,
    data: DeductionUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a deduction"""
    deduction = await db.hr_deductions.find_one({
        "id": deduction_id,
        "company_id": current_user["company_id"]
    })
    
    if not deduction:
        raise HTTPException(status_code=404, detail="الخصم غير موجود")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    update_data["updated_by"] = current_user["user_id"]
    
    await db.hr_deductions.update_one(
        {"id": deduction_id},
        {"$set": update_data}
    )
    
    return {"message": "تم تحديث الخصم بنجاح"}


@router.delete("/deductions/{deduction_id}")
async def delete_deduction(
    deduction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a deduction"""
    result = await db.hr_deductions.delete_one({
        "id": deduction_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الخصم غير موجود")
    
    return {"message": "تم حذف الخصم بنجاح"}


# ==========================================
# ALLOWANCES ENDPOINTS
# ==========================================

@router.get("/allowances")
async def get_allowances(
    month: Optional[str] = None,  # Format: YYYY-MM
    employee_id: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all allowances for the company"""
    query = {"company_id": current_user["company_id"]}
    
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    if employee_id:
        query["employee_id"] = employee_id
    
    if category:
        query["category"] = category
    
    allowances = await db.hr_allowances.find(query, {"_id": 0}).sort("date", -1).to_list(length=500)
    
    # Enrich with employee info
    for alw in allowances:
        emp = await get_employee_info(alw.get("employee_id"), current_user["company_id"])
        if emp:
            alw["employee_name"] = emp.get("name")
            alw["employee_code"] = emp.get("employee_code")
    
    return allowances


@router.get("/allowances/{allowance_id}")
async def get_allowance(
    allowance_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific allowance"""
    allowance = await db.hr_allowances.find_one({
        "id": allowance_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    
    if not allowance:
        raise HTTPException(status_code=404, detail="البدل غير موجود")
    
    # Enrich with employee info
    emp = await get_employee_info(allowance.get("employee_id"), current_user["company_id"])
    if emp:
        allowance["employee_name"] = emp.get("name")
        allowance["employee_code"] = emp.get("employee_code")
    
    return allowance


@router.post("/allowances")
async def create_allowance(
    data: AllowanceCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new allowance"""
    # Verify employee exists
    employee = await get_employee_info(data.employee_id, current_user["company_id"])
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    allowance_id = str(uuid.uuid4())[:8].upper()
    
    # Calculate amount for overtime
    amount = data.amount
    if data.category == "overtime" and data.hours and data.rate:
        amount = data.hours * data.rate
    
    allowance = {
        "id": f"ALW-{allowance_id}",
        "company_id": current_user["company_id"],
        "employee_id": data.employee_id,
        "category": data.category,
        "amount": amount,
        "hours": data.hours,
        "rate": data.rate,
        "date": data.date,
        "notes": data.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.hr_allowances.insert_one(allowance)
    
    return {
        "message": "تم إضافة البدل بنجاح",
        "id": allowance["id"],
        "allowance": serialize_doc(allowance)
    }


@router.put("/allowances/{allowance_id}")
async def update_allowance(
    allowance_id: str,
    data: AllowanceUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an allowance"""
    allowance = await db.hr_allowances.find_one({
        "id": allowance_id,
        "company_id": current_user["company_id"]
    })
    
    if not allowance:
        raise HTTPException(status_code=404, detail="البدل غير موجود")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    
    # Recalculate amount for overtime
    category = update_data.get("category", allowance.get("category"))
    if category == "overtime":
        hours = update_data.get("hours", allowance.get("hours"))
        rate = update_data.get("rate", allowance.get("rate"))
        if hours and rate:
            update_data["amount"] = hours * rate
    
    update_data["updated_at"] = datetime.utcnow().isoformat()
    update_data["updated_by"] = current_user["user_id"]
    
    await db.hr_allowances.update_one(
        {"id": allowance_id},
        {"$set": update_data}
    )
    
    return {"message": "تم تحديث البدل بنجاح"}


@router.delete("/allowances/{allowance_id}")
async def delete_allowance(
    allowance_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an allowance"""
    result = await db.hr_allowances.delete_one({
        "id": allowance_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="البدل غير موجود")
    
    return {"message": "تم حذف البدل بنجاح"}


# ==========================================
# SHIFTS ENDPOINTS
# ==========================================

@router.get("/shifts")
async def get_shifts(
    type: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all shifts for the company"""
    query = {"company_id": current_user["company_id"]}
    
    if type:
        query["type"] = type
    
    if is_active is not None:
        query["is_active"] = is_active
    
    shifts = await db.hr_shifts.find(query, {"_id": 0}).to_list(length=100)
    
    # Get employee count per shift
    for shift in shifts:
        count = await db.employees.count_documents({
            "company_id": current_user["company_id"],
            "shift_id": shift.get("id"),
            "is_active": True
        })
        shift["employee_count"] = count
    
    return shifts


@router.get("/shifts/{shift_id}")
async def get_shift(
    shift_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific shift"""
    shift = await db.hr_shifts.find_one({
        "id": shift_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    
    # Get employee count
    shift["employee_count"] = await db.employees.count_documents({
        "company_id": current_user["company_id"],
        "shift_id": shift_id,
        "is_active": True
    })
    
    return shift


@router.post("/shifts")
async def create_shift(
    data: ShiftCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new shift"""
    shift_id = str(uuid.uuid4())[:8].upper()
    
    shift = {
        "id": f"SH-{shift_id}",
        "company_id": current_user["company_id"],
        "name": data.name,
        "name_ar": data.name_ar or data.name,
        "type": data.type,
        "start_time": data.start_time,
        "end_time": data.end_time,
        "break_start": data.break_start,
        "break_end": data.break_end,
        "break_duration": data.break_duration,
        "working_hours": data.working_hours,
        "working_days": data.working_days,
        "overtime_rate": data.overtime_rate,
        "holiday_rate": data.holiday_rate,
        "night_rate": data.night_rate,
        "overtime_starts_after": data.overtime_starts_after,
        "allow_late_minutes": data.allow_late_minutes,
        "deduct_after_late": data.deduct_after_late,
        "is_active": data.is_active,
        "created_by": current_user["user_id"],
        "created_at": datetime.utcnow().isoformat()
    }
    
    await db.hr_shifts.insert_one(shift)
    
    return {
        "message": "تم إضافة الوردية بنجاح",
        "id": shift["id"],
        "shift": serialize_doc(shift)
    }


@router.put("/shifts/{shift_id}")
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a shift"""
    shift = await db.hr_shifts.find_one({
        "id": shift_id,
        "company_id": current_user["company_id"]
    })
    
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    update_data["updated_by"] = current_user["user_id"]
    
    await db.hr_shifts.update_one(
        {"id": shift_id},
        {"$set": update_data}
    )
    
    return {"message": "تم تحديث الوردية بنجاح"}


@router.delete("/shifts/{shift_id}")
async def delete_shift(
    shift_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a shift"""
    # Check if any employees are assigned to this shift
    employee_count = await db.employees.count_documents({
        "company_id": current_user["company_id"],
        "shift_id": shift_id,
        "is_active": True
    })
    
    if employee_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"لا يمكن حذف الوردية. يوجد {employee_count} موظف مرتبط بها"
        )
    
    result = await db.hr_shifts.delete_one({
        "id": shift_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    
    return {"message": "تم حذف الوردية بنجاح"}


# ==========================================
# STATISTICS ENDPOINTS
# ==========================================

@router.get("/stats/deductions")
async def get_deductions_stats(
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get deductions statistics"""
    query = {"company_id": current_user["company_id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"}
        }}
    ]
    
    results = await db.hr_deductions.aggregate(pipeline).to_list(length=20)
    
    stats = {
        "total_count": 0,
        "total_amount": 0,
        "by_category": {}
    }
    
    for r in results:
        stats["total_count"] += r["count"]
        stats["total_amount"] += r["total"]
        stats["by_category"][r["_id"]] = {
            "count": r["count"],
            "total": r["total"]
        }
    
    return stats


@router.get("/stats/allowances")
async def get_allowances_stats(
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get allowances statistics"""
    query = {"company_id": current_user["company_id"]}
    if month:
        query["date"] = {"$regex": f"^{month}"}
    
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"},
            "total_hours": {"$sum": {"$ifNull": ["$hours", 0]}}
        }}
    ]
    
    results = await db.hr_allowances.aggregate(pipeline).to_list(length=20)
    
    stats = {
        "total_count": 0,
        "total_amount": 0,
        "overtime_hours": 0,
        "by_category": {}
    }
    
    for r in results:
        stats["total_count"] += r["count"]
        stats["total_amount"] += r["total"]
        if r["_id"] == "overtime":
            stats["overtime_hours"] = r["total_hours"]
        stats["by_category"][r["_id"]] = {
            "count": r["count"],
            "total": r["total"]
        }
    
    return stats


@router.get("/stats/shifts")
async def get_shifts_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get shifts statistics"""
    query = {"company_id": current_user["company_id"]}
    
    total = await db.hr_shifts.count_documents(query)
    active = await db.hr_shifts.count_documents({**query, "is_active": True})
    
    # Get employee count per shift
    pipeline = [
        {"$match": {"company_id": current_user["company_id"], "is_active": True}},
        {"$group": {
            "_id": "$shift_id",
            "count": {"$sum": 1}
        }}
    ]
    
    emp_by_shift = await db.employees.aggregate(pipeline).to_list(length=100)
    total_employees = sum(r["count"] for r in emp_by_shift)
    
    # Get average working hours
    shifts = await db.hr_shifts.find(query, {"working_hours": 1}).to_list(length=100)
    avg_hours = sum(s.get("working_hours", 8) for s in shifts) / len(shifts) if shifts else 8
    
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "total_employees": total_employees,
        "average_working_hours": round(avg_hours, 1)
    }
