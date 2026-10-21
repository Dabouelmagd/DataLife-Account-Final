/**
 * Arabic-Indic digit handling for amount inputs.
 *
 * Users typing on an Arabic keyboard produce ٠-٩ (Arabic-Indic) or ۰-۹
 * (Persian/Urdu), the Arabic decimal separator ٫ and the thousands separator
 * ٬. A plain <input type="number"> rejects these and silently yields "" which
 * later becomes 0. normalizeDigits() turns them into an ASCII numeric string;
 * parseAmount() returns a finite number or null — never a silent 0.
 */

const ARABIC_INDIC_ZERO = 0x0660; // ٠
const PERSIAN_ZERO = 0x06f0; // ۰

export function normalizeDigits(input) {
  if (input === null || input === undefined) return '';
  let out = '';
  for (const ch of String(input)) {
    const c = ch.codePointAt(0);
    if (c >= ARABIC_INDIC_ZERO && c <= ARABIC_INDIC_ZERO + 9) out += String(c - ARABIC_INDIC_ZERO);
    else if (c >= PERSIAN_ZERO && c <= PERSIAN_ZERO + 9) out += String(c - PERSIAN_ZERO);
    else if (ch === '٫') out += '.'; // ٫ Arabic decimal separator
    else if (ch === '٬' || ch === ',' || ch === '،') continue; // ٬ / , / ، thousands separators
    else if (ch === '−') out += '-'; // minus sign
    else if (/\s/.test(ch) || ch === '‏' || ch === '‎' || ch === '؜') continue; // spaces, bidi marks
    else out += ch;
  }
  return out;
}

/** Keep only what a decimal amount field may hold while the user is typing. */
export function sanitizeAmountInput(input, { allowNegative = false } = {}) {
  let s = normalizeDigits(input).replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '');
  if (allowNegative) s = s.replace(/(?!^)-/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  return s;
}

/** Parse a user-entered amount. Returns a finite number, or null when empty/invalid. */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = normalizeDigits(input);
  if (s === '' || s === '-' || s === '.' || s === '-.') return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
