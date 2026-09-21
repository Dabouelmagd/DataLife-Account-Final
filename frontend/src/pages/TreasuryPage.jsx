/**
 * الخزينة والبنوك — replaces the sample-data TreasuryModule.
 *
 * - Balances and movements of 161 (treasury) and 162 (bank) come straight
 *   from the general ledger, with opening, running and closing balances.
 * - Receipt / payment vouchers create a journal entry and post it at once:
 *     سند قبض   من ح/ الخزينة أو البنك   ← إلى ح/ الحساب المقابل
 *     سند صرف   من ح/ الحساب المقابل    ← إلى ح/ الخزينة أو البنك
 * - Cheques run through /api/treasury; every step posts its own entry.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Landmark, ArrowDownToLine, ArrowUpFromLine, X, Loader2, Search } from 'lucide-react';

const API_URL = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const CASH = '161';
const BANK = '162';
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
const normalize = (s = '') => String(s ?? '').toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
const isHeader = (a) => a.is_header || a.account_category === 'header' || a.allow_posting === false;

const T = {
  ar: {
    title: 'الخزينة والبنوك', cash: 'الخزينة', bank: 'البنك', cheques: 'الشيكات',
    receipt: 'سند قبض', payment: 'سند صرف', from: 'من', to: 'إلى', allTime: 'كل الفترات',
    date: 'التاريخ', entry: 'رقم القيد', desc: 'البيان', debit: 'مدين', credit: 'دائن', balance: 'الرصيد',
    opening: 'رصيد أول المدة', closing: 'رصيد آخر المدة', noMoves: 'لا توجد حركات في هذه الفترة',
    amount: 'المبلغ', via: 'الحساب', counter: 'الحساب المقابل', counterHint: 'ابحث بالكود أو الاسم',
    reference: 'المرجع', save: 'حفظ وترحيل القيد', cancel: 'إلغاء', close: 'إغلاق', done: 'تم الترحيل إلى دفتر الأستاذ',
    required: 'أكمل المبلغ والحساب المقابل والبيان', loadError: 'تعذّر التحميل — تحقق من الاتصال', retry: 'إعادة المحاولة',
    receiveCheque: 'استلام شيك من عميل', issueCheque: 'إصدار شيك لمورد', incoming: 'وارد', outgoing: 'صادر',
    party: 'الطرف', number: 'رقم الشيك', due: 'الاستحقاق', status: 'الحالة', actions: 'إجراء',
    customer: 'العميل', supplier: 'المورد', payerBank: 'بنك العميل', noCheques: 'لا توجد شيكات',
    deposit: 'إيداع بالبنك', collect: 'تم التحصيل', bounce: 'مرتد', clear: 'تم الصرف', fees: 'مصاريف الارتداد',
    reason: 'سبب الارتداد', confirm: 'تأكيد وترحيل', pending: 'تحت التحصيل',
    st: { received: 'مستلم', under_collection: 'تحت التحصيل', collected: 'محصّل', bounced: 'مرتد', issued: 'صادر — لم يُصرف', cleared: 'صُرف' },
  },
  en: {
    title: 'Treasury & banks', cash: 'Treasury', bank: 'Bank', cheques: 'Cheques',
    receipt: 'Receipt voucher', payment: 'Payment voucher', from: 'From', to: 'To', allTime: 'All periods',
    date: 'Date', entry: 'Entry', desc: 'Description', debit: 'Debit', credit: 'Credit', balance: 'Balance',
    opening: 'Opening balance', closing: 'Closing balance', noMoves: 'No movements in this period',
    amount: 'Amount', via: 'Account', counter: 'Counter account', counterHint: 'Search by code or name',
    reference: 'Reference', save: 'Save and post entry', cancel: 'Cancel', close: 'Close', done: 'Posted to the general ledger',
    required: 'Enter the amount, counter account and description', loadError: 'Could not load — check your connection', retry: 'Retry',
    receiveCheque: 'Receive customer cheque', issueCheque: 'Issue supplier cheque', incoming: 'In', outgoing: 'Out',
    party: 'Party', number: 'Cheque no.', due: 'Due', status: 'Status', actions: 'Action',
    customer: 'Customer', supplier: 'Supplier', payerBank: "Customer's bank", noCheques: 'No cheques',
    deposit: 'Deposit', collect: 'Collected', bounce: 'Bounced', clear: 'Cleared', fees: 'Bounce fees',
    reason: 'Reason', confirm: 'Confirm and post', pending: 'Under collection',
    st: { received: 'Received', under_collection: 'Under collection', collected: 'Collected', bounced: 'Bounced', issued: 'Issued — not cleared', cleared: 'Cleared' },
  },
};

// next step for a cheque in its lifecycle: [action, endpoint, body builder]
const NEXT = {
  received: [['deposit', 'deposit', (id, d) => ({ cheque_id: id, deposit_date: d, bank_account_code: BANK })]],
  under_collection: [
    ['collect', 'collect', (id, d) => ({ cheque_id: id, collection_date: d, bank_account_code: BANK })],
    ['bounce', 'bounce', (id, d, x) => ({ cheque_id: id, bounce_date: d, bounce_fees: Number(x.fees) || 0, bounce_reason: x.reason || undefined })],
  ],
  issued: [['clear', 'clear-outgoing', (id, d) => ({ cheque_id: id, clear_date: d, bank_account_code: BANK })]],
};

export default function TreasuryPage() {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const t = T[isRTL ? 'ar' : 'en'];
  const loc = isRTL ? 'ar-EG' : 'en-US';
  const fmt = (n) => (Number(n) || 0).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState('cash');
  const [range, setRange] = useState({ from: monthStart(), to: '' });
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cheques, setCheques] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [counterQuery, setCounterQuery] = useState('');
  const [chequeForm, setChequeForm] = useState(null);
  const [parties, setParties] = useState([]);
  const [action, setAction] = useState(null);           // { cheque, key, endpoint, build, date, fees, reason }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const byCode = useMemo(() => Object.fromEntries(accounts.map((a) => [a.account_code, a])), [accounts]);
  const counterOptions = useMemo(() => {
    const q = normalize(counterQuery);
    return accounts.filter((a) => !isHeader(a) && ![CASH, BANK].includes(a.account_code) &&
      (!q || normalize(a.account_code).startsWith(q) || normalize(a.account_name).includes(q))).slice(0, 40);
  }, [accounts, counterQuery]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/accounting/accounts`, auth());
      setAccounts([...(res.data.accounts || res.data || [])].sort((a, b) => String(a.account_code).localeCompare(String(b.account_code))));
    } catch { setError(true); }
  }, []);

  const loadStatement = useCallback(async () => {
    const acc = byCode[tab === 'bank' ? BANK : CASH];
    if (!acc) return;
    setLoading(true); setError(false);
    try {
      const p = new URLSearchParams({ limit: '500' });
      if (range.from) p.append('start_date', range.from);
      if (range.to) p.append('end_date', range.to);
      setStatement((await axios.get(`${API_URL}/api/accounting/ledger/account-statement/${acc.id}?${p}`, auth())).data);
    } catch { setError(true); } finally { setLoading(false); }
  }, [byCode, tab, range]);

  const loadCheques = useCallback(async () => {
    setLoading(true); setError(false);
    try { setCheques((await axios.get(`${API_URL}/api/treasury/cheques?limit=200`, auth())).data); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);
  useEffect(() => { if (tab === 'cheques') loadCheques(); else loadStatement(); }, [tab, loadStatement, loadCheques]);

  const refresh = async () => { await loadAccounts(); if (tab === 'cheques') await loadCheques(); else await loadStatement(); };

  const saveVoucher = async () => {
    const amt = Number(voucher.amount);
    if (!(amt > 0) || !voucher.counter || !voucher.description?.trim()) { setMsg({ type: 'err', text: t.required }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    const money = byCode[voucher.via];
    const lines = voucher.kind === 'receipt'
      ? [{ account_id: money.id, debit: amt, credit: 0 }, { account_id: voucher.counter.id, debit: 0, credit: amt }]
      : [{ account_id: voucher.counter.id, debit: amt, credit: 0 }, { account_id: money.id, debit: 0, credit: amt }];
    try {
      const res = await axios.post(`${API_URL}/api/accounting/journal-entries`, {
        entry_date: voucher.date, description: voucher.description.trim(), reference: voucher.reference || undefined,
        lines: lines.map((l) => ({ ...l, description: voucher.description.trim() })),
      }, auth());
      await axios.post(`${API_URL}/api/accounting/journal-entries/${res.data.entry.id}/post`, {}, auth());
      setVoucher(null); setMsg({ type: 'ok', text: t.done }); await refresh();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || t.loadError }); } finally { setBusy(false); }
  };

  const openChequeForm = async (direction) => {
    setChequeForm({ direction, party: '', amount: '', cheque_number: '', cheque_date: today(), date: today(), bank_name: '' });
    setMsg({ type: '', text: '' });
    try {
      const url = direction === 'incoming' ? '/api/financial/customers?limit=500' : '/api/purchases/suppliers';
      const d = (await axios.get(`${API_URL}${url}`, auth())).data;
      setParties(Array.isArray(d) ? d : d.data || d.customers || []);
    } catch { setParties([]); }
  };

  const saveCheque = async () => {
    const f = chequeForm; const p = parties.find((x) => x.id === f.party);
    if (!p || !(Number(f.amount) > 0) || !f.cheque_number) { setMsg({ type: 'err', text: t.required }); return; }
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      if (f.direction === 'incoming') {
        await axios.post(`${API_URL}/api/treasury/cheques/receive`, { customer_id: p.id, customer_name: p.name, amount: Number(f.amount),
          cheque_number: f.cheque_number, cheque_date: f.cheque_date, receive_date: f.date, bank_name: f.bank_name || undefined }, auth());
      } else {
        await axios.post(`${API_URL}/api/treasury/cheques/issue`, { supplier_id: p.id, supplier_name: p.name, amount: Number(f.amount),
          cheque_number: f.cheque_number, cheque_date: f.cheque_date, issue_date: f.date, bank_account_code: BANK }, auth());
      }
      setChequeForm(null); setMsg({ type: 'ok', text: t.done }); await refresh();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || t.loadError }); } finally { setBusy(false); }
  };

  const runAction = async () => {
    setBusy(true); setMsg({ type: '', text: '' });
    try {
      await axios.put(`${API_URL}/api/treasury/cheques/${action.cheque.id}/${action.endpoint}`,
        action.build(action.cheque.id, action.date, action), auth());
      setAction(null); setMsg({ type: 'ok', text: t.done }); await refresh();
    } catch (e) { setMsg({ type: 'err', text: e.response?.data?.detail || t.loadError }); } finally { setBusy(false); }
  };

  const input = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/40';
  const num = 'tabular-nums whitespace-nowrap text-end';
  const side = (b) => (!b ? '' : b > 0 ? (isRTL ? 'مدين' : 'Dr') : (isRTL ? 'دائن' : 'Cr'));
  const accBal = (code) => byCode[code]?.current_balance || 0;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-full bg-slate-50 text-slate-800">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-[#1e3a8a]" aria-hidden />
          <h1 className="text-xl font-extrabold text-slate-900">{t.title}</h1>
        </div>
        <dl className="flex items-center gap-6 text-end">
          {[[t.cash, CASH], [t.bank, BANK]].map(([l, c]) => (
            <div key={c}><dt className="text-xs text-slate-500">{l}</dt>
              <dd className="tabular-nums text-lg font-extrabold">{fmt(Math.abs(accBal(c)))} <span className="text-xs font-semibold text-slate-500">{side(accBal(c))}</span></dd></div>
          ))}
          {cheques?.summary && (
            <div><dt className="text-xs text-slate-500">{t.pending}</dt>
              <dd className="tabular-nums text-lg font-extrabold">{fmt(cheques.summary.pending_collection)}</dd></div>
          )}
        </dl>
      </header>

      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5" role="tablist">
            {[['cash', t.cash], ['bank', t.bank], ['cheques', t.cheques]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`px-3.5 py-2 rounded-md text-sm font-semibold ${tab === k ? 'bg-[#1e3a8a] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{l}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {tab === 'cheques' ? (
              <>
                <button onClick={() => openChequeForm('incoming')} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold"><ArrowDownToLine className="w-4 h-4" />{t.receiveCheque}</button>
                <button onClick={() => openChequeForm('outgoing')} className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-sm font-semibold"><ArrowUpFromLine className="w-4 h-4" />{t.issueCheque}</button>
              </>
            ) : (
              <>
                <button onClick={() => { setVoucher({ kind: 'receipt', via: tab === 'bank' ? BANK : CASH, amount: '', date: today(), counter: null, description: '', reference: '' }); setCounterQuery(''); setMsg({ type: '', text: '' }); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold"><ArrowDownToLine className="w-4 h-4" />{t.receipt}</button>
                <button onClick={() => { setVoucher({ kind: 'payment', via: tab === 'bank' ? BANK : CASH, amount: '', date: today(), counter: null, description: '', reference: '' }); setCounterQuery(''); setMsg({ type: '', text: '' }); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#1e3a8a] text-[#1e3a8a] bg-white text-sm font-semibold"><ArrowUpFromLine className="w-4 h-4" />{t.payment}</button>
              </>
            )}
          </div>
        </div>

        {msg.text && !voucher && !chequeForm && !action && (
          <p className={`text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>
        )}

        {tab !== 'cheques' && (
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="text-xs text-slate-500">{t.from}<input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="block mt-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white" /></label>
            <label className="text-xs text-slate-500">{t.to}<input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="block mt-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm bg-white" /></label>
            <button onClick={() => setRange({ from: '', to: '' })} className="px-2.5 py-1.5 text-[#1e3a8a] hover:underline">{t.allTime}</button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-slate-400" /></div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-slate-600"><p>{t.loadError}</p>
              <button onClick={refresh} className="mt-3 px-3 py-1.5 rounded-md bg-[#1e3a8a] text-white">{t.retry}</button></div>
          ) : tab === 'cheques' ? (
            !cheques?.cheques?.length ? <p className="p-10 text-center text-sm text-slate-500">{t.noCheques}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                    {[t.number, t.party, t.due, t.amount, t.status, t.actions].map((h, i) => (
                      <th key={h} scope="col" className={`px-4 py-2.5 font-semibold ${i === 3 ? 'text-end' : 'text-start'}`}>{h}</th>))}
                  </tr></thead>
                  <tbody>
                    {cheques.cheques.map((c) => {
                      const overdue = ['received', 'issued', 'under_collection'].includes(c.status) && c.cheque_date && c.cheque_date <= today();
                      return (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="px-4 py-2.5 tabular-nums">{c.cheque_number}
                            <span className={`ms-2 text-xs ${c.direction === 'incoming' ? 'text-emerald-700' : 'text-slate-500'}`}>{c.direction === 'incoming' ? t.incoming : t.outgoing}</span></td>
                          <td className="px-4 py-2.5">{c.customer_name || c.supplier_name}</td>
                          <td className={`px-4 py-2.5 tabular-nums whitespace-nowrap ${overdue ? 'font-bold text-amber-700' : ''}`}>{c.cheque_date}</td>
                          <td className={`px-4 py-2.5 ${num} font-semibold`}>{fmt(c.amount)}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">{t.st[c.status] || c.status}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {(NEXT[c.status] || []).map(([key, endpoint, build]) => (
                              <button key={key} onClick={() => { setAction({ cheque: c, key, endpoint, build, date: today(), fees: '', reason: '' }); setMsg({ type: '', text: '' }); }}
                                className={`me-1.5 px-2.5 py-1 rounded text-xs font-semibold ${key === 'bounce' ? 'text-red-700 border border-red-200 hover:bg-red-50' : 'text-[#1e3a8a] border border-[#1e3a8a]/30 hover:bg-blue-50'}`}>{t[key]}</button>
                            ))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : !statement || statement.entries?.length === 0 ? (
            <div>
              {statement && <p className="px-4 pt-4 text-sm text-slate-500">{t.opening}: <strong className="tabular-nums">{fmt(Math.abs(statement.opening_balance))} {side(statement.opening_balance)}</strong></p>}
              <p className="p-10 text-center text-sm text-slate-500">{t.noMoves}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-slate-500 bg-slate-50 border-b border-slate-200">
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.date}</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold">{t.entry}</th>
                  <th scope="col" className="px-4 py-2.5 text-start font-semibold w-full">{t.desc}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.debit}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.credit}</th>
                  <th scope="col" className="px-4 py-2.5 text-end font-semibold">{t.balance}</th>
                </tr></thead>
                <tbody>
                  <tr className="border-b border-slate-100 text-slate-500 italic">
                    <td className="px-4 py-2" colSpan={5}>{t.opening}</td>
                    <td className={`px-4 py-2 ${num}`}>{fmt(Math.abs(statement.opening_balance))} <span className="text-xs">{side(statement.opening_balance)}</span></td>
                  </tr>
                  {statement.entries.map((e, i) => (
                    <tr key={e.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2 tabular-nums whitespace-nowrap">{e.entry_date?.slice(0, 10)}</td>
                      <td className="px-4 py-2 tabular-nums text-slate-500">{e.entry_number ?? '—'}</td>
                      <td className="px-4 py-2">{e.description || '—'}</td>
                      <td className={`px-4 py-2 ${num}`}>{e.debit ? fmt(e.debit) : ''}</td>
                      <td className={`px-4 py-2 ${num}`}>{e.credit ? fmt(e.credit) : ''}</td>
                      <td className={`px-4 py-2 ${num} font-semibold`}>{fmt(Math.abs(e.balance))} <span className="text-xs font-normal text-slate-500">{side(e.balance)}</span></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="bg-slate-50 font-extrabold border-t-2 border-slate-300">
                  <td className="px-4 py-3" colSpan={3}>{t.closing}</td>
                  <td className={`px-4 py-3 ${num}`}>{fmt(statement.total_debit)}</td>
                  <td className={`px-4 py-3 ${num}`}>{fmt(statement.total_credit)}</td>
                  <td className={`px-4 py-3 ${num}`}>{fmt(Math.abs(statement.closing_balance))} <span className="text-xs text-slate-500">{side(statement.closing_balance)}</span></td>
                </tr></tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Receipt / payment voucher ── */}
      {voucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-extrabold">{voucher.kind === 'receipt' ? t.receipt : t.payment}</h2>
              <button onClick={() => setVoucher(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <label><span className="text-slate-600">{t.amount} *</span>
                <input autoFocus type="number" min="0" step="0.01" dir="ltr" value={voucher.amount} onChange={(e) => setVoucher({ ...voucher, amount: e.target.value })} className={`${input} mt-1 tabular-nums`} /></label>
              <label><span className="text-slate-600">{t.date}</span>
                <input type="date" value={voucher.date} onChange={(e) => setVoucher({ ...voucher, date: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="sm:col-span-2"><span className="text-slate-600">{t.via}</span>
                <select value={voucher.via} onChange={(e) => setVoucher({ ...voucher, via: e.target.value })} className={`${input} mt-1 bg-white`}>
                  <option value={CASH}>{CASH} — {byCode[CASH]?.account_name || t.cash}</option>
                  <option value={BANK}>{BANK} — {byCode[BANK]?.account_name || t.bank}</option>
                </select></label>
              <div className="sm:col-span-2">
                <span className="text-slate-600">{t.counter} *</span>
                {voucher.counter ? (
                  <div className="mt-1 flex items-center justify-between px-3 py-2 border border-[#1e3a8a] rounded-md bg-blue-50">
                    <span><span className="tabular-nums text-slate-500 me-2">{voucher.counter.account_code}</span>{voucher.counter.account_name}</span>
                    <button onClick={() => setVoucher({ ...voucher, counter: null })} aria-label="change" className="p-0.5"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <label className="relative block mt-1">
                      <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" aria-hidden />
                      <input type="search" value={counterQuery} onChange={(e) => setCounterQuery(e.target.value)} placeholder={t.counterHint} className={`${input} ps-9`} />
                    </label>
                    <ul className="mt-1 max-h-44 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
                      {counterOptions.map((a) => (
                        <li key={a.id}><button onClick={() => setVoucher({ ...voucher, counter: a })} className="w-full text-start px-3 py-1.5 hover:bg-slate-50">
                          <span className="tabular-nums text-slate-400 me-2">{a.account_code}</span>{a.account_name}</button></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <label className="sm:col-span-2"><span className="text-slate-600">{t.desc} *</span>
                <input value={voucher.description} onChange={(e) => setVoucher({ ...voucher, description: e.target.value })} className={`${input} mt-1`} /></label>
              <label className="sm:col-span-2"><span className="text-slate-600">{t.reference}</span>
                <input value={voucher.reference} onChange={(e) => setVoucher({ ...voucher, reference: e.target.value })} className={`${input} mt-1`} dir="ltr" /></label>
            </div>
            {msg.text && <p className={`mx-5 mb-3 text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setVoucher(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm">{t.cancel}</button>
              <button onClick={saveVoucher} disabled={busy} className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receive / issue cheque ── */}
      {chequeForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-extrabold">{chequeForm.direction === 'incoming' ? t.receiveCheque : t.issueCheque}</h2>
              <button onClick={() => setChequeForm(null)} aria-label={t.close} className="p-1 rounded hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid sm:grid-cols-2 gap-3 text-sm">
              <label className="sm:col-span-2"><span className="text-slate-600">{chequeForm.direction === 'incoming' ? t.customer : t.supplier} *</span>
                <select value={chequeForm.party} onChange={(e) => setChequeForm({ ...chequeForm, party: e.target.value })} className={`${input} mt-1 bg-white`}>
                  <option value="">—</option>
                  {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></label>
              <label><span className="text-slate-600">{t.amount} *</span>
                <input type="number" min="0" step="0.01" dir="ltr" value={chequeForm.amount} onChange={(e) => setChequeForm({ ...chequeForm, amount: e.target.value })} className={`${input} mt-1 tabular-nums`} /></label>
              <label><span className="text-slate-600">{t.number} *</span>
                <input dir="ltr" value={chequeForm.cheque_number} onChange={(e) => setChequeForm({ ...chequeForm, cheque_number: e.target.value })} className={`${input} mt-1`} /></label>
              <label><span className="text-slate-600">{t.date}</span>
                <input type="date" value={chequeForm.date} onChange={(e) => setChequeForm({ ...chequeForm, date: e.target.value })} className={`${input} mt-1`} /></label>
              <label><span className="text-slate-600">{t.due}</span>
                <input type="date" value={chequeForm.cheque_date} onChange={(e) => setChequeForm({ ...chequeForm, cheque_date: e.target.value })} className={`${input} mt-1`} /></label>
              {chequeForm.direction === 'incoming' && (
                <label className="sm:col-span-2"><span className="text-slate-600">{t.payerBank}</span>
                  <input value={chequeForm.bank_name} onChange={(e) => setChequeForm({ ...chequeForm, bank_name: e.target.value })} className={`${input} mt-1`} /></label>
              )}
            </div>
            {msg.text && <p className={`mx-5 mb-3 text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setChequeForm(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm">{t.cancel}</button>
              <button onClick={saveCheque} disabled={busy} className="px-4 py-2 rounded-md bg-[#1e3a8a] text-white text-sm font-semibold disabled:opacity-50">{busy ? '…' : t.save}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cheque action ── */}
      {action && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-lg font-extrabold">{t[action.key]}</h2>
              <p className="text-sm text-slate-500 tabular-nums">{action.cheque.cheque_number} — {fmt(action.cheque.amount)}</p>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <label className="block"><span className="text-slate-600">{t.date}</span>
                <input type="date" value={action.date} onChange={(e) => setAction({ ...action, date: e.target.value })} className={`${input} mt-1`} /></label>
              {action.key === 'bounce' && (
                <>
                  <label className="block"><span className="text-slate-600">{t.fees}</span>
                    <input type="number" min="0" step="0.01" dir="ltr" value={action.fees} onChange={(e) => setAction({ ...action, fees: e.target.value })} className={`${input} mt-1 tabular-nums`} /></label>
                  <label className="block"><span className="text-slate-600">{t.reason}</span>
                    <input value={action.reason} onChange={(e) => setAction({ ...action, reason: e.target.value })} className={`${input} mt-1`} /></label>
                </>
              )}
            </div>
            {msg.text && <p className={`mx-5 mb-3 text-sm ${msg.type === 'err' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
              <button onClick={() => setAction(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm">{t.cancel}</button>
              <button onClick={runAction} disabled={busy} className={`px-4 py-2 rounded-md text-white text-sm font-semibold disabled:opacity-50 ${action.key === 'bounce' ? 'bg-red-700' : 'bg-[#1e3a8a]'}`}>{busy ? '…' : t.confirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
