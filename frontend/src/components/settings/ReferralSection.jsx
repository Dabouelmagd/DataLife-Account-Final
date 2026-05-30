import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  Gift, Copy, Check, Share2, Loader2, Users, TrendingUp, Mail,
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

/**
 * Referral Program section — shown inside the Subscription tab.
 * Lets the user copy/share their unique referral code, see how many
 * companies they have referred, and the discount credits earned.
 */
const ReferralSection = ({ language }) => {
  const isRTL = language === 'ar';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/api/referrals/my-code`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!cancelled) setData(res.data);
      } catch {
        if (!cancelled) toast.error(language === 'ar' ? 'تعذّر تحميل كود الإحالة' : 'Failed to load referral data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [language]);

  const doCopy = async (text, kind) => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === 'code') { setCopied(true); setTimeout(() => setCopied(false), 1800); }
      else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1800); }
      toast.success(language === 'ar' ? 'تم النسخ' : 'Copied!');
    } catch {
      toast.error(language === 'ar' ? 'فشل النسخ' : 'Copy failed');
    }
  };

  const shareVia = (channel) => {
    if (!data) return;
    const msg = language === 'ar'
      ? `جرّبي DataLife Account لإدارة شركتك! استخدمي كود الإحالة بتاعي ${data.code} واحصلي على شهر مجاني إضافي 🎁\n${data.share_url}`
      : `Try DataLife Account for your business! Use my referral code ${data.code} for an extra free month 🎁\n${data.share_url}`;
    const enc = encodeURIComponent(msg);
    const urls = {
      whatsapp: `https://wa.me/?text=${enc}`,
      email: `mailto:?subject=${encodeURIComponent(language === 'ar' ? 'دعوة للانضمام إلى DataLife Account' : 'Join DataLife Account')}&body=${enc}`,
      twitter: `https://twitter.com/intent/tweet?text=${enc}`,
    };
    window.open(urls[channel], '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="md:col-span-2" dir={isRTL ? 'rtl' : 'ltr'} data-testid="referral-section">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-emerald-600" />
          {language === 'ar' ? 'نظام الإحالة — اكسبي مع كل دعوة!' : 'Referral Program — Earn with every invite!'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : !data ? (
          <p className="text-sm text-rose-600">{language === 'ar' ? 'لا توجد بيانات' : 'No data available'}</p>
        ) : (
          <>
            {/* How it works */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3 text-sm">
                <div className="font-bold text-emerald-700 dark:text-emerald-300 mb-1">
                  {language === 'ar' ? '🎁 لكِ' : '🎁 For You'}
                </div>
                <div className="text-emerald-700 dark:text-emerald-200">
                  {language === 'ar'
                    ? `خصم ${data.discount_percent}% على فاتورتك التالية عند كل إحالة ناجحة`
                    : `${data.discount_percent}% off your next invoice for each successful referral`}
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-sm">
                <div className="font-bold text-blue-700 dark:text-blue-300 mb-1">
                  {language === 'ar' ? '🚀 لصديقاتك' : '🚀 For Friends'}
                </div>
                <div className="text-blue-700 dark:text-blue-200">
                  {language === 'ar'
                    ? `${data.invitee_free_days} يوم مجاني إضافي على فترة التجربة`
                    : `${data.invitee_free_days} extra free days on their trial`}
                </div>
              </div>
            </div>

            {/* Code + share */}
            <div className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-xl p-4 sm:p-5">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2">
                {language === 'ar' ? 'كود الإحالة الخاص بكِ' : 'Your Referral Code'}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <code className="text-2xl sm:text-3xl font-mono font-bold text-emerald-800 dark:text-emerald-200 tracking-widest bg-white/60 dark:bg-slate-900/60 px-4 py-2 rounded-lg" data-testid="referral-code-display">
                  {data.code}
                </code>
                <Button
                  size="sm"
                  onClick={() => doCopy(data.code, 'code')}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="copy-referral-code-btn"
                >
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied
                    ? (language === 'ar' ? 'تم!' : 'Copied!')
                    : (language === 'ar' ? 'نسخ الكود' : 'Copy Code')}
                </Button>
              </div>

              {/* Share link */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                  {language === 'ar' ? 'الرابط:' : 'Link:'}
                </span>
                <code className="flex-1 min-w-0 truncate bg-white/60 dark:bg-slate-900/60 px-2 py-1.5 rounded font-mono text-emerald-800 dark:text-emerald-200">
                  {data.share_url}
                </code>
                <button
                  onClick={() => doCopy(data.share_url, 'link')}
                  className="p-1.5 hover:bg-white/60 dark:hover:bg-slate-900/40 rounded transition-colors"
                  title={language === 'ar' ? 'نسخ الرابط' : 'Copy link'}
                  data-testid="copy-referral-link-btn"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5 text-emerald-700" />}
                </button>
              </div>

              {/* Share buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => shareVia('whatsapp')} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors" data-testid="share-whatsapp">
                  <Share2 className="h-3 w-3" /> WhatsApp
                </button>
                <button onClick={() => shareVia('email')} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg transition-colors" data-testid="share-email">
                  <Mail className="h-3 w-3" /> Email
                </button>
                <button onClick={() => shareVia('twitter')} className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors" data-testid="share-twitter">
                  <Share2 className="h-3 w-3" /> Twitter
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center gap-3" data-testid="referrals-count-card">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Users className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{data.referrals_count}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{language === 'ar' ? 'إحالات ناجحة' : 'Successful referrals'}</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 flex items-center gap-3" data-testid="credits-count-card">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{data.pending_credits}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{language === 'ar' ? 'خصومات معلقة' : 'Pending discounts'}</div>
                </div>
              </div>
            </div>

            {/* Referrals list */}
            {data.referrals?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  {language === 'ar' ? 'الشركات التي انضمت بكودك' : 'Companies you referred'}
                </div>
                <ul className="space-y-1.5">
                  {data.referrals.map((r, i) => (
                    <li key={i} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg" data-testid={`referral-row-${i}`}>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{r.company_name || '—'}</span>
                      <span className="text-xs text-slate-500">{r.joined_at?.split('T')[0]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralSection;
