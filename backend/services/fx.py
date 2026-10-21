"""
أسعار الصرف — مصدر واحد لكل الوحدات
One exchange-rate lookup for the whole system.

Rates live in db.exchange_rates in three shapes, written by three screens:

  1. CurrenciesPage  (api/invoice.py /config/exchange-rates)
       {from_currency: <base, EGP>, to_currency: "USD", rate: 0.0204, effective_date}
       — the page says "1 EGP = <rate> USD", so EGP per USD = 1 / rate
  2. enterprise_accounting /exchange-rates
       {from_currency, to_currency, rate, rate_date}
       — same direction rule: from=USD,to=EGP → rate is EGP per USD;
         from=EGP,to=USD → 1 / rate
  3. financial_engine (legacy)
       {currency: "USD", rate: 48.5, date}  — EGP per 1 unit

rate_on() always returns EGP per ONE unit of the foreign currency, using the
latest rate effective on or before the date. EGP is always 1. A missing rate
is an Arabic HTTP 400 — never a silent 1.0, which would post a USD amount as
if it were pounds.
"""
from typing import Optional

from fastapi import HTTPException

BASE = "EGP"


def _code(v) -> str:
    return str(getattr(v, "value", v) or "").strip().upper()


def _date_of(doc: dict) -> str:
    return str(doc.get("effective_date") or doc.get("rate_date") or doc.get("date") or "")[:10]


def _egp_per_unit(doc: dict, currency: str) -> Optional[float]:
    """EGP for one unit of `currency` from one stored rate document, or None
    when the document is not about this currency against EGP."""
    try:
        rate = float(doc.get("rate") or 0)
    except (TypeError, ValueError):
        return None
    if rate <= 0:
        return None
    frm, to = _code(doc.get("from_currency")), _code(doc.get("to_currency"))
    if frm or to:
        if frm == currency and to in (BASE, ""):
            return rate                      # 1 USD = rate EGP
        if to == currency and frm in (BASE, ""):
            # The currencies screen saves {to_currency, rate} with no from, and
            # people type it either way: 48.5 (EGP per USD) or 0.0206 (USD per
            # EGP). Every currency offered is worth more than one pound, so a
            # rate of 1 or more can only be EGP per unit.
            return rate if rate >= 1 else 1.0 / rate
        return None
    if _code(doc.get("currency")) == currency:
        return rate                          # legacy: EGP per unit
    return None


async def rate_on(db, company_id: str, currency, date: Optional[str]) -> float:
    """EGP per one unit of `currency`, effective on or before `date`."""
    cur = _code(currency) or BASE
    if cur == BASE:
        return 1.0
    day = str(date or "")[:10] or "9999-12-31"
    query = {"company_id": company_id, "is_active": {"$ne": False},
             "$or": [{"to_currency": cur}, {"from_currency": cur}, {"currency": cur}]}
    best_key, best = None, None
    async for doc in db.exchange_rates.find(query, {"_id": 0}):
        d = _date_of(doc)
        if not d or d > day:
            continue
        value = _egp_per_unit(doc, cur)
        if value is None:
            continue
        # latest date wins; on the same date the most recently created wins
        key = (d, str(doc.get("created_at") or ""))
        if best_key is None or key >= best_key:
            best_key, best = key, value
    if best is None:
        raise HTTPException(status_code=400,
                            detail=f"لا يوجد سعر صرف لعملة {cur} في {day} أو قبله — أضف السعر من شاشة العملات أولاً")
    return round(best, 6)


def to_egp(amount: float, rate: float) -> float:
    return round(float(amount or 0) * float(rate or 1), 2)


async def strict_account(db, company_id: str, code: str) -> dict:
    """An account of this company's chart, or an Arabic 400. Never a stub —
    a stub id posts to an account that does not exist and the ledger drops it."""
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    if not acc:
        raise HTTPException(status_code=400,
                            detail=f"الحساب {code} غير موجود في شجرة حسابات الشركة — أضفه أو زامن الدليل الافتراضي")
    return acc
