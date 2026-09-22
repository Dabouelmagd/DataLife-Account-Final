"""
AI-suggested interview questions.

Suggestions only: nothing is written to the question bank until a recruiter
saves it, and the caller always gets a usable answer — a missing key, a
timeout or malformed JSON returns ok=False with a reason instead of raising,
so the hiring screen never breaks because of the model.
"""

import asyncio
import json
import logging
import os
from typing import List, Optional

logger = logging.getLogger(__name__)

MODEL = os.environ.get("OPENAI_INTERVIEW_MODEL", "gpt-4o-mini")
TIMEOUT_SECONDS = 25
ALLOWED_CATEGORIES = {"technical", "soft_skills", "experience", "culture_fit", "language", "other"}

SYSTEM = (
    "أنت خبير توظيف عربي. تُعيد أسئلة مقابلات عملية ومحددة يمكن تقييم إجابتها بموضوعية. "
    "لا تسأل عن السن أو الحالة الاجتماعية أو الدين أو الجنسية أو الحمل أو الحالة الصحية — "
    "هذه أسئلة تمييزية. أعد JSON فقط بدون أي نص آخر."
)

PROMPT = """اقترح 5 أسئلة مقابلة لوظيفة: {job_title}
مستوى الخبرة: {level}
{dept}{focus}
أعد مصفوفة JSON بالشكل التالي حرفياً:
[
  {{
    "question": "نص السؤال بالعربية",
    "category": "technical|soft_skills|experience|culture_fit|language",
    "difficulty": "junior|mid|senior",
    "expected_answer": "ملخص لما تتضمنه الإجابة الجيدة",
    "evaluation_criteria": ["ما يثبته الرد الجيد", "..."]
  }}
]"""


def _clean(raw: str) -> str:
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1] if "```" in raw[3:] else raw.strip("`")
        raw = raw[4:] if raw.lower().startswith("json") else raw
    start, end = raw.find("["), raw.rfind("]")
    return raw[start:end + 1] if start != -1 and end > start else raw


def _normalise(items: list, level: str) -> List[dict]:
    out = []
    for it in items:
        if not isinstance(it, dict) or not str(it.get("question", "")).strip():
            continue
        cat = str(it.get("category", "technical")).strip().lower()
        crit = it.get("evaluation_criteria") or []
        out.append({
            "question": str(it["question"]).strip()[:1000],
            "category": cat if cat in ALLOWED_CATEGORIES else "technical",
            "difficulty": str(it.get("difficulty", level)).strip().lower()
                          if str(it.get("difficulty", "")).strip().lower() in {"junior", "mid", "senior"} else level,
            "expected_answer": str(it.get("expected_answer", "")).strip()[:2000] or None,
            "evaluation_criteria": [str(c).strip()[:200] for c in crit if str(c).strip()][:6],
            "source": "ai",
        })
    return out[:5]


async def suggest_questions(job_title: str, experience_level: str = "mid",
                            department: Optional[str] = None, focus: Optional[str] = None) -> dict:
    """Five suggested questions with evaluation criteria.

    Returns {"ok": bool, "questions": [...], "reason": str|None}. Never raises.
    """
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        return {"ok": False, "questions": [], "reason": "مفتاح OpenAI غير مُعد على الخادم"}
    level = experience_level if experience_level in {"junior", "mid", "senior"} else "mid"

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key, timeout=TIMEOUT_SECONDS)
        res = await asyncio.wait_for(client.chat.completions.create(
            model=MODEL,
            temperature=0.7,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": PROMPT.format(
                    job_title=job_title, level=level,
                    dept=f"القسم: {department}\n" if department else "",
                    focus=f"ركّز على: {focus}\n" if focus else "") +
                    '\nإذا لزم غلاف JSON استخدم {"questions": [...]}'},
            ],
        ), timeout=TIMEOUT_SECONDS + 5)
        raw = (res.choices[0].message.content or "").strip()
    except asyncio.TimeoutError:
        return {"ok": False, "questions": [], "reason": "انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي"}
    except Exception as e:                              # auth, quota, network
        logger.warning("interview question suggestion failed: %s", e)
        return {"ok": False, "questions": [], "reason": "تعذّر الاتصال بخدمة الذكاء الاصطناعي"}

    try:
        data = json.loads(_clean(raw))
        if isinstance(data, dict):
            data = data.get("questions") or next((v for v in data.values() if isinstance(v, list)), [])
        questions = _normalise(data if isinstance(data, list) else [], level)
    except (json.JSONDecodeError, TypeError):
        return {"ok": False, "questions": [], "reason": "رد غير صالح من خدمة الذكاء الاصطناعي"}

    if not questions:
        return {"ok": False, "questions": [], "reason": "لم تُقترح أسئلة صالحة — حاول مرة أخرى"}
    return {"ok": True, "questions": questions, "reason": None}
