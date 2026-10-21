/** Pure helpers behind <MonthInput>. Values are always "YYYY-MM" or "". */

export const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const RE = /^(\d{4})-(\d{2})$/;

/** "2026-03" → { year: 2026, month: 3 }; anything else → null. */
export function parseMonth(value) {
  const m = RE.exec(typeof value === 'string' ? value.trim() : '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function formatMonth(year, month) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

/** Keep "YYYY-MM" inside [min, max] (both optional "YYYY-MM"). */
export function clampMonth(value, min, max) {
  if (!parseMonth(value)) return value;
  if (parseMonth(min) && value < min) return min;
  if (parseMonth(max) && value > max) return max;
  return value;
}

/** Years to list: min/max bound the range; otherwise current-10 … current+5, always including the value's year. */
export function yearRange({ value, min, max, now = new Date() } = {}) {
  const cur = now.getFullYear();
  const lo = parseMonth(min)?.year ?? cur - 10;
  const hi = parseMonth(max)?.year ?? cur + 5;
  const v = parseMonth(value)?.year;
  const from = Math.min(lo, hi, v ?? lo);
  const to = Math.max(lo, hi, v ?? hi);
  const out = [];
  for (let y = to; y >= from; y -= 1) out.push(y);
  return out;
}

export function isMonthDisabled(year, month, min, max) {
  if (!year) return false;
  const v = formatMonth(year, month);
  return (parseMonth(min) && v < min) || (parseMonth(max) && v > max) || false;
}

/**
 * Next value after one select changes. part is 'year' or 'month'; raw is the
 * select's string value ('' = cleared). A missing counterpart is filled with
 * the current year / month, then the result is clamped to min/max.
 */
export function nextMonthValue(current, part, raw, { min, max, now = new Date() } = {}) {
  if (raw === '' || raw === null || raw === undefined) return '';
  const p = parseMonth(current);
  const n = Number(raw);
  const year = part === 'year' ? n : (p?.year ?? now.getFullYear());
  const month = part === 'month' ? n : (p?.month ?? now.getMonth() + 1);
  return clampMonth(formatMonth(year, month), min, max);
}
