import bcrypt
import hashlib
import time
from jose import JWTError, jwt
from datetime import datetime, timedelta

# ── Token revocation (logout / refresh rotation) ─────
# revoke_token() filled a set that nothing ever read: verify_token never
# checked it, so a token kept working for its full 8 hours after "logout"
# (a copied token, or one left in another browser, stayed usable). Now
# verify_token refuses revoked tokens. Kept as sha256 -> exp so the map can
# be pruned once a token would have expired anyway, and mirrored to
# db.revoked_tokens (persist_revocation / load_revocations) so a restart
# doesn't silently re-validate every logged-out token. The production
# backend is one uvicorn process; with several workers each loads the
# collection on its first authenticated request but won't see another
# worker's later logouts until restart — use a shared store (Redis) then.
_revoked_tokens: dict = {}
_loaded = False


def _h(token: str) -> str:
    return hashlib.sha256((token or "").encode()).hexdigest()


def _exp_of(token: str) -> float:
    try:
        return float(jwt.get_unverified_claims(token).get("exp") or 0) or time.time() + 8 * 3600
    except Exception:
        return time.time() + 8 * 3600


def revoke_token(token: str) -> None:
    """Refuse this token from now on (logout, or replaced by /refresh)."""
    if not token:
        return
    _revoked_tokens[_h(token)] = _exp_of(token)
    if len(_revoked_tokens) > 5000:              # drop entries past their expiry
        now = time.time()
        for k in [k for k, e in _revoked_tokens.items() if e < now]:
            _revoked_tokens.pop(k, None)


def is_token_revoked(token: str) -> bool:
    return _h(token) in _revoked_tokens


async def persist_revocation(db, token: str) -> None:
    try:
        exp = _exp_of(token)
        await db.revoked_tokens.update_one({"_id": _h(token)}, {"$set": {"exp": exp}}, upsert=True)
    except Exception:
        pass


async def load_revocations(db) -> None:
    """Once per process: reload unexpired revocations saved before a restart."""
    global _loaded
    if _loaded:
        return
    _loaded = True
    try:
        now = time.time()
        async for d in db.revoked_tokens.find({"exp": {"$gt": now}}, {"exp": 1}):
            _revoked_tokens[d["_id"]] = d["exp"]
        await db.revoked_tokens.delete_many({"exp": {"$lte": now}})
    except Exception:
        _loaded = False                          # try again on the next request
from typing import Optional
import os

# JWT settings
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
# Refuse to start without a real signing key. There used to be a fallback
# value in the source: with the variable unset, anyone could sign their own
# Super Admin token. (Production is set — 39 characters — this keeps it so.)
if (not SECRET_KEY or len(SECRET_KEY) < 32
        or SECRET_KEY in ("your-secret-key-change-in-production", "your-secret-key", "secret", "changeme")):
    raise RuntimeError("JWT_SECRET_KEY must be set to a random value of at least 32 characters")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8   # 8 hours — financial data security

def hash_password(password: str) -> str:
    """Hash a password"""
    # Convert to bytes and truncate if necessary (bcrypt has 72-byte limit)
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Generate salt and hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    # Convert to bytes and truncate if necessary
    password_bytes = plain_password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # An account with no password yet (portal invitation not activated) simply
    # fails to log in — it used to raise on None.encode() and return a 500.
    if not hashed_password or not isinstance(hashed_password, str):
        return False
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))
    except ValueError:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # jti: two tokens for the same user issued in the same second were
    # byte-identical, so revoking the replaced one on /refresh would also
    # revoke its replacement. A unique id keeps every token distinct.
    import uuid as _uuid
    to_encode.update({"exp": expire, "jti": to_encode.get("jti") or _uuid.uuid4().hex})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str, allow_customer: bool = False) -> Optional[dict]:
    """Verify and decode a JWT token — STAFF tokens by default.

    Customer-portal tokens are signed with the same key and carry the vendor's
    company_id. Staff authentication accepted them, so any portal customer could
    call staff APIs as a member of that company (ledger, payroll, other
    customers' invoices). They are now refused everywhere except where the
    portal asks for them explicitly (allow_customer=True).
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
    if is_token_revoked(token):                  # logged out / rotated by /refresh
        return None
    if payload.get("type") == "customer" and not allow_customer:
        return None
    return payload