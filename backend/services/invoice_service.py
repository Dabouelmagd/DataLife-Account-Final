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
        settle = await self._settle_amount(journal_entry_id, invoice["document_type"], invoice["grand_total"])
        
        # تحديث حالة الفاتورة
        updates = {
            "status": DocumentStatus.APPROVED.value,
            "approved_by": user_id,
            "approved_at": datetime.utcnow().isoformat(),
            "journal_entry_id": journal_entry_id,
            # what is actually owed, net of withholding (1,140 invoice -> 1,130 to
            # the supplier). amount_due used to be the gross total, so a fully
            # settled invoice stayed "partially paid" with a phantom 10.
            "settle_amount": settle,
            "amount_due": settle,
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
        # invoice_type / client_wht_* are stored on the invoice itself. This
        # name was never defined, so approving ANY sales or purchase invoice
        # raised NameError and no invoice could be approved or journalised.
        invoice_extra = invoice
        
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
        
        elif doc_type in (DocumentType.CREDIT_NOTE.value, DocumentType.DEBIT_NOTE.value):
            # إشعار دائن: عكس فاتورة البيع — من ح/ المبيعات + ضريبة المخرجات ← إلى ح/ العملاء
            # إشعار مدين: العكس (زيادة على العميل)
            credit_note = doc_type == DocumentType.CREDIT_NOTE.value

            # Which side of the business the note corrects. A note against a
            # PURCHASE invoice (goods returned to a supplier) must move
            # suppliers, purchases and INPUT VAT — it was posting to customers,
            # revenue and output VAT like a sales return, which would have
            # inflated sales and understated what the company owes.
            original = None
            if invoice.get("original_invoice_id"):
                original = await self.db.invoices.find_one(
                    {"id": invoice["original_invoice_id"], "company_id": invoice["company_id"]},
                    {"_id": 0, "document_type": 1})
            purchase_side = bool(original) and \
                original.get("document_type") == DocumentType.PURCHASE_INVOICE.value

            if purchase_side:
                # مردود مشتريات: من ح/ الموردين ← إلى ح/ المشتريات + ضريبة المدخلات
                party_acc = find_account("251")
                _method = await self.inventory_method(invoice["company_id"])
                goods_acc = (find_account("125") or find_account("311")) if _method == "perpetual" \
                    else find_account("311")
                tax_acc = find_account("137") or find_account("254")
                if not (party_acc and goods_acc):
                    raise ValueError("حسابات الموردين أو المشتريات غير موجودة في شجرة الحسابات")
                customers, revenue, vat_out = party_acc, goods_acc, tax_acc
            else:
                customers = find_account("131")
                revenue = find_account("411") or find_account("412")
                vat_out = find_account("260")
                if not (customers and revenue):
                    raise ValueError("حسابات العملاء أو المبيعات غير موجودة في شجرة الحسابات")
            net = round(float(invoice.get("total_after_discount") or 0), 2)
            tax = round(float(invoice.get("total_tax") or 0), 2)
            total = round(float(invoice.get("grand_total") or 0), 2)

            def line(acc, amount, debit: bool, text: str):
                return JournalEntryLine(
                    account_id=acc["id"], account_code=acc["account_code"], account_name=acc["account_name"],
                    debit=amount if debit else 0.0, credit=0.0 if debit else amount, description=text)

            # A purchase debit note already has the right shape: the party line
            # takes the opposite side to the goods line, so the supplier is
            # debited (we owe less) and purchases are credited. No flip needed.
            label = ("إشعار دائن" if doc_type == DocumentType.CREDIT_NOTE.value else "إشعار مدين")
            ref = invoice.get("original_invoice_number") or invoice.get("document_number")
            if net:
                lines.append(line(revenue, net, credit_note, f"{label} — مردودات/خصم على الفاتورة {ref}"))
            if tax and vat_out:
                lines.append(line(vat_out, tax, credit_note, f"ضريبة {label} — {ref}"))
            lines.append(line(customers, total, not credit_note, f"{label} — {invoice.get('party_name', '')}"))

        elif doc_type == DocumentType.PURCHASE_INVOICE.value:
            # فاتورة شراء — الدورة المستندية المصرية (مبيعات ومشتريات)
            # قانون 91/2005 م.59: خصم وتحصيل = 1% توريدات | 3% خدمات
            
            # حسابات المشتريات
            suppliers_acc = find_account("251")   # الموردون — دائن
            # periodic: purchases are an expense (311) and the period-end count
            # adjusts. perpetual: they capitalise into stock (125) and each sale
            # posts its own cost. Mixing the two counted cost twice.
            _method = await self.inventory_method(invoice["company_id"])
            purchases_acc = (find_account("125") or find_account("311")) if _method == "perpetual" \
                else find_account("311")
            # ✅ VAT مدخلات = أصل (قابل للخصم من VAT مخرجات)
            vat_in_acc   = find_account("137")    # ضريبة القيمة المضافة مدخلات
            if not vat_in_acc:
                vat_in_acc = find_account("254")  # fallback
            # WHT نستقطعه من المورد ونودعه لمصلحة الضرائب
            wht_pay_acc  = find_account("261")    # مصلحة الضرائب — خصم وتحصيل مستحق
            
            # WHT rate: 1% توريدات بضائع | 3% خدمات
            p_inv_type   = invoice_extra.get("invoice_type", "goods")
            p_wht_rate   = 0.03 if p_inv_type in {"services","engineering","consulting"} else 0.01
            # تطبيق WHT فقط إذا كانت قيمة الشراء > 300 ج.م (حد الإعفاء الضريبي)
            purchase_base = invoice["total_after_discount"]
            p_wht_amount  = round(purchase_base * p_wht_rate, 2) if purchase_base > 300 else 0
            # صافي المستحق للمورد = grand_total - WHT
            supplier_net  = round(invoice["grand_total"] - p_wht_amount, 2)
            
            # ── مدين 1: المخزون / المصروفات ──────────────────────────
            if purchases_acc:
                lines.append(JournalEntryLine(
                    account_id=purchases_acc["id"],
                    account_code=purchases_acc["account_code"],
                    account_name=purchases_acc["account_name"],
                    debit=purchase_base,
                    credit=0,
                    description=f"مشتريات — {invoice['party_name']}"
                ))
            
            # ── مدين 2: VAT مدخلات 14% (قابل للخصم) ─────────────────
            if vat_in_acc and invoice["total_tax"] > 0:
                lines.append(JournalEntryLine(
                    account_id=vat_in_acc["id"],
                    account_code=vat_in_acc["account_code"],
                    account_name=vat_in_acc["account_name"],
                    debit=invoice["total_tax"],
                    credit=0,
                    description=f"ضريبة القيمة المضافة مدخلات 14% — {invoice['party_name']}"
                ))
            
            # ── دائن 1: الموردون (صافي المستحق = grand_total - WHT) ──
            if suppliers_acc:
                lines.append(JournalEntryLine(
                    account_id=suppliers_acc["id"],
                    account_code=suppliers_acc["account_code"],
                    account_name=suppliers_acc["account_name"],
                    debit=0,
                    credit=supplier_net,
                    description=f"فاتورة شراء {invoice['document_number']} — {invoice['party_name']} (صافي بعد خصم وتحصيل)"
                ))
            
            # ── دائن 2: ضريبة الخصم والتحصيل مستحقة لمصلحة الضرائب ──
            if wht_pay_acc and p_wht_amount > 0:
                wht_type_label = "3% خدمات" if p_inv_type in {"services","engineering","consulting"} else "1% توريدات"
                lines.append(JournalEntryLine(
                    account_id=wht_pay_acc["id"],
                    account_code=wht_pay_acc["account_code"],
                    account_name=wht_pay_acc["account_name"],
                    debit=0,
                    credit=p_wht_amount,
                    description=f"ضريبة خصم وتحصيل {wht_type_label} — {invoice['party_name']}"
                ))
        
        # ── التحقق من توازن القيد (مدين = دائن) ──────────────────
        total_dr = round(sum(l.debit  for l in lines), 2)
        total_cr = round(sum(l.credit for l in lines), 2)
        if abs(total_dr - total_cr) > 0.01:
            import logging
            logging.warning(
                f"Invoice journal imbalance: doc={invoice.get('document_number')} "
                f"debit={total_dr} credit={total_cr} diff={abs(total_dr-total_cr)}"
            )
        
        # إنشاء القيد
        entry = JournalEntry(
            company_id=invoice["company_id"],
            entry_number=0,
            entry_date=invoice["document_date"],
            reference=invoice["document_number"],
            description=f"{ {'sales_invoice': 'فاتورة بيع', 'purchase_invoice': 'فاتورة شراء', 'credit_note': 'إشعار دائن', 'debit_note': 'إشعار مدين'}.get(doc_type, 'مستند') } - {invoice['party_name']}",
            lines=lines,
            source_document_type="invoice",
            source_document_id=invoice.get("id"),
            created_by=user_id
        )
        
        result = await self.accounting.create_journal_entry(entry)
        
        # ترحيل القيد
        await self.accounting.post_journal_entry(result["id"], user_id)
        
        # ── قيد تكلفة البضاعة المباعة (COGS) — للمبيعات فقط ──────────
        # من حـ/ تكلفة البضاعة المباعة (321) ← إلى حـ/ المخزون (125 بضائع بغرض البيع)
        # Cost of sales is posted per invoice only under the perpetual method.
        # Under the periodic method purchases are already an expense (311) and
        # the period-end count adjusts — posting both counted cost twice.
        method = await self.inventory_method(invoice["company_id"])
        if doc_type == DocumentType.PURCHASE_INVOICE.value:
            await self._receive_purchase_stock(invoice)
        if doc_type == DocumentType.SALES_INVOICE.value:
            await self._create_cogs_entry(invoice, user_id, post_entry=(method == "perpetual"))
        elif doc_type == DocumentType.CREDIT_NOTE.value and invoice.get("restock", True):
            await self._create_cogs_entry(invoice, user_id, reverse=True, post_entry=(method == "perpetual"))
        elif doc_type == DocumentType.DEBIT_NOTE.value and invoice.get("restock", True):
            # goods handed back to the supplier leave the warehouse
            for line in invoice.get("lines", []):
                if line.get("product_id") and float(line.get("quantity", 0) or 0):
                    await self.db.stocks.update_one(
                        {"company_id": invoice["company_id"], "product_id": line["product_id"],
                         "warehouse_id": line.get("warehouse_id", "main")},
                        {"$inc": {"quantity": -float(line["quantity"])}}, upsert=True)
        
        return result["id"]
    
    async def _receive_purchase_stock(self, invoice: dict) -> None:
        """بضاعة مشتراة تدخل المخزون وتحدّث متوسط التكلفة المتحرك.

        weighted average: (old qty x old cost + received qty x price) / total qty.
        Purchased goods used to change no quantity at all, so stock only ever
        fell with sales.
        """
        company_id = invoice["company_id"]
        for line in invoice.get("lines", []):
            product_id, qty = line.get("product_id"), float(line.get("quantity", 0) or 0)
            if not product_id or qty <= 0:
                continue
            price = float(line.get("unit_price", 0) or 0)
            warehouse = line.get("warehouse_id", "main")
            stock = await self.db.stocks.find_one(
                {"company_id": company_id, "product_id": product_id, "warehouse_id": warehouse},
                {"_id": 0}) or {}
            old_qty = float(stock.get("quantity") or 0)
            old_cost = float(stock.get("unit_cost") or 0)
            new_qty = old_qty + qty
            # a negative or zero opening balance cannot be averaged into
            new_cost = round(((max(old_qty, 0) * old_cost) + (qty * price)) / new_qty, 4) \
                if new_qty > 0 else price
            await self.db.stocks.update_one(
                {"company_id": company_id, "product_id": product_id, "warehouse_id": warehouse},
                {"$set": {"quantity": round(new_qty, 3), "unit_cost": new_cost,
                          "last_purchase_price": price}}, upsert=True)

    async def inventory_method(self, company_id: str) -> str:
        """"periodic" (الجرد الدوري) or "perpetual" (الجرد المستمر).

        Both are accepted in Egypt. Periodic is the default, and it is what the
        purchase posting and the periodic count screen assume: purchases are an
        expense (311) and the count at period end adjusts. Under perpetual,
        purchases capitalise into stock (125) and each sale posts its own cost.

        These must never be mixed: cost was being counted twice — purchases were
        expensed AND every sale posted a cost entry as well.
        """
        company = await self.db.companies.find_one({"id": company_id}, {"_id": 0, "inventory_method": 1}) or {}
        return "perpetual" if company.get("inventory_method") == "perpetual" else "periodic"

    async def moving_average_cost(self, company_id: str, product_id: str) -> float:
        """Weighted average cost held on the stock record (0 if unknown)."""
        rows = await self.db.stocks.find(
            {"company_id": company_id, "product_id": product_id}, {"_id": 0}).to_list(None)
        qty = sum(float(r.get("quantity") or 0) for r in rows)
        value = sum(float(r.get("quantity") or 0) * float(r.get("unit_cost") or 0) for r in rows)
        if qty > 0:
            return round(value / qty, 4)
        return round(float(next((r.get("unit_cost") for r in rows if r.get("unit_cost")), 0) or 0), 4)

    async def _create_cogs_entry(self, invoice: dict, user_id: str, reverse: bool = False,
                                 post_entry: bool = True) -> None:
        """قيد تكلفة البضاعة المباعة (الجرد المستمر) وحركة المخزون.

        post_entry=False: quantities still move (the warehouse is the same
        either way) but no cost entry is posted — that is the periodic method.
        """
        # Stock moves whichever method is in use — a sale takes the goods out,
        # a return puts them back. This happens before any accounting decision
        # so an unknown cost can never leave the warehouse count wrong.
        sign = 1.0 if reverse else -1.0
        for line in invoice.get("lines", []):
            if line.get("product_id") and float(line.get("quantity", 0) or 0):
                await self.db.stocks.update_one(
                    {"company_id": invoice["company_id"], "product_id": line["product_id"],
                     "warehouse_id": line.get("warehouse_id", "main")},
                    {"$inc": {"quantity": sign * float(line["quantity"])}}, upsert=True)
        if not post_entry:
            return                      # periodic: quantities only, no cost entry

        try:
            accounts = await self.accounting.get_all_accounts(invoice["company_id"])
            def find_account(code):
                return next((a for a in accounts if a["account_code"] == code), None)
            
            # 321 is "فوائد وعمولات بنكية مدينة" in this chart — every sale's cost
            # was being posted to bank charges. 314 is cost of goods sold.
            cogs_acc  = find_account("314") or find_account("311")
            # 131 is ACCOUNTS RECEIVABLE in this chart, not stock: every sales
            # invoice was taking its cost out of the customer's balance.
            stock_acc = find_account("125") or find_account("122") or find_account("121")
            
            if post_entry and not (cogs_acc and stock_acc):
                return  # Accounts not in chart — skip COGS entry
            
            # حساب إجمالي التكلفة من بنود الفاتورة
            total_cost = 0.0
            for line in invoice.get("lines", []):
                qty      = float(line.get("quantity", 0))
                # was: unit_price * 0.7 — a 30% margin invented and posted to the
                # ledger. Cost comes from the stock's moving average, or the
                # product's cost price; an unknown cost posts nothing.
                cost = float(line.get("unit_cost") or 0)
                if not cost and line.get("product_id"):
                    cost = await self.moving_average_cost(invoice["company_id"], line["product_id"])
                if not cost and line.get("product_id"):
                    prod = await self.db.products.find_one(
                        {"id": line["product_id"], "company_id": invoice["company_id"]},
                        {"_id": 0, "cost_price": 1}) or {}
                    cost = float(prod.get("cost_price") or 0)
                total_cost += qty * cost
            
            total_cost = round(total_cost, 2)
            if total_cost <= 0:
                return  # No cost to record
            
            cogs_lines = [
                JournalEntryLine(
                    account_id=cogs_acc["id"],
                    account_code=cogs_acc["account_code"],
                    account_name=cogs_acc["account_name"],
                    debit=0 if reverse else total_cost,
                    credit=total_cost if reverse else 0,
                    description=f"تكلفة البضاعة المباعة — فاتورة {invoice['document_number']}"
                ),
                JournalEntryLine(
                    account_id=stock_acc["id"],
                    account_code=stock_acc["account_code"],
                    account_name=stock_acc["account_name"],
                    debit=total_cost if reverse else 0,
                    credit=0 if reverse else total_cost,
                    description=f"إقفال بضاعة مباعة — فاتورة {invoice['document_number']}"
                ),
            ]
            
            cogs_entry = JournalEntry(
                company_id=invoice["company_id"],
                entry_number=0,
                entry_date=invoice["document_date"],
                reference=f"COGS-{invoice['document_number']}",
                description=f"تكلفة البضاعة المباعة — {invoice['party_name']}",
                lines=cogs_lines,
                created_by=user_id
            )
            if post_entry:
                cogs_result = await self.accounting.create_journal_entry(cogs_entry)
                await self.accounting.post_journal_entry(cogs_result["id"], user_id)


        except Exception as e:
            # a cost entry must never block the invoice itself
            logger.error(f"COGS entry failed for {invoice.get('document_number')}: {e}")

    async def _settle_amount(self, je_id: str, doc_type: str, fallback: float) -> float:
        """What is actually owed: the net the entry put on 131 (sales) or 251
        (purchases) — net of withholding, so a fully settled invoice does not
        stay 'partially paid' with a phantom remainder."""
        je = await self.db.journal_entries.find_one({"id": je_id}, {"_id": 0, "lines": 1}) or {}
        code = "131" if doc_type == DocumentType.SALES_INVOICE.value else "251"
        net = sum((l.get("debit", 0) - l.get("credit", 0)) if code == "131" else (l.get("credit", 0) - l.get("debit", 0))
                  for l in je.get("lines", []) if l.get("account_code") == code)
        return round(net, 2) if net > 0 else round(float(fallback), 2)

    async def apply_external_payment(self, company_id: str, party_id: str, doc_type: str, amount: float,
                                     source: str, ref_id: str, date: str):
        """Apply a payment that was posted ELSEWHERE (a supplier payment, an issued
        cheque) to the party's open invoices, oldest first. No journal entry here —
        the caller already posted one. Returns (applied, unapplied)."""
        left = round(float(amount), 2)
        applied = []
        invs = await self.db.invoices.find(
            {"company_id": company_id, "party_id": party_id, "document_type": doc_type,
             "status": {"$in": [DocumentStatus.APPROVED.value, DocumentStatus.PARTIALLY_PAID.value]}},
            {"_id": 0}).sort("document_date", 1).to_list(None)
        for inv in invs:
            if left <= 0.004:
                break
            base = inv.get("settle_amount") or inv["grand_total"]
            open_amt = round(base - (inv.get("amount_paid") or 0), 2)
            if open_amt <= 0.004:
                continue
            part = round(min(left, open_amt), 2)
            paid = round((inv.get("amount_paid") or 0) + part, 2)
            due = round(base - paid, 2)
            await self.db.invoices.update_one({"id": inv["id"]}, {
                "$set": {"amount_paid": paid, "amount_due": max(due, 0),
                         "status": DocumentStatus.PAID.value if due <= 0.004 else DocumentStatus.PARTIALLY_PAID.value,
                         "updated_at": datetime.utcnow().isoformat()},
                "$push": {"allocations": {"source": source, "ref_id": ref_id, "amount": part, "date": date}}})
            applied.append({"invoice_id": inv["id"], "document_number": inv.get("document_number"), "amount": part})
            left = round(left - part, 2)
        return applied, left

    async def _create_payment_journal_entry(self, invoice: Dict, payment: Payment, user_id: str) -> str:
        """إنشاء القيد المحاسبي للسداد"""
        accounts = await self.accounting.get_all_accounts(invoice["company_id"])
        
        def find_account(code: str) -> Optional[Dict]:
            return next((a for a in accounts if a["account_code"] == code), None)
        
        lines = []
        # cash only for cash payments; anything else settles through the bank —
        # bank transfers used to be posted to the treasury account
        _method = str(getattr(payment, "payment_method", "") or "").lower()
        _method = getattr(_method, "value", _method)
        cash_acc = find_account("161") if "cash" in _method and "wallet" not in _method else find_account("162")
        
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
