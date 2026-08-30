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
    ],
    "payroll_runs": [
        [("company_id", 1), ("month", -1)],
        [("company_id", 1), ("status", 1)],
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
    "allowances": [
        [("company_id", 1), ("employee_id", 1)],
        [("company_id", 1), ("is_active", 1)],
    ],
    "deductions": [
        [("company_id", 1), ("employee_id", 1)],
        [("company_id", 1), ("is_active", 1)],
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
}


async def create_indexes():
    print("=" * 55)
    print("DataLife — Creating Database Indexes")
    print("=" * 55)
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    total = 0
    
    # ── 1. Unique indexes first (data integrity) ──────────────
    print("\n── Unique Indexes ─────────────────────────────────")
    for collection, idx in UNIQUE_INDEXES.items():
        try:
            await db[collection].create_index(idx, unique=True, background=True)
            print(f"  ✅ [UNIQUE] {collection}: {idx}")
            total += 1
        except Exception as e:
            print(f"  ⚠️  [UNIQUE] {collection}: {e}")
    
    # ── 2. Performance indexes ────────────────────────────────
    print("\n── Performance Indexes ────────────────────────────")
    for collection, indexes in INDEXES.items():
        col = db[collection]
        for idx in indexes:
            try:
                await col.create_index(idx, background=True)
                print(f"  ✅ {collection}: {idx}")
                total += 1
            except Exception as e:
                print(f"  ⚠️  {collection}: {e}")
    
    print(f"\n✅ Done — {total} indexes created ({len(UNIQUE_INDEXES)} unique + {total-len(UNIQUE_INDEXES)} performance)")
    client.close()

if __name__ == "__main__":
    asyncio.run(create_indexes())
