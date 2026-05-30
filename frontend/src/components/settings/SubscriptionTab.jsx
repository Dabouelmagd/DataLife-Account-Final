import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Key, Shield, Copy, Check } from 'lucide-react';
import TaxInvoicesSection from './TaxInvoicesSection';
import ReferralSection from './ReferralSection';
import ConversionAnalytics from './ConversionAnalytics';

const SubscriptionTab = ({ 
  language, 
  company, 
  subscriptionCode, 
  copied, 
  handleCopyCode 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Subscription Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-[#28376B]" />
            {language === 'ar' ? 'تفاصيل الاشتراك' : 'Subscription Details'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 rounded-xl p-4 text-center">
            <p className="text-sm text-amber-600 mb-2">{language === 'ar' ? 'كود الاشتراك' : 'Subscription Code'}</p>
            <code className="text-2xl font-mono font-bold text-amber-700 tracking-widest">
              {subscriptionCode}
            </code>
            <Button
              onClick={handleCopyCode}
              size="sm"
              className="mt-3 bg-amber-600 hover:bg-amber-700"
            >
              {copied ? (
                <><Check className="h-3 w-3 mr-1" /> {language === 'ar' ? 'تم!' : 'Done!'}</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> {language === 'ar' ? 'نسخ' : 'Copy'}</>
              )}
            </Button>
          </div>

          <div className="space-y-3 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{language === 'ar' ? 'نوع الاشتراك' : 'Plan Type'}</span>
              <span className="font-semibold text-[#28376B]">
                {company?.subscription_status === 'active' 
                  ? (language === 'ar' ? 'اشتراك مدفوع' : 'Paid Plan')
                  : (language === 'ar' ? 'فترة تجريبية' : 'Trial Period')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{language === 'ar' ? 'الحالة' : 'Status'}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                company?.subscription_status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {company?.subscription_status === 'active' 
                  ? (language === 'ar' ? 'نشط' : 'Active')
                  : (language === 'ar' ? 'تجريبي' : 'Trial')}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{language === 'ar' ? 'الشركة' : 'Company'}</span>
              <span className="font-semibold">{company?.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#28376B]" />
            {language === 'ar' ? 'المميزات المتاحة' : 'Available Features'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: language === 'ar' ? 'إدارة الموظفين' : 'Employee Management', included: true },
              { name: language === 'ar' ? 'إدارة الرواتب' : 'Payroll Management', included: true },
              { name: language === 'ar' ? 'الفواتير والمبيعات' : 'Invoices & Sales', included: true },
              { name: language === 'ar' ? 'إدارة المشتريات' : 'Purchases Management', included: true },
              { name: language === 'ar' ? 'إدارة المشاريع' : 'Projects Management', included: true },
              { name: language === 'ar' ? 'التقارير المتقدمة' : 'Advanced Reports', included: true },
              { name: language === 'ar' ? 'التحليلات الذكية' : 'Smart Analytics', included: true },
              { name: language === 'ar' ? 'الدعم الفني' : 'Technical Support', included: true },
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                  feature.included ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Check className="h-3 w-3" />
                </div>
                <span className={feature.included ? 'text-gray-700' : 'text-gray-400'}>
                  {feature.name}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Conversion Analytics — top of subscription tab */}
      <ConversionAnalytics language={language} />

      {/* Referral Program — spans full width */}
      <ReferralSection language={language} />

      {/* Tax Invoices History — spans full width */}
      <TaxInvoicesSection language={language} companyId={company?.id} />
    </div>
  );
};

export default SubscriptionTab;
