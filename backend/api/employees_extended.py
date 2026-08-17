"""
Extended Employee API with Shifts, Documents, and Enhanced Payroll
واجهة الموظفين المحسنة مع الورديات والمستندات وتفاصيل المرتب
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel
import uuid
import os
import aiofiles

from database import db
from api.users import get_current_user
from models.employee_extended import (
    ExtendedEmployee, EmployeeDocument, EmployeeAllowance, EmployeeDeduction,
    WorkShift, EmployeeShiftAssignment, OvertimeRecord,
    DocumentType, AllowanceCategory, DeductionCategory, ShiftType
)

router = APIRouter(prefix="/api/employees", tags=["Employees Extended"])

UPLOAD_DIR = "/app/backend/uploads/employees"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==========================================
# Request Models
# ==========================================

class EmployeeCreateRequest(BaseModel):
    name: str
    name_en: Optional[str] = None
    national_id: Optional[str] = None
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    marital_status: Optional[str] = None
    nationality: str = "Egyptian"
    
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    
    position: str
    department: Optional[str] = None
    branch: Optional[str] = None
    manager_id: Optional[str] = None
    hire_date: str
    contract_type: str = "permanent"
    contract_end_date: Optional[str] = None
    
    basic_salary: float = 0.0
    
    social_insurance_number: Optional[str] = None
    insurance_salary: Optional[float] = None
    
    health_insurance_number: Optional[str] = None
    health_insurance_company: Optional[str] = None
    health_insurance_amount: float = 0.0
    health_insurance_type: str = "company"
    
    medical_allowance: float = 0.0
    medical_yearly_limit: float = 0.0
    
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    iban: Optional[str] = None
    wallet_number: Optional[str] = None
    payment_method: Optional[str] = "bank_transfer"  # bank_transfer | cash | instapay | vodafone_cash
    
    annual_leave_balance: int = 21
    notes: Optional[str] = None


class ShiftCreateRequest(BaseModel):
    name: str
    name_en: Optional[str] = None
    shift_type: str = "morning"
    start_time: str
    end_time: str
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    break_duration: int = 60
    working_hours: float = 8.0
    overtime_starts_after: float = 8.0
    working_days: List[str] = ["sunday", "monday", "tuesday", "wednesday", "thursday"]
    overtime_rate: float = 1.5
    holiday_rate: float = 2.0
    night_rate: float = 1.25
    allow_late_minutes: int = 15


class AllowanceRequest(BaseModel):
    category: str
    name: str
    name_en: Optional[str] = None
    amount: float
    is_percentage: bool = False
    percentage: float = 0.0
    is_taxable: bool = True
    is_insurable: bool = False


class DeductionRequest(BaseModel):
    category: str
    name: str
    name_en: Optional[str] = None
    amount: float
    is_percentage: bool = False
    percentage: float = 0.0


class OvertimeRequest(BaseModel):
    employee_id: str
    date: str
    overtime_hours: float
    holiday_hours: float = 0.0
    night_hours: float = 0.0
    notes: Optional[str] = None


# ==========================================
# Helper Functions
# ==========================================

async def generate_employee_code(company_id: str) -> str:
    """توليد كود موظف"""
    count = await db.employees.count_documents({"company_id": company_id})
    return f"EMP-{str(count + 1).zfill(4)}"


async def calculate_employee_totals(employee: dict) -> dict:
    """حساب إجماليات الموظف"""
    basic_salary = employee.get("basic_salary", 0)
    
    # حساب البدلات
    total_allowances = 0
    for allow in employee.get("allowances", []):
        if allow.get("is_active", True):
            if allow.get("is_percentage"):
                total_allowances += basic_salary * (allow.get("percentage", 0) / 100)
            else:
                total_allowances += allow.get("amount", 0)
    
    # حساب الخصومات الثابتة
    total_deductions = 0
    for ded in employee.get("deductions", []):
        if ded.get("is_active", True):
            if ded.get("is_percentage"):
                total_deductions += basic_salary * (ded.get("percentage", 0) / 100)
            else:
                total_deductions += ded.get("amount", 0)
    
    # إضافة التأمين الصحي
    health_insurance = employee.get("health_insurance_amount", 0)
    if employee.get("health_insurance_type") == "self":
        total_deductions += health_insurance
    
    gross_salary = basic_salary + total_allowances
    net_salary = gross_salary - total_deductions
    
    return {
        "basic_salary": basic_salary,
        "total_allowances": round(total_allowances, 2),
        "gross_salary": round(gross_salary, 2),
        "total_deductions": round(total_deductions, 2),
        "net_salary": round(net_salary, 2)
    }


# ==========================================
# Employee Endpoints
# ==========================================

@router.get("")
async def get_employees(
    department: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على قائمة الموظفين"""
    company_id = current_user["company_id"]
    query = {"company_id": company_id}
    
    if department:
        query["department"] = department
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"name_en": {"$regex": search, "$options": "i"}},
            {"employee_code": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    employees = await db.employees.find(query, {"_id": 0}).sort("name", 1).to_list(length=None)
    
    # حساب الإجماليات لكل موظف
    for emp in employees:
        totals = await calculate_employee_totals(emp)
        emp.update(totals)
    
    return {"employees": employees, "total": len(employees)}


@router.get("/{employee_id}")
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على تفاصيل موظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    }, {"_id": 0})
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # حساب الإجماليات
    totals = await calculate_employee_totals(employee)
    employee.update(totals)
    
    # الحصول على الوردية الحالية
    if employee.get("current_shift_id"):
        shift = await db.work_shifts.find_one({"id": employee["current_shift_id"]}, {"_id": 0})
        employee["current_shift"] = shift
    
    # الحصول على سجل الرواتب الأخير
    last_payroll = await db.payroll_runs.find_one(
        {"company_id": current_user["company_id"], "status": {"$in": ["approved", "paid"]}},
        {"_id": 0},
        sort=[("month", -1)]
    )
    if last_payroll:
        for emp_pay in last_payroll.get("employees", []):
            if emp_pay["employee_id"] == employee_id:
                employee["last_payroll"] = {
                    "month": last_payroll["month"],
                    "basic_salary": emp_pay.get("basic_salary", 0),
                    "gross_salary": emp_pay.get("gross_salary", 0),
                    "total_deductions": emp_pay.get("total_deductions", 0),
                    "net_salary": emp_pay.get("net_salary", 0)
                }
                break
    
    return employee


@router.post("")
async def create_employee(
    request: EmployeeCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء موظف جديد"""
    company_id = current_user["company_id"]
    
    # توليد كود الموظف
    employee_code = await generate_employee_code(company_id)
    
    employee = ExtendedEmployee(
        company_id=company_id,
        employee_code=employee_code,
        **request.dict()
    )
    
    # تحديث رصيد العلاج
    employee.medical_balance = request.medical_yearly_limit
    
    await db.employees.insert_one(employee.dict())
    
    return {"message": "تم إنشاء الموظف بنجاح", "employee": employee.dict()}


@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """تحديث بيانات موظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    })
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # منع تعديل كود الموظف - immutable field
    if "employee_code" in request:
        del request["employee_code"]
    
    # تحديث البيانات
    request["updated_at"] = datetime.utcnow()
    
    await db.employees.update_one(
        {"id": employee_id},
        {"$set": request}
    )
    
    return {"message": "تم تحديث بيانات الموظف بنجاح"}


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف موظف (تعطيل)"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    })
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    await db.employees.update_one(
        {"id": employee_id},
        {"$set": {
            "is_active": False,
            "termination_date": datetime.now().strftime("%Y-%m-%d"),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {"message": "تم تعطيل الموظف بنجاح"}


# ==========================================
# Photo Upload
# ==========================================

@router.post("/{employee_id}/photo")
async def upload_employee_photo(
    employee_id: str,
    photo: UploadFile = File(None),
    file: UploadFile = File(None),
    current_user: dict = Depends(get_current_user)
):
    """رفع صورة الموظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    })
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # التحقق من نوع الملف
    file = photo or file
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="نوع الملف غير مدعوم")
    
    # حفظ الملف
    ext = file.filename.split(".")[-1]
    filename = f"{employee_id}_photo.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    photo_url = f"/api/uploads/employees/{filename}"
    
    await db.employees.update_one(
        {"id": employee_id},
        {"$set": {"photo_url": photo_url, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "تم رفع الصورة بنجاح", "photo_url": photo_url}


# ==========================================
# Documents
# ==========================================

@router.get("/{employee_id}/documents")
async def get_employee_documents(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على مستندات الموظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    }, {"documents": 1})
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    return {"documents": employee.get("documents", [])}


@router.post("/{employee_id}/documents")
async def upload_employee_document(
    employee_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    name: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """رفع مستند للموظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    })
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # حفظ الملف
    doc_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    filename = f"{employee_id}_{doc_id}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    async with aiofiles.open(filepath, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    file_url = f"/api/uploads/employees/{filename}"
    
    document = EmployeeDocument(
        id=doc_id,
        document_type=DocumentType(document_type),
        name=name,
        file_url=file_url,
        file_name=file.filename,
        file_size=len(content),
        expiry_date=expiry_date,
        notes=notes,
        uploaded_by=current_user["user_id"]
    )
    
    await db.employees.update_one(
        {"id": employee_id},
        {"$push": {"documents": document.dict()}}
    )
    
    return {"message": "تم رفع المستند بنجاح", "document": document.dict()}


@router.delete("/{employee_id}/documents/{document_id}")
async def delete_employee_document(
    employee_id: str,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف مستند"""
    await db.employees.update_one(
        {"id": employee_id, "company_id": current_user["company_id"]},
        {"$pull": {"documents": {"id": document_id}}}
    )
    
    return {"message": "تم حذف المستند بنجاح"}


# ==========================================
# Allowances & Deductions
# ==========================================

@router.post("/{employee_id}/allowances")
async def add_employee_allowance(
    employee_id: str,
    request: AllowanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """إضافة بدل للموظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    })
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    allowance = EmployeeAllowance(
        category=AllowanceCategory(request.category),
        name=request.name,
        name_en=request.name_en,
        amount=request.amount,
        is_percentage=request.is_percentage,
        percentage=request.percentage,
        is_taxable=request.is_taxable,
        is_insurable=request.is_insurable,
        effective_date=datetime.now().strftime("%Y-%m-%d")
    )
    
    await db.employees.update_one(
        {"id": employee_id},
        {"$push": {"allowances": allowance.dict()}}
    )
    
    return {"message": "تم إضافة البدل بنجاح", "allowance": allowance.dict()}


@router.delete("/{employee_id}/allowances/{allowance_id}")
async def remove_employee_allowance(
    employee_id: str,
    allowance_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف بدل"""
    await db.employees.update_one(
        {"id": employee_id, "company_id": current_user["company_id"]},
        {"$pull": {"allowances": {"id": allowance_id}}}
    )
    
    return {"message": "تم حذف البدل بنجاح"}


@router.post("/{employee_id}/deductions")
async def add_employee_deduction(
    employee_id: str,
    request: DeductionRequest,
    current_user: dict = Depends(get_current_user)
):
    """إضافة خصم للموظف"""
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": current_user["company_id"]
    })
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    deduction = EmployeeDeduction(
        category=DeductionCategory(request.category),
        name=request.name,
        name_en=request.name_en,
        amount=request.amount,
        is_percentage=request.is_percentage,
        percentage=request.percentage,
        effective_date=datetime.now().strftime("%Y-%m-%d")
    )
    
    await db.employees.update_one(
        {"id": employee_id},
        {"$push": {"deductions": deduction.dict()}}
    )
    
    return {"message": "تم إضافة الخصم بنجاح", "deduction": deduction.dict()}


@router.delete("/{employee_id}/deductions/{deduction_id}")
async def remove_employee_deduction(
    employee_id: str,
    deduction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف خصم"""
    await db.employees.update_one(
        {"id": employee_id, "company_id": current_user["company_id"]},
        {"$pull": {"deductions": {"id": deduction_id}}}
    )
    
    return {"message": "تم حذف الخصم بنجاح"}


# ==========================================
# Work Shifts
# ==========================================

@router.get("/shifts/list")
async def get_shifts(
    current_user: dict = Depends(get_current_user)
):
    """الحصول على قائمة الورديات"""
    shifts = await db.work_shifts.find(
        {"company_id": current_user["company_id"], "is_active": True},
        {"_id": 0}
    ).to_list(length=None)
    
    return {"shifts": shifts}


@router.post("/shifts/create")
async def create_shift(
    request: ShiftCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء وردية جديدة"""
    shift = WorkShift(
        company_id=current_user["company_id"],
        name=request.name,
        name_en=request.name_en,
        shift_type=ShiftType(request.shift_type),
        start_time=request.start_time,
        end_time=request.end_time,
        break_start=request.break_start,
        break_end=request.break_end,
        break_duration=request.break_duration,
        working_hours=request.working_hours,
        overtime_starts_after=request.overtime_starts_after,
        working_days=request.working_days,
        overtime_rate=request.overtime_rate,
        holiday_rate=request.holiday_rate,
        night_rate=request.night_rate,
        allow_late_minutes=request.allow_late_minutes
    )
    
    await db.work_shifts.insert_one(shift.dict())
    
    return {"message": "تم إنشاء الوردية بنجاح", "shift": shift.dict()}


@router.put("/shifts/{shift_id}")
async def update_shift(
    shift_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """تحديث وردية"""
    shift = await db.work_shifts.find_one({
        "id": shift_id,
        "company_id": current_user["company_id"]
    })
    
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    
    await db.work_shifts.update_one(
        {"id": shift_id},
        {"$set": request}
    )
    
    return {"message": "تم تحديث الوردية بنجاح"}


@router.delete("/shifts/{shift_id}")
async def delete_shift(
    shift_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف وردية"""
    await db.work_shifts.update_one(
        {"id": shift_id, "company_id": current_user["company_id"]},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "تم حذف الوردية بنجاح"}


@router.post("/{employee_id}/assign-shift")
async def assign_shift_to_employee(
    employee_id: str,
    shift_id: str = Query(...),
    effective_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """تعيين وردية لموظف"""
    company_id = current_user["company_id"]
    
    employee = await db.employees.find_one({"id": employee_id, "company_id": company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    shift = await db.work_shifts.find_one({"id": shift_id, "company_id": company_id})
    if not shift:
        raise HTTPException(status_code=404, detail="الوردية غير موجودة")
    
    # إنهاء التعيين السابق
    await db.shift_assignments.update_many(
        {"employee_id": employee_id, "is_current": True},
        {"$set": {"is_current": False, "end_date": effective_date}}
    )
    
    # إنشاء تعيين جديد
    assignment = EmployeeShiftAssignment(
        company_id=company_id,
        employee_id=employee_id,
        shift_id=shift_id,
        effective_date=effective_date
    )
    
    await db.shift_assignments.insert_one(assignment.dict())
    
    # تحديث الموظف
    await db.employees.update_one(
        {"id": employee_id},
        {"$set": {"current_shift_id": shift_id}}
    )
    
    return {"message": "تم تعيين الوردية بنجاح"}


# ==========================================
# Overtime
# ==========================================

@router.get("/overtime/list")
async def get_overtime_records(
    month: str = Query(...),
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على سجلات العمل الإضافي"""
    query = {"company_id": current_user["company_id"], "month": month}
    
    if employee_id:
        query["employee_id"] = employee_id
    if status:
        query["status"] = status
    
    records = await db.overtime_records.find(query, {"_id": 0}).to_list(length=None)
    
    return {"records": records}


@router.post("/overtime/create")
async def create_overtime_record(
    request: OvertimeRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء سجل عمل إضافي"""
    company_id = current_user["company_id"]
    
    employee = await db.employees.find_one({"id": request.employee_id, "company_id": company_id})
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    # حساب سعر الساعة
    basic_salary = employee.get("basic_salary", 0)
    hourly_rate = basic_salary / 30 / 8  # افتراض 30 يوم و 8 ساعات
    
    # الحصول على معدلات الوردية
    shift = None
    if employee.get("current_shift_id"):
        shift = await db.work_shifts.find_one({"id": employee["current_shift_id"]})
    
    overtime_rate = shift.get("overtime_rate", 1.5) if shift else 1.5
    holiday_rate = shift.get("holiday_rate", 2.0) if shift else 2.0
    night_rate = shift.get("night_rate", 1.25) if shift else 1.25
    
    # حساب المبالغ
    overtime_amount = request.overtime_hours * hourly_rate * overtime_rate
    holiday_amount = request.holiday_hours * hourly_rate * holiday_rate
    night_amount = request.night_hours * hourly_rate * night_rate
    total_amount = overtime_amount + holiday_amount + night_amount
    
    # تحديد الشهر
    month = request.date[:7]  # YYYY-MM
    
    record = OvertimeRecord(
        company_id=company_id,
        employee_id=request.employee_id,
        employee_name=employee.get("name"),
        date=request.date,
        shift_id=employee.get("current_shift_id"),
        overtime_hours=request.overtime_hours,
        holiday_hours=request.holiday_hours,
        night_hours=request.night_hours,
        hourly_rate=round(hourly_rate, 2),
        overtime_rate=overtime_rate,
        holiday_rate=holiday_rate,
        night_rate=night_rate,
        overtime_amount=round(overtime_amount, 2),
        holiday_amount=round(holiday_amount, 2),
        night_amount=round(night_amount, 2),
        total_amount=round(total_amount, 2),
        month=month,
        notes=request.notes
    )
    
    await db.overtime_records.insert_one(record.dict())
    
    return {"message": "تم إنشاء سجل العمل الإضافي بنجاح", "record": record.dict()}


@router.post("/overtime/{record_id}/approve")
async def approve_overtime(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد سجل عمل إضافي"""
    record = await db.overtime_records.find_one({
        "id": record_id,
        "company_id": current_user["company_id"]
    })
    
    if not record:
        raise HTTPException(status_code=404, detail="السجل غير موجود")
    
    await db.overtime_records.update_one(
        {"id": record_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["user_id"],
            "approved_at": datetime.utcnow()
        }}
    )
    
    return {"message": "تم اعتماد سجل العمل الإضافي بنجاح"}


# ==========================================
# Salary Summary
# ==========================================

@router.get("/{employee_id}/salary-summary")
async def get_employee_salary_summary(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """ملخص راتب الموظف"""
    company_id = current_user["company_id"]
    
    employee = await db.employees.find_one({
        "id": employee_id,
        "company_id": company_id
    }, {"_id": 0})
    
    if not employee:
        raise HTTPException(status_code=404, detail="الموظف غير موجود")
    
    basic_salary = employee.get("basic_salary", 0)
    
    # البدلات
    allowances = []
    total_allowances = 0
    for allow in employee.get("allowances", []):
        if allow.get("is_active", True):
            amount = allow.get("amount", 0)
            if allow.get("is_percentage"):
                amount = basic_salary * (allow.get("percentage", 0) / 100)
            allowances.append({
                "name": allow.get("name"),
                "category": allow.get("category"),
                "amount": round(amount, 2)
            })
            total_allowances += amount
    
    # الخصومات
    deductions = []
    total_deductions = 0
    
    # التأمينات الاجتماعية
    if employee.get("social_insurance_number"):
        insurance_salary = employee.get("insurance_salary") or basic_salary
        si_amount = insurance_salary * 0.11  # 11%
        deductions.append({
            "name": "تأمينات اجتماعية",
            "category": "social_insurance",
            "amount": round(si_amount, 2)
        })
        total_deductions += si_amount
    
    # التأمين الصحي
    if employee.get("health_insurance_type") == "self":
        hi_amount = employee.get("health_insurance_amount", 0)
        deductions.append({
            "name": "تأمين صحي",
            "category": "health_insurance",
            "amount": round(hi_amount, 2)
        })
        total_deductions += hi_amount
    
    # خصومات أخرى
    for ded in employee.get("deductions", []):
        if ded.get("is_active", True):
            amount = ded.get("amount", 0)
            if ded.get("is_percentage"):
                amount = basic_salary * (ded.get("percentage", 0) / 100)
            deductions.append({
                "name": ded.get("name"),
                "category": ded.get("category"),
                "amount": round(amount, 2)
            })
            total_deductions += amount
    
    gross_salary = basic_salary + total_allowances
    net_salary = gross_salary - total_deductions
    
    return {
        "employee_id": employee_id,
        "employee_name": employee.get("name"),
        "basic_salary": round(basic_salary, 2),
        "allowances": allowances,
        "total_allowances": round(total_allowances, 2),
        "gross_salary": round(gross_salary, 2),
        "deductions": deductions,
        "total_deductions": round(total_deductions, 2),
        "net_salary": round(net_salary, 2)
    }


# ==========================================
# Payroll History
# ==========================================

@router.get("/{employee_id}/payroll-history")
async def get_employee_payroll_history(
    employee_id: str,
    year: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """سجل رواتب الموظف"""
    company_id = current_user["company_id"]
    
    query = {
        "company_id": company_id,
        "status": {"$in": ["approved", "paid"]},
        "employees.employee_id": employee_id
    }
    
    if year:
        query["year"] = year
    
    payrolls = await db.payroll_runs.find(query, {"_id": 0}).sort("month", -1).to_list(length=None)
    
    history = []
    for payroll in payrolls:
        for emp in payroll.get("employees", []):
            if emp["employee_id"] == employee_id:
                history.append({
                    "month": payroll["month"],
                    "payroll_number": payroll["payroll_number"],
                    "status": payroll["status"],
                    "basic_salary": emp.get("basic_salary", 0),
                    "total_allowances": emp.get("total_allowances", 0),
                    "gross_salary": emp.get("gross_salary", 0),
                    "total_deductions": emp.get("total_deductions", 0),
                    "net_salary": emp.get("net_salary", 0)
                })
                break
    
    return {"history": history}


# ==========================================
# Statistics
# ==========================================

@router.get("/stats/summary")
async def get_employees_stats(
    current_user: dict = Depends(get_current_user)
):
    """إحصائيات الموظفين"""
    company_id = current_user["company_id"]
    
    # إجمالي الموظفين
    total = await db.employees.count_documents({"company_id": company_id})
    active = await db.employees.count_documents({"company_id": company_id, "is_active": True})
    inactive = total - active
    
    # حسب القسم
    departments = await db.employees.aggregate([
        {"$match": {"company_id": company_id, "is_active": True}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}}
    ]).to_list(length=None)
    
    # إجمالي الرواتب
    salary_sum = await db.employees.aggregate([
        {"$match": {"company_id": company_id, "is_active": True}},
        {"$group": {"_id": None, "total": {"$sum": "$basic_salary"}}}
    ]).to_list(length=1)
    
    total_salaries = salary_sum[0]["total"] if salary_sum else 0
    
    return {
        "total_employees": total,
        "active_employees": active,
        "inactive_employees": inactive,
        "by_department": [{"department": d["_id"] or "غير محدد", "count": d["count"]} for d in departments],
        "total_basic_salaries": round(total_salaries, 2)
    }
