/**
 * دفتر الأستاذ العام
 *
 * Right pane: the chart of accounts, searchable by code or name (Arabic
 * spelling variants are normalised, so "اهلاك" finds "إهلاك"), filterable
 * by type. Header accounts are group titles, not selectable.
 * Left pane: the account statement read like a paper ledger — opening
 * balance, each posting with its running balance, closing balance. Balances
 * are labelled debit/credit instead of green/red, since a credit balance on
 * a liability is normal, not bad.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { BookOpen, Search, Download, Printer, Loader2, X, ChevronRight, ChevronLeft } from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const PAGE_SIZE = 200;
const DEBIT_NATURE = ['asset', 'expense', 'contra_liability', 'contra_equity'];

// Arabic-aware search: ignore diacritics, hamza forms, ta marbuta and alif maqsura
const normalize = (s = '') => String(s).toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();

const T = {
  ar: {
    title: 'دفتر الأستاذ العام', accounts: 'الحسابات', search: 'ابحث بالكود أو الاسم',
    all: 'الكل', asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات',
    pick: 'اختر حساباً من القائمة لعرض كشفه', noMatch: 'لا توجد حسابات مطابقة',
    from: 'من', to: 'إلى', clear: 'كل الفترات', export: 'تصدير', print: 'طباعة',
    date: 'التاريخ', entry: 'رقم القيد', desc: 'البيان', debit: 'مدين', credit: 'دائن', balance: 'الرصيد',
    opening: 'رصيد أول المدة', closing: 'رصيد آخر المدة', totals: 'إجمالي الحركة',
    noEntries: 'لا توجد حركات على هذا الحساب في الفترة المختارة', dr: 'مدين', cr: 'دائن',
    loadError: 'تعذّر تحميل البيانات — تحقق من الاتصال ثم أعد المحاولة', retry: 'إعادة المحاولة',
    page: 'صفحة', of: 'من', count: 'حساب', movements: 'حركة',
  },
  en: {
    title: 'General Ledger', accounts: 'Accounts', search: 'Search by code or name',
    all: 'All', asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', expense: 'Expenses',
    pick: 'Choose an account to see its statement', noMatch: 'No matching accounts',
    from: 'From', to: 'To', clear: 'All periods', export: 'Export', print: 'Print',
    date: 'Date', entry: 'Entry', desc: 'Description', debit: 'Debit', credit: 'Credit', balance: 'Balance',
    opening: 'Opening balance', closing: 'Closing balance', totals: 'Period movement',
    noEntries: 'No postings on this account in the selected period', dr: 'Dr', cr: 'Cr',
    loadError: 'Could not load data — check your connection and try again', retry: 'Retry',
    page: 'Page', of: 'of', count: 'accounts', movements: 'postings',
  },
};

const TYPE_GROUPS = { asset: ['asset', 'contra_asset'], liability: ['liability', 'contra_liability'],
  equity: ['equity', 'contra_equity'], revenue: ['revenue'], expense: ['expense'] };

const isHeader = (a) => a.is_header || a.account_category === 'header' || a.allow_posting === false;

export default function GeneralLedgerPage() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = T[isRTL ? 'ar' : 'en'];
  const fmt = (n) => Math.abs(Number(n) || 0).toLocaleString(isRTL ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [statement, setStatement] = useState(null);
  const [page, setPage] = useState(1);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementError, setStatementError] = useState(false);

  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const fetchAccounts = useCallback(async () => {
    setLoading(true); setAccountsError(false);
    try {
      const res = await axios.get(`${API_URL}/api/accounting/accounts`, auth());
      const list = res.data.accounts || res.data || [];
      setAccounts([...list].sort((a, b) => String(a.account_code).localeCompare(String(b.account_code))));
    } catch { setAccountsError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const fetchStatement = useCallback(async () => {
    if (!selected) return;
    setLoadingStatement(true); setStatementError(false);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (range.from) p.append('start_date', range.from);
      if (range.to) p.append('end_date', range.to);
      const res = await axios.get(`${API_URL}/api/accounting/ledger/account-statement/${selected.id}?${p}`, auth());
      setStatement(res.data);
    } catch { setStatementError(true); setStatement(null); } finally { setLoadingStatement(false); }
  }, [selected, range, page]);

  useEffect(() => { fetchStatement(); }, [fetchStatement]);
  useEffect(() => { setPage(1); }, [selected, range]);

  const visible = useMemo(() => {
    const q = normalize(query);
    const typeOk = (a) => typeFilter === 'all' || TYPE_GROUPS[typeFilter].includes(a.account_type);
    if (q) {
      return accounts.filter((a) => !isHeader(a) && typeOk(a) &&
        (normalize(a.account_code).startsWith(q) || normalize(a.account_name).includes(q) ||
         normalize(a.account_name_en).includes(q)));
    }
    return accounts.filter(typeOk);
  }, [accounts, query, typeFilter]);

  const side = (balance, type) => {
    const debitNature = DEBIT_NATURE.includes(type);
    if (!balance) return '';
    return (balance > 0) === debitNature ? t.dr : t.cr;
  };

  const entries = statement?.entries || [];
  const pages = statement?.pagination?.pages || 1;
  const total = statement?.pagination?.total ?? entries.length;
  const nature = statement?.nature || (DEBIT_NATURE.includes(selected?.account_type) ? 'debit' : 'credit');
  const balType = nature === 'debit' ? 'asset' : 'liability';

  const exportCsv = () => {
    if (!statement) return;
    const rows = [[t.date, t.entry, t.desc, t.debit, t.credit, t.balance]];
    rows.push(['', '', t.opening, '', '', `${fmt(statement.opening_balance)} ${side(statement.opening_balance, balType)}`]);
    entries.forEach((e) => rows.push([e.entry_date?.slice(0, 10), e.entry_number ?? '', e.description ?? '',
      e.debit || '', e.credit || '', `${fmt(e.balance)} ${side(e.balance, balType)}`]));
    rows.push(['', '', t.closing, statement.total_debit, statement.total_credit,
      `${fmt(statement.closing_balance)} ${side(statement.closing_balance, balType)}`]);
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `ledger_${selected.account_code}.csv` });
    a.click(); URL.revokeObjectURL(url);
  };

  const num = 'tabular-nums whitespace-nowrap text-end';
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="gl-page min-h-full bg-slate-50 text-slate-800">
      <style>{`@media print {
        body * { visibility: hidden; } .gl-print, .gl-print * { visibility: visible; }
        .gl-print { position: absolute; inset: 0; } .gl-noprint { display: none !important; } }`}</style>

      <header className="gl-noprint flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          <h1 className="text-xl font-extrabold text-slate-900">{t.title}</h1>
        </div>
        {!loading && !accountsError && (
          <span className="text-sm text-slate-500">
            {accounts.filter((a) => !isHeader(a)).length.toLocaleString(isRTL ? 'ar-EG' : 'en-US')} {t.count}
          </span>
        )}
      </header>

      <div className="grid lg:grid-cols-[360px_1fr] gap-0 lg:gap-6 p-0 lg:p-6">
        {/* ── Accounts ─────────────────────────────── */}
        <aside className="gl-noprint bg-white lg:rounded-xl border-b lg:border border-slate-200 flex flex-col lg:max-h-[calc(100vh-10rem)] lg:sticky lg:top-6">
          <div className="p-3 space-y-2 border-b border-slate-100">
            <label className="relative block">
              <span className="sr-only">{t.search}</span>
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" aria-hidden />
              <input
                type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search}
                className="w-full ps-9 pe-9 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40 focus:border-[#1e3a8a]"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="clear"
                  className="absolute top-1/2 -translate-y-1/2 end-2 p-1 rounded text-slate-400 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-[#1e3a8a]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {['all', 'asset', 'liability', 'equity', 'revenue', 'expense'].map((k) => (
                <button key={k} role="radio" aria-checked={typeFilter === k} onClick={() => setTypeFilter(k)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border focus-visible:ring-2 focus-visible:ring-[#1e3a8a] ${
                    typeFilter === k ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  {t[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto max-h-72 lg:max-h-none flex-1">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : accountsError ? (
              <div className="p-6 text-center text-sm text-slate-600">
                <p>{t.loadError}</p>
                <button onClick={fetchAccounts} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white text-sm">{t.retry}</button>
              </div>
            ) : visible.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">{t.noMatch}</p>
            ) : (
              <ul>
                {visible.map((a) => {
                  const depth = query ? 0 : Math.min(Math.max(String(a.account_code).length - 1, 0), 3);
                  if (isHeader(a)) {
                    return (
                      <li key={a.id} style={{ paddingInlineStart: `${0.75 + depth * 0.9}rem` }}
                        className={`pe-3 pt-3 pb-1 text-slate-900 ${depth === 0 ? 'text-sm font-extrabold' : 'text-xs font-bold text-slate-600'}`}>
                        <span className="tabular-nums text-slate-400 me-1.5">{a.account_code}</span>{a.account_name}
                      </li>
                    );
                  }
                  const active = selected?.id === a.id;
                  return (
                    <li key={a.id}>
                      <button onClick={() => setSelected(a)} aria-current={active}
                        style={{ paddingInlineStart: `${0.75 + depth * 0.9}rem` }}
                        className={`w-full pe-3 py-2 flex items-center gap-2 text-start text-sm border-s-[3px] focus-visible:outline-none focus-visible:bg-slate-100 ${
                          active ? 'bg-blue-50 border-[#1e3a8a]' : 'border-transparent hover:bg-slate-50'}`}>
                        <span className="tabular-nums text-slate-400 w-12 shrink-0">{a.account_code}</span>
                        <span className="flex-1 truncate">{a.account_name}</span>
                        {!!a.current_balance && (
                          <span className={`${num} text-xs text-slate-600`}>
                            {fmt(a.current_balance)} <span className="text-slate-400">{side(a.current_balance, a.account_type)}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* ── Statement ───────────────────────────── */}
        <section className="gl-print bg-white lg:rounded-xl lg:border border-slate-200 min-h-[24rem]">
          {!selected ? (
            <div className="h-full min-h-[24rem] flex items-center justify-center p-8 text-center text-slate-500">
              <p>{t.pick}</p>
            </div>
          ) : (
            <>
              <div className="px-4 md:px-6 pt-5 pb-4 border-b border-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="tabular-nums text-sm text-slate-500">{selected.account_code}</p>
                    <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{selected.account_name}</h2>
                    {selected.account_name_en && <p className="text-sm text-slate-500">{selected.account_name_en}</p>}
                  </div>
                  <div className="gl-noprint flex flex-wrap items-end gap-2">
                    <label className="text-xs text-slate-500">{t.from}
                      <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })}
                        className="block mt-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                    </label>
                    <label className="text-xs text-slate-500">{t.to}
                      <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })}
                        className="block mt-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                    </label>
                    {(range.from || range.to) && (
                      <button onClick={() => setRange({ from: '', to: '' })}
                        className="px-2.5 py-1.5 text-sm text-[#1e3a8a] hover:underline">{t.clear}</button>
                    )}
                    <button onClick={exportCsv} disabled={!statement}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-sm hover:bg-slate-50 disabled:opacity-40">
                      <Download className="w-4 h-4" />{t.export}
                    </button>
                    <button onClick={() => window.print()} disabled={!statement}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-sm hover:bg-slate-50 disabled:opacity-40">
                      <Printer className="w-4 h-4" />{t.print}
                    </button>
                  </div>
                </div>

                {statement && (
                  <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
                    {[[t.opening, statement.opening_balance, true], [t.debit, statement.total_debit, false],
                      [t.credit, statement.total_credit, false], [t.closing, statement.closing_balance, true]].map(([label, val, withSide], i) => (
                      <div key={i} className={i === 3 ? 'md:border-s md:ps-6 border-slate-200' : ''}>
                        <dt className="text-slate-500">{label}</dt>
                        <dd className={`tabular-nums font-bold ${i === 3 ? 'text-lg text-slate-900' : 'text-slate-700'}`}>
                          {fmt(val)}{withSide && <span className="ms-1 text-xs font-semibold text-slate-500">{side(val, balType)}</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>

              {loadingStatement ? (
                <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
              ) : statementError ? (
                <div className="p-10 text-center text-sm text-slate-600">
                  <p>{t.loadError}</p>
                  <button onClick={fetchStatement} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white">{t.retry}</button>
                </div>
              ) : !statement || total === 0 ? (
                <p className="p-10 text-center text-sm text-slate-500">{t.noEntries}</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200 bg-slate-50">
                          <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.date}</th>
                          <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.entry}</th>
                          <th scope="col" className="px-4 py-2.5 text-start font-semibold w-full">{t.desc}</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.debit}</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.credit}</th>
                          <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.balance}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page === 1 && (
                          <tr className="border-b border-slate-100 text-slate-500 italic">
                            <td className="px-4 py-2" colSpan={5}>{t.opening}</td>
                            <td className={`px-4 py-2 ${num}`}>{fmt(statement.opening_balance)} <span className="text-xs">{side(statement.opening_balance, balType)}</span></td>
                          </tr>
                        )}
                        {entries.map((e, i) => (
                          <tr key={e.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-2 tabular-nums whitespace-nowrap">{e.entry_date?.slice(0, 10)}</td>
                            <td className="px-4 py-2 tabular-nums text-slate-500">{e.entry_number ?? '—'}</td>
                            <td className="px-4 py-2">{e.description || '—'}</td>
                            <td className={`px-4 py-2 ${num}`}>{e.debit ? fmt(e.debit) : ''}</td>
                            <td className={`px-4 py-2 ${num}`}>{e.credit ? fmt(e.credit) : ''}</td>
                            <td className={`px-4 py-2 ${num} font-semibold`}>{fmt(e.balance)} <span className="text-xs text-slate-500 font-normal">{side(e.balance, balType)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                      {page === pages && (
                        <tfoot>
                          <tr className="border-t-2 border-slate-300 font-semibold">
                            <td className="px-4 py-2.5" colSpan={3}>{t.totals}</td>
                            <td className={`px-4 py-2.5 ${num}`}>{fmt(statement.total_debit)}</td>
                            <td className={`px-4 py-2.5 ${num}`}>{fmt(statement.total_credit)}</td>
                            <td />
                          </tr>
                          <tr className="bg-slate-50 font-extrabold text-slate-900">
                            <td className="px-4 py-3" colSpan={5}>{t.closing}</td>
                            <td className={`px-4 py-3 ${num}`}>{fmt(statement.closing_balance)} <span className="text-xs font-semibold text-slate-500">{side(statement.closing_balance, balType)}</span></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  <div className="gl-noprint flex items-center justify-between gap-3 px-4 py-3 text-sm text-slate-500">
                    <span className="tabular-nums">{total.toLocaleString(isRTL ? 'ar-EG' : 'en-US')} {t.movements}</span>
                    {pages > 1 && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                          className="p-1.5 rounded border border-slate-300 disabled:opacity-30" aria-label="previous"><PrevIcon className="w-4 h-4" /></button>
                        <span className="tabular-nums">{t.page} {page} {t.of} {pages}</span>
                        <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                          className="p-1.5 rounded border border-slate-300 disabled:opacity-30" aria-label="next"><NextIcon className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
