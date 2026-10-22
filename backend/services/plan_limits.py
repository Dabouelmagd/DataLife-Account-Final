"""
ما تسمح به خطة الاشتراك — plan module limits.

The single-module plans ("الموارد البشرية فقط", "المالية فقط", "المخزون فقط")
were priced and sold and enforced nowhere: PLAN_FEATURES existed to render
the pricing cards, and no route ever asked which plan a company was on. A
customer paying 1,432 for inventory only had the full accounting, payroll and
invoicing system.

This states what each plan includes, and the permission layer refuses a
module the plan does not cover — with a message naming the plan and what to
upgrade to, rather than a bare 403 that reads like a bug.

Unknown or missing plan = full access. A company whose plan cannot be read
must not be locked out of its own books; failing open here is the safer
error, and it matches how the system behaved before.
"""

FULL = None          # None = every module

PLAN_MODULES = {
    "hr-only": {"hr", "hr_admin", "hr_financial", "employees", "payroll", "attendance",
                "leaves", "recruitment", "assessments", "settings", "dashboard", "reports"},
    "financial-only": {"financial", "invoices", "purchases", "accounting", "journal-entries",
                       "general-ledger", "financial-reports", "taxes", "treasury", "parties",
                       "settings", "dashboard", "reports"},
    "inventory-only": {"inventory", "products", "warehouses", "stock", "purchases",
                       "settings", "dashboard", "reports"},
    # size-based plans include everything; they differ in limits, not modules
    "starter": FULL, "professional": FULL, "enterprise": FULL, "trial": FULL,
}

PLAN_NAMES = {
    "hr-only": "الموارد البشرية فقط",
    "financial-only": "المالية فقط",
    "inventory-only": "المخزون فقط",
}


def allowed_modules(plan: str):
    """The module set a plan covers, or None for unrestricted."""
    if not plan:
        return FULL
    return PLAN_MODULES.get(str(plan).strip().lower(), FULL)


def covers(plan: str, module: str) -> bool:
    allowed = allowed_modules(plan)
    if allowed is None:
        return True
    return str(module or "").strip().lower() in allowed


def refusal_message(plan: str, module: str) -> str:
    name = PLAN_NAMES.get(str(plan).strip().lower(), plan)
    return (f"هذه الوحدة غير مشمولة في باقة «{name}». "
            f"للاستفادة منها بدّل إلى باقة كاملة من صفحة الاشتراك.")


# ── what each full plan includes (المبتدئ ← المحترف ← المؤسسي) ─────────────
# Starter is the base; the paths below need Professional or Enterprise.
# A sector pack opens its own tools on any plan. A trial, or a company with no
# active subscription, keeps everything. Subscriptions that started before
# TIER_START keep everything until they end (no one loses a tool mid-period).
import os
from datetime import datetime, timezone

TIER_START = "2026-10-22"
TIER_RANK = {"starter": 1, "professional": 2, "enterprise": 3}
TIER_NAME = {1: "المبتدئ", 2: "المحترف", 3: "المؤسسي"}

TIER_PATHS = [
    # Professional
    ("/api/fixed-assets", 2, "الأصول الثابتة والإهلاك"),
    ("/api/bank-reconciliation", 2, "التسوية البنكية"),
    ("/api/bank-checks", 2, "الشيكات"),
    ("/api/petty-cash", 2, "العهد"),
    ("/api/approvals", 2, "الموافقات"),
    ("/api/erp-core", 2, "الموافقات"),
    ("/api/projects", 2, "المشاريع"),
    ("/api/pos", 2, "نقاط البيع"),
    ("/api/inventory-engine", 2, "الجرد والتحويل بين المخازن وتكاليف الاستيراد"),
    ("/api/performance", 2, "تقييم الأداء"),
    ("/api/interviews", 2, "التوظيف والمقابلات"),
    ("/api/assessments", 2, "اختبارات التوظيف"),
    ("/api/insurance-forms", 2, "نماذج التأمينات"),
    ("/api/analytics", 2, "التحليلات"),
    ("/api/budget", 2, "الموازنة"),
    # Enterprise
    ("/api/financial-engine/fx", 3, "إعادة تقييم العملات الأجنبية"),
    ("/api/consolidation", 3, "القوائم المجمعة لأكثر من شركة"),
    ("/api/lc", 3, "الاعتمادات المستندية"),
    ("/api/trade-finance", 3, "التجارة الخارجية"),
    ("/api/deferred-tax", 3, "الضرائب المؤجلة"),
    ("/api/fraud", 3, "كشف الاحتيال"),
    ("/api/ecommerce", 3, "ربط المتجر الإلكتروني"),
    ("/api/real-estate", 3, "التطوير العقاري"),
    ("/api/manufacturing", 3, "التصنيع"),
]
# features checked inside a route rather than by path
TIER_FEATURES = {"gps": (2, "الحضور بالموقع GPS")}

PACK_UNLOCKS = {
    "construction": ("/api/projects",),
    "real_estate": ("/api/real-estate",),
    "manufacturing": ("/api/manufacturing", "/api/inventory-engine"),
    "import": ("/api/lc", "/api/trade-finance", "/api/inventory-engine"),
    "export": ("/api/lc", "/api/trade-finance"),
    "retail": ("/api/pos", "/api/inventory-engine"),
    "restaurants": ("/api/pos",),
}


def enforcing() -> bool:
    return os.environ.get("PLAN_ENFORCEMENT", "log") == "enforce"


def _match(path: str, prefix: str) -> bool:
    return path == prefix or path.startswith(prefix + "/")


def path_tier(path: str):
    """(rank needed, feature name) or None when any plan has it."""
    best = None
    for prefix, rank, name in TIER_PATHS:
        if _match(path, prefix) and (best is None or len(prefix) > best[0]):
            best = (len(prefix), rank, name)
    return (best[1], best[2]) if best else None


async def company_plan(db, company_id: str) -> dict:
    """{plan, rank, grandfathered, packs} — rank None means no limits."""
    sub = await db.subscriptions.find_one({"company_id": company_id, "status": "active"},
                                          {"_id": 0, "plan": 1, "created_at": 1, "start_date": 1}) or {}
    plan = (sub.get("plan") or "").strip().lower()
    started = str(sub.get("start_date") or sub.get("created_at") or "")[:10]
    company = await db.companies.find_one({"id": company_id}, {"_id": 0, "industry_packs": 1}) or {}
    return {"plan": plan, "rank": TIER_RANK.get(plan), "grandfathered": bool(started and started < TIER_START),
            "packs": list(company.get("industry_packs") or [])}


def tier_refusal(info: dict, path: str):
    """Arabic refusal when the plan does not include this path, else None."""
    need = path_tier(path)
    if not need or info.get("rank") is None or info.get("grandfathered"):
        return None
    rank, name = need
    if info["rank"] >= rank:
        return None
    if any(_match(path, p) for k in info.get("packs", []) for p in PACK_UNLOCKS.get(k, ())):
        return None
    return (f"«{name}» مش ضمن باقة «{TIER_NAME[info['rank']]}» — موجودة من باقة «{TIER_NAME[rank]}». "
            "رقّي باقتك من صفحة الاشتراك.")


async def feature_allowed(db, company_id: str, feature: str) -> bool:
    if not enforcing() or feature not in TIER_FEATURES:
        return True
    info = await company_plan(db, company_id)
    if info["rank"] is None or info["grandfathered"]:
        return True
    return info["rank"] >= TIER_FEATURES[feature][0]


def plan_features() -> dict:
    """For the pricing page and the sidebar: what needs which plan."""
    return {"paths": [{"prefix": p, "tier": r, "name": n} for p, r, n in TIER_PATHS],
            "features": {k: {"tier": r, "name": n} for k, (r, n) in TIER_FEATURES.items()},
            "pack_unlocks": {k: list(v) for k, v in PACK_UNLOCKS.items()}}
