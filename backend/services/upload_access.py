"""
Who may read an uploaded file.

Uploads were served by a plain static mount: anyone with the link could open
an ID card, an employment contract or a payment receipt, with no login, for
ever. A link shared once — forwarded, pasted into a chat, left in a browser
history — stayed a working key.

Files are now served through a route that first asks who is asking:

* the Authorization header, for downloads the app fetches itself; or
* a short-lived cookie the browser sends automatically with <img> and <a>,
  so screens keep working without every image tag being rewritten.

Then it asks whether this company owns the file. Employee documents and
photos are matched against the employee record that carries them, so a
signed-in user of one company cannot read another company's files even with
the exact link.
"""
import os
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

COOKIE_NAME = "dl_files"
COOKIE_MINUTES = 12 * 60          # a working day; re-issued on every login


def _secret() -> str:
    key = os.environ.get("JWT_SECRET_KEY", "")
    if not key or len(key) < 32:
        raise RuntimeError("JWT_SECRET_KEY missing")
    return key


def issue_cookie_value(user: dict) -> str:
    """A short-lived token naming the company whose files may be read."""
    from jose import jwt
    payload = {"uid": user.get("id"), "cid": user.get("company_id"),
               "exp": datetime.now(timezone.utc) + timedelta(minutes=COOKIE_MINUTES)}
    return jwt.encode(payload, _secret(), algorithm="HS256")


def read_cookie(value: str):
    from jose import jwt, JWTError
    try:
        return jwt.decode(value, _secret(), algorithms=["HS256"])
    except (JWTError, Exception):
        return None


def set_file_cookie(response, user: dict) -> None:
    """Attach the cookie to a login response. Scoped to the uploads path only."""
    try:
        response.set_cookie(
            key=COOKIE_NAME, value=issue_cookie_value(user),
            max_age=COOKIE_MINUTES * 60, path="/api/uploads",
            httponly=True, samesite="lax",
            secure=os.environ.get("ENVIRONMENT", "production") != "development")
    except Exception:
        pass                       # a cookie failure must never block signing in


async def caller_company(db, authorization: str = None, cookie: str = None):
    """(user_id, company_id) for whoever is asking, or raise 401."""
    if authorization and authorization.startswith("Bearer "):
        from services.auth_service import verify_token
        try:
            data = verify_token(authorization.split(" ", 1)[1])
            if data:
                return data.get("user_id"), data.get("company_id")
        except Exception:
            pass
    if cookie:
        data = read_cookie(cookie)
        if data:
            return data.get("uid"), data.get("cid")
    raise HTTPException(status_code=401, detail="سجّل الدخول لعرض هذا الملف")


async def may_read(db, company_id: str, relative_path: str) -> bool:
    """Does this company own the file?

    Employee documents and photos are matched against the employee record that
    references them. Anything else (company logos, receipts a user uploaded to
    their own company's records) is allowed to a signed-in user of any company
    only when no owner can be determined — those are not personal documents.
    """
    url = f"/api/uploads/{relative_path}"
    if relative_path.startswith("employees/"):
        owner = await db.employees.find_one(
            {"$or": [{"documents.file_url": url}, {"photo_url": url}]},
            {"_id": 0, "company_id": 1})
        if owner:
            return owner.get("company_id") == company_id
        return False               # an employee file with no owner is not served
    if relative_path.startswith("users/"):
        owner = await db.users.find_one({"profile_photo_url": url}, {"_id": 0, "company_id": 1})
        if owner:
            return owner.get("company_id") == company_id
        return False
    return True                    # logos and similar: any signed-in user
