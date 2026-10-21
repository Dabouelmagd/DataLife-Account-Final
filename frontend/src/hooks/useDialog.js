import { useCallback, useEffect, useRef } from 'react';

/**
 * Keyboard behaviour for hand-rolled modals ("fixed inset-0" overlays):
 *  - Escape closes the top-most open dialog
 *  - Tab / Shift+Tab stay inside the dialog
 *  - the first field (or [data-autofocus]) gets focus on open
 *  - focus returns to whatever was focused before, on close
 *
 * Two entry points:
 *  useDialog(open, onClose)  → ref for one dialog container
 *  useDialogRefs()           → dialogRef(key, onClose) for a component that
 *                              renders several conditional modals
 * Add role="dialog" aria-modal="true" aria-labelledby on the container.
 */

const FOCUSABLE = [
  'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', 'iframe', '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const stack = [];   // open dialogs, last = top-most

function focusables(node) {
  return Array.from(node.querySelectorAll(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0),
  );
}

function onKeyDown(e) {
  const top = stack[stack.length - 1];
  if (!top || e.defaultPrevented) return;
  if (e.key === 'Escape' || e.key === 'Esc') {
    e.preventDefault();
    top.close();
    return;
  }
  if (e.key !== 'Tab') return;
  const items = focusables(top.node);
  if (!items.length) { e.preventDefault(); top.node.focus(); return; }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = top.node.contains(active);
  if (e.shiftKey && (!inside || active === first || active === top.node)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
}

/** Wire a mounted dialog node. Returns a detach function. */
export function attachDialog(node, getClose) {
  if (!node || typeof document === 'undefined') return () => {};
  const entry = { node, close: () => { const fn = getClose(); if (fn) fn(); } };
  const previous = document.activeElement;
  if (!stack.length) document.addEventListener('keydown', onKeyDown);
  stack.push(entry);
  if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');

  const timer = setTimeout(() => {
    if (node.contains(document.activeElement)) return;   // something inside already took focus
    const target = node.querySelector('[data-autofocus]') || focusables(node)[0] || node;
    if (target && typeof target.focus === 'function') target.focus();
  }, 0);

  return () => {
    clearTimeout(timer);
    const i = stack.indexOf(entry);
    if (i !== -1) stack.splice(i, 1);
    if (!stack.length) document.removeEventListener('keydown', onKeyDown);
    if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
      // let the closing render finish before moving focus back
      setTimeout(() => { if (document.contains(previous)) previous.focus(); }, 0);
    }
  };
}

export default function useDialog(open, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!open) return undefined;
    return attachDialog(ref.current, () => closeRef.current);
  }, [open]);
  return ref;
}

/**
 * dialogRef(key, onClose) returns a stable callback ref per key, so a
 * component with several `{showX && (<div …>)}` modals needs one hook call.
 */
export function useDialogRefs() {
  const slots = useRef(new Map());
  return useCallback((key, onClose) => {
    let slot = slots.current.get(key);
    if (!slot) {
      slot = { close: onClose, detach: null };
      slot.ref = (node) => {
        if (slot.detach) { slot.detach(); slot.detach = null; }
        if (node) slot.detach = attachDialog(node, () => slot.close);
      };
      slots.current.set(key, slot);
    }
    slot.close = onClose;
    return slot.ref;
  }, []);
}
