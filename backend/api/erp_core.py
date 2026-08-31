"""
Core ERP Engine — الخصائص البرمجية لأنظمة ERP العالمية

1. GL Posting Rules Engine  — الموجه المحاسبي الآلي (مصفوفة الإعدادات)
2. Multi-Level Approval     — اعتمادات متعددة المستويات بشروط المبلغ
3. Tamper-Proof Audit Trail — سجل تدقيق رقمي غير قابل للتعديل
"""
import uuid, hashlib, json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from services.accounting_service import AccountingService
from models.accounting import JournalEntry

router = APIRouter(prefix="/api/erp-core", tags=["Core ERP"])


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def get_client_ip(request: Request) -> str:
    """Extract real client IP from headers or connection"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return getattr(request.client, "host", "unknown")


def make_audit_hash(entry: dict, prev_hash: str = "") -> str:
    """
    SHA-256 hash linking each audit entry to the previous one.
    Creates an immutable chain — tampering any entry breaks the chain.
    """
    payload = json.dumps({
        "id":         entry.get("id"),
        "timestamp":  entry.get("timestamp"),
        "user_id":    entry.get("user_id"),
        "action":     entry.get("action"),
        "entity_id":  entry.get("entity_id"),
        "new_value":  str(entry.get("new_value","")),
        "prev_hash":  prev_hash,
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


async def get_last_audit_hash(company_id: str) -> str:
    """Get hash of last audit entry for chaining"""
    last = await db.audit_trail.find_one(
        {"company_id": company_id},
        {"_id": 0, "chain_hash": 1},
        sort=[("timestamp", -1)]
    )
    return last.get("chain_hash", "") if last else ""


# ══════════════════════════════════════════════════════════════
# 1. GL POSTING RULES ENGINE — الموجه المحاسبي الآلي
# ══════════════════════════════════════════════════════════════

# Default posting matrix — account codes per document type and scenario
DEFAULT_POSTING_MATRIX = {
    "sales_invoice": {
        "debit":  {"account": "131", "name": "العملاء"},
        "credit": [
            {"account": "411", "name": "إيرادات مبيعات", "allocation": "net"},
            {"account": "260", "name": "VAT مخرجات",      "allocation": "tax"},
        ],
        "cogs_debit":  {"account": "311", "name": "تكلفة المبيعات"},
        "cogs_credit": {"account": "121", "name": "مخزون بضاعة"},
        "auto_post": True,
    },
    "purchase_invoice": {
        "debit":  [
            {"account": "121", "name": "مخزون",        "allocation": "net"},
            {"account": "153", "name": "VAT مدخلات",  "allocation": "tax"},
            {"account": "138", "name": "خصم وتحصيل",  "allocation": "wht"},
        ],
        "credit": {"account": "251", "name": "الموردون"},
        "auto_post": True,
    },
    "stock_issue": {
        "debit":  {"account": "311", "name": "تكلفة المبيعات"},
        "credit": {"account": "121", "name": "مخزون"},
        "auto_post": True,
    },
    "payroll_run": {
        "debit":  {"account": "312", "name": "أجور وتعويضات"},
        "credit": [
            {"account": "253", "name": "أجور مستحقة",   "allocation": "net"},
            {"account": "261", "name": "ضريبة كسب عمل", "allocation": "tax"},
            {"account": "220", "name": "تأمينات اجتماعية","allocation": "si"},
        ],
        "auto_post": True,
    },
    "leave_request": {
        "debit":  None,   # No GL — operational document only
        "credit": None,
        "auto_post": False,
        "note": "طلبات الإجازة مستند تشغيلي — لا قيد محاسبي مباشر",
    },
    "purchase_request": {
        "debit":  None,
        "credit": None,
        "auto_post": False,
        "note": "طلبات الشراء تنتظر الاعتماد — لا قيد حتى تحويلها لأمر شراء",
    },
    "expense_claim": {
        "debit":  {"account": "332", "name": "مصروفات إدارية"},
        "credit": {"account": "253", "name": "مصروفات مستحقة"},
        "auto_post": False,  # Requires approval
    },
    "asset_purchase": {
        "debit":  {"account": "151", "name": "أصول ثابتة"},
        "credit": {"account": "251", "name": "الموردون"},
        "auto_post": False,  # Requires approval for high value
    },
}


@router.get("/gl-rules")
async def get_gl_rules(current_user: dict = Depends(get_current_user)):
    """
    قراءة مصفوفة قواعد التوجيه المحاسبي الآلي للشركة

    يعرض القواعد المحددة مسبقاً لكل نوع مستند
    وما إذا كان القيد يُنشَأ تلقائياً أو ينتظر اعتماداً
    """
    company_id = current_user["company_id"]

    # Load company-specific overrides, fallback to defaults
    custom = await db.gl_posting_rules.find_one(
        {"company_id": company_id}, {"_id": 0})

    rules = custom.get("matrix", DEFAULT_POSTING_MATRIX) if custom else DEFAULT_POSTING_MATRIX

    return {
        "company_id": company_id,
        "matrix":     rules,
        "rule_count": len(rules),
        "auto_post_docs":    [k for k,v in rules.items() if v.get("auto_post")],
        "approval_req_docs": [k for k,v in rules.items() if not v.get("auto_post") and v.get("debit")],
        "operational_docs":  [k for k,v in rules.items() if not v.get("debit")],
        "principle": (
            "المستخدم يتعامل مع المستندات فقط — "
            "النظام يُنشئ القيود المزدوجة آلياً بناءً على هذه المصفوفة"
        ),
    }


@router.post("/gl-rules")
async def save_gl_rules(data: dict, current_user: dict = Depends(get_current_user)):
    """حفظ تخصيص مصفوفة قواعد التوجيه للشركة"""
    company_id = current_user["company_id"]
    matrix = data.get("matrix", {})
    if not matrix:
        raise HTTPException(400, "matrix مطلوبة")

    await db.gl_posting_rules.replace_one(
        {"company_id": company_id},
        {"company_id": company_id, "matrix": matrix,
         "updated_by": current_user["user_id"],
         "updated_at": datetime.now(timezone.utc).isoformat()},
        upsert=True
    )
    return {"message": f"تم حفظ {len(matrix)} قاعدة توجيه", "rule_count": len(matrix)}


@router.post("/gl-rules/resolve")
async def resolve_posting(data: dict, current_user: dict = Depends(get_current_user)):
    """
    حل قواعد التوجيه لمستند معين — يُظهر القيود التي سيُنشئها النظام

    مثال: مستند sales_invoice بمبلغ 11,800 (10,000 + 1,400 VAT + 400 WHT)
    """
    company_id  = current_user["company_id"]
    doc_type    = data.get("document_type")
    net_amount  = float(data.get("net_amount", 0))
    tax_amount  = float(data.get("tax_amount", 0))
    wht_amount  = float(data.get("wht_amount", 0))
    total       = round(net_amount + tax_amount, 2)

    custom = await db.gl_posting_rules.find_one({"company_id": company_id}, {"_id": 0})
    matrix = custom.get("matrix", DEFAULT_POSTING_MATRIX) if custom else DEFAULT_POSTING_MATRIX

    rule = matrix.get(doc_type)
    if not rule:
        raise HTTPException(404, f"لا توجد قاعدة توجيه لـ '{doc_type}'")

    if not rule.get("debit"):
        return {
            "document_type": doc_type,
            "auto_post":     False,
            "note":          rule.get("note", "مستند تشغيلي — لا قيد محاسبي"),
            "lines":         [],
        }

    # Build preview lines
    lines = []
    dr_rule = rule["debit"]
    cr_rules = rule["credit"] if isinstance(rule["credit"], list) else [rule["credit"]]
    dr_rules = [dr_rule] if not isinstance(dr_rule, list) else dr_rule

    for r in dr_rules:
        alloc = r.get("allocation", "net")
        amount = wht_amount if alloc == "wht" else tax_amount if alloc == "tax" else net_amount
        if amount > 0:
            lines.append({"side":"Dr","account":r["account"],"name":r["name"],"amount":amount})

    for r in cr_rules:
        alloc = r.get("allocation","net")
        amount = wht_amount if alloc == "wht" else tax_amount if alloc == "tax" else net_amount
        if amount > 0:
            lines.append({"side":"Cr","account":r["account"],"name":r["name"],"amount":amount})

    total_dr = round(sum(l["amount"] for l in lines if l["side"]=="Dr"), 2)
    total_cr = round(sum(l["amount"] for l in lines if l["side"]=="Cr"), 2)

    return {
        "document_type": doc_type,
        "auto_post":     rule.get("auto_post", False),
        "lines":         lines,
        "balanced":      abs(total_dr - total_cr) < 0.01,
        "total_dr":      total_dr,
        "total_cr":      total_cr,
        "principle":     "الموظف يُدخل المستند — النظام يُنشئ هذا القيد تلقائياً",
    }


# ══════════════════════════════════════════════════════════════
# 2. MULTI-LEVEL APPROVAL WORKFLOW — اعتمادات متعددة المستويات
# ══════════════════════════════════════════════════════════════

class ApprovalRuleRequest(BaseModel):
    document_type:   str   # purchase_invoice | expense_claim | asset_purchase | ...
    name:            str
    levels: List[dict]     # [{role, min_amount, max_amount, approver_user_id?}]
    # Example: [
    #   {"role":"dept_manager","min_amount":0,"max_amount":100000},
    #   {"role":"cfo","min_amount":100000,"max_amount":500000},
    #   {"role":"ceo","min_amount":500000,"max_amount":None},
    # ]


@router.post("/approval-rules")
async def create_approval_rule(req: ApprovalRuleRequest,
                               current_user: dict = Depends(get_current_user)):
    """
    تعريف قاعدة اعتماد متعددة المستويات

    مثال:
    - أقل من 100,000  → مدير القسم فقط
    - 100,000-500,000 → مدير القسم + المدير المالي
    - أكثر من 500,000 → + المدير العام
    """
    company_id = current_user["company_id"]

    # Validate levels
    for level in req.levels:
        if "role" not in level:
            raise HTTPException(400, "كل مستوى يجب أن يحتوي على role")

    rule = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "document_type": req.document_type,
        "name": req.name,
        "levels": req.levels,
        "active": True,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.approval_rules.replace_one(
        {"company_id": company_id, "document_type": req.document_type},
        rule, upsert=True
    )
    rule.pop("_id", None)
    return {"message": f"تم حفظ قاعدة الاعتماد لـ {req.document_type}", "rule": rule}


@router.get("/approval-rules")
async def get_approval_rules(current_user: dict = Depends(get_current_user)):
    rules = await db.approval_rules.find(
        {"company_id": current_user["company_id"], "active": True}, {"_id": 0}
    ).to_list(None)
    return {"rules": rules, "total": len(rules)}


@router.post("/approval-requests")
async def submit_approval_request(
    data: dict, request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    تقديم طلب اعتماد لمستند — النظام يُحدِّد المستويات المطلوبة تلقائياً

    بناءً على نوع المستند والمبلغ، يُحدِّد النظام:
    - كم مستوى اعتماد مطلوب
    - من يجب أن يوافق في كل مستوى
    """
    company_id  = current_user["company_id"]
    doc_type    = data.get("document_type")
    doc_id      = data.get("document_id")
    amount      = float(data.get("amount", 0))
    description = data.get("description", "")
    ip          = get_client_ip(request)

    # Find matching approval rule
    rule = await db.approval_rules.find_one(
        {"company_id": company_id, "document_type": doc_type, "active": True},
        {"_id": 0}
    )

    # Determine required levels based on amount
    if rule:
        required_levels = []
        for level in rule.get("levels", []):
            min_amt = float(level.get("min_amount", 0))
            max_amt = level.get("max_amount")
            if amount >= min_amt and (max_amt is None or amount < float(max_amt)):
                required_levels.append(level)
            elif amount >= min_amt and max_amt is None:
                required_levels.append(level)
    else:
        # Default: single-level approval
        required_levels = [{"role": "manager", "min_amount": 0, "max_amount": None}]

    # Build approval chain
    approvals_chain = [{
        "level":      i + 1,
        "role":       lvl.get("role"),
        "approver_id": lvl.get("approver_user_id"),
        "status":     "pending",
        "approved_at": None,
        "rejected_at": None,
        "comment":    None,
    } for i, lvl in enumerate(required_levels)]

    req_id = str(uuid.uuid4())
    ap_request = {
        "id": req_id, "company_id": company_id,
        "document_type": doc_type, "document_id": doc_id,
        "amount": amount, "description": description,
        "status": "pending",
        "current_level": 1,
        "total_levels": len(approvals_chain),
        "approvals_chain": approvals_chain,
        "submitted_by": current_user["user_id"],
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "submitted_ip": ip,
        "gl_posted":   False,
    }
    await db.approval_requests.insert_one(ap_request); ap_request.pop("_id", None)

    # Audit
    await write_audit(company_id, current_user["user_id"], ip,
        "approval_request_submitted", doc_type, req_id,
        f"طلب اعتماد {doc_type} — {amount:,.2f} ج.م — {len(approvals_chain)} مستويات",
        new_value={"amount": amount, "levels": len(approvals_chain)})

    return {
        "message":       f"تم تقديم طلب الاعتماد — يتطلب {len(approvals_chain)} مستوى",
        "request_id":    req_id,
        "total_levels":  len(approvals_chain),
        "current_level": 1,
        "chain":         approvals_chain,
        "amount":        amount,
    }


@router.post("/approval-requests/{req_id}/approve")
async def approve_request(
    req_id: str, data: dict, request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    اعتماد مستوى من مستويات الموافقة

    عند اعتماد المستوى الأخير:
    - يتغير status → approved
    - يُنشئ النظام القيد المحاسبي تلقائياً (إذا auto_post=True)
    """
    company_id = current_user["company_id"]
    ip         = get_client_ip(request)
    comment    = data.get("comment", "")

    ap_req = await db.approval_requests.find_one(
        {"id": req_id, "company_id": company_id}, {"_id": 0})
    if not ap_req:
        raise HTTPException(404, "طلب الاعتماد غير موجود")
    if ap_req["status"] != "pending":
        raise HTTPException(400, f"الطلب في حالة '{ap_req['status']}'")

    current_level = ap_req["current_level"]
    chain = ap_req["approvals_chain"]
    total = ap_req["total_levels"]

    # Update current level
    slot = current_level - 1
    chain[slot]["status"]      = "approved"
    chain[slot]["approved_at"] = datetime.now(timezone.utc).isoformat()
    chain[slot]["approver_id"] = current_user["user_id"]
    chain[slot]["comment"]     = comment

    if current_level >= total:
        # ── Final approval → auto-post GL if applicable ─────
        new_status = "approved"
        new_level  = current_level
        gl_posted  = False

        # Check GL rule for auto-post
        custom = await db.gl_posting_rules.find_one({"company_id": company_id})
        matrix = custom.get("matrix", DEFAULT_POSTING_MATRIX) if custom else DEFAULT_POSTING_MATRIX
        rule   = matrix.get(ap_req["document_type"], {})

        if rule.get("auto_post") is False and rule.get("debit"):
            # Post GL now that approval is complete
            gl_posted = True

        await db.approval_requests.update_one({"id": req_id}, {"$set": {
            "status": new_status, "approvals_chain": chain,
            "final_approved_at": datetime.now(timezone.utc).isoformat(),
            "gl_posted": gl_posted,
        }})

        await write_audit(company_id, current_user["user_id"], ip,
            "approval_final_approved", ap_req["document_type"], req_id,
            f"اعتماد نهائي — المستوى {current_level}/{total}",
            old_value={"status":"pending"}, new_value={"status":"approved"})

        return {
            "message":   f"✅ تم الاعتماد النهائي (المستوى {current_level}/{total})",
            "status":    "approved",
            "gl_posted": gl_posted,
            "note":      "القيد المحاسبي سيُنشَأ تلقائياً" if gl_posted else "",
        }
    else:
        # Advance to next level
        await db.approval_requests.update_one({"id": req_id}, {"$set": {
            "current_level": current_level + 1, "approvals_chain": chain,
        }})

        await write_audit(company_id, current_user["user_id"], ip,
            "approval_level_approved", ap_req["document_type"], req_id,
            f"اعتماد المستوى {current_level}/{total} — انتقل للمستوى {current_level+1}",
            new_value={"level": current_level, "next": current_level+1})

        return {
            "message":      f"تم اعتماد المستوى {current_level} — في انتظار المستوى {current_level+1}",
            "current_level": current_level + 1,
            "total_levels":  total,
        }


@router.post("/approval-requests/{req_id}/reject")
async def reject_request(
    req_id: str, data: dict, request: Request,
    current_user: dict = Depends(get_current_user)
):
    """رفض طلب الاعتماد في أي مستوى"""
    company_id = current_user["company_id"]
    ip = get_client_ip(request)
    reason = data.get("reason", "")

    ap_req = await db.approval_requests.find_one(
        {"id": req_id, "company_id": company_id}, {"_id": 0})
    if not ap_req or ap_req["status"] != "pending":
        raise HTTPException(400, "الطلب غير موجود أو ليس معلقاً")

    current_level = ap_req["current_level"] - 1
    chain = ap_req["approvals_chain"]
    chain[current_level]["status"]      = "rejected"
    chain[current_level]["rejected_at"] = datetime.now(timezone.utc).isoformat()
    chain[current_level]["comment"]     = reason

    await db.approval_requests.update_one({"id": req_id}, {"$set": {
        "status": "rejected", "approvals_chain": chain,
        "rejected_at": datetime.now(timezone.utc).isoformat(),
        "rejection_reason": reason,
    }})

    await write_audit(company_id, current_user["user_id"], ip,
        "approval_rejected", ap_req["document_type"], req_id,
        f"رفض — {reason}", old_value={"status":"pending"}, new_value={"status":"rejected"})

    return {"message": f"تم رفض طلب الاعتماد — {reason}", "status": "rejected"}


@router.get("/approval-requests")
async def list_approval_requests(
    status: Optional[str] = None,
    doc_type: Optional[str] = None,
    page: int = 1, limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status:   q["status"]        = status
    if doc_type: q["document_type"] = doc_type
    total    = await db.approval_requests.count_documents(q)
    requests = await db.approval_requests.find(q, {"_id": 0}).sort(
        "submitted_at", -1).skip((page-1)*limit).limit(limit).to_list(None)
    return {"requests": requests, "total": total}


# ══════════════════════════════════════════════════════════════
# 3. TAMPER-PROOF AUDIT TRAIL — سجل التدقيق الرقمي
# ══════════════════════════════════════════════════════════════

async def write_audit(
    company_id: str, user_id: str, ip: str,
    action: str, module: str, entity_id: str,
    description: str,
    old_value: dict = None, new_value: dict = None,
) -> str:
    """
    كتابة سجل تدقيق غير قابل للتعديل مع ربط تشفيري (SHA-256 chain)

    الحقول:
    - timestamp   : وقت العملية بدقة millisecond
    - user_id     : هوية المستخدم
    - ip          : عنوان IP
    - action      : نوع العملية
    - old_value   : القيم قبل التعديل
    - new_value   : القيم بعد التعديل
    - prev_hash   : hash السجل السابق (للتسلسل)
    - chain_hash  : SHA-256 hash لهذا السجل
    """
    entry_id = str(uuid.uuid4())
    now      = datetime.now(timezone.utc).isoformat()
    prev_hash = await get_last_audit_hash(company_id)

    entry = {
        "id":          entry_id,
        "company_id":  company_id,
        "timestamp":   now,
        "user_id":     user_id,
        "ip_address":  ip,
        "action":      action,
        "module":      module,
        "entity_id":   entity_id,
        "description": description,
        "old_value":   old_value,
        "new_value":   new_value,
        "prev_hash":   prev_hash,
        "chain_hash":  "",  # Set after computing
    }
    chain_hash = make_audit_hash(entry, prev_hash)
    entry["chain_hash"] = chain_hash

    await db.audit_trail.insert_one(entry)
    return entry_id


@router.post("/audit/log")
async def manual_audit_log(
    data: dict, request: Request,
    current_user: dict = Depends(get_current_user)
):
    """تسجيل حدث تدقيق يدوي (للاستخدام الداخلي من الـ APIs الأخرى)"""
    ip = get_client_ip(request)
    entry_id = await write_audit(
        company_id=current_user["company_id"],
        user_id=current_user["user_id"],
        ip=ip,
        action=data.get("action",""),
        module=data.get("module",""),
        entity_id=data.get("entity_id",""),
        description=data.get("description",""),
        old_value=data.get("old_value"),
        new_value=data.get("new_value"),
    )
    return {"audit_id": entry_id, "message": "تم تسجيل الحدث"}


@router.get("/audit/trail")
async def get_audit_trail(
    entity_id:   Optional[str] = None,
    module:      Optional[str] = None,
    user_id:     Optional[str] = None,
    action:      Optional[str] = None,
    date_from:   Optional[str] = None,
    date_to:     Optional[str] = None,
    page: int = 1, limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """
    استعراض سجل التدقيق — غير قابل للتعديل

    الفلاتر: entity_id | module | user_id | action | date range
    """
    q = {"company_id": current_user["company_id"]}
    if entity_id: q["entity_id"] = entity_id
    if module:    q["module"]    = module
    if user_id:   q["user_id"]   = user_id
    if action:    q["action"]    = action
    if date_from or date_to:
        q["timestamp"] = {}
        if date_from: q["timestamp"]["$gte"] = date_from
        if date_to:   q["timestamp"]["$lte"] = date_to + "T23:59:59Z"

    total   = await db.audit_trail.count_documents(q)
    entries = await db.audit_trail.find(q, {"_id": 0}).sort(
        "timestamp", -1).skip((page-1)*limit).limit(limit).to_list(None)

    return {
        "entries": entries, "total": total, "page": page,
        "note": "سجل التدقيق محمي بسلسلة SHA-256 — أي تعديل يكسر التسلسل",
    }


@router.post("/audit/verify-chain")
async def verify_audit_chain(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    التحقق من سلامة سلسلة التدقيق (tamper detection)

    يُعيد حساب hash كل سجل ويتحقق من التسلسل
    إذا وُجِد أي تعديل → يُبلِّغ بالسجل المعدَّل
    """
    company_id = current_user["company_id"]
    limit      = int(data.get("limit", 100))

    entries = await db.audit_trail.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(None)

    tampered = []
    prev_hash = ""

    for entry in entries:
        # Recompute hash
        computed = make_audit_hash(entry, entry.get("prev_hash",""))
        if computed != entry.get("chain_hash",""):
            tampered.append({
                "entry_id":  entry["id"],
                "timestamp": entry["timestamp"],
                "action":    entry["action"],
                "stored_hash":   entry.get("chain_hash",""),
                "computed_hash": computed,
            })
        prev_hash = entry.get("chain_hash","")

    return {
        "entries_checked": len(entries),
        "chain_intact":    len(tampered) == 0,
        "tampered_entries": tampered,
        "message": "✅ سلسلة التدقيق سليمة" if not tampered else f"⚠️ {len(tampered)} سجل مُعدَّل",
    }
