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


# ── whole-file checking ─────────────────────────────────────────────────────

def _reject(check, total: int):
    """Nothing is written when any row is wrong — every problem is listed."""
    if check.errors:
        raise HTTPException(status_code=422, detail={
            "message": (f"لم يُستورد الملف — عدد المشاكل: {len(check.errors)} (الملف فيه {total} صف). "
                        "صحّح الملف وارفعه مرة أخرى؛ لن يُضاف أي صف حتى يكون الملف كله سليماً."),
            "errors": check.errors[:200],
            "error_count": len(check.errors),
        })


def _partial_failure(done: int, total: int, n, e):
    """A row that passed every check and still failed while writing (a server
    problem, not the file). Say exactly how far it got so nothing is guessed."""
    return HTTPException(status_code=500, detail={
        "message": (f"توقف الاستيراد عند الصف {n} بسبب خطأ في الخادم بعد إضافة {done} من {total}. "
                    "لا ترفع الملف مرة أخرى قبل مراجعة ما أُضيف — تواصل مع الدعم."),
        "errors": [f"صف {n}: {e}"]})


# ── employees ───────────────────────────────────────────────────────────────

@router.post("/employees")
async def import_employees(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Import employees from Excel/CSV file"""
    from services.import_documents import Check, map_columns
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
    _require(cols, {"name": "الاسم", "basic_salary": "الراتب الأساسي", "position": "الوظيفة",
                    "hire_date": "تاريخ التعيين"}, df)

    ck, rows, seen_names, seen_ids, seen_codes = Check(), [], {}, {}, {}
    for idx, row in df.iterrows():
        n = idx + 2
        r = {"n": n,
             "name": ck.text(row, n, cols.get('name'), "الاسم", required=True),
             "position": ck.text(row, n, cols.get('position'), "الوظيفة", required=True),
             "salary": ck.number(row, n, cols.get('basic_salary'), "الراتب الأساسي", required=True, positive=True),
             "hire_date": ck.date(row, n, cols.get('hire_date'), "تاريخ التعيين", required=True),
             "national_id": ck.digits(row, n, cols.get('national_id'), "الرقم القومي", 14),
             "email": ck.email(row, n, cols.get('email')),
             "code": ck.text(row, n, cols.get('code'), "كود الموظف", max_len=30),
             "department": ck.text(row, n, cols.get('department'), "القسم"),
             "phone": ck.text(row, n, cols.get('phone'), "الهاتف", max_len=30)}
        ck.once(seen_ids, r["national_id"], n, "الرقم القومي")
        ck.once(seen_codes, r["code"], n, "كود الموظف")
        if not r["national_id"]:
            ck.once(seen_names, r["name"], n, "الاسم")
        if r["national_id"] and await db.employees.find_one(
                {"company_id": company_id, "national_id": r["national_id"]}, {"_id": 0, "id": 1}):
            ck.err(n, "الرقم القومي", f"موظف بهذا الرقم مسجّل بالفعل ({r['name']})")
        elif r["name"] and not r["national_id"] and await db.employees.find_one(
                {"company_id": company_id, "name": r["name"]}, {"_id": 0, "id": 1}):
            ck.err(n, "الاسم", f"«{r['name']}» مسجّل بالفعل — أضف الرقم القومي إن كان شخصاً آخر")
        if r["code"] and await db.employees.find_one(
                {"company_id": company_id, "employee_code": r["code"]}, {"_id": 0, "id": 1}):
            ck.err(n, "كود الموظف", f"«{r['code']}» مستخدم لموظف آخر")
        rows.append(r)
    _reject(ck, len(df))

    count = await db.employees.count_documents({"company_id": company_id})
    done = 0
    for r in rows:
        try:
            count += 1
            await db.employees.insert_one({
                "id": str(uuid.uuid4()), "company_id": company_id, "name": r["name"],
                "employee_code": r["code"] or f"EMP-{count:04d}", "national_id": r["national_id"] or None,
                "position": r["position"], "job_title": r["position"],
                "department": r["department"] or None, "email": r["email"] or None,
                "phone": r["phone"] or None, "hire_date": r["hire_date"],
                "basic_salary": round(r["salary"], 2), "is_active": True, "status": "active",
                "source": "import", "created_at": datetime.now(timezone.utc).isoformat()})
            done += 1
        except Exception as e:
            raise _partial_failure(done, len(rows), r["n"], e)
    return await _finish(current_user, "employees", "الموظفين", file.filename, digest, len(df), done, [],
                         ["الموظفون يظهرون في شؤون العاملين ويدخلون مسير الرواتب القادم"])


# ── revenues / expenses ─────────────────────────────────────────────────────

@router.post("/financial")
async def import_financial(file: UploadFile = File(...), data_type: str = Form(...),
                           current_user: dict = Depends(get_current_user)):
    """Import revenues or expenses; every row is posted to the ledger."""
    from services.import_documents import Check, map_columns
    from services.import_posting import post_row, resolve_account, PAYMENT_ACCOUNTS
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
    _require(cols, {"date": "التاريخ", "amount": "المبلغ", "description": "الوصف"}, df)

    accepted_methods = "، ".join(sorted(PAYMENT_ACCOUNTS))
    ck, rows = Check(), []
    for idx, row in df.iterrows():
        n = idx + 2
        r = {"n": n,
             "date": ck.date(row, n, cols.get('date'), "التاريخ", required=True),
             "description": ck.text(row, n, cols.get('description'), "الوصف", required=True),
             "amount": ck.number(row, n, cols.get('amount'), "المبلغ", required=True, positive=True),
             "account": ck.text(row, n, cols.get('account'), "الحساب", max_len=60),
             "category": ck.text(row, n, cols.get('category'), "الفئة", max_len=60),
             "payment_method": ck.text(row, n, cols.get('payment_method'), "طريقة السداد", max_len=30)}
        if r["account"]:
            _, fell_back = await resolve_account(db, company_id, r["account"], "")
            if fell_back:
                ck.err(n, "الحساب", f"«{r['account']}» غير موجود في شجرة الحسابات — اكتب كود حساب موجوداً أو اترك الخانة فارغة")
        if r["payment_method"] and r["payment_method"].lower() not in PAYMENT_ACCOUNTS:
            ck.err(n, "طريقة السداد", f"«{r['payment_method']}» غير معروفة — المقبول: {accepted_methods}")
        rows.append(r)
    _reject(ck, len(df))

    user_id = current_user.get("user_id")
    collection = "revenues" if data_type == "revenue" else "expenses"
    done, defaulted, total_amount = 0, 0, 0.0
    for r in rows:
        try:
            record = {"id": str(uuid.uuid4()), "company_id": company_id, "date": r["date"],
                      "description": r["description"], "amount": round(r["amount"], 2),
                      "category": r["category"] or None, "account": r["account"] or None,
                      "payment_method": r["payment_method"] or None, "source": "import",
                      "created_at": datetime.now(timezone.utc).isoformat()}
            posted = await post_row(db, company_id, user_id, record, data_type)
            record.update({"journal_entry_id": posted["journal_entry_id"], "entry_number": posted["entry_number"],
                           "account_code": posted["account_code"],
                           "used_default_account": posted["used_default_account"]})
            defaulted += 1 if posted["used_default_account"] else 0
            await db[collection].insert_one(record)
            done += 1
            total_amount += r["amount"]
        except Exception as e:
            raise _partial_failure(done, len(rows), r["n"], e)
    notes = [f"رُحّل {done} قيداً إلى دفتر الأستاذ بإجمالي {total_amount:,.2f} ج.م"]
    if defaulted:
        notes.append(f"{defaulted} منها على الحساب الافتراضي لأن خانة الحساب فارغة")
    return await _finish(current_user, data_type, "الإيرادات" if data_type == "revenue" else "المصروفات",
                         file.filename, digest, len(df), done, [], notes,
                         {"posted_to_ledger": done, "used_default_account": defaulted,
                          "total_amount": round(total_amount, 2)})


# ── customers / suppliers ───────────────────────────────────────────────────

async def _import_parties(file: UploadFile, current_user: dict, kind: str):
    from services.import_documents import Check, map_columns, find_or_create_party, post_party_opening
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

    ck, rows, seen = Check(), [], {}
    for idx, row in df.iterrows():
        n = idx + 2
        r = {"n": n,
             "name": " ".join(ck.text(row, n, cols.get('name'), "الاسم", required=True).split()),
             "email": ck.email(row, n, cols.get('email')),
             "phone": ck.text(row, n, cols.get('phone'), "الهاتف", max_len=30),
             "address": ck.text(row, n, cols.get('address'), "العنوان", max_len=300),
             "tax_id": ck.digits(row, n, cols.get('tax_id'), "الرقم الضريبي", 9),
             "balance": ck.number(row, n, cols.get('balance'), "الرصيد الافتتاحي"),
             "balance_date": ck.date(row, n, cols.get('balance_date'), "تاريخ الرصيد")}
        ck.once(seen, r["name"], n, "الاسم")
        if r["balance"] and not r["balance_date"] and "balance_date" in cols:
            ck.err(n, "تاريخ الرصيد", "فارغ والرصيد غير صفر")
        if r["name"] and r["balance"] and await db.parties.find_one(
                {"company_id": company_id, "name": r["name"]}, {"_id": 0, "id": 1}):
            ck.err(n, "الرصيد الافتتاحي", f"«{r['name']}» مسجّل بالفعل — رصيده الافتتاحي لا يُضاف مرة ثانية؛ احذف الرصيد من الصف أو أدخله يدوياً")
        rows.append(r)
    _reject(ck, len(df))

    user_id = current_user.get("user_id")
    today = datetime.now().strftime('%Y-%m-%d')
    done, existed, openings, opening_total = 0, 0, 0, 0.0
    for r in rows:
        try:
            party, created = await find_or_create_party(db, company_id, r["name"], kind, {
                "email": r["email"] or None, "phone": r["phone"] or None,
                "address": r["address"] or None, "tax_id": r["tax_id"] or None})
            existed += 0 if created else 1
            if r["balance"]:
                await post_party_opening(db, company_id, user_id, party, kind, r["balance"],
                                         r["balance_date"] or today)
                openings += 1
                opening_total += r["balance"]
            done += 1
        except Exception as e:
            raise _partial_failure(done, len(rows), r["n"], e)
    acc = "العملاء 131" if kind == "customer" else "الموردين 251"
    notes = []
    if openings:
        notes.append(f"{openings} رصيد افتتاحي بإجمالي {opening_total:,.2f} ج.م رُحّل إلى حساب {acc} مقابل الأرباح المرحلة 213")
    if existed:
        notes.append(f"{existed} كانوا مسجلين من قبل وحُدّثت بياناتهم دون تكرار")
    return await _finish(current_user, import_type, "العملاء" if kind == "customer" else "الموردين",
                         file.filename, digest, len(df), done, [], notes,
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
    from services.import_documents import Check, map_columns, import_item, stock_account
    df, digest = await _read_upload(file, current_user, "inventory")
    company_id = current_user.get("company_id")
    cols = map_columns(df, {
        'name': ['name', 'الاسم', 'اسم الصنف', 'item_name', 'product'],
        'code': ['code', 'الكود', 'كود الصنف', 'sku', 'رقم الصنف'],
        'category': ['category', 'الفئة', 'التصنيف'],
        'quantity': ['quantity', 'الكمية', 'qty'],
        'unit': ['unit', 'الوحدة'],
        'cost': ['cost_price', 'سعر التكلفة', 'التكلفة', 'cost'],
        'sale_price': ['sale_price', 'سعر البيع', 'unit_price', 'سعر الوحدة', 'price', 'السعر'],
        'min_stock': ['min_stock', 'الحد الأدنى', 'minimum', 'min'],
        'date': ['date', 'تاريخ الرصيد', 'التاريخ'],
    })
    # the cost is what the stock is worth in the books — it cannot be guessed
    # from a selling price, so the column is required
    _require(cols, {"name": "الاسم", "quantity": "الكمية", "cost": "سعر التكلفة",
                    "unit": "الوحدة"}, df)
    stock_code = await stock_account(db, company_id)

    ck, rows, seen_names, seen_codes = Check(), [], {}, {}
    for idx, row in df.iterrows():
        n = idx + 2
        r = {"n": n,
             "name": ck.text(row, n, cols.get('name'), "الاسم", required=True),
             "code": ck.text(row, n, cols.get('code'), "كود الصنف", max_len=40),
             "unit": ck.text(row, n, cols.get('unit'), "الوحدة", required=True, max_len=30),
             "category": ck.text(row, n, cols.get('category'), "الفئة", max_len=60),
             "quantity": ck.number(row, n, cols.get('quantity'), "الكمية", required=True),
             "cost": ck.number(row, n, cols.get('cost'), "سعر التكلفة", required=True),
             "sale_price": ck.number(row, n, cols.get('sale_price'), "سعر البيع"),
             "min_stock": ck.number(row, n, cols.get('min_stock'), "الحد الأدنى"),
             "date": ck.date(row, n, cols.get('date'), "تاريخ الرصيد")}
        if r["quantity"] and r["cost"] == 0:
            ck.err(n, "سعر التكلفة", "صفر وفي كمية — المخزون لا يُقيَّم بصفر")
        ck.once(seen_names, r["name"], n, "الاسم")
        ck.once(seen_codes, r["code"], n, "كود الصنف")
        or_ = [{"name": r["name"]}] + ([{"code": r["code"]}] if r["code"] else [])
        if r["name"] and await db.products.find_one({"company_id": company_id, "$or": or_}, {"_id": 0, "id": 1}):
            ck.err(n, "الاسم/الكود", f"الصنف «{r['name']}» أو كوده مسجّل بالفعل")
        rows.append(r)
    _reject(ck, len(df))

    user_id = current_user.get("user_id")
    today = datetime.now().strftime('%Y-%m-%d')
    seq = await db.products.count_documents({"company_id": company_id})
    done, total_value = 0, 0.0
    for r in rows:
        try:
            seq += 1
            result = await import_item(db, company_id, user_id, {
                "name": r["name"], "code": r["code"] or f"ITM-{seq:05d}", "category": r["category"],
                "unit": r["unit"], "quantity": r["quantity"], "cost": r["cost"],
                "sale_price": r["sale_price"] or r["cost"], "min_stock": r["min_stock"] or 0},
                r["date"] or today, stock_code)
            total_value += result["value"]
            done += 1
        except Exception as e:
            raise _partial_failure(done, len(rows), r["n"], e)
    notes = [f"قيمة المخزون الافتتاحي {total_value:,.2f} ج.م رُحّلت إلى حساب المخزون {stock_code} مقابل الأرباح المرحلة 213"]
    return await _finish(current_user, "inventory", "المخزون", file.filename, digest,
                         len(df), done, [], notes, {"stock_value": round(total_value, 2)})


# ── sales invoices / purchase invoices ──────────────────────────────────────

VALID_TAX_RATES = {0.0, 5.0, 10.0, 14.0}


async def _import_invoices(file: UploadFile, current_user: dict, kind: str):
    from services.import_documents import Check, cell, map_columns, import_invoice, PAID_WORDS
    import_type = "invoices" if kind == "sales" else "purchases"
    df, digest = await _read_upload(file, current_user, import_type)
    company_id = current_user.get("company_id")
    party_label = "اسم العميل" if kind == "sales" else "اسم المورد"
    cols = map_columns(df, {
        'number': (['invoice_number', 'رقم الفاتورة', 'invoice_no', 'number'] if kind == "sales"
                   else ['purchase_number', 'رقم الشراء', 'رقم الفاتورة', 'po_number', 'invoice_number', 'number']),
        'party': (['customer_name', 'اسم العميل', 'customer', 'العميل'] if kind == "sales"
                  else ['supplier_name', 'اسم المورد', 'supplier', 'المورد']),
        'date': ['date', 'التاريخ', 'invoice_date', 'purchase_date', 'تاريخ الفاتورة'],
        'due_date': ['due_date', 'تاريخ الاستحقاق'],
        'subtotal': ['subtotal', 'المبلغ قبل الضريبة', 'قبل الضريبة', 'الصافي'],
        'tax_rate': ['tax_rate', 'نسبة الضريبة', 'الضريبة %'],
        'amount': ['amount', 'المبلغ', 'total', 'الإجمالي', 'الإجمالي شامل الضريبة'],
        'status': ['status', 'الحالة'],
        'method': ['payment_method', 'طريقة السداد', 'طريقة الدفع'],
        'description': ['description', 'البيان', 'الوصف'],
    })
    _require(cols, {"number": "رقم الفاتورة", "party": party_label, "date": "التاريخ",
                    "subtotal": "المبلغ قبل الضريبة", "tax_rate": "نسبة الضريبة", "status": "الحالة"}, df)

    unpaid_words = {"unpaid", "pending", "غير مدفوعة", "غير مدفوع", "آجل", "اجل", "مستحقة", "غير مسددة"}
    cash_words = {"cash", "نقدي", "نقدا", "نقداً", "خزينة"}
    bank_words = {"bank", "بنك", "تحويل", "تحويل بنكي", "شيك", "انستاباي", "instapay", "فودافون كاش"}
    doc_type = "sales_invoice" if kind == "sales" else "purchase_invoice"
    ck, rows, seen = Check(), [], {}
    for idx, row in df.iterrows():
        n = idx + 2
        r = {"n": n,
             "number": ck.text(row, n, cols.get('number'), "رقم الفاتورة", required=True, max_len=40),
             "party": " ".join(ck.text(row, n, cols.get('party'), party_label, required=True).split()),
             "date": ck.date(row, n, cols.get('date'), "التاريخ", required=True),
             "due_date": ck.date(row, n, cols.get('due_date'), "تاريخ الاستحقاق"),
             "subtotal": ck.number(row, n, cols.get('subtotal'), "المبلغ قبل الضريبة", required=True, positive=True),
             "rate": ck.number(row, n, cols.get('tax_rate'), "نسبة الضريبة", required=True),
             "description": ck.text(row, n, cols.get('description'), "البيان"),
             "status": cell(row, cols.get('status')).lower(),
             "method": cell(row, cols.get('method')).lower()}
        if r["rate"] is not None:
            if 0 < r["rate"] < 1:
                r["rate"] = round(r["rate"] * 100, 2)          # 0.14 written as a fraction
            if r["rate"] not in VALID_TAX_RATES:
                ck.err(n, "نسبة الضريبة", f"{r['rate']:g}% غير معتادة — المقبول: 0 أو 5 أو 10 أو 14")
        if r["due_date"] and r["date"] and r["due_date"] < r["date"]:
            ck.err(n, "تاريخ الاستحقاق", "قبل تاريخ الفاتورة")
        if "amount" in cols and cell(row, cols['amount']) and r["subtotal"] and r["rate"] is not None:
            gross = ck.number(row, n, cols['amount'], "الإجمالي")
            expected = round(r["subtotal"] * (1 + r["rate"] / 100), 2)
            if gross is not None and abs(gross - expected) > 1:
                ck.err(n, "الإجمالي", f"{gross:,.2f} لا يساوي المبلغ قبل الضريبة + الضريبة ({expected:,.2f})")
        if not r["status"]:
            ck.err(n, "الحالة", "فارغة — اكتب مدفوعة أو غير مدفوعة")
        elif r["status"] not in PAID_WORDS and r["status"] not in unpaid_words:
            ck.err(n, "الحالة", f"«{r['status']}» غير مفهومة — اكتب مدفوعة أو غير مدفوعة")
        r["paid"] = r["status"] in PAID_WORDS
        if r["paid"]:
            if not r["method"]:
                ck.err(n, "طريقة السداد", "فارغة والفاتورة مدفوعة — اكتب نقدي أو بنك")
            elif r["method"] not in cash_words | bank_words:
                ck.err(n, "طريقة السداد", f"«{r['method']}» غير مفهومة — اكتب نقدي أو بنك")
        ck.once(seen, r["number"], n, "رقم الفاتورة")
        if r["number"] and await db.invoices.find_one(
                {"company_id": company_id, "document_type": doc_type, "document_number": r["number"]},
                {"_id": 0, "id": 1}):
            ck.err(n, "رقم الفاتورة", f"«{r['number']}» مسجّلة بالفعل في البرنامج")
        rows.append(r)
    _reject(ck, len(df))

    user_id = current_user.get("user_id")
    done, total, paid_total = 0, 0.0, 0.0
    for r in rows:
        try:
            result = await import_invoice(db, company_id, user_id, kind, {
                "number": r["number"], "party_name": r["party"], "date": r["date"],
                "due_date": r["due_date"], "subtotal": r["subtotal"], "tax_rate": r["rate"],
                "description": r["description"], "paid": r["paid"],
                "method": "cash" if r["method"] in cash_words else "bank"})
            total += float(result["grand_total"] or 0)
            paid_total += result["paid"]
            done += 1
        except Exception as e:
            raise _partial_failure(done, len(rows), r["n"], e)
    if kind == "sales":
        notes = [f"{done} فاتورة بيع بإجمالي {total:,.2f} ج.م: مدين العملاء 131 / دائن المبيعات وضريبة القيمة المضافة 260"]
    else:
        notes = [f"{done} فاتورة شراء بإجمالي {total:,.2f} ج.م: مدين المشتريات/المخزون وضريبة المدخلات / دائن الموردين 251"
                 " (مع خصم وتحصيل 1% على ما يزيد عن 300 ج.م كما في شاشة الفواتير)"]
    if paid_total:
        notes.append(f"سُجّل سداد {paid_total:,.2f} ج.م للفواتير المدفوعة")
    return await _finish(current_user, import_type, "الفواتير" if kind == "sales" else "المشتريات",
                         file.filename, digest, len(df), done, [], notes,
                         {"grand_total": round(total, 2), "paid_total": round(paid_total, 2)})


@router.post("/invoices")
async def import_invoices(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Sales invoices through the invoice service: customer, VAT, entry, payment."""
    return await _import_invoices(file, current_user, "sales")


@router.post("/purchases")
async def import_purchases(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Purchase invoices through the invoice service: supplier, VAT, entry, payment."""
    return await _import_invoices(file, current_user, "purchase")


# ── opening trial balance (الميزان الافتتاحي) ──────────────────────────────
# There was no way to bring a company's opening balances in per account: only
# per customer / supplier / item, each auto-balanced against 213. An accountant
# moving from another system has a trial balance (account, debit, credit), and
# the one thing that must hold before anything is written is total debit =
# total credit. A sheet that does not balance is refused whole, with the totals
# and the difference named, and nothing reaches the ledger.

OPENING_CONTROL_ACCOUNTS = {"131": "العملاء", "251": "الموردين"}


@router.post("/opening-balances")
async def import_opening_balances(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """One posted opening entry from a trial-balance sheet; Dr must equal Cr."""
    from services.import_documents import Check, map_columns
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    company_id = current_user.get("company_id")
    # a second, different opening sheet would double every balance — the hash
    # check only stops the identical file
    # (once that entry has been reversed, a corrected sheet may come in)
    earlier = None
    async for h in db.import_history.find(
            {"company_id": company_id, "type": "opening_balances", "success_count": {"$gt": 0}},
            {"_id": 0, "created_at": 1, "filename": 1, "journal_entry_id": 1}):
        je = await db.journal_entries.find_one(
            {"company_id": company_id, "id": h.get("journal_entry_id")}, {"_id": 0, "status": 1})
        if not je or je.get("status") != "reversed":
            earlier = h
            break
    if earlier:
        raise HTTPException(status_code=409, detail=(
            f"الأرصدة الافتتاحية استُوردت من قبل ({earlier.get('filename', '')} بتاريخ "
            f"{str(earlier.get('created_at', ''))[:10]}). لتعديلها اعكس قيد الأرصدة الافتتاحية أولاً "
            "أو سجّل قيد تسوية — لا تُستورد مرتين حتى لا تتضاعف الأرصدة."))
    df, digest = await _read_upload(file, current_user, "opening_balances")
    cols = map_columns(df, {
        'code': ['account_code', 'كود الحساب', 'رقم الحساب', 'الكود', 'code'],
        'name': ['account_name', 'اسم الحساب', 'الحساب', 'name'],
        'debit': ['debit', 'مدين', 'رصيد مدين', 'الرصيد المدين'],
        'credit': ['credit', 'دائن', 'رصيد دائن', 'الرصيد الدائن'],
        'date': ['date', 'تاريخ الرصيد', 'التاريخ'],
    })
    _require(cols, {"code": "كود الحساب", "debit": "مدين", "credit": "دائن", "date": "تاريخ الرصيد"}, df)

    accounts = {a["account_code"]: a async for a in db.chart_of_accounts.find(
        {"company_id": company_id},
        {"_id": 0, "id": 1, "account_code": 1, "account_name": 1, "is_header": 1,
         "allow_posting": 1, "account_category": 1, "is_active": 1})}
    has_party_openings = bool(await db.invoices.find_one(
        {"company_id": company_id, "is_opening_balance": True}, {"_id": 0, "id": 1}))

    ck, rows, seen, dates = Check(), [], {}, {}
    total_dr = total_cr = 0.0
    for idx, row in df.iterrows():
        n = idx + 2
        code = ck.text(row, n, cols.get('code'), "كود الحساب", required=True, max_len=30)
        dr = ck.number(row, n, cols.get('debit'), "مدين")
        cr = ck.number(row, n, cols.get('credit'), "دائن")
        d = ck.date(row, n, cols.get('date'), "تاريخ الرصيد")
        if d:
            dates.setdefault(d, n)
        ck.once(seen, code, n, "كود الحساب")
        acc = accounts.get(code) if code else None
        if code and not acc:
            ck.err(n, "كود الحساب", f"«{code}» غير موجود في شجرة الحسابات")
        elif acc and (acc.get("is_header") or acc.get("allow_posting") is False
                      or acc.get("account_category") == "header"):
            ck.err(n, "كود الحساب", f"«{code} {acc.get('account_name', '')}» حساب تجميعي — ضع الرصيد على حساب فرعي تحته")
        elif acc and acc.get("is_active") is False:
            ck.err(n, "كود الحساب", f"«{code}» حساب موقوف")
        if code in OPENING_CONTROL_ACCOUNTS and has_party_openings:
            ck.err(n, "كود الحساب", (
                f"أرصدة {OPENING_CONTROL_ACCOUNTS[code]} الافتتاحية مستوردة بالفعل لكل طرف على {code} — "
                "احذف هذا الصف حتى لا يتضاعف الرصيد"))
        if dr is not None and cr is not None:
            if dr > 0 and cr > 0:
                ck.err(n, "مدين/دائن", "الصف فيه مدين ودائن معاً — اكتب الصافي في خانة واحدة")
            elif dr == 0 and cr == 0:
                ck.err(n, "مدين/دائن", "الصف بلا رصيد — احذفه أو اكتب المبلغ")
            total_dr += dr
            total_cr += cr
        rows.append({"n": n, "acc": acc, "dr": round(dr or 0, 2), "cr": round(cr or 0, 2)})
    if len(dates) > 1:
        ck.err(", ".join(str(v) for v in list(dates.values())[:5]), "تاريخ الرصيد",
               f"أكثر من تاريخ في الملف ({'، '.join(list(dates)[:5])}) — الميزان الافتتاحي له تاريخ واحد")
    elif not dates and len(df):
        ck.err(2, "تاريخ الرصيد", "فارغ في كل الصفوف — اكتب تاريخ بداية الأرصدة")
    total_dr, total_cr = round(total_dr, 2), round(total_cr, 2)
    if abs(total_dr - total_cr) > 0.01:
        ck.err(f"الإجمالي (بعد صف {len(df) + 1})", "مدين ≠ دائن",
               f"إجمالي المدين {total_dr:,.2f} لا يساوي إجمالي الدائن {total_cr:,.2f} "
               f"(الفرق {abs(total_dr - total_cr):,.2f} في جانب "
               f"{'المدين' if total_dr > total_cr else 'الدائن'}) — الميزان الافتتاحي يجب أن يتوازن")
    entry_date = next(iter(dates), "")
    if entry_date:
        fp = await db.financial_periods.find_one(
            {"company_id": company_id, "$or": [{"year": int(entry_date[:4]), "month": int(entry_date[5:7])},
                                               {"period": entry_date[:7]}]}, {"_id": 0, "status": 1})
        if fp and fp.get("status") == "closed":
            ck.err(list(dates.values())[0], "تاريخ الرصيد", f"الفترة {entry_date[:7]} مغلقة")
    if not len(df):
        ck.err(2, "الملف", "لا توجد صفوف")
    _reject(ck, len(df))

    from models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from services.accounting_service import AccountingService
    user_id = current_user.get("user_id") or "import"
    lines = [JournalEntryLine(account_id=r["acc"]["id"], account_code=r["acc"]["account_code"],
                              account_name=r["acc"].get("account_name", ""), debit=r["dr"], credit=r["cr"],
                              description="رصيد افتتاحي") for r in rows]
    svc = AccountingService(db)
    created = await svc.create_journal_entry(JournalEntry(
        company_id=company_id, entry_number=0, entry_date=entry_date,
        description=f"قيد الأرصدة الافتتاحية — {file.filename}"[:200], lines=lines,
        total_debit=total_dr, total_credit=total_cr, status=JournalEntryStatus.DRAFT,
        source_document_type="opening_balance", created_by=user_id,
        fiscal_year=entry_date[:4], period=entry_date[:7]))
    try:
        await svc.post_journal_entry(created["id"], user_id)
    except Exception as e:
        # a draft left behind would look like an opening entry that is not in
        # the ledger — remove it and report
        await db.journal_entries.delete_one({"id": created["id"], "company_id": company_id})
        raise HTTPException(status_code=400, detail=f"تعذّر ترحيل قيد الأرصدة الافتتاحية: {e}")
    notes = [f"قيد افتتاحي واحد ({len(rows)} سطر) بتاريخ {entry_date}: مدين {total_dr:,.2f} = دائن {total_cr:,.2f}"]
    if any(r["acc"]["account_code"] in OPENING_CONTROL_ACCOUNTS for r in rows):
        notes.append("رصيد العملاء/الموردين دخل كإجمالي — لن يظهر في كشف كل عميل أو مورد")
    result = await _finish(current_user, "opening_balances", "الأرصدة الافتتاحية", file.filename, digest,
                           len(df), len(rows), [], notes,
                           {"journal_entry_id": created["id"], "entry_number": created.get("entry_number_str"),
                            "total_debit": total_dr, "total_credit": total_cr})
    await db.import_history.update_one(
        {"company_id": company_id, "type": "opening_balances", "file_hash": digest},
        {"$set": {"journal_entry_id": created["id"]}})
    return result


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
    "opening_balances": {
        "columns_en": ["account_code", "account_name", "debit", "credit", "date"],
        "columns_ar": ["كود الحساب", "اسم الحساب", "مدين", "دائن", "تاريخ الرصيد"],
        "sample": [{"account_code": "162", "account_name": "النقدية بالبنوك", "debit": 50000, "credit": "",
                    "date": "2026-01-01"}],
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
