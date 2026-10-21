"""
Bank Reconciliation — التسوية البنكية

1. استيراد كشف الحساب البنكي (CSV / XLSX — عناوين عربية أو إنجليزية، وتصدير InstaPay)
   لحساب بنك من دليل الحسابات (16x). الملف نفسه لا يُستورد مرتين (بصمة SHA-256).
2. المطابقة التلقائية: كل سطر في الكشف مع سطر قيد مُرحَّل على نفس حساب البنك —
   نفس المبلغ والاتجاه، والتاريخ في حدود ±3 أيام، وتطابق المرجع / رقم الشيك يرفع
   الأولوية. المطابقة واحد لواحد. الشيكات المحصلة / المصروفة من «الخزينة والشيكات»
   تدخل بقيود تحصيلها وصرفها ويُستخدم رقم الشيك كمرجع.
3. مطابقة يدوية / فك مطابقة.
4. ترحيل البنود التي لم تُسجَّل في الدفاتر (مصروفات وعمولات بنكية، فوائد دائنة).
5. مذكرة التسوية: رصيد الكشف + إيداعات بالطريق − شيكات لم تُصرف = الرصيد المعدَّل
   للبنك، ويقابله رصيد الدفاتر ± بنود الكشف غير المسجلة = الرصيد المعدَّل للدفاتر.

Sign convention: every amount is signed from the COMPANY's side —
  + money into the bank  (statement "credit" / book debit on the bank account)
  − money out of the bank (statement "debit"  / book credit on the bank account)
"""
import csv
import hashlib
import io
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from database import db
from dependencies import get_current_user
from models.accounting import JournalEntry, JournalEntryLine
from services.accounting_service import AccountingService

router = APIRouter(prefix="/api/bank-reconciliation", tags=["Bank Reconciliation"])

DATE_WINDOW_DAYS = 3
BANK_CHARGES_CODE = "334"     # مصروفات وعمولات بنكية
INTEREST_INCOME_CODE = "422"  # إيرادات فوائد دائنة
NOT_MONEY_CODES = {"163", "165", "1651"}
BOOK_STATUSES = ["posted", "reversed"]   # a reversed entry stays in the ledger; its reversal offsets it
IMPORT_LIMIT = 20 * 1024 * 1024


# ══════════════════════════════════════════════════════════════
# Parsing helpers
# ══════════════════════════════════════════════════════════════

_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def _norm(s) -> str:
    s = str(s or "").strip().lower().translate(_AR_DIGITS)
    s = re.sub(r"[ً-ْـ]", "", s)
    s = re.sub(r"[أإآٱ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    s = re.sub(r"[_\-/\\.:()\[\]#]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


HEADER_SYNONYMS = {
    "date": ["date", "transaction date", "trans date", "txn date", "posting date", "post date", "value date",
             "booking date", "date time", "datetime", "created at", "تاريخ", "التاريخ", "تاريخ العمليه",
             "تاريخ الحركه", "تاريخ القيد", "تاريخ المعامله", "تاريخ التحويل", "تاريخ الاستحقاق", "تاريخ الحركة"],
    "description": ["description", "details", "narrative", "narration", "particulars", "remarks", "memo",
                    "transaction details", "transaction description", "البيان", "بيان", "الوصف", "وصف",
                    "التفاصيل", "تفاصيل", "شرح", "ملاحظات", "تفاصيل العمليه", "نوع العمليه"],
    "reference": ["reference", "ref", "ref no", "reference no", "reference number", "transaction id",
                  "transaction reference", "txn id", "trx id", "cheque no", "check no", "cheque number",
                  "check number", "document no", "المرجع", "مرجع", "رقم المرجع", "رقم العمليه", "رقم الحركه",
                  "رقم الشيك", "الرقم المرجعي", "رقم المعامله", "رقم التحويل"],
    "debit": ["debit", "debits", "dr", "withdrawal", "withdrawals", "withdraw", "money out", "paid out", "out",
              "debit amount", "مدين", "سحب", "مسحوبات", "خصم", "منه", "المدين", "صادر", "مبلغ مدين"],
    "credit": ["credit", "credits", "cr", "deposit", "deposits", "money in", "paid in", "in", "credit amount",
               "دائن", "ايداع", "ايداعات", "اضافه", "له", "الدائن", "وارد", "مبلغ دائن"],
    "amount": ["amount", "transaction amount", "value", "amount egp", "المبلغ", "مبلغ", "القيمه", "قيمه",
               "مبلغ العمليه"],
    "balance": ["balance", "running balance", "closing balance", "available balance", "الرصيد", "رصيد",
                "الرصيد بعد العمليه", "الرصيد الدفتري"],
    "direction": ["type", "transaction type", "direction", "dr cr", "debit credit", "النوع", "نوع الحركه",
                  "الاتجاه", "نوع"],
    "status": ["status", "transaction status", "الحاله", "حاله العمليه"],
    "party": ["sender", "receiver", "beneficiary", "counterparty", "sender receiver", "from to", "to from",
              "name", "المستفيد", "المرسل", "المستلم", "اسم المستفيد", "الطرف"],
}
_SYN = {k: {_norm(v) for v in vals} for k, vals in HEADER_SYNONYMS.items()}
OUT_WORDS = {"debit", "dr", "d", "sent", "send", "out", "outgoing", "withdrawal", "payment", "paid", "transfer out",
             "مدين", "صادر", "مرسل", "ارسال", "سحب", "تحويل صادر", "خصم", "دفع"}
IN_WORDS = {"credit", "cr", "c", "received", "receive", "in", "incoming", "deposit", "transfer in",
            "دائن", "وارد", "مستلم", "استلام", "ايداع", "تحويل وارد", "اضافه"}
FAILED_WORDS = {"failed", "rejected", "declined", "cancelled", "canceled", "reversed", "pending",
                "فشل", "فاشله", "مرفوض", "مرفوضه", "ملغي", "ملغاه", "معلق"}


def _classify_header(cell) -> Optional[str]:
    h = _norm(cell)
    if not h:
        return None
    for key, names in _SYN.items():
        if h in names:
            return key
    # "Debit (EGP)", "المبلغ بالجنيه", "Amount EGP" ...
    for key in ("debit", "credit", "balance", "amount", "date", "reference", "description"):
        for n in _SYN[key]:
            if len(n) >= 4 and (h.startswith(n + " ") or h.endswith(" " + n)):
                return key
    return None


def _find_header(rows: list):
    for i, row in enumerate(rows[:20]):
        cols = {}
        for j, cell in enumerate(row):
            k = _classify_header(cell)
            if k and k not in cols:
                cols[k] = j
        if "date" in cols and ("amount" in cols or "debit" in cols or "credit" in cols):
            return i, cols
    raise HTTPException(400, "تعذّر التعرف على أعمدة الكشف — يلزم عمود «التاريخ» وعمود «المبلغ» أو عمودا "
                             "«مدين» و«دائن» (Date / Amount أو Debit / Credit)")


def parse_amount(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 2)
    s = str(v).strip().translate(_AR_DIGITS)
    if not s or s in {"-", "--", "—"}:
        return None
    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg, s = True, s[1:-1]
    low = s.lower()
    if low.endswith("dr") or low.endswith("-"):
        neg, s = True, s[:-2] if low.endswith("dr") else s[:-1]
    elif low.endswith("cr"):
        s = s[:-2]
    s = s.replace("٬", "").replace("،", "").replace("٫", ".")
    s = re.sub(r"[^\d.,\-]", "", s)
    if s.count(",") and s.count("."):
        s = s.replace(",", "")
    elif s.count(",") == 1 and len(s.split(",")[1]) in (1, 2):
        s = s.replace(",", ".")       # 1500,50
    else:
        s = s.replace(",", "")
    if s.startswith("-"):
        neg, s = (not neg), s[1:]
    try:
        n = float(s)
    except ValueError:
        return None
    return round(-n if neg else n, 2)


_MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def parse_date(v) -> Optional[str]:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, (int, float)) and 20000 < float(v) < 80000:      # Excel serial
        return (date(1899, 12, 30) + timedelta(days=int(v))).isoformat()
    s = str(v).strip().translate(_AR_DIGITS)
    s = re.split(r"[ T](?=\d{1,2}:)", s)[0].strip()                    # drop the time part
    m = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", s)
    try:
        if m:
            return date(int(m[1]), int(m[2]), int(m[3])).isoformat()
        m = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$", s)
        if m:
            a, b, y = int(m[1]), int(m[2]), int(m[3])
            y = y + 2000 if y < 100 else y
            d_, mo = (b, a) if b > 12 else (a, b)          # Egyptian banks: day first
            return date(y, mo, d_).isoformat()
        m = re.match(r"^(\d{1,2})[ \-/]([A-Za-z]{3})[A-Za-z]*[ \-/,]+(\d{2,4})$", s)
        if m and m[2].lower() in _MONTHS:
            y = int(m[3]); y = y + 2000 if y < 100 else y
            return date(y, _MONTHS[m[2].lower()], int(m[1])).isoformat()
        m = re.match(r"^([A-Za-z]{3})[A-Za-z]*[ ](\d{1,2}),?[ ](\d{4})$", s)
        if m and m[1].lower() in _MONTHS:
            return date(int(m[3]), _MONTHS[m[1].lower()], int(m[2])).isoformat()
    except ValueError:
        return None
    return None


def read_rows(raw: bytes, filename: str) -> list:
    name = (filename or "").lower()
    if name.endswith((".xlsx", ".xlsm")) or raw[:2] == b"PK":
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            ws = wb.worksheets[0]
            rows = [list(r) for r in ws.iter_rows(values_only=True)]
            wb.close()
            return rows
        except Exception:
            raise HTTPException(400, "تعذّرت قراءة ملف Excel — احفظه بصيغة xlsx أو CSV")
    if name.endswith(".xls"):
        raise HTTPException(400, "صيغة xls القديمة غير مدعومة — احفظ الكشف بصيغة xlsx أو CSV")
    for enc in ("utf-8-sig", "cp1256", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
        delim = dialect.delimiter
    except csv.Error:
        delim = ","
    return [r for r in csv.reader(io.StringIO(text), delimiter=delim)]


def parse_statement(raw: bytes, filename: str) -> list:
    rows = read_rows(raw, filename)
    hi, cols = _find_header(rows)

    def cell(row, key):
        j = cols.get(key)
        return row[j] if j is not None and j < len(row) else None

    out = []
    for n, row in enumerate(rows[hi + 1:], start=hi + 2):
        if not row or all(c in (None, "") for c in row):
            continue
        d = parse_date(cell(row, "date"))
        desc = str(cell(row, "description") or "").strip()
        party = str(cell(row, "party") or "").strip()
        if party and party not in desc:
            desc = f"{desc} — {party}" if desc else party
        status = _norm(cell(row, "status"))
        if status and status in FAILED_WORDS:
            continue
        balance = parse_amount(cell(row, "balance"))
        if "debit" in cols or "credit" in cols:
            dr = abs(parse_amount(cell(row, "debit")) or 0)
            cr = abs(parse_amount(cell(row, "credit")) or 0)
            amount = round(cr - dr, 2)
            if not dr and not cr and "amount" in cols:
                amount = parse_amount(cell(row, "amount")) or 0
        else:
            amount = parse_amount(cell(row, "amount")) or 0
            direction = _norm(cell(row, "direction"))
            if direction:
                if direction in OUT_WORDS or any(w in direction for w in ("sent", "صادر", "مرسل", "debit", "مدين")):
                    amount = -abs(amount)
                elif direction in IN_WORDS or any(w in direction for w in ("receiv", "وارد", "مستلم", "credit", "دائن")):
                    amount = abs(amount)
        if d is None:
            # opening / closing balance rows, totals, footers
            if balance is not None and any(w in _norm(" ".join(str(c or "") for c in row))
                                           for w in ("opening", "افتتاحي", "اول المده", "سابق", "brought forward")):
                out.append({"_opening": balance})
            continue
        if not amount:
            if balance is not None and any(w in _norm(desc) for w in ("opening", "افتتاحي", "اول المده", "brought forward")):
                out.append({"_opening": balance})
            continue
        out.append({"row": n, "date": d, "description": desc[:500],
                     "reference": str(cell(row, "reference") or "").strip()[:120],
                     "amount": amount, "balance": balance})
    return out


# ══════════════════════════════════════════════════════════════
# Book side
# ══════════════════════════════════════════════════════════════

async def get_bank_account(company_id: str, code: str) -> dict:
    code = str(code or "").strip()
    if not code:
        raise HTTPException(400, "اختر حساب البنك")
    acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": code}, {"_id": 0})
    if not acc:
        raise HTTPException(400, f"الحساب {code} غير موجود في دليل الحسابات")
    if acc.get("is_header") or acc.get("account_category") == "header" or acc.get("allow_posting") is False:
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name', '')}» حساب تجميعي — اختر حساب البنك الفرعي")
    ok = code.startswith("16") and code not in NOT_MONEY_CODES and (
        acc.get("account_category") in ("bank", "cash") or str(acc.get("parent_code") or "") in ("161", "162"))
    if not ok:
        raise HTTPException(400, f"الحساب {code} «{acc.get('account_name', '')}» ليس حساب بنك أو خزينة (16x)")
    return acc


def _shift(d: str, days: int) -> str:
    return (date.fromisoformat(d[:10]) + timedelta(days=days)).isoformat()


async def book_lines(company_id: str, code: str, date_from: Optional[str] = None,
                     date_to: Optional[str] = None) -> list:
    """Every posted journal line on the bank account, signed (+ in / − out)."""
    q = {"company_id": company_id, "status": {"$in": BOOK_STATUSES}, "lines.account_code": code}
    rng = {}
    if date_from:
        rng["$gte"] = date_from
    if date_to:
        rng["$lte"] = date_to + "~"           # entry_date may carry a time part
    if rng:
        q["entry_date"] = rng
    items, entry_ids = [], []
    async for e in db.journal_entries.find(q, {"_id": 0}):
        for i, l in enumerate(e.get("lines") or []):
            if str(l.get("account_code")) != code:
                continue
            amt = round(float(l.get("debit") or 0) - float(l.get("credit") or 0), 2)
            if not amt:
                continue
            items.append({
                "entry_id": e["id"], "line_id": l.get("line_id") or f"{e['id']}:{i}",
                "date": str(e.get("entry_date") or "")[:10], "amount": amt,
                "entry_number": e.get("entry_number_str") or e.get("entry_number"),
                "reference": e.get("reference") or "",
                "description": l.get("description") or e.get("description") or "",
                "source_document_type": e.get("source_document_type"),
                "source_document_id": e.get("source_document_id"),
            })
            entry_ids.append(e["id"])
    if entry_ids:   # treasury cheques: carry the cheque number as a reference
        async for c in db.cheques.find(
                {"company_id": company_id, "$or": [{"collect_je_id": {"$in": entry_ids}},
                                                   {"clear_je_id": {"$in": entry_ids}},
                                                   {"bounce_fees_je_id": {"$in": entry_ids}}]},
                {"_id": 0, "id": 1, "cheque_number": 1, "ref": 1, "collect_je_id": 1, "clear_je_id": 1,
                 "bounce_fees_je_id": 1}):
            for it in items:
                if it["entry_id"] in (c.get("collect_je_id"), c.get("clear_je_id"), c.get("bounce_fees_je_id")):
                    it["cheque_id"] = c["id"]
                    it["cheque_number"] = c.get("cheque_number")
                    it["cheque_ref"] = c.get("ref")
    items.sort(key=lambda x: (x["date"], str(x["entry_number"])))
    return items


async def book_balance(company_id: str, code: str, as_of: Optional[str]) -> float:
    return round(sum(i["amount"] for i in await book_lines(company_id, code, None, as_of)), 2)


async def matched_line_ids(company_id: str, code: str) -> set:
    ids = set()
    async for l in db.bank_statement_lines.find(
            {"company_id": company_id, "bank_account_code": code, "status": "matched"},
            {"_id": 0, "match.line_id": 1}):
        if (l.get("match") or {}).get("line_id"):
            ids.add(l["match"]["line_id"])
    return ids


async def first_period_from(company_id: str, code: str) -> Optional[str]:
    s = await db.bank_statements.find_one({"company_id": company_id, "bank_account_code": code},
                                          {"_id": 0, "period_from": 1}, sort=[("period_from", 1)])
    return s.get("period_from") if s else None


async def unmatched_book(company_id: str, code: str, upto: str) -> list:
    """Book lines not on any statement yet, from the first imported statement on.
    Older lines are already inside the first statement's opening balance."""
    start = await first_period_from(company_id, code)
    if not start:
        return []
    done = await matched_line_ids(company_id, code)
    return [b for b in await book_lines(company_id, code, _shift(start, -DATE_WINDOW_DAYS), upto)
            if b["line_id"] not in done]


# ══════════════════════════════════════════════════════════════
# Matching
# ══════════════════════════════════════════════════════════════

def _tokens(*vals) -> set:
    out = set()
    for v in vals:
        for t in re.split(r"[^0-9A-Za-z؀-ۿ]+", str(v or "").translate(_AR_DIGITS)):
            if len(t) >= 3 and any(ch.isdigit() for ch in t):
                out.add(t.lower().lstrip("0") or t)
    return out


def _days(a: str, b: str) -> int:
    return abs((date.fromisoformat(a[:10]) - date.fromisoformat(b[:10])).days)


def _score(st: dict, bk: dict) -> Optional[int]:
    if abs(st["amount"] - bk["amount"]) > 0.005:
        return None
    try:
        days = _days(st["date"], bk["date"])
    except ValueError:
        return None
    if days > DATE_WINDOW_DAYS:
        return None
    score = 100 - 10 * days
    s_tok = _tokens(st.get("reference"), st.get("description"))
    b_tok = _tokens(bk.get("reference"), bk.get("cheque_number"), bk.get("cheque_ref"),
                    bk.get("entry_number"), bk.get("description"))
    if s_tok & b_tok:
        score += 50
    return score


async def auto_match(company_id: str, statement_id: str) -> int:
    st_doc = await db.bank_statements.find_one({"id": statement_id, "company_id": company_id}, {"_id": 0})
    if not st_doc:
        return 0
    code = st_doc["bank_account_code"]
    lines = await db.bank_statement_lines.find(
        {"company_id": company_id, "statement_id": statement_id, "status": "unmatched"}, {"_id": 0}
    ).to_list(None)
    if not lines:
        return 0
    lo = _shift(min(l["date"] for l in lines), -DATE_WINDOW_DAYS)
    hi = _shift(max(l["date"] for l in lines), DATE_WINDOW_DAYS)
    done = await matched_line_ids(company_id, code)
    books = [b for b in await book_lines(company_id, code, lo, hi) if b["line_id"] not in done]
    pairs = []
    for s in lines:
        for b in books:
            sc = _score(s, b)
            if sc is not None:
                pairs.append((-sc, _days(s["date"], b["date"]), s["line_no"], b["date"], s["id"], b))
    pairs.sort(key=lambda p: p[:4])
    used_s, used_b, n = set(), set(), 0
    for neg, days, _, _, sid, b in pairs:
        if sid in used_s or b["line_id"] in used_b:
            continue
        used_s.add(sid); used_b.add(b["line_id"])
        res = await db.bank_statement_lines.update_one(
            {"id": sid, "company_id": company_id, "status": "unmatched"},
            {"$set": {"status": "matched", "match": _match_doc(b, "cheque" if b.get("cheque_id") else "auto", -neg)}})
        n += res.modified_count
    return n


def _match_doc(b: dict, kind: str, score: Optional[int] = None, user_id: Optional[str] = None) -> dict:
    return {"kind": kind, "entry_id": b["entry_id"], "line_id": b["line_id"], "entry_number": b.get("entry_number"),
            "book_date": b["date"], "book_amount": b["amount"], "book_description": b.get("description"),
            "cheque_id": b.get("cheque_id"), "cheque_number": b.get("cheque_number"), "score": score,
            "matched_by": user_id, "matched_at": datetime.now(timezone.utc).isoformat()}


# ══════════════════════════════════════════════════════════════
# Endpoints
# ══════════════════════════════════════════════════════════════

async def _statement(company_id: str, statement_id: str) -> dict:
    s = await db.bank_statements.find_one({"id": statement_id, "company_id": company_id}, {"_id": 0})
    if not s:
        raise HTTPException(404, "كشف الحساب غير موجود")
    return s


@router.get("/bank-accounts")
async def list_bank_accounts(current_user: dict = Depends(get_current_user)):
    """حسابات البنوك والخزائن (16x) القابلة للتسوية"""
    company_id = current_user["company_id"]
    out = []
    async for a in db.chart_of_accounts.find(
            {"company_id": company_id, "account_code": {"$regex": "^16"}}, {"_id": 0}).sort("account_code", 1):
        try:
            await get_bank_account(company_id, a["account_code"])
        except HTTPException:
            continue
        out.append({"account_code": a["account_code"], "account_name": a.get("account_name"),
                    "account_name_en": a.get("account_name_en"), "current_balance": a.get("current_balance", 0)})
    return {"accounts": out}


@router.post("/import")
async def import_statement(
    file: UploadFile = File(...),
    bank_account_code: str = Form(...),
    opening_balance: Optional[float] = Form(None),
    closing_balance: Optional[float] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """استيراد كشف حساب بنكي (CSV / XLSX) ومطابقته تلقائياً مع القيود"""
    company_id = current_user["company_id"]
    acc = await get_bank_account(company_id, bank_account_code)
    code = acc["account_code"]
    try:
        from services.upload_limits import read_limited, IMPORT_LIMIT as LIMIT
        raw = await read_limited(file, LIMIT)
    except ImportError:          # pragma: no cover
        raw = await file.read(IMPORT_LIMIT + 1)
        if len(raw) > IMPORT_LIMIT:
            raise HTTPException(413, "حجم الملف أكبر من الحد المسموح")
    if not raw:
        raise HTTPException(400, "الملف فارغ")
    file_hash = hashlib.sha256(raw).hexdigest()
    dup = await db.bank_statements.find_one({"company_id": company_id, "file_hash": file_hash}, {"_id": 0})
    if dup:
        raise HTTPException(409, f"هذا الكشف مستورد من قبل ({dup.get('file_name', '')} — "
                                 f"{dup.get('period_from', '')} إلى {dup.get('period_to', '')}) — لا يُستورد مرتين")

    parsed = parse_statement(raw, file.filename)
    opening_rows = [p["_opening"] for p in parsed if "_opening" in p]
    rows = [p for p in parsed if "_opening" not in p]
    if not rows:
        raise HTTPException(400, "لا توجد حركات صالحة في الكشف (تاريخ ومبلغ)")
    # newest-first exports: put them in date order, keep file order within a day
    if rows[0]["date"] > rows[-1]["date"]:
        rows.reverse()

    with_bal = [r for r in rows if r.get("balance") is not None]
    total = round(sum(r["amount"] for r in rows), 2)
    if opening_balance is None:
        if opening_rows:
            opening_balance = opening_rows[0]
        elif with_bal:
            opening_balance = round(with_bal[0]["balance"] - with_bal[0]["amount"], 2)
    if closing_balance is None:
        if with_bal:
            closing_balance = with_bal[-1]["balance"]
        elif opening_balance is not None:
            closing_balance = round(opening_balance + total, 2)
    if closing_balance is None:
        raise HTTPException(400, "الكشف بلا عمود رصيد — أدخل رصيد آخر المدة (أو أول المدة) يدوياً")
    if opening_balance is None:
        opening_balance = round(closing_balance - total, 2)
    warning = None
    if abs(round(opening_balance + total, 2) - round(closing_balance, 2)) > 0.01:
        warning = (f"رصيد أول المدة {opening_balance:,.2f} + صافي الحركات {total:,.2f} لا يساوي رصيد آخر المدة "
                   f"{closing_balance:,.2f} — راجع الكشف (قد تكون هناك حركات ناقصة)")

    sid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    stmt = {
        "id": sid, "company_id": company_id, "bank_account_code": code,
        "bank_account_name": acc.get("account_name"), "file_name": file.filename, "file_hash": file_hash,
        "period_from": rows[0]["date"], "period_to": max(r["date"] for r in rows),
        "opening_balance": round(opening_balance, 2), "closing_balance": round(closing_balance, 2),
        "total_in": round(sum(r["amount"] for r in rows if r["amount"] > 0), 2),
        "total_out": round(-sum(r["amount"] for r in rows if r["amount"] < 0), 2),
        "line_count": len(rows), "warning": warning,
        "created_at": now, "created_by": current_user.get("user_id"),
    }
    await db.bank_statements.insert_one(stmt)
    await db.bank_statement_lines.insert_many([{
        "id": str(uuid.uuid4()), "company_id": company_id, "statement_id": sid, "bank_account_code": code,
        "line_no": i + 1, "source_row": r["row"], "date": r["date"], "description": r["description"],
        "reference": r["reference"], "amount": r["amount"],
        "debit": round(-r["amount"], 2) if r["amount"] < 0 else 0.0,
        "credit": r["amount"] if r["amount"] > 0 else 0.0,
        "balance": r.get("balance"), "status": "unmatched", "match": None, "created_at": now,
    } for i, r in enumerate(rows)])
    matched = await auto_match(company_id, sid)
    stmt.pop("_id", None)
    return {"message": f"تم استيراد {len(rows)} حركة — طُوبق منها تلقائياً {matched}",
            "statement": stmt, "auto_matched": matched, "warning": warning}


@router.get("/statements")
async def list_statements(bank_account_code: Optional[str] = None,
                          current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    q = {"company_id": company_id}
    if bank_account_code:
        q["bank_account_code"] = bank_account_code
    stmts = await db.bank_statements.find(q, {"_id": 0, "file_hash": 0}).sort("period_to", -1).to_list(500)
    for s in stmts:
        s["matched_count"] = await db.bank_statement_lines.count_documents(
            {"company_id": company_id, "statement_id": s["id"], "status": "matched"})
        s["unmatched_count"] = s["line_count"] - s["matched_count"]
    return {"statements": stmts}


@router.get("/statements/{statement_id}")
async def get_statement(statement_id: str, current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    s = await _statement(company_id, statement_id)
    s.pop("file_hash", None)
    lines = await db.bank_statement_lines.find(
        {"company_id": company_id, "statement_id": statement_id}, {"_id": 0}).sort("line_no", 1).to_list(None)
    code = s["bank_account_code"]
    book_open = await unmatched_book(company_id, code, _shift(s["period_to"], DATE_WINDOW_DAYS))
    bal = await book_balance(company_id, code, s["period_to"])
    unmatched_st = [l for l in lines if l["status"] != "matched"]
    return {
        "statement": s, "lines": lines,
        "unmatched_book": book_open,
        "summary": {
            "book_balance": bal, "statement_closing_balance": s["closing_balance"],
            "difference": round(s["closing_balance"] - bal, 2),
            "matched": len(lines) - len(unmatched_st), "unmatched_statement": len(unmatched_st),
            "unmatched_statement_total": round(sum(l["amount"] for l in unmatched_st), 2),
            "unmatched_book": len(book_open),
            "unmatched_book_total": round(sum(b["amount"] for b in book_open), 2),
        },
    }


@router.post("/statements/{statement_id}/auto-match")
async def rerun_auto_match(statement_id: str, current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    await _statement(company_id, statement_id)
    n = await auto_match(company_id, statement_id)
    return {"message": f"طُوبق {n} سطر", "auto_matched": n}


class MatchRequest(BaseModel):
    statement_line_id: str
    entry_id: str
    line_id: str


@router.post("/statements/{statement_id}/match")
async def manual_match(statement_id: str, req: MatchRequest, current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    s = await _statement(company_id, statement_id)
    code = s["bank_account_code"]
    line = await db.bank_statement_lines.find_one(
        {"id": req.statement_line_id, "company_id": company_id, "statement_id": statement_id}, {"_id": 0})
    if not line:
        raise HTTPException(404, "سطر الكشف غير موجود")
    if line["status"] == "matched":
        raise HTTPException(400, "سطر الكشف مطابَق بالفعل — فك المطابقة أولاً")
    entry = await db.journal_entries.find_one({"id": req.entry_id, "company_id": company_id}, {"_id": 0, "entry_date": 1})
    if not entry:
        raise HTTPException(404, "القيد غير موجود")
    d = str(entry.get("entry_date") or "")[:10]
    book = next((b for b in await book_lines(company_id, code, d, d)
                 if b["entry_id"] == req.entry_id and b["line_id"] == req.line_id), None)
    if not book:
        raise HTTPException(400, f"سطر القيد غير مُرحَّل أو ليس على حساب البنك {code}")
    if req.line_id in await matched_line_ids(company_id, code):
        raise HTTPException(400, "سطر القيد مطابَق مع سطر آخر في كشف")
    if abs(book["amount"] - line["amount"]) > 0.005:
        raise HTTPException(400, f"المبلغان مختلفان: الكشف {line['amount']:,.2f} والدفاتر {book['amount']:,.2f} — "
                                 "المطابقة لنفس المبلغ والاتجاه فقط")
    res = await db.bank_statement_lines.update_one(
        {"id": line["id"], "company_id": company_id, "status": "unmatched"},
        {"$set": {"status": "matched", "match": _match_doc(book, "manual", None, current_user.get("user_id"))}})
    if not res.modified_count:
        raise HTTPException(409, "تغيّرت حالة السطر — أعد التحميل")
    return {"message": "تمت المطابقة"}


class UnmatchRequest(BaseModel):
    statement_line_id: str


@router.post("/statements/{statement_id}/unmatch")
async def unmatch(statement_id: str, req: UnmatchRequest, current_user: dict = Depends(get_current_user)):
    company_id = current_user["company_id"]
    await _statement(company_id, statement_id)
    line = await db.bank_statement_lines.find_one(
        {"id": req.statement_line_id, "company_id": company_id, "statement_id": statement_id}, {"_id": 0})
    if not line:
        raise HTTPException(404, "سطر الكشف غير موجود")
    if line["status"] != "matched":
        raise HTTPException(400, "السطر غير مطابَق")
    if (line.get("match") or {}).get("kind") == "posted":
        raise HTTPException(400, "هذا السطر رُحِّل له قيد من التسوية — اعكس القيد من دفتر اليومية أولاً")
    await db.bank_statement_lines.update_one(
        {"id": line["id"], "company_id": company_id},
        {"$set": {"status": "unmatched", "match": None}})
    return {"message": "تم فك المطابقة"}


class PostItem(BaseModel):
    statement_line_id: str
    kind: str                       # bank_charges | interest
    account_code: Optional[str] = None   # optional counter account override


class PostUnmatchedRequest(BaseModel):
    items: List[PostItem]


@router.post("/statements/{statement_id}/post-unmatched")
async def post_unmatched(statement_id: str, req: PostUnmatchedRequest,
                         current_user: dict = Depends(get_current_user)):
    """ترحيل بنود الكشف غير المسجلة: مصروفات/عمولات بنكية (من 334 إلى البنك)،
    فوائد دائنة (من البنك إلى 422)"""
    company_id = current_user["company_id"]
    user_id = current_user.get("user_id")
    s = await _statement(company_id, statement_id)
    if not req.items:
        raise HTTPException(400, "اختر سطراً واحداً على الأقل")
    bank = await get_bank_account(company_id, s["bank_account_code"])
    svc = AccountingService(db)

    # validate everything first, post after — no half-posted batch on a bad line
    plan = []
    for it in req.items:
        line = await db.bank_statement_lines.find_one(
            {"id": it.statement_line_id, "company_id": company_id, "statement_id": statement_id}, {"_id": 0})
        if not line:
            raise HTTPException(404, "سطر الكشف غير موجود")
        if line["status"] == "matched":
            raise HTTPException(400, f"السطر {line['line_no']} مطابَق بالفعل")
        if it.kind == "bank_charges":
            if line["amount"] >= 0:
                raise HTTPException(400, f"السطر {line['line_no']} إيداع وليس مصروفاً بنكياً")
            counter_code = it.account_code or BANK_CHARGES_CODE
        elif it.kind == "interest":
            if line["amount"] <= 0:
                raise HTTPException(400, f"السطر {line['line_no']} سحب وليس فوائد دائنة")
            counter_code = it.account_code or INTEREST_INCOME_CODE
        else:
            raise HTTPException(400, "نوع البند غير معروف — bank_charges أو interest")
        counter = await svc.get_account_by_code(company_id, counter_code)
        if not counter:
            raise HTTPException(400, f"الحساب {counter_code} غير موجود في دليل الحسابات")
        if counter.get("is_header") or counter.get("account_category") == "header" or counter.get("allow_posting") is False:
            raise HTTPException(400, f"الحساب {counter_code} حساب تجميعي لا يقبل قيوداً")
        if counter_code.startswith("16"):
            raise HTTPException(400, "الحساب المقابل لا يكون حساب بنك أو خزينة — استخدم المطابقة")
        plan.append((line, it.kind, counter))

    posted = []
    for line, kind, counter in plan:
        amt = abs(line["amount"])
        label = "مصروفات وعمولات بنكية" if kind == "bank_charges" else "فوائد دائنة"
        desc = f"{label} — كشف {s.get('bank_account_name', '')} {line['date']}: {line['description'] or line['reference']}".strip()
        bank_line = JournalEntryLine(account_id=bank["id"], account_code=bank["account_code"],
                                     account_name=bank["account_name"], description=desc,
                                     debit=amt if kind == "interest" else 0.0,
                                     credit=amt if kind == "bank_charges" else 0.0)
        ctr_line = JournalEntryLine(account_id=counter["id"], account_code=counter["account_code"],
                                    account_name=counter["account_name"], description=desc,
                                    debit=amt if kind == "bank_charges" else 0.0,
                                    credit=amt if kind == "interest" else 0.0)
        entry = JournalEntry(company_id=company_id, entry_date=line["date"], description=desc,
                             reference=line.get("reference") or None,
                             lines=[ctr_line, bank_line] if kind == "bank_charges" else [bank_line, ctr_line],
                             source_document_type="bank_transaction", source_document_id=line["id"],
                             created_by=user_id or "system")
        try:
            created = await svc.create_journal_entry(entry)
            await svc.post_journal_entry(created["id"], user_id)
        except ValueError as e:
            raise HTTPException(400, f"تعذّر ترحيل السطر {line['line_no']}: {e}")
        bline = next(l for l in created["lines"] if l["account_code"] == bank["account_code"])
        book = {"entry_id": created["id"], "line_id": bline["line_id"], "date": line["date"],
                "amount": line["amount"], "entry_number": created.get("entry_number_str"), "description": desc}
        await db.bank_statement_lines.update_one(
            {"id": line["id"], "company_id": company_id},
            {"$set": {"status": "matched", "match": _match_doc(book, "posted", None, user_id)}})
        posted.append({"statement_line_id": line["id"], "entry_id": created["id"],
                       "entry_number": created.get("entry_number_str"), "amount": amt, "kind": kind})
    return {"message": f"تم ترحيل {len(posted)} قيد", "posted": posted}


@router.get("/statements/{statement_id}/report")
async def reconciliation_report(statement_id: str, current_user: dict = Depends(get_current_user)):
    """مذكرة التسوية البنكية"""
    company_id = current_user["company_id"]
    s = await _statement(company_id, statement_id)
    code = s["bank_account_code"]
    as_of = s["period_to"]
    bal = await book_balance(company_id, code, as_of)
    outstanding = await unmatched_book(company_id, code, as_of)
    deposits = [b for b in outstanding if b["amount"] > 0]
    cheques = [b for b in outstanding if b["amount"] < 0]
    st_unmatched = await db.bank_statement_lines.find(
        {"company_id": company_id, "statement_id": statement_id, "status": "unmatched"}, {"_id": 0}
    ).sort("line_no", 1).to_list(None)
    st_in = [l for l in st_unmatched if l["amount"] > 0]
    st_out = [l for l in st_unmatched if l["amount"] < 0]

    dep_total = round(sum(b["amount"] for b in deposits), 2)
    chq_total = round(-sum(b["amount"] for b in cheques), 2)
    in_total = round(sum(l["amount"] for l in st_in), 2)
    out_total = round(-sum(l["amount"] for l in st_out), 2)
    adjusted_bank = round(s["closing_balance"] + dep_total - chq_total, 2)
    adjusted_book = round(bal + in_total - out_total, 2)
    return {
        "statement": {k: s.get(k) for k in ("id", "bank_account_code", "bank_account_name", "file_name",
                                            "period_from", "period_to", "opening_balance", "closing_balance")},
        "as_of": as_of,
        "bank_side": {
            "statement_balance": s["closing_balance"],
            "add_deposits_in_transit": dep_total, "deposits_in_transit": deposits,
            "less_outstanding_cheques": chq_total, "outstanding_cheques": cheques,
            "adjusted_balance": adjusted_bank,
        },
        "book_side": {
            "book_balance": bal,
            "add_unrecorded_credits": in_total, "unrecorded_credits": st_in,
            "less_unrecorded_debits": out_total, "unrecorded_debits": st_out,
            "adjusted_balance": adjusted_book,
        },
        "book_balance": bal,
        # what the statement should show = book − deposits in transit + outstanding cheques
        "expected_statement_balance": round(bal - dep_total + chq_total, 2),
        "statement_balance": s["closing_balance"],
        "difference": round(adjusted_bank - adjusted_book, 2),
        "is_reconciled": abs(adjusted_bank - adjusted_book) < 0.005 and not st_unmatched,
    }


@router.delete("/statements/{statement_id}")
async def delete_statement(statement_id: str, current_user: dict = Depends(get_current_user)):
    """حذف كشف مستورد (لا يمس القيود المرحّلة منه)"""
    company_id = current_user["company_id"]
    await _statement(company_id, statement_id)
    posted = await db.bank_statement_lines.count_documents(
        {"company_id": company_id, "statement_id": statement_id, "match.kind": "posted"})
    if posted:
        raise HTTPException(400, f"رُحِّل من هذا الكشف {posted} قيد — اعكسها أولاً ثم احذف الكشف")
    await db.bank_statement_lines.delete_many({"company_id": company_id, "statement_id": statement_id})
    await db.bank_statements.delete_one({"id": statement_id, "company_id": company_id})
    return {"message": "تم حذف الكشف"}
