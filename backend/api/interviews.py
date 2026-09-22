"""
Interview & Evaluation Engine
محرك المقابلات والتقييم

Every query carries company_id (Mode 11), every route needs the "hr"
permission through PermissionMiddleware, and onboarding creates the employee
record and links the portal login in one place.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from dependencies import get_current_user
from models.interview import (
    CandidateEvaluation, CandidateStage, CriterionCategory, Difficulty,
    EvaluationIn, InterviewQuestion, JobProfile, OnboardIn,
)

router = APIRouter(prefix="/api/interviews", tags=["Interviews & Evaluation"])

HR_ROLES = ["رئيس مجلس الإدارة", "Board Chairman", "مدير عام", "General Manager", "CEO",
            "المدير التنفيذي", "مدير الموارد البشرية", "HR Manager", "Super Admin"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _cid(user: dict) -> str:
    cid = user.get("company_id")
    if not cid:
        raise HTTPException(status_code=403, detail="الحساب غير مرتبط بشركة")
    return cid


def _require_hr(user: dict):
    """Interviewers may submit their own scorecards; hiring decisions are HR's."""
    if user.get("role") not in HR_ROLES:
        raise HTTPException(status_code=403, detail="هذا الإجراء مقصور على الموارد البشرية والإدارة")


# ══════════════════════════════════════════
# JOB PROFILES
# ══════════════════════════════════════════
@router.post("/job-profiles")
async def create_job_profile(profile: JobProfile, current_user: dict = Depends(get_current_user)):
    """إنشاء وظيفة بمعايير تقييمها — الأوزان يجب أن تساوي 100 (يتحقق منها النموذج)."""
    _require_hr(current_user)
    profile.company_id = _cid(current_user)          # never trust the body
    profile.created_by = current_user.get("user_id")
    await db.job_profiles.insert_one(profile.model_dump())
    return {"message": "تم إنشاء الوظيفة", "job_profile": profile.model_dump()}


@router.get("/job-profiles")
async def list_job_profiles(only_open: bool = True, department: Optional[str] = None,
                            current_user: dict = Depends(get_current_user)):
    q = {"company_id": _cid(current_user)}
    if only_open:
        q["is_open"] = True
    if department:
        q["department"] = department
    profiles = await db.job_profiles.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"job_profiles": profiles, "total": len(profiles)}


@router.get("/job-profiles/{profile_id}")
async def get_job_profile(profile_id: str, current_user: dict = Depends(get_current_user)):
    profile = await db.job_profiles.find_one({"id": profile_id, "company_id": _cid(current_user)}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="الوظيفة غير موجودة")
    return profile


@router.put("/job-profiles/{profile_id}")
async def update_job_profile(profile_id: str, profile: JobProfile,
                             current_user: dict = Depends(get_current_user)):
    """Re-weighting is allowed: existing scorecards keep the weights they were
    submitted with, and the live score uses the current ones."""
    _require_hr(current_user)
    company_id = _cid(current_user)
    existing = await db.job_profiles.find_one({"id": profile_id, "company_id": company_id}, {"_id": 0, "created_at": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="الوظيفة غير موجودة")
    data = profile.model_dump()
    data.update({"id": profile_id, "company_id": company_id, "created_at": existing.get("created_at"),
                 "updated_at": _now()})
    await db.job_profiles.replace_one({"id": profile_id, "company_id": company_id}, data)
    return {"message": "تم تحديث الوظيفة", "job_profile": data}


# ══════════════════════════════════════════
# QUESTION BANK
# ══════════════════════════════════════════
@router.post("/questions")
async def add_question(question: InterviewQuestion, current_user: dict = Depends(get_current_user)):
    question.company_id = _cid(current_user)
    question.created_by = current_user.get("user_id")
    await db.interview_questions.insert_one(question.model_dump())
    return {"message": "تمت إضافة السؤال", "question": question.model_dump()}


@router.post("/questions/bulk")
async def add_questions_bulk(payload: dict, current_user: dict = Depends(get_current_user)):
    """حفظ الأسئلة المقترحة بعد مراجعتها — accepts the AI suggestions as edited."""
    company_id = _cid(current_user)
    items = payload.get("questions") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="لا توجد أسئلة للحفظ")
    if len(items) > 50:
        raise HTTPException(status_code=400, detail="الحد الأقصى 50 سؤالاً في المرة")
    from pydantic import ValidationError
    docs, skipped = [], []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        try:                                   # one bad item used to fail the whole save
            q = InterviewQuestion(**{**raw, "company_id": company_id,
                                     "created_by": current_user.get("user_id")})
        except ValidationError as e:
            skipped.append({"question": str(raw.get("question", ""))[:60],
                            "reason": e.errors()[0].get("msg", "غير صالح")})
            continue
        docs.append(q.model_dump())
    if not docs:
        raise HTTPException(status_code=400, detail="لا توجد أسئلة صالحة للحفظ")
    await db.interview_questions.insert_many(docs)
    message = f"تم حفظ {len(docs)} سؤالاً"
    if skipped:
        message += f" — وتم تخطي {len(skipped)} غير صالح"
    return {"message": message, "questions": docs, "skipped": skipped}


@router.get("/questions")
async def list_questions(department: Optional[str] = None, role: Optional[str] = None,
                         category: Optional[CriterionCategory] = None,
                         difficulty: Optional[Difficulty] = None,
                         search: Optional[str] = None, limit: int = Query(100, ge=1, le=500),
                         current_user: dict = Depends(get_current_user)):
    q = {"company_id": _cid(current_user), "is_active": True}
    if department:
        q["department"] = department
    if role:
        q["role"] = role
    if category:
        q["category"] = category.value
    if difficulty:
        q["difficulty"] = difficulty.value
    if search:
        q["question"] = {"$regex": search[:80], "$options": "i"}
    questions = await db.interview_questions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"questions": questions, "total": len(questions)}


@router.post("/questions/suggest")
async def suggest_questions_ai(payload: dict, current_user: dict = Depends(get_current_user)):
    """اقتراح أسئلة بالذكاء الاصطناعي — suggestions only, nothing is saved."""
    _cid(current_user)
    from services.interview_ai import suggest_questions
    job_title = (payload.get("job_title") or "").strip()
    if not job_title:
        raise HTTPException(status_code=400, detail="المسمى الوظيفي مطلوب")
    result = await suggest_questions(job_title, payload.get("experience_level", "mid"),
                                     payload.get("department"), payload.get("focus"))
    return result                                   # {ok, questions, reason}


# ══════════════════════════════════════════
# CANDIDATES
# ══════════════════════════════════════════
@router.post("/candidates")
async def create_candidate(payload: dict, current_user: dict = Depends(get_current_user)):
    """إضافة مرشح لوظيفة"""
    company_id = _cid(current_user)
    name = (payload.get("name") or "").strip()
    job_profile_id = (payload.get("job_profile_id") or "").strip()
    if not name or not job_profile_id:
        raise HTTPException(status_code=400, detail="اسم المرشح والوظيفة مطلوبان")
    profile = await db.job_profiles.find_one({"id": job_profile_id, "company_id": company_id},
                                             {"_id": 0, "title": 1})
    if not profile:
        raise HTTPException(status_code=404, detail="الوظيفة غير موجودة")
    email = (payload.get("email") or "").strip().lower() or None
    if email and await db.candidates.find_one(
            {"company_id": company_id, "email": email, "job_profile_id": job_profile_id}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="هذا المرشح مضاف لهذه الوظيفة بالفعل")
    candidate = {
        "id": str(uuid.uuid4()), "company_id": company_id, "name": name[:160], "email": email,
        "phone": (payload.get("phone") or "").strip()[:40] or None,
        "job_profile_id": job_profile_id, "job_title": profile.get("title"),
        "stage": CandidateStage.APPLIED.value,
        "expected_salary": float(payload["expected_salary"]) if str(payload.get("expected_salary", "")).strip() else None,
        "source": (payload.get("source") or "").strip()[:60] or None,
        "notes": (payload.get("notes") or "").strip()[:2000] or None,
        "created_at": _now(), "created_by": current_user.get("user_id"),
    }
    await db.candidates.insert_one(dict(candidate))
    return {"message": "تمت إضافة المرشح", "candidate": candidate}


@router.get("/candidates")
async def list_candidates(job_profile_id: Optional[str] = None, stage: Optional[CandidateStage] = None,
                          search: Optional[str] = None, limit: int = Query(200, ge=1, le=500),
                          current_user: dict = Depends(get_current_user)):
    q = {"company_id": _cid(current_user)}
    if job_profile_id:
        q["job_profile_id"] = job_profile_id
    if stage:
        q["stage"] = stage.value
    if search:
        q["name"] = {"$regex": search[:80], "$options": "i"}
    candidates = await db.candidates.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"candidates": candidates, "total": len(candidates)}


@router.put("/candidates/{candidate_id}/stage")
async def set_candidate_stage(candidate_id: str, payload: dict,
                              current_user: dict = Depends(get_current_user)):
    """تغيير مرحلة المرشح — hiring goes through /onboard, not through here."""
    company_id = _cid(current_user)
    try:
        stage = CandidateStage((payload.get("stage") or "").strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="مرحلة غير صحيحة")
    if stage == CandidateStage.HIRED:
        raise HTTPException(status_code=400, detail="التعيين يتم من زر «تعيين» لإنشاء ملف الموظف")
    if stage in (CandidateStage.REJECTED, CandidateStage.OFFER):
        _require_hr(current_user)
    res = await db.candidates.update_one(
        {"id": candidate_id, "company_id": company_id},
        {"$set": {"stage": stage.value, "stage_reason": (payload.get("reason") or "").strip()[:500] or None,
                  "updated_at": _now(), "updated_by": current_user.get("user_id")}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")
    return {"message": "تم تحديث مرحلة المرشح", "stage": stage.value}


# ══════════════════════════════════════════
# SCORECARDS
# ══════════════════════════════════════════
@router.post("/evaluations")
async def submit_evaluation(payload: EvaluationIn, current_user: dict = Depends(get_current_user)):
    """تسليم بطاقة تقييم — one card per interviewer, per candidate, per round."""
    company_id = _cid(current_user)
    profile = await db.job_profiles.find_one(
        {"id": payload.job_profile_id, "company_id": company_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=404, detail="الوظيفة غير موجودة")
    candidate = await db.candidates.find_one(
        {"id": payload.candidate_id, "company_id": company_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")

    weights = {c["key"]: float(c["weight"]) for c in profile.get("criteria", [])}
    unknown = [s.criterion_key for s in payload.scores if s.criterion_key not in weights]
    if unknown:
        raise HTTPException(status_code=400, detail=f"معايير غير معرّفة لهذه الوظيفة: {', '.join(unknown)}")

    interviewer_id = current_user.get("user_id")
    existing = await db.candidate_evaluations.find_one(
        {"company_id": company_id, "candidate_id": payload.candidate_id,
         "job_profile_id": payload.job_profile_id, "interviewer_id": interviewer_id,
         "round_name": payload.round_name}, {"_id": 0, "id": 1, "created_at": 1})

    evaluation = CandidateEvaluation(
        id=existing["id"] if existing else str(uuid.uuid4()),
        company_id=company_id,
        candidate_id=payload.candidate_id,
        candidate_name=candidate.get("name") or candidate.get("full_name") or "",
        job_profile_id=payload.job_profile_id,
        job_title=profile.get("title"),
        interviewer_id=interviewer_id,
        interviewer_name=current_user.get("full_name") or current_user.get("email"),
        round_name=payload.round_name,
        interview_date=payload.interview_date or _now()[:10],
        scores=payload.scores,
        strengths=payload.strengths,
        concerns=payload.concerns,
        recommendation=payload.recommendation,
        weights_snapshot=weights,            # what the interviewer was shown
        created_at=existing["created_at"] if existing else _now(),
        updated_at=_now() if existing else None,
    )
    doc = evaluation.model_dump()            # computed fields are stored for reporting only
    await db.candidate_evaluations.replace_one(
        {"id": evaluation.id, "company_id": company_id}, doc, upsert=True)
    await db.candidates.update_one(
        {"id": payload.candidate_id, "company_id": company_id},
        {"$set": {"stage": CandidateStage.INTERVIEWING.value, "updated_at": _now()}})
    return {"message": "تم حفظ التقييم" if not existing else "تم تحديث تقييمك",
            "evaluation": doc, "replaced": bool(existing)}


@router.get("/candidates/{candidate_id}/score")
async def candidate_final_score(candidate_id: str, job_profile_id: Optional[str] = None,
                                current_user: dict = Depends(get_current_user)):
    """الدرجة النهائية الموزونة ومتوسط المُقيِّمين — computed in MongoDB.

    Per criterion: average of the interviewers' 1-5 scores, scaled to 0-100 and
    weighted by the job profile's CURRENT weights. Criteria nobody scored are
    excluded and the remaining weights rescaled, so a skipped criterion is not
    read as a zero.
    """
    company_id = _cid(current_user)
    candidate = await db.candidates.find_one({"id": candidate_id, "company_id": company_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")
    job_profile_id = job_profile_id or candidate.get("job_profile_id")
    profile = await db.job_profiles.find_one(
        {"id": job_profile_id, "company_id": company_id}, {"_id": 0}) if job_profile_id else None
    if not profile:
        raise HTTPException(status_code=404, detail="الوظيفة غير محددة لهذا المرشح")

    match = {"company_id": company_id, "candidate_id": candidate_id, "job_profile_id": job_profile_id}
    pipeline = [
        {"$match": match},
        {"$unwind": "$scores"},
        {"$group": {                                   # average per criterion across interviewers
            "_id": "$scores.criterion_key",
            "avg_score": {"$avg": "$scores.score"},
            "min_score": {"$min": "$scores.score"},
            "max_score": {"$max": "$scores.score"},
            "raters": {"$addToSet": "$interviewer_id"},
        }},
        {"$project": {"_id": 0, "criterion_key": "$_id", "avg_score": 1,
                      "min_score": 1, "max_score": 1, "raters": {"$size": "$raters"}}},
        {"$sort": {"criterion_key": 1}},
    ]
    per_criterion = await db.candidate_evaluations.aggregate(pipeline).to_list(200)
    for row in per_criterion:                      # rounded here, not with $round (portable)
        row["avg_score"] = round(float(row.get("avg_score") or 0), 2)

    # interviewer-level summary in one more pass
    per_interviewer = await db.candidate_evaluations.aggregate([
        {"$match": match},
        {"$project": {"_id": 0, "interviewer_id": 1, "interviewer_name": 1, "round_name": 1,
                      "interview_date": 1, "recommendation": 1, "weighted_score": 1,
                      "average_raw": {"$avg": "$scores.score"}}},
        {"$sort": {"interview_date": 1}},
    ]).to_list(100)

    weights = {c["key"]: float(c["weight"]) for c in profile.get("criteria", [])}
    labels = {c["key"]: c.get("label", c["key"]) for c in profile.get("criteria", [])}
    categories = {c["key"]: c.get("category", "other") for c in profile.get("criteria", [])}

    scored = [r for r in per_criterion if r["criterion_key"] in weights]
    covered_weight = sum(weights[r["criterion_key"]] for r in scored)
    breakdown, final = [], 0.0
    for r in scored:
        key = r["criterion_key"]
        share = weights[key] / covered_weight * 100 if covered_weight else 0.0
        contribution = round(share * (r["avg_score"] / 5), 2)
        final += contribution
        breakdown.append({**r, "label": labels[key], "category": categories[key],
                          "weight": weights[key], "effective_weight": round(share, 2),
                          "contribution": contribution})
    final = round(final, 2)
    missing = [{"criterion_key": k, "label": labels[k], "weight": weights[k]}
               for k in weights if k not in {r["criterion_key"] for r in scored}]

    return {
        "candidate": {"id": candidate_id, "name": candidate.get("name") or candidate.get("full_name"),
                      "stage": candidate.get("stage")},
        "job_profile": {"id": job_profile_id, "title": profile.get("title"),
                        "passing_score": profile.get("passing_score", 70)},
        "interviewers": len(per_interviewer),
        "final_score": final,
        "passed": bool(per_interviewer) and final >= float(profile.get("passing_score", 70)),
        "breakdown": breakdown,
        "not_scored": missing,                         # weights rescaled; shown explicitly
        "evaluations": per_interviewer,
    }


@router.get("/candidates/{candidate_id}/evaluations")
async def candidate_evaluations(candidate_id: str, current_user: dict = Depends(get_current_user)):
    company_id = _cid(current_user)
    evaluations = await db.candidate_evaluations.find(
        {"company_id": company_id, "candidate_id": candidate_id}, {"_id": 0}
    ).sort("interview_date", 1).to_list(100)
    return {"evaluations": evaluations, "total": len(evaluations)}


# ══════════════════════════════════════════
# ONBOARDING
# ══════════════════════════════════════════
@router.post("/candidates/{candidate_id}/onboard")
async def onboard_candidate(candidate_id: str, payload: OnboardIn,
                            current_user: dict = Depends(get_current_user)):
    """تعيين المرشح: تحديث حالته وإنشاء ملف موظف — hiring is HR's decision.

    Idempotent: a candidate already hired returns their existing employee
    record instead of creating a second one.
    """
    _require_hr(current_user)
    company_id = _cid(current_user)
    candidate = await db.candidates.find_one({"id": candidate_id, "company_id": company_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")
    if candidate.get("stage") in (CandidateStage.REJECTED.value, CandidateStage.WITHDRAWN.value):
        raise HTTPException(status_code=400, detail="لا يمكن تعيين مرشح مرفوض أو منسحب")
    if candidate.get("employee_id"):
        existing = await db.employees.find_one(
            {"id": candidate["employee_id"], "company_id": company_id}, {"_id": 0})
        if existing:
            return {"message": "المرشح معيّن بالفعل", "employee": existing, "already_hired": True}

    profile = await db.job_profiles.find_one(
        {"id": candidate.get("job_profile_id"), "company_id": company_id}, {"_id": 0}) or {}

    # one click: fill from what the system already knows
    salary = payload.basic_salary or candidate.get("expected_salary") or profile.get("salary_range_min")
    if not salary or float(salary) <= 0:
        raise HTTPException(status_code=400,
                            detail="لا يوجد راتب محفوظ للمرشح ولا نطاق للوظيفة — أدخل الراتب الأساسي")
    hire_date = payload.hire_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    employee = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "name": candidate.get("name") or candidate.get("full_name") or "",
        "position": payload.position or profile.get("title") or candidate.get("job_title") or "",
        "department": payload.department or profile.get("department"),
        "email": candidate.get("email"),
        "phone": candidate.get("phone"),
        "hire_date": hire_date,
        "basic_salary": float(salary),
        "is_active": True,
        "source": "recruitment",
        "candidate_id": candidate_id,
        "created_at": _now(),
        "created_by": current_user.get("user_id"),
    }
    await db.employees.insert_one(dict(employee))
    await db.candidates.update_one(
        {"id": candidate_id, "company_id": company_id},
        {"$set": {"stage": CandidateStage.HIRED.value, "employee_id": employee["id"],
                  "hired_at": _now(), "hired_by": current_user.get("user_id"), "updated_at": _now()}})

    invite = None
    if payload.invite_to_portal and employee.get("email"):
        try:                                   # never fail the hire because of an email
            from api.employees_extended import invite_employee_to_portal
            invite = await invite_employee_to_portal(employee["id"], None, current_user)
        except Exception as e:                 # noqa: BLE001 — reported, not raised
            invite = {"error": str(getattr(e, "detail", e))[:200]}

    return {"message": "تم تعيين المرشح وإنشاء ملف الموظف", "employee": employee,
            "portal_invite": invite,
            "defaults_used": {"hire_date": not payload.hire_date, "basic_salary": not payload.basic_salary,
                              "salary_source": "expected" if not payload.basic_salary and candidate.get("expected_salary")
                                               else ("job_range" if not payload.basic_salary else "entered")}}
