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
    if filename.endswith('.xlsx') or filename.endswith('.xls'):
        return pd.read_excel(io.BytesIO(file_content))
    elif filename.endswith('.csv'):
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
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    return imports

# Import Employees
@router.post("/employees")
async def import_employees(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import employees from Excel/CSV file"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Column mapping (Arabic and English)
    column_map = {
        'name': ['name', 'الاسم', 'اسم الموظف', 'employee_name', 'full_name', 'الاسم الكامل'],
        'position': ['position', 'الوظيفة', 'المسمى الوظيفي', 'job_title', 'title'],
        'department': ['department', 'القسم', 'الإدارة'],
        'email': ['email', 'البريد الإلكتروني', 'الإيميل'],
        'phone': ['phone', 'الهاتف', 'رقم الهاتف', 'mobile', 'الجوال'],
        'hire_date': ['hire_date', 'تاريخ التعيين', 'تاريخ الالتحاق', 'start_date'],
        'basic_salary': ['basic_salary', 'الراتب الأساسي', 'الراتب', 'salary']
    }
    
    # Find matching columns
    df.columns = df.columns.str.strip().str.lower()
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    if 'name' not in mapped_cols:
        raise HTTPException(status_code=400, detail="Required column 'name' or 'الاسم' not found in file")
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            employee = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "name": str(row.get(mapped_cols.get('name', ''), '')).strip(),
                "position": str(row.get(mapped_cols.get('position', ''), 'N/A')).strip(),
                "department": str(row.get(mapped_cols.get('department', ''), '')).strip() or None,
                "email": str(row.get(mapped_cols.get('email', ''), '')).strip() or None,
                "phone": str(row.get(mapped_cols.get('phone', ''), '')).strip() or None,
                "hire_date": str(row.get(mapped_cols.get('hire_date', ''), datetime.now().strftime('%Y-%m-%d'))),
                "basic_salary": float(row.get(mapped_cols.get('basic_salary', ''), 0) or 0),
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            if not employee['name']:
                raise ValueError("Name is required")
            
            await db.employees.insert_one(employee)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    # Save import history
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": "employees",
        "type_ar": "الموظفين",
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Import Financial Data (Revenues/Expenses)
@router.post("/financial")
async def import_financial(
    file: UploadFile = File(...),
    data_type: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Import financial data (revenues/expenses) from Excel/CSV"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    df.columns = df.columns.str.strip().str.lower()
    
    column_map = {
        'date': ['date', 'التاريخ', 'تاريخ'],
        'description': ['description', 'الوصف', 'البيان', 'notes'],
        'amount': ['amount', 'المبلغ', 'القيمة', 'value'],
        'category': ['category', 'الفئة', 'التصنيف', 'type', 'النوع'],
        'account': ['account', 'الحساب']
    }
    
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    success_count = 0
    error_count = 0
    errors = []
    collection = "revenues" if data_type == "revenue" else "expenses"
    
    for idx, row in df.iterrows():
        try:
            record = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "date": str(row.get(mapped_cols.get('date', ''), datetime.now().strftime('%Y-%m-%d'))),
                "description": str(row.get(mapped_cols.get('description', ''), '')).strip(),
                "amount": float(row.get(mapped_cols.get('amount', ''), 0) or 0),
                "category": str(row.get(mapped_cols.get('category', ''), '')).strip() or None,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db[collection].insert_one(record)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    type_name = "الإيرادات" if data_type == "revenue" else "المصروفات"
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": data_type,
        "type_ar": type_name,
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Import Customers
@router.post("/customers")
async def import_customers(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import customers from Excel/CSV"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    df.columns = df.columns.str.strip().str.lower()
    
    column_map = {
        'name': ['name', 'الاسم', 'اسم العميل', 'customer_name'],
        'email': ['email', 'البريد الإلكتروني', 'الإيميل'],
        'phone': ['phone', 'الهاتف', 'رقم الهاتف', 'mobile'],
        'address': ['address', 'العنوان'],
        'balance': ['balance', 'الرصيد', 'المبلغ المستحق']
    }
    
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    if 'name' not in mapped_cols:
        raise HTTPException(status_code=400, detail="Required column 'name' or 'الاسم' not found")
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            customer = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "name": str(row.get(mapped_cols.get('name', ''), '')).strip(),
                "email": str(row.get(mapped_cols.get('email', ''), '')).strip() or None,
                "phone": str(row.get(mapped_cols.get('phone', ''), '')).strip(),
                "address": str(row.get(mapped_cols.get('address', ''), '')).strip() or None,
                "balance": float(row.get(mapped_cols.get('balance', ''), 0) or 0),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            if not customer['name']:
                raise ValueError("Name is required")
            
            await db.customers.insert_one(customer)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": "customers",
        "type_ar": "العملاء",
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Import Suppliers
@router.post("/suppliers")
async def import_suppliers(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import suppliers from Excel/CSV"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    df.columns = df.columns.str.strip().str.lower()
    
    column_map = {
        'name': ['name', 'الاسم', 'اسم المورد', 'supplier_name'],
        'email': ['email', 'البريد الإلكتروني', 'الإيميل'],
        'phone': ['phone', 'الهاتف', 'رقم الهاتف', 'mobile'],
        'address': ['address', 'العنوان'],
        'balance': ['balance', 'الرصيد', 'المبلغ المستحق']
    }
    
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    if 'name' not in mapped_cols:
        raise HTTPException(status_code=400, detail="Required column 'name' or 'الاسم' not found")
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            supplier = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "name": str(row.get(mapped_cols.get('name', ''), '')).strip(),
                "email": str(row.get(mapped_cols.get('email', ''), '')).strip() or None,
                "phone": str(row.get(mapped_cols.get('phone', ''), '')).strip(),
                "address": str(row.get(mapped_cols.get('address', ''), '')).strip() or None,
                "balance": float(row.get(mapped_cols.get('balance', ''), 0) or 0),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            if not supplier['name']:
                raise ValueError("Name is required")
            
            await db.suppliers.insert_one(supplier)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": "suppliers",
        "type_ar": "الموردين",
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Import Inventory
@router.post("/inventory")
async def import_inventory(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import inventory items from Excel/CSV"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    df.columns = df.columns.str.strip().str.lower()
    
    column_map = {
        'name': ['name', 'الاسم', 'اسم الصنف', 'item_name', 'product'],
        'category': ['category', 'الفئة', 'التصنيف'],
        'quantity': ['quantity', 'الكمية', 'qty'],
        'unit': ['unit', 'الوحدة'],
        'unit_price': ['unit_price', 'سعر الوحدة', 'price', 'السعر'],
        'min_stock': ['min_stock', 'الحد الأدنى', 'minimum', 'min']
    }
    
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    if 'name' not in mapped_cols:
        raise HTTPException(status_code=400, detail="Required column 'name' or 'الاسم' not found")
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            quantity = float(row.get(mapped_cols.get('quantity', ''), 0) or 0)
            unit_price = float(row.get(mapped_cols.get('unit_price', ''), 0) or 0)
            min_stock = float(row.get(mapped_cols.get('min_stock', ''), 10) or 10)
            
            item = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "name": str(row.get(mapped_cols.get('name', ''), '')).strip(),
                "category": str(row.get(mapped_cols.get('category', ''), 'General')).strip(),
                "quantity": quantity,
                "unit": str(row.get(mapped_cols.get('unit', ''), 'pcs')).strip(),
                "unit_price": unit_price,
                "total_value": quantity * unit_price,
                "min_stock": min_stock,
                "status": "low-stock" if quantity <= min_stock else "in-stock",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if not item['name']:
                raise ValueError("Name is required")
            
            await db.inventory.insert_one(item)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": "inventory",
        "type_ar": "المخزون",
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Import Invoices
@router.post("/invoices")
async def import_invoices(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import invoices from Excel/CSV"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    df.columns = df.columns.str.strip().str.lower()
    
    column_map = {
        'invoice_number': ['invoice_number', 'رقم الفاتورة', 'invoice_no', 'number'],
        'customer_name': ['customer_name', 'اسم العميل', 'customer', 'العميل'],
        'date': ['date', 'التاريخ', 'invoice_date'],
        'due_date': ['due_date', 'تاريخ الاستحقاق'],
        'amount': ['amount', 'المبلغ', 'total', 'الإجمالي'],
        'status': ['status', 'الحالة']
    }
    
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            invoice = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "invoice_number": str(row.get(mapped_cols.get('invoice_number', ''), f"INV-{idx+1:04d}")),
                "customer_name": str(row.get(mapped_cols.get('customer_name', ''), 'N/A')).strip(),
                "date": str(row.get(mapped_cols.get('date', ''), datetime.now().strftime('%Y-%m-%d'))),
                "due_date": str(row.get(mapped_cols.get('due_date', ''), '')).strip() or None,
                "amount": float(row.get(mapped_cols.get('amount', ''), 0) or 0),
                "status": str(row.get(mapped_cols.get('status', ''), 'pending')).strip().lower(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.invoices.insert_one(invoice)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": "invoices",
        "type_ar": "الفواتير",
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Import Purchases
@router.post("/purchases")
async def import_purchases(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Import purchases from Excel/CSV"""
    if current_user.get("role") not in IMPORT_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    company_id = current_user.get("company_id")
    content = await file.read()
    
    try:
        df = parse_file(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    df.columns = df.columns.str.strip().str.lower()
    
    column_map = {
        'purchase_number': ['purchase_number', 'رقم الشراء', 'po_number', 'number'],
        'supplier_name': ['supplier_name', 'اسم المورد', 'supplier', 'المورد'],
        'date': ['date', 'التاريخ', 'purchase_date'],
        'amount': ['amount', 'المبلغ', 'total', 'الإجمالي'],
        'status': ['status', 'الحالة']
    }
    
    mapped_cols = {}
    for key, variations in column_map.items():
        for var in variations:
            if var.lower() in df.columns:
                mapped_cols[key] = var.lower()
                break
    
    success_count = 0
    error_count = 0
    errors = []
    
    for idx, row in df.iterrows():
        try:
            purchase = {
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "purchase_number": str(row.get(mapped_cols.get('purchase_number', ''), f"PO-{idx+1:04d}")),
                "supplier_name": str(row.get(mapped_cols.get('supplier_name', ''), 'N/A')).strip(),
                "date": str(row.get(mapped_cols.get('date', ''), datetime.now().strftime('%Y-%m-%d'))),
                "amount": float(row.get(mapped_cols.get('amount', ''), 0) or 0),
                "status": str(row.get(mapped_cols.get('status', ''), 'pending')).strip().lower(),
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.purchases.insert_one(purchase)
            success_count += 1
        except Exception as e:
            error_count += 1
            errors.append(f"Row {idx + 2}: {str(e)}")
    
    import_record = {
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "type": "purchases",
        "type_ar": "المشتريات",
        "filename": file.filename,
        "total_rows": len(df),
        "success_count": success_count,
        "error_count": error_count,
        "errors": errors[:10],
        "imported_by": current_user.get("full_name", current_user.get("email")),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.import_history.insert_one(import_record)
    
    return {
        "message": "Import completed",
        "total": len(df),
        "success": success_count,
        "errors": error_count,
        "error_details": errors[:10]
    }

# Download template
@router.get("/template/{data_type}")
async def get_template(data_type: str):
    """Get template information for import"""
    templates = {
        "employees": {
            "columns_en": ["name", "position", "department", "email", "phone", "hire_date", "basic_salary"],
            "columns_ar": ["الاسم", "الوظيفة", "القسم", "البريد الإلكتروني", "الهاتف", "تاريخ التعيين", "الراتب الأساسي"],
            "sample": [
                {"name": "أحمد محمد", "position": "مهندس برمجيات", "department": "تكنولوجيا المعلومات", "email": "ahmed@example.com", "phone": "01234567890", "hire_date": "2024-01-15", "basic_salary": 15000}
            ]
        },
        "customers": {
            "columns_en": ["name", "email", "phone", "address", "balance"],
            "columns_ar": ["الاسم", "البريد الإلكتروني", "الهاتف", "العنوان", "الرصيد"],
            "sample": [
                {"name": "شركة ABC", "email": "info@abc.com", "phone": "01234567890", "address": "القاهرة", "balance": 5000}
            ]
        },
        "suppliers": {
            "columns_en": ["name", "email", "phone", "address", "balance"],
            "columns_ar": ["الاسم", "البريد الإلكتروني", "الهاتف", "العنوان", "الرصيد"],
            "sample": [
                {"name": "مورد XYZ", "email": "info@xyz.com", "phone": "01234567890", "address": "الجيزة", "balance": 10000}
            ]
        },
        "inventory": {
            "columns_en": ["name", "category", "quantity", "unit", "unit_price", "min_stock"],
            "columns_ar": ["الاسم", "الفئة", "الكمية", "الوحدة", "سعر الوحدة", "الحد الأدنى"],
            "sample": [
                {"name": "منتج 1", "category": "مواد خام", "quantity": 100, "unit": "كيلو", "unit_price": 50, "min_stock": 20}
            ]
        },
        "invoices": {
            "columns_en": ["invoice_number", "customer_name", "date", "due_date", "amount", "status"],
            "columns_ar": ["رقم الفاتورة", "اسم العميل", "التاريخ", "تاريخ الاستحقاق", "المبلغ", "الحالة"],
            "sample": [
                {"invoice_number": "INV-001", "customer_name": "عميل 1", "date": "2024-01-15", "due_date": "2024-02-15", "amount": 5000, "status": "pending"}
            ]
        },
        "purchases": {
            "columns_en": ["purchase_number", "supplier_name", "date", "amount", "status"],
            "columns_ar": ["رقم الشراء", "اسم المورد", "التاريخ", "المبلغ", "الحالة"],
            "sample": [
                {"purchase_number": "PO-001", "supplier_name": "مورد 1", "date": "2024-01-15", "amount": 10000, "status": "pending"}
            ]
        },
        "financial": {
            "columns_en": ["date", "description", "amount", "category"],
            "columns_ar": ["التاريخ", "الوصف", "المبلغ", "الفئة"],
            "sample": [
                {"date": "2024-01-15", "description": "مبيعات منتجات", "amount": 25000, "category": "مبيعات"}
            ]
        }
    }
    
    if data_type not in templates:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return templates[data_type]
