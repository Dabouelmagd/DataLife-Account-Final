"""
API للفواتير الإلكترونية
Invoice API Routes
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from models.invoice import (
    Invoice, InvoiceLine, Party, Product, Payment,
    DocumentType, DocumentStatus, PaymentTerms, TaxType, Currency, PaymentMethod,
    UNITS
)
from services.invoice_service import InvoiceService
from api.users import get_current_user
from database import db
import io

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


# ==========================================
# Request Models
# ==========================================

class CreatePartyRequest(BaseModel):
    party_type: str  # "customer" or "supplier"
    name: str
    name_en: Optional[str] = None
    tax_id: Optional[str] = None
    commercial_register: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "EG"
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_person: Optional[str] = None
    credit_limit: float = 0.0
    payment_terms: str = "cash"


class CreateProductRequest(BaseModel):
    code: str
    name: str
    name_en: Optional[str] = None
    description: Optional[str] = None
    unit: str = "EA"
    unit_price: float = 0.0
    cost_price: float = 0.0
    tax_type: str = "vat"
    tax_rate: float = 14.0
    eta_code: Optional[str] = None
    is_service: bool = False


class InvoiceLineRequest(BaseModel):
    product_id: Optional[str] = None
    product_code: Optional[str] = None
    description: str
    unit: str = "EA"
    quantity: float = 1.0
    unit_price: float = 0.0
    discount_percent: float = 0.0
    tax_type: str = "vat"
    tax_rate: float = 14.0


class CreateInvoiceRequest(BaseModel):
    document_type: str
    document_date: str
    due_date: Optional[str] = None
    party_id: str
    currency: str = "EGP"
    payment_terms: str = "cash"
    lines: List[InvoiceLineRequest]
    notes: Optional[str] = None
    reference: Optional[str] = None


class RecordPaymentRequest(BaseModel):
    invoice_id: str
    payment_date: str
    amount: float
    payment_method: str = "cash"
    reference: Optional[str] = None
    notes: Optional[str] = None


# ==========================================
# Party (Customer/Supplier) Endpoints
# ==========================================

@router.get("/parties")
async def get_parties(
    party_type: Optional[str] = Query(None, description="customer or supplier"),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على العملاء والموردين"""
    service = InvoiceService(db)
    parties = await service.get_parties(current_user["company_id"], party_type)
    return {"parties": parties, "total": len(parties)}


@router.get("/parties/{party_id}")
async def get_party(
    party_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على عميل أو مورد"""
    service = InvoiceService(db)
    party = await service.get_party_by_id(party_id)
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    return party


@router.post("/parties")
async def create_party(
    request: CreatePartyRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء عميل أو مورد"""
    service = InvoiceService(db)
    
    party = Party(
        company_id=current_user["company_id"],
        party_type=request.party_type,
        name=request.name,
        name_en=request.name_en,
        tax_id=request.tax_id,
        commercial_register=request.commercial_register,
        address=request.address,
        city=request.city,
        country=request.country,
        phone=request.phone,
        email=request.email,
        contact_person=request.contact_person,
        credit_limit=request.credit_limit,
        payment_terms=PaymentTerms(request.payment_terms)
    )
    
    result = await service.create_party(party)
    return {"message": "تم إنشاء العميل/المورد بنجاح", "party": result}


@router.put("/parties/{party_id}")
async def update_party(
    party_id: str,
    request: CreatePartyRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث عميل أو مورد"""
    service = InvoiceService(db)
    updates = request.dict(exclude_unset=True)
    result = await service.update_party(party_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Party not found")
    return {"message": "تم التحديث بنجاح", "party": result}


# ==========================================
# Product Endpoints
# ==========================================

@router.get("/products")
async def get_products(
    current_user: dict = Depends(get_current_user)
):
    """الحصول على المنتجات"""
    service = InvoiceService(db)
    products = await service.get_products(current_user["company_id"])
    return {"products": products, "total": len(products)}


@router.post("/products")
async def create_product(
    request: CreateProductRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء منتج"""
    service = InvoiceService(db)
    
    product = Product(
        company_id=current_user["company_id"],
        code=request.code,
        name=request.name,
        name_en=request.name_en,
        description=request.description,
        unit=request.unit,
        unit_price=request.unit_price,
        cost_price=request.cost_price,
        tax_type=TaxType(request.tax_type),
        tax_rate=request.tax_rate,
        eta_code=request.eta_code,
        is_service=request.is_service
    )
    
    result = await service.create_product(product)
    return {"message": "تم إنشاء المنتج بنجاح", "product": result}


@router.get("/units")
async def get_units():
    """الحصول على وحدات القياس"""
    return {"units": UNITS}


# ==========================================
# Invoice Endpoints
# ==========================================

@router.get("/")
async def get_invoices(
    document_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    party_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    skip: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """الحصول على الفواتير"""
    service = InvoiceService(db)
    
    doc_type = DocumentType(document_type) if document_type else None
    doc_status = DocumentStatus(status) if status else None
    
    invoices = await service.get_invoices(
        current_user["company_id"],
        doc_type, doc_status, party_id,
        start_date, end_date, limit, skip
    )
    return {"invoices": invoices, "total": len(invoices)}


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على فاتورة"""
    service = InvoiceService(db)
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/")
async def create_invoice(
    request: CreateInvoiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """إنشاء فاتورة"""
    service = InvoiceService(db)
    
    # الحصول على بيانات العميل/المورد
    party = await service.get_party_by_id(request.party_id)
    if not party:
        raise HTTPException(status_code=400, detail="Party not found")
    
    # تحويل الأسطر
    lines = []
    for line_req in request.lines:
        line = InvoiceLine(
            line_number=0,
            product_id=line_req.product_id,
            product_code=line_req.product_code,
            description=line_req.description,
            unit=line_req.unit,
            quantity=line_req.quantity,
            unit_price=line_req.unit_price,
            discount_percent=line_req.discount_percent,
            tax_type=TaxType(line_req.tax_type),
            tax_rate=line_req.tax_rate
        )
        lines.append(line)
    
    invoice = Invoice(
        company_id=current_user["company_id"],
        document_type=DocumentType(request.document_type),
        document_number="",
        document_date=request.document_date,
        due_date=request.due_date,
        party_id=request.party_id,
        party_name=party["name"],
        party_tax_id=party.get("tax_id"),
        party_address=party.get("address"),
        currency=Currency(request.currency),
        payment_terms=PaymentTerms(request.payment_terms),
        lines=lines,
        notes=request.notes,
        reference=request.reference,
        created_by=current_user["user_id"]
    )
    
    # الحصول على اسم الشركة
    company = await db.companies.find_one({"id": current_user["company_id"]})
    company_name = company.get("name", "") if company else ""
    
    result = await service.create_invoice(invoice, company_name)
    return {"message": "تم إنشاء الفاتورة بنجاح", "invoice": result}


@router.put("/{invoice_id}")
async def update_invoice(
    invoice_id: str,
    request: CreateInvoiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث فاتورة"""
    service = InvoiceService(db)
    
    # تحويل الأسطر
    lines = []
    for line_req in request.lines:
        line = InvoiceLine(
            line_number=0,
            product_id=line_req.product_id,
            product_code=line_req.product_code,
            description=line_req.description,
            unit=line_req.unit,
            quantity=line_req.quantity,
            unit_price=line_req.unit_price,
            discount_percent=line_req.discount_percent,
            tax_type=TaxType(line_req.tax_type),
            tax_rate=line_req.tax_rate
        )
        lines.append(line)
    
    updates = {
        "document_date": request.document_date,
        "due_date": request.due_date,
        "payment_terms": request.payment_terms,
        "lines": [line.dict() for line in lines],
        "notes": request.notes,
        "reference": request.reference
    }
    
    try:
        result = await service.update_invoice(invoice_id, updates)
        if not result:
            raise HTTPException(status_code=404, detail="Invoice not found")
        return {"message": "تم تحديث الفاتورة بنجاح", "invoice": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{invoice_id}/approve")
async def approve_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """اعتماد الفاتورة"""
    service = InvoiceService(db)
    
    try:
        result = await service.approve_invoice(invoice_id, current_user["user_id"])
        return {"message": "تم اعتماد الفاتورة بنجاح", "invoice": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{invoice_id}/cancel")
async def cancel_invoice(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """إلغاء الفاتورة"""
    service = InvoiceService(db)
    
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice["status"] in [DocumentStatus.PAID.value, DocumentStatus.PARTIALLY_PAID.value]:
        raise HTTPException(status_code=400, detail="Cannot cancel paid invoice")
    
    await db.invoices.update_one(
        {"id": invoice_id},
        {"$set": {"status": DocumentStatus.CANCELLED.value, "updated_at": datetime.utcnow().isoformat()}}
    )
    
    return {"message": "تم إلغاء الفاتورة بنجاح"}


# ==========================================
# Payment Endpoints
# ==========================================

@router.post("/payments")
async def record_payment(
    request: RecordPaymentRequest,
    current_user: dict = Depends(get_current_user)
):
    """تسجيل سداد"""
    service = InvoiceService(db)
    
    payment = Payment(
        company_id=current_user["company_id"],
        invoice_id=request.invoice_id,
        payment_date=request.payment_date,
        amount=request.amount,
        payment_method=PaymentMethod(request.payment_method),
        reference=request.reference,
        notes=request.notes,
        created_by=current_user["user_id"]
    )
    
    try:
        result = await service.record_payment(payment, current_user["user_id"])
        return {"message": "تم تسجيل السداد بنجاح", "payment": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{invoice_id}/payments")
async def get_invoice_payments(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على مدفوعات الفاتورة"""
    service = InvoiceService(db)
    payments = await service.get_invoice_payments(invoice_id)
    return {"payments": payments, "total": len(payments)}


# ==========================================
# Quotation to Invoice
# ==========================================

@router.post("/{quotation_id}/convert-to-invoice")
async def convert_to_invoice(
    quotation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تحويل عرض السعر إلى فاتورة"""
    service = InvoiceService(db)
    
    company = await db.companies.find_one({"id": current_user["company_id"]})
    company_name = company.get("name", "") if company else ""
    
    try:
        result = await service.convert_quotation_to_invoice(
            quotation_id, 
            current_user["user_id"],
            company_name
        )
        return {"message": "تم تحويل عرض السعر إلى فاتورة بنجاح", "invoice": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# Reports
# ==========================================

@router.get("/reports/sales-summary")
async def get_sales_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """ملخص المبيعات"""
    service = InvoiceService(db)
    summary = await service.get_sales_summary(current_user["company_id"], start_date, end_date)
    return summary


@router.get("/reports/outstanding")
async def get_outstanding_invoices(
    party_type: Optional[str] = Query(None, description="customer or supplier"),
    current_user: dict = Depends(get_current_user)
):
    """الفواتير المستحقة"""
    service = InvoiceService(db)
    invoices = await service.get_outstanding_invoices(current_user["company_id"], party_type)
    return {"invoices": invoices, "total": len(invoices)}


# ==========================================
# PDF Export
# ==========================================

@router.get("/{invoice_id}/pdf")
async def export_invoice_pdf(
    invoice_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تصدير الفاتورة إلى PDF"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import arabic_reshaper
    from bidi.algorithm import get_display
    
    service = InvoiceService(db)
    invoice = await service.get_invoice(invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Get company info
    company = await db.companies.find_one({"id": current_user["company_id"]})
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Helper function for Arabic text
    def arabic_text(text):
        if text:
            try:
                reshaped = arabic_reshaper.reshape(str(text))
                return get_display(reshaped)
            except:
                return str(text)
        return ""
    
    # Title
    title_style = ParagraphStyle('Title', fontSize=18, alignment=1, spaceAfter=20)
    doc_types = {
        "sales_invoice": "فاتورة بيع",
        "purchase_invoice": "فاتورة شراء",
        "sales_quotation": "عرض سعر",
        "purchase_order": "أمر شراء"
    }
    title = doc_types.get(invoice["document_type"], "فاتورة")
    elements.append(Paragraph(arabic_text(title), title_style))
    
    # Invoice info
    info_data = [
        [arabic_text("رقم الفاتورة:"), invoice["document_number"]],
        [arabic_text("التاريخ:"), invoice["document_date"]],
        [arabic_text("العميل/المورد:"), arabic_text(invoice["party_name"])],
    ]
    if invoice.get("party_tax_id"):
        info_data.append([arabic_text("الرقم الضريبي:"), invoice["party_tax_id"]])
    
    info_table = Table(info_data, colWidths=[4*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))
    
    # Items table
    items_header = [
        arabic_text("المبلغ"), 
        arabic_text("الضريبة"), 
        arabic_text("السعر"), 
        arabic_text("الكمية"), 
        arabic_text("البيان"),
        "#"
    ]
    items_data = [items_header]
    
    for i, line in enumerate(invoice["lines"], 1):
        items_data.append([
            f"{line['total']:.2f}",
            f"{line['tax_amount']:.2f}",
            f"{line['unit_price']:.2f}",
            str(line['quantity']),
            arabic_text(line['description']),
            str(i)
        ])
    
    items_table = Table(items_data, colWidths=[2.5*cm, 2*cm, 2.5*cm, 1.5*cm, 7*cm, 1*cm])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#28376B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 20))
    
    # Totals
    totals_data = [
        [f"{invoice['subtotal']:.2f}", arabic_text("المجموع الفرعي")],
        [f"{invoice['total_discount']:.2f}", arabic_text("الخصم")],
        [f"{invoice['total_tax']:.2f}", arabic_text("الضريبة")],
        [f"{invoice['grand_total']:.2f}", arabic_text("الإجمالي")],
    ]
    
    totals_table = Table(totals_data, colWidths=[3*cm, 4*cm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
    ]))
    elements.append(totals_table)
    
    # QR Code
    if invoice.get("qr_code"):
        elements.append(Spacer(1, 20))
        try:
            qr_data = base64.b64decode(invoice["qr_code"])
            qr_buffer = io.BytesIO(qr_data)
            qr_img = Image(qr_buffer, width=3*cm, height=3*cm)
            elements.append(qr_img)
        except:
            pass
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename={invoice["document_number"]}.pdf'}
    )
