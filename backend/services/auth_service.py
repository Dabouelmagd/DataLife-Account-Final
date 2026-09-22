import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta

# ── In-memory token blacklist (revoked tokens) ──────
# For production with multiple workers, use Redis
_revoked_tokens: set = set()

def revoke_token(token: str) -> None:
    """Add token to blacklist on logout"""
    _revoked_tokens.add(token)

def is_token_revoked(token: str) -> bool:
    """Check if token has been revoked"""
    return token in _revoked_tokens
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
    
    # Verify password
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
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
    if payload.get("type") == "customer" and not allow_customer:
        return None
    return payload