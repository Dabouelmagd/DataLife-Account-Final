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
          {/* DataLife Account Logo */}
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <img 
                src={language === 'ar' ? '/datalife-account-ar.jpg' : '/datalife-account-en.jpg'}
                alt="DataLife Account"
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="hidden md:block">
              <p className="text-slate-400 text-sm">
                {language === 'ar' ? 'نظام إدارة الموارد' : 'Enterprise Resource Planning'}
              </p>
              <p className="text-slate-500 text-xs">
                © {currentYear} {language === 'ar' ? 'جميع الحقوق محفوظة' : 'All Rights Reserved'}
              </p>
            </div>
          </div>

          {/* Powered By Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-600 hidden md:block"></div>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">
              Powered by
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-600 hidden md:block"></div>
          </div>

          {/* DataLife AI Logo */}
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-end">
              <p className="text-slate-400 text-sm">
                {language === 'ar' ? 'داتا لايف للذكاء الاصطناعي' : 'DataLife AI'}
              </p>
              <p className="text-slate-500 text-xs">
                {language === 'ar' ? 'حلول ذكية للأعمال' : 'Smart Business Solutions'}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-lg">
              <img 
                src="/datalife-ai.png"
                alt="DataLife AI"
                className="h-12 w-auto object-contain"
              />
            </div>
          </div>
        </div>

        {/* Mobile Copyright */}
        <div className="md:hidden text-center mt-4">
          <p className="text-slate-500 text-xs">
            © {currentYear} {language === 'ar' ? 'جميع الحقوق محفوظة' : 'All Rights Reserved'}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default AppFooter;
