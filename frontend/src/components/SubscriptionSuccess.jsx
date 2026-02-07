import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle2, Loader2, XCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const SubscriptionSuccess = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRTL = language === 'ar';
  
  const [status, setStatus] = useState('checking'); // checking, success, error
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');
  const [pollCount, setPollCount] = useState(0);

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const sessionId = searchParams.get('session_id');

  const t = {
    checking: isRTL ? 'جاري التحقق من الدفع...' : 'Verifying payment...',
    success: isRTL ? 'تم الدفع بنجاح!' : 'Payment Successful!',
    error: isRTL ? 'فشل الدفع' : 'Payment Failed',
    subscriptionActivated: isRTL ? 'تم تفعيل اشتراكك بنجاح' : 'Your subscription has been activated',
    plan: isRTL ? 'الخطة' : 'Plan',
    duration: isRTL ? 'المدة' : 'Duration',
    goToDashboard: isRTL ? 'الذهاب إلى لوحة التحكم' : 'Go to Dashboard',
    tryAgain: isRTL ? 'حاول مرة أخرى' : 'Try Again',
    processing: isRTL ? 'جاري معالجة الدفع...' : 'Processing payment...'
  };

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setStatus('error');
      setError(isRTL ? 'لم يتم العثور على معرف الجلسة' : 'Session ID not found');
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (pollCount >= maxAttempts) {
      setStatus('error');
      setError(isRTL ? 'انتهت مهلة التحقق من الدفع' : 'Payment verification timed out');
      return;
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/payments/status/${sessionId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;

      if (data.payment_status === 'paid') {
        setStatus('success');
        setPaymentData(data);
        return;
      } else if (data.status === 'expired' || data.payment_status === 'unpaid') {
        setStatus('error');
        setError(isRTL ? 'انتهت صلاحية جلسة الدفع' : 'Payment session expired');
        return;
      }

      // Continue polling
      setPollCount(prev => prev + 1);
      setTimeout(pollPaymentStatus, pollInterval);
    } catch (err) {
      setStatus('error');
      setError(err.response?.data?.detail || (isRTL ? 'خطأ في التحقق من الدفع' : 'Error verifying payment'));
    }
  };

  const getDurationLabel = (duration) => {
    const labels = {
      '3_months': isRTL ? '3 أشهر' : '3 Months',
      '6_months': isRTL ? '6 أشهر' : '6 Months',
      '9_months': isRTL ? '9 أشهر' : '9 Months',
      '12_months': isRTL ? 'سنة' : '1 Year',
      'lifetime': isRTL ? 'مدى الحياة' : 'Lifetime'
    };
    return labels[duration] || duration;
  };

  const getPlanLabel = (plan) => {
    const labels = {
      'starter': isRTL ? 'المبتدئ' : 'Starter',
      'professional': isRTL ? 'المحترف' : 'Professional',
      'enterprise': isRTL ? 'المؤسسي' : 'Enterprise'
    };
    return labels[plan] || plan;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="max-w-md w-full" data-testid="payment-result-card">
        <CardHeader className="text-center">
          {status === 'checking' && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
              </div>
              <CardTitle className="text-xl">{t.checking}</CardTitle>
              <p className="text-gray-500 mt-2">{t.processing}</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 p-4 bg-green-100 rounded-full">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-700">{t.success}</CardTitle>
              <p className="text-gray-600 mt-2">{t.subscriptionActivated}</p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 p-4 bg-red-100 rounded-full">
                <XCircle className="h-16 w-16 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-700">{t.error}</CardTitle>
              <p className="text-red-500 mt-2">{error}</p>
            </>
          )}
        </CardHeader>
        
        <CardContent>
          {status === 'success' && paymentData && (
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">{t.plan}:</span>
                  <span className="font-semibold">{getPlanLabel(paymentData.package?.plan)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t.duration}:</span>
                  <span className="font-semibold">{getDurationLabel(paymentData.package?.duration)}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-3">
            {status === 'success' && (
              <Button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                data-testid="go-to-dashboard-btn"
              >
                {t.goToDashboard}
                {isRTL ? <ArrowLeft className="h-5 w-5 mr-2" /> : <ArrowRight className="h-5 w-5 ml-2" />}
              </Button>
            )}
            
            {status === 'error' && (
              <Button
                onClick={() => navigate('/subscription')}
                className="w-full"
                data-testid="try-again-btn"
              >
                {t.tryAgain}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;
