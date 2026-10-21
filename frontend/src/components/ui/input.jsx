import * as React from "react"

import { cn } from "../../lib/utils"
import { sanitizeAmountInput } from "../../utils/numbers"

const base = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"

/*
 * type="number" fields render as a text box with a decimal keypad.
 * A real number input rejects Arabic-Indic digits (١٢٣) in every browser —
 * the value silently became "" and then 0 — and some Safari builds show it as
 * plain text anyway. Here the typed text is normalised (٠-٩ → 0-9, ٫ → .),
 * kept as typed while the field has focus (so "0." can become "0.5"), and the
 * handler receives the ASCII string in e.target.value exactly as before.
 */
const NumberInput = React.forwardRef(({ className, value, onChange, onFocus, onBlur, min, max, step, ...props }, ref) => {
  const [draft, setDraft] = React.useState(null)
  const allowNegative = min === undefined || Number(min) < 0
  const shown = draft !== null ? draft : (value === undefined || value === null ? "" : String(value))
  return (
    <input
      type="text"
      inputMode="decimal"
      dir={props.dir || "ltr"}
      className={cn(base, className)}
      ref={ref}
      value={shown}
      onFocus={(e) => { setDraft(shown); onFocus && onFocus(e) }}
      onBlur={(e) => { setDraft(null); onBlur && onBlur(e) }}
      onChange={(e) => {
        const s = sanitizeAmountInput(e.target.value, { allowNegative })
        setDraft(s)
        if (onChange) onChange({ ...e, target: { ...e.target, value: s, name: e.target.name, id: e.target.id }, currentTarget: e.currentTarget })
      }}
      aria-valuemin={min}
      aria-valuemax={max}
      {...props} />
  )
})
NumberInput.displayName = "NumberInput"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  if (type === "number") return <NumberInput ref={ref} className={className} {...props} />
  return (
    <input
      type={type}
      className={cn(base, className)}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
