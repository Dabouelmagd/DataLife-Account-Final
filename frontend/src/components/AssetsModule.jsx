import { useLanguage } from '../contexts/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_BACKEND_URL;

const DEP_LABELS = {
  buildings:'المباني والإنشاءات',machinery:'الآلات والمعدات',
  vehicles:'السيارات ووسائل النقل',computers:'أجهزة الحاسب الآلي',
  furniture:'الأثاث والديكور',software:'البرامج والتراخيص',
  land:'الأراضي',leasehold:'تحسينات المباني المستأجرة',
  goodwill:'الشهرة التجارية',other:'أصول أخرى'
};
const DEP_RATES = {buildings:5,machinery:10,vehicles:25,computers:50,furniture:10,software:33,land:0,leasehold:10,goodwill:10,other:10};
const DEP_METHODS = {buildings:'straight_line',machinery:'straight_line',vehicles:'declining',computers:'declining',furniture:'straight_line',software:'straight_line',land:'none',leasehold:'straight_line',goodwill:'straight_line',other:'straight_line'};

export default function AssetsModule() {
  const { language, isRTL } = useLanguage();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const [tab, setTab] = useState(defaultTab);
  const [assets, setAssets] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [scheduleAsset, setScheduleAsset] = useState(null);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [assetForm, setAssetForm] = useState({name:'',asset_type:'computers',cost:'',salvage_value:'0',purchase_date:'',department:''});
  const [payrollForm, setPayrollForm] = useState({gross_monthly_salary:'',fixed_allowances:'0',variable_pay:'0'});
  const [payrollResult, setPayrollResult] = useState(null);
  const [vatForm, setVatForm] = useState({amount:'',vat_inclusive:false});
  const [vatResult, setVatResult] = useState(null);
  const [whForm, setWhForm] = useState({amount:'',service_type:'services'});
  const [whResult, setWhResult] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [a,r] = await Promise.all([
        fetch(`${API}/api/financial/assets`,{headers}).then(r=>r.ok?r.json():[]),
        fetch(`${API}/api/financial/assets/depreciation-rates`,{headers}).then(r=>r.ok?r.json():[]),
      ]);
      setAssets(Array.isArray(a)?a:[]); setRates(Array.isArray(r)?r:[]);
    } catch(e){console.error(e);}
    setLoading(false);
  },[token]);

  useEffect(()=>{fetchData();},[fetchData]);

  const addAsset = async () => {
    if(!assetForm.name||!assetForm.cost||!assetForm.purchase_date){setMsg(t('أدخل جميع الحقول المطلوبة','Fill required fields'));return;}
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/financial/assets`,{method:'POST',headers,body:JSON.stringify(assetForm)});
      if(res.ok){setShowAdd(false);setAssetForm({name:'',asset_type:'computers',cost:'',salvage_value:'0',purchase_date:'',department:''});setMsg(t('✅ تم إضافة الأصل وإنشاء القيد المحاسبي','✅ Asset added with journal entry'));fetchData();}
    } catch(e){setMsg(t('خطأ','Error'));}
    setSaving(false);
  };

  const runDepreciation = async () => {
    try {
      const res = await fetch(`${API}/api/financial/assets/depreciation/run`,{method:'POST',headers,body:JSON.stringify({})});
      const d = await res.json();
      setMsg(t(`✅ تم تشغيل الإهلاك — ${d.assets_processed} أصل | ${d.total_monthly_depreciation?.toLocaleString()} ج.م`,`✅ Run complete — ${d.assets_processed} assets`));
      fetchData();
    } catch(e){setMsg(t('خطأ','Error'));}
  };

  const loadSchedule = async (asset) => {
    setScheduleAsset(asset);
    const res = await fetch(`${API}/api/financial/assets/depreciation/schedule/${asset.id}`,{headers});
    setSchedule(await res.json());
  };

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

  const totalCost = assets.reduce((s,a)=>s+(a.cost||0),0);
  const totalAccum = assets.reduce((s,a)=>s+(a.calculated_depreciation?.accumulated_depreciation||0),0);
  const totalBook = assets.reduce((s,a)=>s+(a.calculated_depreciation?.book_value||a.cost||0),0);

  return (
    <div className="space-y-6 p-6" dir={isRTL?'rtl':'ltr'}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{defaultTab === 'assets' ? t('الأصول الثابتة','Fixed Assets') : t('الضرائب والرسوم','Taxes & Duties')}</h1>
          <p className="text-sm text-gray-500 mt-1">{defaultTab === 'assets' ? t('إدارة الأصول والإهلاك — وفق القانون المصري','Asset management & depreciation — Egyptian Law') : t('ضريبة دخل · VAT · خصم تحت الحساب','Income Tax · VAT · Withholding Tax')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runDepreciation} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">🔄 {t('تشغيل الإهلاك','Run Depreciation')}</button>
          <button onClick={()=>setShowAdd(true)} className="px-4 py-2 bg-[#28376B] text-white rounded-xl text-sm font-medium hover:bg-[#1f2b54]">+ {t('إضافة أصل','Add Asset')}</button>
        </div>
      </div>

      {msg && <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">{msg}</div>}

      <div className="grid grid-cols-3 gap-4">
        {[
          {label:t('إجمالي التكلفة','Total Cost'),value:`${totalCost.toLocaleString()} ج.م`,color:'text-blue-600'},
          {label:t('مجمع الإهلاك','Accum. Dep.'),value:`${Math.round(totalAccum).toLocaleString()} ج.م`,color:'text-red-600'},
          {label:t('صافي القيمة الدفترية','Net Book Value'),value:`${Math.round(totalBook).toLocaleString()} ج.م`,color:'text-green-600'},
        ].map((k,i)=>(
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

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
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
              <tr>{[t('الكود','Code'),t('الأصل','Asset'),t('النوع','Type'),t('التكلفة','Cost'),t('إهلاك سنوي','Annual Dep.'),t('مجمع','Accum.'),t('القيمة الدفترية','Book Value'),t('الحالة','Status'),''].map((h,i)=><th key={i} className="p-3 text-right border-b">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading?<tr><td colSpan={9} className="p-8 text-center text-gray-400">{t('جاري التحميل...','Loading...')}</td></tr>
              :assets.length===0?<tr><td colSpan={9} className="p-8 text-center text-gray-400">{t('لا توجد أصول بعد — اضغط إضافة أصل','No assets yet — click Add Asset')}</td></tr>
              :assets.map(a=>{
                const dep=a.calculated_depreciation||{};
                return(
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs text-gray-400">{a.asset_code}</td>
                    <td className="p-3 font-medium">{a.name}</td>
                    <td className="p-3 text-xs">{a.asset_type_ar}</td>
                    <td className="p-3">{(a.cost||0).toLocaleString()} ج.م</td>
                    <td className="p-3 text-orange-600">{(dep.annual_depreciation||0).toLocaleString()} ج.م</td>
                    <td className="p-3 text-red-600">{(dep.accumulated_depreciation||0).toLocaleString()} ج.م</td>
                    <td className="p-3 font-bold text-green-700">{(dep.book_value||a.cost||0).toLocaleString()} ج.م</td>
                    <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs ${a.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{a.status==='active'?t('نشط','Active'):t('مستبعد','Disposed')}</span></td>
                    <td className="p-3"><button onClick={()=>loadSchedule(a)} className="text-blue-500 hover:text-blue-700 text-xs">📋 {t('جدول','Schedule')}</button></td>
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h3 className="font-bold">{t('معدلات الإهلاك الضريبي المصري','Egyptian Tax Depreciation Rates')}</h3>
            <p className="text-xs text-gray-500 mt-1">{t('قانون الضرائب على الدخل 91/2005 وتعديلاته','Income Tax Law 91/2005 and amendments')}</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
              <tr>{[t('نوع الأصل','Asset Type'),t('معدل الإهلاك','Rate'),t('طريقة الإهلاك','Method'),t('العمر الإنتاجي','Useful Life')].map((h,i)=><th key={i} className="p-3 text-right border-b">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(rates.length?rates:Object.entries(DEP_LABELS).map(([k,ar])=>({key:k,name_ar:ar,rate:DEP_RATES[k]/100,method:DEP_METHODS[k],useful_life_years:DEP_RATES[k]>0?Math.round(100/DEP_RATES[k]):0}))).map((r,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{r.name_ar}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${r.rate===0?'bg-gray-100 text-gray-600':r.rate>=0.33?'bg-red-100 text-red-700':r.rate>=0.15?'bg-orange-100 text-orange-700':'bg-blue-100 text-blue-700'}`}>{r.rate===0?t('لا يُهلَك','Not Dep.'):`${(r.rate*100).toFixed(0)}%`}</span></td>
                  <td className="p-3 text-gray-600">{r.method==='straight_line'?t('قسط ثابت','Straight Line'):r.method==='declining'?t('رصيد متناقص','Declining Balance'):t('لا ينطبق','N/A')}</td>
                  <td className="p-3">{r.useful_life_years>0?`${r.useful_life_years} ${t('سنة','yrs')}`:t('—','—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setShowAdd(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">{t('إضافة أصل ثابت جديد','Add New Fixed Asset')}</h3>
            <div className="space-y-3">
              <div><label className="text-xs text-gray-500">{t('اسم الأصل *','Asset Name *')}</label>
              <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder={t('مثال: سيارة تويوتا 2024','e.g. Toyota Car 2024')} value={assetForm.name} onChange={e=>setAssetForm(p=>({...p,name:e.target.value}))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">{t('نوع الأصل *','Asset Type *')}</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={assetForm.asset_type} onChange={e=>setAssetForm(p=>({...p,asset_type:e.target.value}))}>
                  {Object.entries(DEP_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select></div>
                <div><label className="text-xs text-gray-500">{t('القسم','Department')}</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={assetForm.department} onChange={e=>setAssetForm(p=>({...p,department:e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-500">{t('التكلفة الأصلية *','Original Cost *')}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={assetForm.cost} onChange={e=>setAssetForm(p=>({...p,cost:e.target.value}))} /></div>
                <div><label className="text-xs text-gray-500">{t('القيمة التخريدية','Salvage Value')}</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={assetForm.salvage_value} onChange={e=>setAssetForm(p=>({...p,salvage_value:e.target.value}))} /></div>
              </div>
              <div><label className="text-xs text-gray-500">{t('تاريخ الشراء *','Purchase Date *')}</label>
              <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={assetForm.purchase_date} onChange={e=>setAssetForm(p=>({...p,purchase_date:e.target.value}))} /></div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                {t('معدل الإهلاك الضريبي:','Tax rate:')} <strong>{DEP_RATES[assetForm.asset_type]}%</strong>
                {' · '}{['vehicles','computers'].includes(assetForm.asset_type)?t('رصيد متناقص','Declining Balance'):t('قسط ثابت','Straight Line')}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setShowAdd(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">{t('إلغاء','Cancel')}</button>
              <button onClick={addAsset} disabled={saving} className="flex-1 py-2.5 bg-[#28376B] text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {saving?t('جاري الحفظ...','Saving...'):t('إضافة + قيد محاسبي','Add + Journal Entry')}
              </button>
            </div>
          </div>
        </div>
      )}

      {schedule && scheduleAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={()=>setSchedule(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{t('جدول الإهلاك —','Depreciation Schedule —')} {scheduleAsset.name}</h3>
              <button onClick={()=>setSchedule(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                {[t('السنة','Year'),t('قيمة أول المدة','Opening'),t('الإهلاك','Dep.'),t('مجمع الإهلاك','Accum.'),t('القيمة الدفترية','Book Value')].map((h,i)=>(
                  <th key={i} className="p-2 text-right text-xs font-semibold text-gray-500 border-b">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {schedule.schedule?.map((row,i)=>(
                  <tr key={i} className={i===0?'bg-blue-50 font-semibold':''}>
                    <td className="p-2 text-xs">{row.label}</td>
                    <td className="p-2">{row.opening_value?.toLocaleString()} ج.م</td>
                    <td className="p-2 text-red-600">{row.depreciation?.toLocaleString()} ج.م</td>
                    <td className="p-2 text-orange-600">{row.accumulated?.toLocaleString()} ج.م</td>
                    <td className="p-2 font-bold text-green-700">{row.closing_value?.toLocaleString()} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
