"""
AI Assistant Service — translates natural-language Arabic/English business
questions into safe MongoDB queries, executes them scoped to the current
company, then asks the LLM to summarize the result.

Architecture (2 LLM calls per question):
  1. Intent extraction → JSON  {collection, action, filter, group_by, sort, limit}
  2. Result summarization in user's language.

Security:
  - Whitelist of collections and fields → reject anything else.
  - company_id is ALWAYS injected from the JWT (the LLM can't override it).
  - No raw eval / no $where / no JS execution.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage


# ────────────────────────────────────────────────────────────────────────────
# Whitelist of collections + fields the assistant is allowed to touch.
# ────────────────────────────────────────────────────────────────────────────
ALLOWED_SCHEMA: Dict[str, Dict[str, Any]] = {
    "employees": {
        "fields": ["name", "full_name", "email", "phone", "position", "department",
                   "salary", "hire_date", "status", "created_at"],
        "numeric": ["salary"],
    },
    "customers": {
        "fields": ["name", "email", "phone", "balance", "created_at"],
        "numeric": ["balance"],
    },
    "suppliers": {
        "fields": ["name", "email", "phone", "balance", "created_at"],
        "numeric": ["balance"],
    },
    "invoices": {
        "fields": ["invoice_number", "customer_name", "total", "status",
                   "issued_at", "created_at", "due_date"],
        "numeric": ["total"],
    },
    "purchases": {
        "fields": ["purchase_number", "supplier_name", "total", "status", "created_at"],
        "numeric": ["total"],
    },
    "products": {
        "fields": ["name", "sku", "category", "quantity", "price", "created_at"],
        "numeric": ["quantity", "price"],
    },
    "banks": {
        "fields": ["name", "account_number", "balance", "created_at"],
        "numeric": ["balance"],
    },
    "payment_transactions": {
        "fields": ["amount_egp", "plan", "payment_status", "created_at"],
        "numeric": ["amount_egp"],
    },
    "tax_invoices": {
        "fields": ["invoice_number", "customer_email", "customer_name",
                   "total_egp", "vat_amount_egp", "subtotal_egp", "plan", "issued_at"],
        "numeric": ["total_egp", "vat_amount_egp", "subtotal_egp"],
    },
}


# Supported actions
SUPPORTED_ACTIONS = {"find", "count", "sum", "avg", "min", "max", "group_by"}


SYSTEM_PROMPT_INTENT = """You are a JSON-only intent extractor for a business ERP system.

Convert the user's natural-language question (Arabic or English) into a STRICT JSON object describing a MongoDB query.

Available collections (you MUST pick exactly one):
- "employees"   (fields: name, full_name, email, phone, position, department, salary, hire_date, status, created_at)
- "customers"   (fields: name, email, phone, balance, created_at)
- "suppliers"   (fields: name, email, phone, balance, created_at)
- "invoices"    (fields: invoice_number, customer_name, total, status, issued_at, created_at, due_date)
- "purchases"   (fields: purchase_number, supplier_name, total, status, created_at)
- "products"    (fields: name, sku, category, quantity, price, created_at)
- "banks"       (fields: name, account_number, balance, created_at)
- "payment_transactions" (fields: amount_egp, plan, payment_status, created_at)
- "tax_invoices" (fields: invoice_number, customer_email, customer_name, total_egp, vat_amount_egp, subtotal_egp, plan, issued_at)

Available actions:
- "find"     → list documents
- "count"    → count documents matching the filter
- "sum"      → sum a numeric field (use `target_field`)
- "avg"      → average a numeric field
- "min"      → minimum of a numeric field
- "max"      → maximum of a numeric field
- "group_by" → group by a field and sum a numeric field

Output schema (return ONLY this JSON, no markdown, no commentary):
{
  "collection": "<one of the allowed collections>",
  "action": "<one of: find, count, sum, avg, min, max, group_by>",
  "filter": { /* MongoDB filter (no $where, no JS) */ },
  "target_field": "<for sum/avg/min/max only>",
  "group_field": "<for group_by only>",
  "sort": [["field", -1]],
  "limit": 10,
  "explanation": "<1 short sentence describing what this query answers in the user's language>"
}

Rules:
- NEVER include company_id or _id in the filter — the server adds them.
- For relative date filters use ISO date strings (e.g. {"$gte": "2026-05-01"}).
- For "this month" → use the 1st of the current month as $gte.
- For Arabic numeric ranges (e.g. "أكثر من 10 آلاف") translate to numeric filters.
- Return ONLY the JSON object. No code fences, no commentary."""


SYSTEM_PROMPT_SUMMARIZE = """You are a friendly business analyst.

The user asked a question (Arabic or English). The query has already been executed.
You are given:
  - the original question
  - the structured intent (so you know what was queried)
  - the result (a number, a list of docs, or grouped data)

Write a SHORT, friendly natural-language answer in the SAME language as the user's question.
- Use bullet points or a small table only if the result has multiple items.
- Always include numbers with EGP suffix when the field is a money field.
- Be concise (3-6 lines max).
- If the result is empty, say so politely and suggest related questions.
- DO NOT mention "MongoDB", "filter", "collection" or any technical detail."""


def _sanitize_filter(raw_filter: Any, collection: str) -> Dict[str, Any]:
    """Drop any operators that could be unsafe. Whitelist field names too."""
    if not isinstance(raw_filter, dict):
        return {}
    schema = ALLOWED_SCHEMA.get(collection, {})
    allowed_fields = set(schema.get("fields", []))
    safe: Dict[str, Any] = {}
    for k, v in raw_filter.items():
        # Block dangerous operators at the top level
        if k.startswith("$") and k not in ("$and", "$or"):
            continue
        # Block $where / $function inside nested ops
        if k in ("$and", "$or") and isinstance(v, list):
            safe[k] = [_sanitize_filter(item, collection) for item in v]
            continue
        if k not in allowed_fields:
            continue
        # Recursively sanitize nested operators
        if isinstance(v, dict):
            cleaned = {}
            for op, val in v.items():
                if op in ("$where", "$function", "$accumulator"):
                    continue
                cleaned[op] = val
            safe[k] = cleaned
        else:
            safe[k] = v
    return safe


async def _extract_intent(api_key: str, session_id: str, question: str) -> Dict[str, Any]:
    """Ask the LLM to convert the natural-language question to a structured intent."""
    chat = LlmChat(
        api_key=api_key,
        session_id=f"{session_id}-intent",
        system_message=SYSTEM_PROMPT_INTENT,
    ).with_model("openai", "gpt-4o")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_msg = UserMessage(text=f"Today is {today}.\n\nUser question: {question}")
    raw = await chat.send_message(user_msg)
    # Strip code fences if the model included any
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0]
    try:
        intent = json.loads(text)
    except Exception as err:
        raise ValueError(f"Could not parse intent JSON: {err}\nRaw: {text[:300]}")
    return intent


async def _summarize_result(
    api_key: str, session_id: str, question: str,
    intent: Dict[str, Any], result: Any,
) -> str:
    """Ask the LLM to summarize the raw result back to the user."""
    chat = LlmChat(
        api_key=api_key,
        session_id=f"{session_id}-summary",
        system_message=SYSTEM_PROMPT_SUMMARIZE,
    ).with_model("openai", "gpt-4o")
    payload = {
        "question": question,
        "intent": intent,
        "result": result,
    }
    user_msg = UserMessage(text=json.dumps(payload, ensure_ascii=False, default=str)[:6000])
    return await chat.send_message(user_msg)


async def run_assistant_query(
    *,
    db,
    company_id: str,
    user_id: str,
    question: str,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Top-level entry point. Returns a dict containing the original question,
    the intent, the raw result, and the LLM-generated answer.
    """
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")

    session_id = session_id or f"{user_id}-{datetime.now(timezone.utc).timestamp()}"

    # 1) Intent extraction
    intent = await _extract_intent(api_key, session_id, question)

    collection = intent.get("collection")
    action = intent.get("action")
    if collection not in ALLOWED_SCHEMA:
        return {
            "question": question,
            "intent": intent,
            "result": None,
            "answer": "هذا الاستعلام يطلب بيانات غير متاحة. حاول إعادة صياغة السؤال." if any('\u0600' <= c <= '\u06ff' for c in question) else "This query asks for unavailable data. Please rephrase.",
            "error": f"Disallowed collection: {collection}",
        }
    if action not in SUPPORTED_ACTIONS:
        return {
            "question": question, "intent": intent, "result": None,
            "answer": "العملية المطلوبة غير مدعومة." if any('\u0600' <= c <= '\u06ff' for c in question) else "Requested operation is not supported.",
            "error": f"Disallowed action: {action}",
        }

    # 2) Build + execute safe query
    safe_filter = _sanitize_filter(intent.get("filter", {}), collection)
    safe_filter["company_id"] = company_id  # ALWAYS scope by company

    coll = db[collection]
    result: Any
    try:
        if action == "find":
            limit = min(int(intent.get("limit", 20)), 50)
            sort_spec = intent.get("sort") or [["created_at", -1]]
            # Normalize sort field
            sort_field = sort_spec[0][0] if sort_spec and isinstance(sort_spec[0], list) else "created_at"
            sort_dir = sort_spec[0][1] if sort_spec and isinstance(sort_spec[0], list) and len(sort_spec[0]) > 1 else -1
            proj = {"_id": 0, "password": 0, "password_hash": 0, "html": 0}
            cursor = coll.find(safe_filter, proj).sort(sort_field, sort_dir).limit(limit)
            result = await cursor.to_list(length=limit)
        elif action == "count":
            result = await coll.count_documents(safe_filter)
        elif action in ("sum", "avg", "min", "max"):
            target = intent.get("target_field")
            numeric_fields = set(ALLOWED_SCHEMA[collection].get("numeric", []))
            if target not in numeric_fields:
                raise ValueError(f"target_field '{target}' is not numeric on {collection}")
            op_map = {"sum": "$sum", "avg": "$avg", "min": "$min", "max": "$max"}
            pipeline = [
                {"$match": safe_filter},
                {"$group": {"_id": None, "value": {op_map[action]: f"${target}"}}},
            ]
            agg = await coll.aggregate(pipeline).to_list(length=1)
            result = {"value": agg[0]["value"] if agg else 0, "field": target}
        elif action == "group_by":
            group_field = intent.get("group_field")
            target = intent.get("target_field")
            if group_field not in ALLOWED_SCHEMA[collection].get("fields", []):
                raise ValueError(f"group_field '{group_field}' not allowed on {collection}")
            pipeline: list = [{"$match": safe_filter}]
            if target and target in ALLOWED_SCHEMA[collection].get("numeric", []):
                pipeline.append({"$group": {"_id": f"${group_field}", "value": {"$sum": f"${target}"}, "count": {"$sum": 1}}})
            else:
                pipeline.append({"$group": {"_id": f"${group_field}", "count": {"$sum": 1}}})
            pipeline.append({"$sort": {"value" if target else "count": -1}})
            pipeline.append({"$limit": 20})
            agg = await coll.aggregate(pipeline).to_list(length=20)
            result = [{"label": r.get("_id"), **{k: v for k, v in r.items() if k != "_id"}} for r in agg]
        else:
            result = None
    except Exception as err:
        return {
            "question": question,
            "intent": intent,
            "result": None,
            "answer": f"تعذّر تنفيذ الاستعلام: {err}" if any('\u0600' <= c <= '\u06ff' for c in question) else f"Query failed: {err}",
            "error": str(err),
        }

    # 3) Summarize back to user
    try:
        answer = await _summarize_result(api_key, session_id, question, intent, result)
    except Exception as err:
        answer = f"تم تنفيذ الاستعلام، لكن تعذّر إنشاء ملخّص ({err})."

    # Persist conversation history for the user
    try:
        await db.ai_assistant_history.insert_one({
            "user_id": user_id,
            "company_id": company_id,
            "session_id": session_id,
            "question": question,
            "intent": intent,
            "answer": answer,
            "result_size": len(result) if isinstance(result, list) else 1 if result is not None else 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as err:
        print(f"[ai_assistant] failed to persist history: {err}")

    return {
        "question": question,
        "intent": intent,
        "result": result,
        "answer": answer,
        "session_id": session_id,
    }
