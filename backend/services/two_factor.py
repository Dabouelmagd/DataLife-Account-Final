"""
Two-step verification at login.

A Super Admin's password controls every company in the system, so a password
alone is not enough. When two-step is on, the password gets the user only as
far as a challenge: a six-digit code is emailed, and the access token is
issued only after the code is entered.

Only a SHA-256 of the code is stored, it expires in 10 minutes, and a
challenge is thrown away after 5 wrong tries — so a leaked password cannot be
walked through by guessing.
"""
import hashlib
import os
import secrets
import string
from datetime import datetime, timedelta, timezone

CODE_LENGTH = 6
CHALLENGE_MINUTES = 10
MAX_ATTEMPTS = 5


def _now():
    return datetime.now(timezone.utc)


def _hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def generate_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(CODE_LENGTH))


def required_for(user: dict) -> bool:
    """On for anyone who switched it on; and for platform admins when
    TWO_FACTOR_ENFORCE_ADMINS is set (they control every company)."""
    if user.get("two_factor_enabled"):
        return True
    enforce = os.environ.get("TWO_FACTOR_ENFORCE_ADMINS", "").strip().lower() in ("1", "true", "yes")
    is_admin = bool(user.get("is_platform_admin")) or user.get("role") == "Super Admin"
    return enforce and is_admin


async def start(db, user: dict) -> tuple:
    """Create a challenge. Returns (challenge_id, plain_code)."""
    await db.login_challenges.delete_many({"user_id": user["id"]})       # one live challenge
    code = generate_code()
    challenge_id = secrets.token_urlsafe(24)
    await db.login_challenges.insert_one({
        "id": challenge_id, "user_id": user["id"], "email": user.get("email"),
        "code_hash": _hash(code), "attempts": 0,
        "created_at": _now().isoformat(),
        "expires_at": (_now() + timedelta(minutes=CHALLENGE_MINUTES)).isoformat()})
    return challenge_id, code


async def verify(db, challenge_id: str, code: str):
    """(user_id, None) when correct, (None, reason) when not. Never raises."""
    if not isinstance(challenge_id, str) or not isinstance(code, str):
        return None, "بيانات غير صحيحة"
    ch = await db.login_challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not ch or ch.get("expires_at", "") < _now().isoformat():
        return None, "انتهت صلاحية رمز التحقق — سجّل الدخول من جديد"
    if ch.get("attempts", 0) >= MAX_ATTEMPTS:
        await db.login_challenges.delete_one({"id": challenge_id})
        return None, "تم تجاوز عدد المحاولات — سجّل الدخول من جديد"
    if not secrets.compare_digest(ch["code_hash"], _hash(code.strip())):
        await db.login_challenges.update_one({"id": challenge_id}, {"$inc": {"attempts": 1}})
        left = MAX_ATTEMPTS - (ch.get("attempts", 0) + 1)
        return None, f"رمز غير صحيح — تبقّى {max(left, 0)} محاولة"
    await db.login_challenges.delete_one({"id": challenge_id})            # used once
    return ch["user_id"], None


async def send_code_email(email: str, name: str, code: str) -> bool:
    """Resend, like the password-reset codes."""
    try:
        import asyncio as _aio, resend as _rs
        from services.email_service import SENDER_EMAIL
        _rs.api_key = os.environ.get("RESEND_API_KEY", "")
        if not _rs.api_key:
            return False
        html = f"""<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9">
          <p>مرحباً {name or ''},</p>
          <p>رمز تسجيل الدخول الخاص بك:</p>
          <p style="font-size:30px;font-weight:bold;letter-spacing:8px;font-family:monospace">{code}</p>
          <p style="color:#666;font-size:13px">صالح {CHALLENGE_MINUTES} دقائق. إذا لم تحاول تسجيل الدخول،
             غيّر كلمة المرور فوراً — فقد تكون معروفة لشخص آخر.</p></div>"""
        await _aio.to_thread(_rs.Emails.send, {"from": SENDER_EMAIL, "to": [email],
                                               "subject": f"رمز تسجيل الدخول: {code}", "html": html})
        return True
    except Exception:
        return False
