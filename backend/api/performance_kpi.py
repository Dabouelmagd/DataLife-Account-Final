"""
Performance & KPI Engine — محرك تقييم الأداء ومؤشرات الأداء الرئيسية
دورة الموارد البشرية الكاملة: التقييم → الترقية → تعديل الراتب

يغطي:
1. معايير KPI وقوالب التقييم
2. إنشاء وتقييم دورات الأداء (سنوية / ربع سنوية)
3. توصيات المدير (ترقية / زيادة / PIP)
4. ترحيل الزيادة تلقائياً لكشف الرواتب
5. خطط التطوير (IDP — Individual Development Plan)
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/performance", tags=["Performance & KPIs"])

# ══════════════════════════════════════════════════════════════
# KPI RATING SCALE
# ══════════════════════════════════════════════════════════════
RATING_SCALE = {
    "exceptional":    {"min": 90, "label_ar": "استثنائي",       "label_en": "Exceptional"},
    "exceeds":        {"min": 80, "label_ar": "يتجاوز التوقعات", "label_en": "Exceeds Expectations"},
    "meets":          {"min": 70, "label_ar": "يحقق التوقعات",   "label_en": "Meets Expectations"},
    "needs_improvement":{"min":60,"label_ar": "يحتاج تحسين",     "label_en": "Needs Improvement"},
    "unsatisfactory": {"min":  0, "label_ar": "غير مقبول",       "label_en": "Unsatisfactory"},
}

RECOMMENDATIONS = {
    "promotion":         "ترقية",
    "salary_increment":  "زيادة راتب",
    "pip":               "خطة تحسين أداء (PIP)",
    "none":              "لا توصية",
}

def get_rating(score: float) -> dict:
    for key, r in RATING_SCALE.items():
        if score >= r["min"]:
            return {"key": key, **r}
    return {"key": "unsatisfactory", **RATING_SCALE["unsatisfactory"]}


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class KPITemplate(BaseModel):
    name:       str
    department: Optional[str] = None
    kpis: List[dict]
    # [{name, name_ar, weight, target, unit, description}]


class AppraisalRequest(BaseModel):
    employee_id:    str
    review_period:  str      # e.g. "2026-Q3" or "2026-Annual"
    period_type:    str = "quarterly"  # quarterly | annual | probation
    kpi_scores: List[dict]
    # [{kpi_name, score, weight, target, actual, notes}]
    manager_notes:  Optional[str] = None
    manager_recommendation: str = "none"
    # promotion | salary_increment | pip | none
    salary_increment_percentage: float = 0.0
    promotion_to_grade:  Optional[str] = None
    promotion_to_title:  Optional[str] = None
    review_date:    str
    notes:          Optional[str] = None


class IDPRequest(BaseModel):
    employee_id:     str
    appraisal_id:    Optional[str] = None
    goals: List[dict]
    # [{title, description, target_date, category, status}]
    training_courses: List[str] = []
    mentor_id:        Optional[str] = None
    start_date:       str
    end_date:         str


# ══════════════════════════════════════════════════════════════
# 1. KPI TEMPLATES — قوالب مؤشرات الأداء
# ══════════════════════════════════════════════════════════════

@router.post("/kpi-templates")
async def create_kpi_template(req: KPITemplate,
                              current_user: dict = Depends(get_current_user)):
    """إنشاء قالب KPI لقسم أو وظيفة"""
    company_id = current_user["company_id"]

    # Validate weights sum to 100
    total_weight = sum(float(k.get("weight", 0)) for k in req.kpis)
    if abs(total_weight - 100) > 0.01:
        raise HTTPException(400, f"مجموع الأوزان = {total_weight:.1f}% — يجب أن يكون 100%")

    tmpl = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "name": req.name, "department": req.department,
        "kpis": req.kpis, "total_weight": total_weight,
        "kpi_count": len(req.kpis),
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.kpi_templates.insert_one(tmpl); tmpl.pop("_id", None)
    return {"message": f"✅ تم إنشاء قالب KPI '{req.name}'", "template": tmpl}


@router.get("/kpi-templates")
async def list_kpi_templates(department: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if department: q["department"] = department
    templates = await db.kpi_templates.find(q, {"_id": 0}).to_list(None)
    return {"templates": templates, "total": len(templates)}


# ══════════════════════════════════════════════════════════════
# 2. APPRAISAL — تقييم الأداء
# ══════════════════════════════════════════════════════════════

@router.post("/appraisals")
async def create_appraisal(req: AppraisalRequest,
                           current_user: dict = Depends(get_current_user)):
    """
    إنشاء تقييم أداء موظف

    يحسب:
    - الدرجة الإجمالية (Weighted Average)
    - التقدير النوعي
    - التوصية وزيادة الراتب المقترحة
    """
    company_id = current_user["company_id"]

    emp = await db.employees.find_one(
        {"id": req.employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")

    # Check no existing appraisal for same period
    existing = await db.employee_appraisals.find_one({
        "company_id": company_id,
        "employee_id": req.employee_id,
        "review_period": req.review_period,
    })
    if existing:
        raise HTTPException(400,
            f"يوجد تقييم للموظف عن فترة '{req.review_period}' بالفعل")

    # Weighted score
    total_weight = sum(float(k.get("weight",0)) for k in req.kpi_scores)
    if total_weight == 0:
        raise HTTPException(400, "لا توجد KPIs بأوزان")

    weighted_sum = sum(
        float(k.get("score",0)) * float(k.get("weight",0))
        for k in req.kpi_scores
    )
    kpi_score = round(weighted_sum / total_weight, 2)
    rating    = get_rating(kpi_score)

    # Validate recommendation vs score
    if req.manager_recommendation == "pip" and kpi_score >= 70:
        raise HTTPException(400,
            f"لا يمكن توصية PIP لدرجة {kpi_score:.1f} — PIP للأداء أقل من 70")
    if req.manager_recommendation == "promotion" and kpi_score < 80:
        raise HTTPException(400,
            f"الترقية تتطلب أداءً ≥ 80 — الدرجة الحالية {kpi_score:.1f}")

    appraisal_id = str(uuid.uuid4())
    appraisal = {
        "appraisal_id":     appraisal_id,
        "company_id":       company_id,
        "employee_id":      req.employee_id,
        "employee_name":    emp.get("name",""),
        "department":       emp.get("department",""),
        "job_title":        emp.get("job_title",""),
        "current_salary":   float(emp.get("basic_salary", 0)),
        "review_period":    req.review_period,
        "period_type":      req.period_type,
        "review_date":      req.review_date,
        "kpi_scores":       req.kpi_scores,
        "kpi_score":        kpi_score,
        "rating_key":       rating["key"],
        "rating_ar":        rating["label_ar"],
        "rating_en":        rating["label_en"],
        "manager_notes":    req.manager_notes,
        "manager_recommendation":    req.manager_recommendation,
        "recommendation_ar":         RECOMMENDATIONS.get(req.manager_recommendation,""),
        "salary_increment_percentage": req.salary_increment_percentage,
        "promotion_to_grade":  req.promotion_to_grade,
        "promotion_to_title":  req.promotion_to_title,
        "is_applied_to_payroll": False,
        "applied_from_month":    None,
        "status":          "draft",
        "approved_by":     None,
        "approved_at":     None,
        "notes":           req.notes,
        "created_by":      current_user["user_id"],
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.employee_appraisals.insert_one(appraisal)
    appraisal.pop("_id", None)

    # KPI breakdown
    kpi_detail = []
    for k in req.kpi_scores:
        score  = float(k.get("score",0))
        weight = float(k.get("weight",0))
        kpi_detail.append({
            "kpi_name": k.get("kpi_name",""),
            "weight":   weight,
            "score":    score,
            "weighted": round(score * weight / 100, 2),
            "target":   k.get("target",""),
            "actual":   k.get("actual",""),
        })

    return {
        "message":      f"✅ تم إنشاء تقييم الأداء — {emp.get('name','')}",
        "appraisal_id": appraisal_id,
        "result": {
            "employee":      emp.get("name",""),
            "review_period": req.review_period,
            "kpi_score":     kpi_score,
            "rating":        rating["label_ar"],
            "recommendation": RECOMMENDATIONS.get(req.manager_recommendation,""),
            "salary_increment": f"{req.salary_increment_percentage:.1f}%"
                                if req.salary_increment_percentage > 0 else "لا زيادة",
        },
        "kpi_breakdown": kpi_detail,
        "next_step": "POST /api/performance/appraisals/{id}/approve → اعتماد التقييم",
    }


@router.post("/appraisals/{appraisal_id}/approve")
async def approve_appraisal(appraisal_id: str, data: dict,
                            current_user: dict = Depends(get_current_user)):
    """اعتماد التقييم من المدير المختص"""
    company_id = current_user["company_id"]
    decision   = data.get("decision","approved")
    comment    = data.get("comment","")

    appr = await db.employee_appraisals.find_one(
        {"appraisal_id": appraisal_id, "company_id": company_id}, {"_id": 0})
    if not appr:
        raise HTTPException(404, "التقييم غير موجود")
    if appr["status"] == "approved":
        raise HTTPException(400, "التقييم معتمد بالفعل")

    now = datetime.now(timezone.utc).isoformat()
    await db.employee_appraisals.update_one(
        {"appraisal_id": appraisal_id},
        {"$set": {"status": decision, "approved_by": current_user["user_id"],
                  "approved_at": now, "approval_comment": comment}}
    )

    # If promotion: update employee title
    if decision == "approved" and appr.get("manager_recommendation") == "promotion":
        update_fields = {}
        if appr.get("promotion_to_title"):
            update_fields["job_title"] = appr["promotion_to_title"]
        if appr.get("promotion_to_grade"):
            update_fields["grade"] = appr["promotion_to_grade"]
        if update_fields:
            await db.employees.update_one(
                {"id": appr["employee_id"], "company_id": company_id},
                {"$set": update_fields}
            )

    return {
        "message":      f"{'✅ تم اعتماد' if decision=='approved' else '❌ تم رفض'} التقييم",
        "appraisal_id": appraisal_id,
        "decision":     decision,
        "promotion_applied": (decision == "approved" and
                              appr.get("manager_recommendation") == "promotion"),
    }


# ══════════════════════════════════════════════════════════════
# 3. SALARY INCREMENT → PAYROLL — ترحيل الزيادة للراتب
# ══════════════════════════════════════════════════════════════

@router.post("/appraisals/{appraisal_id}/apply-to-payroll")
async def apply_increment_to_payroll(
    appraisal_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    ترحيل الزيادة السنوية لكشف الرواتب — آلياً

    يُحدِّث:
    1. basic_salary للموظف في جدول employees
    2. يُعلِّم التقييم بأنه مُرحَّل (is_applied_to_payroll = True)
    3. يسجل تاريخ بدء التطبيق
    """
    company_id   = current_user["company_id"]
    apply_month  = data.get("apply_from_month", date.today().strftime("%Y-%m"))

    appr = await db.employee_appraisals.find_one(
        {"appraisal_id": appraisal_id, "company_id": company_id}, {"_id": 0})
    if not appr:
        raise HTTPException(404, "التقييم غير موجود")
    if appr["status"] != "approved":
        raise HTTPException(400, "التقييم يجب أن يكون معتمداً أولاً")
    if appr.get("is_applied_to_payroll"):
        raise HTTPException(400,
            f"الزيادة مُرحَّلة بالفعل منذ {appr.get('applied_from_month')}")
    if float(appr.get("salary_increment_percentage", 0)) <= 0:
        raise HTTPException(400, "لا توجد زيادة راتب في هذا التقييم")

    emp = await db.employees.find_one(
        {"id": appr["employee_id"], "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")

    old_salary  = float(emp.get("basic_salary", 0))
    increment   = float(appr["salary_increment_percentage"])
    inc_amount  = round(old_salary * increment / 100, 2)
    new_salary  = round(old_salary + inc_amount, 2)

    # Update employee basic salary
    await db.employees.update_one(
        {"id": appr["employee_id"], "company_id": company_id},
        {"$set": {
            "basic_salary": new_salary,
            "last_increment_date":  date.today().isoformat(),
            "last_increment_amount": inc_amount,
            "last_increment_pct":   increment,
            "salary_history": {
                "date":       date.today().isoformat(),
                "old_salary": old_salary,
                "new_salary": new_salary,
                "increment_pct": increment,
                "appraisal_id":  appraisal_id,
                "period":        appr["review_period"],
            }
        }}
    )

    # Mark appraisal as applied
    await db.employee_appraisals.update_one(
        {"appraisal_id": appraisal_id},
        {"$set": {
            "is_applied_to_payroll": True,
            "applied_from_month":    apply_month,
            "applied_at":            datetime.now(timezone.utc).isoformat(),
            "applied_by":            current_user["user_id"],
            "salary_before":         old_salary,
            "salary_after":          new_salary,
            "increment_amount":      inc_amount,
        }}
    )

    return {
        "message":     f"✅ تم ترحيل الزيادة لكشف رواتب {apply_month}",
        "employee":    emp.get("name",""),
        "old_salary":  old_salary,
        "increment":   f"{increment:.1f}%",
        "inc_amount":  inc_amount,
        "new_salary":  new_salary,
        "effective":   apply_month,
        "note":        "سيُحتسَب الراتب الجديد تلقائياً في كشف الشهر القادم",
    }


@router.post("/appraisals/bulk-apply")
async def bulk_apply_increments(data: dict,
                                current_user: dict = Depends(get_current_user)):
    """
    ترحيل جميع الزيادات المعتمدة دفعة واحدة
    (بعد انتهاء موسم التقييم السنوي)
    """
    company_id  = current_user["company_id"]
    apply_month = data.get("apply_from_month", date.today().strftime("%Y-%m"))
    period      = data.get("review_period")  # e.g. "2026-Annual"

    q = {"company_id": company_id, "status": "approved",
         "is_applied_to_payroll": False,
         "salary_increment_percentage": {"$gt": 0}}
    if period: q["review_period"] = period

    pending = await db.employee_appraisals.find(q, {"_id": 0}).to_list(None)
    applied = errors = 0
    results = []

    for appr in pending:
        try:
            result = await apply_increment_to_payroll(
                appr["appraisal_id"], {"apply_from_month": apply_month}, current_user)
            applied += 1
            results.append({"employee": appr.get("employee_name",""),
                            "increment": appr["salary_increment_percentage"],
                            "status": "✅ applied"})
        except Exception as e:
            errors += 1
            results.append({"employee": appr.get("employee_name",""),
                            "status": f"❌ {str(e)[:60]}"})

    return {
        "message":      f"تم ترحيل {applied} زيادة | {errors} خطأ",
        "apply_month":  apply_month,
        "applied":      applied,
        "errors":       errors,
        "results":      results,
    }


# ══════════════════════════════════════════════════════════════
# 4. INDIVIDUAL DEVELOPMENT PLAN — خطة التطوير الفردية
# ══════════════════════════════════════════════════════════════

@router.post("/idp")
async def create_idp(req: IDPRequest,
                     current_user: dict = Depends(get_current_user)):
    """إنشاء خطة تطوير فردية (IDP) بعد التقييم"""
    company_id = current_user["company_id"]

    emp = await db.employees.find_one(
        {"id": req.employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")

    idp_id = str(uuid.uuid4())
    idp = {
        "id": idp_id, "company_id": company_id,
        "employee_id":    req.employee_id,
        "employee_name":  emp.get("name",""),
        "appraisal_id":   req.appraisal_id,
        "goals":          req.goals,
        "training_courses": req.training_courses,
        "mentor_id":      req.mentor_id,
        "start_date":     req.start_date,
        "end_date":       req.end_date,
        "total_goals":    len(req.goals),
        "completed_goals": 0,
        "status":         "active",
        "created_by":     current_user["user_id"],
        "created_at":     datetime.now(timezone.utc).isoformat(),
    }
    await db.employee_idp.insert_one(idp); idp.pop("_id", None)
    return {"message": f"✅ تم إنشاء خطة التطوير الفردية — {emp.get('name','')}",
            "idp_id": idp_id, "idp": idp}


@router.patch("/idp/{idp_id}/goal/{goal_idx}/complete")
async def complete_idp_goal(idp_id: str, goal_idx: int, data: dict,
                            current_user: dict = Depends(get_current_user)):
    """تحديث حالة هدف في خطة التطوير"""
    idp = await db.employee_idp.find_one(
        {"id": idp_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not idp: raise HTTPException(404, "خطة التطوير غير موجودة")

    goals = idp.get("goals", [])
    if goal_idx >= len(goals): raise HTTPException(400, "رقم الهدف غير صحيح")

    goals[goal_idx]["status"] = data.get("status", "completed")
    goals[goal_idx]["completed_at"] = date.today().isoformat()
    completed = sum(1 for g in goals if g.get("status") == "completed")

    await db.employee_idp.update_one(
        {"id": idp_id},
        {"$set": {"goals": goals, "completed_goals": completed,
                  "status": "completed" if completed == len(goals) else "active"}}
    )
    return {"message": f"✅ تم تحديث الهدف {goal_idx+1}",
            "completed": completed, "total": len(goals)}


# ══════════════════════════════════════════════════════════════
# 5. REPORTS — تقارير الأداء
# ══════════════════════════════════════════════════════════════

@router.get("/appraisals")
async def list_appraisals(
    review_period: Optional[str] = None,
    department:    Optional[str] = None,
    status:        Optional[str] = None,
    recommendation: Optional[str] = None,
    current_user:  dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if review_period:  q["review_period"] = review_period
    if department:     q["department"]    = department
    if status:         q["status"]        = status
    if recommendation: q["manager_recommendation"] = recommendation

    appraisals = await db.employee_appraisals.find(
        q, {"_id": 0, "kpi_scores": 0}
    ).sort("kpi_score", -1).to_list(None)

    avg_score = round(sum(float(a.get("kpi_score",0)) for a in appraisals)
                      / len(appraisals), 2) if appraisals else 0

    return {
        "appraisals": appraisals, "total": len(appraisals),
        "avg_score":  avg_score,
        "distribution": {
            "exceptional":    sum(1 for a in appraisals if a.get("kpi_score",0) >= 90),
            "exceeds":        sum(1 for a in appraisals if 80 <= a.get("kpi_score",0) < 90),
            "meets":          sum(1 for a in appraisals if 70 <= a.get("kpi_score",0) < 80),
            "needs_improvement": sum(1 for a in appraisals if 60 <= a.get("kpi_score",0) < 70),
            "unsatisfactory": sum(1 for a in appraisals if a.get("kpi_score",0) < 60),
        },
        "pending_payroll_apply": sum(1 for a in appraisals
                                     if a.get("status")=="approved"
                                     and not a.get("is_applied_to_payroll")
                                     and a.get("salary_increment_percentage",0)>0),
    }


@router.get("/appraisals/{appraisal_id}")
async def get_appraisal(appraisal_id: str,
                        current_user: dict = Depends(get_current_user)):
    a = await db.employee_appraisals.find_one(
        {"appraisal_id": appraisal_id,
         "company_id": current_user["company_id"]}, {"_id": 0})
    if not a: raise HTTPException(404, "التقييم غير موجود")
    return a


@router.get("/summary/{review_period}")
async def period_summary(review_period: str,
                         current_user: dict = Depends(get_current_user)):
    """ملخص تنفيذي لدورة التقييم"""
    company_id = current_user["company_id"]
    appraisals = await db.employee_appraisals.find(
        {"company_id": company_id, "review_period": review_period},
        {"_id": 0, "kpi_scores": 0}
    ).to_list(None)

    if not appraisals:
        return {"message": f"لا توجد تقييمات لفترة '{review_period}'"}

    increments = [a for a in appraisals if a.get("salary_increment_percentage",0) > 0]
    promotions = [a for a in appraisals if a.get("manager_recommendation")=="promotion"]
    pip        = [a for a in appraisals if a.get("manager_recommendation")=="pip"]

    total_payroll_impact = round(sum(
        float(a.get("current_salary",0)) * float(a.get("salary_increment_percentage",0)) / 100
        for a in increments
    ), 2)

    return {
        "review_period":  review_period,
        "total_reviewed": len(appraisals),
        "avg_score":      round(sum(float(a.get("kpi_score",0)) for a in appraisals)
                                / len(appraisals), 2),
        "recommendations": {
            "promotions":        len(promotions),
            "salary_increments": len(increments),
            "pip":               len(pip),
            "no_action":         len(appraisals) - len(promotions) - len(increments) - len(pip),
        },
        "payroll_impact": {
            "employees_with_increment": len(increments),
            "total_monthly_increase":   total_payroll_impact,
            "annual_cost":              round(total_payroll_impact * 12, 2),
        },
        "pending_approval": sum(1 for a in appraisals if a.get("status")=="draft"),
        "applied_to_payroll": sum(1 for a in appraisals if a.get("is_applied_to_payroll")),
    }
