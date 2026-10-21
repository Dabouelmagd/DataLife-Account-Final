"""
Egyptian Tax Authority (ETA) E-Invoice API Integration
تكامل الفاتورة الإلكترونية مع مصلحة الضرائب المصرية
"""

import os
import base64
import logging
import httpx
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Header, UploadFile, File, Form
from pydantic import BaseModel, Field

from database import db
from services.auth_service import verify_token
from models.eta_settings import (
    CompanyETASettings, ETAEnvironment, ETASubmission, 
    ETADocumentStatus, ETATokenCache
)

router = APIRouter(prefix="/api/eta", tags=["ETA Integration"])

ADMIN_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام", "المدير العام",
               "CEO", "المدير التنفيذي", "Financial Manager", "المدير المالي", "Super Admin", "admin", "owner"}


def get_eta_base_url(environment: str) -> str:
    """ETA API root incl. version. Accepts both spellings used in settings
    ('preprod' in the submit path, 'preproduction' as this default)."""
    env = (environment or "").lower()
    host = ("https://api.preprod.invoicing.eta.gov.eg"
            if env in ("preprod", "preproduction", "sandbox", "test")
            else "https://api.invoicing.eta.gov.eg")
    return f"{host}/api/v1.0"
logger = logging.getLogger(__name__)


async def get_current_user(authorization: Optional[str] = Header(None)):
    """Dependency to get current user from JWT token"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid authentication scheme")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return payload


# ==========================================
# Pydantic Models for API
# ==========================================

class ETASettingsUpdateRequest(BaseModel):
    """طلب تحديث إعدادات ETA"""
    tax_registration_number: Optional[str] = None
    branch_id: Optional[str] = None
    activity_code: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    environment: Optional[str] = None
    is_active: Optional[bool] = None
    auto_submit_invoices: Optional[bool] = None
    # issuer as registered with the authority — every document carries it
    issuer_name: Optional[str] = None
    governate: Optional[str] = None
    region_city: Optional[str] = None
    street: Optional[str] = None
    building_number: Optional[str] = None
    postal_code: Optional[str] = None
    item_code_type: Optional[str] = None          # EGS | GS1
    # signing: "pkcs12" (eSeal file uploaded below) or "pkcs11" (token/HSM)
    signing_mode: Optional[str] = None
    pkcs11_library: Optional[str] = None
    token_label: Optional[str] = None
    key_label: Optional[str] = None
    token_pin: Optional[str] = None


class TestConnectionRequest(BaseModel):
    """طلب اختبار الاتصال"""
    client_id: str
    client_secret: str
    environment: str = "preprod"


class SubmitInvoiceRequest(BaseModel):
    """طلب إرسال فاتورة"""
    invoice_id: str


# ==========================================
# Helper Functions
# ==========================================

async def get_eta_settings(company_id: str) -> dict:
    """الحصول على إعدادات ETA للشركة"""
    settings = await db.company_eta_settings.find_one(
        {"company_id": company_id}, 
        {"_id": 0}
    )
    if not settings:
        # إنشاء إعدادات افتراضية
        default_settings = CompanyETASettings(company_id=company_id)
        await db.company_eta_settings.insert_one(default_settings.dict())
        settings = default_settings.dict()
    return settings


async def get_eta_token(company_id: str, settings: dict) -> str:
    """الحصول على توكن ETA (مع الكاش)"""
    # التحقق من الكاش
    cached = await db.eta_token_cache.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if cached and datetime.fromisoformat(str(cached["expires_at"])) > datetime.utcnow():
        return cached["access_token"]
    
    # طلب توكن جديد
    identity_url = (
        "https://id.preprod.eta.gov.eg" 
        if settings.get("environment") == "preprod" 
        else "https://id.eta.gov.eg"
    )
    
    token_endpoint = f"{identity_url}/connect/token"
    
    credentials = f"{settings['client_id']}:{_secret(settings.get('client_secret'))}"
    encoded = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    payload = {
        "grant_type": "client_credentials",
        "scope": "InvoicingAPI"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(token_endpoint, headers=headers, data=payload)
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=400, 
                detail=f"فشل الحصول على التوكن: {response.text}"
            )
        
        token_data = response.json()
        
        # حفظ في الكاش
        expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"] - 60)
        
        await db.eta_token_cache.update_one(
            {"company_id": company_id},
            {"$set": {
                "company_id": company_id,
                "access_token": token_data["access_token"],
                "token_type": token_data.get("token_type", "Bearer"),
                "expires_at": expires_at,
                "created_at": datetime.utcnow()
            }},
            upsert=True
        )
        
        return token_data["access_token"]


def _qr_png(text: str) -> dict:
    """The printed invoice's QR image, now pointing at the authority's portal."""
    try:
        import io, qrcode
        img = qrcode.make(text)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return {"qr_code": base64.b64encode(buf.getvalue()).decode()}
    except Exception:
        return {}


def _secret(value) -> str:
    """Secrets are stored encrypted (enc: prefix); older rows hold plain text."""
    v = str(value or "")
    if v.startswith("enc:"):
        from services.eta_signer import decrypt
        return decrypt(v[4:]).decode()
    return v


def _protect(value: str) -> str:
    from services.eta_signer import encrypt
    return "enc:" + encrypt(value.encode())


async def _signer_for(settings: dict):
    """(cert_der, rsa_sign) for the company's eSeal."""
    from services import eta_signer
    mode = settings.get("signing_mode") or ("pkcs12" if settings.get("certificate_p12") else "")
    if mode == "pkcs12":
        if not settings.get("certificate_p12"):
            raise HTTPException(400, "ارفع ملف شهادة الختم الإلكتروني (.pfx) من إعدادات المنظومة")
        pfx = eta_signer.decrypt(settings["certificate_p12"])
        return eta_signer.pkcs12_signer(pfx, _secret(settings.get("certificate_password")))
    if mode == "pkcs11":
        if not settings.get("pkcs11_library"):
            raise HTTPException(400, "حدّد مسار مكتبة PKCS#11 الخاصة بالتوكن")
        return eta_signer.pkcs11_signer(settings["pkcs11_library"], _secret(settings.get("token_pin")),
                                        settings.get("token_label"), settings.get("key_label"))
    raise HTTPException(400, "لم تُضبط شهادة التوقيع — المنظومة ترفض المستندات غير الموقَّعة (الإصدار 1.0)")


async def _note_original_uuid(company_id: str, note: dict, settings: dict) -> str:
    """A credit/debit note goes to the authority as document type C/D whose
    "references" carry the original invoice's ETA uuid. The original must be
    our own SALES invoice, accepted (Valid) by the authority, not cancelled
    there, issued by the same taxpayer to the same receiver; the note's own
    lines are sent (partial quantities are fine) and must be positive."""
    if not note.get("original_invoice_id"):
        raise HTTPException(400, "الإشعار غير مرتبط بفاتورة أصلية — لا يُرسل للمنظومة")
    orig = await db.invoices.find_one({"id": note["original_invoice_id"], "company_id": company_id}, {"_id": 0})
    if not orig:
        raise HTTPException(400, "الفاتورة الأصلية للإشعار غير موجودة")
    if orig.get("document_type") != "sales_invoice":
        raise HTTPException(400, "الإشعار على فاتورة شراء لا يُرسل للمنظومة — يرسله المورد على فاتورته")
    uuid_ = orig.get("eta_uuid") or orig.get("eta_document_uuid")
    st = str(orig.get("eta_status") or "").lower()
    if not uuid_:
        raise HTTPException(400, f"الفاتورة الأصلية {orig.get('document_number')} لم تُرسل للمنظومة — أرسلها أولاً")
    if st == "cancelled":
        raise HTTPException(400, "الفاتورة الأصلية ملغاة على المنظومة — لا يُرسل عليها إشعار")
    if st != "valid":
        raise HTTPException(400, f"الفاتورة الأصلية حالتها على المنظومة «{orig.get('eta_status')}» — "
                                 "الإشعار يُرسل بعد قبولها (Valid). حدّث حالتها من «مزامنة الحالة»")
    if note.get("party_id") != orig.get("party_id"):
        raise HTTPException(400, "مستلم الإشعار يجب أن يكون عميل الفاتورة الأصلية نفسه")
    tin = str(settings.get("tax_registration_number") or "").strip()
    if orig.get("eta_issuer_id") and str(orig["eta_issuer_id"]) != tin:
        raise HTTPException(400, "رقم التسجيل الضريبي للمُصدِر تغيّر منذ إرسال الفاتورة الأصلية — "
                                 "الإشعار يصدر من نفس المُصدِر")
    lines = note.get("lines") or []
    if not lines or any(float(l.get("quantity") or 0) <= 0 or float(l.get("unit_price") or 0) < 0 for l in lines) \
            or float(note.get("grand_total") or 0) <= 0:
        raise HTTPException(400, "مبالغ وكميات الإشعار تُرسل موجبة (نوع المستند C/D يحدد الاتجاه)")
    return uuid_


async def prepare_signed_document(company_id: str, invoice: dict, settings: dict) -> tuple:
    """(document with signature, canonical string). Raises 400 in Arabic on
    anything the authority would reject."""
    from services.eta_document import build_document, serialize, ETADocumentError
    from services.eta_validation import validate_party
    from services.eta_signer import sign_canonical, ETASigningError
    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    party = {}
    if invoice.get("party_id"):
        party = await db.parties.find_one({"id": invoice["party_id"], "company_id": company_id}, {"_id": 0}) or {}
    check = validate_party(invoice, party)
    if not check["ok"]:
        raise HTTPException(400, check["error"])
    receiver = {"type": check["type"], "id": check["id"],
                "name": party.get("name") or invoice.get("party_name", ""),
                "country": party.get("country") or "EG", "governate": party.get("governate"),
                "city": party.get("city"), "street": party.get("address"),
                "building_number": party.get("building_number")}
    ids = [l.get("product_id") for l in invoice.get("lines", []) if l.get("product_id")]
    products = {p["id"]: p async for p in db.products.find(
        {"company_id": company_id, "id": {"$in": ids}}, {"_id": 0})} if ids else {}
    original_uuid = None
    if invoice.get("document_type") in ("credit_note", "debit_note"):
        original_uuid = await _note_original_uuid(company_id, invoice, settings)
    try:
        doc = build_document(invoice, settings, company.get("name", ""), receiver, products, original_uuid)
        canonical = serialize(doc)
        cert_der, rsa_sign = await _signer_for(settings)
        doc["signatures"] = [{"signatureType": "I", "value": sign_canonical(canonical, cert_der, rsa_sign)}]
    except (ETADocumentError, ETASigningError) as e:
        raise HTTPException(400, str(e))
    return doc, canonical


async def submit_to_eta(company_id: str, invoice_id: str, user: dict) -> dict:
    """The one submission path: build, serialize, sign, send, record."""
    from services.eta_document import to_json, public_url
    settings = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings or not settings.get("is_active"):
        raise HTTPException(400, "تكامل ETA غير مفعل. يرجى تفعيله من الإعدادات")
    if not settings.get("client_id") or not settings.get("client_secret"):
        raise HTTPException(400, "بيانات اعتماد ETA غير مكتملة")
    invoice = await db.invoices.find_one({"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")
    if invoice.get("status") not in ("approved", "paid", "partially_paid"):
        raise HTTPException(400, "يجب اعتماد الفاتورة قبل إرسالها لمصلحة الضرائب")
    if str(invoice.get("eta_status") or "").lower() in ("submitted", "valid"):
        raise HTTPException(400, "تم إرسال هذه الفاتورة مسبقاً")

    doc, canonical = await prepare_signed_document(company_id, invoice, settings)
    token = await get_eta_token(company_id, settings)
    base = get_eta_base_url(settings.get("environment", "preprod"))
    async with httpx.AsyncClient(timeout=60.0) as client:
        # the body is sent as built: the numbers in it are the text that was signed
        response = await client.post(f"{base}/documentsubmissions",
                                     content=('{"documents":[' + to_json(doc) + ']}').encode("utf-8"),
                                     headers={"Authorization": f"Bearer {token}",
                                              "Content-Type": "application/json; charset=utf-8",
                                              "Accept": "application/json"})
    try:
        result = response.json()
    except Exception:
        result = {"raw": response.text[:1000]}
    now = datetime.now(timezone.utc).isoformat()
    record = {"id": str(uuid.uuid4()), "company_id": company_id, "invoice_id": invoice_id,
              "invoice_number": invoice.get("document_number"), "http_status": response.status_code,
              "response": result, "submitted_at": now, "submitted_by": user.get("email") or user.get("user_id"),
              "created_at": now}
    accepted = (result.get("acceptedDocuments") or []) if isinstance(result, dict) else []
    rejected = (result.get("rejectedDocuments") or []) if isinstance(result, dict) else []
    if response.status_code in (200, 202) and accepted:
        d = accepted[0]
        sub_id = result.get("submissionId") or result.get("submissionUUID")
        qr = public_url(settings.get("environment", "preprod"), d.get("uuid"), d.get("longId"))
        record.update({"status": "submitted", "submission_uuid": sub_id, "document_uuid": d.get("uuid"),
                       "long_id": d.get("longId")})
        await db.eta_submissions.insert_one(record)
        await db.invoices.update_one({"id": invoice_id, "company_id": company_id}, {"$set": {
            "eta_status": "Submitted", "eta_submission_id": sub_id, "eta_submission_uuid": sub_id,
            "eta_uuid": d.get("uuid"), "eta_document_uuid": d.get("uuid"), "eta_long_id": d.get("longId"),
            "eta_hash_key": d.get("hashKey"), "eta_submission_date": now, "eta_public_url": qr,
            "eta_issuer_id": doc.get("issuer", {}).get("id"), "eta_references": doc.get("references"),
            "eta_qr": qr, "eta_rejection_reason": None, **_qr_png(qr)}})
        return {"success": True, "message": "تم إرسال الفاتورة — المنظومة تتحقق منها خلال دقائق",
                "submission_uuid": sub_id, "document_uuid": d.get("uuid"), "long_id": d.get("longId"),
                "public_url": qr}
    # rejected: say why, in the authority's own words
    errs = []
    for r in rejected:
        e = r.get("error") or {}
        errs += [f"{x.get('propertyPath', '')}: {x.get('message', '')}" for x in (e.get("details") or [])] \
            or [e.get("message", "")]
    if not errs and isinstance(result, dict):
        err = result.get("error")
        errs = [err.get("message") if isinstance(err, dict) else (err or result.get("message") or result.get("raw") or "")]
    record.update({"status": "rejected", "errors": errs})
    await db.eta_submissions.insert_one(record)
    await db.invoices.update_one({"id": invoice_id, "company_id": company_id}, {"$set": {
        "eta_status": "Rejected", "eta_rejection_reason": "؛ ".join(e for e in errs if e)[:1000]}})
    raise HTTPException(400, "رفضت المنظومة الفاتورة: " + ("؛ ".join(e for e in errs if e) or f"HTTP {response.status_code}"))


# ==========================================
# API Endpoints
# ==========================================

@router.get("/settings")
async def get_company_eta_settings(current_user: dict = Depends(get_current_user)):
    """الحصول على إعدادات ETA للشركة"""
    settings = await get_eta_settings(current_user["company_id"])
    
    # إخفاء Client Secret جزئياً
    if settings.get("client_secret"):
        secret = settings["client_secret"]
        if len(secret) > 8:
            settings["client_secret_masked"] = "••••••••" if secret.startswith("enc:") else \
            secret[:4] + "*" * (len(secret) - 8) + secret[-4:]
        else:
            settings["client_secret_masked"] = "****"
        # لا نرسل السر الكامل
        del settings["client_secret"]
    for k in ("certificate_p12", "certificate_password", "token_pin"):
        if settings.pop(k, None):
            settings[f"{k}_set"] = True
    
    return settings


@router.put("/settings")
async def update_company_eta_settings(
    request: ETASettingsUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات ETA للشركة"""
    company_id = current_user["company_id"]
    
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "إعدادات المنظومة لمدير الشركة أو المدير المالي")
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    for k in ("client_secret", "token_pin"):
        if k in update_data and not str(update_data[k]).strip():
            update_data.pop(k)            # an empty box means "unchanged", never "erase"
    for k in ("client_secret", "token_pin"):
        if update_data.get(k):
            update_data[k] = _protect(update_data[k])
    if "signing_mode" in update_data and update_data["signing_mode"] not in ("pkcs12", "pkcs11"):
        raise HTTPException(400, "signing_mode: pkcs12 | pkcs11")
    if "environment" in update_data and update_data["environment"] not in ("preprod", "production"):
        raise HTTPException(400, "environment: preprod | production")
    update_data["updated_at"] = datetime.utcnow()
    
    await db.company_eta_settings.update_one(
        {"company_id": company_id},
        {"$set": update_data},
        upsert=True
    )
    
    # إذا تم تغيير بيانات الاعتماد، حذف الكاش
    if "client_id" in update_data or "client_secret" in update_data:
        await db.eta_token_cache.delete_one({"company_id": company_id})
    
    return {"message": "تم تحديث إعدادات ETA بنجاح"}


@router.post("/test-connection")
async def test_eta_connection(
    request: TestConnectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """اختبار الاتصال مع ETA"""
    company_id = current_user["company_id"]
    
    identity_url = (
        "https://id.preprod.eta.gov.eg" 
        if request.environment == "preprod" 
        else "https://id.eta.gov.eg"
    )
    
    token_endpoint = f"{identity_url}/connect/token"
    
    credentials = f"{request.client_id}:{request.client_secret}"
    encoded = base64.b64encode(credentials.encode()).decode()
    
    headers = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    payload = {
        "grant_type": "client_credentials",
        "scope": "InvoicingAPI"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(token_endpoint, headers=headers, data=payload)
            
            if response.status_code == 200:
                # تحديث حالة الاتصال
                await db.company_eta_settings.update_one(
                    {"company_id": company_id},
                    {"$set": {
                        "last_connection_test": datetime.utcnow(),
                        "connection_status": "connected"
                    }}
                )
                return {
                    "success": True,
                    "message": "تم الاتصال بنجاح مع مصلحة الضرائب",
                    "environment": request.environment
                }
            else:
                error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
                await db.company_eta_settings.update_one(
                    {"company_id": company_id},
                    {"$set": {
                        "last_connection_test": datetime.utcnow(),
                        "connection_status": "failed"
                    }}
                )
                return {
                    "success": False,
                    "message": "فشل الاتصال",
                    "error": error_data.get("error_description", error_data.get("error", "خطأ غير معروف"))
                }
    except Exception as e:
        logger.error(f"ETA connection test failed: {str(e)}")
        return {
            "success": False,
            "message": "فشل الاتصال",
            "error": str(e)
        }


@router.post("/submit-invoice")
async def submit_invoice_to_eta(request: SubmitInvoiceRequest, current_user: dict = Depends(get_current_user)):
    """إرسال فاتورة إلى مصلحة الضرائب"""
    return await submit_to_eta(current_user["company_id"], request.invoice_id, current_user)


@router.post("/submit/{invoice_id}")
async def submit_invoice_by_id(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """إرسال فاتورة إلى مصلحة الضرائب باستخدام معرف الفاتورة"""
    return await submit_to_eta(current_user["company_id"], invoice_id, current_user)


@router.post("/preview/{invoice_id}")
async def preview_signed_document(invoice_id: str, current_user: dict = Depends(get_current_user)):
    """المستند كما سيُرسل (موقَّعاً) والنص الموحَّد — للمراجعة قبل الإرسال، بلا إرسال."""
    company_id = current_user["company_id"]
    settings = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    invoice = await db.invoices.find_one({"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")
    doc, canonical = await prepare_signed_document(company_id, invoice, settings)
    return {"document": doc, "canonical": canonical}


@router.post("/certificate")
async def upload_certificate(file: UploadFile = File(...), password: str = Form(""),
                             current_user: dict = Depends(get_current_user)):
    """رفع شهادة الختم الإلكتروني (.pfx / .p12) — تُحفظ مشفّرة."""
    from services import eta_signer
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "رفع الشهادة لمدير الشركة أو المدير المالي")
    data = await file.read()
    if not data or len(data) > 64 * 1024:
        raise HTTPException(400, "ملف الشهادة غير صالح")
    try:
        cert_der, _ = eta_signer.pkcs12_signer(data, password)
    except eta_signer.ETASigningError as e:
        raise HTTPException(400, str(e))
    info = eta_signer.certificate_info(cert_der)
    await db.company_eta_settings.update_one({"company_id": current_user["company_id"]}, {"$set": {
        "certificate_p12": eta_signer.encrypt(data), "certificate_password": _protect(password),
        "certificate_info": info, "signing_mode": "pkcs12", "updated_at": datetime.utcnow()}}, upsert=True)
    return {"message": "تم حفظ شهادة التوقيع", "certificate": info}


@router.get("/submission-status/{submission_uuid}")
async def get_submission_status(
    submission_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على حالة الإرسال"""
    company_id = current_user["company_id"]
    
    settings = await db.company_eta_settings.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not settings or not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="تكامل ETA غير مفعل")
    
    try:
        token = await get_eta_token(company_id, settings)
        
        base_url = (
            "https://api.preprod.invoicing.eta.gov.eg" 
            if settings.get("environment") == "preprod" 
            else "https://api.invoicing.eta.gov.eg"
        )
        
        status_endpoint = f"{base_url}/api/v1.0/documentsubmissions/{submission_uuid}"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(status_endpoint, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # تحديث سجل الإرسال المحلي
                await db.eta_submissions.update_one(
                    {"submission_uuid": submission_uuid, "company_id": company_id},
                    {"$set": {
                        "eta_status": data.get("overallStatus"),
                        "updated_at": datetime.utcnow()
                    }}
                )
                
                return {
                    "submission_uuid": data.get("uuid"),
                    "overall_status": data.get("overallStatus"),
                    "date_received": data.get("dateTimeReceived"),
                    "document_count": data.get("documentCount"),
                    "documents": data.get("documentSummary", [])
                }
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.text
                )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting submission status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions")
async def get_eta_submissions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على سجل الإرسالات"""
    company_id = current_user["company_id"]
    
    query = {"company_id": company_id}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    
    submissions = await db.eta_submissions.find(query, {"_id": 0}).sort(
        "created_at", -1
    ).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.eta_submissions.count_documents(query)
    
    return {
        "submissions": submissions,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit
    }


ETA_CANCEL_WINDOW_DAYS = 7      # the authority's default; settings.cancel_window_days overrides


def _cancel_window_open(invoice: dict, days: int, now: Optional[datetime] = None) -> bool:
    """The issuer may cancel within `days` of the document being received
    (we keep the submission time). Unknown time → let the authority decide."""
    raw = invoice.get("eta_validated_at") or invoice.get("eta_submission_date")
    if not raw:
        return True
    try:
        t = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return True
    if t.tzinfo is None:
        t = t.replace(tzinfo=timezone.utc)
    return (now or datetime.now(timezone.utc)) - t <= timedelta(days=days)


@router.post("/cancel/{invoice_id}")
async def cancel_invoice_on_eta_post(invoice_id: str, body: dict = Body(default={}),
                                     current_user: dict = Depends(get_current_user)):
    """نفس الإلغاء — بالسبب في جسم الطلب {"reason": "..."}"""
    return await cancel_invoice_on_eta(invoice_id, (body or {}).get("reason") or "إلغاء الفاتورة", current_user)


@router.put("/cancel/{invoice_id}")
async def cancel_invoice_on_eta(
    invoice_id: str,
    reason: str = "إلغاء الفاتورة",
    current_user: dict = Depends(get_current_user)
):
    """إلغاء فاتورة على منظومة ETA: PUT documents/state/{uuid}/state
    {"status": "cancelled", "reason"} خلال مهلة الإلغاء (7 أيام افتراضياً).

    Built from the authority's SDK description; not yet exercised against the
    live / pre-production system."""
    company_id = current_user["company_id"]
    invoice = await db.invoices.find_one({"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    
    doc_uuid = invoice.get("eta_uuid") or invoice.get("eta_document_uuid")
    if not doc_uuid:
        raise HTTPException(status_code=400, detail="الفاتورة لم تُرسل إلى ETA بعد")
    
    current_eta_status = invoice.get("eta_status", "")
    if current_eta_status in ("Cancelled", "cancelled"):
        raise HTTPException(status_code=400, detail="الفاتورة ملغاة بالفعل")
    if current_eta_status not in ("Valid", "Submitted", "submitted", "valid"):
        raise HTTPException(status_code=400,
            detail=f"لا يمكن إلغاء فاتورة بحالة '{current_eta_status}'")
    
    if not str(reason or "").strip():
        raise HTTPException(status_code=400, detail="سبب الإلغاء مطلوب")
    if await db.invoices.find_one({"company_id": company_id, "original_invoice_id": invoice_id,
                                   "document_type": {"$in": ["credit_note", "debit_note"]},
                                   "eta_status": {"$in": ["Submitted", "Valid", "submitted", "valid"]}}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="على الفاتورة إشعارات مُرسلة للمنظومة — ألغِ الإشعارات أولاً "
                                                    "أو صحّح بإشعار دائن")
    settings = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="إعدادات ETA غير مكتملة")
    window = int(settings.get("cancel_window_days") or ETA_CANCEL_WINDOW_DAYS)
    if not _cancel_window_open(invoice, window):
        raise HTTPException(status_code=400, detail=(
            f"انتهت مهلة الإلغاء على المنظومة ({window} أيام من الإرسال) — صحّح الفاتورة بإشعار دائن"))
    
    try:
        token = await get_eta_token(company_id, settings)
        base_url = get_eta_base_url(settings.get("environment", "preproduction"))
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.put(
                f"{base_url}/documents/state/{doc_uuid}/state",
                headers={"Authorization": f"Bearer {token}",
                         "Content-Type": "application/json"},
                json={"status": "cancelled", "reason": reason}
            )
        
        if response.status_code in (200, 202):
            await db.invoices.update_one(
                {"id": invoice_id, "company_id": company_id},
                {"$set": {
                    "eta_status":         "Cancelled",   # SQL: eta_status = 'Cancelled'
                    "eta_cancelled_date": datetime.now(timezone.utc).isoformat(),
                    "eta_cancel_reason":  reason,
                    "status":             "cancelled",
                }}
            )
            return {"message": "تم إلغاء الفاتورة على منظومة ETA", "eta_status": "Cancelled"}
        else:
            raise HTTPException(status_code=response.status_code,
                detail=f"خطأ من ETA: {response.text[:200]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ في الاتصال بـ ETA: {str(e)}")


@router.post("/sync-status/{invoice_id}")
async def sync_eta_status(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """مزامنة حالة الفاتورة من ETA — يُحدِّث eta_status في قاعدة البيانات"""
    company_id = current_user["company_id"]
    invoice = await db.invoices.find_one({"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    
    doc_uuid = invoice.get("eta_uuid") or invoice.get("eta_document_uuid")
    if not doc_uuid:
        return {"message": "الفاتورة لم تُرسل إلى ETA", "eta_status": "Pending"}
    
    settings = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0})
    
    try:
        token = await get_eta_token(company_id, settings)
        base_url = get_eta_base_url(settings.get("environment", "preproduction"))
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{base_url}/documents/{doc_uuid}/details",
                headers={"Authorization": f"Bearer {token}"}
            )
        
        if response.status_code == 200:
            data = response.json()
            # Map ETA status to SQL ENUM values
            eta_raw    = data.get("status", "").lower()
            STATUS_MAP = {
                "valid":     "Valid",
                "invalid":   "Invalid",
                "cancelled": "Cancelled",
                "submitted": "Submitted",
                "rejected":  "Invalid",  # map rejected→Invalid for SQL compat
            }
            new_status = STATUS_MAP.get(eta_raw, invoice.get("eta_status", "Pending"))
            
            await db.invoices.update_one(
                {"id": invoice_id},
                {"$set": {
                    "eta_status":    new_status,
                    "eta_long_id":   data.get("longId", invoice.get("eta_long_id")),
                    # the portal link the printed QR opens
                    **({"eta_public_url": data["publicUrl"], "eta_qr": data["publicUrl"], **_qr_png(data["publicUrl"])}
                       if data.get("publicUrl") else {}),
                    "eta_hash_key":  data.get("hashKey", invoice.get("eta_hash_key")),
                }}
            )
            return {
                "message":    "تم تحديث حالة الفاتورة",
                "eta_status": new_status,
                "eta_uuid":   doc_uuid,
                "raw_status": eta_raw,
            }
        else:
            raise HTTPException(status_code=response.status_code,
                detail=f"لم يتمكن من جلب حالة الفاتورة من ETA")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطأ: {str(e)}")


@router.get("/document/{document_uuid}")
async def get_document_details(
    document_uuid: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على تفاصيل المستند من ETA"""
    company_id = current_user["company_id"]
    
    settings = await db.company_eta_settings.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not settings or not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="تكامل ETA غير مفعل")
    
    try:
        token = await get_eta_token(company_id, settings)
        
        base_url = (
            "https://api.preprod.invoicing.eta.gov.eg" 
            if settings.get("environment") == "preprod" 
            else "https://api.invoicing.eta.gov.eg"
        )
        
        details_endpoint = f"{base_url}/api/v1.0/documents/{document_uuid}/details"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(details_endpoint, headers=headers)
            
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=response.text
                )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
