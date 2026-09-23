"""
One store for customers and suppliers: `parties`.

They used to live in three collections — sales_customers (Sales), customers
(finance/analytics/imports) and suppliers_extended (purchases) — while the
invoice page and the ledger-posting purchase flow used `parties`. The same
customer could exist three times with three ids, so a balance or a statement
depended on which screen you opened.

`parties` is the single store because purchase invoices already carry its ids
as party_id. The Sales and invoice systems name some fields differently, so
each document carries BOTH spellings and `normalise()` keeps them in step —
no screen has to change what it reads.
"""
from typing import Optional

CUSTOMER_TYPES = ["customer", "both"]
SUPPLIER_TYPES = ["supplier", "both"]

# invoice-system name  ->  sales/finance name
ALIASES = {
    "tax_id": "tax_number",
    "commercial_register": "commercial_reg",
}


def party_query(company_id: str, kind: Optional[str] = None) -> dict:
    """Mongo filter for this company's parties. kind: customer | supplier | None."""
    q = {"company_id": company_id}
    if kind == "customer":
        q["party_type"] = {"$in": CUSTOMER_TYPES}
    elif kind == "supplier":
        q["party_type"] = {"$in": SUPPLIER_TYPES}
    return q


def normalise(doc: dict, default_type: str = "customer") -> dict:
    """Fill both spellings and both status forms, in place."""
    if not doc:
        return doc
    for a, b in ALIASES.items():
        if doc.get(a) and not doc.get(b):
            doc[b] = doc[a]
        elif doc.get(b) and not doc.get(a):
            doc[a] = doc[b]
    if "is_active" not in doc:
        doc["is_active"] = str(doc.get("status", "active")).lower() != "inactive"
    if "status" not in doc:
        doc["status"] = "active" if doc.get("is_active", True) else "inactive"
    doc.setdefault("party_type", default_type)
    return doc


def add_type(doc: dict, kind: str) -> dict:
    """Mark a party as also being a customer/supplier without losing the other role."""
    current = doc.get("party_type")
    if current and current != kind:
        doc["party_type"] = "both"
    else:
        doc["party_type"] = kind
    return doc
