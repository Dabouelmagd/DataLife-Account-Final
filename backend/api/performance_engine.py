"""
Performance Engine — محرك الأداء والأرشفة لقواعد البيانات الضخمة
High Availability + Materialized Balances + Smart Archiving

1. Materialized Account Balances — الأرصدة الافتتاحية الشهرية المُجمَّعة
   بدلاً من مسح كل القيود من بداية تاريخ الشركة، يُخزَّن رصيد كل حساب
   في بداية كل شهر ويُحدَّث تدريجياً

2. Smart Index Strategy — استراتيجية الـ Indexes المحسَّنة
   Compound indexes تُغطي أنماط الاستعلام الفعلية

3. MongoDB Time-Series / Bucketing
   محاكاة Table Partitioning في MongoDB عبر Time-Bucket collections

4. Background Aggregation Jobs
   تحديث الأرصدة المُجمَّعة في الخلفية دون تأثير على الأداء
"""
import uuid, asyncio
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/performance", tags=["Performance & HA"])


# ══════════════════════════════════════════════════════════════
# MATERIALIZED BALANCE CACHE
# الأرصدة الافتتاحية الشهرية المُجمَّعة
# ══════════════════════════════════════════════════════════════

async def compute_period_balance(
    company_id: str, account_code: str,
    date_from: str, date_to: str
) -> dict:
    """
    احتساب رصيد حساب في فترة محددة من القيود المرحَّلة
    يستخدم $allowDiskUse لدعم النتائج الكبيرة
    """
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "status":     "posted",
            "entry_date": {"$gte": date_from, "$lte": date_to},
        }},
        {"$unwind": "$lines"},
        {"$match": {
            "lines.account_code": {"$regex": f"^{account_code}"}
        }},
        {"$group": {
            "_id":    None,
            "debit":  {"$sum": "$lines.debit"},
            "credit": {"$sum": "$lines.credit"},
        }},
    ]
    result = await db.journal_entries.aggregate(
        pipeline, allowDiskUse=True
    ).to_list(1)

    if not result:
        return {"debit": 0.0, "credit": 0.0, "net": 0.0}
    d = round(float(result[0]["debit"]),  2)
    c = round(float(result[0]["credit"]), 2)
    return {"debit": d, "credit": c, "net": round(d - c, 2)}


async def build_monthly_snapshot(
    company_id: str, year: int, month: int
) -> dict:
    """
    بناء snapshot كامل لجميع الحسابات في نهاية شهر محدد
    يُستخدَم لبناء الرصيد الافتتاحي للشهر التالي
    """
    snapshot_date = f"{year}-{month:02d}-01"
    month_end     = (date(year, month, 1) + relativedelta(months=1)
                     - relativedelta(days=1)).isoformat()

    # Get all account codes active for this company
    accounts = await db.chart_of_accounts.find(
        {"company_id": company_id, "allow_posting": True},
        {"_id": 0, "account_code": 1, "account_name": 1, "account_type": 1}
    ).to_list(None)

    if not accounts:
        return {"accounts": 0, "snapshot_date": snapshot_date}

    # Parallel: compute cumulative balance per account up to month_end
    async def get_balance(acc):
        bal = await compute_period_balance(
            company_id, acc["account_code"], "2000-01-01", month_end)
        return {"account_code": acc["account_code"],
                "account_name": acc.get("account_name",""),
                "account_type": acc.get("account_type",""),
                "debit":  bal["debit"],
                "credit": bal["credit"],
                "net":    bal["net"]}

    # Process in batches of 20 to avoid overwhelming DB
    balances = []
    batch_size = 20
    for i in range(0, len(accounts), batch_size):
        batch   = accounts[i:i+batch_size]
        results = await asyncio.gather(*[get_balance(a) for a in batch])
        balances.extend(results)

    snapshot = {
        "id":             str(uuid.uuid4()),
        "company_id":     company_id,
        "year":           year,
        "month":          month,
        "snapshot_date":  snapshot_date,
        "balances":       balances,
        "accounts_count": len(balances),
        "built_at":       datetime.now(timezone.utc).isoformat(),
    }

    # Upsert snapshot
    await db.account_balance_snapshots.replace_one(
        {"company_id": company_id, "year": year, "month": month},
        snapshot, upsert=True
    )
    return snapshot


async def get_opening_balance(
    company_id: str, account_code: str, year: int, month: int
) -> dict:
    """
    الرصيد الافتتاحي لحساب في بداية شهر محدد
    يقرأ من الـ Snapshot إن وجد، وإلا يحسبه من القيود
    """
    # Month 1 → opening balance is from previous year's snapshot or zero
    if month == 1:
        snap = await db.account_balance_snapshots.find_one({
            "company_id": company_id, "year": year-1, "month": 12
        }, {"_id": 0})
    else:
        snap = await db.account_balance_snapshots.find_one({
            "company_id": company_id, "year": year, "month": month-1
        }, {"_id": 0})

    if snap:
        acc_bal = next(
            (b for b in snap.get("balances",[])
             if b["account_code"].startswith(account_code) or
                account_code.startswith(b["account_code"])),
            None
        )
        if acc_bal:
            return {"source": "snapshot", **acc_bal}

    # Fallback: compute from scratch
    prev_month_end = (date(year, month, 1) - relativedelta(days=1)).isoformat()
    bal = await compute_period_balance(
        company_id, account_code, "2000-01-01", prev_month_end)
    return {"source": "computed", "account_code": account_code, **bal}


# ══════════════════════════════════════════════════════════════
# FAST TRIAL BALANCE — ميزان المراجعة السريع
# يستخدم الـ Snapshot + فقط القيود الحالية
# ══════════════════════════════════════════════════════════════

@router.get("/trial-balance/fast")
async def fast_trial_balance(
    year:  int = Query(...),
    month: int = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """
    ميزان المراجعة السريع — يستخدم Materialized Snapshots

    بدلاً من مسح ملايين القيود:
    1. اسحب الرصيد الافتتاحي من الـ Snapshot (ميلي ثانية)
    2. اجمع فقط قيود الشهر الحالي (محدودة)
    3. الناتج = الرصيد الختامي الدقيق

    Performance: O(snapshot) + O(current_month) بدلاً من O(all_history)
    """
    company_id = current_user["company_id"]
    df = f"{year}-{month:02d}-01"
    m2 = month+1; y2 = year
    if m2 > 12: y2 += 1; m2 = 1
    dt = f"{y2}-{m2:02d}-01"

    start_time = datetime.now()

    # Step 1: Get snapshot for opening balances
    snap = await db.account_balance_snapshots.find_one({
        "company_id": company_id,
        "year":       year if month > 1 else year-1,
        "month":      month-1 if month > 1 else 12,
    }, {"_id": 0})

    opening_balances = {}
    if snap:
        for b in snap.get("balances", []):
            opening_balances[b["account_code"]] = b
        snap_source = f"snapshot_{year if month>1 else year-1}_{month-1 if month>1 else 12}"
    else:
        snap_source = "none (first month or no snapshot)"

    # Step 2: Current month movements only
    pipeline = [
        {"$match": {
            "company_id": company_id,
            "status":     "posted",
            "entry_date": {"$gte": df, "$lt": dt},
        }},
        {"$unwind": "$lines"},
        {"$group": {
            "_id":   "$lines.account_code",
            "name":  {"$last": "$lines.account_name"},
            "debit": {"$sum": "$lines.debit"},
            "credit":{"$sum": "$lines.credit"},
        }},
        {"$sort": {"_id": 1}},
    ]
    current_month = await db.journal_entries.aggregate(
        pipeline, allowDiskUse=True
    ).to_list(None)

    # Step 3: Merge opening + current
    lines_out = []
    all_codes = set(opening_balances.keys()) | {r["_id"] for r in current_month}

    total_ob_dr = total_ob_cr = 0.0
    total_mv_dr = total_mv_cr = 0.0
    total_cl_dr = total_cl_cr = 0.0

    current_map = {r["_id"]: r for r in current_month}

    for code in sorted(all_codes):
        if not code: continue
        ob  = opening_balances.get(code, {})
        cur = current_map.get(code, {})

        ob_dr  = round(float(ob.get("debit",  0)), 2)
        ob_cr  = round(float(ob.get("credit", 0)), 2)
        mv_dr  = round(float(cur.get("debit",  0)), 2)
        mv_cr  = round(float(cur.get("credit", 0)), 2)
        cl_dr  = round(ob_dr + mv_dr, 2)
        cl_cr  = round(ob_cr + mv_cr, 2)

        total_ob_dr += ob_dr; total_ob_cr += ob_cr
        total_mv_dr += mv_dr; total_mv_cr += mv_cr
        total_cl_dr += cl_dr; total_cl_cr += cl_cr

        lines_out.append({
            "account_code":   code,
            "account_name":   ob.get("account_name","") or cur.get("name",""),
            "opening_debit":  ob_dr, "opening_credit": ob_cr,
            "movement_debit": mv_dr, "movement_credit": mv_cr,
            "closing_debit":  cl_dr, "closing_credit":  cl_cr,
        })

    elapsed = (datetime.now() - start_time).total_seconds()

    return {
        "period":       f"{year}/{month:02d}",
        "snapshot_used": snap_source,
        "accounts":     len(lines_out),
        "performance":  {
            "elapsed_seconds":    round(elapsed, 3),
            "method":             "Materialized Snapshot + Current Month Delta",
            "vs_full_scan":       "O(N_snapshot + N_month) vs O(N_all_history)",
        },
        "lines":        lines_out,
        "totals": {
            "opening":  {"debit": round(total_ob_dr,2), "credit": round(total_ob_cr,2)},
            "movement": {"debit": round(total_mv_dr,2), "credit": round(total_mv_cr,2)},
            "closing":  {"debit": round(total_cl_dr,2), "credit": round(total_cl_cr,2),
                         "balanced": abs(total_cl_dr - total_cl_cr) < 1.0},
        },
    }


# ══════════════════════════════════════════════════════════════
# SNAPSHOT MANAGEMENT — إدارة الـ Snapshots
# ══════════════════════════════════════════════════════════════

@router.post("/snapshots/build")
async def build_snapshot(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    بناء Snapshot لشهر محدد (في الخلفية)

    يُشغَّل في نهاية كل شهر لتجميع الأرصدة
    يمكن جدولته بـ cron: 0 2 1 * * (أول الشهر 02:00 صباحاً)
    """
    company_id = current_user["company_id"]
    year       = int(data.get("year",  date.today().year))
    month      = int(data.get("month", date.today().month))
    run_bg     = data.get("background", True)

    if run_bg:
        async def bg_task():
            await build_monthly_snapshot(company_id, year, month)

        background_tasks.add_task(bg_task)
        return {
            "message":  f"تم بدء بناء Snapshot {year}/{month:02d} في الخلفية",
            "year":     year, "month": month,
            "note":     "الـ Snapshot سيكون جاهزاً خلال 1-5 دقائق حسب حجم البيانات",
        }
    else:
        snap = await build_monthly_snapshot(company_id, year, month)
        return {
            "message":  f"✅ تم بناء Snapshot {year}/{month:02d}",
            "accounts": snap["accounts_count"],
            "built_at": snap["built_at"],
        }


@router.post("/snapshots/build-range")
async def build_snapshot_range(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    بناء Snapshots لنطاق تاريخي (للشركات الجديدة أو بعد Import)

    مثال: بناء snapshots من 2023/01 إلى 2026/09
    """
    company_id = current_user["company_id"]
    from_year  = int(data.get("from_year",  date.today().year))
    from_month = int(data.get("from_month", 1))
    to_year    = int(data.get("to_year",    date.today().year))
    to_month   = int(data.get("to_month",   date.today().month))

    periods = []
    y, m = from_year, from_month
    while (y, m) <= (to_year, to_month):
        periods.append((y, m))
        m += 1
        if m > 12: y += 1; m = 1

    async def bg_task():
        for y, m in periods:
            try:
                await build_monthly_snapshot(company_id, y, m)
            except Exception as e:
                pass  # Log and continue

    background_tasks.add_task(bg_task)

    return {
        "message":      f"تم بدء بناء {len(periods)} Snapshot في الخلفية",
        "periods":      [f"{y}/{m:02d}" for y, m in periods[:5]] + ["..."],
        "total":        len(periods),
        "estimated_time": f"{len(periods) * 2} دقيقة تقريباً",
    }


@router.get("/snapshots")
async def list_snapshots(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """قائمة الـ Snapshots المتاحة"""
    q = {"company_id": current_user["company_id"]}
    if year: q["year"] = year
    snaps = await db.account_balance_snapshots.find(
        q, {"_id": 0, "balances": 0}  # exclude large balances array
    ).sort([("year", -1), ("month", -1)]).to_list(None)
    return {
        "snapshots": snaps,
        "total":     len(snaps),
        "coverage":  f"{snaps[-1]['year']}/{snaps[-1]['month']:02d} → {snaps[0]['year']}/{snaps[0]['month']:02d}"
                     if snaps else "لا توجد snapshots",
    }


@router.delete("/snapshots/{year}/{month}")
async def delete_snapshot(
    year: int, month: int,
    current_user: dict = Depends(get_current_user)
):
    """حذف Snapshot (إن احتجت إعادة بنائه)"""
    result = await db.account_balance_snapshots.delete_one({
        "company_id": current_user["company_id"],
        "year": year, "month": month
    })
    if result.deleted_count == 0:
        raise HTTPException(404, f"لا يوجد Snapshot لـ {year}/{month:02d}")
    return {"message": f"✅ تم حذف Snapshot {year}/{month:02d}"}


# ══════════════════════════════════════════════════════════════
# INDEX MANAGEMENT — إدارة الـ Indexes
# ══════════════════════════════════════════════════════════════

@router.post("/indexes/rebuild")
async def rebuild_performance_indexes(
    current_user: dict = Depends(get_current_user)
):
    """
    بناء / إعادة بناء الـ Indexes المحسَّنة للأداء

    MongoDB Partitioning Strategy:
    - journal_entries: مُقسَّم بـ (company_id, entry_date, status)
    - الاستعلامات تستخدم هذا الـ Compound Index أولاً
    - يُعادِل Table Partitioning في SQL
    """
    results = []

    # Critical indexes for journal_entries (محاكاة Table Partitioning)
    je_indexes = [
        # الأهم: عزل الشركة + التاريخ + الحالة (يُعادِل Partition by YEAR)
        [("company_id", 1), ("entry_date", -1), ("status", 1)],
        # ميزان المراجعة السريع: company + account_code + date
        [("company_id", 1), ("lines.account_code", 1), ("entry_date", -1)],
        # البحث بالفترة المالية
        [("company_id", 1), ("fiscal_year", 1), ("period", 1), ("status", 1)],
        # المستند المصدر
        [("company_id", 1), ("source_document_type", 1), ("source_document_id", 1)],
    ]

    for idx_keys in je_indexes:
        try:
            await db.journal_entries.create_index(idx_keys, background=True)
            results.append({"collection": "journal_entries",
                            "index": str(idx_keys), "status": "✅ created"})
        except Exception as e:
            results.append({"collection": "journal_entries",
                            "index": str(idx_keys), "status": f"⚠️ {str(e)[:60]}"})

    # account_balance_snapshots — الأرصدة المُجمَّعة
    snap_indexes = [
        [("company_id", 1), ("year", -1), ("month", -1)],
    ]
    for idx_keys in snap_indexes:
        try:
            await db.account_balance_snapshots.create_index(idx_keys, background=True)
            results.append({"collection": "account_balance_snapshots",
                            "index": str(idx_keys), "status": "✅ created"})
        except Exception as e:
            results.append({"collection": "account_balance_snapshots",
                            "index": str(idx_keys), "status": f"⚠️ {str(e)[:60]}"})

    return {
        "message":     f"تم بناء {len(results)} index",
        "results":     results,
        "note":        "جميع الـ Indexes تُنشأ في الخلفية (background=True) بدون تأثير على الأداء",
        "sql_analog":  "يُعادِل: PARTITION BY RANGE (YEAR(entry_date)) في MySQL/PostgreSQL",
    }


@router.get("/indexes/explain")
async def explain_query(
    year:  int = Query(...),
    month: int = Query(...),
    account_prefix: str = Query("1"),
    current_user: dict = Depends(get_current_user)
):
    """
    تحليل خطة تنفيذ الاستعلام (Query Execution Plan)
    يُظهِر هل يستخدم الـ Index أم يعمل Full Collection Scan
    """
    company_id = current_user["company_id"]
    df = f"{year}-{month:02d}-01"
    m2 = month+1; y2 = year
    if m2>12: y2+=1; m2=1
    dt = f"{y2}-{m2:02d}-01"

    # Run explain on the most expensive query
    explain_result = await db.command({
        "explain": {
            "aggregate": "journal_entries",
            "pipeline": [
                {"$match": {
                    "company_id": company_id,
                    "status":     "posted",
                    "entry_date": {"$gte": df, "$lt": dt},
                }},
                {"$unwind": "$lines"},
                {"$match": {"lines.account_code": {"$regex": f"^{account_prefix}"}}},
                {"$group": {"_id": "$lines.account_code",
                            "debit": {"$sum": "$lines.debit"},
                            "credit": {"$sum": "$lines.credit"}}},
            ],
            "cursor": {},
        },
        "verbosity": "queryPlanner",
    })

    # Extract key info from explain
    stage = explain_result.get("stages", [{}])[0] if explain_result.get("stages") else {}
    winning_plan = explain_result.get("queryPlanner", {}).get("winningPlan", {})
    uses_index   = "IXSCAN" in str(winning_plan)

    return {
        "query_period":     f"{year}/{month:02d}",
        "account_prefix":   account_prefix,
        "uses_index":       uses_index,
        "index_status":     "✅ Index Scan (سريع)" if uses_index else "⚠️ COLLSCAN (بطيء — أنشئ الـ index)",
        "winning_plan":     str(winning_plan)[:500],
        "recommendation":   (
            "✅ الاستعلام محسَّن ويستخدم الـ Index"
            if uses_index else
            "⚠️ الاستعلام يعمل Full Scan — نفِّذ POST /indexes/rebuild"
        ),
    }


# ══════════════════════════════════════════════════════════════
# ARCHIVING — أرشفة القيود القديمة
# ══════════════════════════════════════════════════════════════

@router.post("/archive/old-entries")
async def archive_old_entries(
    data: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    أرشفة القيود القديمة من journal_entries إلى journal_entries_archive

    يُحرِّك القيود القديمة (> N سنوات) لـ collection مستقلة
    يُبقي الـ Active collection صغيرة → استعلامات أسرع

    يُعادِل: SQL Table Partitioning + Partition Pruning
    """
    company_id  = current_user["company_id"]
    older_than_years = int(data.get("older_than_years", 3))
    cutoff_date = (date.today() - relativedelta(years=older_than_years)).isoformat()
    dry_run     = data.get("dry_run", True)

    # Count entries to archive
    count = await db.journal_entries.count_documents({
        "company_id": company_id,
        "status":     "posted",
        "entry_date": {"$lt": cutoff_date},
    })

    if dry_run:
        return {
            "message":     f"[Dry Run] سيتم أرشفة {count:,} قيد",
            "cutoff_date": cutoff_date,
            "older_than":  f"{older_than_years} سنوات",
            "dry_run":     True,
            "to_execute":  "أرسل dry_run: false لتنفيذ الأرشفة الفعلية",
            "note":        "تأكد من وجود Snapshots كاملة قبل الأرشفة",
        }

    async def bg_archive():
        batch_size = 500
        archived   = 0
        while True:
            batch = await db.journal_entries.find({
                "company_id": company_id,
                "status":     "posted",
                "entry_date": {"$lt": cutoff_date},
            }).limit(batch_size).to_list(None)

            if not batch:
                break

            # Insert to archive collection
            for doc in batch:
                doc["archived_at"] = datetime.now(timezone.utc).isoformat()
            await db.journal_entries_archive.insert_many(batch)

            # Delete from main collection
            ids = [d["id"] for d in batch]
            await db.journal_entries.delete_many({"id": {"$in": ids}})

            archived += len(batch)

        # Update status
        await db.archive_operations.insert_one({
            "company_id":    company_id,
            "archived_count": archived,
            "cutoff_date":   cutoff_date,
            "completed_at":  datetime.now(timezone.utc).isoformat(),
        })

    background_tasks.add_task(bg_archive)

    return {
        "message":     f"بدأت أرشفة {count:,} قيد في الخلفية",
        "cutoff_date": cutoff_date,
        "entries_to_archive": count,
        "note": "القيود المُؤرشَفة متاحة في journal_entries_archive — لا تُحذَف",
    }


@router.get("/stats")
async def get_performance_stats(current_user: dict = Depends(get_current_user)):
    """إحصائيات أداء قاعدة البيانات"""
    company_id = current_user["company_id"]

    je_count     = await db.journal_entries.count_documents({"company_id": company_id})
    snap_count   = await db.account_balance_snapshots.count_documents({"company_id": company_id})
    archive_count= await db.journal_entries_archive.count_documents({"company_id": company_id})

    # Get date range of journal entries
    first = await db.journal_entries.find_one(
        {"company_id": company_id, "status": "posted"},
        {"_id": 0, "entry_date": 1},
        sort=[("entry_date", 1)]
    )
    last = await db.journal_entries.find_one(
        {"company_id": company_id, "status": "posted"},
        {"_id": 0, "entry_date": 1},
        sort=[("entry_date", -1)]
    )

    return {
        "company_id":   company_id,
        "journal_entries": {
            "active":   je_count,
            "archived": archive_count,
            "total":    je_count + archive_count,
            "date_from": first.get("entry_date","") if first else "",
            "date_to":   last.get("entry_date","") if last else "",
        },
        "snapshots": {
            "count":   snap_count,
            "coverage": f"{snap_count} شهر مُجمَّع",
        },
        "performance_mode": (
            "✅ Materialized Snapshots جاهزة — ميزان المراجعة سريع"
            if snap_count > 0 else
            "⚠️ لا توجد Snapshots — استخدم POST /snapshots/build-range"
        ),
        "recommendations": [
            f"بناء Snapshots للـ {je_count:,} قيد الحالية" if snap_count == 0 else None,
            f"أرشفة القيود القديمة ({archive_count:,} مُؤرشَف)" if je_count > 100_000 else None,
            "إعادة بناء الـ Indexes" if je_count > 50_000 else None,
        ],
    }
