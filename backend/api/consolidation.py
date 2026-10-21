"""
Consolidation Engine — محرك التجميع المالي
المعيار المحاسبي المصري رقم 42 (EAS 42 / IFRS 10)

القوائم المالية المجمعة لمجموعة الشركات (Holding & Subsidiaries):

1. هيكل المجموعة (Company Group Structure) — بموافقة صريحة من كل شركة تابعة
2. الميزان المجمع (Consolidated Trial Balance)
3. قيود الاستبعاد (أوراق عمل فقط — لا تُرحَّل لدفاتر أي شركة):
   أ. استبعاد المبيعات والمشتريات البينية + الأرباح غير المحققة في المخزون
   ب. استبعاد الحسابات الجارية المدينة والدائنة
   ج. إثبات حقوق الأقلية (NCI)
4. ورقة عمل التجميع (Consolidation Worksheet)

AUTHORISATION MODEL
A user belongs to exactly one company, so "the companies this user may see"
is just their own. Groups used to take holding_company_id and every
subsidiary company_id straight from the request body: anyone could name any
company on the platform as a subsidiary and read its whole ledger through the
trial balance / worksheet. Now:
  • the holding is always the caller's own company (top management only);
  • each subsidiary starts as "pending" and is consolidated only after a top
    manager OF THAT SUBSIDIARY accepts the link (POST /groups/{id}/respond);
    it can withdraw the same way at any time.
Groups created before this change have no link_status, so their
subsidiaries are treated as pending until they accept.
"""
import re as _re
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from models.accounting import DEFAULT_ACCOUNTS
from dependencies import get_current_user

router = APIRouter(prefix="/api/consolidation", tags=["Consolidation EAS42"])

TOP_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام",
             "المدير العام", "CEO", "المدير التنفيذي", "owner"}


def _require_top(user: dict, what: str):
    if user.get("role") not in TOP_ROLES and not user.get("is_platform_admin"):
        raise HTTPException(403, f"{what} لرئيس مجلس الإدارة أو المدير العام / التنفيذي فقط")


# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
# 4301 / 3501 / 3502 do not exist in the default chart. 311 is "raw materials
# consumed" and 121 "raw materials inventory"; goods sold between group
# companies go through 314 (COGS) and 125 (merchandise inventory), the same
# accounts services/invoice_service.py posts a sale to.
ACC = {
    "interco_ar":      "1361",  # جاري الشركات التابعة والشقيقة (مدين)
    "interco_ap":      "2301",  # جاري الشركات التابعة — دائن
    "nci_equity":      "2141",  # حقوق الأقلية NCI
    "revenue":         "411",   # إيراد مبيعات بضائع
    "cogs":            "314",   # تكلفة البضاعة المباعة
    "inventory":       "125",   # مخزون بضائع بغرض البيع
    "retained":        "213",   # الأرباح المرحلة
}
_DEFAULT_BY_CODE = {a["code"]: a for a in DEFAULT_ACCOUNTS}


async def get_acc(company_id: str, code: str) -> dict:
    """Account from the holding's chart, else from the default chart.

    It used to invent {"id": code, "account_name": "حساب <code>"} for any
    code — a line nobody could trace to a real account. Consolidation lines
    are working papers (never posted), so a default-chart account the
    holding has not seeded is acceptable; an unknown code is not.
    """
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    if a:
        return a
    d = _DEFAULT_BY_CODE.get(code)
    if not d:
        raise HTTPException(400, f"الحساب {code} غير موجود في شجرة الحسابات")
    return {"id": None, "account_code": code, "account_name": d["name"]}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc.get("id"),
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", ""),
        "debit": round(float(debit), 2), "credit": round(float(credit), 2),
        "description": desc,
    }


async def record_consolidation_entry(company_id: str, user_id: str, date_str: str,
                                     description: str, lines: list, ref: str = None,
                                     group_id: str = None, fiscal_year: int = None) -> str:
    """Record a consolidation adjustment — WITHOUT posting it to any company's books.

    These used to be posted into the holding company's own ledger. That did two
    kinds of damage: the holding's standalone statements were distorted (its
    sales reduced by amounts that only exist in the group view, so its own
    income statement and VAT return were wrong), and the worksheet then
    subtracted the same elimination again from a combined column that already
    contained it — so the elimination cancelled itself out and consolidation
    had no effect at all.

    A consolidation adjustment belongs to the group's working papers only.
    """
    dr = round(sum(l["debit"] for l in lines), 2)
    cr = round(sum(l["credit"] for l in lines), 2)
    if abs(dr - cr) > 0.01:
        raise HTTPException(400, f"قيد الاستبعاد غير متوازن (مدين {dr:,.2f} / دائن {cr:,.2f})")
    entry_id = str(uuid.uuid4())
    await db.consolidation_entries.insert_one({
        "id": entry_id, "company_id": company_id, "group_ref": ref,
        "group_id": group_id, "fiscal_year": fiscal_year,
        "entry_date": date_str, "description": description,
        "lines": lines, "total_debit": dr, "total_credit": cr,
        "created_by": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "nature": "consolidation_adjustment",   # never posted to a ledger
    })
    return entry_id


async def get_account_balance(
    company_id: str, account_prefix: str,
    date_from: str, date_to: str
) -> float:
    """Sum net (debit - credit) for account prefix in period"""
    pipeline = [
        {"$match": {"company_id": company_id, "status": "posted",
                    "entry_date": {"$gte": date_from, "$lte": date_to}}},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": {"$regex": "^" + _re.escape(str(account_prefix))}}},
        {"$group": {"_id": None,
                    "debit":  {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"}}},
    ]
    r = await db.journal_entries.aggregate(pipeline).to_list(1)
    if not r: return 0.0
    return round(float(r[0]["debit"]) - float(r[0]["credit"]), 2)


def _is_member(sub: dict) -> bool:
    return sub.get("link_status") == "accepted" and sub.get("consolidated", False)


def _member_ids(group: dict) -> list:
    return [group["holding_company_id"]] + [
        s["company_id"] for s in group.get("subsidiaries", []) if _is_member(s)]


async def _holding_group(group_id: str, company_id: str) -> dict:
    g = await db.company_groups.find_one(
        {"id": group_id, "holding_company_id": company_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "المجموعة غير موجودة")
    return g


def _sub_of(group: dict, company_id: str) -> Optional[dict]:
    return next((s for s in group.get("subsidiaries", []) if s.get("company_id") == company_id), None)


def _check_member(group: dict, company_id: str, label: str):
    if company_id == group["holding_company_id"]:
        return
    s = _sub_of(group, company_id)
    if not s:
        raise HTTPException(400, f"{label} ليست ضمن المجموعة")
    if not _is_member(s):
        raise HTTPException(400, f"{label} لم توافق بعد على الانضمام للمجموعة أو لا تُجمَّع بالكامل")


def _year_of(date_str: str, fiscal_year: int):
    if not str(date_str or "").startswith(str(fiscal_year)):
        raise HTTPException(400, "تاريخ الاستبعاد يجب أن يقع في السنة المالية المحددة")


# ══════════════════════════════════════════════════════════════
# 1. COMPANY GROUP STRUCTURE — هيكل المجموعة
# ══════════════════════════════════════════════════════════════

class CompanyGroupRequest(BaseModel):
    group_name:       str
    holding_company_id: Optional[str] = None    # ignored — always the caller's company
    subsidiaries: List[dict]
    # [{company_id, ownership_pct, acquisition_date}]
    fiscal_year:  int
    notes:        Optional[str] = None


@router.post("/groups")
async def create_company_group(
    req: CompanyGroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """تعريف مجموعة (الشركة الحالية قابضة) — كل شركة تابعة يجب أن توافق قبل تجميعها"""
    _require_top(current_user, "تعريف مجموعة الشركات")
    holding = current_user["company_id"]
    if req.holding_company_id and req.holding_company_id != holding:
        raise HTTPException(403, "الشركة القابضة يجب أن تكون شركتك الحالية")
    if not req.group_name.strip():
        raise HTTPException(400, "اسم المجموعة مطلوب")
    if not req.subsidiaries:
        raise HTTPException(400, "أضف شركة تابعة واحدة على الأقل")

    enriched, seen = [], set()
    for sub in req.subsidiaries:
        cid = str(sub.get("company_id") or "").strip()
        if not cid or cid == holding or cid in seen:
            raise HTTPException(400, "معرِّف شركة تابعة فارغ أو مكرر أو هو نفس الشركة القابضة")
        seen.add(cid)
        co = await db.companies.find_one({"id": cid}, {"_id": 0, "id": 1, "name": 1, "name_ar": 1})
        if not co:
            raise HTTPException(400, f"لا توجد شركة بالمعرِّف {cid}")
        try:
            ownership = round(float(sub.get("ownership_pct", 100)), 2)
        except (TypeError, ValueError):
            raise HTTPException(400, "نسبة الملكية يجب أن تكون رقماً")
        if not 0 < ownership <= 100:
            raise HTTPException(400, "نسبة الملكية بين 0 و 100")
        # whitelisted — {**sub} let the caller set link_status="accepted"
        enriched.append({
            "company_id":    cid,
            "company_name":  co.get("name_ar") or co.get("name", ""),
            "ownership_pct": ownership,
            "nci_pct":       round(100 - ownership, 2),
            "acquisition_date": str(sub.get("acquisition_date") or "")[:10] or None,
            "consolidated":  ownership > 50,  # Majority = consolidate
            "method": (
                "full_consolidation"  if ownership > 50   else
                "equity_method"       if ownership >= 20  else
                "fair_value"
            ),
            "link_status":   "pending",
        })

    group_id = str(uuid.uuid4())
    group = {
        "id":                 group_id,
        "admin_company_id":   holding,
        "group_name":         req.group_name.strip()[:200],
        "holding_company_id": holding,
        "subsidiaries":       enriched,
        "fiscal_year":        int(req.fiscal_year),
        "notes":              (req.notes or "")[:1000],
        "created_by":         current_user["user_id"],
        "created_at":         datetime.now(timezone.utc).isoformat(),
    }
    await db.company_groups.insert_one(dict(group))

    return {
        "message":    f"تم تعريف مجموعة '{group['group_name']}' — بانتظار موافقة الشركات التابعة",
        "group_id":   group_id,
        "group":      group,
        "subsidiaries_summary": [
            {"name": s["company_name"], "ownership": s["ownership_pct"],
             "nci": s["nci_pct"], "method": s["method"], "link_status": s["link_status"]}
            for s in enriched
        ],
    }


@router.get("/groups")
async def list_company_groups(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    groups = await db.company_groups.find(
        {"holding_company_id": company_id}, {"_id": 0}).to_list(None)
    for g in groups:
        for s in g.get("subsidiaries", []):
            s.setdefault("link_status", "pending")
    # Groups that name THIS company as a subsidiary — only what it needs to
    # decide (no other subsidiaries are disclosed).
    invitations = []
    for g in await db.company_groups.find(
            {"subsidiaries.company_id": company_id}, {"_id": 0}).to_list(None):
        s = _sub_of(g, company_id) or {}
        holding = await db.companies.find_one({"id": g["holding_company_id"]},
                                              {"_id": 0, "name": 1, "name_ar": 1}) or {}
        invitations.append({
            "group_id": g["id"], "group_name": g.get("group_name"),
            "holding_name": holding.get("name_ar") or holding.get("name", ""),
            "ownership_pct": s.get("ownership_pct"), "link_status": s.get("link_status", "pending"),
        })
    return {"groups": groups, "total": len(groups), "invitations": invitations,
            "my_company_id": company_id}


@router.post("/groups/{group_id}/respond")
async def respond_to_group(group_id: str, data: dict,
                           current_user: dict = Depends(get_current_user)):
    """موافقة/رفض/انسحاب الشركة التابعة من المجموعة — يقرره مديرها الأعلى"""
    _require_top(current_user, "الموافقة على الانضمام لمجموعة")
    company_id = current_user["company_id"]
    g = await db.company_groups.find_one(
        {"id": group_id, "subsidiaries.company_id": company_id}, {"_id": 0, "id": 1})
    if not g:
        raise HTTPException(404, "لا توجد دعوة من هذه المجموعة لشركتك")
    status = "accepted" if data.get("accept") is True else "declined"
    await db.company_groups.update_one(
        {"id": group_id, "subsidiaries.company_id": company_id},
        {"$set": {"subsidiaries.$.link_status": status,
                  "subsidiaries.$.responded_by": current_user["user_id"],
                  "subsidiaries.$.responded_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": "✅ تمت الموافقة على الانضمام للمجموعة" if status == "accepted"
            else "تم رفض/سحب الانضمام — لن تُجمَّع بيانات شركتك", "link_status": status}


# ══════════════════════════════════════════════════════════════
# 2. CONSOLIDATED TRIAL BALANCE — الميزان المجمع
# ══════════════════════════════════════════════════════════════

async def _company_balances(co_id: str, df: str, dt: str) -> dict:
    pipeline = [
        {"$match": {"company_id": co_id, "status": "posted",
                    "entry_date": {"$gte": df, "$lte": dt}}},
        {"$unwind": "$lines"},
        {"$group": {"_id": "$lines.account_code",
                    "debit":  {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"},
                    "name":   {"$last": "$lines.account_name"}}},
    ]
    out = {}
    for row in await db.journal_entries.aggregate(pipeline).to_list(None):
        if row["_id"]:
            out[row["_id"]] = {"name": row.get("name") or "",
                               "debit": round(float(row["debit"] or 0), 2),
                               "credit": round(float(row["credit"] or 0), 2)}
    return out


@router.get("/trial-balance/{group_id}")
async def consolidated_trial_balance(
    group_id:  str,
    year:      int = Query(...),
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """الميزان المجمع (قبل الاستبعادات) — للشركات التي وافقت على الانضمام فقط"""
    group = await _holding_group(group_id, current_user["company_id"])
    df = date_from or f"{year}-01-01"
    dt = date_to   or f"{year}-12-31"
    all_companies = _member_ids(group)

    combined: dict = {}
    for co_id in all_companies:
        for code, row in (await _company_balances(co_id, df, dt)).items():
            c = combined.setdefault(code, {"account_code": code, "account_name": row["name"],
                                           "debit": 0.0, "credit": 0.0})
            c["debit"] += row["debit"]; c["credit"] += row["credit"]

    lines_out = []
    total_dr = total_cr = 0.0
    for code, data in sorted(combined.items()):
        dr = round(data["debit"], 2); cr = round(data["credit"], 2)
        total_dr += dr; total_cr += cr
        lines_out.append({**data, "debit": dr, "credit": cr, "net": round(dr - cr, 2)})

    elims = await db.elimination_entries.find(
        {"group_id": group_id, "fiscal_year": year,
         "admin_company_id": current_user["company_id"]}, {"_id": 0}).to_list(None)

    return {
        "group_name":    group["group_name"],
        "fiscal_year":   year,
        "period":        {"from": df, "to": dt},
        "companies":     all_companies,
        "pending_subsidiaries": [s.get("company_name") for s in group.get("subsidiaries", [])
                                 if s.get("link_status", "pending") != "accepted"],
        "trial_balance": lines_out,
        "totals": {
            "total_debit":  round(total_dr, 2),
            "total_credit": round(total_cr, 2),
            "balanced":     abs(total_dr - total_cr) < 1.0,
        },
        "eliminations": {"count": len(elims), "detail": elims},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 3. ELIMINATION ENTRIES — قيود الاستبعاد (أوراق عمل)
# ══════════════════════════════════════════════════════════════

class IntercompanySaleRequest(BaseModel):
    """معاملة بيع بيني تحتاج استبعاداً"""
    group_id:          str
    seller_company_id: str
    buyer_company_id:  str
    fiscal_year:       int
    sale_amount:       float   # إجمالي المبيعات البينية
    cost_amount:       float   # تكلفة البضاعة البينية (عند البائع)
    ending_inventory_pct: float = 0.0  # % من البضاعة لا تزال عند المشتري
    elimination_date:  str


def _name(group: dict, cid: str) -> str:
    if cid == group["holding_company_id"]:
        return "الشركة القابضة"
    return (_sub_of(group, cid) or {}).get("company_name") or cid


@router.post("/eliminations/intercompany-sales")
async def eliminate_intercompany_sales(
    req: IntercompanySaleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    القيد أ — استبعاد المعاملة البينية:
      من حـ/ 411 إيراد مبيعات (كامل البيع البيني)
      إلى حـ/ 314 تكلفة البضاعة المباعة (كامل البيع البيني — مشتريات المشتري)
    القيد ب — الأرباح غير المحققة في مخزون آخر المدة:
      من حـ/ 314 تكلفة البضاعة المباعة
      إلى حـ/ 125 مخزون بضائع
    """
    company_id = current_user["company_id"]
    group = await _holding_group(req.group_id, company_id)
    _check_member(group, req.seller_company_id, "الشركة البائعة")
    _check_member(group, req.buyer_company_id, "الشركة المشترية")
    if req.seller_company_id == req.buyer_company_id:
        raise HTTPException(400, "البائع والمشتري يجب أن يكونا شركتين مختلفتين")
    _year_of(req.elimination_date, req.fiscal_year)
    sale_amt = round(float(req.sale_amount), 2)
    cost_amt = round(float(req.cost_amount), 2)
    if sale_amt <= 0 or cost_amt < 0:
        raise HTTPException(400, "مبلغ البيع يجب أن يكون أكبر من صفر والتكلفة لا تقل عن صفر")
    if not 0 <= float(req.ending_inventory_pct) <= 100:
        raise HTTPException(400, "نسبة البضاعة المتبقية بين 0 و 100")

    elim_id    = str(uuid.uuid4())
    margin     = round(sale_amt - cost_amt, 2)
    margin_pct = round(margin / sale_amt * 100, 2)
    inv_pct    = float(req.ending_inventory_pct) / 100
    unrealized = round(margin * inv_pct, 2)
    seller, buyer = _name(group, req.seller_company_id), _name(group, req.buyer_company_id)

    lines_a = list(await asyncio.gather(
        je_line(company_id, ACC["revenue"], debit=sale_amt, desc=f"استبعاد إيرادات بينية — {seller} → {buyer}"),
        je_line(company_id, ACC["cogs"], credit=sale_amt, desc=f"استبعاد مشتريات بينية — {buyer}"),
    ))
    je_a_id = await record_consolidation_entry(company_id, current_user["user_id"], req.elimination_date,
        f"استبعاد معاملة بينية — {seller} → {buyer}", lines_a, elim_id, req.group_id, req.fiscal_year)

    # Unrealised profit used to be charged to 213 retained earnings. That is
    # only right for PRIOR-year profit in opening inventory; this year's
    # unrealised profit belongs in this year's cost of sales.
    je_b_id, lines_b = None, []
    if unrealized > 0:
        lines_b = list(await asyncio.gather(
            je_line(company_id, ACC["cogs"], debit=unrealized,
                    desc=f"أرباح غير محققة في مخزون {buyer} ({req.ending_inventory_pct:.0f}% × هامش {margin_pct:.1f}%)"),
            je_line(company_id, ACC["inventory"], credit=unrealized, desc="تخفيض المخزون بالأرباح غير المحققة"),
        ))
        je_b_id = await record_consolidation_entry(company_id, current_user["user_id"], req.elimination_date,
            f"أرباح غير محققة في المخزون البيني — {unrealized:,.2f}", lines_b, elim_id, req.group_id, req.fiscal_year)

    elim = {
        "id": elim_id, "group_id": req.group_id, "admin_company_id": company_id,
        "elimination_type": "intercompany_sales",
        "seller_company": req.seller_company_id, "buyer_company": req.buyer_company_id,
        "description": f"مبيعات بينية {seller} → {buyer}",
        "fiscal_year": req.fiscal_year, "date": req.elimination_date,
        "amount": sale_amt,
        "amounts": {"sale_amount": sale_amt, "cost_amount": cost_amt, "gross_margin": margin,
                    "margin_pct": margin_pct, "ending_inv_pct": req.ending_inventory_pct,
                    "unrealized_profit": unrealized},
        "journal_entries": {"elimination_je": je_a_id, "unrealized_je": je_b_id},
        "entry_ids": [i for i in (je_a_id, je_b_id) if i],
        "lines": lines_a + lines_b,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.elimination_entries.insert_one(dict(elim))
    return {"message": "✅ تم تسجيل استبعاد المعاملة البينية (ورقة عمل — لم يُرحَّل لأي دفتر)",
            "elimination": elim, "law": "المعيار المحاسبي المصري 42"}


@router.post("/eliminations/intercompany-balances")
async def eliminate_intercompany_balances(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    استبعاد الأرصدة الجارية البينية:
      من حـ/ 2301 جاري الشركات التابعة — دائن (في دفاتر الشركة المدينة بالمبلغ)
      إلى حـ/ 1361 جاري الشركات التابعة — مدين (في دفاتر الشركة الدائنة)
    المبلغ لا يتجاوز الأقل من الرصيدين المسجلين فعلاً، ويُظهر الفرق إن وُجد.
    """
    company_id = current_user["company_id"]
    group_id   = data.get("group_id") or ""
    group      = await _holding_group(group_id, company_id)
    co_a = data.get("company_a_id") or ""   # holds the receivable (1361)
    co_b = data.get("company_b_id") or ""   # holds the payable (2301)
    _check_member(group, co_a, "الشركة الدائنة (لها الرصيد المدين 1361)")
    _check_member(group, co_b, "الشركة المدينة (عليها الرصيد الدائن 2301)")
    if co_a == co_b:
        raise HTTPException(400, "اختر شركتين مختلفتين")
    try:
        year = int(data.get("fiscal_year") or date.today().year)
    except (TypeError, ValueError):
        raise HTTPException(400, "السنة المالية غير صحيحة")
    date_str = str(data.get("date") or f"{year}-12-31")[:10]
    _year_of(date_str, year)

    # Balance-sheet accounts are cumulative: everything up to the elimination date.
    ar = round(await get_account_balance(co_a, ACC["interco_ar"], "0000-01-01", date_str), 2)
    ap = round(-await get_account_balance(co_b, ACC["interco_ap"], "0000-01-01", date_str), 2)
    max_elim = round(max(min(ar, ap), 0), 2)
    try:
        amount = round(float(data.get("amount")), 2) if data.get("amount") not in (None, "") else max_elim
    except (TypeError, ValueError):
        raise HTTPException(400, "المبلغ يجب أن يكون رقماً")
    if amount <= 0:
        raise HTTPException(400, f"لا يوجد رصيد بيني يمكن استبعاده (1361 لدى الدائنة {ar:,.2f} / 2301 لدى المدينة {ap:,.2f})")
    # The amount came from the request with no check, so a typo removed more
    # than either company actually recorded and the consolidated balance
    # sheet showed a negative intercompany balance.
    if amount > max_elim + 0.01:
        raise HTTPException(400, f"المبلغ {amount:,.2f} أكبر من الرصيد المسجل: 1361 لدى الدائنة {ar:,.2f} و2301 لدى المدينة {ap:,.2f}")
    dup = await db.elimination_entries.find_one({
        "group_id": group_id, "fiscal_year": year, "elimination_type": "intercompany_balances",
        "company_a_id": co_a, "company_b_id": co_b}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(409, "يوجد استبعاد مسجل لنفس الشركتين في هذه السنة — احذفه أولاً إن أردت تعديله")

    na, nb = _name(group, co_a), _name(group, co_b)
    lines = list(await asyncio.gather(
        je_line(company_id, ACC["interco_ap"], debit=amount, desc=f"استبعاد دائنية {nb} تجاه {na}"),
        je_line(company_id, ACC["interco_ar"], credit=amount, desc=f"استبعاد مديونية {nb} لدى {na}"),
    ))
    elim_id = str(uuid.uuid4())
    je_id = await record_consolidation_entry(company_id, current_user["user_id"], date_str,
        f"استبعاد حسابات جارية بينية — {na} / {nb}", lines, elim_id, group_id, year)

    elim = {
        "id": elim_id, "group_id": group_id, "admin_company_id": company_id,
        "elimination_type": "intercompany_balances",
        "company_a_id": co_a, "company_b_id": co_b,
        "description": f"أرصدة جارية {na} / {nb}",
        "amount": amount, "fiscal_year": year, "date": date_str,
        "reconciliation": {"receivable_1361": ar, "payable_2301": ap, "difference": round(ar - ap, 2)},
        "journal_entry_id": je_id, "entry_ids": [je_id], "lines": lines,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.elimination_entries.insert_one(dict(elim))
    diff = round(ar - ap, 2)
    return {
        "message": f"✅ تم استبعاد الأرصدة البينية {amount:,.2f} ج.م",
        "warning": (f"الرصيدان غير متطابقين (فرق {diff:,.2f}) — راجع البنود في الطريق قبل إقفال التجميع"
                    if abs(diff) > 0.01 else None),
        "elimination": elim,
    }


@router.post("/eliminations/nci")
async def calculate_nci(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    إثبات حقوق الأقلية — المعيار 42: حصة الأقلية = نسبة الأقلية × صافي أصول التابعة
      من حـ/ 213 الأرباح المرحلة (إعادة تبويب من حقوق الملكية)
      إلى حـ/ 2141 حقوق الأقلية
    نسبة الأقلية تؤخذ من هيكل المجموعة؛ صافي الأصول يُحسب من دفاتر التابعة إن لم يُدخَل.
    """
    company_id = current_user["company_id"]
    group_id   = data.get("group_id") or ""
    group      = await _holding_group(group_id, company_id)
    sub_co_id  = data.get("subsidiary_company_id") or ""
    sub = _sub_of(group, sub_co_id)
    if not sub:
        raise HTTPException(400, "الشركة التابعة ليست ضمن المجموعة")
    _check_member(group, sub_co_id, "الشركة التابعة")
    try:
        year = int(data.get("fiscal_year") or date.today().year)
    except (TypeError, ValueError):
        raise HTTPException(400, "السنة المالية غير صحيحة")
    date_str = str(data.get("date") or f"{year}-12-31")[:10]
    _year_of(date_str, year)
    # nci_pct came from the request; it is a fact of the group structure.
    nci_pct  = float(sub.get("nci_pct", 0))
    sub_name = sub.get("company_name") or "شركة تابعة"
    if nci_pct <= 0:
        raise HTTPException(400, "الشركة مملوكة بالكامل — لا توجد حقوق أقلية")

    # equity (credit balances of 21x except NCI itself) + this year's result
    # 221 (legal & general reserve) is equity although it sits under 22
    equity = -(await get_account_balance(sub_co_id, "21", "0000-01-01", date_str)
               + await get_account_balance(sub_co_id, "221", "0000-01-01", date_str))
    nci_in_books = -await get_account_balance(sub_co_id, ACC["nci_equity"], "0000-01-01", date_str)
    pnl = -(await get_account_balance(sub_co_id, "4", f"{year}-01-01", date_str)
            + await get_account_balance(sub_co_id, "3", f"{year}-01-01", date_str))
    computed_net_assets = round(equity - nci_in_books + pnl, 2)
    try:
        net_assets = round(float(data["net_assets"]), 2) if data.get("net_assets") not in (None, "") else computed_net_assets
        net_income = round(float(data["net_income"]), 2) if data.get("net_income") not in (None, "") else round(pnl, 2)
    except (TypeError, ValueError):
        raise HTTPException(400, "صافي الأصول/الدخل يجب أن يكون رقماً")
    dup = await db.elimination_entries.find_one({
        "group_id": group_id, "fiscal_year": year, "elimination_type": "nci",
        "subsidiary_company_id": sub_co_id}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(409, "حقوق الأقلية لهذه الشركة مسجلة لهذه السنة — احذفها أولاً إن أردت تعديلها")

    nci_assets = round(net_assets * nci_pct / 100, 2)
    nci_income = round(net_income * nci_pct / 100, 2)
    elim_id = str(uuid.uuid4())
    je_id, lines = None, []
    if nci_assets > 0:
        lines = list(await asyncio.gather(
            je_line(company_id, ACC["retained"], debit=nci_assets,
                    desc=f"حصة الأقلية في صافي أصول {sub_name} ({nci_pct}%)"),
            je_line(company_id, ACC["nci_equity"], credit=nci_assets, desc=f"حقوق الأقلية — {sub_name}"),
        ))
        je_id = await record_consolidation_entry(company_id, current_user["user_id"], date_str,
            f"إثبات حقوق الأقلية — {sub_name} {nci_pct}%", lines, elim_id, group_id, year)

    nci_rec = {
        "id": elim_id, "group_id": group_id, "admin_company_id": company_id,
        "elimination_type": "nci", "subsidiary_company_id": sub_co_id,
        "subsidiary": sub_name, "description": f"حقوق الأقلية — {sub_name}",
        "nci_pct": nci_pct, "parent_pct": round(100 - nci_pct, 2),
        "net_assets": net_assets, "net_assets_source": "manual" if data.get("net_assets") not in (None, "") else "books",
        "net_income": net_income, "nci_in_assets": nci_assets, "nci_in_income": nci_income,
        "amount": nci_assets, "fiscal_year": year, "date": date_str,
        "journal_entry_id": je_id, "entry_ids": [je_id] if je_id else [], "lines": lines,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.elimination_entries.insert_one(dict(nci_rec))
    return {
        "message": f"✅ تم إثبات حقوق الأقلية — {sub_name}",
        "nci_calculation": {"subsidiary": sub_name, "minority_pct": nci_pct,
                            "net_assets": net_assets, "computed_net_assets": computed_net_assets,
                            "nci_in_assets": nci_assets, "net_income": net_income, "nci_in_income": nci_income},
        "record": nci_rec,
    }


@router.delete("/eliminations/{elim_id}")
async def delete_elimination(elim_id: str, current_user: dict = Depends(get_current_user)):
    """حذف استبعاد خاطئ — ورقة عمل التجميع فقط، لا يمس دفاتر أي شركة"""
    company_id = current_user["company_id"]
    e = await db.elimination_entries.find_one({"id": elim_id, "admin_company_id": company_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "الاستبعاد غير موجود")
    await db.consolidation_entries.delete_many({"company_id": company_id, "group_ref": elim_id})
    await db.elimination_entries.delete_one({"id": elim_id, "admin_company_id": company_id})
    return {"message": "تم حذف الاستبعاد من أوراق العمل"}


# ══════════════════════════════════════════════════════════════
# 4. CONSOLIDATION WORKSHEET — ورقة عمل التجميع
# ══════════════════════════════════════════════════════════════

@router.get("/worksheet/{group_id}")
async def consolidation_worksheet(
    group_id:  str,
    year:      int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """الشركات + الاستبعادات (مدين/دائن) + العمود المجمَّع"""
    company_id = current_user["company_id"]
    group = await _holding_group(group_id, company_id)
    df, dt = f"{year}-01-01", f"{year}-12-31"

    subsidiaries = [s for s in group.get("subsidiaries", []) if _is_member(s)]
    all_companies = _member_ids(group)
    company_columns = {co: await _company_balances(co, df, dt) for co in all_companies}
    all_account_codes = set().union(*[set(c) for c in company_columns.values()]) if company_columns else set()

    elims = await db.elimination_entries.find(
        {"group_id": group_id, "fiscal_year": year, "admin_company_id": company_id}, {"_id": 0}
    ).to_list(None)

    # The worksheet rebuilt eliminations from one "amount" per record: the
    # unrealised-profit entry and every NCI entry were ignored, and sales
    # eliminations were rebuilt on 411/311 whatever had been recorded. It now
    # applies the balanced lines actually recorded for each elimination.
    elim_dr: dict = {}
    elim_cr: dict = {}
    elim_names: dict = {}
    for e in elims:
        lines = e.get("lines")
        if lines is None:
            ids = e.get("entry_ids") or [i for i in (
                e.get("journal_entry_id"), *(e.get("journal_entries") or {}).values()) if i]
            lines = [l for ce in await db.consolidation_entries.find(
                {"company_id": company_id, "id": {"$in": ids}}, {"_id": 0, "lines": 1}).to_list(None)
                for l in ce.get("lines", [])]
        for l in lines:
            code = l.get("account_code")
            elim_dr[code] = round(elim_dr.get(code, 0) + float(l.get("debit") or 0), 2)
            elim_cr[code] = round(elim_cr.get(code, 0) + float(l.get("credit") or 0), 2)
            elim_names.setdefault(code, l.get("account_name", ""))

    all_account_codes |= set(elim_dr) | set(elim_cr)

    worksheet = []
    consolidated_dr = consolidated_cr = 0.0
    for code in sorted(all_account_codes):
        row = {"account_code": code, "companies": {}}
        sum_dr = sum_cr = 0.0
        for co_id in all_companies:
            col = company_columns.get(co_id, {}).get(code, {"debit": 0, "credit": 0, "name": ""})
            row["companies"][co_id] = {"debit": col["debit"], "credit": col["credit"]}
            if col.get("name") and not row.get("account_name"):
                row["account_name"] = col["name"]
            sum_dr += col["debit"]; sum_cr += col["credit"]
        row.setdefault("account_name", elim_names.get(code, ""))
        e_dr = elim_dr.get(code, 0); e_cr = elim_cr.get(code, 0)
        net = round((sum_dr + e_dr) - (sum_cr + e_cr), 2)
        cons_dr = net if net > 0 else 0.0
        cons_cr = -net if net < 0 else 0.0
        row["combined"]     = {"debit": round(sum_dr, 2), "credit": round(sum_cr, 2)}
        row["eliminations"] = {"debit": e_dr, "credit": e_cr}
        row["consolidated"] = {"debit": cons_dr, "credit": cons_cr}
        worksheet.append(row)
        consolidated_dr += cons_dr; consolidated_cr += cons_cr

    tot_edr = round(sum(elim_dr.values()), 2); tot_ecr = round(sum(elim_cr.values()), 2)
    names = {group["holding_company_id"]: "الشركة القابضة",
             **{s["company_id"]: s.get("company_name", "") for s in subsidiaries}}
    return {
        "group_name":    group["group_name"],
        "fiscal_year":   year,
        "companies":     all_companies,
        "company_names": names,
        "subsidiaries":  [{"id": s["company_id"], "name": s.get("company_name", ""),
                           "ownership": s["ownership_pct"], "nci": s["nci_pct"]} for s in subsidiaries],
        "pending_subsidiaries": [s.get("company_name") for s in group.get("subsidiaries", [])
                                 if s.get("link_status", "pending") != "accepted"],
        "worksheet":     worksheet,
        "totals": {
            "eliminations_debit":   tot_edr,
            "eliminations_credit":  tot_ecr,
            "eliminations_balanced": abs(tot_edr - tot_ecr) < 0.01,
            "consolidated_debit":   round(consolidated_dr, 2),
            "consolidated_credit":  round(consolidated_cr, 2),
            "balanced":             abs(consolidated_dr - consolidated_cr) < 1.0,
        },
        "eliminations_applied": len(elims),
        "standard": "المعيار المحاسبي المصري 42 — القوائم المالية المجمعة",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/eliminations/{group_id}")
async def list_eliminations(
    group_id:    str,
    fiscal_year: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """قائمة قيود الاستبعاد المسجلة لمجموعة وسنة محددة"""
    elims = await db.elimination_entries.find(
        {"group_id": group_id, "fiscal_year": fiscal_year,
         "admin_company_id": current_user["company_id"]},
        {"_id": 0}
    ).sort("date", -1).to_list(None)
    return {
        "group_id":    group_id,
        "fiscal_year": fiscal_year,
        "eliminations": elims,
        "count":       len(elims),
        "types": {t: sum(1 for e in elims if e.get("elimination_type") == t)
                  for t in ("intercompany_sales", "intercompany_balances", "nci")},
    }
