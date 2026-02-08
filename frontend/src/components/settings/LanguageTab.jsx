import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Languages, Check } from 'lucide-react';

const LanguageTab = ({ language, toggleLanguage }) => {
  return (
    <div className="max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-[#28376B]" />
            {language === 'ar' ? 'إعدادات اللغة' : 'Language Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">
            {language === 'ar' 
              ? 'اختر لغة العرض للنظام. سيتم تطبيق التغيير على جميع صفحات التطبيق.'
              : 'Choose the display language for the system. The change will be applied to all application pages.'}
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Arabic Option */}
            <div
              onClick={() => language !== 'ar' && toggleLanguage()}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                language === 'ar'
                  ? 'border-[#28376B] bg-[#28376B]/5 ring-2 ring-[#28376B]/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              data-testid="language-option-ar"
            >
              <div className="text-center space-y-3">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                  language === 'ar' ? 'bg-[#28376B] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className="text-xl font-bold">ع</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">العربية</h3>
                  <p className="text-sm text-gray-500">Arabic</p>
                </div>
                {language === 'ar' && (
                  <div className="text-[#28376B] font-semibold text-sm flex items-center justify-center gap-1">
                    <Check className="h-4 w-4" />
                    {language === 'ar' ? 'اللغة الحالية' : 'Current'}
                  </div>
                )}
              </div>
            </div>

            {/* English Option */}
            <div
              onClick={() => language !== 'en' && toggleLanguage()}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                language === 'en'
                  ? 'border-[#28376B] bg-[#28376B]/5 ring-2 ring-[#28376B]/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              data-testid="language-option-en"
            >
              <div className="text-center space-y-3">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                  language === 'en' ? 'bg-[#28376B] text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  <span className="text-xl font-bold">En</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">English</h3>
                  <p className="text-sm text-gray-500">الإنجليزية</p>
                </div>
                {language === 'en' && (
                  <div className="text-[#28376B] font-semibold text-sm flex items-center justify-center gap-1">
                    <Check className="h-4 w-4" />
                    Current Language
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-500 text-center">
              {language === 'ar'
                ? 'ملاحظة: سيتم حفظ تفضيلات اللغة تلقائياً'
                : 'Note: Language preferences will be saved automatically'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LanguageTab;
