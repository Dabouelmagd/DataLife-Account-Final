from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional, List
import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import secrets
import string

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'multi_tenant_erp')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    tax_rate: float = 14  # Egyptian VAT
    discount: float = 0


class InvoiceCreate(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_tax_id: Optional[str] = None  # الرقم الضريبي للعميل
    items: List[InvoiceItem]
    notes: Optional[str] = None
    due_date: Optional[str] = None
    currency: str = "EGP"
    invoice_type: str = "regular"  # regular, etax (الفاتورة الإلكترونية المصرية)
    issuer_tax_id: Optional[str] = None  # الرقم الضريبي للمنشأة


# Egyptian E-Tax Invoice types
ETAX_DOCUMENT_TYPES = {
    "I": "Invoice (فاتورة)",
    "C": "Credit Note (إشعار دائن)",
    "D": "Debit Note (إشعار مدين)"
}

# Egyptian Tax Authority activity codes (sample)
ETAX_ACTIVITY_CODES = {
    "4610": "Wholesale of agricultural raw materials",
    "4620": "Wholesale of food, beverages and tobacco",
    "4690": "Non-specialized wholesale trade",
    "4711": "Retail sale in non-specialized stores"
}


async def verify_token_from_header(authorization: str):
    """Verify token from authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    
    from services.auth_service import verify_token
    token = authorization.split(" ")[1]
    user_data = verify_token(token)
    
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user_data


def generate_invoice_number():
    """Generate unique invoice number"""
    date_part = datetime.now().strftime("%Y%m")
    random_part = ''.join(secrets.choice(string.digits) for _ in range(6))
    return f"INV-{date_part}-{random_part}"


@router.post("/")
async def create_invoice(
    invoice_data: InvoiceCreate,
    authorization: Optional[str] = Header(None)
):
    """Create a new invoice"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Calculate totals
    subtotal = 0
    total_tax = 0
    total_discount = 0
    
    items_with_totals = []
    for item in invoice_data.items:
        item_subtotal = item.quantity * item.unit_price
        item_discount = item_subtotal * (item.discount / 100)
        item_after_discount = item_subtotal - item_discount
        item_tax = item_after_discount * (item.tax_rate / 100)
        item_total = item_after_discount + item_tax
        
        items_with_totals.append({
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "subtotal": item_subtotal,
            "discount_percent": item.discount,
            "discount_amount": item_discount,
            "tax_rate": item.tax_rate,
            "tax_amount": item_tax,
            "total": item_total
        })
        
        subtotal += item_subtotal
        total_discount += item_discount
        total_tax += item_tax
    
    grand_total = subtotal - total_discount + total_tax
    
    # Generate invoice number based on type
    if invoice_data.invoice_type == "etax":
        invoice_number = f"ETAX-{datetime.now().strftime('%Y%m')}-{secrets.token_hex(4).upper()}"
    else:
        invoice_number = generate_invoice_number()
    
    invoice = {
        "invoice_number": invoice_number,
        "company_id": company_id,
        "customer_id": invoice_data.customer_id,
        "customer_name": invoice_data.customer_name,
        "customer_email": invoice_data.customer_email,
        "customer_phone": invoice_data.customer_phone,
        "customer_address": invoice_data.customer_address,
        "customer_tax_id": invoice_data.customer_tax_id,
        "issuer_tax_id": invoice_data.issuer_tax_id,
        "items": items_with_totals,
        "subtotal": subtotal,
        "total_discount": total_discount,
        "total_tax": total_tax,
        "grand_total": grand_total,
        "currency": invoice_data.currency,
        "notes": invoice_data.notes,
        "invoice_type": invoice_data.invoice_type,
        "status": "draft",  # draft, sent, paid, overdue, cancelled
        "issue_date": datetime.now(timezone.utc).isoformat(),
        "due_date": invoice_data.due_date,
        "paid_date": None,
        "paid_amount": 0,
        "created_by": user_data.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        # E-Tax specific fields
        "etax_uuid": secrets.token_hex(16) if invoice_data.invoice_type == "etax" else None,
        "etax_submission_status": None if invoice_data.invoice_type != "etax" else "pending",
        "etax_submitted_at": None
    }
    
    await db.invoices.insert_one(invoice)
    if "_id" in invoice:
        del invoice["_id"]
    
    return invoice


@router.get("/")
async def get_invoices(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Get all invoices with filters"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    query = {"company_id": company_id}
    
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if from_date:
        query["issue_date"] = {"$gte": from_date}
    if to_date:
        if "issue_date" in query:
            query["issue_date"]["$lte"] = to_date
        else:
            query["issue_date"] = {"$lte": to_date}
    
    invoices = await db.invoices.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    return invoices


@router.get("/stats")
async def get_invoice_stats(authorization: Optional[str] = Header(None)):
    """Get invoice statistics"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    invoices = await db.invoices.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(length=None)
    
    total_count = len(invoices)
    total_amount = sum(i.get("grand_total", 0) for i in invoices)
    paid_amount = sum(i.get("paid_amount", 0) for i in invoices)
    pending_amount = total_amount - paid_amount
    
    by_status = {}
    for inv in invoices:
        status = inv.get("status", "unknown")
        if status not in by_status:
            by_status[status] = {"count": 0, "amount": 0}
        by_status[status]["count"] += 1
        by_status[status]["amount"] += inv.get("grand_total", 0)
    
    return {
        "total_invoices": total_count,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount,
        "by_status": by_status
    }


@router.get("/{invoice_number}")
async def get_invoice(
    invoice_number: str,
    authorization: Optional[str] = Header(None)
):
    """Get single invoice by number"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice


@router.put("/{invoice_number}")
async def update_invoice(
    invoice_number: str,
    update_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update invoice"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    # Check invoice exists and is not paid
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot edit paid invoice")
    
    # Update allowed fields
    allowed_fields = ["customer_name", "customer_email", "customer_phone", 
                      "customer_address", "notes", "due_date", "status"]
    
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.invoices.update_one(
        {"invoice_number": invoice_number},
        {"$set": update_fields}
    )
    
    return {"success": True, "invoice_number": invoice_number}


@router.put("/{invoice_number}/status")
async def update_invoice_status(
    invoice_number: str,
    status_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Update invoice status"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    new_status = status_data.get("status")
    valid_statuses = ["draft", "sent", "paid", "overdue", "cancelled"]
    
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    update_data = {
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == "paid":
        update_data["paid_date"] = datetime.now(timezone.utc).isoformat()
        # Get invoice to set paid_amount
        invoice = await db.invoices.find_one({"invoice_number": invoice_number})
        if invoice:
            update_data["paid_amount"] = invoice.get("grand_total", 0)
    
    result = await db.invoices.update_one(
        {"invoice_number": invoice_number, "company_id": company_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"success": True, "status": new_status}


@router.post("/{invoice_number}/payment")
async def record_payment(
    invoice_number: str,
    payment_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Record payment for invoice"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    payment_amount = payment_data.get("amount", 0)
    payment_method = payment_data.get("method", "cash")
    payment_reference = payment_data.get("reference", "")
    
    current_paid = invoice.get("paid_amount", 0)
    new_paid = current_paid + payment_amount
    grand_total = invoice.get("grand_total", 0)
    
    # Create payment record
    payment = {
        "invoice_number": invoice_number,
        "company_id": company_id,
        "amount": payment_amount,
        "method": payment_method,
        "reference": payment_reference,
        "date": datetime.now(timezone.utc).isoformat(),
        "recorded_by": user_data.get("user_id")
    }
    
    await db.invoice_payments.insert_one(payment)
    
    # Update invoice
    update_data = {
        "paid_amount": new_paid,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Auto-mark as paid if fully paid
    if new_paid >= grand_total:
        update_data["status"] = "paid"
        update_data["paid_date"] = datetime.now(timezone.utc).isoformat()
    
    await db.invoices.update_one(
        {"invoice_number": invoice_number},
        {"$set": update_data}
    )
    
    return {
        "success": True,
        "paid_amount": new_paid,
        "remaining": max(0, grand_total - new_paid),
        "status": "paid" if new_paid >= grand_total else invoice.get("status")
    }


@router.delete("/{invoice_number}")
async def delete_invoice(
    invoice_number: str,
    authorization: Optional[str] = Header(None)
):
    """Delete (cancel) invoice"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if invoice.get("status") == "paid":
        raise HTTPException(status_code=400, detail="Cannot delete paid invoice")
    
    # Mark as cancelled instead of deleting
    await db.invoices.update_one(
        {"invoice_number": invoice_number},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": user_data.get("user_id")
        }}
    )
    
    return {"success": True, "invoice_number": invoice_number}


@router.get("/{invoice_number}/payments")
async def get_invoice_payments(
    invoice_number: str,
    authorization: Optional[str] = Header(None)
):
    """Get payment history for invoice"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    payments = await db.invoice_payments.find(
        {"invoice_number": invoice_number, "company_id": company_id},
        {"_id": 0}
    ).sort("date", -1).to_list(length=None)
    
    return payments


@router.post("/{invoice_number}/send")
async def send_invoice(
    invoice_number: str,
    send_data: dict,
    authorization: Optional[str] = Header(None)
):
    """Send invoice via email"""
    user_data = await verify_token_from_header(authorization)
    company_id = user_data.get("company_id")
    
    invoice = await db.invoices.find_one(
        {"invoice_number": invoice_number, "company_id": company_id}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    email = send_data.get("email") or invoice.get("customer_email")
    
    if not email:
        raise HTTPException(status_code=400, detail="No email address provided")
    
    # Send email (using Resend)
    try:
        import resend
        resend_api_key = os.environ.get('RESEND_API_KEY')
        sender_email = os.environ.get('SENDER_EMAIL', 'noreply@datalifeaccount.com')
        
        if resend_api_key:
            resend.api_key = resend_api_key
            
            html_content = generate_invoice_email_html(invoice)
            
            resend.Emails.send({
                "from": f"DataLife Account <{sender_email}>",
                "to": email,
                "subject": f"Invoice #{invoice_number} from DataLife Account",
                "html": html_content
            })
            
            # Update invoice status
            await db.invoices.update_one(
                {"invoice_number": invoice_number},
                {"$set": {
                    "status": "sent" if invoice.get("status") == "draft" else invoice.get("status"),
                    "sent_at": datetime.now(timezone.utc).isoformat(),
                    "sent_to": email
                }}
            )
            
            return {"success": True, "sent_to": email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")
    
    raise HTTPException(status_code=500, detail="Email service not configured")


def generate_invoice_email_html(invoice: dict) -> str:
    """Generate HTML email for invoice"""
    items_html = ""
    for item in invoice.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.get('description')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item.get('quantity')}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{item.get('unit_price'):,.2f}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">{item.get('total'):,.2f}</td>
        </tr>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
            .container {{ max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .header h1 {{ color: #28376B; margin: 0; }}
            .invoice-info {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
            .invoice-info div {{ flex: 1; }}
            table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            th {{ background: #28376B; color: white; padding: 12px; text-align: left; }}
            .totals {{ text-align: right; margin-top: 20px; }}
            .totals div {{ margin: 5px 0; }}
            .grand-total {{ font-size: 20px; font-weight: bold; color: #28376B; }}
            .footer {{ margin-top: 30px; text-align: center; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>DataLife Account</h1>
                <p>Invoice #{invoice.get('invoice_number')}</p>
            </div>
            
            <div class="invoice-info">
                <div>
                    <strong>Bill To:</strong><br>
                    {invoice.get('customer_name', '-')}<br>
                    {invoice.get('customer_email', '')}<br>
                    {invoice.get('customer_phone', '')}<br>
                    {invoice.get('customer_address', '')}
                </div>
                <div style="text-align: right;">
                    <strong>Invoice Date:</strong> {invoice.get('issue_date', '')[:10]}<br>
                    <strong>Due Date:</strong> {invoice.get('due_date', '-')[:10] if invoice.get('due_date') else '-'}<br>
                    <strong>Status:</strong> {invoice.get('status', 'draft').upper()}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Unit Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <div class="totals">
                <div>Subtotal: {invoice.get('subtotal', 0):,.2f} {invoice.get('currency', 'EGP')}</div>
                <div>Discount: -{invoice.get('total_discount', 0):,.2f} {invoice.get('currency', 'EGP')}</div>
                <div>VAT (14%): {invoice.get('total_tax', 0):,.2f} {invoice.get('currency', 'EGP')}</div>
                <div class="grand-total">Total: {invoice.get('grand_total', 0):,.2f} {invoice.get('currency', 'EGP')}</div>
            </div>
            
            {f"<p><strong>Notes:</strong> {invoice.get('notes')}</p>" if invoice.get('notes') else ""}
            
            <div class="footer">
                <p>Thank you for your business!</p>
                <p>DataLife Account - https://datalifeaccount.com</p>
            </div>
        </div>
    </body>
    </html>
    """
