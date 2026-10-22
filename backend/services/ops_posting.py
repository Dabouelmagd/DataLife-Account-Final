"""
Shared posting + stock helpers for the industry-operations modules
(POS, manufacturing, real estate, letters of credit, inventory engine).

Why this exists: each of those modules carried its own copy of
get_acc/je_line/post_je, and every copy had the same three faults:
  1. a missing account fell back to {"id": "<code>"} — a FAKE account id —
     so the entry either failed deep inside posting with an English error or,
     worse, was created against an account that does not exist;
  2. zero-amount lines were passed through, and the accounting service
     refuses them, so any optional cost left at 0 turned a valid operation
     into a 500;
  3. a ValueError from the accounting service (unbalanced, closed period,
     header account) surfaced as a 500 instead of a readable Arabic message,
     and left an unposted draft entry behind.
Stock was also moved with bare {"product_id": x} filters (no warehouse, and
for product_id=None it matched an arbitrary row). One helper, one behaviour.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from models.accounting import JournalEntry
from services.accounting_service import AccountingService

# accounts that only exist after a company subscribes to an industry pack
PACK_HINT = {
    "144": "باقة التطوير العقاري",
    "129": "باقة التطوير العقاري",
    "166": "باقة المطاعم",
    "167": "باقة التجزئة والفروع",
}


def _pack_hints():
    # every other pack account names its own pack (services/pack_accounts.py posts to them)
    from services.industry_packs import PACKS
    for pack in PACKS.values():
        for acc in pack["accounts"]:
            PACK_HINT.setdefault(acc[0], pack["name_ar"])


_pack_hints()


def r2(x) -> float:
    return round(float(x or 0) + 0.0, 2)


async def get_account(db, company_id: str, code: str) -> dict:
    """A postable account of this company's chart, or a 400 in Arabic."""
    acc = await db.chart_of_accounts.find_one(
        {"company_id": company_id, "account_code": code}, {"_id": 0})
    if not acc:
        hint = PACK_HINT.get(code)
        extra = f" — فعّل «{hint}» من إعدادات الحسابات أو أضف الحساب يدوياً" if hint else \
            " — أضفه إلى شجرة الحسابات أولاً"
        raise HTTPException(400, f"الحساب {code} غير موجود في شجرة حسابات الشركة{extra}")
    if acc.get("is_header") or acc.get("allow_posting") is False or \
            str(acc.get("account_category", "")).endswith("header"):
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name', '')}» حساب تجميعي — لا يقبل قيوداً مباشرة")
    if acc.get("is_active") is False:
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name', '')}» موقوف")
    return acc


async def first_account(db, company_id: str, codes: list) -> dict:
    """First existing account of `codes` (pack account first, default fallback)."""
    for c in codes:
        if await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": c}, {"_id": 1}):
            return await get_account(db, company_id, c)
    return await get_account(db, company_id, codes[-1])   # raises the readable error


async def je_line(db, company_id: str, code: str, debit=0.0, credit=0.0, desc: str = "", **extra) -> dict:
    acc = await get_account(db, company_id, code)
    line = {
        "line_id": str(uuid.uuid4()), "entry_id": None,
        "account_id": acc["id"], "account_code": acc["account_code"],
        "account_name": acc.get("account_name", code),
        "debit": r2(debit), "credit": r2(credit), "description": desc,
    }
    line.update({k: v for k, v in extra.items() if v is not None})
    return line


def totals(lines: list) -> tuple:
    return r2(sum(l["debit"] for l in lines)), r2(sum(l["credit"] for l in lines))


async def post_je(db, company_id: str, user_id: str, date_str: str, description: str,
                  lines: list, src_type: str = "manual", src_id: Optional[str] = None,
                  reference: Optional[str] = None) -> Optional[str]:
    """Create + post. Zero lines are dropped; returns None when nothing is left."""
    lines = [l for l in lines if l["debit"] or l["credit"]]
    if not lines:
        return None
    for l in lines:
        if l["debit"] < 0 or l["credit"] < 0:
            raise HTTPException(400, "مبلغ سالب في القيد — راجع المدخلات")
    td, tc = totals(lines)
    if abs(td - tc) > 0.01:
        raise HTTPException(400, f"القيد غير متوازن (مدين {td:,.2f} / دائن {tc:,.2f}) — لم يُرحَّل شيء")
    svc = AccountingService(db)
    entry = JournalEntry(company_id=company_id, entry_number=0, entry_date=date_str,
                         description=description, lines=lines, reference=reference,
                         source_document_type=src_type, source_document_id=src_id,
                         created_by=user_id)
    try:
        res = await svc.create_journal_entry(entry)
    except ValueError as e:
        raise HTTPException(400, str(e))
    try:
        await svc.post_journal_entry(res["id"], user_id)
    except ValueError as e:
        # don't leave an orphan draft behind a failed operation
        await db.journal_entries.delete_one({"id": res["id"], "status": "draft"})
        raise HTTPException(400, str(e))
    return res["id"]


# ── inventory method / accounts ──────────────────────────────────────────

async def inventory_method(db, company_id: str) -> str:
    """Same rule as InvoiceService.inventory_method — periodic unless set."""
    c = await db.companies.find_one({"id": company_id}, {"_id": 0, "inventory_method": 1}) or {}
    return "perpetual" if c.get("inventory_method") == "perpetual" else "periodic"


async def stock_account(db, company_id: str, kind: str = "goods") -> str:
    """Where purchased stock is carried.

    perpetual: goods for resale 125, raw materials 121, finished goods 122.
    periodic : purchases are an expense (311) and the period-end count
               adjusts — exactly what invoice_service posts for a purchase
               invoice, so a receipt through any other door must match it.
    """
    if await inventory_method(db, company_id) == "periodic":
        return "311"
    return {"goods": "125", "raw": "121", "finished": "122"}.get(kind, "125")


async def default_warehouse_id(db, company_id: str) -> str:
    wh = await db.warehouses.find_one({"company_id": company_id, "is_default": True}, {"_id": 0, "id": 1}) \
        or await db.warehouses.find_one({"company_id": company_id}, {"_id": 0, "id": 1})
    # "main" is what invoice_service uses when an invoice line names no warehouse
    return (wh or {}).get("id") or "main"


async def get_product(db, company_id: str, product_id: str) -> dict:
    p = await db.products.find_one({"id": product_id, "company_id": company_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "الصنف غير موجود")
    return p


async def get_stock(db, company_id: str, product_id: str, warehouse_id: str) -> dict:
    return await db.stocks.find_one(
        {"company_id": company_id, "product_id": product_id, "warehouse_id": warehouse_id},
        {"_id": 0}) or {}


async def average_cost(db, company_id: str, product_id: str, warehouse_id: Optional[str] = None) -> float:
    """Moving average cost: this warehouse's, else all warehouses', else product cost_price."""
    if warehouse_id:
        s = await get_stock(db, company_id, product_id, warehouse_id)
        if float(s.get("unit_cost") or 0) > 0:
            return round(float(s["unit_cost"]), 4)
    rows = await db.stocks.find({"company_id": company_id, "product_id": product_id}, {"_id": 0}).to_list(None)
    q = sum(max(float(r.get("quantity") or 0), 0) for r in rows)
    v = sum(max(float(r.get("quantity") or 0), 0) * float(r.get("unit_cost") or 0) for r in rows)
    if q > 0 and v > 0:
        return round(v / q, 4)
    p = await db.products.find_one({"id": product_id, "company_id": company_id}, {"_id": 0, "cost_price": 1}) or {}
    return round(float(p.get("cost_price") or 0), 4)


async def _movement(db, company_id, product_id, warehouse_id, qty, unit_cost, mtype, date_str,
                    source_type, source_id, user_id, product_name=""):
    await db.stock_movements.insert_one({
        "id": str(uuid.uuid4()), "company_id": company_id, "product_id": product_id,
        "product_name": product_name, "warehouse_id": warehouse_id,
        "movement_type": mtype, "movement_date": date_str,
        "quantity": round(qty, 3), "unit_cost": round(unit_cost, 4), "total_cost": r2(qty * unit_cost),
        "source_document_type": source_type, "source_document_id": source_id,
        "created_by": user_id, "created_at": datetime.now(timezone.utc).isoformat()})


async def stock_in(db, company_id: str, product_id: str, warehouse_id: str, qty: float, unit_cost: float,
                   *, date_str: str, source_type: str, source_id: str, user_id: str,
                   mtype: str = "purchase", product_name: str = "") -> float:
    """Receive qty at unit_cost into one warehouse; moving average; returns new average."""
    s = await get_stock(db, company_id, product_id, warehouse_id)
    old_q, old_c = float(s.get("quantity") or 0), float(s.get("unit_cost") or 0)
    new_q = old_q + qty
    # a negative or zero opening balance cannot be averaged into
    new_c = round((max(old_q, 0) * old_c + qty * unit_cost) / (max(old_q, 0) + qty), 4) if qty > 0 else old_c
    await db.stocks.update_one(
        {"company_id": company_id, "product_id": product_id, "warehouse_id": warehouse_id},
        {"$set": {"quantity": round(new_q, 3), "available_qty": round(new_q - float(s.get("reserved_qty") or 0), 3),
                  "unit_cost": new_c, "average_cost": new_c, "total_value": r2(new_q * new_c),
                  "product_name": s.get("product_name") or product_name,
                  "last_movement_date": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True)
    await _movement(db, company_id, product_id, warehouse_id, qty, unit_cost, mtype, date_str,
                    source_type, source_id, user_id, product_name)
    return new_c


async def stock_out(db, company_id: str, product_id: str, warehouse_id: str, qty: float, unit_cost: float,
                    *, date_str: str, source_type: str, source_id: str, user_id: str,
                    mtype: str = "sales", product_name: str = "") -> None:
    s = await get_stock(db, company_id, product_id, warehouse_id)
    new_q = float(s.get("quantity") or 0) - qty
    cost = float(s.get("unit_cost") or unit_cost or 0)
    await db.stocks.update_one(
        {"company_id": company_id, "product_id": product_id, "warehouse_id": warehouse_id},
        {"$set": {"quantity": round(new_q, 3), "available_qty": round(new_q - float(s.get("reserved_qty") or 0), 3),
                  "total_value": r2(new_q * cost), "product_name": s.get("product_name") or product_name,
                  "last_movement_date": datetime.now(timezone.utc).isoformat()},
         "$setOnInsert": {"id": str(uuid.uuid4()), "unit_cost": cost}},
        upsert=True)
    await _movement(db, company_id, product_id, warehouse_id, -qty, unit_cost, mtype, date_str,
                    source_type, source_id, user_id, product_name)


async def require_stock(db, company_id: str, product_id: str, warehouse_id: str, qty: float, name: str = ""):
    s = await get_stock(db, company_id, product_id, warehouse_id)
    have = float(s.get("quantity") or 0)
    if have + 1e-9 < qty:
        wh = await db.warehouses.find_one({"id": warehouse_id, "company_id": company_id}, {"_id": 0, "allow_negative": 1}) or {}
        if not wh.get("allow_negative"):
            raise HTTPException(400, f"رصيد غير كافٍ من {name or 'الصنف'} — المتاح {have:g} والمطلوب {qty:g}")
    return s
