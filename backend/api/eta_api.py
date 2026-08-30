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
from fastapi import APIRouter, HTTPException, Depends, Query, Body, Header
from pydantic import BaseModel, Field

from database import db
from services.auth_service import verify_token
from models.eta_settings import (
    CompanyETASettings, ETAEnvironment, ETASubmission, 
    ETADocumentStatus, ETATokenCache
)

router = APIRouter(prefix="/api/eta", tags=["ETA Integration"])
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
    
    credentials = f"{settings['client_id']}:{settings['client_secret']}"
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


def format_invoice_for_eta(invoice: dict, settings: dict) -> dict:
    """تحويل الفاتورة إلى صيغة ETA"""
    # بناء بيانات المُصدر (الشركة)
    issuer = {
        "type": "B",  # B = Business
        "id": settings.get("tax_registration_number", ""),
        "name": invoice.get("company_name", ""),
        "address": {
            "branchId": settings.get("branch_id", "0"),
            "country": "EG",
            "governate": invoice.get("company_governate", "Cairo"),
            "regionCity": invoice.get("company_city", ""),
            "street": invoice.get("company_street", ""),
            "buildingNumber": invoice.get("company_building", "1")
        }
    }
    
    # بناء بيانات المستلم (العميل)
    receiver = {
        "type": "B" if invoice.get("party_tax_id") else "P",
        "id": invoice.get("party_tax_id", ""),
        "name": invoice.get("party_name", ""),
    }
    
    if invoice.get("party_address"):
        receiver["address"] = {
            "country": "EG",
            "governate": invoice.get("party_governate", ""),
            "regionCity": invoice.get("party_city", ""),
            "street": invoice.get("party_street", ""),
            "buildingNumber": invoice.get("party_building", "1")
        }
    
    # بناء بنود الفاتورة
    invoice_lines = []
    for idx, item in enumerate(invoice.get("items", [])):
        line = {
            "description": item.get("description", ""),
            "itemType": item.get("item_type", "EGS"),
            "itemCode": item.get("eta_code", item.get("code", "")),
            "unitType": item.get("unit", "EA"),
            "quantity": float(item.get("quantity", 1)),
            "unitValue": {
                "currencySold": invoice.get("currency", "EGP"),
                "amountEGP": float(item.get("unit_price", 0))
            },
            "salesTotal": float(item.get("total_before_discount", item.get("quantity", 1) * item.get("unit_price", 0))),
            "netTotal": float(item.get("net_total", item.get("total", 0))),
            "total": float(item.get("total", 0)),
            "valueDifference": 0,
            "totalTaxableFees": 0,
            "itemsDiscount": float(item.get("discount", 0)),
            "taxableItems": []
        }
        
        # إضافة الضريبة إذا وجدت
        if item.get("vat_amount", 0) > 0:
            line["taxableItems"].append({
                "taxType": "T1",  # VAT
                "amount": float(item.get("vat_amount", 0)),
                "subType": "V009",  # 14% VAT
                "rate": float(item.get("vat_rate", 14))
            })
        
        invoice_lines.append(line)
    
    # بناء المستند الكامل
    document = {
        "issuer": issuer,
        "receiver": receiver,
        "documentType": "I",  # Invoice
        "documentTypeVersion": "1.0",
        "dateTimeIssued": invoice.get("date", datetime.utcnow().isoformat()),
        "taxpayerActivityCode": settings.get("activity_code", ""),
        "internalID": invoice.get("invoice_number", ""),
        "invoiceLines": invoice_lines,
        "totalSalesAmount": float(invoice.get("subtotal", 0)),
        "totalDiscountAmount": float(invoice.get("total_discount", 0)),
        "netAmount": float(invoice.get("net_amount", invoice.get("subtotal", 0))),
        "taxTotals": [{
            "taxType": "T1",
            "amount": float(invoice.get("vat_amount", 0))
        }] if invoice.get("vat_amount", 0) > 0 else [],
        "totalAmount": float(invoice.get("total", 0)),
        "extraDiscountAmount": 0,
        "totalItemsDiscountAmount": float(invoice.get("total_discount", 0))
    }
    
    return document


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
            settings["client_secret_masked"] = secret[:4] + "*" * (len(secret) - 8) + secret[-4:]
        else:
            settings["client_secret_masked"] = "****"
        # لا نرسل السر الكامل
        del settings["client_secret"]
    
    return settings


@router.put("/settings")
async def update_company_eta_settings(
    request: ETASettingsUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات ETA للشركة"""
    company_id = current_user["company_id"]
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
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
async def submit_invoice_to_eta(
    request: SubmitInvoiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """إرسال فاتورة إلى مصلحة الضرائب"""
    company_id = current_user["company_id"]
    
    # الحصول على إعدادات ETA
    settings = await db.company_eta_settings.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not settings or not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="تكامل ETA غير مفعل")
    
    if not settings.get("client_id") or not settings.get("client_secret"):
        raise HTTPException(status_code=400, detail="بيانات اعتماد ETA غير مكتملة")
    
    # الحصول على الفاتورة
    invoice = await db.invoices.find_one(
        {"id": request.invoice_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    
    if invoice.get("status") != "approved":
        raise HTTPException(status_code=400, detail="يجب اعتماد الفاتورة قبل إرسالها")
    
    # التحقق من عدم الإرسال مسبقاً
    existing_submission = await db.eta_submissions.find_one({
        "invoice_id": request.invoice_id,
        "status": {"$in": ["submitted", "valid"]}
    })
    
    if existing_submission:
        raise HTTPException(status_code=400, detail="تم إرسال هذه الفاتورة مسبقاً")
    
    try:
        # الحصول على التوكن
        token = await get_eta_token(company_id, settings)
        
        # تحويل الفاتورة لصيغة ETA
        eta_document = format_invoice_for_eta(invoice, settings)
        
        # إرسال الفاتورة
        base_url = (
            "https://api.preprod.invoicing.eta.gov.eg" 
            if settings.get("environment") == "preprod" 
            else "https://api.invoicing.eta.gov.eg"
        )
        
        submit_endpoint = f"{base_url}/api/v1.0/documentsubmissions"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        payload = {"documents": [eta_document]}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(submit_endpoint, json=payload, headers=headers)
            response_data = response.json()
            
            # إنشاء سجل الإرسال
            submission = ETASubmission(
                company_id=company_id,
                invoice_id=request.invoice_id,
                invoice_number=invoice.get("invoice_number"),
                invoice_type="sales"
            )
            
            if response.status_code in [200, 202]:
                accepted_docs = response_data.get("acceptedDocuments", [])
                rejected_docs = response_data.get("rejectedDocuments", [])
                
                if accepted_docs:
                    doc = accepted_docs[0]
                    submission.submission_uuid = response_data.get("submissionUUID")
                    submission.document_uuid = doc.get("uuid")
                    submission.long_id = doc.get("longId")
                    submission.status = ETADocumentStatus.SUBMITTED
                    submission.submitted_at = datetime.utcnow()
                    
                    # تحديث الفاتورة
                    await db.invoices.update_one(
                        {"id": request.invoice_id},
                        {"$set": {
                            "eta_submission_uuid": response_data.get("submissionUUID"),
                            "eta_submission_id":   response_data.get("submissionUUID"),  # SQL field alias
                            "eta_uuid":            doc.get("uuid"),   # SQL: eta_uuid (document UUID)
                            "eta_document_uuid":   doc.get("uuid"),
                            "eta_long_id":         doc.get("longId"),
                            "eta_hash_key":        doc.get("hashKey"),
                            "eta_status":          "Submitted",       # SQL: eta_status (TitleCase)
                            "eta_submission_date": datetime.now(timezone.utc).isoformat(),
                        }}
                    )
                elif rejected_docs:
                    doc = rejected_docs[0]
                    submission.status = ETADocumentStatus.REJECTED
                    submission.error_message = doc.get("error", {}).get("message", "خطأ غير معروف")
                    submission.validation_errors = doc.get("error", {}).get("details", [])
            else:
                submission.status = ETADocumentStatus.INVALID
                submission.error_code = response_data.get("error", "")
                submission.error_message = response_data.get("message", response.text)
            
            # حفظ سجل الإرسال
            await db.eta_submissions.insert_one(submission.dict())
            
            if submission.status == ETADocumentStatus.SUBMITTED:
                return {
                    "success": True,
                    "message": "تم إرسال الفاتورة بنجاح",
                    "submission_uuid": submission.submission_uuid,
                    "document_uuid": submission.document_uuid,
                    "long_id": submission.long_id
                }
            else:
                return {
                    "success": False,
                    "message": submission.error_message,
                    "errors": submission.validation_errors
                }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting invoice to ETA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"خطأ في إرسال الفاتورة: {str(e)}")


@router.post("/submit/{invoice_id}")
async def submit_invoice_by_id(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """إرسال فاتورة إلى مصلحة الضرائب باستخدام معرف الفاتورة"""
    company_id = current_user["company_id"]
    
    # الحصول على إعدادات ETA
    settings = await db.company_eta_settings.find_one(
        {"company_id": company_id},
        {"_id": 0}
    )
    
    if not settings or not settings.get("is_active"):
        raise HTTPException(status_code=400, detail="تكامل ETA غير مفعل. يرجى تفعيله من الإعدادات")
    
    if not settings.get("client_id") or not settings.get("client_secret"):
        raise HTTPException(status_code=400, detail="بيانات اعتماد ETA غير مكتملة")
    
    # الحصول على الفاتورة
    invoice = await db.invoices.find_one(
        {"id": invoice_id, "company_id": company_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="الفاتورة غير موجودة")
    
    if invoice.get("status") != "approved":
        raise HTTPException(status_code=400, detail="يجب اعتماد الفاتورة قبل إرسالها لمصلحة الضرائب")
    
    # التحقق من عدم الإرسال مسبقاً
    existing_submission = await db.eta_submissions.find_one({
        "invoice_id": invoice_id,
        "status": {"$in": ["submitted", "valid"]}
    })
    
    if existing_submission:
        raise HTTPException(status_code=400, detail="تم إرسال هذه الفاتورة مسبقاً")
    
    try:
        # الحصول على التوكن
        token = await get_eta_token(company_id, settings)
        
        # تحويل الفاتورة لصيغة ETA
        eta_document = format_invoice_for_eta(invoice, settings)
        
        # إرسال الفاتورة
        base_url = (
            "https://api.preprod.invoicing.eta.gov.eg" 
            if settings.get("environment") == "preprod" 
            else "https://api.invoicing.eta.gov.eg"
        )
        
        submit_endpoint = f"{base_url}/api/v1.0/documentsubmissions"
        
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                submit_endpoint,
                json={"documents": [eta_document]},
                headers=headers
            )
            
            if response.status_code in [200, 201, 202]:
                result = response.json()
                
                # حفظ سجل الإرسال
                submission_record = {
                    "submission_uuid": result.get("submissionUUID", str(uuid.uuid4())),
                    "invoice_id": invoice_id,
                    "company_id": company_id,
                    "document_uuid": result.get("acceptedDocuments", [{}])[0].get("uuid") if result.get("acceptedDocuments") else None,
                    "status": "submitted",
                    "response": result,
                    "submitted_at": datetime.now(timezone.utc).isoformat(),
                    "submitted_by": current_user.get("email")
                }
                await db.eta_submissions.insert_one(submission_record)
                
                # تحديث حالة الفاتورة
                await db.invoices.update_one(
                    {"id": invoice_id},
                    {"$set": {
                        "eta_status": "submitted",
                        "eta_submission_uuid": submission_record["submission_uuid"],
                        "eta_submitted_at": submission_record["submitted_at"]
                    }}
                )
                
                return {
                    "success": True,
                    "message": "تم إرسال الفاتورة بنجاح",
                    "submission_uuid": submission_record["submission_uuid"],
                    "document_uuid": submission_record["document_uuid"]
                }
            else:
                error_detail = response.text
                logger.error(f"ETA API error: {error_detail}")
                raise HTTPException(status_code=400, detail=f"خطأ من مصلحة الضرائب: {error_detail}")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting invoice to ETA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"خطأ في إرسال الفاتورة: {str(e)}")


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


@router.put("/cancel/{invoice_id}")
async def cancel_invoice_on_eta(
    invoice_id: str,
    reason: str = "إلغاء الفاتورة",
    current_user: dict = Depends(get_current_user)
):
    """إلغاء فاتورة على منظومة ETA — SQL: eta_status = 'Cancelled'"""
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
    
    settings = await db.company_eta_settings.find_one({"company_id": company_id}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=400, detail="إعدادات ETA غير مكتملة")
    
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
                {"id": invoice_id},
                {"$set": {
                    "eta_status":         "Cancelled",   # SQL: eta_status = 'Cancelled'
                    "eta_cancelled_date": datetime.now(timezone.utc).isoformat(),
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
