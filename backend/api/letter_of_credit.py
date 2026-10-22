"""
Letter of Credit Engine — محرك الاعتمادات المستندية للاستيراد الخارجي

الدورة:
1. فتح الاعتماد      — Dr 165 غطاء محتجز + Dr 3371 عمولة فتح / Cr البنك
2. تكاليف الاستيراد  — Dr 123 بضاعة بالطريق / Cr البنك أو الخزينة أو الموردين
   (شحن، تأمين بحري، جمارك، تخليص — كلها جزء من تكلفة البضاعة، المعيار المصري 2)
3. سداد المستندات    — Dr 123 قيمة البضاعة بسعر صرف السداد / Cr 165 الغطاء + Cr البنك الباقي
4. وصول البضاعة      — Dr 125 (أو 121 خامات، أو 311 في الجرد الدوري) / Cr 123 كامل رصيد الاعتماد
                        + دخول الكميات للمخزن بالتكلفة الشاملة (Landed Cost)
5. الإقفال           — رد ما تبقى من الغطاء: Dr البنك / Cr 165
                        أو الإلغاء قبل السداد: رد الغطاء وتحميل التكاليف المدفوعة على مصروفاتها

What was wrong (and is fixed here):
- "receive" debited stock with margin + costs and credited the margin: the
  supplier was never paid in the books, so with a 20% margin the goods were
  carried at 20% of their price and 80% of the cost vanished.
- receive could be called twice (only "closed" was blocked) and costs could be
  added after receipt, so they sat in 123 forever.
- "in_transit" as a receive option debited AND credited 123.
- settle summed 123 across EVERY letter of the company and posted nothing.
- no quantity ever reached the warehouse.
- the old helpers posted to a fake account id when a code was missing.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from database import db
from dependencies import get_current_user
from services import ops_posting as P
from services import pack_accounts as PA

router = APIRouter(prefix="/api/lc", tags=["Letter of Credit"])

ACC = {
    "lc_margin":   "165",   # غطاء اعتمادات مستندية محتجز
    "in_transit":  "123",   # مخزون بضاعة بالطريق / اعتمادات (الحساب الوسيط)
    "lc_commis":   "3371",  # عمولات فتح الاعتمادات المستندية
    "bank":        "162",
    "cash":        "161",
    "ap":          "251",   # الموردون (شركة الشحن / المخلص)
}

COST_TYPES = {   # type → (expense account used only if the LC is cancelled, Arabic label)
    "freight":   ("3372", "مصاريف شحن دولي"),
    "insurance": ("3373", "تأمين بحري"),
    "customs":   ("3374", "رسوم جمركية"),
    "clearance": ("3375", "تخليص جمركي وميناء"),
    "bank":      ("334",  "مصروفات وعمولات بنكية"),
    "other":     ("3375", "مصاريف استيراد أخرى"),
    # import pack: on cancellation these go to 3376/3377/3378; without it to 3375 like "other"
    "demurrage":      ("3375", "أرضيات وتفريغ ومصاريف موانئ"),
    "inspection":     ("3375", "فحص ورقابة على الواردات"),
    "inland_haulage": ("3375", "نولون نقل داخلي من الميناء للمخازن"),
}
COST_PACK_ROLE = {"demurrage": "import_demurrage", "inspection": "import_inspection",
                  "inland_haulage": "import_inland_haulage"}


def _bank(code: str) -> str:
    if not code or not code.startswith("16") or code in ("163", "164", "165"):
        raise HTTPException(400, "حساب البنك/الخزينة غير صحيح — اختر 161 أو 162 أو حساب بنك فرعي")
    return code


async def _post_je(company_id, user_id, date_str, desc, lines, lc_id, ref):
    return await P.post_je(db, company_id, user_id, date_str, desc, lines, "letter_of_credit", lc_id, ref)


async def _get(company_id: str, lc_id: str) -> dict:
    lc = await db.letters_of_credit.find_one({"id": lc_id, "company_id": company_id}, {"_id": 0})
    if not lc:
        raise HTTPException(404, "الاعتماد غير موجود")
    return lc


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class OpenLCRequest(BaseModel):
    lc_number:         str = Field(min_length=1, max_length=60)
    supplier_name:     str = Field(min_length=1, max_length=200)
    supplier_country:  str = ""
    goods_description: str = ""
    lc_currency:       str = "USD"
    lc_amount_foreign: float = Field(gt=0)
    exchange_rate:     float = Field(1.0, gt=0)
    margin_amount:     float = Field(0, ge=0)      # الغطاء النقدي بالجنيه
    bank_commission:   float = Field(0, ge=0)      # عمولة فتح الاعتماد
    open_date:         str
    expiry_date:       str
    bank_account:      str = "162"
    notes:             Optional[str] = None


class CostItem(BaseModel):
    cost_type:   Literal["freight", "insurance", "customs", "clearance", "bank", "other",
                         "demurrage", "inspection", "inland_haulage"]
    description: str = ""
    amount_egp:  float = Field(gt=0)
    invoice_ref: Optional[str] = None


class AddCostsRequest(BaseModel):
    lc_id:       Optional[str] = None     # kept for old clients; the path wins
    date_str:    str
    costs:       List[CostItem] = Field(min_length=1)
    payment_src: Literal["bank", "cash", "supplier"] = "bank"
    bank_account: Optional[str] = None
    notes:       Optional[str] = None


class PayDocumentsRequest(BaseModel):
    date_str:      str
    exchange_rate: Optional[float] = Field(None, gt=0)   # سعر الصرف يوم السداد
    amount_foreign: Optional[float] = Field(None, gt=0)  # فارغ = قيمة الاعتماد
    bank_account:  Optional[str] = None
    notes:         Optional[str] = None


class ReceiveItem(BaseModel):
    product_id:    str
    quantity:      float = Field(gt=0)
    foreign_value: Optional[float] = Field(None, ge=0)    # لتوزيع التكلفة بالقيمة؛ فارغ = بالكمية


class ReceiveGoodsRequest(BaseModel):
    lc_id:          Optional[str] = None
    date_str:       str
    goods_received: Literal["goods", "raw_material", "finished_goods"] = "goods"
    warehouse_id:   Optional[str] = None
    items:          List[ReceiveItem] = []
    quantity_received: Optional[float] = None   # legacy, informational
    notes:          Optional[str] = None


class SettleRequest(BaseModel):
    lc_id:    Optional[str] = None
    date_str: str
    bank_account: Optional[str] = None
    notes:    Optional[str] = None


# ══════════════════════════════════════════════════════════════
# 1. فتح الاعتماد
# ══════════════════════════════════════════════════════════════

@router.post("/open")
async def open_lc(req: OpenLCRequest, current_user: dict = Depends(get_current_user)):
    """Dr 165 غطاء + Dr 3371 عمولة / Cr البنك"""
    company_id = current_user["company_id"]
    bank = _bank(req.bank_account)
    if await db.letters_of_credit.find_one({"company_id": company_id, "lc_number": req.lc_number}, {"_id": 1}):
        raise HTTPException(400, f"رقم الاعتماد {req.lc_number} مسجل من قبل")
    if req.expiry_date < req.open_date:
        raise HTTPException(400, "تاريخ انتهاء الاعتماد قبل تاريخ فتحه")
    lc_id = str(uuid.uuid4())
    margin, commission = P.r2(req.margin_amount), P.r2(req.bank_commission)
    total_paid = P.r2(margin + commission)
    lc_amount_egp = P.r2(req.lc_amount_foreign * req.exchange_rate)

    lines = [
        await P.je_line(db, company_id, ACC["lc_margin"], debit=margin, desc=f"غطاء اعتماد {req.lc_number} — {req.supplier_name}"),
        await P.je_line(db, company_id, ACC["lc_commis"], debit=commission, desc=f"عمولة فتح اعتماد {req.lc_number}"),
        await P.je_line(db, company_id, bank, credit=total_paid, desc=f"خصم بنكي — فتح اعتماد مستندي {req.lc_number}"),
    ]
    je_id = await _post_je(company_id, current_user["user_id"], req.open_date,
                        f"فتح اعتماد مستندي {req.lc_number} — {req.supplier_name}", lines, lc_id, req.lc_number)

    lc = {
        "id": lc_id, "company_id": company_id,
        "lc_number": req.lc_number, "supplier_name": req.supplier_name,
        "supplier_country": req.supplier_country, "goods_description": req.goods_description,
        "lc_currency": req.lc_currency, "lc_amount_foreign": req.lc_amount_foreign,
        "exchange_rate": req.exchange_rate, "lc_amount_egp": lc_amount_egp,
        "margin_amount": margin, "margin_used": 0.0, "bank_commission": commission,
        "bank_account": bank,
        "total_paid_on_open": total_paid,
        "accumulated_costs": 0.0,         # تكاليف الاستيراد المجمعة على 123
        "goods_value_egp": 0.0,           # قيمة المستندات المسددة
        "in_transit_balance": 0.0,        # رصيد 123 الخاص بهذا الاعتماد
        "total_lc_cost": total_paid,
        "open_date": req.open_date, "expiry_date": req.expiry_date,
        "status": "open", "cost_entries": [],
        "open_je_id": je_id, "pay_je_id": None, "receive_je_id": None, "settle_je_id": None,
        "notes": req.notes, "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.letters_of_credit.insert_one(lc); lc.pop("_id", None)
    return {"message": f"✅ تم فتح الاعتماد المستندي {req.lc_number}", "lc_id": lc_id, "lc": lc,
            "journal": {"id": je_id, "balanced": True}}


# ══════════════════════════════════════════════════════════════
# 2. تكاليف الاستيراد
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/costs")
async def add_lc_costs(lc_id: str, req: AddCostsRequest, current_user: dict = Depends(get_current_user)):
    """Dr 123 بضاعة بالطريق / Cr البنك أو الخزينة أو الموردين"""
    company_id = current_user["company_id"]
    lc = await _get(company_id, lc_id)
    if lc["status"] in ("received", "closed", "cancelled"):
        raise HTTPException(400, "استُلمت البضاعة أو أُغلق الاعتماد — سجّل التكلفة الإضافية من «تكاليف الاستيراد» في محرك المخزون")
    total = P.r2(sum(P.r2(c.amount_egp) for c in req.costs))
    src = {"bank": req.bank_account or lc.get("bank_account") or ACC["bank"], "cash": ACC["cash"], "supplier": ACC["ap"]}[req.payment_src]
    if req.payment_src == "bank":
        _bank(src)
    entry_id = str(uuid.uuid4())
    lines = [await P.je_line(db, company_id, ACC["in_transit"], debit=c.amount_egp,
                             desc=f"{COST_TYPES[c.cost_type][1]} — اعتماد {lc['lc_number']} {c.description}".strip())
             for c in req.costs]
    lines.append(await P.je_line(db, company_id, src, credit=total, desc=f"تكاليف استيراد — اعتماد {lc['lc_number']}"))
    je_id = await _post_je(company_id, current_user["user_id"], req.date_str,
                        f"تكاليف اعتماد {lc['lc_number']}", lines, lc_id, lc["lc_number"])

    cost_record = {"id": entry_id, "date": req.date_str, "payment_src": req.payment_src, "credit_account": src,
                   "costs": [{"type": c.cost_type, "type_ar": COST_TYPES[c.cost_type][1], "description": c.description,
                              "amount_egp": P.r2(c.amount_egp), "invoice_ref": c.invoice_ref} for c in req.costs],
                   "total": total, "je_id": je_id, "notes": req.notes}
    await db.letters_of_credit.update_one({"id": lc_id, "company_id": company_id}, {
        "$set": {"in_transit_balance": P.r2(float(lc.get("in_transit_balance", lc.get("accumulated_costs", 0)) or 0) + total)},
        "$inc": {"accumulated_costs": total, "total_lc_cost": total},
        "$push": {"cost_entries": cost_record}})
    lc = await _get(company_id, lc_id)
    return {"message": f"✅ تم إضافة تكاليف الاعتماد {lc['lc_number']}", "lc_id": lc_id, "costs_added": total,
            "accumulated_costs": lc["accumulated_costs"], "total_lc_cost": lc["total_lc_cost"],
            "journal": {"id": je_id, "balanced": True}}


# ══════════════════════════════════════════════════════════════
# 3. سداد المستندات للمورد الأجنبي
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/pay")
async def pay_documents(lc_id: str, req: PayDocumentsRequest, current_user: dict = Depends(get_current_user)):
    """Dr 123 قيمة البضاعة / Cr 165 الغطاء المستخدم + Cr البنك الباقي"""
    company_id = current_user["company_id"]
    lc = await _get(company_id, lc_id)
    if lc["status"] not in ("open", "in_transit"):
        raise HTTPException(400, "تم سداد مستندات هذا الاعتماد أو أُغلق")
    rate = req.exchange_rate or float(lc["exchange_rate"])
    foreign = req.amount_foreign or float(lc["lc_amount_foreign"])
    value = P.r2(foreign * rate)
    margin_used = P.r2(min(float(lc["margin_amount"]), value))
    bank = _bank(req.bank_account or lc.get("bank_account") or ACC["bank"])
    lines = [
        await P.je_line(db, company_id, ACC["in_transit"], debit=value,
                        desc=f"قيمة مستندات اعتماد {lc['lc_number']} — {foreign:,.2f} {lc['lc_currency']} × {rate:g}"),
        await P.je_line(db, company_id, ACC["lc_margin"], credit=margin_used, desc=f"استخدام غطاء اعتماد {lc['lc_number']}"),
        await P.je_line(db, company_id, bank, credit=P.r2(value - margin_used), desc=f"سداد باقي قيمة اعتماد {lc['lc_number']}"),
    ]
    je_id = await _post_je(company_id, current_user["user_id"], req.date_str,
                        f"سداد مستندات اعتماد {lc['lc_number']} — {lc['supplier_name']}", lines, lc_id, lc["lc_number"])
    await db.letters_of_credit.update_one({"id": lc_id, "company_id": company_id}, {
        "$set": {"status": "paid", "pay_je_id": je_id, "pay_date": req.date_str, "pay_exchange_rate": rate,
                 "margin_used": margin_used, "goods_value_egp": value,
                 # letters opened before this version carry their costs only in accumulated_costs
                 "in_transit_balance": P.r2(float(lc.get("in_transit_balance", lc.get("accumulated_costs", 0)) or 0) + value)},
        "$inc": {"total_lc_cost": value}})
    return {"message": f"✅ تم سداد مستندات الاعتماد {lc['lc_number']}", "goods_value_egp": value,
            "margin_used": margin_used, "bank_paid": P.r2(value - margin_used), "journal_entry_id": je_id}


# ══════════════════════════════════════════════════════════════
# 4. وصول البضاعة
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/receive")
async def receive_goods(lc_id: str, req: ReceiveGoodsRequest, current_user: dict = Depends(get_current_user)):
    """Dr 125/121 (311 في الجرد الدوري) / Cr 123 — بكامل رصيد الاعتماد (قيمة + تكاليف)،
    والكميات تدخل المخزن مرة واحدة بالتكلفة الشاملة. لا تُسجَّل فاتورة شراء لنفس البضاعة."""
    company_id = current_user["company_id"]
    lc = await _get(company_id, lc_id)
    if lc["status"] in ("received", "closed", "cancelled"):
        raise HTTPException(400, "تم استلام بضاعة هذا الاعتماد من قبل — لا يُستلم مرتين")
    if lc["status"] != "paid":
        raise HTTPException(400, "سجّل سداد المستندات أولاً — قيمة البضاعة لم تُثبت بعد")
    claimed = await db.letters_of_credit.update_one({"id": lc_id, "company_id": company_id, "status": "paid"},
                                                    {"$set": {"status": "receiving"}})
    if not claimed.modified_count:
        raise HTTPException(409, "جارٍ استلام البضاعة بالفعل")
    try:
        kind = {"goods": "goods", "raw_material": "raw", "finished_goods": "goods"}[req.goods_received]
        inv_code = await P.stock_account(db, company_id, kind)
        total = P.r2(lc.get("in_transit_balance") or 0)
        if total <= 0:
            raise HTTPException(400, "لا يوجد رصيد على هذا الاعتماد لتحويله للمخزون")
        wh = req.warehouse_id or await P.default_warehouse_id(db, company_id)
        # allocate the landed cost: by foreign value when every line has one, else by quantity
        alloc = []
        if req.items:
            for it in req.items:
                await P.get_product(db, company_id, it.product_id)
            by_value = all(it.foreign_value for it in req.items)
            base = [it.foreign_value if by_value else it.quantity for it in req.items]
            tb = sum(base)
            run = 0.0
            for i, it in enumerate(req.items):
                share = P.r2(total - run) if i == len(req.items) - 1 else P.r2(total * base[i] / tb)
                run += share
                alloc.append({"product_id": it.product_id, "quantity": it.quantity, "landed_cost": share,
                              "unit_cost": round(share / it.quantity, 4)})
        lines = [
            await P.je_line(db, company_id, inv_code, debit=total,
                            desc=f"استلام بضاعة اعتماد {lc['lc_number']} — {lc.get('goods_description', '')}"),
            await P.je_line(db, company_id, ACC["in_transit"], credit=total, desc=f"إقفال بضاعة بالطريق — اعتماد {lc['lc_number']}"),
        ]
        je_id = await _post_je(company_id, current_user["user_id"], req.date_str,
                            f"استلام بضاعة اعتماد {lc['lc_number']}", lines, lc_id, lc["lc_number"])
    except Exception:
        await db.letters_of_credit.update_one({"id": lc_id, "company_id": company_id}, {"$set": {"status": "paid"}})
        raise
    for a in alloc:
        await P.stock_in(db, company_id, a["product_id"], wh, a["quantity"], a["unit_cost"], date_str=req.date_str,
                         source_type="letter_of_credit", source_id=lc_id, user_id=current_user["user_id"], mtype="purchase")
    await db.letters_of_credit.update_one({"id": lc_id, "company_id": company_id}, {"$set": {
        "status": "received", "receive_je_id": je_id, "receive_date": req.date_str,
        "inventory_account": inv_code, "warehouse_id": wh, "received_items": alloc,
        "total_inventory_cost": total, "in_transit_balance": 0.0}})
    return {
        "message": f"✅ تم استلام بضاعة الاعتماد {lc['lc_number']}",
        "lc_id": lc_id, "inventory_account": inv_code, "total_inventory_cost": total,
        "cost_breakdown": {"goods_value": lc.get("goods_value_egp", 0), "import_costs": lc.get("accumulated_costs", 0),
                           "total_landed_cost": total},
        "items": alloc, "journal": {"id": je_id, "balanced": True},
    }


# ══════════════════════════════════════════════════════════════
# 5. الإقفال / الإلغاء
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/settle")
async def settle_lc(lc_id: str, req: SettleRequest, current_user: dict = Depends(get_current_user)):
    """
    بعد الاستلام: رد ما تبقى من الغطاء للبنك (Dr البنك / Cr 165) وإقفال الملف.
    قبل السداد (إلغاء): رد كامل الغطاء، وتحميل التكاليف المدفوعة على مصروفاتها (Dr 3372..3375، و3376..3378 مع باقة الاستيراد / Cr 123).
    """
    company_id = current_user["company_id"]
    lc = await _get(company_id, lc_id)
    if lc["status"] in ("closed", "cancelled"):
        raise HTTPException(400, "الاعتماد مُغلَق بالفعل")
    if lc["status"] in ("paid", "receiving"):
        raise HTTPException(400, "تم سداد المستندات — استلم البضاعة أولاً ثم أغلق الاعتماد")
    bank = _bank(req.bank_account or lc.get("bank_account") or ACC["bank"])
    cancel = lc["status"] != "received"
    margin_left = P.r2(float(lc.get("margin_amount", 0)) - float(lc.get("margin_used", 0)))
    lines = [
        await P.je_line(db, company_id, bank, debit=margin_left, desc=f"رد غطاء اعتماد {lc['lc_number']}"),
        await P.je_line(db, company_id, ACC["lc_margin"], credit=margin_left, desc=f"إقفال غطاء اعتماد {lc['lc_number']}"),
    ]
    # letters opened before this version have no in_transit_balance field
    if cancel and float(lc.get("in_transit_balance", lc.get("accumulated_costs", 0)) or 0) > 0:
        by_type: dict = {}
        for e in lc.get("cost_entries", []):
            for c in e.get("costs", []):
                t = c.get("type")
                acc = await PA.pick_code(db, company_id, COST_PACK_ROLE[t]) if t in COST_PACK_ROLE \
                    else COST_TYPES.get(t, COST_TYPES["other"])[0]
                by_type[acc] = P.r2(by_type.get(acc, 0) + float(c.get("amount_egp", 0)))
        for acc, amt in by_type.items():
            lines.append(await P.je_line(db, company_id, acc, debit=amt, desc=f"تكاليف اعتماد ملغى {lc['lc_number']}"))
        lines.append(await P.je_line(db, company_id, ACC["in_transit"], credit=P.r2(sum(by_type.values())),
                                     desc=f"إقفال تكاليف اعتماد ملغى {lc['lc_number']}"))
    je_id = await _post_je(company_id, current_user["user_id"], req.date_str,
                        f"{'إلغاء' if cancel else 'إقفال'} اعتماد {lc['lc_number']}", lines, lc_id, lc["lc_number"])
    await db.letters_of_credit.update_one({"id": lc_id, "company_id": company_id}, {"$set": {
        "status": "cancelled" if cancel else "closed", "settle_je_id": je_id, "close_date": req.date_str,
        "margin_refunded": margin_left, "in_transit_balance": 0.0}})
    return {
        "message": f"✅ تم {'إلغاء' if cancel else 'إغلاق'} ملف الاعتماد {lc['lc_number']}",
        "lc_id": lc_id, "lc_number": lc["lc_number"], "status": "cancelled" if cancel else "closed",
        "close_date": req.date_str, "margin_refunded": margin_left, "journal_entry_id": je_id,
        "final_summary": {
            "lc_amount_egp": lc.get("lc_amount_egp", 0), "margin_paid": lc["margin_amount"],
            "bank_commission": lc["bank_commission"], "accumulated_costs": lc.get("accumulated_costs", 0),
            "goods_value_egp": lc.get("goods_value_egp", 0), "inventory_cost": lc.get("total_inventory_cost", 0),
        },
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/")
async def list_lcs(status: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    lcs = await db.letters_of_credit.find(q, {"_id": 0, "cost_entries": 0}).sort("open_date", -1).to_list(None)
    active = [l for l in lcs if l["status"] not in ("closed", "cancelled")]
    return {
        "letters": lcs, "total": len(lcs),
        "open_exposure_egp": P.r2(sum(float(l.get("lc_amount_egp", 0)) for l in active if l["status"] in ("open", "in_transit"))),
        "margin_held": P.r2(sum(float(l.get("margin_amount", 0)) - float(l.get("margin_used", 0)) for l in active)),
        "by_status": {s: sum(1 for l in lcs if l["status"] == s)
                      for s in ("open", "in_transit", "paid", "received", "closed", "cancelled")},
    }


@router.get("/{lc_id}")
async def get_lc(lc_id: str, current_user: dict = Depends(get_current_user)):
    lc = await _get(current_user["company_id"], lc_id)
    costs_by_type: dict = {}
    for entry in lc.get("cost_entries", []):
        for c in entry.get("costs", []):
            ct = c.get("type", "other")
            costs_by_type[ct] = P.r2(costs_by_type.get(ct, 0) + float(c.get("amount_egp", 0)))
    lc["cost_breakdown_by_type"] = costs_by_type
    return lc
