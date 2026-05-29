"""
AI Insights Service — analyzes the company's data and produces 4-6 daily
"insight cards" combining deterministic metrics with LLM-generated copy.

Strategy: we compute the numbers in Python (fast + accurate) and then ask
the LLM to phrase the message in the user's language. Insights are cached
in Mongo (`ai_insights`) so we don't burn tokens on every page load.
"""
from __future__ import annotations

import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage


CACHE_TTL_HOURS = 6  # Regenerate insights at most every 6 hours
LANGUAGES = {"ar", "en"}


SYSTEM_PROMPT_INSIGHTS = """You are a business analyst writing very short
"insight cards" for a small-business dashboard. You are given a list of
metrics already computed from the database. Re-phrase each metric into a
ONE-SENTENCE friendly insight (max 16 words) in the requested language.

Return JSON only, with this shape:
{
  "cards": [
    {"id": "<same id>", "title": "<short title, <=4 words>", "message": "<one sentence>"}
  ]
}

Rules:
- DO NOT invent numbers — only use what's in the metric data.
- For positive metrics use an encouraging tone; for warnings use a clear,
  helpful tone (never alarming).
- Always include the exact number with EGP suffix if it is a money amount.
- Output ONLY valid JSON (no markdown, no code fences)."""


async def _compute_metrics(db, company_id: str) -> List[Dict[str, Any]]:
    """Compute deterministic metrics for the company. Each returns:
    {id, kind, severity, value, payload}"""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)
    metrics: List[Dict[str, Any]] = []
    co_filter = {"company_id": company_id}

    # 1. Revenue this month vs previous month
    try:
        async def _sum(coll, field, gte, lt):
            agg = await db[coll].aggregate([
                {"$match": {**co_filter, "issued_at": {"$gte": gte, "$lt": lt}}},
                {"$group": {"_id": None, "v": {"$sum": f"${field}"}}},
            ]).to_list(length=1)
            return float(agg[0]["v"]) if agg else 0.0

        this_month_rev = await _sum("invoices", "total", month_start.isoformat(), now.isoformat())
        prev_month_rev = await _sum("invoices", "total", prev_month_start.isoformat(), month_start.isoformat())
        if this_month_rev > 0 or prev_month_rev > 0:
            growth_pct = None
            if prev_month_rev > 0:
                growth_pct = round(((this_month_rev - prev_month_rev) / prev_month_rev) * 100, 1)
            metrics.append({
                "id": "monthly_revenue",
                "kind": "revenue",
                "severity": "good" if (growth_pct or 0) >= 0 else "warning",
                "value": this_month_rev,
                "payload": {
                    "this_month_revenue_egp": this_month_rev,
                    "previous_month_revenue_egp": prev_month_rev,
                    "growth_percent": growth_pct,
                },
            })
    except Exception as err:
        print(f"[insights] revenue metric failed: {err}")

    # 2. Suppliers with negative balance (we owe them)
    try:
        suppliers_owed = await db.suppliers.find(
            {**co_filter, "balance": {"$lt": 0}},
            {"_id": 0, "name": 1, "balance": 1},
        ).sort("balance", 1).limit(5).to_list(length=5)
        if suppliers_owed:
            total_due = sum(abs(s.get("balance", 0)) for s in suppliers_owed)
            metrics.append({
                "id": "suppliers_due",
                "kind": "ap",
                "severity": "warning",
                "value": len(suppliers_owed),
                "payload": {
                    "supplier_count": len(suppliers_owed),
                    "total_amount_due_egp": round(total_due, 2),
                    "top_suppliers": suppliers_owed[:3],
                },
            })
    except Exception as err:
        print(f"[insights] suppliers metric failed: {err}")

    # 3. Customers with overdue balance (they owe us)
    try:
        customers_overdue = await db.customers.find(
            {**co_filter, "balance": {"$gt": 0}},
            {"_id": 0, "name": 1, "balance": 1},
        ).sort("balance", -1).limit(5).to_list(length=5)
        if customers_overdue:
            total_owed = sum(c.get("balance", 0) for c in customers_overdue)
            metrics.append({
                "id": "customers_owe",
                "kind": "ar",
                "severity": "info",
                "value": len(customers_overdue),
                "payload": {
                    "customer_count": len(customers_overdue),
                    "total_amount_owed_egp": round(total_owed, 2),
                    "top_customers": customers_overdue[:3],
                },
            })
    except Exception as err:
        print(f"[insights] customers metric failed: {err}")

    # 4. Low-stock products (quantity below 10)
    try:
        low_stock = await db.products.find(
            {**co_filter, "quantity": {"$lt": 10, "$gte": 0}},
            {"_id": 0, "name": 1, "quantity": 1, "sku": 1},
        ).sort("quantity", 1).limit(5).to_list(length=5)
        if low_stock:
            metrics.append({
                "id": "low_stock",
                "kind": "inventory",
                "severity": "warning",
                "value": len(low_stock),
                "payload": {
                    "low_stock_count": len(low_stock),
                    "items": low_stock,
                },
            })
    except Exception as err:
        print(f"[insights] inventory metric failed: {err}")

    # 5. Top selling product (last 30 days)
    try:
        pipeline = [
            {"$match": {**co_filter, "created_at": {"$gte": (now - timedelta(days=30)).isoformat()}}},
            {"$unwind": "$items"},
            {"$group": {"_id": "$items.name", "qty": {"$sum": "$items.quantity"}, "revenue": {"$sum": "$items.total"}}},
            {"$sort": {"revenue": -1}},
            {"$limit": 1},
        ]
        top = await db.invoices.aggregate(pipeline).to_list(length=1)
        if top and top[0].get("_id"):
            metrics.append({
                "id": "top_product",
                "kind": "best_seller",
                "severity": "good",
                "value": top[0].get("revenue", 0),
                "payload": {
                    "product_name": top[0]["_id"],
                    "quantity_sold": top[0].get("qty", 0),
                    "revenue_egp": round(top[0].get("revenue", 0), 2),
                },
            })
    except Exception as err:
        print(f"[insights] top product metric failed: {err}")

    # 6. Tax invoices issued + VAT collected this month
    try:
        agg = await db.tax_invoices.aggregate([
            {"$match": {**co_filter, "issued_at": {"$gte": month_start.isoformat()}}},
            {"$group": {"_id": None, "count": {"$sum": 1},
                        "total": {"$sum": "$total_egp"},
                        "vat": {"$sum": "$vat_amount_egp"}}},
        ]).to_list(length=1)
        if agg:
            metrics.append({
                "id": "vat_this_month",
                "kind": "tax",
                "severity": "info",
                "value": agg[0].get("count", 0),
                "payload": {
                    "invoice_count": agg[0].get("count", 0),
                    "total_egp": round(agg[0].get("total", 0), 2),
                    "vat_collected_egp": round(agg[0].get("vat", 0), 2),
                },
            })
    except Exception as err:
        print(f"[insights] vat metric failed: {err}")

    # 7. Bank account total balance
    try:
        agg = await db.banks.aggregate([
            {"$match": co_filter},
            {"$group": {"_id": None, "total": {"$sum": "$balance"}, "n": {"$sum": 1}}},
        ]).to_list(length=1)
        if agg:
            total = float(agg[0].get("total", 0))
            metrics.append({
                "id": "cash_balance",
                "kind": "cash",
                "severity": "warning" if total < 0 else "good",
                "value": total,
                "payload": {
                    "total_cash_egp": round(total, 2),
                    "account_count": agg[0].get("n", 0),
                },
            })
    except Exception as err:
        print(f"[insights] cash metric failed: {err}")

    return metrics


async def _phrase_metrics(metrics: List[Dict[str, Any]], language: str) -> Dict[str, Dict[str, str]]:
    """Ask the LLM to write a short friendly card for every metric."""
    if not metrics:
        return {}
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        # Graceful fallback: deterministic English fallbacks
        return {m["id"]: {"title": m["kind"].title(), "message": json.dumps(m["payload"], default=str)[:140]} for m in metrics}
    lang_instruction = "Arabic (RTL)" if language == "ar" else "English"
    chat = LlmChat(
        api_key=api_key,
        session_id=f"insights-{datetime.utcnow().timestamp()}",
        system_message=SYSTEM_PROMPT_INSIGHTS,
    ).with_model("openai", "gpt-4o")
    payload = {"language": lang_instruction, "metrics": metrics}
    msg = UserMessage(text=json.dumps(payload, ensure_ascii=False, default=str)[:6000])
    try:
        raw = await chat.send_message(msg)
        text = (raw or "").strip()
        if text.startswith("```"):
            text = text.strip("`")
            text = text.split("\n", 1)[1] if "\n" in text else text
            text = text.rsplit("```", 1)[0]
        parsed = json.loads(text)
        out: Dict[str, Dict[str, str]] = {}
        for c in parsed.get("cards", []):
            cid = c.get("id")
            if cid:
                out[cid] = {"title": c.get("title", ""), "message": c.get("message", "")}
        return out
    except Exception as err:
        print(f"[insights] LLM phrasing failed: {err}")
        return {}


async def get_dashboard_insights(
    *, db, company_id: str, language: str = "ar", force: bool = False,
) -> Dict[str, Any]:
    """Top-level entry point. Returns a dict {generated_at, cards: [...]}."""
    if language not in LANGUAGES:
        language = "ar"

    # Try cache first
    if not force:
        cached = await db.ai_insights.find_one(
            {"company_id": company_id, "language": language},
            {"_id": 0},
        )
        if cached:
            generated_at = cached.get("generated_at")
            try:
                gen_dt = datetime.fromisoformat(generated_at)
                if gen_dt.tzinfo is None:
                    gen_dt = gen_dt.replace(tzinfo=timezone.utc)
                if (datetime.now(timezone.utc) - gen_dt) < timedelta(hours=CACHE_TTL_HOURS):
                    return {"generated_at": generated_at, "cards": cached.get("cards", []), "cached": True}
            except Exception:
                pass

    # Compute fresh
    metrics = await _compute_metrics(db, company_id)
    phrased = await _phrase_metrics(metrics, language)

    cards = []
    for m in metrics:
        cid = m["id"]
        wording = phrased.get(cid, {})
        cards.append({
            "id": cid,
            "kind": m["kind"],
            "severity": m["severity"],
            "value": m["value"],
            "title": wording.get("title") or m["kind"].replace("_", " ").title(),
            "message": wording.get("message") or json.dumps(m["payload"], ensure_ascii=False, default=str)[:140],
            "payload": m["payload"],
        })

    generated_at = datetime.now(timezone.utc).isoformat()
    try:
        await db.ai_insights.update_one(
            {"company_id": company_id, "language": language},
            {"$set": {"generated_at": generated_at, "cards": cards}},
            upsert=True,
        )
    except Exception as err:
        print(f"[insights] cache write failed: {err}")

    return {"generated_at": generated_at, "cards": cards, "cached": False}
