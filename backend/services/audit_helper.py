"""
Shared audit logging helper for financial operations
All financial CRUD must call log_financial_action()
"""
from database import db
from datetime import datetime, timezone

async def log_financial_action(
    user_id: str,
    company_id: str,
    action: str,           # e.g. "create_invoice", "update_payroll"
    module: str,           # e.g. "invoices", "payroll", "sales"
    entity_id: str = None, # ID of the affected record
    details: str = None,   # Human-readable description
    old_value: dict = None,# Before state (for updates)
    new_value: dict = None,# After state
):
    """Log every financial data change for audit trail"""
    entry = {
        "user_id": user_id,
        "company_id": company_id,
        "action": action,
        "module": module,
        "entity_id": entity_id,
        "details": details,
        "old_value": old_value,
        "new_value": new_value,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "severity": "high" if any(k in action for k in ["delete","void","cancel","update"]) else "normal"
    }
    try:
        await db.audit_logs.insert_one(entry)
    except Exception:
        pass  # Never block operation due to audit failure
