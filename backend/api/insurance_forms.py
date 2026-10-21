"""
Social insurance forms — استمارات التأمينات الاجتماعية (قانون 148/2019)

  GET /api/insurance-forms/form1/{employee_id}       استمارة 1 — اشتراك / التحاق عامل
  GET /api/insurance-forms/form1/{employee_id}/pdf
  GET /api/insurance-forms/form6/{employee_id}       استمارة 6 — انتهاء خدمة / إيقاف اشتراك
  GET /api/insurance-forms/form6/{employee_id}/pdf
  GET /api/insurance-forms/form6-status/{employee_id} form6_ready + what is missing

These return the DATA the official NOSI forms ask for, and a printable Arabic
data sheet. They are not the official forms: those are the authority's own
printed / digital forms (and its online portal), which this system cannot
issue. The PDF says so in its footer.

The insurance wage (أجر الاشتراك) is the same one the payroll run uses
(api/payroll.py _compute_employee_payroll): the employee's insurance profile
`insured_basic_salary`, else `insured_salary`, else the basic salary — held
between the year's minimum and maximum (services/egypt_payroll). Form 6 takes
the last wage from the latest payroll run that contains the employee when
there is one.

Termination data for form 6 comes from, in order: the query parameters, the
end-of-service settlement (/api/payroll/end-of-service), the clearance
(/api/hr-advanced/offboarding — it marks the employee terminated).
"""
import io
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from database import db
from dependencies import get_current_user
from services.egypt_payroll import social_insurance

router = APIRouter(prefix="/api/insurance-forms", tags=["Social Insurance Forms"])

DISCLAIMER = ("هذه ورقة بيانات مستخرجة من نظام داتا لايف لنقلها إلى الاستمارة الرسمية للهيئة القومية "
              "للتأمين الاجتماعي أو إرفاقها بها — وليست الاستمارة الرسمية ولا تُغني عنها. "
              "راجع البيانات وأكواد الأسباب على الاستمارة الرسمية قبل التقديم.")

# internal codes — the official form 6 has its own code list for the reason
# the service ended; match the label to it when transcribing
TERMINATION_REASONS = {
    "resignation": "استقالة",
    "dismissal":   "إنهاء الخدمة من صاحب العمل",
    "contract_end": "انتهاء مدة العقد",
    "retirement":  "بلوغ سن الشيخوخة / التقاعد",
    "death":       "وفاة",
    "disability":  "عجز كلي",
    "other":       "سبب آخر",
}


def _num(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _first(*vals):
    for v in vals:
        if v not in (None, ""):
            return v
    return ""


async def _employee(company_id: str, employee_id: str) -> dict:
    emp = await db.employees.find_one({"id": employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    return emp


async def employer_data(company_id: str) -> dict:
    c = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    return {
        "company_name":     _first(c.get("name"), c.get("company_name")),
        "company_name_en":  c.get("name_en", ""),
        "insurance_number": _first(c.get("insurance_registration_number"), c.get("social_insurance_number"),
                                   c.get("insurance_number")),
        "tax_number":       _first(c.get("tax_number"), c.get("tax_id")),
        "commercial_register": c.get("commercial_register", ""),
        "address":          _first(c.get("address"), c.get("address_ar")),
        "activity":         c.get("activity", ""),
        "insurance_office": c.get("insurance_office", ""),
    }


async def insurance_wage(company_id: str, emp: dict, profile: dict = None) -> dict:
    """أجر الاشتراك — the payroll's own rule, then the legal limits."""
    if profile is None:
        profile = await db.employee_insurance_profiles.find_one(
            {"employee_id": emp["id"], "company_id": company_id}, {"_id": 0}) or {}
    declared = _num(profile.get("insured_basic_salary") or profile.get("insured_salary")
                    or emp.get("basic_salary"))
    settings = await db.payroll_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    si = social_insurance(declared, settings)
    return {
        "declared_wage": round(declared, 2),
        "insurable_wage": si["insurable_wage"],
        "employee_share": si["employee"], "employer_share": si["employer"],
        "limits": {"min": si["min"], "max": si["max"]},
        "source": ("ملف التأمين للموظف" if (profile.get("insured_basic_salary") or profile.get("insured_salary"))
                   else "الراتب الأساسي (لا يوجد ملف تأمين)"),
        "variable_wage_in_profile": _num(profile.get("insured_variable_salary")),
    }


async def last_payroll_wage(company_id: str, employee_id: str) -> Optional[dict]:
    """The insured wage on the latest non-cancelled payroll run with this employee."""
    cur = db.payroll_runs.find(
        {"company_id": company_id, "status": {"$ne": "cancelled"}, "employees.employee_id": employee_id},
        {"_id": 0, "month": 1, "payroll_number": 1, "status": 1, "employees": 1}).sort("month", -1).limit(1)
    async for run in cur:
        row = next((e for e in run.get("employees") or [] if e.get("employee_id") == employee_id), None)
        if row:
            return {"month": run.get("month"), "payroll_number": run.get("payroll_number"),
                    "status": run.get("status"), "insured_salary": round(_num(row.get("insured_salary")), 2),
                    "employee_share": round(_num(row.get("employee_social_insurance") or row.get("social_insurance")), 2),
                    "employer_share": round(_num(row.get("company_social_insurance")), 2)}
    return None


def _missing(pairs) -> list:
    return [label for label, v in pairs if v in (None, "", 0, 0.0)]


# ══════════════════════════════════════════════════════════════
# FORM 1 — استمارة 1
# ══════════════════════════════════════════════════════════════

async def build_form1(company_id: str, employee_id: str) -> dict:
    emp = await _employee(company_id, employee_id)
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": company_id}, {"_id": 0}) or {}
    employer = await employer_data(company_id)
    wage = await insurance_wage(company_id, emp, profile)
    employee = {
        "name":             emp.get("name", ""),
        "name_en":          emp.get("name_en", ""),
        "national_id":      _first(emp.get("national_id"), profile.get("national_id")),
        "insurance_number": _first(profile.get("insurance_number"), emp.get("social_insurance_number")),
        "date_of_birth":    _first(emp.get("date_of_birth"), emp.get("birth_date")),
        "gender":           emp.get("gender", ""),
        "nationality":      emp.get("nationality") or "مصري",
        "marital_status":   emp.get("marital_status", ""),
        "address":          emp.get("address", ""),
        "hire_date":        emp.get("hire_date", ""),
        "insurance_start_date": _first(profile.get("insurance_start_date"), emp.get("hire_date")),
        "job_title":        _first(emp.get("position"), emp.get("job_title")),
        "department":       emp.get("department", ""),
        "employee_code":    emp.get("employee_code", ""),
    }
    missing = _missing([("الرقم التأميني للمنشأة", employer["insurance_number"]),
                        ("اسم المنشأة", employer["company_name"]), ("عنوان المنشأة", employer["address"]),
                        ("الرقم القومي", employee["national_id"]), ("تاريخ الميلاد", employee["date_of_birth"]),
                        ("تاريخ التعيين", employee["hire_date"]), ("الوظيفة", employee["job_title"]),
                        ("أجر الاشتراك", wage["insurable_wage"])])
    return {
        "form": "form1",
        "form_name": "استمارة رقم (1) — طلب اشتراك / التحاق عامل",
        "law_reference": "قانون التأمينات الاجتماعية والمعاشات 148 لسنة 2019",
        "employer_data": employer,
        "employee_data": employee,
        "insurance_wage": wage,
        "missing_fields": missing,
        "complete": not missing,
        "disclaimer": DISCLAIMER,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# FORM 6 — استمارة 6
# ══════════════════════════════════════════════════════════════

async def _settlement(company_id: str, employee_id: str) -> Optional[dict]:
    rows = await db.end_of_service.find(
        {"company_id": company_id, "employee_id": employee_id, "status": {"$in": ["approved", "pending", "paid"]}},
        {"_id": 0}).to_list(20)
    if not rows:
        return None
    # an approved one wins over a pending one
    rows.sort(key=lambda r: (r.get("status") in ("approved", "paid"), str(r.get("created_at") or "")), reverse=True)
    return rows[0]


async def build_form6(company_id: str, employee_id: str, termination_date: str = None,
                      termination_reason: str = None) -> dict:
    from api import hr_engine as H        # leave balance, gratuity formula, wage
    emp = await _employee(company_id, employee_id)
    profile = await db.employee_insurance_profiles.find_one(
        {"employee_id": employee_id, "company_id": company_id}, {"_id": 0}) or {}
    employer = await employer_data(company_id)
    st = await _settlement(company_id, employee_id)

    term_date = _first(termination_date, (st or {}).get("end_date"), emp.get("termination_date"))
    if term_date:
        try:
            term_date = date.fromisoformat(str(term_date)[:10]).isoformat()
        except ValueError:
            raise HTTPException(400, "تاريخ إنهاء الخدمة غير صحيح — استخدم الصيغة YYYY-MM-DD")
    reason = _first(termination_reason, (st or {}).get("termination_reason"), emp.get("termination_reason"))
    if reason and reason not in TERMINATION_REASONS:
        reason_label = str(reason)
    else:
        reason_label = TERMINATION_REASONS.get(reason, "")

    wage_now = await insurance_wage(company_id, emp, profile)
    last_run = await last_payroll_wage(company_id, employee_id)
    last_wage = last_run["insured_salary"] if last_run and last_run["insured_salary"] else wage_now["insurable_wage"]

    # entitlements: the settlement's own figures when there is one
    policy = await H.get_policy(company_id)
    monthly = H.monthly_wage(emp)
    service_yrs = H.calc_service_years(emp.get("hire_date", ""), term_date or None)
    if st:
        eos_amount = round(_num(st.get("end_of_service_amount")), 2)
        eos_source = f"تسوية نهاية الخدمة {st.get('settlement_number', '')} ({st.get('status')})"
    else:
        eos_amount = H.gratuity_amount(policy, monthly, service_yrs, reason or "resignation")["total"]
        eos_source = "محسوبة من سياسة الشركة — لا توجد تسوية نهاية خدمة مسجلة"
    if st and (_num(st.get("vacation_compensation")) or _num(st.get("remaining_vacation_days"))):
        leave_days = _num(st.get("remaining_vacation_days"))
        leave_amount = round(_num(st.get("vacation_compensation")), 2)
        leave_source = "من تسوية نهاية الخدمة"
    else:
        bal = await H.get_leave_balance(employee_id, {"company_id": company_id})
        leave_days = max(_num(bal["annual_leave"]["balance"]), 0)
        leave_amount = round(leave_days * monthly / 30, 2)
        leave_source = "محسوب من رصيد الإجازات الحالي × (الأجر الشامل ÷ 30)"

    terminated = (emp.get("status") == "terminated" or emp.get("is_active") is False
                  or bool(st and st.get("status") in ("approved", "paid")))
    employee = {
        "name":             emp.get("name", ""),
        "national_id":      _first(emp.get("national_id"), profile.get("national_id")),
        "insurance_number": _first(profile.get("insurance_number"), emp.get("social_insurance_number")),
        "date_of_birth":    _first(emp.get("date_of_birth"), emp.get("birth_date")),
        "hire_date":        emp.get("hire_date", ""),
        "job_title":        _first(emp.get("position"), emp.get("job_title")),
        "termination_date": term_date,
        "termination_reason_code": reason or "",
        "termination_reason": reason_label,
        "service_years":    round(service_yrs, 2),
        "last_insurance_wage": round(last_wage, 2),
    }
    missing = _missing([("الرقم التأميني للمنشأة", employer["insurance_number"]),
                        ("الرقم القومي", employee["national_id"]),
                        ("الرقم التأميني للعامل", employee["insurance_number"]),
                        ("تاريخ انتهاء الخدمة", term_date), ("سبب انتهاء الخدمة", reason),
                        ("آخر أجر اشتراك", last_wage)])
    ready = terminated and not missing
    return {
        "form": "form6",
        "form_name": "استمارة رقم (6) — إخطار انتهاء خدمة عامل",
        "law_reference": "قانون التأمينات الاجتماعية والمعاشات 148 لسنة 2019",
        "employer_data": employer,
        "employee_data": employee,
        "insurance_wage": {**wage_now, "last_payroll_run": last_run,
                           "last_wage_source": "آخر مسير رواتب" if last_run and last_run["insured_salary"]
                           else "أجر الاشتراك الحالي (لا يوجد مسير رواتب للموظف)"},
        "settlement": {
            "settlement_id": (st or {}).get("id"), "settlement_number": (st or {}).get("settlement_number"),
            "status": (st or {}).get("status"),
            "end_of_service_amount": eos_amount, "end_of_service_source": eos_source,
            "leave_balance_days": leave_days, "leave_encashment": leave_amount, "leave_source": leave_source,
            "net_settlement": round(_num((st or {}).get("net_settlement")), 2) if st else None,
            "clearance_journal_entry_id": emp.get("clearance_je_id"),
        },
        "employee_terminated": terminated,
        "missing_fields": missing,
        "form6_ready": ready,
        "disclaimer": DISCLAIMER,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/form1/{employee_id}")
async def form1(employee_id: str, current_user: dict = Depends(get_current_user)):
    return await build_form1(current_user["company_id"], employee_id)


@router.get("/form6/{employee_id}")
async def form6(employee_id: str, termination_date: Optional[str] = Query(None),
                termination_reason: Optional[str] = Query(None),
                current_user: dict = Depends(get_current_user)):
    return await build_form6(current_user["company_id"], employee_id, termination_date, termination_reason)


@router.get("/form6-status/{employee_id}")
async def form6_status(employee_id: str, current_user: dict = Depends(get_current_user)):
    """For the end-of-service / clearance screens: is form 6 ready to prepare?"""
    f = await build_form6(current_user["company_id"], employee_id)
    return {"employee_id": employee_id, "form6_ready": f["form6_ready"],
            "employee_terminated": f["employee_terminated"], "missing_fields": f["missing_fields"],
            "form6_url": f"/api/insurance-forms/form6/{employee_id}",
            "form6_pdf_url": f"/api/insurance-forms/form6/{employee_id}/pdf"}


@router.get("/reasons")
async def reasons(current_user: dict = Depends(get_current_user)):
    return {"reasons": [{"code": k, "label": v} for k, v in TERMINATION_REASONS.items()],
            "note": "أكواد داخلية — طابقها مع كود السبب على الاستمارة الرسمية"}


# ══════════════════════════════════════════════════════════════
# PDF — ورقة بيانات عربية للطباعة
# ══════════════════════════════════════════════════════════════

def _money(v) -> str:
    return f"{_num(v):,.2f}"


def render_pdf(form: dict) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib.enums import TA_CENTER
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    except ImportError:
        raise HTTPException(503, "مكتبة PDF غير مثبتة على الخادم — استخدم المعاينة")
    from services.arabic_pdf import font_name, ar, ar_para
    F, FB = font_name(), font_name(bold=True)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=1.8*cm, leftMargin=1.8*cm,
                            topMargin=1.6*cm, bottomMargin=1.6*cm, title=form["form_name"])
    title = ParagraphStyle("t", fontName=FB, fontSize=15, alignment=TA_CENTER, spaceAfter=4)
    sub = ParagraphStyle("s", fontName=F, fontSize=10, alignment=TA_CENTER, spaceAfter=4,
                         textColor=colors.HexColor("#475569"))
    note = ParagraphStyle("n", fontName=F, fontSize=8.5, alignment=TA_CENTER, leading=13,
                          textColor=colors.HexColor("#92400E"))

    def grid(head, rows):
        # right-to-left: value on the left, label on the right
        data = [[ar(""), ar(head)]] + [[ar(str(v if v not in (None, "") else "—")), ar(k)] for k, v in rows]
        t = Table(data, colWidths=[9.4*cm, 8*cm])
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), F), ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("FONTNAME", (0, 0), (-1, 0), FB), ("SPAN", (0, 0), (-1, 0)),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E3A5F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("ALIGN", (0, 0), (-1, 0), "RIGHT"),
            ("ALIGN", (1, 1), (1, -1), "RIGHT"), ("ALIGN", (0, 1), (0, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        return t

    er, ee, w = form["employer_data"], form["employee_data"], form["insurance_wage"]
    story = [Paragraph(ar_para(form["form_name"]), title),
             Paragraph(ar_para(f"ورقة بيانات — {form['law_reference']}"), sub), Spacer(1, 0.3*cm),
             grid("بيانات صاحب العمل", [("اسم المنشأة", er["company_name"]),
                                        ("الرقم التأميني للمنشأة", er["insurance_number"]),
                                        ("العنوان", er["address"]), ("الرقم الضريبي", er["tax_number"]),
                                        ("السجل التجاري", er["commercial_register"])]),
             Spacer(1, 0.3*cm)]
    if form["form"] == "form1":
        story += [grid("بيانات العامل", [("الاسم", ee["name"]), ("الرقم القومي", ee["national_id"]),
                                         ("الرقم التأميني", ee["insurance_number"]),
                                         ("تاريخ الميلاد", ee["date_of_birth"]), ("النوع", ee["gender"]),
                                         ("الجنسية", ee["nationality"]), ("تاريخ التعيين", ee["hire_date"]),
                                         ("تاريخ بدء الاشتراك", ee["insurance_start_date"]),
                                         ("الوظيفة", ee["job_title"]), ("الإدارة", ee["department"])]),
                  Spacer(1, 0.3*cm),
                  grid("أجر الاشتراك", [("الأجر المعلن", _money(w["declared_wage"])),
                                        ("أجر الاشتراك (بعد الحدين الأدنى والأقصى)", _money(w["insurable_wage"])),
                                        ("حصة العامل الشهرية", _money(w["employee_share"])),
                                        ("حصة صاحب العمل الشهرية", _money(w["employer_share"])),
                                        ("المصدر", w["source"])])]
    else:
        s = form["settlement"]
        story += [grid("بيانات العامل وانتهاء الخدمة", [
                      ("الاسم", ee["name"]), ("الرقم القومي", ee["national_id"]),
                      ("الرقم التأميني", ee["insurance_number"]), ("تاريخ التعيين", ee["hire_date"]),
                      ("تاريخ انتهاء الخدمة", ee["termination_date"]),
                      ("سبب انتهاء الخدمة", ee["termination_reason"]),
                      ("مدة الخدمة (سنة)", ee["service_years"]),
                      ("آخر أجر اشتراك", _money(ee["last_insurance_wage"])),
                      ("مصدر آخر أجر", w["last_wage_source"])]),
                  Spacer(1, 0.3*cm),
                  grid("المستحقات عند انتهاء الخدمة", [
                      ("مكافأة نهاية الخدمة", _money(s["end_of_service_amount"])),
                      ("مصدرها", s["end_of_service_source"]),
                      ("رصيد الإجازات (يوم)", f"{_num(s['leave_balance_days']):g}"),
                      ("مقابل رصيد الإجازات", _money(s["leave_encashment"])),
                      ("صافي التسوية", _money(s["net_settlement"]) if s["net_settlement"] is not None else "—")])]
    if form["missing_fields"]:
        story += [Spacer(1, 0.3*cm),
                  Paragraph(ar_para("بيانات ناقصة: " + "، ".join(form["missing_fields"])), note)]
    story += [Spacer(1, 0.6*cm), Paragraph(ar_para(DISCLAIMER), note),
              Paragraph(ar_para(f"تاريخ الاستخراج: {form['generated_at'][:10]}"), sub)]
    doc.build(story)
    return buf.getvalue()


def _pdf_response(form: dict, name: str) -> StreamingResponse:
    return StreamingResponse(io.BytesIO(render_pdf(form)), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})


@router.get("/form1/{employee_id}/pdf")
async def form1_pdf(employee_id: str, current_user: dict = Depends(get_current_user)):
    f = await build_form1(current_user["company_id"], employee_id)
    return _pdf_response(f, f"insurance_form1_{employee_id[:8]}")


@router.get("/form6/{employee_id}/pdf")
async def form6_pdf(employee_id: str, termination_date: Optional[str] = Query(None),
                    termination_reason: Optional[str] = Query(None),
                    current_user: dict = Depends(get_current_user)):
    f = await build_form6(current_user["company_id"], employee_id, termination_date, termination_reason)
    return _pdf_response(f, f"insurance_form6_{employee_id[:8]}")
