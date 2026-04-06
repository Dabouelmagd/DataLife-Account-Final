import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2, CreditCard, Shield } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PayPalSimulatePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const packageId = searchParams.get('package');

  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('pending'); // pending, success, error

  const t = {
    title: isRTL ? 'محاكاة دفع PayPal' : 'PayPal Payment Simulation',
    testMode: isRTL ? 'وضع الاختبار' : 'Test Mode',
    description: isRTL 
      ? 'هذه صفحة محاكاة لاختبار تدفق الدفع عبر PayPal. في الإنتاج، سيتم توجيهك إلى صفحة PayPal الحقيقية.'
      : 'This is a simulation page for testing PayPal payment flow. In production, you would be redirected to the actual PayPal page.',
    orderId: isRTL ? 'رقم الطلب' : 'Order ID',
    amount: isRTL ? 'المبلغ' : 'Amount',
    package: isRTL ? 'الباقة' : 'Package',
    confirmPayment: isRTL ? 'تأكيد الدفع' : 'Confirm Payment',
    cancelPayment: isRTL ? 'إلغاء' : 'Cancel',
    processing: isRTL ? 'جاري المعالجة...' : 'Processing...',
    success: isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!',
    successDesc: isRTL ? 'تم تفعيل اشتراكك بنجاح' : 'Your subscription has been activated',
    goToDashboard: isRTL ? 'الذهاب للوحة التحكم' : 'Go to Dashboard',
    error: isRTL ? 'فشل الدفع' : 'Payment Failed',
    tryAgain: isRTL ? 'حاول مرة أخرى' : 'Try Again'
  };

  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const response = await axios.post(`${API_URL}/api/payments/paypal/capture/${orderId}`);
      
      if (response.data.status === 'captured' || response.data.status === 'already_captured') {
        setStatus('success');
        toast.success(t.success);
      } else {
        setStatus('error');
        toast.error(t.error);
      }
    } catch (error) {
      console.error('Payment capture error:', error);
      setStatus('error');
      toast.error(t.error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    navigate('/subscription');
  };

  if (!orderId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {isRTL ? 'خطأ' : 'Error'}
            </h2>
            <p className="text-gray-600 mb-6">
              {isRTL ? 'رقم الطلب غير موجود' : 'Order ID not found'}
            </p>
            <Button onClick={() => navigate('/subscription')}>
              {isRTL ? 'العودة' : 'Go Back'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <Card className="max-w-md w-full mx-4 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.success}</h2>
            <p className="text-gray-600 mb-6">{t.successDesc}</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">{t.orderId}</span>
                <span className="font-medium">{orderId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t.amount}</span>
                <span className="font-medium">${amount} USD</span>
              </div>
            </div>
            <Button 
              className="w-full bg-[#28376B] hover:bg-[#1e2a52]"
              onClick={() => navigate('/dashboard')}
            >
              {t.goToDashboard}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="bg-[#003087] text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797H9.013c-.496 0-.918.363-.993.852l-1.087 6.842-.148.94a.64.64 0 0 1-.633.74H7.08l-.004-.001zm6.609-14.837h-.792c-.3 0-.554.218-.597.514l-.396 2.492c.31-.026.635-.04.974-.04 1.89 0 3.07-.57 3.472-2.166.053-.21.079-.403.079-.572 0-.39-.085-.61-.338-.77-.29-.183-.785-.258-1.502-.258z"/>
              </svg>
              PayPal
            </CardTitle>
            <span className="text-xs bg-yellow-400 text-black px-2 py-1 rounded font-medium">
              {t.testMode}
            </span>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          <p className="text-gray-600 text-sm mb-6 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {t.description}
          </p>

          <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.orderId}</span>
              <span className="font-mono text-sm">{orderId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.package}</span>
              <span className="font-medium">{packageId}</span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-gray-900 font-medium">{t.amount}</span>
              <span className="text-xl font-bold text-[#003087]">${amount} USD</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleCancel}
              disabled={processing}
            >
              {t.cancelPayment}
            </Button>
            <Button 
              className="flex-1 bg-[#0070ba] hover:bg-[#005ea6]"
              onClick={handleConfirmPayment}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t.processing}
                </>
              ) : (
                t.confirmPayment
              )}
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 mt-4 text-gray-400 text-xs">
            <Shield className="h-3 w-3" />
            <span>{isRTL ? 'محمي بواسطة PayPal' : 'Protected by PayPal'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayPalSimulatePage;
