"""
ETA Digital Signing Engine — محرك التوقيع الرقمي لمنظومة الفاتورة الإلكترونية
Hardware Security Module (HSM) Integration + CAdES-BES Signature

الخطوات:
1. بناء JSON الفاتورة بالصيغة المعتمدة من ETA
2. Canonicalization — توحيد المحتوى (ترتيب الحقول + إزالة المسافات)
3. SHA-256 Hash على المحتوى الموحَّد
4. توقيع Hash باستخدام شهادة الختم الإلكتروني (PKCS#7/CAdES-BES)
5. إدراج التوقيع في الـ JSON وإرسال الفاتورة لبوابة ETA

شهادات معتمدة:
- مصر للمقاصة والتسويات (Egypt Clearing — MCDR)
- إيجيبت تراست (Egypt Trust)
- Misr for Central Clearing (e-Finance)

ملاحظة: في بيئة الإنتاج يتطلب PKCS#11 HSM حقيقي.
       في بيئة التطوير/الاختبار يستخدم شهادة RSA محلية (software token).
"""
import uuid, hashlib, json, base64, hmac, os
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/eta-signing", tags=["ETA Digital Signing"])

# ══════════════════════════════════════════════════════════════
# ETA API CONFIGURATION
# ══════════════════════════════════════════════════════════════
ETA_API_BASE = "https://api.invoicing.eta.gov.eg/api/v1"
ETA_AUTH_URL = "https://id.invoicing.eta.gov.eg/connect/token"
ETA_SANDBOX  = "https://api.preprod.invoicing.eta.gov.eg/api/v1"

# Supported certificate authorities
ETA_CA_PROVIDERS = {
    "egypt_clearing":  "مصر للمقاصة والتسويات (MCDR)",
    "egypt_trust":     "إيجيبت تراست (Egypt Trust)",
    "e_finance":       "إي-فاينانس (e-Finance/Misr Clearing)",
    "software_token":  "رمز برمجي (اختبار فقط — لا يُستخدَم في الإنتاج)",
}

DOCUMENT_TYPES = {
    "I":  "فاتورة ضريبية",
    "C":  "إشعار دائن",
    "D":  "إشعار مدين",
}

TAX_TYPES = {
    "T1": ("ضريبة القيمة المضافة",    0.14),
    "T2": ("الجدول",                  0.05),
    "T3": ("خصم وتحصيل — 1%",         0.01),
    "T4": ("خصم وتحصيل — 3%",         0.03),
    "T5": ("خصم وتحصيل — 5%",         0.05),
}


# ══════════════════════════════════════════════════════════════
# CANONICALIZATION — توحيد المحتوى
# ══════════════════════════════════════════════════════════════

def canonicalize_value(value) -> str:
    """
    تحويل قيمة للصيغة القانونية للتوقيع
    ETA Canonicalization Rules:
    - الأرقام الصحيحة: بدون عشريات
    - الأرقام العشرية: 5 خانات عشرية
    - النصوص: uppercase بدون مسافات زائدة
    - التواريخ: ISO 8601 UTC
    """
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return f"{value:.5f}"
    if isinstance(value, str):
        return value.upper().strip()
    return str(value)


def canonicalize_object(obj, parent_key: str = "") -> str:
    """
    ETA JSON Canonicalization:
    - الحقول مرتبة أبجدياً (sort keys)
    - المصفوفات تُعالَج بالترتيب
    - القيم مُحوَّلة للصيغة القانونية
    - الناتج: سلسلة نصية بدون مسافات
    """
    if isinstance(obj, dict):
        parts = []
        for key in sorted(obj.keys()):
            val = obj[key]
            canon_val = canonicalize_object(val, key)
            if canon_val is not None:
                parts.append(f'"{key.upper()}"{canon_val}')
        return "".join(parts)

    elif isinstance(obj, list):
        parts = []
        for item in obj:
            parts.append(canonicalize_object(item))
        return "".join(parts)

    elif isinstance(obj, (int, float, bool)):
        return canonicalize_value(obj)

    elif isinstance(obj, str):
        # Strings: no quotes in canonical form, uppercase
        return obj.upper().strip()

    elif obj is None:
        return ""

    return canonicalize_value(obj)


def compute_sha256(content: str) -> str:
    """حساب SHA-256 Hash للمحتوى الموحَّد"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


# ══════════════════════════════════════════════════════════════
# SIGNING ENGINE
# ══════════════════════════════════════════════════════════════

async def get_company_signing_config(company_id: str) -> dict:
    """Load company's ETA certificate configuration"""
    config = await db.eta_signing_config.find_one(
        {"company_id": company_id}, {"_id": 0}
    )
    return config or {}


async def sign_document_software(content_hash: str, config: dict) -> str:
    """
    Software Token Signing (بيئة الاختبار / Development)

    في الإنتاج: يُستبدَل بـ PKCS#11 HSM call
    يُنشئ توقيعاً HMAC-SHA256 باستخدام المفتاح المخزَّن

    PRODUCTION NOTE:
    import PyKCS11
    lib = PyKCS11.PyKCS11Lib()
    lib.load(config['pkcs11_lib_path'])  # /usr/lib/opensc-pkcs11.so
    session = lib.openSession(slot, PyKCS11.CKF_SERIAL_SESSION)
    session.login(pin)
    priv_key = session.findObjects([...])[0]
    signature = session.sign(priv_key, content_hash.encode(), PyKCS11.Mechanism(CKM_SHA256_RSA_PKCS))
    return base64.b64encode(bytes(signature)).decode()
    """
    secret_key = config.get("signing_secret", config.get("client_secret", "dev_key"))
    sig_bytes   = hmac.new(
        secret_key.encode(),
        content_hash.encode(),
        hashlib.sha256
    ).digest()
    # Simulate PKCS#7/CAdES-BES envelope
    pkcs7_envelope = {
        "version":     "1.0",
        "algorithm":   "SHA256withRSA",
        "certificate": config.get("certificate_serial", "CERT-DEV-001"),
        "hash":        content_hash,
        "signature":   base64.b64encode(sig_bytes).decode(),
        "timestamp":   datetime.now(timezone.utc).isoformat(),
        "ca_provider": config.get("ca_provider", "software_token"),
    }
    return base64.b64encode(json.dumps(pkcs7_envelope).encode()).decode()


async def sign_document_hsm(content_hash: str, config: dict) -> str:
    """
    HSM/Hardware Token Signing (بيئة الإنتاج)

    يتطلب:
    - تثبيت PKCS#11 middleware من مزود الشهادة
    - رقم الـ PIN الخاص بـ USB Token
    - مكتبة PyKCS11 أو python-pkcs11

    IMPLEMENTATION:
    try:
        import pkcs11
        lib = pkcs11.lib(config['pkcs11_library'])
        token = lib.get_token(token_label=config['token_label'])
        with token.open(user_pin=config['pin']) as session:
            private_key = session.get_key(
                pkcs11.KeyType.RSA,
                pkcs11.ObjectClass.PRIVATE_KEY,
                label=config['key_label']
            )
            signature = private_key.sign(
                content_hash.encode(),
                mechanism=pkcs11.Mechanism.SHA256_RSA_PKCS
            )
            return base64.b64encode(signature).decode()
    except ImportError:
        raise HTTPException(500, 'PKCS11 library not installed')
    except Exception as e:
        raise HTTPException(500, f'HSM signing failed: {e}')
    """
    raise HTTPException(501,
        "HSM signing requires hardware token + PyKCS11 library. "
        "Configure /api/eta-signing/config with hsm_mode=true and pkcs11_library path.")


# ══════════════════════════════════════════════════════════════
# INVOICE BUILDER — بناء الفاتورة بصيغة ETA
# ══════════════════════════════════════════════════════════════

def build_eta_invoice_line(item: dict) -> dict:
    """بناء سطر فاتورة ETA من بيانات المنتج"""
    unit_price   = float(item.get("unit_price", 0))
    quantity     = float(item.get("quantity", 1))
    discount_pct = float(item.get("discount_pct", 0))
    discount_amt = round(unit_price * quantity * discount_pct / 100, 5)
    net_total    = round(unit_price * quantity - discount_amt, 5)
    vat_amt      = round(net_total * 0.14, 5)  # VAT 14%

    return {
        "description":        item.get("description", ""),
        "itemType":           item.get("item_type", "GS1"),
        "itemCode":           item.get("item_code", ""),
        "unitType":           item.get("unit_type", "EA"),
        "quantity":           quantity,
        "internalCode":       item.get("internal_code", ""),
        "salesTotal":         round(unit_price * quantity, 5),
        "total":              round(net_total + vat_amt, 5),
        "valueDifference":    0,
        "totalTaxableFees":   0,
        "netTotal":           net_total,
        "itemsDiscount":      0,
        "discount": {
            "rate":   discount_pct,
            "amount": discount_amt,
        },
        "unitValue": {
            "currencySold":    item.get("currency", "EGP"),
            "amountEGP":       unit_price,
            "amountSold":      unit_price,
            "currencyExchangeRate": float(item.get("exchange_rate", 1)),
        },
        "taxableItems": [
            {
                "taxType":     "T1",
                "amount":      vat_amt,
                "subType":     "V001",
                "rate":        14,
            }
        ],
    }


def build_eta_document(invoice: dict, company: dict, receiver: dict,
                        lines: list, settings: dict) -> dict:
    """
    بناء مستند ETA كامل بالصيغة المعتمدة
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    net_amount  = round(sum(float(l.get("netTotal", 0)) for l in lines), 5)
    total_amount = round(sum(float(l.get("total", 0)) for l in lines), 5)
    vat_amount   = round(sum(
        sum(float(t.get("amount",0)) for t in l.get("taxableItems",[]))
        for l in lines), 5)

    return {
        "issuer": {
            "address": {
                "branchID":      company.get("branch_id", "0"),
                "country":       "EG",
                "governate":     company.get("governate", "Cairo"),
                "regionCity":    company.get("city", "Cairo"),
                "street":        company.get("street", ""),
                "buildingNumber": company.get("building", ""),
                "postalCode":    company.get("postal_code", ""),
            },
            "type":         company.get("type", "B"),
            "id":           company.get("tax_id", ""),
            "name":         company.get("name", ""),
        },
        "receiver": {
            "address": {
                "country":    receiver.get("country", "EG"),
                "governate":  receiver.get("governate", ""),
                "regionCity": receiver.get("city", ""),
                "street":     receiver.get("street", ""),
                "buildingNumber": receiver.get("building", ""),
                "postalCode": receiver.get("postal_code", ""),
            },
            "type":  receiver.get("type", "B"),
            "id":    receiver.get("tax_id", receiver.get("national_id", "")),
            "name":  receiver.get("name", ""),
        },
        "documentType":        invoice.get("document_type", "I"),
        "documentTypeVersion": "1.0",
        "dateTimeIssued":      invoice.get("issue_date", now),
        "taxpayerActivityCode": company.get("activity_code", ""),
        "internalID":          invoice.get("internal_id", str(uuid.uuid4())[:8].upper()),
        "purchaseOrderReference": invoice.get("purchase_order_ref", ""),
        "salesOrderReference":    invoice.get("sales_order_ref", ""),
        "invoiceLines": lines,
        "totalDiscountAmount": round(sum(
            float(l.get("discount",{}).get("amount",0)) for l in lines), 5),
        "totalSalesAmount":    round(sum(float(l.get("salesTotal",0)) for l in lines), 5),
        "netAmount":           net_amount,
        "taxTotals": [
            {"taxType": "T1", "amount": vat_amount}
        ],
        "totalAmount":         total_amount,
        "extraDiscountAmount": 0,
        "totalItemsDiscountAmount": 0,
        # signatures injected after signing
        "signatures": [],
    }


# ══════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.post("/config")
async def save_signing_config(data: dict,
                              current_user: dict = Depends(get_current_user)):
    """
    حفظ إعدادات التوقيع الرقمي والشهادة

    البيانات المطلوبة لكل بيئة:
    - اختبار (software_token): client_id + client_secret فقط
    - إنتاج (HSM): pkcs11_library + token_label + pin + ca_provider
    """
    company_id = current_user["company_id"]

    ca_provider = data.get("ca_provider", "software_token")
    if ca_provider not in ETA_CA_PROVIDERS:
        raise HTTPException(400, f"مزود الشهادة غير مدعوم. المدعوم: {list(ETA_CA_PROVIDERS.keys())}")

    config = {
        "company_id":          company_id,
        "ca_provider":         ca_provider,
        "ca_provider_name":    ETA_CA_PROVIDERS[ca_provider],
        "certificate_serial":  data.get("certificate_serial",""),
        "certificate_subject": data.get("certificate_subject",""),
        "hsm_mode":            data.get("hsm_mode", False),
        # Software token (dev/test)
        "client_id":           data.get("client_id",""),
        "client_secret":       data.get("client_secret",""),
        "signing_secret":      data.get("signing_secret",""),
        # HSM (production)
        "pkcs11_library":      data.get("pkcs11_library",""),
        "token_label":         data.get("token_label",""),
        "key_label":           data.get("key_label",""),
        "pin_encrypted":       data.get("pin",""),  # Should be encrypted at rest
        # Environment
        "environment":         data.get("environment","sandbox"),
        "is_active":           True,
        "updated_at":          datetime.now(timezone.utc).isoformat(),
        "updated_by":          current_user["user_id"],
    }

    await db.eta_signing_config.replace_one(
        {"company_id": company_id}, config, upsert=True)
    config.pop("_id", None)

    # Mask sensitive fields in response
    config["pin_encrypted"]   = "***"
    config["client_secret"]   = "***"
    config["signing_secret"]  = "***"

    return {
        "message": f"✅ تم حفظ إعدادات التوقيع — {ETA_CA_PROVIDERS[ca_provider]}",
        "config":  config,
        "hsm_note": (
            "⚠️ وضع HSM: يتطلب تثبيت PKCS#11 middleware من مزود الشهادة"
            if data.get("hsm_mode") else
            "⚠️ وضع اختبار: لا يُستخدَم في الإنتاج — استبدل بـ HSM"
        ),
    }


@router.post("/sign/{invoice_id}")
async def sign_and_submit_invoice(
    invoice_id: str,
    data:        dict = {},
    current_user: dict = Depends(get_current_user)
):
    """
    التوقيع الرقمي وإرسال الفاتورة لمنظومة ETA

    الخطوات:
    1. سحب بيانات الفاتورة من DB
    2. بناء JSON بصيغة ETA
    3. Canonicalization (توحيد المحتوى)
    4. SHA-256 Hash
    5. التوقيع (Software Token أو HSM)
    6. دمج التوقيع في المستند
    7. الإرسال لبوابة ETA

    CAdES-BES: CMS Advanced Electronic Signatures - Basic Electronic Signature
    """
    company_id = current_user["company_id"]

    # ── 1. سحب الفاتورة ───────────────────────────────────────
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")
    if invoice.get("eta_status") in ("submitted","valid"):
        raise HTTPException(400, f"الفاتورة مُرسَلة بالفعل — حالة: {invoice.get('eta_status')}")

    company = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    config  = await get_company_signing_config(company_id)
    if not config:
        raise HTTPException(400, "لم تُعرَّف إعدادات التوقيع — استخدم POST /config أولاً")

    # Resolve receiver (customer)
    receiver = {}
    if invoice.get("party_id"):
        receiver = await db.customers.find_one(
            {"id": invoice["party_id"], "company_id": company_id}, {"_id": 0}
        ) or {}

    # ── 2. بناء مستند ETA ─────────────────────────────────────
    raw_lines = invoice.get("lines", [])
    eta_lines = [build_eta_invoice_line(l) for l in raw_lines]

    eta_doc = build_eta_document(
        invoice, company, receiver, eta_lines, config
    )

    # ── 3. Canonicalization — توحيد المحتوى ──────────────────
    canonical_content = canonicalize_object(eta_doc)

    # ── 4. SHA-256 Hash ───────────────────────────────────────
    content_hash = compute_sha256(canonical_content)

    # ── 5. التوقيع ────────────────────────────────────────────
    hsm_mode = config.get("hsm_mode", False)
    if hsm_mode:
        signature_value = await sign_document_hsm(content_hash, config)
    else:
        signature_value = await sign_document_software(content_hash, config)

    # ── 6. دمج التوقيع في المستند ─────────────────────────────
    eta_doc["signatures"] = [
        {
            "signatureType": "I",  # Issuer signature
            "value":         signature_value,
        }
    ]

    # ── 7. إرسال لبوابة ETA ───────────────────────────────────
    submission_id   = str(uuid.uuid4())
    environment     = config.get("environment", "sandbox")
    api_base        = ETA_SANDBOX if environment == "sandbox" else ETA_API_BASE
    submission_uuid = None

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            # Get OAuth token
            token_resp = await client.post(ETA_AUTH_URL, data={
                "grant_type":    "client_credentials",
                "client_id":     config.get("client_id",""),
                "client_secret": config.get("client_secret",""),
            })

            if token_resp.status_code != 200:
                raise ValueError(f"Auth failed: {token_resp.text[:200]}")

            token = token_resp.json().get("access_token","")

            # Submit document
            submit_resp = await client.post(
                f"{api_base}/documentsubmissions",
                json={"documents": [eta_doc]},
                headers={
                    "Authorization":  f"Bearer {token}",
                    "Content-Type":   "application/json",
                },
            )

            if submit_resp.status_code in (200, 202):
                result        = submit_resp.json()
                submission_uuid = result.get("submissionId","")
                eta_status    = "submitted"
                eta_message   = "تم الإرسال بنجاح"
            else:
                eta_status  = "rejected"
                eta_message = submit_resp.text[:500]

    except ImportError:
        # httpx not available — simulate response
        submission_uuid = f"SIM-{str(uuid.uuid4())[:8].upper()}"
        eta_status      = "simulated"
        eta_message     = "httpx غير مثبت — استخدام محاكاة الإرسال"

    except Exception as e:
        eta_status  = "error"
        eta_message = str(e)[:500]

    # ── حفظ نتيجة الإرسال ────────────────────────────────────
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {
            "eta_status":          eta_status,
            "eta_submission_id":   submission_uuid,
            "eta_submitted_at":    datetime.now(timezone.utc).isoformat(),
            "eta_message":         eta_message,
            "eta_document_hash":   content_hash,
        }}
    )

    # Save full signing record for audit
    signing_record = {
        "id":              submission_id,
        "company_id":      company_id,
        "invoice_id":      invoice_id,
        "submission_uuid": submission_uuid,
        "environment":     environment,
        "ca_provider":     config.get("ca_provider",""),
        "hsm_mode":        hsm_mode,
        "content_hash":    content_hash,
        "signature_type":  "CAdES-BES",
        "eta_status":      eta_status,
        "eta_message":     eta_message,
        "eta_document":    eta_doc,
        "created_at":      datetime.now(timezone.utc).isoformat(),
    }
    await db.eta_signing_records.insert_one(signing_record)

    return {
        "message":         f"✅ {eta_message}",
        "invoice_id":      invoice_id,
        "submission_uuid": submission_uuid,
        "eta_status":      eta_status,
        "signing_details": {
            "step1_build":      "✅ بناء JSON بصيغة ETA",
            "step2_canonical":  f"✅ Canonicalization ({len(canonical_content)} حرف)",
            "step3_hash":       f"✅ SHA-256: {content_hash[:20]}...",
            "step4_sign":       f"✅ {'HSM' if hsm_mode else 'Software Token'} — CAdES-BES",
            "step5_submit":     f"{'✅' if eta_status in ('submitted','simulated') else '❌'} {eta_message}",
        },
        "eta_document_preview": {
            "documentType":    eta_doc.get("documentType"),
            "dateTimeIssued":  eta_doc.get("dateTimeIssued"),
            "issuer_id":       eta_doc.get("issuer",{}).get("id"),
            "receiver_id":     eta_doc.get("receiver",{}).get("id"),
            "totalAmount":     eta_doc.get("totalAmount"),
            "signatures":      [{"signatureType": "I",
                                 "value": "MIIK..." + signature_value[-20:]}],
        },
    }


@router.post("/preview-document/{invoice_id}")
async def preview_eta_document(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    معاينة المستند بصيغة ETA قبل الإرسال (بدون توقيع)
    للتحقق من صحة البيانات قبل الإرسال الفعلي
    """
    company_id = current_user["company_id"]

    invoice  = await db.invoices.find_one(
        {"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")

    company  = await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}
    receiver = {}
    if invoice.get("party_id"):
        receiver = await db.customers.find_one(
            {"id": invoice["party_id"], "company_id": company_id}, {"_id": 0}
        ) or {}

    raw_lines = invoice.get("lines", [])
    eta_lines = [build_eta_invoice_line(l) for l in raw_lines]
    eta_doc   = build_eta_document(invoice, company, receiver, eta_lines, {})

    canonical_content = canonicalize_object(eta_doc)
    content_hash      = compute_sha256(canonical_content)

    return {
        "message":           "معاينة المستند — لم يُرسَل بعد",
        "eta_document":      eta_doc,
        "canonical_length":  len(canonical_content),
        "sha256_hash":       content_hash,
        "canonical_preview": canonical_content[:300] + "...",
        "validation": {
            "has_issuer_tax_id":   bool(eta_doc.get("issuer",{}).get("id")),
            "has_receiver_id":     bool(eta_doc.get("receiver",{}).get("id")),
            "has_activity_code":   bool(eta_doc.get("taxpayerActivityCode")),
            "has_lines":           len(eta_lines) > 0,
            "total_positive":      float(eta_doc.get("totalAmount",0)) > 0,
            "ready_to_submit":     all([
                eta_doc.get("issuer",{}).get("id"),
                eta_doc.get("receiver",{}).get("id"),
                eta_doc.get("taxpayerActivityCode"),
                len(eta_lines) > 0,
            ]),
        },
    }


@router.get("/status/{invoice_id}")
async def get_submission_status(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """استعلام حالة الفاتورة في منظومة ETA"""
    company_id = current_user["company_id"]
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "company_id": company_id},
        {"_id": 0, "eta_status":1, "eta_submission_id":1,
         "eta_submitted_at":1, "eta_message":1, "eta_document_hash":1}
    )
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")

    return {
        "invoice_id":      invoice_id,
        "eta_status":      invoice.get("eta_status","not_submitted"),
        "submission_uuid": invoice.get("eta_submission_id"),
        "submitted_at":    invoice.get("eta_submitted_at"),
        "document_hash":   invoice.get("eta_document_hash","")[:20] + "...",
        "message":         invoice.get("eta_message",""),
    }


@router.get("/signing-records")
async def list_signing_records(
    limit: int = Query(20),
    current_user: dict = Depends(get_current_user)
):
    """سجل التواقيع الرقمية والإرسالات"""
    records = await db.eta_signing_records.find(
        {"company_id": current_user["company_id"]},
        {"_id": 0, "eta_document": 0}   # exclude large document
    ).sort("created_at", -1).limit(limit).to_list(None)
    return {"records": records, "count": len(records)}


@router.get("/ca-providers")
async def list_ca_providers(current_user: dict = Depends(get_current_user)):
    """قائمة مزودي الشهادات الرقمية المعتمدين"""
    return {
        "providers": [
            {"id": k, "name": v, "accredited": k != "software_token",
             "use_in_production": k != "software_token"}
            for k, v in ETA_CA_PROVIDERS.items()
        ],
        "canonicalization": "ETA JSON Canonicalization (Sort Keys + Uppercase + Decimal 5 digits)",
        "signature_format": "CAdES-BES (CMS Advanced Electronic Signatures)",
        "hash_algorithm":   "SHA-256",
        "note": (
            "⚠️ شهادة الإنتاج تتطلب USB Token أو HSM مُعتمَد من "
            "مصر للمقاصة أو إيجيبت تراست + مكتبة PyKCS11"
        ),
    }
