"""
Audit Log API - سجل التدقيق
Tracks all important operations in the system
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/audit", tags=["Audit Log"])


# ============== Models ==============

class AuditLogEntry(BaseModel):
    action: str  # create, update, delete, activate, deactivate, login, logout
    entity_type: str  # user, company, invoice, permission, settings, etc.
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    details: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: str
    action: str
    action_ar: str
    entity_type: str
    entity_type_ar: str
    entity_id: Optional[str]
    entity_name: Optional[str]
    old_values: Optional[dict]
    new_values: Optional[dict]
    details: Optional[str]
    performed_by_id: str
    performed_by_name: str
    performed_by_email: str
    company_id: Optional[str]
    company_name: Optional[str]
    ip_address: Optional[str]
    timestamp: str


# ============== Helper Functions ==============

ACTION_TRANSLATIONS = {
    "create": "إنشاء",
    "update": "تعديل",
    "delete": "حذف",
    "activate": "تفعيل",
    "deactivate": "إلغاء تفعيل",
    "login": "تسجيل دخول",
    "logout": "تسجيل خروج",
    "change_role": "تغيير الدور",
    "change_permissions": "تغيير الصلاحيات",
    "approve": "موافقة",
    "reject": "رفض",
    "export": "تصدير",
    "import": "استيراد",
}

ENTITY_TRANSLATIONS = {
    "user": "مستخدم",
    "company": "شركة",
    "invoice": "فاتورة",
    "permission": "صلاحية",
    "settings": "إعدادات",
    "employee": "موظف",
    "bank_account": "حساب بنكي",
    "bank_transaction": "حركة بنكية",
    "journal_entry": "قيد يومية",
    "product": "منتج",
    "customer": "عميل",
    "supplier": "مورد",
    "project": "مشروع",
    "payroll": "راتب",
    "attendance": "حضور",
    "leave": "إجازة",
    "report": "تقرير",
    "coupon": "كوبون",
    "subscription": "اشتراك",
}


async def log_audit(
    action: str,
    entity_type: str,
    performed_by_id: str,
    performed_by_name: str,
    performed_by_email: str,
    company_id: Optional[str] = None,
    company_name: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """Kept for existing callers. A company event goes to the single chained
    writer (services.audit_helper.log_event → audit_trail); a platform event
    with no company stays in audit_logs."""
    if company_id:
        from services.audit_helper import log_event
        desc = details if isinstance(details, str) or details is None else str(details)
        if entity_name:
            desc = f"{entity_name}" + (f" — {desc}" if desc else "")
        return await log_event(db, company_id,
                               {"user_id": performed_by_id, "full_name": performed_by_name, "email": performed_by_email},
                               action, entity_type, entity=entity_type, entity_id=entity_id,
                               old=old_values, new=new_values, ip=ip_address, description=desc)
    log_entry = {
        "id": str(uuid.uuid4()),
        "action": action,
        "action_ar": ACTION_TRANSLATIONS.get(action, action),
        "entity_type": entity_type,
        "entity_type_ar": ENTITY_TRANSLATIONS.get(entity_type, entity_type),
        "entity_id": entity_id,
        "entity_name": entity_name,
        "old_values": old_values,
        "new_values": new_values,
        "details": details,
        "performed_by_id": performed_by_id,
        "performed_by_name": performed_by_name,
        "performed_by_email": performed_by_email,
        "company_id": None,
        "company_name": company_name,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.audit_logs.insert_one(dict(log_entry))
    return log_entry


# ============== Unified reading ==============
# Rows come from three stores and are returned with ONE shape:
#   audit_trail      — the chained trail (services.audit_helper.log_event)
#   audit_logs       — older rows from several writers with different field
#                      names (performed_by / performed_by_id / user_id /
#                      created_by, entity_type / module, details / description)
#   security_events  — sign-in events (services.security_log)
# Every query is limited to the caller's company. Only a real platform admin
# (users.is_platform_admin, or the company-less "Super Admin" account created
# by /api/auth/init-super-admin) may read another company or all of them.
# `is_admin` and company roles (GM, CEO…) no longer widen the scope.

SECURITY_LOGIN_KINDS = ["login_ok", "login_failed", "login_locked", "2fa_ok", "2fa_failed", "2fa_sent"]
# these are mirrored into audit_trail by security_log.record — not listed twice
_MIRRORED = ["login_ok", "login_failed", "login_locked", "2fa_ok", "2fa_failed"]


async def _is_platform_admin(user: dict) -> bool:
    try:
        u = await db.users.find_one({"id": user.get("user_id")},
                                    {"_id": 0, "is_platform_admin": 1, "role": 1, "company_id": 1})
    except Exception:
        u = None
    if not u:
        return False
    return bool(u.get("is_platform_admin")) or (u.get("role") == "Super Admin" and not u.get("company_id"))


async def _scope(user: dict, company_id: Optional[str]) -> dict:
    """{} for a platform admin reading everything, else {"company_id": X}."""
    if await _is_platform_admin(user):
        return {"company_id": company_id} if company_id else {}
    cid = user.get("company_id")
    if not cid:
        raise HTTPException(status_code=403, detail="لا توجد شركة مرتبطة بالحساب")
    return {"company_id": cid}


def _date_range(start_date: Optional[str], end_date: Optional[str]) -> Optional[dict]:
    rng = {}
    if start_date:
        rng["$gte"] = start_date
    if end_date:
        rng["$lte"] = end_date + ("T23:59:59.999999Z" if len(end_date) == 10 else "")
    return rng or None


def _first(d: dict, *keys):
    for k in keys:
        v = d.get(k)
        if v not in (None, ""):
            return v
    return None


def _from_trail(r: dict) -> dict:
    return {"id": r.get("id"), "source": "trail", "time": r.get("timestamp"),
            "company_id": r.get("company_id"), "user_id": r.get("user_id"),
            "user_name": r.get("user_name"), "user_email": r.get("user_email"),
            "action": r.get("action"), "module": r.get("module"),
            "entity": r.get("entity") or r.get("module"), "entity_id": r.get("entity_id"),
            "ip": r.get("ip_address"), "details": r.get("description"),
            "old_value": r.get("old_value"), "new_value": r.get("new_value"),
            "seq": r.get("seq"), "chained": bool(r.get("chain_hash"))}


def _from_legacy(r: dict) -> dict:
    det = _first(r, "details", "description")
    if det is not None and not isinstance(det, str):
        det = str(det)
    if r.get("entity_name"):
        det = f"{r['entity_name']}" + (f" — {det}" if det else "")
    return {"id": r.get("id") or str(r.get("_id", "")), "source": "legacy",
            "time": _first(r, "timestamp", "created_at"),
            "company_id": r.get("company_id"),
            "user_id": _first(r, "performed_by_id", "performed_by", "user_id", "created_by"),
            "user_name": _first(r, "performed_by_name", "user_name"),
            "user_email": _first(r, "performed_by_email", "user_email"),
            "action": r.get("action"), "module": _first(r, "module", "entity_type"),
            "entity": _first(r, "entity_type", "module"), "entity_id": r.get("entity_id"),
            "ip": _first(r, "ip_address", "ip"), "details": det,
            "old_value": _first(r, "old_values", "old_value"),
            "new_value": _first(r, "new_values", "new_value"), "seq": None, "chained": False}


def _from_security(r: dict) -> dict:
    return {"id": r.get("id") or str(r.get("_id", "")), "source": "security", "time": r.get("at"),
            "company_id": r.get("company_id"), "user_id": r.get("user_id"),
            "user_name": None, "user_email": r.get("email"),
            "action": r.get("kind"), "module": "auth", "entity": "user", "entity_id": r.get("user_id"),
            "ip": r.get("ip"), "details": r.get("detail"),
            "old_value": None, "new_value": None, "seq": None, "chained": False}


async def _company_emails(scope: dict) -> list:
    if not scope.get("company_id"):
        return []
    us = await db.users.find({"company_id": scope["company_id"]}, {"_id": 0, "email": 1}).to_list(None)
    return [u["email"] for u in us if u.get("email")]


async def _security_scope(scope: dict) -> dict:
    """Failed sign-ins carry only the e-mail typed, not a company."""
    if not scope:
        return {}
    emails = await _company_emails(scope)
    ors = [{"company_id": scope["company_id"]}]
    if emails:
        ors.append({"company_id": None, "email": {"$in": emails}})
    return {"$or": ors}


async def unified_logs(user: dict, *, action=None, module=None, person=None, start_date=None,
                       end_date=None, source=None, company_id=None, limit=50, skip=0) -> dict:
    import re as _re
    scope = await _scope(user, company_id)
    limit = max(1, min(int(limit or 50), 500))
    skip = max(0, int(skip or 0))
    rng = _date_range(start_date, end_date)

    user_ids = None
    if person:
        rx = {"$regex": _re.escape(person), "$options": "i"}
        uq = {**scope, "$or": [{"full_name": rx}, {"name": rx}, {"email": rx}]}
        user_ids = [u["id"] for u in await db.users.find(uq, {"_id": 0, "id": 1}).to_list(500)]
    else:
        rx = None

    # audit_trail
    tq = dict(scope)
    if action: tq["action"] = action
    if module: tq["module"] = module
    if rng: tq["timestamp"] = rng
    if person:
        tq["$or"] = [{"user_id": {"$in": user_ids}}, {"user_name": rx}, {"user_email": rx}]
    # audit_logs (legacy)
    lq = dict(scope)
    if action: lq["action"] = action
    if module: lq["$and"] = [{"$or": [{"module": module}, {"entity_type": module}]}]
    if rng: lq["timestamp"] = rng
    if person:
        lq.setdefault("$and", []).append({"$or": [
            {"performed_by_name": rx}, {"performed_by_email": rx},
            {"performed_by_id": {"$in": user_ids}}, {"performed_by": {"$in": user_ids}},
            {"user_id": {"$in": user_ids}}, {"created_by": {"$in": user_ids}}]})
    # security_events (only kinds not mirrored into the trail)
    sq = {"$and": [await _security_scope(scope), {"kind": {"$nin": _MIRRORED}}]}
    if action: sq["$and"].append({"kind": action})
    if module and module != "auth": sq["$and"].append({"kind": "__none__"})
    if rng: sq["$and"].append({"at": rng})
    if person:
        sq["$and"].append({"$or": [{"user_id": {"$in": user_ids}}, {"email": rx}]})

    want = skip + limit
    sources = [("trail", db.audit_trail, tq, "timestamp", _from_trail),
               ("legacy", db.audit_logs, lq, "timestamp", _from_legacy),
               ("security", db.security_events, sq, "at", _from_security)]
    rows, total, by_source = [], 0, {}
    for name, coll, q, tf, norm in sources:
        if source and source != "all" and source != name:
            continue
        n = await coll.count_documents(q)
        by_source[name] = n
        total += n
        if n:
            docs = await coll.find(q, {"_id": 0}).sort(tf, -1).limit(want).to_list(want)
            rows.extend(norm(d) for d in docs)
    rows.sort(key=lambda r: str(r.get("time") or ""), reverse=True)
    rows = rows[skip:skip + limit]

    # names for rows that only carry an id
    missing = list({r["user_id"] for r in rows if r.get("user_id") and not r.get("user_name")})
    if missing:
        names = {u["id"]: u for u in await db.users.find(
            {"id": {"$in": missing}}, {"_id": 0, "id": 1, "full_name": 1, "name": 1, "email": 1}).to_list(None)}
        for r in rows:
            u = names.get(r.get("user_id"))
            if u and not r.get("user_name"):
                r["user_name"] = u.get("full_name") or u.get("name")
                r["user_email"] = r.get("user_email") or u.get("email")
    if not scope.get("company_id"):
        cids = list({r["company_id"] for r in rows if r.get("company_id")})
        cn = {c["id"]: c.get("name") for c in await db.companies.find(
            {"id": {"$in": cids}}, {"_id": 0, "id": 1, "name": 1}).to_list(None)} if cids else {}
        for r in rows:
            r["company_name"] = cn.get(r.get("company_id"))
    for r in rows:
        r["action_ar"] = ACTION_TRANSLATIONS.get(r.get("action") or "", None)
    return {"logs": rows, "total": total, "by_source": by_source, "limit": limit, "skip": skip,
            "scope": "all_companies" if not scope else "company"}


# ============== API Endpoints ==============

@router.get("/logs")
async def get_audit_logs(
    authorization: Optional[str] = Header(None),
    action: Optional[str] = None,
    module: Optional[str] = None,
    entity_type: Optional[str] = None,      # old name for module
    user: Optional[str] = None,
    performed_by: Optional[str] = None,     # old name for user
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    source: Optional[str] = None,           # all | trail | legacy | security
    company_id: Optional[str] = None,       # platform admin only
    limit: int = 50,
    skip: int = 0
):
    """سجل التدقيق الموحد — صفوف بشكل واحد من كل المخازن، لشركة المستخدم فقط."""
    cu = await get_current_user(authorization)
    if not cu:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await unified_logs(cu, action=action, module=module or entity_type, person=user or performed_by,
                              start_date=start_date, end_date=end_date, source=source,
                              company_id=company_id, limit=limit, skip=skip)


@router.get("/security-events")
async def get_security_events(
    authorization: Optional[str] = Header(None),
    status: Optional[str] = None,           # ok | failed
    user: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    company_id: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """عمليات تسجيل الدخول (ناجحة / فاشلة) مع عنوان IP والوقت."""
    import re as _re
    cu = await get_current_user(authorization)
    if not cu:
        raise HTTPException(status_code=401, detail="Not authenticated")
    scope = await _scope(cu, company_id)
    limit = max(1, min(int(limit or 50), 500))
    skip = max(0, int(skip or 0))
    kinds = {"ok": ["login_ok", "2fa_ok"], "failed": ["login_failed", "login_locked", "2fa_failed"]}.get(
        status or "", SECURITY_LOGIN_KINDS)
    q = {"$and": [await _security_scope(scope), {"kind": {"$in": kinds}}]}
    rng = _date_range(start_date, end_date)
    if rng:
        q["$and"].append({"at": rng})
    if user:
        q["$and"].append({"email": {"$regex": _re.escape(user), "$options": "i"}})
    total = await db.security_events.count_documents(q)
    docs = await db.security_events.find(q, {"_id": 0}).sort("at", -1).skip(skip).limit(limit).to_list(limit)
    rows = [{"time": d.get("at"), "kind": d.get("kind"),
             "ok": d.get("kind") in ("login_ok", "2fa_ok"),
             "email": d.get("email"), "user_id": d.get("user_id"), "ip": d.get("ip"),
             "detail": d.get("detail")} for d in docs]
    since = (datetime.now(timezone.utc) - __import__("datetime").timedelta(days=1)).isoformat()
    failed_24h = await db.security_events.count_documents(
        {"$and": [await _security_scope(scope), {"kind": {"$in": kinds_failed()}}, {"at": {"$gte": since}}]})
    return {"events": rows, "total": total, "failed_last_24h": failed_24h, "limit": limit, "skip": skip}


def kinds_failed():
    return ["login_failed", "login_locked", "2fa_failed"]


@router.get("/logs/{log_id}")
async def get_audit_log_detail(
    log_id: str,
    authorization: Optional[str] = Header(None)
):
    """Get single audit log detail (company-scoped)"""
    cu = await get_current_user(authorization)
    if not cu:
        raise HTTPException(status_code=401, detail="Not authenticated")
    scope = await _scope(cu, None)
    r = await db.audit_trail.find_one({**scope, "id": log_id}, {"_id": 0})
    if r:
        return _from_trail(r)
    r = await db.audit_logs.find_one({**scope, "id": log_id}, {"_id": 0})
    if r:
        return _from_legacy(r)
    raise HTTPException(status_code=404, detail="Log not found")


@router.get("/statistics")
async def get_audit_statistics(
    authorization: Optional[str] = Header(None),
    days: int = 30
):
    """Audit statistics for the caller's company (trail + legacy rows)."""
    cu = await get_current_user(authorization)
    if not cu:
        raise HTTPException(status_code=401, detail="Not authenticated")
    from datetime import timedelta
    scope = await _scope(cu, None)
    days = max(1, min(int(days or 30), 3650))
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {**scope, "timestamp": {"$gte": since}}
    actions, daily, users, total = {}, {}, {}, 0
    for coll, ukey in ((db.audit_trail, "user_id"), (db.audit_logs, "performed_by_name")):
        total += await coll.count_documents(q)
        for it in await coll.aggregate([{"$match": q}, {"$group": {"_id": "$action", "count": {"$sum": 1}}}]).to_list(200):
            actions[it["_id"]] = actions.get(it["_id"], 0) + it["count"]
        for it in await coll.aggregate([{"$match": q}, {"$group": {"_id": {"$substr": ["$timestamp", 0, 10]}, "count": {"$sum": 1}}}]).to_list(days + 1):
            daily[it["_id"]] = daily.get(it["_id"], 0) + it["count"]
        for it in await coll.aggregate([{"$match": q}, {"$group": {"_id": "$" + ukey, "count": {"$sum": 1}}}]).to_list(200):
            if it["_id"]:
                users[it["_id"]] = users.get(it["_id"], 0) + it["count"]
    names = {u["id"]: (u.get("full_name") or u.get("email")) for u in await db.users.find(
        {"id": {"$in": list(users)}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1}).to_list(None)}
    top = sorted(users.items(), key=lambda x: -x[1])[:10]
    return {
        "total_logs": total,
        "period_days": days,
        "actions_by_type": actions,
        "top_users": [{"name": names.get(k, k), "count": v} for k, v in top],
        "daily_activity": [{"date": k, "count": v} for k, v in sorted(daily.items())],
    }


@router.get("/actions")
async def get_available_actions():
    """Get list of available actions for filtering"""
    return {
        "actions": [
            {"key": k, "label_en": k.replace("_", " ").title(), "label_ar": v}
            for k, v in ACTION_TRANSLATIONS.items()
        ]
    }


@router.get("/entity-types")
async def get_available_entity_types():
    """Get list of available entity types for filtering"""
    return {
        "entity_types": [
            {"key": k, "label_en": k.replace("_", " ").title(), "label_ar": v}
            for k, v in ENTITY_TRANSLATIONS.items()
        ]
    }


# ══════════════════════════════════════════════
# Helper — Auto Audit Logger (used by other APIs)
# ══════════════════════════════════════════════

async def auto_audit_log(
    db_conn,
    company_id: str,
    user_id: str,
    user_name: str,
    action: str,
    entity_type: str,
    entity_id: str,
    description: str,
    old_value=None,
    new_value=None,
    metadata: dict = None
):
    """Kept for existing callers — writes through services.audit_helper.log_event."""
    from services.audit_helper import log_event
    try:
        await log_event(db_conn, company_id, {"user_id": user_id, "full_name": user_name},
                        action, entity_type, entity=entity_type, entity_id=entity_id,
                        old=old_value, new=(new_value if not metadata else {"value": new_value, "metadata": metadata}),
                        description=description)
    except Exception:
        pass  # Non-critical — never block main operation
