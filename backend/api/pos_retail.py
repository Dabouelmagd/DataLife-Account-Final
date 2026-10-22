"""
POS, Retail & F&B Engine — محرك نقاط البيع والتجزئة والمطاعم

1. إدارة الوردية (Shift Management)
   - فتح وردية الكاشير مع رصيد افتتاحي (عهدة من الخزينة 161 إلى درج الكاشير 164)
   - تسجيل المبيعات والمرتجعات خلال الوردية (الكمية تخرج/تعود للمخزن فوراً)
   - إغلاق الوردية: قيد واحد بالإيراد والضريبة والفروق، وقيد تكلفة (الجرد المستمر)
   - معالجة عجز أو زيادة الكاشير
2. تسوية مبيعات البطاقات (حين يوجد حساب تسويات معلقة 166/167 من باقة القطاع)
2ب. منصات التوصيل (باقة المطاعم): بيع بطريقة «منصة توصيل» (طلبات، Elmenus، مرسول…)
   يُقيَّد عند الإقفال على 147 مستحقات منصات التوصيل لكل منصة، والتسوية:
   Dr البنك (الصافي) + Dr 33613 عمولة المنصة / Cr 147 (الإجمالي)
3. تالف وهدر المواد (Waste & Spoilage)
   Dr م/33610 مصروف تالف وهدر (33612 هالك المطبخ مع باقة المطاعم)
   Cr م/125 مخزون (أو 311 في الجرد الدوري)
"""
import asyncio
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, ConfigDict, Field
from pymongo.errors import DuplicateKeyError

from database import db
from dependencies import get_current_user
from services import ops_posting as P
from services import pack_accounts as PA
from services import eta_receipt as ER

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
CARD_IN_TRANSIT = PA.codes("card_in_transit")
ALLOWED_SPOILAGE_ACCOUNTS = {"121", "122", "125", "1251", "1252", "1253", "1254", "1255", "1256", "1257"}

CASH_SHORTAGE_TOLERANCE = 50.0   # ج.م — العجز المسموح لكل وردية (قابل للتكوين لكل إقفال)


async def _card_account(company_id: str) -> str:
    acc = await PA.optional(db, company_id, "card_in_transit")
    return acc["account_code"] if acc else ACC["bank"]


async def _signed(company_id, code, amount, desc):
    """Positive → debit, negative → credit (a net refund day flips the side)."""
    amount = P.r2(amount)
    return await P.je_line(db, company_id, code, debit=max(amount, 0), credit=max(-amount, 0), desc=desc)


# ── delivery platforms (restaurants pack: 147 receivable, 33613 commission) ──
DELIVERY_PACK_MSG = ("البيع عن طريق منصات التوصيل (طلبات، Elmenus، مرسول…) يحتاج حساب مستحقات منصات التوصيل 147 — "
                     f"فعّل «{P.PACK_HINT.get('147', 'باقة المطاعم والكافيهات')}» من إعدادات الحسابات")


async def _delivery_account(company_id: str) -> dict:
    acc = await PA.optional(db, company_id, "delivery_receivable")
    if not acc:
        raise HTTPException(400, DELIVERY_PACK_MSG)
    return acc


def _platform_name(raw: Optional[str]) -> str:
    return " ".join(str(raw or "").split())[:60]


async def _check_delivery(company_id: str, method: str, platform: Optional[str]) -> Optional[str]:
    """The platform name for a delivery-platform sale/return (None otherwise)."""
    if method != "delivery":
        return None
    await _delivery_account(company_id)
    name = _platform_name(platform)
    if not name:
        raise HTTPException(400, "اكتب اسم منصة التوصيل (طلبات، Elmenus، مرسول…)")
    return name


async def _delivery_by_platform(company_id: str, shift: dict) -> dict:
    """Net delivery-platform sales of a shift per platform (sales − returns)."""
    if not (float(shift.get("total_delivery_sales") or 0) or float(shift.get("delivery_refunds") or 0)):
        return {}
    out = {}
    async for t in db.pos_transactions.find({"company_id": company_id, "shift_id": shift["id"],
                                             "payment_method": "delivery", "status": "committed"}, {"_id": 0}):
        sign = -1 if t.get("type") == "return" else 1
        name = t.get("platform") or "منصة توصيل"
        out[name] = P.r2(out.get(name, 0) + sign * float(t.get("amount") or 0))
    return {k: v for k, v in out.items() if v}


async def _platform_outstanding(company_id: str) -> dict:
    """Open balance per platform: shift closes add, settlements subtract."""
    out = {}
    async for r in db.pos_platform_ledger.find({"company_id": company_id}, {"_id": 0, "platform": 1, "amount": 1}):
        out[r["platform"]] = P.r2(out.get(r["platform"], 0) + float(r.get("amount") or 0))
    return out


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


class ReceiptBuyer(BaseModel):
    type:           Literal["P", "B", "F"] = "P"   # فرد / شركة / أجنبي
    id:             Optional[str] = None           # الرقم القومي أو رقم التسجيل
    name:           Optional[str] = None
    mobile:         Optional[str] = None
    payment_number: Optional[str] = None


class SaleRequest(BaseModel):
    # was a free dict: a negative amount was accepted (a "sale" that took money
    # out of revenue), VAT larger than the sale was accepted, and an unknown
    # payment method silently counted as wallet
    amount:         float = Field(gt=0)            # الإجمالي شامل الضريبة
    vat:            float = Field(0, ge=0)
    payment_method: Literal["cash", "card", "wallet", "delivery"] = "cash"
    # delivery platform name (طلبات / Elmenus / مرسول …) — only with payment_method "delivery"
    platform:       Optional[str] = Field(None, max_length=60)
    receipt_number: str = ""
    items:          List[SaleItem] = []
    # idempotency key made by the till once per sale; a retried upload with the
    # same key returns the first result. Old clients that send none get one here.
    client_uuid:    Optional[str] = Field(None, min_length=8, max_length=64)
    buyer:          Optional[ReceiptBuyer] = None


_txn_index_ready = False


async def _ensure_txn_index():
    global _txn_index_ready
    if not _txn_index_ready:
        # partial: transactions recorded before client_uuid existed have none
        await db.pos_transactions.create_index(
            [("company_id", 1), ("client_uuid", 1)], unique=True, name="company_client_uuid",
            partialFilterExpression={"client_uuid": {"$type": "string"}})
        _txn_index_ready = True


async def _claim_txn(company_id: str, shift_id: str, kind: str, client_uuid: str):
    """Claim-before-post: the unique (company_id, client_uuid) row is written
    first, so of two concurrent retries only one moves stock and totals.
    Returns (claim, None) for the winner, (None, existing) for a duplicate."""
    await _ensure_txn_index()
    for _ in range(100):
        claim = {"id": str(uuid.uuid4()), "company_id": company_id, "shift_id": shift_id, "type": kind,
                 "client_uuid": client_uuid, "status": "processing",
                 "claimed_at": datetime.now(timezone.utc).isoformat()}
        try:
            await db.pos_transactions.insert_one(claim)
            claim.pop("_id", None)
            return claim, None
        except DuplicateKeyError:
            pass
        ex = await db.pos_transactions.find_one({"company_id": company_id, "client_uuid": client_uuid}, {"_id": 0})
        if ex is None:
            continue                                   # the other attempt failed and let go
        if ex.get("shift_id") != shift_id or ex.get("type", "sale") != kind:
            raise HTTPException(422, "معرّف العملية مستخدم لعملية أخرى")
        if ex.get("status") != "processing":
            return None, ex
        await asyncio.sleep(0.05)                      # the first attempt is still posting
    raise HTTPException(409, "العملية قيد المعالجة — أعد المحاولة بعد لحظات")


async def _release(claim):
    await db.pos_transactions.delete_one({"id": claim["id"], "status": "processing"})


async def _duplicate_reply(company_id, txn, message):
    receipt = await ER.receipt_summary(db, company_id, txn["id"]) or \
        await ER.create_for_transaction(db, company_id, txn)
    return {"message": message, "transaction_id": txn["id"], "transaction": txn,
            "duplicate": True, "eta_receipt": receipt}


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
    amount, vat = P.r2(data.amount), P.r2(data.vat)
    if vat >= amount:
        raise HTTPException(400, "الضريبة لا يمكن أن تساوي أو تتجاوز إجمالي البيع")
    platform = await _check_delivery(company_id, data.payment_method, data.platform)
    claim, existing = await _claim_txn(company_id, shift_id, "sale", data.client_uuid or str(uuid.uuid4()))
    if existing:
        return await _duplicate_reply(company_id, existing, "البيع مسجّل من قبل")
    try:
        if shift["status"] != "open":
            raise HTTPException(400, "الوردية مغلقة")
        cost, items = await _move_items(company_id, shift, data.items, current_user["user_id"], data.receipt_number, -1)
    except BaseException:
        await _release(claim)
        raise
    inc = {"total_sales": amount, "total_vat": vat, "transactions_count": 1, "total_cost": cost,
           f"total_{data.payment_method}_sales": amount}
    txn = {
        **claim, "status": "committed",
        "receipt_number": data.receipt_number, "amount": amount, "vat": vat, "cost": cost,
        "payment_method": data.payment_method, "items": items,
        "buyer": data.buyer.model_dump() if data.buyer else None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if platform:
        txn["platform"] = platform
    await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id}, {"$inc": inc})
    await db.pos_transactions.update_one({"id": claim["id"]}, {"$set": txn})
    # the sale stands whatever happens to its e-receipt (errors are kept on the receipt)
    receipt = await ER.create_for_transaction(db, company_id, txn)
    return {"message": "تم تسجيل البيع", "transaction_id": txn["id"], "transaction": txn,
            "duplicate": False, "eta_receipt": receipt}


class ReturnRequest(BaseModel):
    amount:           float = Field(gt=0)          # المرتجع شامل الضريبة
    vat:              float = Field(0, ge=0)
    payment_method:   Literal["cash", "card", "wallet", "delivery"] = "cash"   # طريقة رد المبلغ
    platform:         Optional[str] = Field(None, max_length=60)
    original_receipt: str = Field(min_length=1)
    reason:           Optional[str] = None
    items:            List[SaleItem] = []
    client_uuid:      Optional[str] = Field(None, min_length=8, max_length=64)


@router.post("/shifts/{shift_id}/return")
async def record_return(shift_id: str, data: ReturnRequest,
                        current_user: dict = Depends(get_current_user)):
    """مرتجع مبيعات داخل الوردية — يُقيَّد عند الإغلاق على 413 (مردودات المبيعات)
    مع رد ضريبة المخرجات 260، وتعود الأصناف للمخزن."""
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one({"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    amount, vat = P.r2(data.amount), P.r2(data.vat)
    if vat >= amount:
        raise HTTPException(400, "الضريبة لا يمكن أن تساوي أو تتجاوز قيمة المرتجع")
    platform = await _check_delivery(company_id, data.payment_method, data.platform)
    claim, existing = await _claim_txn(company_id, shift_id, "return", data.client_uuid or str(uuid.uuid4()))
    if existing:
        return await _duplicate_reply(company_id, existing, "المرتجع مسجّل من قبل")
    try:
        if shift["status"] != "open":
            raise HTTPException(400, "الوردية مغلقة")
        cost, items = await _move_items(company_id, shift, data.items, current_user["user_id"], data.original_receipt, +1)
    except BaseException:
        await _release(claim)
        raise
    txn = {
        **claim, "status": "committed",
        "receipt_number": data.original_receipt, "amount": amount, "vat": vat, "cost": cost,
        "payment_method": data.payment_method, "items": items, "reason": data.reason,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if platform:
        txn["platform"] = platform
    await db.pos_shifts.update_one({"id": shift_id, "company_id": company_id}, {"$inc": {
        "total_returns": amount, "total_returns_vat": vat, "returns_cost": cost, "returns_count": 1,
        f"{data.payment_method}_refunds": amount}})
    await db.pos_transactions.update_one({"id": claim["id"]}, {"$set": txn})
    receipt = await ER.create_for_transaction(db, company_id, txn)
    return {"message": "تم تسجيل المرتجع", "transaction_id": txn["id"], "transaction": txn,
            "duplicate": False, "eta_receipt": receipt}


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
    # restaurants pack: delivery-platform sales are owed by the platform (147), per platform
    delivery = await _delivery_by_platform(company_id, shift)
    if delivery:
        dacc = (await _delivery_account(company_id))["account_code"]
        for name, amt in sorted(delivery.items()):
            lines.append(await _signed(company_id, dacc, amt, f"مستحق على منصة {name} — وردية {who}"))
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
        # restaurants pack: 347 تكلفة الأغذية والمشروبات; otherwise 314
        cogs_acc = await PA.pick_code(db, company_id, "pos_cost_of_sales")
        cogs_lines = [
            await _signed(company_id, cogs_acc, net_cost, f"تكلفة مبيعات وردية {who}"),
            await _signed(company_id, ACC["fnb_inventory"], -net_cost, f"إخراج بضاعة مباعة — وردية {who}"),
        ]
    summary = {"expected_cash": expected, "cash_difference": diff, "shortage_type": shortage_type,
               "sales_net": sales_net, "returns_net": returns_net, "noncash_net": noncash_net,
               "card_account": card_acc, "net_cost": net_cost}
    if delivery:
        summary["delivery_by_platform"] = delivery
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
    Dr 147 مستحقات منصات التوصيل (باقة المطاعم) — سطر لكل منصة
    Dr 413 مردودات + Dr 260 ضريبة المرتجعات
    Dr 3353 عجز مسموح | Dr 1313 عجز على الكاشير | Cr 4231 زيادة
    Cr 4121 إيرادات نقاط البيع          Cr 260 ضريبة المخرجات
    وفي الجرد المستمر قيد التكلفة: Dr 314 (347 مع باقة المطاعم) / Cr 125
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
        **({"delivery_by_platform": s["delivery_by_platform"]} if s.get("delivery_by_platform") else {}),
    }})
    for name, amt in (s.get("delivery_by_platform") or {}).items():
        await db.pos_platform_ledger.insert_one({
            "id": str(uuid.uuid4()), "company_id": company_id, "platform": name, "kind": "shift",
            "amount": amt, "date": date_str, "shift_id": shift_id, "journal_entry_id": je_id,
            "created_at": datetime.now(timezone.utc).isoformat()})
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
    Dr 162 البنك (الصافي) + Dr 334 عمولة بنكية (3472 مع باقة التجزئة) / Cr 166|167 تسويات البطاقات المعلقة"""
    company_id = current_user["company_id"]
    transit = (await PA.optional(db, company_id, "card_in_transit") or {}).get("account_code")
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
        # retail pack: 3472 عمولات شبكات الدفع; otherwise 334
        await P.je_line(db, company_id, await PA.pick_code(db, company_id, "card_network_fee"),
                        debit=req.commission, desc="عمولة ماكينات الدفع"),
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
# 2b. DELIVERY PLATFORMS — منصات التوصيل (باقة المطاعم)
# ══════════════════════════════════════════════════════════════

class DeliverySettlementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date:         str
    platform:     str = Field(min_length=1, max_length=60)
    gross_amount: float = Field(gt=0)        # ما تُسوّيه المنصة من مستحقاتنا (قبل العمولة)
    commission:   float = Field(0, ge=0)     # عمولة المنصة
    bank_account: str = "162"
    reference:    Optional[str] = Field(None, max_length=120)


@router.get("/delivery-platforms")
async def delivery_platforms(current_user: dict = Depends(get_current_user)):
    """المستحق على كل منصة توصيل + آخر التسويات. available=false بدون باقة المطاعم."""
    company_id = current_user["company_id"]
    acc = await PA.optional(db, company_id, "delivery_receivable")
    if not acc:
        return {"available": False, "message": DELIVERY_PACK_MSG, "platforms": [], "settlements": [], "total_outstanding": 0.0}
    bal = await _platform_outstanding(company_id)
    rows = await db.pos_delivery_settlements.find({"company_id": company_id}, {"_id": 0}).sort("date", -1).to_list(200)
    platforms = [{"platform": k, "outstanding": v} for k, v in sorted(bal.items(), key=lambda x: -x[1])]
    return {"available": True, "account": acc["account_code"], "platforms": platforms, "settlements": rows,
            "commission_account": (await PA.optional(db, company_id, "delivery_commission") or {}).get("account_code"),
            "total_outstanding": P.r2(sum(bal.values()))}


@router.post("/delivery-settlements")
async def settle_delivery_platform(req: DeliverySettlementRequest, current_user: dict = Depends(get_current_user)):
    """تحويل المنصة لمستحقاتنا بعد خصم عمولتها:
    Dr البنك (الصافي) + Dr 33613 عمولات منصات التوصيل / Cr 147 مستحقات منصات التوصيل (الإجمالي)"""
    company_id = current_user["company_id"]
    receivable = (await _delivery_account(company_id))["account_code"]
    commission_acc = await PA.pick_code(db, company_id, "delivery_commission")
    name = _platform_name(req.platform)
    if not req.bank_account.startswith("16") or req.bank_account in CARD_IN_TRANSIT or req.bank_account == receivable:
        raise HTTPException(400, "اختر حساب بنك أو خزينة صحيحاً")
    if req.commission >= req.gross_amount:
        raise HTTPException(400, "العمولة لا يمكن أن تساوي أو تتجاوز المبلغ")
    outstanding = (await _platform_outstanding(company_id)).get(name, 0.0)
    if req.gross_amount > outstanding + 0.01:
        raise HTTPException(400, f"المستحق على منصة {name} {outstanding:,.2f} ج.م فقط — "
                                 "المبيعات تُضاف للمستحق عند إقفال الوردية")
    gross, commission = P.r2(req.gross_amount), P.r2(req.commission)
    net = P.r2(gross - commission)
    sid = str(uuid.uuid4())
    lines = [
        await P.je_line(db, company_id, req.bank_account, debit=net, desc=f"تحويل منصة {name} {req.reference or ''}".strip()),
        await P.je_line(db, company_id, commission_acc, debit=commission, desc=f"عمولة منصة {name}"),
        await P.je_line(db, company_id, receivable, credit=gross, desc=f"تسوية مستحقات منصة {name}"),
    ]
    je_id = await P.post_je(db, company_id, current_user["user_id"], req.date, f"تسوية منصة توصيل — {name}",
                            lines, "pos_delivery_settlement", sid, req.reference)
    rec = {"id": sid, "company_id": company_id, "date": req.date, "platform": name, "gross_amount": gross,
           "commission": commission, "net_amount": net, "bank_account": req.bank_account,
           "receivable_account": receivable, "commission_account": commission_acc, "reference": req.reference,
           "journal_entry_id": je_id, "created_by": current_user["user_id"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.pos_delivery_settlements.insert_one(rec); rec.pop("_id", None)
    await db.pos_platform_ledger.insert_one({
        "id": str(uuid.uuid4()), "company_id": company_id, "platform": name, "kind": "settlement",
        "amount": -gross, "date": req.date, "settlement_id": sid, "journal_entry_id": je_id,
        "created_at": rec["created_at"]})
    return {"message": f"تم تسجيل تسوية {name} بصافي {net:,.2f} ج.م", "settlement": rec,
            "outstanding": P.r2(outstanding - gross)}


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
    Dr م/33610 مصروف تالف وهدر (33612 مع باقة المطاعم)
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
    # restaurants pack: 33612 هالك وفاقد المطبخ; otherwise 33610
    waste_acc = await PA.pick_code(db, company_id, "pos_waste")
    lines = [await P.je_line(db, company_id, waste_acc, debit=total_cost,
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
        "journal": {"id": je_id, "debit": f"م/{waste_acc} مصروف تالف وهدر  {total_cost:,.2f}",
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
    company_id = current_user["company_id"]
    txns = await db.pos_transactions.find(
        {"shift_id": shift_id, "company_id": company_id, "status": {"$ne": "processing"}}, {"_id": 0}).to_list(None)
    receipts = await db.eta_receipts.find(
        {"company_id": company_id, "transaction_id": {"$in": [t["id"] for t in txns]}},
        {"_id": 0, "transaction_id": 1, "status": 1, "uuid": 1, "error": 1, "long_id": 1}).to_list(None)
    by_txn = {r.pop("transaction_id"): r for r in receipts}
    for t in txns:
        t["eta_receipt"] = by_txn.get(t["id"])
    shift["transactions"] = txns
    return shift


# ══════════════════════════════════════════════════════════════
# 4. ETA E-RECEIPTS — الإيصال الإلكتروني لنقاط البيع
# Not verified against the live ETA preprod — see services/eta_receipt.py.
# ══════════════════════════════════════════════════════════════

ETA_ADMIN_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام", "المدير العام",
                   "CEO", "المدير التنفيذي", "Financial Manager", "المدير المالي", "Super Admin", "admin", "owner"}


class EtaPosSettingsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    environment:         Optional[Literal["preprod", "production"]] = None
    device_serial:       Optional[str] = Field(None, max_length=100)
    client_id:           Optional[str] = Field(None, max_length=200)
    client_secret:       Optional[str] = Field(None, max_length=500)   # فارغ = بدون تغيير
    pre_shared_key:      Optional[str] = Field(None, max_length=500)
    pos_os_version:      Optional[str] = Field(None, max_length=100)
    pos_model_framework: Optional[str] = Field(None, max_length=100)
    activity_code:       Optional[str] = Field(None, max_length=10)
    branch_code:         Optional[str] = Field(None, max_length=20)
    default_item_code:   Optional[str] = Field(None, max_length=100)
    default_item_type:   Optional[Literal["EGS", "GS1"]] = None
    rin:                 Optional[str] = Field(None, max_length=20)
    company_trade_name:  Optional[str] = Field(None, max_length=200)
    governate:           Optional[str] = None
    region_city:         Optional[str] = None
    street:              Optional[str] = None
    building_number:     Optional[str] = None
    postal_code:         Optional[str] = None


def _public_pos_settings(raw: dict) -> dict:
    out = {k: v for k, v in raw.items() if k not in ("client_secret_enc", "pre_shared_key_enc", "company_id")}
    out["has_client_secret"] = bool(raw.get("client_secret_enc"))
    out["has_pre_shared_key"] = bool(raw.get("pre_shared_key_enc"))
    return out


@router.get("/eta-settings")
async def get_eta_pos_settings(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    raw = await db.company_eta_pos_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    merged = await ER.load_settings(db, company_id)
    return {"settings": _public_pos_settings(raw),
            "effective": {k: merged[k] for k in ("rin", "company_trade_name", "branch_code", "activity_code",
                                                  "device_serial", "environment", "address")},
            "missing": ER.submit_problems(merged)}


@router.put("/eta-settings")
async def put_eta_pos_settings(req: EtaPosSettingsRequest, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ETA_ADMIN_ROLES:
        raise HTTPException(403, "تعديل إعدادات الإيصال الإلكتروني للإدارة فقط")
    from services.eta_signer import encrypt
    company_id = current_user["company_id"]
    data = req.model_dump(exclude_none=True)
    upd = {k: (v.strip() if isinstance(v, str) else v) for k, v in data.items()
           if k not in ("client_secret", "pre_shared_key")}
    if data.get("client_secret"):
        upd["client_secret_enc"] = encrypt(data["client_secret"].encode())
    if data.get("pre_shared_key"):
        upd["pre_shared_key_enc"] = encrypt(data["pre_shared_key"].encode())
    if "rin" in upd and upd["rin"] and (len(upd["rin"]) != 9 or not upd["rin"].isdigit()):
        raise HTTPException(400, "رقم التسجيل الضريبي يجب أن يكون 9 أرقام")
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd["updated_by"] = current_user.get("user_id")
    await db.company_eta_pos_settings.update_one({"company_id": company_id},
                                                 {"$set": upd, "$setOnInsert": {"company_id": company_id}}, upsert=True)
    # receipts waiting for settings can be built now
    built = await ER.build_waiting(db, company_id)
    return {"message": "تم حفظ إعدادات الإيصال الإلكتروني", "built": built,
            **(await get_eta_pos_settings(current_user))}


@router.get("/eta-receipts")
async def list_eta_receipts(status: Optional[Literal["pending", "submitted", "rejected", "error"]] = None,
                            shift_id: Optional[str] = None, limit: int = 100,
                            current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if status:
        q["status"] = status
    if shift_id:
        q["shift_id"] = shift_id
    rows = await db.eta_receipts.find(q, {"_id": 0, "document": 0}).sort("issued_at", -1).limit(max(1, min(limit, 500))).to_list(None)
    counts = {}
    for st in ("pending", "submitted", "rejected", "error"):
        counts[st] = await db.eta_receipts.count_documents({"company_id": company_id, "status": st})
    return {"receipts": rows, "counts": counts}


@router.post("/eta-receipts/submit-now")
async def submit_eta_receipts_now(current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    rebuilt = await ER.build_waiting(db, company_id, include_errors=True)
    res = await ER.submit_pending_receipts(db, company_id)
    r = res[0] if res else {"submitted": 0, "rejected": 0}
    if r.get("skipped"):
        msg = f"لم يُرسل شيء — {r['skipped']}"
    elif r.get("error"):
        msg = f"تعذّر الإرسال: {r['error']}"
    else:
        msg = f"أُرسل {r.get('submitted', 0)} إيصال — مرفوض {r.get('rejected', 0)}"
    return {"message": msg, "rebuilt": rebuilt, "result": r}
