"""
Which permission each API area needs.

Permissions were enforced by the frontend only (it hides modules), so any
logged-in company user could call payroll, ledger, treasury... APIs directly.
This map mirrors what the UI allows, with the cross-module uses the pages
actually make (treasury reads suppliers from /api/invoice, sales reads stock
from /api/inventory...). A prefix is allowed if the user has ANY of its
permissions.

PermissionMiddleware enforces by default (PERMISSION_ENFORCEMENT=enforce).
Set PERMISSION_ENFORCEMENT=log to only record what would be refused
(scripts/permission_denials.py summarises it) while adding a missing mapping.
"""
from models.permission import ROLE_PERMISSIONS

FIN = "financial"
PREFIX_PERMISSIONS = [
    # longest prefixes first
    ("/api/financial-engine", {FIN}),
    ("/api/cash-flow", {FIN}),
    ("/api/accounting", {FIN}),
    ("/api/financial", {FIN}),
    ("/api/treasury", {FIN}),
    ("/api/petty-cash", {FIN}),
    ("/api/bank-accounts", {FIN}),
    ("/api/bank-transactions", {FIN}),
    ("/api/bank-counter-accounts", {FIN}),
    ("/api/bank-settings", {FIN}),
    ("/api/bank-reconciliation", {FIN}),
    ("/api/expenses", {FIN}),
    ("/api/revenues", {FIN}),
    ("/api/tax-reports", {FIN}),
    ("/api/fixed-assets", {FIN}),
    ("/api/db-performance", {FIN}),   # trial-balance snapshots / indexes (moved off /api/performance, which is HR)
    ("/api/data-protection", {"hr", "settings"}),   # personal-data requests; finer role checks inside
    ("/api/company-policies", {"settings", "hr", FIN}),   # read by HR/finance; writes need a top role (checked inside)
    ("/api/data-export", {"settings", FIN, "hr"}),   # whole-company export; top roles only (checked inside)
    ("/api/consolidation", {FIN}),
    ("/api/invoices", {"invoices", FIN, "sales", "purchases"}),
    ("/api/invoice", {"invoices", FIN, "sales", "purchases"}),
    ("/api/eta", {"invoices", FIN}),
    ("/api/sales", {"sales", "invoices", FIN}),
    ("/api/ecommerce", {"sales", "invoices", FIN}),   # store connections + web orders (role check inside)
    ("/api/purchases", {"purchases", FIN}),
    ("/api/inventory", {"inventory", "sales", "purchases", FIN}),
    ("/api/interviews", {"hr"}),
    ("/api/assessments", {"hr"}),   # التقييمات مع التوظيف      # recruitment lives with HR
    ("/api/payroll", {"hr"}),
    ("/api/documents", {"hr", FIN, "settings"}),   # contracts and HR documents — was open to every login
    ("/api/hr", {"hr"}),
    ("/api/employees", {"hr"}),
    ("/api/attendance-pro", {"hr"}),
    ("/api/analytics", {"analytics", FIN}),
    ("/api/approvals", {"approvals"}),
    ("/api/import", {FIN, "hr", "inventory"}),
    # routers that had no entry, so any signed-in user of the company could
    # call them (several post journal entries). /api/hr does not cover these:
    # a prefix matches only up to "/", so /api/hr-engine is its own area.
    ("/api/hr-advanced", {"hr"}),
    ("/api/hr-engine", {"hr"}),
    ("/api/insurance-forms", {"hr"}),   # استمارات التأمينات 1 و6 (أجور وأرقام قومية)
    ("/api/performance", {"hr"}),
    ("/api/projects", {"projects", FIN}),
    ("/api/payment-vouchers", {FIN}),
    ("/api/bank-checks", {FIN}),
    ("/api/enterprise", {FIN}),
    ("/api/equity", {FIN}),
    ("/api/budget", {FIN}),
    ("/api/deferred-tax", {FIN}),
    ("/api/lc", {FIN}),
    ("/api/trade-finance", {FIN}),
    ("/api/real-estate", {FIN}),
    ("/api/fraud", {FIN}),
    ("/api/gov", {FIN, "hr"}),
    ("/api/erp-core", {"approvals", FIN}),
    ("/api/inventory-engine", {"inventory", "sales", "purchases", FIN}),
    ("/api/pos", {"sales", "inventory", FIN}),
    ("/api/manufacturing", {"inventory", FIN}),
    ("/api/reports", {"reports", "analytics", FIN, "hr"}),
    ("/api/audit", {"settings", "users"}),
]

# Everyone signed in needs these, whatever their permissions.
EXEMPT_PREFIXES = (
    "/api/auth", "/api/users/me", "/api/ess", "/api/attendance/check", "/api/attendance/my",
    "/api/notifications", "/api/push", "/api/tasks", "/api/chatbot", "/api/updates",
    "/api/permissions", "/api/companies/current", "/api/dashboard",
    # public: online stores post orders here with no login; each request is
    # authenticated by the HMAC signature of its body (api/ecommerce.py)
    "/api/ecommerce/webhook",
)

PLATFORM_ROLES = {"Super Admin"}

# An employee login (role موظف / Employee, created from the employee's profile
# «دعوة لبوابة الموظف») sees only its own portal. The screens already sent such
# a user to /my-portal, but its token could still call any API that is not in
# PREFIX_PERMISSIONS (sales, invoices, users…). These are the only paths an
# employee token may use; everything else is refused, whatever the
# PERMISSION_ENFORCEMENT mode.
EMPLOYEE_ROLES = {"Employee", "موظف"}
EMPLOYEE_ALLOWED = (
    "/api/auth", "/api/ess", "/api/users/me", "/api/users/upload-photo",
    "/api/notifications", "/api/push", "/api/chatbot", "/api/permissions/config",
    "/api/companies/current", "/api/attendance/check", "/api/attendance/my",
)


def employee_may(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") or path.startswith(p + "?") for p in EMPLOYEE_ALLOWED)


# «معاينة بوابة الموظف»: HR / top management open the portal as one employee
# (POST /api/ess/preview-token). That token is READ-ONLY and reaches the
# employee portal reads only — checked here for every request, before any
# route runs, so a route that forgot its own check still cannot write.
PREVIEW_PREFIX = "preview:"
PREVIEW_READONLY = "ده عرض تجريبي — مفيش حاجة بتتحفظ"
PREVIEW_READ_METHODS = {"GET", "HEAD", "OPTIONS"}
PREVIEW_DENIED = ("/api/ess/admin", "/api/ess/preview-token")


def is_preview_token(payload) -> bool:
    p = payload or {}
    return bool(p.get("preview")) or str(p.get("user_id") or "").startswith(PREVIEW_PREFIX)


def preview_refusal(method: str, path: str):
    """None when a preview token may make this request, else the refusal text."""
    if (method or "").upper() not in PREVIEW_READ_METHODS:
        return PREVIEW_READONLY
    if not (path == "/api/ess" or path.startswith("/api/ess/")):
        return "المعاينة بتفتح بوابة الموظف بس"
    if any(path == p or path.startswith(p + "/") for p in PREVIEW_DENIED):
        return "المعاينة بتفتح بوابة الموظف بس"
    return None


# money figures under otherwise-open prefixes: /api/dashboard is open to every
# login (each widget checks its own section), but these show company cash and
# budgets, which HR-only staff should not see
PRIORITY_PERMISSIONS = [
    ("/api/dashboard/owner-pulse", {"financial"}),
    ("/api/dashboard/budget-variance", {"financial"}),
]


def required_for(path: str):
    for prefix, perms in PRIORITY_PERMISSIONS:
        if path == prefix or path.startswith(prefix + "/"):
            return prefix, perms
    if path.startswith(EXEMPT_PREFIXES):
        return None
    for prefix, perms in PREFIX_PERMISSIONS:
        if path == prefix or path.startswith(prefix + "/"):
            return prefix, perms
    return None


def effective_permissions(user: dict) -> set:
    stored = set(user.get("permissions") or [])
    defaults = set((ROLE_PERMISSIONS.get(user.get("role") or "", {}) or {}).get("permissions", []))
    return stored | defaults
