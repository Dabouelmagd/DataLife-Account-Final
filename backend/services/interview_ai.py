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

# Either provider works — whichever key is configured. ANTHROPIC_API_KEY wins
# when both are set, unless INTERVIEW_AI_PROVIDER says otherwise.
MODEL = os.environ.get("OPENAI_INTERVIEW_MODEL", "gpt-4o-mini")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_INTERVIEW_MODEL", "claude-haiku-4-5-20251001")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
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


def _provider() -> tuple:
    """(name, key) for whichever provider is configured."""
    want = (os.environ.get("INTERVIEW_AI_PROVIDER") or "").strip().lower()
    anthropic = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    # a key pasted into the wrong variable is a common mistake — go by its prefix
    if openai_key.startswith("sk-ant-") and not anthropic:
        anthropic, openai_key = openai_key, ""
    if want == "openai" and openai_key:
        return "openai", openai_key
    if want == "anthropic" and anthropic:
        return "anthropic", anthropic
    if anthropic:
        return "anthropic", anthropic
    if openai_key:
        return "openai", openai_key
    return "", ""


async def _ask_anthropic(key: str, prompt: str) -> str:
    """Anthropic Messages API over httpx — no extra dependency."""
    import httpx
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        res = await client.post(ANTHROPIC_URL, headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
        }, json={
            "model": ANTHROPIC_MODEL, "max_tokens": 2000, "temperature": 0.7,
            "system": SYSTEM,
            "messages": [{"role": "user", "content": prompt}],
        })
    if res.status_code == 401:
        raise PermissionError("مفتاح Anthropic غير صحيح")
    if res.status_code == 404:
        raise ValueError(f"النموذج {ANTHROPIC_MODEL} غير متاح — عدّل ANTHROPIC_INTERVIEW_MODEL")
    res.raise_for_status()
    return "".join(b.get("text", "") for b in res.json().get("content", []) if b.get("type") == "text")


async def suggest_questions(job_title: str, experience_level: str = "mid",
                            department: Optional[str] = None, focus: Optional[str] = None) -> dict:
    """Five suggested questions with evaluation criteria.

    Returns {"ok": bool, "questions": [...], "reason": str|None}. Never raises.
    """
    provider, api_key = _provider()
    if not provider:
        return {"ok": False, "questions": [],
                "reason": "لم يُضبط مفتاح ذكاء اصطناعي على الخادم (ANTHROPIC_API_KEY أو OPENAI_API_KEY)"}
    level = experience_level if experience_level in {"junior", "mid", "senior"} else "mid"
    user_prompt = PROMPT.format(
        job_title=job_title, level=level,
        dept=f"القسم: {department}\n" if department else "",
        focus=f"ركّز على: {focus}\n" if focus else "")

    try:
        if provider == "anthropic":
            raw = (await asyncio.wait_for(_ask_anthropic(api_key, user_prompt), timeout=TIMEOUT_SECONDS + 5)).strip()
        else:
            raw = await _ask_openai(api_key, user_prompt)
    except asyncio.TimeoutError:
        return {"ok": False, "questions": [], "reason": "انتهت مهلة الاتصال بخدمة الذكاء الاصطناعي"}
    except (PermissionError, ValueError) as e:
        logger.warning("interview question suggestion refused: %s", e)
        return {"ok": False, "questions": [], "reason": str(e)}
    except Exception as e:                              # network, quota
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


async def _ask_openai(api_key: str, user_prompt: str) -> str:
    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise ValueError("مكتبة OpenAI غير مثبتة على الخادم")
    client = AsyncOpenAI(api_key=api_key, timeout=TIMEOUT_SECONDS)
    res = await asyncio.wait_for(client.chat.completions.create(
        model=MODEL, temperature=0.7, response_format={"type": "json_object"},
        messages=[{"role": "system", "content": SYSTEM},
                  {"role": "user", "content": user_prompt + '\nإذا لزم غلاف JSON استخدم {"questions": [...]}'}],
    ), timeout=TIMEOUT_SECONDS + 5)
    return (res.choices[0].message.content or "").strip()
