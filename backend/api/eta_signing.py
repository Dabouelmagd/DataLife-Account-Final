"""
/api/eta-signing — kept for existing callers; everything goes through the one
submission path in api/eta_api.py (services/eta_document + services/eta_signer).

This module used to have its own document builder, a canonical form that
sorted and upper-cased values, and a "signature" that was an HMAC wrapped in
base64 JSON. None of that is accepted by the tax authority, and having two
paths meant the invoice screen and this API produced different documents.
"""
from fastapi import APIRouter, HTTPException, Depends, Query

from database import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/eta-signing", tags=["ETA Digital Signing"])

ETA_CA_PROVIDERS = {
    "egypt_trust":    "إيجيبت تراست (Egypt Trust)",
    "mcdr":           "مصر للمقاصة والإيداع والقيد المركزي (MCDR)",
    "e_finance":      "إي فاينانس (e-Finance)",
}


@router.post("/config")
async def save_signing_config(data: dict, current_user: dict = Depends(get_current_user)):
    raise HTTPException(410, "إعدادات التوقيع انتقلت إلى الفاتورة الإلكترونية ← إعدادات ETA "
                             "(رفع ملف الختم الإلكتروني أو ضبط التوكن)")


@router.post("/sign/{invoice_id}")
async def sign_and_submit_invoice(invoice_id: str, current_user: dict = Depends(get_current_user)):
    from api.eta_api import submit_to_eta
    return await submit_to_eta(current_user["company_id"], invoice_id, current_user)


@router.post("/preview-document/{invoice_id}")
async def preview_eta_document(invoice_id: str, current_user: dict = Depends(get_current_user)):
    from api.eta_api import prepare_signed_document
    company_id = current_user["company_id"]
    settings = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    invoice = await db.invoices.find_one({"id": invoice_id, "company_id": company_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")
    doc, canonical = await prepare_signed_document(company_id, invoice, settings)
    return {"document": doc, "canonical_length": len(canonical)}


@router.get("/status/{invoice_id}")
async def get_submission_status(invoice_id: str, current_user: dict = Depends(get_current_user)):
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "company_id": current_user["company_id"]},
        {"_id": 0, "eta_status": 1, "eta_submission_id": 1, "eta_submission_date": 1, "eta_uuid": 1,
         "eta_long_id": 1, "eta_public_url": 1, "eta_rejection_reason": 1})
    if not invoice:
        raise HTTPException(404, "الفاتورة غير موجودة")
    return {"invoice_id": invoice_id, "eta_status": invoice.get("eta_status") or "not_submitted",
            "submission_uuid": invoice.get("eta_submission_id"), "submitted_at": invoice.get("eta_submission_date"),
            "document_uuid": invoice.get("eta_uuid"), "public_url": invoice.get("eta_public_url"),
            "message": invoice.get("eta_rejection_reason") or ""}


@router.get("/signing-records")
async def list_signing_records(limit: int = Query(20, le=200), current_user: dict = Depends(get_current_user)):
    records = await db.eta_submissions.find(
        {"company_id": current_user["company_id"]}, {"_id": 0, "response": 0}
    ).sort("created_at", -1).limit(limit).to_list(None)
    return {"records": records, "count": len(records)}


@router.get("/ca-providers")
async def list_ca_providers(current_user: dict = Depends(get_current_user)):
    return {
        "providers": [{"id": k, "name": v} for k, v in ETA_CA_PROVIDERS.items()],
        "canonicalization": "ETA document serialization (property names upper-case, values as sent, document order)",
        "signature_format": "CAdES-BES, detached, content type 1.2.840.113549.1.7.5, signing-certificate-v2",
        "hash_algorithm": "SHA-256",
        "note": "ملف ختم إلكتروني (.pfx) يُرفع من الإعدادات، أو توكن USB / HSM عبر PKCS#11 على جهاز متصل بالخادم",
    }
