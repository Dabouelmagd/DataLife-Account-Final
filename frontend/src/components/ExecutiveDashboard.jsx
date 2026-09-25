/**
 * لوحة القرار — the figures a decision rests on, above the counters.
 *
 * The dashboard counted documents: employees, invoices, products. None of
 * that decides anything. This shows cash, what is owed both ways, the month's
 * result, the tax position and what is overdue — read from the ledger, so it
 * cannot disagree with the financial statements.
 *
 * Sections appear according to the reader's own permissions, so this is not a
 * way around them.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Wallet, TrendingUp, TrendingDown, Receipt, AlertTriangle, Package,
  Users, Landmark, Loader2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ExecutiveDashboard({ language = 'ar', onNavigate }) {
  const ar = language === 'ar';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/analytics/executive-dashboard`, auth());
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || (ar ? 'تعذّر تحميل الأرقام' : 'Could not load'));
      setData({ sections: {} });
    }
  }, [ar]);
  useEffect(() => { load(); }, [load]);

  if (!data) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }
  if (error) return <p className="text-sm text-red-700 mb-4" role="alert">{error}</p>;

  const { sections = {} } = data;
  const fin = sections.financial;
  const tax = sections.tax;

  if (!data.has_data) {
    return (
      <div dir={ar ? 'rtl' : 'ltr'} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-900">
        {data.note || (ar ? 'لا توجد بيانات محاسبية بعد.' : 'No accounting data yet.')}
      </div>
    );
  }

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-4 mb-8">
      {/* the four that decide */}
      {fin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Figure icon={Wallet} tone="blue" label={ar ? 'النقدية والبنوك' : 'Cash & banks'}
                  value={money(fin.cash_and_banks)} onClick={() => onNavigate?.('financial')} />
          <Figure icon={ArrowDownRight} tone="emerald" label={ar ? 'مستحق لنا (عملاء)' : 'Receivables'}
                  value={money(fin.receivables)} onClick={() => onNavigate?.('invoices')} />
          <Figure icon={ArrowUpRight} tone="rose" label={ar ? 'مستحق علينا (موردون)' : 'Payables'}
                  value={money(fin.payables)} onClick={() => onNavigate?.('purchases')} />
          <Figure icon={fin.month_profit >= 0 ? TrendingUp : TrendingDown}
                  tone={fin.month_profit >= 0 ? 'emerald' : 'rose'}
                  label={ar ? 'نتيجة الشهر' : 'This month'}
                  value={money(fin.month_profit)}
                  hint={ar ? `إيراد ${money(fin.month_revenue)} · مصروف ${money(fin.month_expenses)}`
                           : `Rev ${money(fin.month_revenue)} · Exp ${money(fin.month_expenses)}`} />
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* net position */}
        {fin && (
          <Panel title={ar ? 'المركز النقدي' : 'Net position'} icon={Landmark}>
            <Row label={ar ? 'نقدية + مستحق لنا' : 'Cash + receivables'}
                 value={money(fin.cash_and_banks + fin.receivables)} />
            <Row label={ar ? 'ناقص المستحق علينا' : 'Less payables'} value={`(${money(fin.payables)})`} />
            <Row label={ar ? 'الصافي' : 'Net'} value={money(fin.net_position)} strong
                 tone={fin.net_position >= 0 ? 'emerald' : 'rose'} />
            {fin.loans_outstanding > 0 && (
              <Row label={ar ? 'قروض قائمة' : 'Loans'} value={money(fin.loans_outstanding)} tone="rose" />
            )}
            <Row label={ar ? 'نتيجة العام حتى اليوم' : 'YTD result'} value={money(fin.ytd_profit)}
                 tone={fin.ytd_profit >= 0 ? 'emerald' : 'rose'} />
          </Panel>
        )}

        {/* tax */}
        {tax && (
          <Panel title={ar ? 'الموقف الضريبي' : 'Tax position'} icon={Receipt}
                 onClick={() => onNavigate?.('taxes')}>
            <Row label={ar ? 'ضريبة المخرجات' : 'Output VAT'} value={money(tax.vat_output)} />
            <Row label={ar ? 'ضريبة المدخلات' : 'Input VAT'} value={`(${money(tax.vat_input)})`} />
            <Row label={ar ? 'المستحق للمصلحة' : 'VAT due'} value={money(tax.vat_due)} strong
                 tone={tax.vat_due > 0 ? 'amber' : 'emerald'} />
            {tax.withholding_due > 0 && (
              <Row label={ar ? 'خصم وتحصيل مستحق' : 'Withholding'} value={money(tax.withholding_due)} />
            )}
            {tax.income_tax_accrued > 0 && (
              <Row label={ar ? 'ضريبة دخل مستحقة' : 'Income tax'} value={money(tax.income_tax_accrued)} />
            )}
          </Panel>
        )}

        {/* overdue — the one that costs money quietly */}
        {sections.overdue && (
          <Panel title={ar ? 'متأخرات التحصيل' : 'Overdue'} icon={AlertTriangle}
                 tone={sections.overdue.count > 0 ? 'amber' : undefined}
                 onClick={() => onNavigate?.('invoices')}>
            {sections.overdue.count === 0 ? (
              <p className="text-sm text-slate-500">{ar ? 'لا توجد فواتير متأخرة.' : 'None overdue.'}</p>
            ) : (
              <>
                <Row label={ar ? `${sections.overdue.count} فاتورة متأخرة` : `${sections.overdue.count} invoices`}
                     value={money(sections.overdue.total)} strong tone="amber" />
                {(sections.overdue.oldest || []).slice(0, 3).map((i) => (
                  <Row key={i.document_number} label={`${i.party_name || '—'} · ${i.due_date || ''}`}
                       value={money(i.amount_due)} small />
                ))}
              </>
            )}
          </Panel>
        )}

        {/* banks, one line each */}
        {sections.banks?.length > 0 && (
          <Panel title={ar ? 'الحسابات النقدية' : 'Cash accounts'} icon={Wallet}>
            {sections.banks.map((b) => (
              <Row key={b.code} label={b.name} value={money(b.balance)}
                   tone={b.balance < 0 ? 'rose' : undefined} />
            ))}
          </Panel>
        )}

        {sections.inventory && (
          <Panel title={ar ? 'المخزون' : 'Inventory'} icon={Package}
                 onClick={() => onNavigate?.('inventory')}>
            <Row label={ar ? 'قيمة المخزون' : 'Value'} value={money(sections.inventory.value)} strong />
            {sections.inventory.low_stock_count > 0 && (
              <Row label={ar ? 'أصناف قاربت النفاد' : 'Low stock'}
                   value={sections.inventory.low_stock_count} tone="amber" />
            )}
          </Panel>
        )}

        {sections.people && (
          <Panel title={ar ? 'الموظفون' : 'People'} icon={Users} onClick={() => onNavigate?.('hr')}>
            <Row label={ar ? 'على رأس العمل' : 'Active'} value={sections.people.active_employees} strong />
            {sections.people.payroll_liabilities > 0 && (
              <Row label={ar ? 'التزامات رواتب مستحقة' : 'Payroll due'}
                   value={money(sections.people.payroll_liabilities)} tone="amber" />
            )}
          </Panel>
        )}
      </div>

      {(sections.attention?.draft_invoices > 0 || sections.attention?.unposted_entries > 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 flex flex-wrap gap-4">
          {sections.attention.draft_invoices > 0 && (
            <span>{ar ? `${sections.attention.draft_invoices} فاتورة مسوّدة لم تُعتمد` : `${sections.attention.draft_invoices} draft invoices`}</span>
          )}
          {sections.attention.unposted_entries > 0 && (
            <span>{ar ? `${sections.attention.unposted_entries} قيد لم يُرحَّل` : `${sections.attention.unposted_entries} unposted entries`}</span>
          )}
        </div>
      )}
    </div>
  );
}

const TONES = {
  blue: 'text-[#1e3a8a] bg-blue-50 border-blue-100',
  emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
  rose: 'text-rose-700 bg-rose-50 border-rose-100',
  amber: 'text-amber-800 bg-amber-50 border-amber-100',
};

function Figure({ icon: Icon, label, value, hint, tone = 'blue', onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`text-start rounded-2xl border p-4 ${TONES[tone]} ${onClick ? 'hover:brightness-95' : ''}`}>
      <p className="text-xs font-semibold flex items-center gap-1.5 opacity-80">
        <Icon className="w-4 h-4" aria-hidden />{label}
      </p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] opacity-70 tabular-nums">{hint}</p>}
    </button>
  );
}

function Panel({ title, icon: Icon, children, tone, onClick }) {
  return (
    <section className={`bg-white rounded-2xl border p-4 ${tone === 'amber' ? 'border-amber-200' : 'border-slate-200'}`}>
      <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" aria-hidden />
        {onClick ? (
          <button onClick={onClick} className="hover:text-[#1e3a8a]">{title}</button>
        ) : title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value, strong, tone, small }) {
  const colour = tone === 'emerald' ? 'text-emerald-700' : tone === 'rose' ? 'text-rose-700'
    : tone === 'amber' ? 'text-amber-800' : 'text-slate-700';
  return (
    <div className={`flex items-center justify-between gap-3 ${small ? 'text-xs' : 'text-sm'}`}>
      <span className={`${small ? 'text-slate-500' : 'text-slate-600'} truncate`}>{label}</span>
      <span className={`tabular-nums shrink-0 ${strong ? 'font-extrabold' : 'font-semibold'} ${colour}`}>{value}</span>
    </div>
  );
}
