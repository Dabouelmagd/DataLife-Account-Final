"""
Psychometric and aptitude assessments — models.

Design notes
------------
* company_id on every document, as everywhere else.

* There is no separate InterviewRecord model here. Interview scores already
  live in CandidateEvaluation (models/interview.py) — one scorecard per
  interviewer, with weighted criteria. Adding a second place to keep interview
  scores is exactly the duplication that made customers and invoices
  unreliable before; the final report reads the evaluations that exist.

* Personality result is ADVISORY and never scored. MBTI-style instruments do
  not predict job performance and re-test to a different type often enough
  that a hiring decision built on one is both unfair and, in several
  jurisdictions, legally exposed. The type is carried as context for the
  manager; `advisory_only` is on the report so no screen can quietly turn it
  into a threshold, and the aptitude score — which does relate to performance
  — is the measured part.

* An aptitude question stores its correct answer; a psychometric one stores
  which pole each option leans to. They share one bank so a paper can mix
  both, and the scorer branches on `kind`.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator


def _uid() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class QuestionKind(str, Enum):
    PSYCHOMETRIC = "psychometric"   # نمط الشخصية — استرشادي
    APTITUDE = "aptitude"           # قدرات — مُقيَّم


class Dichotomy(str, Enum):
    """محاور النمط الأربعة"""
    EI = "EI"   # انبساط / انطواء
    SN = "SN"   # حسّي / حدسي
    TF = "TF"   # تفكير / وجدان
    JP = "JP"   # حاسم / مرن


class AptitudeArea(str, Enum):
    NUMERICAL = "numerical"       # عددي
    VERBAL = "verbal"             # لفظي
    LOGICAL = "logical"           # منطقي
    ATTENTION = "attention"       # دقة ملاحظة
    SITUATIONAL = "situational"   # مواقف عملية


POLES = {"EI": ("E", "I"), "SN": ("S", "N"), "TF": ("T", "F"), "JP": ("J", "P")}


class QuestionOption(BaseModel):
    """خيار إجابة."""
    key: str = Field(min_length=1, max_length=4)     # a, b, c...
    text: str = Field(min_length=1, max_length=600)
    # psychometric: which pole this option leans to (E/I/S/N/T/F/J/P)
    pole: Optional[str] = Field(default=None, max_length=1)

    @field_validator("pole")
    @classmethod
    def _valid_pole(cls, v):
        if v and v not in set("EISNTFJP"):
            raise ValueError("القطب يجب أن يكون أحد: E I S N T F J P")
        return v


class AssessmentQuestion(BaseModel):
    """سؤال في بنك التقييم — نفسي أو قدرات."""
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=_uid)
    company_id: str
    kind: QuestionKind
    text: str = Field(min_length=5, max_length=1000)
    options: List[QuestionOption] = Field(min_length=2, max_length=6)

    # psychometric
    dichotomy: Optional[Dichotomy] = None
    # aptitude
    area: Optional[AptitudeArea] = None
    correct_option: Optional[str] = Field(default=None, max_length=4)
    weight: float = Field(default=1.0, gt=0, le=10)

    job_profile_id: Optional[str] = None     # None = usable for any role
    is_active: bool = True
    created_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None

    @model_validator(mode="after")
    def _consistent(self):
        keys = [o.key for o in self.options]
        if len(keys) != len(set(keys)):
            raise ValueError("مفاتيح الخيارات مكررة")
        if self.kind == QuestionKind.APTITUDE:
            if not self.correct_option:
                raise ValueError("سؤال القدرات يجب أن يحدد الإجابة الصحيحة")
            if self.correct_option not in keys:
                raise ValueError("الإجابة الصحيحة ليست ضمن الخيارات")
            if not self.area:
                raise ValueError("سؤال القدرات يجب أن يحدد المجال")
        else:
            if not self.dichotomy:
                raise ValueError("سؤال الشخصية يجب أن يحدد المحور")
            allowed = set(POLES[self.dichotomy.value])
            poles = [o.pole for o in self.options]
            if any(p is None for p in poles):
                raise ValueError("كل خيار في سؤال الشخصية يجب أن يشير إلى قطب")
            if not set(poles) <= allowed:
                raise ValueError(f"أقطاب المحور {self.dichotomy.value} يجب أن تكون {' أو '.join(sorted(allowed))}")
            if len(set(poles)) < 2:
                raise ValueError("سؤال الشخصية يجب أن يقابل بين القطبين")
        return self


class AnswerIn(BaseModel):
    question_id: str
    option_key: str = Field(min_length=1, max_length=4)


class CandidateAssessment(BaseModel):
    """أوراق إجابات مرشح على تقييم واحد."""
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=_uid)
    company_id: str
    candidate_id: str
    candidate_name: Optional[str] = None
    job_profile_id: Optional[str] = None
    kind: QuestionKind
    answers: List[AnswerIn] = Field(min_length=1)

    # results, computed by the scorer and stored so a report is reproducible
    personality_type: Optional[str] = None        # e.g. ENTJ
    dichotomy_scores: Dict[str, int] = Field(default_factory=dict)   # {"E": 7, "I": 3, ...}
    clarity: Dict[str, float] = Field(default_factory=dict)          # how decisive each axis was
    aptitude_score: Optional[float] = None        # out of 10
    correct_count: Optional[int] = None
    total_questions: Optional[int] = None
    area_scores: Dict[str, float] = Field(default_factory=dict)      # per aptitude area, out of 10

    started_at: Optional[str] = None
    submitted_at: str = Field(default_factory=_now)
    duration_seconds: Optional[int] = Field(default=None, ge=0)
    created_by: Optional[str] = None

    @model_validator(mode="after")
    def _no_duplicate_answers(self):
        ids = [a.question_id for a in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError("تمت الإجابة على نفس السؤال أكثر من مرة")
        return self


class FinalCandidateReport(BaseModel):
    """تقرير المرشح: المقابلات + القدرات + ملف الشخصية + ملخص المدير."""
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=_uid)
    company_id: str
    candidate_id: str
    candidate_name: str
    job_profile_id: Optional[str] = None
    job_title: Optional[str] = None

    # from the interview scorecards that already exist
    interview_score: Optional[float] = None       # 0-100, weighted
    interviewers_count: int = 0
    interview_breakdown: List[dict] = Field(default_factory=list)
    recommendations: Dict[str, int] = Field(default_factory=dict)   # {"yes": 2, "no": 1}
    strengths_notes: List[str] = Field(default_factory=list)
    concerns_notes: List[str] = Field(default_factory=list)

    # measured
    aptitude_score: Optional[float] = None        # out of 10
    area_scores: Dict[str, float] = Field(default_factory=dict)

    # advisory
    personality_type: Optional[str] = None
    personality_label: Optional[str] = None
    personality_traits: List[str] = Field(default_factory=list)
    personality_clarity: Dict[str, float] = Field(default_factory=dict)
    advisory_only: bool = True                    # never part of any threshold

    ai_summary: Optional[str] = None
    ai_generated_at: Optional[str] = None

    passing_score: float = 70.0
    generated_at: str = Field(default_factory=_now)
    generated_by: Optional[str] = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def recommendation(self) -> str:
        """التوصية — من المقابلات والقدرات فقط، ولا أثر للنمط فيها."""
        if self.interview_score is None and self.aptitude_score is None:
            return "لا توجد بيانات كافية"
        interview_ok = self.interview_score is not None and self.interview_score >= self.passing_score
        aptitude_ok = self.aptitude_score is None or self.aptitude_score >= 6
        negatives = self.recommendations.get("no", 0) + self.recommendations.get("strong_no", 0)
        positives = self.recommendations.get("yes", 0) + self.recommendations.get("strong_yes", 0)

        if interview_ok and aptitude_ok and negatives == 0:
            return "يُرشَّح للتعيين"
        if negatives > positives:
            return "لا يُرشَّح"
        if interview_ok or (self.aptitude_score or 0) >= 8:
            return "يُرشَّح مع تحفظات — راجع الملاحظات"
        return "لا يُرشَّح"
