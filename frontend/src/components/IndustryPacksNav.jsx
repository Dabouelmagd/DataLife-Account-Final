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
import { Layers, Plus, Check, ChevronDown, Loader2 } from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const ICONS = {
  construction: '🏗️', real_estate: '🏢', manufacturing: '🏭', import: '🚢', export: '🌍',
  restaurants: '🍽️', medical: '🏥', ads: '📣', professional: '⚖️',
  retail: '🛒', logistics: '🚚', education: '🎓',
};

export default function IndustryPacksNav({ language = 'ar', onNavigate }) {
  const ar = language === 'ar';
  const [packs, setPacks] = useState(null);
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/subscriptions/industry-packs`, auth());
      setPacks(data.packs || []);
    } catch { setPacks([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (packs === null) {
    return <div className="px-3 py-2"><Loader2 className="w-4 h-4 animate-spin text-white/40" /></div>;
  }
  if (packs.length === 0) return null;

  const active = packs.filter((p) => p.active);
  const available = packs.filter((p) => !p.active);
  const shown = showAll ? available : available.slice(0, 3);

  return (
    <div className="mt-4" dir={ar ? 'rtl' : 'ltr'}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/50 hover:text-white/70">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" aria-hidden />
          {ar ? 'التخصصات القطاعية' : 'Industry add-ons'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? '' : 'rotate-180'}`} aria-hidden />
      </button>

      {open && (
        <div className="mt-1 space-y-0.5">
          {active.map((p) => (
            <button key={p.key} onClick={() => onNavigate?.(`pack_${p.key}`)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/10">
              <span aria-hidden>{ICONS[p.key] || '📁'}</span>
              <span className="flex-1 text-start truncate">{ar ? p.name_ar : p.name_en}</span>
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden />
            </button>
          ))}

          {shown.map((p) => (
            <button key={p.key} onClick={() => onNavigate?.('subscription')}
              title={p.note_ar}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:bg-white/10 hover:text-white/80">
              <span className="opacity-60" aria-hidden>{ICONS[p.key] || '📁'}</span>
              <span className="flex-1 text-start truncate">{ar ? p.name_ar : p.name_en}</span>
              {p.price_egp != null && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 whitespace-nowrap tabular-nums">
                  {p.price_egp} {ar ? 'ج/شهر' : 'EGP/mo'}
                </span>
              )}
              <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden />
            </button>
          ))}

          {available.length > shown.length && (
            <button onClick={() => setShowAll(true)}
              className="w-full px-3 py-1.5 text-[11px] text-white/50 hover:text-white/80 text-start">
              {ar ? `عرض ${available.length - shown.length} تخصصاً آخر…` : `${available.length - shown.length} more…`}
            </button>
          )}

          {active.length === 0 && (
            <p className="px-3 pt-1 text-[11px] leading-5 text-white/40">
              {ar ? 'اشتراكك الأساسي يشغّل الشركة بالكامل — التخصص إضافة اختيارية فوقه.'
                  : 'Your base subscription runs everything; an add-on is optional.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
