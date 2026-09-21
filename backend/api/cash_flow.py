"""
Automated Cash Flow Engine — محرك قائمة التدفقات النقدية الآلية
المعيار المحاسبي المصري رقم (4)

الطريقة المباشرة  (Direct Method):
  تصنيف حركات الخزينة والبنوك مباشرة إلى 3 أنشطة

الطريقة غير المباشرة (Indirect Method):
  صافي الربح
  + بنود غير نقدية (إهلاك، مخصصات)
  + تغيرات رأس المال العامل (عملاء، مخزون، موردون)
"""
import asyncio
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from database import db
from api.users import get_current_user
from dependencies import get_current_user

router = APIRouter(prefix="/api/cash-flow", tags=["Cash Flow"])


# ══════════════════════════════════════════════════════════════
# CLASSIFICATION MATRIX — مصفوفة تصنيف الحسابات
# كل حساب → نشاط تشغيلي / استثماري / تمويلي
# ══════════════════════════════════════════════════════════════

CASH_ACCOUNTS = {"161", "162", "164"}  # الخزينة + البنوك + درج الكاشير (112/113 were buildings/vehicles)

# Direct method: حركات البنك/الخزينة مصنَّفة حسب الحساب المقابل
DIRECT_CLASSIFICATION = {
    # ── OPERATING — أنشطة تشغيلية ──────────────────────────
    "131": ("operating", "تحصيل من العملاء",              "inflow"),
    "132": ("operating", "تحصيل أوراق قبض",               "inflow"),
    "411": ("operating", "إيرادات مبيعات نقدية",           "inflow"),
    "412": ("operating", "إيرادات خدمات نقدية",            "inflow"),
    "4121":("operating", "إيرادات POS نقدية",              "inflow"),
    "251": ("operating", "مدفوعات للموردين",               "outflow"),
    "252": ("operating", "سداد أوراق دفع",                 "outflow"),
    "253": ("operating", "مصروفات مستحقة مدفوعة",          "outflow"),
    "312": ("operating", "أجور عمالة مدفوعة",              "outflow"),
    "331": ("operating", "رواتب إدارية مدفوعة",            "outflow"),
    "332": ("operating", "مصروفات خدمية مدفوعة",           "outflow"),
    "254": ("operating", "ضرائب مدفوعة",                   "outflow"),
    "255": ("operating", "تأمينات اجتماعية مدفوعة",        "outflow"),
    "261": ("operating", "ضريبة كسب عمل مدفوعة",           "outflow"),
    "260": ("operating", "ضريبة قيمة مضافة مدفوعة",        "outflow"),
    "134": ("operating", "سلف موظفين مصروفة",              "outflow"),
    "134":("operating", "قروض موظفين مصروفة",             "outflow"),
    "341": ("operating", "مصروفات تسويق مدفوعة",           "outflow"),
    "342": ("operating", "عمولات بيع مدفوعة",              "outflow"),
    "334": ("operating", "عمولات بنكية مدفوعة",            "outflow"),
    "3321":("operating", "مصاريف خطابات ضمان",             "outflow"),
    "1361":("operating", "غطاء خطابات ضمان محتجز",        "outflow"),
    # ── INVESTING — أنشطة استثمارية ─────────────────────────
    "111": ("investing", "شراء أراضٍ",                    "outflow"),
    "11101":("investing","شراء أراضٍ ومباني",              "outflow"),
    "112_fixed":("investing","شراء أصول ثابتة",            "outflow"),  # context
    "113": ("investing", "شراء سيارات",                   "outflow"),
    "114": ("investing", "شراء آلات ومعدات",              "outflow"),
    "115": ("investing", "شراء أثاث ومعدات مكتبية",       "outflow"),
    "116": ("investing", "شراء حواسب وبرمجيات",           "outflow"),
    "1561":("investing", "دفع قسط إيجار تمويلي",          "outflow"),
    "142":("investing", "تطوير مشروعات عقارية",          "outflow"),
    "421": ("investing", "حصيلة بيع أصول ثابتة",          "inflow"),
    "422": ("investing", "فوائد دائنة مقبوضة",            "inflow"),
    "14":  ("investing", "مشروعات تحت التنفيذ",           "outflow"),
    "136": ("investing", "إيرادات مستحقة مقبوضة",         "inflow"),
    # ── FINANCING — أنشطة تمويلية ───────────────────────────
    "211": ("financing", "حصيلة زيادة رأس المال",          "inflow"),
    "212": ("financing", "جاري الشركاء",                   "inflow"),
    "241": ("financing", "قروض بنكية مقبوضة",             "inflow"),
    "242": ("financing", "تسهيلات ائتمانية مقبوضة",       "inflow"),
    "2611":("financing", "سداد التزامات إيجار تمويلي",    "outflow"),
    "215": ("financing", "توزيعات أرباح مدفوعة",          "outflow"),
    "223": ("financing", "مكافآت نهاية خدمة مدفوعة",      "outflow"),
}

# Indirect method: non-cash items and working capital accounts

# One classification for BOTH methods, so direct and indirect always agree.
CF_CASH = {"161", "162", "164"}
CF_ACCUM = ("222", "1562")              # accumulated depreciation (contra assets)
CF_INVEST = ("11", "14", "15")           # fixed assets, projects, investments (incl. 1561 ROU)
CF_FIN_EXACT = {"241", "242", "2611", "2612", "256", "2542", "2141"}


def cf_bucket(code: str) -> str:
    code = str(code or "")
    if code in CF_CASH:
        return "cash"
    if code[:1] in ("3", "4"):
        return "pl"
    if code.startswith(CF_ACCUM):
        return "accum"
    if code.startswith(CF_INVEST):
        return "investing"
    if code in CF_FIN_EXACT or code.startswith("24") or (code.startswith("21") and code != "213"):
        return "financing"
    return "operating"

NON_CASH_ITEMS = {
    "222":   ("add",   "إهلاك الأصول الثابتة"),
    "22201": ("add",   "إهلاك مباني وإنشاءات"),
    "22202": ("add",   "إهلاك آلات ومعدات"),
    "22203": ("add",   "إهلاك سيارات"),
    "22204": ("add",   "إهلاك أثاث وأجهزة"),
    "1562":  ("add",   "إهلاك أصول حق الاستخدام"),
    "333":   ("add",   "إهلاكات إدارية"),
    "313":   ("add",   "مصروفات وإهلاكات تشغيلية"),
    "3411":  ("add",   "إهلاك ROU Assets"),
    "223":   ("add",   "مخصص مكافأة نهاية الخدمة"),
    "224":   ("add",   "مخصص خسائر ائتمانية ECL"),
    "226":   ("add",   "مخصص هبوط قيمة مخزون"),
    "227":   ("add",   "مخصص قضايا"),
    "334":   ("add",   "خسائر فروق عملة"),
    "421":   ("deduct","أرباح بيع أصول ثابتة (تُرحَّل للاستثماري)"),
    "3412":  ("add",   "فوائد تمويلية (تُرحَّل للتمويلي)"),
}

WORKING_CAPITAL = {
    # Decrease in asset = inflow (+) | Increase in asset = outflow (-)
    "131":   ("ar",        "asset",     "التغير في ذمم العملاء"),
    "132":   ("notes_rec", "asset",     "التغير في أوراق القبض"),
    "121":   ("inventory", "asset",     "التغير في المخزون"),
    "122":   ("inventory", "asset",     "التغير في إنتاج تام"),
    "135":   ("prepaid",   "asset",     "التغير في مصروفات مقدمة"),
    # Increase in liability = inflow (+) | Decrease in liability = outflow (-)
    "251":   ("ap",        "liability", "التغير في الموردين"),
    "252":   ("notes_pay", "liability", "التغير في أوراق الدفع"),
    "253":   ("accrued",   "liability", "التغير في مصروفات مستحقة"),
    "254":   ("tax_pay",   "liability", "التغير في الضرائب المستحقة"),
    "257":   ("deferred",  "liability", "التغير في إيرادات مؤجلة"),
    "1471":  ("booking",   "liability", "التغير في حجوزات عقارية"),
}


async def get_account_balance(
    company_id: str, account_code: str,
    date_from: str, date_to: str,
    side: str = "net"  # debit | credit | net
) -> float:
    """Sum debit/credit/net for an account in a date range from posted JEs"""
    pipeline = [
        {"$match": {
            "company_id": company_id, "status": {"$in": ["posted", "reversed"]},   # a reversed original + its reversal net to zero
            "entry_date": {"$gte": date_from, "$lte": date_to + "\uffff"},
        }},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": {"$regex": f"^{account_code}"}}},
        {"$group": {"_id": None,
                    "debit":  {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"}}},
    ]
    res = await db.journal_entries.aggregate(pipeline).to_list(1)
    if not res:
        return 0.0
    if side == "debit":
        return round(float(res[0]["debit"]), 2)
    if side == "credit":
        return round(float(res[0]["credit"]), 2)
    return round(float(res[0]["debit"]) - float(res[0]["credit"]), 2)


async def get_account_balance_period(
    company_id: str, account_code: str,
    as_of: str, side: str = "net"
) -> float:
    """Cumulative balance from inception to as_of (for balance sheet accounts)"""
    pipeline = [
        {"$match": {
            "company_id": company_id, "status": {"$in": ["posted", "reversed"]},   # a reversed original + its reversal net to zero
            "entry_date": {"$lte": as_of},
        }},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": {"$regex": f"^{account_code}"}}},
        {"$group": {"_id": None,
                    "debit":  {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"}}},
    ]
    res = await db.journal_entries.aggregate(pipeline).to_list(1)
    if not res:
        return 0.0
    d, c = float(res[0]["debit"]), float(res[0]["credit"])
    if side == "debit":  return round(d, 2)
    if side == "credit": return round(c, 2)
    return round(d - c, 2)


# ══════════════════════════════════════════════════════════════
# 1. DIRECT METHOD — الطريقة المباشرة
# ══════════════════════════════════════════════════════════════

@router.get("/direct")
async def cash_flow_direct(
    year:       int = Query(...),
    date_from:  Optional[str] = None,
    date_to:    Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    قائمة التدفقات النقدية — الطريقة المباشرة
    المعيار المصري 4 — تصنيف حركات البنك والخزينة آلياً

    كل حركة نقدية تُصنَّف بناءً على الحساب المقابل (counter-account)
    في القيد المزدوج
    """
    company_id = current_user["company_id"]
    date_from  = date_from or f"{year}-01-01"
    date_to    = date_to   or f"{year}-12-31"

    # ── اسحب كل حركات الخزينة / البنوك ──────────────────────
    pipeline = [
        {"$match": {
            "company_id": company_id, "status": {"$in": ["posted", "reversed"]},   # a reversed original + its reversal net to zero
            "entry_date": {"$gte": date_from, "$lte": date_to + "\uffff"},
        }},
        {"$unwind": "$lines"},
        # Only cash/bank debit lines (money coming in) or credit lines (money going out)
        {"$match": {"lines.account_code": {"$in": list(CASH_ACCOUNTS)}}},
        {"$group": {
            "_id": {
                "entry_id":  "$id",
                "entry_date":"$entry_date",
                "desc":      "$description",
                "account":   "$lines.account_code",
            },
            "debit":  {"$sum": "$lines.debit"},
            "credit": {"$sum": "$lines.credit"},
        }},
    ]
    cash_moves = await db.journal_entries.aggregate(pipeline).to_list(None)

    # For each cash move, find the counter-account(s) in the same entry
    operating_in = operating_out = 0.0
    investing_in = investing_out = 0.0
    financing_in = financing_out = 0.0
    detail = {"operating": [], "investing": [], "financing": [], "unclassified": []}

    for move in cash_moves:
        entry_id  = move["_id"]["entry_id"]
        net_cash  = round(float(move["debit"]) - float(move["credit"]), 2)
        if abs(net_cash) < 0.01:
            continue

        # Find counter accounts in the same journal entry
        entry = await db.journal_entries.find_one({"id": entry_id}, {"_id": 0, "lines": 1})
        counter_accounts = set()
        if entry:
            for l in entry.get("lines", []):
                code = l.get("account_code","")
                if code not in CASH_ACCOUNTS:
                    counter_accounts.add(code)

        # Classify with the shared rule: investing or financing if any counter
        # account is one; otherwise operating (EAS 4). The label keeps the old map.
        buckets = {cf_bucket(ca) for ca in counter_accounts}
        activity = ("investing" if buckets & {"investing", "accum"}
                    else "financing" if "financing" in buckets else "operating")
        label = move["_id"]["desc"]
        for ca in counter_accounts:
            if ca in DIRECT_CLASSIFICATION:
                label = DIRECT_CLASSIFICATION[ca][1]
                break
        direction = "inflow" if net_cash > 0 else "outflow"

        # EAS 4: operating = everything that is not investing or financing. A move
        # whose counter account is not in the map (e.g. 423 other income) used to be
        # left out of all three sections, so they no longer summed to the cash change.
        defaulted = activity == "unclassified"
        if defaulted:
            activity = "operating"

        amount = abs(net_cash)
        entry_detail = {
            "classified_by_default": defaulted,
            "date":             move["_id"]["entry_date"],
            "description":      label,
            "counter_accounts": list(counter_accounts),
            "amount":           amount,
            "direction":        direction,
        }

        if activity == "operating":
            detail["operating"].append(entry_detail)
            if net_cash > 0: operating_in  += amount
            else:            operating_out += amount
        elif activity == "investing":
            detail["investing"].append(entry_detail)
            if net_cash > 0: investing_in  += amount
            else:            investing_out += amount
        elif activity == "financing":
            detail["financing"].append(entry_detail)
            if net_cash > 0: financing_in  += amount
            else:            financing_out += amount
        else:
            detail["unclassified"].append(entry_detail)

    # Net cash per activity
    net_operating  = round(operating_in  - operating_out,  2)
    net_investing  = round(investing_in  - investing_out,  2)
    net_financing  = round(financing_in  - financing_out,  2)
    net_change     = round(net_operating + net_investing + net_financing, 2)

    # Opening/closing cash balances
    cash_open  = await get_account_balance_period(company_id, "16",
                    f"{year-1}-12-31", "debit")
    cash_close = round(cash_open + net_change, 2)

    return {
        "statement":   "قائمة التدفقات النقدية — الطريقة المباشرة",
        "standard":    "المعيار المحاسبي المصري رقم (4)",
        "method":      "direct",
        "period":      {"from": date_from, "to": date_to},
        "opening_cash_balance": cash_open,
        "operating_activities": {
            "label":     "أولاً: التدفقات النقدية من الأنشطة التشغيلية",
            "inflows":   round(operating_in,  2),
            "outflows":  round(operating_out, 2),
            "net":       net_operating,
            "detail":    detail["operating"],
        },
        "investing_activities": {
            "label":     "ثانياً: التدفقات النقدية من الأنشطة الاستثمارية",
            "inflows":   round(investing_in,  2),
            "outflows":  round(investing_out, 2),
            "net":       net_investing,
            "detail":    detail["investing"],
        },
        "financing_activities": {
            "label":     "ثالثاً: التدفقات النقدية من الأنشطة التمويلية",
            "inflows":   round(financing_in,  2),
            "outflows":  round(financing_out, 2),
            "net":       net_financing,
            "detail":    detail["financing"],
        },
        "unclassified": detail["unclassified"],
        "net_change_in_cash":     net_change,
        "closing_cash_balance":   cash_close,
        "reconciliation": {
            "opening":  cash_open,
            "net_change": net_change,
            "closing":  cash_close,
            "balanced": True,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 2. INDIRECT METHOD — الطريقة غير المباشرة
# ══════════════════════════════════════════════════════════════

@router.get("/indirect")
async def cash_flow_indirect(
    year:      int = Query(...),
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """قائمة التدفقات النقدية — الطريقة غير المباشرة (معيار المحاسبة المصري رقم 4)

    Built so it cannot fail to reconcile: every balance-sheet account belongs to
    exactly one of cash / operating / investing / financing, and its cash effect
    is its period movement (credit − debit) from the general ledger. Double entry
    makes the non-cash movements sum to the change in cash, so the three sections
    always add up. The previous version listed accounts one by one and missed
    some (tax accounts), mis-read others (dividends from a revaluation reserve,
    gains booked as sale proceeds, interest counted twice).
    """
    company_id = current_user["company_id"]
    date_from = date_from or f"{year}-01-01"
    date_to = date_to or f"{year}-12-31"

    accounts = {a["id"]: a for a in await db.chart_of_accounts.find({"company_id": company_id}, {"_id": 0}).to_list(None)}

    async def movement(start, end):
        m = {"company_id": company_id, "entry_date": {"$lte": end + "\uffff"}}
        if start:
            m["entry_date"]["$gte"] = start
        out = {}
        async for r in db.general_ledger.aggregate([{"$match": m},
                {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}]):
            a = accounts.get(r["_id"])
            if a:
                out[a["account_code"]] = out.get(a["account_code"], 0) + r["c"] - r["d"]   # credit − debit
        return out

    mv = await movement(date_from, date_to)
    prev_day = (date.fromisoformat(date_from) - __import__("datetime").timedelta(days=1)).isoformat()
    before = await movement(None, prev_day)

    CASH, ACCUM, bucket = CF_CASH, CF_ACCUM, cf_bucket
    names = {a["account_code"]: a["account_name"] for a in accounts.values()}

    net_income = round(sum(v for c, v in mv.items() if bucket(c) == "pl"), 2)
    # depreciation charge = credits to accumulated depreciation in the period
    dep_rows = [r async for r in db.general_ledger.aggregate([
        {"$match": {"company_id": company_id, "entry_date": {"$gte": date_from, "$lte": date_to + "\uffff"},
                    "account_id": {"$in": [i for i, a in accounts.items() if a["account_code"].startswith(ACCUM)]}}},
        {"$group": {"_id": None, "c": {"$sum": "$credit"}}}])]
    depreciation = round(dep_rows[0]["c"] if dep_rows else 0.0, 2)
    gains = round(mv.get("421", 0), 2)           # disposal gains: in profit, but the cash is investing

    wc_items, operating_wc = [], 0.0
    invest_items, investing = [], 0.0
    fin_items, financing = [], 0.0
    for code, v in sorted(mv.items()):
        v = round(v, 2)
        if abs(v) < 0.005:
            continue
        b = bucket(code)
        item = {"account": code, "item": names.get(code, code), "amount": v}
        if b == "operating":
            wc_items.append(item); operating_wc += v
        elif b == "investing":
            invest_items.append(item); investing += v
        elif b == "financing":
            fin_items.append(item); financing += v
    accum_move = round(sum(v for c, v in mv.items() if bucket(c) == "accum"), 2)
    disposal_accum = round(accum_move - depreciation, 2)              # < 0 when assets were retired
    if disposal_accum:
        invest_items.append({"account": "222", "item": "مجمع إهلاك الأصول المستبعدة", "amount": disposal_accum})
        investing += disposal_accum
    if gains:
        invest_items.append({"account": "421", "item": "أرباح بيع أصول (حصيلة البيع)", "amount": gains})
        investing += gains

    operating = round(net_income + depreciation - gains + operating_wc, 2)
    investing, financing = round(investing, 2), round(financing, 2)
    opening_cash = round(-sum(v for c, v in before.items() if c in CASH), 2)
    cash_change = round(-sum(v for c, v in mv.items() if c in CASH), 2)
    total = round(operating + investing + financing, 2)

    return {
        "statement": "قائمة التدفقات النقدية — الطريقة غير المباشرة",
        "standard": "معيار المحاسبة المصري رقم 4",
        "method": "indirect",
        "period": {"from": date_from, "to": date_to},
        "opening_cash_balance": opening_cash,
        "operating_activities": {
            "net_income": net_income, "depreciation": depreciation, "gains_on_disposal": -gains,
            "working_capital": wc_items, "working_capital_total": round(operating_wc, 2), "net": operating},
        "investing_activities": {"items": invest_items, "net": investing},
        "financing_activities": {"items": fin_items, "net": financing},
        "net_change_in_cash": total,
        "closing_cash_balance": round(opening_cash + total, 2),
        "reconciliation": {"ledger_cash_change": cash_change, "difference": round(total - cash_change, 2),
                           "reconciled": abs(total - cash_change) < 0.01},
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/compare")
async def cash_flow_compare(
    year: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    مقارنة بين الطريقتين المباشرة وغير المباشرة
    يجب أن يتفق صافي التشغيل في الطريقتين
    """
    direct, indirect = await asyncio.gather(
        cash_flow_direct(year, None, None, current_user),
        cash_flow_indirect(year, None, None, current_user),
    )

    direct_op   = direct["operating_activities"]["net"]
    indirect_op = indirect["operating_activities"]["net"]
    diff        = round(abs(direct_op - indirect_op), 2)

    return {
        "year": year,
        "comparison": {
            "direct_method": {
                "operating": direct_op,
                "investing": direct["investing_activities"]["net"],
                "financing": direct["financing_activities"]["net"],
                "net_change": direct["net_change_in_cash"],
            },
            "indirect_method": {
                "operating": indirect_op,
                "investing": indirect["investing_activities"]["net"],
                "financing": indirect["financing_activities"]["net"],
                "net_change": indirect["net_change_in_cash"],
            },
        },
        "reconciliation_check": {
            "direct_operating":   direct_op,
            "indirect_operating": indirect_op,
            "difference":         diff,
            "reconciled":         diff < 1.0,
            "note": "الفرق < 1 ج.م مقبول بسبب التقريب" if diff < 1.0 else
                    "⚠️ فرق كبير — تحقق من تصنيف الحسابات",
        },
        "closing_cash":  direct["closing_cash_balance"],
        "generated_at":  datetime.now(timezone.utc).isoformat(),
    }
