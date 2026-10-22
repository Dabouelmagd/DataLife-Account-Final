"""
Real Estate Development Engine — محرك التطوير العقاري
المعيار المحاسبي المصري رقم 48 — الإيراد يُثبَّت عند نقل السيطرة (تسليم الوحدة)

الدورة:
1. تكاليف المشروع              Dr 142 مشروعات عقارية تحت التنفيذ / Cr 251 أو البنك
2. الحجز وتحصيل المقدم         Dr البنك/الخزينة / Cr 2431 التزامات العقود (لا إيراد بعد)
3. شيكات الأقساط
   قبل التسليم                 Dr 144 (باقة العقارات) أو 163 شيكات برسم التحصيل / Cr 2431
   بعد التسليم                 Dr 144/163 / Cr 1312 عملاء أقساط مؤجلة
   التحصيل                     Dr البنك / Cr 144/163
   الارتداد                    قبل التسليم: Dr 2431 / Cr 144/163 — بعده: Dr 1311 شيكات مرتدة / Cr 144/163
4. التسليم (الاعتراف بالإيراد)  Dr 2431 (ما حُصّل) + Dr 1312 (الباقي) / Cr 4111 إيرادات بيع الوحدات
5. تكلفة الوحدة المباعة         Dr 3211 / Cr 142

What was wrong (and is fixed here):
- installment cheques were credited to 1312 BEFORE 1312 was ever debited (it
  was only debited at delivery), so 1312 ran a credit balance and, at delivery,
  the cheques' value was counted as receivable a second time.
- revenue was credited NET of a 2.5% "real estate disposal tax". That tax
  (Law 91/2005 art. 42) is levied on natural persons disposing of property; a
  developer company is taxed on its profit. It is now off by default and, when
  a user turns it on (sole-proprietor developer), it is an expense of the
  seller (3351 → 2541), not a deduction from revenue.
- unit cost had to be typed; it is now allocated from the project's
  accumulated cost by area, and capped at what is left in 142.
- every helper posted to a fake account id when a code was missing.
"""
import math
import uuid
from datetime import datetime, timezone, date, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from database import db
from dependencies import get_current_user
from services import ops_posting as P
from services import pack_accounts as PA

router = APIRouter(prefix="/api/real-estate", tags=["Real Estate"])

ACC = {
    "re_wip":             "142",   # مشروعات عقارية تحت التنفيذ
    # 2431 is the EAS 48 contract liability. Bookings made before this change
    # were credited to 257; each booking remembers its own account.
    "contract_liability": "2431",
    "installments_ar":    "1312",  # عملاء أقساط مؤجلة — عقارات
    "returned_cheques":   "1311",  # شيكات مرتدة
    "re_revenue":         "4111",  # إيرادات بيع الوحدات العقارية
    "re_cogs":            "3211",  # تكلفة الوحدات العقارية المباعة
    "re_tax":             "2541",  # ضريبة التصرفات العقارية المستحقة
    "re_tax_exp":         "3351",  # مصروف ضريبة الدخل الجارية (ضريبة التصرفات ضريبة دخل نهائية)
    "bank":               "162",
    "cash":               "161",
    "ap":                 "251",
}
CHEQUE_ACCOUNTS = PA.codes("re_cheques")   # 144 من باقة التطوير العقاري، وإلا 163 من الشجرة الافتراضية

RE_TAX_RATE = 0.025  # 2.5% — قانون 91/2005 م.42 (على الأشخاص الطبيعيين) — اختياري


async def _post_je(company_id, user_id, date_str, desc, lines, src_type, src_id):
    return await P.post_je(db, company_id, user_id, date_str, desc, lines, src_type, src_id)


def _pay_acc(method: str) -> str:
    return {"bank": ACC["bank"], "cheque": ACC["bank"], "cash": ACC["cash"]}.get(method, ACC["ap"])


# ══════════════════════════════════════════════════════════════
# PROJECTS
# ══════════════════════════════════════════════════════════════

class ProjectRequest(BaseModel):
    name:            str = Field(min_length=1, max_length=200)
    location:        str = ""
    project_type:    str = "residential"
    total_units:     int = Field(0, ge=0)
    total_area_sqm:  float = Field(0, ge=0)
    initial_cost:    float = Field(0, ge=0)
    payment_method:  Literal["credit", "bank", "cash"] = "credit"
    date:            Optional[str] = None
    expected_delivery: str = ""


@router.post("/projects")
async def create_re_project(data: ProjectRequest, current_user: dict = Depends(get_current_user)):
    """إنشاء مشروع — وإن وُجدت تكلفة أولية: Dr 142 / Cr 251 أو البنك"""
    company_id = current_user["company_id"]
    project_id = str(uuid.uuid4())
    total_cost = P.r2(data.initial_cost)
    date_str = data.date or date.today().isoformat()
    je_id = None
    if total_cost > 0:
        pay = _pay_acc(data.payment_method)
        lines = [
            await P.je_line(db, company_id, ACC["re_wip"], debit=total_cost, desc=f"تكاليف مشروع عقاري — {data.name}"),
            await P.je_line(db, company_id, pay, credit=total_cost, desc=f"تكلفة أولية — {data.name}"),
        ]
        je_id = await _post_je(company_id, current_user["user_id"], date_str, f"إنشاء مشروع عقاري — {data.name}",
                            lines, "re_project", project_id)
    project = {
        "id": project_id, "company_id": company_id, "name": data.name, "location": data.location,
        "project_type": data.project_type, "total_units": data.total_units, "total_area_sqm": data.total_area_sqm,
        "total_development_cost": total_cost, "accumulated_cost": total_cost, "cost_relieved": 0.0,
        "status": "under_development", "start_date": date_str, "expected_delivery": data.expected_delivery,
        "initial_je_id": je_id, "cost_entries": [], "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.re_projects.insert_one(project); project.pop("_id", None)
    return {"message": f"تم إنشاء المشروع العقاري {data.name}", "project": project, "journal_entry_id": je_id}


class AddCostRequest(BaseModel):
    amount:         float = Field(gt=0)
    cost_type:      Literal["land", "construction", "finishing", "infra", "design", "other"] = "construction"
    payment_method: Literal["credit", "bank", "cash"] = "credit"
    date:           Optional[str] = None
    description:    Optional[str] = None


@router.post("/projects/{project_id}/add-cost")
async def add_development_cost(project_id: str, data: AddCostRequest, current_user: dict = Depends(get_current_user)):
    """Dr 142 مشروعات عقارية تحت التنفيذ / Cr 251 مقاولو الباطن والموردون أو البنك/الخزينة"""
    company_id = current_user["company_id"]
    project = await db.re_projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "المشروع غير موجود")
    amount = P.r2(data.amount)
    date_str = data.date or date.today().isoformat()
    desc = data.description or data.cost_type
    lines = [
        await P.je_line(db, company_id, ACC["re_wip"], debit=amount, desc=f"تكلفة {desc} — {project['name']}"),
        await P.je_line(db, company_id, _pay_acc(data.payment_method), credit=amount, desc=f"{desc} — {project['name']}"),
    ]
    je_id = await _post_je(company_id, current_user["user_id"], date_str, f"تكاليف تطوير — {project['name']} — {desc}",
                        lines, "re_project", project_id)
    await db.re_projects.update_one({"id": project_id, "company_id": company_id}, {
        "$inc": {"accumulated_cost": amount},
        "$push": {"cost_entries": {"type": data.cost_type, "amount": amount, "date": date_str,
                                   "description": desc, "je_id": je_id}}})
    return {"message": f"تم تسجيل تكلفة {desc} — {amount:,.2f} ج.م",
            "accumulated_cost": P.r2(float(project.get("accumulated_cost", 0)) + amount), "journal_entry_id": je_id}


# ══════════════════════════════════════════════════════════════
# UNITS
# ══════════════════════════════════════════════════════════════

class UnitRequest(BaseModel):
    unit_number: str = Field(min_length=1, max_length=60)
    unit_type:   str = "apartment"
    floor:       int = 0
    area_sqm:    float = Field(0, ge=0)
    sale_price:  float = Field(0, ge=0)


@router.post("/projects/{project_id}/units")
async def create_unit(project_id: str, data: UnitRequest, current_user: dict = Depends(get_current_user)):
    """تسجيل وحدة عقارية في المشروع"""
    company_id = current_user["company_id"]
    project = await db.re_projects.find_one({"id": project_id, "company_id": company_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "المشروع غير موجود")
    if await db.re_units.find_one({"company_id": company_id, "project_id": project_id, "unit_number": data.unit_number}, {"_id": 1}):
        raise HTTPException(400, f"الوحدة {data.unit_number} مسجلة في هذا المشروع من قبل")
    unit = {
        "id": str(uuid.uuid4()), "company_id": company_id, "project_id": project_id, "project_name": project["name"],
        "unit_number": data.unit_number, "unit_type": data.unit_type, "floor": data.floor,
        "area_sqm": data.area_sqm, "sale_price": P.r2(data.sale_price),
        "status": "available", "cost_allocated": 0.0, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.re_units.insert_one(unit); unit.pop("_id", None)
    return {"message": f"تم تسجيل الوحدة {unit['unit_number']}", "unit": unit}


# ══════════════════════════════════════════════════════════════
# BOOKING & DEPOSIT
# ══════════════════════════════════════════════════════════════

class BookingRequest(BaseModel):
    unit_id:         str
    customer_id:     str = ""
    customer_name:   str = Field(min_length=1, max_length=200)
    customer_tax_id: Optional[str] = None
    booking_date:    str
    deposit_amount:  float = Field(gt=0)
    contract_price:  float = Field(gt=0)
    payment_method:  Literal["bank", "cash", "cheque"] = "bank"


@router.post("/bookings")
async def book_unit(req: BookingRequest, current_user: dict = Depends(get_current_user)):
    """Dr البنك/الخزينة / Cr 2431 التزامات العقود — الإيراد معلق حتى التسليم (م.48)"""
    company_id = current_user["company_id"]
    unit = await db.re_units.find_one({"id": req.unit_id, "company_id": company_id}, {"_id": 0})
    if not unit:
        raise HTTPException(404, "الوحدة غير موجودة")
    if unit["status"] != "available":
        raise HTTPException(400, f"الوحدة في حالة '{unit['status']}' — غير متاحة للحجز")
    if req.deposit_amount > req.contract_price:
        raise HTTPException(400, "المقدم أكبر من سعر العقد")
    # claim the unit before posting so two bookings cannot take the same unit
    claimed = await db.re_units.update_one({"id": req.unit_id, "company_id": company_id, "status": "available"},
                                           {"$set": {"status": "reserved"}})
    if not claimed.modified_count:
        raise HTTPException(409, "تم حجز الوحدة للتو من مستخدم آخر")
    booking_id = str(uuid.uuid4())
    deposit = P.r2(req.deposit_amount)
    pay = _pay_acc(req.payment_method)
    # real-estate pack: 245 التزامات عقود عملاء; otherwise 2431. The booking keeps
    # its own account, so cheques, payments and delivery follow it.
    liability_acc = await PA.pick_code(db, company_id, "re_contract_liability")
    try:
        lines = [
            await P.je_line(db, company_id, pay, debit=deposit, desc=f"دفعة حجز وحدة {unit['unit_number']} — {req.customer_name}"),
            await P.je_line(db, company_id, liability_acc, credit=deposit,
                            desc=f"حجز {req.customer_name} — وحدة {unit['unit_number']} (التزام حتى التسليم)"),
        ]
        je_id = await _post_je(company_id, current_user["user_id"], req.booking_date,
                            f"حجز وحدة {unit['unit_number']} — {req.customer_name}", lines, "re_booking", booking_id)
    except Exception:
        await db.re_units.update_one({"id": req.unit_id, "company_id": company_id}, {"$set": {"status": "available"}})
        raise
    await db.re_units.update_one({"id": req.unit_id, "company_id": company_id}, {"$set": {
        "customer_id": req.customer_id, "customer_name": req.customer_name,
        "contract_price": P.r2(req.contract_price), "deposit_paid": deposit, "booking_id": booking_id}})
    booking = {
        "id": booking_id, "company_id": company_id,
        "unit_id": req.unit_id, "unit_number": unit["unit_number"],
        "project_id": unit["project_id"], "project_name": unit["project_name"],
        "customer_id": req.customer_id, "customer_name": req.customer_name, "customer_tax_id": req.customer_tax_id,
        "booking_date": req.booking_date, "contract_price": P.r2(req.contract_price),
        "deposit_amount": deposit,
        "liability_account": liability_acc,
        "liability_balance": deposit,      # ما في 2431 لهذا الحجز
        "paid_so_far": deposit,            # نقدية فعلية (المقدم + الشيكات المحصلة)
        "cheques_in_hand": 0.0,            # شيكات لم تُحصّل بعد
        "status": "booked", "installments": [], "booking_je_id": je_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.re_bookings.insert_one(booking); booking.pop("_id", None)
    return {"message": f"تم حجز الوحدة {unit['unit_number']} لـ {req.customer_name}", "booking": booking,
            "journal": {"id": je_id, "note": "الإيراد معلق حتى التسليم الفعلي (م.48)"}}


# ══════════════════════════════════════════════════════════════
# INSTALLMENT CHEQUES
# ══════════════════════════════════════════════════════════════

class ChequeIn(BaseModel):
    cheque_number: str = Field(min_length=1, max_length=60)
    amount:        float = Field(gt=0)
    due_date:      str
    bank_name:     Optional[str] = None


class InstallmentChequeRequest(BaseModel):
    booking_id:   str
    cheques:      List[ChequeIn] = Field(min_length=1)
    receive_date: str


def _booking_liability(b: dict) -> tuple:
    """(account, balance) — bookings from before this version credited only the
    deposit to 257 (their cheques went to 1312), so their liability is the
    deposit; delivery then debits 1312 with price − deposit and the old cheque
    credits net it down to what is really still owed."""
    acc = b.get("liability_account") or "257"
    bal = b.get("liability_balance")
    if bal is None:
        bal = float(b.get("deposit_amount", 0) or 0)
    return acc, P.r2(bal)


@router.post("/installments/receive-cheques")
async def receive_installment_cheques(req: InstallmentChequeRequest, current_user: dict = Depends(get_current_user)):
    """قبل التسليم: Dr شيكات برسم التحصيل / Cr 2431 — بعد التسليم: Dr شيكات / Cr 1312"""
    company_id = current_user["company_id"]
    booking = await db.re_bookings.find_one({"id": req.booking_id, "company_id": company_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "الحجز غير موجود")
    if booking.get("status") == "cancelled":
        raise HTTPException(400, "الحجز ملغى")
    delivered = booking.get("status") == "delivered"
    chq_acc = (await P.first_account(db, company_id, CHEQUE_ACCOUNTS))["account_code"]
    total = P.r2(sum(P.r2(c.amount) for c in req.cheques))
    covered = P.r2(float(booking.get("paid_so_far", 0)) + float(booking.get("cheques_in_hand", 0)))
    if total > P.r2(float(booking["contract_price"]) - covered) + 0.01:
        raise HTTPException(400, f"إجمالي الشيكات ({total:,.2f}) يتجاوز المتبقي من سعر العقد "
                                 f"({P.r2(float(booking['contract_price']) - covered):,.2f})")
    nums = [c.cheque_number for c in req.cheques]
    if len(set(nums)) != len(nums) or await db.re_installment_cheques.find_one(
            {"company_id": company_id, "booking_id": req.booking_id, "cheque_number": {"$in": nums}}, {"_id": 1}):
        raise HTTPException(400, "رقم شيك مكرر")
    credit_acc = ACC["installments_ar"] if delivered else _booking_liability(booking)[0]
    lines = [
        await P.je_line(db, company_id, chq_acc, debit=total,
                        desc=f"شيكات أقساط — {booking['customer_name']} — وحدة {booking['unit_number']}"),
        await P.je_line(db, company_id, credit_acc, credit=total,
                        desc=("أقساط مؤجلة — " if delivered else "دفعات عقد (التزام حتى التسليم) — ") + booking["customer_name"]),
    ]
    je_id = await _post_je(company_id, current_user["user_id"], req.receive_date,
                        f"استلام شيكات أقساط — {booking['customer_name']}", lines, "re_booking", req.booking_id)
    records = [{
        "id": str(uuid.uuid4()), "company_id": company_id, "booking_id": req.booking_id,
        "customer_name": booking["customer_name"], "unit_number": booking["unit_number"],
        "project_name": booking.get("project_name", ""),
        "cheque_number": c.cheque_number, "bank_name": c.bank_name, "amount": P.r2(c.amount),
        "due_date": c.due_date, "receive_date": req.receive_date, "status": "pending",
        "account_code": chq_acc, "received_after_delivery": delivered, "receive_je_id": je_id,
    } for c in req.cheques]
    await db.re_installment_cheques.insert_many([dict(r) for r in records])
    update = {"$push": {"installments": {"$each": [dict(r) for r in records]}}, "$inc": {"cheques_in_hand": total}}
    if not delivered:
        # a booking from before this version has no liability_balance yet: set it
        # from what it had collected, plus these cheques
        update["$set"] = {"liability_balance": P.r2(_booking_liability(booking)[1] + total),
                          "liability_account": credit_acc}
    await db.re_bookings.update_one({"id": req.booking_id, "company_id": company_id}, update)
    return {"message": f"تم استلام {len(records)} شيك بإجمالي {total:,.2f} ج.م", "cheques": records,
            "journal": {"id": je_id, "debit": chq_acc, "credit": credit_acc}}


class ChequeActionRequest(BaseModel):
    date: Optional[str] = None
    bank_account: str = "162"


@router.get("/installments/cheques")
async def list_installment_cheques(status: Optional[str] = None, booking_id: Optional[str] = None,
                                   current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    if booking_id: q["booking_id"] = booking_id
    rows = await db.re_installment_cheques.find(q, {"_id": 0}).sort("due_date", 1).to_list(1000)
    return {"cheques": rows, "total": len(rows),
            "pending_total": P.r2(sum(r["amount"] for r in rows if r["status"] == "pending"))}


async def _cheque(company_id, cheque_id):
    """Claim a pending cheque atomically (pending → processing).

    The old check-then-update let a double click read "pending" twice and post
    the collection (or the bounce) twice. Only the request whose update
    actually flips the status may post; the caller restores "pending" if the
    posting fails (_release_cheque)."""
    chq = await db.re_installment_cheques.find_one({"id": cheque_id, "company_id": company_id}, {"_id": 0})
    if not chq:
        raise HTTPException(404, "الشيك غير موجود")
    if chq["status"] != "pending":
        raise HTTPException(400, f"الشيك في حالة '{chq['status']}'")
    claimed = await db.re_installment_cheques.update_one(
        {"id": cheque_id, "company_id": company_id, "status": "pending"}, {"$set": {"status": "processing"}})
    if not claimed.modified_count:
        raise HTTPException(409, "جارٍ تنفيذ عملية أخرى على هذا الشيك")
    return chq


async def _release_cheque(company_id, cheque_id):
    await db.re_installment_cheques.update_one(
        {"id": cheque_id, "company_id": company_id, "status": "processing"}, {"$set": {"status": "pending"}})


@router.post("/installments/{cheque_id}/collect")
async def collect_installment_cheque(cheque_id: str, data: ChequeActionRequest,
                                     current_user: dict = Depends(get_current_user)):
    """Dr البنك / Cr حساب الشيكات الذي استُلم عليه الشيك"""
    company_id = current_user["company_id"]
    if not data.bank_account.startswith("16") or data.bank_account in ("163", "164", "165"):
        raise HTTPException(400, "اختر حساب بنك صحيحاً")
    chq = await _cheque(company_id, cheque_id)
    amount, date_str = P.r2(chq["amount"]), data.date or date.today().isoformat()
    chq_acc = chq.get("account_code") or "163"
    try:
        lines = [
            await P.je_line(db, company_id, data.bank_account, debit=amount, desc=f"تحصيل شيك قسط {chq['cheque_number']} — {chq['customer_name']}"),
            await P.je_line(db, company_id, chq_acc, credit=amount, desc=f"إقفال شيكات برسم التحصيل — {chq['cheque_number']}"),
        ]
        je_id = await _post_je(company_id, current_user["user_id"], date_str, f"تحصيل قسط عقاري — {chq['customer_name']}",
                            lines, "re_cheque", cheque_id)
    except Exception:
        await _release_cheque(company_id, cheque_id)
        raise
    # cash actually received pays the oldest open instalments of the schedule
    allocations = await _allocate(company_id, chq["booking_id"], amount, date_str, "re_cheque", cheque_id)
    await db.re_installment_cheques.update_one({"id": cheque_id, "company_id": company_id},
                                               {"$set": {"status": "collected", "collection_date": date_str, "je_id": je_id,
                                                         "allocations": allocations}})
    await db.re_bookings.update_one({"id": chq["booking_id"], "company_id": company_id},
                                    {"$inc": {"paid_so_far": amount, "cheques_in_hand": -amount}})
    return {"message": f"✅ تم تحصيل الشيك {chq['cheque_number']} — {amount:,.2f} ج.م", "journal_entry_id": je_id,
            "allocations": allocations}


@router.post("/installments/{cheque_id}/bounce")
async def bounce_installment_cheque(cheque_id: str, data: ChequeActionRequest,
                                    current_user: dict = Depends(get_current_user)):
    """شيك مرتد — قبل التسليم يُعكس على التزام العقد، وبعده يُحوَّل إلى 1311 شيكات مرتدة على العميل."""
    company_id = current_user["company_id"]
    chq = await _cheque(company_id, cheque_id)
    try:
        booking = await db.re_bookings.find_one({"id": chq["booking_id"], "company_id": company_id}, {"_id": 0}) or {}
        amount, date_str = P.r2(chq["amount"]), data.date or date.today().isoformat()
        chq_acc = chq.get("account_code") or "163"
        # a cheque received before delivery credited the contract liability; it is
        # reversed there — unless the unit has since been delivered, in which case
        # that liability was already turned into revenue and the customer owes it
        pre = not chq.get("received_after_delivery") and booking.get("status") != "delivered"
        debit_acc = _booking_liability(booking)[0] if pre else ACC["returned_cheques"]
        lines = [
            await P.je_line(db, company_id, debit_acc, debit=amount, desc=f"ارتداد شيك {chq['cheque_number']} — {chq['customer_name']}"),
            await P.je_line(db, company_id, chq_acc, credit=amount, desc=f"إقفال شيك مرتد — {chq['cheque_number']}"),
        ]
        je_id = await _post_je(company_id, current_user["user_id"], date_str, f"شيك قسط مرتد — {chq['customer_name']}",
                            lines, "re_cheque", cheque_id)
    except Exception:
        await _release_cheque(company_id, cheque_id)
        raise
    await db.re_installment_cheques.update_one({"id": cheque_id, "company_id": company_id},
                                               {"$set": {"status": "bounced", "bounce_date": date_str, "bounce_je_id": je_id}})
    inc = {"cheques_in_hand": -amount}
    if pre:
        inc["liability_balance"] = -amount
    await db.re_bookings.update_one({"id": chq["booking_id"], "company_id": company_id}, {"$inc": inc})
    return {"message": f"تم تسجيل ارتداد الشيك {chq['cheque_number']}", "journal_entry_id": je_id, "debit_account": debit_acc}


# ══════════════════════════════════════════════════════════════
# DELIVERY — REVENUE RECOGNITION (EAS 48)
# ══════════════════════════════════════════════════════════════

class DeliverRequest(BaseModel):
    date: Optional[str] = None
    unit_cost: Optional[float] = Field(None, ge=0)   # فارغ = تخصيص تلقائي من تكلفة المشروع بالمساحة
    apply_re_tax: Optional[bool] = None   # None = the company's policy (سياسات الشركة)


async def _suggest_cost(company_id: str, booking: dict) -> dict:
    project = await db.re_projects.find_one({"id": booking["project_id"], "company_id": company_id}, {"_id": 0}) or {}
    unit = await db.re_units.find_one({"id": booking["unit_id"], "company_id": company_id}, {"_id": 0}) or {}
    units = await db.re_units.find({"company_id": company_id, "project_id": booking["project_id"]},
                                   {"_id": 0, "area_sqm": 1}).to_list(None)
    acc = float(project.get("accumulated_cost", 0) or 0)
    remaining = P.r2(acc - float(project.get("cost_relieved", 0) or 0))
    total_area = sum(float(u.get("area_sqm") or 0) for u in units)
    if total_area > 0 and float(unit.get("area_sqm") or 0) > 0:
        cost, basis = acc * float(unit["area_sqm"]) / total_area, "area"
    else:
        n = max(int(project.get("total_units") or 0), len(units), 1)
        cost, basis = acc / n, "units"
    return {"suggested": P.r2(min(cost, max(remaining, 0))), "remaining_wip": remaining, "basis": basis}


@router.get("/bookings/{booking_id}/delivery-preview")
async def delivery_preview(booking_id: str, current_user: dict = Depends(get_current_user)):
    """الأرقام التي سيُرحَّل بها التسليم — للعرض قبل الحفظ."""
    company_id = current_user["company_id"]
    b = await db.re_bookings.find_one({"id": booking_id, "company_id": company_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    acc, bal = _booking_liability(b)
    price = P.r2(b["contract_price"])
    return {"contract_price": price, "liability_account": acc, "liability_balance": bal,
            "receivable": P.r2(price - bal), **(await _suggest_cost(company_id, b))}


@router.post("/bookings/{booking_id}/deliver")
async def deliver_unit(booking_id: str, data: DeliverRequest, current_user: dict = Depends(get_current_user)):
    """
    تسليم الوحدة — نقل السيطرة (م.48):
    Dr 2431 ما حُصّل وما استُلم من شيكات + Dr 1312 باقي سعر العقد / Cr 4111 سعر العقد كاملاً
    Dr 3211 تكلفة الوحدة / Cr 142
    """
    company_id = current_user["company_id"]
    booking = await db.re_bookings.find_one({"id": booking_id, "company_id": company_id}, {"_id": 0})
    if not booking:
        raise HTTPException(404, "الحجز غير موجود")
    if booking.get("status") != "booked":
        raise HTTPException(400, "تم التسليم مسبقاً أو الحجز غير قائم")
    claimed = await db.re_bookings.update_one({"id": booking_id, "company_id": company_id, "status": "booked"},
                                              {"$set": {"status": "delivering"}})
    if not claimed.modified_count:
        raise HTTPException(409, "جارٍ التسليم بالفعل")
    try:
        delivery_date = data.date or date.today().isoformat()
        price = P.r2(booking["contract_price"])
        liab_acc, liab_bal = _booking_liability(booking)
        if liab_bal > price + 0.01:
            raise HTTPException(400, "المحصّل أكبر من سعر العقد — راجع الحجز")
        receivable = P.r2(price - liab_bal)
        sug = await _suggest_cost(company_id, booking)
        unit_cost = P.r2(data.unit_cost if data.unit_cost is not None else sug["suggested"])
        if unit_cost > sug["remaining_wip"] + 0.01:
            raise HTTPException(400, f"تكلفة الوحدة ({unit_cost:,.2f}) أكبر من المتبقي في تكاليف المشروع ({sug['remaining_wip']:,.2f})")
        from api.company_policies import disposal_tax
        tax_on, tax_rate = await disposal_tax(company_id)
        apply_tax = tax_on if data.apply_re_tax is None else data.apply_re_tax
        re_tax = P.r2(price * tax_rate) if apply_tax else 0.0

        rev_lines = [
            await P.je_line(db, company_id, liab_acc, debit=liab_bal,
                            desc=f"تصفية التزام العقد — {booking['customer_name']} وحدة {booking['unit_number']}"),
            await P.je_line(db, company_id, ACC["installments_ar"], debit=receivable,
                            desc=f"باقي ثمن الوحدة أقساط مؤجلة — {booking['customer_name']}"),
            await P.je_line(db, company_id, ACC["re_revenue"], credit=price,
                            desc=f"إيراد بيع وحدة عقارية — {booking['unit_number']}"),
        ]
        if re_tax:
            rev_lines += [
                await P.je_line(db, company_id, ACC["re_tax_exp"], debit=re_tax, desc=f"ضريبة تصرفات عقارية {tax_rate*100:g}% — {booking['unit_number']}"),
                await P.je_line(db, company_id, ACC["re_tax"], credit=re_tax, desc=f"ضريبة تصرفات عقارية مستحقة — {booking['unit_number']}"),
            ]
        je_rev_id = await _post_je(company_id, current_user["user_id"], delivery_date,
                                f"اعتراف بإيراد بيع وحدة {booking['unit_number']} — {booking['customer_name']}",
                                rev_lines, "re_booking", booking_id)
        je_cogs_id = None
        if unit_cost > 0:
            cogs_lines = [
                await P.je_line(db, company_id, ACC["re_cogs"], debit=unit_cost, desc=f"تكلفة وحدة {booking['unit_number']} المباعة"),
                await P.je_line(db, company_id, ACC["re_wip"], credit=unit_cost, desc=f"إقفال تكلفة وحدة {booking['unit_number']} من المشروع"),
            ]
            je_cogs_id = await _post_je(company_id, current_user["user_id"], delivery_date,
                                     f"تكلفة وحدة عقارية مباعة — {booking['unit_number']}", cogs_lines, "re_booking", booking_id)
    except Exception:
        await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {"$set": {"status": "booked"}})
        raise

    await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {"$set": {
        "status": "delivered", "delivery_date": delivery_date, "revenue_je_id": je_rev_id, "cogs_je_id": je_cogs_id,
        "liability_balance": 0.0, "receivable_at_delivery": receivable, "unit_cost": unit_cost, "re_tax_amount": re_tax}})
    await db.re_units.update_one({"id": booking["unit_id"], "company_id": company_id},
                                 {"$set": {"status": "delivered", "delivery_date": delivery_date, "cost_allocated": unit_cost}})
    await db.re_projects.update_one({"id": booking["project_id"], "company_id": company_id}, {"$inc": {"cost_relieved": unit_cost}})
    margin = P.r2(price - unit_cost)
    return {
        "message": f"✅ تم تسليم الوحدة {booking['unit_number']} لـ {booking['customer_name']}",
        "delivery_date": delivery_date,
        "financials": {"contract_price": price, "re_tax_amount": re_tax, "revenue": price,
                       "receivable": receivable, "unit_cost": unit_cost, "gross_margin": margin,
                       "gross_margin_pct": round(margin / price * 100, 1) if price else None},
        "journal_entries": {"revenue_recognition": je_rev_id, "cogs": je_cogs_id},
        "law": "المعيار المحاسبي المصري 48 — الإيراد يُثبَّت عند نقل السيطرة (التسليم الفعلي)",
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/projects")
async def list_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.re_projects.find({"company_id": current_user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(None)
    return {"projects": projects, "total": len(projects)}


@router.get("/projects/{project_id}/units")
async def list_project_units(project_id: str, status: Optional[str] = None,
                             current_user: dict = Depends(get_current_user)):
    q = {"project_id": project_id, "company_id": current_user["company_id"]}
    if status: q["status"] = status
    units = await db.re_units.find(q, {"_id": 0}).to_list(None)
    summary = {
        "total": len(units),
        **{s: sum(1 for u in units if u["status"] == s) for s in ("available", "reserved", "contracted", "delivered")},
        "total_contracted_value": P.r2(sum(float(u.get("contract_price", 0)) for u in units
                                           if u["status"] in ("reserved", "contracted", "delivered"))),
    }
    return {"units": units, "summary": summary}


@router.get("/bookings")
async def list_bookings(status: Optional[str] = None, page: int = 1, limit: int = 20,
                        current_user: dict = Depends(get_current_user)):
    q = {"company_id": current_user["company_id"]}
    if status: q["status"] = status
    limit = max(1, min(limit, 200))
    total = await db.re_bookings.count_documents(q)
    bookings = await db.re_bookings.find(q, {"_id": 0}).sort("booking_date", -1).skip((max(page, 1) - 1) * limit).limit(limit).to_list(None)
    return {"bookings": bookings, "total": total}


@router.get("/reports/revenue-recognition")
async def revenue_recognition_report(year: int = Query(None), current_user: dict = Depends(get_current_user)):
    """تقرير الاعتراف بالإيراد حسب التسليمات الفعلية"""
    q = {"company_id": current_user["company_id"], "status": "delivered"}
    if year:
        q["delivery_date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}
    bookings = await db.re_bookings.find(q, {"_id": 0}).to_list(None)
    total_rev = P.r2(sum(float(b.get("contract_price", 0)) for b in bookings))
    # was contract_price × 2.5% for every booking, whether the tax was applied or not
    total_tax = P.r2(sum(float(b.get("re_tax_amount", 0) or 0) for b in bookings))
    total_cost = P.r2(sum(float(b.get("unit_cost", 0) or 0) for b in bookings))
    return {"period": str(year) if year else "الكل", "units_delivered": len(bookings),
            "total_revenue": total_rev, "total_re_tax": total_tax, "total_cost": total_cost,
            "gross_margin": P.r2(total_rev - total_cost), "net_revenue": total_rev, "bookings": bookings,
            "law": "م.48 — الإيراد يُثبَّت عند التسليم الفعلي فقط"}


# ══════════════════════════════════════════════════════════════
# INSTALMENT SCHEDULE, ALLOCATION, LATE PENALTIES, ALERTS
# جدول الأقساط — ربط التحصيلات بالأقساط — غرامات التأخير — التنبيهات
# ══════════════════════════════════════════════════════════════
# re_installments: {id, company_id, booking_id, seq, due_date, amount,
#   paid_amount, status: due|overdue|paid|cancelled, is_partial, payments[],
#   penalty_amount, penalty_paid, penalty_months_charged, penalties[], version}
# A schedule covers contract price − what was received when it was drawn up;
# cash received later (collected cheques, direct payments) pays the oldest
# open instalment first. Cheques still in hand pay nothing until collected.
FREQ_MONTHS = {"monthly": 1, "quarterly": 3, "semiannual": 6, "annual": 12}
OPEN = ("due", "overdue")
DEFAULT_POLICY = {"penalty_rate_monthly_pct": 0.0, "grace_days": 0, "penalty_account": "423", "due_soon_days": 7}
# who is told about due / overdue instalments
MANAGER_ROLES = ["رئيس مجلس الإدارة", "Board Chairman", "General Manager", "مدير عام", "المدير العام", "CEO",
                 "المدير التنفيذي", "Financial Manager", "المدير المالي", "مدير مالي", "CFO",
                 "Chief Accountant", "رئيس الحسابات", "Sales Manager", "مدير المبيعات"]


def _d(s: str) -> date:
    try:
        return date.fromisoformat(str(s)[:10])
    except ValueError:
        raise HTTPException(400, f"تاريخ غير صالح: {s}")


async def _policy(company_id: str) -> dict:
    doc = await db.re_policy.find_one({"company_id": company_id}, {"_id": 0}) or {}
    return {**DEFAULT_POLICY, **{k: v for k, v in doc.items() if k in DEFAULT_POLICY}}


class PolicyRequest(BaseModel):
    penalty_rate_monthly_pct: float = Field(0, ge=0, le=10)   # % شهرياً على القسط المتأخر
    grace_days: int = Field(0, ge=0, le=120)
    penalty_account: Literal["423", "421"] = "423"            # إيرادات متنوعة أخرى
    due_soon_days: int = Field(7, ge=1, le=60)


@router.get("/policy")
async def get_re_policy(current_user: dict = Depends(get_current_user)):
    """سياسة غرامات التأخير وتنبيهات الأقساط للشركة."""
    return {"policy": await _policy(current_user["company_id"])}


@router.put("/policy")
async def put_re_policy(data: PolicyRequest, current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    await P.get_account(db, company_id, data.penalty_account)     # must exist and accept postings
    await db.re_policy.update_one({"company_id": company_id}, {"$set": {
        **data.model_dump(), "company_id": company_id, "updated_by": current_user["user_id"],
        "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
    return {"message": "تم حفظ سياسة الأقساط", "policy": await _policy(company_id)}


def _build_rows(company_id: str, booking: dict, total: float, count: int, frequency: str,
                start: date, first_seq: int, version: int) -> list:
    step = FREQ_MONTHS[frequency]
    base = P.r2(total / count)
    if total - base * (count - 1) <= 0:          # rounding up must not leave the last one at zero
        base = math.floor(total / count * 100) / 100
    today = date.today()
    rows = []
    for i in range(count):
        amt = base if i < count - 1 else P.r2(total - base * (count - 1))   # last one absorbs rounding
        due = start + relativedelta(months=step * i)
        rows.append({
            "id": str(uuid.uuid4()), "company_id": company_id, "booking_id": booking["id"],
            "customer_name": booking.get("customer_name", ""), "unit_number": booking.get("unit_number", ""),
            "project_name": booking.get("project_name", ""),
            "seq": first_seq + i, "due_date": due.isoformat(), "amount": P.r2(amt), "paid_amount": 0.0,
            "status": "overdue" if due < today else "due", "is_partial": False, "payments": [],
            "penalty_amount": 0.0, "penalty_paid": 0.0, "penalty_months_charged": 0, "penalties": [],
            "version": version, "created_at": datetime.now(timezone.utc).isoformat()})
    return rows


async def _lock_booking(company_id: str, booking_id: str) -> dict:
    b = await db.re_bookings.find_one({"id": booking_id, "company_id": company_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b.get("status") == "cancelled":
        raise HTTPException(400, "الحجز ملغى")
    got = await db.re_bookings.update_one({"id": booking_id, "company_id": company_id, "schedule_lock": {"$ne": True}},
                                          {"$set": {"schedule_lock": True}})
    if not got.modified_count:
        raise HTTPException(409, "جارٍ تعديل جدول أقساط هذا الحجز بالفعل")
    return b


async def _unlock_booking(company_id: str, booking_id: str):
    await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {"$unset": {"schedule_lock": ""}})


class ScheduleRequest(BaseModel):
    count: int = Field(ge=1, le=360)
    frequency: Literal["monthly", "quarterly", "semiannual", "annual"] = "monthly"
    start_date: str
    # what the customer had paid when the contract was signed; empty = what
    # this module recorded (deposit + collected cheques + payments)
    down_payment: Optional[float] = Field(None, ge=0)


@router.post("/bookings/{booking_id}/schedule")
async def create_schedule(booking_id: str, data: ScheduleRequest, current_user: dict = Depends(get_current_user)):
    """توليد جدول أقساط: الإجمالي = سعر العقد − ما حُصّل حتى تاريخه، والقسط الأخير يمتص فروق التقريب."""
    company_id = current_user["company_id"]
    start = _d(data.start_date)
    b = await _lock_booking(company_id, booking_id)
    try:
        if await db.re_installments.find_one({"company_id": company_id, "booking_id": booking_id,
                                              "status": {"$ne": "cancelled"}}, {"_id": 1}):
            raise HTTPException(400, "يوجد جدول أقساط قائم لهذا الحجز — استخدم «إعادة الجدولة»")
        price = P.r2(b["contract_price"])
        recorded = P.r2(b.get("paid_so_far", 0))
        received = recorded if data.down_payment is None else P.r2(data.down_payment)
        if received + 0.01 < recorded:
            raise HTTPException(400, f"المقدم المدخل ({received:,.2f}) أقل مما حُصّل فعلاً ({recorded:,.2f})")
        total = P.r2(price - received)
        if total <= 0:
            raise HTTPException(400, "لا يوجد رصيد متبقٍ لتقسيطه")
        if total / data.count < 0.01:
            raise HTTPException(400, "عدد الأقساط أكبر من المبلغ المتبقي")
        rows = _build_rows(company_id, b, total, data.count, data.frequency, start, 1, 1)
        await db.re_installments.insert_many([dict(r) for r in rows])
        await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {"$set": {
            "schedule": {"count": data.count, "frequency": data.frequency, "start_date": start.isoformat(),
                         "total": total, "received_at_schedule": received, "version": 1}}})
    finally:
        await _unlock_booking(company_id, booking_id)
    return {"message": f"تم توليد {len(rows)} قسط بإجمالي {total:,.2f} ج.م", "installments": rows, "total": total}


def _summ(rows: list) -> dict:
    live = [r for r in rows if r["status"] != "cancelled"]
    return {
        "count": len(live),
        "scheduled": P.r2(sum(r["amount"] for r in live)),
        "paid": P.r2(sum(r.get("paid_amount", 0) for r in live)),
        "outstanding": P.r2(sum(r["amount"] - r.get("paid_amount", 0) for r in live if r["status"] in OPEN)),
        "overdue": P.r2(sum(r["amount"] - r.get("paid_amount", 0) for r in live if r["status"] == "overdue")),
        "overdue_count": sum(1 for r in live if r["status"] == "overdue"),
        "penalties": P.r2(sum(r.get("penalty_amount", 0) for r in rows)),
        "penalties_outstanding": P.r2(sum(r.get("penalty_amount", 0) - r.get("penalty_paid", 0) for r in rows)),
    }


@router.get("/bookings/{booking_id}/schedule")
async def get_schedule(booking_id: str, include_cancelled: bool = False, current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    b = await db.re_bookings.find_one({"id": booking_id, "company_id": company_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    q = {"company_id": company_id, "booking_id": booking_id}
    rows = await db.re_installments.find(q, {"_id": 0}).sort("seq", 1).to_list(None)
    t = date.today().isoformat()
    for r in rows:              # past due but not yet flipped by the daily job
        if r["status"] == "due" and r["due_date"] < t:
            r["status"] = "overdue"
    shown = rows if include_cancelled else [r for r in rows if r["status"] != "cancelled"]
    return {"booking_id": booking_id, "customer_name": b.get("customer_name"), "unit_number": b.get("unit_number"),
            "contract_price": b.get("contract_price"), "paid_so_far": b.get("paid_so_far", 0),
            "cheques_in_hand": b.get("cheques_in_hand", 0), "schedule": b.get("schedule"),
            "installments": shown, "totals": _summ(rows)}


@router.get("/installments")
async def list_installments(status: Literal["overdue", "due_soon", "due", "paid", "open", "all"] = "open",
                            current_user: dict = Depends(get_current_user)):
    """الأقساط على مستوى الشركة: متأخرة، أو مستحقة خلال أيام التنبيه، مع الإجماليات."""
    company_id = current_user["company_id"]
    pol = await _policy(company_id)
    today = date.today()
    q = {"company_id": company_id}
    if status == "overdue":
        # rows the daily job has not flipped yet are overdue all the same
        q["$or"] = [{"status": "overdue"}, {"status": "due", "due_date": {"$lt": today.isoformat()}}]
    elif status == "due_soon":
        q.update(status="due", due_date={"$gte": today.isoformat(),
                                         "$lte": (today + timedelta(days=int(pol["due_soon_days"]))).isoformat()})
    elif status == "open":
        q["status"] = {"$in": list(OPEN)}
    elif status in ("due", "paid"):
        q["status"] = status
    rows = await db.re_installments.find(q, {"_id": 0}).sort("due_date", 1).to_list(2000)
    for r in rows:
        if r["status"] == "due" and r["due_date"] < today.isoformat():
            r["status"] = "overdue"
        r["outstanding"] = P.r2(r["amount"] - r.get("paid_amount", 0)) if r["status"] in OPEN else 0.0
        r["days_late"] = max((today - _d(r["due_date"])).days, 0) if r["status"] == "overdue" else 0
    return {"installments": rows, "status": status, "policy": pol,
            "totals": {"count": len(rows), "amount": P.r2(sum(r["amount"] for r in rows)),
                       "outstanding": P.r2(sum(r["outstanding"] for r in rows)),
                       "penalties_outstanding": P.r2(sum(r.get("penalty_amount", 0) - r.get("penalty_paid", 0) for r in rows))}}


async def _allocate(company_id: str, booking_id: str, amount: float, date_str: str,
                    source_type: str, source_id: str) -> list:
    """Spread cash received over the booking's open instalments, oldest first.

    Without a schedule nothing is allocated (the schedule, when drawn up later,
    starts from what had been received). What exceeds the schedule is kept on
    the booking as unallocated credit."""
    left = P.r2(amount)
    rows = await db.re_installments.find({"company_id": company_id, "booking_id": booking_id,
                                          "status": {"$in": list(OPEN)}}, {"_id": 0}).sort("seq", 1).to_list(None)
    if not rows:
        return []
    out = []
    for r in rows:
        if left <= 0:
            break
        open_amt = P.r2(r["amount"] - r.get("paid_amount", 0))
        if open_amt <= 0:
            continue
        take = min(open_amt, left)
        paid = P.r2(r.get("paid_amount", 0) + take)
        full = paid >= r["amount"] - 0.005
        await db.re_installments.update_one({"id": r["id"], "company_id": company_id}, {
            "$set": {"paid_amount": paid, "is_partial": not full,
                     **({"status": "paid", "paid_date": date_str} if full else {})},
            "$push": {"payments": {"amount": P.r2(take), "date": date_str, "source_type": source_type, "source_id": source_id}}})
        out.append({"installment_id": r["id"], "seq": r["seq"], "amount": P.r2(take), "fully_paid": full})
        left = P.r2(left - take)
    if left > 0:
        await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {"$inc": {"unallocated_credit": left}})
        out.append({"installment_id": None, "unallocated": left})
    return out


class PaymentRequest(BaseModel):
    amount: float = Field(0, ge=0)                 # يُخصم من الأقساط
    penalty_amount: float = Field(0, ge=0)         # سداد غرامات تأخير
    method: Literal["bank", "cash"] = "bank"
    bank_account: Optional[str] = None
    date: Optional[str] = None
    reference: Optional[str] = None


@router.post("/bookings/{booking_id}/payments")
async def receive_payment(booking_id: str, data: PaymentRequest, current_user: dict = Depends(get_current_user)):
    """
    سداد نقدي/تحويل من العميل:
    Dr البنك/الخزينة / Cr 2431 (قبل التسليم) أو 1312 (بعده) — ويُوزَّع على الأقساط الأقدم فالأحدث
    سداد الغرامات: Cr 1312 (حيث قُيِّدت الغرامة)
    """
    company_id = current_user["company_id"]
    b = await db.re_bookings.find_one({"id": booking_id, "company_id": company_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "الحجز غير موجود")
    if b.get("status") not in ("booked", "delivered"):
        raise HTTPException(400, f"الحجز في حالة '{b.get('status')}'")
    amount, pen = P.r2(data.amount), P.r2(data.penalty_amount)
    if amount + pen <= 0:
        raise HTTPException(400, "أدخل مبلغاً")
    left = P.r2(float(b["contract_price"]) - float(b.get("paid_so_far", 0)) - float(b.get("cheques_in_hand", 0)))
    if amount > left + 0.01:
        raise HTTPException(400, f"المبلغ ({amount:,.2f}) أكبر من المتبقي من سعر العقد ({left:,.2f})")
    rows = await db.re_installments.find({"company_id": company_id, "booking_id": booking_id}, {"_id": 0}).sort("seq", 1).to_list(None)
    pen_open = P.r2(sum(r.get("penalty_amount", 0) - r.get("penalty_paid", 0) for r in rows))
    if pen > pen_open + 0.01:
        raise HTTPException(400, f"مبلغ الغرامات ({pen:,.2f}) أكبر من الغرامات المستحقة ({pen_open:,.2f})")
    if data.method == "bank":
        pay_acc = data.bank_account or ACC["bank"]
        if not pay_acc.startswith("16") or pay_acc in ("161", "163", "164", "165"):
            raise HTTPException(400, "اختر حساب بنك صحيحاً")
    else:
        pay_acc = ACC["cash"]
    date_str = data.date or date.today().isoformat()
    delivered = b.get("status") == "delivered"
    credit_acc = ACC["installments_ar"] if delivered else _booking_liability(b)[0]
    lines = [await P.je_line(db, company_id, pay_acc, debit=P.r2(amount + pen),
                             desc=f"تحصيل من {b['customer_name']} — وحدة {b['unit_number']}")]
    if amount:
        lines.append(await P.je_line(db, company_id, credit_acc, credit=amount,
                                     desc=("أقساط مؤجلة — " if delivered else "دفعات عقد (التزام حتى التسليم) — ") + b["customer_name"]))
    if pen:
        lines.append(await P.je_line(db, company_id, ACC["installments_ar"], credit=pen,
                                     desc=f"سداد غرامات تأخير — {b['customer_name']}"))
    pid = str(uuid.uuid4())
    je_id = await _post_je(company_id, current_user["user_id"], date_str,
                           f"تحصيل قسط عقاري — {b['customer_name']}", lines, "re_payment", pid)
    allocations = await _allocate(company_id, booking_id, amount, date_str, "re_payment", pid) if amount else []
    # penalties are settled oldest first as well
    pleft = pen
    for r in rows:
        if pleft <= 0:
            break
        o = P.r2(r.get("penalty_amount", 0) - r.get("penalty_paid", 0))
        if o > 0:
            t = min(o, pleft)
            await db.re_installments.update_one({"id": r["id"], "company_id": company_id}, {"$inc": {"penalty_paid": P.r2(t)}})
            pleft = P.r2(pleft - t)
    inc = {"paid_so_far": amount}
    if not delivered:
        inc["liability_balance"] = amount
    await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {
        "$inc": inc, "$push": {"payments": {"id": pid, "amount": amount, "penalty_amount": pen, "date": date_str,
                                            "account": pay_acc, "je_id": je_id, "reference": data.reference}}})
    return {"message": f"تم تسجيل التحصيل {P.r2(amount + pen):,.2f} ج.م", "journal_entry_id": je_id,
            "allocations": allocations}


class PenaltyRequest(BaseModel):
    as_of: Optional[str] = None


@router.post("/installments/{installment_id}/penalty")
async def apply_penalty(installment_id: str, data: PenaltyRequest, current_user: dict = Depends(get_current_user)):
    """
    غرامة تأخير = المتأخر × النسبة الشهرية × أشهر التأخير بعد فترة السماح (ما لم يُحتسب من قبل)
    Dr 1312 عملاء أقساط مؤجلة / Cr 423 إيرادات متنوعة أخرى — لا تُحتسب مرتين لنفس الشهر.
    """
    company_id = current_user["company_id"]
    r = await db.re_installments.find_one({"id": installment_id, "company_id": company_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "القسط غير موجود")
    pol = await _policy(company_id)
    rate = float(pol["penalty_rate_monthly_pct"] or 0)
    if rate <= 0:
        raise HTTPException(400, "حدد نسبة غرامة التأخير الشهرية في سياسة الأقساط أولاً")
    if r["status"] not in OPEN:
        raise HTTPException(400, f"القسط في حالة '{r['status']}' — لا غرامة")
    as_of = _d(data.as_of) if data.as_of else date.today()
    days = (as_of - _d(r["due_date"])).days - int(pol["grace_days"] or 0)
    if days <= 0:
        raise HTTPException(400, "القسط غير متأخر أو ما زال في فترة السماح")
    months = math.ceil(days / 30)
    charged = int(r.get("penalty_months_charged") or 0)
    period = as_of.isoformat()[:7]
    if months <= charged or any(p.get("period") == period for p in r.get("penalties", [])):
        raise HTTPException(400, f"احتُسبت غرامة هذا القسط عن الشهر {period} من قبل")
    overdue = P.r2(r["amount"] - r.get("paid_amount", 0))
    new_months = months - charged
    penalty = P.r2(overdue * rate / 100 * new_months)
    if penalty <= 0:
        raise HTTPException(400, "مبلغ الغرامة صفر")
    # claim: a second click finds penalty_months_charged already moved on
    got = await db.re_installments.update_one(
        {"id": installment_id, "company_id": company_id, "penalty_months_charged": charged, "penalty_lock": {"$ne": True}},
        {"$set": {"penalty_lock": True}})
    if not got.modified_count:
        raise HTTPException(409, "جارٍ احتساب الغرامة بالفعل")
    try:
        b = await db.re_bookings.find_one({"id": r["booking_id"], "company_id": company_id}, {"_id": 0}) or {}
        lines = [
            await P.je_line(db, company_id, ACC["installments_ar"], debit=penalty,
                            desc=f"غرامة تأخير قسط {r['seq']} — {b.get('customer_name', '')} ({new_months} شهر × {rate:g}%)"),
            await P.je_line(db, company_id, pol["penalty_account"], credit=penalty,
                            desc=f"إيراد غرامات تأخير — وحدة {b.get('unit_number', '')}"),
        ]
        je_id = await _post_je(company_id, current_user["user_id"], as_of.isoformat(),
                               f"غرامة تأخير قسط — {b.get('customer_name', '')}", lines, "re_penalty", installment_id)
    except Exception:
        await db.re_installments.update_one({"id": installment_id, "company_id": company_id}, {"$unset": {"penalty_lock": ""}})
        raise
    await db.re_installments.update_one({"id": installment_id, "company_id": company_id}, {
        "$set": {"penalty_months_charged": months, "status": "overdue"}, "$unset": {"penalty_lock": ""},
        "$inc": {"penalty_amount": penalty},
        "$push": {"penalties": {"period": period, "as_of": as_of.isoformat(), "months": new_months, "rate": rate,
                                "base": overdue, "amount": penalty, "je_id": je_id}}})
    return {"message": f"تم احتساب غرامة تأخير {penalty:,.2f} ج.م", "penalty": penalty, "months": new_months,
            "overdue_amount": overdue, "journal_entry_id": je_id}


@router.post("/bookings/{booking_id}/reschedule")
async def reschedule(booking_id: str, data: ScheduleRequest, current_user: dict = Depends(get_current_user)):
    """إعادة الجدولة: تُلغى الأقساط غير المسددة (المسدد جزئياً يُقفل بما سُدد) ويُعاد تقسيط المتبقي بالشروط الجديدة."""
    company_id = current_user["company_id"]
    start = _d(data.start_date)
    b = await _lock_booking(company_id, booking_id)
    try:
        rows = await db.re_installments.find({"company_id": company_id, "booking_id": booking_id}, {"_id": 0}).to_list(None)
        if not rows:
            raise HTTPException(400, "لا يوجد جدول أقساط — أنشئ جدولاً أولاً")
        open_rows = [r for r in rows if r["status"] in OPEN]
        remaining = P.r2(sum(r["amount"] - r.get("paid_amount", 0) for r in open_rows))
        if remaining <= 0:
            raise HTTPException(400, "لا يوجد رصيد غير مسدد لإعادة جدولته")
        if remaining / data.count < 0.01:
            raise HTTPException(400, "عدد الأقساط أكبر من المبلغ المتبقي")
        version = max(int(r.get("version") or 1) for r in rows) + 1
        new_rows = _build_rows(company_id, b, remaining, data.count, data.frequency, start,
                               max(r["seq"] for r in rows) + 1, version)
        now = datetime.now(timezone.utc).isoformat()
        for r in open_rows:
            if r.get("paid_amount", 0) > 0:     # partly paid: closes at what was paid
                upd = {"status": "paid", "original_amount": r["amount"], "amount": P.r2(r["paid_amount"]),
                       "is_partial": False, "rescheduled_at": now}
            else:
                upd = {"status": "cancelled", "rescheduled_at": now}
            await db.re_installments.update_one({"id": r["id"], "company_id": company_id, "status": {"$in": list(OPEN)}},
                                                {"$set": upd})
        await db.re_installments.insert_many([dict(r) for r in new_rows])
        await db.re_bookings.update_one({"id": booking_id, "company_id": company_id}, {"$set": {
            "schedule": {"count": data.count, "frequency": data.frequency, "start_date": start.isoformat(),
                         "total": remaining, "version": version, "rescheduled_at": now}}})
    finally:
        await _unlock_booking(company_id, booking_id)
    return {"message": f"تمت إعادة جدولة {remaining:,.2f} ج.م على {data.count} قسط", "installments": new_rows,
            "cancelled": len(open_rows), "total": remaining}


async def run_real_estate_daily(database=None) -> dict:
    """Daily job: flip due instalments past their date to overdue and tell each
    company's managers about newly overdue ones and those due within the
    policy's alert window (once per instalment). Hooked into the scheduler."""
    d = database if database is not None else db
    today = date.today()
    t = today.isoformat()
    per_co = {}
    newly = await d.re_installments.find({"status": "due", "due_date": {"$lt": t}}, {"_id": 0}).to_list(None)
    for r in newly:
        res = await d.re_installments.update_one({"id": r["id"], "company_id": r["company_id"], "status": "due"},
                                                 {"$set": {"status": "overdue", "overdue_since": t}})
        if res.modified_count:
            per_co.setdefault(r["company_id"], {"overdue": [], "soon": []})["overdue"].append(r)
    policies = {}
    soon_rows = await d.re_installments.find({"status": "due", "due_date": {"$gte": t},
                                              "due_soon_notified": {"$ne": True}}, {"_id": 0}).to_list(None)
    for r in soon_rows:
        cid = r["company_id"]
        if cid not in policies:
            doc = await d.re_policy.find_one({"company_id": cid}, {"_id": 0}) or {}
            policies[cid] = int(doc.get("due_soon_days") or DEFAULT_POLICY["due_soon_days"])
        if r["due_date"] <= (today + timedelta(days=policies[cid])).isoformat():
            await d.re_installments.update_one({"id": r["id"], "company_id": cid}, {"$set": {"due_soon_notified": True}})
            per_co.setdefault(cid, {"overdue": [], "soon": []})["soon"].append(r)
    sent = 0
    for cid, g in per_co.items():
        users = await d.users.find({"company_id": cid, "role": {"$in": MANAGER_ROLES}, "is_active": {"$ne": False}},
                                   {"_id": 0, "id": 1}).to_list(200)
        o_amt = P.r2(sum(r["amount"] - r.get("paid_amount", 0) for r in g["overdue"]))
        s_amt = P.r2(sum(r["amount"] - r.get("paid_amount", 0) for r in g["soon"]))
        parts_ar, parts_en = [], []
        if g["overdue"]:
            parts_ar.append(f"{len(g['overdue'])} قسط أصبح متأخراً بإجمالي {o_amt:,.2f} ج.م")
            parts_en.append(f"{len(g['overdue'])} instalment(s) became overdue ({o_amt:,.2f} EGP)")
        if g["soon"]:
            parts_ar.append(f"{len(g['soon'])} قسط يستحق قريباً بإجمالي {s_amt:,.2f} ج.م")
            parts_en.append(f"{len(g['soon'])} instalment(s) due soon ({s_amt:,.2f} EGP)")
        for u in users:
            await d.notifications.insert_one({
                "id": f"notif_{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{uuid.uuid4().hex[:6]}",
                "type": "real_estate_installments",
                "title_en": "Real estate instalments",
                "title_ar": "أقساط العقارات",
                "message_en": " — ".join(parts_en),
                "message_ar": " — ".join(parts_ar),
                "icon": "calendar-clock",
                "color": "red" if g["overdue"] else "amber",
                "user_id": u["id"],
                "company_id": cid,
                "data": {"overdue_ids": [r["id"] for r in g["overdue"]], "due_soon_ids": [r["id"] for r in g["soon"]],
                         "link": "/real-estate"},
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            sent += 1
    return {"newly_overdue": sum(len(g["overdue"]) for g in per_co.values()),
            "due_soon": sum(len(g["soon"]) for g in per_co.values()), "notifications": sent}
