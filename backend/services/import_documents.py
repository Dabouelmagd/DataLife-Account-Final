"""
استيراد العملاء والموردين والأصناف والفواتير والمشتريات — كل صف يدخل من
نفس الطريق الذي تستخدمه الشاشات، فيظهر فيها ويُرحَّل إلى دفتر الأستاذ.

What the old importers did, and why each one was wrong:

  customers / suppliers  stored a "balance" number on the party. The party
                         statement and the receivables screen read invoices and
                         the journal, never that field — so the balance was
                         visible nowhere and absent from the trial balance.
  inventory              wrote to `inventory`, a collection no screen reads.
                         The items simply did not exist for the user.
  invoices               wrote a bare row (no party, no lines, no tax, no
                         entry). It showed in some lists and in no account.
  purchases              wrote to `purchases`, read only by one analytics card.

Now:

  party + opening balance   party in `parties`; a non-zero balance becomes an
                            approved opening document with its own entry
                            (customer Dr 131 / Cr 213, supplier Dr 213 / Cr 251),
                            so it appears in the statement, the aging and the
                            trial balance, and later receipts settle it.
  item + opening stock      product in `products` + stock in `stocks` (what the
                            inventory screen reads) + entry Dr stock / Cr 213.
  sales / purchase invoice  created and approved through InvoiceService — the
                            same code as the invoice screen — so customer or
                            supplier, VAT and the entry all come out the same
                            way. A row marked paid also gets its payment posted.

213 (الأرباح المرحلة) is the offset for every opening balance: these are
amounts that existed before the books started, not this period's income.
"""
import hashlib
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

OPENING_OFFSET = "213"      # الأرباح (الخسائر) المرحلة
RECEIVABLES = "131"
PAYABLES = "251"
STOCK_ACCOUNTS = ("125", "121", "122")   # بضاعة بغرض البيع، ثم خامات، ثم إنتاج تام

PAID_WORDS = {"paid", "مدفوع", "مدفوعة", "مسدد", "مسددة", "محصل", "محصلة", "تم السداد", "تم التحصيل"}


# ── reading cells ────────────────────────────────────────────────────────────
# An empty Excel cell arrives as NaN. str(NaN) is "nan", so empty emails were
# stored as the word "nan", and float(NaN or 0) is NaN (NaN is truthy), which
# let an empty amount through every "> 0" check.

def cell(row, col) -> str:
    if not col:
        return ""
    v = row.get(col)
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)                      # 1001.0 -> "1001" (codes, phones)
    text = str(v).strip()
    return "" if text.lower() in ("nan", "none", "nat") else text


def num(row, col, default: float = 0.0) -> float:
    text = cell(row, col).replace(",", "").replace("٬", "").replace("،", "")
    if not text:
        return default
    text = text.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩٫", "0123456789."))
    try:
        value = float(text)
    except ValueError:
        raise ValueError(f"قيمة غير رقمية: {cell(row, col)}")
    if math.isnan(value) or math.isinf(value):
        return default
    return value


def date_cell(row, col) -> str:
    """YYYY-MM-DD from a date cell, a text date or an Excel serial; '' if empty.

    Text dates are read day-first (15/02/2026), the way they are written in
    Egypt; ISO dates (2026-02-15) are unambiguous either way.
    """
    if not col:
        return ""
    v = row.get(col)
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    if isinstance(v, (int, float)) and 20000 < float(v) < 80000:      # Excel serial
        return (pd.Timestamp("1899-12-30") + pd.Timedelta(days=float(v))).strftime("%Y-%m-%d")
    if hasattr(v, "strftime"):
        return v.strftime("%Y-%m-%d")
    text = str(v).strip().translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
    if not text or text.lower() in ("nan", "nat", "none"):
        return ""
    iso = len(text) >= 8 and text[:4].isdigit() and text[4] in "-/."
    try:
        return pd.to_datetime(text, dayfirst=not iso, errors="raise").strftime("%Y-%m-%d")
    except Exception:
        raise ValueError(f"تاريخ غير مفهوم: {v}")


class Check:
    """Collects every problem in a file before anything is written.

    A file is imported whole or not at all: one bad row used to be skipped
    while the rest went in, leaving a half-imported sheet that nobody could
    tell apart from a complete one. Now each problem is named — row, column,
    reason — and the user fixes the file and uploads it again.
    """
    def __init__(self):
        self.errors = []

    def err(self, n, label, msg):
        self.errors.append(f"صف {n} — {label}: {msg}")

    def text(self, row, n, col, label, required=False, max_len=200):
        v = cell(row, col)
        if required and not v:
            self.err(n, label, "فارغ")
        elif len(v) > max_len:
            self.err(n, label, f"أطول من {max_len} حرفاً")
        return v

    def number(self, row, n, col, label, required=False, positive=False, default=0.0):
        raw = cell(row, col)
        if not raw:
            if required:
                self.err(n, label, "فارغ")
                return None
            return default
        try:
            v = num(row, col)
        except ValueError:
            self.err(n, label, f"«{raw}» ليس رقماً")
            return None
        if positive and v <= 0:
            self.err(n, label, "يجب أن يكون أكبر من صفر")
            return None
        if v < 0:
            self.err(n, label, "لا يقبل قيمة سالبة")
            return None
        return v

    def date(self, row, n, col, label, required=False):
        raw = cell(row, col)
        if not raw:
            if required:
                self.err(n, label, "فارغ")
            return ""
        try:
            d = date_cell(row, col)
        except ValueError:
            self.err(n, label, f"«{raw}» ليس تاريخاً صحيحاً (اكتبه 2026-02-15 أو 15/02/2026)")
            return ""
        if not ("2000" <= d[:4] <= "2100"):
            self.err(n, label, f"سنة غير منطقية ({d[:4]})")
            return ""
        return d

    def email(self, row, n, col, label="البريد الإلكتروني"):
        v = cell(row, col)
        if v and ("@" not in v or "." not in v.split("@")[-1] or " " in v):
            self.err(n, label, f"«{v}» ليس بريداً صحيحاً")
            return ""
        return v

    def digits(self, row, n, col, label, length):
        v = cell(row, col).replace(" ", "").replace("-", "")
        v = v.translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789"))
        if v and (not v.isdigit() or len(v) != length):
            self.err(n, label, f"«{cell(row, col)}» يجب أن يكون {length} رقماً")
            return ""
        return v

    def once(self, seen: dict, key, n, label):
        """The same value twice in one file (a duplicated row)."""
        if not key:
            return
        k = str(key).strip().lower()
        if k in seen:
            self.err(n, label, f"«{key}» مكرر في الملف (صف {seen[k]})")
        else:
            seen[k] = n


def blank_row(row) -> bool:
    return all(cell(row, c) == "" for c in row.index)


def file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def map_columns(df, column_map: dict) -> dict:
    """{key: actual column} matching names case/space-insensitively."""
    def norm(t):
        return " ".join(str(t).replace(" ", " ").split()).strip().lower()
    actual = {norm(c): c for c in df.columns}
    mapped = {}
    for key, names in column_map.items():
        for n in names:
            if norm(n) in actual:
                mapped[key] = actual[norm(n)]
                break
    return mapped


# ── ledger helpers ───────────────────────────────────────────────────────────

async def _accounts(db, company_id: str, codes) -> dict:
    rows = await db.chart_of_accounts.find(
        {"company_id": company_id, "account_code": {"$in": list(codes)}},
        {"_id": 0, "id": 1, "account_code": 1, "account_name": 1}).to_list(None)
    return {r["account_code"]: r for r in rows}


async def post_two_line_entry(db, company_id: str, user_id: str, date: str, debit_code: str,
                              credit_code: str, amount: float, description: str,
                              source_type: str, source_id: str) -> dict:
    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from services.accounting_service import AccountingService

    accs = await _accounts(db, company_id, [debit_code, credit_code])
    for code in (debit_code, credit_code):
        if code not in accs:
            raise ValueError(f"الحساب {code} غير موجود في شجرة الحسابات")
    amount = round(amount, 2)

    def line(code, dr, cr):
        a = accs[code]
        return JournalEntryLine(account_id=a["id"], account_code=code, account_name=a["account_name"],
                                debit=dr, credit=cr, description=description[:200])

    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=await svc.get_next_entry_number(company_id),
        entry_date=date, description=description[:200],
        lines=[line(debit_code, amount, 0), line(credit_code, 0, amount)],
        total_debit=amount, total_credit=amount, status=JournalEntryStatus.DRAFT,
        source_document_type=source_type, source_document_id=source_id,
        created_by=user_id or "import", fiscal_year=date[:4], period=date[:7])
    created = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(created["id"], user_id or "import")
    return created


# ── parties ──────────────────────────────────────────────────────────────────

async def find_or_create_party(db, company_id: str, name: str, kind: str,
                               extra: Optional[dict] = None) -> Tuple[dict, bool]:
    """(party, created). Same name in the same company = same party."""
    from services.party_store import normalise, add_type
    name = " ".join(name.split())
    existing = await db.parties.find_one(
        {"company_id": company_id, "name": name}, {"_id": 0})
    if existing:
        if existing.get("party_type") not in (kind, "both"):
            add_type(existing, kind)
            await db.parties.update_one({"id": existing["id"]},
                                        {"$set": {"party_type": existing["party_type"]}})
        return existing, False
    doc = {"id": str(uuid.uuid4()), "company_id": company_id, "name": name,
           "country": "EG", "credit_limit": 0.0, "payment_terms": "cash",
           "created_at": datetime.now(timezone.utc).isoformat(), "source": "import"}
    for k, v in (extra or {}).items():
        if v not in (None, ""):
            doc[k] = v
    doc = normalise(add_type(doc, kind))
    await db.parties.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc, True


async def post_party_opening(db, company_id: str, user_id: str, party: dict, kind: str,
                             balance: float, date: str) -> dict:
    """An opening receivable/payable as an approved document with its own entry.

    It is an invoice document (so statements, aging and receipts treat it like
    any other open amount) with no tax and no revenue: the entry is
    Dr 131 / Cr 213 for a customer and Dr 213 / Cr 251 for a supplier.
    """
    if balance < 0:
        raise ValueError("رصيد سالب (دائن للعميل أو مدين للمورد) — أدخله يدوياً كقيد افتتاحي")
    balance = round(balance, 2)
    doc_type = "sales_invoice" if kind == "customer" else "purchase_invoice"
    count = await db.invoices.count_documents({"company_id": company_id, "is_opening_balance": True})
    number = f"OB-{date[:4]}-{count + 1:04d}"
    inv_id = str(uuid.uuid4())
    if kind == "customer":
        dr, cr = RECEIVABLES, OPENING_OFFSET
    else:
        dr, cr = OPENING_OFFSET, PAYABLES
    je = await post_two_line_entry(
        db, company_id, user_id, date, dr, cr, balance,
        f"رصيد افتتاحي — {party['name']}", "opening_balance", inv_id)
    now = datetime.now(timezone.utc).isoformat()
    await db.invoices.insert_one({
        "id": inv_id, "company_id": company_id, "document_type": doc_type,
        "document_number": number, "document_date": date, "due_date": date,
        "party_id": party["id"], "party_name": party["name"],
        "currency": "EGP", "exchange_rate": 1.0, "payment_terms": "cash",
        "lines": [{"line_number": 1, "description": "رصيد افتتاحي", "unit": "unit", "quantity": 1.0,
                   "unit_price": balance, "discount_percent": 0.0, "discount_amount": 0.0,
                   "tax_type": "exempt", "tax_rate": 0.0, "subtotal": balance,
                   "tax_amount": 0.0, "total": balance}],
        "adjustments": [], "subtotal": balance, "total_discount": 0.0,
        "total_after_discount": balance, "total_tax": 0.0, "total_invoice_discount": 0.0,
        "total_invoice_addition": 0.0, "grand_total": balance, "settle_amount": balance,
        "amount_paid": 0.0, "amount_due": balance, "status": "approved",
        "is_opening_balance": True, "eta_status": "NotApplicable",
        "notes": "رصيد افتتاحي مستورد", "journal_entry_id": je["id"],
        "created_by": user_id or "import", "approved_by": user_id or "import",
        "approved_at": now, "created_at": now, "updated_at": now})
    return {"document_number": number, "journal_entry_id": je["id"],
            "entry_number": je.get("entry_number")}


# ── inventory ────────────────────────────────────────────────────────────────

async def _default_warehouse(db, company_id: str) -> dict:
    wh = await db.warehouses.find_one({"company_id": company_id, "is_active": True, "is_default": True}, {"_id": 0}) \
        or await db.warehouses.find_one({"company_id": company_id, "is_active": True}, {"_id": 0})
    if wh:
        return wh
    from models.inventory import Warehouse
    wh = Warehouse(company_id=company_id, code="WH-01", name="المخزن الرئيسي",
                   name_en="Main Warehouse", is_default=True).dict()
    await db.warehouses.insert_one(dict(wh))
    wh.pop("_id", None)
    return wh


async def _unit(db, company_id: str, name: str) -> dict:
    name = name or "قطعة"
    u = await db.units.find_one({"company_id": company_id, "$or": [{"name": name}, {"symbol": name},
                                                                     {"name_en": name}]}, {"_id": 0})
    if u:
        return u
    from models.inventory import UnitOfMeasure
    u = UnitOfMeasure(company_id=company_id, code=name[:10].upper(), name=name,
                      symbol=name, is_base=True).dict()
    await db.units.insert_one(dict(u))
    u.pop("_id", None)
    return u


async def stock_account(db, company_id: str) -> str:
    accs = await _accounts(db, company_id, STOCK_ACCOUNTS)
    for code in STOCK_ACCOUNTS:
        if code in accs:
            return code
    raise ValueError("لا يوجد حساب مخزون (125/121/122) في شجرة الحسابات")


async def import_item(db, company_id: str, user_id: str, data: dict, date: str,
                      stock_code: str) -> dict:
    """Product + opening stock + entry. Returns what happened for the report."""
    from models.inventory import Product, Stock
    code = data["code"]
    existing = await db.products.find_one(
        {"company_id": company_id, "$or": [{"code": code}, {"name": data["name"]}]}, {"_id": 0, "id": 1})
    if existing:
        raise ValueError(f"الصنف موجود بالفعل ({data['name']} / {code}) — لم يُستورد مرة ثانية")

    unit = await _unit(db, company_id, data.get("unit"))
    wh = await _default_warehouse(db, company_id)
    product = Product(
        company_id=company_id, code=code, name=data["name"],
        category_name=data.get("category") or None,
        base_unit_id=unit["id"], base_unit_name=unit["name"], base_unit_symbol=unit.get("symbol") or unit["name"],
        cost_price=data["cost"], sale_price=data["sale_price"],
        reorder_level=data["min_stock"], min_stock=data["min_stock"], created_by=user_id).dict()
    product["unit"] = unit["name"]
    product["unit_price"] = data["sale_price"]        # the invoice screen reads unit_price
    product["source"] = "import"
    await db.products.insert_one(dict(product))

    qty, cost = data["quantity"], data["cost"]
    value = round(qty * cost, 2)
    je = None
    if qty:
        stock = Stock(company_id=company_id, product_id=product["id"], product_code=code,
                      product_name=data["name"], warehouse_id=wh["id"], warehouse_name=wh["name"],
                      quantity=qty, available_qty=qty, unit_cost=cost, total_value=value,
                      last_movement_date=datetime.utcnow()).dict()
        await db.stocks.insert_one(stock)
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()), "company_id": company_id, "product_id": product["id"],
            "product_code": code, "product_name": data["name"], "warehouse_id": wh["id"],
            "warehouse_name": wh["name"], "movement_type": "opening_balance", "movement_date": date,
            "quantity": qty, "unit_cost": cost, "total_cost": value,
            "reference": "رصيد افتتاحي مستورد", "created_by": user_id,
            "created_at": datetime.utcnow()})
    if value > 0:
        je = await post_two_line_entry(db, company_id, user_id, date, stock_code, OPENING_OFFSET, value,
                                       f"رصيد افتتاحي مخزون — {data['name']} ({qty:g} × {cost:g})",
                                       "opening_stock", product["id"])
    return {"product_id": product["id"], "value": value,
            "journal_entry_id": je["id"] if je else None}


# ── invoices ─────────────────────────────────────────────────────────────────

async def import_invoice(db, company_id: str, user_id: str, kind: str, data: dict) -> dict:
    """A sales or purchase invoice through InvoiceService: create, approve
    (journal entry), and record its payment when the sheet says it is paid."""
    from models.invoice import Invoice, InvoiceLine, DocumentType, TaxType, Payment, PaymentMethod
    from services.invoice_service import InvoiceService

    doc_type = DocumentType.SALES_INVOICE if kind == "sales" else DocumentType.PURCHASE_INVOICE
    party_kind = "customer" if kind == "sales" else "supplier"
    number = data["number"]
    if number and await db.invoices.find_one(
            {"company_id": company_id, "document_type": doc_type.value, "document_number": number},
            {"_id": 0, "id": 1}):
        raise ValueError(f"الفاتورة {number} موجودة بالفعل — لم تُستورد مرة ثانية")

    party, _ = await find_or_create_party(db, company_id, data["party_name"], party_kind)
    rate = data["tax_rate"]
    line = InvoiceLine(line_number=1, description=data["description"] or
                       ("مبيعات — فاتورة مستوردة" if kind == "sales" else "مشتريات — فاتورة مستوردة"),
                       quantity=1.0, unit_price=round(data["subtotal"], 2),
                       tax_type=TaxType.VAT if rate > 0 else TaxType.EXEMPT, tax_rate=rate)
    invoice = Invoice(
        company_id=company_id, document_type=doc_type, document_number=number or "",
        document_date=data["date"], due_date=data["due_date"] or None,
        party_id=party["id"], party_name=party["name"], party_tax_id=party.get("tax_id"),
        party_address=party.get("address"), lines=[line], created_by=user_id or "import",
        notes="فاتورة مستوردة من ملف")
    svc = InvoiceService(db)
    created = await svc.create_invoice(invoice)
    await db.invoices.update_one({"id": created["id"]}, {"$set": {"source": "import"}})
    try:
        approved = await svc.approve_invoice(created["id"], user_id or "import")
    except Exception:
        # an invoice that cannot be journalised must not stay behind as a
        # document with no entry — that is the very gap this import closes
        await db.invoices.delete_one({"id": created["id"]})
        raise

    paid = 0.0
    if data["paid"]:
        due = float(approved.get("amount_due") or 0)
        if due > 0:
            method = PaymentMethod.CASH if data["method"] == "cash" else PaymentMethod.BANK_TRANSFER
            await svc.record_payment(Payment(
                company_id=company_id, invoice_id=created["id"], payment_date=data["date"],
                amount=due, payment_method=method, reference="سداد مستورد",
                created_by=user_id or "import"), user_id or "import")
            paid = due
    return {"invoice_id": created["id"], "document_number": approved.get("document_number"),
            "grand_total": approved.get("grand_total"), "journal_entry_id": approved.get("journal_entry_id"),
            "paid": paid}
