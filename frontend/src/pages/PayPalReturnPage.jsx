import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PayPalReturnPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const paymentId = searchParams.get('paymentId');
  const payerId = searchParams.get('PayerID');
  const packageId = searchParams.get('package');

  const [status, setStatus] = useState('processing');
  const [error, setError] = useState('');

  const t = {
    processing: isRTL ? 'جاري تأكيد الدفع...' : 'Confirming payment...',
    success: isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!',
    successDesc: isRTL ? 'تم تفعيل اشتراكك بنجاح' : 'Your subscription has been activated',
    error: isRTL ? 'فشل الدفع' : 'Payment Failed',
    goToDashboard: isRTL ? 'الذهاب للوحة التحكم' : 'Go to Dashboard',
    tryAgain: isRTL ? 'حاول مرة أخرى' : 'Try Again'
  };

  useEffect(() => {
    if (paymentId && payerId) {
      capturePayment();
    } else {
      setStatus('error');
      setError(isRTL ? 'معلومات الدفع غير مكتملة' : 'Payment information incomplete');
    }
  }, [paymentId, payerId]);

  const capturePayment = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/payments/paypal/capture/${paymentId}?payer_id=${payerId}`
      );
      
      if (response.data.status === 'captured' || response.data.status === 'already_captured') {
        setStatus('success');
        toast.success(t.success);
      } else {
        setStatus('error');
        setError(isRTL ? 'فشل في تأكيد الدفع' : 'Failed to confirm payment');
      }
    } catch (err) {
      console.error('Payment capture error:', err);
      setStatus('error');
      setError(err.response?.data?.detail || (isRTL ? 'خطأ في تأكيد الدفع' : 'Error confirming payment'));
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4 ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="p-8 text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="h-16 w-16 animate-spin text-[#003087] mx-auto mb-6" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t.processing}</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.success}</h2>
              <p className="text-gray-600 mb-6">{t.successDesc}</p>
              <Button 
                className="w-full bg-[#28376B] hover:bg-[#1e2a52]"
                onClick={() => navigate('/dashboard')}
              >
                {t.goToDashboard}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-red-700 mb-2">{t.error}</h2>
              <p className="text-red-500 mb-6">{error}</p>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => navigate('/payment')}
              >
                {t.tryAgain}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PayPalReturnPage;
