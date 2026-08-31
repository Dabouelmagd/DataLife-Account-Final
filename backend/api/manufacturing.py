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
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/manufacturing", tags=["Manufacturing & Accruals"])


# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "raw_materials":    "121",   # مخزون خامات ومواد أولية
    "wip":              "122",   # إنتاج تحت التشغيل
    "finished_goods":   "123",   # مخزون إنتاج تام (نستخدم 123 للمنتجات التامة)
    "foh_applied":      "124",   # تكاليف صناعية غير مباشرة محملة
    "foh_variance":     "125",   # انحراف التكاليف الصناعية
    "direct_labor_exp": "312",   # أجور عمال الإنتاج المباشرة
    "foh_exp":          "313",   # مصروفات وإهلاكات تشغيلية (FOH الفعلية)
    "prepaid_exp":      "135",   # مصروفات مدفوعة مقدماً
    "deferred_rev":     "147",   # إيرادات محصلة مقدماً
    "accrued_exp":      "253",   # مصروفات مستحقة الدفع
    "ecl_provision":    "224",   # مخصص خسائر ائتمانية متوقعة
    "ecl_expense":      "334",   # مصروف اضمحلال وخسائر ائتمانية
    "inv_provision":    "226",   # مخصص هبوط قيمة المخزون
    "inv_writedown_exp":"313",   # مصروف هبوط مخزون
    "contingency_prov": "227",   # مخصص قضايا والتزامات محتملة
    "contingency_exp":  "333",   # مصروف مخصص قضايا
    "bank":             "112",
    "ar":               "131",
    "service_rev":      "412",   # إيرادات الخدمات المحققة
    "rent_exp":         "332",
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


# ══════════════════════════════════════════════════════════════
# PART A — MANUFACTURING ENGINE
# أوامر الإنتاج وتكاليف التصنيع
# ══════════════════════════════════════════════════════════════

class ProductionOrderRequest(BaseModel):
    order_number:    str
    product_id:      str
    product_name:    str
    planned_qty:     float
    start_date:      str
    materials: List[dict]  # [{product_id, name, qty, unit_cost}]
    notes:           Optional[str] = None


@router.post("/production-orders")
async def create_production_order(req: ProductionOrderRequest,
                                  current_user: dict = Depends(get_current_user)):
    """
    فتح أمر إنتاج وصرف المواد الخام للتشغيل

    القيد أ — صرف المواد الخام:
    Dr م/122 إنتاج تحت التشغيل (أمر #XXX)
    Cr م/121 مخزون الخامات والمواد الأولية
    """
    company_id = current_user["company_id"]

    total_materials = sum(
        float(m["qty"]) * float(m["unit_cost"]) for m in req.materials
    )

    # ── قيد صرف المواد الخام ──────────────────────────────────
    lines = [await je_line(
        company_id, ACC["wip"], debit=total_materials,
        desc=f"صرف خامات لأمر إنتاج {req.order_number} — {req.product_name}"
    )]

    for mat in req.materials:
        mat_cost = round(float(mat["qty"]) * float(mat["unit_cost"]), 2)
        lines.append(await je_line(
            company_id, ACC["raw_materials"], credit=mat_cost,
            desc=f"صرف {mat['name']} ({mat['qty']} وحدة × {mat['unit_cost']})"
        ))
        # Reduce raw material stock
        await db.stocks.update_one(
            {"product_id": mat.get("product_id"), "company_id": company_id},
            {"$inc": {"quantity": -float(mat["qty"])}}
        )

    je_id = await post_je(company_id, current_user["user_id"], req.start_date,
        f"صرف مواد خام — أمر إنتاج {req.order_number}", lines)

    # Save production order
    order = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "order_number": req.order_number,
        "product_id": req.product_id, "product_name": req.product_name,
        "planned_qty": req.planned_qty, "actual_qty": 0,
        "status": "open",
        "materials": req.materials,
        "total_materials_cost": total_materials,
        "total_labor_cost":  0.0,
        "total_foh_applied": 0.0,
        "total_actual_cost": total_materials,
        "start_date": req.start_date, "end_date": None,
        "material_je_id": je_id, "notes": req.notes,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.production_orders.insert_one(order); order.pop("_id", None)

    return {
        "message":  f"تم فتح أمر الإنتاج {req.order_number}",
        "order":    order,
        "journal":  {"id": je_id,
                     "debit":  f"م/122 إنتاج تحت التشغيل  {total_materials:,.2f}",
                     "credit": f"م/121 مخزون خامات         {total_materials:,.2f}"},
    }


@router.post("/production-orders/{order_id}/allocate-costs")
async def allocate_production_costs(order_id: str, data: dict,
                                    current_user: dict = Depends(get_current_user)):
    """
    تحميل الأجور والتكاليف الصناعية غير المباشرة (FOH)

    القيد ب:
    Dr م/122 إنتاج تحت التشغيل (أمر #XXX)
    Cr م/312 أجور عمال الإنتاج المباشرة
    Cr م/313 تكاليف صناعية غير مباشرة (كهرباء/صيانة/إهلاك)
    """
    company_id = current_user["company_id"]
    order = await db.production_orders.find_one(
        {"id": order_id, "company_id": company_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "أمر الإنتاج غير موجود")
    if order.get("status") == "closed":
        raise HTTPException(400, "أمر الإنتاج مُغلَق — لا يمكن إضافة تكاليف")

    labor_cost = float(data.get("labor_cost", 0))
    foh_costs  = data.get("foh_costs", [])  # [{type, amount, account_code}]
    date_str   = data.get("date", date.today().isoformat())

    total_foh   = sum(float(f["amount"]) for f in foh_costs)
    total_added = labor_cost + total_foh

    lines = [await je_line(
        company_id, ACC["wip"], debit=total_added,
        desc=f"تحميل تكاليف — أمر إنتاج {order['order_number']}"
    )]

    if labor_cost > 0:
        lines.append(await je_line(
            company_id, ACC["direct_labor_exp"], credit=labor_cost,
            desc=f"أجور عمال إنتاج مباشرة — أمر {order['order_number']}"))

    FOH_ACCOUNTS = {
        "electricity": "332", "maintenance": "313",
        "depreciation": "313", "insurance": "332",
        "rent": "332", "other": "313"
    }
    for foh in foh_costs:
        foh_acc  = foh.get("account_code") or FOH_ACCOUNTS.get(foh.get("type","other"), "313")
        foh_amt  = float(foh["amount"])
        foh_desc = foh.get("description", foh.get("type","تكلفة صناعية"))
        lines.append(await je_line(
            company_id, foh_acc, credit=foh_amt,
            desc=f"تكلفة صناعية غير مباشرة — {foh_desc} — أمر {order['order_number']}"))

    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"تحميل تكاليف صناعية — أمر {order['order_number']}", lines, order_id)

    new_total = round(order["total_actual_cost"] + total_added, 2)
    await db.production_orders.update_one({"id": order_id}, {"$set": {
        "total_labor_cost":  round(order.get("total_labor_cost", 0) + labor_cost, 2),
        "total_foh_applied": round(order.get("total_foh_applied", 0) + total_foh, 2),
        "total_actual_cost": new_total,
    }})

    return {
        "message":   f"تم تحميل التكاليف على أمر الإنتاج {order['order_number']}",
        "allocated": {"labor": labor_cost, "foh": total_foh, "total": total_added},
        "new_total_cost": new_total,
        "journal_entry_id": je_id,
    }


@router.post("/production-orders/{order_id}/complete")
async def complete_production_order(order_id: str, data: dict,
                                    current_user: dict = Depends(get_current_user)):
    """
    إتمام الإنتاج — نقل من WIP إلى مخزون المنتجات التامة

    القيد ج:
    Dr م/123 مخزون المنتجات تامة الصنع
    Cr م/122 إنتاج تحت التشغيل (إغلاق بالتكلفة الفعلية)
    """
    company_id  = current_user["company_id"]
    order = await db.production_orders.find_one(
        {"id": order_id, "company_id": company_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "أمر الإنتاج غير موجود")
    if order.get("status") == "closed":
        raise HTTPException(400, "أمر الإنتاج مُغلَق بالفعل")

    actual_qty  = float(data.get("actual_qty", order["planned_qty"]))
    end_date    = data.get("date", date.today().isoformat())
    total_cost  = float(order["total_actual_cost"])
    unit_cost   = round(total_cost / actual_qty, 4) if actual_qty > 0 else 0

    lines = await asyncio.gather(
        je_line(company_id, ACC["finished_goods"], debit=total_cost,
                desc=f"استلام منتج تام — {order['product_name']} ({actual_qty} وحدة @ {unit_cost})"),
        je_line(company_id, ACC["wip"], credit=total_cost,
                desc=f"إغلاق أمر إنتاج {order['order_number']} بالتكلفة الفعلية {total_cost:,.2f}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], end_date,
        f"إتمام أمر إنتاج {order['order_number']} — {order['product_name']}", list(lines), order_id)

    # Update finished goods stock
    await db.stocks.update_one(
        {"product_id": order["product_id"], "company_id": company_id},
        {"$inc": {"quantity": actual_qty}, "$set": {"unit_cost": unit_cost}},
        upsert=True
    )

    await db.production_orders.update_one({"id": order_id}, {"$set": {
        "status": "closed", "actual_qty": actual_qty,
        "unit_cost": unit_cost, "end_date": end_date, "close_je_id": je_id,
    }})

    return {
        "message":  f"تم إغلاق أمر الإنتاج {order['order_number']}",
        "product":  order["product_name"],
        "actual_qty": actual_qty,
        "total_cost": total_cost,
        "unit_cost":  unit_cost,
        "journal": {"id": je_id,
                    "debit":  f"م/123 مخزون منتجات تامة {total_cost:,.2f}",
                    "credit": f"م/122 إنتاج تحت التشغيل {total_cost:,.2f}"},
    }


@router.post("/overhead-variance")
async def record_overhead_variance(data: dict,
                                   current_user: dict = Depends(get_current_user)):
    """
    تسوية فروق التحميل (Over/Under Absorbed FOH) في نهاية الشهر

    Under-absorbed (فعلي > مُحمَّل):
    Dr م/124 انحراف تكاليف صناعية (خسارة)
    Cr م/313 تكاليف صناعية غير مباشرة (إغلاق الفعلي)

    Over-absorbed (مُحمَّل > فعلي):
    Dr م/313 تكاليف صناعية غير مباشرة
    Cr م/124 انحراف تكاليف صناعية (ربح)
    """
    company_id   = current_user["company_id"]
    period       = data.get("period")  # "2026-01"
    actual_foh   = float(data.get("actual_foh",   0))
    applied_foh  = float(data.get("applied_foh",  0))
    date_str     = data.get("date", date.today().isoformat())

    variance     = round(applied_foh - actual_foh, 2)
    abs_var      = abs(variance)
    is_over      = variance > 0  # over-absorbed = applied > actual

    if abs_var < 0.01:
        return {"message": "لا فروق تحميل — التكاليف المحملة مساوية للفعلية", "variance": 0}

    if is_over:
        # Over-absorbed: محمَّل أكثر من الفعلي → ربح
        lines = await asyncio.gather(
            je_line(company_id, ACC["foh_exp"], debit=actual_foh,
                    desc=f"إغلاق تكاليف صناعية فعلية — {period}"),
            je_line(company_id, ACC["foh_applied"], credit=applied_foh,
                    desc=f"إغلاق تكاليف محملة — {period}"),
            je_line(company_id, ACC["foh_variance"], credit=abs_var,
                    desc=f"ربح انحراف تحميل (over-absorbed) — {period}"),
        )
    else:
        # Under-absorbed: محمَّل أقل من الفعلي → خسارة
        lines = await asyncio.gather(
            je_line(company_id, ACC["foh_exp"], debit=actual_foh,
                    desc=f"إغلاق تكاليف صناعية فعلية — {period}"),
            je_line(company_id, ACC["foh_applied"], credit=applied_foh,
                    desc=f"إغلاق تكاليف محملة — {period}"),
            je_line(company_id, ACC["foh_variance"], debit=abs_var,
                    desc=f"خسارة انحراف تحميل (under-absorbed) — {period}"),
        )

    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"تسوية فروق التحميل — {period} — {'زيادة' if is_over else 'نقص'} {abs_var:,.2f}",
        [l for l in lines], period)

    return {
        "message":      f"تم تسجيل فروق تحميل التكاليف الصناعية — {period}",
        "period":       period,
        "actual_foh":   actual_foh,
        "applied_foh":  applied_foh,
        "variance":     variance,
        "variance_type":"over-absorbed (زيادة تحميل)" if is_over else "under-absorbed (نقص تحميل)",
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
    total  = await db.production_orders.count_documents(q)
    orders = await db.production_orders.find(q, {"_id": 0}).sort(
        "created_at", -1).skip((page-1)*limit).limit(limit).to_list(None)
    return {"orders": orders, "total": total, "page": page}


# ══════════════════════════════════════════════════════════════
# PART B — PREPAYMENTS & DEFERRALS
# المدفوعات المقدمة والإيرادات المؤجلة
# ══════════════════════════════════════════════════════════════

class PrepaymentRequest(BaseModel):
    prepayment_type: str  # expense | revenue
    description:     str
    total_amount:    float
    start_date:      str
    end_date:        str          # فترة الاستحقاق
    payment_date:    str
    payment_account: str = "112"  # بنك | خزينة
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
    total      = req.total_amount

    # Calculate monthly amount
    sd = date.fromisoformat(req.start_date)
    ed = date.fromisoformat(req.end_date)
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
    }, {"_id": 0, "grand_total":1, "document_date":1, "due_date":1,
        "party_name":1, "party_id":1}).to_list(None)

    buckets = {k: 0.0 for k in AGING_RATES}
    ar_detail = []

    for inv in open_ar:
        amount   = float(inv.get("grand_total", 0))
        due_date_str = inv.get("due_date") or inv.get("document_date", today.isoformat())
        try:
            due = date.fromisoformat(due_date_str)
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

    if total_ecl <= 0:
        return {"message": "لا يوجد رصيد ECL مستحق", "total_ecl": 0}

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
    amount      = float(data.get("amount", 0))
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
    amount     = float(data.get("amount", 0))
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
