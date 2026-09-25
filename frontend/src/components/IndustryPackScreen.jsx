/**
 * شاشة التخصص المفعّل.
 *
 * Clicking an active pack in the sidebar led to a screen that did not exist
 * ("هذه الصفحة غير متاحة"), which reads as a broken product rather than a
 * missing page. A pack is a set of accounts added to the chart plus the
 * screens that use them, so that is what this shows: what it added, where the
 * work actually happens, and the state of the subscription behind it.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Layers, Check, Loader2, ArrowLeft, BookOpen, Calendar, AlertTriangle,
} from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// where a pack's day-to-day work is done
const PACK_MODULES = {
  construction: ['projects', 'invoices', 'purchases'],
  real_estate: ['projects', 'invoices', 'parties'],
  manufacturing: ['inventory', 'products', 'financial'],
  import: ['purchases', 'inventory', 'financial'],
  export: ['invoices', 'parties', 'financial'],
  restaurants: ['inventory', 'invoices', 'financial'],
  medical: ['invoices', 'parties', 'inventory'],
  ads: ['projects', 'invoices', 'parties'],
  professional: ['projects', 'invoices', 'parties'],
  retail: ['inventory', 'products', 'invoices'],
  logistics: ['projects', 'invoices', 'financial'],
  education: ['parties', 'invoices', 'financial'],
};
const MODULE_LABELS = {
  projects: 'المشاريع', invoices: 'الفواتير', purchases: 'المشتريات',
  inventory: 'المخزون', products: 'الأصناف', financial: 'الإدارة المالية',
  parties: 'العملاء والموردون',
};

export default function IndustryPackScreen({ packKey, language = 'ar', onNavigate }) {
  const ar = language === 'ar';
  const [pack, setPack] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/subscriptions/industry-packs`, auth());
      const found = (data.packs || []).find((p) => p.key === packKey) || null;
      setPack(found);
      if (found?.active) {
        // the pack's own accounts, as they now stand in this company's chart
        const res = await axios.get(
          `${API}/api/subscriptions/industry-packs/${packKey}/accounts`, auth());
        setAccounts(res.data?.accounts || []);
      }
    } catch { setPack(null); } finally { setLoading(false); }
  }, [packKey]);
  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>;
  }

  if (!pack) {
    return (
      <div dir={ar ? 'rtl' : 'ltr'} className="p-8 text-center text-slate-600">
        {ar ? 'هذا التخصص غير موجود.' : 'Unknown add-on.'}
      </div>
    );
  }

  if (!pack.active) {
    return (
      <div dir={ar ? 'rtl' : 'ltr'} className="max-w-xl mx-auto p-8 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" aria-hidden />
        <h2 className="text-xl font-extrabold">{ar ? pack.name_ar : pack.name_en}</h2>
        <p className="mt-2 text-slate-600">
          {pack.pending_payment
            ? (ar ? `طلبك مسجّل — المستحق ${Number(pack.amount_due || 0).toLocaleString()} ج.م. يُفعَّل بعد تأكيد السداد.`
                  : 'Requested — activates once payment is confirmed.')
            : (ar ? 'هذا التخصص غير مفعّل لشركتك.' : 'This add-on is not active.')}
        </p>
        <button onClick={() => onNavigate?.('subscription')}
          className="mt-4 px-4 py-2 rounded-lg bg-[#1e3a8a] text-white font-semibold">
          {ar ? 'صفحة الاشتراك' : 'Subscription'}
        </button>
      </div>
    );
  }

  const modules = PACK_MODULES[packKey] || [];

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4 text-slate-800">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <Layers className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
            {ar ? pack.name_ar : pack.name_en}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
              <Check className="w-3 h-3" aria-hidden />{ar ? 'مفعّل' : 'Active'}
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">{pack.note_ar}</p>
        </div>
        <button onClick={() => onNavigate?.('subscription')}
          className="text-sm font-semibold text-[#1e3a8a] flex items-center gap-1">
          <Calendar className="w-4 h-4" aria-hidden />{ar ? 'إدارة الاشتراك' : 'Manage'}
        </button>
      </div>

      {modules.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-bold mb-1">{ar ? 'أين تستخدمه' : 'Where you use it'}</h3>
          <p className="text-sm text-slate-600 mb-3">
            {ar ? 'التخصص يضيف حسابات نشاطك إلى الشجرة — والعمل اليومي يتم من هذه الشاشات.'
                : 'The add-on extends your chart; the work happens in these screens.'}
          </p>
          <div className="flex flex-wrap gap-2">
            {modules.map((m) => (
              <button key={m} onClick={() => onNavigate?.(m)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5">
                {MODULE_LABELS[m] || m}
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-bold flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-[#1e3a8a]" aria-hidden />
          {ar ? `الحسابات المضافة (${accounts.length || pack.accounts_count})` : `Accounts added (${pack.accounts_count})`}
        </h3>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            {ar ? 'تعذّر تحميل الحسابات — افتح شجرة الحسابات لعرضها.' : 'Open the chart of accounts to view them.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-slate-500 border-b border-slate-200">
              <th scope="col" className="py-2 text-start font-semibold w-24">{ar ? 'الرقم' : 'Code'}</th>
              <th scope="col" className="py-2 text-start font-semibold">{ar ? 'الاسم' : 'Name'}</th>
              <th scope="col" className="py-2 text-end font-semibold">{ar ? 'الرصيد' : 'Balance'}</th>
            </tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.account_code} className="border-b border-slate-100">
                  <td className="py-2 font-mono" dir="ltr">{a.account_code}</td>
                  <td className="py-2">{a.account_name}</td>
                  <td className="py-2 text-end tabular-nums">
                    {Number(a.current_balance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
