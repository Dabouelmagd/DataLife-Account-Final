"""
One way to tell people something: an in-app row in db.notifications (what
the bell reads) plus a web push to every browser they subscribed, and,
optionally, an email through Resend.

Never raises — a notification that fails must not undo the business action
that triggered it (an approved PO stays approved if the push server is down).
"""
import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Iterable, Optional

logger = logging.getLogger(__name__)

COLORS = {"approval_request": "blue", "approval_approved": "green", "approval_rejected": "red",
          "approval_level": "green", "credit_limit": "orange"}
ICONS = {"approval_request": "clipboard", "approval_approved": "clipboard-check",
         "approval_rejected": "clipboard-x", "approval_level": "clipboard-check",
         "credit_limit": "alert-circle"}


def _aliases(role: str) -> list:
    try:
        from api.approvals import ROLE_ALIASES
        return ROLE_ALIASES.get(role, [role])
    except Exception:
        return [role]


async def resolve_users(db, company_id: str, user_ids: Optional[Iterable[str]] = None,
                        roles: Optional[Iterable[str]] = None) -> list:
    """User ids from explicit ids plus every active user holding one of the roles."""
    ids = [u for u in (user_ids or []) if u]
    if roles:
        names = []
        for r in roles:
            names += _aliases(r)
        async for u in db.users.find({"company_id": company_id, "role": {"$in": names},
                                      "is_active": {"$ne": False}}, {"_id": 0, "id": 1}):
            if u.get("id"):
                ids.append(u["id"])
    return list(dict.fromkeys(ids))


async def notify(db, company_id: str, user_ids: Optional[Iterable[str]] = None,
                 title: str = "", body: str = "", link: str = "/", kind: str = "system",
                 roles: Optional[Iterable[str]] = None, data: Optional[dict] = None,
                 push: bool = True) -> list:
    """Write one db.notifications row per recipient and push it. Returns the
    recipient ids (empty on failure)."""
    try:
        recipients = await resolve_users(db, company_id, user_ids, roles)
        now = datetime.now(timezone.utc).isoformat()
        rows = []
        for uid in recipients:
            rows.append({
                "id": f"notif_{uuid.uuid4().hex[:16]}", "type": kind, "kind": kind,
                # both shapes: the bell (title/body/link) and the older
                # notifications page (title_ar/message_ar)
                "title": title, "body": body, "link": link, "url": link,
                "title_ar": title, "title_en": title, "message_ar": body, "message_en": body,
                "icon": ICONS.get(kind, "bell"), "color": COLORS.get(kind, "blue"),
                "user_id": uid, "company_id": company_id, "broadcast": False,
                "data": data or {}, "read": False, "created_at": now, "created_by": "system"})
        if rows:
            await db.notifications.insert_many([dict(r) for r in rows])
    except Exception as e:
        logger.warning(f"notify: in-app write failed: {e}")
        return []
    for r in rows:
        try:
            from api.notifications import manager
            await manager.send_personal_message({k: v for k, v in r.items() if k != "_id"}, r["user_id"])
        except Exception:
            pass
        if push:
            try:
                from api.push_notifications import push_to_devices
                await push_to_devices(db, r["user_id"], title, body, link, tag=r["id"])
            except Exception as e:
                logger.warning(f"notify: push failed: {e}")
    return recipients


async def send_email(to: Iterable[str], subject: str, html: str) -> bool:
    """Best-effort Resend email (same pattern as the portal invite); skipped
    when RESEND_API_KEY is not set."""
    to = [t for t in (to or []) if t]
    key = os.environ.get("RESEND_API_KEY", "")
    if not to or not key:
        return False
    try:
        import resend as _rs
        from services.email_service import SENDER_EMAIL
        _rs.api_key = key
        await asyncio.to_thread(_rs.Emails.send, {"from": SENDER_EMAIL, "to": to,
                                                  "subject": subject, "html": html})
        return True
    except Exception as e:
        logger.warning(f"notify: email failed: {e}")
        return False
