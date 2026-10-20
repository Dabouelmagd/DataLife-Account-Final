"""
Manufacturing & Cost Accounting Engine
محرك التكاليف الصناعية والمستحقات والمخصصات

أ. أوامر الإنتاج (WIP → تام الصنع)
ب. تحميل التكاليف الصناعية غير المباشرة (FOH)
ج. فروق التحميل (Over/Under Absorbed Overhead)
د. المدفوعات المقدمة والإيرادات المؤجلة (Prepayments & Deferrals)
هـ. مخصصات الخسائر الائتمانية المتوقعة (ECL — المعيار المصري 47)
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from database import db
from dependencies import get_current_user
from services import ops_posting as P

router = APIRouter(prefix="/api/manufacturing", tags=["Manufacturing & Accruals"])


# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "raw_materials":    "121",   # مخزون خامات ومواد أولية
    # 122 is finished goods; WIP had no account of its own, so completing an
    # order debited and credited the SAME account — a zero-effect entry, and
    # finished production never reached the ledger.
    "wip":              "126",   # إنتاج تحت التشغيل
    # 123 is "مخزون بضاعة بالطريق / اعتمادات" — goods in transit under an LC.
    # Finished production belongs in 122, which is exactly that account.
    "finished_goods":   "122",   # مخزون الإنتاج التام
    # 124 is "مخزون قطع غيار ومهمات" and 125 is "مخزون بضائع بغرض البيع" —
    # applied overhead and its variance were being posted into INVENTORY
    # assets, one of them the very account sales credit their cost from.
    "foh_applied":      "3181",  # تكاليف صناعية غير مباشرة محملة
    "foh_variance":     "3182",  # انحراف التكاليف الصناعية
    "direct_labor_exp": "312",   # أجور عمال الإنتاج المباشرة
    "foh_exp":          "313",   # مصروفات وإهلاكات تشغيلية (FOH الفعلية)
    "prepaid_exp":      "135",   # مصروفات مدفوعة مقدماً
    "deferred_rev":     "257",   # إيرادات محصلة مقدماً
    "accrued_exp":      "253",   # مصروفات مستحقة الدفع
    "ecl_provision":    "224",   # مخصص خسائر ائتمانية متوقعة
    "ecl_expense":      "3368",  # مصروف اضمحلال وخسائر ائتمانية (كان 334: مصروفات بنكية)
    "inv_provision":    "226",   # مخصص هبوط قيمة المخزون
    "inv_writedown_exp":"3183",  # مصروف هبوط مخزون (كان 313: مصروفات تشغيلية عامة)
    "contingency_prov": "227",   # مخصص قضايا والتزامات محتملة
    "contingency_exp":  "3369",  # مصروف مخصص قضايا (كان 333: إهلاكات إدارية)
    "bank":             "162",
    "ar":               "131",
    "service_rev":      "412",   # إيرادات الخدمات المحققة
    "rent_exp":         "332",
}


async def je_line(company_id: str, code: str, debit=0.0, credit=0.0, desc="") -> dict:
    # the old copy fell back to a fake account {"id": code} when the code was
    # missing; ops_posting raises a readable 400 instead
    return await P.je_line(db, company_id, code, debit=debit, credit=credit, desc=desc)


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None) -> str:
    return await P.post_je(db, company_id, user_id, date_str, description, list(lines), "manufacturing", src_id)


# ══════════════════════════════════════════════════════════════
# PART A — MANUFACTURING ENGINE
# قوائم المواد وأوامر الإنتاج: خامات 121 ← تحت التشغيل 126 ← إنتاج تام 122
# ══════════════════════════════════════════════════════════════

class BomComponent(BaseModel):
    product_id: str
    qty: float = Field(gt=0)            # الكمية اللازمة لإنتاج output_qty


class BomRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: str                      # المنتج التام
    name: Optional[str] = None
    output_qty: float = Field(1, gt=0)
    components: List[BomComponent] = Field(min_length=1)
    notes: Optional[str] = None


@router.post("/boms")
async def create_bom(req: BomRequest, current_user: dict = Depends(get_current_user)):
    """قائمة مواد (BOM) لمنتج تام — تُستخدم لاقتراح الخامات عند فتح أمر الإنتاج."""
    company_id = current_user["company_id"]
    prod = await P.get_product(db, company_id, req.product_id)
    comps = []
    for c in req.components:
        if c.product_id == req.product_id:
            raise HTTPException(400, "لا يمكن أن يكون المنتج مكوناً لنفسه")
        cp = await P.get_product(db, company_id, c.product_id)
        comps.append({"product_id": c.product_id, "name": cp.get("name", ""), "qty": c.qty})
    bom = {"id": str(uuid.uuid4()), "company_id": company_id, "product_id": req.product_id,
           "product_name": prod.get("name", ""), "name": req.name or f"قائمة مواد {prod.get('name', '')}",
           "output_qty": req.output_qty, "components": comps, "notes": req.notes, "is_active": True,
           "created_by": current_user["user_id"], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.boms.insert_one(bom); bom.pop("_id", None)
    return {"message": "تم حفظ قائمة المواد", "bom": bom}


@router.get("/boms")
async def list_boms(product_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"], "is_active": True}
    if product_id:
        q["product_id"] = product_id
    return {"boms": await db.boms.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)}


@router.delete("/boms/{bom_id}")
async def delete_bom(bom_id: str, current_user: dict = Depends(get_current_user)):
    r = await db.boms.update_one({"id": bom_id, "company_id": current_user["company_id"]},
                                 {"$set": {"is_active": False}})
    if not r.matched_count:
        raise HTTPException(404, "قائمة المواد غير موجودة")
    return {"message": "تم إيقاف قائمة المواد"}


class ProductionMaterial(BaseModel):
    """صنف مصروف على أمر الإنتاج.

    materials was a free List[dict]: a missing key raised a 500 half-way
    through building the entry, and a zero or negative quantity was accepted.
    """
    name: str = Field("", max_length=200)
    qty: float = Field(gt=0)
    unit_cost: float = Field(0, ge=0)     # يُستبدل بمتوسط التكلفة إن كان للصنف رصيد
    product_id: Optional[str] = None


class ProductionOrderRequest(BaseModel):
    order_number:    str = Field(min_length=1, max_length=60)
    product_id:      str
    product_name:    str = Field("", max_length=200)
    planned_qty:     float = Field(gt=0)
    start_date:      str
    materials: List[ProductionMaterial] = []
    bom_id:          Optional[str] = None
    warehouse_id:    Optional[str] = None       # مخزن الخامات
    # where the materials' cost sits: 121 raw materials (default) or 125 when
    # they were bought through a perpetual purchase invoice, which posts to 125
    materials_account: Literal["121", "125"] = "121"
    notes:           Optional[str] = None


async def _materials(company_id: str, req: ProductionOrderRequest, wh: str) -> list:
    mats = list(req.materials)
    if not mats and req.bom_id:
        bom = await db.boms.find_one({"id": req.bom_id, "company_id": company_id, "is_active": True}, {"_id": 0})
        if not bom:
            raise HTTPException(404, "قائمة المواد غير موجودة")
        if bom["product_id"] != req.product_id:
            raise HTTPException(400, "قائمة المواد لا تخص هذا المنتج")
        factor = req.planned_qty / float(bom.get("output_qty") or 1)
        mats = [ProductionMaterial(product_id=c["product_id"], name=c.get("name", ""), qty=round(c["qty"] * factor, 4))
                for c in bom["components"]]
    if not mats:
        raise HTTPException(400, "حدد الخامات المصروفة أو اختر قائمة مواد")
    out = []
    for m in mats:
        name, cost = m.name, m.unit_cost
        if m.product_id:
            p = await P.get_product(db, company_id, m.product_id)
            name = name or p.get("name", "")
            await P.require_stock(db, company_id, m.product_id, wh, m.qty, name)
            # the ledger already carries this material at its moving average;
            # issuing it at a typed price left a difference in 121 forever
            avg = await P.average_cost(db, company_id, m.product_id, wh)
            cost = avg or cost
        if not name:
            raise HTTPException(400, "اسم الخامة مطلوب")
        out.append({"product_id": m.product_id, "name": name, "qty": m.qty, "unit_cost": cost,
                    "total_cost": P.r2(m.qty * cost)})
    return out


@router.post("/production-orders/preview")
async def preview_production_order(req: ProductionOrderRequest, current_user: dict = Depends(get_current_user)):
    """معاينة الخامات وتكلفتها وقيد الصرف قبل الحفظ (لا يكتب شيئاً)."""
    company_id = current_user["company_id"]
    wh = req.warehouse_id or await P.default_warehouse_id(db, company_id)
    mats = await _materials(company_id, req, wh)
    raw_acc = "311" if await P.inventory_method(db, company_id) == "periodic" else req.materials_account
    total = P.r2(sum(m["total_cost"] for m in mats))
    return {"materials": mats, "total_materials_cost": total, "credit_account": raw_acc, "debit_account": ACC["wip"]}


@router.post("/production-orders")
async def create_production_order(req: ProductionOrderRequest,
                                  current_user: dict = Depends(get_current_user)):
    """
    فتح أمر إنتاج وصرف المواد الخام للتشغيل

    القيد أ — صرف المواد الخام:
    Dr م/126 إنتاج تحت التشغيل (أمر #XXX)
    Cr م/121 مخزون الخامات (أو 125، أو 311 في الجرد الدوري حيث حُمِّلت المشتريات عليه)
    """
    company_id = current_user["company_id"]
    if await db.production_orders.find_one({"company_id": company_id, "order_number": req.order_number}, {"_id": 1}):
        raise HTTPException(400, f"رقم أمر الإنتاج {req.order_number} مستخدم من قبل")
    prod = await P.get_product(db, company_id, req.product_id)
    product_name = req.product_name or prod.get("name", "")
    wh = req.warehouse_id or await P.default_warehouse_id(db, company_id)
    materials = await _materials(company_id, req, wh)
    raw_acc = "311" if await P.inventory_method(db, company_id) == "periodic" else req.materials_account
    # total = sum of the ROUNDED line credits; the unrounded sum used for the
    # debit could differ by a piastre and the entry was refused as unbalanced
    total_materials = P.r2(sum(m["total_cost"] for m in materials))
    if total_materials <= 0:
        raise HTTPException(400, "تكلفة الخامات صفر — أدخل تكلفة الوحدة للخامات بلا رصيد")
    order_id = str(uuid.uuid4())

    lines = [await je_line(company_id, ACC["wip"], debit=total_materials,
                           desc=f"صرف خامات لأمر إنتاج {req.order_number} — {product_name}")]
    for mat in materials:
        lines.append(await je_line(company_id, raw_acc, credit=mat["total_cost"],
                                   desc=f"صرف {mat['name']} ({mat['qty']:g} × {mat['unit_cost']:g})"))
    je_id = await post_je(company_id, current_user["user_id"], req.start_date,
                          f"صرف مواد خام — أمر إنتاج {req.order_number}", lines, order_id)

    # stock moves only after the entry posted, and only for real products —
    # the old {"product_id": None} filter decremented an arbitrary stock row
    for mat in materials:
        if mat["product_id"]:
            await P.stock_out(db, company_id, mat["product_id"], wh, mat["qty"], mat["unit_cost"],
                              date_str=req.start_date, source_type="production_order", source_id=order_id,
                              user_id=current_user["user_id"], mtype="production_out", product_name=mat["name"])

    order = {
        "id": order_id, "company_id": company_id,
        "order_number": req.order_number,
        "product_id": req.product_id, "product_name": product_name,
        "planned_qty": req.planned_qty, "actual_qty": 0,
        "status": "open", "bom_id": req.bom_id, "warehouse_id": wh,
        "materials": materials, "materials_account": raw_acc,
        "total_materials_cost": total_materials,
        "total_labor_cost": 0.0, "total_foh_applied": 0.0,
        "total_actual_cost": total_materials,
        "start_date": req.start_date, "end_date": None,
        "material_je_id": je_id, "notes": req.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.production_orders.insert_one(order); order.pop("_id", None)
    return {
        "message": f"تم فتح أمر الإنتاج {req.order_number}",
        "order": order,
        "journal": {"id": je_id,
                    "debit":  f"م/{ACC['wip']} إنتاج تحت التشغيل  {total_materials:,.2f}",
                    "credit": f"م/{raw_acc} خامات  {total_materials:,.2f}"},
    }


class FohItem(BaseModel):
    type: str = "other"
    amount: float = Field(gt=0)
    description: Optional[str] = None


class AllocateCostsRequest(BaseModel):
    labor_cost: float = Field(0, ge=0)
    foh_costs: List[FohItem] = []
    date: Optional[str] = None


@router.post("/production-orders/{order_id}/allocate-costs")
async def allocate_production_costs(order_id: str, data: AllocateCostsRequest,
                                    current_user: dict = Depends(get_current_user)):
    """
    تحميل الأجور والتكاليف الصناعية غير المباشرة على أمر الإنتاج

    Dr م/126 إنتاج تحت التشغيل
    Cr م/312 أجور تشغيلية مباشرة (نقل الأجر المسجل بالرواتب إلى الأمر)
    Cr م/3181 تكاليف صناعية غير مباشرة محمّلة
    """
    company_id = current_user["company_id"]
    order = await db.production_orders.find_one({"id": order_id, "company_id": company_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "أمر الإنتاج غير موجود")
    if order.get("status") == "closed":
        raise HTTPException(400, "أمر الإنتاج مُغلَق — لا يمكن إضافة تكاليف")

    labor_cost = P.r2(data.labor_cost)
    total_foh = P.r2(sum(P.r2(f.amount) for f in data.foh_costs))
    total_added = P.r2(labor_cost + total_foh)
    if total_added <= 0:
        raise HTTPException(400, "أدخل أجوراً أو تكاليف صناعية بمبلغ موجب")
    date_str = data.date or date.today().isoformat()

    lines = [await je_line(company_id, ACC["wip"], debit=total_added,
                           desc=f"تحميل تكاليف — أمر إنتاج {order['order_number']}")]
    if labor_cost > 0:
        lines.append(await je_line(company_id, ACC["direct_labor_exp"], credit=labor_cost,
                                   desc=f"أجور عمال إنتاج مباشرة — أمر {order['order_number']}"))
    # Overhead used to be credited straight to 332/313 (or ANY account_code the
    # body named). Applied overhead belongs in 3181: actual overhead collects in
    # 313, and /overhead-variance closes 3181 against 313 — which only works if
    # the applied side was actually credited to 3181.
    for foh in data.foh_costs:
        lines.append(await je_line(company_id, ACC["foh_applied"], credit=foh.amount,
                                   desc=f"تكاليف صناعية غير مباشرة محملة — {foh.description or foh.type} — أمر {order['order_number']}"))
    je_id = await post_je(company_id, current_user["user_id"], date_str,
                          f"تحميل تكاليف صناعية — أمر {order['order_number']}", lines, order_id)

    new_total = P.r2(order["total_actual_cost"] + total_added)
    await db.production_orders.update_one({"id": order_id, "company_id": company_id}, {
        "$set": {"total_labor_cost": P.r2(order.get("total_labor_cost", 0) + labor_cost),
                 "total_foh_applied": P.r2(order.get("total_foh_applied", 0) + total_foh),
                 "total_actual_cost": new_total},
        "$push": {"cost_allocations": {"date": date_str, "labor": labor_cost, "foh": total_foh, "je_id": je_id}}})
    return {
        "message": f"تم تحميل التكاليف على أمر الإنتاج {order['order_number']}",
        "allocated": {"labor": labor_cost, "foh": total_foh, "total": total_added},
        "new_total_cost": new_total, "journal_entry_id": je_id,
    }


class CompleteOrderRequest(BaseModel):
    actual_qty: Optional[float] = Field(None, gt=0)
    date: Optional[str] = None
    warehouse_id: Optional[str] = None     # مخزن الإنتاج التام


@router.post("/production-orders/{order_id}/complete")
async def complete_production_order(order_id: str, data: CompleteOrderRequest,
                                    current_user: dict = Depends(get_current_user)):
    """
    إتمام الإنتاج — نقل من WIP إلى مخزون الإنتاج التام
    Dr م/122 مخزون الإنتاج التام
    Cr م/126 إنتاج تحت التشغيل (إقفال بالتكلفة الفعلية)
    """
    company_id = current_user["company_id"]
    order = await db.production_orders.find_one({"id": order_id, "company_id": company_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "أمر الإنتاج غير موجود")
    if order.get("status") != "open":
        raise HTTPException(400, "أمر الإنتاج مُغلَق بالفعل")
    # claim first: two clicks used to post the finished goods twice
    claimed = await db.production_orders.update_one({"id": order_id, "company_id": company_id, "status": "open"},
                                                    {"$set": {"status": "closing"}})
    if not claimed.modified_count:
        raise HTTPException(409, "جارٍ إغلاق أمر الإنتاج بالفعل")

    actual_qty = float(data.actual_qty or order["planned_qty"])
    end_date = data.date or date.today().isoformat()
    total_cost = P.r2(order["total_actual_cost"])
    unit_cost = round(total_cost / actual_qty, 4)
    fg_wh = data.warehouse_id or order.get("warehouse_id") or await P.default_warehouse_id(db, company_id)
    try:
        lines = [
            await je_line(company_id, ACC["finished_goods"], debit=total_cost,
                          desc=f"استلام منتج تام — {order['product_name']} ({actual_qty:g} وحدة @ {unit_cost:g})"),
            await je_line(company_id, ACC["wip"], credit=total_cost,
                          desc=f"إغلاق أمر إنتاج {order['order_number']} بالتكلفة الفعلية {total_cost:,.2f}"),
        ]
        je_id = await post_je(company_id, current_user["user_id"], end_date,
                              f"إتمام أمر إنتاج {order['order_number']} — {order['product_name']}", lines, order_id)
    except Exception:
        await db.production_orders.update_one({"id": order_id, "company_id": company_id}, {"$set": {"status": "open"}})
        raise

    # finished goods enter at a weighted average with what is already on hand —
    # the old $set unit_cost replaced the average of existing stock outright
    await P.stock_in(db, company_id, order["product_id"], fg_wh, actual_qty, unit_cost, date_str=end_date,
                     source_type="production_order", source_id=order_id, user_id=current_user["user_id"],
                     mtype="production_in", product_name=order["product_name"])
    await db.production_orders.update_one({"id": order_id, "company_id": company_id}, {"$set": {
        "status": "closed", "actual_qty": actual_qty, "unit_cost": unit_cost,
        "end_date": end_date, "close_je_id": je_id, "fg_warehouse_id": fg_wh}})
    return {
        "message": f"تم إغلاق أمر الإنتاج {order['order_number']}",
        "product": order["product_name"], "actual_qty": actual_qty,
        "total_cost": total_cost, "unit_cost": unit_cost,
        "journal": {"id": je_id,
                    "debit":  f"م/{ACC['finished_goods']} مخزون الإنتاج التام {total_cost:,.2f}",
                    "credit": f"م/{ACC['wip']} إنتاج تحت التشغيل {total_cost:,.2f}"},
    }


class OverheadVarianceRequest(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")
    actual_foh: float = Field(ge=0)
    applied_foh: Optional[float] = Field(None, ge=0)   # فارغ = مجموع المحمّل على أوامر الفترة
    date: Optional[str] = None


@router.post("/overhead-variance")
async def record_overhead_variance(data: OverheadVarianceRequest,
                                   current_user: dict = Depends(get_current_user)):
    """
    تسوية فروق التحميل في نهاية الشهر — يُقفل 3181 (المحمّل) مقابل 313 (الفعلي)
    والفرق إلى 3182: مدين = نقص تحميل (خسارة)، دائن = زيادة تحميل.
    """
    company_id = current_user["company_id"]
    period = data.period
    if await db.overhead_variances.find_one({"company_id": company_id, "period": period}, {"_id": 1}):
        raise HTTPException(400, f"تمت تسوية فروق التحميل لفترة {period} من قبل")
    applied_foh = data.applied_foh
    if applied_foh is None:
        applied_foh = 0.0
        async for o in db.production_orders.find({"company_id": company_id}, {"_id": 0, "cost_allocations": 1}):
            applied_foh += sum(a.get("foh", 0) for a in o.get("cost_allocations", []) if str(a.get("date", "")).startswith(period))
    applied_foh, actual_foh = P.r2(applied_foh), P.r2(data.actual_foh)
    date_str = data.date or date.today().isoformat()

    variance = P.r2(applied_foh - actual_foh)
    abs_var = abs(variance)
    is_over = variance > 0  # over-absorbed = applied > actual
    if abs_var < 0.01 and applied_foh == 0:
        return {"message": "لا توجد تكاليف صناعية لتسويتها", "variance": 0}

    # Closing reverses each account's own balance: the applied account carries a
    # CREDIT balance, so it is closed by a DEBIT; actual overhead carries a
    # DEBIT balance, so it is closed by a CREDIT.
    lines = [
        await je_line(company_id, ACC["foh_applied"], debit=applied_foh, desc=f"إغلاق التكاليف المحملة — {period}"),
        await je_line(company_id, ACC["foh_exp"], credit=actual_foh, desc=f"إغلاق التكاليف الصناعية الفعلية — {period}"),
        await je_line(company_id, ACC["foh_variance"],
                      credit=abs_var if is_over else 0.0, debit=0.0 if is_over else abs_var,
                      desc=(f"ربح انحراف تحميل (زيادة تحميل) — {period}" if is_over
                            else f"خسارة انحراف تحميل (نقص تحميل) — {period}")),
    ]
    je_id = await post_je(company_id, current_user["user_id"], date_str,
                          f"تسوية فروق التحميل — {period} — {'زيادة' if is_over else 'نقص'} {abs_var:,.2f}", lines, period)
    await db.overhead_variances.insert_one({"id": str(uuid.uuid4()), "company_id": company_id, "period": period,
                                            "applied_foh": applied_foh, "actual_foh": actual_foh,
                                            "variance": variance, "je_id": je_id, "date": date_str})
    return {
        "message": f"تم تسجيل فروق تحميل التكاليف الصناعية — {period}",
        "period": period, "actual_foh": actual_foh, "applied_foh": applied_foh, "variance": variance,
        "variance_type": "over-absorbed (زيادة تحميل)" if is_over else "under-absorbed (نقص تحميل)",
        "journal_entry_id": je_id,
    }


@router.get("/production-orders")
async def list_production_orders(
    status: Optional[str] = None,
    page: int = 1, limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if status: q["status"] = status
    limit = max(1, min(limit, 200))
    total = await db.production_orders.count_documents(q)
    orders = await db.production_orders.find(q, {"_id": 0}).sort(
        "created_at", -1).skip((max(page, 1) - 1) * limit).limit(limit).to_list(None)
    return {"orders": orders, "total": total, "page": page}


# ══════════════════════════════════════════════════════════════
# PART B — PREPAYMENTS & DEFERRALS
# المدفوعات المقدمة والإيرادات المؤجلة
# ══════════════════════════════════════════════════════════════

class PrepaymentRequest(BaseModel):
    prepayment_type: Literal["expense", "revenue"]
    description:     str = Field(min_length=1, max_length=200)
    total_amount:    float = Field(gt=0)
    start_date:      str
    end_date:        str          # فترة الاستحقاق
    payment_date:    str
    payment_account: str = "162"  # بنك | خزينة
    expense_account: str = "332"  # حساب المصروف (للمدفوع مقدماً)
    revenue_account: str = "412"  # حساب الإيراد (للمؤجل)
    notes:           Optional[str] = None


@router.post("/prepayments")
async def create_prepayment(req: PrepaymentRequest,
                            current_user: dict = Depends(get_current_user)):
    """
    المصروفات المدفوعة مقدماً والإيرادات المؤجلة

    عند السداد (مصروف مقدم — إيجار سنوي):
    Dr م/135 إيجار مدفوع مقدماً
    Cr م/112 البنك

    عند التحصيل (إيراد مؤجل — اشتراك سنوي):
    Dr م/112 البنك
    Cr م/147 إيرادات محصلة مقدماً
    """
    company_id = current_user["company_id"]
    prepay_id  = str(uuid.uuid4())
    total      = P.r2(req.total_amount)

    # The three account codes came from the body unchecked: a revenue code as
    # the "payment account" or a bank as the "expense account" posted happily.
    if not req.payment_account.startswith("16"):
        raise HTTPException(400, "حساب السداد/التحصيل يجب أن يكون خزينة أو بنكاً (16x)")
    if req.prepayment_type == "expense" and not req.expense_account.startswith("3"):
        raise HTTPException(400, "حساب المصروف يجب أن يكون من حسابات المصروفات (3x)")
    if req.prepayment_type == "revenue" and not req.revenue_account.startswith("4"):
        raise HTTPException(400, "حساب الإيراد يجب أن يكون من حسابات الإيرادات (4x)")
    await P.get_account(db, company_id, req.expense_account if req.prepayment_type == "expense" else req.revenue_account)

    # Calculate monthly amount
    try:
        sd = date.fromisoformat(req.start_date)
        ed = date.fromisoformat(req.end_date)
    except ValueError:
        raise HTTPException(400, "صيغة التاريخ غير صحيحة (YYYY-MM-DD)")
    if ed < sd:
        raise HTTPException(400, "تاريخ النهاية قبل تاريخ البداية")
    months = max((ed.year - sd.year)*12 + (ed.month - sd.month) + 1, 1)
    monthly = round(total / months, 2)

    # ── القيد الأولي (السداد/التحصيل) ────────────────────────
    if req.prepayment_type == "expense":
        # مصروف مدفوع مقدماً
        init_lines = await asyncio.gather(
            je_line(company_id, ACC["prepaid_exp"], debit=total,
                    desc=f"مصروف مدفوع مقدماً — {req.description}"),
            je_line(company_id, req.payment_account, credit=total,
                    desc=f"سداد {req.description} مقدماً"),
        )
        init_desc = f"مصروف مقدم — {req.description}"
    else:
        # إيراد محصل مقدماً
        init_lines = await asyncio.gather(
            je_line(company_id, req.payment_account, debit=total,
                    desc=f"تحصيل اشتراك/إيراد مقدم — {req.description}"),
            je_line(company_id, ACC["deferred_rev"], credit=total,
                    desc=f"إيراد محصل مقدماً — {req.description}"),
        )
        init_desc = f"إيراد مؤجل — {req.description}"

    je_init_id = await post_je(company_id, current_user["user_id"], req.payment_date,
        init_desc, list(init_lines), prepay_id)

    # ── إنشاء جدول الاستحقاق الشهري ──────────────────────────
    schedule = []
    current_date = sd
    remaining = total
    for i in range(months):
        due_date   = current_date.isoformat()
        amount     = monthly if i < months - 1 else round(remaining, 2)
        remaining -= amount
        schedule.append({
            "month":   current_date.strftime("%Y-%m"),
            "due_date": due_date,
            "amount":  amount,
            "posted":  False,
            "je_id":   None,
        })
        # Advance month
        current_date = (current_date.replace(day=1) + relativedelta(months=1))

    # Save prepayment
    prepayment = {
        "id": prepay_id, "company_id": company_id,
        "prepayment_type": req.prepayment_type,
        "description": req.description,
        "total_amount": total, "monthly_amount": monthly,
        "months": months,
        "start_date": req.start_date, "end_date": req.end_date,
        "expense_account": req.expense_account,
        "revenue_account": req.revenue_account,
        "schedule": schedule,
        "initial_je_id": je_init_id,
        "status": "active",
        "notes": req.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.prepayments.insert_one(prepayment); prepayment.pop("_id", None)

    return {
        "message":    f"تم تسجيل {init_desc}",
        "prepayment": prepayment,
        "schedule_preview": schedule[:3],
        "initial_journal": je_init_id,
    }


@router.post("/prepayments/run-accruals")
async def run_monthly_accruals(data: dict,
                               current_user: dict = Depends(get_current_user)):
    """
    تشغيل القيود الشهرية التلقائية للمدفوعات المقدمة والإيرادات المؤجلة

    مصروف مقدم — الاستحقاق الشهري:
    Dr م/332 مصروف الإيجار
    Cr م/135 إيجار مدفوع مقدماً

    إيراد مؤجل — الاستحقاق الشهري:
    Dr م/147 إيرادات محصلة مقدماً
    Cr م/412 إيرادات الخدمات المحققة
    """
    company_id = current_user["company_id"]
    period     = data.get("period")  # "2026-01"
    date_str   = data.get("date", date.today().isoformat())

    if not period:
        raise HTTPException(400, "period مطلوب (مثال: '2026-01')")

    prepayments = await db.prepayments.find(
        {"company_id": company_id, "status": "active"}, {"_id": 0}
    ).to_list(None)

    posted_count = 0
    results = []

    for prepay in prepayments:
        for i, slot in enumerate(prepay.get("schedule", [])):
            if slot["month"] != period or slot.get("posted"):
                continue

            amount    = float(slot["amount"])
            prep_type = prepay["prepayment_type"]
            desc_base = prepay["description"]

            if prep_type == "expense":
                exp_acc = prepay.get("expense_account", ACC["rent_exp"])
                lines = await asyncio.gather(
                    je_line(company_id, exp_acc, debit=amount,
                            desc=f"استحقاق شهري — {desc_base} — {period}"),
                    je_line(company_id, ACC["prepaid_exp"], credit=amount,
                            desc=f"إقفال مصروف مقدم — {desc_base}"),
                )
            else:
                rev_acc = prepay.get("revenue_account", ACC["service_rev"])
                lines = await asyncio.gather(
                    je_line(company_id, ACC["deferred_rev"], debit=amount,
                            desc=f"استحقاق إيراد — {desc_base} — {period}"),
                    je_line(company_id, rev_acc, credit=amount,
                            desc=f"إيراد خدمة محقق — {desc_base}"),
                )

            je_id = await post_je(company_id, current_user["user_id"], date_str,
                f"استحقاق {'مصروف' if prep_type=='expense' else 'إيراد'} — {desc_base} — {period}",
                list(lines), prepay["id"])

            # Mark as posted
            prepay["schedule"][i]["posted"] = True
            prepay["schedule"][i]["je_id"]  = je_id
            await db.prepayments.update_one(
                {"id": prepay["id"]},
                {"$set": {f"schedule.{i}.posted": True, f"schedule.{i}.je_id": je_id}}
            )

            posted_count += 1
            results.append({
                "prepayment_id": prepay["id"],
                "description": desc_base,
                "type": prep_type,
                "amount": amount,
                "je_id": je_id,
            })

    return {
        "message": f"تم ترحيل {posted_count} قيد استحقاق لفترة {period}",
        "period":  period,
        "posted":  posted_count,
        "details": results,
    }


# ══════════════════════════════════════════════════════════════
# PART C — ECL & PROVISIONS
# مخصص الخسائر الائتمانية المتوقعة والمخصصات
# ══════════════════════════════════════════════════════════════

@router.post("/provisions/ecl")
async def create_ecl_provision(data: dict,
                               current_user: dict = Depends(get_current_user)):
    """
    مخصص الخسائر الائتمانية المتوقعة (ECL)
    المعيار المحاسبي المصري 47 (IFRS 9 المصري)

    القيد:
    Dr م/334 مصروف اضمحلال وخسائر ائتمانية متوقعة
    Cr م/224 مخصص خسائر ائتمانية متوقعة (Contra-Asset)

    ECL = الرصيد المتأخر × PD × LGD
    PD = Probability of Default (احتمال التخلف)
    LGD = Loss Given Default (نسبة الخسارة عند التخلف)
    """
    company_id  = current_user["company_id"]
    date_str    = data.get("date", date.today().isoformat())
    method      = data.get("method", "simplified")  # simplified | full_ecl

    # ── Simplified approach: Aging buckets ────────────────────
    AGING_RATES = {
        "current":     0.005,  # 0.5% — جارية
        "1_30":        0.02,   # 2%   — متأخرة 1-30 يوم
        "31_90":       0.05,   # 5%   — متأخرة 31-90 يوم
        "91_180":      0.15,   # 15%  — متأخرة 91-180 يوم
        "181_365":     0.35,   # 35%  — متأخرة 181-365 يوم
        "over_365":    0.75,   # 75%  — متأخرة أكثر من سنة
    }

    today = date.today()
    # Aggregate AR by aging bucket
    open_ar = await db.invoices.find({
        "company_id": company_id,
        "document_type": "sales_invoice",
        "status": {"$nin": ["paid","cancelled"]},
    }, {"_id": 0, "grand_total":1, "amount_paid":1, "document_date":1, "due_date":1,
        "party_name":1, "party_id":1}).to_list(None)

    buckets = {k: 0.0 for k in AGING_RATES}
    ar_detail = []

    for inv in open_ar:
        # was grand_total: a half-paid invoice was provisioned on its full value
        amount   = P.r2(float(inv.get("grand_total", 0) or 0) - float(inv.get("amount_paid", 0) or 0))
        if amount <= 0:
            continue
        due_date_str = inv.get("due_date") or inv.get("document_date", today.isoformat())
        try:
            due = date.fromisoformat(str(due_date_str)[:10])
        except Exception:
            due = today
        days_overdue = max((today - due).days, 0)

        if days_overdue == 0:       bucket = "current"
        elif days_overdue <= 30:    bucket = "1_30"
        elif days_overdue <= 90:    bucket = "31_90"
        elif days_overdue <= 180:   bucket = "91_180"
        elif days_overdue <= 365:   bucket = "181_365"
        else:                       bucket = "over_365"

        buckets[bucket] += amount
        ar_detail.append({
            "party": inv.get("party_name",""),
            "amount": amount,
            "days_overdue": days_overdue,
            "bucket": bucket,
            "ecl_rate": AGING_RATES[bucket],
            "ecl_amount": round(amount * AGING_RATES[bucket], 2),
        })

    total_ecl = round(sum(
        buckets[b] * AGING_RATES[b] for b in AGING_RATES
    ), 2)


    # Get existing provision balance
    existing = await db.provisions.find_one(
        {"company_id": company_id, "provision_type": "ecl"}, {"_id": 0}
    )
    existing_balance = float(existing.get("current_balance", 0)) if existing else 0
    adjustment = round(total_ecl - existing_balance, 2)

    je_id = None
    if abs(adjustment) >= 0.01:
        if adjustment > 0:
            lines = await asyncio.gather(
                je_line(company_id, ACC["ecl_expense"], debit=adjustment,
                        desc=f"مصروف اضمحلال ائتماني متوقع — {date_str}"),
                je_line(company_id, ACC["ecl_provision"], credit=adjustment,
                        desc=f"مخصص خسائر ائتمانية متوقعة (ECL) — {date_str}"),
            )
        else:
            lines = await asyncio.gather(
                je_line(company_id, ACC["ecl_provision"], debit=abs(adjustment),
                        desc=f"تخفيض مخصص ECL — {date_str}"),
                je_line(company_id, ACC["ecl_expense"], credit=abs(adjustment),
                        desc=f"إيراد انعكاس مخصص ECL — {date_str}"),
            )
        je_id = await post_je(company_id, current_user["user_id"], date_str,
            f"مخصص خسائر ائتمانية متوقعة (ECL) — {date_str}", list(lines))

        # Update provision record
        await db.provisions.update_one(
            {"company_id": company_id, "provision_type": "ecl"},
            {"$set": {"current_balance": total_ecl, "last_updated": date_str,
                      "last_je_id": je_id}},
            upsert=True
        )

    # Aging summary
    aging_summary = [
        {"bucket": b, "amount": round(buckets[b], 2),
         "rate": f"{AGING_RATES[b]*100:.1f}%",
         "ecl":  round(buckets[b] * AGING_RATES[b], 2)}
        for b in AGING_RATES
    ]

    return {
        "message":     f"تم احتساب وتسجيل مخصص ECL",
        "date":        date_str,
        "method":      "Simplified Approach (Aging Matrix) — المعيار المصري 47",
        "aging_summary": aging_summary,
        "total_ar":    round(sum(buckets.values()), 2),
        "total_ecl":   total_ecl,
        "existing_provision": existing_balance,
        "adjustment":  adjustment,
        "journal_entry_id": je_id,
        "ar_detail":   ar_detail[:20],  # first 20 items
    }


@router.post("/provisions/inventory-writedown")
async def inventory_writedown(data: dict,
                              current_user: dict = Depends(get_current_user)):
    """
    مخصص هبوط قيمة المخزون (Inventory Write-down)

    القيد:
    Dr م/313 مصروف هبوط مخزون
    Cr م/226 مخصص هبوط قيمة المخزون (Contra-Asset)
    """
    company_id  = current_user["company_id"]
    amount      = P.r2(data.get("amount", 0) or 0)
    if amount <= 0:
        raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
    reason      = data.get("reason", "هبوط قيمة مخزون ركود")
    date_str    = data.get("date", date.today().isoformat())
    product_id  = data.get("product_id")

    lines = await asyncio.gather(
        je_line(company_id, ACC["inv_writedown_exp"], debit=amount,
                desc=f"مصروف هبوط مخزون — {reason}"),
        je_line(company_id, ACC["inv_provision"], credit=amount,
                desc=f"مخصص هبوط قيمة مخزون — {reason}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"هبوط قيمة مخزون — {reason}", list(lines), product_id)

    return {
        "message":  f"تم تسجيل مخصص هبوط المخزون {amount:,.2f} ج.م",
        "reason":   reason,
        "amount":   amount,
        "journal":  {"id": je_id,
                     "debit":  f"م/{ACC['inv_writedown_exp']} مصروف هبوط مخزون {amount:,.2f}",
                     "credit": f"م/{ACC['inv_provision']} مخصص هبوط مخزون {amount:,.2f}"},
    }


@router.post("/provisions/contingency")
async def contingency_provision(data: dict,
                                current_user: dict = Depends(get_current_user)):
    """
    مخصص القضايا والالتزامات المحتملة

    القيد:
    Dr م/333 مصروف مخصص قضايا
    Cr م/227 مخصص قضايا والتزامات محتملة
    """
    company_id = current_user["company_id"]
    amount     = P.r2(data.get("amount", 0) or 0)
    if amount <= 0:
        raise HTTPException(400, "المبلغ يجب أن يكون أكبر من صفر")
    case_desc  = data.get("description", "مخصص قضايا")
    date_str   = data.get("date", date.today().isoformat())

    lines = await asyncio.gather(
        je_line(company_id, ACC["contingency_exp"], debit=amount,
                desc=f"مصروف مخصص قضايا — {case_desc}"),
        je_line(company_id, ACC["contingency_prov"], credit=amount,
                desc=f"مخصص قضايا والتزامات محتملة — {case_desc}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"مخصص قضايا — {case_desc}", list(lines))

    return {
        "message":  f"تم تسجيل مخصص القضايا {amount:,.2f} ج.م",
        "description": case_desc,
        "amount":   amount,
        "journal_entry_id": je_id,
    }
