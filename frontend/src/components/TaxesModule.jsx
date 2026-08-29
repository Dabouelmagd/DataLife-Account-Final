import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TaxesModule() {
  const { language, isRTL } = useLanguage();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [tab, setTab] = useState('payroll');

  // Payroll Tax Calculator
  const [payrollForm, setPayrollForm] = useState({ gross_monthly_salary: '', fixed_allowances: '', variable_pay: '' });
  const [payrollResult, setPayrollResult] = useState(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // VAT Calculator
  const [vatForm, setVatForm] = useState({ amount: '', vat_inclusive: false });
  const [vatResult, setVatResult] = useState(null);
  const [vatLoading, setVatLoading] = useState(false);

  // Withholding Tax Calculator
  const [whForm, setWhForm] = useState({ amount: '', service_type: 'services' });
  const [whResult, setWhResult] = useState(null);
  const [whLoading, setWhLoading] = useState(false);

  const calcPayroll = async () => {
    if (!payrollForm.gross_monthly_salary) return;
    setPayrollLoading(true);
    try {
      const res = await fetch(`${API}/api/financial/tax/payroll-calculate`, {
        method: 'POST', headers, body: JSON.stringify(payrollForm)
      });
      setPayrollResult(await res.json());
    } catch(e) { console.error(e); }
    setPayrollLoading(false);
  };

  const calcVat = async () => {
    if (!vatForm.amount) return;
    setVatLoading(true);
    try {
      const res = await fetch(`${API}/api/financial/tax/calculate-vat`, {
        method: 'POST', headers, body: JSON.stringify(vatForm)
      });
      setVatResult(await res.json());
    } catch(e) { console.error(e); }
    setVatLoading(false);
  };

  const calcWH = async () => {
    if (!whForm.amount) return;
    setWhLoading(true);
    try {
      const res = await fetch(`${API}/api/financial/tax/withholding-calculate`, {
        method: 'POST', headers, body: JSON.stringify(whForm)
      });
      setWhResult(await res.json());
    } catch(e) { console.error(e); }
    setWhLoading(false);
  };

  const TABS = [
    { id: 'payroll',     label: t('ضريبة المرتبات وكسب العمل', 'Payroll Tax') },
    { id: 'vat',         label: t('ضريبة القيمة المضافة 14%', 'VAT 14%') },
    { id: 'withholding', label: t('الخصم والإضافة', 'Withholding Tax') },
  ];

  return (
    <div className="space-y-6 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('الضرائب والاستقطاعات', 'Taxes & Deductions')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('حاسبات الضرائب المصرية — قانون 91/2005', 'Egyptian Tax Calculators — Law 91/2005')}</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === id ? 'border-[#28376B] text-[#28376B]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Payroll Tax ─────────────────────────────────────── */}
      {tab === 'payroll' && (
        <div className="max-w-xl bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{t('حاسبة ضريبة المرتبات وكسب العمل', 'Payroll & Employment Tax Calculator')}</h3>
          <div className="text-xs text-blue-700 bg-blue-50 p-3 rounded-lg">
            {t('قانون 91/2005 — الشرائح الضريبية المصرية المحدثة 2024', 'Egyptian Tax Law 91/2005 — Updated 2024 brackets')}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { label: t('الراتب الأساسي الشهري *', 'Basic Monthly Salary *'), key: 'gross_monthly_salary' },
              { label: t('البدلات الثابتة', 'Fixed Allowances'), key: 'fixed_allowances' },
              { label: t('المتغير / عمولات', 'Variable / Commission'), key: 'variable_pay' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#28376B]"
                  placeholder="0" value={payrollForm[f.key]}
                  onChange={e => setPayrollForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <button onClick={calcPayroll} disabled={payrollLoading}
            className="w-full py-2.5 bg-[#28376B] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 disabled:opacity-60">
            {payrollLoading ? t('جاري الحساب...', 'Calculating...') : t('احسب الضريبة', 'Calculate Tax')}
          </button>
          {payrollResult && !payrollResult.detail && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                [t('إجمالي الراتب', 'Gross Salary'),           `${payrollResult.gross_monthly?.toLocaleString()} ج.م`,       'text-gray-700'],
                [t('تأمينات اجتماعية 11%', 'Social Insurance'), `${payrollResult.social_insurance?.monthly_employee?.toLocaleString()} ج.م`, 'text-orange-600'],
                [t('ضريبة الدخل الشهرية', 'Monthly Income Tax'), `${payrollResult.income_tax?.monthly?.toLocaleString()} ج.م`, 'text-red-600'],
                [t('دمغة المرتبات', 'Stamp Duty'),              `${payrollResult.stamp_duty?.monthly?.toLocaleString()} ج.م`,  'text-amber-600'],
                [t('صافي الراتب', 'Net Salary'),                `${payrollResult.net_monthly?.toLocaleString()} ج.م`,          'text-green-700 font-bold'],
                [t('تكلفة صاحب العمل', 'Total Employer Cost'),  `${payrollResult.total_employer_cost?.toLocaleString()} ج.م`, 'text-blue-700'],
              ].map(([l, v, c], i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{l}</p>
                  <p className={`font-bold text-sm mt-0.5 ${c}`}>{v}</p>
                </div>
              ))}
              {payrollResult.legal_reference && (
                <div className="col-span-2 text-xs text-gray-400 mt-1">{payrollResult.legal_reference}</div>
              )}
            </div>
          )}
          {payrollResult?.detail && (
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">❌ {payrollResult.detail}</p>
          )}
        </div>
      )}

      {/* ── VAT ─────────────────────────────────────────────── */}
      {tab === 'vat' && (
        <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{t('حاسبة ضريبة القيمة المضافة 14%', 'VAT Calculator 14%')}</h3>
          <div className="text-xs text-green-700 bg-green-50 p-3 rounded-lg">
            {t('قانون القيمة المضافة رقم 67/2016 — معدل 14%', 'VAT Law 67/2016 — Rate 14%')}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('المبلغ', 'Amount')} (ج.م)</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#28376B]"
              placeholder="0" value={vatForm.amount}
              onChange={e => setVatForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={vatForm.vat_inclusive}
              onChange={e => setVatForm(f => ({ ...f, vat_inclusive: e.target.checked }))}
              className="rounded" />
            {t('المبلغ شامل الضريبة', 'Amount includes VAT')}
          </label>
          <button onClick={calcVat} disabled={vatLoading}
            className="w-full py-2.5 bg-[#28376B] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 disabled:opacity-60">
            {vatLoading ? t('جاري الحساب...', 'Calculating...') : t('احسب القيمة المضافة', 'Calculate VAT')}
          </button>
          {vatResult && !vatResult.detail && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('المبلغ الخالص', 'Net Amount')}</span>
                <span className="font-semibold">{vatResult.net_amount?.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('ضريبة القيمة المضافة 14%', 'VAT 14%')}</span>
                <span className="font-semibold text-red-600">{vatResult.vat_amount?.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>{t('الإجمالي شامل الضريبة', 'Total incl. VAT')}</span>
                <span className="text-green-700">{vatResult.total_amount?.toLocaleString()} ج.م</span>
              </div>
            </div>
          )}
          {vatResult?.detail && (
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">❌ {vatResult.detail}</p>
          )}
        </div>
      )}

      {/* ── Withholding Tax ──────────────────────────────────── */}
      {tab === 'withholding' && (
        <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{t('حاسبة ضريبة الخصم والإضافة', 'Withholding Tax Calculator')}</h3>
          <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">
            {t('المادة 59 من قانون الضرائب 91/2005 — معدلات متغيرة', 'Article 59, Tax Law 91/2005 — Variable rates')}
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('نوع الخدمة', 'Service Type')}</label>
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#28376B]"
              value={whForm.service_type}
              onChange={e => setWhForm(f => ({ ...f, service_type: e.target.value }))}>
              {[
                ['services',     t('خدمات عامة 1%', 'General Services 1%')],
                ['contracting',  t('مقاولات وتوريدات 1%', 'Contracting & Supply 1%')],
                ['commission',   t('عمولات ووساطة 5%', 'Commission 5%')],
                ['rent',         t('إيجار عقارات 10%', 'Real Estate Rent 10%')],
                ['professional', t('أتعاب مهنية 5%', 'Professional Fees 5%')],
                ['dividends',    t('أرباح وعوائد 10%', 'Dividends 10%')],
                ['non_resident', t('مدفوعات لغير مقيمين 20%', 'Non-resident 20%')],
              ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('المبلغ', 'Amount')} (ج.م)</label>
            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#28376B]"
              placeholder="0" value={whForm.amount}
              onChange={e => setWhForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <button onClick={calcWH} disabled={whLoading}
            className="w-full py-2.5 bg-[#28376B] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 disabled:opacity-60">
            {whLoading ? t('جاري الحساب...', 'Calculating...') : t('احسب الضريبة', 'Calculate Tax')}
          </button>
          {whResult && !whResult.detail && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('إجمالي المبلغ', 'Gross Amount')}</span>
                <span className="font-semibold">{whResult.gross_amount?.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{t('الضريبة المستقطعة', 'Tax Withheld')} ({whResult.rate}%)</span>
                <span className="font-semibold text-red-600">{whResult.tax_withheld?.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>{t('صافي المبلغ المدفوع', 'Net Amount Paid')}</span>
                <span className="text-orange-700">{whResult.net_amount?.toLocaleString()} ج.م</span>
              </div>
              {whResult.legal_reference && (
                <p className="text-xs text-gray-400">{whResult.legal_reference}</p>
              )}
            </div>
          )}
          {whResult?.detail && (
            <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">❌ {whResult.detail}</p>
          )}
        </div>
      )}
    </div>
  );
}
