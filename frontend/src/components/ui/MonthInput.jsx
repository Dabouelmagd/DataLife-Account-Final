import React from 'react';
import { AR_MONTHS, EN_MONTHS, parseMonth, yearRange, isMonthDisabled, nextMonthValue } from './monthValue';

/**
 * Drop-in replacement for <input type="month"> (unsupported in Safari and
 * Firefox desktop, where it degrades to a free-text box). Two native selects
 * — month and year — so it is keyboard and screen-reader accessible for free.
 *
 * value / onChange use exactly "YYYY-MM" ('' when empty). onChange receives an
 * event-like object { target: { value, name, id } } so existing
 * `e => setX(e.target.value)` handlers keep working unchanged.
 */
function isRtl(dir) {
  if (dir) return dir === 'rtl';
  if (typeof document === 'undefined') return true;
  return (document.documentElement.getAttribute('dir') || document.body?.getAttribute('dir')) !== 'ltr';
}

export default function MonthInput({
  value = '',
  onChange,
  min,
  max,
  id,
  name,
  className = '',
  selectClassName = '',
  disabled = false,
  required = false,
  dir,
  'aria-label': ariaLabel,
  ...rest
}) {
  const rtl = isRtl(dir);
  const months = rtl ? AR_MONTHS : EN_MONTHS;
  const parsed = parseMonth(value);
  const years = yearRange({ value, min, max });

  const emit = (part) => (e) => {
    const next = nextMonthValue(value, part, e.target.value, { min, max });
    if (!onChange) return;
    const target = { value: next, name, id };
    onChange({ target, currentTarget: target, type: 'change', preventDefault() {}, stopPropagation() {} });
  };

  const sel = `bg-transparent outline-none cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 rounded ${selectClassName}`;
  const monthLabel = rtl ? 'الشهر' : 'Month';
  const yearLabel = rtl ? 'السنة' : 'Year';

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      dir={rtl ? 'rtl' : 'ltr'}
      className={`${/(^|\s)(flex|block)(\s|$)/.test(className) ? '' : 'inline-flex '}items-center gap-1 ${className}`}
      {...rest}
    >
      <select
        id={id}
        className={`${sel} flex-1 min-w-0`}
        value={parsed ? String(parsed.month) : ''}
        onChange={emit('month')}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} – ${monthLabel}` : monthLabel}
      >
        {(!parsed || !required) && <option value="">{monthLabel}</option>}
        {months.map((m, i) => (
          <option key={m} value={String(i + 1)} disabled={isMonthDisabled(parsed?.year, i + 1, min, max)}>{m}</option>
        ))}
      </select>
      <select
        className={sel}
        value={parsed ? String(parsed.year) : ''}
        onChange={emit('year')}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} – ${yearLabel}` : yearLabel}
      >
        {(!parsed || !required) && <option value="">{yearLabel}</option>}
        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
      </select>
    </span>
  );
}
