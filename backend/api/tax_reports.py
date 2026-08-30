"""
Tax Reports Engine — محرك التقارير الضريبية المصرية
بضغطة زر — جاهز للرفع على بوابة مصلحة الضرائب

1. نموذج 41  — خصم وتحصيل (ربع سنوي)
2. نموذج 10  — ضريبة القيمة المضافة (شهري)
3. نموذج 4   — كسب عمل (ربع سنوي)
4. الإيصال الإلكتروني B2C — نقاط البيع
"""
import uuid
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/tax-reports", tags=["Tax Reports"])


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

def quarter_dates(year: int, quarter: int):
    """Returns (start_date, end_date) for a quarter"""
    starts = {1: "01-01", 2: "04-01", 3: "07-01", 4: "10-01"}
    ends   = {1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31"}
    return f"{year}-{starts[quarter]}", f"{year}-{ends[quarter]}"


async def aggregate_je_lines(company_id: str, account_code: str,
                             date_from: str, date_to: str,
                             side: str = "credit") -> float:
    """Sum debit or credit for a specific account code in a date range"""
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "status": "posted",
            "entry_date": {"$gte": date_from, "$lte": date_to},
        }},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": account_code}},
        {"$group": {"_id": None,
                    "total": {"$sum": f"$lines.{side}"}}}
    ]
    result = await db.journal_entries.aggregate(pipeline).to_list(1)
    return round(result[0]["total"] if result else 0, 2)


async def get_company(company_id: str) -> dict:
    return await db.companies.find_one({"id": company_id}, {"_id": 0}) or {}


# ══════════════════════════════════════════════════════════════
# 1. نموذج 41 — خصم وتحصيل (ربع سنوي)
#    Withholding Tax Form 41
# ══════════════════════════════════════════════════════════════

@router.get("/form-41")
async def generate_form_41(
    year:    int = Query(..., description="السنة"),
    quarter: int = Query(..., ge=1, le=4, description="الربع 1-4"),
    current_user: dict = Depends(get_current_user)
):
    """
    نموذج 41 — كشف ربع سنوي بمبالغ الخصم والتحصيل
    1%  توريدات بضائع | 3% خدمات | 5% مهن حرة

    يُجمِّع من قيود الشراء التي تحمل م/261 (خصم وتحصيل مستحق)
    """
    company_id = current_user["company_id"]
    company    = await get_company(company_id)
    date_from, date_to = quarter_dates(year, quarter)

    # ── جمع بيانات خصم وتحصيل من قيود الشراء ────────────────
    # نبحث في journal_entries عن قيود تحمل م/261 (دائن) في الفترة
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "status": "posted",
            "source_document_type": "invoice",
            "entry_date": {"$gte": date_from, "$lte": date_to},
        }},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": "261", "lines.credit": {"$gt": 0}}},
        {"$group": {
            "_id": "$source_document_id",
            "wht_amount":  {"$sum": "$lines.credit"},
            "entry_date":  {"$first": "$entry_date"},
            "description": {"$first": "$description"},
        }}
    ]
    wht_entries = await db.journal_entries.aggregate(pipeline).to_list(None)

    # ── إضافة بيانات المورد من الفاتورة ──────────────────────
    entries_detail = []
    total_1pct = total_3pct = total_5pct = 0.0

    for entry in wht_entries:
        invoice_id = entry["_id"]
        invoice    = await db.invoices.find_one({"id": invoice_id}, {"_id": 0}) or {}
        party_id   = invoice.get("party_id")
        party      = await db.invoice_parties.find_one({"id": party_id}, {"_id": 0}) or {}
        inv_type   = invoice.get("invoice_type", "goods")
        wht_amount = round(entry["wht_amount"], 2)

        # تصنيف النسبة
        if inv_type in {"engineering", "consulting", "legal", "accounting", "medical_professional"}:
            rate_pct = 5.0; rate_label = "5% مهن حرة"
            total_5pct += wht_amount
        elif inv_type == "services":
            rate_pct = 3.0; rate_label = "3% خدمات"
            total_3pct += wht_amount
        else:
            rate_pct = 1.0; rate_label = "1% توريدات"
            total_1pct += wht_amount

        entries_detail.append({
            "invoice_id":       invoice_id,
            "invoice_number":   invoice.get("document_number", ""),
            "invoice_date":     entry["entry_date"],
            "supplier_name":    party.get("name", invoice.get("party_name", "")),
            "supplier_tax_id":  party.get("tax_id", ""),
            "supplier_address": party.get("address", ""),
            "gross_amount":     float(invoice.get("total_after_discount", 0)),
            "wht_rate_pct":     rate_pct,
            "wht_rate_label":   rate_label,
            "wht_amount":       wht_amount,
            "invoice_type":     inv_type,
        })

    total_wht = round(total_1pct + total_3pct + total_5pct, 2)

    return {
        "form":         "نموذج 41 — خصم وتحصيل",
        "law":          "قانون الضريبة على الدخل 91/2005 المادة 59",
        "period":       f"الربع {quarter} — {year}",
        "date_from":    date_from,
        "date_to":      date_to,
        "due_date":     f"خلال 30 يوماً من نهاية الربع ({date_to})",
        "company": {
            "name":           company.get("name", ""),
            "tax_id":         company.get("tax_id", ""),
            "commercial_reg": company.get("commercial_register", ""),
            "address":        company.get("address", ""),
        },
        "entries": entries_detail,
        "summary": {
            "total_entries":       len(entries_detail),
            "wht_1pct_supplies":   round(total_1pct, 2),
            "wht_3pct_services":   round(total_3pct, 2),
            "wht_5pct_professions":round(total_5pct, 2),
            "total_wht_due":       total_wht,
        },
        "payment_account":  "م/261 مصلحة الضرائب — خصم وتحصيل",
        "generated_at":     datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 2. نموذج 10 — ضريبة القيمة المضافة (شهري)
#    VAT Return Form 10
# ══════════════════════════════════════════════════════════════

@router.get("/form-10")
async def generate_form_10(
    year:  int = Query(..., description="السنة"),
    month: int = Query(..., ge=1, le=12, description="الشهر"),
    current_user: dict = Depends(get_current_user)
):
    """
    نموذج 10 — إقرار ضريبة القيمة المضافة الشهري
    ضريبة مخرجات (260) - ضريبة مدخلات (153) = صافي المستحق

    يُستخرج من قيود دفتر الأستاذ مباشرة
    """
    company_id = current_user["company_id"]
    company    = await get_company(company_id)
    date_from  = f"{year}-{month:02d}-01"
    # Last day of month
    if month == 12:
        date_to = f"{year}-12-31"
    else:
        date_to = f"{year}-{month:02d}-{(date(year, month+1, 1) - __import__('datetime').timedelta(days=1)).day:02d}"

    # ── ضريبة المخرجات (المبيعات) — م/260 دائن ───────────────
    vat_output = await aggregate_je_lines(company_id, "260", date_from, date_to, "credit")

    # ── ضريبة المدخلات (المشتريات) — م/153 مدين ─────────────
    vat_input  = await aggregate_je_lines(company_id, "153", date_from, date_to, "debit")

    # ── ضريبة الجدول (خدمات وسلع جدولية) ────────────────────
    # يمكن إضافة حساب منفصل م/260-J للجدول إذا كان موجوداً
    vat_table  = 0.0  # placeholder — يُستكمل عند إضافة م/260-J

    net_vat = round(vat_output - vat_input - vat_table, 2)

    # ── تفاصيل فواتير المبيعات في الشهر ───────────────────────
    sales_invoices = await db.invoices.find({
        "company_id": company_id,
        "document_type": "sales_invoice",
        "document_date": {"$gte": date_from, "$lte": date_to},
    }, {"_id": 0, "document_number": 1, "document_date": 1,
        "party_name": 1, "total_after_discount": 1, "total_tax": 1}).to_list(None)

    purchase_invoices = await db.invoices.find({
        "company_id": company_id,
        "document_type": "purchase_invoice",
        "document_date": {"$gte": date_from, "$lte": date_to},
    }, {"_id": 0, "document_number": 1, "document_date": 1,
        "party_name": 1, "total_after_discount": 1, "total_tax": 1}).to_list(None)

    sales_base     = round(sum(float(i.get("total_after_discount",0)) for i in sales_invoices), 2)
    purchase_base  = round(sum(float(i.get("total_after_discount",0)) for i in purchase_invoices), 2)

    return {
        "form":       "نموذج 10 — إقرار ضريبة القيمة المضافة",
        "law":        "قانون ضريبة القيمة المضافة 67/2016",
        "period":     f"{year}/{month:02d}",
        "date_from":  date_from,
        "date_to":    date_to,
        "due_date":   f"آخر أبريل / يوليو / أكتوبر / يناير — حسب الدورة الضريبية",
        "company": {
            "name":   company.get("name",""),
            "tax_id": company.get("tax_id",""),
            "vat_registration": company.get("vat_registration_number",""),
        },
        "vat_output": {
            "label":            "أولاً: ضريبة القيمة المضافة على المبيعات (المخرجات)",
            "account":          "م/260",
            "sales_base":       sales_base,
            "vat_amount":       vat_output,
            "invoice_count":    len(sales_invoices),
        },
        "vat_input": {
            "label":            "ثانياً: ضريبة القيمة المضافة على المشتريات (المدخلات)",
            "account":          "م/153",
            "purchase_base":    purchase_base,
            "vat_amount":       vat_input,
            "invoice_count":    len(purchase_invoices),
        },
        "vat_table": {
            "label":  "ثالثاً: ضريبة الجدول (الخدمات والسلع الجدولية)",
            "amount": vat_table,
        },
        "net_position": {
            "vat_output":     vat_output,
            "vat_input":      vat_input,
            "vat_table":      vat_table,
            "net_vat_due":    net_vat if net_vat > 0 else 0,
            "vat_credit":     abs(net_vat) if net_vat < 0 else 0,
            "status":         "مستحق السداد" if net_vat > 0 else ("رصيد دائن" if net_vat < 0 else "متعادل"),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 3. نموذج 4 — كسب عمل (ربع سنوي)
#    Quarterly Payroll Tax Form 4
# ══════════════════════════════════════════════════════════════

@router.get("/form-4")
async def generate_form_4(
    year:    int = Query(..., description="السنة"),
    quarter: int = Query(..., ge=1, le=4, description="الربع 1-4"),
    current_user: dict = Depends(get_current_user)
):
    """
    نموذج 4 — تسوية ربع سنوية لضريبة كسب العمل
    إجمالي المرتبات + ضريبة كسب العمل المسددة عن الموظفين
    """
    company_id = current_user["company_id"]
    company    = await get_company(company_id)
    date_from, date_to = quarter_dates(year, quarter)

    # ── جمع بيانات الرواتب من كشوف المسير ────────────────────
    payroll_runs = await db.payroll_runs.find({
        "company_id": company_id,
        "status": {"$in": ["approved", "paid"]},
        "year":  year,
        "month": {"$gte": (quarter-1)*3+1, "$lte": quarter*3},
    }, {"_id": 0}).to_list(None)

    employees_summary = []
    total_gross = total_taxable = total_tax = total_si_emp = 0.0
    months_included = set()

    for run in payroll_runs:
        month_label = f"{year}/{run.get('month',0):02d}"
        months_included.add(month_label)
        employees = run.get("employees_data", [])

        for emp in employees:
            gross     = float(emp.get("gross_salary", 0))
            taxable   = float(emp.get("annual_taxable", 0)) / 12  # monthly
            tax       = float(emp.get("income_tax", 0))
            si_emp    = float(emp.get("employee_si", 0))

            total_gross   += gross
            total_taxable += taxable
            total_tax     += tax
            total_si_emp  += si_emp

            employees_summary.append({
                "employee_id":    emp.get("employee_id",""),
                "employee_name":  emp.get("employee_name",""),
                "national_id":    emp.get("national_id",""),
                "month":          month_label,
                "gross_salary":   gross,
                "si_deduction":   si_emp,
                "taxable_income": taxable,
                "income_tax":     tax,
            })

    # Fallback: aggregate from journal entries م/261 on payroll entries
    if not employees_summary:
        payroll_tax = await aggregate_je_lines(company_id, "261", date_from, date_to, "credit")
        total_tax = payroll_tax

    # Group by employee for the form
    emp_totals = {}
    for e in employees_summary:
        eid = e["employee_id"]
        if eid not in emp_totals:
            emp_totals[eid] = {**e, "gross_salary": 0, "taxable_income": 0,
                               "income_tax": 0, "si_deduction": 0}
        emp_totals[eid]["gross_salary"]   += e["gross_salary"]
        emp_totals[eid]["taxable_income"] += e["taxable_income"]
        emp_totals[eid]["income_tax"]     += e["income_tax"]
        emp_totals[eid]["si_deduction"]   += e["si_deduction"]

    return {
        "form":       "نموذج 4 — تسوية ربع سنوية لضريبة كسب العمل",
        "law":        "قانون الضريبة على الدخل 91/2005",
        "period":     f"الربع {quarter} — {year}",
        "date_from":  date_from,
        "date_to":    date_to,
        "due_date":   "خلال 30 يوماً من نهاية الربع",
        "company": {
            "name":           company.get("name",""),
            "tax_id":         company.get("tax_id",""),
            "insurance_reg":  company.get("insurance_registration_number",""),
            "employee_count": len(emp_totals),
        },
        "months_included": sorted(months_included),
        "employees": list(emp_totals.values()),
        "quarterly_totals": {
            "total_gross_salaries": round(total_gross, 2),
            "total_si_deductions":  round(total_si_emp, 2),
            "total_taxable_income": round(total_taxable, 2),
            "total_income_tax_due": round(total_tax, 2),
        },
        "payment_account": "م/261 مصلحة الضرائب — ضريبة كسب عمل",
        "generated_at":    datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# 4. الإيصال الإلكتروني B2C — نقاط البيع (POS)
#    E-Receipt System (B2C)
# ══════════════════════════════════════════════════════════════

class EReceiptLineItem(BaseModel):
    description:    str
    quantity:       float
    unit_price:     float
    item_code:      Optional[str] = None
    item_code_type: str = "EGS"   # EGS or GS1
    unit_type:      str = "EA"    # EA=عدد
    vat_rate:       float = 0.14  # 14% VAT أو 5% جدول


class EReceiptRequest(BaseModel):
    receipt_date:    str
    pos_terminal_id: Optional[str] = None
    cashier_id:      Optional[str] = None
    payment_method:  str = "cash"  # cash | card | mobile_wallet
    lines:           List[EReceiptLineItem]
    buyer_name:      Optional[str] = None
    buyer_mobile:    Optional[str] = None
    notes:           Optional[str] = None


@router.post("/e-receipt")
async def create_e_receipt(
    req: EReceiptRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    إيصال إلكتروني للمستهلك النهائي (B2C) — نقطة البيع POS
    يُثبِّت القيد المحاسبي + يُعدّ البيانات للرفع على منظومة ETA
    """
    company_id  = current_user["company_id"]
    receipt_id  = str(uuid.uuid4())
    receipt_num = await _next_receipt_number(company_id)

    # ── حساب المبالغ ──────────────────────────────────────────
    lines_detail = []
    subtotal = vat_total = 0.0

    for line in req.lines:
        line_subtotal = round(line.quantity * line.unit_price, 2)
        line_vat      = round(line_subtotal * line.vat_rate, 2)
        lines_detail.append({
            "description":    line.description,
            "quantity":       line.quantity,
            "unit_price":     line.unit_price,
            "item_code":      line.item_code,
            "item_code_type": line.item_code_type,
            "unit_type":      line.unit_type,
            "vat_rate":       line.vat_rate,
            "subtotal":       line_subtotal,
            "vat_amount":     line_vat,
            "total":          round(line_subtotal + line_vat, 2),
        })
        subtotal  += line_subtotal
        vat_total += line_vat

    grand_total = round(subtotal + vat_total, 2)

    # ── القيد المحاسبي ─────────────────────────────────────────
    # Dr البنك/الخزينة/محفظة إلكترونية | Cr إيرادات مبيعات + VAT مخرجات
    PAYMENT_ACCOUNTS = {
        "cash":           ("161", "الخزينة"),
        "card":           ("112", "البنك — نقطة بيع"),
        "mobile_wallet":  ("113", "محافظ إلكترونية"),
    }
    pay_code, pay_name = PAYMENT_ACCOUNTS.get(req.payment_method, ("161", "الخزينة"))

    svc = AccountingService(db)
    accounts = await svc.get_all_accounts(company_id, True)
    by_code  = {a["account_code"]: a for a in accounts}

    def acc(code, name_fb):
        a = by_code.get(code, {})
        return {"line_id": str(uuid.uuid4()), "entry_id": None,
                "account_id": a.get("id", code), "account_code": code,
                "account_name": a.get("account_name", name_fb),
                "debit": 0, "credit": 0, "description": ""}

    je_lines = []
    # مدين: وسيلة الدفع
    dl = acc(pay_code, pay_name)
    dl.update({"debit": grand_total, "description": f"إيصال {receipt_num} — {req.payment_method}"})
    je_lines.append(dl)
    # دائن: إيرادات مبيعات
    rl = acc("411", "إيرادات مبيعات — نقاط البيع")
    rl.update({"credit": subtotal, "description": f"مبيعات تجزئة — إيصال {receipt_num}"})
    je_lines.append(rl)
    # دائن: VAT مخرجات
    if vat_total > 0:
        vl = acc("260", "ضريبة القيمة المضافة مخرجات")
        vl.update({"credit": vat_total, "description": f"VAT إيصال {receipt_num}"})
        je_lines.append(vl)

    entry = JournalEntry(
        company_id=company_id, entry_number=0,
        entry_date=req.receipt_date,
        description=f"إيصال إلكتروني {receipt_num} — {req.buyer_name or 'مستهلك'}",
        lines=je_lines, source_document_type="manual",
        source_document_id=receipt_id,
        created_by=current_user["user_id"],
    )
    je_result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(je_result["id"], current_user["user_id"])

    # ── بناء حمولة ETA (B2C) ──────────────────────────────────
    company = await get_company(company_id)
    eta_payload = {
        "issuer": {
            "type":    "B",
            "id":      company.get("tax_id",""),
            "name":    company.get("name",""),
            "address": {
                "branchID": "0",
                "country":  "EG",
                "governate": company.get("city",""),
                "regionCity": company.get("city",""),
                "street":    company.get("address",""),
            }
        },
        "receiver": {
            "type": "P",
            "name": req.buyer_name or "مستهلك",
            "id":   req.buyer_mobile or "",
        },
        "documentType":    "r",       # r = receipt (إيصال)
        "documentTypeVersion": "1.0",
        "dateTimeIssued":  req.receipt_date + "T00:00:00Z",
        "receiptNumber":   receipt_num,
        "uuid":            receipt_id,
        "currency":        "EGP",
        "itemData": [
            {
                "internalCode":   line.get("item_code", "EGS-001"),
                "description":    line["description"],
                "itemType":       line.get("item_code_type","EGS"),
                "quantity":       line["quantity"],
                "unitType":       line.get("unit_type","EA"),
                "unitValue": {
                    "currencySold": "EGP",
                    "amountEGP":    line["unit_price"],
                },
                "totalTaxableFees":  0,
                "itemsDiscount":     0,
                "netTotal":          line["subtotal"],
                "taxableItems": [
                    {
                        "taxType":    "T1",  # VAT
                        "amount":     line["vat_amount"],
                        "subType":    "V001",
                        "rate":       line["vat_rate"] * 100,
                    }
                ] if line["vat_amount"] > 0 else [],
                "total": line["total"],
            }
            for line in lines_detail
        ],
        "totalSalesAmount":   subtotal,
        "totalDiscountAmount": 0,
        "netAmount":           subtotal,
        "taxTotals": [{"taxType": "T1", "amount": vat_total}] if vat_total > 0 else [],
        "totalAmount":         grand_total,
        "paymentMethod":       req.payment_method,
    }

    # Save receipt
    receipt = {
        "id": receipt_id, "receipt_number": receipt_num,
        "company_id": company_id,
        "receipt_date": req.receipt_date,
        "buyer_name": req.buyer_name, "buyer_mobile": req.buyer_mobile,
        "payment_method": req.payment_method,
        "pos_terminal_id": req.pos_terminal_id,
        "cashier_id": req.cashier_id,
        "lines": lines_detail,
        "subtotal": subtotal, "vat_total": vat_total, "grand_total": grand_total,
        "journal_entry_id": je_result["id"],
        "eta_status": "pending",
        "eta_payload": eta_payload,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.e_receipts.insert_one(receipt); receipt.pop("_id", None)
    receipt.pop("eta_payload", None)  # don't return payload in response

    return {
        "message":        f"✅ تم إصدار الإيصال الإلكتروني {receipt_num}",
        "receipt_id":     receipt_id,
        "receipt_number": receipt_num,
        "amounts": {
            "subtotal":    subtotal,
            "vat":         vat_total,
            "grand_total": grand_total,
        },
        "journal_entry_id": je_result["id"],
        "eta_status":      "pending",
        "next_step":       "POST /api/tax-reports/e-receipt/{id}/submit-eta لرفعه على منظومة الإيصالات",
    }


@router.post("/e-receipt/{receipt_id}/submit-eta")
async def submit_receipt_to_eta(
    receipt_id: str,
    current_user: dict = Depends(get_current_user)
):
    """رفع الإيصال على منظومة الإيصالات الإلكترونية لمصلحة الضرائب"""
    import httpx
    company_id = current_user["company_id"]

    receipt = await db.e_receipts.find_one(
        {"id": receipt_id, "company_id": company_id}, {"_id": 0}
    )
    if not receipt:
        raise HTTPException(404, "الإيصال غير موجود")
    if receipt.get("eta_status") == "submitted":
        raise HTTPException(400, "تم رفع الإيصال مسبقاً")

    # Get ETA settings (reuse company ETA settings)
    settings = await db.company_eta_settings.find_one(
        {"company_id": company_id}, {"_id": 0}
    )
    if not settings or not settings.get("client_id"):
        raise HTTPException(400, "إعدادات ETA غير مكتملة — تحقق من GET /api/eta/settings")

    # Submit to ETA e-receipts endpoint
    env = settings.get("environment", "preproduction")
    BASE_URLS = {
        "preproduction": "https://preprod.invoicing.eta.gov.eg/api/v1",
        "production":    "https://api.invoicing.eta.gov.eg/api/v1",
    }
    base_url = BASE_URLS.get(env, BASE_URLS["preproduction"])

    try:
        # Get token (reuse ETA token logic)
        from api.eta_api import get_eta_token, get_eta_base_url
        token = await get_eta_token(company_id, settings)

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{base_url}/receipts/",
                headers={"Authorization": f"Bearer {token}",
                         "Content-Type": "application/json"},
                json={"receipts": [receipt["eta_payload"]]}
            )

        if response.status_code in (200, 202):
            resp_data = response.json()
            uuid_from_eta = resp_data.get("receiptUUID", receipt_id)
            await db.e_receipts.update_one(
                {"id": receipt_id},
                {"$set": {
                    "eta_status": "submitted",
                    "eta_uuid":   uuid_from_eta,
                    "submitted_at": datetime.now(timezone.utc).isoformat(),
                }}
            )
            return {"message": "✅ تم رفع الإيصال على منظومة الإيصالات",
                    "eta_uuid": uuid_from_eta, "status": "submitted"}
        else:
            raise HTTPException(response.status_code,
                f"خطأ ETA: {response.text[:300]}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"خطأ في الاتصال: {str(e)}")


@router.get("/e-receipt/summary")
async def get_receipt_summary(
    date_from: str = Query(...),
    date_to:   str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """ملخص الإيصالات لفترة — لدعم التسوية الضريبية"""
    company_id = current_user["company_id"]
    receipts = await db.e_receipts.find({
        "company_id": company_id,
        "receipt_date": {"$gte": date_from, "$lte": date_to},
    }, {"_id": 0, "receipt_number":1,"receipt_date":1,"grand_total":1,
        "vat_total":1,"payment_method":1,"eta_status":1}).to_list(None)

    by_status = {}
    for r in receipts:
        s = r.get("eta_status","pending")
        by_status[s] = by_status.get(s, 0) + 1

    return {
        "period": {"from": date_from, "to": date_to},
        "count":  len(receipts),
        "totals": {
            "gross_sales": round(sum(r.get("grand_total",0) for r in receipts), 2),
            "vat_collected": round(sum(r.get("vat_total",0) for r in receipts), 2),
        },
        "by_status": by_status,
        "receipts": receipts,
    }


# ══════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════

async def _next_receipt_number(company_id: str) -> str:
    counter = await db.receipt_counters.find_one_and_update(
        {"company_id": company_id},
        {"$inc": {"last": 1}},
        upsert=True, return_document=True
    )
    year = date.today().year
    return f"RCP-{year}-{counter['last']:06d}"
