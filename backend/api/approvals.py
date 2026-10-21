from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/approvals", tags=["approvals"])

async def _broadcast_approval(company_id: str, event: str, data: dict):
    """Broadcast approval event to connected WebSocket clients"""
    try:
        from api.attachments import broadcast_update
        await broadcast_update(company_id, event, data)
    except Exception:
        pass  # Non-critical — WebSocket broadcast failure shouldn't break the API

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def generate_id(prefix=""):
    """Generate unique ID"""
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}{random_part}"


async def verify_token(authorization: str):
    """Verify token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token as vt
    token = authorization.split(" ")[1]
    data = vt(token)
    
    if not data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return data


# Approval types and their configurations
APPROVAL_TYPES = {
    "leave_request": {
        "name_en": "Leave Request",
        "name_ar": "طلب إجازة",
        "default_approvers": ["HR Manager", "General Manager"]
    },
    "expense": {
        "name_en": "Expense Approval",
        "name_ar": "الموافقة على المصروفات",
        "default_approvers": ["Financial Manager", "General Manager"]
    },
    "purchase_order": {
        "name_en": "Purchase Order",
        "name_ar": "أمر شراء",
        "default_approvers": ["Procurement Manager", "Financial Manager", "General Manager"]
    },
    "invoice": {
        "name_en": "Invoice Approval",
        "name_ar": "الموافقة على الفاتورة",
        "default_approvers": ["Financial Manager"]
    },
    "salary_change": {
        "name_en": "Salary Change",
        "name_ar": "تغيير الراتب",
        "default_approvers": ["HR Manager", "General Manager"]
    },
    "document": {
        "name_en": "Document Approval",
        "name_ar": "الموافقة على المستند",
        "default_approvers": ["General Manager"]
    }
}


# roles as they are stored: English ids and the Arabic names some accounts use
ROLE_ALIASES = {
    "HR Manager": ["HR Manager", "مدير الموارد البشرية"],
    "General Manager": ["General Manager", "مدير عام", "المدير العام"],
    "Financial Manager": ["Financial Manager", "المدير المالي"],
    "Procurement Manager": ["Procurement Manager", "مدير المشتريات"],
}
# who may set up approval chains, and the fallback approvers when a type's
# default roles have no users
TOP_ROLES = ["Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام", "المدير العام",
             "CEO", "المدير التنفيذي", "Super Admin", "admin", "owner"]


# documents whose approval request is opened by the document itself
DOCUMENT_REFS = {"purchase_order", "payment_voucher"}


def _renumber(approvers: list) -> list:
    """Levels become 1..n in order, with no gaps (an empty level blocked a
    request forever: nobody could ever approve it)."""
    order = sorted({int(a.get("level") or 1) for a in approvers})
    remap = {old: i + 1 for i, old in enumerate(order)}
    return [{**a, "level": remap[int(a.get("level") or 1)]} for a in approvers]


async def _default_approvers(company_id: str, roles: list, requester_id: str) -> list:
    """One level per role, in order; every active user holding that role is an
    approver at that level and any one of them can act. The requester is never
    an approver of their own request."""
    out, level = [], 0
    for role in roles:
        names = ROLE_ALIASES.get(role, [role])
        users = await db.users.find(
            {"company_id": company_id, "role": {"$in": names}, "is_active": {"$ne": False},
             "id": {"$ne": requester_id}},
            {"_id": 0, "id": 1, "full_name": 1, "role": 1, "email": 1}).to_list(length=None)
        users = [u for u in users if u.get("id") not in {a["user_id"] for a in out}]
        if not users:
            continue
        level += 1
        out += [{"user_id": u["id"], "user_name": u.get("full_name"), "role": u.get("role"),
                 "email": u.get("email"), "level": level} for u in users]
    return out


# ============ AMOUNT THRESHOLDS ============
# A workflow can carry amount bands: [{min_amount, max_amount, approver_roles, levels}].
# An amount falls in the band with min_amount <= amount < max_amount (no max =
# no ceiling). The band decides who approves: approver_roles (one level per
# role, in order) or the first `levels` levels of the workflow's chain.
# Below every band (or below auto_approve_below) no approval is needed.
# A user's approval_limit lets them commit up to that amount on their own;
# above it they need approval even where no band applies.

def _num(v):
    try:
        if v is None or v == "":
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def _clean_bands(bands) -> list:
    out = []
    for b in bands or []:
        if not isinstance(b, dict):
            continue
        lo = _num(b.get("min_amount")) or 0.0
        hi = _num(b.get("max_amount"))
        roles = [str(r).strip() for r in (b.get("approver_roles") or []) if str(r or "").strip()]
        levels = b.get("levels")
        try:
            levels = int(levels) if levels not in (None, "") else None
        except (TypeError, ValueError):
            levels = None
        out.append({"min_amount": lo, "max_amount": hi, "approver_roles": roles,
                    "levels": levels if levels and levels > 0 else None,
                    "label": (b.get("label") or "").strip() or None})
    return sorted(out, key=lambda b: b["min_amount"])


def _band_for(bands, amount):
    amount = _num(amount)
    if amount is None:
        return None
    for b in _clean_bands(bands):
        if amount >= b["min_amount"] and (b["max_amount"] is None or amount < b["max_amount"]):
            return b
    return None


def _band_label(b) -> Optional[str]:
    if not b:
        return None
    if b.get("label"):
        return b["label"]
    hi = b.get("max_amount")
    return f"{b['min_amount']:,.0f} – {hi:,.0f}" if hi is not None else f"≥ {b['min_amount']:,.0f}"


async def _workflow(company_id: str, approval_type: str) -> dict:
    return await db.approval_workflows.find_one(
        {"company_id": company_id, "type": approval_type, "is_active": True}, {"_id": 0}) or {}


async def approval_required(company_id: str, approval_type: str, amount, user_id: Optional[str]) -> dict:
    """Does a document of this type and amount, created by this user, need approval?"""
    amount = _num(amount)
    res = {"required": False, "band": None, "band_label": None, "amount": amount,
           "user_limit": None, "auto_approve_below": None, "reason": None}
    if amount is None or amount <= 0:
        return res
    wf = await _workflow(company_id, approval_type)
    user = await db.users.find_one({"id": user_id, "company_id": company_id},
                                   {"_id": 0, "approval_limit": 1}) if user_id else None
    limit = _num((user or {}).get("approval_limit"))
    aab = _num(wf.get("auto_approve_below"))
    bands = _clean_bands(wf.get("bands"))
    band = _band_for(bands, amount)
    res.update(user_limit=limit, auto_approve_below=aab, band=band, band_label=_band_label(band))
    if limit is not None and amount <= limit:
        res["reason"] = "within_user_limit"
        return res
    if aab is not None and amount < aab:
        res["reason"] = "below_auto_approve"
        return res
    if bands:
        if band:
            res.update(required=True, reason="band")
    elif aab is not None:
        res.update(required=True, reason="above_auto_approve")
    if not res["required"] and limit is not None and amount > limit:
        res.update(required=True, reason="above_user_limit")
    return res


async def _resolve_approvers(company_id: str, approval_type: str, amount, requester_id: str):
    """(approvers, band) for a request: the band's roles, else the workflow's
    chain (cut to the band's levels), else the type's default roles, else top
    management. The requester is never one of them."""
    wf = await _workflow(company_id, approval_type)
    band = _band_for(wf.get("bands"), amount)
    chain = [a for a in wf.get("approvers", []) or [] if a.get("user_id") and a.get("user_id") != requester_id]
    approvers = []
    if band and band.get("approver_roles"):
        approvers = await _default_approvers(company_id, band["approver_roles"], requester_id)
    if not approvers:
        approvers = chain or await _default_approvers(
            company_id, APPROVAL_TYPES[approval_type]["default_approvers"], requester_id)
        if approvers and band and band.get("levels"):
            approvers = _renumber(approvers)
            approvers = [a for a in approvers if a["level"] <= band["levels"]] or approvers
    if not approvers:
        approvers = await _default_approvers(company_id, TOP_ROLES, requester_id)
    return (_renumber(approvers) if approvers else []), band, wf


async def gate_document(company_id: str, user_id: str, user_name: Optional[str], approval_type: str,
                        amount, reference_type: str, reference_id: str, title: str,
                        description: str = "", data: Optional[dict] = None, role: Optional[str] = None):
    """Used by purchases / payment vouchers before a document takes effect.
    Returns the open approval request when one is needed, None when the
    document may go ahead. A top-role user with nobody else to approve goes
    ahead (a one-manager company must still be able to work)."""
    need = await approval_required(company_id, approval_type, amount, user_id)
    if not need["required"]:
        return None
    existing = await db.approval_requests.find_one(
        {"company_id": company_id, "reference_type": reference_type, "reference_id": reference_id,
         "status": "pending"}, {"_id": 0})
    if existing:
        return existing
    approvers, _, _ = await _resolve_approvers(company_id, approval_type, amount, user_id)
    if not approvers:
        if not role:
            u = await db.users.find_one({"id": user_id, "company_id": company_id}, {"_id": 0, "role": 1}) or {}
            role = u.get("role")
        if role in TOP_ROLES:
            return None
    return await open_approval_request(company_id, user_id, user_name, {
        "type": approval_type, "title": title, "description": description,
        "reference_type": reference_type, "reference_id": reference_id,
        "amount": need["amount"], "data": data or {}, "_gated": True})


# ============ APPROVAL REQUESTS ============

@router.post("/request")
async def create_approval_request(
    request_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create a new approval request"""
    user_data = await verify_token(authorization)
    request_data = {k: v for k, v in (request_data or {}).items() if k != "_gated"}
    # purchase orders and payment vouchers open their own requests when they
    # cross a threshold; a hand-made request pointing at one could approve it
    if request_data.get("reference_type") in DOCUMENT_REFS:
        raise HTTPException(status_code=400,
                            detail="طلب اعتماد هذا المستند يُنشأ تلقائياً من المستند نفسه")
    return await open_approval_request(user_data.get("company_id"), user_data.get("user_id"),
                                       user_data.get("full_name"), request_data)


async def open_approval_request(company_id: str, requester_id: str, requester_name: Optional[str],
                                request_data: dict) -> dict:
    """Open an approval request on behalf of a user — used by the endpoint
    above and by other modules (e.g. a leave requested from the employee
    portal, which used to wait in a collection no approver could see)."""
    user_data = {"company_id": company_id, "user_id": requester_id, "full_name": requester_name}
    approval_type = request_data.get("type")
    
    if approval_type not in APPROVAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid approval type")
    
    type_config = APPROVAL_TYPES[approval_type]
    
    requester_id = user_data.get("user_id")
    amount = _num(request_data.get("amount"))
    approvers, band, workflow = await _resolve_approvers(company_id, approval_type, amount, requester_id)
    if not approvers:
        raise HTTPException(status_code=400,
                            detail="لا يوجد مَن يعتمد هذا الطلب — أضف مستخدماً بدور مدير أو اضبط مسار الموافقات")
    approval_levels = max(a["level"] for a in approvers)
    
    approval_request = {
        "id": generate_id("apr_"),
        "company_id": company_id,
        "type": approval_type,
        "type_name_en": type_config["name_en"],
        "type_name_ar": type_config["name_ar"],
        "title": request_data.get("title"),
        "description": request_data.get("description", ""),
        "reference_type": request_data.get("reference_type"),  # leave, expense, po, invoice, etc.
        "reference_id": request_data.get("reference_id"),
        "amount": amount if amount is not None else request_data.get("amount"),
        "currency": request_data.get("currency", "EGP"),
        "band": band,
        "band_label": _band_label(band),
        "attachments": request_data.get("attachments", []),
        "data": request_data.get("data", {}),
        "status": "pending",  # pending, approved, rejected, cancelled
        "current_level": 1,
        "total_levels": approval_levels,
        "approvers": approvers,
        "approval_history": [],
        "requester_id": user_data.get("user_id"),
        "requester_name": user_data.get("full_name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # a manual request under the workflow's auto-approve amount is approved at once
    aab = _num(workflow.get("auto_approve_below"))
    if not request_data.get("_gated") and amount is not None and aab is not None and amount < aab:
        now = datetime.now(timezone.utc).isoformat()
        approval_request.update(status="approved", approved_at=now, approval_history=[
            {"action": "auto_approved", "level": 0, "user_id": "system", "user_name": "auto",
             "comments": f"أقل من حد الاعتماد التلقائي {aab:,.2f}", "timestamp": now}])
        await db.approval_requests.insert_one(approval_request)
        approval_request.pop("_id", None)
        await execute_approval_action(approval_request)
        return approval_request

    await db.approval_requests.insert_one(approval_request)
    if "_id" in approval_request:
        del approval_request["_id"]
    
    # Send notification to first level approvers
    first_level_approvers = [a for a in approvers if a.get("level") == 1]
    for approver in first_level_approvers:
        await create_approval_notification(
            approval_request["id"],
            approver.get("user_id"),
            company_id,
            "new_request"
        )
    
    return approval_request


@router.get("/pending")
async def get_pending_approvals(authorization: Optional[str] = Header(None)):
    """Get pending approvals for current user"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    # Find requests where user is an approver at current level
    requests = await db.approval_requests.find({
        "company_id": company_id,
        "status": "pending",
        "approvers": {
            "$elemMatch": {
                "user_id": user_id,
                "level": {"$exists": True}
            }
        }
    }, {"_id": 0}).to_list(length=None)
    
    # Filter to only show requests at user's approval level
    pending = []
    for req in requests:
        current_level = req.get("current_level", 1)
        user_levels = [a.get("level") for a in req.get("approvers", []) if a.get("user_id") == user_id]
        if current_level in user_levels:
            pending.append(req)
    
    return pending


@router.get("/my-requests")
async def get_my_requests(
    status: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get requests created by current user"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    
    query = {"requester_id": user_id}
    if status:
        query["status"] = status
    
    requests = await db.approval_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=None)
    
    return requests


@router.get("/stats")
async def get_approval_stats(authorization: Optional[str] = Header(None)):
    """Get approval statistics"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    user_id = user_data.get("user_id")
    
    all_requests = await db.approval_requests.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # My pending approvals
    my_pending = 0
    for req in all_requests:
        if req.get("status") == "pending":
            current_level = req.get("current_level", 1)
            user_levels = [a.get("level") for a in req.get("approvers", []) if a.get("user_id") == user_id]
            if current_level in user_levels:
                my_pending += 1
    
    # By status
    by_status = {}
    for req in all_requests:
        status = req.get("status", "unknown")
        if status not in by_status:
            by_status[status] = 0
        by_status[status] += 1
    
    # By type
    by_type = {}
    for req in all_requests:
        req_type = req.get("type", "unknown")
        if req_type not in by_type:
            by_type[req_type] = 0
        by_type[req_type] += 1
    
    # Average approval time
    approved_requests = [r for r in all_requests if r.get("status") == "approved" and r.get("approved_at")]
    avg_time = 0
    if approved_requests:
        total_hours = 0
        for req in approved_requests:
            created = datetime.fromisoformat(req.get("created_at").replace('Z', '+00:00'))
            approved = datetime.fromisoformat(req.get("approved_at").replace('Z', '+00:00'))
            total_hours += (approved - created).total_seconds() / 3600
        avg_time = round(total_hours / len(approved_requests), 1)
    
    return {
        "my_pending": my_pending,
        "total_requests": len(all_requests),
        "by_status": by_status,
        "by_type": by_type,
        "average_approval_hours": avg_time
    }


@router.get("/workflows/list")
async def get_workflows(authorization: Optional[str] = Header(None)):
    """Get all approval workflows"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    workflows = await db.approval_workflows.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # Add default types that don't have custom workflows
    existing_types = [w.get("type") for w in workflows]
    for type_key, type_config in APPROVAL_TYPES.items():
        if type_key not in existing_types:
            workflows.append({
                "type": type_key,
                "name_en": type_config["name_en"],
                "name_ar": type_config["name_ar"],
                "is_default": True,
                "default_approvers": type_config["default_approvers"]
            })
    
    return workflows


@router.get("/workflows")
async def get_workflows(authorization: Optional[str] = Header(None)):
    """Get all approval workflows"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    workflows = await db.approval_workflows.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    # Add default types that don't have custom workflows
    existing_types = [w.get("type") for w in workflows]
    for type_key, type_config in APPROVAL_TYPES.items():
        if type_key not in existing_types:
            workflows.append({
                "type": type_key,
                "name_en": type_config["name_en"],
                "name_ar": type_config["name_ar"],
                "is_default": True,
                "default_approvers": type_config["default_approvers"]
            })
    
    return workflows


# ============ THRESHOLD SETTINGS & USER LIMITS ============

def _validate_bands(bands) -> list:
    if bands is None:
        return []
    if not isinstance(bands, list):
        raise HTTPException(status_code=400, detail="الشرائح يجب أن تكون قائمة")
    clean = _clean_bands(bands)
    for i, b in enumerate(clean):
        if b["min_amount"] < 0:
            raise HTTPException(status_code=400, detail="بداية الشريحة لا تكون سالبة")
        if b["max_amount"] is not None and b["max_amount"] <= b["min_amount"]:
            raise HTTPException(status_code=400, detail=f"نهاية الشريحة {i + 1} يجب أن تكون أكبر من بدايتها")
        if i and (clean[i - 1]["max_amount"] is None or clean[i - 1]["max_amount"] > b["min_amount"]):
            raise HTTPException(status_code=400, detail="الشرائح متداخلة — كل شريحة تبدأ حيث تنتهي السابقة أو بعدها")
        if not b["approver_roles"] and not b["levels"]:
            raise HTTPException(status_code=400, detail=f"حدد أدوار المعتمدين أو عدد المستويات للشريحة {i + 1}")
    return clean


def _require_top(user_data: dict):
    if user_data.get("role") not in TOP_ROLES:
        raise HTTPException(status_code=403, detail="ضبط حدود الاعتماد لرئيس مجلس الإدارة أو المدير العام فقط")


@router.get("/settings/thresholds")
async def get_threshold_settings(authorization: Optional[str] = Header(None)):
    """Amount bands per document type, and each user's approval limit."""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    wfs = {w["type"]: w async for w in db.approval_workflows.find({"company_id": company_id}, {"_id": 0})}
    types = []
    for key, cfg in APPROVAL_TYPES.items():
        w = wfs.get(key, {})
        types.append({"type": key, "name_ar": cfg["name_ar"], "name_en": cfg["name_en"],
                      "bands": [{**b, "band_label": _band_label(b)} for b in _clean_bands(w.get("bands"))],
                      "auto_approve_below": _num(w.get("auto_approve_below")),
                      "default_approvers": cfg["default_approvers"]})
    users = await db.users.find(
        {"company_id": company_id, "is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "full_name": 1, "email": 1, "role": 1, "approval_limit": 1}).to_list(length=None)
    roles = sorted({u.get("role") for u in users if u.get("role")} | set(ROLE_ALIASES))
    return {"types": types, "users": users, "roles": roles,
            "can_edit": user_data.get("role") in TOP_ROLES}


@router.put("/settings/thresholds/{approval_type}")
async def set_threshold_settings(approval_type: str, payload: dict,
                                 authorization: Optional[str] = Header(None)):
    """{bands: [{min_amount, max_amount, approver_roles: [...], levels}], auto_approve_below}"""
    user_data = await verify_token(authorization)
    _require_top(user_data)
    if approval_type not in APPROVAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid approval type")
    update = {"bands": _validate_bands((payload or {}).get("bands")),
              "updated_at": datetime.now(timezone.utc).isoformat()}
    if "auto_approve_below" in (payload or {}):
        aab = _num(payload.get("auto_approve_below"))
        if aab is not None and aab < 0:
            raise HTTPException(status_code=400, detail="حد الاعتماد التلقائي لا يكون سالباً")
        update["auto_approve_below"] = aab
    await db.approval_workflows.update_one(
        {"company_id": user_data.get("company_id"), "type": approval_type},
        {"$set": update,
         "$setOnInsert": {"company_id": user_data.get("company_id"), "type": approval_type,
                          "name_en": APPROVAL_TYPES[approval_type]["name_en"],
                          "name_ar": APPROVAL_TYPES[approval_type]["name_ar"],
                          "approvers": [], "is_active": True}},
        upsert=True)
    return {"success": True, "bands": update["bands"], "auto_approve_below": update.get("auto_approve_below")}


@router.put("/limits/{user_id}")
async def set_user_approval_limit(user_id: str, payload: dict,
                                  authorization: Optional[str] = Header(None)):
    """{approval_limit: number | null} — the amount this user may commit without approval."""
    user_data = await verify_token(authorization)
    _require_top(user_data)
    limit = _num((payload or {}).get("approval_limit"))
    if limit is not None and limit < 0:
        raise HTTPException(status_code=400, detail="الحد لا يكون سالباً")
    res = await db.users.update_one({"id": user_id, "company_id": user_data.get("company_id")},
                                    {"$set": {"approval_limit": limit}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="المستخدم غير موجود")
    return {"success": True, "user_id": user_id, "approval_limit": limit}


@router.get("/check")
async def check_approval_needed(type: str, amount: float, authorization: Optional[str] = Header(None)):
    """Would a document of this type and amount need approval for the current user?"""
    user_data = await verify_token(authorization)
    if type not in APPROVAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid approval type")
    return await approval_required(user_data.get("company_id"), type, amount, user_data.get("user_id"))


@router.get("/{request_id}")
async def get_approval_request(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single approval request"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    request = await db.approval_requests.find_one(
        {"id": request_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return request


@router.post("/{request_id}/approve")
async def approve_request(
    request_id: str,
    approval_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Approve a request"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    request = await db.approval_requests.find_one(
        {"id": request_id, "company_id": company_id}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Check if user is an approver at current level
    current_level = request.get("current_level", 1)
    user_levels = [a.get("level") for a in request.get("approvers", []) if a.get("user_id") == user_id]
    
    if current_level not in user_levels:
        raise HTTPException(status_code=403, detail="Not authorized to approve at this level")
    if user_id == request.get("requester_id"):
        raise HTTPException(status_code=403, detail="لا يمكن اعتماد طلبك بنفسك")
    # one person, one signature: someone listed on two levels cannot clear both
    if any(h.get("user_id") == user_id and h.get("action") == "approved"
           for h in request.get("approval_history", [])):
        raise HTTPException(status_code=403, detail="اعتمدت هذا الطلب في مستوى سابق — يلزم معتمد آخر")
    
    # Add to approval history
    approval_entry = {
        "action": "approved",
        "level": current_level,
        "user_id": user_id,
        "user_name": user_data.get("full_name"),
        "comments": approval_data.get("comments", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    update_data = {
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Check if this is the final level
    total_levels = request.get("total_levels", 1)
    
    if current_level >= total_levels:
        # Final approval — the action runs only after the status change is saved
        update_data["status"] = "approved"
        update_data["approved_at"] = datetime.now(timezone.utc).isoformat()
    else:
        # Move to next level
        update_data["current_level"] = current_level + 1
        
        # Notify next level approvers
        next_level_approvers = [a for a in request.get("approvers", []) if a.get("level") == current_level + 1]
        for approver in next_level_approvers:
            await create_approval_notification(
                request_id,
                approver.get("user_id"),
                company_id,
                "level_approved"
            )
    
    # conditional on the level we checked: two approvers clicking together
    # cannot both pass the same level (or run the final action twice)
    res = await db.approval_requests.update_one(
        {"id": request_id, "company_id": company_id, "status": "pending", "current_level": current_level},
        {
            "$set": update_data,
            "$push": {"approval_history": approval_entry}
        }
    )
    if not res.modified_count:
        raise HTTPException(status_code=409, detail="تغيّرت حالة الطلب — حدّث الصفحة")
    if update_data.get("status") == "approved":
        await execute_approval_action(request, approver_id=user_id)
    
    # Notify requester
    await create_approval_notification(
        request_id,
        request.get("requester_id"),
        company_id,
        "approved" if update_data.get("status") == "approved" else "level_approved"
    )
    
    # Broadcast real-time update to all connected clients
    await _broadcast_approval(company_id, "approval_updated", {
        "request_id": request_id,
        "status": update_data.get("status", "pending"),
        "approved_by": user_id,
        "type": request.get("type"),
        "title": request.get("title", ""),
    })

    return {"success": True, "status": update_data.get("status", "pending")}


@router.post("/{request_id}/reject")
async def reject_request(
    request_id: str,
    rejection_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Reject a request"""
    user_data = await verify_token(authorization)
    user_id = user_data.get("user_id")
    company_id = user_data.get("company_id")
    
    request = await db.approval_requests.find_one(
        {"id": request_id, "company_id": company_id}
    )
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")
    
    # Check if user is an approver
    current_level = request.get("current_level", 1)
    user_levels = [a.get("level") for a in request.get("approvers", []) if a.get("user_id") == user_id]
    
    if current_level not in user_levels:
        raise HTTPException(status_code=403, detail="Not authorized to reject")
    if user_id == request.get("requester_id"):
        raise HTTPException(status_code=403, detail="لا يمكن رفض طلبك بنفسك — ألغِه بدلاً من ذلك")
    
    rejection_entry = {
        "action": "rejected",
        "level": current_level,
        "user_id": user_id,
        "user_name": user_data.get("full_name"),
        "reason": rejection_data.get("reason", ""),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.approval_requests.update_one(
        {"id": request_id, "company_id": company_id, "status": "pending"},
        {
            "$set": {
                "status": "rejected",
                "rejected_at": datetime.now(timezone.utc).isoformat(),
                "rejection_reason": rejection_data.get("reason", ""),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$push": {"approval_history": rejection_entry}
        }
    )
    
    await _close_document(request, "rejected", rejection_data.get("reason", ""))
    if request.get("reference_type") == "leave" and request.get("reference_id"):
        await db.leaves.update_one(
            {"id": request["reference_id"], "company_id": company_id, "status": "pending"},
            {"$set": {"status": "rejected", "rejection_reason": rejection_data.get("reason", ""),
                      "reviewed_at": datetime.now(timezone.utc).isoformat()}})
    
    # Notify requester
    await create_approval_notification(
        request_id,
        request.get("requester_id"),
        company_id,
        "rejected"
    )
    
    return {"success": True, "status": "rejected"}


@router.post("/{request_id}/cancel")
async def cancel_request(
    request_id: str,
    authorization: Optional[str] = Header(None)
):
    """Cancel own request"""
    user_data = await verify_token(authorization)
    if not await db.approval_requests.find_one({"id": request_id, "company_id": user_data.get("company_id")}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Request not found")
    user_id = user_data.get("user_id")
    
    request = await db.approval_requests.find_one({"id": request_id})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request.get("requester_id") != user_id:
        raise HTTPException(status_code=403, detail="Can only cancel your own requests")
    
    if request.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    
    await db.approval_requests.update_one(
        {"id": request_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    await _close_document(request, "cancelled")
    
    return {"success": True}


# ============ WORKFLOW CONFIGURATION ============

@router.post("/workflows")
async def create_workflow(
    workflow_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Create or update approval workflow"""
    user_data = await verify_token(authorization)
    company_id = user_data.get("company_id")
    
    # Anyone could rewrite a chain — including listing themselves as the only
    # approver, then approving their own requests.
    if user_data.get("role") not in TOP_ROLES:
        raise HTTPException(status_code=403, detail="ضبط مسار الموافقات لرئيس مجلس الإدارة أو المدير العام فقط")
    approval_type = workflow_data.get("type")
    
    if approval_type not in APPROVAL_TYPES:
        raise HTTPException(status_code=400, detail="Invalid approval type")
    
    approvers = []
    for a in workflow_data.get("approvers", []) or []:
        uid = (a or {}).get("user_id")
        try:
            level = int(a.get("level") or 1)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="مستوى الموافقة يجب أن يكون رقماً")
        if level < 1:
            raise HTTPException(status_code=400, detail="مستوى الموافقة يبدأ من 1")
        u = await db.users.find_one({"id": uid, "company_id": company_id, "is_active": {"$ne": False}},
                                    {"_id": 0, "id": 1, "full_name": 1, "role": 1, "email": 1})
        if not u:
            raise HTTPException(status_code=400, detail="أحد المعتمدين ليس مستخدماً في الشركة")
        approvers.append({"user_id": u["id"], "user_name": u.get("full_name"), "role": u.get("role"),
                          "email": u.get("email"), "level": level})
    if not approvers:
        raise HTTPException(status_code=400, detail="أضف معتمداً واحداً على الأقل")
    approvers = _renumber(approvers)
    
    workflow = {
        "company_id": company_id,
        "type": approval_type,
        "name_en": APPROVAL_TYPES[approval_type]["name_en"],
        "name_ar": APPROVAL_TYPES[approval_type]["name_ar"],
        "approvers": approvers,
        "levels": max(a["level"] for a in approvers),
        "escalation_days": workflow_data.get("escalation_days", 3),
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if "auto_approve_below" in workflow_data:   # amounts below it need no approval
        workflow["auto_approve_below"] = _num(workflow_data.get("auto_approve_below"))
    if "bands" in workflow_data:
        workflow["bands"] = _validate_bands(workflow_data.get("bands"))
    
    await db.approval_workflows.update_one(
        {"company_id": company_id, "type": approval_type},
        {"$set": workflow},
        upsert=True
    )
    
    return {"success": True}


# ============ HELPER FUNCTIONS ============

APPROVALS_LINK = "/dashboard?tab=approvals"


async def create_approval_notification(request_id: str, user_id: str, company_id: str, action: str):
    """In-app row + web push (and, for a new request, an email to the approver).
    Never raises: the approval itself is already saved."""
    try:
        from services.notify import notify, send_email
        req = await db.approval_requests.find_one({"id": request_id, "company_id": company_id}, {"_id": 0}) or {}
        what = req.get("title") or req.get("type_name_ar") or "طلب"
        amt = _num(req.get("amount"))
        money = f" — {amt:,.2f} {req.get('currency') or 'EGP'}" if amt else ""
        texts = {
            "new_request": ("طلب موافقة جديد", f"{what}{money} من {req.get('requester_name') or ''} بانتظار اعتمادك",
                            "approval_request"),
            "level_approved": ("تقدّم طلب الموافقة", f"{what}{money}: اعتُمد في المستوى الحالي",
                               "approval_level"),
            "approved": ("تم اعتماد طلبك", f"{what}{money}: تمت الموافقة بالكامل", "approval_approved"),
            "rejected": ("تم رفض طلبك", f"{what}{money}" + (f": {req['rejection_reason']}" if req.get("rejection_reason") else ""),
                         "approval_rejected"),
        }
        title, body, kind = texts.get(action, ("تحديث الموافقة", what, "approval"))
        await notify(db, company_id, [user_id], title, body, APPROVALS_LINK, kind,
                     data={"request_id": request_id, "action": action,
                           "reference_type": req.get("reference_type"), "reference_id": req.get("reference_id")})
        if action == "new_request":
            u = await db.users.find_one({"id": user_id, "company_id": company_id}, {"_id": 0, "email": 1, "full_name": 1}) or {}
            if u.get("email"):
                band = f"<p>الشريحة: {req['band_label']}</p>" if req.get("band_label") else ""
                html = f"""<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.8">
      <p>مرحباً {u.get('full_name') or ''}،</p>
      <p>طلب <b>{req.get('type_name_ar') or ''}</b> بانتظار اعتمادك: <b>{what}</b>{money}</p>
      <p>مقدم الطلب: {req.get('requester_name') or ''}</p>{band}
      <p>افتح صفحة الموافقات في DataLife Account لاعتماده أو رفضه.</p></div>"""
                await send_email([u["email"]], f"طلب موافقة: {what}{money}", html)
    except Exception:
        pass


async def _close_document(request: dict, outcome: str, reason: str = ""):
    """A rejected or cancelled request releases the document it was holding."""
    ref_type, ref_id, company_id = request.get("reference_type"), request.get("reference_id"), request.get("company_id")
    if not ref_type or not ref_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    try:
        if ref_type == "purchase_order":
            await db.purchase_orders.update_one(
                {"po_number": ref_id, "company_id": company_id, "status": "pending_approval",
                 "approval_request_id": request.get("id")},
                {"$set": {"status": "rejected" if outcome == "rejected" else "draft",
                          "approval_status": outcome, "rejection_reason": reason or None, "updated_at": now}})
        elif ref_type == "payment_voucher":
            await db.payment_vouchers.update_one(
                {"id": ref_id, "company_id": company_id, "status": "pending_approval",
                 "approval_request_id": request.get("id")},
                {"$set": {"status": outcome, "rejection_reason": reason or None, "updated_at": now}})
    except Exception:
        pass


async def execute_approval_action(request: dict, approver_id: Optional[str] = None):
    """Execute action after final approval"""
    ref_type = request.get("reference_type")
    ref_id = request.get("reference_id")
    
    if not ref_type or not ref_id:
        return
    
    company_id = request.get("company_id")
    # every update is scoped to the request's company: reference_id comes from
    # the requester and used to be matched across all companies
    if ref_type == "leave":
        await db.leaves.update_one(
            {"id": ref_id, "company_id": company_id},
            {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
        # Send email notification to employee
        try:
            leave = await db.leaves.find_one({"id": ref_id, "company_id": company_id})
            if leave:
                employee = await db.users.find_one({"id": leave.get("employee_id")})
                if employee and employee.get("email"):
                    from api.notification_events import notify_leave_decision
                    await notify_leave_decision({
                        "employee_email": employee.get("email"),
                        "employee_name": employee.get("full_name", ""),
                        "leave_type": leave.get("leave_type", "إجازة"),
                        "start_date": leave.get("start_date", ""),
                        "end_date": leave.get("end_date", ""),
                        "status": "approved",
                        "approver_name": ((request.get("approvals") or [{}])[-1].get("approver_name")
                                          or request.get("approver_name") or "المدير"),
                        "rejection_reason": None,
                    }, leave.get("company_id", ""))
        except Exception as e:
            pass  # Email failure should not block approval
    elif ref_type == "purchase_order":
        # only the request the order itself opened, and only while it waits
        await db.purchase_orders.update_one(
            {"po_number": ref_id, "company_id": company_id, "status": "pending_approval",
             "approval_request_id": request.get("id")},
            {"$set": {"status": "approved", "approval_status": "approved",
                      "approved_by": approver_id or "approval",
                      "approved_at": datetime.now(timezone.utc).isoformat()}}
        )
    elif ref_type == "payment_voucher":
        # the entry is posted only now; if it cannot be (e.g. the cash box no
        # longer covers it) the voucher says so and the requester is told
        try:
            from api.payment_vouchers import post_pending_voucher
            await post_pending_voucher(company_id, ref_id, request.get("id"), approver_id)
        except Exception as e:
            detail = getattr(e, "detail", None) or str(e)
            await db.payment_vouchers.update_one(
                {"id": ref_id, "company_id": company_id, "status": "pending_approval"},
                {"$set": {"status": "post_failed", "post_error": detail}})
            try:
                from services.notify import notify
                await notify(db, company_id, [request.get("requester_id")], "تعذّر ترحيل سند الصرف",
                             f"{ref_id}: اعتُمد لكن لم يُرحَّل — {detail}", APPROVALS_LINK,
                             "approval_rejected", data={"voucher": ref_id})
            except Exception:
                pass
    elif ref_type == "invoice":
        # approve through the invoice service so the entry is posted (and stock
        # moves); just flipping the status left an approved invoice with no entry
        inv = await db.invoices.find_one(
            {"company_id": company_id, "status": "draft",
             "$or": [{"id": ref_id}, {"document_number": ref_id}]}, {"_id": 0, "id": 1})
        if inv:
            from services.invoice_service import InvoiceService
            await InvoiceService(db).approve_invoice(inv["id"], request.get("requester_id") or "system")
