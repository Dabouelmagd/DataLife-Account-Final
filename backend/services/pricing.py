"""
تسعير الاشتراك — مصدر واحد للباقة الأساسية + باقات المجالات + الإجمالي.

The pricing page had its own price table, the payment modal sent whatever
amount the browser computed, and the server stored it as the amount due. The
quote is now built here from api/payments.PLANS (base plan per period) and
services/industry_packs.PACKS (sector add-ons, monthly), and a payment request
stores the server's figure, never the browser's.

Prices are VAT-inclusive: the invoice shows the 14% contained in the total
(total × 14 / 114), not added on top.

A sector pack bought with a period gets the same period discount as the base
plan (e.g. a year = 8 months' price), so the customer sees one consistent rule.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

VAT_RATE = 14.0
DURATIONS = {
    "monthly": {"months": 1, "label": "شهري", "label_en": "Monthly", "days": 30},
    "3months": {"months": 3, "label": "3 شهور", "label_en": "3 months", "days": 90},
    "yearly": {"months": 12, "label": "سنوي", "label_en": "Yearly", "days": 365},
}
PLAN_ORDER = ("starter", "professional", "enterprise")
MODULE_PLANS = ("hr-only", "financial-only", "inventory-only")
# sector packs add accounts — they only make sense where the books are kept
PACK_PLANS = PLAN_ORDER + ("financial-only",)


def _plans():
    from api.payments import PLANS
    return PLANS


def plan_price(plan: str, duration: str) -> float:
    p = _plans().get(f"{plan}_{duration}")
    if not p:
        raise ValueError("الباقة أو المدة غير متاحة")
    return float(p["price_egp"])


def period_factor(plan: str, duration: str) -> float:
    """How many monthly prices the period costs (yearly ≈ 8)."""
    return plan_price(plan, duration) / plan_price(plan, "monthly")


def pack_price(pack_key: str, plan: str, duration: str) -> float:
    from services.industry_packs import PACKS
    pack = PACKS.get(pack_key)
    if not pack:
        raise ValueError(f"باقة المجال «{pack_key}» غير موجودة")
    return float(round(float(pack.get("price_egp") or 0) * period_factor(plan, duration)))


def _pack_opens(key: str) -> list:
    """Tools a sector pack opens on any plan (services/plan_limits.PACK_UNLOCKS)."""
    from services.plan_limits import PACK_UNLOCKS, TIER_PATHS
    names = {p: n for p, _, n in TIER_PATHS}
    return list(dict.fromkeys(names[p] for p in PACK_UNLOCKS.get(key, ()) if p in names))


def catalog() -> dict:
    """Everything the pricing page needs, from the server's own prices."""
    from services.industry_packs import PACKS
    plans = []
    for key in PLAN_ORDER + MODULE_PLANS:
        m = _plans()[f"{key}_monthly"]
        prices = {d: plan_price(key, d) for d in DURATIONS if f"{key}_{d}" in _plans()}
        plans.append({"key": key, "name_ar": m["name_ar"].split(" — ")[0], "name_en": m["name_en"].split(" — ")[0],
                      "employees": m["employees"], "prices": prices,
                      "kind": "module" if key in MODULE_PLANS else "full", "packs_allowed": key in PACK_PLANS,
                      "savings": {d: round(plan_price(key, "monthly") * DURATIONS[d]["months"] - v, 2)
                                  for d, v in prices.items()}})
    packs = [{"key": k, "name_ar": v["name_ar"], "name_en": v["name_en"], "note_ar": v.get("note_ar", ""),
              "monthly": float(v.get("price_egp") or 0),
              "adds": [a[1] for a in v.get("accounts", [])],
              "opens": _pack_opens(k)} for k, v in PACKS.items()]
    return {"plans": plans, "packs": packs, "durations": DURATIONS, "vat_rate": VAT_RATE,
            "vat_inclusive": True, "currency": "EGP"}


def quote(plan: str, duration: str, packs: Optional[list] = None, auto_renew: bool = False,
          start: Optional[datetime] = None) -> dict:
    """Line items, VAT contained in the total, and the renewal date."""
    if duration not in DURATIONS:
        raise ValueError("المدة يجب أن تكون شهري أو 3 شهور أو سنوي")
    from services.industry_packs import PACKS
    base = plan_price(plan, duration)
    m = _plans()[f"{plan}_{duration}"]
    lines = [{"kind": "plan", "key": plan, "label": f"اشتراك {m['name_ar']}", "amount": base}]
    seen = []
    if packs and plan not in PACK_PLANS:
        raise ValueError("المجالات المتخصصة بتتضاف على باقة فيها الحسابات (المبتدئ أو المحترف أو المؤسسي أو المالية فقط)")
    for k in packs or []:
        if k in seen:
            continue
        seen.append(k)
        lines.append({"kind": "pack", "key": k, "label": f"{PACKS[k]['name_ar']} — {DURATIONS[duration]['label']}"
                      if k in PACKS else k, "amount": pack_price(k, plan, duration)})
    total = round(sum(l["amount"] for l in lines), 2)
    vat = round(total * VAT_RATE / (100 + VAT_RATE), 2)
    start = start or datetime.now(timezone.utc)
    ends = start + timedelta(days=DURATIONS[duration]["days"])
    return {"plan": plan, "duration": duration, "months": DURATIONS[duration]["months"],
            "packs": seen, "lines": lines, "total": total,
            "vat_rate": VAT_RATE, "vat_included": vat, "net_before_vat": round(total - vat, 2),
            "auto_renew": bool(auto_renew), "starts": start.date().isoformat(),
            "renews_on": ends.date().isoformat(),
            "renewal_note": ("قبل التجديد بـ 7 أيام تتعمل فاتورة التجديد وتوصلك، وتدفعها بنفس طرق الدفع. "
                             "الخصم التلقائي من الكارت هيتفعّل أول ما ربط البنك يخلص.") if auto_renew else
                            "الاشتراك بينتهي في تاريخه، وتقدر تجدده يدوياً من صفحة الاشتراك."}
