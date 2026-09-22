"""Per-account throttling for authentication.

The only limit used to be a global 300 requests/minute per IP, so passwords and
reset codes could be guessed against one account from many addresses:
- no lockout after failed logins;
- each reset code allowed 5 tries, but a fresh code could be requested at will,
  giving unlimited tries at a 6-digit code.
Counts are kept per account (lower-cased email), not per IP.
"""
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException


def _now():
    return datetime.now(timezone.utc)


async def _count(db, key: str, window: timedelta) -> int:
    since = (_now() - window).isoformat()
    return await db.auth_throttle.count_documents({"key": key, "at": {"$gte": since}})


async def record(db, key: str):
    await db.auth_throttle.insert_one({"key": key, "at": _now().isoformat()})
    # nothing here is looked at beyond a day: keep the collection small
    await db.auth_throttle.delete_many({"key": key, "at": {"$lt": (_now() - timedelta(days=1, minutes=5)).isoformat()}})


async def clear(db, key: str):
    await db.auth_throttle.delete_many({"key": key})


async def check(db, key: str, limit: int, window: timedelta, message: str):
    if await _count(db, key, window) >= limit:
        raise HTTPException(status_code=429, detail=message)


def k(kind: str, email: str) -> str:
    return f"{kind}:{(email or '').strip().lower()}"


LOGIN_FAILS = (10, timedelta(minutes=15), "تم إيقاف تسجيل الدخول لهذا الحساب مؤقتاً بعد محاولات متكررة — حاول بعد 15 دقيقة")
RESET_REQ_SHORT = (3, timedelta(minutes=15), "طلبت رموزاً كثيرة — انتظر 15 دقيقة قبل طلب رمز جديد")
RESET_REQ_DAY = (10, timedelta(days=1), "تم تجاوز الحد اليومي لطلبات رمز الاستعادة لهذا البريد")
OTP_FAILS_DAY = (15, timedelta(days=1), "تم تجاوز الحد اليومي لمحاولات إدخال الرمز لهذا البريد — حاول غداً")
