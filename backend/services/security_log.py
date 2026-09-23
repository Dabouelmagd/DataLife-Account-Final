"""
A record of security-relevant events.

Nothing was recorded: a failed login, a locked account, a wrong two-step code
or a refused file left no trace anywhere. After an incident there was no way
to answer "who tried, from where, and when".

Events go two places: the rotating log file on the persistent volume (so they
survive a deploy) and a `security_events` collection, so they can be read
back from a screen or a script without shell access to the server.

Never records a password, a code, a token or a file's contents — only what
happened, to whom, and from where.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger("security")

LOGIN_FAILED = "login_failed"
LOGIN_LOCKED = "login_locked"
LOGIN_OK = "login_ok"
TWO_FACTOR_SENT = "2fa_sent"
TWO_FACTOR_FAILED = "2fa_failed"
TWO_FACTOR_OK = "2fa_ok"
PASSWORD_RESET_REQUESTED = "password_reset_requested"
FILE_DENIED = "file_denied"
PERMISSION_DENIED = "permission_denied"

KEEP_DAYS = 180


def client_ip(request) -> str:
    """Behind nginx the real address is in X-Forwarded-For."""
    try:
        fwd = request.headers.get("x-forwarded-for") or ""
        if fwd:
            return fwd.split(",")[0].strip()[:45]
        return (request.client.host if request.client else "")[:45]
    except Exception:
        return ""


async def record(db, kind: str, *, email: str = None, user_id: str = None,
                 company_id: str = None, ip: str = None, detail: str = None) -> None:
    """Write the event. Never raises — logging must not break a request."""
    entry = {
        "kind": kind,
        "email": (email or "")[:160] or None,
        "user_id": user_id,
        "company_id": company_id,
        "ip": (ip or "")[:45] or None,
        "detail": (detail or "")[:300] or None,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    logger.warning("SECURITY %s | %s | ip=%s | %s",
                   kind, entry["email"] or entry["user_id"] or "-", entry["ip"] or "-", entry["detail"] or "")
    try:
        await db.security_events.insert_one(dict(entry))
    except Exception:
        pass                       # the file log still has it
