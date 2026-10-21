"""
Database Indexes — Performance Optimization
Run: docker exec -it datalife_backend python3 -m scripts.create_indexes
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME   = os.environ.get("DB_NAME", "datalife_erp")

INDEXES = {
    "journal_entries": [
        [("company_id", 1), ("entry_date", -1)],
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("fiscal_year", 1), ("period", 1)],
        [("source_document_type", 1), ("source_document_id", 1)],
        [("company_id", 1), ("entry_number", -1)],
        [("entry_number_str", 1)],
        [("company_id", 1), ("approved_by", 1)],
        # account statements / trial balance by account code over a period
        [("company_id", 1), ("lines.account_code", 1), ("entry_date", 1)],
        # NOT unique: entry numbers came from count-based generators for years
        # and existing data can hold duplicates — a unique build would fail
        # (and fail every startup). (company_id, entry_number) lookups use the
        # non-unique ("company_id", "entry_number", -1) index above.
    ],
    "journal_counters": [
        [("company_id", 1)],
    ],
    "chart_of_accounts": [
        [("company_id", 1), ("account_code", 1)],   # UNIQUE per company
        [("company_id", 1), ("account_type", 1)],
        [("company_id", 1), ("is_active", 1)],
        [("company_id", 1), ("parent_account_id", 1)],   # tree traversal
        [("company_id", 1), ("is_reconciliation", 1)],   # filter reconciliation accounts
        [("company_id", 1), ("allow_posting", 1)],        # filter postable accounts
    ],
    "general_ledger": [
        [("company_id", 1), ("account_id", 1), ("entry_date", -1)],
        [("journal_entry_id", 1)],
        [("company_id", 1), ("entry_date", 1)],
    ],
    "employees": [
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("department", 1)],
        [("email", 1)],
    ],
    "invoices": [
        [("company_id", 1), ("invoice_date", -1)],
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("customer_id", 1)],
        [("eta_uuid", 1)],
        [("eta_submission_id", 1)],              # SQL: eta_submission_id
        [("company_id", 1), ("eta_status", 1)],  # SQL: eta_status filter
        [("eta_item_code_type", 1)],              # SQL: eta_item_code_type (GS1/EGS)
        # the shared invoice store (document_type / party_id / document_date):
        # customer & supplier statements, sales lists by period
        [("company_id", 1), ("document_type", 1), ("party_id", 1), ("document_date", 1)],
        [("company_id", 1), ("document_type", 1), ("document_date", 1)],
    ],
    "payments": [
        [("company_id", 1), ("invoice_id", 1)],
    ],
    "cheques": [
        [("company_id", 1), ("customer_id", 1), ("direction", 1)],
    ],
    "payroll_runs": [
        [("company_id", 1), ("month", -1)],      # serves (company_id, month) lookups too
        [("company_id", 1), ("status", 1)],
    ],
    "payroll_jobs": [
        [("company_id", 1), ("run_id", 1), ("created_at", -1)],
    ],
    "payroll_bank_file_settings": [
        [("company_id", 1)],
    ],
    "audit_logs": [
        [("company_id", 1), ("timestamp", -1)],
        [("entity_type", 1), ("entity_id", 1)],
    ],
    "users": [
        [("email", 1)],
        [("company_id", 1), ("is_active", 1)],
    ],
    "companies": [
        [("is_active", 1)],
        [("subscription_type", 1)],
    ],
        "progress_claims": [
        [("company_id", 1), ("project_id", 1), ("claim_number", 1)],
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("claim_type", 1)],
        [("project_id", 1), ("claim_number", 1), ("claim_type", 1)],
        [("company_id", 1), ("partner_id", 1)],
    ],
    "project_boq": [
        [("company_id", 1), ("project_id", 1)],
        [("project_id", 1), ("item_number", 1)],
    ],
    "payroll_tax_brackets": [
        [("tax_year", 1), ("bracket_order", 1)],
    ],
    "app_updates": [
        [("is_active", 1), ("created_at", -1)],
    ],
    # ── HR & Finance collections ───────────────────────
    "attendance": [
        [("company_id", 1), ("date", -1)],
        [("company_id", 1), ("employee_id", 1), ("date", -1)],
        [("company_id", 1), ("status", 1)],
    ],
    "leaves": [
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("employee_id", 1)],
        [("company_id", 1), ("start_date", -1)],
    ],
    # the collection the attendance API and payroll actually use
    # ("attendance" above is a legacy name)
    "attendance_records": [
        [("company_id", 1), ("employee_id", 1), ("date", 1)],
        [("company_id", 1), ("date", 1)],
    ],
    "allowances": [
        [("company_id", 1), ("employee_id", 1)],
        [("company_id", 1), ("is_active", 1)],
        [("company_id", 1), ("employee_id", 1), ("month", 1)],    # payroll: the run's month
    ],
    "deductions": [
        [("company_id", 1), ("employee_id", 1)],
        [("company_id", 1), ("is_active", 1)],
        [("company_id", 1), ("employee_id", 1), ("month", 1)],
    ],
    "employee_loans": [
        # payroll: status in (approved, active), start_month <= month
        [("company_id", 1), ("employee_id", 1), ("status", 1), ("start_month", 1)],
    ],
    "penalties": [
        [("company_id", 1), ("employee_id", 1), ("date", 1)],
    ],
    "employee_insurance_profiles": [
        [("company_id", 1), ("employee_id", 1)],
    ],
    "treasury": [
        [("company_id", 1), ("transaction_date", -1)],
        [("company_id", 1), ("type", 1)],
    ],
    "bank": [
        [("company_id", 1), ("transaction_date", -1)],
        [("company_id", 1), ("account_id", 1), ("transaction_date", -1)],
    ],
    # ── Sales & CRM ───────────────────────────────────
    "sales_quotations": [
        [("company_id", 1), ("date", -1)],
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("customer_name", 1)],
    ],
    "sales_subscriptions": [
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("customer_id", 1)],
        [("company_id", 1), ("next_billing_date", 1)],
    ],
    "sales_invoices": [
        [("company_id", 1), ("invoice_date", -1)],
        [("company_id", 1), ("status", 1)],
    ],
    # ── Audit & Activity ──────────────────────────────
    "activity_logs": [
        [("company_id", 1), ("created_at", -1)],
        [("user_id", 1), ("created_at", -1)],
        [("action", 1), ("created_at", -1)],
    ],
    "admin_audit_logs": [
        [("created_at", -1)],
        [("user_id", 1), ("created_at", -1)],
    ],
    # ── Projects & Assets ─────────────────────────────
    "projects": [
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("created_at", -1)],
    ],
    "fixed_assets": [
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("asset_type", 1)],
        [("company_id", 1), ("asset_code", 1)],
        [("company_id", 1), ("commissioning_date", -1)],
    ],
    "depreciation_entries": [
        [("company_id", 1), ("period", -1)],
        [("company_id", 1), ("asset_id", 1), ("period", 1)],
    ],
    "asset_disposals": [
        [("company_id", 1), ("disposal_date", -1)],
        [("company_id", 1), ("asset_id", 1)],
    ],
    "asset_counters": [
        [("company_id", 1), ("asset_type", 1)],
    ],
    "purchases": [
        [("company_id", 1), ("order_date", -1)],
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("supplier_id", 1)],
    ],
    # ── Medical Module ────────────────────────────────
    "medical_services": [
        [("company_id", 1), ("service_date", -1)],
        [("company_id", 1), ("patient_id", 1)],
        [("company_id", 1), ("doctor_id", 1)],
        [("company_id", 1), ("insurance_company_id", 1)],
        [("company_id", 1), ("status", 1)],
        [("company_id", 1), ("service_type", 1)],
    ],
    "doctor_payments": [
        [("company_id", 1), ("payment_date", -1)],
        [("company_id", 1), ("doctor_id", 1)],
        [("company_id", 1), ("service_id", 1)],
    ],
}

# ══════════════════════════════════════════════════════
# UNIQUE indexes — enforce data integrity at DB level
# ══════════════════════════════════════════════════════
UNIQUE_INDEXES = {
    "chart_of_accounts":           [("company_id", 1), ("account_code", 1)],
    "employee_insurance_profiles": [("national_id", 1)],
    "users":                       [("email", 1)],
    "journal_counters":            [("company_id", 1)],
    "asset_counters":              [("company_id", 1), ("asset_type", 1)],
    # one depreciation claim per asset per month — api/fixed_assets.py also
    # creates it lazily; blocks double posting by concurrent runs
    "depreciation_claims":         [("company_id", 1), ("asset_id", 1), ("period", 1)],
    "cheque_counters":             [("company_id", 1), ("direction", 1)],
    "receipt_counters":            [("company_id", 1)],
}


async def ensure_indexes(db, verbose: bool = False) -> dict:
    """Create every index above. Idempotent (create_index on an existing
    identical index is a no-op) and failure-tolerant: a conflict (an index on
    the same keys with other options or another name, duplicates blocking a
    unique build, ...) is logged and skipped — it never stops startup.
    Returns {"created": n, "skipped": [(collection, keys, error), ...]}."""
    import logging
    log = logging.getLogger("create_indexes")
    created, skipped = 0, []

    async def one(collection, idx, **opts):
        nonlocal created
        try:
            await db[collection].create_index(idx, background=True, **opts)
            created += 1
            if verbose:
                print(f"  ✅ {'[UNIQUE] ' if opts.get('unique') else ''}{collection}: {idx}")
        except Exception as e:                       # noqa: BLE001 — tolerated by design
            skipped.append((collection, idx, str(e)[:200]))
            log.warning("index %s %s skipped: %s", collection, idx, e)
            if verbose:
                print(f"  ⚠️  {collection}: {idx}: {e}")

    unique_ok = set()
    for collection, idx in UNIQUE_INDEXES.items():          # data integrity first
        before = created
        await one(collection, idx, unique=True)
        if created > before:
            unique_ok.add((collection, tuple(idx)))
    for collection, indexes in INDEXES.items():
        for idx in indexes:
            # the same keys as a unique index that exists would only conflict
            # ("already exists with different options"); if the unique build
            # failed (duplicates), the plain index still serves the lookups
            if (collection, tuple(idx)) in unique_ok:
                continue
            await one(collection, idx)
    return {"created": created, "skipped": skipped}


async def create_indexes():
    print("=" * 55)
    print("DataLife — Creating Database Indexes")
    print("=" * 55)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    res = await ensure_indexes(db, verbose=True)
    print(f"\n✅ Done — {res['created']} indexes ensured, {len(res['skipped'])} skipped")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_indexes())
