"""
POS, Retail & F&B Engine — محرك نقاط البيع والتجزئة والمطاعم

1. إدارة الوردية (Shift Management)
   - فتح وردية الكاشير مع رصيد افتتاحي (عهدة من الخزينة 161 إلى درج الكاشير 164)
   - تسجيل المبيعات والمرتجعات خلال الوردية (الكمية تخرج/تعود للمخزن فوراً)
   - إغلاق الوردية: قيد واحد بالإيراد والضريبة والفروق، وقيد تكلفة (الجرد المستمر)
   - معالجة عجز أو زيادة الكاشير
2. تسوية مبيعات البطاقات (حين يوجد حساب تسويات معلقة 166/167 من باقة القطاع)
3. تالف وهدر المواد (Waste & Spoilage)
   Dr م/33610 مصروف تالف وهدر
   Cr م/125 مخزون (أو 311 في الجرد الدوري)
"""
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from database import db
from dependencies import get_current_user
from services import ops_posting as P

router = APIRouter(prefix="/api/pos", tags=["POS & Retail"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES — all checked against DEFAULT_ACCOUNTS
# ══════════════════════════════════════════════════════════════
ACC = {
    "cash_drawer":      "164",   # نقدية درج الكاشير — نقاط البيع
    "shortage_ar":      "1313",  # عجز نقدية — ذمة الكاشير
    "shortage_exp":     "3353",  # عجز نقدية مسموح به
    "surplus_rev":      "4231",  # إيراد زيادة النقدية
    "pos_sales":        "4121",  # إيرادات مبيعات نقاط البيع (فرعي تحت 41 مثل 411)
    "sales_returns":    "413",   # مردودات ومسموحات المبيعات
    "vat_output":       "260",   # ضريبة القيمة المضافة المخرجات
    "fnb_inventory":    "125",   # مخزون بضائع بغرض البيع
    "waste_exp":        "33610", # مصروف تالف وهدر   # كان 3361: مصروفات بوفيه وضيافة
    # was 311 (تكلفة الخامات المستهلكة) — 314 is cost of goods sold, and is
    # what invoice_service posts a sale's cost to; two doors, one account
    "cogs":             "314",
    "bank":             "162",
    "cash":             "161",   # الخزينة الرئيسية
    "bank_charges":     "334",   # مصروفات وعمولات بنكية (عمولة ماكينة البطاقات)
}
# industry-pack accounts for card money not yet in the bank (retail 167, F&B 166)
CARD_IN_TRANSIT = ["167", "166"]
ALLOWED_SPOILAGE_ACCOUNTS = {"121", "122", "125", "1251", "1252", "1253", "1254", "1255", "1256", "1257"}

CASH_SHORTAGE_TOLERANCE = 50.0   # ج.م — العجز المسموح لكل وردية (قابل للتكوين لكل إقفال)


async def _card_account(company_id: str) -> str:
    for c in CARD_IN_TRANSIT:
        if await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": c}, {"_id": 1}):
            return c
    return ACC["bank"]


async def _signed(company_id, code, amount, desc):
    """Positive → debit, negative → credit (a net refund day flips the side)."""
    amount = P.r2(amount)
    return await P.je_line(db, company_id, code, debit=max(amount, 0), credit=max(-amount, 0), desc=desc)


# ══════════════════════════════════════════════════════════════
# 1. SHIFT MANAGEMENT — إدارة الوردية
# ══════════════════════════════════════════════════════════════

class OpenShiftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")   # a misspelled field would silently open with 0 float
    cashier_id:      str = Field(min_length=1)
    cashier_name:    str = Field(min_length=1, max_length=120)
    terminal_id:     str = "POS-01"
    opening_cash:    float = Field(0.0, ge=0)   # الرصيد الافتتاحي للوردية
    shift_date:      str
    warehouse_id:    Optional[str] = None       # المخزن الذي تُصرف منه مبيعات الوردية


@router.post("/shifts/open")
async def open_shift(req: OpenShiftRequest,
                     current_user: dict = Depends(get_current_user)):
    """
    فتح وردية جديدة للكاشير

    إن كان هناك رصيد افتتاحي مستلم:
    Dr م/164 نقدية درج الكاشير
    Cr م/161 الخزينة الرئيسية
    """
    company_id = current_user["company_id"]

    existing = await db.pos_shifts.find_one({
        "company_id": company_id, "cashier_id": req.cashier_id, "status": "open"})
    if existing:
        raise HTTPException(400, f"الكاشير {req.cashier_name} لديه وردية مفتوحة بالفعل")
    if await db.pos_shifts.find_one({"company_id": company_id, "terminal_id": req.terminal_id, "status": "open"}):
        raise HTTPException(400, f"نقطة البيع {req.terminal_id} عليها وردية مفتوحة — أغلقها أولاً")

    warehouse_id = req.warehouse_id or await P.default_warehouse_id(db, company_id)
    shift_id = str(uuid.uuid4())
    je_id = None
    if req.opening_cash > 0:
        lines = [
            await P.je_line(db, company_id, ACC["cash_drawer"], debit=req.opening_cash,
                            desc=f"رصيد افتتاحي وردية {req.cashier_name} — {req.terminal_id}"),
            await P.je_line(db, company_id, ACC["cash"], credit=req.opening_cash,
                            desc=f"صرف عهدة وردية كاشير {req.cashier_name}"),
        ]
        je_id = await P.post_je(db, company_id, current_user["user_id"], req.shift_date,
                                f"فتح وردية — {req.cashier_name} — {req.terminal_id}", lines,
                                "pos_shift", shift_id)

    shift = {
        "id": shift_id, "company_id": company_id,
        "cashier_id": req.cashier_id, "cashier_name": req.cashier_name,
        "terminal_id": req.terminal_id, "warehouse_id": warehouse_id,
        "shift_date": req.shift_date,
        "open_time": datetime.now(timezone.utc).isoformat(), "close_time": None,
        "status": "open",
        "opening_cash": P.r2(req.opening_cash),
        "total_sales": 0.0, "total_cash_sales": 0.0, "total_card_sales": 0.0,
        "total_wallet_sales": 0.0, "total_vat": 0.0,
        "total_returns": 0.0, "total_returns_vat": 0.0,
        "cash_refunds": 0.0, "card_refunds": 0.0, "wallet_refunds": 0.0,
        "total_cost": 0.0, "returns_cost": 0.0,
        "transactions_count": 0, "returns_count": 0,
        "open_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.pos_shifts.insert_one(shift); shift.pop("_id", None)
    return {"message": f"تم فتح وردية الكاشير {req.cashier_name}", "shift": shift, "shift_id": shift_id}


class SaleItem(BaseModel):
    product_id: Optional[str] = None
    name: Optional[str] = None
    qty: float = Field(gt=0)
    unit_price: float = Field(0, ge=0)


class SaleRequest(BaseModel):
    # was a free dict: a negative amount was accepted (a "sale" that took money
    # out of revenue), VAT larger than the sale was accepted, and an unknown
    # payment method silently counted as wallet
    amount:         float = Field(gt=0)            # الإجمالي شامل الضريبة
    vat:            float = Field(0, ge=0)
    payment_method: Literal["cash", "card", "wallet"] = "cash"
    receipt_number: str = ""
    items:          List[SaleItem] = []


async def _move_items(company_id, shift, items, user_id, receipt, sign):
    """Stock out (sign=-1) / back in (sign=+1); returns cost at moving average."""
    wh = shift.get("warehouse_id") or await P.default_warehouse_id(db, company_id)
    total_cost, out = 0.0, []
    for it in items:
        if not it.product_id:
            out.append({**it.model_dump(), "unit_cost": 0}); continue
        prod = await P.get_product(db, company_id, it.product_id)
        cost = await P.average_cost(db, company_id, it.product_id, wh)
        total_cost += it.qty * cost
        out.append({**it.model_dump(), "name": it.name or prod.get("name"), "unit_cost": cost})
    # move after every product resolved, so a bad id never leaves half the basket moved
    for it, row in zip(items, out):
        if not it.product_id:
            continue
        kw = dict(date_str=shift["shift_date"], source_type="pos", source_id=shift["id"],
                  user_id=user_id, product_name=row["name"] or "")
        if sign < 0:
            await P.stock_out(db, company_id, it.product_id, wh, it.qty, row["unit_cost"], mtype="sales", **kw)
        else:
            await P.stock_in(db, company_id, it.product_id, wh, it.qty, row["unit_cost"], mtype="return_in", **kw)
    return P.r2(total_cost), out


@router.post("/shifts/{shift_id}/sale")
async def record_sale(shift_id: str, data: SaleRequest,
                      current_user: dict = Depends(get_current_user)):
    """تسجيل عملية بيع خلال الوردية — يتراكم في الوردية ويُرحَّل قيده عند الإغلاق.
    الأصناف المرتبطة بصنف مخزني تخرج من مخزن الوردية فوراً (بالجرد الدوري والمستمر)."""
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one({"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    if shift["status"] != "open":
        raise HTTPException(400, "الوردية مغلقة")
    amount, vat = P.r2(data.amount), P.r2(data.vat)
    if vat >= amount:
        raise HTTPException(400, "الضريبة لا يمكن أن تساوي أو تتجاوز إجمالي البيع")

    cost, items = await _move_items(company_id, shift, data.items, current_user["user_id"], data.receipt_number, -1)
    inc = {"total_sales": amount, "total_vat": vat, "transactions_count": 1, "total_cost": cost,
           f"total_{data.payment_method}_sales": amount}
    txn = {
        "id": str(uuid.uuid4()), "company_id": company_id, "shift_id": shift_id, "type": "sale",
        "receipt_number": data.receipt_number, "amount": amount, "vat": vat, "cost": cost,
        "payment_method": data.payment_method, "items": items,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.pos_transactions.insert_one(txn)
    await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id}, {"$inc": inc})
    return {"message": "تم تسجيل البيع", "transaction_id": txn["id"]}


class ReturnRequest(BaseModel):
    amount:           float = Field(gt=0)          # المرتجع شامل الضريبة
    vat:              float = Field(0, ge=0)
    payment_method:   Literal["cash", "card", "wallet"] = "cash"   # طريقة رد المبلغ
    original_receipt: str = Field(min_length=1)
    reason:           Optional[str] = None
    items:            List[SaleItem] = []


@router.post("/shifts/{shift_id}/return")
async def record_return(shift_id: str, data: ReturnRequest,
                        current_user: dict = Depends(get_current_user)):
    """مرتجع مبيعات داخل الوردية — يُقيَّد عند الإغلاق على 413 (مردودات المبيعات)
    مع رد ضريبة المخرجات 260، وتعود الأصناف للمخزن."""
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one({"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    if shift["status"] != "open":
        raise HTTPException(400, "الوردية مغلقة")
    amount, vat = P.r2(data.amount), P.r2(data.vat)
    if vat >= amount:
        raise HTTPException(400, "الضريبة لا يمكن أن تساوي أو تتجاوز قيمة المرتجع")
    cost, items = await _move_items(company_id, shift, data.items, current_user["user_id"], data.original_receipt, +1)
    txn = {
        "id": str(uuid.uuid4()), "company_id": company_id, "shift_id": shift_id, "type": "return",
        "receipt_number": data.original_receipt, "amount": amount, "vat": vat, "cost": cost,
        "payment_method": data.payment_method, "items": items, "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.pos_transactions.insert_one(txn)
    await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id}, {"$inc": {
        "total_returns": amount, "total_returns_vat": vat, "returns_cost": cost, "returns_count": 1,
        f"{data.payment_method}_refunds": amount}})
    return {"message": "تم تسجيل المرتجع", "transaction_id": txn["id"]}


async def _close_lines(company_id: str, shift: dict, actual_cash: float, tolerance: float, date_str: str):
    """Build the close entry. Shared by the preview and the real close."""
    f = lambda k: float(shift.get(k) or 0)
    opening = f("opening_cash")
    cash_net = f("total_cash_sales") - f("cash_refunds")
    noncash_net = P.r2(f("total_card_sales") + f("total_wallet_sales") - f("card_refunds") - f("wallet_refunds"))
    sales_net = P.r2(f("total_sales") - f("total_vat"))
    returns_net = P.r2(f("total_returns") - f("total_returns_vat"))
    expected = P.r2(opening + cash_net)
    diff = P.r2(actual_cash - expected)            # + زيادة | - عجز
    who = f"{shift['cashier_name']} ({shift['terminal_id']})"
    card_acc = await _card_account(company_id)

    # The old entry debited the main safe with (counted − opening) and then
    # posted a SECOND entry returning the opening float; a drawer counted below
    # its float produced a negative debit and the close failed. Now the counted
    # cash moves to the safe and the drawer (164) is emptied in the same entry.
    lines = [
        await P.je_line(db, company_id, ACC["cash"], debit=actual_cash, desc=f"توريد نقدية وردية {who} للخزينة"),
        await P.je_line(db, company_id, ACC["cash_drawer"], credit=opening, desc=f"إقفال عهدة درج الكاشير — {who}"),
        await _signed(company_id, card_acc, noncash_net, f"صافي مبيعات بطاقات ومحافظ — وردية {who}"),
        await P.je_line(db, company_id, ACC["sales_returns"], debit=returns_net, desc=f"مردودات مبيعات — وردية {who}"),
        await P.je_line(db, company_id, ACC["vat_output"], debit=f("total_returns_vat"), desc=f"رد ضريبة مرتجعات — وردية {who}"),
    ]
    shortage_type = None
    if diff < 0:
        if abs(diff) <= tolerance:
            lines.append(await P.je_line(db, company_id, ACC["shortage_exp"], debit=-diff,
                                         desc=f"عجز نقدية مسموح به — {who}"))
            shortage_type = "allowable"
        else:
            lines.append(await P.je_line(db, company_id, ACC["shortage_ar"], debit=-diff,
                                         desc=f"عجز نقدية كاشير {shift['cashier_name']} — ذمة مستحقة"))
            shortage_type = "cashier_receivable"
    elif diff > 0:
        lines.append(await P.je_line(db, company_id, ACC["surplus_rev"], credit=diff, desc=f"زيادة نقدية — وردية {who}"))
        shortage_type = "surplus"
    lines += [
        await P.je_line(db, company_id, ACC["pos_sales"], credit=sales_net, desc=f"إيرادات مبيعات نقاط البيع — {who} — {date_str}"),
        await P.je_line(db, company_id, ACC["vat_output"], credit=f("total_vat"), desc=f"ضريبة مخرجات مبيعات وردية {who}"),
    ]

    cogs_lines = []
    net_cost = P.r2(f("total_cost") - f("returns_cost"))
    if net_cost and await P.inventory_method(db, company_id) == "perpetual":
        cogs_lines = [
            await _signed(company_id, ACC["cogs"], net_cost, f"تكلفة مبيعات وردية {who}"),
            await _signed(company_id, ACC["fnb_inventory"], -net_cost, f"إخراج بضاعة مباعة — وردية {who}"),
        ]
    summary = {"expected_cash": expected, "cash_difference": diff, "shortage_type": shortage_type,
               "sales_net": sales_net, "returns_net": returns_net, "noncash_net": noncash_net,
               "card_account": card_acc, "net_cost": net_cost}
    return lines, cogs_lines, summary


class CloseShiftRequest(BaseModel):
    actual_cash:        float = Field(ge=0)       # الرصيد النقدي المعدود
    date:               Optional[str] = None
    shortage_tolerance: float = Field(CASH_SHORTAGE_TOLERANCE, ge=0)


def _line_view(lines):
    return [{"account_code": l["account_code"], "account_name": l["account_name"],
             "debit": l["debit"], "credit": l["credit"], "description": l["description"]}
            for l in lines if l["debit"] or l["credit"]]


@router.post("/shifts/{shift_id}/close-preview")
async def preview_close(shift_id: str, data: CloseShiftRequest,
                        current_user: dict = Depends(get_current_user)):
    """معاينة قيد الإقفال قبل الترحيل — لا يُكتب شيء."""
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one({"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    lines, cogs, s = await _close_lines(company_id, shift, P.r2(data.actual_cash), data.shortage_tolerance,
                                        data.date or shift["shift_date"])
    return {"lines": _line_view(lines), "cogs_lines": _line_view(cogs), **s}


@router.post("/shifts/{shift_id}/close")
async def close_shift(shift_id: str, data: CloseShiftRequest,
                      current_user: dict = Depends(get_current_user)):
    """
    إغلاق الوردية وتسوية النقدية — قيد واحد:
    Dr 161 الخزينة (المعدود فعلاً)       Cr 164 درج الكاشير (العهدة)
    Dr 162/166/167 صافي البطاقات والمحافظ
    Dr 413 مردودات + Dr 260 ضريبة المرتجعات
    Dr 3353 عجز مسموح | Dr 1313 عجز على الكاشير | Cr 4231 زيادة
    Cr 4121 إيرادات نقاط البيع          Cr 260 ضريبة المخرجات
    وفي الجرد المستمر قيد التكلفة: Dr 314 / Cr 125
    """
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one({"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    if shift["status"] != "open":
        raise HTTPException(400, "الوردية مغلقة بالفعل")
    # claim the shift first so a double click cannot post the close twice
    claimed = await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id, "status": "open"},
                                             {"$set": {"status": "closing"}})
    if not claimed.modified_count:
        raise HTTPException(409, "جارٍ إغلاق الوردية بالفعل")

    actual_cash = P.r2(data.actual_cash)
    date_str = data.date or shift["shift_date"]
    try:
        lines, cogs_lines, s = await _close_lines(company_id, shift, actual_cash, data.shortage_tolerance, date_str)
        je_id = await P.post_je(db, company_id, current_user["user_id"], date_str,
                                f"إغلاق وردية {shift['cashier_name']} — {shift['terminal_id']} — {date_str}",
                                lines, "pos_shift", shift_id)
        cogs_je = await P.post_je(db, company_id, current_user["user_id"], date_str,
                                  f"تكلفة مبيعات وردية {shift['cashier_name']} — {date_str}",
                                  cogs_lines, "pos_shift", shift_id) if cogs_lines else None
    except Exception:
        await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id}, {"$set": {"status": "open"}})
        raise

    td, tc = P.totals([l for l in lines])
    await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id}, {"$set": {
        "status": "closed", "close_time": datetime.now(timezone.utc).isoformat(),
        "actual_cash": actual_cash, "expected_cash": s["expected_cash"],
        "cash_difference": s["cash_difference"], "shortage_type": s["shortage_type"],
        "close_je_id": je_id, "cogs_je_id": cogs_je, "card_account": s["card_account"],
    }})
    diff, st = s["cash_difference"], s["shortage_type"]
    return {
        "message": f"تم إغلاق وردية {shift['cashier_name']}",
        "shift_summary": {
            "cashier": shift["cashier_name"], "terminal": shift["terminal_id"], "date": date_str,
            "total_sales": shift["total_sales"], "total_vat": shift["total_vat"], "net_sales": s["sales_net"],
            "returns": shift.get("total_returns", 0), "returns_net": s["returns_net"],
            "cash_sales": shift["total_cash_sales"], "card_sales": shift["total_card_sales"],
            "wallet_sales": shift["total_wallet_sales"], "opening_cash": shift["opening_cash"],
            "expected_cash": s["expected_cash"], "actual_cash": actual_cash,
            "cash_difference": diff, "shortage_type": st,
            "transactions": shift["transactions_count"], "cost_of_sales": s["net_cost"],
        },
        "journal": {"id": je_id, "cogs_id": cogs_je, "debit": td, "credit": tc, "balanced": abs(td - tc) < 0.01},
        "cash_diff_note": (
            f"زيادة نقدية ({diff:.2f}) → إيراد م/4231" if st == "surplus" else
            f"عجز مسموح ({abs(diff):.2f}) → مصروف م/3353" if st == "allowable" else
            f"عجز غير مسموح ({abs(diff):.2f}) → ذمة الكاشير م/1313" if st == "cashier_receivable" else
            "لا فروق نقدية ✅"),
    }


# ══════════════════════════════════════════════════════════════
# 2. CARD SETTLEMENTS — تسوية مبيعات البطاقات
# ══════════════════════════════════════════════════════════════

class CardSettlementRequest(BaseModel):
    date:         str
    gross_amount: float = Field(gt=0)        # ما خُصم من حساب التسويات
    commission:   float = Field(0, ge=0)     # عمولة البنك/الشبكة
    bank_account: str = "162"
    reference:    Optional[str] = None


@router.post("/card-settlements")
async def settle_cards(req: CardSettlementRequest, current_user: dict = Depends(get_current_user)):
    """وصول مبالغ البطاقات للبنك بعد خصم العمولة:
    Dr 162 البنك (الصافي) + Dr 334 عمولة بنكية / Cr 166|167 تسويات البطاقات المعلقة"""
    company_id = current_user["company_id"]
    transit = None
    for c in CARD_IN_TRANSIT:
        if await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": c}, {"_id": 1}):
            transit = c; break
    if not transit:
        raise HTTPException(400, "لا يوجد حساب تسويات بطاقات معلقة (167 أو 166) — فعّل باقة التجزئة أو المطاعم. "
                                 "بدونها تُقيَّد مبيعات البطاقات على البنك 162 مباشرة عند إقفال الوردية ولا تحتاج تسوية.")
    if not req.bank_account.startswith("16") or req.bank_account in CARD_IN_TRANSIT:
        raise HTTPException(400, "اختر حساب بنك صحيحاً")
    if req.commission >= req.gross_amount:
        raise HTTPException(400, "العمولة أكبر من المبلغ")
    net = P.r2(req.gross_amount - req.commission)
    sid = str(uuid.uuid4())
    lines = [
        await P.je_line(db, company_id, req.bank_account, debit=net, desc=f"تحصيل تسوية بطاقات {req.reference or ''}"),
        await P.je_line(db, company_id, ACC["bank_charges"], debit=req.commission, desc="عمولة ماكينات الدفع"),
        await P.je_line(db, company_id, transit, credit=req.gross_amount, desc="إقفال تسويات بطاقات معلقة"),
    ]
    je_id = await P.post_je(db, company_id, current_user["user_id"], req.date, "تسوية مبيعات البطاقات",
                            lines, "pos_card_settlement", sid, req.reference)
    rec = {"id": sid, "company_id": company_id, "date": req.date, "gross_amount": P.r2(req.gross_amount),
           "commission": P.r2(req.commission), "net_amount": net, "bank_account": req.bank_account,
           "transit_account": transit, "reference": req.reference, "journal_entry_id": je_id,
           "created_by": current_user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.pos_card_settlements.insert_one(rec); rec.pop("_id", None)
    return {"message": f"تم تسجيل تسوية بطاقات بصافي {net:,.2f} ج.م", "settlement": rec}


@router.get("/card-settlements")
async def list_card_settlements(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    rows = await db.pos_card_settlements.find({"company_id": company_id}, {"_id": 0}).sort("date", -1).to_list(200)
    transit = await _card_account(company_id)
    return {"settlements": rows, "transit_account": transit if transit != ACC["bank"] else None}


# ══════════════════════════════════════════════════════════════
# 3. WASTE & SPOILAGE — تالف وهدر المواد
# ══════════════════════════════════════════════════════════════

class SpoilageItem(BaseModel):
    product_id:   Optional[str] = None
    product_name: Optional[str] = None
    qty:          float = Field(gt=0)
    unit_cost:    Optional[float] = Field(None, ge=0)   # فارغ = متوسط التكلفة المتحرك
    reason:       str = "تالف"


class SpoilageRequest(BaseModel):
    date:          str
    items:         List[SpoilageItem] = Field(min_length=1)
    approved_by:   Optional[str] = None
    notes:         Optional[str] = None
    inventory_account: str = "125"
    warehouse_id:  Optional[str] = None


@router.post("/spoilage")
async def record_spoilage(req: SpoilageRequest,
                          current_user: dict = Depends(get_current_user)):
    """
    تسجيل تالف وهدر المواد
    Dr م/33610 مصروف تالف وهدر
    Cr م/125 (أو حساب المخزون المختار) — وفي الجرد الدوري Cr م/311 لأن المشتريات حُمِّلت عليه
    """
    company_id = current_user["company_id"]
    # inventory_account came straight from the body: any code, even revenue or a
    # bank, could be credited. Only inventory accounts are allowed.
    if req.inventory_account not in ALLOWED_SPOILAGE_ACCOUNTS:
        raise HTTPException(400, "حساب المخزون غير مسموح — اختر 121 أو 122 أو 125 أو حساباً فرعياً من 125")
    inv_acc = "311" if await P.inventory_method(db, company_id) == "periodic" else req.inventory_account
    wh = req.warehouse_id or await P.default_warehouse_id(db, company_id)
    spoilage_id = str(uuid.uuid4())

    item_details, credit_lines = [], []
    for item in req.items:
        pname = item.product_name or ""
        if item.product_id:
            prod = await P.get_product(db, company_id, item.product_id)
            pname = pname or prod.get("name", "")
        cost = item.unit_cost if item.unit_cost is not None else \
            (await P.average_cost(db, company_id, item.product_id, wh) if item.product_id else 0)
        line_cost = P.r2(item.qty * cost)
        credit_lines.append(await P.je_line(db, company_id, inv_acc, credit=line_cost,
                                            desc=f"هدر {pname} — {item.qty:g} × {cost:g} — {item.reason}"))
        item_details.append({"product_id": item.product_id or "", "product_name": pname, "qty": item.qty,
                             "unit_cost": cost, "total_cost": line_cost, "reason": item.reason})
    total_cost = P.r2(sum(i["total_cost"] for i in item_details))
    if total_cost <= 0:
        raise HTTPException(400, "يجب إدخال بنود بتكلفة موجبة")
    lines = [await P.je_line(db, company_id, ACC["waste_exp"], debit=total_cost,
                             desc=f"تالف وهدر مواد — {len(req.items)} صنف — {req.date}")] + credit_lines
    je_id = await P.post_je(db, company_id, current_user["user_id"], req.date,
                            f"تالف وهدر مواد — {req.date}", lines, "spoilage", spoilage_id)

    # stock leaves the warehouse only once the entry is posted
    for item, d in zip(req.items, item_details):
        if item.product_id:
            await P.stock_out(db, company_id, item.product_id, wh, item.qty, d["unit_cost"], date_str=req.date,
                              source_type="spoilage", source_id=spoilage_id, user_id=current_user["user_id"],
                              mtype="damage", product_name=d["product_name"])

    record = {"id": spoilage_id, "company_id": company_id, "date": req.date, "items": item_details,
              "total_cost": total_cost, "warehouse_id": wh, "inventory_account": inv_acc,
              "approved_by": req.approved_by, "notes": req.notes, "journal_entry_id": je_id,
              "created_by": current_user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.spoilage_records.insert_one(record); record.pop("_id", None)
    return {
        "message": f"تم تسجيل تالف {len(req.items)} صنف — إجمالي {total_cost:,.2f} ج.م",
        "record": record,
        "journal": {"id": je_id, "debit": f"م/{ACC['waste_exp']} مصروف تالف وهدر  {total_cost:,.2f}",
                    "credit": f"م/{inv_acc}  {total_cost:,.2f}", "balanced": True},
    }


@router.get("/spoilage/report")
async def spoilage_report(date_from: str = Query(...), date_to: str = Query(...),
                          current_user: dict = Depends(get_current_user)):
    """تقرير التالف والهدر خلال فترة"""
    records = await db.spoilage_records.find({
        "company_id": current_user["company_id"], "date": {"$gte": date_from, "$lte": date_to}
    }, {"_id": 0}).sort("date", -1).to_list(None)
    total = P.r2(sum(r["total_cost"] for r in records))
    return {"period": {"from": date_from, "to": date_to}, "records_count": len(records),
            "total_waste_cost": total, "records": records}


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/shifts")
async def list_shifts(
    status: Optional[str] = None, cashier_id: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    page: int = 1, limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status:     q["status"] = status
    if cashier_id: q["cashier_id"] = cashier_id
    if date_from or date_to:
        q["shift_date"] = {}
        if date_from: q["shift_date"]["$gte"] = date_from
        if date_to:   q["shift_date"]["$lte"] = date_to
    limit = max(1, min(limit, 200))
    total = await db.pos_shifts.count_documents(q)
    shifts = await db.pos_shifts.find(q, {"_id": 0}).sort("shift_date", -1).skip((max(page, 1) - 1) * limit).limit(limit).to_list(None)
    return {
        "shifts": shifts, "total": total, "page": page,
        "summary": {
            "total_sales":    P.r2(sum(float(s.get("total_sales", 0)) for s in shifts)),
            "total_cash":     P.r2(sum(float(s.get("total_cash_sales", 0)) for s in shifts)),
            "total_card":     P.r2(sum(float(s.get("total_card_sales", 0)) for s in shifts)),
            "total_returns":  P.r2(sum(float(s.get("total_returns", 0) or 0) for s in shifts)),
            "cash_shortages": sum(1 for s in shifts if (s.get("cash_difference", 0) or 0) < 0),
            "cash_surpluses": sum(1 for s in shifts if (s.get("cash_difference", 0) or 0) > 0),
        }
    }


@router.get("/shifts/{shift_id}")
async def get_shift(shift_id: str, current_user: dict = Depends(get_current_user)):
    shift = await db.pos_shifts.find_one({"id": shift_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    shift["transactions"] = await db.pos_transactions.find(
        {"shift_id": shift_id, "company_id": current_user["company_id"]}, {"_id": 0}).to_list(None)
    return shift
