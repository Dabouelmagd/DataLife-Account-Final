"""
التقييمات النفسية واختبارات القدرات — API.

Sits beside the interview engine and reads from it rather than duplicating it:
the final report assembles the interview scorecards that already exist
(candidate_evaluations) with the assessment results and, when a provider is
configured, an AI summary.

Personality output is advisory throughout. It is never added to a score, never
compared against a threshold, and the report says so on its face — including
in the PDF a manager will print and keep.
"""

import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from database import db
from dependencies import get_current_user
from models.assessment import (
    AnswerIn, AssessmentQuestion, CandidateAssessment, FinalCandidateReport, QuestionKind,
)

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])

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
    if user.get("role") not in HR_ROLES:
        raise HTTPException(status_code=403, detail="هذا الإجراء مقصور على الموارد البشرية والإدارة")


# ══════════════════════════════════════════
# QUESTION BANK
# ══════════════════════════════════════════
@router.post("/questions")
async def add_question(question: AssessmentQuestion, current_user: dict = Depends(get_current_user)):
    """إضافة سؤال — نفسي أو قدرات (النموذج يتحقق من اتساق كل نوع)."""
    _require_hr(current_user)
    question.company_id = _cid(current_user)
    question.created_by = current_user.get("user_id")
    await db.assessment_questions.insert_one(question.model_dump(mode="json"))
    return {"message": "تمت إضافة السؤال", "question": question.model_dump(mode="json")}


@router.post("/questions/bulk")
async def add_questions_bulk(payload: dict, current_user: dict = Depends(get_current_user)):
    """حفظ مجموعة أسئلة — يُحفظ الصالح ويُبلَّغ عن المتخطى وسببه."""
    _require_hr(current_user)
    company_id = _cid(current_user)
    items = (payload or {}).get("questions") or []
    if not isinstance(items, list) or not items:
        raise HTTPException(status_code=400, detail="لا توجد أسئلة للحفظ")
    if len(items) > 200:
        raise HTTPException(status_code=400, detail="الحد الأقصى 200 سؤال في المرة")

    from pydantic import ValidationError
    docs, skipped = [], []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        try:
            q = AssessmentQuestion(**{**raw, "company_id": company_id,
                                      "created_by": current_user.get("user_id")})
        except ValidationError as e:
            skipped.append({"text": str(raw.get("text", ""))[:60],
                            "reason": e.errors()[0].get("msg", "غير صالح")})
            continue
        docs.append(q.model_dump(mode="json"))
    if not docs:
        raise HTTPException(status_code=400, detail="لا توجد أسئلة صالحة للحفظ")
    await db.assessment_questions.insert_many(docs)
    message = f"تم حفظ {len(docs)} سؤالاً"
    if skipped:
        message += f" — وتم تخطي {len(skipped)} غير صالح"
    return {"message": message, "saved": len(docs), "skipped": skipped}


@router.get("/questions")
async def list_questions(kind: Optional[QuestionKind] = None, job_profile_id: Optional[str] = None,
                         limit: int = Query(200, ge=1, le=500),
                         current_user: dict = Depends(get_current_user)):
    q = {"company_id": _cid(current_user), "is_active": True}
    if kind:
        q["kind"] = kind.value
    if job_profile_id:
        q["$or"] = [{"job_profile_id": job_profile_id}, {"job_profile_id": None}]
    rows = await db.assessment_questions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"questions": rows, "total": len(rows)}


@router.get("/paper/{candidate_id}")
async def assessment_paper(candidate_id: str, kind: QuestionKind,
                           current_user: dict = Depends(get_current_user)):
    """ورقة الأسئلة كما يراها المرشح — بلا إجابات صحيحة ولا أقطاب.

    Sending the answer key to the browser would make the test meaningless;
    the correct option and the personality poles never leave the server.
    """
    company_id = _cid(current_user)
    candidate = await db.candidates.find_one({"id": candidate_id, "company_id": company_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")
    kind_value = kind.value if hasattr(kind, "value") else str(kind)
    q = {"company_id": company_id, "is_active": True, "kind": kind_value,
         "$or": [{"job_profile_id": candidate.get("job_profile_id")}, {"job_profile_id": None}]}
    rows = await db.assessment_questions.find(
        q, {"_id": 0, "correct_option": 0, "options.pole": 0, "dichotomy": 0}).to_list(300)
    return {"candidate": {"id": candidate_id, "name": candidate.get("name")},
            "kind": kind_value, "questions": rows, "total": len(rows)}


# ══════════════════════════════════════════
# SUBMISSION & SCORING
# ══════════════════════════════════════════
@router.post("/submit")
async def submit_assessment(payload: dict, current_user: dict = Depends(get_current_user)):
    """تسليم إجابات المرشح وحساب النتيجة."""
    from services.assessment_scoring import score_personality, score_aptitude, describe_type

    company_id = _cid(current_user)
    candidate_id = (payload or {}).get("candidate_id")
    kind_raw = (payload or {}).get("kind")
    raw_answers = (payload or {}).get("answers") or []
    try:
        kind = QuestionKind(kind_raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="نوع التقييم غير صحيح")

    candidate = await db.candidates.find_one({"id": candidate_id, "company_id": company_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")
    if not raw_answers:
        raise HTTPException(status_code=400, detail="لا توجد إجابات")

    answers = [AnswerIn(**a) for a in raw_answers if isinstance(a, dict)]
    ids = [a.question_id for a in answers]
    questions = await db.assessment_questions.find(
        {"company_id": company_id, "id": {"$in": ids}}, {"_id": 0}).to_list(500)
    if len(questions) != len(set(ids)):
        raise HTTPException(status_code=400, detail="بعض الأسئلة غير موجودة أو تخص شركة أخرى")
    wrong_kind = [q for q in questions if q.get("kind") != kind.value]
    if wrong_kind:
        raise HTTPException(status_code=400, detail="الإجابات تخلط بين نوعي التقييم")

    record = CandidateAssessment(
        company_id=company_id, candidate_id=candidate_id,
        candidate_name=candidate.get("name"), job_profile_id=candidate.get("job_profile_id"),
        kind=kind, answers=answers,
        started_at=(payload or {}).get("started_at"),
        duration_seconds=(payload or {}).get("duration_seconds"),
        created_by=current_user.get("user_id"))

    plain = [a.model_dump() for a in answers]
    if kind == QuestionKind.PSYCHOMETRIC:
        result = score_personality(questions, plain)
        described = describe_type(result["type"])
        record.personality_type = result["type"]
        record.dichotomy_scores = result["counts"]
        record.clarity = result["clarity"]
        summary = {"personality_type": result["type"], "label": described["label"],
                   "traits": described["traits"], "clarity": result["clarity"],
                   "complete": described["complete"],
                   "note": "نتيجة استرشادية — لا تُستخدم كمعيار قبول أو رفض"}
    else:
        result = score_aptitude(questions, plain)
        record.aptitude_score = result["score"]
        record.correct_count = result["correct"]
        record.total_questions = result["attempted"]
        # keys come from the question documents and may be enum members;
        # stored as plain strings so every reader sees the same thing
        record.area_scores = {str(getattr(k, "value", k)): v for k, v in result["area_scores"].items()}
        summary = {"score": result["score"], "correct": result["correct"],
                   "total": result["attempted"], "area_scores": record.area_scores}

    # one live result per candidate per kind: re-sitting replaces, with history kept
    previous = await db.candidate_assessments.find_one(
        {"company_id": company_id, "candidate_id": candidate_id, "kind": kind.value,
         "superseded": {"$ne": True}}, {"_id": 0, "id": 1})
    if previous:
        await db.candidate_assessments.update_one(
            {"id": previous["id"]}, {"$set": {"superseded": True, "superseded_at": _now()}})
    await db.candidate_assessments.insert_one(record.model_dump(mode="json"))
    return {"message": "تم تسجيل التقييم", "assessment_id": record.id,
            "result": summary, "replaced_previous": bool(previous)}


@router.get("/candidates/{candidate_id}")
async def candidate_assessments(candidate_id: str, include_history: bool = False,
                                current_user: dict = Depends(get_current_user)):
    company_id = _cid(current_user)
    q = {"company_id": company_id, "candidate_id": candidate_id}
    if not include_history:
        q["superseded"] = {"$ne": True}
    rows = await db.candidate_assessments.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(100)
    return {"assessments": rows, "total": len(rows)}


# ══════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════
async def _build_report(company_id: str, candidate_id: str, user_id: str = None) -> dict:
    """Assemble interviews + assessments into one report (no AI, no storage)."""
    from services.assessment_scoring import describe_type

    candidate = await db.candidates.find_one({"id": candidate_id, "company_id": company_id}, {"_id": 0})
    if not candidate:
        raise HTTPException(status_code=404, detail="المرشح غير موجود")
    profile = await db.job_profiles.find_one(
        {"id": candidate.get("job_profile_id"), "company_id": company_id}, {"_id": 0}) or {}

    # interview scores come from the scorecards that already exist
    evaluations = await db.candidate_evaluations.find(
        {"company_id": company_id, "candidate_id": candidate_id}, {"_id": 0}).to_list(100)
    weights = {c["key"]: float(c["weight"]) for c in profile.get("criteria", [])}
    labels = {c["key"]: c.get("label", c["key"]) for c in profile.get("criteria", [])}

    per_criterion: dict = {}
    recommendations: dict = {}
    strengths, concerns = [], []
    for ev in evaluations:
        recommendations[ev.get("recommendation", "neutral")] = \
            recommendations.get(ev.get("recommendation", "neutral"), 0) + 1
        if ev.get("strengths"):
            strengths.append(ev["strengths"])
        if ev.get("concerns"):
            concerns.append(ev["concerns"])
        for s in ev.get("scores", []):
            per_criterion.setdefault(s["criterion_key"], []).append(float(s["score"]))

    breakdown, interview_score = [], None
    scored = {k: v for k, v in per_criterion.items() if k in weights}
    covered = sum(weights[k] for k in scored)
    if scored and covered:
        total = 0.0
        for key, values in scored.items():
            avg = sum(values) / len(values)
            share = weights[key] / covered * 100
            contribution = round(share * (avg / 5), 2)
            total += contribution
            breakdown.append({"criterion_key": key, "label": labels.get(key, key),
                              "avg_score": round(avg, 2), "weight": weights[key],
                              "contribution": contribution, "raters": len(values)})
        interview_score = round(total, 2)

    psych = await db.candidate_assessments.find_one(
        {"company_id": company_id, "candidate_id": candidate_id,
         "kind": "psychometric", "superseded": {"$ne": True}}, {"_id": 0})
    apt = await db.candidate_assessments.find_one(
        {"company_id": company_id, "candidate_id": candidate_id,
         "kind": "aptitude", "superseded": {"$ne": True}}, {"_id": 0})

    described = describe_type(psych.get("personality_type")) if psych else {}
    report = FinalCandidateReport(
        company_id=company_id, candidate_id=candidate_id,
        candidate_name=candidate.get("name") or "", job_profile_id=profile.get("id"),
        job_title=profile.get("title"),
        interview_score=interview_score, interviewers_count=len(evaluations),
        interview_breakdown=sorted(breakdown, key=lambda b: -b["contribution"]),
        recommendations=recommendations, strengths_notes=strengths, concerns_notes=concerns,
        aptitude_score=(apt or {}).get("aptitude_score"),
        area_scores=(apt or {}).get("area_scores") or {},
        personality_type=(psych or {}).get("personality_type"),
        personality_label=described.get("label"),
        personality_traits=described.get("traits") or [],
        personality_clarity=(psych or {}).get("clarity") or {},
        passing_score=float(profile.get("passing_score", 70) or 70),
        generated_by=user_id)
    return report.model_dump(mode="json")


@router.get("/report/{candidate_id}")
async def candidate_report(candidate_id: str, with_ai: bool = False,
                           current_user: dict = Depends(get_current_user)):
    """تقرير المرشح الشامل."""
    company_id = _cid(current_user)
    report = await _build_report(company_id, candidate_id, current_user.get("user_id"))

    if with_ai:
        from services.assessment_ai import manager_summary
        ai = await manager_summary(report)
        report["ai_summary"] = ai.get("summary")
        report["ai_generated_at"] = _now() if ai.get("ok") else None
        report["ai_error"] = ai.get("reason")

    await db.candidate_reports.replace_one(
        {"company_id": company_id, "candidate_id": candidate_id}, report, upsert=True)
    return report


@router.get("/report/{candidate_id}/pdf")
async def candidate_report_pdf(candidate_id: str, with_ai: bool = False,
                               current_user: dict = Depends(get_current_user)):
    """تقرير المرشح كملف PDF جاهز للطباعة."""
    company_id = _cid(current_user)
    report = await _build_report(company_id, candidate_id, current_user.get("user_id"))
    if with_ai:
        from services.assessment_ai import manager_summary
        ai = await manager_summary(report)
        report["ai_summary"] = ai.get("summary")

    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    pdf = _render_pdf(report, company.get("name", ""))
    filename = f"candidate-report-{candidate_id[:8]}.pdf"
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _render_pdf(report: dict, company_name: str) -> bytes:
    """The printed report. Arabic is drawn with a font that can draw it."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle)
    from services.arabic_pdf import ar, font_name

    regular, bold = font_name(), font_name(bold=True)
    title = ParagraphStyle("t", fontName=bold, fontSize=16, alignment=2, spaceAfter=4)
    sub = ParagraphStyle("s", fontName=regular, fontSize=9.5, alignment=2,
                         textColor=colors.HexColor("#475569"), spaceAfter=12)
    head = ParagraphStyle("h", fontName=bold, fontSize=12, alignment=2,
                          textColor=colors.HexColor("#1e3a8a"), spaceBefore=12, spaceAfter=6)
    body = ParagraphStyle("b", fontName=regular, fontSize=10, alignment=2, leading=16)
    note = ParagraphStyle("n", fontName=regular, fontSize=8.5, alignment=2,
                          textColor=colors.HexColor("#92400e"), leading=13)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title="تقرير المرشح")
    flow = [Paragraph(ar(f"تقرير المرشح — {report.get('candidate_name','')}"), title),
            Paragraph(ar(f"{company_name} · {report.get('job_title') or '—'} · "
                         f"{(report.get('generated_at') or '')[:10]}"), sub)]

    def table(rows, widths):
        t = Table(rows, colWidths=widths, hAlign="RIGHT")
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), regular),
            ("FONTNAME", (0, 0), (-1, 0), bold),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        return t

    # the decision line first — it is what the reader came for
    flow.append(Paragraph(ar("الخلاصة"), head))
    interview = report.get("interview_score")
    aptitude = report.get("aptitude_score")
    flow.append(table([
        [ar("التوصية"), ar(report.get("recommendation", "—"))],
        [ar("درجة المقابلات"), ar(f"{interview} من 100" if interview is not None else "لم تُجرَ")],
        [ar("عدد المُقيِّمين"), ar(str(report.get("interviewers_count", 0)))],
        [ar("اختبار القدرات"), ar(f"{aptitude} من 10" if aptitude is not None else "لم يُجرَ")],
        [ar("حد النجاح"), ar(f"{report.get('passing_score', 70)} من 100")],
    ], [60 * mm, 110 * mm]))

    if report.get("interview_breakdown"):
        flow.append(Paragraph(ar("تفصيل المقابلات"), head))
        rows = [[ar("المعيار"), ar("المتوسط"), ar("الوزن"), ar("المساهمة")]]
        for b in report["interview_breakdown"]:
            rows.append([ar(b["label"]), ar(f"{b['avg_score']} / 5"),
                         ar(f"{b['weight']}%"), ar(str(b["contribution"]))])
        flow.append(table(rows, [70 * mm, 33 * mm, 33 * mm, 34 * mm]))

    if report.get("area_scores"):
        flow.append(Paragraph(ar("القدرات بالمجالات"), head))
        names = {"numerical": "عددي", "verbal": "لفظي", "logical": "منطقي",
                 "attention": "دقة ملاحظة", "situational": "مواقف عملية"}
        rows = [[ar("المجال"), ar("الدرجة من 10")]]
        for area, score in report["area_scores"].items():
            rows.append([ar(names.get(area, area)), ar(str(score))])
        flow.append(table(rows, [100 * mm, 70 * mm]))

    if report.get("personality_type"):
        flow.append(Paragraph(ar("ملف الشخصية (استرشادي)"), head))
        flow.append(table([
            [ar("النمط"), ar(f"{report['personality_type']} — {report.get('personality_label') or ''}")],
            [ar("سمات مرتبطة"), ar("، ".join(report.get("personality_traits") or []) or "—")],
        ], [50 * mm, 120 * mm]))
        flow.append(Spacer(1, 4))
        flow.append(Paragraph(ar(
            "هذه النتيجة استرشادية لفهم أسلوب العمل المفضّل، ولم تدخل في أي درجة أو توصية. "
            "أدوات أنماط الشخصية لا تتنبأ بالأداء الوظيفي وقد تعطي نمطاً مختلفاً عند إعادة "
            "الاختبار، فلا تُبنى عليها قرارات القبول أو الرفض."), note))

    for key, heading in (("strengths_notes", "نقاط القوة كما ذكرها المُقيِّمون"),
                         ("concerns_notes", "التحفظات")):
        items = report.get(key) or []
        if items:
            flow.append(Paragraph(ar(heading), head))
            for item in items:
                flow.append(Paragraph(ar(f"• {item}"), body))

    if report.get("ai_summary"):
        flow.append(Paragraph(ar("ملخص المدير"), head))
        for para in str(report["ai_summary"]).split("\n"):
            if para.strip():
                flow.append(Paragraph(ar(para.strip()), body))
                flow.append(Spacer(1, 3))
        flow.append(Paragraph(ar("ملخص مُولَّد آلياً — يُقرأ كمساعدة لا كبديل عن قراءة التقرير."), note))

    doc.build(flow)
    return buf.getvalue()


@router.get("/reports")
async def list_reports(limit: int = Query(100, ge=1, le=300),
                       current_user: dict = Depends(get_current_user)):
    """التقارير السابقة — للرجوع إليها لاحقاً."""
    rows = await db.candidate_reports.find(
        {"company_id": _cid(current_user)}, {"_id": 0}).sort("generated_at", -1).to_list(limit)
    return {"reports": rows, "total": len(rows)}
