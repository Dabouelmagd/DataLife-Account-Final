import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from 'sonner';
import { Copy, Gift, Users, CheckCircle, Clock, Share2, RefreshCw } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ReferralPanel() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]  = useState(false);

  const token   = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/coupons/referral/my-invites`, { headers });
      if (r.ok) setData(await r.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyLink = () => {
    if (!data?.referral_link) return;
    navigator.clipboard.writeText(data.referral_link);
    setCopied(true);
    toast.success(ar ? '✅ تم نسخ الرابط' : '✅ Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (!data?.referral_link) return;
    if (navigator.share) {
      navigator.share({
        title: ar ? 'انضم لداتا لايف أكونت' : 'Join DataLife Account',
        text: ar ? 'جرب أفضل نظام ERP مصري مجاناً 14 يوم' : 'Try Egypt\'s best ERP free for 14 days',
        url: data.referral_link,
      });
    } else {
      copyLink();
    }
  };

  const progress = data ? Math.min((data.invited_count / data.target) * 100, 100) : 0;
  const remaining = data ? Math.max(data.target - data.invited_count, 0) : 5;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 animate-spin text-[#28376B]" />
    </div>
  );

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="space-y-5">

      {/* Header banner */}
      <div className="bg-gradient-to-r from-[#0f1729] to-[#28376B] rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/15 rounded-xl flex items-center justify-center">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black">{ar ? 'نظام الإحالة' : 'Referral Program'}</h2>
            <p className="text-blue-200 text-sm">{ar ? 'ادعُ 5 شركات واحصل على شهر مجاني' : 'Invite 5 companies, get a free month'}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-blue-200">{ar ? 'التقدم نحو المكافأة' : 'Progress to reward'}</span>
            <span className="font-bold">{data?.invited_count || 0} / {data?.target || 5}</span>
          </div>
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
          {data?.rewarded ? (
            <p className="text-emerald-300 text-sm mt-2 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {ar ? '🎉 تم الحصول على المكافأة! شهر مجاني مُفعَّل' : '🎉 Reward claimed! Free month activated'}
            </p>
          ) : (
            <p className="text-blue-200 text-sm mt-2">
              {ar ? `${remaining} شركة متبقية للحصول على شهر مجاني` : `${remaining} more companies for free month`}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users,        val: data?.invited_count || 0, label: ar ? 'مدعوون' : 'Invited' },
            { icon: CheckCircle,  val: (data?.invites || []).filter(i => i.subscribed).length, label: ar ? 'اشتركوا' : 'Subscribed' },
            { icon: Gift,         val: data?.rewarded ? 1 : 0, label: ar ? 'مكافآت' : 'Rewards' },
          ].map(({ icon: Icon, val, label }) => (
            <div key={label} className="bg-white/10 rounded-xl p-3 text-center">
              <Icon className="w-4 h-4 mx-auto mb-1 text-blue-300" />
              <div className="text-2xl font-black">{val}</div>
              <div className="text-xs text-blue-300">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Referral link card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-[#28376B]" />
          {ar ? 'رابط الإحالة الخاص بك' : 'Your Referral Link'}
        </h3>

        {/* Code */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-sm text-gray-700 truncate">
            {data?.referral_code || '—'}
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-3 py-2 rounded-lg font-medium">
            {ar ? 'الكود' : 'Code'}
          </span>
        </div>

        {/* Link */}
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-50 border border-dashed border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-500 truncate">
            {data?.referral_link || '—'}
          </div>
          <button
            onClick={copyLink}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              copied ? 'bg-emerald-500 text-white' : 'bg-[#28376B] text-white hover:bg-[#0f1729]'
            }`}
          >
            <Copy className="w-4 h-4" />
            {copied ? (ar ? 'تم!' : 'Done!') : (ar ? 'نسخ' : 'Copy')}
          </button>
          <button
            onClick={shareLink}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
          >
            <Share2 className="w-4 h-4" />
            {ar ? 'مشاركة' : 'Share'}
          </button>
        </div>

        {/* How it works */}
        <div className="mt-4 bg-blue-50 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-800 mb-2">{ar ? 'كيف تعمل؟' : 'How it works?'}</p>
          <div className="space-y-1.5">
            {(ar ? [
              '1. شارك رابطك أو كودك مع شركات تعرفها',
              '2. كل شركة تسجل من رابطك تُحتسب كإحالة',
              '3. بعد 5 إحالات → تحصل على شهر مجاني تلقائياً',
            ] : [
              '1. Share your link or code with companies you know',
              '2. Every company that registers via your link counts',
              '3. After 5 referrals → free month added automatically',
            ]).map((step, i) => (
              <p key={i} className="text-xs text-blue-700">{step}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Invites list */}
      {data?.invites?.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">{ar ? 'الشركات المدعوة' : 'Invited Companies'}</h3>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-3 py-1 rounded-full">
              {data.invites.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {data.invites.map((inv, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{inv.invited_email}</p>
                  <p className="text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                  inv.subscribed
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {inv.subscribed ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {inv.subscribed
                    ? (ar ? `مشترك — ${inv.plan || ''}` : `Subscribed — ${inv.plan || ''}`)
                    : (ar ? 'في الانتظار' : 'Pending')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data?.invites?.length && (
        <div className="text-center py-8 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{ar ? 'لا توجد إحالات بعد — ابدأ بمشاركة رابطك!' : 'No referrals yet — start sharing your link!'}</p>
        </div>
      )}
    </div>
  );
}
