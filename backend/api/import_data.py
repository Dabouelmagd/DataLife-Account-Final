from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, Form
from services.auth_service import verify_token
from typing import Optional, List
from database import get_database
from datetime import datetime, timezone
import pandas as pd
import io
import uuid

router = APIRouter(prefix="/api/import", tags=["import"])
db = get_database()

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

# Allowed roles for import operations
IMPORT_ROLES = [
    "General Manager", "CEO", "Board Chairman", "HR Manager", "Financial Manager",
    "مدير عام", "المدير التنفيذي", "رئيس مجلس الإدارة", "مدير الموارد البشرية", "المدير المالي"
]

def parse_file(file_content: bytes, filename: str) -> pd.DataFrame:
    """Parse Excel or CSV file into DataFrame"""
    name = (filename or "").lower()
    if name.endswith('.xlsx') or name.endswith('.xls'):
        return pd.read_excel(io.BytesIO(file_content))
    elif name.endswith('.csv'):
        # Try different encodings
        for encoding in ['utf-8', 'utf-8-sig', 'cp1256', 'iso-8859-1']:
            try:
                return pd.read_csv(io.BytesIO(file_content), encoding=encoding)
            except UnicodeDecodeError:
                continue
        raise HTTPException(status_code=400, detail="Unable to decode file. Please use UTF-8 encoding.")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use .xlsx, .xls, or .csv")


# Get import history
@router.get("/history")
async def get_import_history(current_user: dict = Depends(get_current_user)):
    """Get all import history for the company"""
    company_id = current_user.get("company_id")
    imports = await db.import_history.find(
        {"company_id": company_id},
        {"_id": 0, "file_hash": 0}
    ).sort("created_at", -1).to_list(length=100)
    return imports


# ── shared plumbing ─────────────────────────────────────────────────────────

async def _read_upload(file: UploadFile, current_user: dict, import_type: str):
    """Permission, size limit, parse, and refuse a file already imported.

    Importing the same sheet twice used to double every customer, item and
    entry with no warning. The file's fingerprint is kept with its history
    row, so the second upload is stopped and the date of the first is named.
    """
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    from services.upload_limits import read_limited as _rl, IMPORT_LIMIT as _LIM
    from services.import_documents import file_hash
    content = await _rl(file, _LIM)
    digest = file_hash(content)
    earlier = await db.import_history.find_one(
        {"company_id": current_user.get("company_id"), "type": import_type,
         "file_hash": digest, "success_count": {"$gt": 0}}, {"_id": 0, "created_at": 1})
    if earlier:
        raise HTTPException(status_code=409, detail=(
            f"هذا الملف نفسه استُورد من قبل بتاريخ {str(earlier.get('created_at', ''))[:10]} — "
            "لم يُستورد مرة ثانية حتى لا تتكرر البيانات والقيود."))
    try:
        df = parse_file(content, file.filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"تعذّر قراءة الملف: {str(e)}")
    df.columns = [str(c).strip() for c in df.columns]
    from services.import_documents import blank_row
    df = df[[not blank_row(r) for _, r in df.iterrows()]] if len(df) else df
    return df, digest


def _require(mapped: dict, needed: dict, df):
    """Refuse a sheet whose key columns are missing, naming what was seen."""
    missing = [ar for key, ar in needed.items() if key not in mapped]
    if missing:
        seen = "، ".join(str(c) for c in list(df.columns)[:12]) or "(لا توجد أعمدة)"
        raise HTTPException(status_code=400, detail=(
            f"تعذّر فهم الملف: لم يُعثر على عمود {' و'.join(missing)}. "
            f"الأعمدة الموجودة: {seen}. حمّل النموذج من نفس الشاشة واستخدم أسماء أعمدته."))


async def _finish(current_user: dict, import_type: str, type_ar: str, filename: str, digest: str,
                  total: int, success: int, errors: list, notes: list, extra: Optional[dict] = None):
    await db.import_history.insert_one({
        "id": str(uuid.uuid4()), "company_id": current_user.get("company_id"),
        "type": import_type, "type_ar": type_ar, "filename": filename, "file_hash": digest,
        "total_rows": total, "success_count": success, "error_count": len(errors),
        "errors": errors[:20], "notes": notes[:10],
        "imported_by": current_user.get("full_name") or current_user.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat()})
    message = f"تم استيراد {success} من {total}" + (" — " + "، ".join(notes) if notes else "")
    return {"message": message, "total": total, "success": success, "errors": len(errors),
            "error_details": errors[:20], "notes": notes, **(extra or {})}


# ── employees ───────────────────────────────────────────────────────────────

@router.post("/employees")
async def import_employees(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import employees from Excel/CSV file"""
    from services.import_documents import cell, num, date_cell, map_columns
    df, digest = await _read_upload(file, current_user, "employees")
    company_id = current_user.get("company_id")
    cols = map_columns(df, {
        'name': ['name', 'الاسم', 'اسم الموظف', 'employee_name', 'full_name', 'الاسم الكامل'],
        'code': ['employee_code', 'كود الموظف', 'الكود', 'رقم الموظف', 'code'],
        'national_id': ['national_id', 'الرقم القومي', 'رقم البطاقة'],
        'position': ['position', 'الوظيفة', 'المسمى الوظيفي', 'job_title', 'title'],
        'department': ['department', 'القسم', 'الإدارة'],
        'email': ['email', 'البريد الإلكتروني', 'الإيميل'],
        'phone': ['phone', 'الهاتف', 'رقم الهاتف', 'mobile', 'الجوال'],
        'hire_date': ['hire_date', 'تاريخ التعيين', 'تاريخ الالتحاق', 'start_date'],
        'basic_salary': ['basic_salary', 'الراتب الأساسي', 'الراتب', 'salary'],
    })
    _require(cols, {"name": "الاسم", "basic_salary": "الراتب الأساسي"}, df)

    count = await db.employees.count_documents({"company_id": company_id})
    success, errors, skipped = 0, [], 0
    for idx, row in df.iterrows():
        try:
            name = cell(row, cols.get('name'))
            if not name:
                raise ValueError("الاسم فارغ")
            national_id = cell(row, cols.get('national_id'))
            dup = {"company_id": company_id, "name": name}
            if national_id:
                dup = {"company_id": company_id, "national_id": national_id}
            if await db.employees.find_one(dup, {"_id": 0, "id": 1}):
                skipped += 1
                raise ValueError(f"الموظف {name} موجود بالفعل — لم يُضف مرة ثانية")
            salary = num(row, cols.get('basic_salary'))
            if salary < 0:
                raise ValueError("الراتب سالب")
            count += 1
            await db.employees.insert_one({
                "id": str(uuid.uuid4()), "company_id": company_id, "name": name,
                "employee_code": cell(row, cols.get('code')) or f"EMP-{count:04d}",
                "national_id": national_id or None,
                "position": cell(row, cols.get('position')) or "غير محدد",
                "job_title": cell(row, cols.get('position')) or None,
                "department": cell(row, cols.get('department')) or None,
                "email": cell(row, cols.get('email')) or None,
                "phone": cell(row, cols.get('phone')) or None,
                "hire_date": date_cell(row, cols.get('hire_date')) or datetime.now().strftime('%Y-%m-%d'),
                "basic_salary": round(salary, 2), "is_active": True, "status": "active",
                "source": "import", "created_at": datetime.now(timezone.utc).isoformat()})
            success += 1
        except Exception as e:
            errors.append(f"صف {idx + 2}: {e}")
    notes = ["الموظفون يظهرون في شؤون العاملين ويدخلون مسير الرواتب القادم"]
    if skipped:
        notes.append(f"{skipped} موجودون بالفعل")
    return await _finish(current_user, "employees", "الموظفين", file.filename, digest,
                         len(df), success, errors, notes)


# ── revenues / expenses ─────────────────────────────────────────────────────

@router.post("/financial")
async def import_financial(file: UploadFile = File(...), data_type: str = Form(...),
                           current_user: dict = Depends(get_current_user)):
    """Import revenues or expenses; every row is posted to the ledger."""
    from services.import_documents import cell, num, date_cell, map_columns
    from services.import_posting import post_row
    if data_type not in ("revenue", "expense"):
        raise HTTPException(status_code=400, detail="data_type must be revenue or expense")
    df, digest = await _read_upload(file, current_user, data_type)
    company_id = current_user.get("company_id")
    cols = map_columns(df, {
        'date': ['date', 'التاريخ', 'تاريخ'],
        'description': ['description', 'الوصف', 'البيان', 'notes'],
        'amount': ['amount', 'المبلغ', 'القيمة', 'value'],
        'category': ['category', 'الفئة', 'التصنيف', 'type', 'النوع'],
        'account': ['account', 'الحساب', 'رقم الحساب', 'كود الحساب'],
        'payment_method': ['payment_method', 'طريقة السداد', 'طريقة الدفع', 'السداد'],
    })
    _require(cols, {"amount": "المبلغ", "description": "الوصف"}, df)

    user_id = current_user.get("user_id")
    collection = "revenues" if data_type == "revenue" else "expenses"
    success, errors, defaulted, total_amount = 0, [], 0, 0.0
    for idx, row in df.iterrows():
        try:
            amount = num(row, cols.get('amount'))
            if amount <= 0:
                raise ValueError("المبلغ فارغ أو صفر أو سالب")
            record = {
                "id": str(uuid.uuid4()), "company_id": company_id,
                "date": date_cell(row, cols.get('date')) or datetime.now().strftime('%Y-%m-%d'),
                "description": cell(row, cols.get('description')),
                "amount": round(amount, 2),
                "category": cell(row, cols.get('category')) or None,
                "account": cell(row, cols.get('account')) or None,
                "payment_method": cell(row, cols.get('payment_method')) or None,
                "source": "import", "created_at": datetime.now(timezone.utc).isoformat()}
            posted = await post_row(db, company_id, user_id, record, data_type)
            record.update({"journal_entry_id": posted["journal_entry_id"],
                           "entry_number": posted["entry_number"],
                           "account_code": posted["account_code"],
                           "used_default_account": posted["used_default_account"]})
            defaulted += 1 if posted["used_default_account"] else 0
            await db[collection].insert_one(record)
            success += 1
            total_amount += amount
        except Exception as e:
            errors.append(f"صف {idx + 2}: {e}")
    notes = [f"رُحّل {success} قيداً إلى دفتر الأستاذ بإجمالي {total_amount:,.2f} ج.م"]
    if defaulted:
        notes.append(f"{defaulted} منها على الحساب الافتراضي لعدم تحديد حساب في الملف")
    return await _finish(current_user, data_type, "الإيرادات" if data_type == "revenue" else "المصروفات",
                         file.filename, digest, len(df), success, errors, notes,
                         {"posted_to_ledger": success, "used_default_account": defaulted,
                          "total_amount": round(total_amount, 2)})


# ── customers / suppliers ───────────────────────────────────────────────────

async def _import_parties(file: UploadFile, current_user: dict, kind: str):
    from services.import_documents import cell, num, date_cell, map_columns, \
        find_or_create_party, post_party_opening
    import_type = "customers" if kind == "customer" else "suppliers"
    df, digest = await _read_upload(file, current_user, import_type)
    company_id = current_user.get("company_id")
    cols = map_columns(df, {
        'name': ['name', 'الاسم', 'اسم العميل' if kind == "customer" else 'اسم المورد',
                 'customer_name' if kind == "customer" else 'supplier_name'],
        'email': ['email', 'البريد الإلكتروني', 'الإيميل'],
        'phone': ['phone', 'الهاتف', 'رقم الهاتف', 'mobile'],
        'address': ['address', 'العنوان'],
        'tax_id': ['tax_id', 'tax_number', 'الرقم الضريبي', 'رقم التسجيل الضريبي'],
        'balance': ['balance', 'الرصيد', 'الرصيد الافتتاحي', 'المبلغ المستحق', 'opening_balance'],
        'balance_date': ['balance_date', 'تاريخ الرصيد'],
    })
    _require(cols, {"name": "الاسم"}, df)

    user_id = current_user.get("user_id")
    today = datetime.now().strftime('%Y-%m-%d')
    success, errors, existed, openings, opening_total = 0, [], 0, 0, 0.0
    for idx, row in df.iterrows():
        try:
            name = cell(row, cols.get('name'))
            if not name:
                raise ValueError("الاسم فارغ")
            balance = num(row, cols.get('balance'))
            tax_id = cell(row, cols.get('tax_id'))
            party, created = await find_or_create_party(db, company_id, name, kind, {
                "email": cell(row, cols.get('email')) or None,
                "phone": cell(row, cols.get('phone')) or None,
                "address": cell(row, cols.get('address')) or None,
                "tax_id": tax_id or None})
            if not created:
                existed += 1
                if balance:
                    raise ValueError(f"{name} موجود بالفعل — لم يُسجَّل رصيده الافتتاحي مرة ثانية")
            if balance:
                await post_party_opening(db, company_id, user_id, party, kind, balance,
                                         date_cell(row, cols.get('balance_date')) or today)
                openings += 1
                opening_total += balance
            success += 1
        except Exception as e:
            errors.append(f"صف {idx + 2}: {e}")
    acc = "العملاء 131" if kind == "customer" else "الموردين 251"
    notes = []
    if openings:
        notes.append(f"{openings} رصيد افتتاحي بإجمالي {opening_total:,.2f} ج.م رُحّل إلى حساب {acc} مقابل الأرباح المرحلة 213")
    if existed:
        notes.append(f"{existed} كانوا مسجلين من قبل")
    return await _finish(current_user, import_type, "العملاء" if kind == "customer" else "الموردين",
                         file.filename, digest, len(df), success, errors, notes,
                         {"opening_balances": openings, "opening_total": round(opening_total, 2)})


@router.post("/customers")
async def import_customers(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import customers; an opening balance is posted Dr 131 / Cr 213."""
    return await _import_parties(file, current_user, "customer")


@router.post("/suppliers")
async def import_suppliers(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import suppliers; an opening balance is posted Dr 213 / Cr 251."""
    return await _import_parties(file, current_user, "supplier")


# ── inventory ───────────────────────────────────────────────────────────────

@router.post("/inventory")
async def import_inventory(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Items into the inventory screens, opening stock posted Dr stock / Cr 213."""
    from services.import_documents import cell, num, date_cell, map_columns, import_item, stock_account
    df, digest = await _read_upload(file, current_user, "inventory")
    company_id = current_user.get("company_id")
    cols = map_columns(df, {
        'name': ['name', 'الاسم', 'اسم الصنف', 'item_name', 'product'],
        'code': ['code', 'الكود', 'كود الصنف', 'sku', 'رقم الصنف'],
        'category': ['category', 'الفئة', 'التصنيف'],
        'quantity': ['quantity', 'الكمية', 'qty'],
        'unit': ['unit', 'الوحدة'],
        'cost': ['cost_price', 'سعر التكلفة', 'التكلفة', 'cost'],
        'sale_price': ['sale_price', 'سعر البيع'],
        'unit_price': ['unit_price', 'سعر الوحدة', 'price', 'السعر'],
        'min_stock': ['min_stock', 'الحد الأدنى', 'minimum', 'min'],
        'date': ['date', 'تاريخ الرصيد', 'التاريخ'],
    })
    _require(cols, {"name": "الاسم"}, df)
    if "cost" not in cols and "unit_price" not in cols:
        raise HTTPException(status_code=400, detail="لم يُعثر على عمود سعر التكلفة (أو سعر الوحدة) — لا يمكن تقييم المخزون بدونه")

    stock_code = await stock_account(db, company_id)
    user_id = current_user.get("user_id")
    today = datetime.now().strftime('%Y-%m-%d')
    seq = await db.products.count_documents({"company_id": company_id})
    success, errors, total_value, cost_from_unit_price = 0, [], 0.0, 0
    for idx, row in df.iterrows():
        try:
            name = cell(row, cols.get('name'))
            if not name:
                raise ValueError("الاسم فارغ")
            qty = num(row, cols.get('quantity'))
            if qty < 0:
                raise ValueError("الكمية سالبة")
            if "cost" in cols and cell(row, cols['cost']):
                cost = num(row, cols['cost'])
            else:
                cost = num(row, cols.get('unit_price'))
                cost_from_unit_price += 1
            sale = num(row, cols.get('sale_price')) if "sale_price" in cols else num(row, cols.get('unit_price'))
            seq += 1
            result = await import_item(db, company_id, user_id, {
                "name": name, "code": cell(row, cols.get('code')) or f"ITM-{seq:05d}",
                "category": cell(row, cols.get('category')), "unit": cell(row, cols.get('unit')),
                "quantity": qty, "cost": cost, "sale_price": sale or cost,
                "min_stock": num(row, cols.get('min_stock'))},
                date_cell(row, cols.get('date')) or today, stock_code)
            total_value += result["value"]
            success += 1
        except Exception as e:
            errors.append(f"صف {idx + 2}: {e}")
    notes = [f"قيمة المخزون الافتتاحي {total_value:,.2f} ج.م رُحّلت إلى حساب المخزون {stock_code} مقابل الأرباح المرحلة 213"]
    if cost_from_unit_price:
        notes.append(f"{cost_from_unit_price} صنف قُيّم بعمود سعر الوحدة لعدم وجود سعر التكلفة — راجعه")
    return await _finish(current_user, "inventory", "المخزون", file.filename, digest,
                         len(df), success, errors, notes, {"stock_value": round(total_value, 2)})


# ── sales invoices / purchase invoices ──────────────────────────────────────

async def _import_invoices(file: UploadFile, current_user: dict, kind: str):
    from services.import_documents import cell, num, date_cell, map_columns, import_invoice, PAID_WORDS
    import_type = "invoices" if kind == "sales" else "purchases"
    df, digest = await _read_upload(file, current_user, import_type)
    company_id = current_user.get("company_id")
    party_names = (['customer_name', 'اسم العميل', 'customer', 'العميل'] if kind == "sales"
                   else ['supplier_name', 'اسم المورد', 'supplier', 'المورد'])
    cols = map_columns(df, {
        'number': (['invoice_number', 'رقم الفاتورة', 'invoice_no', 'number'] if kind == "sales"
                   else ['purchase_number', 'رقم الشراء', 'رقم الفاتورة', 'po_number', 'invoice_number', 'number']),
        'party': party_names,
        'date': ['date', 'التاريخ', 'invoice_date', 'purchase_date', 'تاريخ الفاتورة'],
        'due_date': ['due_date', 'تاريخ الاستحقاق'],
        'subtotal': ['subtotal', 'المبلغ قبل الضريبة', 'قبل الضريبة', 'الصافي'],
        'tax_rate': ['tax_rate', 'نسبة الضريبة', 'الضريبة %'],
        'amount': ['amount', 'المبلغ', 'total', 'الإجمالي', 'الإجمالي شامل الضريبة'],
        'status': ['status', 'الحالة'],
        'method': ['payment_method', 'طريقة السداد', 'طريقة الدفع'],
        'description': ['description', 'البيان', 'الوصف'],
    })
    _require(cols, {"party": "اسم العميل" if kind == "sales" else "اسم المورد", "date": "التاريخ"}, df)
    if "subtotal" not in cols and "amount" not in cols:
        _require(cols, {"amount": "المبلغ (الإجمالي) أو المبلغ قبل الضريبة"}, df)

    user_id = current_user.get("user_id")
    success, errors, total, paid_total, from_gross = 0, [], 0.0, 0.0, 0
    for idx, row in df.iterrows():
        try:
            party = cell(row, cols.get('party'))
            if not party:
                raise ValueError("اسم العميل/المورد فارغ")
            date = date_cell(row, cols.get('date'))
            if not date:
                raise ValueError("التاريخ فارغ")
            rate = num(row, cols.get('tax_rate'), 14.0) if "tax_rate" in cols else 14.0
            if rate and rate < 1:
                rate *= 100                       # 0.14 written as a fraction
            if "subtotal" in cols and cell(row, cols['subtotal']):
                subtotal = num(row, cols['subtotal'])
            else:
                # the sheet gives the total including VAT; take the tax out of it
                subtotal = num(row, cols.get('amount')) / (1 + rate / 100)
                from_gross += 1
            if subtotal <= 0:
                raise ValueError("المبلغ فارغ أو صفر")
            status = cell(row, cols.get('status')).lower()
            method_text = cell(row, cols.get('method')).lower()
            result = await import_invoice(db, company_id, user_id, kind, {
                "number": cell(row, cols.get('number')), "party_name": party, "date": date,
                "due_date": date_cell(row, cols.get('due_date')), "subtotal": subtotal,
                "tax_rate": rate, "description": cell(row, cols.get('description')),
                "paid": status in PAID_WORDS,
                "method": "cash" if method_text in ("cash", "نقدي", "نقدا", "نقداً", "خزينة") else "bank"})
            total += float(result["grand_total"] or 0)
            paid_total += result["paid"]
            success += 1
        except Exception as e:
            errors.append(f"صف {idx + 2}: {e}")
    if kind == "sales":
        notes = [f"{success} فاتورة بيع بإجمالي {total:,.2f} ج.م: مدين العملاء 131 / دائن المبيعات وضريبة القيمة المضافة 260"]
    else:
        notes = [f"{success} فاتورة شراء بإجمالي {total:,.2f} ج.م: مدين المشتريات/المخزون وضريبة المدخلات / دائن الموردين 251"
                 " (مع خصم وتحصيل 1% على ما يزيد عن 300 ج.م كما في شاشة الفواتير)"]
    if paid_total:
        notes.append(f"سُجّل سداد {paid_total:,.2f} ج.م للفواتير المكتوب حالتها مدفوعة")
    if from_gross:
        notes.append(f"{from_gross} فاتورة حُسبت ضريبتها من الإجمالي ({'نسبة الملف' if 'tax_rate' in cols else '14%'})")
    return await _finish(current_user, import_type, "الفواتير" if kind == "sales" else "المشتريات",
                         file.filename, digest, len(df), success, errors, notes,
                         {"grand_total": round(total, 2), "paid_total": round(paid_total, 2)})


@router.post("/invoices")
async def import_invoices(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Sales invoices through the invoice service: customer, VAT, entry, payment."""
    return await _import_invoices(file, current_user, "sales")


@router.post("/purchases")
async def import_purchases(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Purchase invoices through the invoice service: supplier, VAT, entry, payment."""
    return await _import_invoices(file, current_user, "purchase")


# ── templates ───────────────────────────────────────────────────────────────

_FINANCIAL_TEMPLATE = {
    "columns_en": ["date", "description", "amount", "account", "payment_method"],
    "columns_ar": ["التاريخ", "الوصف", "المبلغ", "الحساب", "طريقة السداد"],
    "sample": [{"date": "2026-01-15", "description": "إيجار المكتب", "amount": 25000,
                "account": "3322", "payment_method": "بنك"}],
}

TEMPLATES = {
    "employees": {
        "columns_en": ["name", "employee_code", "national_id", "position", "department", "email", "phone", "hire_date", "basic_salary"],
        "columns_ar": ["الاسم", "كود الموظف", "الرقم القومي", "الوظيفة", "القسم", "البريد الإلكتروني", "الهاتف", "تاريخ التعيين", "الراتب الأساسي"],
        "sample": [{"name": "أحمد محمد", "employee_code": "EMP-0001", "national_id": "29001011234567",
                    "position": "محاسب", "department": "المالية", "email": "ahmed@example.com",
                    "phone": "01234567890", "hire_date": "2024-01-15", "basic_salary": 15000}]
    },
    "customers": {
        "columns_en": ["name", "tax_id", "email", "phone", "address", "balance", "balance_date"],
        "columns_ar": ["الاسم", "الرقم الضريبي", "البريد الإلكتروني", "الهاتف", "العنوان", "الرصيد الافتتاحي", "تاريخ الرصيد"],
        "sample": [{"name": "شركة ABC", "tax_id": "123456789", "email": "info@abc.com", "phone": "01234567890",
                    "address": "القاهرة", "balance": 5000, "balance_date": "2026-01-01"}]
    },
    "suppliers": {
        "columns_en": ["name", "tax_id", "email", "phone", "address", "balance", "balance_date"],
        "columns_ar": ["الاسم", "الرقم الضريبي", "البريد الإلكتروني", "الهاتف", "العنوان", "الرصيد الافتتاحي", "تاريخ الرصيد"],
        "sample": [{"name": "مورد XYZ", "tax_id": "987654321", "email": "info@xyz.com", "phone": "01234567890",
                    "address": "الجيزة", "balance": 10000, "balance_date": "2026-01-01"}]
    },
    "inventory": {
        "columns_en": ["code", "name", "category", "unit", "quantity", "cost_price", "sale_price", "min_stock", "date"],
        "columns_ar": ["كود الصنف", "الاسم", "الفئة", "الوحدة", "الكمية", "سعر التكلفة", "سعر البيع", "الحد الأدنى", "تاريخ الرصيد"],
        "sample": [{"code": "P-001", "name": "منتج 1", "category": "مواد غذائية", "unit": "قطعة", "quantity": 100,
                    "cost_price": 40, "sale_price": 50, "min_stock": 20, "date": "2026-01-01"}]
    },
    "invoices": {
        "columns_en": ["invoice_number", "customer_name", "date", "due_date", "subtotal", "tax_rate", "amount", "status", "payment_method"],
        "columns_ar": ["رقم الفاتورة", "اسم العميل", "التاريخ", "تاريخ الاستحقاق", "المبلغ قبل الضريبة", "نسبة الضريبة", "الإجمالي", "الحالة", "طريقة السداد"],
        "sample": [{"invoice_number": "INV-001", "customer_name": "عميل 1", "date": "2026-01-15", "due_date": "2026-02-15",
                    "subtotal": 5000, "tax_rate": 14, "amount": 5700, "status": "غير مدفوعة", "payment_method": ""}]
    },
    "purchases": {
        "columns_en": ["purchase_number", "supplier_name", "date", "due_date", "subtotal", "tax_rate", "amount", "status", "payment_method"],
        "columns_ar": ["رقم الفاتورة", "اسم المورد", "التاريخ", "تاريخ الاستحقاق", "المبلغ قبل الضريبة", "نسبة الضريبة", "الإجمالي", "الحالة", "طريقة السداد"],
        "sample": [{"purchase_number": "P-001", "supplier_name": "مورد 1", "date": "2026-01-15", "due_date": "2026-02-15",
                    "subtotal": 10000, "tax_rate": 14, "amount": 11400, "status": "مدفوعة", "payment_method": "بنك"}]
    },
    "financial": _FINANCIAL_TEMPLATE,
    "expense": _FINANCIAL_TEMPLATE,
    "revenue": {**_FINANCIAL_TEMPLATE, "sample": [{"date": "2026-01-15", "description": "إيراد خدمات", "amount": 25000,
                                                   "account": "412", "payment_method": "بنك"}]},
}


@router.get("/template/{data_type}")
async def get_template(data_type: str):
    """Get template information for import"""
    if data_type not in TEMPLATES:
        raise HTTPException(status_code=404, detail="Template not found")
    return TEMPLATES[data_type]
