import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { RefreshCw, Save, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const DEFAULT_ICONS = { instapay:'📱', vodafone_cash:'📲', bank_transfer:'🏦', credit_card:'💳', cash:'💵' };

export default function PaymentMethodsPanel() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/payment-settings`, { headers });
      if (r.ok) {
        const d = await r.json();
        setMethods(d.methods || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/admin/payment-settings`, {
        method: 'PUT', headers,
        body: JSON.stringify({ methods })
      });
      if (r.ok) toast.success(ar ? '✅ تم الحفظ' : '✅ Saved');
      else toast.error(ar ? 'خطأ في الحفظ' : 'Save error');
    } catch { toast.error('Error'); }
    setSaving(false);
  };

  const update = (idx, field, val) =>
    setMethods(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));

  const addMethod = () =>
    setMethods(prev => [...prev, { id: `method_${Date.now()}`, label_ar: 'طريقة جديدة', label_en: 'New Method', icon: '💰', account: '', active: true }]);

  const removeMethod = (idx) =>
    setMethods(prev => prev.filter((_, i) => i !== idx));

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 animate-spin text-[#28376B]" />
    </div>
  );

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0f1729] to-[#065f46] rounded-2xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black">{ar ? 'إعداد طرق الدفع' : 'Payment Methods Setup'}</h2>
          <p className="text-emerald-200 text-sm mt-1">{ar ? 'أرقام الحسابات والمحافظ المعتمدة للدفع' : 'Accepted account numbers and wallets'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addMethod} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> {ar ? 'إضافة طريقة' : 'Add Method'}
          </button>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-white text-[#0f1729] hover:bg-gray-100 px-4 py-2 rounded-xl text-sm font-bold transition-all">
            <Save className="w-4 h-4" /> {saving ? '...' : (ar ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>

      {/* Methods list */}
      <div className="space-y-3">
        {methods.map((m, i) => (
          <div key={i} className={`bg-white border rounded-2xl p-5 shadow-sm ${m.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              {/* Icon */}
              <div className="flex items-center gap-3">
                <input value={m.icon} onChange={e => update(i, 'icon', e.target.value)}
                  className="w-14 h-12 text-center text-2xl border border-gray-200 rounded-xl focus:outline-none focus:border-blue-400" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">{ar ? 'الأيقونة' : 'Icon'}</p>
                  <code className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">{m.id}</code>
                </div>
              </div>

              {/* Labels */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{ar ? 'الاسم بالعربي' : 'Arabic Name'}</label>
                <input value={m.label_ar} onChange={e => update(i, 'label_ar', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{ar ? 'الاسم بالإنجليزي' : 'English Name'}</label>
                <input value={m.label_en} onChange={e => update(i, 'label_en', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>

              {/* Account */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{ar ? 'رقم الحساب / الوصف' : 'Account Number / Info'}</label>
                <input value={m.account} onChange={e => update(i, 'account', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400"
                  placeholder={ar ? 'رقم المحفظة أو الحساب البنكي' : 'Wallet or bank account number'} />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => update(i, 'active', !m.active)}
                  className={`p-2.5 rounded-xl transition-all ${m.active ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  title={m.active ? (ar ? 'إيقاف' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}>
                  {m.active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => removeMethod(i)} className="p-2.5 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
        <h3 className="font-bold text-gray-700 mb-3 text-sm">{ar ? 'معاينة — كما يظهر للعملاء:' : 'Preview — as seen by clients:'}</h3>
        <div className="flex flex-wrap gap-3">
          {methods.filter(m => m.active).map((m, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center min-w-[120px] shadow-sm">
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="text-xs font-bold text-gray-700">{ar ? m.label_ar : m.label_en}</div>
              {m.account && <div className="text-xs text-gray-400 mt-1 font-mono">{m.account}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
