"""
أعمال منجزة لم تُفوتر — Work done, not yet billed (one mechanism, three packs).

    construction  143 إيرادات مستحقة غير مفوترة — أعمال منجزة
    professional  150 خدمات واستشارات تحت التنفيذ — ساعات غير مفوترة
    ads           149 حملات وإنتاجات إعلانية تحت التنفيذ

Recording work done before its claim / invoice exists (accrual, EAS 8 / EAS 48):
    Dr 143|150|149          Cr the revenue account the billing will credit
When the billing is issued for the same project — an owner progress claim, a
project revenue, a sales invoice tagged with the project — the open accruals of
that project are released oldest first, up to the billed amount:
    Dr the accrual's revenue account     Cr 143|150|149
so the revenue is counted once: early by the accrual, then the billing's own
revenue line replaces it. A release can also be made by hand (work that will
not be billed). Undoing the billing (a cancelled project revenue) reverses its
release and re-opens the accrual.

Pack-only: a company without any of the three accounts gets a readable Arabic
400 naming the packs, and its billings are untouched (no accrual → nothing to
release, no query beyond one lookup).
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from services import ops_posting as P
from services import pack_accounts as PA

# the revenue account an accrual credits by default (first one in the chart wins)
REVENUE_FOR = {
    "143": ["414", "431", "412"],   # إيرادات مقاولات (مستخلصات) — كما يقيّد المستخلص
    "150": ["416", "412"],          # إيرادات استشارات مهنية — كما تقيّد فاتورة الخدمات المهنية
    "149": ["412"],                 # إيراد تقديم خدمات
}
LABEL = {
    "143": "أعمال منجزة لم تُفوتر (مقاولات)",
    "150": "ساعات وخدمات منجزة لم تُفوتر",
    "149": "حملات منفذة لم تُفوتر",
}
PACK_MSG = ("إثبات الأعمال المنجزة غير المفوترة يحتاج أحد الحسابات 143 أو 150 أو 149 — فعّل «"
            + P.PACK_HINT.get("143", "باقة المقاولات والتشييد") + "» أو «"
            + P.PACK_HINT.get("150", "باقة المكاتب المهنية والاستشارية") + "» أو «"
            + P.PACK_HINT.get("149", "باقة الإعلان والميديا") + "» من إعدادات الحسابات")


def _kind(t) -> str:
    return str(getattr(t, "value", t) or "").lower()


async def wip_accounts(db, company_id: str) -> list:
    out = []
    for code in PA.codes("unbilled_work"):
        acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": code}, {"_id": 0})
        if PA.postable(acc):
            out.append(acc)
    return out


async def revenue_options(db, company_id: str) -> list:
    rows = await db.chart_of_accounts.find({"company_id": company_id}, {"_id": 0}).to_list(None)
    return [{"account_code": a["account_code"], "account_name": a.get("account_name", "")}
            for a in sorted(rows, key=lambda a: a["account_code"])
            if _kind(a.get("account_type")) == "revenue" and PA.postable(a)]


async def _default_revenue(db, company_id: str, wip_code: str) -> str:
    for code in REVENUE_FOR.get(wip_code, ["412"]):
        if PA.postable(await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": code}, {"_id": 0})):
            return code
    raise HTTPException(400, "لا يوجد حساب إيراد مناسب — اختر حساب الإيراد")


async def record(db, company_id: str, user_id: str, *, project: dict, amount: float, date: str,
                 description: str, wip_code: Optional[str] = None, revenue_code: Optional[str] = None) -> dict:
    """Dr 143|150|149 / Cr revenue — work done on `project` not billed yet."""
    accounts = await wip_accounts(db, company_id)
    if not accounts:
        raise HTTPException(400, PACK_MSG)
    amount = P.r2(amount)
    if amount <= 0:
        raise HTTPException(400, "قيمة الأعمال المنجزة يجب أن تكون أكبر من صفر")
    if len(str(description or "").strip()) < 3:
        raise HTTPException(400, "اكتب بياناً واضحاً للأعمال المنجزة")
    if not date or date > datetime.now(timezone.utc).strftime("%Y-%m-%d"):
        raise HTTPException(400, "التاريخ مطلوب ولا يكون في المستقبل — الأعمال تُثبت بتاريخ تنفيذها")
    codes = [a["account_code"] for a in accounts]
    if wip_code and wip_code not in codes:
        raise HTTPException(400, f"الحساب {wip_code} غير متاح — المتاح: {'، '.join(codes)}")
    wip = wip_code or codes[0]
    rev = revenue_code or await _default_revenue(db, company_id, wip)
    rev_acc = await P.get_account(db, company_id, rev)
    if _kind(rev_acc.get("account_type")) != "revenue":
        raise HTTPException(400, f"الحساب {rev} ليس حساب إيراد")
    pid, pname = project["id"], project.get("name") or project["id"]
    acc_id = str(uuid.uuid4())
    text = f"{LABEL.get(wip, 'أعمال منجزة لم تُفوتر')} — {pname}: {description.strip()}"[:200]
    lines = [
        await P.je_line(db, company_id, wip, debit=amount, desc=text, project_id=pid),
        await P.je_line(db, company_id, rev, credit=amount, desc=text, project_id=pid),
    ]
    je_id = await P.post_je(db, company_id, user_id, date, text, lines, "unbilled_work", acc_id)
    doc = {"id": acc_id, "company_id": company_id, "project_id": pid, "project_name": pname,
           "wip_account": wip, "revenue_account": rev, "amount": amount, "released": 0.0, "remaining": amount,
           "status": "open", "date": date, "description": description.strip()[:300], "journal_entry_id": je_id,
           "releases": [], "created_by": user_id, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.unbilled_work.insert_one(dict(doc))
    return doc


async def open_items(db, company_id: str, project_id: str) -> list:
    return await db.unbilled_work.find(
        {"company_id": company_id, "project_id": project_id, "status": {"$in": ["open", "partial"]}},
        {"_id": 0}).sort([("date", 1), ("created_at", 1)]).to_list(None)


async def release(db, company_id: str, user_id: str, *, project_id: Optional[str], date: str,
                  source_type: str, source_id: str, amount: Optional[float] = None,
                  accrual_id: Optional[str] = None, note: str = "") -> Optional[dict]:
    """Release open accruals of a project (or one accrual), oldest first, up to
    `amount` (None = everything open): Dr revenue / Cr 143|150|149.
    Returns None when nothing was open — the caller's billing is untouched."""
    if not project_id and not accrual_id:
        return None
    if accrual_id:
        items = await db.unbilled_work.find({"company_id": company_id, "id": accrual_id,
                                             "status": {"$in": ["open", "partial"]}}, {"_id": 0}).to_list(1)
    else:
        items = await open_items(db, company_id, project_id)
    if not items:
        return None
    left = None if amount is None else P.r2(amount)
    parts = []
    for it in items:
        if left is not None and left <= 0:
            break
        rem = P.r2(it.get("remaining", 0))
        take = rem if left is None else P.r2(min(rem, left))
        if take <= 0:
            continue
        parts.append((it, take))
        if left is not None:
            left = P.r2(left - take)
    if not parts:
        return None
    total = P.r2(sum(t for _, t in parts))
    text = (note or "تسوية أعمال منجزة غير مفوترة عند الفوترة")[:200]
    lines = []
    for it, take in parts:
        lines.append(await P.je_line(db, company_id, it["revenue_account"], debit=take,
                                     desc=f"{text} — {it['description']}"[:200], project_id=it["project_id"]))
        lines.append(await P.je_line(db, company_id, it["wip_account"], credit=take,
                                     desc=f"إقفال {LABEL.get(it['wip_account'], 'أعمال غير مفوترة')} — {it['project_name']}"[:200],
                                     project_id=it["project_id"]))
    rel_id = str(uuid.uuid4())
    je_id = await P.post_je(db, company_id, user_id, date, text, lines, "unbilled_release", rel_id)
    now = datetime.now(timezone.utc).isoformat()
    for it, take in parts:
        released = P.r2(float(it.get("released") or 0) + take)
        remaining = P.r2(float(it["amount"]) - released)
        await db.unbilled_work.update_one({"company_id": company_id, "id": it["id"]}, {
            "$set": {"released": released, "remaining": remaining,
                     "status": "billed" if remaining <= 0.005 else "partial"},
            "$push": {"releases": {"id": rel_id, "amount": take, "date": date, "source_type": source_type,
                                   "source_id": source_id, "journal_entry_id": je_id, "at": now}}})
    return {"release_id": rel_id, "journal_entry_id": je_id, "released": total,
            "accruals": [it["id"] for it, _ in parts]}


async def undo_release(db, company_id: str, user_id: str, source_type: str, source_id: str) -> int:
    """The billing behind a release was cancelled: reverse the release entry
    and re-open what it consumed. Returns how many releases were undone."""
    from services.accounting_service import AccountingService
    rows = await db.unbilled_work.find({"company_id": company_id, "releases.source_type": source_type,
                                        "releases.source_id": source_id}, {"_id": 0}).to_list(None)
    done = set()
    for it in rows:
        for r in it.get("releases") or []:
            if r.get("source_type") != source_type or r.get("source_id") != source_id or r.get("undone"):
                continue
            if r["journal_entry_id"] not in done:
                try:
                    await AccountingService(db).reverse_journal_entry(r["journal_entry_id"], user_id, r.get("date"))
                except ValueError as e:
                    raise HTTPException(400, f"تعذّر عكس تسوية الأعمال غير المفوترة: {e}")
                done.add(r["journal_entry_id"])
            r["undone"] = True
            it["released"] = P.r2(float(it.get("released") or 0) - float(r["amount"]))
        remaining = P.r2(float(it["amount"]) - it["released"])
        await db.unbilled_work.update_one({"company_id": company_id, "id": it["id"]}, {"$set": {
            "releases": it["releases"], "released": it["released"], "remaining": remaining,
            "status": "open" if it["released"] <= 0.005 else ("billed" if remaining <= 0.005 else "partial")}})
    return len(done)


async def summary(db, company_id: str, project_id: str) -> dict:
    accounts = await wip_accounts(db, company_id)
    items = await db.unbilled_work.find({"company_id": company_id, "project_id": project_id},
                                        {"_id": 0}).sort("date", -1).to_list(None)
    return {
        "available": bool(accounts),
        "message": None if accounts else PACK_MSG,
        "wip_accounts": [{"account_code": a["account_code"], "account_name": a.get("account_name", ""),
                          "default_revenue": await _default_revenue(db, company_id, a["account_code"])}
                         for a in accounts],
        "revenue_accounts": await revenue_options(db, company_id) if accounts else [],
        "items": items,
        "open_total": P.r2(sum(float(i.get("remaining") or 0) for i in items if i.get("status") in ("open", "partial"))),
    }
