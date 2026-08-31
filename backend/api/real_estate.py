"""
Real Estate Development Engine — محرك التطوير العقاري
المعيار المحاسبي المصري رقم 48 (الإيراد من العقود مع العملاء)
IFRS 15 المصري — الاعتراف بالإيراد عند نقل السيطرة للمشتري

الدورة المحاسبية الكاملة:
1. شراء وتطوير أراضي المشروع  → مشروعات تحت التنفيذ
2. حجز الوحدات وتحصيل المقدم → التزام للعميل (دفعات مقدمة)
3. إصدار شيكات الأقساط        → أوراق قبض / أقساط مؤجلة
4. الاعتراف بالإيراد          → عند التسليم الفعلي (م.48)
5. تكلفة الوحدة المباعة       → COGS عقاري
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from api.users import get_current_user
from models.accounting import JournalEntry
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/real-estate", tags=["Real Estate"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "re_wip":           "1611",  # مشروعات عقارية تحت التنفيذ
    "booking_liability":"1471",  # عملاء حجز وتعاقد — دفعات مقدمة
    "installments_ar":  "1472",  # عملاء أقساط مؤجلة
    "checks_collection":"1473",  # شيكات تحت التحصيل — أقساط عقارية
    "re_revenue":       "4111",  # إيرادات بيع وحدات عقارية
    "re_cogs":          "3211",  # تكلفة الوحدات العقارية المباعة
    "re_tax":           "2541",  # ضريبة التصرفات العقارية
    "bank":             "112",
    "ap":               "251",   # موردون / مقاولو باطن
    "ar":               "131",   # عملاء عاديون
    "notes_receivable": "132",   # أوراق قبض
}

RE_TAX_RATE = 0.025  # 2.5% ضريبة التصرفات العقارية (قانون 91/2005 م.42)


async def get_acc(company_id: str, code: str) -> dict:
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id":      str(uuid.uuid4()), "entry_id": None,
        "account_id":   acc["id"],
        "account_code": acc["account_code"],
        "account_name": acc.get("account_name", f"حساب {code}"),
        "debit": round(debit, 2), "credit": round(credit, 2),
        "description": desc,
    }


async def post_je(company_id: str, user_id: str, date_str: str,
                  description: str, lines: list, src_id: str = None) -> str:
    svc = AccountingService(db)
    entry = JournalEntry(
        company_id=company_id, entry_number=0, entry_date=date_str,
        description=description, lines=lines,
        source_document_type="manual", source_document_id=src_id,
        created_by=user_id,
    )
    result = await svc.create_journal_entry(entry)
    await svc.post_journal_entry(result["id"], user_id)
    return result["id"]


def validate_balance(lines: list) -> bool:
    td = round(sum(l["debit"] for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    return abs(td - tc) < 0.01, td, tc


# ══════════════════════════════════════════════════════════════
# PROJECT MANAGEMENT
# ══════════════════════════════════════════════════════════════

@router.post("/projects")
async def create_re_project(data: dict,
                             current_user: dict = Depends(get_current_user)):
    """
    إنشاء مشروع تطوير عقاري

    القيد — شراء وتطوير الأرض:
    Dr م/1611 مشروعات عقارية تحت التنفيذ
    Cr م/251 الموردون / مقاولو الباطن / م/112 البنك
    """
    company_id = current_user["company_id"]
    project_id = str(uuid.uuid4())

    # Initial land/development cost entry
    total_cost   = float(data.get("initial_cost", 0))
    payment_method = data.get("payment_method", "credit")  # credit | bank
    date_str     = data.get("date", date.today().isoformat())

    je_id = None
    if total_cost > 0:
        pay_acc  = ACC["bank"] if payment_method == "bank" else ACC["ap"]
        pay_name = "البنك" if payment_method == "bank" else "الموردون / مقاولو الباطن"
        lines = await asyncio.gather(
            je_line(company_id, ACC["re_wip"], debit=total_cost,
                    desc=f"تكاليف مشروع عقاري — {data.get('name','')}"),
            je_line(company_id, pay_acc, credit=total_cost,
                    desc=f"{'سداد' if payment_method=='bank' else 'مستحق'} {pay_name}"),
        )
        ok, td, tc = validate_balance(list(lines))
        je_id = await post_je(company_id, current_user["user_id"], date_str,
            f"إنشاء مشروع عقاري — {data.get('name','')}", list(lines), project_id)

    project = {
        "id": project_id, "company_id": company_id,
        "name":         data.get("name", ""),
        "location":     data.get("location", ""),
        "project_type": data.get("project_type", "residential"),
        "total_units":  int(data.get("total_units", 0)),
        "total_area_sqm": float(data.get("total_area_sqm", 0)),
        "total_development_cost": total_cost,
        "accumulated_cost": total_cost,
        "status": "under_development",
        "start_date": date_str,
        "expected_delivery": data.get("expected_delivery", ""),
        "initial_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.re_projects.insert_one(project); project.pop("_id", None)

    return {
        "message": f"تم إنشاء المشروع العقاري {data.get('name','')}",
        "project": project,
        "journal": {"id": je_id,
                    "debit":  f"م/{ACC['re_wip']} مشروعات عقارية تحت التنفيذ {total_cost:,.2f}",
                    "credit": f"م/{ACC['ap']} الموردون {total_cost:,.2f}"},
    }


@router.post("/projects/{project_id}/add-cost")
async def add_development_cost(project_id: str, data: dict,
                                current_user: dict = Depends(get_current_user)):
    """
    إضافة تكاليف تطوير لمشروع قائم (خرسانة / تشطيب / بنية تحتية)

    Dr م/1611 مشروعات عقارية تحت التنفيذ
    Cr م/251 مقاولو الباطن / م/112 البنك
    """
    company_id = current_user["company_id"]
    project = await db.re_projects.find_one(
        {"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "المشروع غير موجود")

    amount     = float(data.get("amount", 0))
    cost_type  = data.get("cost_type", "construction")  # land|construction|finishing|infra
    pay_method = data.get("payment_method", "credit")
    date_str   = data.get("date", date.today().isoformat())
    desc       = data.get("description", cost_type)

    pay_acc  = ACC["bank"] if pay_method == "bank" else ACC["ap"]
    pay_name = "البنك" if pay_method == "bank" else "مقاول الباطن / مورد"

    lines = await asyncio.gather(
        je_line(company_id, ACC["re_wip"], debit=amount,
                desc=f"تكلفة {desc} — {project['name']}"),
        je_line(company_id, pay_acc, credit=amount,
                desc=f"{pay_name} — {desc}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"تكاليف تطوير — {project['name']} — {desc}", list(lines), project_id)

    new_cost = round(float(project.get("accumulated_cost", 0)) + amount, 2)
    await db.re_projects.update_one(
        {"id": project_id},
        {"$set": {"accumulated_cost": new_cost},
         "$push": {"cost_entries": {"type": cost_type, "amount": amount,
                                    "date": date_str, "je_id": je_id}}}
    )
    return {
        "message":          f"تم تسجيل تكلفة {desc} — {amount:,.2f} ج.م",
        "accumulated_cost": new_cost,
        "journal_entry_id": je_id,
    }


# ══════════════════════════════════════════════════════════════
# UNIT MANAGEMENT
# ══════════════════════════════════════════════════════════════

@router.post("/projects/{project_id}/units")
async def create_unit(project_id: str, data: dict,
                       current_user: dict = Depends(get_current_user)):
    """تسجيل وحدة عقارية في المشروع"""
    company_id = current_user["company_id"]
    project = await db.re_projects.find_one(
        {"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "المشروع غير موجود")

    unit = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "project_id": project_id, "project_name": project["name"],
        "unit_number":  data.get("unit_number", ""),
        "unit_type":    data.get("unit_type", "apartment"),
        "floor":        data.get("floor", 0),
        "area_sqm":     float(data.get("area_sqm", 0)),
        "sale_price":   float(data.get("sale_price", 0)),
        "status":       "available",  # available|reserved|contracted|delivered
        "cost_allocated": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.re_units.insert_one(unit); unit.pop("_id", None)
    return {"message": f"تم تسجيل الوحدة {unit['unit_number']}", "unit": unit}


# ══════════════════════════════════════════════════════════════
# 2. BOOKING & DEPOSIT — الحجز والدفعة المقدمة
# ══════════════════════════════════════════════════════════════

class BookingRequest(BaseModel):
    unit_id:        str
    customer_id:    str
    customer_name:  str
    customer_tax_id: Optional[str] = None
    booking_date:   str
    deposit_amount: float          # الدفعة المقدمة (العربون)
    contract_price: float          # سعر العقد الإجمالي
    payment_method: str = "bank"   # bank | cash | cheque


@router.post("/bookings")
async def book_unit(req: BookingRequest,
                    current_user: dict = Depends(get_current_user)):
    """
    حجز وحدة عقارية وتحصيل المقدم

    القيد:
    Dr م/112 البنك (أو خزينة)
    Cr م/1471 عملاء حجز وتعاقد — دفعات مقدمة

    ← الإيراد لا يُثبَّت بعد (م.48: حتى نقل السيطرة)
    """
    company_id = current_user["company_id"]

    unit = await db.re_units.find_one(
        {"id": req.unit_id, "company_id": company_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "الوحدة غير موجودة")
    if unit["status"] not in ("available",):
        raise HTTPException(400, f"الوحدة في حالة '{unit['status']}' — غير متاحة للحجز")

    pay_acc  = ACC["bank"] if req.payment_method != "cash" else "161"
    pay_name = "البنك" if req.payment_method != "cash" else "الخزينة"
    booking_id = str(uuid.uuid4())

    lines = await asyncio.gather(
        je_line(company_id, pay_acc, debit=req.deposit_amount,
                desc=f"دفعة حجز وحدة {unit['unit_number']} — {req.customer_name}"),
        je_line(company_id, ACC["booking_liability"], credit=req.deposit_amount,
                desc=f"حجز {req.customer_name} — وحدة {unit['unit_number']} (التزام حتى التسليم)"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.booking_date,
        f"حجز وحدة {unit['unit_number']} — {req.customer_name}", list(lines), booking_id)

    # Update unit status
    await db.re_units.update_one(
        {"id": req.unit_id},
        {"$set": {"status": "reserved", "customer_id": req.customer_id,
                  "customer_name": req.customer_name, "contract_price": req.contract_price,
                  "deposit_paid": req.deposit_amount}}
    )

    # Save booking record
    booking = {
        "id": booking_id, "company_id": company_id,
        "unit_id": req.unit_id, "unit_number": unit["unit_number"],
        "project_id": unit["project_id"], "project_name": unit["project_name"],
        "customer_id": req.customer_id, "customer_name": req.customer_name,
        "customer_tax_id": req.customer_tax_id,
        "booking_date": req.booking_date,
        "contract_price": req.contract_price,
        "deposit_amount": req.deposit_amount,
        "paid_so_far": req.deposit_amount,
        "status": "booked",
        "installments": [],
        "booking_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.re_bookings.insert_one(booking); booking.pop("_id", None)

    return {
        "message":   f"تم حجز الوحدة {unit['unit_number']} لـ {req.customer_name}",
        "booking":   booking,
        "journal": {
            "id":     je_id,
            "debit":  f"م/{pay_acc} {pay_name}  {req.deposit_amount:,.2f}",
            "credit": f"م/{ACC['booking_liability']} عملاء حجز وتعاقد  {req.deposit_amount:,.2f}",
            "note":   "الإيراد معلق حتى التسليم الفعلي (م.48 معيار الإيراد)",
        }
    }


# ══════════════════════════════════════════════════════════════
# 3. INSTALLMENT CHEQUES — شيكات الأقساط
# ══════════════════════════════════════════════════════════════

class InstallmentChequeRequest(BaseModel):
    booking_id:      str
    cheques: List[dict]  # [{cheque_number, amount, due_date}]
    receive_date:    str


@router.post("/installments/receive-cheques")
async def receive_installment_cheques(req: InstallmentChequeRequest,
                                      current_user: dict = Depends(get_current_user)):
    """
    استلام شيكات الأقساط من العميل

    القيد:
    Dr م/1473 شيكات تحت التحصيل — أقساط عقارية
    Cr م/1472 عملاء أقساط مؤجلة

    ← الشيكات آجلة — لا تذهب للبنك مباشرة
    """
    company_id = current_user["company_id"]
    booking = await db.re_bookings.find_one(
        {"id": req.booking_id, "company_id": company_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "الحجز غير موجود")

    total_cheques = sum(float(c["amount"]) for c in req.cheques)
    lines = await asyncio.gather(
        je_line(company_id, ACC["checks_collection"], debit=total_cheques,
                desc=f"شيكات أقساط — {booking['customer_name']} — وحدة {booking['unit_number']}"),
        je_line(company_id, ACC["installments_ar"], credit=total_cheques,
                desc=f"أقساط مؤجلة — {booking['customer_name']}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], req.receive_date,
        f"استلام شيكات أقساط — {booking['customer_name']}", list(lines), req.booking_id)

    # Save cheques
    cheque_records = []
    for chq in req.cheques:
        cheque_records.append({
            "id": str(uuid.uuid4()), "company_id": company_id,
            "booking_id": req.booking_id,
            "customer_name": booking["customer_name"],
            "unit_number": booking["unit_number"],
            "cheque_number": chq["cheque_number"],
            "amount": float(chq["amount"]),
            "due_date": chq["due_date"],
            "receive_date": req.receive_date,
            "status": "pending",  # pending|collected|bounced
        })

    if cheque_records:
        await db.re_installment_cheques.insert_many(cheque_records)

    # Update booking
    await db.re_bookings.update_one(
        {"id": req.booking_id},
        {"$push": {"installments": {"$each": cheque_records}},
         "$inc": {"paid_so_far": total_cheques}}
    )

    return {
        "message":     f"تم استلام {len(req.cheques)} شيك بإجمالي {total_cheques:,.2f} ج.م",
        "cheques":     cheque_records,
        "journal":     {"id": je_id,
                        "debit":  f"م/{ACC['checks_collection']} شيكات تحت التحصيل {total_cheques:,.2f}",
                        "credit": f"م/{ACC['installments_ar']} أقساط مؤجلة {total_cheques:,.2f}"},
        "note": "شيكات آجلة — تُحوَّل للبنك عند استحقاقها عبر POST /installments/collect"
    }


@router.post("/installments/{cheque_id}/collect")
async def collect_installment_cheque(cheque_id: str, data: dict,
                                     current_user: dict = Depends(get_current_user)):
    """
    تحصيل شيك قسط في البنك

    Dr م/112 البنك
    Cr م/1473 شيكات تحت التحصيل
    """
    company_id = current_user["company_id"]
    chq = await db.re_installment_cheques.find_one(
        {"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not chq:
        raise HTTPException(404, "الشيك غير موجود")
    if chq["status"] != "pending":
        raise HTTPException(400, f"الشيك في حالة '{chq['status']}'")

    amount   = float(chq["amount"])
    date_str = data.get("date", date.today().isoformat())

    lines = await asyncio.gather(
        je_line(company_id, ACC["bank"], debit=amount,
                desc=f"تحصيل شيك قسط {chq['cheque_number']} — {chq['customer_name']}"),
        je_line(company_id, ACC["checks_collection"], credit=amount,
                desc=f"إقفال شيكات تحت التحصيل — {chq['cheque_number']}"),
    )
    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"تحصيل قسط عقاري — {chq['customer_name']}", list(lines), cheque_id)

    await db.re_installment_cheques.update_one(
        {"id": cheque_id},
        {"$set": {"status": "collected", "collection_date": date_str, "je_id": je_id}}
    )
    return {
        "message": f"✅ تم تحصيل الشيك {chq['cheque_number']} — {amount:,.2f} ج.م",
        "journal": {"id": je_id,
                    "debit":  f"م/112 البنك  {amount:,.2f}",
                    "credit": f"م/{ACC['checks_collection']} شيكات تحت التحصيل  {amount:,.2f}"},
    }


# ══════════════════════════════════════════════════════════════
# 4. REVENUE RECOGNITION — الاعتراف بالإيراد (م.48)
# ══════════════════════════════════════════════════════════════

@router.post("/bookings/{booking_id}/deliver")
async def deliver_unit(booking_id: str, data: dict,
                        current_user: dict = Depends(get_current_user)):
    """
    تسليم الوحدة للعميل — الاعتراف بالإيراد (م.48)

    القيد الإيراد:
    Dr م/1471 عملاء حجز وتعاقد (تصفية الدفعات المقدمة)
    Cr م/4111 إيرادات بيع وحدات عقارية
    Cr م/2541 ضريبة التصرفات العقارية (2.5%)

    القيد التكلفة (COGS):
    Dr م/3211 تكلفة الوحدات العقارية المباعة
    Cr م/1611 مشروعات عقارية تحت التنفيذ
    """
    company_id   = current_user["company_id"]
    booking = await db.re_bookings.find_one(
        {"id": booking_id, "company_id": company_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "الحجز غير موجود")
    if booking.get("status") == "delivered":
        raise HTTPException(400, "تم التسليم مسبقاً")

    delivery_date  = data.get("date", date.today().isoformat())
    contract_price = float(booking["contract_price"])
    deposit_paid   = float(booking.get("deposit_amount", 0))
    unit_cost      = float(data.get("unit_cost", 0))  # التكلفة الفعلية للوحدة

    # ── حساب ضريبة التصرفات العقارية ─────────────────────────
    apply_re_tax   = data.get("apply_re_tax", True)
    re_tax_amount  = round(contract_price * RE_TAX_RATE, 2) if apply_re_tax else 0
    net_revenue    = round(contract_price - re_tax_amount, 2)

    # ── القيد أ: الاعتراف بالإيراد ────────────────────────────
    rev_lines = [
        await je_line(company_id, ACC["booking_liability"], debit=deposit_paid,
                      desc=f"تصفية دفعة حجز — {booking['customer_name']} وحدة {booking['unit_number']}"),
    ]
    # الفرق بين سعر العقد والمقدم المدفوع = الجزء المتبقي من الإيرادات
    remaining_rev = round(contract_price - deposit_paid, 2)
    if remaining_rev > 0:
        rev_lines.append(await je_line(
            company_id, ACC["installments_ar"], debit=remaining_rev,
            desc=f"إيرادات متبقية — {booking['customer_name']}"))

    if apply_re_tax and re_tax_amount > 0:
        rev_lines.append(await je_line(
            company_id, ACC["re_revenue"], credit=net_revenue,
            desc=f"إيراد بيع وحدة عقارية — {booking['unit_number']}"))
        rev_lines.append(await je_line(
            company_id, ACC["re_tax"], credit=re_tax_amount,
            desc=f"ضريبة تصرفات عقارية 2.5% — {booking['unit_number']}"))
    else:
        rev_lines.append(await je_line(
            company_id, ACC["re_revenue"], credit=contract_price,
            desc=f"إيراد بيع وحدة عقارية — {booking['unit_number']}"))

    td = round(sum(l["debit"]  for l in rev_lines), 2)
    tc = round(sum(l["credit"] for l in rev_lines), 2)
    je_rev_id = await post_je(company_id, current_user["user_id"], delivery_date,
        f"اعتراف بإيراد بيع وحدة {booking['unit_number']} — {booking['customer_name']}",
        rev_lines, booking_id)

    # ── القيد ب: إثبات التكلفة (COGS) ─────────────────────────
    je_cogs_id = None
    if unit_cost > 0:
        cogs_lines = await asyncio.gather(
            je_line(company_id, ACC["re_cogs"], debit=unit_cost,
                    desc=f"تكلفة وحدة {booking['unit_number']} المباعة"),
            je_line(company_id, ACC["re_wip"], credit=unit_cost,
                    desc=f"إقفال تكلفة وحدة {booking['unit_number']} من WIP"),
        )
        je_cogs_id = await post_je(company_id, current_user["user_id"], delivery_date,
            f"تكلفة وحدة عقارية مباعة — {booking['unit_number']}", list(cogs_lines), booking_id)

    # Update booking & unit
    await db.re_bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "delivered", "delivery_date": delivery_date,
                  "revenue_je_id": je_rev_id, "cogs_je_id": je_cogs_id}}
    )
    await db.re_units.update_one(
        {"id": booking.get("unit_id", "")},
        {"$set": {"status": "delivered", "delivery_date": delivery_date}}
    )

    gross_margin = round(contract_price - unit_cost, 2) if unit_cost > 0 else None

    return {
        "message":     f"✅ تم تسليم الوحدة {booking['unit_number']} لـ {booking['customer_name']}",
        "delivery_date": delivery_date,
        "financials": {
            "contract_price":  contract_price,
            "re_tax_amount":   re_tax_amount,
            "net_revenue":     net_revenue,
            "unit_cost":       unit_cost,
            "gross_margin":    gross_margin,
            "gross_margin_pct": round(gross_margin/contract_price*100, 1) if gross_margin and contract_price else None,
        },
        "journal_entries": {
            "revenue_recognition": je_rev_id,
            "cogs":                je_cogs_id,
        },
        "revenue_entries": [
            {"debit":  f"م/{ACC['booking_liability']} تصفية حجز    {deposit_paid:,.2f}"},
            {"credit": f"م/{ACC['re_revenue']} إيراد بيع        {net_revenue:,.2f}"},
            {"credit": f"م/{ACC['re_tax']} ضريبة تصرفات عقارية {re_tax_amount:,.2f}"},
        ] if apply_re_tax else [
            {"debit":  f"م/{ACC['booking_liability']} تصفية حجز  {deposit_paid:,.2f}"},
            {"credit": f"م/{ACC['re_revenue']} إيراد بيع       {contract_price:,.2f}"},
        ],
        "cogs_entry": {
            "debit":  f"م/{ACC['re_cogs']} تكلفة وحدة   {unit_cost:,.2f}",
            "credit": f"م/{ACC['re_wip']} WIP عقاري      {unit_cost:,.2f}",
        } if unit_cost > 0 else None,
        "law": "المعيار المحاسبي المصري 48 — الإيراد يُثبَّت عند نقل السيطرة (التسليم الفعلي)",
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/projects")
async def list_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.re_projects.find(
        {"company_id": current_user["company_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    return {"projects": projects, "total": len(projects)}


@router.get("/projects/{project_id}/units")
async def list_project_units(
    project_id: str,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    q = {"project_id": project_id, "company_id": current_user["company_id"]}
    if status: q["status"] = status
    units = await db.re_units.find(q, {"_id": 0}).to_list(None)
    summary = {
        "total": len(units),
        "available":  sum(1 for u in units if u["status"]=="available"),
        "reserved":   sum(1 for u in units if u["status"]=="reserved"),
        "contracted": sum(1 for u in units if u["status"]=="contracted"),
        "delivered":  sum(1 for u in units if u["status"]=="delivered"),
        "total_contracted_value": round(sum(
            float(u.get("contract_price",0)) for u in units
            if u["status"] in ("reserved","contracted","delivered")), 2),
    }
    return {"units": units, "summary": summary}


@router.get("/bookings")
async def list_bookings(
    status: Optional[str] = None,
    page: int = 1, limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    total    = await db.re_bookings.count_documents(q)
    bookings = await db.re_bookings.find(q, {"_id": 0}).sort(
        "booking_date", -1).skip((page-1)*limit).limit(limit).to_list(None)
    return {"bookings": bookings, "total": total}


@router.get("/reports/revenue-recognition")
async def revenue_recognition_report(
    year: int = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """تقرير الاعتراف بالإيراد حسب التسليمات الفعلية"""
    company_id = current_user["company_id"]
    q = {"company_id": company_id, "status": "delivered"}
    if year:
        q["delivery_date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}

    bookings = await db.re_bookings.find(q, {"_id": 0}).to_list(None)
    total_rev  = sum(float(b.get("contract_price",0)) for b in bookings)
    total_tax  = sum(float(b.get("contract_price",0)) * RE_TAX_RATE for b in bookings)

    return {
        "period": str(year) if year else "الكل",
        "units_delivered":  len(bookings),
        "total_revenue":    round(total_rev, 2),
        "total_re_tax":     round(total_tax, 2),
        "net_revenue":      round(total_rev - total_tax, 2),
        "bookings":         bookings,
        "law": "م.48 — الإيراد يُثبَّت عند التسليم الفعلي فقط",
    }
