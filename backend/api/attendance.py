from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
import os
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

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


def generate_qr_code():
    """Generate unique QR code for attendance"""
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(12))


@router.post("/check-in")
async def check_in(
    check_in_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Record employee check-in"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    employee_id = check_in_data.get("employee_id")
    location = check_in_data.get("location", {})
    method = check_in_data.get("method", "manual")  # manual, qr, biometric
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID required")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Check if already checked in today
    existing = await db.attendance.find_one({
        "employee_id": employee_id,
        "date": today,
        "check_out_time": None
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Already checked in")
    
    now = datetime.now(timezone.utc)
    
    # Get work schedule to check if late
    # Default: 9:00 AM start time
    schedule_start = 9  # hours
    current_hour = now.hour
    is_late = current_hour >= schedule_start + 1  # More than 1 hour late
    late_minutes = max(0, (current_hour - schedule_start) * 60 + now.minute) if is_late else 0
    
    attendance_record = {
        "employee_id": employee_id,
        "company_id": company_id,
        "date": today,
        "check_in_time": now.isoformat(),
        "check_out_time": None,
        "check_in_location": location,
        "check_in_method": method,
        "is_late": is_late,
        "late_minutes": late_minutes,
        "overtime_minutes": 0,
        "work_hours": 0,
        "status": "present",  # present, absent, late, half-day, leave
        "notes": check_in_data.get("notes", ""),
        "created_at": now.isoformat()
    }
    
    await db.attendance.insert_one(attendance_record)
    if "_id" in attendance_record:
        del attendance_record["_id"]
    
    return attendance_record


@router.post("/check-out")
async def check_out(
    check_out_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Record employee check-out"""
    user_data = await verify_token_from_header(authorization)
    
    employee_id = check_out_data.get("employee_id")
    location = check_out_data.get("location", {})
    
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID required")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Find today's check-in record
    attendance = await db.attendance.find_one({
        "employee_id": employee_id,
        "date": today,
        "check_out_time": None
    })
    
    if not attendance:
        raise HTTPException(status_code=400, detail="No check-in record found")
    
    now = datetime.now(timezone.utc)
    check_in_time = datetime.fromisoformat(attendance.get("check_in_time").replace('Z', '+00:00'))
    
    # Calculate work hours
    work_duration = now - check_in_time
    work_hours = work_duration.total_seconds() / 3600
    
    # Calculate overtime (assuming 8 hour work day)
    overtime_minutes = max(0, (work_hours - 8) * 60)
    
    # Update attendance record
    update_data = {
        "check_out_time": now.isoformat(),
        "check_out_location": location,
        "work_hours": round(work_hours, 2),
        "overtime_minutes": round(overtime_minutes),
        "updated_at": now.isoformat()
    }
    
    # Update status if it was late
    if attendance.get("is_late") and work_hours < 8:
        update_data["status"] = "late"
    
    await db.attendance.update_one(
        {"employee_id": employee_id, "date": today, "check_out_time": None},
        {"$set": update_data}
    )
    
    return {
        "employee_id": employee_id,
        "check_out_time": now.isoformat(),
        "work_hours": round(work_hours, 2),
        "overtime_minutes": round(overtime_minutes)
    }


@router.get("/today")
async def get_today_attendance(authorization: Optional[str] = Header(None)):
    """Get today's attendance records"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    records = await db.attendance.find(
        {"company_id": company_id, "date": today},
        {"_id": 0}
    ).to_list(length=None)
    
    # Get employee names
    employee_ids = [r.get("employee_id") for r in records]
    employees = await db.employees.find(
        {"id": {"$in": employee_ids}},
        {"_id": 0, "id": 1, "name": 1, "department": 1, "position": 1}
    ).to_list(length=None)
    
    employee_map = {e.get("id"): e for e in employees}
    
    for record in records:
        emp = employee_map.get(record.get("employee_id"), {})
        record["employee_name"] = emp.get("name", "Unknown")
        record["department"] = emp.get("department", "-")
        record["position"] = emp.get("position", "-")
    
    # Calculate summary
    total_employees = await db.employees.count_documents({"company_id": company_id, "is_active": True})
    present = len([r for r in records if r.get("status") in ["present", "late"]])
    late = len([r for r in records if r.get("is_late")])
    absent = total_employees - present
    
    return {
        "date": today,
        "records": records,
        "summary": {
            "total_employees": total_employees,
            "present": present,
            "absent": absent,
            "late": late,
            "on_leave": 0  # Would need to check leave records
        }
    }


@router.get("/employee/{employee_id}")
async def get_employee_attendance(
    employee_id: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get attendance history for an employee"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {"employee_id": employee_id, "company_id": company_id}
    
    if from_date:
        query["date"] = {"$gte": from_date}
    if to_date:
        if "date" in query:
            query["date"]["$lte"] = to_date
        else:
            query["date"] = {"$lte": to_date}
    
    records = await db.attendance.find(
        query,
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    # Calculate statistics
    total_days = len(records)
    present_days = len([r for r in records if r.get("status") in ["present", "late"]])
    late_days = len([r for r in records if r.get("is_late")])
    total_hours = sum(r.get("work_hours", 0) for r in records)
    total_overtime = sum(r.get("overtime_minutes", 0) for r in records)
    total_late_minutes = sum(r.get("late_minutes", 0) for r in records)
    
    return {
        "employee_id": employee_id,
        "records": records,
        "statistics": {
            "total_days": total_days,
            "present_days": present_days,
            "late_days": late_days,
            "absent_days": total_days - present_days,
            "total_work_hours": round(total_hours, 2),
            "total_overtime_minutes": round(total_overtime),
            "total_late_minutes": round(total_late_minutes),
            "attendance_rate": round((present_days / total_days * 100), 1) if total_days > 0 else 0
        }
    }


@router.get("/report")
async def get_attendance_report(
    from_date: str,
    to_date: str,
    department: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get attendance report for date range"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {
        "company_id": company_id,
        "date": {"$gte": from_date, "$lte": to_date}
    }
    
    records = await db.attendance.find(query, {"_id": 0}).to_list(length=None)
    
    # Get employees
    emp_query = {"company_id": company_id, "is_active": True}
    if department:
        emp_query["department"] = department
    
    employees = await db.employees.find(emp_query, {"_id": 0}).to_list(length=None)
    
    # Group by employee
    employee_stats = {}
    for emp in employees:
        emp_id = emp.get("id")
        emp_records = [r for r in records if r.get("employee_id") == emp_id]
        
        employee_stats[emp_id] = {
            "employee_id": emp_id,
            "employee_name": emp.get("full_name"),
            "department": emp.get("department"),
            "position": emp.get("position"),
            "present_days": len([r for r in emp_records if r.get("status") in ["present", "late"]]),
            "late_days": len([r for r in emp_records if r.get("is_late")]),
            "absent_days": 0,  # Would need working days calculation
            "total_hours": round(sum(r.get("work_hours", 0) for r in emp_records), 2),
            "overtime_minutes": round(sum(r.get("overtime_minutes", 0) for r in emp_records)),
            "late_minutes": round(sum(r.get("late_minutes", 0) for r in emp_records))
        }
    
    # Overall summary
    total_present = sum(e["present_days"] for e in employee_stats.values())
    total_late = sum(e["late_days"] for e in employee_stats.values())
    total_overtime = sum(e["overtime_minutes"] for e in employee_stats.values())
    
    return {
        "period": {"from": from_date, "to": to_date},
        "employees": list(employee_stats.values()),
        "summary": {
            "total_employees": len(employees),
            "total_present_days": total_present,
            "total_late_days": total_late,
            "total_overtime_minutes": total_overtime,
            "average_attendance_rate": round((total_present / (len(employees) * len(set(r.get("date") for r in records))) * 100), 1) if records else 0
        }
    }


@router.post("/qr/generate")
async def generate_attendance_qr(authorization: Optional[str] = Header(None)):
    """Generate QR code for attendance"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    qr_code = generate_qr_code()
    expiry = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    qr_record = {
        "code": qr_code,
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expiry.isoformat(),
        "used": False
    }
    
    await db.attendance_qr.insert_one(qr_record)
    
    return {
        "qr_code": qr_code,
        "expires_at": expiry.isoformat()
    }


@router.post("/qr/validate")
async def validate_attendance_qr(
    qr_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Validate QR code and check in"""
    user_data = await verify_token_from_header(authorization)
    
    qr_code = qr_data.get("code")
    employee_id = qr_data.get("employee_id")
    
    if not qr_code or not employee_id:
        raise HTTPException(status_code=400, detail="QR code and employee ID required")
    
    # Find and validate QR code
    qr_record = await db.attendance_qr.find_one({
        "code": qr_code,
        "used": False
    })
    
    if not qr_record:
        raise HTTPException(status_code=400, detail="Invalid or expired QR code")
    
    # Check expiry
    expiry = datetime.fromisoformat(qr_record.get("expires_at").replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="QR code has expired")
    
    # Perform check-in
    check_in_result = await check_in(
        {"employee_id": employee_id, "method": "qr"},
        authorization
    )
    
    # Mark QR as used (optional - can allow multiple uses)
    # await db.attendance_qr.update_one(
    #     {"code": qr_code},
    #     {"$set": {"used": True}}
    # )
    
    return check_in_result


@router.get("/settings")
async def get_attendance_settings(authorization: Optional[str] = Header(None)):
    """Get company attendance settings"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    settings = await db.attendance_settings.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not settings:
        # Return default settings
        settings = {
            "company_id": company_id,
            "work_start_time": "09:00",
            "work_end_time": "17:00",
            "work_hours_per_day": 8,
            "late_threshold_minutes": 15,
            "overtime_multiplier": 1.5,
            "working_days": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]
        }
    
    return settings


@router.put("/settings")
async def update_attendance_settings(
    settings_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update company attendance settings"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    settings_data["company_id"] = company_id
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.attendance_settings.update_one(
        {"company_id": company_id},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"success": True}
