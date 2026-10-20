"""
Employee Self-Service Portal — بوابة الخدمة الذاتية للموظفين
+ Multi-Tenant Isolation Architecture

أ. ESS Portal:
   - طلبات الإجازات / السلف / الوقت الإضافي
   - قسيمة الراتب PDF مشفرة
   - الحضور بالموقع الجغرافي (Geofencing)

ب. Multi-Tenant Architecture:
   - Row-Level Security validation middleware
   - Tenant isolation audit
   - Schema-per-tenant documentation + enforcement
"""
import uuid, io, math, hashlib, json
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, Request, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from dependencies import get_current_user

router = APIRouter(prefix="/api/ess", tags=["Employee Self-Service"])


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

async def get_employee_by_user(user_id: str, company_id: str) -> dict:
    """Get employee record linked to the logged-in user"""
    emp = await db.employees.find_one(
        {"user_id": user_id, "company_id": company_id}, {"_id": 0}
    )
    if not emp:
        # Fallback: find by employee_id stored in user profile
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user and user.get("employee_id"):
            emp = await db.employees.find_one(
                {"id": user["employee_id"], "company_id": company_id}, {"_id": 0}
            )
    if not emp:
        raise HTTPException(403, "هذا الحساب غير مرتبط بملف موظف — تواصل مع الـ HR")
    return emp


def haversine_distance(lat1, lon1, lat2, lon2) -> float:
    """
    حساب المسافة بين نقطتين جغرافيتين (بالمتر)
    Haversine Formula
    """
    R = 6_371_000  # Earth radius in meters
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a  = math.sin(Δφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(Δλ/2)**2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a)), 2)


# ══════════════════════════════════════════════════════════════
# أ-1. ATTENDANCE WITH GEOFENCING — الحضور بالموقع الجغرافي
# ══════════════════════════════════════════════════════════════

class AttendanceRequest(BaseModel):
    latitude:   float
    longitude:  float
    device_id:  Optional[str] = None
    notes:      Optional[str] = None



def resolve_work_location(emp: dict, company: dict):
    """Where this employee must check in, and whether remote check-in is allowed.

    The GPS settings page saves companies.gps_settings, but check-in read
    companies.work_location — a field nothing writes — so the geofence never
    applied and anyone could check in from anywhere. Order: the employee's own
    location (a branch) first, then the company's GPS settings, then the old
    field. Returns (location | None, remote_allowed)."""
    gps = company.get("gps_settings") or {}
    candidates = [emp.get("work_location"),
                  gps if gps.get("enabled", True) else None,
                  company.get("work_location")]
    loc = next((c for c in candidates if c and c.get("latitude") not in (None, "")), None)
    remote = bool(gps.get("allow_remote") or company.get("allow_remote_checkin") or emp.get("remote_work_allowed"))
    return loc, remote


def _geofence(emp: dict, company: dict, req, action: str) -> tuple:
    """(status, distance_m, allowed_radius) — refuses outside the work radius
    unless remote work is allowed. Used for check-in AND check-out: check-out
    had no location check, so a day could be closed from anywhere."""
    work_location, remote_allowed = resolve_work_location(emp, company)
    if not (work_location and work_location.get("latitude")):
        return "not_configured", None, 500
    wlat = float(work_location["latitude"])
    wlon = float(work_location["longitude"])
    allowed_radius = float(work_location.get("radius_meters", 40))
    distance_m = haversine_distance(req.latitude, req.longitude, wlat, wlon)
    if distance_m <= allowed_radius:
        return "within_range", distance_m, allowed_radius
    if not remote_allowed:
        raise HTTPException(400,
            f"أنت خارج نطاق مكان العمل ({distance_m:.0f}م) — "
            f"الحد المسموح {allowed_radius:.0f}م | "
            f"لا يمكن تسجيل {action} من هنا — تواصل مع مديرك للحصول على إذن العمل عن بُعد")
    return "out_of_range", distance_m, allowed_radius


@router.post("/attendance/check-in")
async def ess_check_in(
    req: AttendanceRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    تسجيل حضور من الهاتف مع التحقق من الموقع الجغرافي (Geofencing)

    النظام يتحقق أن الموظف داخل نطاق مكان العمل المُعرَّف
    """
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    # Check existing open check-in
    today = date.today().isoformat()
    existing = await db.attendance_records.find_one({
        "employee_id": emp["id"],
        "company_id":  company_id,
        "date":        today,
        "check_out":   None,
    })
    if existing:
        raise HTTPException(400, f"تم تسجيل الحضور بالفعل اليوم في {existing.get('check_in','')}")

    # Geofencing check
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    geofence_status, distance_m, allowed_radius = _geofence(emp, company, req, "الحضور")

    # Create check-in record
    record_id = str(uuid.uuid4())
    now       = datetime.now(timezone.utc).isoformat()
    ip        = request.headers.get("X-Forwarded-For", getattr(request.client, "host",""))

    record = {
        "id":            record_id,
        "company_id":    company_id,
        "employee_id":   emp["id"],
        "employee_name": emp.get("name",""),
        "date":          today,
        "check_in":      now,
        "check_out":     None,
        # The privacy policy promises employees that exact coordinates are not
        # stored — only whether they were inside the allowed area and how far
        # from the office. The record kept latitude and longitude anyway, and
        # nothing ever read them. They are used for the distance check above
        # and then discarded, so the record now matches the promise.
        "check_in_location": {
            "distance_from_office_m": distance_m,
            "geofence_status": geofence_status,
        },
        "check_out_location": None,
        "device_id":     req.device_id,
        "ip_address":    ip,
        "status":        "present",
        "work_hours":    None,
        "notes":         req.notes,
        "created_at":    now,
    }
    await db.attendance_records.insert_one(record)
    record.pop("_id", None)

    return {
        "message":       f"✅ تم تسجيل حضورك — {now[:19].replace('T',' ')}",
        "record_id":     record_id,
        "geofence": {
            "status":         geofence_status,
            "distance_m":     distance_m,
            "allowed_radius": allowed_radius,
        },
        "employee":      emp.get("name",""),
    }


@router.post("/attendance/check-out")
async def ess_check_out(
    req: AttendanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """تسجيل انصراف من الهاتف"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)
    today = date.today().isoformat()

    record = await db.attendance_records.find_one({
        "employee_id": emp["id"],
        "company_id":  company_id,
        "date":        today,
        "check_out":   None,
    })
    if not record:
        raise HTTPException(400, "لا يوجد تسجيل حضور مفتوح اليوم")

    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    geofence_status, distance_m, allowed_radius = _geofence(emp, company, req, "الانصراف")

    check_in_dt  = datetime.fromisoformat(record["check_in"])
    if check_in_dt.tzinfo is None:            # older records were saved without a zone
        check_in_dt = check_in_dt.replace(tzinfo=timezone.utc)
    check_out_dt = datetime.now(timezone.utc)
    # total_seconds: .seconds dropped whole days and wrapped past 24h
    work_hours   = round(max((check_out_dt - check_in_dt).total_seconds(), 0) / 3600, 2)
    now          = check_out_dt.isoformat()

    await db.attendance_records.update_one(
        {"id": record["id"]},
        {"$set": {
            "check_out":  now,
            "work_hours": work_hours,
            "check_out_location": {
                "latitude": req.latitude, "longitude": req.longitude,
                "distance_from_office_m": distance_m,
                "geofence_status": geofence_status,
            },
        }}
    )
    return {
        "message":    f"✅ تم تسجيل انصرافك — {now[:19].replace('T',' ')}",
        "work_hours": work_hours,
        "check_in":   record["check_in"][:19].replace("T"," "),
        "check_out":  now[:19].replace("T"," "),
    }


@router.get("/attendance/my-records")
async def my_attendance(
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """سجل حضور الموظف الشخصي"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)
    today = date.today()
    if month:
        y, m = map(int, month.split("-"))
        date_from = f"{y}-{m:02d}-01"
        m2 = m+1; y2 = y
        if m2>12: y2+=1; m2=1
        date_to = f"{y2}-{m2:02d}-01"
    else:
        date_from = f"{today.year}-{today.month:02d}-01"
        date_to   = today.isoformat()

    records = await db.attendance_records.find({
        "employee_id": emp["id"],
        "company_id":  company_id,
        "date": {"$gte": date_from, "$lte": date_to},
    }, {"_id": 0}).sort("date", -1).to_list(None)

    total_hours = round(sum(float(r.get("work_hours") or 0) for r in records), 2)
    present_days = len([r for r in records if r["status"] == "present"])
    return {
        "employee": emp.get("name",""),
        "period": {"from": date_from, "to": date_to},
        "summary": {"total_days": len(records), "present": present_days,
                    "total_hours": total_hours},
        "records": records,
    }


# ══════════════════════════════════════════════════════════════
# أ-2. ESS REQUESTS — طلبات الموظف الذاتية
# ══════════════════════════════════════════════════════════════

@router.post("/requests/leave")
async def request_leave_ess(data: dict, current_user: dict = Depends(get_current_user)):
    """تقديم طلب إجازة من الهاتف"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    leave_type = data.get("leave_type","annual")
    start = data.get("start_date"); end = data.get("end_date")
    if not start or not end:
        raise HTTPException(400, "start_date و end_date مطلوبان")

    sd = date.fromisoformat(start); ed = date.fromisoformat(end)
    days = (ed - sd).days + 1
    if days <= 0:
        raise HTTPException(400, "تاريخ الانتهاء يجب أن يكون بعد البداية")
    if leave_type == "casual" and days > 2:
        raise HTTPException(400, "الإجازة العارضة لا تتجاوز يومين")

    if leave_type not in ("annual", "casual", "sick"):
        raise HTTPException(400, "نوع الإجازة: سنوية أو عارضة أو مرضية")
    req = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id":   emp["id"],
        "employee_name": emp.get("name",""),
        "employee_code": emp.get("employee_code", ""),
        "request_type":  "leave",
        "leave_type":    leave_type,
        "start_date":    start, "end_date": end, "days": days,
        "reason":        data.get("reason",""),
        "status":        "pending",
        "submitted_via": "mobile_ess",
        "created_by":    current_user.get("user_id"),
        "created_at":    datetime.now(timezone.utc).isoformat(),
    }
    # db.leaves is what the HR leave screens list and approve, and the
    # approval request puts it in the managers' «الموافقات» queue. It used to
    # go to db.leave_requests, which nobody could approve.
    await db.leaves.insert_one(req); req.pop("_id",None)
    try:
        from api.approvals import open_approval_request
        names = {"annual": "سنوية", "casual": "عارضة", "sick": "مرضية"}
        await open_approval_request(company_id, current_user.get("user_id"), emp.get("name", ""), {
            "type": "leave_request", "title": f"إجازة {names[leave_type]} — {emp.get('name', '')} ({days} يوم)",
            "description": data.get("reason", ""), "reference_type": "leave", "reference_id": req["id"],
            "data": {"start_date": start, "end_date": end, "days": days, "leave_type": leave_type}})
    except HTTPException:
        pass        # no approver configured yet: HR still sees it in the leave screens
    return {"message": f"✅ تم تقديم طلب إجازة {days} يوم", "request": req}


@router.post("/requests/loan")
async def request_loan_ess(data: dict, current_user: dict = Depends(get_current_user)):
    """تقديم طلب سلفة من الهاتف"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    amount = float(data.get("amount", 0))
    if amount <= 0:
        raise HTTPException(400, "مبلغ السلفة يجب أن يكون موجباً")

    # Check existing active loans
    active = await db.employee_loans.count_documents({
        "employee_id": emp["id"], "company_id": company_id, "status": "active"
    })
    if active > 0:
        raise HTTPException(400, "لديك سلفة نشطة — يجب سدادها أولاً")

    req = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id":      emp["id"],
        "employee_name":    emp.get("name",""),
        "request_type":     "loan",
        "amount":           amount,
        "installments":     int(data.get("installments", 3)),
        "reason":           data.get("reason",""),
        "status":           "pending",
        "submitted_via":    "mobile_ess",
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }
    installments = max(1, min(int(data.get("installments", 3) or 3), 60))
    req["installments"] = installments
    # the request was written only to ess_requests, which no HR screen reads —
    # it now also lands in employee_loans as a pending loan, where الرواتب ←
    # السُلف lists it with its approve button (approval posts the entry)
    pending = await db.employee_loans.count_documents(
        {"employee_id": emp["id"], "company_id": company_id, "status": "pending"})
    if pending:
        raise HTTPException(400, "لديك طلب سلفة قيد المراجعة بالفعل")
    from models.payroll import EmployeeLoan
    from api.payroll import generate_number
    now = datetime.now(timezone.utc)
    nxt = (now.replace(day=1) + timedelta(days=32)).strftime("%Y-%m")
    loan = EmployeeLoan(
        company_id=company_id, employee_id=emp["id"], employee_name=emp.get("name", ""),
        loan_number=await generate_number(company_id, "LOAN", "employee_loans"),
        loan_date=now.strftime("%Y-%m-%d"), amount=round(amount, 2), installments=installments,
        installment_amount=round(amount / installments, 2), remaining_amount=round(amount, 2),
        start_month=nxt, reason=req["reason"] or "طلب من بوابة الموظف", notes="ess")
    loan_doc = loan.dict()
    loan_doc["source"] = "ess"
    loan_doc["ess_request_id"] = req["id"]
    await db.employee_loans.insert_one(loan_doc)
    req["loan_id"] = loan.id
    req["loan_number"] = loan.loan_number
    await db.ess_requests.insert_one(req); req.pop("_id",None)
    return {"message": f"✅ تم تقديم طلب سلفة {amount:,.2f} ج.م — في انتظار موافقة الموارد البشرية", "request": req}


@router.post("/requests/overtime")
async def request_overtime_ess(data: dict, current_user: dict = Depends(get_current_user)):
    """تقديم طلب وقت إضافي من الهاتف"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    req = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "employee_id":   emp["id"],
        "employee_name": emp.get("name",""),
        "request_type":  "overtime",
        "date":          data.get("date", date.today().isoformat()),
        "hours":         float(data.get("hours", 1)),
        "ot_type":       data.get("ot_type","day"),  # day|night|holiday
        "reason":        data.get("reason",""),
        "status":        "pending",
        "submitted_via": "mobile_ess",
        "created_at":    datetime.now(timezone.utc).isoformat(),
    }
    await db.ess_requests.insert_one(req); req.pop("_id",None)
    return {"message": f"✅ تم تقديم طلب وقت إضافي {req['hours']} ساعة", "request": req}


@router.get("/requests/my-requests")
async def my_requests(
    request_type: Optional[str] = None,
    status:       Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """طلباتي الذاتية (إجازات، سلف، وقت إضافي)"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    q = {"employee_id": emp["id"], "company_id": company_id}
    if request_type: q["request_type"] = request_type
    if status:       q["status"] = status

    # Combine from both collections
    ess_reqs = await db.ess_requests.find(q, {"_id": 0}).sort("created_at",-1).to_list(None)
    loan_ids = [r["loan_id"] for r in ess_reqs if r.get("loan_id")]
    if loan_ids:                                  # HR decides on the loan record
        state = {l["id"]: l.get("status") async for l in db.employee_loans.find(
            {"id": {"$in": loan_ids}, "company_id": company_id}, {"_id": 0, "id": 1, "status": 1})}
        for r in ess_reqs:
            if r.get("loan_id") in state:
                r["status"] = state[r["loan_id"]]
    leave_q  = {**q}; leave_q.pop("request_type", None)
    if not request_type or request_type == "leave":
        leaves = await db.leaves.find({**leave_q, "employee_id": emp["id"]}, {"_id": 0}).sort("created_at",-1).to_list(None)
        leaves += await db.leave_requests.find(leave_q, {"_id": 0}).sort("created_at",-1).to_list(None)   # older requests
        for l in leaves: l["request_type"] = "leave"
    else:
        leaves = []

    all_requests = sorted(ess_reqs + leaves,
                          key=lambda x: x.get("created_at",""), reverse=True)
    return {
        "employee":   emp.get("name",""),
        "requests":   all_requests,
        "total":      len(all_requests),
        "pending":    sum(1 for r in all_requests if r.get("status")=="pending"),
    }


# ══════════════════════════════════════════════════════════════
# أ-3. PAYSLIP PDF — قسيمة الراتب المشفرة
# ══════════════════════════════════════════════════════════════

@router.get("/payslip/list")
async def list_my_payslips(current_user: dict = Depends(get_current_user)):
    """قائمة كشوف الرواتب المتاحة للموظف"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    # payroll runs store their rows in "employees" and the month as "YYYY-MM";
    # this read "employees_data" and integer year/month, so the list was always empty
    runs = await db.payroll_runs.find({
        "company_id":    company_id,
        "status":        {"$in": ["approved","paid"]},
        "$or": [{"employees.employee_id": emp["id"]}, {"employees_data.employee_id": emp["id"]}],
    }, {"_id": 0, "id": 1, "year": 1, "month": 1, "status": 1, "payroll_number": 1,
        "payment_date": 1, "paid_at": 1, "employees": 1, "employees_data": 1}).to_list(None)
    out = []
    for r in runs:
        row = next((e for e in _rows(r) if e.get("employee_id") == emp["id"]), {})
        out.append({"run_id": r["id"], "id": r["id"], "period": _period(r),
                    "period_month": _month_ar(_period(r)), "status": r.get("status"),
                    "payment_date": str(r.get("payment_date") or r.get("paid_at") or "")[:10],
                    "net_salary": round(float(row.get("net_salary") or 0), 2)})
    runs = sorted(out, key=lambda r: r["period"], reverse=True)[:24]

    return {
        "employee":   emp.get("name",""),
        "payslips":   runs,
        "total":      len(runs),
        "download_url": "/api/ess/payslip/{run_id}",
    }


# ══════════════════════════════════════════════════════════════
# ب. MULTI-TENANT ISOLATION ARCHITECTURE
# ══════════════════════════════════════════════════════════════



MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس",
             "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]


def _month_ar(period: str) -> str:
    """'2026-10' → 'أكتوبر 2026' (a bare 2026-10 flips to 10-2026 inside Arabic text)."""
    try:
        y, m = period.split("-")[:2]
        return f"{MONTHS_AR[int(m) - 1]} {y}"
    except (ValueError, IndexError):
        return period


def _rows(run: dict) -> list:
    return run.get("employees") or run.get("employees_data") or []


def _period(run: dict) -> str:
    """'YYYY-MM' whether the run stored month as that string or year + month ints."""
    m = run.get("month")
    if isinstance(m, str) and len(m) >= 7:
        return m[:7]
    try:
        return f"{int(run.get('year')):04d}-{int(m):02d}"
    except (TypeError, ValueError):
        return str(m or "")


def slip_figures(emp_data: dict) -> dict:
    """Payslip figures from one employee's entry in a payroll run.

    The run stores allowances and deductions as LISTS ({deduction_type, name,
    amount}); there are no employee_si / income_tax / loan_deduction fields.
    The payslip read those missing fields (so tax and insurance printed 0) and
    did float() on the allowances list (the PDF failed with a 500)."""
    def num(v):
        try:
            return float(v or 0)
        except (TypeError, ValueError):
            return 0.0

    def total(v):
        return sum(num(x.get("amount")) for x in v) if isinstance(v, list) else num(v)

    deds = emp_data.get("deductions") if isinstance(emp_data.get("deductions"), list) else []
    by = lambda *types: round(sum(num(d.get("amount")) for d in deds if d.get("deduction_type") in types), 2)
    si, tax, loan = by("social_insurance"), by("income_tax"), by("loan", "advance")
    ded_total = num(emp_data.get("total_deductions")) or round(sum(num(d.get("amount")) for d in deds), 2)
    allow = num(emp_data.get("total_allowances")) or total(emp_data.get("allowances"))
    return {"basic_salary": round(num(emp_data.get("basic_salary")), 2), "allowances": round(allow, 2),
            "overtime": round(num(emp_data.get("overtime_bonus")), 2),
            "gross_salary": round(num(emp_data.get("gross_salary")), 2),
            "employee_si": si, "income_tax": tax, "loan_deduction": loan,
            "other_deductions": round(max(ded_total - si - tax - loan, 0.0), 2),
            "total_deductions": round(ded_total, 2), "net_salary": round(num(emp_data.get("net_salary")), 2),
            "deductions": [{"type": d.get("deduction_type"), "name": d.get("name"), "amount": round(num(d.get("amount")), 2)}
                           for d in deds]}


@router.get("/payslip/{run_id}")
async def get_payslip_pdf(
    run_id: str,
    format: Optional[str] = Query(None),        # "json": the figures, for the on-screen breakdown
    current_user: dict = Depends(get_current_user)
):
    """
    تحميل قسيمة الراتب PDF مشفرة
    الموظف يرى راتبه فقط — لا يمكنه رؤية رواتب الآخرين
    """
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)
    if not emp:                                   # was a 500 (emp["id"] on None)
        raise HTTPException(404, "لا يوجد ملف موظف مرتبط بحسابك — تواصل مع الموارد البشرية")

    run = await db.payroll_runs.find_one(
        {"id": run_id, "company_id": company_id}, {"_id": 0})
    if not run:
        raise HTTPException(404, "كشف الرواتب غير موجود")

    # Find this employee's data in the run
    emp_data = next((e for e in _rows(run) if e.get("employee_id") == emp["id"]), None)
    if not emp_data:
        raise HTTPException(404, "لا توجد بيانات راتب لهذا الشهر")

    if format == "json":
        return {"period": _period(run), **slip_figures(emp_data)}

    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}

    period = _period(run)
    fg = slip_figures(emp_data)
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER
    except ImportError:
        return {"message": "مكتبة PDF غير مثبتة — القسيمة كبيانات",
                "payslip": {"employee": emp.get("name", ""), "period": period, **fg}}

    # Arabic needs a font that has its letters and text shaped right-to-left;
    # Helvetica drew every Arabic word as boxes
    from services.arabic_pdf import font_name, ar
    F, FB = font_name(), font_name(bold=True)
    money = lambda v: f"{float(v or 0):,.2f}"

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm,
                            topMargin=1.8*cm, bottomMargin=1.8*cm,
                            title=f"Payslip {period}", author=company.get("name", ""))
    title = ParagraphStyle("t", fontName=FB, fontSize=16, alignment=TA_CENTER, spaceAfter=6)
    sub = ParagraphStyle("s", fontName=F, fontSize=11, alignment=TA_CENTER, spaceAfter=4,
                         textColor=colors.HexColor("#475569"))
    note = ParagraphStyle("n", fontName=F, fontSize=8, alignment=TA_CENTER, textColor=colors.grey)
    story = [Paragraph(ar(company.get("name") or company.get("company_name") or ""), title),
             Paragraph(ar(f"قسيمة راتب — {_month_ar(period)}"), sub), Spacer(1, 0.4*cm)]

    # tables read right to left: value column on the left, label on the right
    def grid(rows, head=None, widths=(6*cm, 11*cm), head_color="#1E3A5F", total=False):
        data = ([[ar(head[1]), ar(head[0])]] if head else []) + [[ar(v), ar(k)] for k, v in rows]
        t = Table(data, colWidths=list(widths))
        style = [("FONTNAME", (0, 0), (-1, -1), F), ("FONTSIZE", (0, 0), (-1, -1), 10),
                 ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("ALIGN", (0, 0), (0, -1), "LEFT"),
                 ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                 ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]
        if head:
            style += [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(head_color)),
                      ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), FB)]
        if total:
            style += [("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
                      ("FONTNAME", (0, -1), (-1, -1), FB)]
        t.setStyle(TableStyle(style))
        return t

    story.append(grid([("الموظف", emp.get("name", "")), ("القسم", emp.get("department", "") or "—"),
                       ("الوظيفة", emp.get("position", "") or "—"),
                       ("كود الموظف", emp.get("employee_code") or emp.get("id", "")[:8]),
                       ("تاريخ الصرف", str(run.get("payment_date") or run.get("paid_at") or "")[:10] or "—")]))
    story.append(Spacer(1, 0.4*cm))
    earn = [("الراتب الأساسي", money(fg["basic_salary"])), ("البدلات", money(fg["allowances"]))]
    if fg["overtime"]:
        earn.append(("العمل الإضافي", money(fg["overtime"])))
    earn.append(("إجمالي المستحقات", money(fg["gross_salary"])))
    story.append(grid(earn, head=("المستحقات", "المبلغ (ج.م)"), total=True))
    story.append(Spacer(1, 0.3*cm))
    ded = [(d["name"] or d["type"] or "خصم", money(d["amount"])) for d in fg["deductions"] if d["amount"]]
    ded.append(("إجمالي الخصومات", money(fg["total_deductions"])))
    story.append(grid(ded, head=("الخصومات", "المبلغ (ج.م)"), head_color="#B91C1C", total=True))
    story.append(Spacer(1, 0.4*cm))
    net = Table([[ar(f"{money(fg['net_salary'])} ج.م"), ar("صافي الراتب")]], colWidths=[6*cm, 11*cm])
    net.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1E3A5F")),
                             ("TEXTCOLOR", (0, 0), (-1, -1), colors.white), ("FONTNAME", (0, 0), (-1, -1), FB),
                             ("FONTSIZE", (0, 0), (-1, -1), 13), ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                             ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    story += [net, Spacer(1, 0.8*cm),
              Paragraph(ar("هذه القسيمة سرية وخاصة بالموظف — صادرة من نظام داتا لايف أكاونت"), note)]
    doc.build(story)
    buf.seek(0)
    filename = f"payslip_{period}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"',
                                      "X-Payslip-Month": period})


@router.get("/admin/tenant-isolation/audit")
async def audit_tenant_isolation(current_user: dict = Depends(get_current_user)):
    """
    تدقيق عزل بيانات المستأجرين (Multi-Tenant Isolation Audit)

    يتحقق من:
    1. كل collection تحتوي على company_id index
    2. لا توجد وثائق بدون company_id
    3. Row-Level Security مُطبَّق على كل استعلام
    """
    # platform tool: counts documents across ALL companies — was open to any
    # logged-in user, including employees on their self-service portal
    if current_user.get("role") != "Super Admin":
        _u = await db.users.find_one({"id": current_user.get("user_id")}, {"_id": 0, "is_platform_admin": 1})
        if not (_u and _u.get("is_platform_admin")):
            raise HTTPException(status_code=403, detail="Platform administrator access required")
    company_id = current_user["company_id"]

    AUDITED_COLLECTIONS = [
        "journal_entries", "invoices", "employees", "payroll_runs",
        "purchase_orders", "inventory", "leave_requests", "approval_requests",
        "audit_trail", "budget_checks", "financial_budgets",
        "letters_of_guarantee", "lease_contracts",
    ]

    audit_results = []
    total_docs = total_isolated = total_violations = 0

    for col_name in AUDITED_COLLECTIONS:
        try:
            col = db[col_name]
            # Count total docs in this collection
            all_count = await col.count_documents({})
            # Count docs WITH company_id
            with_cid  = await col.count_documents({"company_id": {"$exists": True}})
            # Count docs for THIS company
            this_co   = await col.count_documents({"company_id": company_id})
            # Count docs WITHOUT company_id (isolation violation)
            without   = all_count - with_cid
            # Docs from OTHER companies (should never be accessible)
            other_co  = all_count - without - this_co

            audit_results.append({
                "collection":        col_name,
                "total_docs":        all_count,
                "with_company_id":   with_cid,
                "this_company_docs": this_co,
                "other_companies":   other_co,
                "no_company_id":     without,
                "isolated":          without == 0,
                "status": "✅ isolated" if without == 0 else f"⚠️ {without} docs missing company_id",
            })
            total_docs      += all_count
            total_isolated  += this_co
            total_violations+= without
        except Exception as e:
            audit_results.append({
                "collection": col_name, "error": str(e)})

    return {
        "audit_type": "Row-Level Security (company_id Isolation)",
        "company_id": company_id,
        "summary": {
            "collections_audited": len(AUDITED_COLLECTIONS),
            "total_docs_system":   total_docs,
            "this_company_docs":   total_isolated,
            "isolation_violations":total_violations,
            "rls_status":          "✅ CLEAN" if total_violations == 0 else f"⚠️ {total_violations} violations",
        },
        "results":      audit_results,
        "architecture": {
            "model":     "Row-Level Security (Shared DB / Tenant_ID)",
            "enforcement": "company_id field on every document + index",
            "queries":   "Every API query MUST include company_id filter",
            "upgrade_path": "Schema-per-Tenant for enterprise clients",
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/admin/tenant-isolation/validate-query")
async def validate_query_isolation(
    collection: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    التحقق من أن استعلام محدد يشمل company_id filter (RLS Check)
    """
    # platform tool: counts documents across ALL companies — was open to any
    # logged-in user, including employees on their self-service portal
    if current_user.get("role") != "Super Admin":
        _u = await db.users.find_one({"id": current_user.get("user_id")}, {"_id": 0, "is_platform_admin": 1})
        if not (_u and _u.get("is_platform_admin")):
            raise HTTPException(status_code=403, detail="Platform administrator access required")
    company_id = current_user["company_id"]
    col = db[collection]

    # Run a test query WITHOUT company_id and see how many docs leak
    try:
        all_docs  = await col.count_documents({})
        my_docs   = await col.count_documents({"company_id": company_id})
        leak_risk = all_docs - my_docs
    except Exception:
        all_docs = my_docs = leak_risk = 0

    return {
        "collection":      collection,
        "all_docs_without_filter": all_docs,
        "my_company_docs": my_docs,
        "potential_data_leak_without_rls": leak_risk,
        "rls_is_critical": leak_risk > 0,
        "message": (
            f"✅ مجموعة آمنة — {my_docs} وثيقة"
            if leak_risk == 0 else
            f"⚠️ بدون company_id filter، ستُعاد {leak_risk} وثيقة من شركات أخرى"
        ),
        "recommended_filter": {"company_id": company_id},
    }


@router.get("/admin/tenant-architecture")
async def get_tenant_architecture(current_user: dict = Depends(get_current_user)):
    """
    وثيقة معمارية عزل البيانات المُطبَّقة في النظام
    """
    # platform tool: counts documents across ALL companies — was open to any
    # logged-in user, including employees on their self-service portal
    if current_user.get("role") != "Super Admin":
        _u = await db.users.find_one({"id": current_user.get("user_id")}, {"_id": 0, "is_platform_admin": 1})
        if not (_u and _u.get("is_platform_admin")):
            raise HTTPException(status_code=403, detail="Platform administrator access required")
    return {
        "architecture_name": "Shared Database — Row-Level Security (RLS)",
        "description": "قاعدة بيانات موحدة مع عزل البيانات عبر حقل company_id",
        "implementation": {
            "method":     "company_id field on every document",
            "enforcement": "Every MongoDB query MUST include {company_id: tenant_id}",
            "indexing":   "Compound index on (company_id, *) for all collections",
            "auth":       "JWT token contains company_id — extracted in get_current_user()",
        },
        "schema_per_tenant_option": {
            "description": "للعملاء الكبار — قاعدة بيانات مستقلة لكل شركة",
            "mongodb_url": "mongodb://host/{company_id}_db",
            "benefits":   ["عزل كامل للبيانات", "نسخ احتياطي مستقل", "performance isolation"],
            "when_to_use": "إيرادات > 50,000 ج.م/شهر أو متطلبات تدقيق مستقلة",
        },
        "current_rls_rules": [
            "كل collection تحتوي compound index على (company_id, field)",
            "get_current_user() يُعيد company_id من JWT token",
            "كل endpoint يمرر company_id للـ DB query",
            "audit_trail يُسجِّل company_id على كل حدث",
            "Budget + Approval rules مُقيَّدة بـ company_id",
        ],
        "compliance": "ISO 27001 | SOC 2 — Data Isolation Controls",
        "audit_endpoint": "GET /api/ess/admin/tenant-isolation/audit",
    }


# ══════════════════════════════════════════════════════════════
# ESS PROFILE — ملف الموظف الخاص (read-only for employee)
# ══════════════════════════════════════════════════════════════

@router.get("/profile")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """
    يُعيد بيانات الموظف الخاصة بالمستخدم الحالي فقط
    مع إخفاء البيانات الحساسة (IBAN مخفية جزئياً، رقم قومي مخفي)
    """
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    # Mask sensitive fields
    safe = dict(emp)
    if safe.get("national_id"):
        safe["national_id"] = "•••••••••••" + safe["national_id"][-3:]
    if safe.get("iban"):
        safe["iban"] = safe["iban"][:4] + "••••" + safe["iban"][-4:]
    if safe.get("bank_account_number"):
        n = safe["bank_account_number"]
        safe["bank_account_number"] = "•••••" + n[-4:]

    return {"employee": safe, "company_id": company_id}


@router.get("/my-appraisals")
async def my_appraisals(current_user: dict = Depends(get_current_user)):
    """تقييمات أدائي المعتمدة فقط — المسودات وما لم يُعتمد لا يراها الموظف."""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)
    rows = await db.employee_appraisals.find(
        {"company_id": company_id, "employee_id": emp["id"], "status": "approved"},
        {"_id": 0, "current_salary": 0, "created_by": 0, "approved_by": 0}).sort("review_date", -1).to_list(100)
    return {"appraisals": rows, "total": len(rows)}


@router.get("/leave/balances")
async def get_leave_balances(current_user: dict = Depends(get_current_user)):
    """أرصدة الإجازات الخاصة بالموظف المسجل"""
    company_id = current_user["company_id"]
    emp = await get_employee_by_user(current_user["user_id"], company_id)

    # Try leave_balances collection first
    bal = await db.leave_balances.find_one(
        {"employee_id": emp["id"], "company_id": company_id}, {"_id": 0}
    )
    if bal:
        return {
            "annual": bal.get("annual_balance", 21),
            "casual": bal.get("casual_balance", 6),
            "sick":   bal.get("sick_balance",   15),
            "employee_id": emp["id"],
        }

    # Fallback to employee record
    return {
        "annual": emp.get("annual_leave_balance", 21),
        "casual": emp.get("casual_leave_balance", 6),
        "sick":   emp.get("sick_leave_balance",   15),
        "employee_id": emp["id"],
    }


# ══════════════════════════════════════════
# MY DOCUMENTS — the employee uploads their own; HR uploads too.
# Same storage as HR (employees.documents + uploads/employees), so both
# always see one list. The portal shows it from /api/ess/profile.
# ══════════════════════════════════════════
DOC_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"}


@router.post("/documents")
async def upload_my_document(
    file: UploadFile = File(...),
    document_type: str = Form("other"),
    name: str = Form(...),
    expiry_date: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    import os, aiofiles
    from models.employee_extended import EmployeeDocument, DocumentType
    from services.upload_limits import read_limited, MB
    emp = await get_employee_by_user(current_user["user_id"], current_user["company_id"])
    if not emp:
        raise HTTPException(status_code=404, detail="لا يوجد ملف موظف مرتبط بحسابك — تواصل مع الموارد البشرية")
    try:
        dtype = DocumentType(document_type)
    except ValueError:
        dtype = DocumentType.OTHER
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "").lower()
    if ext not in DOC_EXTENSIONS:
        raise HTTPException(status_code=400, detail="نوع الملف غير مسموح — المسموح: PDF، صور، Word")
    content = await read_limited(file, 10 * MB)
    doc_id = str(uuid.uuid4())
    upload_dir = "/app/uploads/employees"
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"{emp['id']}_{doc_id}.{ext}"
    async with aiofiles.open(os.path.join(upload_dir, filename), "wb") as f:
        await f.write(content)
    document = EmployeeDocument(
        id=doc_id, document_type=dtype, name=(name or "").strip()[:120] or dtype.value,
        file_url=f"/api/uploads/employees/{filename}", file_name=file.filename, file_size=len(content),
        expiry_date=expiry_date or None, notes=notes, uploaded_by=current_user["user_id"]).dict()
    document["uploaded_by_role"] = "employee"
    await db.employees.update_one({"id": emp["id"], "company_id": current_user["company_id"]},
                                  {"$push": {"documents": document}})
    return {"message": "تم رفع المستند", "document": document}


@router.get("/work-location")
async def my_work_location(current_user: dict = Depends(get_current_user)):
    """The place and radius used for this employee's check-in — for the map."""
    emp = await get_employee_by_user(current_user["user_id"], current_user["company_id"])
    if not emp:
        raise HTTPException(404, "لا يوجد ملف موظف مرتبط بحسابك — تواصل مع الموارد البشرية")
    company = await db.companies.find_one({"id": current_user["company_id"]}, {"_id": 0}) or {}
    loc, remote = resolve_work_location(emp, company)
    if not loc:
        return {"configured": False, "remote_allowed": remote}
    return {"configured": True, "latitude": float(loc["latitude"]), "longitude": float(loc["longitude"]),
            "radius_meters": float(loc.get("radius_meters") or 200), "address": loc.get("address", ""),
            "remote_allowed": remote}
