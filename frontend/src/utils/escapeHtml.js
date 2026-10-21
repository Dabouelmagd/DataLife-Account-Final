/**
 * Escape a value before putting it into HTML built as a string
 * (print windows written with document.write, innerHTML).
 *
 * Print screens interpolated customer names, item descriptions, notes...
 * straight into the page: an invoice whose customer was named
 * `<img src=x onerror=...>` ran that script in the app's own origin — with the
 * signed-in user's token in localStorage — the moment anyone printed it.
 */
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

export default escapeHtml;
