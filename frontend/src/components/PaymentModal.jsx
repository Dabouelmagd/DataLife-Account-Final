import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { CheckCircle, CreditCard, Smartphone, Building, Wallet, Shield, Clock, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';

const PaymentModal = ({ isOpen, onClose, selectedPlan, billingCycle }) => {
  const { language, isRTL } = useLanguage();
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentStep, setPaymentStep] = useState('method'); // method, details, processing, success
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: '',
    email: '',
    phone: '',
    companyName: '',
    vatNumber: ''
  });

  const t = (key) => getTranslation(language, key);

  const paymentMethods = [
    {
      id: 'card',
      name: t('payment.methods.card'),
      description: t('payment.methods.cardDesc'),
      icon: <CreditCard className="h-6 w-6" />,
      providers: ['Visa', 'Mastercard', 'CIB', 'NBE'],
      processingTime: t('payment.instant')
    },
    {
      id: 'fawry',
      name: 'Fawry',
      description: t('payment.methods.fawryDesc'),
      icon: <Smartphone className="h-6 w-6" />,
      providers: ['Fawry Pay', 'Fawry+'],
      processingTime: t('payment.instant')
    },
    {
      id: 'bank',
      name: t('payment.methods.bank'),
      description: t('payment.methods.bankDesc'),
      icon: <Building className="h-6 w-6" />,
      providers: ['CIB', 'NBE', 'AAIB', 'QNB'],
      processingTime: t('payment.bankTime')
    },
    {
      id: 'wallet',
      name: t('payment.methods.wallet'),
      description: t('payment.methods.walletDesc'),
      icon: <Wallet className="h-6 w-6" />,
      providers: ['Vodafone Cash', 'Orange Money', 'Etisalat Cash'],
      processingTime: t('payment.instant')
    }
  ];

  const getCurrentPrice = () => {
    if (!selectedPlan) return 0;
    return billingCycle === 'monthly' ? selectedPlan.monthlyPrice : selectedPlan.annualPrice;
  };

  const getDiscountAmount = () => {
    if (!selectedPlan || billingCycle === 'monthly') return 0;
    return (selectedPlan.monthlyPrice * 12) - selectedPlan.annualPrice;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentStep('processing');

    // Simulate payment processing
    setTimeout(() => {
      setPaymentStep('success');
      // Send notifications (this would be handled by backend)
      sendPaymentNotifications();
    }, 3000);
  };

  const sendPaymentNotifications = () => {
    // This would be implemented in the backend
    console.log('Sending payment notifications...');
  };

  const renderPaymentMethodSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('payment.selectMethod')}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => (
          <Card 
            key={method.id}
            className={`cursor-pointer transition-all ${
              paymentMethod === method.id 
                ? 'border-[#28376B] border-2 bg-[#28376B]/5' 
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setPaymentMethod(method.id)}
          >
            <CardContent className="p-4">
              <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                <div className={`p-2 rounded-lg ${
                  paymentMethod === method.id ? 'bg-[#28376B] text-white' : 'bg-gray-100'
                }`}>
                  {method.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{method.name}</h4>
                  <p className="text-sm text-gray-600">{method.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {method.providers.map((provider, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                  <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-1 mt-1`}>
                    <Clock className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-500">{method.processingTime}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderPaymentDetails = () => (
    <form onSubmit={handlePaymentSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('payment.paymentDetails')}</h3>
        
        {paymentMethod === 'card' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="cardNumber">{t('payment.cardNumber')}</Label>
              <Input
                id="cardNumber"
                name="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={formData.cardNumber}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expiryDate">{t('payment.expiryDate')}</Label>
                <Input
                  id="expiryDate"
                  name="expiryDate"
                  placeholder="MM/YY"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cvv">{t('payment.cvv')}</Label>
                <Input
                  id="cvv"
                  name="cvv"
                  placeholder="123"
                  value={formData.cvv}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="cardName">{t('payment.cardName')}</Label>
              <Input
                id="cardName"
                name="cardName"
                placeholder={t('payment.cardNamePlaceholder')}
                value={formData.cardName}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        )}

        {paymentMethod === 'fawry' && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900">{t('payment.fawryInstructions')}</h4>
              <p className="text-sm text-blue-700 mt-2">
                {t('payment.fawrySteps')}
              </p>
            </div>
          </div>
        )}

        {paymentMethod === 'bank' && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-900">{t('payment.bankInstructions')}</h4>
              <p className="text-sm text-green-700 mt-2">
                {t('payment.bankDetails')}
              </p>
            </div>
          </div>
        )}

        {paymentMethod === 'wallet' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">{t('payment.walletPhone')}</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="01xxxxxxxxx"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        )}

        <Separator className="my-6" />

        <div className="space-y-4">
          <h4 className="font-medium">{t('payment.billingInfo')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">{t('payment.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">{t('payment.phone')}</Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+20 1xxxxxxxxx"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="companyName">{t('payment.companyName')}</Label>
            <Input
              id="companyName"
              name="companyName"
              placeholder={t('payment.companyNamePlaceholder')}
              value={formData.companyName}
              onChange={handleInputChange}
              required
            />
          </div>
          <div>
            <Label htmlFor="vatNumber">{t('payment.vatNumber')} ({t('payment.optional')})</Label>
            <Input
              id="vatNumber"
              name="vatNumber"
              placeholder="123456789"
              value={formData.vatNumber}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setPaymentStep('method')}
          className="flex-1"
        >
          {t('payment.back')}
        </Button>
        <Button 
          type="submit" 
          className="flex-1 bg-[#28376B] hover:bg-[#1e2a5a]"
        >
          {paymentMethod === 'card' ? t('payment.payNow') : t('payment.continue')}
        </Button>
      </div>
    </form>
  );

  const renderProcessing = () => (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#28376B] border-t-transparent mx-auto mb-6"></div>
      <h3 className="text-xl font-semibold mb-2">{t('payment.processing')}</h3>
      <p className="text-gray-600">{t('payment.processingDesc')}</p>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{t('payment.success')}</h3>
      <p className="text-gray-600 mb-6">{t('payment.successDesc')}</p>
      
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="text-sm text-gray-600 space-y-2">
          <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('payment.transactionId')}:</span>
            <span className="font-mono">TXN-{Date.now()}</span>
          </div>
          <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('payment.amount')}:</span>
            <span>{getCurrentPrice()} {selectedPlan?.currency}</span>
          </div>
          <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('payment.plan')}:</span>
            <span>{selectedPlan?.name}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-600">
        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 justify-center`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('payment.emailSent')}</span>
        </div>
        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 justify-center`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('payment.smsSent')}</span>
        </div>
        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 justify-center`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('payment.accountActivated')}</span>
        </div>
      </div>

      <Button 
        onClick={onClose}
        className="mt-6 bg-[#28376B] hover:bg-[#1e2a5a]"
      >
        {t('payment.getStarted')}
      </Button>
    </div>
  );

  if (!selectedPlan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={`text-2xl font-bold ${isRTL ? 'text-right' : ''}`}>
            {paymentStep === 'success' ? t('payment.paymentComplete') : t('payment.checkout')}
          </DialogTitle>
          {paymentStep !== 'success' && (
            <DialogDescription className={isRTL ? 'text-right' : ''}>
              {t('payment.secureCheckout')}
            </DialogDescription>
          )}
        </DialogHeader>

        {paymentStep !== 'success' && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className={`flex justify-between items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div>
                <h4 className="font-semibold">{selectedPlan.name}</h4>
                <p className="text-sm text-gray-600">
                  {billingCycle === 'monthly' ? t('pricing.billing.monthly') : t('pricing.billing.annual')}
                </p>
                {billingCycle === 'annual' && getDiscountAmount() > 0 && (
                  <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                    {t('payment.save')} {getDiscountAmount()} {selectedPlan.currency}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {getCurrentPrice()} {selectedPlan.currency}
                </div>
                {billingCycle === 'annual' && (
                  <div className="text-sm text-gray-500 line-through">
                    {selectedPlan.monthlyPrice * 12} {selectedPlan.currency}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {paymentStep === 'method' && renderPaymentMethodSelection()}
        {paymentStep === 'details' && renderPaymentDetails()}
        {paymentStep === 'processing' && renderProcessing()}
        {paymentStep === 'success' && renderSuccess()}

        {paymentStep === 'method' && (
          <div className={`flex gap-4 mt-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('payment.cancel')}
            </Button>
            <Button 
              onClick={() => setPaymentStep('details')}
              className="flex-1 bg-[#28376B] hover:bg-[#1e2a5a]"
              disabled={!paymentMethod}
            >
              {t('payment.continue')}
            </Button>
          </div>
        )}

        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 text-sm text-gray-500 mt-4`}>
          <Shield className="h-4 w-4" />
          <span>{t('payment.securePayment')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;