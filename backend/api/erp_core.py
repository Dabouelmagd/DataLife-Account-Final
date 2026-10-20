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
from dependencies import get_current_user

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
    # Other modules (financial_engine) write plain audit_trail rows with no
    # chain_hash; picking one of those as "last" restarted the chain from "".
    last = await db.audit_trail.find_one(
        {"company_id": company_id, "chain_hash": {"$exists": True, "$ne": ""}},
        {"_id": 0, "chain_hash": 1},
        sort=[("timestamp", -1)]
    )
    return last.get("chain_hash", "") if last else ""


# ══════════════════════════════════════════════════════════════
# 1. GL POSTING RULES ENGINE — الموجه المحاسبي الآلي
# ══════════════════════════════════════════════════════════════

# Default posting matrix — account codes per document type and scenario.
#
# NOTE: this matrix is a REFERENCE / preview. No module posts through it —
# invoices, payroll and vouchers post their own entries (services/
# invoice_service.py, api/payroll.py, ...). Editing it changes the preview
# only; it is described that way to the user.
#
# The old defaults did not balance and used wrong accounts: the customer was
# debited with the net amount only while revenue + VAT were credited; on a
# purchase the WHT deducted from the supplier was DEBITED to 138 (that is WHT
# others deducted from US) instead of credited to 261; payroll debited only the
# net pay; "asset_purchase" debited 151 Marketable Securities; COGS/stock used
# the raw-material accounts 311/121 for goods sold.
# Allocations: net | tax | wht | si | gross (= net+tax+si) | payable (= net+tax−wht)
DEFAULT_POSTING_MATRIX = {
    "sales_invoice": {
        "debit":  [
            {"account": "131", "name": "العملاء",                         "allocation": "payable"},
            {"account": "138", "name": "خصم وتحصيل خصمه العميل منا",      "allocation": "wht"},
        ],
        "credit": [
            {"account": "411", "name": "إيراد مبيعات بضائع", "allocation": "net"},
            {"account": "260", "name": "ضريبة القيمة المضافة المخرجات", "allocation": "tax"},
        ],
        "cogs_debit":  {"account": "314", "name": "تكلفة البضاعة المباعة"},
        "cogs_credit": {"account": "125", "name": "مخزون بضائع بغرض البيع"},
        "auto_post": True,
    },
    "purchase_invoice": {
        "debit":  [
            {"account": "125", "name": "مخزون بضائع",                "allocation": "net"},
            {"account": "137", "name": "ضريبة المدخلات",             "allocation": "tax"},
        ],
        "credit": [
            {"account": "261", "name": "خصم وتحصيل مستقطع من المورد", "allocation": "wht"},
            {"account": "251", "name": "الموردون",                    "allocation": "payable"},
        ],
        "auto_post": True,
    },
    "stock_issue": {
        "debit":  {"account": "311", "name": "تكلفة الخامات المستهلكة"},
        "credit": {"account": "121", "name": "مخزون الخامات"},
        "auto_post": True,
    },
    "payroll_run": {
        "debit":  {"account": "331", "name": "رواتب وأجور", "allocation": "gross"},
        "credit": [
            {"account": "253", "name": "أجور مستحقة (الصافي)",      "allocation": "net"},
            {"account": "266", "name": "ضريبة كسب العمل",           "allocation": "tax"},
            {"account": "255", "name": "تأمينات اجتماعية (حصة العامل)", "allocation": "si"},
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
        "debit":  {"account": "3366", "name": "مصروفات نثرية ومتنوعة"},
        "credit": {"account": "253",  "name": "مصروفات مستحقة"},
        "auto_post": False,  # Requires approval
    },
    "asset_purchase": {
        "debit":  [
            {"account": "115", "name": "أثاث وتجهيزات (اختر حساب الأصل المناسب)", "allocation": "net"},
            {"account": "137", "name": "ضريبة المدخلات",                         "allocation": "tax"},
        ],
        "credit": [
            {"account": "261", "name": "خصم وتحصيل مستقطع من المورد", "allocation": "wht"},
            {"account": "251", "name": "الموردون",                    "allocation": "payable"},
        ],
        "auto_post": False,  # Requires approval for high value
    },
}

ALLOCATIONS = {"net", "tax", "wht", "si", "gross", "payable"}
TOP_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام",
             "المدير العام", "CEO", "المدير التنفيذي", "owner"}
FINANCE_ROLES = TOP_ROLES | {"Financial Manager", "المدير المالي"}

# Approval levels name abstract roles ("cfo", "ceo"...); this maps each one to
# the real user roles that may sign that level. Before, anybody — including
# the person who submitted the request — could approve every level.
LEVEL_ROLES = {
    "manager":      TOP_ROLES | {"Financial Manager", "المدير المالي", "HR Manager", "مدير الموارد البشرية",
                                 "Project Manager", "مدير المشاريع", "Chief Accountant", "رئيس الحسابات"},
    "dept_manager": TOP_ROLES | {"Financial Manager", "المدير المالي", "HR Manager", "مدير الموارد البشرية",
                                 "Project Manager", "مدير المشاريع", "Chief Accountant", "رئيس الحسابات"},
    "chief_accountant": TOP_ROLES | {"Financial Manager", "المدير المالي", "Chief Accountant", "رئيس الحسابات"},
    "cfo":          FINANCE_ROLES,
    "finance_manager": FINANCE_ROLES,
    "ceo":          TOP_ROLES,
    "gm":           TOP_ROLES,
    "chairman":     {"Board Chairman", "رئيس مجلس الإدارة", "owner"},
}


def _require(user: dict, roles: set, what: str):
    if user.get("role") not in roles and not user.get("is_platform_admin"):
        raise HTTPException(403, f"{what} غير مسموح لدورك")


def _alloc_amounts(net: float, tax: float, wht: float, si: float) -> dict:
    return {"net": net, "tax": tax, "wht": wht, "si": si,
            "gross": round(net + tax + si, 2), "payable": round(net + tax - wht, 2)}


def _rule_sides(rule: dict):
    def as_list(x):
        return [] if not x else (x if isinstance(x, list) else [x])
    return as_list(rule.get("debit")), as_list(rule.get("credit"))


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
        "note": ("مصفوفة مرجعية للمعاينة — القيود الفعلية تُنشئها موديولات الفواتير "
                 "والرواتب والسندات بقواعدها الخاصة"),
    }


@router.post("/gl-rules")
async def save_gl_rules(data: dict, current_user: dict = Depends(get_current_user)):
    """حفظ تخصيص مصفوفة قواعد التوجيه للشركة"""
    _require(current_user, FINANCE_ROLES, "تعديل قواعد التوجيه المحاسبي")
    company_id = current_user["company_id"]
    matrix = data.get("matrix", {})
    if not matrix or not isinstance(matrix, dict):
        raise HTTPException(400, "matrix مطلوبة")
    # The matrix was stored exactly as sent: any structure, any account code.
    # Every rule is rebuilt from known keys and each account must exist and
    # accept postings in this company's chart.
    clean = {}
    for doc_type, rule in matrix.items():
        if not isinstance(rule, dict):
            raise HTTPException(400, f"قاعدة {doc_type} غير صحيحة")
        sides = {}
        for side in ("debit", "credit"):
            items = rule.get(side)
            items = [] if not items else (items if isinstance(items, list) else [items])
            out = []
            for it in items:
                code = str((it or {}).get("account") or "")
                alloc = (it or {}).get("allocation", "net")
                if alloc not in ALLOCATIONS:
                    raise HTTPException(400, f"توزيع غير معروف '{alloc}' في {doc_type}")
                acc = await db.chart_of_accounts.find_one(
                    {"company_id": company_id, "account_code": code}, {"_id": 0})
                if not acc:
                    raise HTTPException(400, f"الحساب {code} في قاعدة {doc_type} غير موجود في شجرة الحسابات")
                if acc.get("is_header") or acc.get("allow_posting") is False:
                    raise HTTPException(400, f"الحساب {code} تجميعي ولا يقبل قيوداً")
                out.append({"account": code, "name": acc.get("account_name", ""), "allocation": alloc})
            sides[side] = (out if len(out) != 1 else out[0]) if out else None
        clean[str(doc_type)[:50]] = {**sides, "auto_post": bool(rule.get("auto_post")),
                                     "note": str(rule.get("note") or "")[:300]}
    matrix = clean

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
    try:
        net_amount = round(float(data.get("net_amount") or 0), 2)
        tax_amount = round(float(data.get("tax_amount") or 0), 2)
        wht_amount = round(float(data.get("wht_amount") or 0), 2)
        si_amount  = round(float(data.get("si_amount") or 0), 2)
    except (TypeError, ValueError):
        raise HTTPException(400, "المبالغ يجب أن تكون أرقاماً")

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
    amounts = _alloc_amounts(net_amount, tax_amount, wht_amount, si_amount)
    dr_rules, cr_rules = _rule_sides(rule)
    for side, rules in (("Dr", dr_rules), ("Cr", cr_rules)):
        for r in rules:
            amount = round(amounts.get(r.get("allocation", "net"), net_amount), 2)
            if amount > 0:
                acc = await db.chart_of_accounts.find_one(
                    {"company_id": company_id, "account_code": r["account"]},
                    {"_id": 0, "is_header": 1, "allow_posting": 1})
                lines.append({"side": side, "account": r["account"], "name": r.get("name", ""),
                              "amount": amount,
                              "problem": ("الحساب غير موجود في شجرة الحسابات" if not acc else
                                          "حساب تجميعي لا يقبل قيوداً" if acc.get("is_header") or acc.get("allow_posting") is False
                                          else None)})

    total_dr = round(sum(l["amount"] for l in lines if l["side"]=="Dr"), 2)
    total_cr = round(sum(l["amount"] for l in lines if l["side"]=="Cr"), 2)

    return {
        "document_type": doc_type,
        "auto_post":     rule.get("auto_post", False),
        "lines":         lines,
        "balanced":      abs(total_dr - total_cr) < 0.01,
        "total_dr":      total_dr,
        "total_cr":      total_cr,
        "note":          "معاينة مرجعية — القيد الفعلي يُنشئه الموديول المختص عند حفظ المستند",
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


async def _clean_levels(levels: list, company_id: str) -> list:
    """Levels were stored as sent ({**anything}). Keep known keys, a known
    role, numeric bands, and an approver who is an active user of THIS company."""
    if not levels:
        raise HTTPException(400, "أضف مستوى اعتماد واحداً على الأقل")
    out = []
    for lv in levels:
        role = (lv or {}).get("role")
        if role not in LEVEL_ROLES:
            raise HTTPException(400, f"الدور '{role}' غير معروف — المتاح: {', '.join(LEVEL_ROLES)}")
        try:
            mn = round(float(lv.get("min_amount") or 0), 2)
            mx = None if lv.get("max_amount") in (None, "") else round(float(lv["max_amount"]), 2)
        except (TypeError, ValueError):
            raise HTTPException(400, "حدود المبالغ يجب أن تكون أرقاماً")
        if mn < 0 or (mx is not None and mx <= mn):
            raise HTTPException(400, "الحد الأقصى يجب أن يكون أكبر من الحد الأدنى")
        approver = lv.get("approver_user_id") or None
        name = ""
        if approver:
            u = await db.users.find_one({"id": approver, "company_id": company_id, "is_active": {"$ne": False}},
                                        {"_id": 0, "full_name": 1})
            if not u:
                raise HTTPException(400, "المعتمد المحدد ليس مستخدماً نشطاً في الشركة")
            name = u.get("full_name", "")
        out.append({"role": role, "role_name_ar": str(lv.get("role_name_ar") or "")[:100],
                    "min_amount": mn, "max_amount": mx,
                    "approver_user_id": approver, "approver_name": name})
    return out


def _required_levels(levels: list, amount: float) -> list:
    """Escalation is CUMULATIVE: a level applies once the amount reaches its
    minimum. The old test (min <= amount < max) kept only the one band the
    amount fell in, so 600,000 needed the CEO alone and skipped the manager
    and CFO — the opposite of the documented rule."""
    req = [lv for lv in levels if amount >= float(lv.get("min_amount") or 0)]
    return req or levels[:1]


def _can_sign(level: dict, user: dict) -> bool:
    if level.get("approver_id"):
        return level["approver_id"] == user.get("user_id")
    return user.get("role") in LEVEL_ROLES.get(level.get("role"), TOP_ROLES) or bool(user.get("is_platform_admin"))


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
    _require(current_user, TOP_ROLES, "ضبط قواعد الاعتماد")
    company_id = current_user["company_id"]
    levels = await _clean_levels(req.levels, company_id)

    rule = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "document_type": req.document_type[:50],
        "name": req.name[:200],
        "levels": levels,
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
    doc_type    = str(data.get("document_type") or "")[:50]
    doc_id      = data.get("document_id")
    try:
        amount = round(float(data.get("amount") or 0), 2)
    except (TypeError, ValueError):
        raise HTTPException(400, "المبلغ يجب أن يكون رقماً")
    if not doc_type or amount < 0:
        raise HTTPException(400, "نوع المستند مطلوب والمبلغ لا يقل عن صفر")
    description = str(data.get("description") or "")[:500]
    ip          = get_client_ip(request)

    # Find matching approval rule
    rule = await db.approval_rules.find_one(
        {"company_id": company_id, "document_type": doc_type, "active": True},
        {"_id": 0}
    )

    # Determine required levels based on amount
    if rule and rule.get("levels"):
        required_levels = _required_levels(rule["levels"], amount)
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

    if "approvals_chain" not in ap_req:
        raise HTTPException(400, "هذا الطلب من شاشة الموافقات — اعتمده من هناك")
    current_level = ap_req["current_level"]
    chain = ap_req["approvals_chain"]
    total = ap_req["total_levels"]

    # Segregation of duties: the requester cannot approve their own request,
    # and each level is signed only by its named approver or its role.
    if ap_req.get("submitted_by") == current_user["user_id"]:
        raise HTTPException(403, "لا يمكنك اعتماد طلب قدَّمته بنفسك")
    if any(c.get("status") == "approved" and c.get("approver_id") == current_user["user_id"]
           for c in chain):
        raise HTTPException(403, "اعتمدت مستوى سابقاً في هذا الطلب — يلزم معتمد آخر")
    if not _can_sign(chain[current_level - 1], current_user):
        raise HTTPException(403, "هذا المستوى ليس من صلاحيتك")

    # Update current level
    slot = current_level - 1
    chain[slot]["status"]      = "approved"
    chain[slot]["approved_at"] = datetime.now(timezone.utc).isoformat()
    chain[slot]["approver_id"] = current_user["user_id"]
    chain[slot]["comment"]     = comment

    if current_level >= total:
        # ── Final approval → auto-post GL if applicable ─────
        new_status = "approved"
        # gl_posted was set to True here and the reply said "the entry will be
        # created automatically" — but nothing was ever posted. Approval only
        # releases the document; its own module posts the entry.
        res = await db.approval_requests.update_one(
            {"id": req_id, "company_id": company_id, "status": "pending", "current_level": current_level},
            {"$set": {"status": new_status, "approvals_chain": chain,
                      "final_approved_at": datetime.now(timezone.utc).isoformat(),
                      "gl_posted": False}})
        if res.modified_count == 0:
            raise HTTPException(409, "تم تعديل الطلب في نفس اللحظة — حدِّث الصفحة")

        await write_audit(company_id, current_user["user_id"], ip,
            "approval_final_approved", ap_req["document_type"], req_id,
            f"اعتماد نهائي — المستوى {current_level}/{total}",
            old_value={"status":"pending"}, new_value={"status":"approved"})

        return {
            "message":   f"✅ تم الاعتماد النهائي (المستوى {current_level}/{total})",
            "status":    "approved",
            "gl_posted": False,
            "note":      "تم الاعتماد — يُنشأ القيد عند حفظ/ترحيل المستند في الموديول الخاص به",
        }
    else:
        # Advance to next level
        res = await db.approval_requests.update_one(
            {"id": req_id, "company_id": company_id, "status": "pending", "current_level": current_level},
            {"$set": {"current_level": current_level + 1, "approvals_chain": chain}})
        if res.modified_count == 0:
            raise HTTPException(409, "تم تعديل الطلب في نفس اللحظة — حدِّث الصفحة")

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
    if not ap_req or ap_req["status"] != "pending" or "approvals_chain" not in ap_req:
        raise HTTPException(400, "الطلب غير موجود أو ليس معلقاً")

    current_level = ap_req["current_level"] - 1
    chain = ap_req["approvals_chain"]
    if not _can_sign(chain[current_level], current_user):
        raise HTTPException(403, "هذا المستوى ليس من صلاحيتك")
    chain[current_level]["approver_id"] = current_user["user_id"]
    chain[current_level]["status"]      = "rejected"
    chain[current_level]["rejected_at"] = datetime.now(timezone.utc).isoformat()
    chain[current_level]["comment"]     = reason

    await db.approval_requests.update_one({"id": req_id, "company_id": company_id}, {"$set": {
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
    # approvals.py shares this collection with a different schema; show only
    # the requests this engine created (the others live in the Approvals screen).
    q = {"company_id": current_user["company_id"], "approvals_chain": {"$exists": True}}
    if status:   q["status"]        = status
    if doc_type: q["document_type"] = doc_type
    page, limit = max(1, int(page)), max(1, min(int(limit), 100))
    total    = await db.approval_requests.count_documents(q)
    requests = await db.approval_requests.find(q, {"_id": 0}).sort(
        "submitted_at", -1).skip((page-1)*limit).limit(limit).to_list(None)
    return {"requests": requests, "total": total}




# ══════════════════════════════════════════════════════════════
# APPROVAL RULES — PER-COMPANY CONFIGURATION
# إدارة قواعد الاعتماد لكل شركة بشكل مستقل
# ══════════════════════════════════════════════════════════════

# جميع أنواع المستندات المدعومة
SUPPORTED_DOC_TYPES = [
    "purchase_invoice",    # فواتير الشراء
    "expense_claim",       # مطالبات المصروفات
    "asset_purchase",      # شراء الأصول الثابتة
    "payroll_run",         # كشف الرواتب
    "journal_entry",       # قيود يومية يدوية
    "credit_note",         # إشعارات دائنة
    "bank_transfer",       # تحويلات بنكية
    "inventory_write_off", # شطب مخزون
    "employee_loan",       # سلف الموظفين
    "contract_signing",    # توقيع العقود
]


@router.get("/approval-rules/templates")
async def get_rule_templates(current_user: dict = Depends(get_current_user)):
    """
    قوالب قواعد الاعتماد الجاهزة — يمكن تطبيقها ثم تعديل القيم

    يُسرِّع إعداد الشركات الجديدة
    """
    return {
        "templates": [
            {
                "name":          "شركة صغيرة (مستوى واحد)",
                "description":   "مناسبة للشركات < 50 موظف",
                "document_type": "purchase_invoice",
                "levels": [
                    {"role": "manager", "role_name_ar": "المدير العام",
                     "min_amount": 0, "max_amount": None,
                     "approver_user_id": None},
                ],
            },
            {
                "name":          "شركة متوسطة (مستويان)",
                "description":   "مناسبة للشركات 50–200 موظف",
                "document_type": "purchase_invoice",
                "levels": [
                    {"role": "dept_manager", "role_name_ar": "مدير القسم",
                     "min_amount": 0, "max_amount": 100_000,
                     "approver_user_id": None},
                    {"role": "cfo", "role_name_ar": "المدير المالي",
                     "min_amount": 100_000, "max_amount": None,
                     "approver_user_id": None},
                ],
            },
            {
                "name":          "شركة كبيرة (ثلاثة مستويات)",
                "description":   "مناسبة للشركات > 200 موظف",
                "document_type": "purchase_invoice",
                "levels": [
                    {"role": "dept_manager", "role_name_ar": "مدير القسم",
                     "min_amount": 0, "max_amount": 50_000,
                     "approver_user_id": None},
                    {"role": "cfo", "role_name_ar": "المدير المالي",
                     "min_amount": 50_000, "max_amount": 500_000,
                     "approver_user_id": None},
                    {"role": "ceo", "role_name_ar": "المدير العام",
                     "min_amount": 500_000, "max_amount": None,
                     "approver_user_id": None},
                ],
            },
        ],
        "supported_document_types": SUPPORTED_DOC_TYPES,
        "note": "طبِّق أي قالب ثم عدِّل القيم حسب احتياج شركتك",
    }


@router.get("/approval-rules/{doc_type}")
async def get_rule_by_doc_type(
    doc_type: str,
    current_user: dict = Depends(get_current_user)
):
    """
    عرض قاعدة الاعتماد لنوع مستند محدد مع شرح تفصيلي لكل مستوى

    يُظهر: الأدوار + نطاقات المبالغ + المعتمد المعيَّن (إن وجد)
    """
    company_id = current_user["company_id"]
    rule = await db.approval_rules.find_one(
        {"company_id": company_id, "document_type": doc_type}, {"_id": 0})

    if not rule:
        return {
            "exists":        False,
            "document_type": doc_type,
            "message":       f"لا توجد قاعدة اعتماد لـ '{doc_type}' — سيُطبَّق مستوى واحد افتراضي",
            "default_behavior": "مستوى واحد — مدير مباشر",
        }

    # Enrich levels with simulated examples
    enriched_levels = []
    for lvl in rule.get("levels", []):
        min_a = lvl.get("min_amount", 0)
        max_a = lvl.get("max_amount")
        enriched_levels.append({
            **lvl,
            "range_label": (
                f"من {min_a:,.0f} إلى {max_a:,.0f} ج.م"
                if max_a else f"من {min_a:,.0f} ج.م فأكثر"
            ),
        })

    return {
        "exists":        True,
        "document_type": doc_type,
        "name":          rule.get("name",""),
        "levels":        enriched_levels,
        "total_levels":  len(enriched_levels),
        "active":        rule.get("active", True),
        "created_at":    rule.get("created_at",""),
        "updated_at":    rule.get("updated_at",""),
    }


@router.put("/approval-rules/{doc_type}/thresholds")
async def update_thresholds(
    doc_type: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    تعديل قيم عتبات المبالغ فقط — بدون إعادة تعريف الأدوار

    الأبسط لتعديل الأرقام: أرسل فقط القيم الجديدة
    {
      "thresholds": [
        {"level": 1, "min_amount": 0,       "max_amount": 75000},
        {"level": 2, "min_amount": 75000,   "max_amount": 400000},
        {"level": 3, "min_amount": 400000,  "max_amount": null}
      ]
    }
    """
    _require(current_user, TOP_ROLES, "ضبط قواعد الاعتماد")
    company_id = current_user["company_id"]
    thresholds = data.get("thresholds", [])

    if not thresholds:
        raise HTTPException(400, "thresholds مطلوبة")

    rule = await db.approval_rules.find_one(
        {"company_id": company_id, "document_type": doc_type}, {"_id": 0})
    if not rule:
        raise HTTPException(404, f"لا توجد قاعدة اعتماد لـ '{doc_type}' — أنشئها أولاً")

    levels = rule.get("levels", [])

    # Validate thresholds count matches levels
    if len(thresholds) != len(levels):
        raise HTTPException(400,
            f"عدد العتبات ({len(thresholds)}) لا يطابق عدد المستويات ({len(levels)})")

    # Apply thresholds
    old_thresholds = [{"level": i+1,
                       "min_amount": l.get("min_amount"),
                       "max_amount": l.get("max_amount")}
                      for i, l in enumerate(levels)]

    for t in thresholds:
        lvl_idx = int(t.get("level", 1)) - 1
        if 0 <= lvl_idx < len(levels):
            levels[lvl_idx]["min_amount"] = float(t.get("min_amount", 0))
            levels[lvl_idx]["max_amount"] = float(t["max_amount"]) if t.get("max_amount") is not None else None

    # Validate: min of each level = max of previous
    for i in range(1, len(levels)):
        prev_max = levels[i-1].get("max_amount")
        curr_min = levels[i].get("min_amount", 0)
        if prev_max is not None and abs(float(prev_max) - float(curr_min)) > 0.01:
            raise HTTPException(400,
                f"الحد الأقصى للمستوى {i} ({prev_max}) يجب أن يساوي الحد الأدنى للمستوى {i+1} ({curr_min})")

    updated_at = datetime.now(timezone.utc).isoformat()
    await db.approval_rules.update_one(
        {"company_id": company_id, "document_type": doc_type},
        {"$set": {"levels": levels, "updated_at": updated_at,
                  "updated_by": current_user["user_id"]}}
    )

    return {
        "message":   f"✅ تم تحديث عتبات المبالغ لـ '{doc_type}'",
        "doc_type":  doc_type,
        "old_thresholds": old_thresholds,
        "new_levels": [
            {"level":     i+1,
             "role":      l.get("role"),
             "role_name_ar": l.get("role_name_ar",""),
             "min_amount": l.get("min_amount"),
             "max_amount": l.get("max_amount"),
             "range_label": (
                 f"{l.get('min_amount',0):,.0f} – {l['max_amount']:,.0f} ج.م"
                 if l.get("max_amount") else f"{l.get('min_amount',0):,.0f} ج.م فأكثر"
             )}
            for i, l in enumerate(levels)
        ],
        "updated_at": updated_at,
    }


@router.put("/approval-rules/{doc_type}/level/{level_num}/approver")
async def assign_approver(
    doc_type: str, level_num: int, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    تعيين مستخدم محدد كمعتمد لمستوى معين

    يمكن ترك approver_user_id فارغاً → أي مستخدم بالدور يمكنه الاعتماد
    """
    _require(current_user, TOP_ROLES, "ضبط قواعد الاعتماد")
    company_id = current_user["company_id"]
    approver_id = data.get("approver_user_id")
    approver_name = data.get("approver_name", "")

    rule = await db.approval_rules.find_one(
        {"company_id": company_id, "document_type": doc_type}, {"_id": 0})
    if not rule:
        raise HTTPException(404, f"لا توجد قاعدة لـ '{doc_type}'")

    levels = rule.get("levels", [])
    idx = level_num - 1
    if idx < 0 or idx >= len(levels):
        raise HTTPException(400, f"المستوى {level_num} غير موجود (المجال 1–{len(levels)})")

    if approver_id:
        u = await db.users.find_one({"id": approver_id, "company_id": company_id, "is_active": {"$ne": False}},
                                    {"_id": 0, "full_name": 1})
        if not u:
            raise HTTPException(400, "المعتمد ليس مستخدماً نشطاً في الشركة")
        approver_name = u.get("full_name", "")   # not the name typed in the request
    old_approver = levels[idx].get("approver_user_id")
    levels[idx]["approver_user_id"] = approver_id or None
    levels[idx]["approver_name"]    = approver_name if approver_id else ""

    await db.approval_rules.update_one(
        {"company_id": company_id, "document_type": doc_type},
        {"$set": {"levels": levels,
                  "updated_at": datetime.now(timezone.utc).isoformat(),
                  "updated_by": current_user["user_id"]}}
    )
    return {
        "message":      f"✅ تم تعيين المعتمد للمستوى {level_num}",
        "doc_type":     doc_type,
        "level":        level_num,
        "old_approver": old_approver,
        "new_approver": approver_id,
        "approver_name": approver_name,
    }


@router.patch("/approval-rules/{doc_type}/toggle")
async def toggle_rule(
    doc_type: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """تفعيل / تعطيل قاعدة اعتماد"""
    _require(current_user, TOP_ROLES, "ضبط قواعد الاعتماد")
    company_id = current_user["company_id"]
    active = data.get("active", True) is not False

    result = await db.approval_rules.update_one(
        {"company_id": company_id, "document_type": doc_type},
        {"$set": {"active": active,
                  "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, f"لا توجد قاعدة لـ '{doc_type}'")

    return {
        "message": f"{'✅ تم تفعيل' if active else '⏸ تم تعطيل'} قاعدة الاعتماد لـ '{doc_type}'",
        "doc_type": doc_type,
        "active":   active,
    }


@router.post("/approval-rules/copy-from")
async def copy_rules_from_company(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    استيراد قواعد الاعتماد من شركة أخرى

    مفيد لإعداد شركات جديدة بنفس هيكل اعتماد شركة قائمة
    """
    company_id      = current_user["company_id"]
    source_company  = data.get("source_company_id")
    doc_types       = data.get("document_types", [])  # empty = all

    if not source_company:
        raise HTTPException(400, "source_company_id مطلوب")
    if source_company == company_id:
        raise HTTPException(400, "لا يمكن النسخ من نفس الشركة")
    # This read another company's rules by bare id — any tenant could pull
    # any other tenant's approval structure. Only companies linked to this one
    # in a consolidation group (subsidiary has ACCEPTED the link) qualify.
    linked = await db.company_groups.find_one({"$or": [
        {"holding_company_id": company_id,
         "subsidiaries": {"$elemMatch": {"company_id": source_company, "link_status": "accepted"}}},
        {"holding_company_id": source_company,
         "subsidiaries": {"$elemMatch": {"company_id": company_id, "link_status": "accepted"}}},
    ]}, {"_id": 1})
    if not linked:
        raise HTTPException(403, "النسخ مسموح فقط من شركة مرتبطة بشركتك في مجموعة (تجميع) وافقت على الارتباط")

    q = {"company_id": source_company, "active": True}
    if doc_types:
        q["document_type"] = {"$in": doc_types}

    source_rules = await db.approval_rules.find(q, {"_id": 0}).to_list(None)
    if not source_rules:
        raise HTTPException(404, "لا توجد قواعد في الشركة المصدر")

    copied = []
    for rule in source_rules:
        import uuid as _uuid
        new_rule = {
            "document_type": rule["document_type"], "name": rule.get("name", ""),
            "levels": [dict(l) for l in rule.get("levels", [])], "active": True,
            "id":          str(_uuid.uuid4()),
            "company_id":  company_id,
            "copied_from": source_company,
            "created_by":  current_user["user_id"],
            "created_at":  datetime.now(timezone.utc).isoformat(),
            "updated_at":  None,
        }
        # Clear company-specific approver IDs (roles stay, user IDs cleared)
        for level in new_rule.get("levels", []):
            level["approver_user_id"] = None
            level["approver_name"]    = ""

        await db.approval_rules.replace_one(
            {"company_id": company_id, "document_type": rule["document_type"]},
            new_rule, upsert=True
        )
        copied.append(rule["document_type"])

    return {
        "message":       f"✅ تم نسخ {len(copied)} قاعدة اعتماد",
        "source_company": source_company,
        "copied_rules":   copied,
        "note": "تم مسح معرِّفات المعتمدين — يجب تعيين المعتمدين للشركة الجديدة",
    }


@router.get("/approval-rules/summary/all")
async def get_all_rules_summary(current_user: dict = Depends(get_current_user)):
    """
    ملخص شامل لجميع قواعد الاعتماد المُعرَّفة للشركة

    يُظهر بوضوح: كل نوع مستند + مستوياته + قيم العتبات
    """
    _require(current_user, TOP_ROLES, "ضبط قواعد الاعتماد")
    company_id = current_user["company_id"]
    rules = await db.approval_rules.find(
        {"company_id": company_id}, {"_id": 0}
    ).sort("document_type", 1).to_list(None)

    configured_types = {r["document_type"] for r in rules}
    missing_types = [t for t in SUPPORTED_DOC_TYPES if t not in configured_types]

    summary = []
    for rule in rules:
        levels = rule.get("levels", [])
        summary.append({
            "document_type":  rule["document_type"],
            "name":           rule.get("name",""),
            "active":         rule.get("active", True),
            "levels_count":   len(levels),
            "thresholds": [
                {
                    "level": i+1,
                    "role":  l.get("role",""),
                    "role_name_ar": l.get("role_name_ar",""),
                    "min_amount":   l.get("min_amount",0),
                    "max_amount":   l.get("max_amount"),
                    "approver_assigned": bool(l.get("approver_user_id")),
                }
                for i, l in enumerate(levels)
            ],
            "updated_at": rule.get("updated_at",""),
        })

    return {
        "company_id":       company_id,
        "configured_count": len(rules),
        "rules":            summary,
        "missing_config":   missing_types,
        "missing_note":     "هذه الأنواع ستستخدم مستوى اعتماد واحد افتراضياً",
    }

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
        # marked so a hand-written event can't pass for one the system logged
        action="manual:" + str(data.get("action", ""))[:80],
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
    page, limit = max(1, int(page)), max(1, min(int(limit), 200))
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
    try:
        limit = max(1, min(int(data.get("limit", 1000)), 20000))
    except (TypeError, ValueError):
        limit = 1000

    entries = await db.audit_trail.find(
        {"company_id": company_id, "chain_hash": {"$exists": True, "$ne": ""}}, {"_id": 0}
    ).sort("timestamp", 1).limit(limit).to_list(None)

    tampered = []
    prev_hash = None

    for entry in entries:
        computed = make_audit_hash(entry, entry.get("prev_hash",""))
        problem = None
        if computed != entry.get("chain_hash",""):
            problem = "محتوى السجل تغيَّر"
        # Only each row's own hash was checked, so DELETING a row went
        # unnoticed. Each row must point at the hash of the row before it.
        elif prev_hash is not None and entry.get("prev_hash", "") != prev_hash:
            problem = "سجل سابق محذوف أو مُعاد ترتيبه"
        if problem:
            tampered.append({
                "entry_id":  entry["id"],
                "timestamp": entry["timestamp"],
                "action":    entry["action"],
                "problem":   problem,
                "stored_hash":   entry.get("chain_hash",""),
                "computed_hash": computed,
            })
        prev_hash = entry.get("chain_hash","")

    return {
        "entries_checked": len(entries),
        "chain_intact":    len(tampered) == 0,
        "note": "قد تظهر ملاحظة تسلسل إذا سُجِّل حدثان في نفس اللحظة",
        "tampered_entries": tampered,
        "message": "✅ سلسلة التدقيق سليمة" if not tampered else f"⚠️ {len(tampered)} سجل مُعدَّل",
    }
