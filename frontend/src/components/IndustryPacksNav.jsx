/**
 * التخصصات القطاعية في القائمة الجانبية.
 *
 * The packs were reachable only from the subscription page, so a customer
 * browsing the app never learned they existed. This puts them where the work
 * is: what is already active opens its screen, and what is not shows its
 * monthly price and a way to add it.
 *
 * Prices come from the backend, not from a copy kept here — the pricing page
 * once drifted from the system and sold packs that did not exist.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Layers, Check } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const ICONS = {
  construction: '🏗️', real_estate: '🏢', manufacturing: '🏭', import: '🚢', export: '🌍',
  restaurants: '🍽️', medical: '🏥', ads: '📣', professional: '⚖️',
  retail: '🛒', logistics: '🚚', education: '🎓',
};

export default function IndustryPacksNav({ language = 'ar', onNavigate }) {
  const ar = language === 'ar';
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/subscriptions/industry-packs`, auth());
      setSummary({
        active: (data.packs || []).filter((p) => p.active),
        pending: data.pending_count || 0,
        total: (data.packs || []).length,
        included: Boolean(data.included_in_plan),
      });
    } catch { setSummary({ active: [], pending: 0, total: 0 }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!summary) return null;

  // The menu shows what the company has, plus one way in to add another. The
  // catalogue with the twelve packs and their prices belongs on the
  // subscription page — a sidebar full of priced items is a price list, not
  // navigation.
  return (
    <div className="mt-2" dir={ar ? 'rtl' : 'ltr'}>
      {summary.active.length > 0 && (
        <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {ar ? 'التخصصات القطاعية' : 'Industry'}
        </p>
      )}

      {summary.active.map((p) => (
        <button key={p.key} onClick={() => onNavigate?.(`pack_${p.key}`)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
          <span aria-hidden>{ICONS[p.key] || '📁'}</span>
          <span className="flex-1 text-start truncate">{ar ? p.name_ar : p.name_en}</span>
          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
        </button>
      ))}

      <button onClick={() => onNavigate?.('subscription')}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700">
        <Layers className="w-4 h-4 shrink-0" aria-hidden />
        <span className="flex-1 text-start">
          {summary.active.length > 0 ? (ar ? 'إضافة تخصص آخر' : 'Add another')
                                     : (ar ? 'إضافة تخصص قطاعي' : 'Add an industry pack')}
        </span>
        {summary.pending > 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 whitespace-nowrap">
            {ar ? 'بانتظار السداد' : 'Pending'}
          </span>
        )}
      </button>
    </div>
  );
}
