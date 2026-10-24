"""
مستند الفاتورة الإلكترونية لمنظومة مصلحة الضرائب المصرية (ETA) — بناء وتسلسل.

One builder for every path that talks to the tax authority. There were two
(api/eta_api.py and api/eta_signing.py) and neither matched the invoices this
program stores: they read `items`, `date`, `invoice_number`, `issue_date` —
fields an invoice does not have — so every line went out empty, the date was
"now", the internal id was random, every line was taxed at 14% whatever its
rate, and nothing was signed.

serialize() is the authority's canonical form (sdk.invoicing.eta.gov.eg →
"Document Serialization Approach"):
  * property names upper-cased and quoted, in document order;
  * simple values quoted exactly as they appear in the JSON sent;
  * an array is prefixed with its name, and so is every element of it;
  * the document is serialized WITHOUT its "signatures".
The JSON body is produced by to_json() from the same document, so the numbers
the authority re-serializes are the same text that was signed.
"""
import json
from datetime import datetime, timezone, date as _date
from typing import Optional

ROUND = 5            # the authority computes with 5 decimals

# our unit codes → UN/ECE Recommendation 20 codes the authority expects
UNIT_CODES = {
    "unit": "EA", "ea": "EA", "pcs": "EA", "piece": "EA", "قطعة": "EA", "": "EA",
    "kg": "KGM", "g": "GRM", "l": "LTR", "m": "MTR", "m2": "MTK", "m3": "MTQ",
    "hr": "HUR", "hour": "HUR", "day": "DAY", "box": "BX", "pkt": "PK", "set": "SET",
}

DOC_TYPES = {"sales_invoice": "I", "credit_note": "C", "debit_note": "D"}


class ETADocumentError(ValueError):
    """Something the authority would reject, said in Arabic, before sending."""


def _n(x) -> float:
    return round(float(x or 0), ROUND)


# T1 sub-types, from the authority's code table "Tax Types → Tax Subtypes":
#   V001 Export                     V002 Export to free areas and other areas
#   V003 Exempted good or service   V004 A non-taxable good or service
#   V005 Exemptions for diplomats   V006 Defence and national security exemptions
#   V007 Exemptions                 V008 Special taxation
#   V009 General item sales         V010 Other rates
VAT_SUBTYPES_BY_CATEGORY = {"export": "V001", "free_zone": "V002",
                            "exempt": "V003", "non_taxable": "V004"}
# default sub-types for the other tax types when a line does not give one
DEFAULT_SUBTYPES = {"T2": "Tbl01", "T3": "Tbl02", "T4": "W001", "T5": "ST01", "T6": "ST02",
                    "T7": "Ent01", "T8": "RD01", "T9": "SC01", "T10": "Mn01", "T11": "MI01",
                    "T12": "OF01"}
DEDUCTED_TYPES = {"T4"}


def _vat_subtype(rate: float, category: Optional[str] = None) -> str:
    """V009 standard 14%; V010 any other positive rate; export/free zone/
    exempt/non-taxable by category. A legacy line with no category and rate 0
    stays V003 (exempt), as before."""
    if category and category in VAT_SUBTYPES_BY_CATEGORY:
        return VAT_SUBTYPES_BY_CATEGORY[category]
    if rate == 14:
        return "V009"
    return "V010" if rate > 0 else "V003"


def _line_category(ln: dict) -> str:
    cat = ln.get("vat_category")
    cat = getattr(cat, "value", cat)
    if cat:
        return str(cat)
    tt = ln.get("tax_type") or "vat"
    return {"exempt": "exempt", "zero_rated": "export"}.get(str(getattr(tt, "value", tt)), "standard")


def _address(src: dict, label: str, with_branch: Optional[str] = None, foreign: bool = False) -> dict:
    if foreign:
        # a foreign receiver's address has no Egyptian governorate; the
        # authority still wants the field, so the region/city stands in
        src = dict(src)
        src["governate"] = src.get("governate") or src.get("governorate") or src.get("region_city") \
            or src.get("city") or src.get("country")
        src["building_number"] = src.get("building_number") or src.get("building") or "0"
    a = {
        "country": __import__("services.country", fromlist=["x"]).country_code(src.get("country")),
        "governate": (src.get("governate") or src.get("governorate") or "").strip(),
        "regionCity": (src.get("region_city") or src.get("city") or "").strip(),
        "street": (src.get("street") or src.get("address") or "").strip(),
        "buildingNumber": str(src.get("building_number") or src.get("building") or "").strip(),
    }
    missing = [k for k, v in a.items() if not v]
    if missing:
        names = {"governate": "المحافظة", "regionCity": "المدينة / المنطقة", "street": "الشارع",
                 "buildingNumber": "رقم المبنى", "country": "الدولة"}
        raise ETADocumentError(f"عنوان {label} ناقص: " + "، ".join(names[m] for m in missing))
    if src.get("postal_code"):
        a["postalCode"] = str(src["postal_code"])
    if with_branch is not None:
        a = {"branchID": str(with_branch), **a}
    return a


def date_issued(document_date: str, now: Optional[datetime] = None) -> str:
    """ISO UTC with seconds. The authority refuses a future time, so today's
    invoices carry the current time and earlier ones a time on that day."""
    now = now or datetime.now(timezone.utc)
    d = str(document_date or "")[:10] or now.date().isoformat()
    if d >= now.date().isoformat():
        return now.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"{d}T10:00:00Z"


def build_document(invoice: dict, settings: dict, issuer_name: str, receiver: dict,
                   products: Optional[dict] = None, original_uuid: Optional[str] = None,
                   now: Optional[datetime] = None) -> dict:
    """invoice: an invoice as stored (models/invoice.Invoice). settings: the
    company's ETA settings. receiver: {"type","id","name", ...address fields}.
    products: product_id → product, for item codes kept on the product."""
    products = products or {}
    doc_type = DOC_TYPES.get(invoice.get("document_type"))
    if not doc_type:
        raise ETADocumentError("نوع المستند لا يُرسل للمنظومة (فواتير البيع والإشعارات فقط)")
    if float(invoice.get("total_invoice_addition") or 0) > 0:
        raise ETADocumentError("الفاتورة بها إضافات على الإجمالي — المنظومة لا تقبلها؛ "
                               "أضفها كبند في الفاتورة")
    tin = str(settings.get("tax_registration_number") or "").strip()
    if len(tin) != 9 or not tin.isdigit():
        raise ETADocumentError("رقم التسجيل الضريبي للشركة في إعدادات المنظومة يجب أن يكون 9 أرقام")
    if not str(settings.get("activity_code") or "").strip():
        raise ETADocumentError("كود النشاط مطلوب في إعدادات المنظومة")

    currency = str(invoice.get("currency") or "EGP")
    rate_fx = float(invoice.get("exchange_rate") or 1) or 1
    code_type = (settings.get("item_code_type") or "EGS").upper()

    lines, missing_codes = [], []
    for ln in invoice.get("lines") or []:
        prod = products.get(ln.get("product_id")) or {}
        code = (ln.get("eta_code") or prod.get("item_code") or prod.get("eta_code") or "").strip()
        if not code:
            missing_codes.append(str(ln.get("line_number") or len(lines) + 1))
        qty = _n(ln.get("quantity"))
        price_sold = float(ln.get("unit_price") or 0)
        price_egp = _n(price_sold * rate_fx)
        sales_total = _n(qty * price_egp)
        # the line's own discount plus its share of a before-tax invoice
        # discount: both reduce the net the VAT is charged on
        disc = _n((float(ln.get("discount_amount") or 0) + float(ln.get("invoice_discount") or 0)) * rate_fx)
        net = _n(sales_total - disc)
        category = _line_category(ln)
        tax_rate = float(ln.get("tax_rate") or 0) \
            if (ln.get("tax_type") or "vat") == "vat" and category == "standard" else 0.0
        tax_amt = _n(float(ln.get("tax_amount") or 0) * rate_fx)
        unit_value = {"currencySold": currency, "amountEGP": price_egp}
        if currency != "EGP":
            unit_value.update({"amountSold": _n(price_sold), "currencyExchangeRate": _n(rate_fx)})
        taxable = [{"taxType": "T1", "amount": tax_amt,
                    "subType": _vat_subtype(tax_rate, category), "rate": _n(tax_rate)}]
        for t in ln.get("other_taxes") or []:
            ttype = str(t.get("tax_type") or "").upper()
            if not ttype or ttype == "T1":
                continue
            taxable.append({"taxType": ttype, "amount": _n(float(t.get("amount") or 0) * rate_fx),
                            "subType": str(t.get("sub_type") or DEFAULT_SUBTYPES.get(ttype, "")),
                            "rate": _n(t.get("rate"))})
        line_total = _n(net + sum(t["amount"] * (-1 if t["taxType"] in DEDUCTED_TYPES else 1)
                                  for t in taxable))
        lines.append({
            "description": str(ln.get("description") or prod.get("name") or "")[:500],
            "itemType": (prod.get("item_code_type") or code_type).upper(),
            "itemCode": code,
            "unitType": (prod.get("unit_type") if prod.get("unit_type") and str(ln.get("unit") or "unit").lower() in ("unit", "")
                         else UNIT_CODES.get(str(ln.get("unit") or "").lower(), str(ln.get("unit") or "EA").upper())),
            "quantity": qty,
            "internalCode": str(ln.get("product_code") or prod.get("code") or ln.get("line_number") or ""),
            "salesTotal": sales_total,
            "total": line_total,
            "valueDifference": 0,
            "totalTaxableFees": 0,
            "netTotal": net,
            "itemsDiscount": 0,
            "unitValue": unit_value,
            "discount": {"rate": _n(ln.get("discount_percent")), "amount": disc},
            "taxableItems": taxable,
        })
    if not lines:
        raise ETADocumentError("الفاتورة بلا بنود")
    if missing_codes:
        raise ETADocumentError(f"كود الصنف ({code_type}) المسجّل في المنظومة ناقص في البنود: "
                               + "، ".join(missing_codes) + " — أضفه في المنتج أو في البند")

    # only an AFTER-tax discount is an extra discount; a before-tax one is
    # already inside each line's discount
    extra_discount = _n(float(invoice.get("total_invoice_discount") or 0) * rate_fx)
    tax_totals = {}
    for l in lines:
        for t in l["taxableItems"]:
            tax_totals[t["taxType"]] = _n(tax_totals.get(t["taxType"], 0) + t["amount"])
    doc = {
        "issuer": {
            "address": _address(settings, "الشركة (إعدادات المنظومة)", with_branch=settings.get("branch_id") or "0"),
            "type": "B",
            "id": tin,
            "name": (settings.get("issuer_name") or issuer_name or "").strip(),
        },
        "receiver": {
            "type": receiver["type"],
            "id": receiver.get("id") or "",
            "name": (receiver.get("name") or "").strip(),
        },
        "documentType": doc_type,
        "documentTypeVersion": "1.0",
        "dateTimeIssued": date_issued(invoice.get("document_date"), now),
        "taxpayerActivityCode": str(settings["activity_code"]).strip(),
        "internalID": str(invoice.get("document_number") or ""),
        "invoiceLines": lines,
        "totalDiscountAmount": _n(sum(l["discount"]["amount"] for l in lines)),
        "totalSalesAmount": _n(sum(l["salesTotal"] for l in lines)),
        "netAmount": _n(sum(l["netTotal"] for l in lines)),
        "taxTotals": [{"taxType": k, "amount": v} for k, v in
                      sorted(tax_totals.items(), key=lambda kv: int(kv[0][1:]) if kv[0][1:].isdigit() else 99)],
        "totalAmount": _n(sum(l["total"] for l in lines) - extra_discount),
        "extraDiscountAmount": extra_discount,
        "totalItemsDiscountAmount": 0,
    }
    # a company receiver needs an address; an individual's is optional
    if receiver["type"] == "F" and __import__("services.country", fromlist=["x"]).is_egypt(receiver.get("country")):
        raise ETADocumentError("العميل أجنبي — حدد دولته (كود الدولة من حرفين) في بيانات العميل")
    if receiver["type"] in ("B", "F") or any(receiver.get(k) for k in ("governate", "city", "street")):
        doc["receiver"] = {"address": _address(receiver, "العميل", foreign=receiver["type"] == "F"),
                           **doc["receiver"]}
    if not doc["receiver"]["name"]:
        raise ETADocumentError("اسم العميل مطلوب")
    if doc_type in ("C", "D"):
        if not original_uuid:
            raise ETADocumentError("الإشعار يجب أن يشير لفاتورة أصلية أُرسلت للمنظومة أولاً")
        doc["references"] = [original_uuid]
    return doc


def _scalar(v) -> str:
    """A simple value exactly as json.dumps writes it, unquoted."""
    if isinstance(v, str):
        return v
    if v is None:
        return ""
    return json.dumps(v)          # numbers and booleans: same text as in the body


def serialize(node, name: Optional[str] = None) -> str:
    """The authority's canonical string for `node` (a document without signatures)."""
    if not isinstance(node, (dict, list)):
        return '"' + _scalar(node) + '"'
    out = []
    for key, value in node.items():
        if key == "signatures" and name is None:
            continue                       # never part of what is signed
        upper = key.upper()
        if isinstance(value, list):
            out.append(f'"{upper}"')
            for item in value:
                out.append(f'"{upper}"')
                out.append(serialize(item, key))
        else:
            out.append(f'"{upper}"')
            out.append(serialize(value, key))
    return "".join(out)


def to_json(doc: dict) -> str:
    """Compact JSON body. Same number text as serialize() reads."""
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":"))


def public_url(environment: str, uuid: str, long_id: str) -> str:
    """The invoice's public page on the authority's portal — what the printed
    QR code must open (not the Saudi TLV format it used to carry)."""
    host = ("https://preprod.invoicing.eta.gov.eg" if (environment or "").lower() in
            ("preprod", "preproduction", "sandbox", "test") else "https://invoicing.eta.gov.eg")
    return f"{host}/print/documents/{uuid}/share/{long_id}"
