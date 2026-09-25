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
