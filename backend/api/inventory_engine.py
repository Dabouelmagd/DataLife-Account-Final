"""
Inventory Valuation & Landed Costs Engine
محرك تقييم المخزون والتكاليف المضافة

1. Weighted Average — المتوسط المرجح (يُعاد حساب التكلفة عند كل استلام)
2. FIFO Queue        — الوارد أولاً يصرف أولاً (queue per product/warehouse)
3. Landed Costs     — توزيع مصاريف الاستيراد آلياً على تكلفة الوحدة
4. Inventory Reconciliation — جرد + عجز مسموح / غير مسموح + قيود محاسبية
5. Branch Transfers — تحويلات بين الفروع / المخازن
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/inventory-engine", tags=["Inventory Engine"])


# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "inventory":        "121",  # مخزون البضاعة
    "inventory_wip":    "122",  # إنتاج تحت التشغيل
    "cogs":             "321",  # تكلفة البضاعة المباعة
    "shortage_allowed": "332",  # مصروف عجز مسموح به
    "shortage_denied":  "432",  # مطالبات / عجز غير مسموح (مدين من المسؤول)
    "surplus":          "423",  # إيراد زيادة مخزون
    "landed_clearing":  "241",  # حساب تكاليف الاستيراد مقيدة
    "bank":             "112",
    "ap":               "251",
    "customs":          "254",  # رسوم جمركية مستحقة
    "freight_exp":      "332",  # مصاريف شحن
    "insurance_exp":    "332",  # مصاريف تأمين
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
        "line_id":      str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit":  round(debit,  2),
        "credit": round(credit, 2),
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


# ══════════════════════════════════════════════════════════════
# 1. WEIGHTED AVERAGE ENGINE
#    يُعاد حساب التكلفة المتوسطة عند كل استلام
# ══════════════════════════════════════════════════════════════

async def recalc_weighted_average(company_id: str,
                                   product_id: str,
                                   warehouse_id: str,
                                   received_qty: float,
                                   received_unit_cost: float) -> float:
    """
    المتوسط المرجح = (قيمة الرصيد القائم + قيمة الوارد الجديد)
                    ÷ (كمية الرصيد + كمية الوارد)
    يُحدَّث في جدول stocks ثم يُعاد للـ caller
    """
    stock = await db.stocks.find_one(
        {"product_id": product_id,
         "warehouse_id": warehouse_id,
         "company_id": company_id}, {"_id": 0}
    )
    existing_qty  = float(stock.get("quantity",   0)) if stock else 0
    existing_cost = float(stock.get("unit_cost",  0)) if stock else received_unit_cost

    total_qty   = existing_qty + received_qty
    total_value = (existing_qty * existing_cost) + (received_qty * received_unit_cost)
    new_avg     = round(total_value / total_qty, 4) if total_qty > 0 else received_unit_cost

    # Update stock record
    await db.stocks.update_one(
        {"product_id": product_id, "warehouse_id": warehouse_id, "company_id": company_id},
        {"$set": {"unit_cost": new_avg, "average_cost": new_avg},
         "$inc": {"quantity": received_qty}},
        upsert=True
    )
    return new_avg


@router.post("/receive")
async def receive_inventory(data: dict,
                            current_user: dict = Depends(get_current_user)):
    """
    استلام بضاعة + تحديث التكلفة (متوسط مرجح أو FIFO)

    القيد:
    Dr م/121 مخزون البضاعة   ← (الكمية × التكلفة الشاملة)
    Cr م/251 الموردون / م/112 البنك
    """
    company_id = current_user["company_id"]
    product_id  = data.get("product_id")
    warehouse_id= data.get("warehouse_id")
    qty         = float(data.get("quantity", 0))
    unit_cost   = float(data.get("unit_cost", 0))
    date_str    = data.get("date", date.today().isoformat())
    method      = data.get("valuation_method", "weighted_average")
    ref_po      = data.get("purchase_order_id")
    pay_method  = data.get("payment_method", "credit")  # credit | cash

    if qty <= 0:
        raise HTTPException(400, "الكمية يجب أن تكون موجبة")

    product = await db.products.find_one({"id": product_id, "company_id": company_id})
    if not product:
        raise HTTPException(404, "المنتج غير موجود")

    total_cost = round(qty * unit_cost, 2)

    # ── تحديث رصيد المخزون حسب الطريقة ──────────────────────
    if method == "weighted_average":
        new_cost = await recalc_weighted_average(
            company_id, product_id, warehouse_id, qty, unit_cost)
    else:  # FIFO — add to queue
        await db.fifo_queue.insert_one({
            "id": str(uuid.uuid4()), "company_id": company_id,
            "product_id": product_id, "warehouse_id": warehouse_id,
            "received_date": date_str, "qty_original": qty,
            "qty_remaining": qty, "unit_cost": unit_cost,
            "ref_po": ref_po,
        })
        await db.stocks.update_one(
            {"product_id": product_id, "warehouse_id": warehouse_id,
             "company_id": company_id},
            {"$inc": {"quantity": qty}},
            upsert=True
        )
        new_cost = unit_cost

    # ── القيد المحاسبي ─────────────────────────────────────────
    pay_acc = ACC["bank"] if pay_method == "cash" else ACC["ap"]
    pay_name = "البنك" if pay_method == "cash" else "الموردون"

    lines = await asyncio.gather(
        je_line(company_id, ACC["inventory"], debit=total_cost,
                desc=f"استلام {qty} × {product['name']} بتكلفة {unit_cost}"),
        je_line(company_id, pay_acc, credit=total_cost,
                desc=f"{'سداد' if pay_method=='cash' else 'مستحق'} مشتريات {product['name']}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"استلام مخزون — {product['name']} ({method})", lines, product_id)

    return {
        "message":   f"تم تسجيل استلام {qty} وحدة من {product['name']}",
        "valuation": {
            "method":      method,
            "unit_cost":   unit_cost,
            "new_avg_cost": new_cost if method == "weighted_average" else None,
            "total_cost":  total_cost,
        },
        "journal_entry_id": je_id,
    }


@router.post("/issue")
async def issue_inventory(data: dict,
                          current_user: dict = Depends(get_current_user)):
    """
    صرف بضاعة من المخزون (مبيعات / إنتاج)

    FIFO: يُقلِّص الدُّفعات من الأقدم للأحدث
    Weighted Average: يُقلِّص بالتكلفة المتوسطة الحالية
    """
    company_id  = current_user["company_id"]
    product_id  = data.get("product_id")
    warehouse_id= data.get("warehouse_id")
    qty         = float(data.get("quantity", 0))
    date_str    = data.get("date", date.today().isoformat())
    method      = data.get("valuation_method", "weighted_average")

    stock = await db.stocks.find_one(
        {"product_id": product_id, "warehouse_id": warehouse_id,
         "company_id": company_id}, {"_id": 0}
    )
    if not stock or float(stock.get("quantity", 0)) < qty:
        raise HTTPException(400, f"رصيد غير كافٍ — متاح: {stock.get('quantity',0) if stock else 0}")

    # ── حساب تكلفة المُصرَف ───────────────────────────────────
    if method == "fifo":
        cogs, consumed_cost = await _consume_fifo(company_id, product_id, warehouse_id, qty)
    else:  # weighted average
        avg_cost     = float(stock.get("unit_cost", stock.get("average_cost", 0)))
        cogs         = round(qty * avg_cost, 2)
        consumed_cost = avg_cost

    # Update stock
    await db.stocks.update_one(
        {"product_id": product_id, "warehouse_id": warehouse_id, "company_id": company_id},
        {"$inc": {"quantity": -qty}}
    )

    # Journal: Dr COGS | Cr Inventory
    product = await db.products.find_one({"id": product_id}) or {}
    lines = await asyncio.gather(
        je_line(company_id, ACC["cogs"], debit=cogs,
                desc=f"تكلفة صرف {qty} × {product.get('name','')} ({method})"),
        je_line(company_id, ACC["inventory"], credit=cogs,
                desc=f"إقفال مخزون مُصرَف — {product.get('name','')}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"صرف مخزون — {product.get('name','')} ({method})", lines, product_id)

    return {
        "message":     f"تم صرف {qty} وحدة",
        "cogs":        cogs,
        "unit_cost":   consumed_cost,
        "method":      method,
        "journal_entry_id": je_id,
    }


async def _consume_fifo(company_id, product_id, warehouse_id, qty_needed) -> tuple:
    """Consume from FIFO queue oldest-first. Returns (total_cogs, avg_unit_cost)"""
    lots = await db.fifo_queue.find({
        "company_id": company_id, "product_id": product_id,
        "warehouse_id": warehouse_id, "qty_remaining": {"$gt": 0}
    }).sort("received_date", 1).to_list(None)

    remaining = qty_needed
    total_cost = 0.0
    for lot in lots:
        if remaining <= 0:
            break
        take = min(lot["qty_remaining"], remaining)
        total_cost += take * lot["unit_cost"]
        remaining  -= take
        new_rem     = lot["qty_remaining"] - take
        await db.fifo_queue.update_one(
            {"id": lot["id"]}, {"$set": {"qty_remaining": new_rem}}
        )

    if remaining > 0:
        raise HTTPException(400, f"FIFO queue exhausted — مخزون FIFO غير كافٍ")

    avg = round(total_cost / qty_needed, 4) if qty_needed > 0 else 0
    return round(total_cost, 2), avg


# ══════════════════════════════════════════════════════════════
# 2. LANDED COSTS ENGINE — تكاليف الاستيراد والشحن
# ══════════════════════════════════════════════════════════════

class LandedCostRequest(BaseModel):
    purchase_order_id:  str
    date:               str
    allocation_method:  str = "value"  # value | quantity | weight | manual
    costs: List[dict]   # [{type, amount, account_code, description}]
    # cost types: freight | insurance | customs | clearance | other


@router.post("/landed-costs")
async def apply_landed_costs(req: LandedCostRequest,
                              current_user: dict = Depends(get_current_user)):
    """
    توزيع تكاليف الاستيراد على تكلفة الوحدة — Landed Costs Engine

    الطرق المتاحة:
    - value:    بالنسبة للقيمة (الأكثر شيوعاً)
    - quantity: بالنسبة للكمية
    - weight:   بالنسبة للوزن
    - manual:   يدوي لكل بند

    القيد:
    Dr م/121 مخزون (زيادة التكلفة الموزعة)
    Cr م/251 موردون / م/112 بنك / م/254 رسوم جمركية
    """
    company_id = current_user["company_id"]
    po_id      = req.purchase_order_id

    # جلب بنود أمر الشراء / الاستلام
    po_lines = await db.inventory_movements.find(
        {"company_id": company_id, "source_document_id": po_id,
         "movement_type": {"$in": ["in", "purchase"]}},
        {"_id": 0}
    ).to_list(None)

    if not po_lines:
        # Fallback: search fifo_queue by ref_po
        po_lines = await db.fifo_queue.find(
            {"company_id": company_id, "ref_po": po_id}, {"_id": 0}
        ).to_list(None)

    if not po_lines:
        raise HTTPException(404, f"لا توجد حركات استلام لأمر الشراء {po_id}")

    # حساب قاعدة التوزيع
    total_base = sum(
        float(l.get("quantity", 0)) * float(l.get("unit_cost", 0))
        if req.allocation_method == "value"
        else float(l.get("quantity", 0))
        if req.allocation_method == "quantity"
        else float(l.get("weight", 1))
        for l in po_lines
    ) or 1.0

    total_landed_cost = sum(float(c["amount"]) for c in req.costs)
    je_lines = []
    je_lines_cr = []
    allocation_detail = []

    for line in po_lines:
        line_base = (
            float(line.get("quantity",0)) * float(line.get("unit_cost",0))
            if req.allocation_method == "value"
            else float(line.get("quantity",0))
        )
        ratio        = line_base / total_base
        alloc_cost   = round(total_landed_cost * ratio, 2)
        line_qty     = float(line.get("quantity", 1))
        extra_per_unit = round(alloc_cost / line_qty, 4) if line_qty > 0 else 0

        # Update unit cost in inventory
        pid = line.get("product_id")
        wid = line.get("warehouse_id")
        if pid and wid:
            stock = await db.stocks.find_one(
                {"product_id": pid, "warehouse_id": wid, "company_id": company_id})
            if stock:
                new_cost = round(float(stock.get("unit_cost", 0)) + extra_per_unit, 4)
                await db.stocks.update_one(
                    {"product_id": pid, "warehouse_id": wid, "company_id": company_id},
                    {"$set": {"unit_cost": new_cost, "average_cost": new_cost}}
                )
                # Update FIFO queue lots for this PO
                await db.fifo_queue.update_many(
                    {"company_id": company_id, "product_id": pid,
                     "warehouse_id": wid, "ref_po": po_id},
                    {"$inc": {"unit_cost": extra_per_unit}}
                )

        allocation_detail.append({
            "product_id":      pid,
            "product_name":    line.get("product_name",""),
            "line_value":      round(line_base, 2),
            "allocation_ratio":round(ratio, 4),
            "allocated_cost":  alloc_cost,
            "extra_per_unit":  extra_per_unit,
        })

        # مدين: زيادة المخزون
        je_lines.append(await je_line(
            company_id, ACC["inventory"], debit=alloc_cost,
            desc=f"تكلفة استيراد موزعة — {line.get('product_name','')} ({req.allocation_method})"
        ))

    # دائن: مصادر التكاليف
    for cost in req.costs:
        cr_acc = {
            "freight":   "251",    # شحن مستحق
            "insurance": "251",    # تأمين شحنة
            "customs":   "254",    # رسوم جمركية
            "clearance": "251",    # تخليص جمركي
        }.get(cost.get("type","other"), "251")

        je_lines_cr.append(await je_line(
            company_id, cr_acc, credit=float(cost["amount"]),
            desc=cost.get("description", f"تكلفة استيراد — {cost.get('type','')}")
        ))

    # Balance check
    total_d = round(sum(l["debit"]  for l in je_lines), 2)
    total_c = round(sum(l["credit"] for l in je_lines_cr), 2)

    je_id = await post_je(company_id, current_user["user_id"], req.date,
        f"تكاليف استيراد — أمر شراء {po_id} ({req.allocation_method})",
        je_lines + je_lines_cr, po_id)

    return {
        "message":            f"تم توزيع {total_landed_cost:,.2f} ج.م تكاليف استيراد على {len(allocation_detail)} صنف",
        "po_id":              po_id,
        "allocation_method":  req.allocation_method,
        "total_landed_cost":  total_landed_cost,
        "allocation":         allocation_detail,
        "journal": {
            "id":       je_id,
            "debit":    total_d,
            "credit":   total_c,
            "balanced": abs(total_d - total_c) < 0.01,
        }
    }


# ══════════════════════════════════════════════════════════════
# 3. INVENTORY RECONCILIATION — جرد وتسويات المخزون
# ══════════════════════════════════════════════════════════════

SHORTAGE_TOLERANCE_PCT = 0.005  # 0.5% عجز مسموح به افتراضي


class ReconciliationRequest(BaseModel):
    warehouse_id:        str
    count_date:          str
    lines:               List[dict]  # [{product_id, system_qty, counted_qty, unit_cost?}]
    shortage_tolerance:  float = SHORTAGE_TOLERANCE_PCT  # نسبة العجز المسموح
    notes:               Optional[str] = None


@router.post("/reconcile")
async def reconcile_inventory(req: ReconciliationRequest,
                               current_user: dict = Depends(get_current_user)):
    """
    تسوية الجرد المخزني مع فصل العجز المسموح / غير المسموح

    العجز المسموح (ضمن التسامح):
      Dr م/332 مصروف عجز مسموح | Cr م/121 مخزون

    العجز غير المسموح (يتجاوز التسامح):
      Dr م/432 مطالبات عجز | Cr م/121 مخزون
      (يُحمَّل على المسؤول أو التأمين)

    الزيادة (فائض):
      Dr م/121 مخزون | Cr م/423 إيراد زيادة مخزون
    """
    company_id = current_user["company_id"]
    je_lines   = []
    detail     = []

    total_shortage_allowed = 0.0
    total_shortage_denied  = 0.0
    total_surplus          = 0.0

    for line in req.lines:
        pid          = line["product_id"]
        system_qty   = float(line.get("system_qty", 0))
        counted_qty  = float(line["counted_qty"])
        diff         = round(counted_qty - system_qty, 4)

        if abs(diff) < 0.001:
            continue  # no difference

        # Get unit cost
        stock = await db.stocks.find_one(
            {"product_id": pid, "warehouse_id": req.warehouse_id,
             "company_id": company_id}, {"_id": 0}
        )
        unit_cost = float(line.get("unit_cost") or
                          (stock.get("unit_cost", 0) if stock else 0))
        diff_value = round(abs(diff) * unit_cost, 2)
        product    = await db.products.find_one({"id": pid}) or {}
        pname      = product.get("name", pid)

        if diff < 0:
            # ── عجز (النقص) ──────────────────────────────────
            tolerance_qty = system_qty * req.shortage_tolerance
            if abs(diff) <= tolerance_qty:
                # عجز مسموح به
                je_lines.append(await je_line(
                    company_id, ACC["shortage_allowed"], debit=diff_value,
                    desc=f"عجز مسموح — {pname} ({abs(diff):.2f} وحدة)"))
                total_shortage_allowed += diff_value
                shortage_type = "allowed"
            else:
                # عجز غير مسموح به
                je_lines.append(await je_line(
                    company_id, ACC["shortage_denied"], debit=diff_value,
                    desc=f"عجز غير مسموح — {pname} ({abs(diff):.2f} وحدة)"))
                total_shortage_denied += diff_value
                shortage_type = "denied"

            je_lines.append(await je_line(
                company_id, ACC["inventory"], credit=diff_value,
                desc=f"تسوية مخزون — {pname}"))

        else:
            # ── فائض (الزيادة) ────────────────────────────────
            je_lines.append(await je_line(
                company_id, ACC["inventory"], debit=diff_value,
                desc=f"فائض مخزون — {pname} ({diff:.2f} وحدة)"))
            je_lines.append(await je_line(
                company_id, ACC["surplus"], credit=diff_value,
                desc=f"إيراد زيادة مخزون — {pname}"))
            total_surplus += diff_value
            shortage_type  = "surplus"

        # Update stock qty
        await db.stocks.update_one(
            {"product_id": pid, "warehouse_id": req.warehouse_id, "company_id": company_id},
            {"$set": {"quantity": counted_qty}}
        )

        detail.append({
            "product_id":    pid,
            "product_name":  pname,
            "system_qty":    system_qty,
            "counted_qty":   counted_qty,
            "difference":    diff,
            "unit_cost":     unit_cost,
            "value":         diff_value,
            "type":          shortage_type,
        })

    if not je_lines:
        return {"message": "لا فروق في الجرد — المخزون مطابق", "differences": 0}

    je_id = await post_je(company_id, current_user["user_id"], req.count_date,
        f"تسوية جرد مخزون — {req.warehouse_id}", je_lines, req.warehouse_id)

    return {
        "message":      f"تم إثبات {len(detail)} فرق في الجرد",
        "count_date":   req.count_date,
        "summary": {
            "shortage_allowed":        round(total_shortage_allowed, 2),
            "shortage_denied":         round(total_shortage_denied, 2),
            "surplus":                 round(total_surplus, 2),
            "net_inventory_adjustment": round(total_surplus - total_shortage_allowed - total_shortage_denied, 2),
        },
        "detail":          detail,
        "journal_entry_id": je_id,
        "law_note":        "العجز المسموح: قرار وزارة التموين — نسبة التسامح الافتراضية 0.5%",
    }


# ══════════════════════════════════════════════════════════════
# 4. BRANCH / WAREHOUSE TRANSFERS — تحويلات الفروع
# ══════════════════════════════════════════════════════════════

class BranchTransferRequest(BaseModel):
    from_warehouse_id: str
    to_warehouse_id:   str
    transfer_date:     str
    lines: List[dict]  # [{product_id, quantity, unit_cost?}]
    notes: Optional[str] = None


@router.post("/branch-transfer")
async def branch_transfer(req: BranchTransferRequest,
                          current_user: dict = Depends(get_current_user)):
    """
    تحويل بضاعة بين الفروع / المخازن

    القيد:
    Dr م/121 مخزون الفرع المستلِم   ← (كمية × تكلفة)
    Cr م/121 مخزون الفرع المُرسِل   ← نفس القيمة

    يُحافظ على طريقة التقييم (FIFO / Weighted Average)
    """
    company_id = current_user["company_id"]
    ref_num    = f"TRF-{date.today().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    je_lines   = []
    detail     = []
    total_value = 0.0

    for item in req.lines:
        pid     = item["product_id"]
        qty     = float(item["quantity"])

        # Validate source stock
        src_stock = await db.stocks.find_one(
            {"product_id": pid, "warehouse_id": req.from_warehouse_id,
             "company_id": company_id}, {"_id": 0}
        )
        if not src_stock or float(src_stock.get("quantity", 0)) < qty:
            avail = src_stock.get("quantity", 0) if src_stock else 0
            raise HTTPException(400, f"رصيد غير كافٍ للتحويل — متاح: {avail}")

        unit_cost = float(item.get("unit_cost") or src_stock.get("unit_cost", 0))
        line_val  = round(qty * unit_cost, 2)
        total_value += line_val
        product   = await db.products.find_one({"id": pid}) or {}
        pname     = product.get("name", pid)

        # Debit receiving warehouse
        je_lines.append(await je_line(
            company_id, ACC["inventory"], debit=line_val,
            desc=f"تحويل وارد — {pname} — {req.to_warehouse_id}"))
        # Credit sending warehouse
        je_lines.append(await je_line(
            company_id, ACC["inventory"], credit=line_val,
            desc=f"تحويل صادر — {pname} — {req.from_warehouse_id}"))

        # Update source stock
        await db.stocks.update_one(
            {"product_id": pid, "warehouse_id": req.from_warehouse_id, "company_id": company_id},
            {"$inc": {"quantity": -qty}}
        )
        # Update/create destination stock (maintain unit_cost)
        dest = await db.stocks.find_one(
            {"product_id": pid, "warehouse_id": req.to_warehouse_id, "company_id": company_id})
        if dest:
            new_avg = await recalc_weighted_average(
                company_id, pid, req.to_warehouse_id, qty, unit_cost)
        else:
            await db.stocks.insert_one({
                "company_id": company_id, "product_id": pid,
                "warehouse_id": req.to_warehouse_id,
                "quantity": qty, "unit_cost": unit_cost, "average_cost": unit_cost,
            })

        # Transfer FIFO lots if applicable
        await db.fifo_queue.update_many(
            {"company_id": company_id, "product_id": pid,
             "warehouse_id": req.from_warehouse_id, "qty_remaining": {"$gt": 0}},
            {"$set": {"warehouse_id": req.to_warehouse_id}}
        )

        detail.append({
            "product_id": pid, "product_name": pname,
            "quantity": qty, "unit_cost": unit_cost, "value": line_val,
        })

    je_id = await post_je(company_id, current_user["user_id"], req.transfer_date,
        f"تحويل مخزون {ref_num} — من {req.from_warehouse_id} إلى {req.to_warehouse_id}",
        je_lines, ref_num)

    return {
        "message":          f"تم تحويل {len(detail)} صنف — إجمالي {total_value:,.2f} ج.م",
        "reference":        ref_num,
        "from_warehouse":   req.from_warehouse_id,
        "to_warehouse":     req.to_warehouse_id,
        "items_transferred": len(detail),
        "total_value":      total_value,
        "detail":           detail,
        "journal_entry_id": je_id,
    }


# ══════════════════════════════════════════════════════════════
# 5. VALUATION REPORT — تقرير تقييم المخزون
# ══════════════════════════════════════════════════════════════

@router.get("/valuation-report")
async def valuation_report(
    warehouse_id:  Optional[str] = None,
    method:        str = Query("weighted_average", enum=["weighted_average", "fifo"]),
    as_of_date:    Optional[str] = None,
    current_user:  dict = Depends(get_current_user)
):
    """
    تقرير تقييم المخزون — Weighted Average أو FIFO
    """
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if warehouse_id:
        q["warehouse_id"] = warehouse_id

    stocks = await db.stocks.find(q, {"_id": 0}).to_list(None)
    report_lines = []
    total_qty   = 0.0
    total_value = 0.0

    for stock in stocks:
        pid  = stock.get("product_id")
        wid  = stock.get("warehouse_id")
        qty  = float(stock.get("quantity", 0))
        if qty <= 0:
            continue

        if method == "fifo":
            # FIFO value = sum of remaining lots
            lots = await db.fifo_queue.find({
                "company_id": company_id, "product_id": pid,
                "warehouse_id": wid, "qty_remaining": {"$gt": 0}
            }).sort("received_date", 1).to_list(None)
            fifo_val  = sum(l["qty_remaining"] * l["unit_cost"] for l in lots)
            unit_cost = round(fifo_val / qty, 4) if qty > 0 else 0
            value     = round(fifo_val, 2)
        else:
            unit_cost = float(stock.get("unit_cost", stock.get("average_cost", 0)))
            value     = round(qty * unit_cost, 2)

        product = await db.products.find_one({"id": pid}, {"_id":0,"name":1,"code":1}) or {}
        report_lines.append({
            "product_id":   pid,
            "product_code": product.get("code",""),
            "product_name": product.get("name",""),
            "warehouse_id": wid,
            "quantity":     qty,
            "unit_cost":    unit_cost,
            "total_value":  value,
            "method":       method,
        })
        total_qty   += qty
        total_value += value

    report_lines.sort(key=lambda x: x["product_code"])

    return {
        "valuation_method": method,
        "as_of_date":       as_of_date or date.today().isoformat(),
        "warehouse_filter": warehouse_id,
        "lines":            report_lines,
        "totals": {
            "total_items":  len(report_lines),
            "total_qty":    round(total_qty, 2),
            "total_value":  round(total_value, 2),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
