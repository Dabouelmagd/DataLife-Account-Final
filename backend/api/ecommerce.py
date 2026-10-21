"""
استقبال طلبات المتاجر الإلكترونية — Shopify / WooCommerce / سلة / ربط عام
E-commerce order intake.

A store (connection) posts its order webhooks to
    POST /api/ecommerce/webhook/{connection_id}
which is public (no login): it is authenticated by the HMAC signature of the
raw body with the connection's webhook secret. The receiver only verifies,
claims the order (unique company_id + platform + external_order_id) and
answers 200; the order is processed in the background:

    received → invoiced → paid → eta_submitted
             ↘ needs_mapping (a SKU has no product)   ↘ error (with the text)
    cancelled — cancelled before an invoice existed

Processing goes through InvoiceService exactly as POST /api/invoice/ and
POST /api/invoice/{id}/approve do (create_invoice → approve_invoice, which
posts revenue/VAT, takes the goods out of stock and posts COGS), and
POST /api/invoice/payments (record_payment) for paid orders. Every step is
resumable: the invoice id is saved on the order as soon as it exists, so a
retry approves/pays it instead of creating a second one.

Cancellations and refunds are recorded and flagged for a manual credit note;
nothing is reversed automatically.
"""
import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from database import db
from dependencies import get_current_user

logger = logging.getLogger("ecommerce")
router = APIRouter(prefix="/api/ecommerce", tags=["ecommerce"])

PLATFORMS = ("shopify", "woocommerce", "salla", "generic")
PUBLIC_BASE = os.environ.get("PUBLIC_BASE_URL", "https://datalifeaccount.com").rstrip("/")
MAX_BODY = 2 * 1024 * 1024          # a large Shopify order is ~100 KB
LOCK_MINUTES = 5

TOP_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام",
             "المدير العام", "CEO", "المدير التنفيذي", "owner", "Super Admin"}
MANAGE_ROLES = TOP_ROLES | {"Financial Manager", "المدير المالي", "Chief Accountant", "رئيس الحسابات"}
VIEW_ROLES = MANAGE_ROLES | {"Accountant", "محاسب"}

STATUSES = ("received", "invoiced", "paid", "eta_submitted", "needs_mapping", "error", "cancelled")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _need(user: dict, roles: set):
    if user.get("role") not in roles:
        raise HTTPException(status_code=403, detail="ربط المتاجر الإلكترونية متاح للإدارة العليا والإدارة المالية فقط")


def _webhook_url(connection_id: str) -> str:
    return f"{PUBLIC_BASE}/api/ecommerce/webhook/{connection_id}"


_indexes_ready = False


async def _ensure_indexes():
    """The unique key is what makes a webhook delivered twice create one
    invoice: the receiver inserts the claim first and a duplicate fails."""
    global _indexes_ready
    if _indexes_ready:
        return
    await db.ecommerce_orders.create_index(
        [("company_id", 1), ("platform", 1), ("external_order_id", 1)],
        unique=True, name="ecommerce_order_once")
    await db.ecommerce_orders.create_index([("company_id", 1), ("status", 1)])
    await db.ecommerce_connections.create_index([("id", 1)], unique=True)
    _indexes_ready = True


# ══════════════════════════════════════════════════════════════
# Secrets
# ══════════════════════════════════════════════════════════════

def _seal(secret: str) -> str:
    from services.eta_signer import encrypt
    return encrypt(secret.encode("utf-8"))


def _unseal(token: str) -> str:
    from services.eta_signer import decrypt
    return decrypt(token).decode("utf-8")


def _new_secret() -> str:
    return secrets.token_urlsafe(32)


def _secret_from(given: Optional[str]) -> str:
    """A secret pasted from the platform (Shopify/Salla make their own), or a new one."""
    given = (given or "").strip()
    if given and len(given) < 8:
        raise HTTPException(status_code=400, detail="مفتاح التوقيع قصير جداً")
    return given or _new_secret()


def _public(conn: dict) -> dict:
    out = {k: v for k, v in conn.items() if k not in ("_id", "webhook_secret_enc")}
    out["webhook_url"] = _webhook_url(conn["id"])
    out["has_secret"] = bool(conn.get("webhook_secret_enc"))
    return out


# ══════════════════════════════════════════════════════════════
# Signature verification (raw body)
# ══════════════════════════════════════════════════════════════

def _b64_hmac(secret: str, body: bytes) -> str:
    return base64.b64encode(hmac.new(secret.encode("utf-8"), body, hashlib.sha256).digest()).decode()


def _hex_hmac(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _same(a: str, b: str) -> bool:
    return bool(a) and bool(b) and hmac.compare_digest(a.strip().encode(), b.strip().encode())


def verify_signature(platform: str, secret: str, body: bytes, headers) -> bool:
    """True when the request was signed with this connection's secret.

    shopify      X-Shopify-Hmac-Sha256 = base64(HMAC-SHA256(secret, raw body)).
                 The secret is the one Shopify shows under Settings →
                 Notifications → Webhooks (or the app's client secret), so it
                 must be pasted into the connection, not generated here.
    woocommerce  X-WC-Webhook-Signature = base64(HMAC-SHA256(secret, raw body)).
                 The secret is whatever is typed in the Woo webhook form — ours.
    salla        UNCERTAIN — written from Salla's docs as remembered:
                 "Signature" strategy sends X-Salla-Signature = hex(HMAC-SHA256
                 (secret, raw body)); "Token" strategy sends
                 Authorization: Bearer <secret> (some setups send the bare token).
                 Both are accepted. Verify against a live Salla delivery before
                 relying on it.
    generic      X-Signature = hex(HMAC-SHA256(secret, raw body)), optional
                 "sha256=" prefix.
    """
    if not secret:
        return False
    if platform == "shopify":
        return _same(headers.get("x-shopify-hmac-sha256", ""), _b64_hmac(secret, body))
    if platform == "woocommerce":
        return _same(headers.get("x-wc-webhook-signature", ""), _b64_hmac(secret, body))
    if platform == "salla":
        sig = headers.get("x-salla-signature", "")
        if sig:
            return _same(sig.lower(), _hex_hmac(secret, body))
        token = headers.get("authorization", "")
        if token.lower().startswith("bearer "):
            token = token[7:]
        return _same(token, secret)
    if platform == "generic":
        sig = headers.get("x-signature", "")
        if sig.lower().startswith("sha256="):
            sig = sig[7:]
        return _same(sig.lower(), _hex_hmac(secret, body))
    return False


_WOO_PING = re.compile(rb"^webhook_id=\d+$")


def _is_woo_ping(body: bytes, headers) -> bool:
    """WooCommerce posts `webhook_id=<n>` (form-encoded, unsigned) once when the
    webhook is saved, to check the URL answers. Answer 200, create nothing."""
    return not headers.get("x-wc-webhook-signature") and bool(_WOO_PING.match(body.strip()))


async def _read_body(request: Request) -> bytes:
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BODY:
        raise HTTPException(status_code=413, detail="payload too large")
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BODY:
            raise HTTPException(status_code=413, detail="payload too large")
        chunks.append(chunk)
    return b"".join(chunks)


# ══════════════════════════════════════════════════════════════
# Payload normalisation
# ══════════════════════════════════════════════════════════════

def _f(v, default=0.0) -> float:
    try:
        if isinstance(v, dict):
            v = v.get("amount")
        return float(v) if v not in (None, "") else default
    except (TypeError, ValueError):
        return default


def _name(*parts) -> str:
    return " ".join(str(p).strip() for p in parts if p and str(p).strip())


def _date(v) -> str:
    if isinstance(v, dict):
        v = v.get("date")
    s = str(v or "")[:10]
    return s if re.match(r"^\d{4}-\d{2}-\d{2}$", s) else datetime.now(timezone.utc).date().isoformat()


def _shopify(topic: str, p: dict):
    if topic == "refunds/create":
        return "refund", {"external_id": str(p.get("order_id") or "")}
    if topic not in ("orders/create", "orders/paid", "orders/updated", "orders/cancelled"):
        return "ignore", None
    cust = p.get("customer") or {}
    addr = p.get("billing_address") or p.get("shipping_address") or {}
    order = {
        "external_id": str(p.get("id") or ""),
        "number": str(p.get("name") or p.get("order_number") or p.get("id") or ""),
        "currency": p.get("currency") or "EGP",
        "date": _date(p.get("created_at")),
        "paid": p.get("financial_status") == "paid",
        "prices_include_tax": bool(p.get("taxes_included")),
        "customer": {"name": _name(cust.get("first_name"), cust.get("last_name")) or addr.get("name") or "",
                     "email": (p.get("email") or cust.get("email") or "").strip().lower(),
                     "phone": p.get("phone") or cust.get("phone") or addr.get("phone") or ""},
        "lines": [],
        "shipping": sum(_f(s.get("discounted_price", s.get("price"))) for s in (p.get("shipping_lines") or [])),
        "total": _f(p.get("total_price")),
    }
    for li in p.get("line_items") or []:
        allocs = li.get("discount_allocations")
        disc = sum(_f(a.get("amount")) for a in allocs) if allocs else _f(li.get("total_discount"))
        order["lines"].append({"sku": (li.get("sku") or "").strip(), "name": li.get("title") or li.get("name") or "",
                               "quantity": _f(li.get("quantity")), "unit_price": _f(li.get("price")),
                               "discount": disc})
    if topic == "orders/cancelled" or p.get("cancelled_at") or p.get("financial_status") == "voided":
        return "cancel", order
    if p.get("financial_status") == "refunded":
        return "refund", order
    return "order", order


def _woocommerce(topic: str, p: dict):
    status = p.get("status") or ""
    if topic == "order.deleted":
        return "cancel", {"external_id": str(p.get("id") or "")}
    if topic not in ("order.created", "order.updated", "order.restored", ""):
        return "ignore", None
    if status in ("cancelled", "failed"):
        return "cancel", {"external_id": str(p.get("id") or "")}
    if status == "refunded":
        return "refund", {"external_id": str(p.get("id") or "")}
    if status in ("pending", "checkout-draft", "draft", "trash"):
        return "ignore", None          # not placed yet (often abandoned) — wait for processing/on-hold
    bill = p.get("billing") or {}
    order = {
        "external_id": str(p.get("id") or ""),
        "number": str(p.get("number") or p.get("id") or ""),
        "currency": p.get("currency") or "EGP",
        "date": _date(p.get("date_created")),
        "paid": bool(p.get("date_paid")) or status in ("processing", "completed"),
        # Woo line subtotal/total are always before tax, whatever the store shows
        "prices_include_tax": False,
        "customer": {"name": _name(bill.get("first_name"), bill.get("last_name")) or bill.get("company") or "",
                     "email": (bill.get("email") or "").strip().lower(), "phone": bill.get("phone") or ""},
        "lines": [],
        "shipping": _f(p.get("shipping_total")),
        "total": _f(p.get("total")),
    }
    for li in p.get("line_items") or []:
        qty = _f(li.get("quantity"))
        sub, tot = _f(li.get("subtotal")), _f(li.get("total"))
        order["lines"].append({"sku": (li.get("sku") or "").strip(), "name": li.get("name") or "",
                               "quantity": qty, "unit_price": round(sub / qty, 4) if qty else 0.0,
                               "discount": round(max(sub - tot, 0.0), 2)})
    return "order", order


def _salla(topic: str, p: dict):
    """UNCERTAIN field names — Salla wraps the order in `data`; amounts are
    {"amount": x, "currency": "SAR"} objects. Checked against docs from
    memory only."""
    d = p.get("data") or {}
    ev = topic or p.get("event") or ""
    if ev in ("order.cancelled", "order.deleted"):
        return "cancel", {"external_id": str(d.get("id") or "")}
    if ev == "order.refunded":
        return "refund", {"external_id": str(d.get("id") or "")}
    if not ev.startswith("order.") or ev in ("order.shipment.created", "order.shipping.address.updated"):
        return "ignore", None
    status = ((d.get("status") or {}).get("slug") if isinstance(d.get("status"), dict) else d.get("status")) or ""
    if status in ("canceled", "cancelled"):
        return "cancel", {"external_id": str(d.get("id") or "")}
    if status in ("payment_pending", "pending_payment"):
        return "ignore", None
    amounts = d.get("amounts") or {}
    cust = d.get("customer") or {}
    pm = str(d.get("payment_method") or "").lower()
    order = {
        "external_id": str(d.get("id") or ""),
        "number": str(d.get("reference_id") or d.get("id") or ""),
        "currency": d.get("currency") or (amounts.get("total") or {}).get("currency") or "SAR",
        "date": _date(d.get("date")),
        # online methods are captured at checkout; cash on delivery is paid later
        "paid": bool(d.get("is_paid")) or (pm not in ("", "cod", "cash_on_delivery") and status != "payment_pending"),
        "prices_include_tax": False,
        "customer": {"name": _name(cust.get("first_name"), cust.get("last_name")) or cust.get("name") or "",
                     "email": (cust.get("email") or "").strip().lower(),
                     "phone": _name(cust.get("mobile_code"), cust.get("mobile"))},
        "lines": [],
        "shipping": _f(amounts.get("shipping_cost")),
        "total": _f(amounts.get("total")),
    }
    for li in d.get("items") or []:
        am = li.get("amounts") or {}
        order["lines"].append({"sku": (li.get("sku") or "").strip(), "name": li.get("name") or "",
                               "quantity": _f(li.get("quantity")),
                               "unit_price": _f(am.get("price_without_tax") or li.get("price")),
                               "discount": _f(am.get("total_discount"))})
    return "order", order


def _generic(topic: str, p: dict):
    """Our own documented format:
    {"event": "order.created" | "order.paid" | "order.cancelled" | "order.refunded",
     "order": {"id", "number", "currency", "date", "paid", "prices_include_tax",
               "customer": {"name", "email", "phone"},
               "lines": [{"sku", "name", "quantity", "unit_price", "discount"}],
               "shipping", "total"}}"""
    ev = topic or p.get("event") or "order.created"
    o = p.get("order") or {}
    if ev == "order.cancelled":
        return "cancel", {"external_id": str(o.get("id") or "")}
    if ev == "order.refunded":
        return "refund", {"external_id": str(o.get("id") or "")}
    if ev not in ("order.created", "order.paid", "order.updated"):
        return "ignore", None
    c = o.get("customer") or {}
    return "order", {
        "external_id": str(o.get("id") or ""), "number": str(o.get("number") or o.get("id") or ""),
        "currency": o.get("currency") or "EGP", "date": _date(o.get("date")),
        "paid": bool(o.get("paid")), "prices_include_tax": bool(o.get("prices_include_tax")),
        "customer": {"name": c.get("name") or "", "email": (c.get("email") or "").strip().lower(),
                     "phone": c.get("phone") or ""},
        "lines": [{"sku": str(li.get("sku") or "").strip(), "name": li.get("name") or "",
                   "quantity": _f(li.get("quantity")), "unit_price": _f(li.get("unit_price")),
                   "discount": _f(li.get("discount"))} for li in (o.get("lines") or [])],
        "shipping": _f(o.get("shipping")), "total": _f(o.get("total")),
    }


def normalize(platform: str, topic: str, payload: dict):
    """(kind, order) — kind is order | cancel | refund | ignore."""
    fn = {"shopify": _shopify, "woocommerce": _woocommerce, "salla": _salla, "generic": _generic}[platform]
    return fn(topic or "", payload if isinstance(payload, dict) else {})


def _topic(platform: str, headers, payload: dict) -> str:
    if platform == "shopify":
        return headers.get("x-shopify-topic", "")
    if platform == "woocommerce":
        return headers.get("x-wc-webhook-topic", "")
    return (payload.get("event") if isinstance(payload, dict) else "") or headers.get("x-event", "")


# ══════════════════════════════════════════════════════════════
# Connections (login + top/finance roles)
# ══════════════════════════════════════════════════════════════

class ConnectionIn(BaseModel):
    name: str
    platform: str
    shop_domain: Optional[str] = ""
    # Shopify / Salla generate the signing secret on their side: paste it here.
    # Empty → a secret is generated (WooCommerce / generic), shown once.
    webhook_secret: Optional[str] = None
    customer_mode: str = "auto"              # auto: party per customer email | default: always default_party_id
    default_party_id: Optional[str] = None   # walk-in web customer
    warehouse_id: str = "main"
    payment_account_id: Optional[str] = None  # bank/cash/clearing account (id or code)
    payment_method: str = "credit_card"
    shipping_tax_rate: float = 14.0
    auto_submit_eta: bool = False
    is_active: bool = True
    sku_map: Dict[str, str] = {}             # store SKU → product code


class ConnectionUpdate(BaseModel):
    name: Optional[str] = None
    shop_domain: Optional[str] = None
    customer_mode: Optional[str] = None
    default_party_id: Optional[str] = None
    warehouse_id: Optional[str] = None
    payment_account_id: Optional[str] = None
    payment_method: Optional[str] = None
    shipping_tax_rate: Optional[float] = None
    auto_submit_eta: Optional[bool] = None
    is_active: Optional[bool] = None


class SecretIn(BaseModel):
    webhook_secret: Optional[str] = None


class SkuMapIn(BaseModel):
    sku_map: Dict[str, str]


async def _own_connection(company_id: str, connection_id: str) -> dict:
    conn = await db.ecommerce_connections.find_one({"id": connection_id, "company_id": company_id}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=404, detail="الربط غير موجود")
    return conn


async def _check_refs(company_id: str, data: dict) -> dict:
    """Party, warehouse, payment account and mapped products must be this
    company's — otherwise a web order could post to another tenant's books."""
    out = {}
    if data.get("platform") is not None and data["platform"] not in PLATFORMS:
        raise HTTPException(status_code=400, detail="المنصة غير مدعومة")
    if data.get("customer_mode") is not None and data["customer_mode"] not in ("auto", "default"):
        raise HTTPException(status_code=400, detail="customer_mode: auto أو default")
    if data.get("payment_method") is not None:
        from models.invoice import PaymentMethod
        try:
            PaymentMethod(data["payment_method"])
        except ValueError:
            raise HTTPException(status_code=400, detail="طريقة الدفع غير معروفة")
    if data.get("default_party_id"):
        if not await db.parties.find_one({"id": data["default_party_id"], "company_id": company_id,
                                          "party_type": "customer"}, {"_id": 1}):
            raise HTTPException(status_code=400, detail="العميل الافتراضي غير موجود في هذه الشركة")
    if data.get("customer_mode") == "default" and not data.get("default_party_id"):
        raise HTTPException(status_code=400, detail="اختر العميل الافتراضي لطلبات المتجر")
    wh = data.get("warehouse_id")
    if wh and wh != "main" and not await db.warehouses.find_one({"id": wh, "company_id": company_id}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="المخزن غير موجود في هذه الشركة")
    acc_ref = data.get("payment_account_id")
    if acc_ref:
        acc = await db.chart_of_accounts.find_one(
            {"company_id": company_id, "$or": [{"id": acc_ref}, {"account_code": acc_ref}]}, {"_id": 0})
        if not acc or acc.get("is_header"):
            raise HTTPException(status_code=400, detail="حساب التحصيل غير موجود أو حساب رئيسي لا يقبل الترحيل")
        out["payment_account_id"] = acc["id"]
        out["payment_account_code"] = acc.get("account_code")
        out["payment_account_name"] = acc.get("account_name")
    if data.get("sku_map"):
        out["sku_map"] = await _check_sku_map(company_id, data["sku_map"])
    return out


async def _check_sku_map(company_id: str, sku_map: Dict[str, str]) -> Dict[str, str]:
    clean = {str(k).strip(): str(v).strip() for k, v in (sku_map or {}).items() if str(k).strip() and str(v).strip()}
    if not clean:
        return {}
    codes = set(clean.values())
    found = {p["code"] for p in await db.products.find(
        {"company_id": company_id, "code": {"$in": list(codes)}}, {"_id": 0, "code": 1}).to_list(None)}
    missing = sorted(codes - found)
    if missing:
        raise HTTPException(status_code=400, detail="أكواد أصناف غير موجودة: " + "، ".join(missing[:20]))
    return clean


@router.get("/connections")
async def list_connections(current_user: dict = Depends(get_current_user)):
    _need(current_user, VIEW_ROLES)
    rows = await db.ecommerce_connections.find({"company_id": current_user["company_id"]}, {"_id": 0}).to_list(200)
    return {"connections": [_public(r) for r in rows]}


@router.post("/connections")
async def create_connection(body: ConnectionIn, current_user: dict = Depends(get_current_user)):
    _need(current_user, MANAGE_ROLES)
    cid = current_user["company_id"]
    data = body.dict()
    refs = await _check_refs(cid, data)
    secret = _secret_from(body.webhook_secret)
    conn = {k: v for k, v in data.items() if k != "webhook_secret"}
    conn.update(refs)
    conn.update({"id": str(uuid.uuid4()), "company_id": cid, "shop_domain": (body.shop_domain or "").strip().lower(),
                 "webhook_secret_enc": _seal(secret), "secret_provided": bool(body.webhook_secret),
                 "created_by": current_user["user_id"], "created_at": _now(), "updated_at": _now()})
    await _ensure_indexes()
    await db.ecommerce_connections.insert_one(dict(conn))
    # the secret is returned this once and never again
    return {"message": "تم إنشاء الربط — انسخ الرابط والمفتاح الآن، لن يظهر المفتاح مرة أخرى",
            "connection": _public(conn), "webhook_url": _webhook_url(conn["id"]), "webhook_secret": secret}


@router.put("/connections/{connection_id}")
async def update_connection(connection_id: str, body: ConnectionUpdate, current_user: dict = Depends(get_current_user)):
    _need(current_user, MANAGE_ROLES)
    cid = current_user["company_id"]
    conn = await _own_connection(cid, connection_id)
    changes = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None or k == "default_party_id"}
    merged = {**conn, **changes}
    check = {k: merged.get(k) for k in ("customer_mode", "default_party_id", "warehouse_id", "payment_method")}
    check["payment_account_id"] = changes.get("payment_account_id")
    refs = await _check_refs(cid, check)
    changes.update(refs)
    if "shop_domain" in changes:
        changes["shop_domain"] = (changes["shop_domain"] or "").strip().lower()
    changes["updated_at"] = _now()
    await db.ecommerce_connections.update_one({"id": connection_id, "company_id": cid}, {"$set": changes})
    return {"connection": _public({**conn, **changes})}


@router.put("/connections/{connection_id}/sku-map")
async def set_sku_map(connection_id: str, body: SkuMapIn, current_user: dict = Depends(get_current_user)):
    _need(current_user, MANAGE_ROLES)
    cid = current_user["company_id"]
    await _own_connection(cid, connection_id)
    clean = await _check_sku_map(cid, body.sku_map)
    await db.ecommerce_connections.update_one({"id": connection_id, "company_id": cid},
                                              {"$set": {"sku_map": clean, "updated_at": _now()}})
    return {"sku_map": clean}


@router.post("/connections/{connection_id}/rotate-secret")
async def rotate_secret(connection_id: str, body: SecretIn, current_user: dict = Depends(get_current_user)):
    _need(current_user, MANAGE_ROLES)
    cid = current_user["company_id"]
    await _own_connection(cid, connection_id)
    secret = _secret_from(body.webhook_secret)
    await db.ecommerce_connections.update_one({"id": connection_id, "company_id": cid}, {"$set": {
        "webhook_secret_enc": _seal(secret), "secret_provided": bool(body.webhook_secret),
        "secret_rotated_at": _now(), "updated_at": _now()}})
    return {"webhook_url": _webhook_url(connection_id), "webhook_secret": secret,
            "message": "تم تغيير المفتاح — حدّثه في إعدادات المتجر الآن"}


@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str, current_user: dict = Depends(get_current_user)):
    """Stops intake. Orders already received (and their invoices) stay."""
    _need(current_user, MANAGE_ROLES)
    cid = current_user["company_id"]
    await _own_connection(cid, connection_id)
    await db.ecommerce_connections.delete_one({"id": connection_id, "company_id": cid})
    return {"message": "تم حذف الربط"}


# ══════════════════════════════════════════════════════════════
# Orders (login)
# ══════════════════════════════════════════════════════════════

@router.get("/orders")
async def list_orders(status: Optional[str] = Query(None), connection_id: Optional[str] = Query(None),
                      needs_credit_note: Optional[bool] = Query(None), limit: int = Query(200, le=1000),
                      current_user: dict = Depends(get_current_user)):
    _need(current_user, VIEW_ROLES)
    q = {"company_id": current_user["company_id"]}
    if status:
        q["status"] = status
    if connection_id:
        q["connection_id"] = connection_id
    if needs_credit_note is not None:
        q["needs_credit_note"] = needs_credit_note
    rows = await db.ecommerce_orders.find(q, {"_id": 0}).sort("received_at", -1).to_list(limit)
    counts = {}
    for r in await db.ecommerce_orders.find({"company_id": current_user["company_id"]},
                                            {"_id": 0, "status": 1}).to_list(None):
        counts[r.get("status")] = counts.get(r.get("status"), 0) + 1
    return {"orders": rows, "counts": counts}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    _need(current_user, VIEW_ROLES)
    o = await db.ecommerce_orders.find_one({"id": order_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    return o


@router.post("/orders/{order_id}/retry")
async def retry_order(order_id: str, current_user: dict = Depends(get_current_user)):
    """Runs the pipeline again from where it stopped (after fixing a SKU
    mapping, an account, the ETA settings...). Never creates a second invoice."""
    _need(current_user, VIEW_ROLES)
    cid = current_user["company_id"]
    o = await db.ecommerce_orders.find_one({"id": order_id, "company_id": cid}, {"_id": 0})
    if not o:
        raise HTTPException(status_code=404, detail="الطلب غير موجود")
    if o.get("status") in ("eta_submitted", "cancelled"):
        raise HTTPException(status_code=400, detail="لا يوجد ما يُعاد تنفيذه لهذا الطلب")
    await db.ecommerce_orders.update_one({"id": order_id, "company_id": cid},
                                         {"$set": {"processing_until": None},
                                          "$push": {"events": {"at": _now(), "event": "retry",
                                                               "by": current_user.get("email")}}})
    await process_order(cid, order_id)
    return await db.ecommerce_orders.find_one({"id": order_id, "company_id": cid}, {"_id": 0})


# ══════════════════════════════════════════════════════════════
# Public receiver — authenticated by the HMAC signature only
# ══════════════════════════════════════════════════════════════

async def _load_connection(connection_id: str) -> Optional[dict]:
    """By id alone, on purpose: the caller is a store, not a user. Possession
    of the connection's secret (checked next, on the raw body) is what
    authenticates the request and fixes the company."""
    if not re.fullmatch(r"[0-9a-f-]{36}", connection_id or ""):
        return None
    return await db.ecommerce_connections.find_one({"id": connection_id}, {"_id": 0})


_TASKS = set()


def _spawn(company_id: str, order_id: str):
    t = asyncio.create_task(process_order(company_id, order_id))
    _TASKS.add(t)                     # keep a reference: a bare task can be garbage-collected mid-run
    t.add_done_callback(_TASKS.discard)


@router.post("/webhook/{connection_id}")
async def receive_webhook(connection_id: str, request: Request):
    """Public. Authenticated by the HMAC signature of the raw body (verify_signature)."""
    body = await _read_body(request)
    conn = await _load_connection(connection_id)
    headers = request.headers
    if conn and conn.get("platform") == "woocommerce" and _is_woo_ping(body, headers):
        return {"ok": True, "ping": True}
    try:
        secret = _unseal(conn["webhook_secret_enc"]) if conn and conn.get("webhook_secret_enc") else ""
    except Exception:
        secret = ""
    if not conn or not verify_signature(conn.get("platform"), secret, body, headers):
        raise HTTPException(status_code=401, detail="invalid signature")
    if not conn.get("is_active", True):
        return {"ok": True, "ignored": "connection disabled"}
    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="invalid JSON")

    platform, company_id = conn["platform"], conn["company_id"]
    topic = _topic(platform, headers, payload)
    kind, order = normalize(platform, topic, payload)
    if kind == "ignore":
        return {"ok": True, "ignored": topic or "event"}
    if not order or not order.get("external_id"):
        raise HTTPException(status_code=400, detail="order id missing")
    await _ensure_indexes()
    if kind in ("cancel", "refund"):
        return await _record_cancellation(conn, kind, topic, order)
    return await _claim_order(conn, topic, order)


async def _claim_order(conn: dict, topic: str, order: dict) -> dict:
    from pymongo.errors import DuplicateKeyError
    company_id, platform = conn["company_id"], conn["platform"]
    doc = {"id": str(uuid.uuid4()), "company_id": company_id, "connection_id": conn["id"],
           "connection_name": conn.get("name"), "platform": platform,
           "external_order_id": order["external_id"], "order_number": order.get("number"),
           "topic": topic, "status": "received", "error": None, "order": order,
           "received_at": _now(), "updated_at": _now(), "processing_until": None,
           "invoice_id": None, "payment_id": None, "needs_credit_note": False,
           "events": [{"at": _now(), "event": topic or "order"}]}
    try:
        await db.ecommerce_orders.insert_one(dict(doc))
    except DuplicateKeyError:
        existing = await db.ecommerce_orders.find_one(
            {"company_id": company_id, "platform": platform, "external_order_id": order["external_id"]}, {"_id": 0})
        out = {"ok": True, "duplicate": True, "order_id": (existing or {}).get("id")}
        # orders/paid (or Woo processing) for an order first received unpaid: take the payment
        if existing and order.get("paid") and not (existing.get("order") or {}).get("paid") \
                and existing.get("status") not in ("cancelled",):
            await db.ecommerce_orders.update_one(
                {"id": existing["id"], "company_id": company_id},
                {"$set": {"order.paid": True, "updated_at": _now()},
                 "$push": {"events": {"at": _now(), "event": topic or "paid"}}})
            _spawn(company_id, existing["id"])
            out["payment_update"] = True
        return out
    _spawn(company_id, doc["id"])
    return {"ok": True, "order_id": doc["id"]}


async def _record_cancellation(conn: dict, kind: str, topic: str, order: dict) -> dict:
    """Record only. An invoiced order is flagged for a manual credit note;
    an order never invoiced is just marked cancelled (and a later 'create'
    for it is a duplicate, so it is never invoiced)."""
    from pymongo.errors import DuplicateKeyError
    company_id, platform = conn["company_id"], conn["platform"]
    key = {"company_id": company_id, "platform": platform, "external_order_id": order["external_id"]}
    event = {"at": _now(), "event": topic or kind, "kind": kind}
    existing = await db.ecommerce_orders.find_one(key, {"_id": 0})
    if existing:
        sets = {"updated_at": _now(), f"{kind}_received_at": _now()}
        if existing.get("invoice_id"):
            sets["needs_credit_note"] = True
        elif kind == "cancel":
            sets["status"] = "cancelled"
        await db.ecommerce_orders.update_one({"id": existing["id"], "company_id": company_id},
                                             {"$set": sets, "$push": {"events": event}})
        return {"ok": True, "recorded": kind, "order_id": existing["id"],
                "needs_credit_note": bool(existing.get("invoice_id"))}
    try:
        await db.ecommerce_orders.insert_one({
            **key, "id": str(uuid.uuid4()), "connection_id": conn["id"], "connection_name": conn.get("name"),
            "order_number": order.get("number"), "topic": topic, "status": "cancelled",
            "error": None, "order": order, "received_at": _now(), "updated_at": _now(),
            "invoice_id": None, "payment_id": None, "needs_credit_note": False,
            f"{kind}_received_at": _now(), "events": [event]})
    except DuplicateKeyError:
        pass
    return {"ok": True, "recorded": kind}


# ══════════════════════════════════════════════════════════════
# Processing (background)
# ══════════════════════════════════════════════════════════════

class NeedsMapping(Exception):
    def __init__(self, skus):
        super().__init__("أصناف غير مربوطة: " + "، ".join(skus))
        self.skus = skus


async def _set(company_id: str, order_id: str, **fields):
    fields["updated_at"] = _now()
    await db.ecommerce_orders.update_one({"id": order_id, "company_id": company_id}, {"$set": fields})


async def process_order(company_id: str, order_id: str):
    """Never raises: every failure ends on the order as status/error."""
    until = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat()
    claimed = await db.ecommerce_orders.find_one_and_update(
        {"id": order_id, "company_id": company_id,
         "$or": [{"processing_until": None}, {"processing_until": {"$lt": _now()}}]},
        {"$set": {"processing_until": until}})
    if not claimed:
        return                         # another worker has it
    try:
        o = await db.ecommerce_orders.find_one({"id": order_id, "company_id": company_id}, {"_id": 0})
        if o.get("status") == "cancelled":
            return
        conn = await db.ecommerce_connections.find_one({"id": o["connection_id"], "company_id": company_id},
                                                       {"_id": 0})
        if not conn:
            await _set(company_id, order_id, status="error", error="الربط محذوف")
            return
        await _run(company_id, o, conn)
    except NeedsMapping as e:
        await _set(company_id, order_id, status="needs_mapping", error=str(e), unmapped_skus=e.skus)
    except HTTPException as e:
        await _set(company_id, order_id, status="error", error=str(e.detail)[:1000])
    except Exception as e:
        logger.exception("ecommerce order %s failed", order_id)
        await _set(company_id, order_id, status="error", error=(str(e) or e.__class__.__name__)[:1000])
    finally:
        await db.ecommerce_orders.update_one({"id": order_id, "company_id": company_id},
                                             {"$set": {"processing_until": None}})


async def _run(company_id: str, o: dict, conn: dict):
    from services.invoice_service import InvoiceService
    service = InvoiceService(db)
    user_id = conn.get("created_by") or "ecommerce"
    oid = o["id"]
    order = o["order"]

    # 1. invoice (created once; its id is saved before approval)
    inv = None
    if o.get("invoice_id"):
        inv = await db.invoices.find_one({"id": o["invoice_id"], "company_id": company_id}, {"_id": 0})
    if not inv:
        inv = await _create_invoice(service, company_id, o, conn, user_id)
        await _set(company_id, oid, invoice_id=inv["id"], invoice_number=inv.get("document_number"),
                   unmapped_skus=[], error=None)
    if inv.get("status") == "draft":
        inv = await service.approve_invoice(inv["id"], user_id)
    if inv.get("status") == "cancelled":
        raise ValueError("الفاتورة ملغاة — راجعها يدوياً")
    diff = round(float(inv.get("grand_total") or 0) - float(order.get("total") or 0), 2)
    await _set(company_id, oid, status="invoiced", error=None, invoice_total=inv.get("grand_total"),
               total_difference=diff if abs(diff) >= 0.05 and order.get("total") else 0.0)
    status = "invoiced"

    # 2. payment (only for paid orders; once)
    if order.get("paid"):
        if not o.get("payment_id"):
            ref = f"{conn['platform']}:{o['external_order_id']}"
            prior = await db.payments.find_one({"invoice_id": inv["id"], "company_id": company_id,
                                                "reference": ref}, {"_id": 0, "id": 1})
            if prior:
                pay_id = prior["id"]
            else:
                due = round(float(inv.get("amount_due") or 0), 2)
                if due <= 0:
                    pay_id = "settled"
                else:
                    from models.invoice import Payment, PaymentMethod
                    pay = Payment(company_id=company_id, invoice_id=inv["id"],
                                  payment_date=order.get("date") or _now()[:10], amount=due,
                                  payment_method=PaymentMethod(conn.get("payment_method") or "credit_card"),
                                  reference=ref, notes=f"طلب متجر {o.get('order_number') or ''}",
                                  bank_account=conn.get("payment_account_id"), created_by=user_id)
                    pay_id = (await service.record_payment(pay, user_id))["id"]
            await _set(company_id, oid, payment_id=pay_id)
        status = "paid"
        await _set(company_id, oid, status="paid")

    # 3. ETA (optional; a failure is recorded, never raised)
    if conn.get("auto_submit_eta") and not o.get("eta_submitted_at"):
        settings = await db.company_eta_settings.find_one({"company_id": company_id, "is_active": True},
                                                          {"_id": 0, "company_id": 1})
        if not settings:
            await _set(company_id, oid, eta_error="تكامل الفاتورة الإلكترونية غير مفعّل")
        else:
            try:
                from api.eta_api import submit_to_eta
                await submit_to_eta(company_id, inv["id"], {"user_id": user_id, "email": "ecommerce"})
                await _set(company_id, oid, status="eta_submitted", eta_submitted_at=_now(), eta_error=None)
                status = "eta_submitted"
            except HTTPException as e:
                await _set(company_id, oid, eta_error=str(e.detail)[:1000])
            except Exception as e:
                await _set(company_id, oid, eta_error=(str(e) or e.__class__.__name__)[:1000])
    return status


async def _resolve_party(service, company_id: str, order: dict, conn: dict) -> dict:
    from models.invoice import Party
    cust = order.get("customer") or {}
    email = (cust.get("email") or "").strip().lower()
    if conn.get("default_party_id") and (conn.get("customer_mode") == "default" or not email):
        p = await db.parties.find_one({"id": conn["default_party_id"], "company_id": company_id}, {"_id": 0})
        if p:
            return p
    if email:
        p = await db.parties.find_one({"company_id": company_id, "party_type": "customer", "email": email},
                                      {"_id": 0})
        if p:
            return p
        p = await service.create_party(Party(company_id=company_id, party_type="customer",
                                             name=cust.get("name") or email, email=email,
                                             phone=cust.get("phone") or None))
        await db.parties.update_one({"id": p["id"], "company_id": company_id},
                                    {"$set": {"source": "ecommerce", "ecommerce_connection_id": conn["id"]}})
        return p
    # no email, no default party: one walk-in customer per store
    p = await db.parties.find_one({"company_id": company_id, "ecommerce_walkin_connection_id": conn["id"]},
                                  {"_id": 0})
    if p:
        return p
    p = await service.create_party(Party(company_id=company_id, party_type="customer",
                                         name=f"عميل المتجر الإلكتروني — {conn.get('name') or conn['platform']}"))
    await db.parties.update_one({"id": p["id"], "company_id": company_id},
                                {"$set": {"source": "ecommerce", "ecommerce_walkin_connection_id": conn["id"]}})
    return p


async def _create_invoice(service, company_id: str, o: dict, conn: dict, user_id: str) -> dict:
    from models.invoice import Invoice, InvoiceLine, DocumentType, PaymentTerms, TaxType, Currency
    order = o["order"]
    sku_map = conn.get("sku_map") or {}
    lines_in = [l for l in order.get("lines") or [] if _f(l.get("quantity")) > 0]
    if not lines_in:
        raise ValueError("الطلب بلا أصناف")

    # map every SKU first: one unmapped SKU → no invoice at all
    products, unmapped = [], []
    for l in lines_in:
        sku = (l.get("sku") or "").strip()
        code = sku_map.get(sku)
        prod = None
        if code:
            prod = await db.products.find_one({"company_id": company_id, "code": code}, {"_id": 0})
        elif sku:
            # no explicit mapping: a product whose code or barcode is the SKU
            prod = await db.products.find_one({"company_id": company_id, "$or": [{"code": sku}, {"barcode": sku}]},
                                              {"_id": 0})
        if not prod:
            unmapped.append(sku or f"«{l.get('name') or '?'}» بلا SKU")
        products.append(prod)
    if unmapped:
        raise NeedsMapping(sorted(set(unmapped)))

    code = str(order.get("currency") or "EGP").upper()
    try:
        currency = Currency(code)
    except ValueError:
        raise ValueError(f"العملة {code} غير مدعومة في الفواتير")
    rate = 1.0
    if code != "EGP":
        from services.fx import rate_on
        rate = await rate_on(db, company_id, code, order.get("date"))

    incl = bool(order.get("prices_include_tax"))
    lines = []
    for l, prod in zip(lines_in, products):
        tax_rate = float(prod.get("tax_rate", 14.0) if prod.get("tax_rate") is not None else 14.0)
        try:
            tax_type = TaxType(prod.get("tax_type") or "vat")
        except ValueError:
            tax_type = TaxType.VAT
        div = 1 + tax_rate / 100 if (incl and tax_type == TaxType.VAT) else 1.0
        lines.append(InvoiceLine(
            line_number=0, product_id=prod["id"], product_code=prod.get("code"),
            description=prod.get("name") or l.get("name") or prod.get("code"),
            unit=prod.get("unit_type") or prod.get("unit") or "EA",
            quantity=_f(l.get("quantity")), unit_price=round(_f(l.get("unit_price")) / div, 5),
            discount_amount=round(_f(l.get("discount")) / div, 2), tax_type=tax_type, tax_rate=tax_rate,
            eta_code=prod.get("eta_code") or prod.get("item_code")))
    shipping = _f(order.get("shipping"))
    if shipping > 0:
        srate = float(conn.get("shipping_tax_rate") if conn.get("shipping_tax_rate") is not None else 14.0)
        div = 1 + srate / 100 if incl and srate else 1.0
        lines.append(InvoiceLine(line_number=0, description="مصاريف شحن / Shipping", unit="EA", quantity=1,
                                 unit_price=round(shipping / div, 5),
                                 tax_type=TaxType.VAT if srate else TaxType.EXEMPT, tax_rate=srate))

    party = await _resolve_party(service, company_id, order, conn)
    paid = bool(order.get("paid"))
    invoice = Invoice(
        company_id=company_id, document_type=DocumentType.SALES_INVOICE, document_number="",
        document_date=order.get("date"), due_date=order.get("date"), party_id=party["id"],
        party_name=party["name"], party_tax_id=party.get("tax_id"), party_address=party.get("address"),
        currency=currency, exchange_rate=rate, payment_terms=PaymentTerms.CASH,
        lines=lines, notes=f"طلب {conn['platform']} رقم {o.get('order_number') or o['external_order_id']}"
                           + ("" if paid else " — لم يُسدَّد بعد"),
        reference=f"{conn['platform']}:{o['external_order_id']}", created_by=user_id)
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "name": 1}) or {}
    inv = await service.create_invoice(invoice, company.get("name", ""),
                                       invoice_extra={"invoice_type": "goods", "client_wht_rate": 0.0,
                                                      "client_wht_amount": 0.0})
    # InvoiceLine has no warehouse field; approval reads line["warehouse_id"] (default "main")
    wh = conn.get("warehouse_id") or "main"
    stored = inv.get("lines") or []
    for ln in stored:
        if ln.get("product_id"):
            ln["warehouse_id"] = wh
    await db.invoices.update_one({"id": inv["id"], "company_id": company_id},
                                 {"$set": {"lines": stored, "source": "ecommerce",
                                           "ecommerce_order_id": o["id"]}})
    inv["lines"] = stored
    return inv
