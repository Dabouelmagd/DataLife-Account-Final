"""ISO-2 country code from whatever a customer's «الدولة» field holds.

The Customers page saved «مصر», and the VAT / e-invoice code read the first
two letters ("مص" != "EG"), so every invoice to those customers became a
zero-rated export. Empty means Egypt; Arabic and English names are mapped.
"""
import re

_NAMES = {
    "EG": ("مصر", "جمهورية مصر العربية", "ج.م.ع", "جمع", "egypt", "arab republic of egypt", "egy"),
    "SA": ("السعودية", "المملكة العربية السعودية", "saudi arabia", "ksa"),
    "AE": ("الإمارات", "الامارات", "الإمارات العربية المتحدة", "uae", "united arab emirates"),
    "KW": ("الكويت", "kuwait"), "QA": ("قطر", "qatar"), "BH": ("البحرين", "bahrain"),
    "OM": ("عمان", "عُمان", "سلطنة عمان", "oman"), "JO": ("الأردن", "الاردن", "jordan"),
    "LY": ("ليبيا", "libya"), "SD": ("السودان", "sudan"), "LB": ("لبنان", "lebanon"),
    "IQ": ("العراق", "iraq"), "MA": ("المغرب", "morocco"), "TN": ("تونس", "tunisia"),
    "DZ": ("الجزائر", "algeria"), "PS": ("فلسطين", "palestine"), "SY": ("سوريا", "syria"),
    "YE": ("اليمن", "yemen"), "TR": ("تركيا", "turkey", "türkiye"), "CN": ("الصين", "china"),
    "US": ("أمريكا", "امريكا", "الولايات المتحدة", "usa", "united states"),
    "GB": ("بريطانيا", "المملكة المتحدة", "uk", "united kingdom"),
    "DE": ("ألمانيا", "المانيا", "germany"), "FR": ("فرنسا", "france"), "IT": ("إيطاليا", "ايطاليا", "italy"),
}
_LOOKUP = {n.lower(): code for code, names in _NAMES.items() for n in names}


def country_code(value) -> str:
    v = re.sub(r"\s+", " ", str(value or "").strip())
    if not v:
        return "EG"
    hit = _LOOKUP.get(v.lower())
    if hit:
        return hit
    if re.fullmatch(r"[A-Za-z]{2,3}", v):
        return "EG" if v.upper() in ("EG", "EGY") else v.upper()[:2]
    if v.isascii():
        return v.upper()[:2]
    return "XX"   # a name we don't know: treated as abroad, shown as-is to the user


def is_egypt(value) -> bool:
    return country_code(value) == "EG"
