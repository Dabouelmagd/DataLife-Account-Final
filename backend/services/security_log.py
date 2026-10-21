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
    """The caller's address as nginx saw it.

    nginx-server.conf (host) and frontend/nginx.conf both set
    `proxy_set_header X-Real-IP $remote_addr;` and
    `X-Forwarded-For $proxy_add_x_forwarded_for;`. X-Real-IP is overwritten
    by nginx, so a client cannot choose it. The FIRST X-Forwarded-For entry
    is whatever the client sent (spoofable); the LAST one is the hop nginx
    appended. So: X-Real-IP, else the last X-Forwarded-For hop, else the
    socket peer. (This trusts nginx: the backend port must not be reachable
    from outside without it.)
    """
    try:
        if request is None:
            return ""
        real = (request.headers.get("x-real-ip") or "").strip()
        if real:
            return real[:45]
        fwd = request.headers.get("x-forwarded-for") or ""
        hops = [h.strip() for h in fwd.split(",") if h.strip()]
        if hops:
            return hops[-1][:45]
        return (request.client.host if getattr(request, "client", None) else "")[:45]
    except Exception:
        return ""


# login outcomes also go to the company's chained audit trail
_AUDITED = {LOGIN_OK: "login_ok", LOGIN_FAILED: "login_failed", LOGIN_LOCKED: "login_failed",
            TWO_FACTOR_FAILED: "login_failed", TWO_FACTOR_OK: "login_ok"}


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
    if kind in _AUDITED:
        try:
            cid, uid, name = company_id, user_id, None
            if email and (not cid or not uid):
                # failed logins carry only the e-mail typed; file them under
                # that account's company (unknown e-mails stay in security_events)
                u = await db.users.find_one({"email": email}, {"_id": 0, "id": 1, "company_id": 1, "full_name": 1})
                if u:
                    cid, uid, name = cid or u.get("company_id"), uid or u.get("id"), u.get("full_name")
            if cid:
                from services.audit_helper import log_event
                await log_event(db, cid, {"user_id": uid, "email": entry["email"], "full_name": name},
                                _AUDITED[kind], "auth", entity="user", entity_id=uid, ip=entry["ip"],
                                description=f"{kind}" + (f" — {entry['detail']}" if entry["detail"] else ""))
        except Exception:
            pass
