"""
Consolidation Engine — محرك التجميع المالي
المعيار المحاسبي المصري رقم 42 (EAS 42 / IFRS 10)

القوائم المالية المجمعة لمجموعة الشركات (Holding & Subsidiaries):

1. هيكل المجموعة (Company Group Structure)
2. الميزان المجمع (Consolidated Trial Balance)
3. قيود الاستبعاد الآلية (Automatic Elimination Entries):
   أ. استبعاد المبيعات والمشتريات البينية
   ب. استبعاد الأرباح غير المحققة في المخزون
   ج. استبعاد الحسابات الجارية المدينة والدائنة
   د. إثبات حقوق الأقلية (NCI)
4. ورقة عمل التجميع (Consolidation Worksheet)
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/consolidation", tags=["Consolidation EAS42"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "interco_ar":      "1361",  # ح.ج مدينة — شركات تابعة
    "interco_ap":      "2301",  # ح.ج دائنة — شركات تابعة
    "nci_equity":      "2141",  # حقوق الأقلية NCI
    "unrealized_prof": "4301",  # أرباح غير محققة — مخزون
    "revenue_elim":    "3501",  # استبعاد إيرادات بينية
    "cogs_elim":       "3502",  # استبعاد مشتريات بينية
    "revenue":         "411",
    "cogs":            "311",
    "inventory":       "121",
    "retained":        "213",
    "bank":            "112",
}


async def get_acc(company_id: str, code: str) -> dict:
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit": round(debit, 2), "credit": round(credit, 2),
        "description": desc,
    }


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None) -> str:
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="manual", source_document_id=src_id,
        created_by=user_id,
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], user_id)
    return result["id"]


async def get_account_balance(
    company_id: str, account_prefix: str,
    date_from: str, date_to: str
) -> float:
    """Sum net (debit - credit) for account prefix in period"""
    pipeline = [
        {"$match": {"company_id": company_id, "status": "posted",
                    "entry_date": {"$gte": date_from, "$lte": date_to}}},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": {"$regex": f"^{account_prefix}"}}},
        {"$group": {"_id": None,
                    "debit":  {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"}}},
    ]
    r = await db.journal_entries.aggregate(pipeline).to_list(1)
    if not r: return 0.0
    return round(float(r[0]["debit"]) - float(r[0]["credit"]), 2)


# ══════════════════════════════════════════════════════════════
# 1. COMPANY GROUP STRUCTURE — هيكل المجموعة
# ══════════════════════════════════════════════════════════════

class CompanyGroupRequest(BaseModel):
    group_name:       str
    holding_company_id: str
    subsidiaries: List[dict]
    # [{company_id, company_name, ownership_pct, acquisition_date}]
    fiscal_year:  int
    notes:        Optional[str] = None


@router.post("/groups")
async def create_company_group(
    req: CompanyGroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    تعريف هيكل مجموعة الشركات (Holding + Subsidiaries)

    يحدد:
    - نسبة الملكية لكل شركة تابعة
    - حقوق الأقلية = 100% - نسبة الملكية
    """
    group_id = str(uuid.uuid4())

    # Enrich subsidiaries with NCI percentage
    enriched = []
    for sub in req.subsidiaries:
        ownership = float(sub.get("ownership_pct", 100))
        nci_pct   = round(100 - ownership, 2)
        enriched.append({
            **sub,
            "ownership_pct": ownership,
            "nci_pct":       nci_pct,
            "consolidated":  ownership > 50,  # Majority = consolidate
            "method": (
                "full_consolidation"  if ownership > 50   else
                "equity_method"       if ownership >= 20  else
                "fair_value"
            ),
        })

    group = {
        "id":                 group_id,
        "admin_company_id":   current_user["company_id"],
        "group_name":         req.group_name,
        "holding_company_id": req.holding_company_id,
        "subsidiaries":       enriched,
        "fiscal_year":        req.fiscal_year,
        "notes":              req.notes,
        "created_by":         current_user["user_id"],
        "created_at":         datetime.now(timezone.utc).isoformat(),
    }
    await db.company_groups.insert_one(group)
    group.pop("_id", None)

    return {
        "message":    f"تم تعريف مجموعة '{req.group_name}'",
        "group_id":   group_id,
        "group":      group,
        "subsidiaries_summary": [
            {"name": s.get("company_name",""),
             "ownership": s["ownership_pct"],
             "nci": s["nci_pct"],
             "method": s["method"]}
            for s in enriched
        ],
    }


@router.get("/groups")
async def list_company_groups(current_user: dict = Depends(get_current_user)):
    groups = await db.company_groups.find(
        {"admin_company_id": current_user["company_id"]},
        {"_id": 0}
    ).to_list(None)
    return {"groups": groups, "total": len(groups)}


# ══════════════════════════════════════════════════════════════
# 2. CONSOLIDATED TRIAL BALANCE — الميزان المجمع
# ══════════════════════════════════════════════════════════════

@router.get("/trial-balance/{group_id}")
async def consolidated_trial_balance(
    group_id:  str,
    year:      int = Query(...),
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    الميزان التجريبي المجمع لمجموعة الشركات

    1. اسحب أرصدة كل شركة تابعة
    2. اجمعها سطراً سطراً حسب كود الحساب
    3. احسب الاستبعادات
    4. اعرض النتيجة المجمعة بعد الاستبعادات
    """
    df = date_from or f"{year}-01-01"
    dt = date_to   or f"{year}-12-31"

    group = await db.company_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(404, "المجموعة غير موجودة")

    # Collect all company IDs in group
    all_companies = [group["holding_company_id"]] + [
        s["company_id"] for s in group.get("subsidiaries", [])
        if s.get("consolidated", True)
    ]

    # Aggregate balances per account across all companies
    combined: dict = {}  # account_code → {debit, credit, net}

    for co_id in all_companies:
        pipeline = [
            {"$match": {"company_id": co_id, "status": "posted",
                        "entry_date": {"$gte": df, "$lte": dt}}},
            {"$unwind": "$lines"},
            {"$group": {
                "_id": "$lines.account_code",
                "debit":  {"$sum": "$lines.debit"},
                "credit": {"$sum": "$lines.credit"},
                "name":   {"$last": "$lines.account_name"},
            }},
        ]
        rows = await db.journal_entries.aggregate(pipeline).to_list(None)
        for row in rows:
            code = row["_id"]
            if not code: continue
            if code not in combined:
                combined[code] = {"account_code": code,
                                  "account_name": row.get("name",""),
                                  "debit": 0.0, "credit": 0.0}
            combined[code]["debit"]  += float(row["debit"])
            combined[code]["credit"] += float(row["credit"])

    # Round and compute net
    lines_out = []
    total_dr = total_cr = 0.0
    for code, data in sorted(combined.items()):
        dr = round(data["debit"],  2)
        cr = round(data["credit"], 2)
        total_dr += dr; total_cr += cr
        lines_out.append({**data, "debit": dr, "credit": cr,
                          "net": round(dr - cr, 2)})

    # Fetch pending eliminations for this group/year
    elims = await db.elimination_entries.find(
        {"group_id": group_id, "fiscal_year": year}, {"_id": 0}
    ).to_list(None)
    total_elim = round(sum(float(e.get("amount",0)) for e in elims), 2)

    return {
        "group_name":    group["group_name"],
        "fiscal_year":   year,
        "period":        {"from": df, "to": dt},
        "companies":     all_companies,
        "trial_balance": lines_out,
        "totals": {
            "total_debit":  round(total_dr, 2),
            "total_credit": round(total_cr, 2),
            "balanced":     abs(total_dr - total_cr) < 1.0,
        },
        "eliminations": {
            "count":  len(elims),
            "total":  total_elim,
            "detail": elims,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 3. ELIMINATION ENTRIES — قيود الاستبعاد الآلية
# ══════════════════════════════════════════════════════════════

class IntercompanySaleRequest(BaseModel):
    """معاملة بيع بيني تحتاج استبعاداً"""
    group_id:         str
    seller_company_id: str
    buyer_company_id:  str
    fiscal_year:       int
    sale_amount:       float   # إجمالي المبيعات البينية
    cost_amount:       float   # تكلفة البضاعة البينية (عند البائع)
    ending_inventory_pct: float = 0.0  # % من البضاعة لا تزال عند المشتري
    elimination_date:  str


@router.post("/eliminations/intercompany-sales")
async def eliminate_intercompany_sales(
    req: IntercompanySaleRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    استبعاد المبيعات والمشتريات البينية + الأرباح غير المحققة

    القيد أ — استبعاد المعاملة البينية:
    Dr م/3501 استبعاد إيرادات مبيعات بينية  (رصيد الإيرادات)
    Cr م/3502 استبعاد تكلفة مشتريات بينية  (رصيد التكلفة)

    القيد ب — استبعاد الأرباح غير المحققة في المخزون:
    Dr م/4301 أرباح وخسائر (تسوية أرباح غير محققة)
    Cr م/121 مخزون البضاعة (تخفيض بقدر هامش الربح البيني)
    """
    company_id = current_user["company_id"]
    elim_id    = str(uuid.uuid4())

    sale_amt   = float(req.sale_amount)
    cost_amt   = float(req.cost_amount)
    margin     = round(sale_amt - cost_amt, 2)
    margin_pct = round(margin / sale_amt * 100, 2) if sale_amt > 0 else 0

    # Unrealized profit = margin on goods still in buyer's inventory
    inv_pct       = float(req.ending_inventory_pct) / 100
    unrealized    = round(margin * inv_pct, 2)
    realized_cogs = round(cost_amt * (1 - inv_pct), 2)

    # ── القيد أ: استبعاد كامل الإيراد مقابل كامل التكلفة ────
    # EAS 42: حذف الإيراد البيني كاملاً مقابل التكلفة الكاملة
    # (الفرق = هامش الربح يُزال في القيد ب)
    lines_a = await asyncio.gather(
        je_line(company_id, ACC["revenue"], debit=sale_amt,
                desc=f"استبعاد إيرادات بينية — {req.seller_company_id} → {req.buyer_company_id}"),
        je_line(company_id, ACC["cogs"], credit=sale_amt,
                desc=f"استبعاد تكلفة مشتريات بينية — {req.buyer_company_id} (مقابل الإيراد كاملاً)"),
    )
    je_a_id = await post_je(company_id, current_user["user_id"],
        req.elimination_date,
        f"استبعاد معاملة بينية — {req.seller_company_id} → {req.buyer_company_id}",
        list(lines_a), elim_id)

    # ── القيد ب: استبعاد الأرباح غير المحققة في المخزون ──────
    # من حـ/ أرباح وخسائر (تسوية أرباح غير محققة)
    # إلى حـ/ مخزون البضاعة (تخفيض هامش الربح البيني المحتجز)
    je_b_id = None
    if unrealized > 0:
        lines_b = await asyncio.gather(
            je_line(company_id, ACC["retained"], debit=unrealized,
                    desc=f"تسوية أرباح غير محققة في المخزون ({req.ending_inventory_pct:.0f}% × هامش {margin_pct:.1f}%)"),
            je_line(company_id, ACC["inventory"], credit=unrealized,
                    desc=f"تخفيض المخزون بقدر الأرباح غير المحققة — {unrealized:,.2f}"),
        )
        je_b_id = await post_je(company_id, current_user["user_id"],
            req.elimination_date,
            f"أرباح غير محققة في المخزون البيني — {unrealized:,.2f}",
            list(lines_b), elim_id)

    # Save elimination record
    elim = {
        "id":               elim_id,
        "group_id":         req.group_id,
        "admin_company_id": company_id,
        "elimination_type": "intercompany_sales",
        "seller_company":   req.seller_company_id,
        "buyer_company":    req.buyer_company_id,
        "fiscal_year":      req.fiscal_year,
        "date":             req.elimination_date,
        "amounts": {
            "sale_amount":      sale_amt,
            "cost_amount":      cost_amt,
            "gross_margin":     margin,
            "margin_pct":       margin_pct,
            "ending_inv_pct":   req.ending_inventory_pct,
            "unrealized_profit": unrealized,
            "realized_cogs":    realized_cogs,
        },
        "journal_entries": {"elimination_je": je_a_id, "unrealized_je": je_b_id},
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.elimination_entries.insert_one(elim); elim.pop("_id", None)

    td_a = round(sum(l["debit"] for l in list(lines_a)), 2)
    tc_a = round(sum(l["credit"] for l in list(lines_a)), 2)

    return {
        "message":    "✅ تم استبعاد المعاملة البينية",
        "elimination": elim,
        "journal_a": {
            "id":      je_a_id,
            "debit":   f"م/{ACC['revenue']} إيرادات بينية  {sale_amt:,.2f}",
            "credit":  f"م/{ACC['cogs']} تكلفة بينية  {sale_amt:,.2f}",
            "note":    "استبعاد كامل الإيراد مقابل كامل التكلفة — EAS 42",
            "balanced": True,
        },
        "journal_b": {
            "id":     je_b_id,
            "debit":  f"م/{ACC['retained']} أرباح وخسائر  {unrealized:,.2f}",
            "credit": f"م/{ACC['inventory']} مخزون (تخفيض)  {unrealized:,.2f}",
            "note":   f"أرباح غير محققة = هامش {margin_pct:.1f}% × {inv_pct*100:.0f}% بضاعة آخر المدة",
        } if unrealized > 0 else None,
        "law": "المعيار المحاسبي المصري 42 — استبعاد المعاملات البينية",
    }


@router.post("/eliminations/intercompany-balances")
async def eliminate_intercompany_balances(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    استبعاد الحسابات الجارية البينية (AR/AP Elimination)

    الشركة أ لها مديونية على الشركة ب:
    Dr م/2301 ح.ج دائنة — شركات تابعة  (من جانب الشركة الدائنة)
    Cr م/1361 ح.ج مدينة — شركات تابعة  (من جانب الشركة المدينة)

    الصافي بعد الاستبعاد = صفر (لا تظهر في القائمة المجمعة)
    """
    company_id = current_user["company_id"]
    amount     = float(data.get("amount", 0))
    date_str   = data.get("date", date.today().isoformat())
    group_id   = data.get("group_id","")
    co_a       = data.get("company_a_name","الشركة أ")
    co_b       = data.get("company_b_name","الشركة ب")

    lines = await asyncio.gather(
        je_line(company_id, ACC["interco_ap"], debit=amount,
                desc=f"استبعاد ح.ج دائنة — {co_a} تجاه {co_b}"),
        je_line(company_id, ACC["interco_ar"], credit=amount,
                desc=f"استبعاد ح.ج مدينة — {co_b} من {co_a}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"استبعاد حسابات جارية بينية — {co_a} / {co_b}", list(lines))

    elim = {
        "id":               str(uuid.uuid4()),
        "group_id":         group_id,
        "admin_company_id": company_id,
        "elimination_type": "intercompany_balances",
        "amount":           amount,
        "fiscal_year":      data.get("fiscal_year", date.today().year),
        "date":             date_str,
        "journal_entry_id": je_id,
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }
    await db.elimination_entries.insert_one(elim); elim.pop("_id", None)

    return {
        "message": f"✅ تم استبعاد الحسابات الجارية البينية {amount:,.2f} ج.م",
        "journal": {
            "id":     je_id,
            "debit":  f"م/{ACC['interco_ap']} ح.ج دائنة بينية  {amount:,.2f}",
            "credit": f"م/{ACC['interco_ar']} ح.ج مدينة بينية  {amount:,.2f}",
            "result": "الرصيد صفر — لا يظهر في القائمة المجمعة ✅",
        },
        "elimination": elim,
    }


@router.post("/eliminations/nci")
async def calculate_nci(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    إثبات حقوق الأقلية (Non-Controlling Interest — NCI)
    المعيار 42: حصة الأقلية = NCI% × صافي أصول الشركة التابعة

    القيد:
    Dr م/2141 حقوق الأقلية (ضمن حقوق الملكية المجمعة)
    Cr حصة الأقلية في صافي الدخل / الأصول

    تُثبَّت في القائمة المجمعة بشكل مستقل عن حقوق المساهمين الرئيسيين
    """
    company_id  = current_user["company_id"]
    group_id    = data.get("group_id","")
    sub_co_id   = data.get("subsidiary_company_id","")
    sub_name    = data.get("subsidiary_name","شركة تابعة")
    nci_pct     = float(data.get("nci_pct", 0))  # e.g. 30 for 30%
    net_assets  = float(data.get("net_assets", 0))
    net_income  = float(data.get("net_income", 0))
    date_str    = data.get("date", date.today().isoformat())
    year        = data.get("fiscal_year", date.today().year)

    nci_assets  = round(net_assets * nci_pct / 100, 2)
    nci_income  = round(net_income * nci_pct / 100, 2)

    je_id = None
    if nci_assets > 0:
        lines = await asyncio.gather(
            je_line(company_id, "213", debit=nci_assets,
                    desc=f"حصة الأقلية في صافي أصول {sub_name} ({nci_pct}%)"),
            je_line(company_id, ACC["nci_equity"], credit=nci_assets,
                    desc=f"حقوق الأقلية (NCI) — {sub_name}"),
        )
        je_id = await post_je(company_id, current_user["user_id"], date_str,
            f"إثبات حقوق الأقلية — {sub_name} {nci_pct}%", list(lines))

    nci_rec = {
        "id":               str(uuid.uuid4()),
        "group_id":         group_id,
        "admin_company_id": company_id,
        "elimination_type": "nci",
        "subsidiary":       sub_name,
        "nci_pct":          nci_pct,
        "parent_pct":       round(100 - nci_pct, 2),
        "net_assets":       net_assets,
        "net_income":       net_income,
        "nci_in_assets":    nci_assets,
        "nci_in_income":    nci_income,
        "fiscal_year":      year,
        "date":             date_str,
        "journal_entry_id": je_id,
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }
    await db.elimination_entries.insert_one(nci_rec); nci_rec.pop("_id", None)

    return {
        "message": f"✅ تم إثبات حقوق الأقلية — {sub_name}",
        "nci_calculation": {
            "subsidiary":     sub_name,
            "parent_owns":    f"{100-nci_pct:.0f}%",
            "minority_owns":  f"{nci_pct:.0f}%",
            "net_assets":     net_assets,
            "nci_in_assets":  nci_assets,
            "net_income":     net_income,
            "nci_in_income":  nci_income,
        },
        "journal": {
            "id":     je_id,
            "debit":  f"م/213 أرباح محتجزة  {nci_assets:,.2f}",
            "credit": f"م/{ACC['nci_equity']} حقوق الأقلية (NCI)  {nci_assets:,.2f}",
        } if je_id else None,
        "disclosure": f"تُعرَض حقوق الأقلية ({nci_assets:,.2f} ج.م) "
                      "بشكل مستقل ضمن حقوق الملكية في القائمة المجمعة",
        "record": nci_rec,
    }


# ══════════════════════════════════════════════════════════════
# 4. CONSOLIDATION WORKSHEET — ورقة عمل التجميع
# ══════════════════════════════════════════════════════════════

@router.get("/worksheet/{group_id}")
async def consolidation_worksheet(
    group_id:  str,
    year:      int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    ورقة عمل التجميع الكاملة — EAS 42

    العمود 1: الشركة القابضة
    العمود 2-N: الشركات التابعة
    العمود الاستبعادات: Dr / Cr
    العمود المجمَّع: الناتج النهائي
    """
    df = f"{year}-01-01"
    dt = f"{year}-12-31"

    group = await db.company_groups.find_one({"id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(404, "المجموعة غير موجودة")

    subsidiaries = [s for s in group.get("subsidiaries",[]) if s.get("consolidated")]
    all_companies = [group["holding_company_id"]] + [s["company_id"] for s in subsidiaries]

    # Get balances for each company
    company_columns = {}
    all_account_codes = set()

    for co_id in all_companies:
        pipeline = [
            {"$match": {"company_id": co_id, "status": "posted",
                        "entry_date": {"$gte": df, "$lte": dt}}},
            {"$unwind": "$lines"},
            {"$group": {"_id": {"code":"$lines.account_code","name":"$lines.account_name"},
                        "debit":  {"$sum": "$lines.debit"},
                        "credit": {"$sum": "$lines.credit"}}},
        ]
        rows = await db.journal_entries.aggregate(pipeline).to_list(None)
        col_data = {}
        for row in rows:
            code = row["_id"]["code"]
            if not code: continue
            all_account_codes.add(code)
            col_data[code] = {
                "name":   row["_id"].get("name",""),
                "debit":  round(float(row["debit"]),  2),
                "credit": round(float(row["credit"]), 2),
            }
        company_columns[co_id] = col_data

    # Get eliminations
    elims = await db.elimination_entries.find(
        {"group_id": group_id, "fiscal_year": year}, {"_id": 0}
    ).to_list(None)

    elim_dr: dict = {}  # code → amount
    elim_cr: dict = {}

    for elim in elims:
        amount = float(elim.get("amount", elim.get("amounts",{}).get("sale_amount",0) or 0))
        etype  = elim.get("elimination_type","")
        if etype == "intercompany_balances":
            elim_dr[ACC["interco_ap"]] = elim_dr.get(ACC["interco_ap"],0) + amount
            elim_cr[ACC["interco_ar"]] = elim_cr.get(ACC["interco_ar"],0) + amount
        elif etype == "intercompany_sales":
            elim_dr[ACC["revenue"]]   = elim_dr.get(ACC["revenue"],0) + amount
            elim_cr[ACC["cogs"]]      = elim_cr.get(ACC["cogs"],0)   + amount

    # Build worksheet rows
    worksheet = []
    consolidated_dr = consolidated_cr = 0.0

    for code in sorted(all_account_codes):
        row = {"account_code": code, "companies": {}}
        sum_dr = sum_cr = 0.0

        for co_id in all_companies:
            col = company_columns.get(co_id, {}).get(code, {"debit":0,"credit":0,"name":""})
            row["companies"][co_id] = {"debit": col["debit"], "credit": col["credit"]}
            row.setdefault("account_name", col.get("name",""))
            sum_dr += col["debit"]; sum_cr += col["credit"]

        # Apply eliminations
        e_dr = elim_dr.get(code, 0)
        e_cr = elim_cr.get(code, 0)
        cons_dr = round(sum_dr - e_dr, 2)
        cons_cr = round(sum_cr - e_cr, 2)

        row["combined"]      = {"debit": round(sum_dr,2), "credit": round(sum_cr,2)}
        row["eliminations"]  = {"debit": e_dr, "credit": e_cr}
        row["consolidated"]  = {"debit": cons_dr, "credit": cons_cr}
        worksheet.append(row)
        consolidated_dr += cons_dr; consolidated_cr += cons_cr

    return {
        "group_name":    group["group_name"],
        "fiscal_year":   year,
        "companies":     all_companies,
        "subsidiaries":  [{"id": s["company_id"], "name": s.get("company_name",""),
                           "ownership": s["ownership_pct"], "nci": s["nci_pct"]}
                          for s in subsidiaries],
        "worksheet":     worksheet,
        "totals": {
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
        "types": {
            "intercompany_sales":    sum(1 for e in elims if e["elimination_type"]=="intercompany_sales"),
            "intercompany_balances": sum(1 for e in elims if e["elimination_type"]=="intercompany_balances"),
            "nci":                   sum(1 for e in elims if e["elimination_type"]=="nci"),
        },
    }
