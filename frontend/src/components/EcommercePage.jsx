/**
 * المتاجر الإلكترونية — ربط Shopify / WooCommerce / سلة واستقبال الطلبات
 *
 * Each store connection gets a webhook URL and a signing secret (shown once).
 * Orders arrive on the webhook, are matched to products by SKU, and become an
 * approved sales invoice (revenue, VAT, stock), a payment when the order is
 * paid, and optionally an ETA submission. Orders whose SKUs are not mapped
 * wait in "needs mapping" until they are mapped and retried.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Store, Plus, Copy, RefreshCw, Trash2, Loader2, Check, KeyRound, Link2, X } from 'lucide-react';

const BASE = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const API = `${BASE}/api/ecommerce`;
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PLATFORMS = [
  { id: 'shopify', ar: 'Shopify', en: 'Shopify' },
  { id: 'woocommerce', ar: 'WooCommerce', en: 'WooCommerce' },
  { id: 'salla', ar: 'سلة', en: 'Salla' },
  { id: 'generic', ar: 'ربط عام (API)', en: 'Generic (API)' },
];
const STATUS = {
  received: { ar: 'مستلم', en: 'Received', cls: 'bg-gray-100 text-gray-700' },
  invoiced: { ar: 'تمت الفوترة', en: 'Invoiced', cls: 'bg-blue-100 text-blue-700' },
  paid: { ar: 'مدفوع', en: 'Paid', cls: 'bg-green-100 text-green-700' },
  eta_submitted: { ar: 'أُرسل للضرائب', en: 'ETA submitted', cls: 'bg-emerald-100 text-emerald-800' },
  needs_mapping: { ar: 'يحتاج ربط أصناف', en: 'Needs mapping', cls: 'bg-amber-100 text-amber-800' },
  error: { ar: 'خطأ', en: 'Error', cls: 'bg-red-100 text-red-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-gray-200 text-gray-600' },
};
const EMPTY = {
  name: '', platform: 'shopify', shop_domain: '', webhook_secret: '', customer_mode: 'auto',
  default_party_id: '', warehouse_id: 'main', payment_account_id: '', payment_method: 'credit_card',
  shipping_tax_rate: 14, auto_submit_eta: false,
};

function CopyField({ label, value, ar }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { window.prompt(ar ? 'انسخ القيمة' : 'Copy the value', value); }
  };
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <code dir="ltr" className="flex-1 bg-gray-50 border rounded px-2 py-1.5 text-xs break-all">{value}</code>
        <button type="button" onClick={copy} className="p-2 rounded border hover:bg-gray-50" title={ar ? 'نسخ' : 'Copy'}>
          {done ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function EcommercePage({ language = 'ar' }) {
  const ar = language === 'ar';
  const t = (a, e) => (ar ? a : e);
  const [tab, setTab] = useState('orders');
  const [conns, setConns] = useState([]);
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [revealed, setRevealed] = useState(null);   // {name, url, secret} — shown once
  const [parties, setParties] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [mapFor, setMapFor] = useState(null);       // connection whose SKU map is open
  const [mapRows, setMapRows] = useState([]);

  const fail = useCallback((e, fallback) => setMsg({ type: 'err', text: e?.response?.data?.detail || fallback }), []);

  const loadConns = useCallback(async () => {
    try { setConns((await axios.get(`${API}/connections`, auth())).data.connections || []); }
    catch (e) { fail(e, ar ? 'تعذّر تحميل المتاجر' : 'Could not load stores'); }
  }, [ar, fail]);

  const loadOrders = useCallback(async () => {
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : '';
      const { data } = await axios.get(`${API}/orders${q}`, auth());
      setOrders(data.orders || []); setCounts(data.counts || {});
    } catch (e) { fail(e, ar ? 'تعذّر تحميل الطلبات' : 'Could not load orders'); }
  }, [status, ar, fail]);

  useEffect(() => { loadConns(); }, [loadConns]);
  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => {
    const get = (url, key, set) => axios.get(`${BASE}${url}`, auth()).then((r) => set(r.data[key] || [])).catch(() => set([]));
    get('/api/invoice/parties?party_type=customer', 'parties', setParties);
    get('/api/inventory/warehouses', 'warehouses', setWarehouses);
    get('/api/invoice/products', 'products', setProducts);
    get('/api/accounting/accounts', 'accounts', (rows) => setAccounts(
      rows.filter((a) => !a.is_header && String(a.account_code || '').startsWith('1'))));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setBusy('create'); setMsg({ type: '', text: '' });
    try {
      const body = { ...form, shipping_tax_rate: Number(form.shipping_tax_rate || 0),
        webhook_secret: form.webhook_secret || null, default_party_id: form.default_party_id || null,
        payment_account_id: form.payment_account_id || null };
      const { data } = await axios.post(`${API}/connections`, body, auth());
      setRevealed({ name: data.connection.name, url: data.webhook_url, secret: data.webhook_secret });
      setShowForm(false); setForm(EMPTY); loadConns();
    } catch (err) { fail(err, ar ? 'تعذّر إنشاء الربط' : 'Could not create the connection'); }
    finally { setBusy(''); }
  };

  const toggleActive = async (c) => {
    try { await axios.put(`${API}/connections/${c.id}`, { is_active: !c.is_active }, auth()); loadConns(); }
    catch (e) { fail(e, ar ? 'تعذّر التحديث' : 'Update failed'); }
  };

  const toggleEta = async (c) => {
    try { await axios.put(`${API}/connections/${c.id}`, { auto_submit_eta: !c.auto_submit_eta }, auth()); loadConns(); }
    catch (e) { fail(e, ar ? 'تعذّر التحديث' : 'Update failed'); }
  };

  const rotate = async (c) => {
    const given = window.prompt(ar
      ? 'مفتاح جديد: اتركه فارغاً لتوليد مفتاح، أو الصق المفتاح الذي تعرضه المنصة (Shopify / سلة)'
      : 'New secret: leave empty to generate one, or paste the one the platform shows (Shopify / Salla)', '');
    if (given === null) return;
    try {
      const { data } = await axios.post(`${API}/connections/${c.id}/rotate-secret`, { webhook_secret: given || null }, auth());
      setRevealed({ name: c.name, url: data.webhook_url, secret: data.webhook_secret });
    } catch (e) { fail(e, ar ? 'تعذّر تغيير المفتاح' : 'Could not rotate the secret'); }
  };

  const remove = async (c) => {
    if (!window.confirm(ar ? `حذف ربط «${c.name}»؟ تتوقف الطلبات الجديدة، وتبقى الطلبات والفواتير السابقة.`
      : `Delete "${c.name}"? New orders stop; past orders and invoices stay.`)) return;
    try { await axios.delete(`${API}/connections/${c.id}`, auth()); loadConns(); }
    catch (e) { fail(e, ar ? 'تعذّر الحذف' : 'Delete failed'); }
  };

  const openMap = (c, extraSkus = []) => {
    const rows = Object.entries(c.sku_map || {}).map(([sku, code]) => ({ sku, code }));
    extraSkus.filter((s) => s && !rows.some((r) => r.sku === s)).forEach((sku) => rows.push({ sku, code: '' }));
    if (!rows.length) rows.push({ sku: '', code: '' });
    setMapRows(rows); setMapFor(c); setTab('stores');
  };

  const saveMap = async () => {
    setBusy('map');
    try {
      const sku_map = {};
      mapRows.forEach((r) => { if (r.sku.trim() && r.code) sku_map[r.sku.trim()] = r.code; });
      await axios.put(`${API}/connections/${mapFor.id}/sku-map`, { sku_map }, auth());
      setMsg({ type: 'ok', text: ar ? 'تم حفظ ربط الأصناف — أعد تنفيذ الطلبات المعلقة' : 'Mapping saved — retry the waiting orders' });
      setMapFor(null); loadConns();
    } catch (e) { fail(e, ar ? 'تعذّر حفظ الربط' : 'Could not save the mapping'); }
    finally { setBusy(''); }
  };

  const retry = async (o) => {
    setBusy(o.id); setMsg({ type: '', text: '' });
    try {
      const { data } = await axios.post(`${API}/orders/${o.id}/retry`, {}, auth());
      setMsg(data.status === 'error' || data.status === 'needs_mapping'
        ? { type: 'err', text: data.error || STATUS[data.status][ar ? 'ar' : 'en'] }
        : { type: 'ok', text: ar ? 'تمت المعالجة' : 'Processed' });
      loadOrders();
    } catch (e) { fail(e, ar ? 'تعذّرت إعادة التنفيذ' : 'Retry failed'); }
    finally { setBusy(''); }
  };

  const connById = (id) => conns.find((c) => c.id === id);
  const needsSecret = form.platform === 'shopify' || form.platform === 'salla';

  return (
    <div className="p-4 md:p-6 space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Store className="w-5 h-5" />{t('المتاجر الإلكترونية', 'Online stores')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t(
            'طلبات المتجر تتحول تلقائياً إلى فاتورة بيع معتمدة (إيراد وضريبة ومخزون) وسداد للطلبات المدفوعة.',
            'Store orders become approved sales invoices (revenue, VAT, stock) and payments for paid orders.')}</p>
        </div>
        <div className="flex gap-2">
          {[['orders', t('الطلبات', 'Orders')], ['stores', t('المتاجر وربط الأصناف', 'Stores & SKU mapping')]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${tab === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}>{label}</button>
          ))}
        </div>
      </div>

      {msg.text && (
        <div className={`flex items-start justify-between gap-2 rounded-lg px-3 py-2 text-sm ${msg.type === 'err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg({ type: '', text: '' })}><X className="w-4 h-4" /></button>
        </div>
      )}

      {revealed && (
        <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
          <div className="font-semibold text-amber-900 flex items-center gap-2"><KeyRound className="w-4 h-4" />
            {t(`بيانات ربط «${revealed.name}» — المفتاح يظهر هذه المرة فقط`, `"${revealed.name}" — the secret is shown this once only`)}</div>
          <CopyField ar={ar} label={t('رابط الـ Webhook', 'Webhook URL')} value={revealed.url} />
          <CopyField ar={ar} label={t('مفتاح التوقيع (Secret)', 'Signing secret')} value={revealed.secret} />
          <p className="text-xs text-amber-800">{t(
            'الصق الرابط والمفتاح في إعدادات الـ Webhook بالمتجر (حدث إنشاء الطلب وتحديثه وإلغائه).',
            'Paste the URL and secret into the store webhook settings (order created / updated / cancelled).')}</p>
          <button type="button" onClick={() => setRevealed(null)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm">{t('نسختهما', 'I copied them')}</button>
        </div>
      )}

      {tab === 'orders' && (
        <div className="bg-white border rounded-xl">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b">
            <button type="button" onClick={() => setStatus('')}
              className={`px-2.5 py-1 rounded-full text-xs border ${!status ? 'bg-gray-900 text-white' : ''}`}>{t('الكل', 'All')}</button>
            {Object.entries(STATUS).map(([k, s]) => (
              <button key={k} type="button" onClick={() => setStatus(k)}
                className={`px-2.5 py-1 rounded-full text-xs border ${status === k ? 'bg-gray-900 text-white' : ''}`}>
                {s[ar ? 'ar' : 'en']}{counts[k] ? ` (${counts[k]})` : ''}
              </button>
            ))}
            <button type="button" onClick={loadOrders} className="ms-auto p-1.5 rounded border hover:bg-gray-50" title={t('تحديث', 'Refresh')}><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>{[t('الطلب', 'Order'), t('المتجر', 'Store'), t('التاريخ', 'Date'), t('العميل', 'Customer'),
                  t('الإجمالي', 'Total'), t('الحالة', 'Status'), t('الفاتورة', 'Invoice'), t('ملاحظات', 'Notes'), ''].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-start font-medium whitespace-nowrap">{h}</th>))}</tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">{t('لا توجد طلبات', 'No orders')}</td></tr>
                )}
                {orders.map((o) => {
                  const s = STATUS[o.status] || STATUS.received;
                  const od = o.order || {};
                  const canRetry = !['eta_submitted', 'cancelled'].includes(o.status);
                  const c = connById(o.connection_id);
                  return (
                    <tr key={o.id} className="border-t align-top">
                      <td className="px-3 py-2 font-medium" dir="ltr">{o.order_number || o.external_order_id}</td>
                      <td className="px-3 py-2">{o.connection_name || o.platform}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{od.date || (o.received_at || '').slice(0, 10)}</td>
                      <td className="px-3 py-2">{od.customer?.name || od.customer?.email || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap" dir="ltr">{money(od.total)} {od.currency}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${s.cls}`}>{s[ar ? 'ar' : 'en']}</span></td>
                      <td className="px-3 py-2" dir="ltr">{o.invoice_number || '—'}</td>
                      <td className="px-3 py-2 text-xs space-y-1 max-w-xs">
                        {o.error && <div className="text-red-600">{o.error}</div>}
                        {o.eta_error && <div className="text-amber-700">{t('الضرائب: ', 'ETA: ')}{o.eta_error}</div>}
                        {o.needs_credit_note && <div className="text-purple-700 font-medium">{t('أُلغي/استُرد في المتجر — أصدر إشعاراً دائناً يدوياً', 'Cancelled/refunded in the store — issue a credit note manually')}</div>}
                        {!!o.total_difference && <div className="text-gray-500">{t('فرق عن إجمالي المتجر: ', 'Difference from store total: ')}{money(o.total_difference)}</div>}
                        {o.status === 'needs_mapping' && c && (
                          <button type="button" onClick={() => openMap(c, o.unmapped_skus || [])} className="text-blue-600 underline">{t('ربط الأصناف', 'Map SKUs')}</button>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {canRetry && (
                          <button type="button" disabled={busy === o.id} onClick={() => retry(o)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-gray-50 disabled:opacity-50">
                            {busy === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}{t('إعادة', 'Retry')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'stores' && (
        <div className="space-y-4">
          {!showForm && (
            <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm">
              <Plus className="w-4 h-4" />{t('ربط متجر جديد', 'Connect a store')}
            </button>
          )}

          {showForm && (
            <form onSubmit={create} className="bg-white border rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <label className="space-y-1"><span className="text-gray-600">{t('اسم المتجر', 'Store name')}</span>
                <input required value={form.name} onChange={set('name')} className="w-full border rounded-lg px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-gray-600">{t('المنصة', 'Platform')}</span>
                <select value={form.platform} onChange={set('platform')} className="w-full border rounded-lg px-3 py-2">
                  {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p[ar ? 'ar' : 'en']}</option>)}</select></label>
              <label className="space-y-1"><span className="text-gray-600">{t('نطاق المتجر', 'Shop domain')}</span>
                <input dir="ltr" value={form.shop_domain} onChange={set('shop_domain')} placeholder="mystore.myshopify.com" className="w-full border rounded-lg px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-gray-600">{needsSecret
                ? t('مفتاح التوقيع من المنصة (مطلوب لـ Shopify / سلة)', 'Signing secret from the platform (Shopify / Salla)')
                : t('مفتاح التوقيع (اتركه فارغاً للتوليد)', 'Signing secret (empty → generated)')}</span>
                <input dir="ltr" required={needsSecret} value={form.webhook_secret} onChange={set('webhook_secret')} className="w-full border rounded-lg px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-gray-600">{t('العميل في الفاتورة', 'Invoice customer')}</span>
                <select value={form.customer_mode} onChange={set('customer_mode')} className="w-full border rounded-lg px-3 py-2">
                  <option value="auto">{t('عميل لكل بريد إلكتروني (إنشاء تلقائي)', 'One customer per email (auto-create)')}</option>
                  <option value="default">{t('عميل واحد ثابت لكل الطلبات', 'One fixed customer for all orders')}</option></select></label>
              <label className="space-y-1"><span className="text-gray-600">{t('العميل الافتراضي (طلبات بلا بريد)', 'Default customer (orders without email)')}</span>
                <select value={form.default_party_id} onChange={set('default_party_id')} required={form.customer_mode === 'default'} className="w-full border rounded-lg px-3 py-2">
                  <option value="">{t('— عميل المتجر يُنشأ تلقائياً —', '— store walk-in customer, auto —')}</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              <label className="space-y-1"><span className="text-gray-600">{t('المخزن', 'Warehouse')}</span>
                <select value={form.warehouse_id} onChange={set('warehouse_id')} className="w-full border rounded-lg px-3 py-2">
                  <option value="main">{t('الرئيسي', 'Main')}</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
              <label className="space-y-1"><span className="text-gray-600">{t('حساب التحصيل (بنك / خزينة / وسيط دفع)', 'Collection account (bank / cash / clearing)')}</span>
                <select value={form.payment_account_id} onChange={set('payment_account_id')} className="w-full border rounded-lg px-3 py-2">
                  <option value="">{t('— البنك الافتراضي (162) —', '— default bank (162) —')}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}</select></label>
              <label className="space-y-1"><span className="text-gray-600">{t('طريقة الدفع', 'Payment method')}</span>
                <select value={form.payment_method} onChange={set('payment_method')} className="w-full border rounded-lg px-3 py-2">
                  <option value="credit_card">{t('بطاقة / بوابة دفع', 'Card / gateway')}</option>
                  <option value="bank_transfer">{t('تحويل بنكي', 'Bank transfer')}</option>
                  <option value="mobile_wallet">{t('محفظة إلكترونية', 'Mobile wallet')}</option>
                  <option value="cash">{t('نقدي', 'Cash')}</option></select></label>
              <label className="space-y-1"><span className="text-gray-600">{t('ضريبة الشحن %', 'Shipping VAT %')}</span>
                <input type="number" min="0" step="0.01" value={form.shipping_tax_rate} onChange={set('shipping_tax_rate')} className="w-full border rounded-lg px-3 py-2" /></label>
              <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={form.auto_submit_eta} onChange={set('auto_submit_eta')} />
                {t('إرسال الفاتورة لمنظومة الفاتورة الإلكترونية تلقائياً (إن كان التكامل مفعّلاً)', 'Submit the invoice to ETA automatically (when the integration is active)')}</label>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" disabled={busy === 'create'} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">
                  {busy === 'create' && <Loader2 className="w-4 h-4 animate-spin" />}{t('إنشاء الربط', 'Create')}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border">{t('إلغاء', 'Cancel')}</button>
              </div>
            </form>
          )}

          {conns.length === 0 && !showForm && (
            <div className="text-center text-gray-400 py-10 border rounded-xl bg-white">{t('لا توجد متاجر مربوطة بعد', 'No stores connected yet')}</div>
          )}

          {conns.map((c) => (
            <div key={c.id} className="bg-white border rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.name} <span className="text-xs text-gray-500">· {(PLATFORMS.find((p) => p.id === c.platform) || {})[ar ? 'ar' : 'en']}</span></div>
                  <div className="text-xs text-gray-500" dir="ltr">{c.shop_domain}</div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button type="button" onClick={() => toggleActive(c)} className={`px-2 py-1 rounded border ${c.is_active ? 'text-green-700' : 'text-gray-500'}`}>
                    {c.is_active ? t('مفعّل', 'Active') : t('موقوف', 'Paused')}</button>
                  <button type="button" onClick={() => toggleEta(c)} className="px-2 py-1 rounded border">
                    {t('الضرائب تلقائياً: ', 'Auto ETA: ')}{c.auto_submit_eta ? t('نعم', 'yes') : t('لا', 'no')}</button>
                  <button type="button" onClick={() => openMap(c)} className="inline-flex items-center gap-1 px-2 py-1 rounded border"><Link2 className="w-3 h-3" />{t('ربط الأصناف', 'SKU mapping')} ({Object.keys(c.sku_map || {}).length})</button>
                  <button type="button" onClick={() => rotate(c)} className="inline-flex items-center gap-1 px-2 py-1 rounded border"><KeyRound className="w-3 h-3" />{t('تغيير المفتاح', 'Rotate secret')}</button>
                  <button type="button" onClick={() => remove(c)} className="p-1 rounded border text-red-600" title={t('حذف', 'Delete')}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <CopyField ar={ar} label={t('رابط الـ Webhook', 'Webhook URL')} value={c.webhook_url} />
              <div className="text-xs text-gray-500">
                {t('المخزن: ', 'Warehouse: ')}{c.warehouse_id === 'main' ? t('الرئيسي', 'Main') : ((warehouses.find((w) => w.id === c.warehouse_id) || {}).name || c.warehouse_id)}
                {' · '}{t('التحصيل: ', 'Collection: ')}{c.payment_account_code ? `${c.payment_account_code} ${c.payment_account_name || ''}` : '162'}
              </div>

              {mapFor?.id === c.id && (
                <div className="border-t pt-3 space-y-2">
                  <div className="text-sm font-medium">{t('ربط SKU المتجر بكود الصنف', 'Store SKU → product code')}</div>
                  <p className="text-xs text-gray-500">{t('الـ SKU المطابق لكود الصنف أو الباركود يُربط تلقائياً بدون إدخال.', 'A SKU equal to a product code or barcode matches without an entry.')}</p>
                  <table className="w-full text-sm">
                    <thead><tr className="text-gray-500 text-xs"><th className="text-start py-1">SKU</th><th className="text-start py-1">{t('الصنف', 'Product')}</th><th /></tr></thead>
                    <tbody>
                      {mapRows.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1 pe-2"><input dir="ltr" value={r.sku} onChange={(e) => setMapRows((rows) => rows.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))} className="w-full border rounded px-2 py-1" /></td>
                          <td className="py-1 pe-2">
                            <select value={r.code} onChange={(e) => setMapRows((rows) => rows.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))} className="w-full border rounded px-2 py-1">
                              <option value="">{t('— اختر —', '— choose —')}</option>
                              {products.map((p) => <option key={p.id} value={p.code}>{p.code} — {p.name}</option>)}
                            </select>
                          </td>
                          <td className="py-1"><button type="button" onClick={() => setMapRows((rows) => rows.filter((_, j) => j !== i))} className="p-1 text-red-600"><X className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMapRows((rows) => [...rows, { sku: '', code: '' }])} className="px-3 py-1.5 rounded border text-sm">{t('سطر', 'Row')} +</button>
                    <button type="button" disabled={busy === 'map'} onClick={saveMap} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50">{t('حفظ', 'Save')}</button>
                    <button type="button" onClick={() => setMapFor(null)} className="px-3 py-1.5 rounded border text-sm">{t('إغلاق', 'Close')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
