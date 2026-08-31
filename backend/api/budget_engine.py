"""
Budgeting & Control Engine — محرك الموازنات التقديرية والرقابة المالية

يتيح للمدير المالي وضع موازنات مستقلة لكل:
- مركز تكلفة (Cost Center)
- مشروع (Project)
- قسم (Department)
- حساب محاسبي (Account)

مع فرض رقابة مسبقة على الصرف:
  Actual + Committed + Current ≤ Allocated → نعم: تمر | لا: hard_stop أو warning
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/budget", tags=["Budget & Control"])


# ══════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════

class BudgetLineRequest(BaseModel):
    fiscal_year:      int
    account_code:     str
    account_name:     Optional[str] = None
    cost_center_id:   Optional[str] = None
    cost_center_name: Optional[str] = None
    project_id:       Optional[str] = None
    project_name:     Optional[str] = None
    department_id:    Optional[str] = None
    department_name:  Optional[str] = None
    allocated_amount: float
    control_action:   str = "warning_only"  # warning_only | hard_stop_prevent_entry
    notes:            Optional[str] = None


class BudgetCheckRequest(BaseModel):
    """طلب فحص الموازنة قبل تنفيذ معاملة"""
    fiscal_year:     int
    account_code:    str
    cost_center_id:  Optional[str] = None
    project_id:      Optional[str] = None
    department_id:   Optional[str] = None
    transaction_amount: float
    source_document_type: str = "purchase_order"  # purchase_order | expense | manual
    source_document_id:   Optional[str] = None
    description:          Optional[str] = None


class BudgetOverrideRequest(BaseModel):
    """طلب تجاوز الموازنة باعتماد استثنائي"""
    budget_check_id: str
    justification:   str
    override_amount: Optional[float] = None  # None = override full excess


# ══════════════════════════════════════════════════════════════
# 1. BUDGET SETUP — إعداد الموازنات
# ══════════════════════════════════════════════════════════════

@router.post("/lines")
async def create_budget_line(
    req: BudgetLineRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إنشاء أو تحديث سطر موازنة

    يُحدِّد الحد المسموح للإنفاق على:
    حساب محاسبي × مركز تكلفة × مشروع × قسم × سنة مالية

    control_action:
    - warning_only          → يُنبِّه فقط، يُسمَح بالمتابعة
    - hard_stop_prevent_entry → يمنع الحفظ تماماً
    """
    company_id = current_user["company_id"]

    if req.allocated_amount < 0:
        raise HTTPException(400, "مبلغ الموازنة يجب أن يكون موجباً")
    if req.control_action not in ("warning_only", "hard_stop_prevent_entry"):
        raise HTTPException(400, "control_action غير صحيح")

    # Upsert: replace if same fiscal_year + account + centers
    filter_key = {
        "company_id":    company_id,
        "fiscal_year":   req.fiscal_year,
        "account_code":  req.account_code,
        "cost_center_id": req.cost_center_id,
        "project_id":    req.project_id,
        "department_id": req.department_id,
    }

    line_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        **filter_key,
        "id":              line_id,
        "account_name":    req.account_name or req.account_code,
        "cost_center_name": req.cost_center_name,
        "project_name":    req.project_name,
        "department_name": req.department_name,
        "allocated_amount": req.allocated_amount,
        "control_action":  req.control_action,
        "notes":           req.notes,
        "created_by":      current_user["user_id"],
        "created_at":      now,
        "updated_at":      now,
    }

    existing = await db.financial_budgets.find_one(filter_key, {"_id": 0})
    if existing:
        old_amount = existing.get("allocated_amount", 0)
        doc["id"] = existing.get("id", line_id)
        await db.financial_budgets.replace_one(filter_key, doc)
        action_msg = f"تم تحديث الموازنة من {old_amount:,.2f} إلى {req.allocated_amount:,.2f}"
    else:
        await db.financial_budgets.insert_one(doc)
        doc.pop("_id", None)
        action_msg = f"تم إنشاء سطر موازنة {req.allocated_amount:,.2f} ج.م"

    doc.pop("_id", None)
    return {"message": action_msg, "budget_line": doc}


@router.post("/bulk")
async def create_budget_bulk(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    رفع موازنة كاملة دفعة واحدة (مصفوفة أسطر)

    مفيد لاستيراد الموازنة السنوية من Excel
    """
    company_id = current_user["company_id"]
    lines_data = data.get("lines", [])
    if not lines_data:
        raise HTTPException(400, "lines مطلوبة")

    created = updated = 0
    errors  = []

    for i, line in enumerate(lines_data):
        try:
            req = BudgetLineRequest(**{**line, "fiscal_year": data.get("fiscal_year", line.get("fiscal_year"))})
            await create_budget_line(req, current_user)
            created += 1
        except Exception as e:
            errors.append({"row": i+1, "error": str(e)})

    return {
        "message":  f"تم معالجة {len(lines_data)} سطر: {created} ناجح، {len(errors)} خطأ",
        "created":  created,
        "errors":   errors[:10],
    }


@router.get("/lines")
async def list_budget_lines(
    fiscal_year:    int = Query(...),
    cost_center_id: Optional[str] = None,
    project_id:     Optional[str] = None,
    account_code:   Optional[str] = None,
    current_user:   dict = Depends(get_current_user)
):
    """قائمة أسطر الموازنة مع الإنفاق الفعلي والمرتبط"""
    company_id = current_user["company_id"]
    q = {"company_id": company_id, "fiscal_year": fiscal_year}
    if cost_center_id: q["cost_center_id"] = cost_center_id
    if project_id:     q["project_id"]     = project_id
    if account_code:   q["account_code"]   = account_code

    lines = await db.financial_budgets.find(q, {"_id": 0}).sort("account_code", 1).to_list(None)

    # Enrich with actual spent + committed
    enriched = []
    total_allocated = total_spent = total_committed = 0.0

    for line in lines:
        spent, committed = await _get_spent_and_committed(
            company_id, fiscal_year,
            line["account_code"],
            line.get("cost_center_id"),
            line.get("project_id"),
        )
        allocated  = float(line["allocated_amount"])
        available  = round(allocated - spent - committed, 2)
        utilization = round((spent + committed) / allocated * 100, 1) if allocated > 0 else 0

        enriched.append({
            **line,
            "actual_spent":    round(spent, 2),
            "committed":       round(committed, 2),
            "available":       available,
            "utilization_pct": utilization,
            "status":          (
                "over_budget"    if available < 0 else
                "critical"       if utilization >= 90 else
                "warning"        if utilization >= 75 else
                "on_track"
            ),
        })
        total_allocated += allocated
        total_spent     += spent
        total_committed += committed

    return {
        "fiscal_year": fiscal_year,
        "lines":       enriched,
        "totals": {
            "allocated":   round(total_allocated, 2),
            "spent":       round(total_spent, 2),
            "committed":   round(total_committed, 2),
            "available":   round(total_allocated - total_spent - total_committed, 2),
            "utilization": round((total_spent+total_committed)/total_allocated*100, 1)
                           if total_allocated > 0 else 0,
        }
    }


@router.delete("/lines/{line_id}")
async def delete_budget_line(line_id: str,
                              current_user: dict = Depends(get_current_user)):
    result = await db.financial_budgets.delete_one(
        {"id": line_id, "company_id": current_user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(404, "سطر الموازنة غير موجود")
    return {"message": "تم حذف سطر الموازنة"}


# ══════════════════════════════════════════════════════════════
# 2. BUDGET VALIDATION ENGINE — محرك فحص الموازنة
# ══════════════════════════════════════════════════════════════

async def _get_spent_and_committed(
    company_id: str, fiscal_year: int,
    account_code: str,
    cost_center_id: Optional[str] = None,
    project_id: Optional[str] = None,
) -> tuple:
    """
    احتساب المنصرف الفعلي + المرتبط (أوامر شراء معلقة)

    Actual:    من قيود دفتر الأستاذ (مدين على الحسابات 3xxx + مدفوعات)
    Committed: من أوامر الشراء المعتمدة غير المنفذة + طلبات الصرف المعلقة
    """
    year_start = f"{fiscal_year}-01-01"
    year_end   = f"{fiscal_year}-12-31"

    # ── Actual Spent: sum of debit entries for this account ──
    match_q = {
        "company_id": company_id, "status": "posted",
        "entry_date": {"$gte": year_start, "$lte": year_end},
    }
    pipeline_actual = [
        {"$match": match_q},
        {"$unwind": "$lines"},
        {"$match": {
            "lines.account_code": account_code,
            **({} if not cost_center_id else {"lines.cost_center_id": cost_center_id}),
            **({} if not project_id     else {"lines.project_id":     project_id}),
        }},
        {"$group": {"_id": None, "total": {"$sum": "$lines.debit"}}},
    ]
    actual_res = await db.journal_entries.aggregate(pipeline_actual).to_list(1)
    actual = float(actual_res[0]["total"]) if actual_res else 0.0

    # ── Committed: pending purchase orders ────────────────────
    po_q = {
        "company_id": company_id,
        "status": {"$in": ["approved", "partial"]},
        "account_code": account_code,
    }
    if cost_center_id: po_q["cost_center_id"] = cost_center_id
    if project_id:     po_q["project_id"]     = project_id

    pos = await db.purchase_orders.find(po_q, {"_id": 0,
          "total_amount": 1, "received_amount": 1}).to_list(None)
    committed = sum(
        float(po.get("total_amount",0)) - float(po.get("received_amount",0))
        for po in pos
    )

    # Also committed: pending approval_requests
    pending_q = {
        "company_id": company_id,
        "status": "pending",
        "document_type": {"$in": ["expense_claim", "purchase_invoice", "purchase_order"]},
    }
    if account_code:
        pending_q["account_code"] = account_code
    pending_reqs = await db.approval_requests.find(
        pending_q, {"_id": 0, "amount": 1}).to_list(None)
    committed += sum(float(r.get("amount", 0)) for r in pending_reqs)

    return round(actual, 2), round(committed, 2)


@router.post("/check")
async def check_budget(
    req: BudgetCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    فحص الموازنة قبل تنفيذ معاملة

    Formula:
    Actual + Committed + Current_Transaction ≤ Allocated → ✅ تمر
    إذا تجاوزت:
      warning_only          → تحذير + يُسمَح بالمتابعة
      hard_stop_prevent_entry → رفض + يمنع الحفظ تماماً

    يُحفَظ نتيجة الفحص لإمكانية Override
    """
    company_id = current_user["company_id"]

    # Find budget line
    budget = await db.financial_budgets.find_one({
        "company_id":    company_id,
        "fiscal_year":   req.fiscal_year,
        "account_code":  req.account_code,
        "cost_center_id": req.cost_center_id,
        "project_id":    req.project_id,
    }, {"_id": 0})

    check_id = str(uuid.uuid4())
    now      = datetime.now(timezone.utc).isoformat()

    # No budget defined → allow with warning
    if not budget:
        result = {
            "check_id":   check_id,
            "passed":     True,
            "status":     "no_budget_defined",
            "message":    "لا توجد موازنة مُعرَّفة لهذا الحساب/مركز التكلفة — يُسمَح بالمتابعة",
            "warning":    True,
            "allow_proceed": True,
        }
        await db.budget_checks.insert_one({**result, "company_id": company_id,
                                           "request": req.dict(), "checked_at": now})
        result.pop("_id", None)
        return result

    allocated  = float(budget["allocated_amount"])
    actual, committed = await _get_spent_and_committed(
        company_id, req.fiscal_year, req.account_code,
        req.cost_center_id, req.project_id
    )
    current    = float(req.transaction_amount)
    total_after = round(actual + committed + current, 2)
    available  = round(allocated - actual - committed, 2)
    excess     = round(total_after - allocated, 2)
    within     = excess <= 0
    utilization = round(total_after / allocated * 100, 1) if allocated > 0 else 0
    control    = budget.get("control_action", "warning_only")

    result = {
        "check_id":          check_id,
        "fiscal_year":       req.fiscal_year,
        "account_code":      req.account_code,
        "cost_center_id":    req.cost_center_id,
        "project_id":        req.project_id,
        "budget_amounts": {
            "allocated":        allocated,
            "actual_spent":     actual,
            "committed":        committed,
            "current_transaction": current,
            "total_after":      total_after,
            "available_before": available,
            "excess":           max(excess, 0),
        },
        "utilization_pct":   utilization,
        "control_action":    control,
        "passed":            within,
        "allow_proceed":     within or control == "warning_only",
        "requires_override": not within and control == "hard_stop_prevent_entry",
        "status":            (
            "approved"    if within else
            "warning"     if control == "warning_only" else
            "hard_stop"
        ),
        "message":           (
            f"✅ ضمن الموازنة — متاح {available:,.2f} ج.م"    if within else
            f"⚠️ تجاوز الموازنة بـ {excess:,.2f} ج.م — تحذير فقط"
                                                              if control == "warning_only" else
            f"🚫 تجاوز الموازنة بـ {excess:,.2f} — مرفوض (Hard Stop)"
        ),
        "override_endpoint": "/api/budget/override" if not within and control == "hard_stop_prevent_entry" else None,
        "source_document": {
            "type": req.source_document_type,
            "id":   req.source_document_id,
        },
        "checked_at":   now,
        "checked_by":   current_user["user_id"],
    }

    # Save check result for audit + override reference
    await db.budget_checks.insert_one({
        **result,
        "company_id": company_id,
        "override_status": "none",
    })
    result.pop("_id", None)
    return result


# ══════════════════════════════════════════════════════════════
# 3. OVERRIDE APPROVAL — تجاوز الموازنة باعتماد استثنائي
# ══════════════════════════════════════════════════════════════

@router.post("/override")
async def request_budget_override(
    req: BudgetOverrideRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    طلب تجاوز الموازنة — يتطلب اعتماداً من المدير المالي

    يُحفَظ الطلب في انتظار موافقة CFO/Manager
    """
    company_id = current_user["company_id"]

    check = await db.budget_checks.find_one(
        {"check_id": req.budget_check_id, "company_id": company_id}, {"_id": 0})
    if not check:
        raise HTTPException(404, "نتيجة الفحص غير موجودة — نفِّذ /check أولاً")
    if check.get("passed"):
        raise HTTPException(400, "الموازنة لم تُتجاوَز — لا حاجة لتجاوز")
    if check.get("override_status") not in (None, "none"):
        raise HTTPException(400, f"طلب التجاوز في حالة '{check.get('override_status')}'")

    override_id = str(uuid.uuid4())
    excess = float(check.get("budget_amounts", {}).get("excess", 0))
    override_amount = req.override_amount or excess

    override = {
        "id":              override_id,
        "company_id":      company_id,
        "budget_check_id": req.budget_check_id,
        "account_code":    check.get("account_code"),
        "cost_center_id":  check.get("cost_center_id"),
        "project_id":      check.get("project_id"),
        "fiscal_year":     check.get("fiscal_year"),
        "excess_amount":   excess,
        "override_amount": override_amount,
        "justification":   req.justification,
        "status":          "pending_cfo",
        "requested_by":    current_user["user_id"],
        "requested_at":    datetime.now(timezone.utc).isoformat(),
        "approved_by":     None,
        "approved_at":     None,
        "source_document": check.get("source_document"),
    }
    await db.budget_overrides.insert_one(override); override.pop("_id", None)

    # Mark the check as pending override
    await db.budget_checks.update_one(
        {"check_id": req.budget_check_id},
        {"$set": {"override_status": "pending", "override_id": override_id}}
    )

    return {
        "message":     f"تم تقديم طلب تجاوز الموازنة — في انتظار اعتماد المدير المالي",
        "override_id": override_id,
        "excess":      excess,
        "justification": req.justification,
        "next_step":   f"POST /api/budget/override/{override_id}/approve  (CFO only)",
    }


@router.post("/override/{override_id}/approve")
async def approve_override(
    override_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد طلب تجاوز الموازنة (المدير المالي)"""
    company_id = current_user["company_id"]
    decision   = data.get("decision", "approved")  # approved | rejected
    comment    = data.get("comment", "")

    override = await db.budget_overrides.find_one(
        {"id": override_id, "company_id": company_id}, {"_id": 0})
    if not override:
        raise HTTPException(404, "طلب التجاوز غير موجود")
    if override["status"] != "pending_cfo":
        raise HTTPException(400, f"الطلب في حالة '{override['status']}'")

    now = datetime.now(timezone.utc).isoformat()
    new_status = "approved" if decision == "approved" else "rejected"

    await db.budget_overrides.update_one({"id": override_id}, {"$set": {
        "status":      new_status,
        "approved_by": current_user["user_id"],
        "approved_at": now,
        "comment":     comment,
    }})

    # Update the budget check
    await db.budget_checks.update_one(
        {"override_id": override_id},
        {"$set": {"override_status": new_status}}
    )

    return {
        "message":     f"{'✅ تم اعتماد' if decision=='approved' else '❌ تم رفض'} طلب التجاوز",
        "override_id": override_id,
        "decision":    new_status,
        "allow_proceed": new_status == "approved",
        "comment":     comment,
    }


@router.get("/override/pending")
async def list_pending_overrides(current_user: dict = Depends(get_current_user)):
    """قائمة طلبات تجاوز الموازنة المعلقة للاعتماد"""
    overrides = await db.budget_overrides.find({
        "company_id": current_user["company_id"],
        "status": "pending_cfo",
    }, {"_id": 0}).sort("requested_at", -1).to_list(None)
    return {"overrides": overrides, "count": len(overrides)}


# ══════════════════════════════════════════════════════════════
# 4. BUDGET REPORTS — تقارير الموازنات
# ══════════════════════════════════════════════════════════════

@router.get("/variance-report")
async def budget_variance_report(
    fiscal_year:    int = Query(...),
    cost_center_id: Optional[str] = None,
    project_id:     Optional[str] = None,
    current_user:   dict = Depends(get_current_user)
):
    """
    تقرير الانحرافات — الموازنة مقابل الفعلي
    يُظهر: مبلغ الانحراف | النسبة | حالة كل سطر
    """
    company_id = current_user["company_id"]
    q = {"company_id": company_id, "fiscal_year": fiscal_year}
    if cost_center_id: q["cost_center_id"] = cost_center_id
    if project_id:     q["project_id"]     = project_id

    lines = await db.financial_budgets.find(q, {"_id": 0}).to_list(None)
    report = []
    grand_allocated = grand_actual = grand_variance = 0.0

    for line in lines:
        actual, committed = await _get_spent_and_committed(
            company_id, fiscal_year, line["account_code"],
            line.get("cost_center_id"), line.get("project_id")
        )
        allocated = float(line["allocated_amount"])
        total_actual = actual + committed
        variance  = round(allocated - total_actual, 2)
        var_pct   = round(variance / allocated * 100, 1) if allocated > 0 else 0

        report.append({
            "account_code":   line["account_code"],
            "account_name":   line.get("account_name",""),
            "cost_center":    line.get("cost_center_name",""),
            "project":        line.get("project_name",""),
            "allocated":      allocated,
            "actual_spent":   actual,
            "committed":      committed,
            "total_utilized": round(total_actual, 2),
            "variance":       variance,
            "variance_pct":   var_pct,
            "control_action": line.get("control_action",""),
            "status": (
                "over_budget" if variance < 0 else
                "critical"    if var_pct < 10 else
                "warning"     if var_pct < 25 else
                "on_track"
            ),
        })
        grand_allocated += allocated
        grand_actual    += total_actual
        grand_variance  += variance

    # Sort by worst variance first
    report.sort(key=lambda x: x["variance"])

    return {
        "fiscal_year": fiscal_year,
        "report":      report,
        "grand_total": {
            "allocated":      round(grand_allocated, 2),
            "total_utilized": round(grand_actual, 2),
            "variance":       round(grand_variance, 2),
            "variance_pct":   round(grand_variance/grand_allocated*100, 1)
                              if grand_allocated > 0 else 0,
        },
        "over_budget_count": sum(1 for r in report if r["status"]=="over_budget"),
        "critical_count":    sum(1 for r in report if r["status"]=="critical"),
        "generated_at":      datetime.now(timezone.utc).isoformat(),
    }


@router.get("/dashboard")
async def budget_dashboard(
    fiscal_year: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """لوحة تحكم الموازنة — ملخص تنفيذي"""
    company_id = current_user["company_id"]

    lines = await db.financial_budgets.find(
        {"company_id": company_id, "fiscal_year": fiscal_year}, {"_id": 0}
    ).to_list(None)

    total_allocated = sum(float(l["allocated_amount"]) for l in lines)
    total_actual = total_committed = 0.0
    over_budget = []

    for line in lines:
        actual, committed = await _get_spent_and_committed(
            company_id, fiscal_year, line["account_code"],
            line.get("cost_center_id"), line.get("project_id")
        )
        total_actual    += actual
        total_committed += committed
        if actual + committed > float(line["allocated_amount"]):
            over_budget.append({
                "account":   line["account_code"],
                "name":      line.get("account_name",""),
                "excess":    round(actual+committed-float(line["allocated_amount"]), 2),
                "control":   line.get("control_action"),
            })

    pending_overrides = await db.budget_overrides.count_documents(
        {"company_id": company_id, "status": "pending_cfo"})

    return {
        "fiscal_year":       fiscal_year,
        "total_lines":       len(lines),
        "financial_summary": {
            "allocated":      round(total_allocated, 2),
            "actual_spent":   round(total_actual, 2),
            "committed":      round(total_committed, 2),
            "available":      round(total_allocated - total_actual - total_committed, 2),
            "utilization_pct": round((total_actual+total_committed)/total_allocated*100, 1)
                               if total_allocated > 0 else 0,
        },
        "alerts": {
            "over_budget_lines":      len(over_budget),
            "pending_overrides":      pending_overrides,
            "over_budget_details":    over_budget[:5],
        },
    }
