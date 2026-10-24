"""
الإيصال الإلكتروني (B2C) لمنظومة مصلحة الضرائب المصرية — لمبيعات نقاط البيع.

One receipt per POS sale / return, built here and kept in db.eta_receipts:
    {id, company_id, transaction_id, shift_id, kind: sale|return, status,
     device_serial, receipt_number, uuid, previous_uuid, reference_uuid,
     document, error, issued_at, created_at, submitted_at, long_id, ...}
status: pending (not yet accepted — built or waiting for settings) |
        submitted (accepted by the authority) | rejected (refused by it) |
        error (could not be built — see `error`; fix and press "إرسال الآن").

Receipt layout follows the e-receipt v1.2 specification as published on
sdk.invoicing.eta.gov.eg (header / documentType / seller / buyer / itemData /
totals / paymentMethod). The uuid is SHA-256 (hex) of the receipt in the
authority's canonical serialization — the same serialize() used for invoices
(services/eta_document) — computed with header.uuid = "" and previousUUID
already set. previousUUID chains the receipts of one POS device.

NOT verified against the live ETA pre-production environment: field names,
the payment-method codes and the token/submit headers are written from the
published spec and need one round-trip on preprod before going live.
"""
import hashlib
import uuid as _uuid
from datetime import datetime, timezone
from typing import Optional

from pymongo.errors import DuplicateKeyError

from services.eta_document import serialize, UNIT_CODES, _vat_subtype

ROUND = 5
TYPE_VERSION = "1.2"
# our POS payment methods → receipt paymentMethod codes (C cash, V visa/card,
# O others — an e-wallet has no code of its own in the spec as we read it)
PAYMENT_CODES = {"cash": "C", "card": "V", "wallet": "O"}
# individuals: national id required at or above this receipt total (spec rule)
BUYER_ID_THRESHOLD = 150000
BATCH_SIZE = 100

_indexes_ready = False


class ETAReceiptError(ValueError):
    """Why a receipt cannot be built — Arabic, shown next to the sale."""


def _n(x) -> float:
    return round(float(x or 0), ROUND)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_indexes(db):
    global _indexes_ready
    if _indexes_ready:
        return
    await db.eta_receipts.create_index([("company_id", 1), ("transaction_id", 1)], unique=True)
    await db.eta_receipt_chain.create_index([("company_id", 1), ("device_serial", 1)], unique=True)
    _indexes_ready = True


# ── settings ─────────────────────────────────────────────────

async def load_settings(db, company_id: str) -> dict:
    """POS e-receipt settings merged with the company's invoicing ETA settings
    (registration number, trade name and address are the same taxpayer)."""
    pos = await db.company_eta_pos_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    inv = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    s = {
        "rin": (pos.get("rin") or inv.get("tax_registration_number") or "").strip(),
        "company_trade_name": (pos.get("company_trade_name") or inv.get("issuer_name") or "").strip(),
        "branch_code": str(pos.get("branch_code") or inv.get("branch_id") or "0").strip(),
        "activity_code": str(pos.get("activity_code") or inv.get("activity_code") or "").strip(),
        "device_serial": str(pos.get("device_serial") or "").strip(),
        "environment": pos.get("environment") or "preprod",
        "client_id": pos.get("client_id") or "",
        "client_secret_enc": pos.get("client_secret_enc") or "",
        "pos_os_version": pos.get("pos_os_version") or "",
        "pos_model_framework": pos.get("pos_model_framework") or "",
        "pre_shared_key_enc": pos.get("pre_shared_key_enc") or "",
        "default_item_code": (pos.get("default_item_code") or "").strip(),
        "default_item_type": (pos.get("default_item_type") or inv.get("item_code_type") or "EGS").upper(),
    }
    addr_src = pos if pos.get("governate") or pos.get("street") else inv
    s["address"] = {
        "country": __import__("services.country", fromlist=["x"]).country_code(addr_src.get("country")),
        "governate": (addr_src.get("governate") or "").strip(),
        "regionCity": (addr_src.get("region_city") or "").strip(),
        "street": (addr_src.get("street") or "").strip(),
        "buildingNumber": str(addr_src.get("building_number") or "").strip(),
        "postalCode": str(addr_src.get("postal_code") or ""),
        "floor": "", "room": "", "landmark": "", "additionalInformation": "",
    }
    return s


def build_problems(s: dict) -> list:
    """What is missing before any receipt can be built."""
    p = []
    if len(s["rin"]) != 9 or not s["rin"].isdigit():
        p.append("رقم التسجيل الضريبي (9 أرقام)")
    if not s["company_trade_name"]:
        p.append("الاسم التجاري")
    if not s["device_serial"]:
        p.append("الرقم التسلسلي لجهاز نقطة البيع")
    if not s["activity_code"]:
        p.append("كود النشاط")
    a = s["address"]
    if not (a["governate"] and a["regionCity"] and a["street"] and a["buildingNumber"]):
        p.append("عنوان الفرع (المحافظة، المدينة، الشارع، رقم المبنى)")
    return p


def submit_problems(s: dict) -> list:
    p = build_problems(s)
    if not s["client_id"] or not s["client_secret_enc"]:
        p.append("بيانات عميل جهاز نقطة البيع (Client ID / Secret)")
    return p


# ── building ─────────────────────────────────────────────────

def _lines(txn: dict, products: dict, s: dict) -> list:
    """Item lines that add up to the transaction (amount incl. VAT, vat).
    Lines carry prices only when every item has one; otherwise the whole
    receipt is one line under the device's default item code."""
    amount, vat = float(txn["amount"]), float(txn.get("vat") or 0)
    net = amount - vat
    rate = round(vat / net * 100, 2) if net > 0 and vat > 0 else 0.0
    if abs(rate - 14) < 0.05:
        rate = 14.0
    items = txn.get("items") or []
    priced = items and all(float(i.get("unit_price") or 0) > 0 and float(i.get("qty") or 0) > 0 for i in items)
    if priced:
        rows = []
        for i in items:
            p = products.get(i.get("product_id")) or {}
            rows.append({"w": float(i["qty"]) * float(i["unit_price"]), "qty": float(i["qty"]),
                         "name": i.get("name") or p.get("name") or "صنف",
                         "code": (p.get("eta_code") or p.get("item_code") or s["default_item_code"] or "").strip(),
                         "type": (p.get("item_code_type") or s["default_item_type"]).upper(),
                         "unit": p.get("unit_type") or UNIT_CODES.get(str(p.get("unit") or "").lower(), "EA"),
                         "internal": str(p.get("code") or i.get("product_id") or "")})
    else:
        rows = [{"w": 1.0, "qty": 1.0, "name": "مبيعات نقطة البيع", "code": s["default_item_code"],
                 "type": s["default_item_type"], "unit": "EA", "internal": "POS"}]
    missing = [r["name"] for r in rows if not r["code"]]
    if missing:
        raise ETAReceiptError("كود الصنف المسجّل بالمنظومة ناقص (" + "، ".join(missing[:5]) +
                              ") — أضفه للصنف أو حدّد كوداً افتراضياً في إعدادات الإيصال الإلكتروني")
    W = sum(r["w"] for r in rows) or 1.0
    out, net_left, vat_left = [], _n(net), _n(vat)
    for k, r in enumerate(rows):
        last = k == len(rows) - 1
        line_net = net_left if last else _n(net * r["w"] / W)
        line_vat = vat_left if last else _n(vat * r["w"] / W)
        net_left, vat_left = _n(net_left - line_net), _n(vat_left - line_vat)
        qty = _n(r["qty"])
        unit_price = _n(line_net / qty)
        total_sale = line_net
        out.append({
            "internalCode": r["internal"][:50] or "POS",
            "description": str(r["name"])[:500],
            "itemType": r["type"],
            "itemCode": r["code"],
            "unitType": r["unit"],
            "quantity": qty,
            "unitPrice": unit_price,
            "netSale": total_sale,
            "totalSale": total_sale,
            "total": _n(total_sale + line_vat),
            "commercialDiscountData": [],
            "itemDiscountData": [],
            "valueDifference": 0,
            "taxableItems": [{"taxType": "T1", "amount": line_vat,
                              "subType": _vat_subtype(rate), "rate": _n(rate)}],
        })
    return out


def receipt_uuid(receipt: dict) -> str:
    """SHA-256 hex of the canonical serialization with header.uuid empty."""
    copy = {**receipt, "header": {**receipt["header"], "uuid": ""}}
    return hashlib.sha256(serialize(copy).encode("utf-8")).hexdigest()


def build_receipt(txn: dict, s: dict, products: dict, previous_uuid: str,
                  issued_at: str, receipt_number: str, reference_uuid: Optional[str] = None,
                  buyer: Optional[dict] = None) -> dict:
    """The receipt document with its uuid filled in."""
    problems = build_problems(s)
    if problems:
        raise ETAReceiptError("إعدادات الإيصال الإلكتروني ناقصة: " + "، ".join(problems))
    is_return = txn.get("type") == "return"
    if is_return and not reference_uuid:
        raise ETAReceiptError("المرتجع يجب أن يشير لإيصال بيع أصلي له رقم في المنظومة")
    lines = _lines(txn, products, s)
    total_sales = _n(sum(l["totalSale"] for l in lines))
    net_amount = _n(sum(l["netSale"] for l in lines))
    t1 = _n(sum(l["taxableItems"][0]["amount"] for l in lines))
    total = _n(net_amount + t1)
    b = buyer or {}
    buyer_doc = {"type": (b.get("type") or "P").upper(), "id": str(b.get("id") or ""),
                 "name": str(b.get("name") or ""), "mobileNumber": str(b.get("mobile") or ""),
                 "paymentNumber": str(b.get("payment_number") or "")}
    if buyer_doc["type"] in ("B", "F") and not (buyer_doc["id"] and buyer_doc["name"]):
        raise ETAReceiptError("المشتري شركة/أجنبي — الاسم والرقم مطلوبان")
    if buyer_doc["type"] == "P" and total >= BUYER_ID_THRESHOLD and not buyer_doc["id"]:
        raise ETAReceiptError(f"إيصال بقيمة {BUYER_ID_THRESHOLD:,} ج.م أو أكثر يتطلب الرقم القومي للمشتري")
    dt = datetime.fromisoformat(issued_at.replace("Z", "+00:00")).astimezone(timezone.utc)
    header = {
        "dateTimeIssued": dt.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "receiptNumber": str(receipt_number)[:50],
        "uuid": "",
        "previousUUID": previous_uuid or "",
        "referenceOldUUID": "",
        "currency": "EGP",
        "exchangeRate": 0,
        "sOrderNameCode": "",
        "orderdeliveryMode": "",
        "grossWeight": 0,
        "netWeight": 0,
    }
    if is_return:
        # a return receipt names the sale it reverses (referenceUUID); referenceOldUUID
        # is reserved for re-issuing a corrected receipt and stays empty
        header["referenceUUID"] = reference_uuid
    receipt = {
        "header": header,
        "documentType": {"receiptType": "R" if is_return else "S", "typeVersion": TYPE_VERSION},
        "seller": {
            "rin": s["rin"],
            "companyTradeName": s["company_trade_name"],
            "branchCode": s["branch_code"] or "0",
            "branchAddress": s["address"],
            "deviceSerialNumber": s["device_serial"],
            "syndicateLicenseNumber": "",
            "activityCode": s["activity_code"],
        },
        "buyer": buyer_doc,
        "itemData": lines,
        "totalSales": total_sales,
        "totalCommercialDiscount": 0,
        "totalItemsDiscount": 0,
        "extraReceiptDiscountData": [],
        "netAmount": net_amount,
        "feesAmount": 0,
        "totalAmount": total,
        "taxTotals": [{"taxType": "T1", "amount": t1}],
        "paymentMethod": PAYMENT_CODES.get(txn.get("payment_method"), "O"),
        "adjustment": 0,
    }
    receipt["header"]["uuid"] = receipt_uuid(receipt)
    return receipt


async def _products(db, company_id: str, txn: dict) -> dict:
    ids = [i.get("product_id") for i in txn.get("items") or [] if i.get("product_id")]
    if not ids:
        return {}
    rows = await db.products.find({"company_id": company_id, "id": {"$in": ids}}, {"_id": 0}).to_list(None)
    return {p["id"]: p for p in rows}


async def _reference_uuid(db, company_id: str, txn: dict) -> Optional[str]:
    """uuid of the sale a return reverses (by its receipt number)."""
    number = txn.get("receipt_number")
    if not number:
        return None
    r = await db.eta_receipts.find_one(
        {"company_id": company_id, "kind": "sale", "receipt_number": number, "uuid": {"$ne": None}},
        {"_id": 0, "uuid": 1}, sort=[("issued_at", -1)])
    return (r or {}).get("uuid") or None


async def _advance_chain(db, company_id: str, device: str, new_uuid_for):
    """Compare-and-swap on the device chain: build with the current last uuid,
    and move the chain only if nobody moved it meanwhile. Returns (doc, prev)."""
    for _ in range(20):
        chain = await db.eta_receipt_chain.find_one({"company_id": company_id, "device_serial": device}, {"_id": 0})
        prev = (chain or {}).get("last_uuid") or ""
        doc = await new_uuid_for(prev)
        new = doc["header"]["uuid"]
        if chain is None:
            try:
                await db.eta_receipt_chain.insert_one({"company_id": company_id, "device_serial": device,
                                                       "last_uuid": new, "count": 1, "updated_at": _now()})
                return doc, prev
            except DuplicateKeyError:
                continue
        moved = await db.eta_receipt_chain.update_one(
            {"company_id": company_id, "device_serial": device, "last_uuid": chain.get("last_uuid")},
            {"$set": {"last_uuid": new, "updated_at": _now()}, "$inc": {"count": 1}})
        if moved.modified_count:
            return doc, prev
    raise ETAReceiptError("تعذّر تسلسل الإيصال — أعد المحاولة")


async def _build_one(db, rec: dict, s: dict):
    txn = await db.pos_transactions.find_one({"company_id": rec["company_id"], "id": rec["transaction_id"]}, {"_id": 0})
    if not txn:
        raise ETAReceiptError("العملية غير موجودة")
    ref = None
    if txn.get("type") == "return":
        ref = await _reference_uuid(db, rec["company_id"], txn)
        if not ref:
            raise ETAReceiptError(f"إيصال البيع الأصلي ({txn.get('receipt_number')}) ليس له إيصال إلكتروني مبني بعد")
    products = await _products(db, rec["company_id"], txn)

    async def make(prev):
        return build_receipt(txn, s, products, prev, rec["issued_at"], rec["receipt_number"],
                             reference_uuid=ref, buyer=txn.get("buyer"))
    doc, prev = await _advance_chain(db, rec["company_id"], s["device_serial"], make)
    return doc, prev, ref


async def build_waiting(db, company_id: str, s: Optional[dict] = None, include_errors: bool = False) -> int:
    """Build every receipt of the company still without a document, oldest
    first, so the device chain follows the order of the sales."""
    s = s or await load_settings(db, company_id)
    if build_problems(s):
        return 0
    statuses = ["pending", "error"] if include_errors else ["pending"]
    built = 0
    waiting = await db.eta_receipts.find(
        {"company_id": company_id, "status": {"$in": statuses}, "document": None},
        {"_id": 0}).sort([("issued_at", 1), ("seq", 1)]).to_list(5000)
    for rec in waiting:
        # claim, so two builders never chain the same receipt twice
        claim = await db.eta_receipts.update_one(
            {"id": rec["id"], "document": None, "building": {"$ne": True}}, {"$set": {"building": True}})
        if not claim.modified_count:
            continue
        try:
            doc, prev, ref = await _build_one(db, rec, s)
            await db.eta_receipts.update_one({"id": rec["id"]}, {"$set": {
                "document": doc, "uuid": doc["header"]["uuid"], "previous_uuid": prev, "reference_uuid": ref,
                "device_serial": s["device_serial"], "status": "pending", "error": None,
                "built_at": _now(), "building": False}})
            built += 1
        except ETAReceiptError as e:
            await db.eta_receipts.update_one({"id": rec["id"]}, {"$set": {
                "status": "error", "error": str(e), "building": False}})
        except Exception as e:                           # never leave it claimed
            await db.eta_receipts.update_one({"id": rec["id"]}, {"$set": {
                "status": "error", "error": f"خطأ غير متوقع: {e}", "building": False}})
    return built


async def create_for_transaction(db, company_id: str, txn: dict) -> dict:
    """Record the receipt of a committed POS transaction and build it now when
    settings allow. Idempotent per transaction. Never raises."""
    try:
        await ensure_indexes(db)
        existing = await db.eta_receipts.find_one({"company_id": company_id, "transaction_id": txn["id"]}, {"_id": 0})
        if not existing:
            rec = {
                "id": str(_uuid.uuid4()), "company_id": company_id, "transaction_id": txn["id"],
                "shift_id": txn.get("shift_id"), "kind": txn.get("type", "sale"),
                "receipt_number": txn.get("receipt_number") or txn["id"],
                "issued_at": txn.get("timestamp") or _now(), "seq": datetime.now(timezone.utc).timestamp(),
                "amount": txn.get("amount"), "status": "pending", "document": None, "uuid": None,
                "previous_uuid": None, "reference_uuid": None, "error": None, "attempts": 0,
                "created_at": _now(),
            }
            try:
                await db.eta_receipts.insert_one(rec)
            except DuplicateKeyError:
                pass
        s = await load_settings(db, company_id)
        problems = build_problems(s)
        if problems:
            await db.eta_receipts.update_one(
                {"company_id": company_id, "transaction_id": txn["id"], "document": None},
                {"$set": {"error": "بانتظار إكمال إعدادات الإيصال الإلكتروني: " + "، ".join(problems)}})
        else:
            await build_waiting(db, company_id, s)
    except Exception as e:                               # the sale is already committed
        try:
            await db.eta_receipts.update_one({"company_id": company_id, "transaction_id": txn["id"]},
                                             {"$set": {"status": "error", "error": f"تعذّر بناء الإيصال: {e}",
                                                       "building": False}})
        except Exception:
            pass
    return await receipt_summary(db, company_id, txn["id"])


async def receipt_summary(db, company_id: str, transaction_id: str) -> Optional[dict]:
    r = await db.eta_receipts.find_one({"company_id": company_id, "transaction_id": transaction_id},
                                       {"_id": 0, "status": 1, "uuid": 1, "error": 1, "long_id": 1, "receipt_number": 1})
    return r


# ── submission ───────────────────────────────────────────────

def _hosts(environment: str):
    pre = (environment or "").lower() in ("preprod", "preproduction", "sandbox", "test")
    return (("https://id.preprod.eta.gov.eg", "https://api.preprod.invoicing.eta.gov.eg") if pre
            else ("https://id.eta.gov.eg", "https://api.invoicing.eta.gov.eg"))


def _pos_headers(s: dict) -> dict:
    from services.eta_signer import decrypt
    h = {"posserial": s["device_serial"], "pososversion": s["pos_os_version"] or "os"}
    if s["pos_model_framework"]:
        h["posmodelframework"] = s["pos_model_framework"]
    if s["pre_shared_key_enc"]:
        h["presharedkey"] = decrypt(s["pre_shared_key_enc"]).decode()
    return h


async def _token(http, s: dict) -> str:
    from services.eta_signer import decrypt
    id_host, _ = _hosts(s["environment"])
    resp = await http.post(f"{id_host}/connect/token", headers=_pos_headers(s), data={
        "grant_type": "client_credentials", "client_id": s["client_id"],
        "client_secret": decrypt(s["client_secret_enc"]).decode()})
    if resp.status_code != 200:
        raise RuntimeError(f"فشل الحصول على توكن نقطة البيع ({resp.status_code}): {str(resp.text)[:300]}")
    return resp.json()["access_token"]


def _err_text(e) -> str:
    if isinstance(e, dict):
        msg = e.get("message") or e.get("error") or ""
        det = "؛ ".join(_err_text(d) for d in e.get("details") or [])
        return (f"{msg} {det}").strip() or str(e)
    return str(e)


async def _submit_company(db, company_id: str, http) -> dict:
    s = await load_settings(db, company_id)
    problems = submit_problems(s)
    if problems:
        return {"company_id": company_id, "skipped": "إعدادات ناقصة: " + "، ".join(problems)}
    await build_waiting(db, company_id, s)
    ready = await db.eta_receipts.find(
        {"company_id": company_id, "status": "pending", "document": {"$ne": None},
         "device_serial": s["device_serial"]}, {"_id": 0}).sort([("issued_at", 1), ("seq", 1)]).to_list(5000)
    if not ready:
        return {"company_id": company_id, "submitted": 0, "rejected": 0}
    token = await _token(http, s)
    _, api_host = _hosts(s["environment"])
    headers = {**_pos_headers(s), "Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    done = rejected = 0
    for k in range(0, len(ready), BATCH_SIZE):
        batch = ready[k:k + BATCH_SIZE]
        ids = [r["id"] for r in batch]
        try:
            resp = await http.post(f"{api_host}/api/v1/receiptsubmissions", headers=headers,
                                   json={"receipts": [r["document"] for r in batch]})
        except Exception as e:
            await db.eta_receipts.update_many({"id": {"$in": ids}}, {"$set": {"last_error": f"تعذّر الاتصال: {e}"},
                                                                     "$inc": {"attempts": 1}})
            break                                        # keep order: stop at the first failed batch
        if resp.status_code not in (200, 202):
            await db.eta_receipts.update_many({"id": {"$in": ids}}, {"$set": {
                "last_error": f"HTTP {resp.status_code}: {str(resp.text)[:300]}"}, "$inc": {"attempts": 1}})
            break
        body = resp.json() or {}
        by_uuid = {r["uuid"]: r for r in batch}
        now = _now()
        for a in body.get("acceptedDocuments") or []:
            r = by_uuid.get(a.get("uuid"))
            if r:
                await db.eta_receipts.update_one({"id": r["id"]}, {"$set": {
                    "status": "submitted", "submitted_at": now, "long_id": a.get("longId"),
                    "submission_id": body.get("submissionId"), "last_error": None}, "$inc": {"attempts": 1}})
                done += 1
        for rj in body.get("rejectedDocuments") or []:
            r = by_uuid.get(rj.get("uuid"))
            if r:
                await db.eta_receipts.update_one({"id": r["id"]}, {"$set": {
                    "status": "rejected", "error": _err_text(rj.get("error")),
                    "submission_id": body.get("submissionId")}, "$inc": {"attempts": 1}})
                rejected += 1
    return {"company_id": company_id, "submitted": done, "rejected": rejected}


async def submit_pending_receipts(db, company_id: Optional[str] = None, http=None) -> list:
    """Send every built, pending receipt. Companies without complete POS
    settings are left pending. `http` — an object with an async post(); a
    real httpx client is opened when none is given."""
    companies = [company_id] if company_id else await db.eta_receipts.distinct("company_id", {"status": "pending"})
    if not companies:
        return []
    own = http is None
    if own:
        import httpx
        http = httpx.AsyncClient(timeout=60.0)
    results = []
    try:
        for cid in companies:
            try:
                results.append(await _submit_company(db, cid, http))
            except Exception as e:
                await db.eta_receipts.update_many({"company_id": cid, "status": "pending"},
                                                  {"$set": {"last_error": str(e)[:300]}})
                results.append({"company_id": cid, "error": str(e)[:300]})
    finally:
        if own:
            await http.aclose()
    return results
