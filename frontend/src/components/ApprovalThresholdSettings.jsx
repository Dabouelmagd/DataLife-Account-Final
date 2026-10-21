import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Plus, Trash2, Save, Layers, UserCheck } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;
// document types whose requests carry an amount
const AMOUNT_TYPES = ['purchase_order', 'expense', 'invoice', 'salary_change'];

const emptyBand = () => ({ min_amount: '', max_amount: '', approver_roles: [], levels: '' });

const toForm = (t) => ({
  auto_approve_below: t.auto_approve_below ?? '',
  bands: (t.bands || []).map(b => ({
    min_amount: b.min_amount ?? '',
    max_amount: b.max_amount ?? '',
    approver_roles: b.approver_roles || [],
    levels: b.levels ?? '',
  })),
});

const ApprovalThresholdSettings = ({ token, isRTL }) => {
  const [data, setData] = useState(null);
  const [forms, setForms] = useState({});
  const [limits, setLimits] = useState({});
  const [saving, setSaving] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/approvals/settings/thresholds`,
        { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
      const f = {};
      (res.data.types || []).forEach(t => { f[t.type] = toForm(t); });
      setForms(f);
      const l = {};
      (res.data.users || []).forEach(u => { l[u.id] = u.approval_limit ?? ''; });
      setLimits(l);
    } catch (e) {
      // settings are optional: the page works without them
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (!data) return null;
  const canEdit = !!data.can_edit;
  const fmt = (v) => (v === '' || v === null || v === undefined) ? '∞' : Number(v).toLocaleString();

  const setBand = (type, i, patch) => setForms(prev => {
    const bands = prev[type].bands.map((b, j) => (j === i ? { ...b, ...patch } : b));
    return { ...prev, [type]: { ...prev[type], bands } };
  });

  const toggleRole = (type, i, role) => {
    const roles = forms[type].bands[i].approver_roles;
    setBand(type, i, { approver_roles: roles.includes(role) ? roles.filter(r => r !== role) : [...roles, role] });
  };

  const saveType = async (type) => {
    const f = forms[type];
    setSaving(type);
    try {
      await axios.put(`${API_URL}/api/approvals/settings/thresholds/${type}`, {
        auto_approve_below: f.auto_approve_below === '' ? null : Number(f.auto_approve_below),
        bands: f.bands.map(b => ({
          min_amount: b.min_amount === '' ? 0 : Number(b.min_amount),
          max_amount: b.max_amount === '' ? null : Number(b.max_amount),
          approver_roles: b.approver_roles,
          levels: b.levels === '' ? null : Number(b.levels),
        })),
      }, { headers });
      toast.success(isRTL ? 'تم حفظ حدود الاعتماد' : 'Thresholds saved');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving('');
    }
  };

  const saveLimit = async (userId) => {
    setSaving(userId);
    try {
      const v = limits[userId];
      await axios.put(`${API_URL}/api/approvals/limits/${userId}`,
        { approval_limit: v === '' ? null : Number(v) }, { headers });
      toast.success(isRTL ? 'تم حفظ حد المستخدم' : 'User limit saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || (isRTL ? 'تعذّر الحفظ' : 'Save failed'));
    } finally {
      setSaving('');
    }
  };

  const types = (data.types || []).filter(t => AMOUNT_TYPES.includes(t.type));

  return (
    <div className="space-y-6 mt-6" data-testid="approval-thresholds">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {isRTL ? 'شرائح المبالغ وحدود الاعتماد' : 'Amount bands & approval thresholds'}
          </CardTitle>
          <p className="text-sm text-gray-500">
            {isRTL
              ? 'المستند الذي يقع مبلغه داخل شريحة يُحجز بانتظار اعتماد أدوارها بالترتيب. أقل من «الاعتماد التلقائي» أو من حد المستخدم لا يحتاج موافقة.'
              : 'A document whose amount falls in a band waits for that band\'s roles, in order. Below auto-approve, or within the user\'s own limit, no approval is needed.'}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {types.map(t => {
            const f = forms[t.type] || { auto_approve_below: '', bands: [] };
            return (
              <div key={t.type} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-semibold">{isRTL ? t.name_ar : t.name_en}</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{isRTL ? 'اعتماد تلقائي أقل من' : 'Auto-approve below'}</span>
                    <Input type="number" min="0" className="w-32" disabled={!canEdit}
                      value={f.auto_approve_below}
                      onChange={e => setForms(p => ({ ...p, [t.type]: { ...f, auto_approve_below: e.target.value } }))} />
                  </div>
                </div>

                {f.bands.length === 0 && (
                  <p className="text-sm text-gray-400">
                    {isRTL ? 'لا شرائح — لا يُحجز أي مستند بسبب مبلغه.' : 'No bands — no document is held for its amount.'}
                  </p>
                )}

                {f.bands.map((b, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 dark:bg-slate-800 p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <Badge variant="outline">{isRTL ? `شريحة ${i + 1}` : `Band ${i + 1}`}</Badge>
                      <span className="text-gray-500">{isRTL ? 'من' : 'From'}</span>
                      <Input type="number" min="0" className="w-32" disabled={!canEdit} value={b.min_amount}
                        onChange={e => setBand(t.type, i, { min_amount: e.target.value })} />
                      <span className="text-gray-500">{isRTL ? 'إلى أقل من' : 'to below'}</span>
                      <Input type="number" min="0" className="w-32" disabled={!canEdit} value={b.max_amount}
                        placeholder="∞" onChange={e => setBand(t.type, i, { max_amount: e.target.value })} />
                      <span className="text-gray-500">{isRTL ? 'أو أول مستويات' : 'or first levels'}</span>
                      <Input type="number" min="1" className="w-20" disabled={!canEdit} value={b.levels}
                        onChange={e => setBand(t.type, i, { levels: e.target.value })} />
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="text-red-600"
                          onClick={() => setForms(p => ({ ...p, [t.type]: { ...f, bands: f.bands.filter((_, j) => j !== i) } }))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 items-center text-xs">
                      <span className="text-gray-500 me-1">{isRTL ? 'المعتمدون بالترتيب:' : 'Approvers in order:'}</span>
                      {(data.roles || []).map(role => {
                        const idx = b.approver_roles.indexOf(role);
                        return (
                          <button key={role} type="button" disabled={!canEdit}
                            onClick={() => toggleRole(t.type, i, role)}
                            className={`px-2 py-1 rounded-full border ${idx >= 0 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-900 text-gray-600 border-gray-200'}`}>
                            {idx >= 0 ? `${idx + 1}. ` : ''}{role}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400">
                      {fmt(b.min_amount === '' ? 0 : b.min_amount)} – {fmt(b.max_amount)}
                    </p>
                  </div>
                ))}

                {canEdit && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm"
                      onClick={() => setForms(p => ({ ...p, [t.type]: { ...f, bands: [...f.bands, emptyBand()] } }))}>
                      <Plus className="h-4 w-4 me-1" />{isRTL ? 'إضافة شريحة' : 'Add band'}
                    </Button>
                    <Button size="sm" disabled={saving === t.type} onClick={() => saveType(t.type)}>
                      <Save className="h-4 w-4 me-1" />{isRTL ? 'حفظ' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            {isRTL ? 'حد الاعتماد لكل مستخدم' : 'Per-user approval limit'}
          </CardTitle>
          <p className="text-sm text-gray-500">
            {isRTL
              ? 'المبلغ الذي يلتزم به المستخدم دون موافقة. فوقه يُحجز المستند للاعتماد. فارغ = حسب الشرائح فقط.'
              : 'What the user may commit without approval. Above it the document is held. Empty = bands only.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {(data.users || []).map(u => (
              <div key={u.id} className="flex items-center justify-between gap-2 py-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-gray-500">{u.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="number" min="0" className="w-36" disabled={!canEdit} placeholder="—"
                    value={limits[u.id] ?? ''}
                    onChange={e => setLimits(p => ({ ...p, [u.id]: e.target.value }))} />
                  {canEdit && (
                    <Button size="sm" variant="outline" disabled={saving === u.id} onClick={() => saveLimit(u.id)}>
                      <Save className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalThresholdSettings;
