import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import {
  Search, X, Users, Briefcase, FileText, ShoppingBag,
  Package, CreditCard, Building2, Loader2, ArrowRight,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';

const CATEGORY_META = {
  employees: { icon: Users,       en: 'Employees',   ar: 'الموظفون',   route: '/dashboard?module=hr' },
  customers: { icon: Briefcase,   en: 'Customers',   ar: 'العملاء',    route: '/dashboard?module=financial' },
  suppliers: { icon: Building2,   en: 'Suppliers',   ar: 'الموردون',   route: '/dashboard?module=purchases' },
  invoices:  { icon: FileText,    en: 'Invoices',    ar: 'الفواتير',   route: '/dashboard?module=invoices' },
  purchases: { icon: ShoppingBag, en: 'Purchases',   ar: 'المشتريات',  route: '/dashboard?module=purchases' },
  products:  { icon: Package,     en: 'Inventory',   ar: 'المخزون',    route: '/dashboard?module=inventory' },
  banks:     { icon: CreditCard,  en: 'Banks',       ar: 'البنوك',     route: '/dashboard?module=financial' },
};

const GlobalSearch = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Open/close via Ctrl+K or Cmd+K, close via Escape
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({});
    }
  }, [open]);

  const runSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 1) {
      setResults({});
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/search/`,
        {
          params: { q },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setResults(res.data.results || {});
    } catch {
      setResults({});
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, runSearch]);

  const handleItemClick = (category) => {
    const route = CATEGORY_META[category]?.route;
    if (route) {
      navigate(route);
      setOpen(false);
    }
  };

  const total = Object.values(results).reduce((sum, arr) => sum + (arr?.length || 0), 0);

  return (
    <>
      {/* Trigger button (rendered by parent) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 transition-colors w-[260px] lg:w-[340px]"
        data-testid="global-search-trigger"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-start">
          {language === 'ar' ? 'بحث...' : 'Search...'}
        </span>
        <kbd className="text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 font-mono">
          Ctrl+K
        </kbd>
      </button>
      {/* Mobile icon-only trigger */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700"
        title={language === 'ar' ? 'بحث' : 'Search'}
        data-testid="global-search-trigger-mobile"
      >
        <Search className="h-4 w-4 text-slate-600 dark:text-slate-300" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
          data-testid="global-search-modal"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <Search className="h-5 w-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={language === 'ar' ? 'ابحث عن أي شيء (موظف، فاتورة، عميل...)' : 'Search anything (employee, invoice, customer...)'}
                className="flex-1 bg-transparent outline-none text-base text-slate-800 dark:text-slate-100 placeholder-slate-400"
                data-testid="global-search-input"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {query.trim() && !loading && total === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm">
                  {language === 'ar' ? 'لا توجد نتائج.' : 'No results.'}
                </div>
              )}
              {!query.trim() && (
                <div className="px-4 py-10 text-center text-slate-400 text-sm">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{language === 'ar' ? 'ابدأ بالكتابة للبحث في كل بيانات شركتك.' : 'Start typing to search across all your company data.'}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {Object.entries(CATEGORY_META).map(([key, meta]) => {
                      const Icon = meta.icon;
                      return (
                        <span key={key} className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-full">
                          <Icon className="h-3 w-3" />
                          {language === 'ar' ? meta.ar : meta.en}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.entries(results).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                const meta = CATEGORY_META[category];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <div key={category} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {language === 'ar' ? meta.ar : meta.en}
                      <span className="ml-auto text-slate-400 font-normal">{items.length}</span>
                    </div>
                    {items.map((it, idx) => (
                      <button
                        key={`${category}-${idx}`}
                        onClick={() => handleItemClick(category)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-start"
                        data-testid={`search-result-${category}-${idx}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {it.name || it.full_name || it.invoice_number || it.purchase_number || it.email || '—'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {it.email || it.position || it.customer_name || it.supplier_name || it.role || it.sku || it.account_number || ''}
                            {it.total != null && ` · ${it.total} EGP`}
                            {it.balance != null && ` · ${it.balance} EGP`}
                            {it.quantity != null && ` · qty: ${it.quantity}`}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300" />
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 flex justify-between">
              <span>
                <kbd className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 font-mono">↵</kbd>
                <span className="mx-1">{language === 'ar' ? 'فتح' : 'open'}</span>
                <kbd className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
                <span className="mx-1">{language === 'ar' ? 'إغلاق' : 'close'}</span>
              </span>
              <span>{total} {language === 'ar' ? 'نتيجة' : 'results'}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalSearch;
