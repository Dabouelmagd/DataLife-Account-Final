"""
تصدير بيانات الشركة — Company data export (no lock-in).

A company's top management can take ALL of its data out of DataLife at any
time: one ZIP with every collection that carries its company_id, as JSON (one
file per collection), plus Excel workbooks for the main ledgers.

  POST /api/data-export                       start an export (top roles only)
  GET  /api/data-export                       this company's recent exports
  GET  /api/data-export/{job_id}              progress of one export
  POST /api/data-export/{job_id}/link         one-time download link (5 minutes)
  GET  /api/data-export/download/{token}      the ZIP itself (token = credential)

Rules
- top roles of the company only (company_policies.TOP_ROLES), checked against
  the user's CURRENT role in the database, not the one in the token;
- one export per company per hour (failed attempts do not count);
- secrets are never exported: password hashes, tokens, OTP/2FA codes, ETA
  client secrets / PINs / certificate passwords, webhook secrets, anything
  stored encrypted (*_enc, *_encrypted). Personal data is NOT masked — this is
  the owner's own copy — but PII encrypted at rest is decrypted so the copy is
  usable outside DataLife;
- the ZIP lives outside /app/uploads (never served by /api/uploads) and is
  deleted 24 hours after it was made; each download link works once.
- every request and every download is written to the audit trail
  (action data_export / data_export_download).
"""
import asyncio
import hashlib
import json
import logging
import os
import re
import secrets
import shutil
import tempfile
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from database import db
from dependencies import get_current_user
from api.company_policies import TOP_ROLES

logger = logging.getLogger("data_export")
router = APIRouter(prefix="/api/data-export", tags=["Data Export"])

EXPORT_DIR = os.environ.get("DATA_EXPORT_DIR", "/app/data_exports")
JOBS = "data_export_jobs"
RATE_WINDOW = timedelta(hours=1)
FILE_TTL = timedelta(hours=24)
LINK_TTL = timedelta(minutes=5)
STALE_RUNNING = timedelta(minutes=45)      # a job "running" this long died with its process
BATCH = 500

# whole collections that never leave: login machinery and caches, not company data
EXCLUDED_COLLECTIONS = {
    JOBS, "auth_throttle", "revoked_tokens", "login_challenges", "password_reset_otps",
    "eta_token_cache", "push_subscriptions", "portal_invites", "activation_codes",
    "chatbot_rate", "audit_counters",
}

# field names removed wherever they appear (also inside nested objects)
SECRET_FIELDS = {
    "password", "password_hash", "hashed_password", "temp_password", "new_password",
    "current_password", "old_password", "token", "access_token", "refresh_token", "id_token",
    "token_hash", "code_hash", "otp", "otp_hash", "otp_code", "pin", "pin_hash", "token_pin",
    "secret", "client_secret", "webhook_secret", "pre_shared_key", "api_key", "admin_key",
    "private_key", "certificate_password", "eta_hash_key", "totp_secret", "two_factor_secret",
    "signing_key", "passphrase", "reset_token", "invite_token", "session_token",
}
SECRET_PATTERN = re.compile(r"(secret|password|passwd|private_key|api_key|_token$|^token_|_enc$|_encrypted$)",
                            re.IGNORECASE)
# booleans and timestamps ABOUT secrets are harmless and useful ("has_secret",
# "must_change_password", "pii_encrypted"): only strings/objects are removed
_SAFE_TYPES = (bool, int, float, type(None))

_tasks: set = set()

LEDGER_WORKBOOKS = {
    "chart_of_accounts": ["account_code", "account_name", "account_name_en", "account_type",
                          "parent_code", "parent_id", "level", "is_active", "balance"],
    "invoices": ["invoice_number", "invoice_type", "invoice_date", "due_date", "customer_name",
                 "supplier_name", "currency", "subtotal", "tax_amount", "discount", "total_amount",
                 "paid_amount", "status", "eta_status"],
    "parties": ["code", "name", "name_en", "party_type", "tax_id", "phone", "email", "address",
                "balance", "credit_limit"],
    "suppliers": ["code", "name", "tax_id", "phone", "email", "address", "balance"],
    "products": ["sku", "code", "barcode", "name", "name_en", "category", "unit", "cost_price",
                 "sale_price", "price", "quantity", "stock", "is_active"],
    "employees": ["employee_number", "employee_code", "name", "name_en", "national_id", "job_title",
                  "department", "hire_date", "basic_salary", "mobile", "email", "iban",
                  "bank_account_number", "status"],
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(d: Optional[datetime]) -> Optional[str]:
    if d is None:
        return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.isoformat()


def _aware(d) -> Optional[datetime]:
    if isinstance(d, str):
        try:
            d = datetime.fromisoformat(d)
        except ValueError:
            return None
    if isinstance(d, datetime) and d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d


# ── secrets / PII ────────────────────────────────────────────

def _is_secret_key(key: str, value: Any) -> bool:
    if isinstance(value, _SAFE_TYPES):
        return False
    k = str(key)
    return k.lower() in SECRET_FIELDS or bool(SECRET_PATTERN.search(k))


_decrypt = None


def _decryptor():
    global _decrypt
    if _decrypt is None:
        try:
            from api.data_protection import ENCRYPTION
            _decrypt = ENCRYPTION.decrypt
        except Exception:                      # pragma: no cover - module always present
            _decrypt = lambda v: v               # noqa: E731
    return _decrypt


def clean(value: Any) -> Any:
    """Strip secret fields (recursively) and decrypt PII encrypted at rest."""
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items() if k != "_id" and not _is_secret_key(k, v)}
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, str) and value.startswith("ENCRYPTED:"):
        return _decryptor()(value)
    return value


def _json_default(o):
    if isinstance(o, datetime):
        return _iso(o)
    return str(o)


# ── access ──────────────────────────────────────────────────

async def _top_user(current_user: dict) -> dict:
    uid = current_user.get("user_id") or current_user.get("id")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "email": 1,
                                                 "role": 1, "company_id": 1, "is_active": 1})
    if not user or user.get("is_active") is False:
        raise HTTPException(401, "الحساب غير نشط")
    if not user.get("company_id"):
        raise HTTPException(400, "هذا الحساب غير مرتبط بشركة")
    if user.get("role") not in TOP_ROLES:
        raise HTTPException(403, "تصدير بيانات الشركة متاح لرئيس مجلس الإدارة أو المدير العام أو المدير التنفيذي فقط")
    user["user_id"] = user["id"]
    return user


def _public(job: dict) -> dict:
    keep = ("id", "status", "progress", "step", "collections_total", "collections_done",
            "documents", "size", "error", "created_at", "finished_at", "expires_at",
            "requested_by_name", "downloads")
    out = {k: job.get(k) for k in keep}
    for k in ("created_at", "finished_at", "expires_at"):
        out[k] = _iso(_aware(out[k])) if out[k] else None
    return out


def _remove_file(path: Optional[str]):
    if path:
        try:
            os.remove(path)
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.warning("could not delete export file: %s", e)


async def purge_expired():
    """Delete export files older than 24h and close jobs whose process died."""
    now = _now()
    async for job in db[JOBS].find({"status": "done", "expires_at": {"$lt": now}}, {"_id": 0}):
        _remove_file(job.get("file_path"))
        await db[JOBS].update_one({"id": job["id"]}, {"$set": {"status": "expired", "file_path": None,
                                                             "download_token_hash": None}})
    await db[JOBS].update_many(
        {"status": {"$in": ["queued", "running"]}, "updated_at": {"$lt": now - STALE_RUNNING}},
        {"$set": {"status": "failed", "error": "توقفت العملية قبل اكتمالها — أعد المحاولة"}})
    # files left behind with no job (e.g. a crash between write and update)
    try:
        if os.path.isdir(EXPORT_DIR):
            for name in os.listdir(EXPORT_DIR):
                p = os.path.join(EXPORT_DIR, name)
                if os.path.isfile(p) and now.timestamp() - os.path.getmtime(p) > FILE_TTL.total_seconds():
                    _remove_file(p)
    except Exception as e:
        logger.warning("export dir sweep failed: %s", e)


async def _cleanup_loop():
    while True:
        try:
            await purge_expired()
        except Exception as e:
            logger.warning("data export cleanup failed: %s", e)
        await asyncio.sleep(1800)


@router.on_event("startup")
async def _start_cleanup():
    t = asyncio.create_task(_cleanup_loop())
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


# ── building the archive ────────────────────────────────────

async def _collections_for(company_id: str) -> list:
    names = []
    for name in sorted(await db.list_collection_names()):
        if name.startswith("system.") or name in EXCLUDED_COLLECTIONS:
            continue
        names.append(name)
    return names


async def _write_collection(zf: zipfile.ZipFile, name: str, query: dict) -> int:
    count = 0
    with zf.open(f"json/{name}.json", "w", force_zip64=True) as fh:
        fh.write(b"[\n")
        async for doc in db[name].find(query, {"_id": 0}).batch_size(BATCH):
            if count:
                fh.write(b",\n")
            fh.write(json.dumps(clean(doc), ensure_ascii=False, default=_json_default).encode("utf-8"))
            count += 1
            if count % BATCH == 0:
                await asyncio.sleep(0)          # let the API keep serving
        fh.write(b"\n]\n")
    return count


def _cell(v):
    if v is None or isinstance(v, (bool, int, float)):
        return v
    if isinstance(v, datetime):
        return _iso(v)
    if isinstance(v, (dict, list)):
        v = json.dumps(v, ensure_ascii=False, default=_json_default)
    # written as a plain string cell (strings_to_formulas=False): "=..." never runs
    return str(v)[:32000]


async def _columns(name: str, query: dict, preferred: list) -> list:
    seen = list(preferred)
    known = set(seen)
    async for doc in db[name].find(query, {"_id": 0}).limit(2000):
        for k, v in clean(doc).items():
            if k not in known and not isinstance(v, (dict, list)):
                known.add(k)
                seen.append(k)
    return seen


async def _sheet(wb, title: str, name: str, query: dict, preferred: list) -> int:
    cols = await _columns(name, query, preferred)
    ws = wb.add_worksheet(title[:31])
    ws.right_to_left()
    for c, col in enumerate(cols):
        ws.write(0, c, col)
    r = 0
    async for doc in db[name].find(query, {"_id": 0}).batch_size(BATCH):
        d = clean(doc)
        r += 1
        for c, col in enumerate(cols):
            ws.write(r, c, _cell(d.get(col)))
        if r % BATCH == 0:
            await asyncio.sleep(0)
    return r


async def _journal_lines_sheet(wb, query: dict) -> int:
    head = ["entry_number", "entry_date", "date", "description", "reference", "status", "source"]
    line = ["account_code", "account_name", "debit", "credit", "description", "cost_center", "currency"]
    ws = wb.add_worksheet("journal_lines")
    ws.right_to_left()
    for c, col in enumerate(["entry_id"] + head + ["line_" + x for x in line]):
        ws.write(0, c, col)
    r = 0
    async for doc in db.journal_entries.find(query, {"_id": 0}).batch_size(BATCH):
        d = clean(doc)
        for ln in (d.get("lines") or d.get("entries") or [{}]):
            ln = ln if isinstance(ln, dict) else {}
            r += 1
            row = [d.get("id")] + [d.get(h) for h in head] + [ln.get(x) for x in line]
            for c, v in enumerate(row):
                ws.write(r, c, _cell(v))
        if r % BATCH == 0:
            await asyncio.sleep(0)
    return r


async def _workbooks(zf: zipfile.ZipFile, company_id: str, tmp: str, present: set):
    import xlsxwriter
    q = {"company_id": company_id}
    plan = [
        ("chart_of_accounts.xlsx", [("chart_of_accounts", "chart_of_accounts")]),
        ("journal_entries.xlsx", [("journal_lines", None)]),
        ("invoices.xlsx", [("invoices", "invoices"), ("sales_invoices", "sales_invoices")]),
        ("parties.xlsx", [("parties", "parties"), ("suppliers", "suppliers")]),
        ("products.xlsx", [("products", "products")]),
        ("employees.xlsx", [("employees", "employees")]),
    ]
    for fname, sheets in plan:
        wanted = [(t, c) for t, c in sheets if (c in present) or (c is None and "journal_entries" in present)]
        if not wanted:
            continue
        path = os.path.join(tmp, fname)
        wb = xlsxwriter.Workbook(path, {"constant_memory": True, "strings_to_formulas": False,
                                        "strings_to_urls": False})
        try:
            for title, coll in wanted:
                if coll is None:
                    await _journal_lines_sheet(wb, q)
                else:
                    await _sheet(wb, title, coll, q, LEDGER_WORKBOOKS.get(coll, []))
        finally:
            wb.close()
        zf.write(path, f"excel/{fname}")


README_AR = """تصدير بيانات الشركة من داتا لايف
=================================
هذا الملف نسخة كاملة من بيانات شركتك وقت التصدير، لتحتفظي/تحتفظ بها أو تنقلها إلى أي نظام آخر.

- json/   : ملف لكل مجموعة بيانات (collection) فيه كل سجلات شركتك بصيغة JSON (UTF-8).
- excel/  : دفاتر Excel للدفاتر الرئيسية: دليل الحسابات، سطور القيود، الفواتير، العملاء والموردين، الأصناف، الموظفين.
- manifest.json : قائمة المجموعات وعدد السجلات في كل منها.

لم تُصدَّر الأسرار: كلمات المرور (مُجزّأة)، رموز الدخول، أكواد التحقق، أسرار ربط الفاتورة الإلكترونية والمتاجر.
البيانات الشخصية غير مُخفاة لأنها نسختكم الخاصة — احفظوا الملف في مكان آمن.

Company data export from DataLife Account. json/ = one file per collection, excel/ = main ledgers,
manifest.json = record counts. Secrets (password hashes, tokens, OTP codes, ETA/webhook secrets)
are not included. Personal data is NOT masked: keep this file safe.
"""


async def _run(job_id: str, company_id: str, user: dict):
    os.makedirs(EXPORT_DIR, mode=0o700, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix="dlx-")
    final = os.path.join(EXPORT_DIR, f"{company_id}-{job_id}.zip")
    part = final + ".part"

    async def progress(**kw):
        kw["updated_at"] = _now()
        await db[JOBS].update_one({"id": job_id}, {"$set": kw})

    try:
        names = await _collections_for(company_id)
        await progress(status="running", collections_total=len(names) + 1, step="بدء التصدير")
        counts, present = {}, set()
        with zipfile.ZipFile(part, "w", compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
            company = await db.companies.find_one({"id": company_id}, {"_id": 0})
            zf.writestr("json/companies.json", json.dumps([clean(company)] if company else [],
                                                          ensure_ascii=False, default=_json_default))
            for i, name in enumerate(names, 1):
                if name == "companies":
                    continue
                q = {"company_id": company_id}
                if await db[name].count_documents(q, limit=1):
                    counts[name] = await _write_collection(zf, name, q)
                    present.add(name)
                await progress(collections_done=i, step=f"تصدير {name}",
                               progress=int(80 * i / max(1, len(names))),
                               documents=sum(counts.values()))
            await progress(step="إنشاء ملفات Excel", progress=85)
            await _workbooks(zf, company_id, tmp, present)
            manifest = {
                "company_id": company_id,
                "company_name": (company or {}).get("name"),
                "generated_at": _iso(_now()),
                "generated_by": {"id": user.get("id"), "name": user.get("name"), "email": user.get("email")},
                "format": "json/<collection>.json = array of records; excel/ = main ledgers",
                "collections": counts,
                "documents": sum(counts.values()),
                "excluded_collections": sorted(EXCLUDED_COLLECTIONS),
                "excluded_fields": "password hashes, tokens, OTP/2FA codes, ETA/webhook secrets, *_enc/*_encrypted",
            }
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
            zf.writestr("README.txt", README_AR)
        os.replace(part, final)
        os.chmod(final, 0o600)
        size = os.path.getsize(final)
        await progress(status="done", progress=100, step="اكتمل", file_path=final, size=size,
                       documents=sum(counts.values()), collections_done=len(names) + 1,
                       finished_at=_now(), expires_at=_now() + FILE_TTL)
        from services.audit_helper import log_event
        await log_event(db, company_id, user, action="data_export", module="data_export",
                        entity="data_export_jobs", entity_id=job_id,
                        new={"documents": sum(counts.values()), "collections": len(counts), "size": size},
                        description="تصدير كامل لبيانات الشركة")
    except Exception as e:
        logger.exception("data export %s failed", job_id)
        _remove_file(part)
        await progress(status="failed", error=f"تعذّر إنشاء ملف التصدير: {type(e).__name__}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ── endpoints ───────────────────────────────────────────────

@router.post("")
async def start_export(current_user: dict = Depends(get_current_user)):
    user = await _top_user(current_user)
    cid = user["company_id"]
    await purge_expired()
    since = _now() - RATE_WINDOW
    recent = await db[JOBS].find_one(
        {"company_id": cid, "status": {"$ne": "failed"}, "created_at": {"$gte": since}},
        {"_id": 0, "id": 1, "created_at": 1}, sort=[("created_at", -1)])
    if recent:
        wait = int(((_aware(recent["created_at"]) + RATE_WINDOW) - _now()).total_seconds() // 60) + 1
        raise HTTPException(429, f"مسموح بتصدير واحد كل ساعة لكل شركة — حاول بعد {wait} دقيقة "
                                 f"أو حمّل التصدير الأخير")
    job = {"id": str(uuid.uuid4()), "company_id": cid, "status": "queued", "progress": 0,
           "step": "في الانتظار", "collections_total": 0, "collections_done": 0, "documents": 0,
           "size": None, "error": None, "file_path": None, "downloads": 0,
           "requested_by": user["id"], "requested_by_name": user.get("name"),
           "created_at": _now(), "updated_at": _now(), "finished_at": None, "expires_at": None,
           "download_token_hash": None, "token_expires_at": None}
    await db[JOBS].insert_one(dict(job))
    from services.audit_helper import log_event
    await log_event(db, cid, user, action="data_export", module="data_export",
                    entity="data_export_jobs", entity_id=job["id"], description="طلب تصدير بيانات الشركة")
    t = asyncio.create_task(_run(job["id"], cid, user))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
    return _public(job)


@router.get("")
async def list_exports(current_user: dict = Depends(get_current_user)):
    user = await _top_user(current_user)
    await purge_expired()
    rows = await db[JOBS].find({"company_id": user["company_id"]}, {"_id": 0}) \
        .sort("created_at", -1).limit(5).to_list(5)
    return {"jobs": [_public(r) for r in rows], "rate_limit_minutes": 60,
            "file_ttl_hours": 24}


@router.get("/download/{token}")
async def download(token: str):
    """No login header: the browser opens this link. The one-time token is the credential."""
    h = hashlib.sha256(token.encode()).hexdigest()
    job = await db[JOBS].find_one_and_update(
        {"download_token_hash": h, "status": "done", "token_expires_at": {"$gt": _now()}},
        {"$set": {"download_token_hash": None, "token_expires_at": None}, "$inc": {"downloads": 1}})
    if not job or not job.get("file_path") or not os.path.isfile(job["file_path"]):
        raise HTTPException(404, "رابط التحميل غير صالح أو انتهت صلاحيته — اطلب رابطاً جديداً")
    from services.audit_helper import log_event
    await log_event(db, job["company_id"], {"id": job.get("requested_by")},
                    action="data_export_download", module="data_export",
                    entity="data_export_jobs", entity_id=job["id"], description="تحميل ملف تصدير البيانات")
    stamp = _aware(job.get("finished_at")) or _now()
    return FileResponse(job["file_path"], media_type="application/zip",
                        filename=f"datalife-export-{stamp:%Y%m%d-%H%M}.zip",
                        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/{job_id}")
async def export_status(job_id: str, current_user: dict = Depends(get_current_user)):
    user = await _top_user(current_user)
    await purge_expired()
    job = await db[JOBS].find_one({"id": job_id, "company_id": user["company_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "عملية التصدير غير موجودة")
    return _public(job)


@router.post("/{job_id}/link")
async def download_link(job_id: str, current_user: dict = Depends(get_current_user)):
    user = await _top_user(current_user)
    await purge_expired()
    job = await db[JOBS].find_one({"id": job_id, "company_id": user["company_id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "عملية التصدير غير موجودة")
    if job.get("status") != "done" or not job.get("file_path"):
        raise HTTPException(409, "ملف التصدير غير جاهز أو انتهت صلاحيته (يُحذف بعد 24 ساعة)")
    token = secrets.token_urlsafe(32)
    await db[JOBS].update_one({"id": job_id}, {"$set": {
        "download_token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "token_expires_at": _now() + LINK_TTL}})
    return {"url": f"/api/data-export/download/{token}", "expires_in_seconds": int(LINK_TTL.total_seconds())}
