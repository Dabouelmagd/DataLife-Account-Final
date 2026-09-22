"""
Interview & Evaluation Engine — models
محرك المقابلات والتقييم

Design notes
------------
* company_id on every document. Nothing is ever queried without it.
* Weights live on the JobProfile, not on the evaluation: the same scorecard
  can be re-weighted later without touching what interviewers submitted.
  Weights are validated to sum to 100 at write time (see JobProfile).
* Interviewers submit RAW scores (1-5) per criterion. Weighting, averaging
  and any recruiter-facing score are derived — never stored as the source of
  truth — so a criterion added or re-weighted later cannot silently change
  history.
* Salary figures are stored here as offers/expectations only. They become
  accounting facts when the candidate is onboarded and payroll runs.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid() -> str:
    return str(uuid.uuid4())


class CriterionCategory(str, Enum):
    """تصنيف معايير التقييم — used to group the scorecard and the report."""
    TECHNICAL = "technical"          # المهارات الفنية
    SOFT_SKILLS = "soft_skills"      # المهارات الشخصية
    EXPERIENCE = "experience"        # الخبرة
    CULTURE_FIT = "culture_fit"      # التوافق مع بيئة العمل
    LANGUAGE = "language"            # اللغات
    OTHER = "other"                  # أخرى


class Difficulty(str, Enum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"


class CandidateStage(str, Enum):
    """مراحل المرشح"""
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class Recommendation(str, Enum):
    STRONG_YES = "strong_yes"
    YES = "yes"
    NEUTRAL = "neutral"
    NO = "no"
    STRONG_NO = "strong_no"


# ── Job profile ───────────────────────────────────────────────────────────
class EvaluationCriterion(BaseModel):
    """معيار تقييم بوزنه — الأوزان مجموعها 100 لكل وظيفة."""
    model_config = ConfigDict(str_strip_whitespace=True)

    key: str = Field(min_length=1, max_length=40, description="stable id used by scorecards")
    label: str = Field(min_length=1, max_length=120)
    category: CriterionCategory = CriterionCategory.OTHER
    weight: float = Field(gt=0, le=100, description="percentage of the final score")
    guidance: Optional[str] = Field(default=None, max_length=500,
                                    description="what a 1 and what a 5 look like")

    @field_validator("key")
    @classmethod
    def _slug(cls, v: str) -> str:
        return v.strip().lower().replace(" ", "_")


class JobProfile(BaseModel):
    """الوظيفة ومتطلباتها ومعايير تقييمها"""
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=_uid)
    company_id: str
    title: str = Field(min_length=2, max_length=160)
    department: Optional[str] = Field(default=None, max_length=120)
    level: Difficulty = Difficulty.MID
    description: Optional[str] = Field(default=None, max_length=4000)
    requirements: List[str] = Field(default_factory=list)
    responsibilities: List[str] = Field(default_factory=list)
    criteria: List[EvaluationCriterion] = Field(min_length=1)
    passing_score: float = Field(default=70, ge=0, le=100,
                                 description="weighted score (0-100) considered a pass")
    salary_range_min: Optional[float] = Field(default=None, ge=0)
    salary_range_max: Optional[float] = Field(default=None, ge=0)
    is_open: bool = True
    created_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None
    updated_at: Optional[str] = None

    @model_validator(mode="after")
    def _check(self):
        keys = [c.key for c in self.criteria]
        if len(keys) != len(set(keys)):
            raise ValueError("مفاتيح معايير التقييم مكررة")
        total = round(sum(c.weight for c in self.criteria), 2)
        if total != 100:
            raise ValueError(f"مجموع أوزان المعايير يجب أن يساوي 100 (الحالي {total})")
        if (self.salary_range_min is not None and self.salary_range_max is not None
                and self.salary_range_min > self.salary_range_max):
            raise ValueError("الحد الأدنى للراتب أكبر من الحد الأعلى")
        return self


# ── Question bank ─────────────────────────────────────────────────────────
class InterviewQuestion(BaseModel):
    """سؤال في بنك الأسئلة"""
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=_uid)
    company_id: str
    question: str = Field(min_length=5, max_length=1000)
    category: CriterionCategory = CriterionCategory.TECHNICAL
    department: Optional[str] = Field(default=None, max_length=120)
    role: Optional[str] = Field(default=None, max_length=160, description="job title this fits")
    difficulty: Difficulty = Difficulty.MID
    expected_answer: Optional[str] = Field(default=None, max_length=2000)
    evaluation_criteria: List[str] = Field(default_factory=list,
                                           description="what a good answer demonstrates")
    tags: List[str] = Field(default_factory=list, max_length=12)
    source: str = Field(default="manual", description="manual | ai | imported")
    times_used: int = Field(default=0, ge=0)
    is_active: bool = True
    created_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None


# ── Candidate evaluation (the scorecard) ──────────────────────────────────
class CriterionScore(BaseModel):
    """درجة معيار واحد — 1 إلى 5 كما أدخلها المُقيِّم"""
    criterion_key: str = Field(min_length=1, max_length=40)
    score: int = Field(ge=1, le=5)
    note: Optional[str] = Field(default=None, max_length=1000)


class CandidateEvaluation(BaseModel):
    """تقييم مُقيِّم واحد لمرشح في وظيفة — بطاقة تقييم واحدة"""
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(default_factory=_uid)
    company_id: str
    candidate_id: str
    candidate_name: str = Field(min_length=2, max_length=160)
    job_profile_id: str
    job_title: Optional[str] = None
    interviewer_id: str
    interviewer_name: Optional[str] = None
    round_name: str = Field(default="technical", max_length=60,
                            description="screening / technical / hr / final")
    interview_date: str = Field(default_factory=lambda: _now()[:10])
    scores: List[CriterionScore] = Field(min_length=1)
    strengths: Optional[str] = Field(default=None, max_length=2000)
    concerns: Optional[str] = Field(default=None, max_length=2000)
    recommendation: Recommendation = Recommendation.NEUTRAL
    # weights as they stood when this card was submitted, so an old card can
    # always be recomputed exactly as the interviewer saw it
    weights_snapshot: dict = Field(default_factory=dict)
    created_at: str = Field(default_factory=_now)
    updated_at: Optional[str] = None

    @model_validator(mode="after")
    def _unique_criteria(self):
        keys = [s.criterion_key for s in self.scores]
        if len(keys) != len(set(keys)):
            raise ValueError("تم تقييم نفس المعيار أكثر من مرة")
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def weighted_score(self) -> float:
        """0-100 for THIS card, using the weights captured at submission.

        Criteria the interviewer did not score are excluded and the remaining
        weights are rescaled, so a skipped criterion does not read as a zero.
        """
        if not self.weights_snapshot:
            return round(sum(s.score for s in self.scores) / len(self.scores) * 20, 2)
        used = {s.criterion_key: s.score for s in self.scores if s.criterion_key in self.weights_snapshot}
        total_weight = sum(self.weights_snapshot[k] for k in used)
        if not total_weight:
            return 0.0
        return round(sum(self.weights_snapshot[k] * (used[k] / 5) for k in used) / total_weight * 100, 2)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def average_raw(self) -> float:
        """متوسط الدرجات الخام من 5 — for a quick read next to the weighted score."""
        return round(sum(s.score for s in self.scores) / len(self.scores), 2)


# ── Requests ──────────────────────────────────────────────────────────────
class EvaluationIn(BaseModel):
    """ما يرسله المُقيِّم — the server fills company, interviewer and weights."""
    model_config = ConfigDict(str_strip_whitespace=True)

    candidate_id: str
    job_profile_id: str
    round_name: str = Field(default="technical", max_length=60)
    interview_date: Optional[str] = None
    scores: List[CriterionScore] = Field(min_length=1)
    strengths: Optional[str] = Field(default=None, max_length=2000)
    concerns: Optional[str] = Field(default=None, max_length=2000)
    recommendation: Recommendation = Recommendation.NEUTRAL


class OnboardIn(BaseModel):
    """تحويل مرشح إلى موظف"""
    model_config = ConfigDict(str_strip_whitespace=True)

    hire_date: str = Field(description="YYYY-MM-DD")
    basic_salary: float = Field(gt=0)
    position: Optional[str] = Field(default=None, max_length=160)
    department: Optional[str] = Field(default=None, max_length=120)
    invite_to_portal: bool = Field(default=True, description="email the portal activation link")

    @field_validator("hire_date")
    @classmethod
    def _date(cls, v: str) -> str:
        datetime.strptime(v, "%Y-%m-%d")      # raises if malformed
        return v
