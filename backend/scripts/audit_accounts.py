"""
Audit a company's chart of accounts and general ledger. READ-ONLY.

Checks
  1. Structure    duplicate codes, missing parents, type vs code group
                  (Egyptian Unified Accounting System numbering:
                   1 assets · 2 liabilities & equity · 3 expenses · 4 revenues)
  2. Legal        accounts Egyptian law requires a company to be able to post to
  3. Automation   every account code the backend posts to automatically exists
  4. Ledger       debits = credits; every posted entry is in the ledger;
                  current_balance agrees with opening + ledger movement

This is a technical consistency check, not a legal opinion. Final
sign-off on statutory compliance belongs to a licensed accountant.

USAGE
    docker exec datalife_backend python scripts/audit_accounts.py --email dalia@datalifeai.com
"""

import os
import re
import sys
import pathlib
from collections import defaultdict
from pymongo import MongoClient

ROOT = pathlib.Path(__file__).resolve().parent.parent
# report-only modules: a missing account there yields 0, it cannot fail a posting
READ_ONLY = {"cash_flow.py"}
MAP_ENTRY = re.compile(r'^\s*["\'](\w+)["\']\s*:\s*\(?\s*["\']([1-4]\d{1,4})["\']')
DEBIT_NATURE = {"asset", "expense", "contra_liability", "contra_equity"}

# (label, legal basis, name patterns — any match counts)
LEGAL = [
    # (label, legal basis, allowed account types, name patterns)
    ("رأس المال", "قانون الشركات 159/1981", {"equity"}, [r"رأس ?المال|راس ?المال"]),
    ("الاحتياطي القانوني", "قانون الشركات 159/1981 — 5% من صافي الربح", {"equity", "liability"},
     [r"احتياطي قانوني|الاحتياطي القانوني"]),
    ("الأرباح (الخسائر) المرحلة", "معيار المحاسبة المصري رقم 1", {"equity"},
     [r"مرحل|محتجزة"]),
    ("ضريبة القيمة المضافة — مخرجات (مستحقة)", "قانون الضريبة على القيمة المضافة 67/2016", {"liability"},
     [r"قيمة مضافة|القيمة المضافة|مخرجات"]),
    ("ضريبة القيمة المضافة — مدخلات (قابلة للخصم)", "قانون الضريبة على القيمة المضافة 67/2016", {"asset"},
     [r"مدخلات|قيمة مضافة.*(قابل|استرداد)"]),
    ("ضريبة الخصم والتحصيل تحت حساب الضريبة", "قانون الضريبة على الدخل 91/2005", {"liability"},
     [r"الخصم والتحصيل|خصم وتحصيل|الخصم والإضافة|خصم من المنبع"]),
    ("ضريبة كسب العمل (المرتبات)", "قانون الضريبة على الدخل 91/2005", {"liability"},
     [r"كسب (ال)?عمل|ضريبة (ال)?مرتبات|ضرائب (ال)?مرتبات|ضريبة (ال)?أجور"]),
    ("ضريبة الدخل المستحقة (أرباح الشركة)", "قانون الضريبة على الدخل 91/2005", {"liability"},
     [r"ضريبة (ال)?دخل|ضرائب (ال)?دخل|ضريبة (ال)?أرباح|ضريبة شركات"]),
    ("التأمينات الاجتماعية المستحقة", "قانون التأمينات 148/2019", {"liability"},
     [r"تأمينات|تامينات"]),
    ("المساهمة التكافلية للتأمين الصحي الشامل", "قانون التأمين الصحي الشامل 2/2018", {"liability"},
     [r"تكافلي|تأمين صحي"]),
    ("مجمع الإهلاك", "معيار المحاسبة المصري رقم 10", {"contra_asset", "liability"},
     [r"مجمع|مخصص (ال)?إهلاك"]),
    ("مصروف الإهلاك", "معيار المحاسبة المصري رقم 10", {"expense"}, [r"إهلاك|اهلاك"]),
    ("النقدية بالصندوق", "", {"asset"}, [r"صندوق|خزينة|الخزينة"]),
    ("النقدية بالبنوك", "", {"asset"}, [r"بنك|بنوك"]),
    ("العملاء", "", {"asset"}, [r"عملاء|مدينون"]),
    ("الموردون", "", {"liability"}, [r"موردون|موردين|دائنون"]),
    ("المخزون", "", {"asset"}, [r"مخزون|بضاعة"]),
    ("مصروف الأجور والمرتبات", "", {"expense"}, [r"أجور|اجور|مرتبات|رواتب"]),
    ("إيرادات النشاط / المبيعات", "", {"revenue"}, [r"مبيعات|إيراد|ايراد"]),
]


def expected_types(code: str):
    if code.startswith("1"):
        return {"asset", "contra_asset"}
    if code.startswith("21"):
        return {"equity", "contra_equity"}
    if code.startswith("2"):
        return {"liability", "contra_liability", "contra_asset", "equity"}
    if code.startswith("3"):
        return {"expense"}
    if code.startswith("4"):
        return {"revenue"}
    return None


def codes_used_by_backend():
    """Account codes written literally in backend postings (same scan as review)."""
    ctx = re.compile(r"account|acct|debit|credit|gl_|ledger|ACCOUNTS", re.I)
    found = defaultdict(set)
    for f in list((ROOT / "api").rglob("*.py")) + list((ROOT / "services").rglob("*.py")):
        if "__pycache__" in str(f) or f.name in READ_ONLY:
            continue
        lines = f.read_text(encoding="utf-8", errors="ignore").splitlines()
        for i, line in enumerate(lines):
            if not ctx.search(" ".join(lines[max(0, i - 3):i + 2])):
                continue
            for c in re.findall(r"[\"']([1-4]\d{1,3})[\"']", line):
                found[c].add(f"{f.name}:{i + 1}")
        # account maps: "under_collection": "233" — missed by the context scan above
        for i, line in enumerate(lines):
            m = MAP_ENTRY.match(line)
            if m:
                found[m.group(2)].add(f"{f.name}:{i + 1}")
    return found


def main():
    if "--email" not in sys.argv:
        sys.exit("usage: --email <user email>")
    email = sys.argv[sys.argv.index("--email") + 1]
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    user = db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("company_id"):
        sys.exit(f"no company for {email}")
    cid = user["company_id"]
    accounts = list(db.chart_of_accounts.find({"company_id": cid}, {"_id": 0}))
    by_code = {a["account_code"]: a for a in accounts}
    issues = 0

    print("=" * 72)
    print(f"مراجعة شجرة الحسابات — {len(accounts)} حساب")
    print("=" * 72)

    # ── 1. structure ──
    print("\n[١] الهيكل")
    counts = defaultdict(int)
    for a in accounts:
        counts[a["account_code"]] += 1
    dup = [c for c, n in counts.items() if n > 1]
    ids = {a["id"] for a in accounts}
    orphan = [a for a in accounts if a.get("parent_account_id") and a["parent_account_id"] not in ids]
    contra_rev = re.compile(r"مردودات|مسموحات|خصم مسموح")
    wrong_type = [a for a in accounts
                  if expected_types(a["account_code"])
                  and a.get("account_type") not in expected_types(a["account_code"])
                  and not (a["account_code"].startswith("4") and a.get("account_type") == "expense"
                           and contra_rev.search(a["account_name"]))]
    print(f"  أكواد مكررة               : {len(dup)}  {dup[:10] if dup else ''}")
    print(f"  حسابات أبوها غير موجود      : {len(orphan)}")
    for a in orphan[:10]:
        print(f"      {a['account_code']} {a['account_name']}")
    print(f"  نوع لا يطابق مجموعة الكود   : {len(wrong_type)}")
    for a in wrong_type[:15]:
        print(f"      {a['account_code']:<7} {a.get('account_type',''):<12} {a['account_name']}")
    issues += len(dup) + len(orphan) + len(wrong_type)

    # ── 2. legal ──
    print("\n[٢] الحسابات المطلوبة قانونياً ومحاسبياً")
    postable = [a for a in accounts if a.get("allow_posting", True) and not a.get("is_header")]
    for label, basis, types, pats in LEGAL:
        hits = [a for a in postable if a.get("account_type") in types
                and any(re.search(p, a["account_name"]) for p in pats)]
        mark = "✓" if hits else "✗"
        if not hits:
            issues += 1
        ex = f"{hits[0]['account_code']} {hits[0]['account_name']}" if hits else "غير موجود"
        print(f"  {mark} {label:<40} {ex[:38]:<38} {basis}")

    # ── 3. automation ──
    print("\n[٣] أكواد تستخدمها القيود الآلية")
    used = codes_used_by_backend()
    missing = {c: v for c, v in used.items() if c not in by_code}
    print(f"  مستخدمة: {len(used)} | غير موجودة في شجرتك: {len(missing)}")
    for c in sorted(missing, key=lambda x: (len(x), x)):
        print(f"      {c:<6} ← {', '.join(sorted(missing[c])[:2])}")
    issues += len(missing)

    # ── 4. ledger ──
    print("\n[٤] سلامة دفتر الأستاذ")
    agg = list(db.general_ledger.aggregate([
        {"$match": {"company_id": cid}},
        {"$group": {"_id": "$account_id", "d": {"$sum": "$debit"}, "c": {"$sum": "$credit"}}}]))
    td = round(sum(r["d"] for r in agg), 2)
    tc = round(sum(r["c"] for r in agg), 2)
    print(f"  إجمالي المدين {td:,.2f} | إجمالي الدائن {tc:,.2f} | {'✓ متوازن' if td == tc else '✗ غير متوازن'}")
    issues += td != tc

    missing_gl = [e for e in db.journal_entries.find({"company_id": cid, "status": "posted"}, {"_id": 0, "id": 1, "entry_number": 1})
                  if not db.general_ledger.count_documents({"journal_entry_id": e["id"]})]
    print(f"  قيود مرحّلة غائبة عن الدفتر : {len(missing_gl)}")
    issues += len(missing_gl)

    mv = {r["_id"]: r for r in agg}
    drift = []
    for a in accounts:
        m = mv.get(a["id"], {"d": 0, "c": 0})
        ob = float(a.get("opening_balance", 0) or 0)
        exp = ob + (m["d"] - m["c"] if a.get("account_type") in DEBIT_NATURE else m["c"] - m["d"])
        if round(exp, 2) != round(float(a.get("current_balance", 0) or 0), 2):
            drift.append((a, round(exp, 2)))
    print(f"  أرصدة لا تطابق الدفتر       : {len(drift)}")
    for a, exp in drift[:10]:
        print(f"      {a['account_code']:<7} الحالي {a.get('current_balance',0):,.2f} | من الدفتر {exp:,.2f}")
    issues += len(drift)

    drafts = db.journal_entries.count_documents({"company_id": cid, "status": "draft"})
    print(f"  قيود مسودة غير مرحّلة       : {drafts}  (للمراجعة، ليست خطأ بالضرورة)")

    # ── 5. completeness: closed documents whose entry never reached the ledger ──
    print("\n[٥] اكتمال الدفتر — مستندات مُقفلة بلا قيد مرحّل")
    posted_ids = {e["id"] for e in db.journal_entries.find(
        {"company_id": cid, "status": {"$in": ["posted", "reversed"]}}, {"id": 1})}
    checks = [
        ("فواتير معتمدة/مدفوعة", "invoices", {"status": {"$in": ["approved", "paid", "partially_paid"]}}),
        ("تسويات نهاية خدمة", "end_of_service", {"status": {"$in": ["approved", "paid"]}}),
    ]
    for label, coll, q in checks:
        if coll not in db.list_collection_names():
            continue
        docs = list(db[coll].find({"company_id": cid, **q}, {"_id": 0, "id": 1, "journal_entry_id": 1,
                                                             "document_number": 1, "invoice_number": 1}))
        bad = [d for d in docs if d.get("journal_entry_id") not in posted_ids]
        print(f"  {label:<28}: {len(docs)} | بلا قيد مرحّل: {len(bad)}")
        for d in bad[:10]:
            print(f"      {d.get('document_number') or d.get('invoice_number') or d.get('id')}")
        issues += len(bad)

    by_src = list(db.journal_entries.aggregate([
        {"$match": {"company_id": cid, "status": "draft"}},
        {"$group": {"_id": "$source_document_type", "n": {"$sum": 1}, "oldest": {"$min": "$entry_date"}}}]))
    for r in by_src:
        print(f"  مسودات من {r['_id'] or 'manual':<24}: {r['n']}  (أقدمها {r['oldest']})")

    print("\n" + "=" * 72)
    print(f"إجمالي الملاحظات: {issues}")


if __name__ == "__main__":
    main()
