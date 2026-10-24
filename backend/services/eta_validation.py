"""
تدقيق بيانات الطرف قبل الإرسال لمنظومة الفاتورة الإلكترونية.

The submission sent whatever was on the record: a tax id of any length, or
none at all, and never a national id. The tax authority rejects those — and a
rejection surfaces late, after the invoice is already in the customer's hands
and in the books, which is the expensive moment to discover it.

Three rules, each from the authority's own requirements:

* a company (B2B) must carry a 9-digit tax registration number;
* an individual (B2C) above the reporting threshold must carry a 14-digit
  national id, or a passport number for a foreigner;
* Arabic-Indic digits (٧٧١٠٥٦٣١١) are normalised to Latin first — they read
  the same to a person and not at all to the authority's parser.

The threshold is configurable because the authority moves it: B2C_ID_THRESHOLD,
default 150,000 EGP.
"""

import os
import re

ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
TAX_ID_LENGTH = 9
NATIONAL_ID_LENGTH = 14


def threshold() -> float:
    try:
        return float(os.environ.get("B2C_ID_THRESHOLD", "150000"))
    except ValueError:
        return 150000.0


def normalise_digits(value) -> str:
    """Arabic-Indic to Latin, and drop the separators people type."""
    if value is None:
        return ""
    text = str(value).translate(ARABIC_DIGITS)
    return re.sub(r"[\s\-‑–—/\\.]", "", text).strip()


def check_tax_id(value) -> tuple:
    """(normalised, error). A company's registration number is exactly 9 digits."""
    digits = normalise_digits(value)
    if not digits:
        return "", "الرقم الضريبي مطلوب لفواتير الشركات (B2B)"
    if not digits.isdigit():
        return digits, "الرقم الضريبي يجب أن يتكون من أرقام فقط"
    if len(digits) != TAX_ID_LENGTH:
        return digits, f"الرقم الضريبي يجب أن يكون {TAX_ID_LENGTH} أرقام (المُدخل {len(digits)})"
    return digits, None


def check_national_id(value) -> tuple:
    """(normalised, error). 14 digits, and the birth-date part must be real."""
    digits = normalise_digits(value)
    if not digits:
        return "", "الرقم القومي مطلوب"
    if not digits.isdigit():
        return digits, "الرقم القومي يجب أن يتكون من أرقام فقط"
    if len(digits) != NATIONAL_ID_LENGTH:
        return digits, f"الرقم القومي يجب أن يكون {NATIONAL_ID_LENGTH} رقماً (المُدخل {len(digits)})"
    # 1 = 1900s, 2 = 2000s, 3 = 2100s — then YYMMDD
    century, month, day = digits[0], int(digits[3:5]), int(digits[5:7])
    if century not in ("1", "2", "3"):
        return digits, "الرقم القومي غير صحيح — خانة القرن"
    if not (1 <= month <= 12) or not (1 <= day <= 31):
        return digits, "الرقم القومي غير صحيح — تاريخ الميلاد بداخله غير منطقي"
    return digits, None


def validate_party(invoice: dict, party: dict = None) -> dict:
    """What the authority needs for this invoice's counterparty.

    Returns {"ok", "type", "id", "error"}. type is "B" for an Egyptian company,
    "P" for an individual and "F" for a receiver abroad (party.is_foreign or a
    country other than EG; "country" is returned too), which is what the
    submission payload expects.
    """
    party = party or {}
    total = float(invoice.get("grand_total") or invoice.get("settle_amount") or 0)

    # a receiver outside Egypt is type "F": its own country's tax number (or a
    # passport for a person) — the 9-digit / 14-digit Egyptian rules do not apply
    from services.country import country_code
    country = country_code(party.get("country"))
    if party.get("is_foreign") or country != "EG":
        foreign_id = str(party.get("foreign_tax_id") or party.get("tax_id") or party.get("tax_number")
                         or party.get("passport_number") or "").strip()
        foreign_id = normalise_digits(foreign_id) if foreign_id.translate(ARABIC_DIGITS).replace(" ", "").isdigit() \
            else foreign_id
        if country == "EG":
            return {"ok": False, "type": "F", "id": foreign_id, "country": country,
                    "error": "العميل مُعلَّم كأجنبي ودولته مصر — حدد كود دولته (حرفان، مثل SA أو US)"}
        return {"ok": True, "type": "F", "id": foreign_id, "country": country, "error": None}

    raw_tax = invoice.get("party_tax_id") or party.get("tax_number") or party.get("tax_id")
    raw_national = (invoice.get("party_national_id") or party.get("national_id")
                    or party.get("passport_number"))
    is_company = bool(str(raw_tax or "").strip()) or (party.get("party_type") in ("company", "b2b"))

    if is_company:
        digits, error = check_tax_id(raw_tax)
        return {"ok": error is None, "type": "B", "id": digits, "error": error}

    # an individual: identification only matters above the reporting threshold
    limit = threshold()
    if total < limit:
        return {"ok": True, "type": "P", "id": normalise_digits(raw_national), "error": None}

    if party.get("passport_number") and not raw_national:
        return {"ok": True, "type": "P", "id": str(party["passport_number"]).strip(), "error": None}

    digits, error = check_national_id(raw_national)
    if error:
        error = (f"فاتورة بقيمة {total:,.2f} لشخص طبيعي تتجاوز الحد المقرر "
                 f"({limit:,.0f}) — {error}")
    return {"ok": error is None, "type": "P", "id": digits, "error": error}
