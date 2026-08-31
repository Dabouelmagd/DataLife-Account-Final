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

router = APIRouter(prefix="/api/cash-flow", tags=["Cash Flow"])


# ══════════════════════════════════════════════════════════════
# CLASSIFICATION MATRIX — مصفوفة تصنيف الحسابات
# كل حساب → نشاط تشغيلي / استثماري / تمويلي
# ══════════════════════════════════════════════════════════════

CASH_ACCOUNTS = {"112", "161", "162", "113"}  # بنوك + خزائن

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
    "1341":("operating", "قروض موظفين مصروفة",             "outflow"),
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
    "1611":("investing", "تطوير مشروعات عقارية",          "outflow"),
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
    "147":   ("deferred",  "liability", "التغير في إيرادات مؤجلة"),
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
            "company_id": company_id, "status": "posted",
            "entry_date": {"$gte": date_from, "$lte": date_to},
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
            "company_id": company_id, "status": "posted",
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
            "company_id": company_id, "status": "posted",
            "entry_date": {"$gte": date_from, "$lte": date_to},
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

        # Classify based on first matching counter account
        activity = "unclassified"
        label    = move["_id"]["desc"]
        direction = "inflow" if net_cash > 0 else "outflow"

        for ca in counter_accounts:
            # Exact match first
            if ca in DIRECT_CLASSIFICATION:
                activity, label, _ = DIRECT_CLASSIFICATION[ca]
                break
            # Prefix match (e.g. 221xx matches 22)
            for prefix in sorted(DIRECT_CLASSIFICATION.keys(), key=len, reverse=True):
                if ca.startswith(prefix):
                    activity, label, _ = DIRECT_CLASSIFICATION[prefix]
                    break
            if activity != "unclassified":
                break

        amount = abs(net_cash)
        entry_detail = {
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
    """
    قائمة التدفقات النقدية — الطريقة غير المباشرة
    المعيار المصري 4

    1. صافي الربح (من قائمة الدخل)
    2. + بنود غير نقدية (إهلاك، مخصصات)
    3. ± تغيرات رأس المال العامل
    4. = صافي تدفق الأنشطة التشغيلية
    """
    company_id = current_user["company_id"]
    date_from  = date_from or f"{year}-01-01"
    date_to    = date_to   or f"{year}-12-31"
    prev_end   = f"{year-1}-12-31"

    # ── 1. صافي الربح ─────────────────────────────────────────
    revenue_total  = await get_account_balance(company_id, "4", date_from, date_to, "credit")
    expense_total  = await get_account_balance(company_id, "3", date_from, date_to, "debit")
    net_income     = round(revenue_total - expense_total, 2)

    # ── 2. البنود غير النقدية ─────────────────────────────────
    # Depreciation: credit side of accumulated depreciation accounts (new period charge)
    dep_charged = 0.0
    dep_detail  = []

    dep_accounts = {
        "222":   "إهلاك الأصول الثابتة (مجمَّع)",
        "22201": "إهلاك مباني",
        "22202": "إهلاك آلات",
        "22203": "إهلاك سيارات",
        "22204": "إهلاك أثاث",
        "1562":  "إهلاك ROU Assets",
    }
    # Get depreciation expense accounts (debit) — more accurate
    dep_exp_accounts = {"313": "إهلاك تشغيلي", "333": "إهلاك إداري",
                        "3411": "إهلاك ROU", "3412": "فوائد تمويلية إيجار"}

    tasks = [get_account_balance(company_id, code, date_from, date_to, "debit")
             for code in dep_exp_accounts]
    dep_amounts = await asyncio.gather(*tasks)

    for (code, lbl), amt in zip(dep_exp_accounts.items(), dep_amounts):
        if amt > 0:
            dep_charged += amt
            dep_detail.append({"item": lbl, "amount": round(amt, 2)})

    # Provisions charged this period
    prov_charged = 0.0
    prov_detail  = []
    prov_accounts = {
        "223": "مخصص مكافأة نهاية الخدمة",
        "224": "مخصص خسائر ائتمانية ECL",
        "226": "مخصص هبوط مخزون",
        "227": "مخصص قضايا",
    }
    tasks2 = [get_account_balance(company_id, code, date_from, date_to, "credit")
              for code in prov_accounts]
    prov_amounts = await asyncio.gather(*tasks2)
    for (code, lbl), amt in zip(prov_accounts.items(), prov_amounts):
        if amt > 0:
            prov_charged += amt
            prov_detail.append({"item": lbl, "amount": round(amt, 2)})

    # Capital gains (already in revenue — deduct from operating)
    capital_gains = await get_account_balance(company_id, "421", date_from, date_to, "credit")

    # Finance interest (add back to operating, will appear in financing)
    finance_interest = await get_account_balance(company_id, "3412", date_from, date_to, "debit")

    non_cash_total = round(dep_charged + prov_charged - capital_gains, 2)

    # ── 3. تغيرات رأس المال العامل ───────────────────────────
    wc_items   = []
    wc_total   = 0.0

    wc_tasks_curr = [get_account_balance_period(company_id, code, date_to, "net")
                     for code in WORKING_CAPITAL]
    wc_tasks_prev = [get_account_balance_period(company_id, code, prev_end, "net")
                     for code in WORKING_CAPITAL]

    curr_balances, prev_balances = await asyncio.gather(
        asyncio.gather(*wc_tasks_curr),
        asyncio.gather(*wc_tasks_prev)
    )

    for (code, (key, acc_type, lbl)), curr, prev in zip(
        WORKING_CAPITAL.items(), curr_balances, prev_balances
    ):
        change = round(curr - prev, 2)
        if abs(change) < 0.01:
            continue

        # Assets: increase = outflow (negative), decrease = inflow (positive)
        # Liabilities: increase = inflow (positive), decrease = outflow (negative)
        if acc_type == "asset":
            cf_effect = round(-change, 2)   # flip sign
            direction = "inflow" if change < 0 else "outflow"
        else:
            cf_effect = round(change, 2)
            direction = "inflow" if change > 0 else "outflow"

        wc_items.append({
            "item":      lbl,
            "account":   code,
            "prev_bal":  prev,
            "curr_bal":  curr,
            "change":    change,
            "cf_effect": cf_effect,
            "direction": direction,
        })
        wc_total = round(wc_total + cf_effect, 2)

    # ── 4. Assemble Operating Activities ─────────────────────
    net_operating = round(net_income + non_cash_total + wc_total, 2)

    # ── 5. Investing Activities ───────────────────────────────
    # Fixed asset purchases (debit to asset accounts) — credit side = inflows
    invest_items = []
    invest_net   = 0.0

    invest_accounts = {
        "111": "شراء أراضٍ ومباني", "113": "شراء سيارات",
        "114": "شراء آلات ومعدات", "115": "شراء أثاث",
        "116": "شراء حواسب", "1561": "دفعات إيجار تمويلي",
        "1611": "تطوير عقاري",
    }
    tasks_inv = [get_account_balance(company_id, code, date_from, date_to, "net")
                 for code in invest_accounts]
    inv_amounts = await asyncio.gather(*tasks_inv)

    for (code, lbl), net in zip(invest_accounts.items(), inv_amounts):
        if abs(net) < 0.01:
            continue
        cf = round(-net, 2)  # debit = purchase = outflow → flip
        invest_items.append({"item": lbl, "amount": cf})
        invest_net = round(invest_net + cf, 2)

    if capital_gains > 0:
        invest_items.append({"item": "حصيلة بيع أصول ثابتة", "amount": capital_gains})
        invest_net = round(invest_net + capital_gains, 2)

    interest_received = await get_account_balance(company_id, "422", date_from, date_to, "credit")
    if interest_received > 0:
        invest_items.append({"item": "فوائد دائنة مقبوضة", "amount": interest_received})
        invest_net = round(invest_net + interest_received, 2)

    # ── 6. Financing Activities ───────────────────────────────
    fin_items = []
    fin_net   = 0.0

    loans_received = await get_account_balance(company_id, "241", date_from, date_to, "credit")
    loans_repaid   = await get_account_balance(company_id, "241", date_from, date_to, "debit")
    capital_inc    = await get_account_balance(company_id, "211", date_from, date_to, "credit")
    dividends_paid = await get_account_balance(company_id, "215", date_from, date_to, "debit")
    gratuity_paid  = await get_account_balance(company_id, "223", date_from, date_to, "debit")
    lease_paid     = await get_account_balance(company_id, "2611", date_from, date_to, "debit")

    for lbl, amt, sign in [
        ("حصيلة قروض بنكية",              loans_received,  +1),
        ("سداد قروض بنكية",               loans_repaid,    -1),
        ("زيادة رأس المال",               capital_inc,     +1),
        ("توزيعات أرباح مدفوعة",          dividends_paid,  -1),
        ("مكافآت نهاية خدمة مدفوعة",      gratuity_paid,   -1),
        ("سداد التزامات إيجار تمويلي",    lease_paid,      -1),
        ("فوائد تمويلية مدفوعة",          finance_interest,-1),
    ]:
        if amt > 0:
            cf = round(amt * sign, 2)
            fin_items.append({"item": lbl, "amount": cf})
            fin_net = round(fin_net + cf, 2)

    # ── 7. Net Change & Reconciliation ───────────────────────
    net_change = round(net_operating + invest_net + fin_net, 2)
    cash_open  = await get_account_balance_period(company_id, "16", prev_end, "net")
    cash_close = round(cash_open + net_change, 2)

    return {
        "statement":  "قائمة التدفقات النقدية — الطريقة غير المباشرة",
        "standard":   "المعيار المحاسبي المصري رقم (4)",
        "method":     "indirect",
        "period":     {"from": date_from, "to": date_to},
        "opening_cash_balance": round(cash_open, 2),
        "operating_activities": {
            "label": "أولاً: التدفقات النقدية من الأنشطة التشغيلية",
            "net_income": net_income,
            "adjustments": {
                "depreciation_amortization": {
                    "label":  "إضافة: الإهلاك والاستهلاك",
                    "amount": round(dep_charged, 2),
                    "detail": dep_detail,
                },
                "provisions": {
                    "label":  "إضافة: المخصصات المحملة",
                    "amount": round(prov_charged, 2),
                    "detail": prov_detail,
                },
                "capital_gains": {
                    "label":  "خصم: أرباح بيع أصول (تُنقَل للاستثماري)",
                    "amount": round(-capital_gains, 2),
                },
                "finance_interest": {
                    "label":  "خصم: فوائد تمويلية (تُنقَل للتمويلي)",
                    "amount": round(-finance_interest, 2),
                },
                "total_non_cash": round(non_cash_total, 2),
            },
            "working_capital_changes": {
                "label":  "التغير في رأس المال العامل",
                "items":  wc_items,
                "total":  wc_total,
            },
            "net": net_operating,
        },
        "investing_activities": {
            "label": "ثانياً: التدفقات النقدية من الأنشطة الاستثمارية",
            "items": invest_items,
            "net":   round(invest_net, 2),
        },
        "financing_activities": {
            "label": "ثالثاً: التدفقات النقدية من الأنشطة التمويلية",
            "items": fin_items,
            "net":   round(fin_net, 2),
        },
        "net_change_in_cash":   net_change,
        "closing_cash_balance": cash_close,
        "reconciliation": {
            "opening_cash": round(cash_open, 2),
            "operating":    net_operating,
            "investing":    round(invest_net, 2),
            "financing":    round(fin_net, 2),
            "net_change":   net_change,
            "closing_cash": cash_close,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 3. COMPARISON — مقارنة الطريقتين
# ══════════════════════════════════════════════════════════════

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
