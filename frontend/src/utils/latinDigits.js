/**
 * الأرقام بالإنجليزية (0-9) في كل البرنامج، حتى في الواجهة العربية.
 *
 * Formatting with an Arabic locale ('ar', 'ar-EG', …) prints Arabic-Indic
 * digits (٠١٢٣). The product shows Western digits everywhere, so every Arabic
 * locale handed to the browser's formatters is given the Latin numbering
 * system ("-u-nu-latn"). Month and weekday names stay Arabic; only the digits
 * change. Done once here so the ~80 places that format numbers and dates —
 * and the chart library — all follow it without each being edited.
 */
const latn = (locale) => {
  const fix = (l) => (typeof l === 'string' && /^ar(-|$)/i.test(l) && !/-nu-/.test(l)
    ? (l.includes('-u-') ? `${l}-nu-latn` : `${l}-u-nu-latn`) : l);
  return Array.isArray(locale) ? locale.map(fix) : fix(locale);
};

if (typeof window !== 'undefined' && !window.__latinDigits) {
  window.__latinDigits = true;

  const NF = Intl.NumberFormat;
  const DTF = Intl.DateTimeFormat;
  function NumberFormat(locale, opts) { return new NF(latn(locale), opts); }
  NumberFormat.prototype = NF.prototype;
  NumberFormat.supportedLocalesOf = NF.supportedLocalesOf;
  function DateTimeFormat(locale, opts) { return new DTF(latn(locale), opts); }
  DateTimeFormat.prototype = DTF.prototype;
  DateTimeFormat.supportedLocalesOf = DTF.supportedLocalesOf;
  Intl.NumberFormat = NumberFormat;
  Intl.DateTimeFormat = DateTimeFormat;

  const wrap = (proto, name) => {
    const orig = proto[name];
    proto[name] = function patched(locale, opts) { return orig.call(this, latn(locale), opts); };
  };
  wrap(Number.prototype, 'toLocaleString');
  wrap(Date.prototype, 'toLocaleString');
  wrap(Date.prototype, 'toLocaleDateString');
  wrap(Date.prototype, 'toLocaleTimeString');
}

export default latn;
