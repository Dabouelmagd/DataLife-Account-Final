/**
 * شاشات عمليات القطاعات — كانت محركاتها في الخلفية بلا واجهة:
 *   PosShiftsPage        — ورديات نقاط البيع، البيع والمرتجع، الإقفال، التالف، تسويات البطاقات،
 *                          الإيصال الإلكتروني، والعمل بدون إنترنت (utils/posQueue) (/api/pos)
 *   ManufacturingPage    — قوائم المواد وأوامر الإنتاج وفروق التحميل (/api/manufacturing)
 *   RealEstatePage       — المشاريع والوحدات والحجوزات والشيكات والتسليم (/api/real-estate)
 *   LettersOfCreditPage  — الاعتمادات المستندية للاستيراد (/api/lc)
 *   InventoryEngineTools — تكاليف الاستيراد، الجرد، التحويل بين المخازن، تقييم المخزون (/api/inventory-engine)
 * Every entry the server will post is previewed before saving; the server
 * recomputes it and refuses anything unbalanced or posted to a missing account.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Plus, X, Trash2, RefreshCw, WifiOff, Printer } from 'lucide-react';
import * as posQueue from '../utils/posQueue';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = (n) => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });
const today = () => new Date().toISOString().slice(0, 10);
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};

const input = 'mt-1 w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900';
const btnPrimary = 'px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50';
const btnGhost = 'px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm';
const btnSmall = 'px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-600 text-xs font-semibold';
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;
const Q = ({ v }) => <bdi dir="ltr" className="tabular-nums">{qtyFmt(v)}</bdi>;

const getProducts = () => axios.get(`${API}/api/inventory/products`, { ...auth(), params: { limit: 500 } })
  .then((r) => r.data?.products || []).catch(() => []);
const getWarehouses = () => axios.get(`${API}/api/inventory/warehouses`, auth())
  .then((r) => r.data?.warehouses || []).catch(() => []);
const getBanks = () => axios.get(`${API}/api/payment-vouchers/sources`, auth())
  .then((r) => [...new Map((r.data?.sources || []).filter((s) => s.kind === 'bank').map((b) => [b.account_code, b])).values()])
  .catch(() => []);

function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" dir="rtl">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} max-h-[92vh] overflow-y-auto shadow-xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">{footer}</div>}
      </div>
    </div>
  );
}

function Lines({ rows, note }) {
  const shown = rows.filter((r) => r[1] || r[2]);
  const dr = r2(shown.reduce((s, r) => s + (r[1] || 0), 0));
  const cr = r2(shown.reduce((s, r) => s + (r[2] || 0), 0));
  return (
    <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs">
      <p className="font-bold mb-2">القيد الذي سيُرحَّل:</p>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="text-slate-500"><tr><th className="text-start">الحساب</th><th className="text-end">مدين</th><th className="text-end">دائن</th></tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={`${r[0]}-${i}`}><td className="py-0.5">{r[0]}</td>
                <td className="text-end">{r[1] ? <N v={r[1]} /> : ''}</td><td className="text-end">{r[2] ? <N v={r[2]} /> : ''}</td></tr>
            ))}
            <tr className="border-t border-slate-300 font-bold"><td className="pt-1">الإجمالي</td><td className="text-end pt-1"><N v={dr} /></td><td className="text-end pt-1"><N v={cr} /></td></tr>
          </tbody>
        </table>
      </div>
      {Math.abs(dr - cr) > 0.01 && <p className="mt-2 text-red-700">غير متوازن — راجع الأرقام</p>}
      {note && <p className="mt-2 text-slate-500">{note}</p>}
    </div>
  );
}

const serverRows = (lines) => (lines || []).map((l) => [`${l.account_code} ${l.account_name}`, l.debit, l.credit]);

function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`px-4 py-2 rounded-full text-sm font-semibold border ${value === k ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'border-slate-300 dark:border-slate-600'}`}>{l}</button>
      ))}
    </div>
  );
}

function Header({ title, sub, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-xl font-extrabold">{title}</h1>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const AddBtn = ({ onClick, children }) => (
  <button onClick={onClick} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">
    <Plus className="w-4 h-4" aria-hidden /> {children}</button>
);

function Table({ head, children, empty }) {
  if (empty) return <p className="text-center py-12 text-sm text-slate-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300"><tr>
          {head.map((h, i) => <th key={i} className={`px-3 py-2 ${h.startsWith('#') ? 'text-end' : 'text-start'}`}>{h.replace(/^#/, '')}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}

const Spinner = () => <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
const Err = ({ e }) => (e ? <p className="mt-3 text-sm text-red-700" role="alert">{e}</p> : null);
const Stat = ({ label, v, money: m = true }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3"><p className="text-xs text-slate-500">{label}</p>
    <p className="text-lg font-extrabold">{m ? <N v={v} /> : <bdi dir="ltr">{v ?? 0}</bdi>}</p></div>
);
const Label = ({ t, children, className = '' }) => <label className={className}><span className="text-slate-600 dark:text-slate-300">{t}</span>{children}</label>;
const Num = ({ value, onChange, ...p }) => (
  <input type="number" min="0" step="0.01" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className={input} {...p} />
);
const ProductSelect = ({ products, value, onChange, optional }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
    <option value="">{optional ? '— بدون صنف مخزني —' : '— اختر الصنف —'}</option>
    {products.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name}</option>)}
  </select>
);
const WarehouseSelect = ({ warehouses, value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
    <option value="">المخزن الافتراضي</option>
    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
  </select>
);
const BankSelect = ({ banks, value, onChange }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
    {banks.length === 0 && <option value="162">162 النقدية بالبنوك</option>}
    {banks.map((b) => <option key={b.account_code} value={b.account_code}>{b.account_code} — {b.label}</option>)}
  </select>
);
const Badge = ({ tone = 'slate', children }) => {
  const c = { green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-800', red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700' }[tone];
  return <span className={`px-2 py-0.5 rounded-full text-xs whitespace-nowrap ${c}`}>{children}</span>;
};
const DelBtn = ({ onClick }) => (
  <button onClick={onClick} aria-label="حذف السطر" className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><Trash2 className="w-4 h-4" /></button>
);

/* ═════════════════════════ نقاط البيع ═════════════════════════ */

const PAY = { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة' };
const ETA_ST = { pending: ['بانتظار الإرسال', 'amber'], submitted: ['مُرسل', 'green'], rejected: ['مرفوض', 'red'], error: ['خطأ', 'red'] };
const EtaBadge = ({ r }) => {
  if (!r) return <span className="text-slate-400">—</span>;
  const [l, tone] = ETA_ST[r.status] || [r.status, 'slate'];
  return <span title={r.error || r.uuid || ''}><Badge tone={tone}>{l}</Badge></span>;
};
const isNetErr = (e) => posQueue.isRetryable(e);
const autoReceipt = (terminal) => {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0');
  return `${terminal || 'POS'}-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};
const ETA_BLANK = { environment: 'preprod', device_serial: '', client_id: '', client_secret: '', pre_shared_key: '', pos_os_version: '',
  activity_code: '', branch_code: '0', default_item_code: '', default_item_type: 'EGS' };

/** Prints a simple 72mm receipt through a hidden frame — works offline. */
function printReceipt({ shift, kind, payload, products, eta, pending }) {
  const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const names = Object.fromEntries((products || []).map((p) => [p.id, p.name]));
  const rows = (payload.items || []).map((i) => `<tr><td>${esc(names[i.product_id] || i.product_id || 'صنف')}</td><td class="n">${esc(qtyFmt(i.qty))}</td></tr>`).join('');
  const when = new Date().toLocaleString('en-GB');
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>إيصال</title><style>
    body{font-family:Tahoma,Arial,sans-serif;width:72mm;margin:0 auto;font-size:12px;color:#000}
    h1{font-size:15px;text-align:center;margin:4px 0} .c{text-align:center} table{width:100%;border-collapse:collapse}
    td{padding:2px 0} .n{text-align:left;direction:ltr} .t{border-top:1px dashed #000;font-weight:bold}
    .mark{border:2px solid #000;text-align:center;font-weight:bold;padding:4px;margin:6px 0}
    .u{font-size:9px;word-break:break-all;direction:ltr;text-align:center}</style></head><body>
    <h1>${kind === 'return' ? 'إيصال مرتجع' : 'إيصال بيع'}</h1>
    <p class="c">${esc(shift?.terminal_id)} — ${esc(shift?.cashier_name)}<br/><span dir="ltr">${esc(when)}</span></p>
    <p>رقم الإيصال: <span dir="ltr">${esc(payload.receipt_number || payload.original_receipt || '')}</span></p>
    ${rows ? `<table>${rows}</table>` : ''}
    <table><tr class="t"><td>الإجمالي شامل الضريبة</td><td class="n">${esc(money(payload.amount))}</td></tr>
    <tr><td>ضريبة القيمة المضافة</td><td class="n">${esc(money(payload.vat))}</td></tr>
    <tr><td>${kind === 'return' ? 'طريقة الرد' : 'طريقة الدفع'}</td><td class="n">${esc(PAY[payload.payment_method])}</td></tr></table>
    ${pending ? '<div class="mark">سيتم رفعه — حُفظ بدون إنترنت</div>' : ''}
    ${eta?.uuid ? `<p class="c">الإيصال الإلكتروني</p><p class="u">${esc(eta.uuid)}</p>` : ''}
    <p class="c">شكراً لزيارتكم</p></body></html>`;
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  Object.assign(f.style, { position: 'fixed', width: '0', height: '0', border: '0', right: '0', bottom: '0' });
  document.body.appendChild(f);
  const w = f.contentWindow;
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(() => {
    try { w.focus(); w.print(); } catch (e) { /* print blocked */ }
    setTimeout(() => f.remove(), 2000);
  }, 100);
}

export function PosShiftsPage() {
  const [tab, setTab] = useState('shifts');
  const [data, setData] = useState(null);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [banks, setBanks] = useState([]);
  const [active, setActive] = useState(null);
  const [form, setForm] = useState(null);       // {kind: open|sale|return|close|spoil|settle, ...}
  const [preview, setPreview] = useState(null);
  const [spoil, setSpoil] = useState(null);
  const [settle, setSettle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [online, setOnline] = useState(posQueue.isOnline());
  const [queued, setQueued] = useState([]);
  const [printOn, setPrintOn] = useState(true);
  const [eta, setEta] = useState(null);          // {settings, effective, missing}
  const [etaForm, setEtaForm] = useState(null);
  const [receipts, setReceipts] = useState(null); // {receipts, counts}
  const [etaFilter, setEtaFilter] = useState('');
  const [note, setNote] = useState('');
  const activeRef = useRef(null);
  activeRef.current = active;

  const load = async () => {
    try {
      const { data: d } = await axios.get(`${API}/api/pos/shifts`, { ...auth(), params: { limit: 50 } });
      setData(d); posQueue.cacheSet('shifts', d);
    } catch (e) {
      const cached = isNetErr(e) ? await posQueue.cacheGet('shifts') : null;
      setData(cached || { shifts: [], summary: {} });
      if (!cached) setErr(errText(e, 'تعذّر تحميل الورديات'));
    }
  };
  const loadProducts = async () => {
    try {
      const { data: r } = await axios.get(`${API}/api/inventory/products`, { ...auth(), params: { limit: 500 } });
      const list = r?.products || []; setProducts(list); posQueue.cacheSet('products', list);
    } catch (e) { setProducts((await posQueue.cacheGet('products')) || []); }
  };
  const loadSpoil = async () => {
    const d = new Date(); const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    try { const { data: r } = await axios.get(`${API}/api/pos/spoilage/report`, { ...auth(), params: { date_from: from, date_to: today() } }); setSpoil(r); }
    catch (e) { setSpoil({ records: [], total_waste_cost: 0 }); }
  };
  const loadSettle = async () => {
    try { const { data: r } = await axios.get(`${API}/api/pos/card-settlements`, auth()); setSettle(r); }
    catch (e) { setSettle({ settlements: [] }); }
  };
  const loadReceipts = async (status) => {
    try {
      const { data: r } = await axios.get(`${API}/api/pos/eta-receipts`, { ...auth(), params: status ? { status } : {} });
      setReceipts(r);
    } catch (e) { setReceipts((prev) => prev || { receipts: [], counts: {} }); }
  };
  const loadEta = async () => {
    try {
      const { data: r } = await axios.get(`${API}/api/pos/eta-settings`, auth());
      setEta(r); setEtaForm({ ...ETA_BLANK, ...r.settings, client_secret: '', pre_shared_key: '' });
    } catch (e) { setEta({ settings: {}, effective: {}, missing: [] }); setEtaForm((f) => f || { ...ETA_BLANK }); }
  };
  const openShift = async (id) => {
    try {
      const { data: s } = await axios.get(`${API}/api/pos/shifts/${id}`, auth());
      setActive(s); posQueue.cacheSet(`shift:${id}`, s);
    } catch (e) {
      const cached = isNetErr(e) ? await posQueue.cacheGet(`shift:${id}`) : null;
      if (cached) setActive(cached);
      else if (isNetErr(e)) {
        const sh = (data?.shifts || []).find((x) => x.id === id);
        if (sh) setActive({ ...sh, transactions: [] }); else setErr('لا توجد نسخة محفوظة من الوردية على هذا الجهاز');
      } else setErr(errText(e, 'تعذّر فتح الوردية'));
    }
  };
  const sendOp = (op) => axios.post(`${API}/api/pos/shifts/${op.shift_id}/${op.kind}`, { ...op.payload, client_uuid: op.client_uuid }, auth());
  const afterFlush = async () => {
    await load(); loadReceipts(etaFilter);
    if (activeRef.current) await openShift(activeRef.current.id);
  };
  const flushNow = async () => {
    const r = await posQueue.flush(sendOp);
    if (r.sent) await afterFlush();
    if (r.failed) setErr(`${r.failed} عملية رفضها الخادم — راجعها في قائمة العمليات المعلقة`);
  };
  const afterFlushRef = useRef(afterFlush);
  afterFlushRef.current = afterFlush;
  const sendRef = useRef(sendOp);
  sendRef.current = sendOp;

  useEffect(() => {
    load(); loadSpoil(); loadSettle(); loadProducts(); loadReceipts(''); loadEta();
    getWarehouses().then(setWarehouses); getBanks().then(setBanks);
    const up = () => setOnline(true); const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    const unsub = posQueue.subscribe(setQueued);
    const stop = posQueue.startAutoFlush((op) => sendRef.current(op), () => afterFlushRef.current());
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); unsub(); stop(); };
  }, []);

  const run = async (fn, after) => {
    setBusy(true); setErr('');
    try { await fn(); setForm(null); setPreview(null); if (after) await after(); }
    catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };

  const itemsBody = (items) => items.filter((i) => i.product_id && +i.qty > 0).map((i) => ({ product_id: i.product_id, qty: +i.qty }));
  const saveOpen = () => run(() => axios.post(`${API}/api/pos/shifts/open`, {
    cashier_id: form.cashier_id.trim(), cashier_name: form.cashier_name.trim(), terminal_id: form.terminal_id || 'POS-01',
    opening_cash: +form.opening_cash || 0, shift_date: form.shift_date, warehouse_id: form.warehouse_id || null }, auth()), load);

  const saveTxn = async () => {
    const kind = form.kind;
    const shift = active;
    const payload = kind === 'sale'
      ? { amount: +form.amount, vat: +form.vat || 0, payment_method: form.payment_method,
        receipt_number: form.receipt_number.trim() || autoReceipt(shift.terminal_id), items: itemsBody(form.items) }
      : { amount: +form.amount, vat: +form.vat || 0, payment_method: form.payment_method,
        original_receipt: form.receipt_number.trim(), reason: form.reason || null, items: itemsBody(form.items) };
    const op = { client_uuid: form.client_uuid, kind, shift_id: shift.id, payload };
    const keepOffline = async () => {
      await posQueue.enqueue(op);
      if (printOn) printReceipt({ shift, kind, payload, products, pending: true });
      setForm(null); setNote('حُفظت العملية على الجهاز — سيتم رفعها تلقائياً عند عودة الاتصال');
    };
    setBusy(true); setErr(''); setNote('');
    try {
      if (!posQueue.isOnline()) { await keepOffline(); return; }
      try {
        const { data: r } = await sendOp(op);
        if (printOn) printReceipt({ shift, kind, payload, products, eta: r.eta_receipt, pending: false });
        setForm(null);
        if (r.eta_receipt?.status === 'error') setNote(`سُجّلت العملية — الإيصال الإلكتروني: ${r.eta_receipt.error}`);
        await openShift(shift.id); await load(); loadReceipts(etaFilter);
      } catch (e) {
        if (isNetErr(e)) await keepOffline();
        else setErr(errText(e, 'تعذّر الحفظ'));
      }
    } finally { setBusy(false); }
  };
  const closeBody = () => ({ actual_cash: +form.actual_cash, shortage_tolerance: +form.tolerance || 0, date: form.date });
  const doPreview = async () => {
    setBusy(true); setErr('');
    try { const { data: p } = await axios.post(`${API}/api/pos/shifts/${active.id}/close-preview`, closeBody(), auth()); setPreview(p); }
    catch (e) { setErr(errText(e, 'تعذّرت المعاينة')); } finally { setBusy(false); }
  };
  const saveClose = () => run(() => axios.post(`${API}/api/pos/shifts/${active.id}/close`, closeBody(), auth()), async () => { setActive(null); await load(); });
  const saveSpoil = () => run(() => axios.post(`${API}/api/pos/spoilage`, {
    date: form.date, warehouse_id: form.warehouse_id || null, inventory_account: form.inventory_account, notes: form.notes || null,
    items: form.items.filter((i) => +i.qty > 0).map((i) => ({ product_id: i.product_id || null, product_name: i.product_name || null,
      qty: +i.qty, unit_cost: i.unit_cost === '' ? null : +i.unit_cost, reason: i.reason || 'تالف' })) }, auth()), loadSpoil);
  const saveSettle = () => run(() => axios.post(`${API}/api/pos/card-settlements`, {
    date: form.date, gross_amount: +form.gross_amount, commission: +form.commission || 0, bank_account: form.bank_account, reference: form.reference || null }, auth()), loadSettle);
  const saveEta = async () => {
    setBusy(true); setErr(''); setNote('');
    const body = {};
    Object.entries(etaForm).forEach(([k, v]) => {
      if (!(k in ETA_BLANK)) return;
      if ((k === 'client_secret' || k === 'pre_shared_key') && !v) return;   // empty = keep the stored one
      body[k] = typeof v === 'string' ? v.trim() : v;
    });
    try {
      const { data: r } = await axios.put(`${API}/api/pos/eta-settings`, body, auth());
      setEta(r); setEtaForm({ ...ETA_BLANK, ...r.settings, client_secret: '', pre_shared_key: '' });
      setNote(r.built ? `${r.message} — بُني ${r.built} إيصال كان ينتظر الإعدادات` : r.message);
      loadReceipts(etaFilter);
    } catch (e) { setErr(errText(e, 'تعذّر حفظ الإعدادات')); } finally { setBusy(false); }
  };
  const submitNow = async () => {
    setBusy(true); setErr(''); setNote('');
    try { const { data: r } = await axios.post(`${API}/api/pos/eta-receipts/submit-now`, {}, auth()); setNote(r.message); await loadReceipts(etaFilter); }
    catch (e) { setErr(errText(e, 'تعذّر الإرسال')); } finally { setBusy(false); }
  };

  const s = data?.summary || {};
  const blankItem = { product_id: '', qty: '' };
  const setItem = (i, k, v) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const waiting = queued.filter((o) => !o.failed);
  const rejectedOps = queued.filter((o) => o.failed);
  const activeQueued = active ? queued.filter((o) => o.shift_id === active.id) : [];
  const counts = receipts?.counts || {};
  const setE = (k) => (e) => setEtaForm({ ...etaForm, [k]: e.target.value });

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <Header title="نقاط البيع" sub="الوردية تُرحَّل بقيد واحد عند الإقفال: الإيراد 4121، الضريبة 260، المرتجعات 413، والفروق النقدية (3353 / 1313 / 4231).">
        {tab === 'shifts' && <AddBtn onClick={() => { setErr(''); setForm({ kind: 'open', cashier_id: '', cashier_name: '', terminal_id: 'POS-01', opening_cash: '', shift_date: today(), warehouse_id: '' }); }}>فتح وردية</AddBtn>}
        {tab === 'spoilage' && <AddBtn onClick={() => { setErr(''); setForm({ kind: 'spoil', date: today(), warehouse_id: '', inventory_account: '125', notes: '', items: [{ product_id: '', product_name: '', qty: '', unit_cost: '', reason: 'تالف' }] }); }}>تسجيل تالف</AddBtn>}
        {tab === 'cards' && <AddBtn onClick={() => { setErr(''); setForm({ kind: 'settle', date: today(), gross_amount: '', commission: '', bank_account: banks[0]?.account_code || '162', reference: '' }); }}>تسوية بطاقات</AddBtn>}
      </Header>

      {!online && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 p-3 text-sm" role="status">
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
          <span><b>يعمل بدون إنترنت</b> — المبيعات والمرتجعات تُحفظ على هذا الجهاز وتُرفع تلقائياً عند عودة الاتصال. الإقفال والإعدادات تحتاج اتصالاً.</span>
        </div>
      )}
      {(waiting.length > 0 || rejectedOps.length > 0) && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span>عمليات بانتظار الرفع: <b><bdi dir="ltr">{waiting.length}</bdi></b></span>
            {waiting[0]?.last_error && <span className="text-xs text-slate-500">آخر محاولة: {waiting[0].last_error}</span>}
            {online && waiting.length > 0 && <button onClick={flushNow} className={btnSmall}>رفع الآن</button>}
          </div>
          {rejectedOps.map((o) => (
            <div key={o.client_uuid} className="flex flex-wrap items-center gap-2 text-red-700">
              <Badge tone="red">رفضها الخادم</Badge>
              <span>{o.kind === 'return' ? 'مرتجع' : 'بيع'} <N v={o.payload.amount} /> — {o.last_error}</span>
              <button onClick={() => posQueue.discard(o.client_uuid)} className={btnSmall}>حذف من الجهاز</button>
            </div>
          ))}
        </div>
      )}

      <Tabs tabs={[['shifts', 'الورديات'], ['spoilage', 'التالف والهدر'], ['cards', 'تسويات البطاقات'], ['eta', 'الإيصال الإلكتروني']]} value={tab}
        onChange={(t) => { setTab(t); setNote(''); if (t === 'eta') { loadEta(); loadReceipts(etaFilter); } }} />
      {note && <p className="text-sm rounded-lg bg-blue-50 text-blue-900 p-3" role="status">{note}</p>}

      {tab === 'shifts' && (<>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="إجمالي المبيعات" v={s.total_sales} /><Stat label="نقدي" v={s.total_cash} />
          <Stat label="بطاقات" v={s.total_card} /><Stat label="ورديات بعجز" v={s.cash_shortages} money={false} />
          <Stat label="إيصالات إلكترونية بانتظار الإرسال" v={counts.pending || 0} money={false} />
        </div>
        {data === null ? <Spinner /> : (
          <Table head={['الكاشير', 'النقطة', 'التاريخ', '#المبيعات', '#المرتجعات', '#فرق النقدية', 'الحالة', '']} empty={data.shifts.length === 0 && 'لا توجد ورديات بعد.'}>
            {data.shifts.map((sh) => (
              <tr key={sh.id}>
                <td className="px-3 py-2 font-semibold">{sh.cashier_name}</td><td className="px-3 py-2"><bdi dir="ltr">{sh.terminal_id}</bdi></td>
                <td className="px-3 py-2"><bdi dir="ltr">{sh.shift_date}</bdi></td>
                <td className="px-3 py-2 text-end"><N v={sh.total_sales} /></td><td className="px-3 py-2 text-end"><N v={sh.total_returns} /></td>
                <td className={`px-3 py-2 text-end ${(sh.cash_difference || 0) < 0 ? 'text-red-700' : ''}`}>{sh.status === 'closed' ? <N v={sh.cash_difference} /> : '—'}</td>
                <td className="px-3 py-2">{sh.status === 'open' ? <Badge tone="green">مفتوحة</Badge> : <Badge>مغلقة</Badge>}</td>
                <td className="px-3 py-2 text-end"><button onClick={() => openShift(sh.id)} className={btnSmall}>{sh.status === 'open' ? 'إدارة' : 'عرض'}</button></td>
              </tr>
            ))}
          </Table>
        )}
      </>)}

      {tab === 'spoilage' && (spoil === null ? <Spinner /> : (<>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Stat label="تكلفة التالف هذا الشهر" v={spoil.total_waste_cost} /><Stat label="عدد المحاضر" v={spoil.records_count} money={false} /></div>
        <Table head={['التاريخ', 'الأصناف', '#التكلفة', 'الحساب']} empty={(spoil.records || []).length === 0 && 'لا يوجد تالف مسجل هذا الشهر.'}>
          {(spoil.records || []).map((r) => (
            <tr key={r.id}><td className="px-3 py-2"><bdi dir="ltr">{r.date}</bdi></td>
              <td className="px-3 py-2">{r.items.map((i) => `${i.product_name} (${qtyFmt(i.qty)})`).join('، ')}</td>
              <td className="px-3 py-2 text-end"><N v={r.total_cost} /></td><td className="px-3 py-2"><bdi dir="ltr">{r.inventory_account || '125'}</bdi></td></tr>
          ))}
        </Table>
      </>))}

      {tab === 'cards' && (settle === null ? <Spinner /> : (<>
        {!settle.transit_account && <p className="text-sm rounded-lg bg-amber-50 text-amber-800 p-3">لا يوجد حساب تسويات بطاقات معلقة (166/167) — تُقيَّد مبيعات البطاقات على البنك 162 مباشرة عند الإقفال. فعّل باقة التجزئة أو المطاعم لاستخدام التسويات.</p>}
        <Table head={['التاريخ', 'المرجع', '#الإجمالي', '#العمولة', '#الصافي للبنك']} empty={(settle.settlements || []).length === 0 && 'لا توجد تسويات.'}>
          {(settle.settlements || []).map((r) => (
            <tr key={r.id}><td className="px-3 py-2"><bdi dir="ltr">{r.date}</bdi></td><td className="px-3 py-2"><bdi dir="ltr">{r.reference || '—'}</bdi></td>
              <td className="px-3 py-2 text-end"><N v={r.gross_amount} /></td><td className="px-3 py-2 text-end"><N v={r.commission} /></td><td className="px-3 py-2 text-end font-semibold"><N v={r.net_amount} /></td></tr>
          ))}
        </Table>
      </>))}

      {tab === 'eta' && (etaForm === null ? <Spinner /> : (<>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="بانتظار الإرسال" v={counts.pending || 0} money={false} /><Stat label="مُرسلة" v={counts.submitted || 0} money={false} />
          <Stat label="مرفوضة" v={counts.rejected || 0} money={false} /><Stat label="أخطاء بناء" v={counts.error || 0} money={false} />
        </div>
        {eta?.missing?.length > 0 && <p className="text-sm rounded-lg bg-amber-50 text-amber-800 p-3">الإيصالات تبقى بانتظار الإرسال حتى تكتمل: {eta.missing.join('، ')}. رقم التسجيل والاسم والعنوان تُؤخذ من إعدادات الفاتورة الإلكترونية.</p>}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="font-bold mb-3">إعدادات جهاز نقطة البيع لدى المنظومة</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <Label t="البيئة"><select value={etaForm.environment || 'preprod'} onChange={setE('environment')} className={input}>
              <option value="preprod">تجريبية (Pre-production)</option><option value="production">الإنتاج</option></select></Label>
            <Label t="الرقم التسلسلي للجهاز *"><input dir="ltr" value={etaForm.device_serial || ''} onChange={setE('device_serial')} className={input} /></Label>
            <Label t="إصدار نظام التشغيل"><input dir="ltr" value={etaForm.pos_os_version || ''} onChange={setE('pos_os_version')} className={input} /></Label>
            <Label t="Client ID *"><input dir="ltr" value={etaForm.client_id || ''} onChange={setE('client_id')} className={input} autoComplete="off" /></Label>
            <Label t={eta?.settings?.has_client_secret ? 'Client Secret (محفوظ — اتركه فارغاً للإبقاء)' : 'Client Secret *'}>
              <input dir="ltr" type="password" value={etaForm.client_secret || ''} onChange={setE('client_secret')} className={input} autoComplete="new-password" /></Label>
            <Label t={eta?.settings?.has_pre_shared_key ? 'المفتاح المشترك (محفوظ)' : 'المفتاح المشترك (إن وُجد)'}>
              <input dir="ltr" type="password" value={etaForm.pre_shared_key || ''} onChange={setE('pre_shared_key')} className={input} autoComplete="new-password" /></Label>
            <Label t="كود النشاط"><input dir="ltr" value={etaForm.activity_code || ''} onChange={setE('activity_code')} placeholder={eta?.effective?.activity_code || ''} className={input} /></Label>
            <Label t="كود الفرع"><input dir="ltr" value={etaForm.branch_code || ''} onChange={setE('branch_code')} className={input} /></Label>
            <Label t="كود الصنف الافتراضي (للإيصال بلا أصناف مسعّرة)">
              <div className="flex gap-2"><select value={etaForm.default_item_type || 'EGS'} onChange={setE('default_item_type')} className={`${input} w-24`}>
                <option value="EGS">EGS</option><option value="GS1">GS1</option></select>
                <input dir="ltr" value={etaForm.default_item_code || ''} onChange={setE('default_item_code')} className={input} /></div></Label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={saveEta} disabled={busy || !online} className={btnPrimary}>{busy ? '…' : 'حفظ الإعدادات'}</button>
            <button onClick={submitNow} disabled={busy || !online} className={btnGhost}>إرسال الإيصالات الآن</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">تُرسل الإيصالات تلقائياً كل 10 دقائق. لم يُختبر الربط بعد على بيئة المنظومة التجريبية — جرّب البيئة التجريبية أولاً.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs tabs={[['', 'الكل'], ['pending', 'بانتظار الإرسال'], ['submitted', 'مُرسلة'], ['rejected', 'مرفوضة'], ['error', 'أخطاء']]} value={etaFilter}
            onChange={(f) => { setEtaFilter(f); loadReceipts(f); }} />
          <button onClick={() => loadReceipts(etaFilter)} aria-label="تحديث" className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><RefreshCw className="w-4 h-4" /></button>
        </div>
        {receipts === null ? <Spinner /> : (
          <Table head={['الوقت', 'النوع', 'الإيصال', '#المبلغ', 'الحالة', 'الرقم لدى المنظومة / السبب']} empty={(receipts.receipts || []).length === 0 && 'لا توجد إيصالات.'}>
            {(receipts.receipts || []).map((r) => (
              <tr key={r.id}><td className="px-3 py-2"><bdi dir="ltr">{String(r.issued_at || '').slice(0, 16).replace('T', ' ')}</bdi></td>
                <td className="px-3 py-2">{r.kind === 'return' ? <Badge tone="amber">مرتجع</Badge> : 'بيع'}</td>
                <td className="px-3 py-2"><bdi dir="ltr">{r.receipt_number}</bdi></td><td className="px-3 py-2 text-end"><N v={r.amount} /></td>
                <td className="px-3 py-2"><EtaBadge r={r} /></td>
                <td className="px-3 py-2 text-xs max-w-xs break-all">{r.error || r.last_error ? <span className="text-red-700">{r.error || r.last_error}</span> : <bdi dir="ltr">{r.long_id || r.uuid || '—'}</bdi>}</td></tr>
            ))}
          </Table>
        )}
      </>))}
      {err && !form && <Err e={err} />}

      {active && !form && (
        <Modal wide title={`وردية ${active.cashier_name} — ${active.terminal_id}`} onClose={() => setActive(null)} footer={active.status === 'open' && <>
          <label className="me-auto inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={printOn} onChange={(e) => setPrintOn(e.target.checked)} /><Printer className="w-4 h-4" aria-hidden /> طباعة الإيصال</label>
          <button onClick={() => { setErr(''); setForm({ kind: 'return', client_uuid: posQueue.newClientUuid(), amount: '', vat: '', payment_method: 'cash', receipt_number: '', reason: '', items: [blankItem] }); }} className={btnGhost}>مرتجع</button>
          <button onClick={() => { setErr(''); setForm({ kind: 'sale', client_uuid: posQueue.newClientUuid(), amount: '', vat: '', payment_method: 'cash', receipt_number: '', items: [blankItem] }); }} className={btnGhost}>تسجيل بيع</button>
          <button onClick={() => { setErr(''); setPreview(null); setForm({ kind: 'close', actual_cash: '', tolerance: 50, date: active.shift_date }); }} disabled={!online || activeQueued.length > 0}
            title={activeQueued.length ? 'ارفع العمليات المعلقة أولاً' : ''} className={btnPrimary}>إقفال الوردية</button></>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <Stat label="العهدة الافتتاحية" v={active.opening_cash} /><Stat label="مبيعات نقدية" v={active.total_cash_sales} />
            <Stat label="بطاقات ومحافظ" v={(active.total_card_sales || 0) + (active.total_wallet_sales || 0)} /><Stat label="مرتجعات" v={active.total_returns} />
          </div>
          {active.status === 'closed' && <p className="mb-3 text-sm">النقدية المتوقعة <N v={active.expected_cash} /> — المعدودة <N v={active.actual_cash} /> — الفرق <N v={active.cash_difference} /></p>}
          <Table head={['الوقت', 'النوع', 'الإيصال', 'الدفع', '#المبلغ', '#الضريبة', 'الإيصال الإلكتروني']} empty={(active.transactions || []).length === 0 && activeQueued.length === 0 && 'لا توجد عمليات بعد.'}>
            {activeQueued.map((o) => (
              <tr key={o.client_uuid} className="bg-amber-50/60 dark:bg-amber-900/10"><td className="px-3 py-2"><bdi dir="ltr">{String(o.created_at || '').slice(11, 16)}</bdi></td>
                <td className="px-3 py-2">{o.kind === 'return' ? <Badge tone="amber">مرتجع</Badge> : 'بيع'}</td>
                <td className="px-3 py-2"><bdi dir="ltr">{o.payload.receipt_number || o.payload.original_receipt || '—'}</bdi></td><td className="px-3 py-2">{PAY[o.payload.payment_method]}</td>
                <td className="px-3 py-2 text-end"><N v={o.payload.amount} /></td><td className="px-3 py-2 text-end"><N v={o.payload.vat} /></td>
                <td className="px-3 py-2">{o.failed ? <Badge tone="red">رفضها الخادم</Badge> : <Badge tone="amber">سيتم رفعه</Badge>}</td></tr>
            ))}
            {(active.transactions || []).map((t) => (
              <tr key={t.id}><td className="px-3 py-2"><bdi dir="ltr">{String(t.timestamp || '').slice(11, 16)}</bdi></td>
                <td className="px-3 py-2">{t.type === 'return' ? <Badge tone="amber">مرتجع</Badge> : 'بيع'}</td>
                <td className="px-3 py-2"><bdi dir="ltr">{t.receipt_number || '—'}</bdi></td><td className="px-3 py-2">{PAY[t.payment_method]}</td>
                <td className="px-3 py-2 text-end"><N v={t.amount} /></td><td className="px-3 py-2 text-end"><N v={t.vat} /></td>
                <td className="px-3 py-2"><EtaBadge r={t.eta_receipt} /></td></tr>
            ))}
          </Table>
        </Modal>
      )}
      {form?.kind === 'open' && (
        <Modal title="فتح وردية" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={saveOpen} disabled={busy || !form.cashier_id.trim() || !form.cashier_name.trim()} className={btnPrimary}>{busy ? '…' : 'فتح وترحيل العهدة'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="كود الكاشير *"><input dir="ltr" value={form.cashier_id} onChange={(e) => setForm({ ...form, cashier_id: e.target.value })} className={input} /></Label>
            <Label t="اسم الكاشير *"><input value={form.cashier_name} onChange={(e) => setForm({ ...form, cashier_name: e.target.value })} className={input} /></Label>
            <Label t="نقطة البيع"><input dir="ltr" value={form.terminal_id} onChange={(e) => setForm({ ...form, terminal_id: e.target.value })} className={input} /></Label>
            <Label t="التاريخ"><input type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} className={input} /></Label>
            <Label t="العهدة النقدية الافتتاحية"><Num value={form.opening_cash} onChange={(v) => setForm({ ...form, opening_cash: v })} /></Label>
            <Label t="المخزن الذي تُصرف منه الأصناف"><WarehouseSelect warehouses={warehouses} value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })} /></Label>
          </div>
          {+form.opening_cash > 0 && <div className="mt-4"><Lines rows={[['164 نقدية درج الكاشير', r2(form.opening_cash), 0], ['161 الخزينة الرئيسية', 0, r2(form.opening_cash)]]} /></div>}
          <Err e={err} />
        </Modal>
      )}

      {(form?.kind === 'sale' || form?.kind === 'return') && (
        <Modal title={form.kind === 'sale' ? 'تسجيل بيع' : 'مرتجع مبيعات'} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={saveTxn} disabled={busy || !(+form.amount > 0) || +form.vat >= +form.amount || (form.kind === 'return' && !form.receipt_number.trim())} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="الإجمالي شامل الضريبة *"><Num value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></Label>
            <Label t="ضريبة القيمة المضافة">
              <div className="flex gap-2"><Num value={form.vat} onChange={(v) => setForm({ ...form, vat: v })} />
                <button type="button" onClick={() => setForm({ ...form, vat: String(r2((+form.amount || 0) * 14 / 114)) })} className={`${btnSmall} mt-1 whitespace-nowrap`}>14% ضمنية</button></div></Label>
            <Label t={form.kind === 'sale' ? 'طريقة الدفع' : 'طريقة رد المبلغ'}>
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={input}>
                {Object.entries(PAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Label>
            <Label t={form.kind === 'sale' ? 'رقم الإيصال' : 'رقم الإيصال الأصلي *'}><input dir="ltr" value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} className={input} /></Label>
          </div>
          <p className="mt-4 font-bold">الأصناف ({form.kind === 'sale' ? 'تخرج من المخزن' : 'تعود للمخزن'}) — اختياري</p>
          {form.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
              <ProductSelect products={products} value={it.product_id} onChange={(v) => setItem(i, 'product_id', v)} />
              <Num value={it.qty} onChange={(v) => setItem(i, 'qty', v)} placeholder="الكمية" />
              <DelBtn onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button onClick={() => setForm({ ...form, items: [...form.items, blankItem] })} className={`${btnSmall} mt-2`}>+ صنف</button>
          <p className="mt-3 text-xs text-slate-500">لا يُرحَّل قيد الآن — المبيعات والمرتجعات تُجمَّع وتُرحَّل بقيد واحد عند إقفال الوردية. في الجرد المستمر تُحسب التكلفة بمتوسط التكلفة المتحرك.</p>
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'close' && (
        <Modal title={`إقفال وردية ${active.cashier_name}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={doPreview} disabled={busy || form.actual_cash === ''} className={btnGhost}>معاينة القيد</button>
          <button onClick={saveClose} disabled={busy || !preview} className={btnPrimary}>{busy ? '…' : 'إقفال وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Label t="النقدية المعدودة في الدرج *"><Num value={form.actual_cash} onChange={(v) => { setPreview(null); setForm({ ...form, actual_cash: v }); }} /></Label>
            <Label t="العجز المسموح (ج.م)"><Num value={form.tolerance} onChange={(v) => { setPreview(null); setForm({ ...form, tolerance: v }); }} /></Label>
            <Label t="تاريخ القيد"><input type="date" value={form.date} onChange={(e) => { setPreview(null); setForm({ ...form, date: e.target.value }); }} className={input} /></Label>
          </div>
          {preview && (
            <div className="mt-4 space-y-2">
              <p>النقدية المتوقعة <N v={preview.expected_cash} /> — الفرق <span className={preview.cash_difference < 0 ? 'text-red-700 font-bold' : 'font-bold'}><N v={preview.cash_difference} /></span>
                {preview.shortage_type === 'allowable' && ' — عجز مسموح (مصروف 3353)'}{preview.shortage_type === 'cashier_receivable' && ' — عجز على الكاشير (1313)'}{preview.shortage_type === 'surplus' && ' — زيادة (إيراد 4231)'}</p>
              <Lines rows={serverRows(preview.lines)} />
              {preview.cogs_lines?.length > 0 && <Lines rows={serverRows(preview.cogs_lines)} note="قيد تكلفة المبيعات (الجرد المستمر)" />}
            </div>
          )}
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'spoil' && (() => {
        const typed = form.items.filter((i) => +i.qty > 0 && i.unit_cost !== '');
        const total = r2(typed.reduce((t, i) => t + (+i.qty) * (+i.unit_cost), 0));
        const allTyped = typed.length === form.items.filter((i) => +i.qty > 0).length;
        return (
          <Modal wide title="تسجيل تالف وهدر" onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={saveSpoil} disabled={busy || !form.items.some((i) => +i.qty > 0 && (i.product_id || i.product_name))} className={btnPrimary}>{busy ? '…' : 'حفظ وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
              <Label t="المخزن"><WarehouseSelect warehouses={warehouses} value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })} /></Label>
              <Label t="حساب المخزون">
                <select value={form.inventory_account} onChange={(e) => setForm({ ...form, inventory_account: e.target.value })} className={input}>
                  <option value="125">125 بضائع بغرض البيع</option><option value="121">121 خامات</option><option value="122">122 إنتاج تام</option></select></Label>
            </div>
            <div className="mt-4 space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_6rem_7rem_8rem_auto] gap-2 items-end">
                  {it.product_id || !it.product_name ? <ProductSelect products={products} value={it.product_id} onChange={(v) => setItem(i, 'product_id', v)} optional />
                    : <input value={it.product_name} onChange={(e) => setItem(i, 'product_name', e.target.value)} className={input} />}
                  <Num value={it.qty} onChange={(v) => setItem(i, 'qty', v)} placeholder="الكمية" />
                  <Num value={it.unit_cost} onChange={(v) => setItem(i, 'unit_cost', v)} placeholder="تكلفة (فارغ = المتوسط)" />
                  <input value={it.reason} onChange={(e) => setItem(i, 'reason', e.target.value)} placeholder="السبب" className={input} />
                  <DelBtn onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', product_name: '', qty: '', unit_cost: '', reason: 'تالف' }] })} className={btnSmall}>+ صنف</button>
            </div>
            <div className="mt-4"><Lines rows={[['33610 مصروف تالف وهدر', total, 0], [`${form.inventory_account} المخزون (311 في الجرد الدوري)`, 0, total]]}
              note={allTyped ? null : 'الأصناف بلا تكلفة تُسعَّر بمتوسط التكلفة المتحرك عند الحفظ — الإجمالي النهائي يظهر بعد الترحيل.'} /></div>
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'settle' && (
        <Modal title="تسوية مبيعات البطاقات" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={saveSettle} disabled={busy || !(+form.gross_amount > 0) || +form.commission >= +form.gross_amount} className={btnPrimary}>{busy ? '…' : 'حفظ وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
            <Label t="البنك"><BankSelect banks={banks} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} /></Label>
            <Label t="إجمالي التسوية *"><Num value={form.gross_amount} onChange={(v) => setForm({ ...form, gross_amount: v })} /></Label>
            <Label t="عمولة البنك / الشبكة"><Num value={form.commission} onChange={(v) => setForm({ ...form, commission: v })} /></Label>
            <Label t="المرجع" className="sm:col-span-2"><input dir="ltr" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={input} /></Label>
          </div>
          {+form.gross_amount > 0 && <div className="mt-4"><Lines rows={[[`${form.bank_account} البنك`, r2(form.gross_amount - (+form.commission || 0)), 0],
            ['334 مصروفات وعمولات بنكية', r2(form.commission), 0], [`${settle?.transit_account || '166/167'} تسويات بطاقات معلقة`, 0, r2(form.gross_amount)]]} /></div>}
          <Err e={err} />
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ التصنيع ═════════════════════════ */

export function ManufacturingPage() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState(null);
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try { const { data } = await axios.get(`${API}/api/manufacturing/production-orders`, { ...auth(), params: { limit: 100 } }); setOrders(data.orders || []); }
    catch (e) { setOrders([]); setErr(errText(e, 'تعذّر تحميل أوامر الإنتاج')); }
    axios.get(`${API}/api/manufacturing/boms`, auth()).then((r) => setBoms(r.data?.boms || [])).catch(() => {});
  };
  useEffect(() => { load(); getProducts().then(setProducts); getWarehouses().then(setWarehouses); }, []);

  const pname = (id) => products.find((p) => p.id === id)?.name || '';
  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); setForm(null); setPreview(null); await load(); }
    catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };
  const orderBody = () => ({
    order_number: form.order_number.trim(), product_id: form.product_id, product_name: pname(form.product_id),
    planned_qty: +form.planned_qty, start_date: form.start_date, warehouse_id: form.warehouse_id || null,
    materials_account: form.materials_account || null, notes: form.notes || null,
    overhead_basis: form.overhead_basis || null, overhead_rate: form.overhead_basis ? +form.overhead_rate || 0 : 0,
    bom_id: form.source === 'bom' ? form.bom_id : null,
    materials: form.source === 'bom' ? [] : form.materials.filter((m) => +m.qty > 0).map((m) => ({
      product_id: m.product_id || null, name: m.name || pname(m.product_id), qty: +m.qty, unit_cost: +m.unit_cost || 0 })),
  });
  const doPreview = async () => {
    setBusy(true); setErr('');
    try { const { data } = await axios.post(`${API}/api/manufacturing/production-orders/preview`, orderBody(), auth()); setPreview(data); }
    catch (e) { setErr(errText(e, 'تعذّرت المعاينة')); } finally { setBusy(false); }
  };
  const statusBadge = (s) => (s === 'open' ? <Badge tone="blue">تحت التشغيل</Badge> : <Badge tone="green">تام</Badge>);
  const setRow = (key, i, k, v) => setForm({ ...form, [key]: form[key].map((x, j) => (j === i ? { ...x, [k]: v } : x)) });

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <Header title="التصنيع وأوامر الإنتاج" sub="خامات 121 ← إنتاج تحت التشغيل 126 ← إنتاج تام 122 (في الجرد الدوري: 311 ← 126 ← 311 والكميات فقط تدخل المخزن). الأجور تُنقل من 312 والتكاليف غير المباشرة تُحمَّل على 3181.">
        {tab === 'orders' && <AddBtn onClick={() => { setErr(''); setPreview(null); setForm({ kind: 'order', order_number: `MO-${(orders || []).length + 1}`, product_id: '', planned_qty: '', start_date: today(), warehouse_id: '', materials_account: '', overhead_basis: '', overhead_rate: '', source: 'manual', bom_id: '', notes: '', materials: [{ product_id: '', name: '', qty: '', unit_cost: '' }] }); }}>أمر إنتاج</AddBtn>}
        {tab === 'boms' && <AddBtn onClick={() => { setErr(''); setForm({ kind: 'bom', product_id: '', output_qty: 1, name: '', components: [{ product_id: '', qty: '' }] }); }}>قائمة مواد</AddBtn>}
        {tab === 'variance' && <AddBtn onClick={() => { setErr(''); const d = new Date(); setForm({ kind: 'variance', period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, actual_foh: '', applied_foh: '', date: today() }); }}>تسوية فروق التحميل</AddBtn>}
      </Header>
      <Tabs tabs={[['orders', 'أوامر الإنتاج'], ['boms', 'قوائم المواد'], ['variance', 'فروق التحميل']]} value={tab} onChange={setTab} />

      {tab === 'orders' && (orders === null ? <Spinner /> : (
        <Table head={['الأمر', 'المنتج', '#المخطط', '#الفعلي', '#انحراف العائد', '#خامات', '#أجور + غير مباشرة', '#التكلفة', 'الحالة', '']} empty={orders.length === 0 && 'لا توجد أوامر إنتاج بعد.'}>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2"><bdi dir="ltr">{o.order_number}</bdi></td><td className="px-3 py-2 font-semibold">{o.product_name}</td>
              <td className="px-3 py-2 text-end"><Q v={o.planned_qty} /></td><td className="px-3 py-2 text-end">{o.status === 'closed' ? <Q v={o.actual_qty} /> : '—'}</td>
              <td className={`px-3 py-2 text-end ${o.yield_variance_pct < 0 ? 'text-red-700' : o.yield_variance_pct > 0 ? 'text-emerald-700' : ''}`}>
                {o.status === 'closed' && o.yield_variance_pct != null ? <bdi dir="ltr">{o.yield_variance_pct > 0 ? '+' : ''}{o.yield_variance_pct}%</bdi> : '—'}</td>
              <td className="px-3 py-2 text-end"><N v={o.total_materials_cost} /></td><td className="px-3 py-2 text-end"><N v={(o.total_labor_cost || 0) + (o.total_foh_applied || 0)} /></td>
              <td className="px-3 py-2 text-end font-semibold"><N v={o.total_actual_cost} /></td><td className="px-3 py-2">{statusBadge(o.status)}</td>
              <td className="px-3 py-2 text-end whitespace-nowrap">{o.status === 'open' && <>
                <button onClick={() => { setErr(''); setForm({ kind: 'alloc', order: o, labor_cost: '', date: today(), foh: [{ type: 'electricity', amount: '', description: '' }] }); }} className={btnSmall}>تحميل تكاليف</button>{' '}
                <button onClick={() => { setErr(''); setForm({ kind: 'complete', order: o, actual_qty: o.planned_qty, date: today(), warehouse_id: '', confirm_yield: false }); }} className={btnSmall}>إتمام</button></>}</td>
            </tr>
          ))}
        </Table>
      ))}

      {tab === 'boms' && (
        <Table head={['المنتج', 'الاسم', '#ينتج', 'المكونات', '']} empty={boms.length === 0 && 'لا توجد قوائم مواد.'}>
          {boms.map((b) => (
            <tr key={b.id}><td className="px-3 py-2 font-semibold">{b.product_name}</td><td className="px-3 py-2">{b.name}</td>
              <td className="px-3 py-2 text-end"><Q v={b.output_qty} /></td>
              <td className="px-3 py-2">{b.components.map((c) => `${c.name} × ${qtyFmt(c.qty)}`).join('، ')}</td>
              <td className="px-3 py-2 text-end"><button onClick={() => run(() => axios.delete(`${API}/api/manufacturing/boms/${b.id}`, auth()))} className={btnSmall}>إيقاف</button></td></tr>
          ))}
        </Table>
      )}

      {tab === 'variance' && <p className="text-sm text-slate-500 rounded-lg border border-slate-200 dark:border-slate-700 p-4">في نهاية كل شهر: التكاليف الصناعية الفعلية تتجمع على 313، والمحمَّلة على الأوامر على 3181. التسوية تُقفل الاثنين والفرق يذهب إلى 3182 (مدين = نقص تحميل، دائن = زيادة تحميل). تُسوّى كل فترة مرة واحدة.</p>}
      {err && !form && <Err e={err} />}

      {form?.kind === 'order' && (
        <Modal wide title="أمر إنتاج جديد" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={doPreview} disabled={busy || !form.product_id || !(+form.planned_qty > 0)} className={btnGhost}>معاينة الخامات والقيد</button>
          <button onClick={() => run(() => axios.post(`${API}/api/manufacturing/production-orders`, orderBody(), auth()))} disabled={busy || !preview} className={btnPrimary}>{busy ? '…' : 'فتح الأمر وصرف الخامات'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Label t="رقم الأمر *"><input dir="ltr" value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} className={input} /></Label>
            <Label t="المنتج التام *" className="sm:col-span-2"><ProductSelect products={products} value={form.product_id} onChange={(v) => { setPreview(null); setForm({ ...form, product_id: v, bom_id: '' }); }} /></Label>
            <Label t="الكمية المخططة *"><Num value={form.planned_qty} onChange={(v) => { setPreview(null); setForm({ ...form, planned_qty: v }); }} /></Label>
            <Label t="تاريخ البدء"><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={input} /></Label>
            <Label t="مخزن الخامات"><WarehouseSelect warehouses={warehouses} value={form.warehouse_id} onChange={(v) => { setPreview(null); setForm({ ...form, warehouse_id: v }); }} /></Label>
            <Label t="الخامات مسجلة على" className="sm:col-span-3">
              <select value={form.materials_account} onChange={(e) => { setPreview(null); setForm({ ...form, materials_account: e.target.value }); }} className={input}>
                <option value="">تلقائي — حسب طريقة الجرد (121 في الجرد المستمر، 311 في الدوري)</option>
                <option value="121">121 مخزون الخامات والمواد الأولية</option>
                <option value="125">125 بضائع — إن كانت الخامات مشتراة بفاتورة شراء (الجرد المستمر يقيد المشتريات على 125)</option></select></Label>
            <Label t="تحميل غير مباشر بمعدل محدد مسبقاً (يُحمَّل تلقائياً عند الإتمام)">
              <select value={form.overhead_basis} onChange={(e) => { setPreview(null); setForm({ ...form, overhead_basis: e.target.value }); }} className={input}>
                <option value="">بدون — تحميل يدوي</option><option value="material_pct">% من تكلفة الخامات</option><option value="per_unit">مبلغ لكل وحدة منتجة</option></select></Label>
            {form.overhead_basis && <Label t={form.overhead_basis === 'material_pct' ? 'النسبة %' : 'المبلغ لكل وحدة'}><Num value={form.overhead_rate} onChange={(v) => { setPreview(null); setForm({ ...form, overhead_rate: v }); }} /></Label>}
          </div>
          <div className="mt-4"><Tabs tabs={[['manual', 'خامات يدوياً'], ['bom', 'من قائمة مواد']]} value={form.source} onChange={(v) => { setPreview(null); setForm({ ...form, source: v }); }} /></div>
          {form.source === 'bom' ? (
            <Label t="قائمة المواد" className="block mt-3">
              <select value={form.bom_id} onChange={(e) => { setPreview(null); setForm({ ...form, bom_id: e.target.value }); }} className={input}>
                <option value="">— اختر —</option>{boms.filter((b) => b.product_id === form.product_id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              {form.product_id && !boms.some((b) => b.product_id === form.product_id) && <span className="text-xs text-amber-700">لا توجد قائمة مواد لهذا المنتج — أنشئها من تبويب «قوائم المواد».</span>}
            </Label>
          ) : (
            <div className="mt-3 space-y-2">
              {form.materials.map((m, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_6rem_8rem_auto] gap-2 items-end">
                  <ProductSelect products={products} value={m.product_id} onChange={(v) => { setPreview(null); setRow('materials', i, 'product_id', v); }} optional />
                  <Num value={m.qty} onChange={(v) => { setPreview(null); setRow('materials', i, 'qty', v); }} placeholder="الكمية" />
                  <Num value={m.unit_cost} onChange={(v) => { setPreview(null); setRow('materials', i, 'unit_cost', v); }} placeholder="تكلفة (بلا رصيد)" />
                  <DelBtn onClick={() => { setPreview(null); setForm({ ...form, materials: form.materials.filter((_, j) => j !== i) }); }} />
                  {!m.product_id && <input value={m.name} onChange={(e) => setRow('materials', i, 'name', e.target.value)} placeholder="اسم الخامة" className={`${input} sm:col-span-4`} />}
                </div>
              ))}
              <button onClick={() => setForm({ ...form, materials: [...form.materials, { product_id: '', name: '', qty: '', unit_cost: '' }] })} className={btnSmall}>+ خامة</button>
              <p className="text-xs text-slate-500">الخامة التي لها رصيد بالمخزن تُصرف بمتوسط تكلفتها المتحرك، والتكلفة المكتوبة تُستخدم فقط لما لا رصيد له.</p>
            </div>
          )}
          {preview && (
            <div className="mt-4 space-y-2">
              <Table head={['الخامة', '#الكمية', '#تكلفة الوحدة', '#الإجمالي']}>
                {preview.materials.map((m, i) => <tr key={i}><td className="px-3 py-1.5">{m.name}</td><td className="px-3 py-1.5 text-end"><Q v={m.qty} /></td>
                  <td className="px-3 py-1.5 text-end"><N v={m.unit_cost} /></td><td className="px-3 py-1.5 text-end"><N v={m.total_cost} /></td></tr>)}
              </Table>
              <Lines rows={[['126 إنتاج تحت التشغيل', preview.total_materials_cost, 0], [`${preview.credit_account} ${preview.credit_account === '311' ? 'تكلفة الخامات (الجرد الدوري)' : 'المخزون'}`, 0, preview.total_materials_cost]]}
                note={preview.overhead_at_planned_qty > 0 ? `سيُحمَّل عند الإتمام تلقائياً ≈ ${money(preview.overhead_at_planned_qty)} تكاليف غير مباشرة (126 / 3181) بالكمية المخططة.` : undefined} />
            </div>
          )}
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'alloc' && (() => {
        const foh = r2(form.foh.reduce((t, f) => t + (+f.amount || 0), 0));
        const labor = r2(form.labor_cost);
        return (
          <Modal title={`تحميل تكاليف — ${form.order.order_number}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/manufacturing/production-orders/${form.order.id}/allocate-costs`, {
              labor_cost: labor, date: form.date, foh_costs: form.foh.filter((f) => +f.amount > 0).map((f) => ({ type: f.type, amount: +f.amount, description: f.description || null })) }, auth()))}
              disabled={busy || !(labor + foh > 0)} className={btnPrimary}>{busy ? '…' : 'حفظ وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label t="أجور مباشرة"><Num value={form.labor_cost} onChange={(v) => setForm({ ...form, labor_cost: v })} /></Label>
              <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
            </div>
            <p className="mt-4 font-bold">تكاليف صناعية غير مباشرة (تحميل)</p>
            {form.foh.map((f, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[9rem_8rem_1fr_auto] gap-2 items-end">
                <select value={f.type} onChange={(e) => setRow('foh', i, 'type', e.target.value)} className={input}>
                  {[['electricity', 'كهرباء'], ['maintenance', 'صيانة'], ['depreciation', 'إهلاك'], ['rent', 'إيجار'], ['other', 'أخرى']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <Num value={f.amount} onChange={(v) => setRow('foh', i, 'amount', v)} placeholder="المبلغ" />
                <input value={f.description} onChange={(e) => setRow('foh', i, 'description', e.target.value)} placeholder="بيان" className={input} />
                <DelBtn onClick={() => setForm({ ...form, foh: form.foh.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <button onClick={() => setForm({ ...form, foh: [...form.foh, { type: 'other', amount: '', description: '' }] })} className={`${btnSmall} mt-2`}>+ بند</button>
            <div className="mt-4"><Lines rows={[['126 إنتاج تحت التشغيل', r2(labor + foh), 0], ['312 أجور تشغيلية مباشرة', 0, labor], ['3181 تكاليف صناعية غير مباشرة محملة', 0, foh]]} /></div>
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'complete' && (() => {
        const o = form.order; const qty = +form.actual_qty || 0;
        const oh = !o.overhead_basis || !(o.overhead_rate > 0) ? 0
          : r2(o.overhead_basis === 'material_pct' ? o.total_materials_cost * o.overhead_rate / 100 : qty * o.overhead_rate);
        const total = r2(o.total_actual_cost + oh);
        const yPct = o.planned_qty > 0 ? Math.round((qty - o.planned_qty) / o.planned_qty * 10000) / 100 : 0;
        const huge = qty > o.planned_qty * 10;
        const periodic = o.materials_account === '311';
        return (
        <Modal title={`إتمام أمر ${o.order_number} — ${o.product_name}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/manufacturing/production-orders/${o.id}/complete`, { actual_qty: qty, date: form.date, warehouse_id: form.warehouse_id || null, confirm_yield: form.confirm_yield }, auth()))}
            disabled={busy || !(qty > 0) || (huge && !form.confirm_yield)} className={btnPrimary}>{busy ? '…' : 'إتمام وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Label t="الكمية المنتجة فعلاً *"><Num value={form.actual_qty} onChange={(v) => setForm({ ...form, actual_qty: v })} /></Label>
            <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
            <Label t="مخزن الإنتاج التام"><WarehouseSelect warehouses={warehouses} value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })} /></Label>
          </div>
          {qty > 0 && <p className="mt-3">تكلفة الوحدة: <N v={total / qty} /> — انحراف العائد عن المخطط:{' '}
            <bdi dir="ltr" className={yPct < 0 ? 'text-red-700 font-bold' : yPct > 0 ? 'text-emerald-700 font-bold' : ''}>{yPct > 0 ? '+' : ''}{yPct}%</bdi></p>}
          {huge && <label className="mt-2 flex items-start gap-2 text-sm text-red-700"><input type="checkbox" checked={form.confirm_yield} onChange={(e) => setForm({ ...form, confirm_yield: e.target.checked })} className="mt-1" />
            <span>الكمية أكبر من 10 أضعاف المخطط — أؤكد أنها صحيحة وليست خطأ إدخال.</span></label>}
          <div className="mt-3 space-y-2">
            {oh > 0 && <Lines rows={[['126 إنتاج تحت التشغيل', oh, 0], ['3181 تكاليف صناعية غير مباشرة محملة', 0, oh]]} note={`تحميل تلقائي بالمعدل المحدد مسبقاً (${o.overhead_basis === 'material_pct' ? `${o.overhead_rate}% من الخامات` : `${o.overhead_rate} لكل وحدة`}).`} />}
            <Lines rows={[[periodic ? '311 تكلفة الخامات (الجرد الدوري)' : '122 مخزون الإنتاج التام', total, 0], ['126 إنتاج تحت التشغيل', 0, total]]}
              note={periodic ? 'الجرد الدوري: تكلفة الإنتاج تعود إلى 311 والكمية تدخل المخزن؛ جرد آخر الفترة يُثبت قيمة المخزون التام.' : undefined} />
          </div>
          <Err e={err} />
        </Modal>
        );
      })()}

      {form?.kind === 'bom' && (
        <Modal title="قائمة مواد جديدة" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/manufacturing/boms`, { product_id: form.product_id, name: form.name || null, output_qty: +form.output_qty || 1,
            components: form.components.filter((c) => c.product_id && +c.qty > 0).map((c) => ({ product_id: c.product_id, qty: +c.qty })) }, auth()))}
            disabled={busy || !form.product_id || !form.components.some((c) => c.product_id && +c.qty > 0)} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Label t="المنتج التام *" className="sm:col-span-2"><ProductSelect products={products} value={form.product_id} onChange={(v) => setForm({ ...form, product_id: v })} /></Label>
            <Label t="الكمية التي تنتجها القائمة"><Num value={form.output_qty} onChange={(v) => setForm({ ...form, output_qty: v })} /></Label>
            <Label t="الاسم" className="sm:col-span-3"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></Label>
          </div>
          <p className="mt-4 font-bold">المكونات</p>
          {form.components.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
              <ProductSelect products={products} value={c.product_id} onChange={(v) => setRow('components', i, 'product_id', v)} />
              <Num value={c.qty} onChange={(v) => setRow('components', i, 'qty', v)} placeholder="الكمية" />
              <DelBtn onClick={() => setForm({ ...form, components: form.components.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button onClick={() => setForm({ ...form, components: [...form.components, { product_id: '', qty: '' }] })} className={`${btnSmall} mt-2`}>+ مكوّن</button>
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'variance' && (() => {
        const auto = form.applied_foh === '';
        const v = auto ? null : r2((+form.applied_foh || 0) - (+form.actual_foh || 0));
        return (
          <Modal title="تسوية فروق التحميل" onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/manufacturing/overhead-variance`, { period: form.period, actual_foh: +form.actual_foh || 0,
              applied_foh: auto ? null : +form.applied_foh, date: form.date }, auth()))} disabled={busy || form.actual_foh === '' || !/^\d{4}-\d{2}$/.test(form.period)} className={btnPrimary}>{busy ? '…' : 'تسوية وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label t="الفترة (YYYY-MM)"><input dir="ltr" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} className={input} /></Label>
              <Label t="تاريخ القيد"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
              <Label t="التكاليف الفعلية (رصيد 313) *"><Num value={form.actual_foh} onChange={(x) => setForm({ ...form, actual_foh: x })} /></Label>
              <Label t="المحمَّل (فارغ = مجموع أوامر الفترة)"><Num value={form.applied_foh} onChange={(x) => setForm({ ...form, applied_foh: x })} /></Label>
            </div>
            {!auto && <div className="mt-4"><Lines rows={[['3181 تكاليف صناعية محملة', r2(form.applied_foh), 0], ['313 مصروفات تشغيلية فعلية', 0, r2(form.actual_foh)],
              ['3182 انحراف التكاليف الصناعية', v < 0 ? -v : 0, v > 0 ? v : 0]]} /></div>}
            {auto && <p className="mt-3 text-xs text-slate-500">سيُحسب المحمَّل من أوامر الإنتاج التي حُمّلت عليها تكاليف في هذه الفترة، ويُعرض القيد بعد الترحيل.</p>}
            <Err e={err} />
          </Modal>
        );
      })()}
    </div>
  );
}

/* ═════════════════════════ التطوير العقاري ═════════════════════════ */

const UNIT_STATUS = { available: ['متاحة', 'green'], reserved: ['محجوزة', 'amber'], contracted: ['متعاقد', 'blue'], delivered: ['مُسلَّمة', 'slate'] };
const CHQ_STATUS = { pending: ['تحت التحصيل', 'amber'], processing: ['جارٍ التنفيذ', 'slate'], collected: ['محصّل', 'green'], bounced: ['مرتد', 'red'] };
const INST_STATUS = { due: ['مستحق', 'blue'], overdue: ['متأخر', 'red'], paid: ['مسدد', 'green'], cancelled: ['ملغى', 'slate'] };
const FREQ = [['monthly', 'شهري'], ['quarterly', 'ربع سنوي'], ['semiannual', 'نصف سنوي'], ['annual', 'سنوي']];
const FREQ_M = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
// the same split the server makes: equal instalments, the last absorbs rounding
const splitPlan = (total, count, freq, start) => {
  const n = parseInt(count, 10) || 0;
  if (!(total > 0) || n < 1 || !start) return [];
  const base = r2(total / n);
  const d0 = new Date(`${start}T00:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(d0); d.setMonth(d.getMonth() + FREQ_M[freq] * i);
    return { seq: i + 1, due_date: d.toISOString().slice(0, 10), amount: i < n - 1 ? base : r2(total - base * (n - 1)) };
  });
};
const InstBadge = ({ r }) => (
  <span className="inline-flex items-center gap-1"><Badge tone={(INST_STATUS[r.status] || [])[1]}>{(INST_STATUS[r.status] || [r.status])[0]}</Badge>
    {r.is_partial && r.status !== 'paid' && <Badge tone="amber">جزئي</Badge>}</span>
);

export function RealEstatePage() {
  const [tab, setTab] = useState('projects');
  // the company's own choice (Settings → Company policies): tax on/off and its rate
  const [reTax, setReTax] = useState({ disposal_tax_enabled: false, disposal_tax_rate: 0.025 });
  useEffect(() => {
    axios.get(`${API}/api/company-policies`, auth()).then((r) => r.data?.policies?.real_estate && setReTax(r.data.policies.real_estate)).catch(() => {});
  }, []);
  const [projects, setProjects] = useState(null);
  const [project, setProject] = useState(null);
  const [units, setUnits] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [cheques, setCheques] = useState(null);
  const [insts, setInsts] = useState(null);
  const [instFilter, setInstFilter] = useState('overdue');
  const [report, setReport] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const loadProjects = async () => {
    try { const { data } = await axios.get(`${API}/api/real-estate/projects`, auth()); setProjects(data.projects || []); }
    catch (e) { setProjects([]); setErr(errText(e, 'تعذّر تحميل المشاريع')); }
  };
  const loadUnits = async (p) => {
    setUnits(null);
    try { const { data } = await axios.get(`${API}/api/real-estate/projects/${p.id}/units`, auth()); setUnits(data); }
    catch (e) { setUnits({ units: [], summary: {} }); }
  };
  const loadBookings = async () => {
    try { const { data } = await axios.get(`${API}/api/real-estate/bookings`, { ...auth(), params: { limit: 200 } }); setBookings(data.bookings || []); }
    catch (e) { setBookings([]); }
  };
  const loadCheques = async () => {
    try { const { data } = await axios.get(`${API}/api/real-estate/installments/cheques`, auth()); setCheques(data); }
    catch (e) { setCheques({ cheques: [] }); }
  };
  const loadReport = async (year) => {
    try { const { data } = await axios.get(`${API}/api/real-estate/reports/revenue-recognition`, { ...auth(), params: year ? { year } : {} }); setReport(data); }
    catch (e) { setReport({ bookings: [] }); }
  };
  useEffect(() => {
    loadProjects(); loadBookings(); loadCheques(); loadReport(new Date().getFullYear());
    axios.get(`${API}/api/invoice/parties`, { ...auth(), params: { party_type: 'customer' } }).then((r) => setCustomers(r.data?.parties || [])).catch(() => {});
    getBanks().then(setBanks);
  }, []);

  const loadInsts = async (status) => {
    try { const { data } = await axios.get(`${API}/api/real-estate/installments`, { ...auth(), params: { status } }); setInsts(data); }
    catch (e) { setInsts({ installments: [], totals: {} }); setErr(errText(e, 'تعذّر تحميل الأقساط')); }
  };
  const refreshAll = async () => {
    await loadProjects(); await loadBookings(); await loadCheques(); if (project) await loadUnits(project);
    if (insts) await loadInsts(instFilter);
  };
  const changeTab = (t) => { setTab(t); if (t === 'installments') loadInsts(instFilter); };
  const openSchedule = async (b) => {
    setErr('');
    try {
      const { data } = await axios.get(`${API}/api/real-estate/bookings/${b.id}/schedule`, auth());
      setForm({ kind: 'schedule', booking: b, data, mode: data.installments.length ? 'view' : 'gen',
        plan: { count: '12', frequency: 'monthly', start_date: today(), down_payment: '' },
        pay: { amount: '', penalty_amount: '', method: 'bank', bank_account: banks[0]?.account_code || '162', date: today() } });
    } catch (e) { setErr(errText(e, 'تعذّر تحميل جدول الأقساط')); }
  };
  // actions inside the schedule window keep it open and reload it
  const runSched = async (fn, mode = 'view') => {
    setBusy(true); setErr('');
    try {
      await fn();
      const { data } = await axios.get(`${API}/api/real-estate/bookings/${form.booking.id}/schedule`, auth());
      setForm((f) => ({ ...f, data, mode }));
      await refreshAll();
    } catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };
  const applyPenalty = (id) => axios.post(`${API}/api/real-estate/installments/${id}/penalty`, {}, auth());
  const openPolicy = async () => {
    setErr('');
    try {
      const { data } = await axios.get(`${API}/api/real-estate/policy`, auth());
      setForm({ kind: 'policy', ...data.policy });
    } catch (e) { setErr(errText(e, 'تعذّر تحميل السياسة')); }
  };
  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); setForm(null); await refreshAll(); }
    catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };
  const payLabel = (m) => ({ credit: '251 الموردون / مقاولو الباطن', bank: '162 البنك', cash: '161 الخزينة', cheque: '162 البنك' }[m]);
  const openDeliver = async (b) => {
    setErr('');
    try {
      const { data } = await axios.get(`${API}/api/real-estate/bookings/${b.id}/delivery-preview`, auth());
      setForm({ kind: 'deliver', booking: b, preview: data, unit_cost: String(data.suggested), date: today(), apply_re_tax: !!reTax.disposal_tax_enabled });
    } catch (e) { setErr(errText(e, 'تعذّر تحميل بيانات التسليم')); }
  };
  const bookingOpenCheques = (b) => r2(b.contract_price - (b.paid_so_far || 0) - (b.cheques_in_hand || 0));

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <Header title="التطوير العقاري" sub="المعيار المصري 48: المقدم والشيكات قبل التسليم التزام عقد (2431)، والإيراد 4111 يُثبَّت بالكامل عند تسليم الوحدة.">
        {tab === 'installments' && <button onClick={openPolicy} className={btnGhost}>سياسة الغرامات والتنبيهات</button>}
        {tab === 'projects' && <AddBtn onClick={() => { setErr(''); setForm({ kind: 'project', name: '', location: '', total_units: '', total_area_sqm: '', initial_cost: '', payment_method: 'credit', date: today(), expected_delivery: '' }); }}>مشروع جديد</AddBtn>}
      </Header>
      <Tabs tabs={[['projects', 'المشاريع والوحدات'], ['bookings', 'الحجوزات والتسليم'], ['installments', 'الأقساط والمتأخرات'], ['cheques', 'شيكات الأقساط'], ['report', 'تقرير الإيراد']]} value={tab} onChange={changeTab} />

      {tab === 'projects' && (projects === null ? <Spinner /> : (<>
        {projects.length === 0 ? <p className="text-center py-12 text-sm text-slate-500">لا توجد مشاريع بعد.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <div key={p.id} className={`rounded-xl border p-4 ${project?.id === p.id ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}>
                <p className="font-extrabold">{p.name}</p><p className="text-xs text-slate-500">{p.location || '—'}</p>
                <p className="mt-2 text-sm">تكلفة متراكمة (142): <N v={p.accumulated_cost} /></p>
                <p className="text-sm">المُحمَّل على وحدات مباعة: <N v={p.cost_relieved} /></p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { setProject(p); loadUnits(p); }} className={btnSmall}>الوحدات</button>
                  <button onClick={() => { setErr(''); setForm({ kind: 'cost', project: p, amount: '', cost_type: 'construction', payment_method: 'credit', date: today(), description: '' }); }} className={btnSmall}>إضافة تكلفة</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {project && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-extrabold">وحدات {project.name}</h2>
              <button onClick={() => { setErr(''); setForm({ kind: 'unit', unit_number: '', unit_type: 'apartment', floor: '', area_sqm: '', sale_price: '' }); }} className={btnSmall}>+ وحدة</button>
            </div>
            {units === null ? <Spinner /> : (
              <Table head={['الوحدة', 'النوع', '#الدور', '#المساحة م²', '#سعر البيع', 'العميل', 'الحالة', '']} empty={units.units.length === 0 && 'لا توجد وحدات.'}>
                {units.units.map((u) => (
                  <tr key={u.id}><td className="px-3 py-2 font-semibold"><bdi dir="ltr">{u.unit_number}</bdi></td><td className="px-3 py-2">{u.unit_type}</td>
                    <td className="px-3 py-2 text-end"><bdi dir="ltr">{u.floor}</bdi></td><td className="px-3 py-2 text-end"><Q v={u.area_sqm} /></td>
                    <td className="px-3 py-2 text-end"><N v={u.contract_price || u.sale_price} /></td><td className="px-3 py-2">{u.customer_name || '—'}</td>
                    <td className="px-3 py-2"><Badge tone={(UNIT_STATUS[u.status] || [])[1]}>{(UNIT_STATUS[u.status] || [u.status])[0]}</Badge></td>
                    <td className="px-3 py-2 text-end">{u.status === 'available' && <button onClick={() => { setErr(''); setForm({ kind: 'book', unit: u, customer_id: '', customer_name: '', booking_date: today(), deposit_amount: '', contract_price: String(u.sale_price || ''), payment_method: 'bank' }); }} className={btnSmall}>حجز</button>}</td></tr>
                ))}
              </Table>
            )}
          </div>
        )}
      </>))}

      {tab === 'bookings' && (bookings === null ? <Spinner /> : (
        <Table head={['العميل', 'الوحدة', '#سعر العقد', '#محصّل', '#شيكات بالخزينة', 'الحالة', '']} empty={bookings.length === 0 && 'لا توجد حجوزات.'}>
          {bookings.map((b) => (
            <tr key={b.id}><td className="px-3 py-2 font-semibold">{b.customer_name}</td><td className="px-3 py-2">{b.project_name} — <bdi dir="ltr">{b.unit_number}</bdi></td>
              <td className="px-3 py-2 text-end"><N v={b.contract_price} /></td><td className="px-3 py-2 text-end"><N v={b.paid_so_far} /></td>
              <td className="px-3 py-2 text-end"><N v={b.cheques_in_hand} /></td>
              <td className="px-3 py-2">{b.status === 'delivered' ? <Badge>مُسلَّمة</Badge> : <Badge tone="amber">محجوزة</Badge>}</td>
              <td className="px-3 py-2 text-end whitespace-nowrap">
                {bookingOpenCheques(b) > 0 && <button onClick={() => { setErr(''); setForm({ kind: 'cheques', booking: b, receive_date: today(), rows: [{ cheque_number: '', amount: '', due_date: '', bank_name: '' }] }); }} className={btnSmall}>استلام شيكات</button>}{' '}
                <button onClick={() => openSchedule(b)} className={btnSmall}>جدول الأقساط</button>{' '}
                {b.status === 'booked' && <button onClick={() => openDeliver(b)} className={btnSmall}>تسليم</button>}</td></tr>
          ))}
        </Table>
      ))}

      {tab === 'installments' && (insts === null ? <Spinner /> : (<>
        <div className="flex flex-wrap items-end gap-2">
          <Tabs tabs={[['overdue', 'متأخرة'], ['due_soon', 'تستحق قريباً'], ['open', 'كل المفتوحة'], ['paid', 'مسددة']]} value={instFilter}
            onChange={(v) => { setInstFilter(v); setInsts(null); loadInsts(v); }} />
          <button onClick={() => loadInsts(instFilter)} aria-label="تحديث" className="p-2 rounded-lg border border-slate-300 dark:border-slate-600"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="عدد الأقساط" v={insts.totals?.count} money={false} /><Stat label="الإجمالي" v={insts.totals?.amount} />
          <Stat label="غير المسدد" v={insts.totals?.outstanding} /><Stat label="غرامات مستحقة" v={insts.totals?.penalties_outstanding} />
        </div>
        {instFilter === 'due_soon' && <p className="text-xs text-slate-500">المستحق خلال {insts.policy?.due_soon_days ?? 7} أيام — يُرسل تنبيه يومي للمديرين بالمتأخر والمستحق قريباً.</p>}
        <Table head={['العميل', 'الوحدة', '#القسط', 'الاستحقاق', '#المبلغ', '#غير المسدد', '#أيام التأخير', '#الغرامات', 'الحالة', '']} empty={(insts.installments || []).length === 0 && 'لا توجد أقساط في هذا التصنيف.'}>
          {insts.installments.map((r) => (
            <tr key={r.id} className={r.status === 'overdue' ? 'bg-red-50/60 dark:bg-red-950/20' : ''}>
              <td className="px-3 py-2 font-semibold">{r.customer_name}</td><td className="px-3 py-2">{r.project_name} — <bdi dir="ltr">{r.unit_number}</bdi></td>
              <td className="px-3 py-2 text-end"><bdi dir="ltr">{r.seq}</bdi></td><td className="px-3 py-2"><bdi dir="ltr">{r.due_date}</bdi></td>
              <td className="px-3 py-2 text-end"><N v={r.amount} /></td><td className="px-3 py-2 text-end"><N v={r.outstanding} /></td>
              <td className="px-3 py-2 text-end"><bdi dir="ltr">{r.days_late || '—'}</bdi></td><td className="px-3 py-2 text-end"><N v={r.penalty_amount} /></td>
              <td className="px-3 py-2"><InstBadge r={r} /></td>
              <td className="px-3 py-2 text-end">{r.status === 'overdue' && <button disabled={busy} onClick={() => run(() => applyPenalty(r.id))} className={btnSmall}>احتساب غرامة</button>}</td></tr>
          ))}
        </Table>
      </>))}

      {tab === 'cheques' && (cheques === null ? <Spinner /> : (<>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><Stat label="شيكات تحت التحصيل" v={cheques.pending_total} /></div>
        <Table head={['الشيك', 'العميل', 'الوحدة', 'الاستحقاق', '#المبلغ', 'الحالة', '']} empty={(cheques.cheques || []).length === 0 && 'لا توجد شيكات.'}>
          {cheques.cheques.map((c) => {
            const due = c.status === 'pending' && c.due_date && c.due_date <= today();
            return (
              <tr key={c.id}><td className="px-3 py-2"><bdi dir="ltr">{c.cheque_number}</bdi>{c.bank_name && <span className="block text-xs text-slate-500">{c.bank_name}</span>}</td>
                <td className="px-3 py-2">{c.customer_name}</td><td className="px-3 py-2"><bdi dir="ltr">{c.unit_number}</bdi></td>
                <td className={`px-3 py-2 ${due ? 'text-amber-700 font-bold' : ''}`}><bdi dir="ltr">{c.due_date}</bdi></td>
                <td className="px-3 py-2 text-end"><N v={c.amount} /></td>
                <td className="px-3 py-2"><Badge tone={(CHQ_STATUS[c.status] || [])[1]}>{(CHQ_STATUS[c.status] || [c.status])[0]}</Badge></td>
                <td className="px-3 py-2 text-end whitespace-nowrap">{c.status === 'pending' && <>
                  <button onClick={() => { setErr(''); setForm({ kind: 'collect', cheque: c, date: today(), bank_account: banks[0]?.account_code || '162' }); }} className={btnSmall}>تحصيل</button>{' '}
                  <button onClick={() => { setErr(''); setForm({ kind: 'bounce', cheque: c, date: today() }); }} className={btnSmall}>ارتداد</button></>}</td></tr>
            );
          })}
        </Table>
      </>))}

      {tab === 'report' && (report === null ? <Spinner /> : (<>
        <div className="flex flex-wrap items-end gap-2">
          <Label t="السنة"><input type="number" dir="ltr" defaultValue={new Date().getFullYear()} onBlur={(e) => loadReport(+e.target.value || null)} className={`${input} w-28`} /></Label>
          <button onClick={() => loadReport(null)} className={btnGhost}>كل السنوات</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="وحدات مُسلَّمة" v={report.units_delivered} money={false} /><Stat label="الإيراد المعترف به" v={report.total_revenue} />
          <Stat label="تكلفة الوحدات" v={report.total_cost} /><Stat label="مجمل الربح" v={report.gross_margin} />
        </div>
        <Table head={['العميل', 'الوحدة', 'تاريخ التسليم', '#الإيراد', '#التكلفة']} empty={(report.bookings || []).length === 0 && 'لا توجد تسليمات في الفترة.'}>
          {(report.bookings || []).map((b) => <tr key={b.id}><td className="px-3 py-2">{b.customer_name}</td><td className="px-3 py-2"><bdi dir="ltr">{b.unit_number}</bdi></td>
            <td className="px-3 py-2"><bdi dir="ltr">{b.delivery_date}</bdi></td><td className="px-3 py-2 text-end"><N v={b.contract_price} /></td><td className="px-3 py-2 text-end"><N v={b.unit_cost} /></td></tr>)}
        </Table>
      </>))}
      {err && !form && <Err e={err} />}

      {form?.kind === 'project' && (
        <Modal title="مشروع عقاري جديد" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/real-estate/projects`, { name: form.name.trim(), location: form.location, total_units: +form.total_units || 0,
            total_area_sqm: +form.total_area_sqm || 0, initial_cost: +form.initial_cost || 0, payment_method: form.payment_method, date: form.date, expected_delivery: form.expected_delivery }, auth()))}
            disabled={busy || !form.name.trim()} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="اسم المشروع *"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} /></Label>
            <Label t="الموقع"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={input} /></Label>
            <Label t="عدد الوحدات"><Num value={form.total_units} onChange={(v) => setForm({ ...form, total_units: v })} step="1" /></Label>
            <Label t="إجمالي المساحة م²"><Num value={form.total_area_sqm} onChange={(v) => setForm({ ...form, total_area_sqm: v })} /></Label>
            <Label t="تكلفة أولية (أرض / تراخيص)"><Num value={form.initial_cost} onChange={(v) => setForm({ ...form, initial_cost: v })} /></Label>
            <Label t="طريقة السداد">
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={input}>
                <option value="credit">آجل — الموردون</option><option value="bank">البنك</option><option value="cash">الخزينة</option></select></Label>
            <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
            <Label t="التسليم المتوقع"><input type="date" value={form.expected_delivery} onChange={(e) => setForm({ ...form, expected_delivery: e.target.value })} className={input} /></Label>
          </div>
          {+form.initial_cost > 0 && <div className="mt-4"><Lines rows={[['142 مشروعات عقارية تحت التنفيذ', r2(form.initial_cost), 0], [payLabel(form.payment_method), 0, r2(form.initial_cost)]]} /></div>}
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'cost' && (
        <Modal title={`إضافة تكلفة — ${form.project.name}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/real-estate/projects/${form.project.id}/add-cost`, { amount: +form.amount, cost_type: form.cost_type,
            payment_method: form.payment_method, date: form.date, description: form.description || null }, auth()))} disabled={busy || !(+form.amount > 0)} className={btnPrimary}>{busy ? '…' : 'حفظ وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="المبلغ *"><Num value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></Label>
            <Label t="النوع">
              <select value={form.cost_type} onChange={(e) => setForm({ ...form, cost_type: e.target.value })} className={input}>
                {[['land', 'أرض'], ['construction', 'إنشاءات'], ['finishing', 'تشطيبات'], ['infra', 'مرافق وبنية تحتية'], ['design', 'تصميم واستشارات'], ['other', 'أخرى']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Label>
            <Label t="طريقة السداد">
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={input}>
                <option value="credit">آجل — مقاول / مورد</option><option value="bank">البنك</option><option value="cash">الخزينة</option></select></Label>
            <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
            <Label t="البيان" className="sm:col-span-2"><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} /></Label>
          </div>
          {+form.amount > 0 && <div className="mt-4"><Lines rows={[['142 مشروعات عقارية تحت التنفيذ', r2(form.amount), 0], [payLabel(form.payment_method), 0, r2(form.amount)]]} /></div>}
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'unit' && (
        <Modal title={`وحدة جديدة — ${project?.name}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/real-estate/projects/${project.id}/units`, { unit_number: form.unit_number.trim(), unit_type: form.unit_type,
            floor: parseInt(form.floor, 10) || 0, area_sqm: +form.area_sqm || 0, sale_price: +form.sale_price || 0 }, auth()))} disabled={busy || !form.unit_number.trim()} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="رقم الوحدة *"><input dir="ltr" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} className={input} /></Label>
            <Label t="النوع">
              <select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} className={input}>
                {[['apartment', 'شقة'], ['villa', 'فيلا'], ['shop', 'محل'], ['office', 'مكتب'], ['land', 'قطعة أرض']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Label>
            <Label t="الدور"><Num value={form.floor} onChange={(v) => setForm({ ...form, floor: v })} step="1" /></Label>
            <Label t="المساحة م² (تُستخدم لتوزيع التكلفة)"><Num value={form.area_sqm} onChange={(v) => setForm({ ...form, area_sqm: v })} /></Label>
            <Label t="سعر البيع"><Num value={form.sale_price} onChange={(v) => setForm({ ...form, sale_price: v })} /></Label>
          </div>
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'book' && (
        <Modal title={`حجز الوحدة ${form.unit.unit_number}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/real-estate/bookings`, { unit_id: form.unit.id, customer_id: form.customer_id, customer_name: form.customer_name.trim(),
            booking_date: form.booking_date, deposit_amount: +form.deposit_amount, contract_price: +form.contract_price, payment_method: form.payment_method }, auth()))}
            disabled={busy || !form.customer_name.trim() || !(+form.deposit_amount > 0) || !(+form.contract_price > 0) || +form.deposit_amount > +form.contract_price} className={btnPrimary}>{busy ? '…' : 'حجز وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="العميل *" className="sm:col-span-2">
              <select value={form.customer_id} onChange={(e) => { const c = customers.find((x) => x.id === e.target.value); setForm({ ...form, customer_id: e.target.value, customer_name: c?.name || form.customer_name }); }} className={input}>
                <option value="">— من الدليل أو اكتب الاسم —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="الاسم" className={input} /></Label>
            <Label t="سعر العقد *"><Num value={form.contract_price} onChange={(v) => setForm({ ...form, contract_price: v })} /></Label>
            <Label t="المقدم المحصّل *"><Num value={form.deposit_amount} onChange={(v) => setForm({ ...form, deposit_amount: v })} /></Label>
            <Label t="طريقة التحصيل">
              <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={input}>
                <option value="bank">تحويل بنكي</option><option value="cash">نقدي</option></select></Label>
            <Label t="تاريخ الحجز"><input type="date" value={form.booking_date} onChange={(e) => setForm({ ...form, booking_date: e.target.value })} className={input} /></Label>
          </div>
          {+form.deposit_amount > 0 && <div className="mt-4"><Lines rows={[[payLabel(form.payment_method), r2(form.deposit_amount), 0], ['2431 التزامات العقود', 0, r2(form.deposit_amount)]]} note="لا إيراد عند الحجز — يُثبت عند التسليم (م.48)." /></div>}
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'cheques' && (() => {
        const total = r2(form.rows.reduce((t, r) => t + (+r.amount || 0), 0));
        const left = bookingOpenCheques(form.booking);
        const delivered = form.booking.status === 'delivered';
        const setR = (i, k, v) => setForm({ ...form, rows: form.rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
        return (
          <Modal wide title={`شيكات أقساط — ${form.booking.customer_name}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/real-estate/installments/receive-cheques`, { booking_id: form.booking.id, receive_date: form.receive_date,
              cheques: form.rows.filter((r) => +r.amount > 0).map((r) => ({ cheque_number: r.cheque_number.trim(), amount: +r.amount, due_date: r.due_date, bank_name: r.bank_name || null })) }, auth()))}
              disabled={busy || !(total > 0) || total > left + 0.01 || form.rows.some((r) => +r.amount > 0 && (!r.cheque_number.trim() || !r.due_date))} className={btnPrimary}>{busy ? '…' : 'استلام وترحيل'}</button></>}>
            <p className="mb-3">المتبقي من سعر العقد بلا شيكات: <N v={left} /></p>
            <Label t="تاريخ الاستلام"><input type="date" value={form.receive_date} onChange={(e) => setForm({ ...form, receive_date: e.target.value })} className={`${input} sm:w-48`} /></Label>
            <div className="mt-3 space-y-2">
              {form.rows.map((r, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[8rem_9rem_10rem_1fr_auto] gap-2 items-end">
                  <input dir="ltr" value={r.cheque_number} onChange={(e) => setR(i, 'cheque_number', e.target.value)} placeholder="رقم الشيك" className={input} />
                  <Num value={r.amount} onChange={(v) => setR(i, 'amount', v)} placeholder="المبلغ" />
                  <input type="date" value={r.due_date} onChange={(e) => setR(i, 'due_date', e.target.value)} className={input} />
                  <input value={r.bank_name} onChange={(e) => setR(i, 'bank_name', e.target.value)} placeholder="البنك المسحوب عليه" className={input} />
                  <DelBtn onClick={() => setForm({ ...form, rows: form.rows.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, rows: [...form.rows, { cheque_number: '', amount: '', due_date: '', bank_name: '' }] })} className={btnSmall}>+ شيك</button>
            </div>
            {total > left + 0.01 && <p className="mt-2 text-red-700 text-sm">إجمالي الشيكات أكبر من المتبقي.</p>}
            {total > 0 && <div className="mt-4"><Lines rows={[['144/163 شيكات برسم التحصيل', total, 0], [delivered ? '1312 عملاء أقساط مؤجلة' : '2431 التزامات العقود', 0, total]]}
              note="144 إن كانت باقة التطوير العقاري مفعّلة، وإلا 163." /></div>}
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'collect' && (
        <Modal title={`تحصيل الشيك ${form.cheque.cheque_number}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/real-estate/installments/${form.cheque.id}/collect`, { date: form.date, bank_account: form.bank_account }, auth()))} disabled={busy} className={btnPrimary}>{busy ? '…' : 'تحصيل وترحيل'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="تاريخ التحصيل"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
            <Label t="البنك"><BankSelect banks={banks} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} /></Label>
          </div>
          <div className="mt-4"><Lines rows={[[`${form.bank_account} البنك`, form.cheque.amount, 0], [`${form.cheque.account_code || '163'} شيكات برسم التحصيل`, 0, form.cheque.amount]]} /></div>
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'bounce' && (
        <Modal title={`ارتداد الشيك ${form.cheque.cheque_number}`} onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.post(`${API}/api/real-estate/installments/${form.cheque.id}/bounce`, { date: form.date }, auth()))} disabled={busy} className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50">{busy ? '…' : 'تسجيل الارتداد'}</button></>}>
          <Label t="التاريخ"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${input} sm:w-48`} /></Label>
          <div className="mt-4"><Lines rows={[[form.cheque.received_after_delivery ? '1311 شيكات مرتدة' : '2431 التزامات العقود (أو 1311 إن سُلّمت الوحدة)', form.cheque.amount, 0],
            [`${form.cheque.account_code || '163'} شيكات برسم التحصيل`, 0, form.cheque.amount]]} /></div>
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'policy' && (
        <Modal title="سياسة غرامات التأخير وتنبيهات الأقساط" onClose={() => setForm(null)} footer={<>
          <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
          <button onClick={() => run(() => axios.put(`${API}/api/real-estate/policy`, { penalty_rate_monthly_pct: +form.penalty_rate_monthly_pct || 0,
            grace_days: parseInt(form.grace_days, 10) || 0, penalty_account: form.penalty_account, due_soon_days: parseInt(form.due_soon_days, 10) || 7 }, auth()))}
            disabled={busy || +form.penalty_rate_monthly_pct > 10} className={btnPrimary}>{busy ? '…' : 'حفظ'}</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Label t="نسبة الغرامة الشهرية % (0 = بدون غرامات)"><Num value={form.penalty_rate_monthly_pct} onChange={(v) => setForm({ ...form, penalty_rate_monthly_pct: v })} max="10" /></Label>
            <Label t="فترة السماح (أيام)"><Num value={form.grace_days} onChange={(v) => setForm({ ...form, grace_days: v })} step="1" /></Label>
            <Label t="حساب إيراد الغرامات">
              <select value={form.penalty_account} onChange={(e) => setForm({ ...form, penalty_account: e.target.value })} className={input}>
                <option value="423">423 إيرادات متنوعة أخرى</option><option value="421">421 أرباح رأسمالية</option></select></Label>
            <Label t="التنبيه بالأقساط المستحقة خلال (أيام)"><Num value={form.due_soon_days} onChange={(v) => setForm({ ...form, due_soon_days: v })} step="1" /></Label>
          </div>
          <p className="mt-3 text-xs text-slate-500">الغرامة = المتأخر × النسبة × أشهر التأخير بعد فترة السماح، تُقيد Dr 1312 / Cr حساب الإيراد، ولا تُحتسب مرتين لنفس الشهر.</p>
          <Err e={err} />
        </Modal>
      )}

      {form?.kind === 'schedule' && (() => {
        const b = form.booking; const d = form.data; const rows = d.installments || []; const t = d.totals || {};
        const setPlan = (k, v) => setForm({ ...form, plan: { ...form.plan, [k]: v } });
        const setPay = (k, v) => setForm({ ...form, pay: { ...form.pay, [k]: v } });
        const received = form.plan.down_payment === '' ? (d.paid_so_far || 0) : +form.plan.down_payment;
        const planTotal = form.mode === 'resched' ? t.outstanding : r2((d.contract_price || 0) - received);
        const plan = splitPlan(planTotal, form.plan.count, form.plan.frequency, form.plan.start_date);
        const planBody = () => ({ count: parseInt(form.plan.count, 10), frequency: form.plan.frequency, start_date: form.plan.start_date,
          down_payment: form.mode === 'gen' && form.plan.down_payment !== '' ? +form.plan.down_payment : null });
        return (
          <Modal wide title={`جدول أقساط — ${b.customer_name} — ${b.unit_number}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إغلاق</button>
            {form.mode === 'gen' && <button disabled={busy || !plan.length} onClick={() => runSched(() => axios.post(`${API}/api/real-estate/bookings/${b.id}/schedule`, planBody(), auth()))} className={btnPrimary}>{busy ? '…' : 'توليد الجدول'}</button>}
            {form.mode === 'resched' && <button disabled={busy || !plan.length} onClick={() => runSched(() => axios.post(`${API}/api/real-estate/bookings/${b.id}/reschedule`, planBody(), auth()))} className={btnPrimary}>{busy ? '…' : 'إعادة الجدولة'}</button>}
            {form.mode === 'pay' && <button disabled={busy || !(+form.pay.amount > 0 || +form.pay.penalty_amount > 0)} onClick={() => runSched(() => axios.post(`${API}/api/real-estate/bookings/${b.id}/payments`, {
              amount: +form.pay.amount || 0, penalty_amount: +form.pay.penalty_amount || 0, method: form.pay.method, bank_account: form.pay.method === 'bank' ? form.pay.bank_account : null, date: form.pay.date }, auth()))} className={btnPrimary}>{busy ? '…' : 'تسجيل وترحيل'}</button>}
          </>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="سعر العقد" v={d.contract_price} /><Stat label="المحصّل نقداً" v={d.paid_so_far} />
              <Stat label="غير المسدد من الجدول" v={t.outstanding} /><Stat label="متأخر" v={t.overdue} />
            </div>
            {rows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Tabs tabs={[['view', 'الجدول'], ['pay', 'تسجيل سداد'], ['resched', 'إعادة جدولة']]} value={form.mode} onChange={(m) => { setErr(''); setForm({ ...form, mode: m }); }} />
              </div>
            )}
            {(form.mode === 'gen' || form.mode === 'resched') && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <Label t="عدد الأقساط *"><Num value={form.plan.count} onChange={(v) => setPlan('count', v)} step="1" /></Label>
                  <Label t="الدورية"><select value={form.plan.frequency} onChange={(e) => setPlan('frequency', e.target.value)} className={input}>
                    {FREQ.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Label>
                  <Label t="تاريخ أول قسط"><input type="date" value={form.plan.start_date} onChange={(e) => setPlan('start_date', e.target.value)} className={input} /></Label>
                  {form.mode === 'gen' && <Label t="المقدم المدفوع (فارغ = المحصّل المسجل)"><Num value={form.plan.down_payment} onChange={(v) => setPlan('down_payment', v)} /></Label>}
                </div>
                <p>{form.mode === 'resched' ? 'المتبقي غير المسدد الذي سيُعاد تقسيطه' : 'المبلغ المقسط = سعر العقد − ما حُصّل'}: <N v={planTotal} />
                  {form.mode === 'resched' && <span className="block text-xs text-slate-500">تُلغى الأقساط غير المسددة، والمسدد جزئياً يُقفل بما سُدد منه، والمسدد يبقى كما هو.</span>}
                  {form.mode === 'gen' && (d.cheques_in_hand || 0) > 0 && <span className="block text-xs text-slate-500">الشيكات تحت التحصيل (<N v={d.cheques_in_hand} />) تُخصم من الأقساط عند تحصيلها.</span>}</p>
                {plan.length > 0 && (
                  <Table head={['#القسط', 'الاستحقاق', '#المبلغ']}>
                    {plan.slice(0, 60).map((r) => <tr key={r.seq}><td className="px-3 py-1.5 text-end"><bdi dir="ltr">{r.seq}</bdi></td><td className="px-3 py-1.5"><bdi dir="ltr">{r.due_date}</bdi></td><td className="px-3 py-1.5 text-end"><N v={r.amount} /></td></tr>)}
                  </Table>
                )}
              </div>
            )}
            {form.mode === 'pay' && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Label t="مبلغ الأقساط (يُوزّع على الأقدم فالأحدث)"><Num value={form.pay.amount} onChange={(v) => setPay('amount', v)} /></Label>
                <Label t={`سداد غرامات (المستحق ${money(t.penalties_outstanding)})`}><Num value={form.pay.penalty_amount} onChange={(v) => setPay('penalty_amount', v)} /></Label>
                <Label t="طريقة السداد"><select value={form.pay.method} onChange={(e) => setPay('method', e.target.value)} className={input}>
                  <option value="bank">تحويل بنكي</option><option value="cash">نقدي</option></select></Label>
                {form.pay.method === 'bank' ? <Label t="البنك"><BankSelect banks={banks} value={form.pay.bank_account} onChange={(v) => setPay('bank_account', v)} /></Label> : <span />}
                <Label t="التاريخ"><input type="date" value={form.pay.date} onChange={(e) => setPay('date', e.target.value)} className={input} /></Label>
                <div className="sm:col-span-2"><Lines rows={[[form.pay.method === 'bank' ? `${form.pay.bank_account} البنك` : '161 الخزينة', r2((+form.pay.amount || 0) + (+form.pay.penalty_amount || 0)), 0],
                  [b.status === 'delivered' ? '1312 عملاء أقساط مؤجلة' : '2431 التزامات العقود', 0, r2(form.pay.amount)], ['1312 غرامات تأخير', 0, r2(form.pay.penalty_amount)]]} /></div>
              </div>
            )}
            {form.mode === 'view' && rows.length > 0 && (
              <div className="mt-4">
                <Table head={['#القسط', 'الاستحقاق', '#المبلغ', '#المسدد', '#الغرامات', 'الحالة', '']}>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === 'overdue' ? 'bg-red-50/60 dark:bg-red-950/20' : r.status === 'paid' ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''}>
                      <td className="px-3 py-1.5 text-end"><bdi dir="ltr">{r.seq}</bdi></td><td className="px-3 py-1.5"><bdi dir="ltr">{r.due_date}</bdi></td>
                      <td className="px-3 py-1.5 text-end"><N v={r.amount} /></td><td className="px-3 py-1.5 text-end"><N v={r.paid_amount} /></td>
                      <td className="px-3 py-1.5 text-end"><N v={r.penalty_amount} /></td><td className="px-3 py-1.5"><InstBadge r={r} /></td>
                      <td className="px-3 py-1.5 text-end">{r.status === 'overdue' && <button disabled={busy} onClick={() => runSched(() => applyPenalty(r.id))} className={btnSmall}>احتساب غرامة</button>}</td></tr>
                  ))}
                </Table>
              </div>
            )}
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'deliver' && (() => {
        const p = form.preview; const cost = r2(form.unit_cost); const tax = form.apply_re_tax ? r2(p.contract_price * (reTax.disposal_tax_rate || 0.025)) : 0;
        return (
          <Modal title={`تسليم الوحدة ${form.booking.unit_number} — ${form.booking.customer_name}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/real-estate/bookings/${form.booking.id}/deliver`, { date: form.date, unit_cost: form.unit_cost === '' ? null : cost, apply_re_tax: form.apply_re_tax }, auth()))}
              disabled={busy || cost > p.remaining_wip + 0.01} className={btnPrimary}>{busy ? '…' : 'تسليم والاعتراف بالإيراد'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label t="تاريخ التسليم (نقل السيطرة)"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></Label>
              <Label t={`تكلفة الوحدة (مقترحة ${p.basis === 'area' ? 'بالمساحة' : 'بعدد الوحدات'})`}><Num value={form.unit_cost} onChange={(v) => setForm({ ...form, unit_cost: v })} /></Label>
            </div>
            <p className="mt-2 text-xs text-slate-500">المتبقي في تكاليف المشروع (142): <N v={p.remaining_wip} /></p>
            <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" checked={form.apply_re_tax} onChange={(e) => setForm({ ...form, apply_re_tax: e.target.checked })} className="mt-1" />
              <span>ضريبة التصرفات العقارية {(reTax.disposal_tax_rate * 100).toLocaleString('en-US')}% — الافتراضي من سياسات الشركة ({reTax.disposal_tax_enabled ? 'مفعّلة' : 'غير مفعّلة'})، ويمكن تغييره لهذه الوحدة.</span></label>
            <div className="mt-4 space-y-2">
              <Lines rows={[[`${p.liability_account} التزامات العقود (ما حُصّل وما استُلم من شيكات)`, p.liability_balance, 0], ['1312 عملاء أقساط مؤجلة', p.receivable, 0],
                ['4111 إيرادات بيع الوحدات العقارية', 0, p.contract_price], ['3351 مصروف ضريبة التصرفات', tax, 0], ['2541 ضريبة التصرفات المستحقة', 0, tax]]} />
              {cost > 0 && <Lines rows={[['3211 تكلفة الوحدات المباعة', cost, 0], ['142 مشروعات عقارية تحت التنفيذ', 0, cost]]} />}
            </div>
            {cost > p.remaining_wip + 0.01 && <p className="mt-2 text-red-700 text-sm">التكلفة أكبر من المتبقي في تكاليف المشروع.</p>}
            <Err e={err} />
          </Modal>
        );
      })()}
    </div>
  );
}

/* ═════════════════════════ الاعتمادات المستندية ═════════════════════════ */

const LC_STATUS = { open: ['مفتوح', 'blue'], in_transit: ['مفتوح', 'blue'], paid: ['مستندات مسددة', 'amber'], received: ['بضاعة مستلمة', 'green'], closed: ['مُغلق', 'slate'], cancelled: ['ملغى', 'red'] };
const LC_COSTS = { freight: 'شحن دولي', insurance: 'تأمين بحري', customs: 'رسوم جمركية', clearance: 'تخليص وميناء', bank: 'مصروفات بنكية', other: 'أخرى' };

export function LettersOfCreditPage() {
  const [data, setData] = useState(null);
  const [banks, setBanks] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try { const { data: d } = await axios.get(`${API}/api/lc/`, auth()); setData(d); }
    catch (e) { setData({ letters: [], by_status: {} }); setErr(errText(e, 'تعذّر تحميل الاعتمادات')); }
  };
  useEffect(() => { load(); getBanks().then(setBanks); getProducts().then(setProducts); getWarehouses().then(setWarehouses); }, []);
  const run = async (fn) => {
    setBusy(true); setErr('');
    try { await fn(); setForm(null); await load(); }
    catch (e) { setErr(errText(e, 'تعذّر الحفظ')); } finally { setBusy(false); }
  };
  const bank0 = banks[0]?.account_code || '162';
  const balanceOf = (l) => r2(l.in_transit_balance ?? l.accumulated_costs ?? 0);
  const marginLeft = (l) => r2((l.margin_amount || 0) - (l.margin_used || 0));
  const isOpen = (l) => ['open', 'in_transit'].includes(l.status);

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <Header title="الاعتمادات المستندية" sub="الغطاء 165، والبضاعة وتكاليف استيرادها تتجمع على 123 حتى الوصول، ثم تدخل المخزون بالتكلفة الشاملة. لا تسجّل فاتورة شراء لنفس البضاعة.">
        <AddBtn onClick={() => { setErr(''); setForm({ kind: 'open', lc_number: '', supplier_name: '', supplier_country: '', goods_description: '', lc_currency: 'USD', lc_amount_foreign: '', exchange_rate: '', margin_amount: '', bank_commission: '', open_date: today(), expiry_date: '', bank_account: bank0 }); }}>فتح اعتماد</AddBtn>
      </Header>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="قيمة الاعتمادات المفتوحة" v={data?.open_exposure_egp} /><Stat label="الغطاء المحتجز" v={data?.margin_held} />
        <Stat label="مستندات مسددة بالطريق" v={data?.by_status?.paid} money={false} /><Stat label="بضاعة مستلمة لم تُقفل" v={data?.by_status?.received} money={false} />
      </div>
      {data === null ? <Spinner /> : (
        <Table head={['الاعتماد', 'المورد', '#القيمة', '#الغطاء', '#على 123', 'الانتهاء', 'الحالة', '']} empty={data.letters.length === 0 && 'لا توجد اعتمادات.'}>
          {data.letters.map((l) => (
            <tr key={l.id}>
              <td className="px-3 py-2 font-semibold"><bdi dir="ltr">{l.lc_number}</bdi><span className="block text-xs text-slate-500">{l.goods_description}</span></td>
              <td className="px-3 py-2">{l.supplier_name}</td>
              <td className="px-3 py-2 text-end"><bdi dir="ltr">{money(l.lc_amount_foreign)} {l.lc_currency}</bdi><span className="block text-xs text-slate-500"><N v={l.lc_amount_egp} /></span></td>
              <td className="px-3 py-2 text-end"><N v={l.margin_amount} /></td><td className="px-3 py-2 text-end"><N v={balanceOf(l)} /></td>
              <td className="px-3 py-2"><bdi dir="ltr">{l.expiry_date}</bdi></td>
              <td className="px-3 py-2"><Badge tone={(LC_STATUS[l.status] || [])[1]}>{(LC_STATUS[l.status] || [l.status])[0]}</Badge></td>
              <td className="px-3 py-2 text-end whitespace-nowrap space-x-1 space-x-reverse">
                {(isOpen(l) || l.status === 'paid') && <button onClick={() => { setErr(''); setForm({ kind: 'costs', lc: l, date_str: today(), payment_src: 'bank', bank_account: l.bank_account || bank0, rows: [{ cost_type: 'freight', amount_egp: '', description: '' }] }); }} className={btnSmall}>تكاليف</button>}
                {isOpen(l) && <button onClick={() => { setErr(''); setForm({ kind: 'pay', lc: l, date_str: today(), exchange_rate: String(l.exchange_rate || ''), amount_foreign: String(l.lc_amount_foreign || ''), bank_account: l.bank_account || bank0 }); }} className={btnSmall}>سداد المستندات</button>}
                {l.status === 'paid' && <button onClick={() => { setErr(''); setForm({ kind: 'receive', lc: l, date_str: today(), goods_received: 'goods', warehouse_id: '', items: [{ product_id: '', quantity: '', foreign_value: '' }] }); }} className={btnSmall}>استلام البضاعة</button>}
                {(l.status === 'received' || isOpen(l)) && <button onClick={() => { setErr(''); setForm({ kind: 'settle', lc: l, date_str: today(), bank_account: l.bank_account || bank0 }); }} className={btnSmall}>{l.status === 'received' ? 'إقفال' : 'إلغاء'}</button>}
              </td>
            </tr>
          ))}
        </Table>
      )}
      {err && !form && <Err e={err} />}

      {form?.kind === 'open' && (() => {
        const egp = r2((+form.lc_amount_foreign || 0) * (+form.exchange_rate || 0));
        return (
          <Modal wide title="فتح اعتماد مستندي" onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/lc/open`, { ...form, kind: undefined, lc_number: form.lc_number.trim(), supplier_name: form.supplier_name.trim(),
              lc_amount_foreign: +form.lc_amount_foreign, exchange_rate: +form.exchange_rate, margin_amount: +form.margin_amount || 0, bank_commission: +form.bank_commission || 0 }, auth()))}
              disabled={busy || !form.lc_number.trim() || !form.supplier_name.trim() || !(+form.lc_amount_foreign > 0) || !(+form.exchange_rate > 0) || !form.expiry_date} className={btnPrimary}>{busy ? '…' : 'فتح وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Label t="رقم الاعتماد *"><input dir="ltr" value={form.lc_number} onChange={(e) => setForm({ ...form, lc_number: e.target.value })} className={input} /></Label>
              <Label t="المورد الأجنبي *"><input value={form.supplier_name} onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} className={input} /></Label>
              <Label t="بلد المورد"><input value={form.supplier_country} onChange={(e) => setForm({ ...form, supplier_country: e.target.value })} className={input} /></Label>
              <Label t="وصف البضاعة" className="sm:col-span-3"><input value={form.goods_description} onChange={(e) => setForm({ ...form, goods_description: e.target.value })} className={input} /></Label>
              <Label t="العملة"><select value={form.lc_currency} onChange={(e) => setForm({ ...form, lc_currency: e.target.value })} className={input}>{['USD', 'EUR', 'GBP', 'CNY', 'SAR', 'AED'].map((c) => <option key={c}>{c}</option>)}</select></Label>
              <Label t="قيمة الاعتماد بالعملة *"><Num value={form.lc_amount_foreign} onChange={(v) => setForm({ ...form, lc_amount_foreign: v })} /></Label>
              <Label t="سعر الصرف *"><Num value={form.exchange_rate} onChange={(v) => setForm({ ...form, exchange_rate: v })} step="0.0001" /></Label>
              <Label t="الغطاء النقدي (ج.م)"><Num value={form.margin_amount} onChange={(v) => setForm({ ...form, margin_amount: v })} /></Label>
              <Label t="عمولة فتح الاعتماد"><Num value={form.bank_commission} onChange={(v) => setForm({ ...form, bank_commission: v })} /></Label>
              <Label t="البنك"><BankSelect banks={banks} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} /></Label>
              <Label t="تاريخ الفتح"><input type="date" value={form.open_date} onChange={(e) => setForm({ ...form, open_date: e.target.value })} className={input} /></Label>
              <Label t="تاريخ الانتهاء *"><input type="date" min={form.open_date} value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className={input} /></Label>
            </div>
            {egp > 0 && <p className="mt-3">القيمة بالجنيه: <N v={egp} /></p>}
            <div className="mt-3"><Lines rows={[['165 غطاء اعتمادات مستندية', r2(form.margin_amount), 0], ['3371 عمولات فتح الاعتمادات', r2(form.bank_commission), 0],
              [`${form.bank_account} البنك`, 0, r2((+form.margin_amount || 0) + (+form.bank_commission || 0))]]} /></div>
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'costs' && (() => {
        const total = r2(form.rows.reduce((t, r) => t + (+r.amount_egp || 0), 0));
        const src = form.payment_src === 'bank' ? `${form.bank_account} البنك` : form.payment_src === 'cash' ? '161 الخزينة' : '251 الموردون (شاحن / مخلّص)';
        const setR = (i, k, v) => setForm({ ...form, rows: form.rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
        return (
          <Modal title={`تكاليف استيراد — ${form.lc.lc_number}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/lc/${form.lc.id}/costs`, { date_str: form.date_str, payment_src: form.payment_src, bank_account: form.bank_account,
              costs: form.rows.filter((r) => +r.amount_egp > 0).map((r) => ({ cost_type: r.cost_type, amount_egp: +r.amount_egp, description: r.description })) }, auth()))}
              disabled={busy || !(total > 0)} className={btnPrimary}>{busy ? '…' : 'حفظ وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Label t="التاريخ"><input type="date" value={form.date_str} onChange={(e) => setForm({ ...form, date_str: e.target.value })} className={input} /></Label>
              <Label t="مصدر السداد">
                <select value={form.payment_src} onChange={(e) => setForm({ ...form, payment_src: e.target.value })} className={input}>
                  <option value="bank">البنك</option><option value="cash">الخزينة</option><option value="supplier">آجل — الشاحن/المخلّص</option></select></Label>
              {form.payment_src === 'bank' && <Label t="البنك"><BankSelect banks={banks} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} /></Label>}
            </div>
            <div className="mt-3 space-y-2">
              {form.rows.map((r, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[9rem_8rem_1fr_auto] gap-2 items-end">
                  <select value={r.cost_type} onChange={(e) => setR(i, 'cost_type', e.target.value)} className={input}>{Object.entries(LC_COSTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <Num value={r.amount_egp} onChange={(v) => setR(i, 'amount_egp', v)} placeholder="المبلغ" />
                  <input value={r.description} onChange={(e) => setR(i, 'description', e.target.value)} placeholder="بيان / رقم الفاتورة" className={input} />
                  <DelBtn onClick={() => setForm({ ...form, rows: form.rows.filter((_, j) => j !== i) })} />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, rows: [...form.rows, { cost_type: 'customs', amount_egp: '', description: '' }] })} className={btnSmall}>+ بند</button>
            </div>
            <div className="mt-4"><Lines rows={[...form.rows.filter((r) => +r.amount_egp > 0).map((r) => [`123 بضاعة بالطريق — ${LC_COSTS[r.cost_type]}`, r2(r.amount_egp), 0]), [src, 0, total]]} /></div>
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'pay' && (() => {
        const value = r2((+form.amount_foreign || 0) * (+form.exchange_rate || 0));
        const used = Math.min(form.lc.margin_amount || 0, value);
        return (
          <Modal title={`سداد مستندات — ${form.lc.lc_number}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/lc/${form.lc.id}/pay`, { date_str: form.date_str, exchange_rate: +form.exchange_rate, amount_foreign: +form.amount_foreign, bank_account: form.bank_account }, auth()))}
              disabled={busy || !(value > 0)} className={btnPrimary}>{busy ? '…' : 'سداد وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label t="تاريخ السداد"><input type="date" value={form.date_str} onChange={(e) => setForm({ ...form, date_str: e.target.value })} className={input} /></Label>
              <Label t="البنك"><BankSelect banks={banks} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} /></Label>
              <Label t={`المبلغ المسدد (${form.lc.lc_currency})`}><Num value={form.amount_foreign} onChange={(v) => setForm({ ...form, amount_foreign: v })} /></Label>
              <Label t="سعر الصرف يوم السداد"><Num value={form.exchange_rate} onChange={(v) => setForm({ ...form, exchange_rate: v })} step="0.0001" /></Label>
            </div>
            <div className="mt-4"><Lines rows={[['123 بضاعة بالطريق — قيمة المستندات', value, 0], ['165 غطاء الاعتماد المستخدم', 0, r2(used)], [`${form.bank_account} البنك — الباقي`, 0, r2(value - used)]]}
              note="قيمة البضاعة تُثبت بسعر الصرف الفعلي يوم السداد (المعيار المصري 13)." /></div>
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'receive' && (() => {
        const total = balanceOf(form.lc);
        const setI = (i, k, v) => setForm({ ...form, items: form.items.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
        return (
          <Modal wide title={`استلام بضاعة — ${form.lc.lc_number}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>إلغاء</button>
            <button onClick={() => run(() => axios.post(`${API}/api/lc/${form.lc.id}/receive`, { date_str: form.date_str, goods_received: form.goods_received, warehouse_id: form.warehouse_id || null,
              items: form.items.filter((i) => i.product_id && +i.quantity > 0).map((i) => ({ product_id: i.product_id, quantity: +i.quantity, foreign_value: i.foreign_value === '' ? null : +i.foreign_value })) }, auth()))}
              disabled={busy} className={btnPrimary}>{busy ? '…' : 'استلام وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Label t="تاريخ الوصول"><input type="date" value={form.date_str} onChange={(e) => setForm({ ...form, date_str: e.target.value })} className={input} /></Label>
              <Label t="نوع البضاعة">
                <select value={form.goods_received} onChange={(e) => setForm({ ...form, goods_received: e.target.value })} className={input}>
                  <option value="goods">بضائع بغرض البيع (125)</option><option value="raw_material">خامات للتصنيع (121)</option></select></Label>
              <Label t="المخزن"><WarehouseSelect warehouses={warehouses} value={form.warehouse_id} onChange={(v) => setForm({ ...form, warehouse_id: v })} /></Label>
            </div>
            <p className="mt-4 font-bold">الأصناف المستلمة — التكلفة الشاملة توزع بالقيمة (إن أُدخلت لكل الأصناف) وإلا بالكمية</p>
            {form.items.map((it, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_9rem_auto] gap-2 items-end">
                <ProductSelect products={products} value={it.product_id} onChange={(v) => setI(i, 'product_id', v)} />
                <Num value={it.quantity} onChange={(v) => setI(i, 'quantity', v)} placeholder="الكمية" />
                <Num value={it.foreign_value} onChange={(v) => setI(i, 'foreign_value', v)} placeholder={`القيمة ${form.lc.lc_currency}`} />
                <DelBtn onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <button onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', quantity: '', foreign_value: '' }] })} className={`${btnSmall} mt-2`}>+ صنف</button>
            <div className="mt-4"><Lines rows={[[`${form.goods_received === 'raw_material' ? '121 مخزون الخامات' : '125 مخزون بضائع'} (311 في الجرد الدوري)`, total, 0], ['123 بضاعة بالطريق', 0, total]]}
              note="الكميات تدخل المخزن مرة واحدة هنا — لا تسجّل فاتورة شراء ولا إذن استلام آخر لنفس الشحنة." /></div>
            <Err e={err} />
          </Modal>
        );
      })()}

      {form?.kind === 'settle' && (() => {
        const l = form.lc; const cancel = l.status !== 'received'; const ml = marginLeft(l); const bal = balanceOf(l);
        return (
          <Modal title={`${cancel ? 'إلغاء' : 'إقفال'} الاعتماد ${l.lc_number}`} onClose={() => setForm(null)} footer={<>
            <button onClick={() => setForm(null)} className={btnGhost}>رجوع</button>
            <button onClick={() => run(() => axios.post(`${API}/api/lc/${l.id}/settle`, { date_str: form.date_str, bank_account: form.bank_account }, auth()))} disabled={busy}
              className={cancel ? 'px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50' : btnPrimary}>{busy ? '…' : cancel ? 'إلغاء الاعتماد' : 'إقفال وترحيل'}</button></>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Label t="التاريخ"><input type="date" value={form.date_str} onChange={(e) => setForm({ ...form, date_str: e.target.value })} className={input} /></Label>
              <Label t="البنك المسترد إليه"><BankSelect banks={banks} value={form.bank_account} onChange={(v) => setForm({ ...form, bank_account: v })} /></Label>
            </div>
            <div className="mt-4"><Lines rows={[[`${form.bank_account} البنك — رد الغطاء`, ml, 0], ['165 غطاء الاعتماد', 0, ml],
              ...(cancel ? [['3372-3375 مصروفات الاستيراد المدفوعة', bal, 0], ['123 بضاعة بالطريق', 0, bal]] : [])]}
              note={cancel ? 'إلغاء قبل سداد المستندات: يُرد الغطاء وتُحمَّل التكاليف المدفوعة على مصروفاتها.' : null} /></div>
            <Err e={err} />
          </Modal>
        );
      })()}
    </div>
  );
}

/* ═════════════════════════ أدوات المخزون ═════════════════════════ */

const LANDED_TYPES = { freight: 'شحن', insurance: 'تأمين', customs: 'جمارك', clearance: 'تخليص', other: 'أخرى' };
const LANDED_CREDIT = [['251', '251 مستحق للمورد / الشاحن'], ['162', '162 مدفوع من البنك'], ['161', '161 مدفوع من الخزينة'],
  ['3372', '3372 سبق تسجيله مصروف شحن'], ['3373', '3373 سبق تسجيله مصروف تأمين'], ['3374', '3374 سبق تسجيله رسوم جمركية'], ['3375', '3375 سبق تسجيله تخليص']];
const LANDED_DEFAULT = { freight: '251', insurance: '251', customs: '3374', clearance: '3375', other: '251' };

export function InventoryEngineTools({ initialTab = 'landed' } = {}) {
  const [tab, setTab] = useState(initialTab);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [landed, setLanded] = useState({ ref: '', date: today(), method: 'value', rows: [{ type: 'freight', amount: '', credit_account: '251', description: '' }] });
  const [count, setCount] = useState({ warehouse_id: '', date: today(), tolerance: 0.5, lines: null, counted: {} });
  const [transfer, setTransfer] = useState({ from: '', to: '', date: today(), stock: [], rows: [{ product_id: '', quantity: '' }] });
  const [val, setVal] = useState({ warehouse_id: '', method: 'weighted_average', data: null });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getWarehouses().then(setWarehouses); getProducts().then(setProducts);
    axios.get(`${API}/api/inventory-engine/receipts`, auth()).then((r) => setReceipts(r.data?.receipts || [])).catch(() => {});
  }, []);

  const go = async (fn) => {
    setBusy(true); setErr(''); setResult(null);
    try { const r = await fn(); setResult(r?.data?.message || 'تم'); return r; }
    catch (e) { setErr(errText(e, 'تعذّر التنفيذ')); return null; } finally { setBusy(false); }
  };
  const loadSheet = async (wid, setter) => {
    try { const { data } = await axios.get(`${API}/api/inventory-engine/count-sheet`, { ...auth(), params: wid ? { warehouse_id: wid } : {} }); setter(data); }
    catch (e) { setErr(errText(e, 'تعذّر تحميل أرصدة المخزن')); }
  };
  const pname = (id) => products.find((p) => p.id === id)?.name || id;

  // ── landed
  const landedTotal = r2(landed.rows.reduce((t, r) => t + (+r.amount || 0), 0));
  const setLR = (i, k, v) => setLanded({ ...landed, rows: landed.rows.map((x, j) => (j === i ? { ...x, [k]: v, ...(k === 'type' ? { credit_account: LANDED_DEFAULT[v] } : {}) } : x)) });
  const saveLanded = () => go(() => axios.post(`${API}/api/inventory-engine/landed-costs`, { purchase_order_id: landed.ref.trim(), date: landed.date, allocation_method: landed.method,
    costs: landed.rows.filter((r) => +r.amount > 0).map((r) => ({ type: r.type, amount: +r.amount, credit_account: r.credit_account, description: r.description || null })) }, auth()));

  // ── count
  const countDiffs = useMemo(() => {
    if (!count.lines) return [];
    const altCredit = '1314/1313 مطالبة على المسؤول';
    return count.lines.map((l) => {
      const c = count.counted[l.product_id];
      if (c === undefined || c === '') return null;
      const diff = +c - l.system_qty;
      if (Math.abs(diff) < 0.001) return null;
      const value = r2(Math.abs(diff) * l.unit_cost);
      const kind = diff > 0 ? 'surplus' : Math.abs(diff) <= Math.max(l.system_qty, 0) * (+count.tolerance || 0) / 100 ? 'allowed' : 'denied';
      return { ...l, counted: +c, diff, value, kind, acc: kind === 'surplus' ? '423 إيرادات متنوعة' : kind === 'allowed' ? '3365 خسائر عهد ومفقودات' : altCredit };
    }).filter(Boolean);
  }, [count]);
  const countRows = () => {
    const sum = (k) => r2(countDiffs.filter((d) => d.kind === k).reduce((t, d) => t + d.value, 0));
    const short = r2(sum('allowed') + sum('denied'));
    return [['3365 خسائر عهد ومفقودات (عجز مسموح)', sum('allowed'), 0], ['1314/1313 مطالبة على المسؤول (عجز غير مسموح)', sum('denied'), 0],
      ['125 المخزون (311 في الجرد الدوري)', sum('surplus'), short], ['423 إيرادات متنوعة (زيادة)', 0, sum('surplus')]];
  };
  const saveCount = async () => {
    const r = await go(() => axios.post(`${API}/api/inventory-engine/reconcile`, { warehouse_id: count.warehouse_id || 'main', count_date: count.date, shortage_tolerance: (+count.tolerance || 0) / 100,
      lines: countDiffs.map((d) => ({ product_id: d.product_id, counted_qty: d.counted })) }, auth()));
    if (r) loadSheet(count.warehouse_id, (d) => setCount((c) => ({ ...c, warehouse_id: d.warehouse_id, lines: d.lines, counted: {} })));
  };

  // ── transfer
  const avail = (pid) => transfer.stock.find((s) => s.product_id === pid)?.system_qty || 0;
  const setTR = (i, k, v) => setTransfer({ ...transfer, rows: transfer.rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const trOk = transfer.from && transfer.to && transfer.from !== transfer.to && transfer.rows.some((r) => r.product_id && +r.quantity > 0)
    && transfer.rows.every((r) => !r.product_id || +r.quantity <= avail(r.product_id));
  const saveTransfer = async () => {
    const r = await go(() => axios.post(`${API}/api/inventory-engine/branch-transfer`, { from_warehouse_id: transfer.from, to_warehouse_id: transfer.to, transfer_date: transfer.date,
      lines: transfer.rows.filter((x) => x.product_id && +x.quantity > 0).map((x) => ({ product_id: x.product_id, quantity: +x.quantity })) }, auth()));
    if (r) { setTransfer((t) => ({ ...t, rows: [{ product_id: '', quantity: '' }] })); loadSheet(transfer.from, (d) => setTransfer((t) => ({ ...t, stock: d.lines }))); }
  };

  // ── valuation
  const loadVal = async () => {
    setErr('');
    try { const { data } = await axios.get(`${API}/api/inventory-engine/valuation-report`, { ...auth(), params: { method: val.method, ...(val.warehouse_id ? { warehouse_id: val.warehouse_id } : {}) } }); setVal({ ...val, data }); }
    catch (e) { setErr(errText(e, 'تعذّر إعداد التقرير')); }
  };

  const whSelect = (value, onChange, allowAll) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
      <option value="">{allowAll ? 'كل المخازن' : '— اختر المخزن —'}</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
  );

  return (
    <div className="p-4 md:p-6 space-y-4" dir="rtl">
      <Header title="أدوات المخزون المتقدمة" sub="تكاليف الاستيراد، الجرد الفعلي وتسويته، التحويل بين المخازن، وتقييم المخزون — كل حركة بقيدها حسب طريقة الجرد (مستمر: 125 / دوري: 311)." />
      <Tabs tabs={[['landed', 'تكاليف الاستيراد'], ['count', 'الجرد والتسوية'], ['transfer', 'تحويل بين المخازن'], ['valuation', 'تقييم المخزون']]} value={tab} onChange={(v) => { setTab(v); setErr(''); setResult(null); }} />
      {result && <p className="text-sm rounded-lg bg-emerald-50 text-emerald-800 p-3" role="status">{result}</p>}
      <Err e={err} />

      {tab === 'landed' && (
        <div className="space-y-3 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Label t="إذن الاستلام / الاعتماد *" className="sm:col-span-2">
              <select value={receipts.some((r) => r.reference === landed.ref) ? landed.ref : ''} onChange={(e) => setLanded({ ...landed, ref: e.target.value })} className={input}>
                <option value="">— اختر أو اكتب المرجع بالأسفل —</option>
                {receipts.map((r) => <option key={r.reference} value={r.reference}>{r.label || r.reference} — {r.date} — {r.products.join('، ')} ({money(r.value)})</option>)}</select>
              <input dir="ltr" value={landed.ref} onChange={(e) => setLanded({ ...landed, ref: e.target.value })} placeholder="مرجع الاستلام" className={input} /></Label>
            <Label t="التاريخ"><input type="date" value={landed.date} onChange={(e) => setLanded({ ...landed, date: e.target.value })} className={input} /></Label>
            <Label t="أساس التوزيع">
              <select value={landed.method} onChange={(e) => setLanded({ ...landed, method: e.target.value })} className={input}><option value="value">بالقيمة</option><option value="quantity">بالكمية</option></select></Label>
          </div>
          {landed.rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[7rem_8rem_1fr_1fr_auto] gap-2 items-end">
              <select value={r.type} onChange={(e) => setLR(i, 'type', e.target.value)} className={input}>{Object.entries(LANDED_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <Num value={r.amount} onChange={(v) => setLR(i, 'amount', v)} placeholder="المبلغ" />
              <select value={r.credit_account} onChange={(e) => setLR(i, 'credit_account', e.target.value)} className={input}>{LANDED_CREDIT.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <input value={r.description} onChange={(e) => setLR(i, 'description', e.target.value)} placeholder="بيان" className={input} />
              <DelBtn onClick={() => setLanded({ ...landed, rows: landed.rows.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button onClick={() => setLanded({ ...landed, rows: [...landed.rows, { type: 'customs', amount: '', credit_account: '3374', description: '' }] })} className={btnSmall}>+ تكلفة</button>
          {landedTotal > 0 && <Lines rows={[['125 المخزون (والجزء الخاص ببضاعة بيعت على 314)', landedTotal, 0],
            ...landed.rows.filter((r) => +r.amount > 0).map((r) => [LANDED_CREDIT.find((c) => c[0] === r.credit_account)?.[1] || r.credit_account, 0, r2(r.amount)])]}
            note="تضاف التكلفة لمتوسط تكلفة الكمية الموجودة بالمخزن؛ ما يخص كمية بيعت بالفعل يُحمَّل على تكلفة المبيعات." />}
          <button onClick={saveLanded} disabled={busy || !landed.ref.trim() || !(landedTotal > 0)} className={btnPrimary}>{busy ? '…' : 'توزيع وترحيل'}</button>
        </div>
      )}

      {tab === 'count' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Label t="المخزن">{whSelect(count.warehouse_id, (v) => setCount({ ...count, warehouse_id: v, lines: null, counted: {} }), false)}</Label>
            <Label t="تاريخ الجرد"><input type="date" value={count.date} onChange={(e) => setCount({ ...count, date: e.target.value })} className={input} /></Label>
            <Label t="العجز المسموح %"><Num value={count.tolerance} onChange={(v) => setCount({ ...count, tolerance: v })} step="0.1" /></Label>
            <button onClick={() => loadSheet(count.warehouse_id, (d) => setCount((c) => ({ ...c, warehouse_id: d.warehouse_id, lines: d.lines, counted: {} })))} className={`${btnGhost} inline-flex items-center gap-1`}>
              <RefreshCw className="w-4 h-4" aria-hidden /> تحميل كشف الجرد</button>
          </div>
          {count.lines && (
            <Table head={['الكود', 'الصنف', '#الدفتري', '#المعدود فعلاً', '#الفرق', '#القيمة', 'المعالجة']} empty={count.lines.length === 0 && 'لا أرصدة في هذا المخزن.'}>
              {count.lines.map((l) => {
                const d = countDiffs.find((x) => x.product_id === l.product_id);
                return (
                  <tr key={l.product_id}><td className="px-3 py-2"><bdi dir="ltr">{l.product_code}</bdi></td><td className="px-3 py-2">{l.product_name}</td>
                    <td className="px-3 py-2 text-end"><Q v={l.system_qty} /></td>
                    <td className="px-3 py-2 text-end"><input type="number" min="0" step="0.001" dir="ltr" aria-label={`المعدود — ${l.product_name}`} value={count.counted[l.product_id] ?? ''}
                      placeholder={qtyFmt(l.system_qty)} onChange={(e) => setCount({ ...count, counted: { ...count.counted, [l.product_id]: e.target.value } })} className={`${input} w-28 mt-0`} /></td>
                    <td className={`px-3 py-2 text-end ${d && d.diff < 0 ? 'text-red-700' : ''}`}>{d ? <Q v={d.diff} /> : '—'}</td>
                    <td className="px-3 py-2 text-end">{d ? <N v={d.value} /> : '—'}</td><td className="px-3 py-2 text-xs">{d?.acc || ''}</td></tr>
                );
              })}
            </Table>
          )}
          {countDiffs.length > 0 && <div className="max-w-2xl"><Lines rows={countRows()} /></div>}
          {count.lines && <button onClick={saveCount} disabled={busy || countDiffs.length === 0} className={btnPrimary}>{busy ? '…' : `ترحيل تسوية ${countDiffs.length} صنف`}</button>}
        </div>
      )}

      {tab === 'transfer' && (
        <div className="space-y-3 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Label t="من مخزن *">{whSelect(transfer.from, (v) => { setTransfer({ ...transfer, from: v, stock: [] }); if (v) loadSheet(v, (d) => setTransfer((t) => ({ ...t, stock: d.lines }))); }, false)}</Label>
            <Label t="إلى مخزن *">{whSelect(transfer.to, (v) => setTransfer({ ...transfer, to: v }), false)}</Label>
            <Label t="التاريخ"><input type="date" value={transfer.date} onChange={(e) => setTransfer({ ...transfer, date: e.target.value })} className={input} /></Label>
          </div>
          {transfer.rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end">
              <select value={r.product_id} onChange={(e) => setTR(i, 'product_id', e.target.value)} className={input}>
                <option value="">— الصنف —</option>{transfer.stock.filter((s) => s.system_qty > 0).map((s) => <option key={s.product_id} value={s.product_id}>{s.product_name || pname(s.product_id)} (متاح {qtyFmt(s.system_qty)})</option>)}</select>
              <Num value={r.quantity} onChange={(v) => setTR(i, 'quantity', v)} placeholder="الكمية" />
              <DelBtn onClick={() => setTransfer({ ...transfer, rows: transfer.rows.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button onClick={() => setTransfer({ ...transfer, rows: [...transfer.rows, { product_id: '', quantity: '' }] })} className={btnSmall}>+ صنف</button>
          {transfer.from && transfer.from === transfer.to && <p className="text-sm text-red-700">المخزن المرسل والمستلم واحد.</p>}
          <p className="text-xs text-slate-500">التحويل بتكلفة المخزن المرسل. لا يُرحَّل قيد لأن المخزون يبقى على نفس الحساب (125) — إلا إذا كان لكل مخزن مركز تكلفة مختلف.</p>
          <button onClick={saveTransfer} disabled={busy || !trOk} className={btnPrimary}>{busy ? '…' : 'تنفيذ التحويل'}</button>
        </div>
      )}

      {tab === 'valuation' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <Label t="المخزن">{whSelect(val.warehouse_id, (v) => setVal({ ...val, warehouse_id: v }), true)}</Label>
            <Label t="الطريقة"><select value={val.method} onChange={(e) => setVal({ ...val, method: e.target.value })} className={input}><option value="weighted_average">المتوسط المرجح</option><option value="fifo">الوارد أولاً يصرف أولاً</option></select></Label>
            <button onClick={loadVal} className={btnPrimary}>عرض التقرير</button>
          </div>
          {val.data && (<>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="عدد الأصناف" v={val.data.totals.total_items} money={false} /><Stat label="قيمة المخزون" v={val.data.totals.total_value} />
              {val.data.ledger && <Stat label={`رصيد الحساب ${val.data.ledger.account_code}`} v={val.data.ledger.balance} />}
              {val.data.ledger && <Stat label="الفرق" v={r2(val.data.totals.total_value - val.data.ledger.balance)} />}
            </div>
            {val.data.ledger && Math.abs(val.data.totals.total_value - val.data.ledger.balance) > 0.01 && !val.warehouse_id &&
              <p className="text-xs text-amber-700">قيمة الأرصدة لا تطابق رصيد الحساب في الدفاتر — راجع الأرصدة الافتتاحية والحركات المسجلة خارج النظام.</p>}
            <Table head={['الكود', 'الصنف', 'المخزن', '#الكمية', '#تكلفة الوحدة', '#القيمة']} empty={val.data.lines.length === 0 && 'لا أرصدة.'}>
              {val.data.lines.map((l) => <tr key={`${l.product_id}-${l.warehouse_id}`}><td className="px-3 py-2"><bdi dir="ltr">{l.product_code}</bdi></td><td className="px-3 py-2">{l.product_name}</td>
                <td className="px-3 py-2">{l.warehouse_name}</td><td className="px-3 py-2 text-end"><Q v={l.quantity} /></td><td className="px-3 py-2 text-end"><N v={l.unit_cost} /></td>
                <td className="px-3 py-2 text-end font-semibold"><N v={l.total_value} /></td></tr>)}
            </Table>
          </>)}
        </div>
      )}
    </div>
  );
}
