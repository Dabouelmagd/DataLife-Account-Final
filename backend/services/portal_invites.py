"""Employee portal invitations.

HR invites an employee from their profile: a login (role موظف) is created and
LINKED to the employee record, and a one-time activation link is issued. The
employee opens it, sees their name and company, and chooses their password.

Only a SHA-256 of the token is stored. The link is valid 7 days, works once,
and is returned to HR as well as emailed — so it can be shared on WhatsApp
when email is not delivered (the old invite reported success even when the
email failed, leaving the employee unable to log in).
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

INVITE_DAYS = 7
PORTAL_BASE = "https://datalifeaccount.com/accept-invite?token="


def _h(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now():
    return datetime.now(timezone.utc)


async def issue(db, user_id: str, company_id: str, employee_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.portal_invites.update_many({"user_id": user_id, "used": False}, {"$set": {"used": True, "superseded": True}})
    await db.portal_invites.insert_one({
        "token_hash": _h(token), "user_id": user_id, "company_id": company_id, "employee_id": employee_id,
        "created_at": _now().isoformat(), "expires_at": (_now() + timedelta(days=INVITE_DAYS)).isoformat(), "used": False})
    return token


async def lookup(db, token: str):
    if not isinstance(token, str) or len(token) < 20:
        return None
    inv = await db.portal_invites.find_one({"token_hash": _h(token)}, {"_id": 0})
    if not inv or inv.get("used") or inv.get("expires_at", "") < _now().isoformat():
        return None
    return inv


async def consume(db, token: str):
    return await db.portal_invites.find_one_and_update(
        {"token_hash": _h(token), "used": False, "expires_at": {"$gte": _now().isoformat()}},
        {"$set": {"used": True, "used_at": _now().isoformat()}})
