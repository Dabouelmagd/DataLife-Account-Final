"""
ملخص المدير — an AI reading of one candidate, for the person deciding.

Uses whichever provider is configured (Anthropic or OpenAI), the same way the
interview-question helper does, and never raises: a hiring report must open
even when the model is unavailable, so a failure returns ok=False and the
report simply shows the numbers without a narrative.

The prompt is deliberately constrained:
  * the personality type is context, never a reason to hire or reject — the
    instrument does not predict performance, and a summary that treats it as
    evidence would launder that into a decision;
  * no inference about age, gender, origin, religion, health or family — none
    of it is in the inputs and none of it may appear in the output;
  * concerns are named as plainly as strengths. A summary that only flatters
    is worse than none, because it reads as diligence.
"""

import asyncio
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 30

SYSTEM = (
    "أنت مدير موارد بشرية خبير تكتب ملخصاً موجزاً لمسؤول التوظيف عن مرشح واحد. "
    "اكتب بالعربية، بلغة مهنية مباشرة، دون مجاملة ودون مبالغة. "
    "نمط الشخصية سياق مساعد فقط ولا يصلح سبباً للقبول أو الرفض — لا تبنِ عليه توصية. "
    "اعتمد على درجات المقابلات والقدرات وملاحظات المُقيِّمين. "
    "لا تستنتج شيئاً عن السن أو النوع أو الأصل أو الدين أو الحالة الصحية أو الأسرة. "
    "اذكر التحفظات بنفس وضوح نقاط القوة."
)

TEMPLATE = """المرشح: {name}
الوظيفة: {job}

درجة المقابلات: {interview} من 100 (عدد المُقيِّمين: {raters})
درجة اختبار القدرات: {aptitude} من 10
تفصيل القدرات: {areas}

نمط الشخصية (استرشادي، غير مُقيَّم): {mbti} — {mbti_label}
سمات مرتبطة بالنمط: {traits}

ما ذكره المُقيِّمون كنقاط قوة:
{strengths}

ما ذكره المُقيِّمون كتحفظات:
{concerns}

اكتب ملخصاً من ثلاث فقرات قصيرة:
1. ما يقوله أداؤه في المقابلات والقدرات.
2. التحفظات وما يجب التحقق منه قبل القرار.
3. كيف يُدار هذا الشخص ليقدّم أفضل ما عنده (هنا فقط يمكن الاستئناس بالنمط).
لا تكتب توصية نهائية بالقبول أو الرفض — القرار لمسؤول التوظيف."""


def _provider():
    from services.interview_ai import _provider as pick
    return pick()


async def _ask_anthropic(key: str, prompt: str) -> str:
    import httpx
    from services.interview_ai import ANTHROPIC_MODEL, ANTHROPIC_URL
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        res = await client.post(ANTHROPIC_URL, headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
        }, json={"model": ANTHROPIC_MODEL, "max_tokens": 1200, "temperature": 0.4,
                 "system": SYSTEM, "messages": [{"role": "user", "content": prompt}]})
    if res.status_code == 401:
        raise PermissionError("مفتاح Anthropic غير صحيح")
    res.raise_for_status()
    return "".join(b.get("text", "") for b in res.json().get("content", []) if b.get("type") == "text")


async def _ask_openai(key: str, prompt: str) -> str:
    from openai import AsyncOpenAI
    from services.interview_ai import MODEL
    client = AsyncOpenAI(api_key=key, timeout=TIMEOUT_SECONDS)
    res = await client.chat.completions.create(
        model=MODEL, temperature=0.4,
        messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}])
    return (res.choices[0].message.content or "").strip()


async def manager_summary(report: dict) -> dict:
    """{"ok", "summary", "reason"} — never raises."""
    provider, key = _provider()
    if not provider:
        return {"ok": False, "summary": None,
                "reason": "لم يُضبط مفتاح ذكاء اصطناعي على الخادم"}

    areas = report.get("area_scores") or {}
    prompt = TEMPLATE.format(
        name=report.get("candidate_name", ""),
        job=report.get("job_title") or "—",
        interview=report.get("interview_score") if report.get("interview_score") is not None else "لم تُجرَ",
        raters=report.get("interviewers_count", 0),
        aptitude=report.get("aptitude_score") if report.get("aptitude_score") is not None else "لم يُجرَ",
        areas=", ".join(f"{k}: {v}" for k, v in areas.items()) or "—",
        mbti=report.get("personality_type") or "لم يُجرَ",
        mbti_label=report.get("personality_label") or "—",
        traits="، ".join(report.get("personality_traits") or []) or "—",
        strengths="\n".join(f"- {s}" for s in (report.get("strengths_notes") or [])) or "- لا يوجد",
        concerns="\n".join(f"- {c}" for c in (report.get("concerns_notes") or [])) or "- لا يوجد",
    )

    try:
        if provider == "anthropic":
            text = await asyncio.wait_for(_ask_anthropic(key, prompt), timeout=TIMEOUT_SECONDS + 5)
        else:
            text = await asyncio.wait_for(_ask_openai(key, prompt), timeout=TIMEOUT_SECONDS + 5)
    except asyncio.TimeoutError:
        return {"ok": False, "summary": None, "reason": "انتهت مهلة خدمة الذكاء الاصطناعي"}
    except PermissionError as e:
        return {"ok": False, "summary": None, "reason": str(e)}
    except Exception as e:
        logger.warning("manager summary failed: %s", e)
        return {"ok": False, "summary": None, "reason": "تعذّر الاتصال بخدمة الذكاء الاصطناعي"}

    text = (text or "").strip()
    if not text:
        return {"ok": False, "summary": None, "reason": "رد فارغ من خدمة الذكاء الاصطناعي"}
    return {"ok": True, "summary": text, "reason": None}
