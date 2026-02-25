import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const AppFooter = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700/50 py-6 px-8"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* DataLife AI - Company/Owner */}
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <img 
                src="/datalife-ai.png"
                alt="DataLife AI"
                className="h-14 w-auto object-contain"
              />
            </div>
            <div className="hidden md:block">
              <p className="text-white font-semibold text-sm">
                {language === 'ar' ? 'داتا لايف لخدمات الذكاء الاصطناعي' : 'DataLife AI Services'}
              </p>
              <p className="text-slate-400 text-xs">
                {language === 'ar' ? 'حلول ذكية للأعمال' : 'Smart Business Solutions'}
              </p>
            </div>
          </div>

          {/* Center - Product Info */}
          <div className="flex flex-col items-center gap-2">
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <img 
                src={language === 'ar' ? '/datalife-account-ar.jpg' : '/datalife-account-en.jpg'}
                alt="DataLife Account"
                className="h-12 w-auto object-contain"
              />
            </div>
            <p className="text-slate-400 text-xs text-center">
              {language === 'ar' ? 'نظام إدارة موارد المؤسسات' : 'Enterprise Resource Planning System'}
            </p>
          </div>

          {/* Copyright */}
          <div className="text-center md:text-end">
            <p className="text-slate-400 text-sm">
              © {currentYear} {language === 'ar' ? 'داتا لايف' : 'DataLife'}
            </p>
            <p className="text-slate-500 text-xs">
              {language === 'ar' ? 'جميع الحقوق محفوظة' : 'All Rights Reserved'}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
