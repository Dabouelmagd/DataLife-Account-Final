import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { CheckCircle, Calendar, Users, BarChart3, Shield, Star, Gift, ArrowRight, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';

const FreeTrialModal = ({ isOpen, onClose }) => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState('form'); // form, processing, success
  const [trialId, setTrialId] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    phone: '',
    industry: '',
    companySize: '',
    intendedUse: '',
    howHeard: ''
  });

  const t = (key) => getTranslation(language, key);

  const trialFeatures = [
    {
      icon: <Calendar className="h-5 w-5" />,
      title: t('trial.features.duration'),
      description: t('trial.features.durationDesc')
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: t('trial.features.employees'),
      description: t('trial.features.employeesDesc')
    },
    {
      icon: <BarChart3 className="h-5 w-5" />,
      title: t('trial.features.fullAccess'),
      description: t('trial.features.fullAccessDesc')
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: t('trial.features.support'),
      description: t('trial.features.supportDesc')
    }
  ];

  const industries = [
    'Manufacturing',
    'Retail',
    'Healthcare',
    'Education',
    'Technology',
    'Finance',
    'Real Estate',
    'Construction',
    'Food & Beverage',
    'Other'
  ];

  const companySizes = [
    '1-10 employees',
    '11-50 employees', 
    '51-200 employees',
    '200+ employees'
  ];

  const intendedUses = [
    'Replace current accounting software',
    'First-time business management system',
    'Expand from basic bookkeeping',
    'Integrate scattered systems',
    'Scale growing business operations'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStep('processing');

    try {
      // Submit trial registration
      const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${BACKEND_URL}/api/trials/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          first_name: formData.firstName,
          last_name: formData.lastName,
          company_name: formData.companyName,
          phone: formData.phone,
          industry: formData.industry,
          company_size: formData.companySize,
          intended_use: formData.intendedUse,
          how_heard: formData.howHeard
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setTrialId(result.id);
        setTimeout(() => {
          setStep('success');
        }, 2000);
      } else {
        throw new Error(result.detail || 'Failed to start trial');
      }
    } catch (error) {
      console.error('Trial registration failed:', error);
      alert('Failed to start trial. Please try again.');
      setStep('form');
    }
  };

  const renderTrialForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">{t('trial.form.title')}</h3>
        
        {/* Personal Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="firstName">{t('trial.form.firstName')} *</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
              placeholder={t('trial.form.firstNamePlaceholder')}
            />
          </div>
          <div>
            <Label htmlFor="lastName">{t('trial.form.lastName')} *</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
              placeholder={t('trial.form.lastNamePlaceholder')}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label htmlFor="email">{t('trial.form.email')} *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="name@company.com"
            />
          </div>
          <div>
            <Label htmlFor="phone">{t('trial.form.phone')}</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="+20 1xxxxxxxxx"
            />
          </div>
        </div>

        <div className="mb-6">
          <Label htmlFor="companyName">{t('trial.form.companyName')} *</Label>
          <Input
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleInputChange}
            required
            placeholder={t('trial.form.companyNamePlaceholder')}
          />
        </div>

        <Separator className="my-6" />

        {/* Business Information */}
        <h4 className="font-medium mb-4">{t('trial.form.businessInfo')}</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="industry">{t('trial.form.industry')}</Label>
            <Select value={formData.industry} onValueChange={(value) => handleSelectChange('industry', value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('trial.form.selectIndustry')} />
              </SelectTrigger>
              <SelectContent>
                {industries.map((industry) => (
                  <SelectItem key={industry} value={industry}>
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="companySize">{t('trial.form.companySize')}</Label>
            <Select value={formData.companySize} onValueChange={(value) => handleSelectChange('companySize', value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('trial.form.selectSize')} />
              </SelectTrigger>
              <SelectContent>
                {companySizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-4">
          <Label htmlFor="intendedUse">{t('trial.form.intendedUse')}</Label>
          <Select value={formData.intendedUse} onValueChange={(value) => handleSelectChange('intendedUse', value)}>
            <SelectTrigger>
              <SelectValue placeholder={t('trial.form.selectUse')} />
            </SelectTrigger>
            <SelectContent>
              {intendedUses.map((use) => (
                <SelectItem key={use} value={use}>
                  {use}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          {t('trial.form.cancel')}
        </Button>
        <Button type="submit" className="flex-1 bg-[#28376B] hover:bg-[#1e2a5a]">
          {t('trial.form.startTrial')}
        </Button>
      </div>
    </form>
  );

  const renderProcessing = () => (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#28376B] border-t-transparent mx-auto mb-6"></div>
      <h3 className="text-xl font-semibold mb-2">{t('trial.processing.title')}</h3>
      <p className="text-gray-600">{t('trial.processing.description')}</p>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold mb-2">{t('trial.success.title')}</h3>
      <p className="text-gray-600 mb-6">{t('trial.success.description')}</p>
      
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="text-sm text-gray-600 space-y-2">
          <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('trial.success.trialLength')}:</span>
            <span className="font-semibold">14 {t('trial.success.days')}</span>
          </div>
          <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('trial.success.maxEmployees')}:</span>
            <span className="font-semibold">25 {t('trial.success.employees')}</span>
          </div>
          <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('trial.success.features')}:</span>
            <span className="font-semibold">{t('trial.success.fullAccess')}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-sm text-gray-600 mb-6">
        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 justify-center`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('trial.success.emailSent')}</span>
        </div>
        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 justify-center`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('trial.success.accountCreated')}</span>
        </div>
        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 justify-center`}>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span>{t('trial.success.sampleData')}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          onClick={() => {
            onClose();
            navigate('/register-company', { 
              state: { 
                email: formData.email, 
                trialId: trialId 
              } 
            });
          }}
          className="bg-[#28376B] hover:bg-[#1e2a5a] flex-1"
        >
          <ArrowRight className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {t('trial.success.accessTrial')}
        </Button>
        <Button 
          variant="outline"
          onClick={onClose}
          className="flex-1"
        >
          {t('trial.form.cancel')}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={`text-2xl font-bold ${isRTL ? 'text-right' : ''}`}>
            {step === 'success' ? t('trial.success.header') : t('trial.title')}
          </DialogTitle>
          {step !== 'success' && (
            <DialogDescription className={isRTL ? 'text-right' : ''}>
              {t('trial.description')}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'form' && (
          <>
            {/* Trial Benefits */}
            <div className="bg-gradient-to-r from-[#28376B]/10 to-blue-50 rounded-lg p-6 mb-6">
              <div className="flex items-center mb-4">
                <Gift className="h-6 w-6 text-[#28376B] mr-3" />
                <h3 className="text-lg font-semibold text-[#28376B]">
                  {t('trial.benefits.title')}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trialFeatures.map((feature, index) => (
                  <div key={index} className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3`}>
                    <div className="text-[#28376B]">{feature.icon}</div>
                    <div>
                      <p className="font-medium text-gray-900">{feature.title}</p>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {renderTrialForm()}
          </>
        )}

        {step === 'processing' && renderProcessing()}
        {step === 'success' && renderSuccess()}

        <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 text-sm text-gray-500 mt-4`}>
          <Shield className="h-4 w-4" />
          <span>{t('trial.security')}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeTrialModal;