"""
ضريبة كسب العمل والتأمينات الاجتماعية — مصدر واحد لكل البرنامج.

There were three different bracket tables (payroll settings, a seeded DB
table, the calculator screen) and none matched the law, so the same salary
was taxed three ways. Every caller now uses this module.

Salary tax — Law 91/2005 as amended by Law 7/2024 (salaries from March 2024):
  * personal exemption 20,000 EGP a year;
  * annual net income after the exemption, in brackets
        0 – 40,000          0%
        40,000 – 55,000     10%
        55,000 – 70,000     15%
        70,000 – 200,000    20%
        200,000 – 400,000   22.5%
        400,000 – 1,200,000 25%
        over 1,200,000      27.5%
  * the lower brackets fall away as income rises (the law's tiers):
        over 600,000 to 700,000     the 0% bracket is lost: first 55,000 at 10%
        over 700,000 to 800,000     first 70,000 at 15%
        over 800,000 to 900,000     first 200,000 at 20%
        over 900,000 to 1,200,000   first 400,000 at 22.5%
        over 1,200,000              first 1,200,000 at 25%, the rest 27.5%
  The tax base is the annual taxable pay less the employee's insurance share.

Social insurance — Law 148/2019: employee 11%, employer 18.75%, on the
insurable wage held between the year's minimum and maximum. Those limits
rise every January, so they are company settings with the current year's
values as defaults; a value saved from an old default is replaced by them.
"""
from typing import Optional

PERSONAL_EXEMPTION = 20_000.0
BRACKETS = [(40_000, 0.0), (55_000, 0.10), (70_000, 0.15), (200_000, 0.20),
            (400_000, 0.225), (1_200_000, 0.25), (float("inf"), 0.275)]
# (income above this, the bracket edge up to which tax starts at its rate)
PHASE_OUT = [(1_200_000, 1_200_000), (900_000, 400_000), (800_000, 200_000),
             (700_000, 70_000), (600_000, 55_000)]

EMPLOYEE_RATE = 11.0
EMPLOYER_RATE = 18.75
# January 2026 limits (min 2,700 / max 16,700). Check every January.
INSURABLE_MIN = 2_700.0
INSURABLE_MAX = 16_700.0
INSURANCE_YEAR = 2026
# values earlier versions wrote into payroll settings as defaults — not a choice anyone made
_LEGACY_MIN = {1400.0, 2000.0, 2300.0}
_LEGACY_MAX = {12600.0, 11800.0, 14500.0}


def annual_tax(taxable: float) -> float:
    """Tax on annual taxable income AFTER the personal exemption."""
    if taxable <= 0:
        return 0.0
    floor, tax = 0.0, 0.0
    for above, edge in PHASE_OUT:                     # highest tier first
        if taxable > above:
            # everything up to `edge` is taxed at the rate of the bracket ending there
            rate = next(r for top, r in BRACKETS if top == edge)
            tax, floor = edge * rate, edge
            break
    for top, rate in BRACKETS:
        if taxable <= floor:
            break
        if top <= floor:
            continue
        part = min(taxable, top) - floor
        tax += part * rate
        floor = min(taxable, top)
    return round(tax, 2)


def monthly_salary_tax(monthly_taxable_pay: float, monthly_employee_insurance: float,
                       exemption: Optional[float] = None) -> float:
    """Monthly tax for a monthly taxable pay (gross less exempt allowances)."""
    exempt = PERSONAL_EXEMPTION if exemption is None else exemption
    annual_base = max((monthly_taxable_pay - monthly_employee_insurance) * 12 - exempt, 0)
    return round(annual_tax(annual_base) / 12, 2)


def insurance_limits(settings: Optional[dict] = None) -> tuple:
    s = settings or {}
    lo = float(s.get("social_insurance_min_wage") or 0)
    hi = float(s.get("social_insurance_max_wage") or 0)
    if not lo or lo in _LEGACY_MIN:
        lo = INSURABLE_MIN
    if not hi or hi in _LEGACY_MAX:
        hi = INSURABLE_MAX
    return lo, hi


def social_insurance(insurable_wage: float, settings: Optional[dict] = None) -> dict:
    """Employee and employer shares on the insurable wage, within the limits."""
    s = settings or {}
    lo, hi = insurance_limits(s)
    wage = min(max(float(insurable_wage or 0), lo), hi) if insurable_wage else 0.0
    emp_rate = float(s.get("employee_social_insurance_rate") or EMPLOYEE_RATE)
    co_rate = float(s.get("company_social_insurance_rate") or EMPLOYER_RATE)
    return {"insurable_wage": round(wage, 2),
            "employee": round(wage * emp_rate / 100, 2),
            "employer": round(wage * co_rate / 100, 2),
            "min": lo, "max": hi}


def exemption_from(settings: Optional[dict] = None) -> float:
    """The company's exemption, unless it is an old default (15,000 / 21,000)."""
    v = float((settings or {}).get("personal_exemption") or 0)
    return PERSONAL_EXEMPTION if v in (0.0, 15000.0, 21000.0) else v


def brackets_table() -> list:
    out, low = [], 0
    for top, rate in BRACKETS:
        out.append({"from": low, "to": None if top == float("inf") else top, "rate": rate})
        low = top
    return out
