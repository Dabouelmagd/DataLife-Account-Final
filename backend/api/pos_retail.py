"""
POS, Retail & F&B Engine — محرك نقاط البيع والتجزئة والمطاعم

1. إدارة الوردية (Shift Management)
   - فتح وردية الكاشير مع رصيد افتتاحي
   - تسجيل المبيعات خلال الوردية
   - إغلاق الوردية وتسوية النقدية
   - معالجة عجز أو زيادة الكاشير

2. تالف وهدر المواد الغذائية (Waste & Spoilage)
   Dr م/3361 مصروف تالف وهدر مواد
   Cr م/1241 مخزون الأغذية والمشروبات
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

router = APIRouter(prefix="/api/pos", tags=["POS & Retail"])

# ══════════════════════════════════════════════════════════════
# ACCOUNT CODES
# ══════════════════════════════════════════════════════════════
ACC = {
    "cash_drawer":      "1631",  # نقدية الخزينة — وردية POS
    "shortage_ar":      "1632",  # عجز النقدية (ذمة الكاشير)
    "shortage_exp":     "3351",  # مصروف عجز مسموح به
    "surplus_rev":      "4231",  # إيراد زيادة النقدية
    "pos_sales":        "4121",  # إيرادات مبيعات POS
    "vat_output":       "260",   # VAT مخرجات
    "service_charge":   "412",   # رسوم خدمة (مطاعم)
    "fnb_inventory":    "1241",  # مخزون الأغذية والمشروبات
    "waste_exp":        "3361",  # مصروف تالف وهدر
    "cogs":             "311",   # تكلفة المبيعات
    "bank":             "112",
    "cash":             "161",   # الخزينة الرئيسية
    "ar":               "131",
}

CASH_SHORTAGE_TOLERANCE = 50.0   # ج.م — العجز المسموح لكل وردية (قابل للتكوين)


async def get_acc(company_id: str, code: str) -> dict:
    a = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0}
    )
    return a or {"id": code, "account_code": code, "account_name": f"حساب {code}"}


async def je_line(company_id: str, code: str,
                  debit=0.0, credit=0.0, desc="") -> dict:
    acc = await get_acc(company_id, code)
    return {
        "line_id": str(uuid.uuid4()), "entry_id": None,
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


# ══════════════════════════════════════════════════════════════
# 1. SHIFT MANAGEMENT — إدارة الوردية
# ══════════════════════════════════════════════════════════════

class OpenShiftRequest(BaseModel):
    cashier_id:      str
    cashier_name:    str
    terminal_id:     str = "POS-01"
    opening_cash:    float = 0.0   # الرصيد الافتتاحي للوردية
    shift_date:      str


@router.post("/shifts/open")
async def open_shift(req: OpenShiftRequest,
                     current_user: dict = Depends(get_current_user)):
    """
    فتح وردية جديدة للكاشير

    إن كان هناك رصيد افتتاحي مستلم:
    Dr م/1631 نقدية الخزينة — وردية POS
    Cr م/161 الخزينة الرئيسية
    """
    company_id = current_user["company_id"]

    # Check no open shift for same cashier/terminal
    existing = await db.pos_shifts.find_one({
        "company_id": company_id, "cashier_id": req.cashier_id,
        "status": "open"
    })
    if existing:
        raise HTTPException(400, f"الكاشير {req.cashier_name} لديه وردية مفتوحة بالفعل")

    shift_id = str(uuid.uuid4())
    je_id    = None

    # Opening cash journal
    if req.opening_cash > 0:
        lines = await asyncio.gather(
            je_line(company_id, ACC["cash_drawer"], debit=req.opening_cash,
                    desc=f"رصيد افتتاحي وردية {req.cashier_name} — {req.terminal_id}"),
            je_line(company_id, ACC["cash"], credit=req.opening_cash,
                    desc=f"صرف عهدة وردية كاشير {req.cashier_name}"),
        )
        je_id = await post_je(company_id, current_user["user_id"], req.shift_date,
            f"فتح وردية — {req.cashier_name} — {req.terminal_id}", list(lines), shift_id)

    shift = {
        "id": shift_id, "company_id": company_id,
        "cashier_id":   req.cashier_id,
        "cashier_name": req.cashier_name,
        "terminal_id":  req.terminal_id,
        "shift_date":   req.shift_date,
        "open_time":    datetime.now(timezone.utc).isoformat(),
        "close_time":   None,
        "status":       "open",
        "opening_cash": req.opening_cash,
        "total_sales":  0.0,
        "total_cash_sales":  0.0,
        "total_card_sales":  0.0,
        "total_wallet_sales": 0.0,
        "total_vat":    0.0,
        "transactions_count": 0,
        "open_je_id":   je_id,
        "created_at":   datetime.now(timezone.utc).isoformat(),
    }
    await db.pos_shifts.insert_one(shift); shift.pop("_id", None)

    return {
        "message": f"تم فتح وردية الكاشير {req.cashier_name}",
        "shift":   shift,
        "shift_id": shift_id,
    }


@router.post("/shifts/{shift_id}/sale")
async def record_sale(shift_id: str, data: dict,
                      current_user: dict = Depends(get_current_user)):
    """تسجيل عملية بيع خلال الوردية (يتراكم في الوردية)"""
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one(
        {"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    if shift["status"] != "open":
        raise HTTPException(400, "الوردية مغلقة")

    amount         = float(data.get("amount", 0))
    vat            = float(data.get("vat", 0))
    payment_method = data.get("payment_method", "cash")
    receipt_num    = data.get("receipt_number", "")

    # Update shift totals
    update = {
        "$inc": {
            "total_sales":        amount,
            "total_vat":          vat,
            "transactions_count": 1,
        }
    }
    if payment_method == "cash":
        update["$inc"]["total_cash_sales"] = amount
    elif payment_method == "card":
        update["$inc"]["total_card_sales"] = amount
    else:
        update["$inc"]["total_wallet_sales"] = amount

    # Record transaction
    txn = {
        "id": str(uuid.uuid4()), "company_id": company_id,
        "shift_id": shift_id, "receipt_number": receipt_num,
        "amount": amount, "vat": vat,
        "payment_method": payment_method,
        "items": data.get("items", []),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.pos_transactions.insert_one(txn)
    await db.pos_shifts.update_one({"id": shift_id}, update)

    return {"message": "تم تسجيل البيع", "transaction_id": txn["id"]}


@router.post("/shifts/{shift_id}/close")
async def close_shift(shift_id: str, data: dict,
                      current_user: dict = Depends(get_current_user)):
    """
    إغلاق الوردية وتسوية النقدية

    ══ حالة الرصيد الفعلي = المبيعات النقدية (لا فرق) ══
    Dr م/161 الخزينة الرئيسية      ← المبيعات النقدية
    Dr م/112 البنك (محافظ/بطاقات) ← المبيعات غير النقدية
    Cr م/4121 إيرادات مبيعات POS   ← إجمالي المبيعات (بدون VAT)
    Cr م/260 VAT مخرجات             ← ضريبة القيمة المضافة

    ══ حالة العجز (actual_cash < expected_cash) ══
    Dr م/161 الخزينة (رصيد فعلي)
    Dr م/1632 عجز كاشير (ذمة) أو م/3351 عجز مسموح
    Dr م/112 بنك (بطاقات + محافظ)
    Cr م/4121 إيرادات POS
    Cr م/260 VAT

    ══ حالة الزيادة (actual_cash > expected_cash) ══
    Dr م/161 الخزينة (رصيد فعلي)
    Dr م/112 بنك
    Cr م/4121 إيرادات POS
    Cr م/260 VAT
    Cr م/4231 إيراد زيادة نقدية
    """
    company_id = current_user["company_id"]
    shift = await db.pos_shifts.find_one(
        {"id": shift_id, "company_id": company_id}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    if shift["status"] != "open":
        raise HTTPException(400, "الوردية مغلقة بالفعل")

    actual_cash    = float(data.get("actual_cash", 0))     # الرصيد الفعلي عند الجرد
    date_str       = data.get("date", shift["shift_date"])
    tolerance      = float(data.get("shortage_tolerance", CASH_SHORTAGE_TOLERANCE))

    total_sales    = float(shift["total_sales"])
    total_vat      = float(shift["total_vat"])
    cash_sales     = float(shift["total_cash_sales"])
    card_sales     = float(shift["total_card_sales"])
    wallet_sales   = float(shift["total_wallet_sales"])
    opening_cash   = float(shift["opening_cash"])

    # الرصيد النقدي المتوقع = رصيد الافتتاح + مبيعات نقدية
    expected_cash  = round(opening_cash + cash_sales, 2)
    cash_diff      = round(actual_cash - expected_cash, 2)  # + زيادة | - عجز
    actual_net     = round(actual_cash - opening_cash, 2)  # صافي ما حصّله الكاشير
    net_sales      = round(total_sales - total_vat, 2)

    lines = []

    # ── الجانب المدين: ما وُجِد فعلاً ───────────────────────
    # نقدية الوردية (صافي = الفعلي - الرصيد الافتتاحي)
    # الرصيد الافتتاحي تمت معالجته في قيد فتح الوردية
    actual_net = round(actual_cash - opening_cash, 2)
    lines.append(await je_line(
        company_id, ACC["cash"], debit=actual_net,
        desc=f"نقدية وردية {shift['cashier_name']} ({shift['terminal_id']}) صافي الوردية"))

    # بطاقات ومحافظ إلكترونية
    if card_sales > 0:
        lines.append(await je_line(
            company_id, ACC["bank"], debit=card_sales,
            desc=f"مبيعات بطاقات — وردية {shift['cashier_name']}"))
    if wallet_sales > 0:
        lines.append(await je_line(
            company_id, ACC["bank"], debit=wallet_sales,
            desc=f"مبيعات محافظ إلكترونية — وردية {shift['cashier_name']}"))

    # معالجة الفروق النقدية
    shortage_type = None
    if cash_diff < 0:
        # ── عجز نقدية ──────────────────────────────────────
        shortage_amount = abs(cash_diff)
        if shortage_amount <= tolerance:
            # عجز مسموح به → مصروف
            lines.append(await je_line(
                company_id, ACC["shortage_exp"], debit=shortage_amount,
                desc=f"عجز نقدية مسموح به — {shift['cashier_name']} ({shortage_amount:.2f})"))
            shortage_type = "allowable"
        else:
            # عجز غير مسموح → ذمة الكاشير
            lines.append(await je_line(
                company_id, ACC["shortage_ar"], debit=shortage_amount,
                desc=f"عجز نقدية كاشير {shift['cashier_name']} — ذمة مستحقة"))
            shortage_type = "cashier_receivable"

    elif cash_diff > 0:
        # ── زيادة نقدية → إيراد ──────────────────────────
        lines.append(await je_line(
            company_id, ACC["surplus_rev"], credit=cash_diff,
            desc=f"زيادة نقدية — وردية {shift['cashier_name']} ({cash_diff:.2f})"))
        shortage_type = "surplus"

    # ── الجانب الدائن: الإيرادات ─────────────────────────
    lines.append(await je_line(
        company_id, ACC["pos_sales"], credit=net_sales,
        desc=f"إيرادات مبيعات POS — {shift['cashier_name']} — {date_str}"))

    if total_vat > 0:
        lines.append(await je_line(
            company_id, ACC["vat_output"], credit=total_vat,
            desc=f"VAT مبيعات وردية {shift['cashier_name']}"))

    # Balance check
    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)
    balanced = abs(td - tc) < 0.01

    je_id = await post_je(company_id, current_user["user_id"], date_str,
        f"إغلاق وردية {shift['cashier_name']} — {shift['terminal_id']} — {date_str}",
        lines, shift_id)

    # Return opening cash to main safe
    if opening_cash > 0:
        ret_lines = await asyncio.gather(
            je_line(company_id, ACC["cash"], debit=opening_cash,
                    desc=f"إعادة عهدة وردية — {shift['cashier_name']}"),
            je_line(company_id, ACC["cash_drawer"], credit=opening_cash,
                    desc=f"إغلاق حساب نقدية الوردية — {shift['cashier_name']}"),
        )
        await post_je(company_id, current_user["user_id"], date_str,
            f"إعادة عهدة وردية — {shift['cashier_name']}", list(ret_lines), shift_id)

    # Update shift
    await db.pos_shifts.update_one({"id": shift_id}, {"$set": {
        "status": "closed", "close_time": datetime.now(timezone.utc).isoformat(),
        "actual_cash": actual_cash, "expected_cash": expected_cash,
        "cash_difference": cash_diff, "shortage_type": shortage_type,
        "close_je_id": je_id,
    }})

    return {
        "message":  f"تم إغلاق وردية {shift['cashier_name']}",
        "shift_summary": {
            "cashier":        shift["cashier_name"],
            "terminal":       shift["terminal_id"],
            "date":           date_str,
            "total_sales":    total_sales,
            "total_vat":      total_vat,
            "net_sales":      net_sales,
            "cash_sales":     cash_sales,
            "card_sales":     card_sales,
            "wallet_sales":   wallet_sales,
            "opening_cash":   opening_cash,
            "expected_cash":  expected_cash,
            "actual_cash":    actual_cash,
            "cash_difference": cash_diff,
            "shortage_type":  shortage_type,
            "transactions":   shift["transactions_count"],
        },
        "journal": {
            "id":       je_id,
            "debit":    td,
            "credit":   tc,
            "balanced": balanced,
        },
        "cash_diff_note": (
            "زيادة نقدية → إيراد م/4231" if cash_diff > 0 else
            f"عجز مسموح ({abs(cash_diff):.2f}) → مصروف م/3351" if shortage_type == "allowable" else
            f"عجز غير مسموح ({abs(cash_diff):.2f}) → ذمة الكاشير م/1632" if shortage_type == "cashier_receivable" else
            "لا فروق نقدية ✅"
        ),
    }


# ══════════════════════════════════════════════════════════════
# 2. WASTE & SPOILAGE — تالف وهدر المواد الغذائية
# ══════════════════════════════════════════════════════════════

class SpoilageRequest(BaseModel):
    date:          str
    items: List[dict]  # [{product_id, product_name, qty, unit_cost, reason}]
    approved_by:   Optional[str] = None
    notes:         Optional[str] = None
    inventory_account: str = "1241"  # F&B inventory default


@router.post("/spoilage")
async def record_spoilage(req: SpoilageRequest,
                           current_user: dict = Depends(get_current_user)):
    """
    تسجيل تالف وهدر المواد الغذائية والتشغيلية

    القيد:
    Dr م/3361 مصروف تالف وهدر مواد (F&B)
    Cr م/1241 مخزون الأغذية والمشروبات

    يُحدِّث مخزون الصنف تلقائياً
    """
    company_id = current_user["company_id"]
    spoilage_id = str(uuid.uuid4())

    total_cost = round(sum(float(i["qty"]) * float(i["unit_cost"]) for i in req.items), 2)
    if total_cost <= 0:
        raise HTTPException(400, "يجب إدخال بنود بتكلفة موجبة")

    inv_acc = req.inventory_account  # can be 1241 (F&B) or 121 (raw materials)

    lines = [
        await je_line(company_id, ACC["waste_exp"], debit=total_cost,
                      desc=f"تالف وهدر مواد — {len(req.items)} صنف — {req.date}")
    ]

    item_details = []
    for item in req.items:
        qty        = float(item["qty"])
        unit_cost  = float(item["unit_cost"])
        line_cost  = round(qty * unit_cost, 2)
        reason     = item.get("reason", "تالف")
        pname      = item.get("product_name", item.get("product_id",""))

        lines.append(await je_line(
            company_id, inv_acc, credit=line_cost,
            desc=f"هدر {pname} — {qty} وحدة × {unit_cost} — {reason}"))

        # Reduce stock
        if item.get("product_id"):
            await db.stocks.update_one(
                {"product_id": item["product_id"], "company_id": company_id},
                {"$inc": {"quantity": -qty}}
            )

        item_details.append({
            "product_id":   item.get("product_id",""),
            "product_name": pname,
            "qty":          qty,
            "unit_cost":    unit_cost,
            "total_cost":   line_cost,
            "reason":       reason,
        })

    # Validate balance
    td = round(sum(l["debit"]  for l in lines), 2)
    tc = round(sum(l["credit"] for l in lines), 2)

    je_id = await post_je(company_id, current_user["user_id"], req.date,
        f"تالف وهدر مواد — {req.date}", lines, spoilage_id)

    # Save spoilage record
    record = {
        "id": spoilage_id, "company_id": company_id,
        "date": req.date, "items": item_details,
        "total_cost": total_cost,
        "approved_by": req.approved_by,
        "notes": req.notes,
        "journal_entry_id": je_id,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.spoilage_records.insert_one(record); record.pop("_id", None)

    return {
        "message":  f"تم تسجيل تالف {len(req.items)} صنف — إجمالي {total_cost:,.2f} ج.م",
        "record":   record,
        "journal": {
            "id":     je_id,
            "debit":  f"م/3361 مصروف تالف وهدر مواد  {total_cost:,.2f}",
            "credit": f"م/{inv_acc} مخزون الأغذية والمشروبات  {total_cost:,.2f}",
            "balanced": abs(td - tc) < 0.01,
        }
    }


@router.get("/spoilage/report")
async def spoilage_report(
    date_from: str = Query(...),
    date_to:   str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """تقرير التالف والهدر خلال فترة"""
    company_id = current_user["company_id"]
    records = await db.spoilage_records.find({
        "company_id": company_id,
        "date": {"$gte": date_from, "$lte": date_to}
    }, {"_id": 0}).sort("date", -1).to_list(None)

    total = round(sum(r["total_cost"] for r in records), 2)
    return {
        "period":       {"from": date_from, "to": date_to},
        "records_count": len(records),
        "total_waste_cost": total,
        "records":      records,
    }


# ══════════════════════════════════════════════════════════════
# READ ENDPOINTS
# ══════════════════════════════════════════════════════════════

@router.get("/shifts")
async def list_shifts(
    status: Optional[str] = None,
    cashier_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    page: int = 1, limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status:     q["status"]     = status
    if cashier_id: q["cashier_id"] = cashier_id
    if date_from or date_to:
        q["shift_date"] = {}
        if date_from: q["shift_date"]["$gte"] = date_from
        if date_to:   q["shift_date"]["$lte"] = date_to

    total  = await db.pos_shifts.count_documents(q)
    shifts = await db.pos_shifts.find(q, {"_id": 0}).sort(
        "shift_date", -1).skip((page-1)*limit).limit(limit).to_list(None)

    return {
        "shifts": shifts, "total": total, "page": page,
        "summary": {
            "total_sales":     round(sum(float(s.get("total_sales",0))     for s in shifts), 2),
            "total_cash":      round(sum(float(s.get("total_cash_sales",0)) for s in shifts), 2),
            "total_card":      round(sum(float(s.get("total_card_sales",0)) for s in shifts), 2),
            "cash_shortages":  sum(1 for s in shifts if (s.get("cash_difference",0) or 0) < 0),
            "cash_surpluses":  sum(1 for s in shifts if (s.get("cash_difference",0) or 0) > 0),
        }
    }


@router.get("/shifts/{shift_id}")
async def get_shift(shift_id: str, current_user: dict = Depends(get_current_user)):
    shift = await db.pos_shifts.find_one(
        {"id": shift_id, "company_id": current_user["company_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "الوردية غير موجودة")
    # Include transactions
    txns = await db.pos_transactions.find(
        {"shift_id": shift_id, "company_id": current_user["company_id"]}, {"_id": 0}
    ).to_list(None)
    shift["transactions"] = txns
    return shift
