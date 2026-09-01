"""
Fraud & Anomaly Detection Engine — محرك كشف الاحتيال والتلاعب المالي
الذكاء الاصطناعي الرقابي للأنظمة المالية المتقدمة

1. Benford's Law         — قانون بنفورد لكشف الأرقام المفتعلة
2. Duplicate Detection   — رصد الدفعات المكررة والفواتير المزدوجة
3. Ghost Employee        — كشف الموظفين الوهميين والساعات الشاذة
4. Statistical Outliers  — الانحراف المعياري والـ IQR للمبالغ الشاذة
5. Pattern Analysis      — أنماط مشبوهة في أوقات القيود
"""
import math, statistics, uuid, asyncio
from datetime import datetime, timezone, date
from collections import Counter
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from database import db
from api.users import get_current_user

router = APIRouter(prefix="/api/fraud", tags=["Fraud Detection AI"])

# ══════════════════════════════════════════════════════════════
# RISK LEVELS
# ══════════════════════════════════════════════════════════════
RISK = {
    "critical": {"level": "CRITICAL", "color": "#DC2626", "action": "تحقيق فوري مطلوب"},
    "high":     {"level": "HIGH",     "color": "#EA580C", "action": "مراجعة من المدير المالي"},
    "medium":   {"level": "MEDIUM",   "color": "#D97706", "action": "مراقبة وتوثيق"},
    "low":      {"level": "LOW",      "color": "#2563EB", "action": "سجِّل ومتابعة"},
    "clean":    {"level": "CLEAN",    "color": "#16A34A", "action": "نظيف"},
}

def risk_level(score: float) -> dict:
    if score >= 0.80: return RISK["critical"]
    if score >= 0.60: return RISK["high"]
    if score >= 0.40: return RISK["medium"]
    if score >= 0.20: return RISK["low"]
    return RISK["clean"]


async def save_alert(company_id: str, alert_type: str, risk_score: float,
                     details: dict, user_id: str = None) -> str:
    """حفظ تنبيه الاحتيال في قاعدة البيانات"""
    alert_id = str(uuid.uuid4())
    await db.fraud_alerts.insert_one({
        "id":          alert_id,
        "company_id":  company_id,
        "alert_type":  alert_type,
        "risk_score":  risk_score,
        "risk_level":  risk_level(risk_score)["level"],
        "details":     details,
        "status":      "open",
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "detected_by": "AI_Engine",
        "assigned_to": None,
        "resolved_at": None,
    })
    return alert_id


# ══════════════════════════════════════════════════════════════
# 1. BENFORD'S LAW — قانون بنفورد
# ══════════════════════════════════════════════════════════════

# Benford's expected distribution for first digits 1-9
BENFORD_EXPECTED = {
    1: 0.3010, 2: 0.1761, 3: 0.1249, 4: 0.0969,
    5: 0.0792, 6: 0.0669, 7: 0.0580, 8: 0.0512, 9: 0.0458
}


def get_first_digit(amount: float) -> Optional[int]:
    """استخراج الرقم الأول من المبلغ (بتجاهل الصفر واللاحقات)"""
    if amount <= 0:
        return None
    s = f"{amount:.2f}".replace(".", "").lstrip("0")
    return int(s[0]) if s else None


def chi_square_benford(observed: dict, n: int) -> float:
    """
    اختبار Chi-Square لمقارنة التوزيع الفعلي بتوزيع بنفورد
    القيمة الأعلى = ابتعاد أكبر عن التوزيع الطبيعي = احتمال تلاعب أعلى
    """
    chi2 = 0.0
    for digit in range(1, 10):
        expected_count = n * BENFORD_EXPECTED[digit]
        observed_count = observed.get(digit, 0)
        if expected_count > 0:
            chi2 += (observed_count - expected_count) ** 2 / expected_count
    return round(chi2, 4)


def mad_benford(observed: dict, n: int) -> float:
    """
    Mean Absolute Deviation — الانحراف المطلق المتوسط عن بنفورد
    MAD < 0.006 = مطابقة ممتازة | > 0.012 = شذوذ مرتفع
    """
    total_dev = 0.0
    for digit in range(1, 10):
        obs_pct = observed.get(digit, 0) / n if n > 0 else 0
        total_dev += abs(obs_pct - BENFORD_EXPECTED[digit])
    return round(total_dev / 9, 6)


@router.get("/benford")
async def benford_analysis(
    date_from:    Optional[str] = None,
    date_to:      Optional[str] = None,
    source:       str = Query("invoices"),  # invoices | expenses | payroll | all
    amount_field: str = Query("grand_total"),
    min_amount:   float = Query(100.0),
    current_user: dict = Depends(get_current_user)
):
    """
    تحليل قانون بنفورد على المصروفات والفواتير

    قانون بنفورد: في البيانات المالية الطبيعية، ~30% من الأرقام تبدأ بـ 1
    الانحراف الكبير عن هذا التوزيع = مؤشر تلاعب أو تزوير
    """
    company_id = current_user["company_id"]
    df = date_from or f"{date.today().year}-01-01"
    dt = date_to   or date.today().isoformat()

    # Collect amounts from source
    amounts = []

    if source in ("invoices","all"):
        invs = await db.invoices.find({
            "company_id": company_id,
            "document_date": {"$gte": df, "$lte": dt},
            "status": {"$nin": ["cancelled","draft"]},
        }, {"_id": 0, amount_field: 1}).to_list(None)
        amounts.extend([float(i.get(amount_field, 0)) for i in invs
                        if float(i.get(amount_field, 0)) >= min_amount])

    if source in ("expenses","all"):
        # Journal lines with expense accounts (3xxx)
        pipeline = [
            {"$match": {"company_id": company_id, "status": "posted",
                        "entry_date": {"$gte": df, "$lte": dt}}},
            {"$unwind": "$lines"},
            {"$match": {"lines.account_code": {"$regex": "^3"},
                        "lines.debit": {"$gte": min_amount}}},
            {"$project": {"amount": "$lines.debit"}},
        ]
        exp = await db.journal_entries.aggregate(pipeline).to_list(None)
        amounts.extend([float(e["amount"]) for e in exp])

    if source in ("payroll","all"):
        for run in await db.payroll_runs.find({
            "company_id": company_id,
            "status": {"$in": ["approved","paid"]},
        }, {"_id": 0, "employees_data": 1}).to_list(None):
            for emp in run.get("employees_data",[]):
                net = float(emp.get("net_salary",0))
                if net >= min_amount:
                    amounts.append(net)

    if len(amounts) < 30:
        return {"message": "البيانات غير كافية — يتطلب 30+ سجل للتحليل",
                "count": len(amounts)}

    # Count first digits
    first_digits = [get_first_digit(a) for a in amounts]
    first_digits = [d for d in first_digits if d is not None]
    observed     = dict(Counter(first_digits))
    n            = len(first_digits)

    # Statistical tests
    chi2 = chi_square_benford(observed, n)
    mad  = mad_benford(observed, n)

    # Risk scoring
    # Chi2 critical value for df=8, p=0.05 → 15.507
    chi2_risk = min(chi2 / 30, 1.0)
    mad_risk  = min(mad / 0.015, 1.0)
    risk_score = round((chi2_risk * 0.6 + mad_risk * 0.4), 3)

    # Identify suspicious digits (observed >> expected)
    suspicious = []
    for d in range(1, 10):
        obs_pct = observed.get(d, 0) / n
        exp_pct = BENFORD_EXPECTED[d]
        deviation = round(abs(obs_pct - exp_pct) / exp_pct * 100, 1)
        if deviation > 25:
            suspicious.append({
                "digit":      d,
                "observed":   round(obs_pct * 100, 2),
                "expected":   round(exp_pct * 100, 2),
                "deviation":  f"+{deviation:.1f}%",
                "warning":    "مرتفع جداً" if obs_pct > exp_pct * 1.5 else "منخفض جداً",
            })

    rl = risk_level(risk_score)
    alert_id = None
    if risk_score >= 0.40:
        alert_id = await save_alert(company_id, "benford_anomaly", risk_score, {
            "source": source, "n": n, "chi2": chi2, "mad": mad,
            "suspicious_digits": suspicious,
        }, current_user["user_id"])

    # Digit distribution table
    distribution = []
    for d in range(1, 10):
        obs_pct = observed.get(d, 0) / n
        distribution.append({
            "digit":          d,
            "observed_count": observed.get(d, 0),
            "observed_pct":   round(obs_pct * 100, 2),
            "expected_pct":   round(BENFORD_EXPECTED[d] * 100, 2),
            "deviation_pct":  round((obs_pct - BENFORD_EXPECTED[d]) * 100, 2),
        })

    return {
        "analysis": "قانون بنفورد — Benford's Law Analysis",
        "period":   {"from": df, "to": dt},
        "source":   source,
        "n":        n,
        "tests": {
            "chi_square":  chi2,
            "chi2_critical":"15.507 (p=0.05, df=8)",
            "chi2_result": "⚠️ احتمال تلاعب" if chi2 > 15.507 else "✅ طبيعي",
            "mad":         mad,
            "mad_scale":   "<0.006 ممتاز | 0.006-0.012 مقبول | >0.012 مشبوه",
            "mad_result":  "✅ مقبول" if mad < 0.012 else "⚠️ مشبوه",
        },
        "risk_score":   risk_score,
        "risk":         rl,
        "alert_id":     alert_id,
        "suspicious_digits": suspicious,
        "distribution": distribution,
        "interpretation": (
            "✅ التوزيع طبيعي — لا مؤشرات على تلاعب" if risk_score < 0.20 else
            f"⚠️ انحراف عن توزيع بنفورد — {rl['action']}"
        ),
    }


# ══════════════════════════════════════════════════════════════
# 2. DUPLICATE PAYMENT DETECTOR — كاشف المدفوعات المكررة
# ══════════════════════════════════════════════════════════════

@router.get("/duplicate-payments")
async def detect_duplicate_payments(
    date_from:     Optional[str] = None,
    date_to:       Optional[str] = None,
    tolerance_pct: float = Query(0.0, description="نسبة تفاوت مسموح (0 = مطابق تام)"),
    days_window:   int   = Query(30,  description="نافذة البحث بالأيام"),
    current_user:  dict  = Depends(get_current_user)
):
    """
    رصد الفواتير والمدفوعات المكررة

    يبحث عن:
    - نفس المورد + نفس المبلغ + فترة متقاربة
    - نفس رقم الفاتورة لمورد مختلف
    - مبالغ متطابقة لأطراف متعددين في نفس اليوم
    """
    company_id = current_user["company_id"]
    df = date_from or f"{date.today().year}-01-01"
    dt = date_to   or date.today().isoformat()

    invoices = await db.invoices.find({
        "company_id": company_id,
        "document_type": {"$in": ["purchase_invoice", "expense"]},
        "document_date": {"$gte": df, "$lte": dt},
        "status": {"$nin": ["cancelled"]},
    }, {"_id": 0, "id":1, "document_number":1, "document_date":1,
        "party_id":1, "party_name":1, "grand_total":1, "status":1}).to_list(None)

    duplicates = []
    suspicious_groups = []

    # Group by (party_id, rounded_amount)
    from itertools import combinations
    for i, inv_a in enumerate(invoices):
        for inv_b in invoices[i+1:]:
            # Same vendor + same amount + close dates
            same_vendor = inv_a.get("party_id") == inv_b.get("party_id")
            amt_a = float(inv_a.get("grand_total", 0))
            amt_b = float(inv_b.get("grand_total", 0))

            if amt_a == 0 or amt_b == 0:
                continue

            amt_diff_pct = abs(amt_a - amt_b) / max(amt_a, amt_b) * 100

            # Date proximity
            try:
                d_a = date.fromisoformat(inv_a.get("document_date",""))
                d_b = date.fromisoformat(inv_b.get("document_date",""))
                days_apart = abs((d_a - d_b).days)
            except Exception:
                days_apart = 999

            within_window = days_apart <= days_window
            within_tol    = amt_diff_pct <= tolerance_pct

            if same_vendor and within_tol and within_window and amt_diff_pct == 0:
                # Exact duplicate
                risk_s = 0.95 if days_apart <= 7 else 0.75
                duplicates.append({
                    "type":       "EXACT_DUPLICATE",
                    "invoice_a":  inv_a.get("document_number",""),
                    "invoice_b":  inv_b.get("document_number",""),
                    "vendor":     inv_a.get("party_name",""),
                    "amount":     amt_a,
                    "date_a":     inv_a.get("document_date",""),
                    "date_b":     inv_b.get("document_date",""),
                    "days_apart": days_apart,
                    "risk_score": risk_s,
                    "risk":       risk_level(risk_s)["level"],
                })
            elif same_vendor and within_tol and within_window and amt_diff_pct > 0:
                # Near duplicate
                risk_s = 0.55
                duplicates.append({
                    "type":       "NEAR_DUPLICATE",
                    "invoice_a":  inv_a.get("document_number",""),
                    "invoice_b":  inv_b.get("document_number",""),
                    "vendor":     inv_a.get("party_name",""),
                    "amount_a":   amt_a, "amount_b": amt_b,
                    "diff_pct":   round(amt_diff_pct, 2),
                    "days_apart": days_apart,
                    "risk_score": risk_s,
                    "risk":       risk_level(risk_s)["level"],
                })

    # Same amount, multiple vendors, same day (split payment suspicion)
    by_date_amount: dict = {}
    for inv in invoices:
        key = (inv.get("document_date",""), str(inv.get("grand_total","")))
        if key not in by_date_amount:
            by_date_amount[key] = []
        by_date_amount[key].append(inv)
    for key, group in by_date_amount.items():
        if len(group) >= 3:
            vendors = set(g.get("party_id","") for g in group)
            if len(vendors) >= 2:
                suspicious_groups.append({
                    "type":     "SAME_AMOUNT_MULTIPLE_VENDORS",
                    "date":     key[0],
                    "amount":   float(key[1]),
                    "count":    len(group),
                    "vendors":  [g.get("party_name","") for g in group],
                    "risk_score": 0.45,
                    "risk":     "MEDIUM",
                })

    all_issues = duplicates + suspicious_groups
    critical   = [d for d in all_issues if d.get("risk") in ("CRITICAL","HIGH")]

    # Save alerts for critical findings
    for issue in critical[:10]:
        await save_alert(company_id, "duplicate_payment",
                         issue.get("risk_score", 0.7), issue,
                         current_user["user_id"])

    return {
        "analysis":           "كاشف المدفوعات المكررة",
        "period":             {"from": df, "to": dt},
        "invoices_analyzed":  len(invoices),
        "duplicates_found":   len(duplicates),
        "suspicious_groups":  len(suspicious_groups),
        "critical_count":     len(critical),
        "total_at_risk":      round(sum(
            float(d.get("amount", d.get("amount_a",0))) for d in critical), 2),
        "duplicates":         duplicates[:20],
        "suspicious_groups":  suspicious_groups[:10],
        "recommendation": (
            f"🚨 {len(critical)} مدفوعة مشبوهة تحتاج مراجعة فورية"
            if critical else "✅ لا مدفوعات مكررة مشبوهة"
        ),
    }


# ══════════════════════════════════════════════════════════════
# 3. GHOST EMPLOYEE & ANOMALY HOURS — الموظف الوهمي والساعات الشاذة
# ══════════════════════════════════════════════════════════════

@router.get("/ghost-employees")
async def detect_ghost_employees(
    month: str = Query(..., description="2026-09"),
    current_user: dict = Depends(get_current_user)
):
    """
    كشف الموظفين الوهميين والساعات الشاذة

    فحوص:
    1. موظف في كشف الراتب بلا سجلات حضور
    2. موظف بساعات عمل إضافية مشبوهة (>= 3 أضعاف المتوسط)
    3. موظف بوقت إضافي بدون أمر عمل أو موافقة
    4. تسجيل حضور من مواقع بعيدة عن مكان العمل
    5. موظف بـ national_id مكرر
    """
    company_id = current_user["company_id"]
    y, m = map(int, month.split("-"))
    df = f"{y}-{m:02d}-01"
    m2 = m+1; y2 = y
    if m2>12: y2+=1; m2=1
    dt = f"{y2}-{m2:02d}-01"

    alerts = []

    # ── 1. موظفون في كشف الراتب بلا حضور ──────────────────────
    payroll_run = await db.payroll_runs.find_one({
        "company_id": company_id,
        "year": y, "month": m,
        "status": {"$in": ["approved","paid"]},
    }, {"_id": 0})

    if payroll_run:
        payroll_employees = {
            emp.get("employee_id"): emp
            for emp in payroll_run.get("employees_data",[])
        }

        # Get attendance records for this month
        attendance = await db.attendance_records.find({
            "company_id": company_id,
            "date": {"$gte": df, "$lt": dt},
        }, {"_id": 0, "employee_id": 1, "date":1, "work_hours":1,
            "check_in_location": 1}).to_list(None)

        attendance_emp = set(a["employee_id"] for a in attendance)

        for emp_id, emp_data in payroll_employees.items():
            net = float(emp_data.get("net_salary",0))
            if emp_id not in attendance_emp and net > 0:
                alerts.append({
                    "type":        "NO_ATTENDANCE_IN_PAYROLL",
                    "risk_score":  0.85,
                    "risk":        "CRITICAL",
                    "employee_id": emp_id,
                    "employee_name": emp_data.get("employee_name",""),
                    "net_salary":  net,
                    "month":       month,
                    "detail":      "موظف يتقاضى راتباً بدون أي سجل حضور هذا الشهر",
                    "action":      "التحقق الفوري من وجود الموظف وصحة بياناته",
                })

    # ── 2. ساعات عمل إضافية شاذة (Z-Score) ────────────────────
    emp_hours: dict = {}
    for att in (attendance if payroll_run else []):
        eid = att["employee_id"]
        hrs = float(att.get("work_hours") or 0)
        if eid not in emp_hours:
            emp_hours[eid] = []
        emp_hours[eid].append(hrs)

    if len(emp_hours) >= 3:
        all_daily_hours = [h for hrs in emp_hours.values() for h in hrs if h > 0]
        if all_daily_hours:
            mean_h = statistics.mean(all_daily_hours)
            std_h  = statistics.stdev(all_daily_hours) if len(all_daily_hours) > 1 else 0

            for emp_id, hours_list in emp_hours.items():
                total_h = sum(hours_list)
                avg_h   = total_h / len(hours_list) if hours_list else 0
                z_score = (avg_h - mean_h) / std_h if std_h > 0 else 0

                if z_score > 2.5 or avg_h > 14:  # > 14 hours/day suspicious
                    emp_name = next(
                        (e.get("employee_name","") for e in
                         payroll_run.get("employees_data",[])
                         if e.get("employee_id") == emp_id), emp_id
                    ) if payroll_run else emp_id
                    alerts.append({
                        "type":         "ANOMALY_WORK_HOURS",
                        "risk_score":   min(0.30 + z_score * 0.1, 0.90),
                        "risk":         "HIGH" if z_score > 3 else "MEDIUM",
                        "employee_id":  emp_id,
                        "employee_name": emp_name,
                        "avg_daily_hours": round(avg_h, 2),
                        "company_avg":  round(mean_h, 2),
                        "z_score":      round(z_score, 2),
                        "detail":       f"متوسط {avg_h:.1f} ساعة/يوم vs متوسط الشركة {mean_h:.1f}",
                        "action":       "مراجعة سجلات الحضور وأوامر الوقت الإضافي",
                    })

    # ── 3. تسجيل حضور من مواقع بعيدة ──────────────────────────
    for att in (attendance if payroll_run else []):
        loc = att.get("check_in_location",{})
        geofence = loc.get("geofence_status","")
        dist     = loc.get("distance_from_office_m")
        if geofence == "out_of_range" and dist and float(dist) > 2000:
            alerts.append({
                "type":         "REMOTE_LOCATION_CHECKIN",
                "risk_score":   0.55,
                "risk":         "MEDIUM",
                "employee_id":  att["employee_id"],
                "date":         att.get("date",""),
                "distance_m":   float(dist),
                "detail":       f"تسجيل حضور من مسافة {dist:.0f}م عن مكان العمل",
                "action":       "التحقق من إذن العمل عن بُعد",
            })

    # ── 4. Duplicate National IDs ────────────────────────────
    all_employees = await db.employees.find(
        {"company_id": company_id, "status": "active"},
        {"_id": 0, "id":1, "name":1, "national_id":1}
    ).to_list(None)

    nid_map: dict = {}
    for emp in all_employees:
        nid = emp.get("national_id","")
        if nid and len(nid) >= 10:
            if nid not in nid_map:
                nid_map[nid] = []
            nid_map[nid].append(emp)

    for nid, emps in nid_map.items():
        if len(emps) >= 2:
            alerts.append({
                "type":        "DUPLICATE_NATIONAL_ID",
                "risk_score":  0.95,
                "risk":        "CRITICAL",
                "national_id": nid[:6] + "****" + nid[-3:],
                "employees":   [{"id": e["id"], "name": e.get("name","")} for e in emps],
                "detail":      f"رقم قومي واحد مسجَّل لـ {len(emps)} موظفين",
                "action":      "تحقيق فوري — احتمال موظف وهمي",
            })

    # ── 5. Unapproved overtime ────────────────────────────────
    unapproved_ot = await db.ess_requests.count_documents({
        "company_id": company_id,
        "request_type": "overtime",
        "status": "pending",
        "date": {"$gte": df, "$lt": dt},
    })
    if unapproved_ot > 0:
        alerts.append({
            "type":       "UNAPPROVED_OVERTIME",
            "risk_score": 0.35,
            "risk":       "LOW",
            "count":      unapproved_ot,
            "month":      month,
            "detail":     f"{unapproved_ot} طلب وقت إضافي بدون اعتماد في الكشف",
            "action":     "مراجعة وتسوية طلبات الوقت الإضافي المعلقة",
        })

    # Sort by risk score
    alerts.sort(key=lambda x: x.get("risk_score",0), reverse=True)

    # Save critical alerts
    for alert in alerts[:5]:
        if alert.get("risk_score",0) >= 0.60:
            await save_alert(company_id, alert["type"],
                             alert["risk_score"], alert,
                             current_user["user_id"])

    critical = [a for a in alerts if a.get("risk") in ("CRITICAL","HIGH")]
    return {
        "analysis":    "كشف الموظفين الوهميين والساعات الشاذة",
        "month":       month,
        "total_alerts": len(alerts),
        "critical":    len(critical),
        "alerts":      alerts,
        "summary": {
            "no_attendance":    sum(1 for a in alerts if a["type"]=="NO_ATTENDANCE_IN_PAYROLL"),
            "anomaly_hours":    sum(1 for a in alerts if a["type"]=="ANOMALY_WORK_HOURS"),
            "remote_checkins":  sum(1 for a in alerts if a["type"]=="REMOTE_LOCATION_CHECKIN"),
            "duplicate_ids":    sum(1 for a in alerts if a["type"]=="DUPLICATE_NATIONAL_ID"),
            "unapproved_ot":    sum(1 for a in alerts if a["type"]=="UNAPPROVED_OVERTIME"),
        },
        "recommendation": (
            f"🚨 {len(critical)} تنبيه حرج يتطلب تحقيقاً فورياً"
            if critical else "✅ لا مؤشرات احتيال واضحة هذا الشهر"
        ),
    }


# ══════════════════════════════════════════════════════════════
# 4. STATISTICAL OUTLIER DETECTION — رصد الشذوذ الإحصائي
# ══════════════════════════════════════════════════════════════

@router.get("/outliers")
async def detect_statistical_outliers(
    date_from:  Optional[str] = None,
    date_to:    Optional[str] = None,
    account_prefix: str = Query("3", description="بادئة الحساب (3=مصروفات)"),
    method:     str = Query("iqr", description="iqr | zscore"),
    current_user: dict = Depends(get_current_user)
):
    """
    كشف الشذوذ الإحصائي في المصروفات والمبالغ

    طرق الكشف:
    - IQR (Interquartile Range): Q3 + 1.5×IQR = حد أعلى
    - Z-Score: |z| > 3 = شاذ
    """
    company_id = current_user["company_id"]
    df = date_from or f"{date.today().year}-01-01"
    dt = date_to   or date.today().isoformat()

    pipeline = [
        {"$match": {"company_id": company_id, "status": "posted",
                    "entry_date": {"$gte": df, "$lte": dt}}},
        {"$unwind": "$lines"},
        {"$match": {"lines.account_code": {"$regex": f"^{account_prefix}"},
                    "lines.debit": {"$gt": 0}}},
        {"$project": {
            "amount":       "$lines.debit",
            "account_code": "$lines.account_code",
            "account_name": "$lines.account_name",
            "description":  "$description",
            "entry_date":   1,
        }},
    ]
    records = await db.journal_entries.aggregate(
        pipeline, allowDiskUse=True
    ).to_list(None)

    if len(records) < 10:
        return {"message": "بيانات غير كافية — يتطلب 10+ سجل", "count": len(records)}

    amounts = [float(r.get("amount",0)) for r in records]

    if method == "iqr":
        sorted_a = sorted(amounts)
        n = len(sorted_a)
        q1 = sorted_a[n//4]
        q3 = sorted_a[3*n//4]
        iqr = q3 - q1
        upper_fence = q3 + 1.5 * iqr
        lower_fence = max(q1 - 1.5 * iqr, 0)
        outliers = [r for r in records
                    if float(r.get("amount",0)) > upper_fence
                    or float(r.get("amount",0)) < lower_fence]
        stats_info = {"q1": round(q1,2), "q3": round(q3,2),
                      "iqr": round(iqr,2), "upper_fence": round(upper_fence,2)}
    else:
        mean_a  = statistics.mean(amounts)
        std_a   = statistics.stdev(amounts) if len(amounts)>1 else 0
        outliers = [r for r in records
                    if std_a > 0 and abs((float(r.get("amount",0)) - mean_a) / std_a) > 3]
        stats_info = {"mean": round(mean_a,2), "std": round(std_a,2),
                      "threshold_z": 3}

    # Risk score based on outlier ratio
    outlier_ratio = len(outliers) / len(records)
    risk_score    = min(outlier_ratio * 3, 1.0)

    # Enrich outliers with risk info
    enriched = []
    for r in sorted(outliers, key=lambda x: float(x.get("amount",0)), reverse=True)[:20]:
        enriched.append({
            "entry_date":   r.get("entry_date",""),
            "account_code": r.get("account_code",""),
            "account_name": r.get("account_name",""),
            "description":  r.get("description","")[:80],
            "amount":       round(float(r.get("amount",0)), 2),
            "risk_score":   round(min(float(r.get("amount",0)) / upper_fence
                                      if method=="iqr" else 0.7, 1.0), 2),
        })

    return {
        "analysis":        "كشف الشذوذ الإحصائي في المصروفات",
        "period":          {"from": df, "to": dt},
        "method":          method.upper(),
        "records_analyzed": len(records),
        "outliers_found":  len(outliers),
        "outlier_ratio":   f"{outlier_ratio*100:.1f}%",
        "statistics":      stats_info,
        "risk_score":      round(risk_score, 3),
        "risk":            risk_level(risk_score),
        "outliers":        enriched,
        "recommendation": (
            f"⚠️ {len(outliers)} مبلغ شاذ إحصائياً يستحق المراجعة"
            if outliers else "✅ التوزيع طبيعي — لا شذوذ"
        ),
    }


# ══════════════════════════════════════════════════════════════
# 5. COMPREHENSIVE FRAUD SCAN — المسح الشامل
# ══════════════════════════════════════════════════════════════

@router.post("/full-scan")
async def full_fraud_scan(
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    مسح شامل لجميع مؤشرات الاحتيال دفعة واحدة
    يُشغَّل شهرياً أو ربع سنوياً
    """
    company_id = current_user["company_id"]
    year  = data.get("year",  date.today().year)
    month = data.get("month", date.today().month)
    month_str = f"{year}-{month:02d}"
    df = f"{year}-{month:02d}-01"
    dt = f"{year}-{month+1 if month<12 else 1:02d}-01"

    scan_id = str(uuid.uuid4())
    results = {}

    # Run all detectors in parallel
    async def safe_call(fn, *args, **kwargs):
        try:
            return await fn(*args, **kwargs)
        except Exception as e:
            return {"error": str(e)[:100]}

    # Minimal user mock
    user = {"company_id": company_id,
            "user_id": current_user.get("user_id","")}

    (benford_res, dup_res, ghost_res, outlier_res) = await asyncio.gather(
        safe_call(benford_analysis, df, dt, "all", "grand_total", 0.0, user),
        safe_call(detect_duplicate_payments, df, dt, 0.0, 30, user),
        safe_call(detect_ghost_employees, month_str, user),
        safe_call(detect_statistical_outliers, df, dt, "3", "iqr", user),
    )

    results = {
        "benford":    benford_res,
        "duplicates": dup_res,
        "ghost":      ghost_res,
        "outliers":   outlier_res,
    }

    # Overall risk
    scores = [
        float(benford_res.get("risk_score", 0)),
        0.8 if int(dup_res.get("critical_count",0)) > 0 else 0.1,
        float(ghost_res.get("critical",0)) * 0.3,
        float(outlier_res.get("risk_score",0)),
    ]
    overall_score = round(sum(scores) / len(scores), 3)
    rl = risk_level(overall_score)

    # Save scan summary
    await db.fraud_scans.insert_one({
        "id":           scan_id,
        "company_id":   company_id,
        "period":       {"year": year, "month": month},
        "overall_risk": overall_score,
        "risk_level":   rl["level"],
        "alerts_count": sum([
            1 if benford_res.get("risk_score",0) >= 0.40 else 0,
            int(dup_res.get("critical_count",0)),
            int(ghost_res.get("critical",0)),
            1 if outlier_res.get("risk_score",0) >= 0.40 else 0,
        ]),
        "scan_date":    datetime.now(timezone.utc).isoformat(),
    })

    return {
        "scan_id":      scan_id,
        "period":       month_str,
        "overall_risk_score": overall_score,
        "overall_risk": rl,
        "summary": {
            "benford_anomaly":    benford_res.get("risk_score",0) >= 0.40,
            "duplicate_payments": int(dup_res.get("critical_count",0)),
            "ghost_employees":    int(ghost_res.get("critical",0)),
            "statistical_outliers": int(outlier_res.get("outliers_found",0)),
        },
        "results": results,
        "recommendation": rl["action"],
    }


# ══════════════════════════════════════════════════════════════
# ALERTS MANAGEMENT — إدارة التنبيهات
# ══════════════════════════════════════════════════════════════

@router.get("/alerts")
async def list_fraud_alerts(
    status:     Optional[str] = None,
    risk_level_filter: Optional[str] = None,
    limit:      int = Query(50),
    current_user: dict = Depends(get_current_user)
):
    q = {"company_id": current_user["company_id"]}
    if status:             q["status"]     = status
    if risk_level_filter:  q["risk_level"] = risk_level_filter.upper()
    alerts = await db.fraud_alerts.find(q, {"_id": 0}).sort(
        "detected_at", -1).limit(limit).to_list(None)
    summary = {
        "CRITICAL": sum(1 for a in alerts if a.get("risk_level")=="CRITICAL"),
        "HIGH":     sum(1 for a in alerts if a.get("risk_level")=="HIGH"),
        "MEDIUM":   sum(1 for a in alerts if a.get("risk_level")=="MEDIUM"),
        "LOW":      sum(1 for a in alerts if a.get("risk_level")=="LOW"),
    }
    return {"alerts": alerts, "total": len(alerts), "by_risk": summary}


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, data: dict,
                        current_user: dict = Depends(get_current_user)):
    result = await db.fraud_alerts.update_one(
        {"id": alert_id, "company_id": current_user["company_id"]},
        {"$set": {
            "status":      "resolved",
            "resolution":  data.get("resolution",""),
            "resolved_by": current_user["user_id"],
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "التنبيه غير موجود")
    return {"message": "✅ تم إغلاق التنبيه", "alert_id": alert_id}
