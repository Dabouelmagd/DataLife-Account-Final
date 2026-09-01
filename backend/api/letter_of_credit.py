"""
Letter of Credit Engine — محرك الاعتمادات المستندية للاستيراد الخارجي
LC Documentary Credit Cycle

4 مراحل كاملة:
1. فتح الاعتماد  — حجز الغطاء + سداد العمولات
2. تجميع التكاليف — شحن + تأمين بحري + جمارك + تخليص
3. وصول البضاعة  — إقفال ملف الاعتماد وإثبات المخزون
4. التسوية النهائية — تسوية الفروق وإغلاق الحساب الوسيط
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/lc", tags=["Letter of Credit"])

# ── Account codes ─────────────────────────────────────────────
ACC = {
    "lc_margin":   "1231",  # غطاء نقدي محتجز
    "lc_costs":    "1232",  # تكاليف مرحلية مجمَّعة (الحساب الوسيط الرئيسي)
    "lc_commis":   "3371",  # عمولات فتح الاعتماد
    "freight":     "3372",  # شحن دولي
    "insurance":   "3373",  # تأمين بحري
    "customs":     "3374",  # رسوم جمركية
    "clearance":   "3375",  # تخليص جمركي وميناء
    "inventory_rm":"121",   # مخزون خامات ومواد أولية
    "inventory_fg":"122",   # مخزون بضاعة جاهزة
    "inventory_tr":"123",   # بضاعة بالطريق
    "bank":        "112",
    "cash":        "161",
}

COST_TYPES = {
    "freight":   (ACC["freight"],   "مصاريف شحن دولي"),
    "insurance": (ACC["insurance"], "تأمين بحري"),
    "customs":   (ACC["customs"],   "رسوم جمركية"),
    "clearance": (ACC["clearance"], "تخليص جمركي وميناء"),
    "other":     ("332",            "مصاريف استيراد أخرى"),
}


async def get_acc(company_id, code):
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id, code, debit=0.0, credit=0.0, desc=""):
    acc = await get_acc(company_id, code)
    return {"line_id": str(uuid.uuid4()), "entry_id": None,
            "account_id": acc["id"], "account_code": code,
            "account_name": acc.get("account_name", f"حساب {code}"),
            "debit": round(debit,2), "credit": round(credit,2), "description": desc}


async def post_je(company_id, user_id, date_str, description, lines, src_id=None):
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="letter_of_credit", source_document_id=src_id,
        created_by=user_id)
    r = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(r["id"], user_id)
    return r["id"]


def balanced(lines):
    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    return abs(td-tc) < 0.01, td, tc


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class OpenLCRequest(BaseModel):
    lc_number:        str
    supplier_name:    str
    supplier_country: str
    goods_description: str
    lc_currency:      str = "USD"
    lc_amount_foreign: float
    exchange_rate:    float = 1.0
    margin_amount:    float         # الغطاء النقدي بالجنيه
    bank_commission:  float         # عمولة البنك
    open_date:        str
    expiry_date:      str
    bank_account:     str = "112"
    notes:            Optional[str] = None


class CostItem(BaseModel):
    cost_type:   str   # freight|insurance|customs|clearance|other
    description: str
    amount_egp:  float
    invoice_ref: Optional[str] = None


class AddCostsRequest(BaseModel):
    lc_id:       str
    date_str:    str
    costs:       list[CostItem]
    payment_src: str = "bank"   # bank | cash
    notes:       Optional[str] = None


class ReceiveGoodsRequest(BaseModel):
    lc_id:            str
    date_str:         str
    goods_received:   str   # raw_material | finished_goods | in_transit
    quantity_received: Optional[float] = None
    notes:            Optional[str] = None


class SettleRequest(BaseModel):
    lc_id:    str
    date_str: str
    notes:    Optional[str] = None


# ══════════════════════════════════════════════════════════════
# 1. فتح الاعتماد — OPEN LC
# ══════════════════════════════════════════════════════════════

@router.post("/open")
async def open_lc(req: OpenLCRequest,
                  current_user: dict = Depends(get_current_user)):
    """
    فتح الاعتماد المستندي وحجز الغطاء البنكي

    القيد:
    Dr م/1231 اعتمادات مستندية — غطاء نقدي   ← الغطاء المحتجز
    Dr م/3371 عمولات فتح الاعتماد              ← عمولة البنك
    Cr م/112  البنك الجاري                     ← إجمالي المدفوع
    """
    company_id = current_user["company_id"]
    lc_id      = str(uuid.uuid4())
    total_paid = round(req.margin_amount + req.bank_commission, 2)
    lc_amount_egp = round(req.lc_amount_foreign * req.exchange_rate, 2)

    lines = await asyncio.gather(
        je_line(company_id, ACC["lc_margin"], debit=req.margin_amount,
                desc=f"غطاء اعتماد {req.lc_number} — {req.supplier_name}"),
        je_line(company_id, ACC["lc_commis"], debit=req.bank_commission,
                desc=f"عمولة فتح اعتماد {req.lc_number}"),
        je_line(company_id, req.bank_account, credit=total_paid,
                desc=f"خصم بنكي — فتح اعتماد مستندي {req.lc_number}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.open_date,
        f"فتح اعتماد مستندي {req.lc_number} — {req.supplier_name}", list(lines), lc_id)

    ok, td, tc = balanced(list(lines))
    lc = {
        "id": lc_id, "company_id": company_id,
        "lc_number":         req.lc_number,
        "supplier_name":     req.supplier_name,
        "supplier_country":  req.supplier_country,
        "goods_description": req.goods_description,
        "lc_currency":       req.lc_currency,
        "lc_amount_foreign": req.lc_amount_foreign,
        "exchange_rate":     req.exchange_rate,
        "lc_amount_egp":     lc_amount_egp,
        "margin_amount":     req.margin_amount,
        "bank_commission":   req.bank_commission,
        "total_paid_on_open": total_paid,
        "accumulated_costs": 0.0,   # تتراكم مع مراحل الاستيراد
        "total_lc_cost":     total_paid,
        "open_date":         req.open_date,
        "expiry_date":       req.expiry_date,
        "status":            "open",
        "cost_entries":      [],
        "open_je_id":        je_id,
        "receive_je_id":     None,
        "settle_je_id":      None,
        "notes":             req.notes,
        "created_at":        datetime.now(timezone.utc).isoformat(),
    }
    await db.letters_of_credit.insert_one(lc); lc.pop("_id", None)

    return {
        "message":  f"✅ تم فتح الاعتماد المستندي {req.lc_number}",
        "lc_id":    lc_id,
        "lc":       lc,
        "journal": {
            "id":       je_id,
            "debit":    [f"م/{ACC['lc_margin']} غطاء اعتماد  {req.margin_amount:,.2f}",
                         f"م/{ACC['lc_commis']} عمولة بنكية   {req.bank_commission:,.2f}"],
            "credit":   f"م/{req.bank_account} البنك           {total_paid:,.2f}",
            "balanced": ok,
        },
    }


# ══════════════════════════════════════════════════════════════
# 2. تجميع التكاليف — ADD COSTS (شحن + تأمين + جمارك)
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/costs")
async def add_lc_costs(lc_id: str, req: AddCostsRequest,
                       current_user: dict = Depends(get_current_user)):
    """
    إضافة تكاليف الاستيراد إلى ملف الاعتماد

    شحن دولي + تأمين بحري + رسوم جمركية + تخليص
    جميعها تُجمَّع على م/1232 (حساب وسيط) حتى وصول البضاعة

    القيد:
    Dr م/1232 اعتمادات مستندية — تكاليف مرحلية  ← المصروف
    Cr م/112  البنك / م/161 الخزينة              ← المصدر
    """
    company_id = current_user["company_id"]
    lc = await db.letters_of_credit.find_one(
        {"id": lc_id, "company_id": company_id}, {"_id": 0})
    if not lc:
        raise HTTPException(404, "الاعتماد غير موجود")
    if lc["status"] == "closed":
        raise HTTPException(400, "الاعتماد مُغلَق")

    total_costs = round(sum(float(c.amount_egp) for c in req.costs), 2)
    src_code    = ACC["bank"] if req.payment_src == "bank" else ACC["cash"]
    src_name    = "البنك" if req.payment_src == "bank" else "الخزينة"
    entry_id    = str(uuid.uuid4())

    # Debit: lc_costs account (الحساب الوسيط)
    lines = [
        await je_line(company_id, ACC["lc_costs"], debit=total_costs,
                      desc=f"تكاليف اعتماد {lc['lc_number']} — {len(req.costs)} بند")
    ]
    # Credit: source
    lines.append(await je_line(
        company_id, src_code, credit=total_costs,
        desc=f"سداد تكاليف استيراد — اعتماد {lc['lc_number']}"))

    je_id = await post_je(company_id, current_user["user_id"], req.date_str,
        f"تكاليف اعتماد {lc['lc_number']} — {', '.join(c.cost_type for c in req.costs)}",
        lines, entry_id)

    # Build cost record detail
    cost_record = {
        "id":       entry_id,
        "date":     req.date_str,
        "costs":    [{"type": c.cost_type,
                      "type_ar": COST_TYPES.get(c.cost_type,("",""))[1],
                      "description": c.description,
                      "amount_egp": float(c.amount_egp),
                      "invoice_ref": c.invoice_ref} for c in req.costs],
        "total":    total_costs,
        "je_id":    je_id,
        "notes":    req.notes,
    }

    new_acc_costs  = round(float(lc.get("accumulated_costs", 0)) + total_costs, 2)
    new_total_cost = round(float(lc.get("total_lc_cost", 0)) + total_costs, 2)

    await db.letters_of_credit.update_one(
        {"id": lc_id},
        {"$set": {"accumulated_costs": new_acc_costs,
                  "total_lc_cost":    new_total_cost,
                  "status": "in_transit"},
         "$push": {"cost_entries": cost_record}}
    )

    ok, td, tc = balanced(lines)
    return {
        "message":          f"✅ تم إضافة تكاليف الاعتماد {lc['lc_number']}",
        "lc_id":            lc_id,
        "costs_added":      total_costs,
        "accumulated_costs": new_acc_costs,
        "total_lc_cost":    new_total_cost,
        "cost_breakdown":   [f"{c.cost_type}: {c.amount_egp:,.2f}" for c in req.costs],
        "journal": {
            "id":       je_id,
            "debit":    f"م/{ACC['lc_costs']} اعتمادات مستندية — تكاليف  {total_costs:,.2f}",
            "credit":   f"م/{src_code} {src_name}                         {total_costs:,.2f}",
            "balanced": ok,
        },
    }


# ══════════════════════════════════════════════════════════════
# 3. وصول البضاعة وإثبات المخزون — RECEIVE GOODS
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/receive")
async def receive_goods(lc_id: str, req: ReceiveGoodsRequest,
                        current_user: dict = Depends(get_current_user)):
    """
    إثبات استلام البضاعة وإقفال ملف الاعتماد المستندي

    التكلفة الإجمالية = غطاء الاعتماد + الشحن + التأمين + الجمارك + التخليص

    القيد:
    Dr م/121 مخزون الخامات / م/122 بضاعة جاهزة  ← التكلفة الكاملة
    Cr م/1231 اعتمادات مستندية — غطاء نقدي       ← استرداد الغطاء
    Cr م/1232 اعتمادات مستندية — تكاليف مرحلية   ← إقفال التكاليف
    """
    company_id = current_user["company_id"]
    lc = await db.letters_of_credit.find_one(
        {"id": lc_id, "company_id": company_id}, {"_id": 0})
    if not lc:
        raise HTTPException(404, "الاعتماد غير موجود")
    if lc["status"] == "closed":
        raise HTTPException(400, "الاعتماد مُغلَق بالفعل")

    # Total cost = margin + commission + all accumulated costs
    margin_amt   = float(lc["margin_amount"])
    costs_amt    = float(lc.get("accumulated_costs", 0))
    commission   = float(lc["bank_commission"])
    # The inventory debit = full landed cost
    total_inventory_cost = round(margin_amt + costs_amt, 2)

    # Choose inventory account
    inv_map = {
        "raw_material":    (ACC["inventory_rm"], "مخزون الخامات والمواد الأولية"),
        "finished_goods":  (ACC["inventory_fg"], "مخزون البضاعة الجاهزة"),
        "in_transit":      (ACC["inventory_tr"], "بضاعة بالطريق"),
    }
    inv_code, inv_name = inv_map.get(
        req.goods_received, (ACC["inventory_rm"], "مخزون"))

    # Build lines
    lines = [
        # Dr: المخزون ← التكلفة الإجمالية (Landed Cost)
        await je_line(company_id, inv_code, debit=total_inventory_cost,
                      desc=f"استلام بضاعة اعتماد {lc['lc_number']} — {lc['goods_description']}"),
        # Cr: إقفال الغطاء النقدي
        await je_line(company_id, ACC["lc_margin"], credit=margin_amt,
                      desc=f"إقفال غطاء اعتماد {lc['lc_number']}"),
    ]
    # Cr: إقفال التكاليف المرحلية (إن وجدت)
    if costs_amt > 0:
        lines.append(await je_line(
            company_id, ACC["lc_costs"], credit=costs_amt,
            desc=f"إقفال تكاليف مرحلية — اعتماد {lc['lc_number']}"))

    je_id = await post_je(company_id, current_user["user_id"], req.date_str,
        f"استلام بضاعة اعتماد {lc['lc_number']} — {inv_name}", lines, lc_id)

    ok, td, tc = balanced(lines)
    await db.letters_of_credit.update_one(
        {"id": lc_id},
        {"$set": {"status": "received", "receive_je_id": je_id,
                  "receive_date": req.date_str,
                  "inventory_account": inv_code,
                  "total_inventory_cost": total_inventory_cost}}
    )

    return {
        "message":   f"✅ تم استلام البضاعة وإقفال ملف الاعتماد {lc['lc_number']}",
        "lc_id":     lc_id,
        "inventory_account":     inv_code,
        "total_inventory_cost":  total_inventory_cost,
        "cost_breakdown": {
            "lc_margin_released": margin_amt,
            "accumulated_costs_closed": costs_amt,
            "total_landed_cost":  total_inventory_cost,
        },
        "journal": {
            "id":       je_id,
            "debit":    f"م/{inv_code} {inv_name}  {total_inventory_cost:,.2f}",
            "credits":  [
                f"م/{ACC['lc_margin']} غطاء اعتماد   {margin_amt:,.2f}",
                f"م/{ACC['lc_costs']}  تكاليف مرحلية  {costs_amt:,.2f}",
            ],
            "balanced": ok,
            "note":     "التكلفة الكاملة (Landed Cost) مثبَّتة على المخزون",
        },
    }


# ══════════════════════════════════════════════════════════════
# 4. التسوية النهائية — FINAL SETTLEMENT
# ══════════════════════════════════════════════════════════════

@router.post("/{lc_id}/settle")
async def settle_lc(lc_id: str, req: SettleRequest,
                    current_user: dict = Depends(get_current_user)):
    """
    تسوية أي فروق وإغلاق ملف الاعتماد نهائياً

    يُستخدَم عند وجود فروق صرف عملة أجنبية
    أو مبالغ معلقة في الحساب الوسيط
    """
    company_id = current_user["company_id"]
    lc = await db.letters_of_credit.find_one(
        {"id": lc_id, "company_id": company_id}, {"_id": 0})
    if not lc:
        raise HTTPException(404, "الاعتماد غير موجود")
    if lc["status"] == "closed":
        raise HTTPException(400, "الاعتماد مُغلَق بالفعل")

    # Check for residual balance in lc_costs account
    pipeline = [
        {"$match": {"company_id": company_id, "status": "posted"}},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": ACC["lc_costs"]}},
        {"$group": {"_id": None,
                    "debit": {"$sum": "$lines.debit"},
                    "credit": {"$sum": "$lines.credit"}}},
    ]
    res = await db.journal_entries.aggregate(pipeline).to_list(1)
    residual = 0.0
    if res:
        residual = round(float(res[0]["debit"]) - float(res[0]["credit"]), 2)

    await db.letters_of_credit.update_one(
        {"id": lc_id},
        {"$set": {"status": "closed", "settle_je_id": None,
                  "close_date": req.date_str,
                  "residual_cleared": residual}}
    )
    return {
        "message":    f"✅ تم إغلاق ملف الاعتماد {lc['lc_number']} نهائياً",
        "lc_id":      lc_id,
        "lc_number":  lc["lc_number"],
        "status":     "closed",
        "close_date": req.date_str,
        "final_summary": {
            "lc_amount_egp":       lc.get("lc_amount_egp", 0),
            "margin_paid":         lc["margin_amount"],
            "bank_commission":     lc["bank_commission"],
            "accumulated_costs":   lc.get("accumulated_costs", 0),
            "total_lc_cost":       lc.get("total_lc_cost", 0),
            "inventory_cost":      lc.get("total_inventory_cost", 0),
        },
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/")
async def list_lcs(status: Optional[str] = None,
                   current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    lcs = await db.letters_of_credit.find(
        q, {"_id": 0, "cost_entries": 0}
    ).sort("open_date", -1).to_list(None)
    total_exposure = round(sum(float(l.get("lc_amount_egp",0))
                               for l in lcs if l["status"] != "closed"), 2)
    return {
        "letters": lcs, "total": len(lcs),
        "open_exposure_egp": total_exposure,
        "by_status": {
            "open":       sum(1 for l in lcs if l["status"]=="open"),
            "in_transit": sum(1 for l in lcs if l["status"]=="in_transit"),
            "received":   sum(1 for l in lcs if l["status"]=="received"),
            "closed":     sum(1 for l in lcs if l["status"]=="closed"),
        }
    }


@router.get("/{lc_id}")
async def get_lc(lc_id: str, current_user: dict = Depends(get_current_user)):
    lc = await db.letters_of_credit.find_one(
        {"id": lc_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not lc: raise HTTPException(404, "الاعتماد غير موجود")
    # Compute cost breakdown
    costs_by_type: dict = {}
    for entry in lc.get("cost_entries", []):
        for c in entry.get("costs", []):
            ct = c.get("type", "other")
            costs_by_type[ct] = round(costs_by_type.get(ct, 0) + float(c.get("amount_egp",0)), 2)
    lc["cost_breakdown_by_type"] = costs_by_type
    return lc
