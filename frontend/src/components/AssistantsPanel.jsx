/**
 * AssistantsPanel — إدارة مساعدي الـ Owner
 * Super Admin يضيف مساعدين بصلاحيات محددة
 */
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  UserPlus, Trash2, Edit2, CheckCircle, XCircle,
  Shield, Copy, Eye, EyeOff, Loader2, Users, Key
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

const API = process.env.REACT_APP_BACKEND_URL || '';

// Assistant permission groups (subset of platform permissions)
const ASSISTANT_PERMISSIONS = [
  { id: 'view_companies',   label_ar: '👁️ مشاهدة الشركات',        label_en: '👁️ View Companies' },
  { id: 'manage_companies', label_ar: '🏢 إدارة الشركات',           label_en: '🏢 Manage Companies' },
  { id: 'view_users',       label_ar: '👤 مشاهدة المستخدمين',       label_en: '👤 View Users' },
  { id: 'manage_users',     label_ar: '👥 إدارة المستخدمين',         label_en: '👥 Manage Users' },
  { id: 'view_subscriptions', label_ar: '📋 مشاهدة الاشتراكات',    label_en: '📋 View Subscriptions' },
  { id: 'manage_subscriptions', label_ar: '💳 إدارة الاشتراكات',   label_en: '💳 Manage Subscriptions' },
  { id: 'publish_updates',  label_ar: '🚀 نشر التحديثات',           label_en: '🚀 Publish Updates' },
  { id: 'view_analytics',   label_ar: '📊 مشاهدة التحليلات',        label_en: '📊 View Analytics' },
  { id: 'support',          label_ar: '🎧 الدعم الفني',              label_en: '🎧 Technical Support' },
  { id: 'manage_coupons',   label_ar: '🎁 إدارة الكوبونات',         label_en: '🎁 Manage Coupons' },
];

export default function AssistantsPanel() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';

  const [assistants, setAssistants]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [showPass, setShowPass]       = useState({});
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState(null);

  const [form, setForm] = useState({
    full_name: '', email: '',
    permissions: ['view_companies', 'view_users', 'view_subscriptions'],
  });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAssistants = async () => {
    try {
      const res = await fetch(`${API}/api/auth/assistants`, { headers });
      if (res.ok) setAssistants((await res.json()).assistants || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAssistants(); }, []);

  const togglePermission = (permId) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId]
    }));
  };

  const handleSave = async () => {
    if (!form.email || !form.full_name) {
      setMsg({ type: 'error', text: ar ? 'الاسم والبريد مطلوبان' : 'Name and email required' });
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        // Update existing
        const res = await fetch(`${API}/api/auth/assistants/${editingId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ permissions: form.permissions, full_name: form.full_name })
        });
        if (res.ok) {
          setMsg({ type: 'success', text: ar ? '✅ تم تحديث المساعد' : '✅ Assistant updated' });
          fetchAssistants();
          setShowForm(false); setEditingId(null);
        }
      } else {
        // Create new
        const res = await fetch(`${API}/api/auth/create-assistant`, {
          method: 'POST', headers, body: JSON.stringify(form)
        });
        const data = await res.json();
        if (res.ok) {
          setMsg({ type: 'success', text: ar ? `✅ تم إنشاء الحساب\nكلمة المرور المؤقتة: ${data.temp_password}` : `✅ Account created\nTemp password: ${data.temp_password}`, password: data.temp_password });
          fetchAssistants();
          setShowForm(false);
          setForm({ full_name: '', email: '', permissions: ['view_companies','view_users','view_subscriptions'] });
        } else {
          setMsg({ type: 'error', text: data.detail || (ar ? 'فشل الإنشاء' : 'Creation failed') });
        }
      }
    } catch { setMsg({ type: 'error', text: ar ? 'خطأ في الاتصال' : 'Connection error' }); }
    setSaving(false);
    setTimeout(() => setMsg(null), 10000);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(ar ? `حذف مساعد "${name}"؟` : `Delete assistant "${name}"?`)) return;
    await fetch(`${API}/api/auth/assistants/${id}`, { method: 'DELETE', headers });
    fetchAssistants();
  };

  const toggleActive = async (assistant) => {
    await fetch(`${API}/api/auth/assistants/${assistant.id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ is_active: !assistant.is_active })
    });
    fetchAssistants();
  };

  const startEdit = (assistant) => {
    setForm({ full_name: assistant.full_name, email: assistant.email, permissions: assistant.permissions || [] });
    setEditingId(assistant.id);
    setShowForm(true);
  };

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{ar ? 'مساعدو الـ Owner' : 'Owner Assistants'}</h2>
            <p className="text-xs text-gray-500">{ar ? 'أضف مساعدين بصلاحيات محددة للمساعدة في إدارة المنصة' : 'Add assistants with specific permissions to help manage the platform'}</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ full_name:'', email:'', permissions:['view_companies','view_users','view_subscriptions'] }); }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 text-white rounded-xl hover:bg-purple-800 transition-colors text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          {ar ? 'إضافة مساعد' : 'Add Assistant'}
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`p-4 rounded-xl text-sm border ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          <pre className="whitespace-pre-wrap font-sans">{msg.text}</pre>
          {msg.password && (
            <div className="mt-2 flex items-center gap-2">
              <code className="bg-green-100 px-3 py-1 rounded-lg font-mono font-bold text-green-900">{msg.password}</code>
              <button onClick={() => navigator.clipboard.writeText(msg.password)} className="text-green-600 hover:text-green-800">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-purple-200 shadow-md">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-gray-800">{editingId ? (ar ? 'تعديل مساعد' : 'Edit Assistant') : (ar ? 'إضافة مساعد جديد' : 'Add New Assistant')}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'الاسم الكامل *' : 'Full Name *'}</label>
                <input
                  type="text" placeholder={ar ? 'اسم المساعد' : 'Assistant name'}
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">{ar ? 'البريد الإلكتروني *' : 'Email *'}</label>
                <input
                  type="email" placeholder="assistant@example.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  disabled={!!editingId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-2">
                {ar ? 'الصلاحيات الممنوحة' : 'Granted Permissions'}
                <span className="text-purple-600 mr-2">({form.permissions.length}/{ASSISTANT_PERMISSIONS.length})</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ASSISTANT_PERMISSIONS.map(perm => (
                  <button
                    key={perm.id}
                    onClick={() => togglePermission(perm.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-start transition-all ${
                      form.permissions.includes(perm.id)
                        ? 'bg-purple-50 border-purple-300 text-purple-800 font-medium'
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                      form.permissions.includes(perm.id) ? 'bg-purple-600 border-purple-600' : 'border-gray-300'
                    }`}>
                      {form.permissions.includes(perm.id) && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    {ar ? perm.label_ar : perm.label_en}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editingId ? (ar ? 'حفظ التعديلات' : 'Save Changes') : (ar ? 'إنشاء الحساب' : 'Create Account')}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 text-sm">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assistants List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-600" /></div>
      ) : assistants.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{ar ? 'لا يوجد مساعدون بعد' : 'No assistants yet'}</p>
          <p className="text-sm mt-1">{ar ? 'اضغط "إضافة مساعد" لإضافة أول مساعد' : 'Click "Add Assistant" to add the first one'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assistants.map(assistant => (
            <Card key={assistant.id} className={`border ${assistant.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {assistant.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">{assistant.full_name}</span>
                      <Badge className="bg-purple-100 text-purple-700 text-xs">
                        {ar ? 'مساعد Owner' : 'Owner Assistant'}
                      </Badge>
                      {!assistant.is_active && <Badge className="bg-red-100 text-red-600 text-xs">{ar ? 'موقوف' : 'Suspended'}</Badge>}
                      {!assistant.has_logged_in && <Badge className="bg-yellow-100 text-yellow-700 text-xs">🟡 {ar ? 'لم يدخل بعد' : 'Not logged in'}</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{assistant.email}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(assistant.permissions || []).slice(0,4).map(p => {
                        const perm = ASSISTANT_PERMISSIONS.find(ap => ap.id === p);
                        return perm ? (
                          <span key={p} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            {ar ? perm.label_ar.split(' ').slice(1).join(' ') : perm.label_en.split(' ').slice(1).join(' ')}
                          </span>
                        ) : null;
                      })}
                      {(assistant.permissions || []).length > 4 && (
                        <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                          +{(assistant.permissions||[]).length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(assistant)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={ar ? 'تعديل' : 'Edit'}>
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(assistant)} className={`p-2 rounded-lg transition-colors ${assistant.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`} title={assistant.is_active ? (ar ? 'تعليق' : 'Suspend') : (ar ? 'تفعيل' : 'Activate')}>
                      {assistant.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(assistant.id, assistant.full_name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={ar ? 'حذف' : 'Delete'}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
