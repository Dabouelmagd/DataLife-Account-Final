/**
 * ActivationCodesPanel — إدارة أكواد التفعيل
 * Super Admin ينشئ أكواداً للعملاء
 */
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Key, Plus, Copy, Trash2, ToggleLeft, ToggleRight,
  CheckCircle, Loader2, Search, RefreshCw, Download
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

const PLANS = [
  { id: 'starter',      name_ar: 'مبتدئ',  name_en: 'Starter' },
  { id: 'professional', name_ar: 'محترف',  name_en: 'Professional' },
  { id: 'enterprise',   name_ar: 'مؤسسي',  name_en: 'Enterprise' },
];

const DURATIONS = [
  { id: 'monthly',  name_ar: 'شهري',     name_en: 'Monthly' },
  { id: '3months',  name_ar: '3 أشهر',   name_en: '3 Months' },
  { id: '6months',  name_ar: '6 أشهر',   name_en: '6 Months' },
  { id: 'yearly',   name_ar: 'سنوي',     name_en: 'Yearly' },
  { id: 'lifetime', name_ar: 'مدى الحياة', name_en: 'Lifetime' },
];

export default function ActivationCodesPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [codes, setCodes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);
  const [copied, setCopied]     = useState(null);

  const [form, setForm] = useState({
    plan: 'professional', duration: 'monthly', count: 1, notes: ''
  });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchCodes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/activation-codes`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCodes(Array.isArray(data) ? data : data.codes || []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const generateCodes = async () => {
    setSaving(true);
    try {
      const endpoint = form.count > 1
        ? `${API}/api/admin/activation-codes/bulk-generate`
        : `${API}/api/admin/activation-codes/generate`;

      const body = form.count > 1
        ? { plan: form.plan, duration: form.duration, count: form.count, notes: form.notes }
        : { plan: form.plan, duration: form.duration, notes: form.notes };

      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: ar ? `✅ تم إنشاء ${form.count} كود بنجاح` : `✅ ${form.count} code(s) generated` });
        setShowForm(false);
        fetchCodes();
      } else {
        setMsg({ type: 'error', text: data.detail || (ar ? 'فشل الإنشاء' : 'Generation failed') });
      }
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 5000);
  };

  const toggleCode = async (code) => {
    await fetch(`${API}/api/admin/activation-codes/${code}/toggle`, { method: 'PUT', headers });
    fetchCodes();
  };

  const deleteCode = async (code) => {
    if (!window.confirm(ar ? `حذف الكود "${code}"؟` : `Delete code "${code}"?`)) return;
    await fetch(`${API}/api/admin/activation-codes/${code}`, { method: 'DELETE', headers });
    fetchCodes();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const exportCodes = () => {
    const unused = codes.filter(c => !c.is_used && c.is_active);
    const text = unused.map(c => `${c.code} | ${c.plan} | ${c.duration}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'activation_codes.txt';
    a.click();
  };

  const filtered = codes.filter(c =>
    (c.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.plan || '').includes(search.toLowerCase()) ||
    (c.notes || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: codes.length,
    unused: codes.filter(c => !c.is_used && c.is_active).length,
    used: codes.filter(c => c.is_used).length,
    inactive: codes.filter(c => !c.is_active).length,
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a0f29] to-[#3d1f6e] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">{ar ? 'أكواد التفعيل' : 'Activation Codes'}</h2>
              <p className="text-purple-200 text-xs mt-0.5">{ar ? 'إنشاء وإدارة أكواد تفعيل الاشتراكات' : 'Generate and manage subscription activation codes'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCodes} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors" title={ar ? 'تصدير الأكواد غير المستخدمة' : 'Export unused codes'}>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={fetchCodes} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-800 rounded-xl font-bold text-sm hover:bg-purple-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {ar ? 'إنشاء كود' : 'Generate Code'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: ar ? 'الإجمالي' : 'Total',          value: stats.total,    color: 'text-white' },
            { label: ar ? 'متاح' : 'Available',           value: stats.unused,   color: 'text-green-300' },
            { label: ar ? 'مستخدم' : 'Used',             value: stats.used,     color: 'text-blue-300' },
            { label: ar ? 'موقوف' : 'Inactive',          value: stats.inactive, color: 'text-red-300' },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`p-3 rounded-xl text-sm border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {msg.text}
        </div>
      )}

      {/* Generate Form */}
      {showForm && (
        <Card className="border-purple-200 shadow-md">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-gray-800">{ar ? '🔑 إنشاء أكواد تفعيل' : '🔑 Generate Activation Codes'}</h3>

            <div className="grid grid-cols-3 gap-3">
              {/* Plan */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'الخطة' : 'Plan'}</label>
                <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {PLANS.map(p => <option key={p.id} value={p.id}>{ar ? p.name_ar : p.name_en}</option>)}
                </select>
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'المدة' : 'Duration'}</label>
                <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {DURATIONS.map(d => <option key={d.id} value={d.id}>{ar ? d.name_ar : d.name_en}</option>)}
                </select>
              </div>

              {/* Count */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'العدد' : 'Count'}</label>
                <input type="number" min="1" max="100" value={form.count}
                  onChange={e => setForm(f => ({ ...f, count: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'ملاحظة (اختياري)' : 'Notes (optional)'}</label>
              <input type="text" placeholder={ar ? 'مثال: عميل من المعرض' : 'e.g. Trade show client'}
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="flex gap-3">
              <button onClick={generateCodes} disabled={saving}
                className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {ar ? `إنشاء ${form.count} كود` : `Generate ${form.count} Code(s)`}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 border border-gray-300 rounded-xl text-gray-600 text-sm hover:bg-gray-50">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={ar ? 'بحث عن كود...' : 'Search codes...'}
          className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-xl text-sm" />
      </div>

      {/* Codes List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{ar ? 'لا توجد أكواد' : 'No activation codes found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((code, i) => (
            <Card key={i} className={`border ${!code.is_active ? 'opacity-50 border-gray-100' : code.is_used ? 'border-blue-100 bg-blue-50/20' : 'border-gray-200'}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Code */}
                  <div className={`flex-1 min-w-0`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className={`font-mono font-bold text-sm px-2 py-0.5 rounded ${code.is_used ? 'bg-blue-100 text-blue-700 line-through' : 'bg-purple-100 text-purple-800'}`}>
                        {code.code}
                      </code>
                      <Badge className={`text-xs ${
                        code.is_used ? 'bg-blue-100 text-blue-700' :
                        !code.is_active ? 'bg-gray-100 text-gray-500' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {code.is_used ? (ar ? 'مستخدم' : 'Used') :
                         !code.is_active ? (ar ? 'موقوف' : 'Inactive') :
                         (ar ? 'متاح' : 'Available')}
                      </Badge>
                      <span className="text-xs text-gray-500">{code.plan} · {code.duration}</span>
                      {code.notes && <span className="text-xs text-gray-400">💬 {code.notes}</span>}
                    </div>
                    {code.is_used && code.used_by && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        ✅ {ar ? 'استخدمه:' : 'Used by:'} {code.used_by} — {code.used_at ? new Date(code.used_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US') : ''}
                      </p>
                    )}
                    {code.created_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        📅 {new Date(code.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {!code.is_used && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => copyCode(code.code)}
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title={ar ? 'نسخ' : 'Copy'}>
                        {copied === code.code ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button onClick={() => toggleCode(code.code)}
                        className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title={code.is_active ? (ar ? 'إيقاف' : 'Deactivate') : (ar ? 'تفعيل' : 'Activate')}>
                        {code.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button onClick={() => deleteCode(code.code)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={ar ? 'حذف' : 'Delete'}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
