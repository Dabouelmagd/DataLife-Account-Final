"""
Merge the old customer/supplier collections into `parties`.

    sales_customers      (Sales)               -> parties, party_type customer
    customers            (finance, imports)    -> parties, party_type customer
    suppliers_extended   (purchases)           -> parties, party_type supplier

Ids are preserved, so anything already pointing at a record keeps working.
A record that exists in more than one place is merged into one party: fields
already set win, missing ones are filled from the other copy, and a party that
is both a customer and a supplier gets party_type "both".

Records with the same email (or the same name when there is no email) inside
one company are treated as the same party and merged, with the extra ids
recorded in `merged_ids` so old references can still be resolved.

Dry run by default; --apply writes. Source collections are NEVER deleted —
they are left untouched so this can be re-run or reviewed.

    docker exec datalife_backend python scripts/merge_parties.py
    docker exec datalife_backend python scripts/merge_parties.py --apply
"""
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pymongo import MongoClient

SOURCES = [("sales_customers", "customer"), ("customers", "customer"), ("suppliers_extended", "supplier")]
ALIASES = {"tax_id": "tax_number", "commercial_register": "commercial_reg"}


def key_of(doc):
    """What makes two records the same party: email, else the name."""
    email = (doc.get("email") or "").strip().lower()
    return ("e", email) if email else ("n", (doc.get("name") or doc.get("full_name") or "").strip())


def normalise(doc, kind):
    for a, b in ALIASES.items():
        if doc.get(a) and not doc.get(b):
            doc[b] = doc[a]
        elif doc.get(b) and not doc.get(a):
            doc[a] = doc[b]
    if "is_active" not in doc:
        doc["is_active"] = str(doc.get("status", "active")).lower() != "inactive"
    if "status" not in doc:
        doc["status"] = "active" if doc.get("is_active", True) else "inactive"
    doc.setdefault("party_type", kind)
    return doc


def merge_into(target, extra, kind):
    """Fill gaps in target from extra; widen the role if needed."""
    for k, v in extra.items():
        if k in ("_id", "id", "party_type", "company_id"):
            continue
        if target.get(k) in (None, "", [], 0) and v not in (None, "", []):
            target[k] = v
    if target.get("party_type") and target["party_type"] != kind:
        target["party_type"] = "both"
    else:
        target.setdefault("party_type", kind)
    if extra.get("id") and extra["id"] != target.get("id"):
        target.setdefault("merged_ids", [])
        if extra["id"] not in target["merged_ids"]:
            target["merged_ids"].append(extra["id"])
    return target


def main():
    apply = "--apply" in sys.argv
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    existing_names = db.list_collection_names()
    print("DRY RUN — nothing written\n" if not apply else "APPLYING\n")

    # what is already in parties, per company
    parties = defaultdict(dict)          # company -> key -> doc
    by_id = {}
    for p in db.parties.find({}, {"_id": 0}):
        parties[p.get("company_id")][key_of(p)] = p
        by_id[p.get("id")] = p
    print(f"parties already holds {len(by_id)} record(s)")

    created = updated = skipped = 0
    for source, kind in SOURCES:
        if source not in existing_names:
            print(f"\n[{source}] not present — nothing to do")
            continue
        rows = list(db[source].find({}, {"_id": 0}))
        print(f"\n[{source}] {len(rows)} record(s) -> {kind}")
        for row in rows:
            cid, k = row.get("company_id"), key_of(row)
            if not cid or k in (("e", ""), ("n", "")):
                skipped += 1
                print(f"  skip (no company or name): {row.get('id')}")
                continue
            target = parties[cid].get(k) or by_id.get(row.get("id"))
            if target:
                before = dict(target)
                merge_into(target, row, kind)
                if target != before:
                    print(f"  merge  {row.get('name', '')[:28]:<30} -> {target['id']} ({target['party_type']})")
                    if apply:
                        db.parties.replace_one({"id": target["id"], "company_id": cid}, normalise(target, kind))
                    updated += 1
            else:
                doc = normalise(dict(row), kind)
                doc["company_id"] = cid
                doc.setdefault("migrated_from", source)
                print(f"  create {doc.get('name', '')[:28]:<30} -> {doc.get('id')} ({doc['party_type']})")
                if apply:
                    db.parties.insert_one(doc)
                parties[cid][k] = doc
                by_id[doc.get("id")] = doc
                created += 1

    print(f"\n{'done' if apply else 'would do'}: create {created} | merge {updated}"
          + (f" | skipped {skipped}" if skipped else ""))
    if not apply:
        print("Re-run with --apply to write. Source collections are never deleted.")


if __name__ == "__main__":
    main()
