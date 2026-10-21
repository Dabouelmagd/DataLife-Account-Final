import React, { useId, useMemo, useRef, useState } from 'react';
import { normalizeDigits } from '../../utils/numbers';

/**
 * Small accessible combobox (WAI-ARIA 1.2 "select-only"-style list with a
 * text filter). Renders inline — no portal — so it lives inside hand-rolled
 * modals and their focus trap.
 *
 * options: [{ value, label, code?, keywords? }]
 * Typing filters by code prefix (Arabic-Indic digits accepted) or by any word
 * in the label / keywords. ↑/↓ move, Enter selects, Escape closes the list
 * (a second Escape bubbles up to the dialog), Tab keeps the highlighted match
 * only when the user typed something.
 */
const MAX_SHOWN = 60;

function matches(opt, q) {
  if (!q) return true;
  const code = String(opt.code ?? '').toLowerCase();
  if (code && code.startsWith(q)) return true;
  const hay = `${opt.label} ${opt.keywords || ''}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

const Combobox = React.forwardRef(function Combobox({
  id,
  value,
  onChange,
  options,
  placeholder = '',
  emptyText = 'لا توجد نتائج',
  className = '',
  inputClassName = '',
  disabled = false,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  onKeyDown: onKeyDownProp,
}, ref) {
  const autoId = useId();
  const baseId = id || `cb-${autoId.replace(/:/g, '')}`;
  const listId = `${baseId}-list`;
  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) || null, [options, value]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(null);   // null = not typing, show the selected label
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const q = normalizeDigits(query || '').trim().toLowerCase();
  const filtered = useMemo(() => options.filter((o) => matches(o, q)), [options, q]);
  const shown = filtered.slice(0, MAX_SHOWN);
  const activeOpt = open ? shown[Math.min(active, shown.length - 1)] : null;

  const scrollTo = (i) => {
    const el = listRef.current?.children?.[i];
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
  };
  const openList = (start) => {
    const i = start ?? Math.max(0, shown.findIndex((o) => String(o.value) === String(value)));
    setOpen(true); setActive(i); scrollTo(i);
  };
  const close = () => { setOpen(false); setQuery(null); };
  const choose = (opt) => {
    if (opt && onChange) onChange(opt.value);
    close();
  };
  const move = (delta) => {
    if (!open) { openList(); return; }
    if (!shown.length) return;
    const i = (Math.min(active, shown.length - 1) + delta + shown.length) % shown.length;
    setActive(i); scrollTo(i);
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1); break;
      case 'ArrowUp': e.preventDefault(); move(-1); break;
      case 'Home': if (open) { e.preventDefault(); setActive(0); scrollTo(0); } break;
      case 'End': if (open) { e.preventDefault(); setActive(shown.length - 1); scrollTo(shown.length - 1); } break;
      case 'Enter':
        if (open) { e.preventDefault(); choose(activeOpt); return; }
        break;
      case 'Escape':
        if (open || query !== null) { e.preventDefault(); e.stopPropagation(); close(); return; }
        break;
      case 'Tab':
        if (open && query && activeOpt) choose(activeOpt); else close();
        break;
      default:
    }
    if (onKeyDownProp) onKeyDownProp(e);
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={ref}
        id={baseId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOpt ? `${baseId}-opt-${String(activeOpt.value)}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
        value={query !== null ? query : (selected ? selected.label : '')}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
        onClick={() => (open ? null : openList())}
        onBlur={() => close()}
      />
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        hidden={!open}
        className="absolute z-20 mt-1 max-h-64 w-full min-w-[16rem] overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
      >
        {shown.map((o, i) => {
          const isActive = activeOpt && o.value === activeOpt.value;
          const isSel = selected && o.value === selected.value;
          return (
            <li
              key={o.value}
              id={`${baseId}-opt-${String(o.value)}`}
              role="option"
              aria-selected={!!isSel}
              className={`cursor-pointer px-3 py-1.5 ${isActive ? 'bg-blue-50 text-blue-900' : ''} ${isSel ? 'font-semibold' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseMove={() => { if (active !== i) setActive(i); }}
            >
              {o.label}
            </li>
          );
        })}
        {!shown.length && <li role="presentation" className="px-3 py-2 text-gray-500">{emptyText}</li>}
        {filtered.length > MAX_SHOWN && (
          <li role="presentation" className="px-3 py-1.5 text-xs text-gray-400">
            {`+${filtered.length - MAX_SHOWN}`}
          </li>
        )}
      </ul>
    </div>
  );
});

export default Combobox;
