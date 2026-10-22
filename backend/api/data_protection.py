"""
Data Protection Tools — أدوات مساعدة لطلبات حماية البيانات الشخصية

IMPORTANT (owner rule): this module is a set of TOOLS that help the company
answer data-protection requests and keep an eye on personal data. It is NOT a
certificate of compliance with the Egyptian Personal Data Protection Law
151/2020, and nothing it returns may say "compliant / ممتثل". Compliance is a
legal judgement about the whole company (policies, consents, DPO, licences
from the Data Protection Centre...) that only a lawyer can give.

1. Data Retention overview   — مدد احتفاظ افتراضية تُراجَع مع المستشار القانوني/الضريبي
2. PII Field Encryption      — معطَّل افتراضياً؛ ENCRYPTION_INVENTORY يبين ما هو مشفَّر وما ليس مشفَّراً
3. Data Masking by Role      — إخفاء البيانات الحساسة حسب الصلاحية
4. Data Subject requests     — سجل الطلبات + تقرير الوصول + التصحيح
5. Status report             — حالة الأدوات (ليس تقرير امتثال)
"""
import uuid, hashlib, hmac, base64, os
from datetime import datetime, timezone, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks

from database import db
from dependencies import get_current_user

router = APIRouter(prefix="/api/data-protection", tags=["Data Protection"])

DISCLAIMER = ("هذه أدوات مساعدة للتعامل مع طلبات حماية البيانات الشخصية ومتابعتها، "
              "وليست شهادة امتثال لقانون حماية البيانات الشخصية رقم 151 لسنة 2020. "
              "الامتثال يحدده مستشار قانوني.")

# ══════════════════════════════════════════════════════════════
# ROLES
# ══════════════════════════════════════════════════════════════
# The role sets were {"super_admin","hr_manager","finance_manager","legal"} —
# strings no user ever has (roles are "HR Manager", "مدير الموارد البشرية"...),
# so every request for a data-subject report was refused and every screen
# showed masked data, including to HR.
TOP_ROLES = {"Board Chairman", "رئيس مجلس الإدارة", "General Manager", "مدير عام",
             "المدير العام", "CEO", "المدير التنفيذي", "owner"}
HR_ROLES = {"HR Manager", "مدير الموارد البشرية", "مدير موارد بشرية"}
PAYROLL_ROLES = {"Financial Manager", "المدير المالي", "Payroll Officer", "مسؤول الرواتب",
                 "Payroll Accountant", "محاسب الرواتب"}
# Who sees national ID / phone / bank account in full.
PII_CLEARANCE_ROLES = TOP_ROLES | HR_ROLES | PAYROLL_ROLES
# Who sees salary figures. The chief accountant posts the payroll entries.
SALARY_CLEARANCE_ROLES = PII_CLEARANCE_ROLES | {"Chief Accountant", "رئيس الحسابات"}


def has_pii_clearance(user: dict) -> bool:
    return (user or {}).get("role") in PII_CLEARANCE_ROLES or bool((user or {}).get("is_platform_admin"))


def has_salary_clearance(user: dict) -> bool:
    return (user or {}).get("role") in SALARY_CLEARANCE_ROLES or bool((user or {}).get("is_platform_admin"))


def _require_top(user: dict, what: str):
    if user.get("role") not in TOP_ROLES and not user.get("is_platform_admin"):
        raise HTTPException(403, f"{what} لرئيس مجلس الإدارة أو المدير العام / التنفيذي فقط")


def _require_clearance(user: dict):
    if user.get("role") not in PII_CLEARANCE_ROLES and not user.get("is_platform_admin"):
        raise HTTPException(403, "غير مصرح — للإدارة العليا ومدير الموارد البشرية والمدير المالي فقط")


# ══════════════════════════════════════════════════════════════
# ENCRYPTION SERVICE
# ══════════════════════════════════════════════════════════════

class FieldEncryption:
    """
    تشفير الحقول الحساسة (PII) باستخدام Fernet.

    The key used to fall back to sha256(MONGO_URL). That is not a secret (it
    sits next to the data it protects), and changing the database password
    would have made every encrypted national ID unreadable for good
    ("DECRYPTION_ERROR"). There is no fallback any more: without
    FIELD_ENCRYPTION_KEY nothing is encrypted.
    """
    def __init__(self):
        self._fernet = None

    def _get_fernet(self):
        if self._fernet is None:
            key = os.environ.get("FIELD_ENCRYPTION_KEY")
            if not key:
                return None
            try:
                from cryptography.fernet import Fernet
                self._fernet = Fernet(key.encode() if isinstance(key, str) else key)
            except Exception:
                self._fernet = None
        return self._fernet

    def available(self) -> bool:
        return self._get_fernet() is not None

    def encrypt(self, value: str) -> str:
        if not value or value.startswith("ENCRYPTED:"):
            return value
        f = self._get_fernet()
        if f is None:
            raise HTTPException(503, "مفتاح التشفير FIELD_ENCRYPTION_KEY غير مضبوط على الخادم")
        return "ENCRYPTED:" + f.encrypt(value.encode()).decode()

    def decrypt(self, value: str) -> str:
        if not value or not isinstance(value, str) or not value.startswith("ENCRYPTED:"):
            return value
        f = self._get_fernet()
        if f is None:
            return "[مشفَّر]"
        try:
            return f.decrypt(value[10:].encode()).decode()
        except Exception:
            return "[تعذَّر فك التشفير]"

    def mask(self, value: str, show_last: int = 4) -> str:
        if not value:
            return ""
        plain = self.decrypt(value) if str(value).startswith("ENCRYPTED:") else str(value)
        if len(plain) <= show_last:
            return "*" * len(plain)
        return "*" * (len(plain) - show_last) + plain[-show_last:]

    def hash_for_search(self, value: str) -> str:
        # A plain sha256 of a 14-digit national ID is reversed by trying every
        # ID; keyed HMAC is not.
        key = (os.environ.get("FIELD_ENCRYPTION_KEY") or "").encode()
        return "HMAC:" + hmac.new(key, value.encode(), hashlib.sha256).hexdigest()[:32]


ENCRYPTION = FieldEncryption()

# Real field names of an employee (models/employee_extended.py). The old list
# named "mobile_number", "home_address", "bank_account_iban" — fields that do
# not exist — so masking hid nothing but the national ID.
# PII_FIELDS["employees"] is also the list the (disabled) field encryption
# would encrypt, so salary figures are kept in their own list: encrypting a
# number would break payroll arithmetic.
SALARY_FIELDS = ["basic_salary", "net_salary", "gross_salary", "total_allowances", "total_deductions",
                 "salary", "insurance_salary", "insured_salary", "social_insurance_salary",
                 "variable_salary", "health_insurance_amount", "hourly_rate", "daily_rate",
                 "income_tax", "social_insurance", "company_social_insurance", "total_cost",
                 "total_earnings", "overtime_amount", "bonus", "deductions_total"]
PII_FIELDS = {
    "employees": ["national_id", "bank_account_number", "iban", "mobile", "phone",
                  "address", "emergency_phone",
                  # legacy names, kept so old records are masked too
                  "bank_account_iban", "mobile_number", "home_address"],
    "employee_salary": SALARY_FIELDS,
    "customers": ["national_id", "tax_id", "phone"],
    "users":     ["mobile", "personal_email"],
}

# how many trailing characters stay visible; 0 = hidden entirely
MASK_SHOW = {"national_id": 3, "tax_id": 3, "phone": 3, "mobile": 3, "mobile_number": 3,
             "emergency_phone": 3, "wallet_number": 3, "social_insurance_number": 3,
             "iban": 4, "bank_account_iban": 4, "bank_account_number": 4, "account_number": 4,
             "address": 0, "home_address": 0, "personal_email": 0}


def mask_value(value, show: int) -> str:
    if value in (None, ""):
        return value
    plain = ENCRYPTION.decrypt(str(value)) if str(value).startswith("ENCRYPTED:") else str(value)
    if show <= 0 or len(plain) <= show:
        return "*" * min(len(plain), 8) or "*"
    return "*" * (len(plain) - show) + plain[-show:]


def is_masked(value) -> bool:
    """True for a value this module produced by masking (so it is never
    written back over the real one)."""
    return isinstance(value, str) and value.startswith("*") and set(value[:max(1, len(value) - 4)]) <= {"*"}


def _hide_salary(doc: dict) -> None:
    for f in SALARY_FIELDS:
        if f in doc:
            doc[f] = None
    for lst in ("allowances", "deductions"):
        if isinstance(doc.get(lst), list):
            doc[lst] = [{**x, "amount": None, "percentage": None} if isinstance(x, dict) else x for x in doc[lst]]
        elif isinstance(doc.get(lst), dict):
            doc[lst] = {k: None for k in doc[lst]}
    doc.pop("last_payroll", None)


def mask_employee(doc: dict, user: dict) -> dict:
    """Mask an employee (or payroll row) for the caller's role.
    Identity fields → last 3 (national ID, phone) / last 4 (IBAN, account);
    salary figures → hidden (None) for roles without salary clearance.
    Returns a copy with `pii_masked` / `salary_hidden` flags."""
    out = dict(doc)
    pii = has_pii_clearance(user)
    sal = has_salary_clearance(user)
    if pii:
        for field in PII_FIELDS["employees"]:
            if out.get(field):
                out[field] = ENCRYPTION.decrypt(out[field])
    else:
        for field, show in MASK_SHOW.items():
            if out.get(field):
                out[field] = mask_value(out[field], show)
    if not sal:
        _hide_salary(out)
    out["pii_masked"] = not pii
    out["salary_hidden"] = not sal
    return out


def apply_pii_mask(doc: dict, collection: str, user_role: str) -> dict:
    """Older entry point (by role name only)."""
    if collection == "employees":
        return mask_employee(doc, {"role": user_role})
    if user_role in PII_CLEARANCE_ROLES:
        for field in PII_FIELDS.get(collection, []):
            if doc.get(field):
                doc[field] = ENCRYPTION.decrypt(doc[field])
        return doc
    for field in PII_FIELDS.get(collection, []):
        if doc.get(field):
            doc[field] = mask_value(doc[field], MASK_SHOW.get(field, 3))
    return doc


async def log_pii_view(user: dict, entity: str, entity_id: str = None, fields: list = None,
                       description: str = None, ip: str = None) -> None:
    """Record that personal data was shown in full (pii_viewed) in the
    company's chained audit trail. Never raises."""
    try:
        from services.audit_helper import log_event
        await log_event(db, (user or {}).get("company_id"), user, "pii_viewed", "data_protection",
                        entity=entity, entity_id=entity_id, ip=ip,
                        new={"fields": fields or []}, description=description)
    except Exception:
        pass


async def _log(company_id: str, user_id: str, action: str, employee_id: str = None, **extra):
    await db.data_protection_log.insert_one({
        "id": str(uuid.uuid4()), "company_id": company_id, "action": action,
        "employee_id": employee_id, "performed_by": user_id,
        "timestamp": datetime.now(timezone.utc).isoformat(), **extra,
    })


# ══════════════════════════════════════════════════════════════
# 1. PII ENCRYPTION ENDPOINTS
# ══════════════════════════════════════════════════════════════
# Encrypting national ID / IBAN / mobile IN PLACE breaks the rest of the
# system, which reads those fields as plain text: payroll bank files, social
# insurance forms (gov_integration), the e-invoice validator, the ghost-
# employee check (duplicate national IDs) and import de-duplication would all
# get "ENCRYPTED:..." instead of the value. Until those readers decrypt, the
# endpoints refuse unless the operator turns the feature on explicitly
# (PII_FIELD_ENCRYPTION=enabled) AND a real key is configured. Disk / database
# encryption at rest is the safe way to protect these fields today.

def _encryption_gate():
    if os.environ.get("PII_FIELD_ENCRYPTION", "").lower() != "enabled":
        raise HTTPException(409, "تشفير الحقول داخل قاعدة البيانات غير مفعَّل: الرواتب والتأمينات والفاتورة "
                                 "الإلكترونية تقرأ الرقم القومي والحساب البنكي كنص صريح وستتعطل. "
                                 "استخدم تشفير القرص/قاعدة البيانات على الخادم بدلاً منه.")
    if not ENCRYPTION.available():
        raise HTTPException(503, "مفتاح التشفير FIELD_ENCRYPTION_KEY غير مضبوط على الخادم")


@router.post("/encrypt-employee-pii/{employee_id}")
async def encrypt_employee_pii(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    _require_top(current_user, "تشفير البيانات الشخصية")
    _encryption_gate()
    company_id = current_user["company_id"]
    emp = await db.employees.find_one(
        {"id": employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")

    update_fields = {}
    for field in PII_FIELDS["employees"]:
        val = emp.get(field, "")
        if val and not str(val).startswith("ENCRYPTED:"):
            update_fields[field] = ENCRYPTION.encrypt(str(val))
            update_fields[f"{field}_hash"] = ENCRYPTION.hash_for_search(str(val))

    if not update_fields:
        return {"message": "البيانات مُشفَّرة بالفعل", "employee_id": employee_id}

    # was update_one({"id": employee_id}) — not limited to the company
    await db.employees.update_one(
        {"id": employee_id, "company_id": company_id},
        {"$set": {**update_fields,
                  "pii_encrypted": True,
                  "pii_encrypted_at": datetime.now(timezone.utc).isoformat()}}
    )
    await _log(company_id, current_user["user_id"], "encryption", employee_id)
    return {
        "message":          "✅ تم تشفير الحقول الحساسة للموظف",
        "employee_id":      employee_id,
        "fields_encrypted": [f for f in PII_FIELDS["employees"] if f in update_fields],
    }


@router.post("/encrypt-all-employees")
async def encrypt_all_employees(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    _require_top(current_user, "تشفير البيانات الشخصية")
    _encryption_gate()
    company_id = current_user["company_id"]
    count = await db.employees.count_documents(
        {"company_id": company_id, "pii_encrypted": {"$ne": True}})

    async def bg_encrypt():
        employees = await db.employees.find(
            {"company_id": company_id, "pii_encrypted": {"$ne": True}},
            {"_id": 0, "id": 1}
        ).to_list(None)
        for emp in employees:
            try:
                await encrypt_employee_pii(emp["id"], current_user)
            except Exception:
                pass

    background_tasks.add_task(bg_encrypt)
    return {"message": f"تشفير {count} موظف يعمل في الخلفية", "employees_count": count}


@router.get("/masked-employee/{employee_id}")
async def get_masked_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """عرض بيانات الموظف مع إخفاء الحقول الحساسة حسب الدور"""
    company_id = current_user["company_id"]
    user_role  = current_user.get("role", "user")

    emp = await db.employees.find_one(
        {"id": employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")

    emp_masked = mask_employee(emp, current_user)
    if not emp_masked["pii_masked"]:
        await log_pii_view(current_user, "employee", employee_id, ["national_id", "iban", "mobile"],
                           "عرض بيانات موظف كاملة (masked-employee)")
    return {
        "employee":     emp_masked,
        "access_level": "full" if has_pii_clearance(current_user) else "masked",
        "note":         "الحقول الحساسة مُخفاة لغير المصرح لهم",
    }


# ══════════════════════════════════════════════════════════════
# 2. DATA RETENTION — مدد الاحتفاظ
# ══════════════════════════════════════════════════════════════
# These are DEFAULTS for review, not legal advice. Tax/accounting records must
# be kept for the period the tax and commercial laws require (the Unified Tax
# Procedures Law 206/2020 sets the minimum for books and records); the exact
# periods per record type must be confirmed by the company's tax adviser and
# lawyer. Records still inside their period can never be deleted by this
# module — it only reports and flags for archiving.
RETENTION_RULES = {
    "journal_entries":    {"years": 5,  "date_field": "entry_date",    "basis": "سجلات محاسبية وضريبية — قانون الإجراءات الضريبية الموحد 206/2020", "legal_hold": True},
    "invoices":           {"years": 5,  "date_field": "document_date", "basis": "سجلات ضريبية — قانون 206/2020", "legal_hold": True},
    "payroll_runs":       {"years": 5,  "date_field": "month",         "basis": "سجلات أجور وضرائب وتأمينات", "legal_hold": True},
    "tax_forms":          {"years": 5,  "date_field": "created_at",    "basis": "إقرارات ونماذج ضريبية", "legal_hold": True},
    "eta_signing_records":{"years": 5,  "date_field": "created_at",    "basis": "سجلات الفاتورة الإلكترونية", "legal_hold": True},
    "letters_of_credit":  {"years": 5,  "date_field": "created_at",    "basis": "مستندات تجارية", "legal_hold": True},
    "audit_trail":        {"years": 7,  "date_field": "timestamp",     "basis": "اختيار حوكمة — قابل للتعديل", "legal_hold": False},
    "employees":          {"years": 10, "date_field": "created_at",    "basis": "ملفات العاملين — المدة تُحدَّد مع المستشار القانوني", "legal_hold": True},
    "contracts":          {"years": 10, "date_field": "created_at",    "basis": "عقود — المدة تُحدَّد مع المستشار القانوني", "legal_hold": True},
}


async def _rules(company_id: str) -> dict:
    """RETENTION_RULES with the company's own years (سياسات الشركة)."""
    from api.company_policies import retention_years
    years = await retention_years(company_id)
    return {k: {**r, "years": int(years.get(k, r["years"]))} for k, r in RETENTION_RULES.items()}


def _cutoff(rule: dict, today: date) -> str:
    d = (today - relativedelta(years=rule["years"])).isoformat()
    return d[:7] if rule["date_field"] == "month" else d


@router.get("/retention/status")
async def retention_status(current_user: dict = Depends(get_current_user)):
    """عرض عدد السجلات داخل وخارج مدة الاحتفاظ الافتراضية لكل نوع سجل"""
    company_id = current_user["company_id"]
    today      = date.today()
    report     = []

    for collection, rule in (await _rules(company_id)).items():
        min_keep_date = _cutoff(rule, today)
        col = db[collection]
        try:
            total = await col.count_documents({"company_id": company_id})
            # The date field was always "created_at" (`else "created_at" if
            # "created_at" else None` is always true), and created_at is a
            # datetime on many records, so string comparison found nothing.
            old_count = await col.count_documents(
                {"company_id": company_id, rule["date_field"]: {"$lt": min_keep_date}})
            status = ("ضمن مدة الاحتفاظ" if old_count == 0
                      else f"{old_count:,} سجل تجاوز {rule['years']} سنوات")
        except Exception:
            total = old_count = 0
            status = "غير متاح"

        report.append({
            "collection":       collection,
            "retention_years":  rule["years"],
            "law_reference":    rule["basis"],
            "total_records":    total,
            "beyond_retention": old_count,
            "min_keep_date":    min_keep_date,
            "status":           status,
            "action": (
                "احتفظ — لا يُحذف" if old_count == 0 else
                "يمكن تعليمه للأرشفة بعد موافقة المستشار القانوني — لا يحذف النظام أي سجل"
            ),
        })

    return {
        "title":       "مدد الاحتفاظ بالسجلات",
        "as_of":       today.isoformat(),
        "collections": report,
        "note":        "المدد من سياسات شركتك (الإعدادات ← سياسات الشركة) — راجعها مع المستشار الضريبي والقانوني.",
        "disclaimer":  DISCLAIMER,
    }


@router.post("/retention/flag-for-archive")
async def flag_for_archive(data: dict,
                           current_user: dict = Depends(get_current_user)):
    """تعليم السجلات القديمة للأرشفة (لا حذف)"""
    company_id  = current_user["company_id"]
    collection  = data.get("collection", "journal_entries")
    dry_run     = data.get("dry_run", True) is not False

    if collection not in RETENTION_RULES:
        raise HTTPException(400, "نوع السجل غير مُعرَّف في مدد الاحتفاظ")
    rule = (await _rules(company_id))[collection]
    cutoff = _cutoff(rule, date.today())
    # A caller-supplied before_date could flag records still inside the legal
    # period; it may only move the cut-off EARLIER, never later.
    before_date = str(data.get("before_date") or cutoff)
    if before_date > cutoff:
        before_date = cutoff
    q = {"company_id": company_id, rule["date_field"]: {"$lt": before_date}}

    count = await db[collection].count_documents(q)
    if dry_run:
        return {"message": f"[معاينة] سيُعلَّم {count:,} سجل للأرشفة", "collection": collection,
                "before_date": before_date, "count": count, "dry_run": True}

    _require_top(current_user, "تعليم السجلات للأرشفة")
    result = await db[collection].update_many(
        q, {"$set": {"archive_flagged": True,
                     "archive_flagged_at": datetime.now(timezone.utc).isoformat(),
                     "archive_flagged_by": current_user["user_id"]}})
    await _log(company_id, current_user["user_id"], "archive_flag",
               collection=collection, before_date=before_date, count=result.modified_count)
    return {"message": f"✅ تم تعليم {result.modified_count:,} سجل للأرشفة (لم يُحذف شيء)",
            "collection": collection, "before_date": before_date, "flagged": result.modified_count}


# ══════════════════════════════════════════════════════════════
# 3. DATA SUBJECT REQUESTS — طلبات أصحاب البيانات
# ══════════════════════════════════════════════════════════════

REQUEST_TYPES = {
    "access":        "طلب اطلاع على البيانات",
    "rectification": "طلب تصحيح",
    "erasure":       "طلب محو / حذف",
    "objection":     "اعتراض على المعالجة",
    "restriction":   "طلب تقييد المعالجة",
}
REQUEST_STATUSES = {"received", "in_review", "completed", "rejected"}
# Shown on every erasure request so whoever decides it knows what may NOT go.
ERASURE_HOLD_NOTE = ("لا يجوز حذف القيود المحاسبية والفواتير ورواتب الشهور وسجلات التأمينات والضرائب "
                     "خلال مدة الاحتفاظ القانونية حتى لو طلب صاحب البيانات ذلك. يُنفَّذ المحو يدوياً "
                     "على البيانات غير المطلوبة قانوناً فقط بعد رأي المستشار القانوني.")


@router.get("/requests")
async def list_subject_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    _require_clearance(current_user)
    q = {"company_id": current_user["company_id"]}
    if status:
        q["status"] = status
    reqs = await db.data_subject_requests.find(q, {"_id": 0}).sort("received_date", -1).to_list(500)
    today = date.today().isoformat()
    for r in reqs:
        r["overdue"] = r.get("status") in ("received", "in_review") and (r.get("due_date") or "9999") < today
    return {"requests": reqs, "total": len(reqs), "types": REQUEST_TYPES, "disclaimer": DISCLAIMER}


@router.post("/requests")
async def create_subject_request(data: dict, current_user: dict = Depends(get_current_user)):
    """تسجيل طلب وارد من صاحب بيانات (موظف/عميل) — تسجيل ومتابعة فقط، لا ينفِّذ أي حذف"""
    _require_clearance(current_user)
    company_id = current_user["company_id"]
    rtype = data.get("request_type")
    if rtype not in REQUEST_TYPES:
        raise HTTPException(400, "نوع الطلب غير صحيح")
    subject_name = str(data.get("subject_name") or "").strip()[:200]
    if not subject_name:
        raise HTTPException(400, "اسم صاحب البيانات مطلوب")
    received = str(data.get("received_date") or date.today().isoformat())[:10]
    try:
        rd = date.fromisoformat(received)
    except ValueError:
        raise HTTPException(400, "تاريخ الاستلام غير صحيح")
    employee_id = data.get("employee_id") or None
    if employee_id and not await db.employees.find_one(
            {"id": employee_id, "company_id": company_id}, {"_id": 1}):
        raise HTTPException(404, "الموظف غير موجود")
    try:
        response_days = max(1, min(int(data.get("response_days") or 30), 180))
    except (TypeError, ValueError):
        response_days = 30
    # whitelisted fields only — the body is never spread into the document
    doc = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "request_type": rtype, "request_type_label": REQUEST_TYPES[rtype],
        "subject_name": subject_name,
        "subject_type": data.get("subject_type") if data.get("subject_type") in ("employee", "customer", "supplier", "other") else "other",
        "employee_id": employee_id,
        "channel": str(data.get("channel") or "")[:100],
        "details": str(data.get("details") or "")[:2000],
        "received_date": received,
        # response period is the company's own setting — confirm with the lawyer
        "due_date": (rd + timedelta(days=response_days)).isoformat(),
        "status": "received", "decision": None, "decision_note": None,
        "legal_hold_note": ERASURE_HOLD_NOTE if rtype == "erasure" else None,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.data_subject_requests.insert_one(dict(doc))
    await _log(company_id, current_user["user_id"], "request_registered", employee_id, request_id=doc["id"])
    return {"message": "✅ تم تسجيل الطلب", "request": doc}


@router.patch("/requests/{request_id}")
async def update_subject_request(request_id: str, data: dict,
                                 current_user: dict = Depends(get_current_user)):
    _require_clearance(current_user)
    company_id = current_user["company_id"]
    req = await db.data_subject_requests.find_one({"id": request_id, "company_id": company_id}, {"_id": 0})
    if not req:
        raise HTTPException(404, "الطلب غير موجود")
    status = data.get("status")
    if status not in REQUEST_STATUSES:
        raise HTTPException(400, "الحالة غير صحيحة")
    note = str(data.get("decision_note") or "").strip()[:2000]
    if status in ("completed", "rejected"):
        if not note:
            raise HTTPException(400, "اكتب ما تم في الطلب أو سبب الرفض")
        # closing an erasure request is the top management's call
        if req["request_type"] == "erasure":
            _require_top(current_user, "البت في طلبات المحو")
    upd = {"status": status, "decision_note": note or req.get("decision_note"),
           "updated_by": current_user["user_id"], "updated_at": datetime.now(timezone.utc).isoformat()}
    if status in ("completed", "rejected"):
        upd["closed_at"] = upd["updated_at"]
    await db.data_subject_requests.update_one({"id": request_id, "company_id": company_id}, {"$set": upd})
    await _log(company_id, current_user["user_id"], f"request_{status}", req.get("employee_id"), request_id=request_id)
    return {"message": "✅ تم تحديث الطلب", "request": {**req, **upd}}


@router.get("/subject-data/{employee_id}")
async def get_subject_data(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """تقرير ما يحفظه النظام عن موظف — للرد على طلب اطلاع"""
    company_id = current_user["company_id"]
    _require_clearance(current_user)

    emp = await db.employees.find_one(
        {"id": employee_id, "company_id": company_id}, {"_id": 0})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    for field in PII_FIELDS["employees"]:
        if emp.get(field):
            emp[field] = ENCRYPTION.decrypt(emp[field])

    payroll_count  = await db.payroll_runs.count_documents(
        {"company_id": company_id, "$or": [{"employees.employee_id": employee_id},
                                           {"employees_data.employee_id": employee_id}]})
    attendance_count = (await db.attendance_records.count_documents(
        {"company_id": company_id, "employee_id": employee_id})
        + await db.attendance.count_documents({"company_id": company_id, "employee_id": employee_id}))
    appraisal_count  = await db.employee_appraisals.count_documents(
        {"company_id": company_id, "employee_id": employee_id})
    await _log(company_id, current_user["user_id"], "access_report", employee_id)
    await log_pii_view(current_user, "employee", employee_id, ["national_id", "iban", "mobile", "address"],
                       "تقرير البيانات الشخصية لصاحب البيانات")

    return {
        "title":       "تقرير البيانات الشخصية المحفوظة",
        "employee_id": employee_id,
        "personal_data": {
            "name":         emp.get("name", ""),
            "national_id":  emp.get("national_id", ""),
            "mobile":       emp.get("mobile") or emp.get("phone") or emp.get("mobile_number", ""),
            "email":        emp.get("email", ""),
            "address":      emp.get("address") or emp.get("home_address", ""),
            "bank_iban":    emp.get("iban") or emp.get("bank_account_iban", ""),
            "hire_date":    emp.get("hire_date", ""),
            "department":   emp.get("department", ""),
            "job_title":    emp.get("job_title") or emp.get("position", ""),
        },
        "data_holdings": {
            "payroll_records":    payroll_count,
            "attendance_records": attendance_count,
            "appraisals":         appraisal_count,
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note":         "تقرير سري — يُسلَّم لصاحب البيانات أو الجهة المخوَّلة فقط",
        "disclaimer":   DISCLAIMER,
    }


@router.post("/subject-data/{employee_id}/rectify")
async def rectify_subject_data(
    employee_id: str, data: dict,
    current_user: dict = Depends(get_current_user)
):
    """تصحيح بيانات اتصال الموظف بناءً على طلبه"""
    company_id = current_user["company_id"]
    _require_clearance(current_user)

    allowed_fields = {"mobile", "phone", "address", "email", "emergency_contact", "emergency_phone"}
    update_data    = {k: str(v)[:300] for k, v in data.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(400, "الحقول المسموح تصحيحها: الموبايل، التليفون، العنوان، البريد، جهة الطوارئ")

    emp = await db.employees.find_one({"id": employee_id, "company_id": company_id},
                                      {"_id": 0, "id": 1, "pii_encrypted": 1})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    if emp.get("pii_encrypted"):
        for field in PII_FIELDS["employees"]:
            if field in update_data:
                update_data[field] = ENCRYPTION.encrypt(update_data[field])

    fields = list(update_data.keys())
    update_data["last_rectified_at"] = datetime.now(timezone.utc).isoformat()
    update_data["last_rectified_by"] = current_user["user_id"]
    await db.employees.update_one({"id": employee_id, "company_id": company_id}, {"$set": update_data})
    await _log(company_id, current_user["user_id"], "rectification", employee_id, fields=fields)
    return {"message": "✅ تم تصحيح بيانات الموظف", "fields_updated": fields}


# ══════════════════════════════════════════════════════════════
# 4. STATUS REPORT — حالة أدوات حماية البيانات (ليس تقرير امتثال)
# ══════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════
# ENCRYPTION AT REST — what is and is NOT encrypted (stated plainly)
# ══════════════════════════════════════════════════════════════
# Field encryption of employee PII stays OFF: payroll bank files, social
# insurance forms, the e-invoice validator, ghost-employee checks and import
# de-duplication read national ID / IBAN / mobile as plain text and would
# break. The application itself therefore stores these in readable form.
# Whether the DISK / database files are encrypted is a server setting the
# application cannot see — it is reported as "unknown", not as done.
ENCRYPTION_INVENTORY = [
    {"item": "كلمات مرور المستخدمين", "state": "hashed",
     "detail": "تُحفظ بصمة bcrypt وليس كلمة المرور — لا يمكن استرجاعها"},
    {"item": "رموز التحقق الثنائي (2FA)", "state": "hashed",
     "detail": "تُحفظ بصمة SHA-256 للرمز فقط"},
    {"item": "شهادة الختم الإلكتروني للفاتورة الإلكترونية وكلمة مرورها", "state": "encrypted",
     "detail": "مشفّرة بـ Fernet بمفتاح ETA_SECRET_KEY (أو مفتاح مشتق من JWT_SECRET_KEY إن لم يُضبط)"},
    {"item": "الرقم القومي، IBAN ورقم الحساب البنكي، الموبايل والعنوان للموظفين", "state": "not_encrypted",
     "detail": "نص صريح في قاعدة البيانات — تشفير الحقول معطَّل لأن الرواتب والتأمينات والفاتورة الإلكترونية تقرؤها كنص. "
               "تُخفى على الشاشات والتصدير لغير المصرح لهم فقط (إخفاء عرض، وليس تشفيراً)."},
    {"item": "الرواتب والبدلات والخصومات", "state": "not_encrypted",
     "detail": "أرقام صريحة في قاعدة البيانات؛ تُخفى عن الأدوار غير المخوَّلة بالرواتب في القوائم والتصدير"},
    {"item": "بيانات العملاء والموردين والفواتير والقيود", "state": "not_encrypted",
     "detail": "نص صريح في قاعدة البيانات"},
    {"item": "سجل التدقيق", "state": "not_encrypted",
     "detail": "غير مشفَّر، لكنه مربوط ببصمات SHA-256 لاكتشاف التعديل والحذف (ليس منعاً لهما)"},
    {"item": "الملفات المرفوعة (صور ومستندات الموظفين)", "state": "not_encrypted",
     "detail": "تُحفظ كما هي على قرص الخادم؛ تُقدَّم لمستخدمي الشركة المصرح لهم فقط"},
    {"item": "تشفير القرص / ملفات قاعدة البيانات على الخادم", "state": "unknown",
     "detail": "إعداد في الخادم لا يستطيع البرنامج التحقق منه — يُؤكَّد مع مسؤول الخادم"},
    {"item": "الاتصال بين المتصفح والخادم", "state": "in_transit",
     "detail": "HTTPS عبر nginx (تشفير أثناء النقل، وليس أثناء التخزين)"},
]


def encryption_status() -> dict:
    field_enc = os.environ.get("PII_FIELD_ENCRYPTION", "").lower() == "enabled"
    inv = [dict(i) for i in ENCRYPTION_INVENTORY]
    if field_enc and ENCRYPTION.available():
        inv[3] = {**inv[3], "state": "partial",
                  "detail": "تشفير الحقول مفعَّل يدوياً على هذا الخادم للموظفين الذين شُغِّل لهم — راجع أعداد الموظفين المشفَّرين"}
    return {
        "field_encryption_enabled": field_enc,
        "field_encryption_key_configured": ENCRYPTION.available(),
        "items": inv,
        "summary": "البيانات الشخصية للموظفين غير مشفَّرة داخل قاعدة البيانات؛ تُخفى على الشاشات حسب الدور فقط."
                   if not field_enc else "تشفير الحقول مفعَّل جزئياً — انظر التفاصيل.",
    }


@router.get("/encryption-status")
async def get_encryption_status(current_user: dict = Depends(get_current_user)):
    """ما هو مشفَّر وما ليس مشفَّراً — بيان صريح، ليس شهادة."""
    total = await db.employees.count_documents({"company_id": current_user["company_id"]})
    enc = await db.employees.count_documents({"company_id": current_user["company_id"], "pii_encrypted": True})
    return {**encryption_status(), "employees": {"total": total, "field_encrypted": enc}, "disclaimer": DISCLAIMER}


@router.get("/compliance-report")
async def compliance_report(current_user: dict = Depends(get_current_user)):
    """حالة أدوات حماية البيانات — لا يُصدر حكماً بالامتثال (انظر DISCLAIMER)"""
    company_id = current_user["company_id"]
    total_emps     = await db.employees.count_documents({"company_id": company_id})
    encrypted_emps = await db.employees.count_documents({"company_id": company_id, "pii_encrypted": True})
    audit_count    = await db.audit_trail.count_documents({"company_id": company_id})
    dp_actions     = await db.data_protection_log.count_documents({"company_id": company_id})
    open_reqs      = await db.data_subject_requests.count_documents(
        {"company_id": company_id, "status": {"$in": ["received", "in_review"]}})
    overdue        = await db.data_subject_requests.count_documents(
        {"company_id": company_id, "status": {"$in": ["received", "in_review"]},
         "due_date": {"$lt": date.today().isoformat()}})

    # The old report computed a score, said "✅ ممتثل" at 80%, and cited
    # article numbers of Law 151/2020 that were never checked. A software
    # checklist cannot establish legal compliance; it only lists which tools
    # are in use.
    checks = [
        {"check": "إخفاء البيانات الحساسة حسب الدور",
         "status": "مفعَّل في قائمة الموظفين وتفاصيل الموظف وتصدير الرواتب وكشف المرتبات (إخفاء عرض فقط)", "passed": True},
        {"check": "تسجيل الاطلاع على البيانات الكاملة", "status": "يُسجَّل pii_viewed في سجل التدقيق", "passed": True},
        {"check": "سجل التدقيق", "status": f"{audit_count:,} حدث" if audit_count else "لا توجد أحداث", "passed": audit_count > 0},
        {"check": "سجل طلبات أصحاب البيانات", "status": f"{open_reqs} طلب مفتوح" + (f" — {overdue} متأخر" if overdue else ""), "passed": overdue == 0},
        {"check": "تقرير الاطلاع وتصحيح البيانات", "status": "متاح", "passed": True},
        {"check": "تشفير الحقول داخل قاعدة البيانات",
         "status": f"{encrypted_emps} من {total_emps} موظف" if os.environ.get("PII_FIELD_ENCRYPTION", "").lower() == "enabled"
                   else "غير مفعَّل — الرقم القومي والحساب البنكي والرواتب نص صريح في قاعدة البيانات", "passed": False
         if os.environ.get("PII_FIELD_ENCRYPTION", "").lower() != "enabled" else None},
        {"check": "تشفير قرص الخادم", "status": "غير معروف للبرنامج — يُؤكَّد مع مسؤول الخادم", "passed": None},
    ]
    return {
        "title":    "حالة أدوات حماية البيانات",
        "as_of":    date.today().isoformat(),
        "checks":   checks,
        "open_requests": open_reqs,
        "overdue_requests": overdue,
        "data_protection_actions": dp_actions,
        "pii_encryption": {"total_employees": total_emps, "encrypted": encrypted_emps},
        "encryption": encryption_status(),
        "recommendations": [r for r in [
            f"{overdue} طلب تجاوز موعد الرد" if overdue else None,
            "راجع مدد الاحتفاظ وسياسة الخصوصية مع مستشار قانوني",
        ] if r],
        "disclaimer": DISCLAIMER,
    }
