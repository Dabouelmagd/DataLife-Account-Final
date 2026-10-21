/**
 * Copy text to the clipboard. Uses the async Clipboard API when available and
 * falls back to a hidden textarea + execCommand('copy') (older Safari, http
 * origins, iframes without clipboard permission). Resolves to true/false and
 * never throws, so callers can show success or failure feedback.
 */
function legacyCopy(text) {
  if (typeof document === 'undefined') return false;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  const active = document.activeElement;
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(ta);
  if (active && typeof active.focus === 'function') active.focus();
  return ok;
}

export async function copyText(value) {
  const text = value === null || value === undefined ? '' : String(value);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function'
      && (typeof window === 'undefined' || window.isSecureContext !== false)) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  return legacyCopy(text);
}

export default copyText;
