"""
Which permission each API area needs.

Permissions were enforced by the frontend only (it hides modules), so any
logged-in company user could call payroll, ledger, treasury... APIs directly.
This map mirrors what the UI allows, with the cross-module uses the pages
actually make (treasury reads suppliers from /api/invoice, sales reads stock
from /api/inventory...). A prefix is allowed if the user has ANY of its
permissions.

Rollout: PermissionMiddleware runs in "log" mode first (records what WOULD be
refused, blocks nothing). scripts/permission_denials.py summarises it; once
the legitimate cases are exempted, set PERMISSION_ENFORCEMENT=enforce.
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
    ("/api/expenses", {FIN}),
    ("/api/revenues", {FIN}),
    ("/api/tax-reports", {FIN}),
    ("/api/fixed-assets", {FIN}),
    ("/api/db-performance", {FIN}),   # trial-balance snapshots / indexes (moved off /api/performance, which is HR)
    ("/api/data-protection", {"hr", "settings"}),   # personal-data requests; finer role checks inside
    ("/api/company-policies", {"settings", "hr", FIN}),   # read by HR/finance; writes need a top role (checked inside)
    ("/api/consolidation", {FIN}),
    ("/api/invoices", {"invoices", FIN, "sales", "purchases"}),
    ("/api/invoice", {"invoices", FIN, "sales", "purchases"}),
    ("/api/eta", {"invoices", FIN}),
    ("/api/sales", {"sales", "invoices", FIN}),
    ("/api/purchases", {"purchases", FIN}),
    ("/api/inventory", {"inventory", "sales", "purchases", FIN}),
    ("/api/interviews", {"hr"}),
    ("/api/assessments", {"hr"}),   # التقييمات مع التوظيف      # recruitment lives with HR
    ("/api/payroll", {"hr"}),
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
)

PLATFORM_ROLES = {"Super Admin"}


def required_for(path: str):
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
