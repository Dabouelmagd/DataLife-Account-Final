"""
Inventory Valuation & Landed Costs Engine
محرك تقييم المخزون والتكاليف المضافة

1. Weighted Average — المتوسط المرجح (يُعاد حساب التكلفة عند كل استلام)
2. FIFO Queue        — الوارد أولاً يصرف أولاً (queue per product/warehouse)
3. Landed Costs     — توزيع مصاريف الاستيراد على تكلفة الوحدة
4. Inventory Reconciliation — جرد + عجز مسموح / غير مسموح + قيود محاسبية
5. Branch Transfers — تحويلات بين الفروع / المخازن
6. Valuation report

Accounts follow the company's inventory method, exactly like invoice_service:
  perpetual → stock is carried in 125 and each issue posts its cost (314)
  periodic  → purchases are an expense (311); issues move quantities only
Posting 125 under the periodic method (as this engine always did) counted the
same goods twice: once in 311 from the purchase invoice, once in 125 here.
"""
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from dependencies import get_current_user
from services import ops_posting as P

router = APIRouter(prefix="/api/inventory-engine", tags=["Inventory Engine"])

ACC = {
    # 125 like the invoices: purchases (perpetual) and the cost of each sale
    # both use 125, so goods received here into 121 (raw materials) were never
    # relieved — 121 only grew and 125 went negative
    "inventory":        "125",   # مخزون بضائع بغرض البيع (الجرد الدوري: 311)
    "inventory_wip":    "126",   # إنتاج تحت التشغيل (122 هو الإنتاج التام)
    "cogs":             "314",   # تكلفة البضاعة المباعة   # كان 321
    # 3353 is "عجز نقدية مسموح به" — a CASH shortage. A stock shortage within
    # tolerance is a loss of goods: 3365 "خسائر عهد ومفقودات".
    "shortage_allowed": "3365",
    # a shortage beyond tolerance is claimed from the storekeeper: 1314 when
    # the company has added it, else 1313 (the cashier-shortage receivable,
    # the only staff-shortage receivable in the default chart)
    "shortage_denied":  ["1314", "1313"],
    "surplus":          "423",   # إيرادات متنوعة أخرى
    "bank":             "162",
    "cash":             "161",
    "ap":               "251",
}
# credit side of a landed cost: owed (251), paid (161/162), or already booked
# as an expense and now capitalised (3372 freight, 3373 insurance, 3374 customs, 3375 clearance)
LANDED_CREDIT_OK = {"251", "161", "162", "3372", "3373", "3374", "3375"}
LANDED_DEFAULT_CREDIT = {"freight": "251", "insurance": "251", "customs": "3374", "clearance": "3375", "other": "251"}
LANDED_LABEL = {"freight": "شحن", "insurance": "تأمين", "customs": "جمارك", "clearance": "تخليص", "other": "أخرى"}


async def _is_perpetual(company_id: str) -> bool:
    return await P.inventory_method(db, company_id) == "perpetual"


async def _wh(company_id: str, warehouse_id: Optional[str]) -> str:
    if warehouse_id:
        if warehouse_id != "main" and not await db.warehouses.find_one({"id": warehouse_id, "company_id": company_id}, {"_id": 1}):
            raise HTTPException(404, "المخزن غير موجود")
        return warehouse_id
    return await P.default_warehouse_id(db, company_id)


# ══════════════════════════════════════════════════════════════
# 1. RECEIVE / ISSUE
# ══════════════════════════════════════════════════════════════

class ReceiveRequest(BaseModel):
    product_id:        str
    warehouse_id:      Optional[str] = None
    quantity:          float = Field(gt=0)
    unit_cost:         float = Field(ge=0)
    date:              Optional[str] = None
    valuation_method:  Literal["weighted_average", "fifo"] = "weighted_average"
    purchase_order_id: Optional[str] = None      # مرجع الاستلام (يُستخدم لتوزيع تكاليف الاستيراد)
    payment_method:    Literal["credit", "cash"] = "credit"
    bank_account:      str = "162"


@router.post("/receive")
async def receive_inventory(data: ReceiveRequest, current_user: dict = Depends(get_current_user)):
    """
    استلام بضاعة بدون فاتورة شراء (لا تُسجّل فاتورة شراء لنفس البضاعة وإلا تكررت):
    Dr 125 (الجرد الدوري: 311) / Cr 251 الموردون أو البنك
    """
    company_id = current_user["company_id"]
    product = await P.get_product(db, company_id, data.product_id)
    wh = await _wh(company_id, data.warehouse_id)
    date_str = data.date or date.today().isoformat()
    ref = data.purchase_order_id or f"RCV-{date.today().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"
    total_cost = P.r2(data.quantity * data.unit_cost)
    stock_acc = await P.stock_account(db, company_id, "goods")
    pay_acc = data.bank_account if data.payment_method == "cash" else ACC["ap"]
    if data.payment_method == "cash" and not pay_acc.startswith("16"):
        raise HTTPException(400, "اختر خزينة أو بنكاً للسداد")
    lines = [
        await P.je_line(db, company_id, stock_acc, debit=total_cost,
                        desc=f"استلام {data.quantity:g} × {product['name']} بتكلفة {data.unit_cost:g}"),
        await P.je_line(db, company_id, pay_acc, credit=total_cost,
                        desc=f"{'سداد' if data.payment_method == 'cash' else 'مستحق'} مشتريات {product['name']}"),
    ]
    je_id = await P.post_je(db, company_id, current_user["user_id"], date_str,
                            f"استلام مخزون — {product['name']} ({data.valuation_method})", lines,
                            "inventory_receipt", ref, ref)
    # quantities move after the entry posted (a refused entry used to leave the stock already changed)
    new_cost = await P.stock_in(db, company_id, data.product_id, wh, data.quantity, data.unit_cost,
                                date_str=date_str, source_type="inventory_receipt", source_id=ref,
                                user_id=current_user["user_id"], mtype="purchase", product_name=product["name"])
    if data.valuation_method == "fifo":
        await db.fifo_queue.insert_one({
            "id": str(uuid.uuid4()), "company_id": company_id, "product_id": data.product_id, "warehouse_id": wh,
            "received_date": date_str, "qty_original": data.quantity, "qty_remaining": data.quantity,
            "unit_cost": data.unit_cost, "ref_po": ref})
    return {
        "message": f"تم تسجيل استلام {data.quantity:g} وحدة من {product['name']}",
        "reference": ref,
        "valuation": {"method": data.valuation_method, "unit_cost": data.unit_cost,
                      "new_avg_cost": new_cost, "total_cost": total_cost},
        "journal_entry_id": je_id,
    }


class IssueRequest(BaseModel):
    product_id:       str
    warehouse_id:     Optional[str] = None
    quantity:         float = Field(gt=0)        # negative quantity used to ADD stock
    date:             Optional[str] = None
    valuation_method: Literal["weighted_average", "fifo"] = "weighted_average"
    purpose:          Literal["sale", "production"] = "sale"


@router.post("/issue")
async def issue_inventory(data: IssueRequest, current_user: dict = Depends(get_current_user)):
    """صرف بضاعة (بيع: Dr 314 — إنتاج: Dr 126) / Cr 125 — في الجرد الدوري تتحرك الكمية فقط."""
    company_id = current_user["company_id"]
    product = await P.get_product(db, company_id, data.product_id)
    wh = await _wh(company_id, data.warehouse_id)
    date_str = data.date or date.today().isoformat()
    stock = await P.require_stock(db, company_id, data.product_id, wh, data.quantity, product["name"])
    if data.valuation_method == "fifo":
        cogs, unit = await _consume_fifo(company_id, data.product_id, wh, data.quantity, dry_run=True)
    else:
        unit = float(stock.get("unit_cost") or 0) or await P.average_cost(db, company_id, data.product_id, wh)
        cogs = P.r2(data.quantity * unit)
    src = str(uuid.uuid4())
    je_id = None
    if await _is_perpetual(company_id) and cogs > 0:
        dr = ACC["cogs"] if data.purpose == "sale" else ACC["inventory_wip"]
        lines = [
            await P.je_line(db, company_id, dr, debit=cogs, desc=f"تكلفة صرف {data.quantity:g} × {product['name']}"),
            await P.je_line(db, company_id, ACC["inventory"], credit=cogs, desc=f"صرف مخزون — {product['name']}"),
        ]
        je_id = await P.post_je(db, company_id, current_user["user_id"], date_str,
                                f"صرف مخزون — {product['name']} ({data.valuation_method})", lines, "inventory_issue", src)
    if data.valuation_method == "fifo":
        await _consume_fifo(company_id, data.product_id, wh, data.quantity)
    await P.stock_out(db, company_id, data.product_id, wh, data.quantity, unit, date_str=date_str,
                      source_type="inventory_issue", source_id=src, user_id=current_user["user_id"],
                      mtype="sales" if data.purpose == "sale" else "production_out", product_name=product["name"])
    return {"message": f"تم صرف {data.quantity:g} وحدة", "cogs": cogs, "unit_cost": unit,
            "method": data.valuation_method, "journal_entry_id": je_id}


async def _fifo_take(company_id, product_id, warehouse_id, qty_needed, dry_run=False) -> tuple:
    """Consume oldest-first → (total cost, unit cost, [(lot, qty taken)]).
    dry_run prices the issue without touching the lots."""
    lots = await db.fifo_queue.find({
        "company_id": company_id, "product_id": product_id,
        "warehouse_id": warehouse_id, "qty_remaining": {"$gt": 0}
    }, {"_id": 0}).sort("received_date", 1).to_list(None)
    remaining, total_cost, taken = qty_needed, 0.0, []
    for lot in lots:
        if remaining <= 1e-9:
            break
        take = min(lot["qty_remaining"], remaining)
        total_cost += take * lot["unit_cost"]
        remaining -= take
        taken.append((lot, take))
    if remaining > 1e-9:
        raise HTTPException(400, "دفعات الوارد أولاً (FIFO) غير كافية لهذه الكمية")
    if not dry_run:
        for lot, take in taken:
            await db.fifo_queue.update_one({"id": lot["id"], "company_id": company_id},
                                           {"$inc": {"qty_remaining": -take}})
    return P.r2(total_cost), (round(total_cost / qty_needed, 4) if qty_needed > 0 else 0), taken


async def _consume_fifo(company_id, product_id, warehouse_id, qty_needed, dry_run=False):
    total, unit, _ = await _fifo_take(company_id, product_id, warehouse_id, qty_needed, dry_run)
    return total, unit


# ══════════════════════════════════════════════════════════════
# 2. LANDED COSTS — تكاليف الاستيراد والشحن
# ══════════════════════════════════════════════════════════════

class LandedCostItem(BaseModel):
    type:           Literal["freight", "insurance", "customs", "clearance", "other"] = "other"
    amount:         float = Field(gt=0)
    description:    Optional[str] = None
    credit_account: Optional[str] = None


class LandedCostRequest(BaseModel):
    purchase_order_id: str                       # مرجع الاستلام
    date:              str
    allocation_method: Literal["value", "quantity"] = "value"
    costs:             List[LandedCostItem] = Field(min_length=1)


async def _receipt_lines(company_id: str, ref: str) -> list:
    rows = await db.stock_movements.find(
        {"company_id": company_id, "source_document_id": ref, "quantity": {"$gt": 0},
         "movement_type": {"$in": ["purchase", "in"]}}, {"_id": 0}).to_list(None)
    if not rows:   # receipts made before this version
        rows = await db.inventory_movements.find(
            {"company_id": company_id, "source_document_id": ref, "movement_type": {"$in": ["in", "purchase"]}},
            {"_id": 0}).to_list(None)
    if not rows:
        rows = [{"product_id": l["product_id"], "warehouse_id": l["warehouse_id"], "quantity": l["qty_original"],
                 "unit_cost": l["unit_cost"]}
                for l in await db.fifo_queue.find({"company_id": company_id, "ref_po": ref}, {"_id": 0}).to_list(None)]
    return rows


@router.get("/receipts")
async def list_receipts(current_user: dict = Depends(get_current_user)):
    """آخر أذون الاستلام (من هنا أو من الاعتمادات المستندية) — لاختيار ما تُوزَّع عليه تكاليف الاستيراد."""
    company_id = current_user["company_id"]
    rows = await db.stock_movements.find(
        {"company_id": company_id, "quantity": {"$gt": 0}, "movement_type": "purchase",
         "source_document_type": {"$in": ["inventory_receipt", "letter_of_credit"]}},
        {"_id": 0}).sort("created_at", -1).to_list(500)
    out: dict = {}
    for r in rows:
        k = r.get("source_document_id")
        o = out.setdefault(k, {"reference": k, "source": r.get("source_document_type"), "date": r.get("movement_date"),
                               "lines": 0, "value": 0.0, "products": []})
        o["lines"] += 1
        o["value"] = P.r2(o["value"] + float(r.get("total_cost") or 0))
        if r.get("product_name") and len(o["products"]) < 3:
            o["products"].append(r["product_name"])
    lcs = {l["id"]: l["lc_number"] for l in await db.letters_of_credit.find(
        {"company_id": company_id, "id": {"$in": [k for k, v in out.items() if v["source"] == "letter_of_credit"]}},
        {"_id": 0, "id": 1, "lc_number": 1}).to_list(None)}
    for k, v in out.items():
        if k in lcs:
            v["label"] = f"اعتماد {lcs[k]}"
    return {"receipts": list(out.values())[:100]}


@router.post("/landed-costs")
async def apply_landed_costs(req: LandedCostRequest, current_user: dict = Depends(get_current_user)):
    """
    توزيع تكاليف الاستيراد على أصناف إذن الاستلام (بالقيمة أو بالكمية):
    Dr 125 (الجزء الذي ما زال بالمخزن) + Dr 314 (الجزء الذي بيع بالفعل) — الجرد الدوري: Dr 311
    Cr 251 مستحق / 161-162 مدفوع / 3372-3375 إعادة تبويب مصروف سبق تسجيله
    """
    company_id = current_user["company_id"]
    po_id = req.purchase_order_id
    po_lines = await _receipt_lines(company_id, po_id)
    if not po_lines:
        raise HTTPException(404, f"لا توجد حركات استلام بالمرجع {po_id}")
    perpetual = await _is_perpetual(company_id)
    stock_acc = await P.stock_account(db, company_id, "goods")

    credit_lines = []
    for c in req.costs:
        acc = c.credit_account or LANDED_DEFAULT_CREDIT[c.type]
        # the credit account came from a fixed map keyed on a free "type"; now
        # a caller can choose, but only among accounts that make sense here
        if acc not in LANDED_CREDIT_OK:
            raise HTTPException(400, f"الحساب {acc} غير مسموح كطرف دائن لتكاليف الاستيراد")
        credit_lines.append(await P.je_line(db, company_id, acc, credit=c.amount,
                                            desc=c.description or f"تكلفة استيراد — {LANDED_LABEL[c.type]} — {po_id}"))
    total_landed = P.r2(sum(P.r2(c.amount) for c in req.costs))

    # base: value or quantity — the old "weight" branch summed weights for the
    # total but used quantity per line, so ratios did not add up to 1 and the
    # entry came out unbalanced
    bases = [float(l.get("quantity", 0)) * float(l.get("unit_cost", 0)) if req.allocation_method == "value"
             else float(l.get("quantity", 0)) for l in po_lines]
    tb = sum(bases)
    if tb <= 0:
        raise HTTPException(400, "لا يمكن التوزيع — قيمة/كمية الاستلام صفر؛ جرّب التوزيع بالكمية")

    allocation, debit_stock, debit_cogs, run = [], 0.0, 0.0, 0.0
    for i, (line, base) in enumerate(zip(po_lines, bases)):
        alloc = P.r2(total_landed - run) if i == len(po_lines) - 1 else P.r2(total_landed * base / tb)
        run = P.r2(run + alloc)
        pid, wid, lq = line.get("product_id"), line.get("warehouse_id"), float(line.get("quantity", 0))
        stock = await P.get_stock(db, company_id, pid, wid) if pid and wid else {}
        on_hand = max(float(stock.get("quantity") or 0), 0)
        # landed cost belongs to the goods; the part for units already sold is
        # cost of sales, not stock. Spread the stock part over what is on hand
        # (moving average) — adding a per-unit amount computed on the receipt
        # quantity to an average that also covers older stock overstated it.
        kept_q = min(on_hand, lq) if perpetual else lq
        to_stock = P.r2(alloc * kept_q / lq) if lq > 0 else 0.0
        to_cogs = P.r2(alloc - to_stock)
        debit_stock += to_stock; debit_cogs += to_cogs
        if perpetual and stock and on_hand > 0 and to_stock > 0:
            new_cost = round(float(stock.get("unit_cost") or 0) + to_stock / on_hand, 4)
            await db.stocks.update_one({"company_id": company_id, "product_id": pid, "warehouse_id": wid},
                                       {"$set": {"unit_cost": new_cost, "average_cost": new_cost,
                                                 "total_value": P.r2(float(stock.get("quantity") or 0) * new_cost)}})
        if lq > 0:
            await db.fifo_queue.update_many({"company_id": company_id, "product_id": pid, "warehouse_id": wid, "ref_po": po_id},
                                            {"$inc": {"unit_cost": round(alloc / lq, 4)}})
        allocation.append({"product_id": pid, "product_name": line.get("product_name", ""),
                           "line_value": P.r2(base) if req.allocation_method == "value" else None,
                           "allocation_ratio": round(base / tb, 4), "allocated_cost": alloc,
                           "to_inventory": to_stock, "to_cogs": to_cogs,
                           "extra_per_unit": round(alloc / lq, 4) if lq else 0})

    lines = [await P.je_line(db, company_id, stock_acc, debit=P.r2(debit_stock), desc=f"تكاليف استيراد موزعة — {po_id}")]
    if debit_cogs:
        lines.append(await P.je_line(db, company_id, "314", debit=P.r2(debit_cogs),
                                     desc=f"تكاليف استيراد تخص بضاعة بيعت — {po_id}"))
    je_id = await P.post_je(db, company_id, current_user["user_id"], req.date,
                            f"تكاليف استيراد — {po_id} ({req.allocation_method})", lines + credit_lines,
                            "landed_cost", po_id, po_id)
    return {"message": f"تم توزيع {total_landed:,.2f} ج.م تكاليف استيراد على {len(allocation)} صنف",
            "po_id": po_id, "allocation_method": req.allocation_method, "total_landed_cost": total_landed,
            "allocation": allocation, "journal": {"id": je_id, "debit": total_landed, "credit": total_landed, "balanced": True}}


# ══════════════════════════════════════════════════════════════
# 3. INVENTORY RECONCILIATION — جرد وتسويات المخزون
# ══════════════════════════════════════════════════════════════

SHORTAGE_TOLERANCE_PCT = 0.005  # 0.5% عجز مسموح به افتراضي (قابل للتغيير لكل جرد)


class CountLine(BaseModel):
    product_id:  str
    counted_qty: float = Field(ge=0)
    system_qty:  Optional[float] = None      # ignored: the system quantity is read from the stock record


class ReconciliationRequest(BaseModel):
    warehouse_id:       str
    count_date:         str
    lines:              List[CountLine] = Field(min_length=1)
    shortage_tolerance: float = Field(SHORTAGE_TOLERANCE_PCT, ge=0, le=0.2)
    notes:              Optional[str] = None


@router.get("/count-sheet")
async def count_sheet(warehouse_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """كشف الجرد: الكمية الدفترية وتكلفة الوحدة لكل صنف في المخزن."""
    company_id = current_user["company_id"]
    wh = await _wh(company_id, warehouse_id)
    stocks = await db.stocks.find({"company_id": company_id, "warehouse_id": wh}, {"_id": 0}).to_list(None)
    names = {p["id"]: p for p in await db.products.find(
        {"company_id": company_id, "id": {"$in": [s["product_id"] for s in stocks]}},
        {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(None)}
    rows = [{"product_id": s["product_id"], "product_name": names.get(s["product_id"], {}).get("name") or s.get("product_name", ""),
             "product_code": names.get(s["product_id"], {}).get("code", ""),
             "system_qty": float(s.get("quantity") or 0), "unit_cost": float(s.get("unit_cost") or 0)} for s in stocks]
    rows.sort(key=lambda r: r["product_code"] or r["product_name"])
    return {"warehouse_id": wh, "lines": rows}


@router.post("/reconcile")
async def reconcile_inventory(req: ReconciliationRequest, current_user: dict = Depends(get_current_user)):
    """
    تسوية الجرد:
      عجز ضمن النسبة المسموحة:  Dr 3365 خسائر عهد ومفقودات / Cr 125
      عجز يتجاوز النسبة:         Dr 1314 (أو 1313) مطالبة على المسؤول / Cr 125
      زيادة:                     Dr 125 / Cr 423 إيرادات متنوعة
    (في الجرد الدوري يكون الطرف المخزني 311)
    """
    company_id = current_user["company_id"]
    await _wh(company_id, req.warehouse_id)
    stock_acc = await P.stock_account(db, company_id, "goods")
    denied_acc = (await P.first_account(db, company_id, ACC["shortage_denied"]))["account_code"]
    je_lines, detail = [], []
    tot = {"allowed": 0.0, "denied": 0.0, "surplus": 0.0}
    seen = set()
    for line in req.lines:
        if line.product_id in seen:
            raise HTTPException(400, "صنف مكرر في كشف الجرد")
        seen.add(line.product_id)
        product = await P.get_product(db, company_id, line.product_id)
        stock = await P.get_stock(db, company_id, line.product_id, req.warehouse_id)
        # system_qty came from the request body, so any figure typed there
        # decided the shortage; it is the stock record that is authoritative
        system_qty = float(stock.get("quantity") or 0)
        diff = round(line.counted_qty - system_qty, 4)
        if abs(diff) < 0.001:
            continue
        unit_cost = float(stock.get("unit_cost") or 0) or await P.average_cost(db, company_id, line.product_id, req.warehouse_id)
        value = P.r2(abs(diff) * unit_cost)
        pname = product.get("name", line.product_id)
        if diff < 0:
            kind = "allowed" if abs(diff) <= max(system_qty, 0) * req.shortage_tolerance else "denied"
            acc = ACC["shortage_allowed"] if kind == "allowed" else denied_acc
            je_lines.append(await P.je_line(db, company_id, acc, debit=value,
                                            desc=f"عجز {'مسموح' if kind == 'allowed' else 'غير مسموح'} — {pname} ({abs(diff):g} وحدة)"))
            je_lines.append(await P.je_line(db, company_id, stock_acc, credit=value, desc=f"تسوية جرد — {pname}"))
        else:
            kind = "surplus"
            je_lines.append(await P.je_line(db, company_id, stock_acc, debit=value, desc=f"فائض جرد — {pname} ({diff:g} وحدة)"))
            je_lines.append(await P.je_line(db, company_id, ACC["surplus"], credit=value, desc=f"إيراد زيادة مخزون — {pname}"))
        tot[kind] += value
        detail.append({"product_id": line.product_id, "product_name": pname, "system_qty": system_qty,
                       "counted_qty": line.counted_qty, "difference": diff, "unit_cost": unit_cost,
                       "value": value, "type": kind})
    if not detail:
        return {"message": "لا فروق في الجرد — المخزون مطابق", "differences": 0}

    ref = f"CNT-{req.count_date}-{str(uuid.uuid4())[:6].upper()}"
    je_id = await P.post_je(db, company_id, current_user["user_id"], req.count_date,
                            f"تسوية جرد مخزون — {req.warehouse_id}", je_lines, "inventory_count", ref, ref)
    for d in detail:
        if d["difference"] < 0:
            await P.stock_out(db, company_id, d["product_id"], req.warehouse_id, -d["difference"], d["unit_cost"],
                              date_str=req.count_date, source_type="inventory_count", source_id=ref,
                              user_id=current_user["user_id"], mtype="adjustment_out", product_name=d["product_name"])
        else:
            await P.stock_in(db, company_id, d["product_id"], req.warehouse_id, d["difference"], d["unit_cost"],
                             date_str=req.count_date, source_type="inventory_count", source_id=ref,
                             user_id=current_user["user_id"], mtype="adjustment_in", product_name=d["product_name"])
    await db.inventory_counts.insert_one({"id": ref, "company_id": company_id, "warehouse_id": req.warehouse_id,
                                          "count_date": req.count_date, "detail": detail, "journal_entry_id": je_id,
                                          "notes": req.notes, "created_by": current_user["user_id"],
                                          "created_at": datetime.now(timezone.utc).isoformat()})
    return {
        "message": f"تم إثبات {len(detail)} فرق في الجرد", "reference": ref, "count_date": req.count_date,
        "summary": {"shortage_allowed": P.r2(tot["allowed"]), "shortage_denied": P.r2(tot["denied"]),
                    "surplus": P.r2(tot["surplus"]),
                    "net_inventory_adjustment": P.r2(tot["surplus"] - tot["allowed"] - tot["denied"])},
        "detail": detail, "journal_entry_id": je_id,
        "note": "نسبة العجز المسموح قرار إداري للشركة (الافتراضي 0.5%) — عدّلها حسب طبيعة الصنف",
    }


# ══════════════════════════════════════════════════════════════
# 4. BRANCH / WAREHOUSE TRANSFERS — تحويلات الفروع
# ══════════════════════════════════════════════════════════════

class TransferLine(BaseModel):
    product_id: str
    quantity:   float = Field(gt=0)


class BranchTransferRequest(BaseModel):
    from_warehouse_id: str
    to_warehouse_id:   str
    transfer_date:     str
    lines:             List[TransferLine] = Field(min_length=1)
    notes:             Optional[str] = None


@router.post("/branch-transfer")
async def branch_transfer(req: BranchTransferRequest, current_user: dict = Depends(get_current_user)):
    """
    تحويل بضاعة بين المخازن بتكلفة المخزن المُرسِل.
    لا قيد محاسبي إلا إذا كان لكل مخزن مركز تكلفة مختلف (cost_center_id): عندها
    Dr 125 (مركز المستلم) / Cr 125 (مركز المرسل). كان القيد Dr 125 / Cr 125 بلا أي
    تمييز — قيد صفري الأثر يملأ اليومية فقط.
    """
    company_id = current_user["company_id"]
    if req.from_warehouse_id == req.to_warehouse_id:
        raise HTTPException(400, "المخزن المُرسِل والمستلم واحد")
    src_wh = await db.warehouses.find_one({"id": req.from_warehouse_id, "company_id": company_id}, {"_id": 0}) or {}
    dst_wh = await db.warehouses.find_one({"id": req.to_warehouse_id, "company_id": company_id}, {"_id": 0}) or {}
    if (not src_wh and req.from_warehouse_id != "main") or (not dst_wh and req.to_warehouse_id != "main"):
        raise HTTPException(404, "المخزن غير موجود")
    ref = f"TRF-{date.today().strftime('%Y%m%d')}-{str(uuid.uuid4())[:6].upper()}"

    detail = []
    for item in req.lines:     # validate everything before moving anything
        product = await P.get_product(db, company_id, item.product_id)
        src = await P.require_stock(db, company_id, item.product_id, req.from_warehouse_id, item.quantity, product["name"])
        unit_cost = float(src.get("unit_cost") or 0) or await P.average_cost(db, company_id, item.product_id, req.from_warehouse_id)
        detail.append({"product_id": item.product_id, "product_name": product["name"], "quantity": item.quantity,
                       "unit_cost": unit_cost, "value": P.r2(item.quantity * unit_cost)})
    total_value = P.r2(sum(d["value"] for d in detail))

    je_id = None
    cc_from, cc_to = src_wh.get("cost_center_id"), dst_wh.get("cost_center_id")
    if cc_from != cc_to and total_value > 0 and await _is_perpetual(company_id):
        lines = [
            await P.je_line(db, company_id, ACC["inventory"], debit=total_value, desc=f"تحويل وارد — {dst_wh.get('name', '')}", cost_center_id=cc_to),
            await P.je_line(db, company_id, ACC["inventory"], credit=total_value, desc=f"تحويل صادر — {src_wh.get('name', '')}", cost_center_id=cc_from),
        ]
        je_id = await P.post_je(db, company_id, current_user["user_id"], req.transfer_date,
                                f"تحويل مخزون {ref}", lines, "inventory_transfer", ref, ref)

    for d in detail:
        kw = dict(date_str=req.transfer_date, source_type="inventory_transfer", source_id=ref,
                  user_id=current_user["user_id"], product_name=d["product_name"])
        await P.stock_out(db, company_id, d["product_id"], req.from_warehouse_id, d["quantity"], d["unit_cost"], mtype="transfer_out", **kw)
        await P.stock_in(db, company_id, d["product_id"], req.to_warehouse_id, d["quantity"], d["unit_cost"], mtype="transfer_in", **kw)
        # move only the transferred quantity's FIFO lots (oldest first) — the
        # old code moved EVERY open lot of the product to the destination
        try:
            _, _, taken = await _fifo_take(company_id, d["product_id"], req.from_warehouse_id, d["quantity"], dry_run=True)
        except HTTPException:
            taken = []      # product not (fully) tracked in FIFO lots — nothing to move
        if taken:
            for lot, take in taken:
                await db.fifo_queue.update_one({"id": lot["id"], "company_id": company_id}, {"$inc": {"qty_remaining": -take}})
                await db.fifo_queue.insert_one({**{k: v for k, v in lot.items() if k != "_id"}, "id": str(uuid.uuid4()),
                                                "warehouse_id": req.to_warehouse_id, "qty_original": take,
                                                "qty_remaining": take, "transfer_ref": ref})

    await db.inventory_transfers_engine.insert_one({"id": ref, "company_id": company_id, "from_warehouse_id": req.from_warehouse_id,
                                                    "to_warehouse_id": req.to_warehouse_id, "date": req.transfer_date,
                                                    "detail": detail, "total_value": total_value, "journal_entry_id": je_id,
                                                    "notes": req.notes, "created_by": current_user["user_id"],
                                                    "created_at": datetime.now(timezone.utc).isoformat()})
    return {"message": f"تم تحويل {len(detail)} صنف — إجمالي {total_value:,.2f} ج.م", "reference": ref,
            "from_warehouse": req.from_warehouse_id, "to_warehouse": req.to_warehouse_id,
            "items_transferred": len(detail), "total_value": total_value, "detail": detail,
            "journal_entry_id": je_id}


# ══════════════════════════════════════════════════════════════
# 5. VALUATION REPORT — تقرير تقييم المخزون
# ══════════════════════════════════════════════════════════════

@router.get("/valuation-report")
async def valuation_report(
    warehouse_id: Optional[str] = None,
    method: str = Query("weighted_average", enum=["weighted_average", "fifo"]),
    as_of_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """تقرير تقييم المخزون الحالي — المتوسط المرجح أو الوارد أولاً (الأرصدة الحالية؛ as_of_date للعرض فقط)."""
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if warehouse_id:
        q["warehouse_id"] = warehouse_id
    stocks = await db.stocks.find(q, {"_id": 0}).to_list(None)
    products = {p["id"]: p for p in await db.products.find(
        {"company_id": company_id, "id": {"$in": list({s.get("product_id") for s in stocks})}},
        {"_id": 0, "id": 1, "name": 1, "code": 1}).to_list(None)}
    whs = {w["id"]: w.get("name", "") for w in await db.warehouses.find({"company_id": company_id}, {"_id": 0, "id": 1, "name": 1}).to_list(None)}
    report_lines, total_qty, total_value = [], 0.0, 0.0
    for stock in stocks:
        pid, wid = stock.get("product_id"), stock.get("warehouse_id")
        qty = float(stock.get("quantity", 0) or 0)
        if qty <= 0:
            continue
        if method == "fifo":
            lots = await db.fifo_queue.find({"company_id": company_id, "product_id": pid, "warehouse_id": wid,
                                             "qty_remaining": {"$gt": 0}}, {"_id": 0}).to_list(None)
            if lots:
                value = P.r2(sum(l["qty_remaining"] * l["unit_cost"] for l in lots))
                unit_cost = round(value / qty, 4)
            else:   # never received through FIFO: fall back to the average rather than report zero
                unit_cost = float(stock.get("unit_cost", 0) or 0); value = P.r2(qty * unit_cost)
        else:
            unit_cost = float(stock.get("unit_cost", stock.get("average_cost", 0)) or 0)
            value = P.r2(qty * unit_cost)
        prod = products.get(pid, {})
        report_lines.append({"product_id": pid, "product_code": prod.get("code", ""),
                             "product_name": prod.get("name") or stock.get("product_name", ""),
                             "warehouse_id": wid, "warehouse_name": whs.get(wid, wid),
                             "quantity": qty, "unit_cost": unit_cost, "total_value": value, "method": method})
        total_qty += qty
        total_value += value
    report_lines.sort(key=lambda x: (x["product_code"] or "", x["product_name"] or ""))
    gl_code = await P.stock_account(db, company_id, "goods")
    gl = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": gl_code}, {"_id": 0, "current_balance": 1}) or {}
    return {
        "valuation_method": method, "as_of_date": as_of_date or date.today().isoformat(),
        "warehouse_filter": warehouse_id, "lines": report_lines,
        "totals": {"total_items": len(report_lines), "total_qty": round(total_qty, 2), "total_value": P.r2(total_value)},
        "ledger": {"account_code": gl_code, "balance": P.r2(gl.get("current_balance", 0))} if gl_code != "311" else None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
