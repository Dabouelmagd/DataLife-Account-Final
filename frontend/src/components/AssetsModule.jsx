/**
 * الأصول الثابتة + حاسبات الضرائب.
 *
 * The assets tab used /api/financial/assets — a second, simpler engine that
 * writes the same `fixed_assets` collection under other field names
 * (name/cost vs asset_name/purchase_cost), has no disposal, no tax
 * depreciation and posts land to a header account. It now uses the full
 * engine at /api/fixed-assets (purchase, commissioning, monthly/annual
 * depreciation, disposal), which also reads the older records. Every entry is
 * previewed from the server before it is posted.
 */
import { useLanguage } from '../contexts/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { JournalPreview } from './FinanceExtras';

const API = (process.env.REACT_APP_BACKEND_URL || 'https://datalifeaccount.com').replace('http://', 'https://');
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const money = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N = ({ v }) => <bdi dir="ltr" className="tabular-nums">{money(v)}</bdi>;
const today = () => new Date().toISOString().slice(0, 10);
const errText = (e, fallback) => {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join(' — ');
  return fallback;
};

// keys and law rates mirror backend/models/fixed_assets.py (Law 91/2005 art. 25)
const TYPES = {
  buildings: ['مباني وإنشاءات', 'Buildings'], machinery: ['آلات ومعدات إنتاج', 'Machinery'],
  computers: ['حاسبات ونظم معلومات', 'Computers'], vehicles: ['سيارات ووسائل نقل', 'Vehicles'],
  furniture: ['أثاث وتجهيزات', 'Furniture'], intangible: ['أصول معنوية (برمجيات، شهرة)', 'Intangibles'],
  land: ['أراضٍ (لا تُهلَك)', 'Land'], wip: ['مشروع تحت التنفيذ', 'Construction in progress'],
};
const TAX_RULES = [
  ['buildings', 'straight_line', 5], ['intangible', 'straight_line', 10], ['computers', 'declining_balance', 50],
  ['machinery', 'declining_balance', 25], ['vehicles', 'declining_balance', 25], ['furniture', 'declining_balance', 25], ['land', null, 0],
];
const STATUS = {
  active: ['نشط', 'Active', 'bg-green-100 text-green-700'], wip: ['تحت التنفيذ', 'In progress', 'bg-blue-100 text-blue-700'],
  fully_depreciated: ['مُهلَك بالكامل', 'Fully depreciated', 'bg-amber-100 text-amber-800'],
  disposed: ['مُستبعَد', 'Disposed', 'bg-gray-100 text-gray-600'], idle: ['متوقف', 'Idle', 'bg-gray-100 text-gray-600'],
};
const emptyAsset = () => ({ asset_name: '', asset_type: 'computers', purchase_cost: '', salvage_value: '', purchase_date: today(),
  payment_method: 'bank', in_service: true, useful_life_years: '', accounting_rate: '', dep_method: 'straight_line',
  is_new_productive: false, location: '', serial_number: '' });
const field = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 bg-white dark:bg-slate-900';

export default function AssetsModule({ defaultTab = 'assets' } = {}) {
  const { language, isRTL } = useLanguage();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [tab, setTab] = useState(defaultTab);
  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // modal: {kind:'add'|'dep'|'dispose'|'commission'|'schedule', asset?, form, preview}
  const [modal, setModal] = useState(null);
  const [payrollForm, setPayrollForm] = useState({gross_monthly_salary:'',fixed_allowances:'0',variable_pay:'0'});
  const [payrollResult, setPayrollResult] = useState(null);
  const [vatForm, setVatForm] = useState({amount:'',vat_inclusive:false});
  const [vatResult, setVatResult] = useState(null);
  const [whForm, setWhForm] = useState({amount:'',service_type:'services'});
  const [whResult, setWhResult] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/fixed-assets/`, { ...auth(), params: { limit: 500 } });
      setAssets(data.assets || []); setSummary(data.summary || {});
    } catch (e) { setErr(errText(e, t('تعذّر تحميل الأصول', 'Could not load assets'))); }
    setLoading(false);
  }, [language]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const open = (kind, asset, form) => { setErr(''); setModal({ kind, asset, form: form || {}, preview: null }); };
  const setForm = (k, v) => setModal((m) => ({ ...m, form: { ...m.form, [k]: v }, preview: null }));

  const assetBody = (f) => ({
    asset_name: f.asset_name, asset_type: f.asset_type, purchase_cost: Number(f.purchase_cost) || 0,
    salvage_value: Number(f.salvage_value) || 0, purchase_date: f.purchase_date, payment_method: f.payment_method,
    in_service: f.asset_type === 'wip' ? false : f.in_service, dep_method: f.dep_method, is_new_productive: f.is_new_productive,
    ...(f.useful_life_years ? { useful_life_years: Number(f.useful_life_years) } : {}),
    ...(f.accounting_rate ? { accounting_rate: Number(f.accounting_rate) } : {}),
    ...(f.location ? { location: f.location } : {}), ...(f.serial_number ? { serial_number: f.serial_number } : {}),
  });

  const call = async (fn, onOk) => {
    setBusy(true); setErr('');
    try { const { data } = await fn(); onOk(data); } catch (e) { setErr(errText(e, t('تعذّر تنفيذ العملية', 'Operation failed'))); }
    setBusy(false);
  };
  const doPreview = () => {
    const { kind, asset, form } = modal;
    const req = {
      add: () => axios.post(`${API}/api/fixed-assets/preview`, assetBody(form), auth()),
      dep: () => axios.post(`${API}/api/fixed-assets/depreciation-preview`, { period: form.period }, auth()),
      dispose: () => axios.post(`${API}/api/fixed-assets/${asset.id}/dispose-preview`, form, auth()),
    }[kind];
    call(req, (data) => setModal((m) => ({ ...m, preview: data })));
  };
  const doPost = () => {
    const { kind, asset, form } = modal;
    const req = {
      add: () => axios.post(`${API}/api/fixed-assets/`, assetBody(form), auth()),
      dep: () => axios.post(`${API}/api/fixed-assets/run-depreciation`, { period: form.period }, auth()),
      dispose: () => axios.post(`${API}/api/fixed-assets/${asset.id}/dispose`, form, auth()),
      commission: () => axios.put(`${API}/api/fixed-assets/${asset.id}/commission`, form, auth()),
    }[kind];
    call(req, (data) => { setMsg(`✅ ${data.message || t('تم', 'Done')}`); setModal(null); fetchData(); });
  };
  const loadSchedule = (asset) => call(async () => {
    const [s, h] = await Promise.all([
      axios.get(`${API}/api/fixed-assets/depreciation-schedule/${asset.id}`, { ...auth(), params: { years: 10 } }),
      axios.get(`${API}/api/fixed-assets/depreciation-history/${asset.id}`, auth()),
    ]);
    return { data: { schedule: s.data.schedule || [], history: h.data.entries || [] } };
  }, (data) => setModal({ kind: 'schedule', asset, form: {}, preview: data }));

  const calcPayroll = async () => {
    const res = await fetch(`${API}/api/financial/tax/payroll-calculate`,{method:'POST',headers,body:JSON.stringify(payrollForm)});
    setPayrollResult(await res.json());
  };
  const calcVat = async () => {
    const res = await fetch(`${API}/api/financial/tax/calculate-vat`,{method:'POST',headers,body:JSON.stringify(vatForm)});
    setVatResult(await res.json());
  };
  const calcWH = async () => {
    const res = await fetch(`${API}/api/financial/tax/withholding-calculate`,{method:'POST',headers,body:JSON.stringify(whForm)});
    setWhResult(await res.json());
  };

  const m = modal; const f = m?.form || {}; const pv = m?.preview;
  const typeName = (k) => (TYPES[k] ? t(TYPES[k][0], TYPES[k][1]) : k);
  const canPreview = m && m.kind !== 'commission' && m.kind !== 'schedule';

  return (
    <div className="space-y-6 p-4 sm:p-6" dir={isRTL?'rtl':'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{defaultTab === 'assets' ? t('الأصول الثابتة','Fixed Assets') : t('الضرائب والرسوم','Taxes & Duties')}</h1>
          <p className="text-sm text-gray-500 mt-1">{defaultTab === 'assets' ? t('سجل الأصول والإهلاك والاستبعاد — قانون 91/2005','Register, depreciation & disposal — Law 91/2005') : t('ضريبة دخل · VAT · خصم تحت الحساب','Income Tax · VAT · Withholding Tax')}</p>
        </div>
        {tab === 'assets' && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => open('dep', null, { period: today().slice(0, 7) })} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">🔄 {t('تشغيل الإهلاك','Run Depreciation')}</button>
            <button onClick={() => open('add', null, emptyAsset())} className="px-4 py-2 bg-[#28376B] text-white rounded-xl text-sm font-medium hover:bg-[#1f2b54]">+ {t('إضافة أصل','Add Asset')}</button>
          </div>
        )}
      </div>

      {msg && <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">{msg}</div>}
      {err && !m && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">{err}</div>}

      {tab === 'assets' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[[t('إجمالي التكلفة','Total Cost'), summary.total_cost, 'text-blue-600'],
            [t('مجمع الإهلاك','Accum. Dep.'), summary.total_accum_dep, 'text-red-600'],
            [t('صافي القيمة الدفترية','Net Book Value'), summary.total_nbv, 'text-green-600']].map(([l, v, c]) => (
            <div key={l} className="bg-white dark:bg-slate-900 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500">{l}</p>
              <p className={`text-xl font-bold mt-1 ${c}`}><N v={v} /></p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {[['assets',t('الأصول الثابتة','Fixed Assets')],['payroll',t('ضريبة المرتبات','Payroll Tax')],
          ['vat',t('القيمة المضافة','VAT')],['withholding',t('خصم وإضافة','Withholding')],
          ['rates',t('معدلات الإهلاك','Dep. Rates')]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab===id?'border-[#28376B] text-[#28376B]':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab==='assets' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500">
              <tr>{[t('الكود','Code'),t('الأصل','Asset'),t('النوع','Type'),t('التكلفة','Cost'),t('مجمع الإهلاك','Accum.'),t('القيمة الدفترية','Book Value'),t('الحالة','Status'),''].map((h,i)=><th key={i} className="p-3 text-start border-b">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading?<tr><td colSpan={8} className="p-8 text-center text-gray-400">{t('جاري التحميل...','Loading...')}</td></tr>
              :assets.length===0?<tr><td colSpan={8} className="p-8 text-center text-gray-400">{t('لا توجد أصول بعد — اضغط إضافة أصل','No assets yet — click Add Asset')}</td></tr>
              :assets.map(a=>{
                const st = STATUS[a.status] || [a.status, a.status, 'bg-gray-100 text-gray-600'];
                return(
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-slate-800">
                    <td className="p-3 font-mono text-xs text-gray-400"><bdi dir="ltr">{a.asset_code}</bdi></td>
                    <td className="p-3 font-medium">{a.asset_name}</td>
                    <td className="p-3 text-xs">{typeName(a.asset_type)}</td>
                    <td className="p-3"><N v={a.purchase_cost} /></td>
                    <td className="p-3 text-red-600"><N v={a.accumulated_dep_accounting} /></td>
                    <td className="p-3 font-bold text-green-700"><N v={a.net_book_value} /></td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${st[2]}`}>{t(st[0], st[1])}</span></td>
                    <td className="p-3 whitespace-nowrap text-xs space-x-2 space-x-reverse">
                      <button onClick={()=>loadSchedule(a)} className="text-blue-600 hover:text-blue-800">📋 {t('جدول','Schedule')}</button>
                      {a.status==='wip' && <button onClick={()=>open('commission', a, { date: today(), asset_type: a.asset_type === 'wip' ? 'buildings' : a.asset_type })} className="text-indigo-600">▶ {t('تشغيل','Commission')}</button>}
                      {a.status!=='disposed' && <button onClick={()=>open('dispose', a, { disposal_type: 'sale', sale_proceeds: '', receipt_method: 'bank', date: today() })} className="text-red-600">✖ {t('استبعاد/بيع','Dispose')}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab==='payroll' && (
        <div className="max-w-xl bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{t('حاسبة ضريبة المرتبات وكسب العمل','Payroll & Employment Tax Calculator')}</h3>
          <div className="text-xs text-blue-700 bg-blue-50 p-3 rounded-lg">{t('قانون 91/2005 معدلاً بالقانون 26/2023 · قانون التأمين الاجتماعي 148/2019','Law 91/2005 amended 26/2023 · Social Insurance Law 148/2019')}</div>
          <div className="grid grid-cols-2 gap-3">
            {[{label:t('الراتب الأساسي الشهري *','Basic Monthly Salary *'),key:'gross_monthly_salary'},
              {label:t('البدلات الثابتة','Fixed Allowances'),key:'fixed_allowances'},
              {label:t('المتغير / عمولات','Variable / Commission'),key:'variable_pay'}].map(f=>(
              <div key={f.key}><label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#28376B]"
                placeholder="0" value={payrollForm[f.key]} onChange={e=>setPayrollForm(p=>({...p,[f.key]:e.target.value}))} /></div>
            ))}
          </div>
          <button onClick={calcPayroll} className="w-full py-2.5 bg-[#28376B] text-white rounded-xl text-sm font-medium hover:bg-[#1f2b54]">🧮 {t('احسب الضريبة','Calculate Tax')}</button>
          {payrollResult && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[[t('إجمالي الراتب','Gross Salary'),`${payrollResult.gross_monthly?.toLocaleString()} ج.م`,'text-gray-900'],
                [t('تأمينات اجتماعية 11%','Social Insurance 11%'),`${payrollResult.social_insurance?.employee_contribution?.toLocaleString()} ج.م`,'text-red-600'],
                [t('ضريبة الدخل الشهرية','Monthly Income Tax'),`${payrollResult.income_tax?.monthly_tax?.toLocaleString()} ج.م`,'text-red-600'],
                [t('دمغة المرتبات 2.5‰','Stamp Duty 2.5‰'),`${payrollResult.stamp_duty?.monthly?.toLocaleString()} ج.م`,'text-orange-600'],
                [t('صافي الراتب','Net Salary'),`${payrollResult.net_monthly?.toLocaleString()} ج.م`,'text-green-700 font-bold text-base'],
                [t('تكلفة صاحب العمل الإجمالية','Total Employer Cost'),`${payrollResult.total_employer_cost?.toLocaleString()} ج.م`,'text-blue-700 font-bold'],
              ].map(([l,v,c],i)=>(
                <div key={i} className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">{l}</p><p className={`font-bold ${c}`}>{v}</p></div>
              ))}
              <div className="col-span-2 text-xs text-gray-400 mt-1">{payrollResult.legal_reference}</div>
            </div>
          )}
        </div>
      )}

      {tab==='vat' && (
        <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{t('حاسبة ضريبة القيمة المضافة 14%','VAT Calculator 14%')}</h3>
          <div><label className="text-xs text-gray-500 mb-1 block">{t('المبلغ','Amount')}</label>
          <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" value={vatForm.amount} onChange={e=>setVatForm(p=>({...p,amount:e.target.value}))} /></div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={vatForm.vat_inclusive} onChange={e=>setVatForm(p=>({...p,vat_inclusive:e.target.checked}))} className="rounded" />
            {t('المبلغ شامل الضريبة','Amount includes VAT')}
          </label>
          <button onClick={calcVat} className="w-full py-2.5 bg-[#28376B] text-white rounded-xl text-sm font-medium">🧮 {t('احسب','Calculate')}</button>
          {vatResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>{t('المبلغ الخالص','Net Amount')}</span><span className="font-bold">{vatResult.net_amount?.toLocaleString()} ج.م</span></div>
              <div className="flex justify-between text-sm"><span>{t('ضريبة القيمة المضافة 14%','VAT 14%')}</span><span className="font-bold text-red-600">{vatResult.vat_amount?.toLocaleString()} ج.م</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>{t('الإجمالي شامل الضريبة','Total with VAT')}</span><span className="text-green-700">{vatResult.total_with_vat?.toLocaleString()} ج.م</span></div>
            </div>
          )}
        </div>
      )}

      {tab==='withholding' && (
        <div className="max-w-md bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h3 className="font-bold text-gray-900">{t('حاسبة ضريبة الخصم والإضافة','Withholding Tax Calculator')}</h3>
          <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg">{t('المادة 59 — قانون 91/2005 — تُسدَّد للمصلحة خلال الأسبوع الأول من الشهر التالي','Article 59 — Law 91/2005 — due first week of following month')}</div>
          <div><label className="text-xs text-gray-500 mb-1 block">{t('نوع الخدمة','Service Type')}</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={whForm.service_type} onChange={e=>setWhForm(p=>({...p,service_type:e.target.value}))}>
            {[['services',t('خدمات عامة 1%','General Services 1%')],['contracting',t('مقاولات وتوريدات 2%','Contracting 2%')],
              ['commission',t('عمولات ووساطة 5%','Commission 5%')],['rent',t('إيجار عقارات 5%','Property Rent 5%')],
              ['professional',t('أتعاب مهنية 5%','Professional Fees 5%')],['dividends',t('أرباح موزعة 10%','Dividends 10%')],
              ['non_resident',t('مدفوعات لغير مقيمين 20%','Non-resident 20%')]
            ].map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select></div>
          <div><label className="text-xs text-gray-500 mb-1 block">{t('المبلغ','Amount')}</label>
          <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0.00" value={whForm.amount} onChange={e=>setWhForm(p=>({...p,amount:e.target.value}))} /></div>
          <button onClick={calcWH} className="w-full py-2.5 bg-[#28376B] text-white rounded-xl text-sm font-medium">🧮 {t('احسب الضريبة المستقطعة','Calculate Withholding')}</button>
          {whResult && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>{t('إجمالي المبلغ','Gross Amount')}</span><span className="font-bold">{whResult.gross_amount?.toLocaleString()} ج.م</span></div>
              <div className="flex justify-between text-sm"><span>{t('الضريبة المستقطعة','Tax Withheld')} ({(whResult.withholding_rate*100).toFixed(0)}%)</span><span className="font-bold text-red-600">{whResult.tax_withheld?.toLocaleString()} ج.م</span></div>
              <div className="flex justify-between font-bold text-base border-t pt-2"><span>{t('صافي المبلغ المدفوع','Net Payment')}</span><span className="text-green-700">{whResult.net_payment?.toLocaleString()} ج.م</span></div>
              <p className="text-xs text-gray-400">{whResult.legal_reference}</p>
            </div>
          )}
        </div>
      )}

      {tab==='rates' && (
        <div className="bg-white dark:bg-slate-900 border border-gray-200 rounded-xl overflow-x-auto">
          <div className="p-4 bg-gray-50 dark:bg-slate-800 border-b">
            <h3 className="font-bold">{t('معدلات الإهلاك الضريبي المصري','Egyptian Tax Depreciation Rates')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('قانون الضريبة على الدخل 91/2005 — المادة 25 (آلات جديدة للإنتاج: 30% إضافية في السنة الأولى)','Income Tax Law 91/2005 art. 25 (new productive machinery: extra 30% in year one)')}</p>
          </div>
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-gray-50 dark:bg-slate-800 text-xs font-semibold text-gray-500">
              <tr>{[t('نوع الأصل','Asset Type'),t('معدل الإهلاك','Rate'),t('طريقة الإهلاك','Method')].map((h,i)=><th key={i} className="p-3 text-start border-b">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {TAX_RULES.map(([k, method, rate])=>(
                <tr key={k}>
                  <td className="p-3 font-medium">{typeName(k)}</td>
                  <td className="p-3"><bdi dir="ltr">{rate ? `${rate}%` : t('لا يُهلَك','Not depreciated')}</bdi></td>
                  <td className="p-3 text-gray-600">{method==='straight_line'?t('قسط ثابت','Straight Line'):method==='declining_balance'?t('رصيد متناقص','Declining Balance'):'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {m && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{{
                add: t('إضافة أصل ثابت','Add Fixed Asset'), dep: t('تشغيل الإهلاك','Run Depreciation'),
                dispose: `${t('استبعاد / بيع','Dispose / Sell')} — ${m.asset?.asset_name}`,
                commission: `${t('تشغيل الأصل','Commission')} — ${m.asset?.asset_name}`,
                schedule: `${t('جدول الإهلاك','Depreciation Schedule')} — ${m.asset?.asset_name}`,
              }[m.kind]}</h3>
              <button onClick={()=>setModal(null)} aria-label={t('إغلاق','Close')} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {err && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{err}</div>}

            {m.kind === 'add' && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-gray-500">{t('اسم الأصل *','Asset Name *')}<input className={field} value={f.asset_name} onChange={e=>setForm('asset_name', e.target.value)} /></label>
                  <label className="text-xs text-gray-500">{t('نوع الأصل *','Asset Type *')}
                    <select className={field} value={f.asset_type} onChange={e=>setForm('asset_type', e.target.value)}>
                      {Object.keys(TYPES).map(k=><option key={k} value={k}>{typeName(k)}</option>)}
                    </select></label>
                  <label className="text-xs text-gray-500">{t('تكلفة الشراء *','Purchase Cost *')}<input type="number" min="0" dir="ltr" className={field} value={f.purchase_cost} onChange={e=>setForm('purchase_cost', e.target.value)} /></label>
                  <label className="text-xs text-gray-500">{t('القيمة التخريدية','Salvage Value')}<input type="number" min="0" dir="ltr" className={field} value={f.salvage_value} onChange={e=>setForm('salvage_value', e.target.value)} /></label>
                  <label className="text-xs text-gray-500">{t('تاريخ الشراء *','Purchase Date *')}<input type="date" className={field} value={f.purchase_date} onChange={e=>setForm('purchase_date', e.target.value)} /></label>
                  <label className="text-xs text-gray-500">{t('طريقة السداد','Paid by')}
                    <select className={field} value={f.payment_method} onChange={e=>setForm('payment_method', e.target.value)}>
                      <option value="bank">{t('البنك (162)','Bank (162)')}</option><option value="cash">{t('الخزينة (161)','Cash (161)')}</option><option value="credit">{t('آجل — الموردون (251)','On credit — Suppliers (251)')}</option>
                    </select></label>
                  {!['land','wip'].includes(f.asset_type) && <>
                    <label className="text-xs text-gray-500">{t('العمر الإنتاجي (سنوات)','Useful life (years)')}<input type="number" min="0" dir="ltr" className={field} value={f.useful_life_years} onChange={e=>setForm('useful_life_years', e.target.value)} placeholder={t('فارغ = معدل القانون','blank = law rate')} /></label>
                    <label className="text-xs text-gray-500">{t('أو معدل الإهلاك المحاسبي %','or accounting rate %')}<input type="number" min="0" max="100" dir="ltr" className={field} value={f.accounting_rate} onChange={e=>setForm('accounting_rate', e.target.value)} /></label>
                    <label className="text-xs text-gray-500">{t('طريقة الإهلاك المحاسبي','Accounting method')}
                      <select className={field} value={f.dep_method} onChange={e=>setForm('dep_method', e.target.value)}>
                        <option value="straight_line">{t('قسط ثابت','Straight line')}</option><option value="declining_balance">{t('رصيد متناقص','Declining balance')}</option>
                      </select></label>
                  </>}
                  <label className="text-xs text-gray-500">{t('الموقع','Location')}<input className={field} value={f.location} onChange={e=>setForm('location', e.target.value)} /></label>
                </div>
                {f.asset_type !== 'wip' && <label className="flex items-center gap-2"><input type="checkbox" checked={f.in_service} onChange={e=>setForm('in_service', e.target.checked)} /> {t('الأصل جاهز للاستخدام الآن (وإلا يُسجَّل تحت التنفيذ 143)','Ready for use now (otherwise booked to construction-in-progress 143)')}</label>}
                {f.asset_type === 'machinery' && <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_new_productive} onChange={e=>setForm('is_new_productive', e.target.checked)} /> {t('آلة جديدة مستخدمة في الإنتاج (إهلاك ضريبي معجل 30% أول سنة)','New productive machinery (30% accelerated tax depreciation year one)')}</label>}
              </div>
            )}

            {m.kind === 'dep' && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-3 items-end">
                  <label className="text-xs text-gray-500">{t('شهر','Month')}<input type="month" className={field} value={f.period?.length === 7 ? f.period : ''} onChange={e=>setForm('period', e.target.value)} /></label>
                  <label className="text-xs text-gray-500">{t('أو سنة كاملة','or a full year')}<input type="number" dir="ltr" className={field} value={f.period?.length === 4 ? f.period : ''} placeholder="2026" onChange={e=>setForm('period', e.target.value)} /></label>
                </div>
                <p className="text-xs text-gray-500">{t('لا يُكرَّر إهلاك نفس الفترة، ولا يُجمع تشغيل سنوي مع تشغيل شهري لنفس السنة.','A period is never posted twice; annual and monthly runs of the same year cannot be mixed.')}</p>
                {pv && (
                  <div className="space-y-2">
                    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[520px]">
                      <thead className="text-gray-500"><tr>{[t('الأصل','Asset'),t('الشهور','Months'),t('إهلاك محاسبي','Accounting'),t('إهلاك ضريبي','Tax'),t('الحسابات','Accounts')].map(h=><th key={h} className="text-start p-1">{h}</th>)}</tr></thead>
                      <tbody>{pv.assets.map(a=>(
                        <tr key={a.asset_id}><td className="p-1">{a.asset_name}</td><td className="p-1"><bdi dir="ltr">{a.months}</bdi></td>
                          <td className="p-1 font-bold"><N v={a.accounting_dep} /></td><td className="p-1"><N v={a.tax_dep} /></td>
                          <td className="p-1"><bdi dir="ltr">{a.lines.map(l=>l.account_code).join(' / ')}</bdi></td></tr>))}
                        <tr className="border-t font-bold"><td className="p-1" colSpan={2}>{t('الإجمالي','Total')}</td><td className="p-1"><N v={pv.total} /></td><td colSpan={2} /></tr>
                      </tbody></table></div>
                    <p className="text-xs text-gray-500">{t('قيد لكل أصل: مدين مصروف الإهلاك — دائن مجمع الإهلاك، بتاريخ','One entry per asset: Dr depreciation expense — Cr accumulated depreciation, dated')} <bdi dir="ltr">{pv.entry_date}</bdi></p>
                    {pv.skipped?.length > 0 && <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2">{pv.skipped.map((s,i)=><p key={i}>{s.asset}: {s.reason}</p>)}</div>}
                  </div>
                )}
              </div>
            )}

            {m.kind === 'dispose' && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-gray-500">{t('نوع الاستبعاد','Type')}
                    <select className={field} value={f.disposal_type} onChange={e=>setForm('disposal_type', e.target.value)}>
                      <option value="sale">{t('بيع','Sale')}</option><option value="scrapped">{t('إتلاف / تخريد','Scrapped')}</option>
                    </select></label>
                  <label className="text-xs text-gray-500">{t('التاريخ','Date')}<input type="date" className={field} value={f.date} onChange={e=>setForm('date', e.target.value)} /></label>
                  {f.disposal_type === 'sale' && <>
                    <label className="text-xs text-gray-500">{t('ثمن البيع','Sale proceeds')}<input type="number" min="0" dir="ltr" className={field} value={f.sale_proceeds} onChange={e=>setForm('sale_proceeds', e.target.value)} /></label>
                    <label className="text-xs text-gray-500">{t('التحصيل في','Received into')}
                      <select className={field} value={f.receipt_method} onChange={e=>setForm('receipt_method', e.target.value)}>
                        <option value="bank">{t('البنك','Bank')}</option><option value="cash">{t('الخزينة','Cash')}</option>
                      </select></label>
                  </>}
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">{t('شغّل إهلاك الفترة حتى تاريخ البيع أولاً — يُستبعد الأصل بمجمع إهلاكه المسجَّل حالياً.','Post depreciation up to the sale date first — the asset leaves with its currently posted accumulated depreciation.')}</p>
                {pv?.financials && <p>{t('القيمة الدفترية','Book value')} <N v={pv.financials.net_book_value} /> — {pv.financials.gain_loss >= 0 ? t('ربح','Gain') : t('خسارة','Loss')} <b><N v={Math.abs(pv.financials.gain_loss)} /></b></p>}
              </div>
            )}

            {m.kind === 'commission' && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs text-gray-500">{t('تاريخ التشغيل (يبدأ منه الإهلاك)','Commissioning date (depreciation starts)')}<input type="date" className={field} value={f.date} onChange={e=>setForm('date', e.target.value)} /></label>
                  {m.asset.asset_type === 'wip' && (
                    <label className="text-xs text-gray-500">{t('نوع الأصل النهائي','Final asset type')}
                      <select className={field} value={f.asset_type} onChange={e=>setForm('asset_type', e.target.value)}>
                        {Object.keys(TYPES).filter(k=>k!=='wip').map(k=><option key={k} value={k}>{typeName(k)}</option>)}
                      </select></label>
                  )}
                </div>
                <JournalPreview lines={[
                  { account_code: m.asset.asset_type === 'wip' ? '' : m.asset.asset_account_code, account_name: t('الأصل الثابت','Fixed asset'), debit: m.asset.purchase_cost, credit: 0, description: t('تشغيل','Commissioning') },
                  { account_code: m.asset.wip_account_code || '1491', account_name: t('مشروعات تحت التنفيذ','Construction in progress'), debit: 0, credit: m.asset.purchase_cost, description: '' },
                ]} />
              </div>
            )}

            {m.kind === 'schedule' && pv && (
              <div className="space-y-4">
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-50 dark:bg-slate-800"><tr>
                    {[t('السنة','Year'),t('إهلاك محاسبي','Accounting'),t('إهلاك ضريبي','Tax'),t('الفرق','Difference'),t('القيمة الدفترية','Book value'),t('الأساس الضريبي','Tax base')].map(h=><th key={h} className="p-2 text-start text-xs text-gray-500 border-b">{h}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">{pv.schedule.map(r=>(
                    <tr key={r.year}><td className="p-2"><bdi dir="ltr">{r.year}</bdi></td><td className="p-2"><N v={r.accounting_dep} /></td><td className="p-2"><N v={r.tax_dep} /></td>
                      <td className="p-2"><N v={r.timing_difference} /></td><td className="p-2 font-bold"><N v={r.net_book_value} /></td><td className="p-2"><N v={r.tax_book_value} /></td></tr>))}
                  </tbody></table></div>
                <div>
                  <p className="font-bold text-sm mb-1">{t('الإهلاك المرحَّل','Posted depreciation')}</p>
                  {!pv.history.length ? <p className="text-xs text-gray-400">{t('لا يوجد بعد','None yet')}</p> : (
                    <div className="overflow-x-auto"><table className="w-full text-xs min-w-[400px]"><tbody>{pv.history.map(h=>(
                      <tr key={h.id}><td className="p-1"><bdi dir="ltr">{h.period}</bdi></td><td className="p-1"><N v={h.accounting_dep} /></td><td className="p-1"><N v={h.tax_dep} /></td></tr>))}
                    </tbody></table></div>)}
                </div>
              </div>
            )}

            {pv?.lines && <div className="mt-3"><JournalPreview lines={pv.lines} /></div>}

            {m.kind !== 'schedule' && (
              <div className="flex flex-wrap gap-2 mt-4 justify-end">
                <button onClick={()=>setModal(null)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">{t('إلغاء','Cancel')}</button>
                {canPreview && <button onClick={doPreview} disabled={busy} className="px-4 py-2.5 border border-[#28376B] text-[#28376B] rounded-xl text-sm font-bold disabled:opacity-50">{busy ? '…' : t('معاينة القيد','Preview entry')}</button>}
                <button onClick={doPost} disabled={busy || (canPreview && !pv) || (m.kind === 'dep' && pv && !pv.assets.length)} className="px-4 py-2.5 bg-[#28376B] text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {busy ? t('جاري الحفظ...','Saving...') : t('ترحيل','Post')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
