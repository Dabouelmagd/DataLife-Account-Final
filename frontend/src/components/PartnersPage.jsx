import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PartnersPage({ language }) {
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const t = (ar, en) => language === 'ar' ? ar : en;
  return (
    <div className="min-h-screen bg-[#0F1729]" dir={isRTL?'rtl':'ltr'}>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/90 backdrop-blur-md border-b border-white/5 px-6 h-16 flex items-center justify-between">
        <button onClick={()=>navigate('/')} className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-white text-lg">D</div><span className="font-bold text-white text-lg">DataLife Account</span></button>
        <button onClick={()=>navigate(-1)} className="text-gray-400 hover:text-white text-sm">← {t('رجوع','Back')}</button>
      </nav>
      <div className="pt-24 pb-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-sm font-semibold mb-6">🤝 {t('برنامج الشراكة','Partnership Program')}</div>
          <h1 className="text-4xl font-black text-white mb-4">{t('انمُ معنا','Grow With Us')}</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">{t('انضم لبرنامج شركاء DataLife وابنِ مصدر دخل متكرر','Join DataLife Partners program and build a recurring income stream')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {icon:'⭐',name:t('شريك مُعتمَد','Certified Partner'),commission:'20%',target:t('0 — 10 عملاء','0-10 clients'),color:'from-gray-500 to-gray-700'},
            {icon:'🥇',name:t('شريك ذهبي','Gold Partner'),commission:'25%',target:t('10 — 30 عميل','10-30 clients'),color:'from-yellow-500 to-amber-600'},
            {icon:'💎',name:t('شريك بلاتيني','Platinum Partner'),commission:'30%',target:t('30+ عميل','30+ clients'),color:'from-purple-500 to-purple-700'},
          ].map((tier,i)=>(
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div className={`bg-gradient-to-r ${tier.color} p-5`}>
                <div className="text-3xl mb-2">{tier.icon}</div>
                <div className="text-white font-bold text-xl">{tier.name}</div>
                <div className="text-white/70 text-sm mt-1">{tier.target}</div>
              </div>
              <div className="p-5">
                <div className="text-4xl font-black text-yellow-400 mb-1">{tier.commission}</div>
                <div className="text-gray-400 text-sm">{t('عمولة متكررة','Recurring commission')}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a href="mailto:partners@datalifeai.com" className="inline-flex items-center gap-2 px-8 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-bold rounded-xl transition-all">
            🤝 {t('انضم كشريك الآن','Become a Partner Now')}
          </a>
          <p className="text-gray-500 text-sm mt-4">partners@datalifeai.com</p>
        </div>
      </div>
    </div>
  );
}
