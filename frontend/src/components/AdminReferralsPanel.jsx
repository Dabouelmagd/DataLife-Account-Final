import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Gift, Users, CheckCircle, RefreshCw, ChevronDown, ChevronUp, Award } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminReferralsPanel() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch]   = useState('');
  const [granting, setGranting] = useState(null);

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/coupons/referral/admin/all`, { headers });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grantReward = async (userId, companyName) => {
    if (!window.confirm(ar ? `منح شهر مجاني لـ "${companyName}"؟` : `Grant free month to "${companyName}"?`)) return;
    setGranting(userId);
    try {
      const r = await fetch(`${API}/api/coupons/referral/admin/reward/${userId}`, { method: 'POST', headers });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success(ar ? '✅ تم منح الشهر المجاني' : '✅ Free month granted');
        fetchData();
      } else {
        toast.error(d.detail || 'Error');
      }
    } catch { toast.error('Error'); }
    setGranting(null);
  };

  const filtered = (data?.referrals || []).filter(r =>
    (r.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.referral_code || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 animate-spin text-[#28376B]" />
    </div>
  );

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#0f1729] to-[#7c3aed] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">{ar ? 'إدارة الإحالات' : 'Referrals Management'}</h2>
            <p className="text-purple-200 text-sm">{ar ? 'متابعة الإحالات والمكافآت' : 'Track referrals and rewards'}</p>
          </div>
          <button onClick={fetchData} className="mr-auto p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users,       val: data?.total || 0,          label: ar ? 'محيلون' : 'Referrers' },
            { icon: CheckCircle, val: data?.total_invites || 0,  label: ar ? 'إجمالي الإحالات' : 'Total Invites' },
            { icon: Award,       val: data?.rewarded || 0,       label: ar ? 'مكافآت مُنحت' : 'Rewards Given' },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1 text-purple-300" />
              <div className="text-2xl font-black">{val}</div>
              <div className="text-xs text-purple-300">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder={ar ? 'بحث بالشركة أو الاسم أو الكود...' : 'Search by company, name or code...'}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-400"
      />

      {/* Referrals table */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500">
          <div className="col-span-3">{ar ? 'الشركة' : 'Company'}</div>
          <div className="col-span-2">{ar ? 'الكود' : 'Code'}</div>
          <div className="col-span-2 text-center">{ar ? 'الإحالات' : 'Invites'}</div>
          <div className="col-span-2 text-center">{ar ? 'الاشتراكات' : 'Subscribed'}</div>
          <div className="col-span-2 text-center">{ar ? 'الحالة' : 'Status'}</div>
          <div className="col-span-1"></div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">
            {ar ? 'لا توجد إحالات بعد' : 'No referrals yet'}
          </div>
        )}

        {filtered.map((ref, i) => {
          const subscribedCount = (ref.invites || []).filter(inv => inv.subscribed).length;
          const isExpanded = expanded === ref.referral_code;
          const needsReward = ref.invited_count >= 5 && !ref.rewarded;

          return (
            <div key={i} className="border-b border-gray-50 last:border-0">
              <div
                className={`grid grid-cols-12 gap-2 px-5 py-3.5 items-center cursor-pointer hover:bg-gray-50 transition-colors ${needsReward ? 'bg-amber-50' : ''}`}
                onClick={() => setExpanded(isExpanded ? null : ref.referral_code)}
              >
                <div className="col-span-3">
                  <p className="text-sm font-semibold text-gray-800">{ref.company_name || ref.user_name}</p>
                  <p className="text-xs text-gray-400">{ref.email}</p>
                </div>
                <div className="col-span-2">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded-lg">{ref.referral_code}</code>
                </div>
                <div className="col-span-2 text-center">
                  <span className="font-bold text-gray-700">{ref.invited_count}</span>
                  <span className="text-xs text-gray-400"> / 5</span>
                </div>
                <div className="col-span-2 text-center">
                  <span className={`font-bold ${subscribedCount > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>{subscribedCount}</span>
                </div>
                <div className="col-span-2 text-center">
                  {ref.rewarded ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-1 rounded-full flex items-center gap-1 w-fit mx-auto">
                      <CheckCircle className="w-3 h-3" /> {ar ? 'مُكافأ' : 'Rewarded'}
                    </span>
                  ) : needsReward ? (
                    <button
                      onClick={e => { e.stopPropagation(); grantReward(ref.user_id, ref.company_name); }}
                      disabled={granting === ref.user_id}
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 w-fit mx-auto"
                    >
                      <Gift className="w-3 h-3" />
                      {granting === ref.user_id ? '...' : (ar ? 'منح مكافأة' : 'Grant')}
                    </button>
                  ) : (
                    <div className="text-center">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(ref.invited_count/5)*100}%` }} />
                      </div>
                      <span className="text-xs text-gray-400">{5 - ref.invited_count} {ar ? 'متبقي' : 'left'}</span>
                    </div>
                  )}
                </div>
                <div className="col-span-1 text-center text-gray-400">
                  {isExpanded ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
                </div>
              </div>

              {/* Expanded invites */}
              {isExpanded && (
                <div className="bg-gray-50 px-6 py-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">{ar ? 'الشركات المدعوة:' : 'Invited companies:'}</p>
                  {(ref.invites || []).length === 0 ? (
                    <p className="text-xs text-gray-400">{ar ? 'لا توجد إحالات بعد' : 'No invites yet'}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ref.invites.map((inv, j) => (
                        <div key={j} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                          <span className="text-xs text-gray-700">{inv.invited_email}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.subscribed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {inv.subscribed ? (ar ? 'مشترك' : 'Subscribed') : (ar ? 'معلق' : 'Pending')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
