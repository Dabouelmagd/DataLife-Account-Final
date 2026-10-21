/**
 * The backend serialises many timestamps as naive ISO strings
 * ("2026-10-21T08:30:00") that are actually UTC. `new Date()` would read
 * those as local time and shift them by the user's offset. parseServerDate()
 * treats a date-time without a zone suffix as UTC; values with Z/±hh:mm, date
 * only strings, numbers and Date objects are handled as usual.
 */
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

export function parseServerDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  let s = String(value).trim();
  if (DATE_TIME.test(s)) s = s.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');   // Safari: ISO 'T', max 3 fraction digits
  if (DATE_TIME.test(s) && !HAS_ZONE.test(s)) s = `${s}Z`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default parseServerDate;
