"""
One audit writer for the whole system — services.audit_helper.log_event

Before this there were four stores with different field names (audit_logs,
audit_trail, admin_audit_logs, security_events) and only erp_core chained its
rows, with a hash that left out the IP, the old value, the module, the
description and the company, so those could be edited without a trace. Two
writes at the same moment read the same "last hash" and forked the chain, and
deleting the newest rows could not be noticed at all.

log_event() writes to `audit_trail` (hash_v = 2):

  * seq        — per-company sequence. The next number and the chain head are
                 taken together with a compare-and-swap on `audit_counters`
                 ({_id: company_id, seq, head_hash}; $inc seq only if nobody
                 moved it since we read it), so concurrent writers line up
                 one after another instead of forking.
  * chain_hash — sha256(prev_hash + canonical JSON of EVERY stored field:
                 id, seq, company_id, timestamp, user, ip, action, module,
                 entity, entity_id, description, old_value, new_value,
                 prev_hash, hash_v). Changing any of them breaks the row.
  * anchor     — `audit_anchors` {_id: company_id, seq, hash} is updated after
                 each write. verify compares the last row with the anchor, so
                 removing rows from the end is reported.

Limits (said plainly): someone with write access to the database can rewrite
the rows AND the counter AND the anchor together. Export the anchor
periodically (e.g. to a backup or e-mail) if detection must survive that.
A crash between taking a sequence number and inserting the row leaves a gap,
which verify reports as a missing row.

Never raises into the caller — an audit failure must not break the operation.
"""
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("audit")

HASH_VERSION = 2
_HASHED_FIELDS = ("id", "seq", "company_id", "timestamp", "user_id", "user_name", "user_email",
                  "ip_address", "action", "module", "entity", "entity_id", "description",
                  "old_value", "new_value", "prev_hash", "hash_v")


def _plain(v: Any) -> Any:
    """JSON round-trip so what is stored is exactly what was hashed
    (datetimes/ObjectIds become strings, tuples become lists)."""
    if v is None:
        return None
    try:
        return json.loads(json.dumps(v, default=str, ensure_ascii=False))
    except Exception:
        return str(v)


def canonical(entry: dict) -> str:
    return json.dumps({k: entry.get(k) for k in _HASHED_FIELDS}, sort_keys=True,
                      ensure_ascii=False, separators=(",", ":"), default=str)


def compute_hash(entry: dict) -> str:
    return hashlib.sha256(((entry.get("prev_hash") or "") + canonical(entry)).encode("utf-8")).hexdigest()


def _user_parts(user) -> tuple:
    if isinstance(user, dict):
        uid = user.get("user_id") or user.get("id")
        name = user.get("full_name") or user.get("name") or user.get("user_name")
        email = user.get("email")
        return uid, name, email
    return (user or None), None, None


async def _legacy_head(db, company_id: str) -> str:
    """Last hash of the old (v1) chain, so the new chain continues from it."""
    try:
        last = await db.audit_trail.find_one(
            {"company_id": company_id, "chain_hash": {"$exists": True, "$ne": ""},
             "hash_v": {"$exists": False}},
            {"_id": 0, "chain_hash": 1}, sort=[("timestamp", -1)])
        return (last or {}).get("chain_hash", "") or ""
    except Exception:
        return ""


async def _ensure_counter(db, company_id: str) -> None:
    if await db.audit_counters.find_one({"_id": company_id}) is not None:
        return
    head = await _legacy_head(db, company_id)
    try:
        await db.audit_counters.update_one(
            {"_id": company_id},
            {"$setOnInsert": {"seq": 0, "head_hash": head, "legacy_head": head}}, upsert=True)
    except Exception:
        pass                                      # another writer created it first


async def log_event(db, company_id: Optional[str], user=None, action: str = "", module: str = "",
                    entity: Optional[str] = None, entity_id: Optional[str] = None,
                    old=None, new=None, ip: Optional[str] = None,
                    description: Optional[str] = None) -> Optional[dict]:
    """Append one chained audit event. Returns the stored row, or None on failure."""
    if not company_id:
        return None
    try:
        uid, uname, uemail = _user_parts(user)
        base = {
            "company_id": company_id,
            "user_id": uid,
            "user_name": (uname or None),
            "user_email": (uemail or None),
            "ip_address": (ip or "")[:45] or None,
            "action": str(action or "")[:120],
            "module": str(module or "")[:80],
            "entity": (str(entity)[:80] if entity else None),
            "entity_id": (str(entity_id)[:120] if entity_id else None),
            "description": (str(description)[:1000] if description else None),
            "old_value": _plain(old),
            "new_value": _plain(new),
            "hash_v": HASH_VERSION,
        }
        await _ensure_counter(db, company_id)
        for _ in range(100):
            counter = await db.audit_counters.find_one({"_id": company_id}) or {}
            seq, head = int(counter.get("seq", 0)), counter.get("head_hash", "") or ""
            entry = {**base, "id": str(uuid.uuid4()), "seq": seq + 1, "prev_hash": head,
                     "timestamp": datetime.now(timezone.utc).isoformat()}
            entry["chain_hash"] = compute_hash(entry)
            # compare-and-swap: take seq+1 only if nobody wrote since we read
            claimed = await db.audit_counters.find_one_and_update(
                {"_id": company_id, "seq": seq, "head_hash": head},
                {"$inc": {"seq": 1}, "$set": {"head_hash": entry["chain_hash"]}})
            if claimed:
                break
        else:
            raise RuntimeError("audit counter busy")
        await db.audit_trail.insert_one(dict(entry))
        await db.audit_anchors.update_one(
            {"_id": company_id, "$or": [{"seq": {"$lt": entry["seq"]}}, {"seq": {"$exists": False}}]},
            {"$set": {"seq": entry["seq"], "hash": entry["chain_hash"], "at": entry["timestamp"]}})
        if await db.audit_anchors.find_one({"_id": company_id}) is None:
            try:
                await db.audit_anchors.insert_one({"_id": company_id, "seq": entry["seq"],
                                                   "hash": entry["chain_hash"], "at": entry["timestamp"]})
            except Exception:
                pass
        return entry
    except Exception as e:                       # never break the request
        logger.error("audit log_event failed: %s", e)
        return None


# ── verification ──────────────────────────────────────────────

def legacy_hash(entry: dict, prev_hash: str = "") -> str:
    """The v1 formula (erp_core before hash_v 2) — only id, time, user,
    action, entity_id and new_value were covered."""
    payload = json.dumps({
        "id": entry.get("id"), "timestamp": entry.get("timestamp"), "user_id": entry.get("user_id"),
        "action": entry.get("action"), "entity_id": entry.get("entity_id"),
        "new_value": str(entry.get("new_value", "")), "prev_hash": prev_hash,
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()


async def verify_chain(db, company_id: str, limit: int = 20000) -> dict:
    problems = []

    # legacy (v1) segment — checked with the old formula, reported apart
    legacy = await db.audit_trail.find(
        {"company_id": company_id, "chain_hash": {"$exists": True, "$ne": ""}, "hash_v": {"$exists": False}},
        {"_id": 0}).sort("timestamp", 1).limit(limit).to_list(None)
    legacy_issues, prev = [], None
    for e in legacy:
        computed = legacy_hash(e, e.get("prev_hash", ""))
        p = None
        if computed != e.get("chain_hash", ""):
            p = "محتوى السجل تغيَّر"
        elif prev is not None and e.get("prev_hash", "") != prev:
            p = "سجل سابق محذوف أو مُعاد ترتيبه"
        if p:
            legacy_issues.append({"entry_id": e.get("id"), "timestamp": e.get("timestamp"), "action": e.get("action"),
                                  "problem": p, "segment": "legacy", "stored_hash": e.get("chain_hash", ""),
                                  "computed_hash": computed})
        prev = e.get("chain_hash", "")

    # current (v2) chain — by seq
    rows = await db.audit_trail.find({"company_id": company_id, "hash_v": HASH_VERSION},
                                     {"_id": 0}).sort("seq", 1).limit(limit).to_list(None)
    counter = await db.audit_counters.find_one({"_id": company_id}) or {}
    anchor = await db.audit_anchors.find_one({"_id": company_id}) or {}
    expected_prev = counter.get("legacy_head", "") if counter else ""
    expected_seq = 1
    for e in rows:
        computed = compute_hash(e)
        p = None
        if computed != e.get("chain_hash"):
            p = "محتوى السجل تغيَّر"
        elif e.get("seq") != expected_seq or e.get("prev_hash", "") != expected_prev:
            p = "سجل سابق محذوف أو مُعاد ترتيبه"
        if p:
            problems.append({"entry_id": e.get("id"), "seq": e.get("seq"), "timestamp": e.get("timestamp"),
                             "action": e.get("action"), "problem": p, "segment": "current",
                             "stored_hash": e.get("chain_hash", ""), "computed_hash": computed})
        expected_seq = (e.get("seq") or 0) + 1
        expected_prev = e.get("chain_hash", "")

    last = rows[-1] if rows else None
    if anchor and len(rows) < limit:
        if not last or anchor.get("seq") != last.get("seq") or anchor.get("hash") != last.get("chain_hash"):
            problems.append({"entry_id": None, "seq": anchor.get("seq"), "timestamp": anchor.get("at"),
                             "action": "-", "segment": "current",
                             "problem": "سجلات محذوفة من نهاية السجل (آخر سجل لا يطابق نقطة الإثبات)",
                             "stored_hash": anchor.get("hash", ""),
                             "computed_hash": (last or {}).get("chain_hash", "")})

    all_issues = problems + legacy_issues
    return {
        "entries_checked": len(rows) + len(legacy),
        "current_checked": len(rows),
        "legacy_checked": len(legacy),
        "chain_intact": not all_issues,
        "current_intact": not problems,
        "legacy_intact": not legacy_issues,
        "anchor": {"seq": anchor.get("seq"), "hash": anchor.get("hash"), "at": anchor.get("at")} if anchor else None,
        "tampered_entries": all_issues,
        "legacy_note": ("السجلات القديمة (قبل تحديث السلسلة) تُفحص بالصيغة القديمة التي لم تكن تشمل "
                        "عنوان IP والقيمة السابقة والوصف والموديول — تعديل هذه الحقول فيها لا يُكتشف.")
                       if legacy else None,
        "message": "سلسلة التدقيق سليمة" if not all_issues else f"{len(all_issues)} ملاحظة على السجل",
    }


# ── kept for existing callers ─────────────────────────────────

async def log_financial_action(
    user_id: str,
    company_id: str,
    action: str,
    module: str,
    entity_id: str = None,
    details: str = None,
    old_value: dict = None,
    new_value: dict = None,
    ip: str = None,
):
    """Old entry point (imported by sales/invoices/payroll…) — now a thin
    wrapper over log_event so it lands in the chained trail."""
    from database import db
    return await log_event(db, company_id, user_id, action, module, entity=module, entity_id=entity_id,
                           old=old_value, new=new_value, ip=ip, description=details)
