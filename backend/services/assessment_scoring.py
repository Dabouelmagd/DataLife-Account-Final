"""
حساب نتائج التقييم — scoring.

Personality: count each axis's poles and take the stronger side. A tie is
reported as a tie (X), not resolved by a coin flip — "ENTJ" and "E?TJ" are
different claims and the second is the honest one when the answers do not
decide. `clarity` says how decisive each axis was, because a 6–5 split and a
11–0 split produce the same letter and mean very different things; a manager
reading a type without it is reading noise as signal.

Aptitude: correct answers weighted by the question's own weight, scaled to 10,
and also broken down per area — a candidate strong in numerical and weak in
attention is a different hire from one who is evenly average, and a single
number hides that.
"""

from typing import Dict, List, Tuple

from models.assessment import POLES

# the 16 types, with what each is usually taken to mean at work
TYPE_PROFILES: Dict[str, Dict] = {
    "ISTJ": {"label": "المُنفِّذ", "traits": ["منهجي", "موثوق في المواعيد", "دقيق في التفاصيل", "يحترم الإجراءات"]},
    "ISFJ": {"label": "الحاني", "traits": ["متعاون", "صبور", "يهتم بالتفاصيل", "يفضل الاستقرار"]},
    "INFJ": {"label": "المُرشد", "traits": ["صاحب رؤية", "يقرأ الناس جيداً", "يفضل العمل العميق"]},
    "INTJ": {"label": "المخطِّط", "traits": ["تفكير استراتيجي", "مستقل", "يميل للأنظمة والهياكل"]},
    "ISTP": {"label": "الحِرفي", "traits": ["عملي", "يحل المشكلات الفورية", "هادئ تحت الضغط"]},
    "ISFP": {"label": "الفنان", "traits": ["مرن", "حسّي", "يتجنّب الصراع"]},
    "INFP": {"label": "الوسيط", "traits": ["مدفوع بالقيم", "يحتاج معنى في العمل", "إبداعي"]},
    "INTP": {"label": "المحلِّل", "traits": ["فضولي", "يفكك المشكلات", "يقاوم الروتين"]},
    "ESTP": {"label": "المبادر", "traits": ["سريع القرار", "يجيد التفاوض", "يمل من التفاصيل"]},
    "ESFP": {"label": "المُنشِّط", "traits": ["اجتماعي", "يتعامل مع الجمهور بسهولة", "يحتاج تنويعاً"]},
    "ENFP": {"label": "المُلهِم", "traits": ["صاحب أفكار", "يبني العلاقات بسرعة", "قد يتشتت"]},
    "ENTP": {"label": "المُجادِل", "traits": ["يطرح البدائل", "يتحدّى الطرق المعتادة", "يحتاج تحدياً"]},
    "ESTJ": {"label": "المدير", "traits": ["منظِّم", "يضبط التنفيذ", "حاسم", "يميل للسيطرة على العملية"]},
    "ESFJ": {"label": "الداعم", "traits": ["يبني فرقاً متماسكة", "يتابع احتياجات الآخرين", "يقدّر الانسجام"]},
    "ENFJ": {"label": "القائد المُوجِّه", "traits": ["يطوّر الآخرين", "مقنع", "يقود بالعلاقات"]},
    "ENTJ": {"label": "القائد التنفيذي", "traits": ["يضع الأهداف ويقود لها", "سريع الحسم", "يتحمّل المساءلة"]},
}

TIE = "X"


def score_personality(questions: List[dict], answers: List[dict]) -> Dict:
    """(type, per-pole counts, clarity per axis). A tie stays a tie."""
    by_id = {q["id"]: q for q in questions}
    counts: Dict[str, int] = {p: 0 for p in "EISNTFJP"}
    answered_per_axis: Dict[str, int] = {axis: 0 for axis in POLES}

    for answer in answers:
        question = by_id.get(answer["question_id"])
        if not question or question.get("kind") != "psychometric":
            continue
        option = next((o for o in question.get("options", [])
                       if o.get("key") == answer.get("option_key")), None)
        pole = (option or {}).get("pole")
        if not pole:
            continue
        counts[pole] = counts.get(pole, 0) + 1
        axis = question.get("dichotomy")
        if axis in answered_per_axis:
            answered_per_axis[axis] += 1

    letters, clarity = "", {}
    for axis, (first, second) in POLES.items():
        a, b = counts.get(first, 0), counts.get(second, 0)
        total = a + b
        if total == 0:
            letters += TIE            # axis not covered by this paper
            clarity[axis] = 0.0
            continue
        if a == b:
            letters += TIE            # genuinely undecided — do not invent a side
            clarity[axis] = 0.0
        else:
            letters += first if a > b else second
            clarity[axis] = round(abs(a - b) / total * 100, 1)

    return {"type": letters, "counts": counts, "clarity": clarity,
            "answered_per_axis": answered_per_axis}


def describe_type(type_code: str) -> Dict:
    """Label and traits, tolerant of a code with ties in it."""
    profile = TYPE_PROFILES.get(type_code)
    if profile:
        return {"code": type_code, **profile, "complete": True}
    if TIE in (type_code or ""):
        return {"code": type_code, "label": "نمط غير محسوم",
                "traits": ["لم تحسم الإجابات أحد المحاور أو أكثر — النتيجة غير مكتملة"],
                "complete": False}
    return {"code": type_code or "—", "label": "غير محدد", "traits": [], "complete": False}


def score_aptitude(questions: List[dict], answers: List[dict]) -> Dict:
    """Weighted score out of 10, plus a score per area."""
    by_id = {q["id"]: q for q in questions}
    earned = possible = 0.0
    correct = attempted = 0
    per_area: Dict[str, List[float]] = {}

    for answer in answers:
        question = by_id.get(answer["question_id"])
        if not question or question.get("kind") != "aptitude":
            continue
        weight = float(question.get("weight", 1) or 1)
        is_right = answer.get("option_key") == question.get("correct_option")
        attempted += 1
        possible += weight
        if is_right:
            earned += weight
            correct += 1
        area = question.get("area") or "other"
        per_area.setdefault(area, []).append(weight if is_right else 0.0)
        per_area.setdefault(f"{area}__possible", []).append(weight)

    def out_of_ten(got: float, total: float) -> float:
        return round(got / total * 10, 2) if total else 0.0

    areas = {}
    for area in [a for a in per_area if not a.endswith("__possible")]:
        got = sum(per_area[area])
        total = sum(per_area.get(f"{area}__possible", []))
        areas[area] = out_of_ten(got, total)

    return {"score": out_of_ten(earned, possible), "correct": correct,
            "attempted": attempted, "area_scores": areas}
