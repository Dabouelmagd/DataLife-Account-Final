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
    UNITS, CURRENCIES, ExchangeRate, CompanyCurrency, convert_currency, get_currency_info
)
from services.invoice_service import InvoiceService
from api.users import get_current_user
from database import db
import io
import base64

router = APIRouter(prefix="/api/invoice", tags=["invoice"])


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



# ==========================================
# تقارير الفواتير - Invoice Reports
# ==========================================

@router.get("/reports/sales")
async def get_sales_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    group_by: str = Query("date", enum=["date", "customer", "product"]),
    current_user: dict = Depends(get_current_user)
):
    """تقرير المبيعات - Sales Report"""
    try:
        company_id = current_user.get("company_id")
        
        # Build query
        query = {
            "company_id": company_id,
            "document_type": "sales_invoice",
            "status": {"$in": ["approved", "paid", "partially_paid"]}
        }
        
        if start_date:
            query["document_date"] = {"$gte": start_date}
        if end_date:
            if "document_date" in query:
                query["document_date"]["$lte"] = end_date
            else:
                query["document_date"] = {"$lte": end_date}
        
        invoices = await db.invoices.find(query, {"_id": 0}).to_list(length=None)
        
        # Calculate totals
        total_sales = sum(inv.get("grand_total", 0) for inv in invoices)
        total_tax = sum(inv.get("total_tax", 0) for inv in invoices)
        total_discount = sum(inv.get("total_discount", 0) for inv in invoices)
        total_paid = sum(inv.get("amount_paid", 0) for inv in invoices)
        total_due = sum(inv.get("amount_due", 0) for inv in invoices)
        
        # Group data
        grouped_data = []
        
        if group_by == "date":
            # Group by date
            date_groups = {}
            for inv in invoices:
                date = inv.get("document_date", "Unknown")
                if date not in date_groups:
                    date_groups[date] = {"date": date, "count": 0, "total": 0, "tax": 0}
                date_groups[date]["count"] += 1
                date_groups[date]["total"] += inv.get("grand_total", 0)
                date_groups[date]["tax"] += inv.get("total_tax", 0)
            grouped_data = sorted(date_groups.values(), key=lambda x: x["date"], reverse=True)
            
        elif group_by == "customer":
            # Group by customer
            customer_groups = {}
            for inv in invoices:
                customer = inv.get("party_name", "Unknown")
                customer_id = inv.get("party_id", "unknown")
                if customer_id not in customer_groups:
                    customer_groups[customer_id] = {
                        "customer_id": customer_id,
                        "customer_name": customer,
                        "count": 0,
                        "total": 0,
                        "paid": 0,
                        "due": 0
                    }
                customer_groups[customer_id]["count"] += 1
                customer_groups[customer_id]["total"] += inv.get("grand_total", 0)
                customer_groups[customer_id]["paid"] += inv.get("amount_paid", 0)
                customer_groups[customer_id]["due"] += inv.get("amount_due", 0)
            grouped_data = sorted(customer_groups.values(), key=lambda x: x["total"], reverse=True)
            
        elif group_by == "product":
            # Group by product/service
            product_groups = {}
            for inv in invoices:
                for line in inv.get("lines", []):
                    desc = line.get("description", "Unknown")
                    if desc not in product_groups:
                        product_groups[desc] = {
                            "product": desc,
                            "quantity": 0,
                            "total": 0
                        }
                    product_groups[desc]["quantity"] += line.get("quantity", 0)
                    product_groups[desc]["total"] += line.get("total", 0)
            grouped_data = sorted(product_groups.values(), key=lambda x: x["total"], reverse=True)
        
        return {
            "report_type": "sales",
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "invoice_count": len(invoices),
                "total_sales": round(total_sales, 2),
                "total_tax": round(total_tax, 2),
                "total_discount": round(total_discount, 2),
                "total_paid": round(total_paid, 2),
                "total_due": round(total_due, 2)
            },
            "grouped_by": group_by,
            "data": grouped_data,
            "invoices": invoices[:50]  # Last 50 invoices
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/purchases")
async def get_purchases_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    group_by: str = Query("date", enum=["date", "supplier", "product"]),
    current_user: dict = Depends(get_current_user)
):
    """تقرير المشتريات - Purchases Report"""
    try:
        company_id = current_user.get("company_id")
        
        query = {
            "company_id": company_id,
            "document_type": "purchase_invoice",
            "status": {"$in": ["approved", "paid", "partially_paid"]}
        }
        
        if start_date:
            query["document_date"] = {"$gte": start_date}
        if end_date:
            if "document_date" in query:
                query["document_date"]["$lte"] = end_date
            else:
                query["document_date"] = {"$lte": end_date}
        
        invoices = await db.invoices.find(query, {"_id": 0}).to_list(length=None)
        
        total_purchases = sum(inv.get("grand_total", 0) for inv in invoices)
        total_tax = sum(inv.get("total_tax", 0) for inv in invoices)
        total_paid = sum(inv.get("amount_paid", 0) for inv in invoices)
        total_due = sum(inv.get("amount_due", 0) for inv in invoices)
        
        grouped_data = []
        
        if group_by == "date":
            date_groups = {}
            for inv in invoices:
                date = inv.get("document_date", "Unknown")
                if date not in date_groups:
                    date_groups[date] = {"date": date, "count": 0, "total": 0, "tax": 0}
                date_groups[date]["count"] += 1
                date_groups[date]["total"] += inv.get("grand_total", 0)
                date_groups[date]["tax"] += inv.get("total_tax", 0)
            grouped_data = sorted(date_groups.values(), key=lambda x: x["date"], reverse=True)
            
        elif group_by == "supplier":
            supplier_groups = {}
            for inv in invoices:
                supplier = inv.get("party_name", "Unknown")
                supplier_id = inv.get("party_id", "unknown")
                if supplier_id not in supplier_groups:
                    supplier_groups[supplier_id] = {
                        "supplier_id": supplier_id,
                        "supplier_name": supplier,
                        "count": 0,
                        "total": 0,
                        "paid": 0,
                        "due": 0
                    }
                supplier_groups[supplier_id]["count"] += 1
                supplier_groups[supplier_id]["total"] += inv.get("grand_total", 0)
                supplier_groups[supplier_id]["paid"] += inv.get("amount_paid", 0)
                supplier_groups[supplier_id]["due"] += inv.get("amount_due", 0)
            grouped_data = sorted(supplier_groups.values(), key=lambda x: x["total"], reverse=True)
            
        elif group_by == "product":
            product_groups = {}
            for inv in invoices:
                for line in inv.get("lines", []):
                    desc = line.get("description", "Unknown")
                    if desc not in product_groups:
                        product_groups[desc] = {"product": desc, "quantity": 0, "total": 0}
                    product_groups[desc]["quantity"] += line.get("quantity", 0)
                    product_groups[desc]["total"] += line.get("total", 0)
            grouped_data = sorted(product_groups.values(), key=lambda x: x["total"], reverse=True)
        
        return {
            "report_type": "purchases",
            "period": {"start": start_date, "end": end_date},
            "summary": {
                "invoice_count": len(invoices),
                "total_purchases": round(total_purchases, 2),
                "total_tax": round(total_tax, 2),
                "total_paid": round(total_paid, 2),
                "total_due": round(total_due, 2)
            },
            "grouped_by": group_by,
            "data": grouped_data,
            "invoices": invoices[:50]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/vat")
async def get_vat_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """تقرير ضريبة القيمة المضافة - VAT Report"""
    try:
        company_id = current_user.get("company_id")
        
        base_query = {
            "company_id": company_id,
            "status": {"$in": ["approved", "paid", "partially_paid"]}
        }
        
        if start_date:
            base_query["document_date"] = {"$gte": start_date}
        if end_date:
            if "document_date" in base_query:
                base_query["document_date"]["$lte"] = end_date
            else:
                base_query["document_date"] = {"$lte": end_date}
        
        # Sales VAT (Output Tax)
        sales_query = {**base_query, "document_type": "sales_invoice"}
        sales_invoices = await db.invoices.find(sales_query, {"_id": 0}).to_list(length=None)
        
        sales_subtotal = sum(inv.get("subtotal", 0) for inv in sales_invoices)
        sales_tax = sum(inv.get("total_tax", 0) for inv in sales_invoices)
        sales_total = sum(inv.get("grand_total", 0) for inv in sales_invoices)
        
        # Purchases VAT (Input Tax)
        purchases_query = {**base_query, "document_type": "purchase_invoice"}
        purchases_invoices = await db.invoices.find(purchases_query, {"_id": 0}).to_list(length=None)
        
        purchases_subtotal = sum(inv.get("subtotal", 0) for inv in purchases_invoices)
        purchases_tax = sum(inv.get("total_tax", 0) for inv in purchases_invoices)
        purchases_total = sum(inv.get("grand_total", 0) for inv in purchases_invoices)
        
        # Net VAT
        net_vat = sales_tax - purchases_tax
        
        # Breakdown by tax rate
        tax_breakdown = {}
        
        for inv in sales_invoices:
            for line in inv.get("lines", []):
                rate = line.get("tax_rate", 0)
                key = f"{rate}%"
                if key not in tax_breakdown:
                    tax_breakdown[key] = {"rate": rate, "sales_base": 0, "sales_tax": 0, "purchases_base": 0, "purchases_tax": 0}
                tax_breakdown[key]["sales_base"] += line.get("subtotal", 0) - line.get("discount_amount", 0)
                tax_breakdown[key]["sales_tax"] += line.get("tax_amount", 0)
        
        for inv in purchases_invoices:
            for line in inv.get("lines", []):
                rate = line.get("tax_rate", 0)
                key = f"{rate}%"
                if key not in tax_breakdown:
                    tax_breakdown[key] = {"rate": rate, "sales_base": 0, "sales_tax": 0, "purchases_base": 0, "purchases_tax": 0}
                tax_breakdown[key]["purchases_base"] += line.get("subtotal", 0) - line.get("discount_amount", 0)
                tax_breakdown[key]["purchases_tax"] += line.get("tax_amount", 0)
        
        # Calculate net for each rate
        for key in tax_breakdown:
            tax_breakdown[key]["net_tax"] = tax_breakdown[key]["sales_tax"] - tax_breakdown[key]["purchases_tax"]
        
        return {
            "report_type": "vat",
            "period": {"start": start_date, "end": end_date},
            "output_tax": {
                "description": "ضريبة المخرجات (المبيعات)",
                "description_en": "Output Tax (Sales)",
                "invoice_count": len(sales_invoices),
                "taxable_amount": round(sales_subtotal, 2),
                "tax_amount": round(sales_tax, 2),
                "total_amount": round(sales_total, 2)
            },
            "input_tax": {
                "description": "ضريبة المدخلات (المشتريات)",
                "description_en": "Input Tax (Purchases)",
                "invoice_count": len(purchases_invoices),
                "taxable_amount": round(purchases_subtotal, 2),
                "tax_amount": round(purchases_tax, 2),
                "total_amount": round(purchases_total, 2)
            },
            "net_vat": {
                "description": "صافي الضريبة المستحقة",
                "description_en": "Net VAT Due",
                "amount": round(net_vat, 2),
                "status": "payable" if net_vat > 0 else "refundable" if net_vat < 0 else "zero"
            },
            "tax_breakdown": list(tax_breakdown.values())
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/aging")
async def get_aging_report(
    report_type: str = Query("receivables", enum=["receivables", "payables"]),
    as_of_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """تقرير أعمار الديون - Aging Report"""
    try:
        from datetime import datetime, timedelta
        
        company_id = current_user.get("company_id")
        
        if as_of_date:
            reference_date = datetime.strptime(as_of_date, "%Y-%m-%d")
        else:
            reference_date = datetime.now()
        
        doc_type = "sales_invoice" if report_type == "receivables" else "purchase_invoice"
        
        query = {
            "company_id": company_id,
            "document_type": doc_type,
            "status": {"$in": ["approved", "partially_paid"]},
            "amount_due": {"$gt": 0}
        }
        
        invoices = await db.invoices.find(query, {"_id": 0}).to_list(length=None)
        
        # Age buckets
        buckets = {
            "current": {"label": "0-30 days", "label_ar": "0-30 يوم", "min": 0, "max": 30, "total": 0, "count": 0, "invoices": []},
            "30_60": {"label": "31-60 days", "label_ar": "31-60 يوم", "min": 31, "max": 60, "total": 0, "count": 0, "invoices": []},
            "60_90": {"label": "61-90 days", "label_ar": "61-90 يوم", "min": 61, "max": 90, "total": 0, "count": 0, "invoices": []},
            "over_90": {"label": "Over 90 days", "label_ar": "أكثر من 90 يوم", "min": 91, "max": 9999, "total": 0, "count": 0, "invoices": []}
        }
        
        # Party summaries
        party_summary = {}
        
        for inv in invoices:
            due_date_str = inv.get("due_date") or inv.get("document_date")
            if due_date_str:
                try:
                    due_date = datetime.strptime(due_date_str, "%Y-%m-%d")
                    days_overdue = (reference_date - due_date).days
                except:
                    days_overdue = 0
            else:
                days_overdue = 0
            
            amount_due = inv.get("amount_due", 0)
            party_id = inv.get("party_id", "unknown")
            party_name = inv.get("party_name", "Unknown")
            
            # Add to appropriate bucket
            inv_summary = {
                "invoice_number": inv.get("document_number"),
                "date": inv.get("document_date"),
                "due_date": inv.get("due_date"),
                "days_overdue": max(0, days_overdue),
                "amount_due": amount_due,
                "party_name": party_name
            }
            
            if days_overdue <= 30:
                buckets["current"]["total"] += amount_due
                buckets["current"]["count"] += 1
                buckets["current"]["invoices"].append(inv_summary)
            elif days_overdue <= 60:
                buckets["30_60"]["total"] += amount_due
                buckets["30_60"]["count"] += 1
                buckets["30_60"]["invoices"].append(inv_summary)
            elif days_overdue <= 90:
                buckets["60_90"]["total"] += amount_due
                buckets["60_90"]["count"] += 1
                buckets["60_90"]["invoices"].append(inv_summary)
            else:
                buckets["over_90"]["total"] += amount_due
                buckets["over_90"]["count"] += 1
                buckets["over_90"]["invoices"].append(inv_summary)
            
            # Party summary
            if party_id not in party_summary:
                party_summary[party_id] = {
                    "party_id": party_id,
                    "party_name": party_name,
                    "current": 0,
                    "30_60": 0,
                    "60_90": 0,
                    "over_90": 0,
                    "total": 0
                }
            
            if days_overdue <= 30:
                party_summary[party_id]["current"] += amount_due
            elif days_overdue <= 60:
                party_summary[party_id]["30_60"] += amount_due
            elif days_overdue <= 90:
                party_summary[party_id]["60_90"] += amount_due
            else:
                party_summary[party_id]["over_90"] += amount_due
            
            party_summary[party_id]["total"] += amount_due
        
        # Round values
        for bucket in buckets.values():
            bucket["total"] = round(bucket["total"], 2)
            # Limit invoices shown
            bucket["invoices"] = bucket["invoices"][:20]
        
        for party in party_summary.values():
            party["current"] = round(party["current"], 2)
            party["30_60"] = round(party["30_60"], 2)
            party["60_90"] = round(party["60_90"], 2)
            party["over_90"] = round(party["over_90"], 2)
            party["total"] = round(party["total"], 2)
        
        total_outstanding = sum(b["total"] for b in buckets.values())
        
        return {
            "report_type": f"aging_{report_type}",
            "as_of_date": reference_date.strftime("%Y-%m-%d"),
            "summary": {
                "total_outstanding": round(total_outstanding, 2),
                "invoice_count": len(invoices),
                "party_count": len(party_summary)
            },
            "buckets": buckets,
            "by_party": sorted(party_summary.values(), key=lambda x: x["total"], reverse=True)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/export/{report_type}")
async def export_report_to_excel(
    report_type: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """تصدير التقرير إلى Excel - Export Report to Excel"""
    try:
        import xlsxwriter
        
        company_id = current_user.get("company_id")
        buffer = io.BytesIO()
        workbook = xlsxwriter.Workbook(buffer, {'in_memory': True})
        
        # Styles
        header_format = workbook.add_format({
            'bold': True, 'bg_color': '#28376B', 'font_color': 'white',
            'border': 1, 'align': 'center'
        })
        number_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1})
        text_format = workbook.add_format({'border': 1})
        total_format = workbook.add_format({
            'bold': True, 'bg_color': '#f3f4f6', 'num_format': '#,##0.00', 'border': 1
        })
        
        if report_type == "sales":
            # Sales Report
            worksheet = workbook.add_worksheet("Sales Report")
            
            query = {
                "company_id": company_id,
                "document_type": "sales_invoice",
                "status": {"$in": ["approved", "paid", "partially_paid"]}
            }
            if start_date:
                query["document_date"] = {"$gte": start_date}
            if end_date:
                if "document_date" in query:
                    query["document_date"]["$lte"] = end_date
                else:
                    query["document_date"] = {"$lte": end_date}
            
            invoices = await db.invoices.find(query, {"_id": 0}).to_list(length=None)
            
            headers = ["Invoice #", "Date", "Customer", "Subtotal", "Discount", "Tax", "Total", "Paid", "Due", "Status"]
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
            
            row = 1
            for inv in invoices:
                worksheet.write(row, 0, inv.get("document_number", ""), text_format)
                worksheet.write(row, 1, inv.get("document_date", ""), text_format)
                worksheet.write(row, 2, inv.get("party_name", ""), text_format)
                worksheet.write(row, 3, inv.get("subtotal", 0), number_format)
                worksheet.write(row, 4, inv.get("total_discount", 0), number_format)
                worksheet.write(row, 5, inv.get("total_tax", 0), number_format)
                worksheet.write(row, 6, inv.get("grand_total", 0), number_format)
                worksheet.write(row, 7, inv.get("amount_paid", 0), number_format)
                worksheet.write(row, 8, inv.get("amount_due", 0), number_format)
                worksheet.write(row, 9, inv.get("status", ""), text_format)
                row += 1
            
            # Totals
            worksheet.write(row, 2, "TOTAL", total_format)
            worksheet.write(row, 3, sum(inv.get("subtotal", 0) for inv in invoices), total_format)
            worksheet.write(row, 4, sum(inv.get("total_discount", 0) for inv in invoices), total_format)
            worksheet.write(row, 5, sum(inv.get("total_tax", 0) for inv in invoices), total_format)
            worksheet.write(row, 6, sum(inv.get("grand_total", 0) for inv in invoices), total_format)
            worksheet.write(row, 7, sum(inv.get("amount_paid", 0) for inv in invoices), total_format)
            worksheet.write(row, 8, sum(inv.get("amount_due", 0) for inv in invoices), total_format)
            
            worksheet.set_column('A:A', 15)
            worksheet.set_column('B:B', 12)
            worksheet.set_column('C:C', 30)
            worksheet.set_column('D:J', 12)
            
        elif report_type == "purchases":
            # Purchases Report
            worksheet = workbook.add_worksheet("Purchases Report")
            
            query = {
                "company_id": company_id,
                "document_type": "purchase_invoice",
                "status": {"$in": ["approved", "paid", "partially_paid"]}
            }
            if start_date:
                query["document_date"] = {"$gte": start_date}
            if end_date:
                if "document_date" in query:
                    query["document_date"]["$lte"] = end_date
                else:
                    query["document_date"] = {"$lte": end_date}
            
            invoices = await db.invoices.find(query, {"_id": 0}).to_list(length=None)
            
            headers = ["Invoice #", "Date", "Supplier", "Subtotal", "Discount", "Tax", "Total", "Paid", "Due", "Status"]
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
            
            row = 1
            for inv in invoices:
                worksheet.write(row, 0, inv.get("document_number", ""), text_format)
                worksheet.write(row, 1, inv.get("document_date", ""), text_format)
                worksheet.write(row, 2, inv.get("party_name", ""), text_format)
                worksheet.write(row, 3, inv.get("subtotal", 0), number_format)
                worksheet.write(row, 4, inv.get("total_discount", 0), number_format)
                worksheet.write(row, 5, inv.get("total_tax", 0), number_format)
                worksheet.write(row, 6, inv.get("grand_total", 0), number_format)
                worksheet.write(row, 7, inv.get("amount_paid", 0), number_format)
                worksheet.write(row, 8, inv.get("amount_due", 0), number_format)
                worksheet.write(row, 9, inv.get("status", ""), text_format)
                row += 1
            
            worksheet.write(row, 2, "TOTAL", total_format)
            worksheet.write(row, 6, sum(inv.get("grand_total", 0) for inv in invoices), total_format)
            
            worksheet.set_column('A:A', 15)
            worksheet.set_column('B:B', 12)
            worksheet.set_column('C:C', 30)
            worksheet.set_column('D:J', 12)
            
        elif report_type == "vat":
            # VAT Report
            worksheet = workbook.add_worksheet("VAT Report")
            
            base_query = {
                "company_id": company_id,
                "status": {"$in": ["approved", "paid", "partially_paid"]}
            }
            if start_date:
                base_query["document_date"] = {"$gte": start_date}
            if end_date:
                if "document_date" in base_query:
                    base_query["document_date"]["$lte"] = end_date
                else:
                    base_query["document_date"] = {"$lte": end_date}
            
            sales_invoices = await db.invoices.find({**base_query, "document_type": "sales_invoice"}, {"_id": 0}).to_list(length=None)
            purchases_invoices = await db.invoices.find({**base_query, "document_type": "purchase_invoice"}, {"_id": 0}).to_list(length=None)
            
            worksheet.write(0, 0, "VAT Report", header_format)
            worksheet.write(1, 0, f"Period: {start_date or 'Start'} to {end_date or 'End'}", text_format)
            
            worksheet.write(3, 0, "Description", header_format)
            worksheet.write(3, 1, "Taxable Amount", header_format)
            worksheet.write(3, 2, "VAT Amount", header_format)
            
            sales_subtotal = sum(inv.get("subtotal", 0) for inv in sales_invoices)
            sales_tax = sum(inv.get("total_tax", 0) for inv in sales_invoices)
            purchases_subtotal = sum(inv.get("subtotal", 0) for inv in purchases_invoices)
            purchases_tax = sum(inv.get("total_tax", 0) for inv in purchases_invoices)
            
            worksheet.write(4, 0, "Output Tax (Sales)", text_format)
            worksheet.write(4, 1, sales_subtotal, number_format)
            worksheet.write(4, 2, sales_tax, number_format)
            
            worksheet.write(5, 0, "Input Tax (Purchases)", text_format)
            worksheet.write(5, 1, purchases_subtotal, number_format)
            worksheet.write(5, 2, purchases_tax, number_format)
            
            worksheet.write(6, 0, "Net VAT Due", total_format)
            worksheet.write(6, 1, "", total_format)
            worksheet.write(6, 2, sales_tax - purchases_tax, total_format)
            
            worksheet.set_column('A:A', 25)
            worksheet.set_column('B:C', 15)
            
        else:
            raise HTTPException(status_code=400, detail="Invalid report type")
        
        workbook.close()
        buffer.seek(0)
        
        filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        return StreamingResponse(
            buffer,
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ==========================================
# العملات وأسعار الصرف - Currencies & Exchange Rates
# ==========================================

class ExchangeRateRequest(BaseModel):
    """طلب إضافة/تحديث سعر صرف"""
    to_currency: str
    rate: float
    effective_date: Optional[str] = None


class UpdateCurrencySettingsRequest(BaseModel):
    """طلب تحديث إعدادات العملات"""
    base_currency: Optional[str] = None
    enabled_currencies: Optional[List[str]] = None


@router.get("/config/currencies")
async def get_currencies(current_user: dict = Depends(get_current_user)):
    """الحصول على قائمة العملات المدعومة"""
    try:
        company_id = current_user.get("company_id")
        
        # Get company currency settings
        settings = await db.company_currencies.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        
        if not settings:
            # Create default settings
            settings = CompanyCurrency(
                company_id=company_id,
                base_currency="EGP",
                enabled_currencies=["EGP", "USD", "EUR", "SAR", "AED"]
            ).dict()
            await db.company_currencies.insert_one(settings)
        
        # Get all currencies with enabled status
        currencies = []
        for code, info in CURRENCIES.items():
            currencies.append({
                **info,
                "is_enabled": code in settings.get("enabled_currencies", ["EGP"]),
                "is_base": code == settings.get("base_currency", "EGP")
            })
        
        return {
            "currencies": currencies,
            "base_currency": settings.get("base_currency", "EGP"),
            "enabled_currencies": settings.get("enabled_currencies", ["EGP"])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config/currencies/settings")
async def update_currency_settings(
    request: UpdateCurrencySettingsRequest,
    current_user: dict = Depends(get_current_user)
):
    """تحديث إعدادات العملات للشركة"""
    try:
        company_id = current_user.get("company_id")
        
        update_data = {}
        if request.base_currency:
            if request.base_currency not in CURRENCIES:
                raise HTTPException(status_code=400, detail="عملة غير صالحة")
            update_data["base_currency"] = request.base_currency
            
        if request.enabled_currencies:
            # Validate all currencies
            for curr in request.enabled_currencies:
                if curr not in CURRENCIES:
                    raise HTTPException(status_code=400, detail=f"عملة غير صالحة: {curr}")
            update_data["enabled_currencies"] = request.enabled_currencies
        
        if update_data:
            await db.company_currencies.update_one(
                {"company_id": company_id},
                {"$set": update_data},
                upsert=True
            )
        
        return {"message": "تم تحديث إعدادات العملات بنجاح"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/exchange-rates")
async def get_exchange_rates(
    currency: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """الحصول على أسعار الصرف"""
    try:
        company_id = current_user.get("company_id")
        
        # Get company base currency
        settings = await db.company_currencies.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        base_currency = settings.get("base_currency", "EGP") if settings else "EGP"
        
        # Build query
        query = {"company_id": company_id, "is_active": True}
        if currency:
            query["to_currency"] = currency
        
        rates = await db.exchange_rates.find(query, {"_id": 0}).sort("effective_date", -1).to_list(length=100)
        
        # Get latest rate for each currency
        latest_rates = {}
        for rate in rates:
            curr = rate["to_currency"]
            if curr not in latest_rates:
                latest_rates[curr] = rate
        
        return {
            "base_currency": base_currency,
            "rates": list(latest_rates.values()),
            "all_rates": rates
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/exchange-rates")
async def create_exchange_rate(
    request: ExchangeRateRequest,
    current_user: dict = Depends(get_current_user)
):
    """إضافة سعر صرف جديد"""
    try:
        company_id = current_user.get("company_id")
        user_id = current_user.get("user_id")
        
        if request.to_currency not in CURRENCIES:
            raise HTTPException(status_code=400, detail="عملة غير صالحة")
        
        if request.rate <= 0:
            raise HTTPException(status_code=400, detail="سعر الصرف يجب أن يكون أكبر من صفر")
        
        # Get company base currency
        settings = await db.company_currencies.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        base_currency = settings.get("base_currency", "EGP") if settings else "EGP"
        
        rate = ExchangeRate(
            company_id=company_id,
            from_currency=base_currency,
            to_currency=request.to_currency,
            rate=request.rate,
            effective_date=request.effective_date or datetime.now().strftime("%Y-%m-%d"),
            created_by=user_id
        )
        
        await db.exchange_rates.insert_one(rate.dict())
        
        return {
            "message": "تم إضافة سعر الصرف بنجاح",
            "rate": rate.dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/config/exchange-rates/{rate_id}")
async def delete_exchange_rate(
    rate_id: str,
    current_user: dict = Depends(get_current_user)
):
    """حذف سعر صرف"""
    try:
        company_id = current_user.get("company_id")
        
        result = await db.exchange_rates.update_one(
            {"id": rate_id, "company_id": company_id},
            {"$set": {"is_active": False}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="سعر الصرف غير موجود")
        
        return {"message": "تم حذف سعر الصرف بنجاح"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config/convert")
async def convert_amount(
    amount: float,
    from_currency: str,
    to_currency: str,
    current_user: dict = Depends(get_current_user)
):
    """تحويل مبلغ من عملة لأخرى"""
    try:
        company_id = current_user.get("company_id")
        
        if from_currency not in CURRENCIES or to_currency not in CURRENCIES:
            raise HTTPException(status_code=400, detail="عملة غير صالحة")
        
        if from_currency == to_currency:
            return {
                "original_amount": amount,
                "converted_amount": amount,
                "from_currency": from_currency,
                "to_currency": to_currency,
                "rate": 1.0
            }
        
        # Get company base currency
        settings = await db.company_currencies.find_one(
            {"company_id": company_id},
            {"_id": 0}
        )
        base_currency = settings.get("base_currency", "EGP") if settings else "EGP"
        
        # Get exchange rates
        from_rate = 1.0
        to_rate = 1.0
        
        if from_currency != base_currency:
            rate_doc = await db.exchange_rates.find_one(
                {"company_id": company_id, "to_currency": from_currency, "is_active": True},
                {"_id": 0},
                sort=[("effective_date", -1)]
            )
            if rate_doc:
                from_rate = rate_doc["rate"]
        
        if to_currency != base_currency:
            rate_doc = await db.exchange_rates.find_one(
                {"company_id": company_id, "to_currency": to_currency, "is_active": True},
                {"_id": 0},
                sort=[("effective_date", -1)]
            )
            if rate_doc:
                to_rate = rate_doc["rate"]
        
        # Convert: amount -> base currency -> target currency
        base_amount = amount / from_rate if from_rate != 0 else amount
        converted_amount = base_amount * to_rate
        
        return {
            "original_amount": amount,
            "converted_amount": round(converted_amount, 2),
            "from_currency": from_currency,
            "to_currency": to_currency,
            "rate": round(to_rate / from_rate, 6) if from_rate != 0 else 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
