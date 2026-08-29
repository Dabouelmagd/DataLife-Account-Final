import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Key, Shield, Copy, Check, Clock, AlertCircle, CreditCard } from 'lucide-react';

const SubscriptionTab = ({ 
  language, 
  company, 
  subscriptionCode, 
  copied, 
  handleCopyCode 
}) => {
  const ar = language === 'ar';
  const [codeInput, setCodeInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [codeMsg, setCodeMsg] = useState('');

  // Calculate trial days remaining
  const trialEnd = company?.trial_ends_at || company?.subscription_expires_at;
  const isTrial = company?.subscription_plan === 'trial' || company?.subscription_status === 'trial';
  const daysLeft = trialEnd 
    ? Math.ceil((new Date(trialEnd) - new Date()) / (1000*60*60*24))
    : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;

  const handleApplyCode = async () => {
    if (!codeInput.trim()) return;
    setApplying(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/activation-codes/redeem`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput.trim().toUpperCase() })
      });
      const data = await res.json();
      if (res.ok) {
        setCodeMsg(ar 
          ? `✅ ${data.message || 'تم تفعيل الاشتراك بنجاح!'}` 
          : `✅ ${data.message || 'Subscription activated successfully!'}`
        );
        setCodeInput('');
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setCodeMsg(ar ? `❌ ${data.detail || 'كود غير صحيح'}` : `❌ ${data.detail || 'Invalid code'}`);
      }
    } catch {
      setCodeMsg(ar ? '❌ حدث خطأ في الاتصال' : '❌ Connection error');
    }
    setApplying(false);
  };

  return (
    <div className="space-y-4">

      {/* Trial Countdown Banner */}
      {isTrial && daysLeft !== null && (
        <Card className={`border-2 ${isExpired ? 'border-red-500 bg-red-50' : daysLeft <= 3 ? 'border-red-400 bg-red-50' : daysLeft <= 7 ? 'border-amber-400 bg-amber-50' : 'border-blue-400 bg-blue-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                {isExpired ? <AlertCircle className="h-8 w-8 text-red-600"/> : <Clock className={`h-8 w-8 ${daysLeft <= 7 ? 'text-amber-600' : 'text-blue-600'}`}/>}
                <div>
                  <p className={`font-black text-lg ${isExpired ? 'text-red-700' : daysLeft <= 7 ? 'text-amber-700' : 'text-blue-700'}`}>
                    {isExpired 
                      ? (ar ? '⚠️ انتهت الفترة التجريبية' : '⚠️ Trial Expired')
                      : ar ? `متبقي ${daysLeft} يوم من الفترة التجريبية` : `${daysLeft} days left in trial`
                    }
                  </p>
                  <p className={`text-sm ${isExpired ? 'text-red-600' : 'text-gray-600'}`}>
                    {isExpired 
                      ? (ar ? 'يرجى الاشتراك للاستمرار في استخدام النظام' : 'Please subscribe to continue using the system')
                      : ar ? 'اشترك الآن للاستمرار في استخدام كامل المميزات' : 'Subscribe now to keep all features'
                    }
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-[#28376B] hover:bg-[#1e2a55] text-white gap-2"
                  onClick={() => window.open('https://datalifeaccount.com/pricing', '_blank')}
                >
                  <CreditCard className="h-4 w-4"/>
                  {ar ? 'اشترك الآن' : 'Subscribe Now'}
                </Button>
              </div>
            </div>
            {/* Progress bar */}
            {!isExpired && daysLeft !== null && (
              <div className="mt-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${daysLeft <= 3 ? 'bg-red-500' : daysLeft <= 7 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{width: `${Math.max(0, (daysLeft/14)*100)}%`}}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {ar ? `${14-daysLeft} من 14 يوم مستخدمة` : `${14-daysLeft} of 14 days used`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Subscription Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-[#28376B]"/>
              {ar ? 'تفاصيل الاشتراك' : 'Subscription Details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-500 text-sm">{ar ? 'الخطة' : 'Plan'}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                isTrial ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}>
                {isTrial ? (ar ? 'تجريبي' : 'Trial') : (company?.subscription_plan || (ar ? 'نشط' : 'Active'))}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-500 text-sm">{ar ? 'الشركة' : 'Company'}</span>
              <span className="font-medium text-sm">{company?.name || '-'}</span>
            </div>
            {trialEnd && (
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500 text-sm">{ar ? 'تاريخ الانتهاء' : 'Expires'}</span>
                <span className={`font-medium text-sm ${isExpired ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                  {new Date(trialEnd).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                </span>
              </div>
            )}
            {!isTrial && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500 text-sm">{ar ? 'الحالة' : 'Status'}</span>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                  {ar ? 'نشط' : 'Active'}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activation Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="h-5 w-5 text-[#28376B]"/>
              {ar ? 'كود التفعيل' : 'Activation Code'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current company code */}
            {subscriptionCode && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{ar ? 'كود شركتك' : 'Your company code'}</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <code className="flex-1 font-mono text-sm font-bold text-[#28376B]">{subscriptionCode}</code>
                  <button onClick={handleCopyCode} className="text-gray-400 hover:text-gray-600">
                    {copied ? <Check className="h-4 w-4 text-green-500"/> : <Copy className="h-4 w-4"/>}
                  </button>
                </div>
              </div>
            )}
            {/* Apply new code */}
            <div>
              <p className="text-xs text-gray-500 mb-1">{ar ? 'تفعيل كود اشتراك جديد' : 'Apply subscription code'}</p>
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={e => setCodeInput(e.target.value.toUpperCase())}
                  placeholder={ar ? 'أدخل الكود...' : 'Enter code...'}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#28376B]"
                  onKeyDown={e => e.key === 'Enter' && handleApplyCode()}
                />
                <Button onClick={handleApplyCode} disabled={applying || !codeInput.trim()} className="bg-[#28376B]">
                  {applying ? '...' : (ar ? 'تفعيل' : 'Apply')}
                </Button>
              </div>
              {codeMsg && <p className={`text-xs mt-1 ${codeMsg.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{codeMsg}</p>}
            </div>
            <Button 
              variant="outline" 
              className="w-full border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white gap-2"
              onClick={() => window.open('https://datalifeaccount.com/pricing', '_blank')}
            >
              <CreditCard className="h-4 w-4"/>
              {ar ? 'عرض خطط الاشتراك' : 'View Subscription Plans'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubscriptionTab;
