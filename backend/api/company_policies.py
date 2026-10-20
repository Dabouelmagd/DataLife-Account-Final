"""
سياسات الشركة — اختيارات تحددها كل شركة مع محاسبها ومحاميها.

Some rules are a legal judgement the program cannot make for every company:
whether the 2.5% real-estate disposal tax applies to its sales, how long it
keeps each kind of record, and whether its own lawyer has reviewed its HR
policy and its handling of personal data (Law 151/2020). These used to be
hard-coded (or not recorded at all). They are now per-company settings.

The program never states that a company complies with a law. The legal-review
section only records what the company itself says: who reviewed what, and
when — shown as the company's own statement.

The HR policy itself (overtime rates, penalty cap, end-of-service formula)
lives in /api/hr-engine/policy; this endpoint only records its legal review.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from database import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/company-policies", tags=["Company Policies"])

TOP_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام", "المدير العام",
             "CEO", "المدير التنفيذي", "Super Admin", "admin", "owner"}

# record types and their default years. Records the tax law requires a company
# to keep (legal_hold) can be kept longer but never set below LEGAL_MIN_YEARS.
LEGAL_MIN_YEARS = 5
RETENTION_DEFAULTS = {
    "journal_entries": 5, "invoices": 5, "payroll_runs": 5, "tax_forms": 5,
    "eta_signing_records": 5, "letters_of_credit": 5, "audit_trail": 7,
    "employees": 10, "contracts": 10,
}
LEGAL_HOLD = {"journal_entries", "invoices", "payroll_runs", "tax_forms", "eta_signing_records",
              "letters_of_credit", "employees", "contracts"}

DEFAULTS = {
    "real_estate": {"disposal_tax_enabled": False, "disposal_tax_rate": 0.025},
    "retention_years": dict(RETENTION_DEFAULTS),
    "legal_review": {
        "hr_policy":       {"reviewed": False, "reviewer": "", "date": "", "note": ""},
        "real_estate_tax": {"reviewed": False, "reviewer": "", "date": "", "note": ""},
        "retention":       {"reviewed": False, "reviewer": "", "date": "", "note": ""},
        "data_protection": {"reviewed": False, "reviewer": "", "date": "", "note": ""},
    },
}

NOTE = ("هذه اختيارات شركتك. البرنامج لا يقدّم رأياً قانونياً ولا يقرّر امتثال الشركة لأي قانون — "
        "سجّل هنا من راجع كل سياسة ومتى، كبيان من شركتك.")


def _merge(base: dict, saved: dict) -> dict:
    out = {}
    for k, v in base.items():
        if isinstance(v, dict):
            out[k] = _merge(v, (saved or {}).get(k) or {})
        else:
            out[k] = (saved or {}).get(k, v)
    return out


async def get_policies(company_id: str) -> dict:
    saved = await db.company_policies.find_one({"company_id": company_id}, {"_id": 0}) or {}
    return _merge(DEFAULTS, saved)


async def retention_years(company_id: str) -> dict:
    return (await get_policies(company_id))["retention_years"]


async def disposal_tax(company_id: str) -> tuple:
    re = (await get_policies(company_id))["real_estate"]
    return bool(re["disposal_tax_enabled"]), float(re["disposal_tax_rate"])


@router.get("")
async def read_policies(current_user: dict = Depends(get_current_user)):
    return {"policies": await get_policies(current_user["company_id"]), "defaults": DEFAULTS,
            "legal_min_years": LEGAL_MIN_YEARS, "legal_hold": sorted(LEGAL_HOLD), "note": NOTE}


def _date(v) -> str:
    v = str(v or "").strip()[:10]
    if v:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "التاريخ بصيغة YYYY-MM-DD")
    return v


@router.put("")
async def update_policies(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in TOP_ROLES:
        raise HTTPException(403, "سياسات الشركة يضبطها رئيس مجلس الإدارة أو المدير العام")
    upd = {}
    re = data.get("real_estate")
    if isinstance(re, dict):
        if "disposal_tax_enabled" in re:
            upd["real_estate.disposal_tax_enabled"] = bool(re["disposal_tax_enabled"])
        if "disposal_tax_rate" in re:
            r = float(re["disposal_tax_rate"])
            r = r / 100 if r >= 1 else r                 # 2.5 or 0.025
            if not 0 <= r <= 0.1:
                raise HTTPException(400, "نسبة ضريبة التصرفات بين 0 و10%")
            upd["real_estate.disposal_tax_rate"] = round(r, 4)
    ret = data.get("retention_years")
    if isinstance(ret, dict):
        for k, v in ret.items():
            if k not in RETENTION_DEFAULTS:
                continue
            try:
                years = int(v)
            except (TypeError, ValueError):
                raise HTTPException(400, f"مدة الاحتفاظ لـ {k} رقم صحيح")
            floor = LEGAL_MIN_YEARS if k in LEGAL_HOLD else 1
            if not floor <= years <= 50:
                raise HTTPException(400, f"مدة الاحتفاظ لـ {k} بين {floor} و50 سنة")
            upd[f"retention_years.{k}"] = years
    lr = data.get("legal_review")
    if isinstance(lr, dict):
        for k, v in lr.items():
            if k not in DEFAULTS["legal_review"] or not isinstance(v, dict):
                continue
            reviewed = bool(v.get("reviewed"))
            reviewer = str(v.get("reviewer") or "").strip()[:200]
            if reviewed and not reviewer:
                raise HTTPException(400, "اكتب اسم من راجع السياسة (المحامي / المحاسب)")
            upd[f"legal_review.{k}"] = {"reviewed": reviewed, "reviewer": reviewer,
                                        "date": _date(v.get("date")), "note": str(v.get("note") or "")[:1000]}
    if not upd:
        raise HTTPException(400, "لا توجد قيم للتحديث")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_by"] = current_user.get("user_id")
    await db.company_policies.update_one({"company_id": current_user["company_id"]},
                                         {"$set": upd, "$setOnInsert": {"company_id": current_user["company_id"]}},
                                         upsert=True)
    return {"message": "تم حفظ سياسات الشركة", "policies": await get_policies(current_user["company_id"])}
