"""
الصناديق والمساهمات المحسوبة على الأجور — اختيارية لكل شركة.

Four contributions were posted on every payroll of every company at fixed
rates: the workers' emergency fund 1%, the martyrs' fund 0.05%, the disability
fund 0.05% and the universal-health-insurance contribution 0.25%. Whether each
applies to a given company, at what rate, on which base, and who bears it
(the martyrs' fund) is a question for the company's accountant — the
emergency fund, for one, is commonly said to apply only from 30 workers. So
each one is a company setting, shown with a note, and the posted amounts are
stored on the payroll run so the payment entry settles exactly what was
accrued (it used to recompute them, and never paid the disability fund).

Defaults keep the previous behaviour, so nothing changes for a company until
it reviews the settings; `reviewed` tells the screens to show the note.
"""
import os
from typing import Optional

# key: (name, default rate %, base, payers allowed, expense code, payable code, note)
FUNDS = {
    "emergency": {
        "name": "صندوق إعانة الطوارئ للعمال",
        "rate": 1.0, "base": "basic", "payers": ("company",),
        "expense": "339", "liability": "258",
        "note": ("يُطبَّق عادةً على المنشآت التي يعمل بها 30 عاملاً فأكثر، بنسبة 1% من الأجور الأساسية "
                 "وتتحملها المنشأة. راجع محاسبك: إن كانت شركتك أقل من هذا العدد أوقفه."),
    },
    "martyrs": {
        "name": "صندوق تكريم الشهداء والمفقودين",
        "rate": 0.05, "base": "basic", "payers": ("company", "employee"),
        "expense": "3382", "liability": "259",
        "note": ("0.05% من الأجور. حدّد مع محاسبك: تتحمله الشركة (مصروف) أم يُخصم من راتب الموظف "
                 "ويظهر في قسيمته."),
    },
    "disability": {
        "name": "صندوق دعم الأشخاص ذوي الإعاقة",
        "rate": float(os.environ.get("DISABILITY_FUND_RATE", "0.0005")) * 100, "base": "basic",
        "payers": ("company",), "expense": "3383", "liability": "269",
        "note": "النسبة والوعاء حسب ما يحدده محاسبك للشركة.",
    },
    "uhi": {
        "name": "التأمين الصحي الشامل — المساهمة التكافلية",
        "rate": 0.25, "base": "gross", "payers": ("company",),
        "expense": "340", "liability": "262",
        "note": ("المساهمة التكافلية في القانون مرتبطة بإيرادات المنشأة لا بالأجور؛ البرنامج يقدّرها هنا "
                 "من إجمالي الأجور. أوقفها لو محاسبك بيحسبها ويقدّمها بشكل منفصل."),
    },
}
BASES = {"basic": "الأجور الأساسية", "gross": "إجمالي الأجور"}


def funds_config(settings: Optional[dict]) -> dict:
    """Each fund's effective setting: {enabled, rate (%), payer, base}."""
    saved = (settings or {}).get("funds") or {}
    out = {}
    for key, f in FUNDS.items():
        s = saved.get(key) or {}
        payer = s.get("payer") if s.get("payer") in f["payers"] else "company"
        try:
            rate = float(s["rate"]) if s.get("rate") not in (None, "") else f["rate"]
        except (TypeError, ValueError):
            rate = f["rate"]
        out[key] = {"enabled": bool(s.get("enabled", True)), "rate": rate, "payer": payer,
                    "base": f["base"]}
    return out


def clean_funds(data: dict) -> dict:
    """Validate a settings body: {key: {enabled, rate, payer}}. Raises ValueError."""
    out = {}
    for key, s in (data or {}).items():
        if key not in FUNDS or not isinstance(s, dict):
            continue
        f = FUNDS[key]
        try:
            rate = float(s.get("rate", f["rate"]))
        except (TypeError, ValueError):
            raise ValueError(f"نسبة {f['name']} غير صحيحة")
        if not (0 <= rate <= 5):
            raise ValueError(f"نسبة {f['name']} يجب أن تكون بين 0 و5%")
        payer = s.get("payer") or "company"
        if payer not in f["payers"]:
            raise ValueError(f"{f['name']}: تتحمله الشركة فقط")
        out[key] = {"enabled": bool(s.get("enabled")), "rate": round(rate, 4), "payer": payer}
    return out


def describe(settings: Optional[dict]) -> list:
    """For the settings screen: the note and the current choice of each fund."""
    cfg = funds_config(settings)
    return [{"key": k, "name": f["name"], "note": f["note"], "default_rate": f["rate"],
             "base": f["base"], "base_label": BASES[f["base"]], "payers": list(f["payers"]),
             **cfg[k]} for k, f in FUNDS.items()]


def employee_deductions(cfg: dict, basic: float, gross: float) -> list:
    """(key, name, amount) deducted from ONE employee's pay — funds the employee bears."""
    out = []
    for key, c in cfg.items():
        if c["enabled"] and c["payer"] == "employee" and c["rate"] > 0:
            base = gross if c["base"] == "gross" else basic
            amt = round(float(base or 0) * c["rate"] / 100, 2)
            if amt > 0:
                out.append((key, FUNDS[key]["name"], amt))
    return out


def company_amounts(cfg: dict, total_basic: float, total_gross: float) -> dict:
    """{key: amount} the company bears for a whole run."""
    out = {}
    for key, c in cfg.items():
        if c["enabled"] and c["payer"] == "company" and c["rate"] > 0:
            base = total_gross if c["base"] == "gross" else total_basic
            amt = round(float(base or 0) * c["rate"] / 100, 2)
            if amt > 0:
                out[key] = amt
    return out
