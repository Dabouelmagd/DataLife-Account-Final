"""
حسابات باقات القطاعات في القيود التلقائية — Industry-pack accounts in automatic postings.

A pack (services/industry_packs.py) only ADDS accounts to a company's chart,
so "the company has the pack" is exactly "the account code exists in its
chart". Until now almost nothing posted to those accounts: a retailer's stock
count still went to the generic loss account, a restaurant's POS cost of
sales to 314, an exporter's zero-rated sale to 411.

One table decides it. Each ROLE lists account codes, pack account first and
today's default last; the first one this company has (and can post to) wins.
A company without the pack therefore gets the default — exactly what it got
before this module existed. A role with no default (pack-only) yields None
from `optional()` so the caller keeps its own behaviour, or a readable Arabic
error from `pick()` when the user explicitly asked for that pack category.

Never returns a made-up account: every result is a real chart document.
"""
from typing import Iterable, Optional

from services import ops_posting as P

# role → codes, pack account(s) first, today's default (if any) last
ROLES = {
    # ── التجزئة (retail) ──────────────────────────────────────────
    # stock-count shortage within tolerance (default: 3365 خسائر عهد ومفقودات)
    "stock_count_shortage": ["3471", "3365"],
    # stock-count surplus (default: 423 إيرادات متنوعة أخرى)
    "stock_count_surplus":  ["3471", "423"],
    # card network commission on a POS card settlement (default: 334 عمولات بنكية)
    "card_network_fee":     ["3472", "334"],
    # card money not yet in the bank (pack-only: without it cards go to the bank)
    "card_in_transit":      ["167", "166"],

    # ── المطاعم (restaurants) ─────────────────────────────────────
    "pos_cost_of_sales":    ["347", "314"],      # تكلفة الأغذية والمشروبات / تكلفة البضاعة المباعة
    "pos_waste":            ["33612", "33610"],  # هالك المطبخ / مصروف تالف وهدر

    # ── التصدير (export) ──────────────────────────────────────────
    "export_revenue":       ["424"],             # pack-only: else the invoice's own revenue account

    # ── التعليم والنقل (education / logistics) ────────────────────
    # revenue of invoice lines that are service items (pack-only: else 411 as today)
    "service_line_revenue": ["429", "428"],
    # revenue collected in advance (prepayments module)
    "deferred_revenue":     ["247", "257"],
    # what a deferral becomes month by month, when the user names no account
    "deferred_revenue_income": ["429", "428", "412"],

    # ── المكاتب المهنية (professional) ────────────────────────────
    "audit_fee_revenue":         ["425"],        # invoice_type "accounting"
    "advisory_fee_revenue":      ["426"],        # invoice_type "legal"
    "incorporation_fee_revenue": ["427"],        # invoice_type "incorporation"

    # ── المقاولات (construction) ──────────────────────────────────
    "subcontractor_payable":   ["243", "251"],
    "project_equipment":       ["318", "313"],   # project expense category "equipment"
    "project_quality_testing": ["319"],          # pack-only project category
    "project_site_permits":    ["322"],          # pack-only project category
    "project_consultants":     ["346"],          # professional pack: consultant costs on engagements

    # ── التطوير العقاري (real estate) ─────────────────────────────
    "re_contract_liability":   ["245", "2431"],
    "re_cheques":              ["144", "163"],

    # ── التصنيع (manufacturing) ───────────────────────────────────
    "foh_utilities":           ["325"],          # parts of actual overhead booked to the pack accounts
    "foh_maintenance":         ["326"],
    "foh_safety":              ["327"],
    "packaging_stock":         ["130"],          # materials issued from packaging stock

    # ── الاستيراد (import) ────────────────────────────────────────
    # expense of an LC cost type when the LC is cancelled (default: 3375 like "other")
    "import_demurrage":        ["3376", "3375"],
    "import_inspection":       ["3377", "3375"],
    "import_inland_haulage":   ["3378", "3375"],

    # ── بنود العهد النثرية (petty cash, pack-only categories) ─────
    "petty_fleet_fuel":        ["3481"],
    "petty_fleet_maintenance": ["3482"],
    "petty_vehicle_licences":  ["3483"],
    "petty_educational_materials": ["3492"],
    "petty_kitchen_waste":     ["33612"],
}


def codes(role: str) -> list:
    return list(ROLES[role])


def postable(acc: Optional[dict]) -> bool:
    return bool(acc) and not (acc.get("is_header") or acc.get("allow_posting") is False
                              or str(acc.get("account_category", "")).endswith("header")
                              or acc.get("is_active") is False)


def pick_from(by_code: dict, role: str) -> Optional[dict]:
    """Sync form for code → account maps already loaded (invoice / project posting)."""
    for c in ROLES[role]:
        if postable(by_code.get(c)):
            return by_code[c]
    return None


def pick_from_list(accounts: Iterable[dict], role: str) -> Optional[dict]:
    return pick_from({a.get("account_code"): a for a in accounts}, role)


async def optional(db, company_id: str, role: str) -> Optional[dict]:
    """First postable account of the role in this company's chart, or None."""
    for c in ROLES[role]:
        acc = await db.chart_of_accounts.find_one({"company_id": company_id, "account_code": c}, {"_id": 0})
        if postable(acc):
            return acc
    return None


async def pick(db, company_id: str, role: str) -> dict:
    """Like optional(), but a missing account is a readable Arabic 400 (with
    the pack to subscribe to) — never a fake account."""
    acc = await optional(db, company_id, role)
    if acc:
        return acc
    return await P.get_account(db, company_id, ROLES[role][-1])   # raises the readable error


async def pick_code(db, company_id: str, role: str) -> str:
    return (await pick(db, company_id, role))["account_code"]
