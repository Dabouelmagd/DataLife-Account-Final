"""
Attendance API - واجهة الحضور والانصراف
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from typing import Optional, List
from datetime import datetime, date, timedelta
from pydantic import BaseModel
import uuid
import csv
import io

from database import db
from api.users import get_current_user
from models.attendance import (
    AttendanceRecord, AttendanceStatus, AttendanceSettings,
    FingerprintLog, FingerprintDevice, Holiday,
    DailyAttendanceSummary, MonthlyAttendanceSummary
)

router = APIRouter(prefix="/api/attendance-pro", tags=["Attendance Pro"])


# ==========================================
# Request Models
# ==========================================

class CheckInRequest(BaseModel):
    employee_id: str
    check_in_time: Optional[str] = None
    device_id: Optional[str] = None
    notes: Optional[str] = None


class CheckOutRequest(BaseModel):
    employee_id: str
    check_out_time: Optional[str] = None
    device_id: Optional[str] = None
    notes: Optional[str] = None


class ManualAttendanceRequest(BaseModel):
    employee_id: str
    date: str
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    status: str = "present"
    notes: Optional[str] = None
    is_excused: bool = False
    excuse_reason: Optional[str] = None


class HolidayRequest(BaseModel):
    name: str
    name_en: Optional[str] = None
    date: str
    is_annual: bool = True


class SettingsUpdateRequest(BaseModel):
    grace_period_minutes: int = 15
    late_deduction_per_minute: float = 0.0
    max_late_minutes_before_absence: int = 120
    early_leave_deduction_per_minute: float = 0.0
    absence_deduction_type: str = "day"
    absence_deduction_days: float = 1.0
    overtime_requires_approval: bool = True
    max_daily_overtime: float = 4.0
    weekend_days: List[str] = ["friday", "saturday"]
    require_both_punches: bool = True


# ==========================================
# Helper Functions
# ==========================================

def time_to_minutes(time_str: str) -> int:
    """تحويل الوقت إلى دقائق"""
    if not time_str:
        return 0
    parts = time_str.split(":")
    hours = int(parts[0])
    minutes = int(parts[1]) if len(parts) > 1 else 0
    return hours * 60 + minutes


def minutes_to_hours(minutes: int) -> float:
    """تحويل الدقائق إلى ساعات"""
    return round(minutes / 60, 2)


def calculate_working_hours(check_in: str, check_out: str, break_duration: int = 0) -> float:
    """حساب ساعات العمل"""
    if not check_in or not check_out:
        return 0.0
    
    in_minutes = time_to_minutes(check_in)
    out_minutes = time_to_minutes(check_out)
    
    # إذا كان الانصراف قبل الحضور (تجاوز منتصف الليل)
    if out_minutes < in_minutes:
        out_minutes += 24 * 60
    
    total_minutes = out_minutes - in_minutes - break_duration
    return max(0, minutes_to_hours(total_minutes))


def calculate_late_minutes(expected_in: str, actual_in: str, grace_period: int = 0) -> int:
    """حساب دقائق التأخير"""
    if not expected_in or not actual_in:
        return 0
    
    expected = time_to_minutes(expected_in)
    actual = time_to_minutes(actual_in)
    
    late = actual - expected - grace_period
    return max(0, late)


def calculate_early_leave_minutes(expected_out: str, actual_out: str) -> int:
    """حساب دقائق الانصراف المبكر"""
    if not expected_out or not actual_out:
        return 0
    
    expected = time_to_minutes(expected_out)
    actual = time_to_minutes(actual_out)
    
    early = expected - actual
    return max(0, early)


def calculate_overtime(actual_hours: float, expected_hours: float, shift: dict = None) -> dict:
    """حساب ساعات الإضافي"""
    overtime = max(0, actual_hours - expected_hours)
    
    overtime_rate = shift.get("overtime_rate", 1.5) if shift else 1.5
    
    return {
        "regular_overtime": overtime,
        "overtime_rate": overtime_rate
    }


async def get_employee_shift(employee_id: str, date_str: str) -> dict:
    """الحصول على وردية الموظف لتاريخ معين"""
    employee = await db.employees.find_one({"id": employee_id}, {"current_shift_id": 1})
    if not employee or not employee.get("current_shift_id"):
        return None
    
    shift = await db.work_shifts.find_one({"id": employee["current_shift_id"]}, {"_id": 0})
    return shift


async def get_attendance_settings(company_id: str) -> dict:
    """الحصول على إعدادات الحضور"""
    settings = await db.attendance_settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings:
        # إعدادات افتراضية
        settings = AttendanceSettings(company_id=company_id).dict()
        await db.attendance_settings.insert_one(settings)
    return settings


def get_day_name(date_str: str) -> str:
    """الحصول على اسم اليوم"""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    return days[d.weekday()]


# ==========================================
# Check In / Check Out
# ==========================================

@router.post("/check-in")
async def record_check_in(
    request: CheckInRequest,
    current_user: dict = Depends(get_current_user)
):
    """تسجيل بصمة الحضور"""
    company_id = current_user["company_id"]
    today = datetime.now().strftime("%Y-%m-%d")
    current_time = request.check_in_time or datetime.now().strftime("%H:%M:%S")
    
    # التحقق من وجود الموظف
    employee = await db.employees.find_one({
        "id": request.employee_id,
        "company_id": company_id
    }, {"_id": 0, "name": 1, "employee_code": 1, "department": 1, "current_shift_id": 1})
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # التحقق من عدم وجود سجل حضور لهذا اليوم
    existing = await db.attendance_records.find_one({
        "employee_id": request.employee_id,
        "date": today,
        "company_id": company_id
    })
    
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="تم تسجيل الحضور مسبقاً لهذا اليوم")
    
    # الحصول على الوردية والإعدادات
    shift = await get_employee_shift(request.employee_id, today)
    settings = await get_attendance_settings(company_id)
    
    # حساب التأخير
    late_minutes = 0
    status = AttendanceStatus.PRESENT
    
    if shift:
        late_minutes = calculate_late_minutes(
            shift.get("start_time"),
            current_time[:5],
            settings.get("grace_period_minutes", 15)
        )
        
        if late_minutes > settings.get("max_late_minutes_before_absence", 120):
            status = AttendanceStatus.ABSENT
        elif late_minutes > 0:
            status = AttendanceStatus.LATE
    
    # إنشاء أو تحديث سجل الحضور
    if existing:
        await db.attendance_records.update_one(
            {"id": existing["id"]},
            {"$set": {
                "check_in": current_time,
                "check_in_device": request.device_id,
                "late_minutes": late_minutes,
                "status": status,
                "updated_at": datetime.utcnow()
            }}
        )
        record_id = existing["id"]
    else:
        record = AttendanceRecord(
            company_id=company_id,
            employee_id=request.employee_id,
            employee_name=employee.get("name"),
            employee_code=employee.get("employee_code"),
            department=employee.get("department"),
            date=today,
            shift_id=shift.get("id") if shift else None,
            shift_name=shift.get("name") if shift else None,
            expected_check_in=shift.get("start_time") if shift else None,
            expected_check_out=shift.get("end_time") if shift else None,
            expected_working_hours=shift.get("working_hours", 8.0) if shift else 8.0,
            check_in=current_time,
            check_in_device=request.device_id,
            late_minutes=late_minutes,
            status=status,
            notes=request.notes,
            created_by=current_user["user_id"]
        )
        await db.attendance_records.insert_one(record.dict())
        record_id = record.id
    
    return {
        "message": "تم تسجيل الحضور بنجاح",
        "record_id": record_id,
        "check_in": current_time,
        "late_minutes": late_minutes,
        "status": status
    }


@router.post("/check-out")
async def record_check_out(
    request: CheckOutRequest,
    current_user: dict = Depends(get_current_user)
):
    """تسجيل بصمة الانصراف"""
    company_id = current_user["company_id"]
    today = datetime.now().strftime("%Y-%m-%d")
    current_time = request.check_out_time or datetime.now().strftime("%H:%M:%S")
    
    # البحث عن سجل الحضور
    record = await db.attendance_records.find_one({
        "employee_id": request.employee_id,
        "date": today,
        "company_id": company_id
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="لا يوجد سجل حضور لهذا اليوم")
    
    if record.get("check_out"):
        raise HTTPException(status_code=400, detail="تم تسجيل الانصراف مسبقاً")
    
    # الحصول على الوردية
    shift = None
    if record.get("shift_id"):
        shift = await db.work_shifts.find_one({"id": record["shift_id"]}, {"_id": 0})
    
    # حساب ساعات العمل
    break_duration = shift.get("break_duration", 60) if shift else 60
    actual_hours = calculate_working_hours(record["check_in"], current_time, break_duration)
    
    # حساب الانصراف المبكر
    early_leave = 0
    if shift and shift.get("end_time"):
        early_leave = calculate_early_leave_minutes(shift["end_time"], current_time[:5])
    
    # حساب الإضافي
    expected_hours = record.get("expected_working_hours", 8.0)
    overtime_info = calculate_overtime(actual_hours, expected_hours, shift)
    
    # تحديث الحالة
    status = record.get("status", AttendanceStatus.PRESENT)
    if early_leave > 30 and status == AttendanceStatus.PRESENT:
        status = AttendanceStatus.EARLY_LEAVE
    
    # تحديث السجل
    await db.attendance_records.update_one(
        {"id": record["id"]},
        {"$set": {
            "check_out": current_time,
            "check_out_device": request.device_id,
            "actual_working_hours": actual_hours,
            "early_leave_minutes": early_leave,
            "overtime_hours": overtime_info["regular_overtime"],
            "regular_overtime": overtime_info["regular_overtime"],
            "status": status,
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "message": "تم تسجيل الانصراف بنجاح",
        "check_out": current_time,
        "actual_working_hours": actual_hours,
        "overtime_hours": overtime_info["regular_overtime"],
        "early_leave_minutes": early_leave
    }


# ==========================================
# Manual Attendance
# ==========================================

@router.post("/manual")
async def add_manual_attendance(
    request: ManualAttendanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """إضافة حضور يدوي"""
    company_id = current_user["company_id"]
    
    employee = await db.employees.find_one({
        "id": request.employee_id,
        "company_id": company_id
    }, {"_id": 0, "name": 1, "employee_code": 1, "department": 1, "current_shift_id": 1})
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # التحقق من عدم وجود سجل
    existing = await db.attendance_records.find_one({
        "employee_id": request.employee_id,
        "date": request.date,
        "company_id": company_id
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="يوجد سجل حضور لهذا التاريخ")
    
    # الحصول على الوردية
    shift = await get_employee_shift(request.employee_id, request.date)
    settings = await get_attendance_settings(company_id)
    
    # حساب ساعات العمل والتأخير
    actual_hours = 0.0
    late_minutes = 0
    early_leave = 0
    overtime_hours = 0.0
    
    if request.check_in and request.check_out:
        break_duration = shift.get("break_duration", 60) if shift else 60
        actual_hours = calculate_working_hours(request.check_in, request.check_out, break_duration)
        
        if shift:
            late_minutes = calculate_late_minutes(
                shift.get("start_time"),
                request.check_in,
                settings.get("grace_period_minutes", 15)
            )
            early_leave = calculate_early_leave_minutes(shift.get("end_time"), request.check_out)
            
            expected_hours = shift.get("working_hours", 8.0)
            overtime_hours = max(0, actual_hours - expected_hours)
    
    # تحديد الحالة
    status = AttendanceStatus(request.status)
    
    record = AttendanceRecord(
        company_id=company_id,
        employee_id=request.employee_id,
        employee_name=employee.get("name"),
        employee_code=employee.get("employee_code"),
        department=employee.get("department"),
        date=request.date,
        shift_id=shift.get("id") if shift else None,
        shift_name=shift.get("name") if shift else None,
        expected_check_in=shift.get("start_time") if shift else None,
        expected_check_out=shift.get("end_time") if shift else None,
        expected_working_hours=shift.get("working_hours", 8.0) if shift else 8.0,
        check_in=request.check_in,
        check_out=request.check_out,
        actual_working_hours=actual_hours,
        late_minutes=late_minutes,
        early_leave_minutes=early_leave,
        overtime_hours=overtime_hours,
        regular_overtime=overtime_hours,
        status=status,
        notes=request.notes,
        is_excused=request.is_excused,
        excuse_reason=request.excuse_reason,
        created_by=current_user["user_id"]
    )
    
    await db.attendance_records.insert_one(record.dict())
    
    return {"message": "تم إضافة سجل الحضور بنجاح", "record": record.dict()}


# ==========================================
# Attendance Records
# ==========================================

@router.get("/records")
async def get_attendance_records(
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    employee_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على سجلات الحضور"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id}
    
    if date:
        query["date"] = date
    elif start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    if employee_id:
        query["employee_id"] = employee_id
    if department:
        query["department"] = department
    if status:
        query["status"] = status
    
    records = await db.attendance_records.find(query, {"_id": 0}).sort("date", -1).to_list(length=1000)
    
    return {"records": records, "total": len(records)}


@router.get("/records/{record_id}")
async def get_attendance_record(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على سجل حضور"""
    record = await db.attendance_records.find_one({
        "id": record_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    
    if not record:
        raise HTTPException(status_code=404, detail="السجل غير موجود")
    
    return record


@router.put("/records/{record_id}")
async def update_attendance_record(
    record_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """تحديث سجل حضور"""
    record = await db.attendance_records.find_one({
        "id": record_id,
        "company_id": current_user["company_id"]
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="السجل غير موجود")
    
    # إعادة حساب ساعات العمل إذا تم تغيير الأوقات
    if "check_in" in request or "check_out" in request:
        check_in = request.get("check_in", record.get("check_in"))
        check_out = request.get("check_out", record.get("check_out"))
        
        if check_in and check_out:
            shift = None
            if record.get("shift_id"):
                shift = await db.work_shifts.find_one({"id": record["shift_id"]}, {"_id": 0})
            
            break_duration = shift.get("break_duration", 60) if shift else 60
            request["actual_working_hours"] = calculate_working_hours(check_in, check_out, break_duration)
            
            if shift:
                settings = await get_attendance_settings(current_user["company_id"])
                request["late_minutes"] = calculate_late_minutes(
                    shift.get("start_time"), check_in,
                    settings.get("grace_period_minutes", 15)
                )
                request["early_leave_minutes"] = calculate_early_leave_minutes(
                    shift.get("end_time"), check_out
                )
                
                expected_hours = shift.get("working_hours", 8.0)
                request["overtime_hours"] = max(0, request["actual_working_hours"] - expected_hours)
    
    request["updated_at"] = datetime.utcnow()
    
    await db.attendance_records.update_one(
        {"id": record_id},
        {"$set": request}
    )
    
    return {"message": "تم تحديث السجل بنجاح"}


@router.delete("/records/{record_id}")
async def delete_attendance_record(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف سجل حضور"""
    result = await db.attendance_records.delete_one({
        "id": record_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="السجل غير موجود")
    
    return {"message": "تم حذف السجل بنجاح"}


# ==========================================
# Daily Summary
# ==========================================

@router.get("/daily-summary")
async def get_daily_summary(
    date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """ملخص الحضور اليومي"""
    company_id = current_user["company_id"]
    
    # إجمالي الموظفين النشطين
    total_employees = await db.employees.count_documents({
        "company_id": company_id,
        "is_active": True
    })
    
    # سجلات اليوم
    records = await db.attendance_records.find({
        "company_id": company_id,
        "date": date
    }, {"_id": 0}).to_list(length=None)
    
    present = sum(1 for r in records if r.get("status") in ["present", "late", "early_leave"])
    absent = sum(1 for r in records if r.get("status") == "absent")
    late = sum(1 for r in records if r.get("status") == "late")
    on_leave = sum(1 for r in records if r.get("status") == "on_leave")
    
    total_working_hours = sum(r.get("actual_working_hours", 0) for r in records)
    total_overtime = sum(r.get("overtime_hours", 0) for r in records)
    total_late_minutes = sum(r.get("late_minutes", 0) for r in records)
    
    # الموظفين بدون سجل (محتمل غياب)
    employees_with_records = [r["employee_id"] for r in records]
    missing_count = total_employees - len(set(employees_with_records))
    
    attendance_rate = (present / total_employees * 100) if total_employees > 0 else 0
    
    return {
        "date": date,
        "total_employees": total_employees,
        "present_count": present,
        "absent_count": absent + missing_count,
        "late_count": late,
        "on_leave_count": on_leave,
        "missing_records": missing_count,
        "total_working_hours": round(total_working_hours, 2),
        "total_overtime_hours": round(total_overtime, 2),
        "total_late_minutes": total_late_minutes,
        "attendance_rate": round(attendance_rate, 1)
    }


# ==========================================
# Monthly Summary
# ==========================================

@router.get("/monthly-summary")
async def get_monthly_summary(
    month: str = Query(...),
    employee_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """ملخص الحضور الشهري"""
    company_id = current_user["company_id"]
    
    # تحديد نطاق التواريخ
    year, mon = map(int, month.split("-"))
    start_date = f"{month}-01"
    
    # آخر يوم في الشهر
    if mon == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{mon + 1:02d}-01"
    
    # الاستعلام
    query = {
        "company_id": company_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }
    
    if employee_id:
        query["employee_id"] = employee_id
    
    records = await db.attendance_records.find(query, {"_id": 0}).to_list(length=None)
    
    # تجميع حسب الموظف
    employee_summaries = {}
    for r in records:
        emp_id = r["employee_id"]
        if emp_id not in employee_summaries:
            employee_summaries[emp_id] = {
                "employee_id": emp_id,
                "employee_name": r.get("employee_name"),
                "employee_code": r.get("employee_code"),
                "department": r.get("department"),
                "month": month,
                "working_days": 0,
                "present_days": 0,
                "absent_days": 0,
                "late_days": 0,
                "leave_days": 0,
                "total_working_hours": 0,
                "total_overtime_hours": 0,
                "total_late_minutes": 0,
                "total_early_leave_minutes": 0
            }
        
        summary = employee_summaries[emp_id]
        summary["working_days"] += 1
        
        status = r.get("status")
        if status in ["present", "late", "early_leave"]:
            summary["present_days"] += 1
        elif status == "absent":
            summary["absent_days"] += 1
        elif status == "on_leave":
            summary["leave_days"] += 1
        
        if status == "late":
            summary["late_days"] += 1
        
        summary["total_working_hours"] += r.get("actual_working_hours", 0)
        summary["total_overtime_hours"] += r.get("overtime_hours", 0)
        summary["total_late_minutes"] += r.get("late_minutes", 0)
        summary["total_early_leave_minutes"] += r.get("early_leave_minutes", 0)
    
    # حساب نسبة الحضور
    for emp_id, summary in employee_summaries.items():
        if summary["working_days"] > 0:
            summary["attendance_rate"] = round(
                summary["present_days"] / summary["working_days"] * 100, 1
            )
        else:
            summary["attendance_rate"] = 0
        
        summary["total_working_hours"] = round(summary["total_working_hours"], 2)
        summary["total_overtime_hours"] = round(summary["total_overtime_hours"], 2)
    
    return {"summaries": list(employee_summaries.values()), "month": month}


# ==========================================
# Fingerprint Reports
# ==========================================

@router.get("/fingerprint-report")
async def get_fingerprint_report(
    start_date: str = Query(...),
    end_date: str = Query(...),
    employee_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير البصمة"""
    company_id = current_user["company_id"]
    
    query = {
        "company_id": company_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    if employee_id:
        query["employee_id"] = employee_id
    if department:
        query["department"] = department
    
    records = await db.attendance_records.find(query, {"_id": 0}).sort([
        ("employee_name", 1),
        ("date", 1)
    ]).to_list(length=None)
    
    # تجميع البيانات
    report_data = []
    for r in records:
        report_data.append({
            "date": r.get("date"),
            "employee_code": r.get("employee_code"),
            "employee_name": r.get("employee_name"),
            "department": r.get("department"),
            "shift_name": r.get("shift_name"),
            "expected_in": r.get("expected_check_in"),
            "expected_out": r.get("expected_check_out"),
            "actual_in": r.get("check_in"),
            "actual_out": r.get("check_out"),
            "late_minutes": r.get("late_minutes", 0),
            "early_leave_minutes": r.get("early_leave_minutes", 0),
            "working_hours": r.get("actual_working_hours", 0),
            "overtime_hours": r.get("overtime_hours", 0),
            "status": r.get("status"),
            "notes": r.get("notes")
        })
    
    # إحصائيات
    total_records = len(report_data)
    total_late = sum(1 for r in report_data if r["late_minutes"] > 0)
    total_overtime = sum(r["overtime_hours"] for r in report_data)
    total_late_minutes = sum(r["late_minutes"] for r in report_data)
    
    return {
        "report": report_data,
        "statistics": {
            "total_records": total_records,
            "total_late_instances": total_late,
            "total_overtime_hours": round(total_overtime, 2),
            "total_late_minutes": total_late_minutes,
            "average_working_hours": round(
                sum(r["working_hours"] for r in report_data) / total_records, 2
            ) if total_records > 0 else 0
        },
        "period": {
            "start_date": start_date,
            "end_date": end_date
        }
    }


# ==========================================
# Overtime Report
# ==========================================

@router.get("/overtime-report")
async def get_overtime_report(
    month: str = Query(...),
    employee_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير ساعات العمل الإضافي"""
    company_id = current_user["company_id"]
    
    year, mon = map(int, month.split("-"))
    start_date = f"{month}-01"
    if mon == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{mon + 1:02d}-01"
    
    query = {
        "company_id": company_id,
        "date": {"$gte": start_date, "$lt": end_date},
        "overtime_hours": {"$gt": 0}
    }
    
    if employee_id:
        query["employee_id"] = employee_id
    if department:
        query["department"] = department
    
    records = await db.attendance_records.find(query, {"_id": 0}).to_list(length=None)
    
    # تجميع حسب الموظف
    employee_overtime = {}
    for r in records:
        emp_id = r["employee_id"]
        if emp_id not in employee_overtime:
            employee_overtime[emp_id] = {
                "employee_id": emp_id,
                "employee_name": r.get("employee_name"),
                "employee_code": r.get("employee_code"),
                "department": r.get("department"),
                "total_overtime_hours": 0,
                "overtime_days": 0,
                "details": []
            }
        
        summary = employee_overtime[emp_id]
        summary["total_overtime_hours"] += r.get("overtime_hours", 0)
        summary["overtime_days"] += 1
        summary["details"].append({
            "date": r.get("date"),
            "overtime_hours": r.get("overtime_hours", 0),
            "check_in": r.get("check_in"),
            "check_out": r.get("check_out")
        })
    
    # تقريب الأرقام
    for emp_id, summary in employee_overtime.items():
        summary["total_overtime_hours"] = round(summary["total_overtime_hours"], 2)
    
    return {
        "report": list(employee_overtime.values()),
        "month": month,
        "total_overtime_hours": round(sum(e["total_overtime_hours"] for e in employee_overtime.values()), 2)
    }


# ==========================================
# Holidays
# ==========================================

@router.get("/holidays")
async def get_holidays(
    year: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على العطلات الرسمية"""
    query = {"company_id": current_user["company_id"]}
    
    if year:
        query["date"] = {"$regex": f"^{year}"}
    
    holidays = await db.holidays.find(query, {"_id": 0}).sort("date", 1).to_list(length=None)
    return {"holidays": holidays}


@router.post("/holidays")
async def add_holiday(
    request: HolidayRequest,
    current_user: dict = Depends(get_current_user)
):
    """إضافة عطلة رسمية"""
    holiday = Holiday(
        company_id=current_user["company_id"],
        name=request.name,
        name_en=request.name_en,
        date=request.date,
        is_annual=request.is_annual
    )
    
    await db.holidays.insert_one(holiday.dict())
    return {"message": "تم إضافة العطلة بنجاح", "holiday": holiday.dict()}


@router.delete("/holidays/{holiday_id}")
async def delete_holiday(
    holiday_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف عطلة"""
    result = await db.holidays.delete_one({
        "id": holiday_id,
        "company_id": current_user["company_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="العطلة غير موجودة")
    
    return {"message": "تم حذف العطلة بنجاح"}


# ==========================================
# Settings
# ==========================================

@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    """الحصول على إعدادات الحضور"""
    settings = await get_attendance_settings(current_user["company_id"])
    return settings


@router.put("/settings")
async def update_settings(
    request: SettingsUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات الحضور"""
    company_id = current_user["company_id"]
    
    update_data = request.dict()
    update_data["updated_at"] = datetime.utcnow()
    
    await db.attendance_settings.update_one(
        {"company_id": company_id},
        {"$set": update_data},
        upsert=True
    )
    
    return {"message": "تم تحديث الإعدادات بنجاح"}


# ==========================================
# Import Fingerprint Data
# ==========================================

@router.post("/import-fingerprint")
async def import_fingerprint_data(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """استيراد بيانات البصمة من ملف CSV"""
    company_id = current_user["company_id"]
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="يجب أن يكون الملف بصيغة CSV")
    
    content = await file.read()
    decoded = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(decoded))
    
    imported = 0
    errors = []
    
    for row in reader:
        try:
            # البحث عن الموظف
            employee_code = row.get('employee_code') or row.get('كود_الموظف')
            employee = await db.employees.find_one({
                "company_id": company_id,
                "$or": [
                    {"employee_code": employee_code},
                    {"national_id": employee_code}
                ]
            }, {"_id": 0, "id": 1, "name": 1, "employee_code": 1, "department": 1})
            
            if not employee:
                errors.append(f"الموظف غير موجود: {employee_code}")
                continue
            
            date_str = row.get('date') or row.get('التاريخ')
            check_in = row.get('check_in') or row.get('الحضور')
            check_out = row.get('check_out') or row.get('الانصراف')
            
            # التحقق من عدم وجود سجل
            existing = await db.attendance_records.find_one({
                "employee_id": employee["id"],
                "date": date_str,
                "company_id": company_id
            })
            
            if existing:
                # تحديث السجل الموجود
                await db.attendance_records.update_one(
                    {"id": existing["id"]},
                    {"$set": {
                        "check_in": check_in,
                        "check_out": check_out,
                        "updated_at": datetime.utcnow()
                    }}
                )
            else:
                # إنشاء سجل جديد
                shift = await get_employee_shift(employee["id"], date_str)
                
                record = AttendanceRecord(
                    company_id=company_id,
                    employee_id=employee["id"],
                    employee_name=employee.get("name"),
                    employee_code=employee.get("employee_code"),
                    department=employee.get("department"),
                    date=date_str,
                    shift_id=shift.get("id") if shift else None,
                    shift_name=shift.get("name") if shift else None,
                    expected_check_in=shift.get("start_time") if shift else None,
                    expected_check_out=shift.get("end_time") if shift else None,
                    check_in=check_in,
                    check_out=check_out,
                    created_by=current_user["user_id"]
                )
                
                # حساب ساعات العمل
                if check_in and check_out:
                    break_duration = shift.get("break_duration", 60) if shift else 60
                    record.actual_working_hours = calculate_working_hours(check_in, check_out, break_duration)
                    
                    if shift:
                        settings = await get_attendance_settings(company_id)
                        record.late_minutes = calculate_late_minutes(
                            shift.get("start_time"), check_in,
                            settings.get("grace_period_minutes", 15)
                        )
                        record.early_leave_minutes = calculate_early_leave_minutes(
                            shift.get("end_time"), check_out
                        )
                        record.overtime_hours = max(0, record.actual_working_hours - shift.get("working_hours", 8.0))
                
                await db.attendance_records.insert_one(record.dict())
            
            imported += 1
        except Exception as e:
            errors.append(f"خطأ في السطر: {str(e)}")
    
    return {
        "message": f"تم استيراد {imported} سجل",
        "imported": imported,
        "errors": errors[:10]  # أول 10 أخطاء فقط
    }


# ==========================================
# Statistics
# ==========================================

@router.get("/statistics")
async def get_attendance_statistics(
    month: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """إحصائيات الحضور"""
    company_id = current_user["company_id"]
    
    if not month:
        month = datetime.now().strftime("%Y-%m")
    
    year, mon = map(int, month.split("-"))
    start_date = f"{month}-01"
    if mon == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{mon + 1:02d}-01"
    
    records = await db.attendance_records.find({
        "company_id": company_id,
        "date": {"$gte": start_date, "$lt": end_date}
    }, {"_id": 0}).to_list(length=None)
    
    total_employees = await db.employees.count_documents({
        "company_id": company_id,
        "is_active": True
    })
    
    # إحصائيات
    total_records = len(records)
    present = sum(1 for r in records if r.get("status") in ["present", "late", "early_leave"])
    absent = sum(1 for r in records if r.get("status") == "absent")
    late = sum(1 for r in records if r.get("status") == "late")
    on_leave = sum(1 for r in records if r.get("status") == "on_leave")
    
    total_working_hours = sum(r.get("actual_working_hours", 0) for r in records)
    total_overtime = sum(r.get("overtime_hours", 0) for r in records)
    total_late_minutes = sum(r.get("late_minutes", 0) for r in records)
    
    # حساب أيام العمل في الشهر (تقريبي)
    working_days_in_month = 22
    expected_records = total_employees * working_days_in_month
    
    attendance_rate = (present / expected_records * 100) if expected_records > 0 else 0
    
    return {
        "month": month,
        "total_employees": total_employees,
        "total_records": total_records,
        "present_count": present,
        "absent_count": absent,
        "late_count": late,
        "on_leave_count": on_leave,
        "total_working_hours": round(total_working_hours, 2),
        "total_overtime_hours": round(total_overtime, 2),
        "total_late_minutes": total_late_minutes,
        "average_attendance_rate": round(attendance_rate, 1)
    }
