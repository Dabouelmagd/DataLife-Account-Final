"""
الخط العربي في ملفات PDF.

Every Arabic PDF the system produced — invoices, payslips, reports — came out
as rows of identical boxes. ReportLab ships only Helvetica and friends, none
of which carry Arabic glyphs, and no font was ever registered; the text was
reshaped correctly and then drawn with a font that could not draw it.

This registers a font that can, once per process, and exposes the one call
every generator needs: `ar(text)` to reshape and reorder, `font_name()` for
the font to draw it with.

The font is looked up in a few places rather than bundled, so a deployment
that ships its own (Cairo, Amiri, Tajawal) is used in preference; DejaVu is
the fallback because it is present on almost every Linux image and covers
Arabic adequately.
"""

import logging
import os

logger = logging.getLogger(__name__)

FONT_NAME = "DataLifeArabic"
FONT_BOLD = "DataLifeArabicBold"

# a deployment's own font wins; the rest are what images usually carry
CANDIDATES = [
    (os.environ.get("PDF_ARABIC_FONT", ""), os.environ.get("PDF_ARABIC_FONT_BOLD", "")),
    ("/app/assets/fonts/Cairo-Regular.ttf", "/app/assets/fonts/Cairo-Bold.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/freefont/FreeSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"),
]

_registered = None          # None = not tried yet, False = no font available


def _register() -> bool:
    global _registered
    if _registered is not None:
        return _registered
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    for regular, bold in CANDIDATES:
        if not regular or not os.path.isfile(regular):
            continue
        try:
            pdfmetrics.registerFont(TTFont(FONT_NAME, regular))
            pdfmetrics.registerFont(TTFont(FONT_BOLD, bold if bold and os.path.isfile(bold) else regular))
            _registered = True
            logger.info("Arabic PDF font registered from %s", regular)
            return True
        except Exception as e:
            logger.warning("could not register %s: %s", regular, e)
    logger.error("NO Arabic-capable font found — Arabic text in PDFs will not render")
    _registered = False
    return False


def font_name(bold: bool = False) -> str:
    """The font to draw Arabic with — Helvetica only if nothing else exists."""
    if _register():
        return FONT_BOLD if bold else FONT_NAME
    return "Helvetica-Bold" if bold else "Helvetica"


def ar(text) -> str:
    """Reshape and reorder Arabic for PDF drawing. Safe on any input."""
    if text is None:
        return ""
    text = str(text)
    if not any("\u0600" <= ch <= "\u06ff" for ch in text):
        return text                      # nothing Arabic in it
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(text))
    except Exception:
        return text


def available() -> bool:
    """Whether Arabic will actually render — for a health check or a warning."""
    return _register()
