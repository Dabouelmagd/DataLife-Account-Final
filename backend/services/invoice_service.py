"""
خدمات نظام الفواتير
Invoice Services
"""

from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models.invoice import (
    Invoice, InvoiceLine, Party, Product, Payment,
    InvoiceSequence, ETASettings,
    DocumentType, DocumentStatus, PaymentTerms, TaxType, Currency,
    calculate_line_totals, calculate_invoice_totals, generate_qr_code_data
)
from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
from services.accounting_service import AccountingService
import logging
import qrcode
import io
import base64

logger = logging.getLogger(__name__)


class InvoiceService:
    """خدمات الفواتير"""
    
    def __init__(self, db: AsyncIOMotorClient):
        self.db = db
        self.accounting = AccountingService(db)
    
    # ==========================================
    # Invoice Sequence
    # ==========================================
    
    async def get_next_document_number(self, company_id: str, doc_type: DocumentType) -> str:
        """الحصول على رقم المستند التالي"""
        year = datetime.utcnow().year
        
        # البحث عن التسلسل الحالي
        sequence = await self.db.invoice_sequences.find_one({
            "company_id": company_id,
            "document_type": doc_type.value,
            "year": year
        })
        
        # تحديد البادئة حسب نوع المستند
        prefixes = {
            DocumentType.SALES_INVOICE: "INV",
            DocumentType.PURCHASE_INVOICE: "BILL",
            DocumentType.SALES_QUOTATION: "QTN",
            DocumentType.PURCHASE_ORDER: "PO",
            DocumentType.CREDIT_NOTE: "CN",
            DocumentType.DEBIT_NOTE: "DN"
        }
        prefix = prefixes.get(doc_type, "DOC")
        
        if sequence:
            # تحديث الرقم الحالي
            new_number = sequence["current_number"] + 1
            await self.db.invoice_sequences.update_one(
                {"_id": sequence["_id"]},
                {"$set": {"current_number": new_number}}
            )
        else:
            # إنشاء تسلسل جديد
            new_number = 1
            new_sequence = InvoiceSequence(
                company_id=company_id,
                document_type=doc_type,
                prefix=prefix,
                current_number=new_number,
                year=year
            )
            await self.db.invoice_sequences.insert_one(new_sequence.dict())
        
        return f"{prefix}-{year}-{new_number:05d}"
    
    # ==========================================
    # Party (Customer/Supplier) Operations
    # ==========================================
    
    async def create_party(self, party: Party) -> Dict:
        """إنشاء عميل أو مورد"""
        party_dict = party.dict()
        await self.db.parties.insert_one(party_dict)
        party_dict.pop("_id", None)
        return party_dict
    
    async def get_parties(self, company_id: str, party_type: str = None) -> List[Dict]:
        """الحصول على العملاء أو الموردين"""
        query = {"company_id": company_id, "is_active": True}
        if party_type:
            query["party_type"] = party_type
        
        parties = await self.db.parties.find(query, {"_id": 0}).to_list(length=1000)
        return parties
    
    async def get_party_by_id(self, party_id: str) -> Optional[Dict]:
        """الحصول على عميل أو مورد"""
        return await self.db.parties.find_one({"id": party_id}, {"_id": 0})
    
    async def update_party(self, party_id: str, updates: Dict) -> Optional[Dict]:
        """تحديث عميل أو مورد"""
        result = await self.db.parties.find_one_and_update(
            {"id": party_id},
            {"$set": updates},
            return_document=True
        )
        if result:
            result.pop("_id", None)
        return result
    
    # ==========================================
    # Product Operations
    # ==========================================
    
    async def create_product(self, product: Product) -> Dict:
        """إنشاء منتج أو خدمة"""
        product_dict = product.dict()
        await self.db.products.insert_one(product_dict)
        product_dict.pop("_id", None)
        return product_dict
    
    async def get_products(self, company_id: str) -> List[Dict]:
        """الحصول على المنتجات"""
        products = await self.db.products.find(
            {"company_id": company_id, "is_active": True},
            {"_id": 0}
        ).to_list(length=1000)
        return products
    
    async def get_product_by_id(self, product_id: str) -> Optional[Dict]:
        """الحصول على منتج"""
        return await self.db.products.find_one({"id": product_id}, {"_id": 0})
    
    # ==========================================
    # Invoice Operations
    # ==========================================
    
    async def create_invoice(self, invoice: Invoice, company_name: str = "") -> Dict:
        """إنشاء فاتورة"""
        # توليد رقم الفاتورة
        if not invoice.document_number:
            invoice.document_number = await self.get_next_document_number(
                invoice.company_id, 
                invoice.document_type
            )
        
        # حساب مجاميع الأسطر
        for i, line in enumerate(invoice.lines):
            line.line_number = i + 1
            invoice.lines[i] = calculate_line_totals(line)
        
        # حساب مجاميع الفاتورة
        invoice = calculate_invoice_totals(invoice)
        
        # توليد QR Code
        try:
            qr_data = generate_qr_code_data(invoice, company_name)
            qr = qrcode.QRCode(version=1, box_size=10, border=5)
            qr.add_data(qr_data)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            invoice.qr_code = base64.b64encode(buffer.getvalue()).decode('utf-8')
        except Exception as e:
            logger.error(f"Error generating QR code: {e}")
        
        invoice_dict = invoice.dict()
        await self.db.invoices.insert_one(invoice_dict)
        invoice_dict.pop("_id", None)
        
        return invoice_dict
    
    async def get_invoice(self, invoice_id: str) -> Optional[Dict]:
        """الحصول على فاتورة"""
        return await self.db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    
    async def get_invoices(
        self,
        company_id: str,
        document_type: Optional[DocumentType] = None,
        status: Optional[DocumentStatus] = None,
        party_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """الحصول على الفواتير"""
        query = {"company_id": company_id}
        
        if document_type:
            query["document_type"] = document_type.value
        if status:
            query["status"] = status.value
        if party_id:
            query["party_id"] = party_id
        if start_date:
            query["document_date"] = {"$gte": start_date}
        if end_date:
            if "document_date" in query:
                query["document_date"]["$lte"] = end_date
            else:
                query["document_date"] = {"$lte": end_date}
        
        invoices = await self.db.invoices.find(
            query, {"_id": 0}
        ).sort("document_date", -1).skip(skip).limit(limit).to_list(length=limit)
        
        return invoices
    
    async def update_invoice(self, invoice_id: str, updates: Dict, company_name: str = "") -> Optional[Dict]:
        """تحديث فاتورة"""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            return None
        
        if invoice["status"] not in [DocumentStatus.DRAFT.value, DocumentStatus.PENDING.value]:
            raise ValueError("Cannot update approved or paid invoice")
        
        # إعادة حساب المجاميع إذا تم تحديث الأسطر
        if "lines" in updates:
            lines = [InvoiceLine(**line) for line in updates["lines"]]
            for i, line in enumerate(lines):
                line.line_number = i + 1
                lines[i] = calculate_line_totals(line)
            updates["lines"] = [line.dict() for line in lines]
            
            # إنشاء فاتورة مؤقتة لحساب المجاميع
            temp_invoice = Invoice(**{**invoice, **updates})
            temp_invoice = calculate_invoice_totals(temp_invoice)
            updates["subtotal"] = temp_invoice.subtotal
            updates["total_discount"] = temp_invoice.total_discount
            updates["total_after_discount"] = temp_invoice.total_after_discount
            updates["total_tax"] = temp_invoice.total_tax
            updates["grand_total"] = temp_invoice.grand_total
            updates["amount_due"] = temp_invoice.amount_due
        
        updates["updated_at"] = datetime.utcnow().isoformat()
        
        result = await self.db.invoices.find_one_and_update(
            {"id": invoice_id},
            {"$set": updates},
            return_document=True
        )
        if result:
            result.pop("_id", None)
        return result
    
    async def approve_invoice(self, invoice_id: str, user_id: str) -> Dict:
        """اعتماد الفاتورة وإنشاء القيد المحاسبي"""
        invoice = await self.get_invoice(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        
        if invoice["status"] != DocumentStatus.DRAFT.value:
            raise ValueError("Invoice is not in draft status")
        
        # إنشاء القيد المحاسبي
        journal_entry_id = await self._create_invoice_journal_entry(invoice, user_id)
        
        # تحديث حالة الفاتورة
        updates = {
            "status": DocumentStatus.APPROVED.value,
            "approved_by": user_id,
            "approved_at": datetime.utcnow().isoformat(),
            "journal_entry_id": journal_entry_id,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = await self.db.invoices.find_one_and_update(
            {"id": invoice_id},
            {"$set": updates},
            return_document=True
        )
        result.pop("_id", None)
        return result
    
    async def _create_invoice_journal_entry(self, invoice: Dict, user_id: str) -> str:
        """إنشاء القيد المحاسبي للفاتورة"""
        doc_type = invoice["document_type"]
        
        # الحصول على الحسابات
        accounts = await self.accounting.get_all_accounts(invoice["company_id"])
        
        def find_account(code: str) -> Optional[Dict]:
            return next((a for a in accounts if a["account_code"] == code), None)
        
        lines = []
        
        if doc_type == DocumentType.SALES_INVOICE.value:
            # فاتورة بيع — يحدد نوع الخدمة القيد المناسب
            inv_type    = invoice_extra.get("invoice_type", "goods")
            wht_rate    = float(invoice_extra.get("client_wht_rate", 0.0))
            wht_amount  = float(invoice_extra.get("client_wht_amount", 0.0))
            
            # حساب WHT إن لم يُحدَّد يدوياً
            if wht_rate > 0 and wht_amount == 0:
                wht_amount = round(invoice["total_after_discount"] * wht_rate, 2)
            
            customers_acc  = find_account("131")   # العملاء — مدينون
            vat_out_acc    = find_account("260")   # ضريبة القيمة المضافة مخرجات
            wht_asset_acc  = find_account("138")   # ضريبة الخصم والتحصيل لدى العملاء
            tax_acc        = vat_out_acc
            
            # حساب الإيراد حسب نوع الفاتورة
            # قانون 91/2005 م.59: المهن الحرة والاستشارات — 5% خصم وتحصيل
            PROFESSIONAL_TYPES = {"engineering", "consulting", "medical_professional",
                                   "legal", "accounting", "services"}
            
            if inv_type in PROFESSIONAL_TYPES:
                # ── فاتورة خدمات مهنية / استشارات هندسية ──────────────
                # م/416 إيرادات استشارات هندسية ومهنية (دليل الحسابات المصري)
                sales_acc = find_account("416")
                if not sales_acc:
                    # م/412 إيراد تقديم خدمات / تشغيل للغير (fallback)
                    sales_acc = find_account("412")
                    if not sales_acc:
                        sales_acc = find_account("411")
                rev_desc = "إيرادات استشارات هندسية ومهنية — خدمات مهن حرة"
            else:
                # ── فاتورة بضائع عادية ─────────────────────────────────
                # م/411 إيراد مبيعات بضائع
                sales_acc = find_account("411")
                rev_desc = "إيرادات مبيعات"
            
            # ── مدين 1: العملاء (صافي المطلوب = grand_total - WHT) ────
            # العميل يدفع: قيمة الفاتورة + VAT - WHT المستقطع
            net_ar = round(invoice["grand_total"] - wht_amount, 2)
            if customers_acc:
                lines.append(JournalEntryLine(
                    account_id=customers_acc["id"],
                    account_code=customers_acc["account_code"],
                    account_name=customers_acc["account_name"],
                    debit=net_ar,
                    credit=0,
                    description=f"فاتورة {invoice['document_number']} — {invoice['party_name']} (صافي بعد خصم وتحصيل)"
                ))
            
            # ── مدين 2: ضريبة الخصم والتحصيل لدى العملاء (WHT asset) ──
            # العميل استقطعها — تُعتبر أصلاً ضريبياً قابلاً للخصم لاحقاً
            if wht_amount > 0 and wht_asset_acc:
                lines.append(JournalEntryLine(
                    account_id=wht_asset_acc["id"],
                    account_code=wht_asset_acc["account_code"],
                    account_name=wht_asset_acc["account_name"],
                    debit=wht_amount,
                    credit=0,
                    description=f"ضريبة خصم وتحصيل {round(wht_rate*100)}% محتجزة لدى {invoice['party_name']}"
                ))
            
            # ── دائن 1: إيرادات (م/421 خدمات أو م/411 بضائع) ──────────
            if sales_acc:
                lines.append(JournalEntryLine(
                    account_id=sales_acc["id"],
                    account_code=sales_acc["account_code"],
                    account_name=sales_acc["account_name"],
                    debit=0,
                    credit=invoice["total_after_discount"],
                    description=rev_desc
                ))
            
            # ── دائن 2: ضريبة القيمة المضافة 14% مخرجات ───────────────
            if tax_acc and invoice["total_tax"] > 0:
                lines.append(JournalEntryLine(
                    account_id=tax_acc["id"],
                    account_code=tax_acc["account_code"],
                    account_name=tax_acc["account_name"],
                    debit=0,
                    credit=invoice["total_tax"],
                    description=f"ضريبة القيمة المضافة 14% مخرجات"
                ))
        
        elif doc_type == DocumentType.PURCHASE_INVOICE.value:
            # فاتورة شراء: المشتريات (مدين) - ضريبة (مدين) - الموردين (دائن)
            suppliers_acc = find_account("251")   # الموردون
            purchases_acc = find_account("311")   # تكلفة الخامات والمواد
            tax_acc = find_account("254")   # الضرائب المستحقة
            
            if purchases_acc:
                lines.append(JournalEntryLine(
                    account_id=purchases_acc["id"],
                    account_code=purchases_acc["account_code"],
                    account_name=purchases_acc["account_name"],
                    debit=invoice["total_after_discount"],
                    credit=0,
                    description=f"مشتريات"
                ))
            
            if tax_acc and invoice["total_tax"] > 0:
                lines.append(JournalEntryLine(
                    account_id=tax_acc["id"],
                    account_code=tax_acc["account_code"],
                    account_name=tax_acc["account_name"],
                    debit=invoice["total_tax"],
                    credit=0,
                    description=f"ضريبة مدخلات"
                ))
            
            if suppliers_acc:
                lines.append(JournalEntryLine(
                    account_id=suppliers_acc["id"],
                    account_code=suppliers_acc["account_code"],
                    account_name=suppliers_acc["account_name"],
                    debit=0,
                    credit=invoice["grand_total"],
                    description=f"فاتورة شراء {invoice['document_number']} - {invoice['party_name']}"
                ))
        
        # إنشاء القيد
        entry = JournalEntry(
            company_id=invoice["company_id"],
            entry_number=0,
            entry_date=invoice["document_date"],
            reference=invoice["document_number"],
            description=f"{'فاتورة بيع' if doc_type == DocumentType.SALES_INVOICE.value else 'فاتورة شراء'} - {invoice['party_name']}",
            lines=lines,
            created_by=user_id
        )
        
        result = await self.accounting.create_journal_entry(entry)
        
        # ترحيل القيد
        await self.accounting.post_journal_entry(result["id"], user_id)
        
        return result["id"]
    
    # ==========================================
    # Payment Operations
    # ==========================================
    
    async def record_payment(self, payment: Payment, user_id: str) -> Dict:
        """تسجيل سداد للفاتورة"""
        invoice = await self.get_invoice(payment.invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")
        
        if invoice["status"] == DocumentStatus.CANCELLED.value:
            raise ValueError("Cannot record payment for cancelled invoice")
        
        if payment.amount > invoice["amount_due"]:
            raise ValueError("Payment amount exceeds amount due")
        
        # إنشاء قيد السداد
        journal_entry_id = await self._create_payment_journal_entry(invoice, payment, user_id)
        payment.journal_entry_id = journal_entry_id
        
        # حفظ السداد
        payment_dict = payment.dict()
        await self.db.payments.insert_one(payment_dict)
        payment_dict.pop("_id", None)
        
        # تحديث الفاتورة
        new_amount_paid = invoice["amount_paid"] + payment.amount
        new_amount_due = invoice["grand_total"] - new_amount_paid
        new_status = DocumentStatus.PAID.value if new_amount_due <= 0 else DocumentStatus.PARTIALLY_PAID.value
        
        await self.db.invoices.update_one(
            {"id": payment.invoice_id},
            {"$set": {
                "amount_paid": new_amount_paid,
                "amount_due": new_amount_due,
                "status": new_status,
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        
        return payment_dict
    
    async def _create_payment_journal_entry(self, invoice: Dict, payment: Payment, user_id: str) -> str:
        """إنشاء القيد المحاسبي للسداد"""
        accounts = await self.accounting.get_all_accounts(invoice["company_id"])
        
        def find_account(code: str) -> Optional[Dict]:
            return next((a for a in accounts if a["account_code"] == code), None)
        
        lines = []
        cash_acc = find_account("161")   # النقدية بالصندوق
        
        if invoice["document_type"] == DocumentType.SALES_INVOICE.value:
            # سداد فاتورة بيع: النقدية (مدين) - العملاء (دائن)
            customers_acc = find_account("131")
            
            if cash_acc:
                lines.append(JournalEntryLine(
                    account_id=cash_acc["id"],
                    account_code=cash_acc["account_code"],
                    account_name=cash_acc["account_name"],
                    debit=payment.amount,
                    credit=0,
                    description=f"سداد فاتورة {invoice['document_number']}"
                ))
            
            if customers_acc:
                lines.append(JournalEntryLine(
                    account_id=customers_acc["id"],
                    account_code=customers_acc["account_code"],
                    account_name=customers_acc["account_name"],
                    debit=0,
                    credit=payment.amount,
                    description=f"سداد من {invoice['party_name']}"
                ))
        
        else:
            # سداد فاتورة شراء: الموردين (مدين) - النقدية (دائن)
            suppliers_acc = find_account("251")
            
            if suppliers_acc:
                lines.append(JournalEntryLine(
                    account_id=suppliers_acc["id"],
                    account_code=suppliers_acc["account_code"],
                    account_name=suppliers_acc["account_name"],
                    debit=payment.amount,
                    credit=0,
                    description=f"سداد فاتورة {invoice['document_number']}"
                ))
            
            if cash_acc:
                lines.append(JournalEntryLine(
                    account_id=cash_acc["id"],
                    account_code=cash_acc["account_code"],
                    account_name=cash_acc["account_name"],
                    debit=0,
                    credit=payment.amount,
                    description=f"سداد إلى {invoice['party_name']}"
                ))
        
        entry = JournalEntry(
            company_id=invoice["company_id"],
            entry_number=0,
            entry_date=payment.payment_date,
            reference=f"PAY-{invoice['document_number']}",
            description=f"سداد فاتورة {invoice['document_number']} - {invoice['party_name']}",
            lines=lines,
            created_by=user_id
        )
        
        result = await self.accounting.create_journal_entry(entry)
        await self.accounting.post_journal_entry(result["id"], user_id)
        
        return result["id"]
    
    async def get_invoice_payments(self, invoice_id: str) -> List[Dict]:
        """الحصول على مدفوعات الفاتورة"""
        payments = await self.db.payments.find(
            {"invoice_id": invoice_id},
            {"_id": 0}
        ).sort("payment_date", -1).to_list(length=100)
        return payments
    
    # ==========================================
    # Convert Quotation to Invoice
    # ==========================================
    
    async def convert_quotation_to_invoice(self, quotation_id: str, user_id: str, company_name: str = "") -> Dict:
        """تحويل عرض السعر إلى فاتورة"""
        quotation = await self.get_invoice(quotation_id)
        if not quotation:
            raise ValueError("Quotation not found")
        
        if quotation["document_type"] != DocumentType.SALES_QUOTATION.value:
            raise ValueError("Document is not a quotation")
        
        if quotation["status"] == DocumentStatus.CONVERTED.value:
            raise ValueError("Quotation already converted")
        
        # إنشاء فاتورة جديدة من عرض السعر
        invoice = Invoice(
            company_id=quotation["company_id"],
            document_type=DocumentType.SALES_INVOICE,
            document_number="",  # Will be generated
            document_date=datetime.utcnow().strftime("%Y-%m-%d"),
            party_id=quotation["party_id"],
            party_name=quotation["party_name"],
            party_tax_id=quotation.get("party_tax_id"),
            party_address=quotation.get("party_address"),
            currency=Currency(quotation["currency"]),
            payment_terms=PaymentTerms(quotation["payment_terms"]),
            lines=[InvoiceLine(**line) for line in quotation["lines"]],
            notes=quotation.get("notes"),
            converted_from_id=quotation_id,
            created_by=user_id
        )
        
        result = await self.create_invoice(invoice, company_name)
        
        # تحديث حالة عرض السعر
        await self.db.invoices.update_one(
            {"id": quotation_id},
            {"$set": {"status": DocumentStatus.CONVERTED.value, "updated_at": datetime.utcnow().isoformat()}}
        )
        
        return result
    
    # ==========================================
    # Reports
    # ==========================================
    
    async def get_sales_summary(self, company_id: str, start_date: str, end_date: str) -> Dict:
        """ملخص المبيعات"""
        pipeline = [
            {
                "$match": {
                    "company_id": company_id,
                    "document_type": DocumentType.SALES_INVOICE.value,
                    "status": {"$in": [DocumentStatus.APPROVED.value, DocumentStatus.PAID.value, DocumentStatus.PARTIALLY_PAID.value]},
                    "document_date": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_sales": {"$sum": "$grand_total"},
                    "total_tax": {"$sum": "$total_tax"},
                    "total_paid": {"$sum": "$amount_paid"},
                    "total_due": {"$sum": "$amount_due"},
                    "invoice_count": {"$sum": 1}
                }
            }
        ]
        
        result = await self.db.invoices.aggregate(pipeline).to_list(length=1)
        
        if result:
            return result[0]
        return {
            "total_sales": 0,
            "total_tax": 0,
            "total_paid": 0,
            "total_due": 0,
            "invoice_count": 0
        }
    
    async def get_outstanding_invoices(self, company_id: str, party_type: str = None) -> List[Dict]:
        """الفواتير المستحقة"""
        query = {
            "company_id": company_id,
            "amount_due": {"$gt": 0},
            "status": {"$in": [DocumentStatus.APPROVED.value, DocumentStatus.PARTIALLY_PAID.value]}
        }
        
        if party_type == "customer":
            query["document_type"] = DocumentType.SALES_INVOICE.value
        elif party_type == "supplier":
            query["document_type"] = DocumentType.PURCHASE_INVOICE.value
        
        invoices = await self.db.invoices.find(
            query,
            {"_id": 0, "id": 1, "document_number": 1, "document_date": 1, "due_date": 1,
             "party_name": 1, "grand_total": 1, "amount_due": 1, "document_type": 1}
        ).sort("due_date", 1).to_list(length=1000)
        
        return invoices
