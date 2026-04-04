import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { 
  Plus, Trash2, RefreshCw, DollarSign, TrendingUp, Settings, Calculator
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

const CurrenciesPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [currencies, setCurrencies] = useState([]);
  const [exchangeRates, setExchangeRates] = useState([]);
  const [baseCurrency, setBaseCurrency] = useState('EGP');
  const [enabledCurrencies, setEnabledCurrencies] = useState(['EGP']);
  const [loading, setLoading] = useState(true);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showConverterModal, setShowConverterModal] = useState(false);
  
  // Rate form
  const [rateForm, setRateForm] = useState({
    to_currency: '',
    rate: '',
    effective_date: new Date().toISOString().split('T')[0]
  });
  
  // Converter form
  const [converterForm, setConverterForm] = useState({
    amount: 1000,
    from_currency: 'EGP',
    to_currency: 'USD',
    result: null
  });

  const t = {
    ar: {
      currencies: 'إدارة العملات',
      currencySettings: 'إعدادات العملات',
      exchangeRates: 'أسعار الصرف',
      baseCurrency: 'العملة الأساسية',
      enabledCurrencies: 'العملات المفعلة',
      code: 'الكود',
      name: 'الاسم',
      symbol: 'الرمز',
      rate: 'سعر الصرف',
      effectiveDate: 'تاريخ السريان',
      actions: 'الإجراءات',
      addRate: 'إضافة سعر صرف',
      currency: 'العملة',
      save: 'حفظ',
      cancel: 'إلغاء',
      enabled: 'مفعل',
      disabled: 'معطل',
      base: 'أساسي',
      noRates: 'لا توجد أسعار صرف',
      rateAdded: 'تم إضافة سعر الصرف بنجاح',
      settingsUpdated: 'تم تحديث الإعدادات بنجاح',
      error: 'حدث خطأ',
      converter: 'محول العملات',
      amount: 'المبلغ',
      from: 'من',
      to: 'إلى',
      convert: 'تحويل',
      result: 'النتيجة',
      rateInfo: 'سعر الصرف مقابل العملة الأساسية',
      totalCurrencies: 'إجمالي العملات',
      activeRates: 'أسعار الصرف النشطة'
    },
    en: {
      currencies: 'Currency Management',
      currencySettings: 'Currency Settings',
      exchangeRates: 'Exchange Rates',
      baseCurrency: 'Base Currency',
      enabledCurrencies: 'Enabled Currencies',
      code: 'Code',
      name: 'Name',
      symbol: 'Symbol',
      rate: 'Exchange Rate',
      effectiveDate: 'Effective Date',
      actions: 'Actions',
      addRate: 'Add Exchange Rate',
      currency: 'Currency',
      save: 'Save',
      cancel: 'Cancel',
      enabled: 'Enabled',
      disabled: 'Disabled',
      base: 'Base',
      noRates: 'No exchange rates',
      rateAdded: 'Exchange rate added successfully',
      settingsUpdated: 'Settings updated successfully',
      error: 'An error occurred',
      converter: 'Currency Converter',
      amount: 'Amount',
      from: 'From',
      to: 'To',
      convert: 'Convert',
      result: 'Result',
      rateInfo: 'Exchange rate against base currency',
      totalCurrencies: 'Total Currencies',
      activeRates: 'Active Rates'
    }
  };

  const text = t[language] || t.ar;
  const getToken = () => localStorage.getItem('token');

  const fetchCurrencies = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(`${API}/config/currencies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCurrencies(data.currencies || []);
      setBaseCurrency(data.base_currency || 'EGP');
      setEnabledCurrencies(data.enabled_currencies || ['EGP']);
    } catch (error) {
      console.error('Error fetching currencies:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExchangeRates = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/config/exchange-rates`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setExchangeRates(data.rates || []);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  }, []);

  useEffect(() => {
    fetchCurrencies();
    fetchExchangeRates();
  }, [fetchCurrencies, fetchExchangeRates]);

  const handleToggleCurrency = async (currencyCode, enabled) => {
    try {
      const token = getToken();
      let newEnabled;
      
      if (enabled) {
        newEnabled = [...enabledCurrencies, currencyCode];
      } else {
        if (currencyCode === baseCurrency) {
          toast.error(language === 'ar' ? 'لا يمكن تعطيل العملة الأساسية' : 'Cannot disable base currency');
          return;
        }
        newEnabled = enabledCurrencies.filter(c => c !== currencyCode);
      }
      
      const response = await fetch(`${API}/config/currencies/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled_currencies: newEnabled })
      });

      if (response.ok) {
        setEnabledCurrencies(newEnabled);
        toast.success(text.settingsUpdated);
        fetchCurrencies();
      }
    } catch (error) {
      toast.error(text.error);
    }
  };

  const handleSetBaseCurrency = async (currencyCode) => {
    try {
      const token = getToken();
      
      // Ensure the new base currency is enabled
      let newEnabled = enabledCurrencies;
      if (!enabledCurrencies.includes(currencyCode)) {
        newEnabled = [...enabledCurrencies, currencyCode];
      }
      
      const response = await fetch(`${API}/config/currencies/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          base_currency: currencyCode,
          enabled_currencies: newEnabled
        })
      });

      if (response.ok) {
        setBaseCurrency(currencyCode);
        setEnabledCurrencies(newEnabled);
        toast.success(text.settingsUpdated);
        fetchCurrencies();
        fetchExchangeRates();
      }
    } catch (error) {
      toast.error(text.error);
    }
  };

  const handleAddRate = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/config/exchange-rates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to_currency: rateForm.to_currency,
          rate: parseFloat(rateForm.rate),
          effective_date: rateForm.effective_date
        })
      });

      if (response.ok) {
        toast.success(text.rateAdded);
        setShowRateModal(false);
        setRateForm({ to_currency: '', rate: '', effective_date: new Date().toISOString().split('T')[0] });
        fetchExchangeRates();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.error);
      }
    } catch (error) {
      toast.error(text.error);
    }
  };

  const handleDeleteRate = async (rateId) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/config/exchange-rates/${rateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
        fetchExchangeRates();
      }
    } catch (error) {
      toast.error(text.error);
    }
  };

  const handleConvert = async () => {
    try {
      const token = getToken();
      const response = await fetch(
        `${API}/config/convert?amount=${converterForm.amount}&from_currency=${converterForm.from_currency}&to_currency=${converterForm.to_currency}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setConverterForm(prev => ({ ...prev, result: data }));
      }
    } catch (error) {
      toast.error(text.error);
    }
  };

  const getCurrencyName = (code) => {
    const curr = currencies.find(c => c.code === code);
    return curr ? (language === 'ar' ? curr.name_ar : curr.name_en) : code;
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{text.currencies}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {language === 'ar' ? 'إدارة العملات وأسعار الصرف' : 'Manage currencies and exchange rates'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConverterModal(true)}>
            <Calculator className="w-4 h-4 mr-2" />
            {text.converter}
          </Button>
          <Button onClick={() => setShowRateModal(true)} className="bg-[#28376B] hover:bg-[#1e2a52] text-white">
            <Plus className="w-4 h-4 mr-2" />
            {text.addRate}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.baseCurrency}</p>
                <p className="text-2xl font-bold text-[#28376B]">{baseCurrency}</p>
                <p className="text-xs text-gray-400">{getCurrencyName(baseCurrency)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-[#28376B]" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalCurrencies}</p>
                <p className="text-2xl font-bold text-green-600">{enabledCurrencies.length}</p>
                <p className="text-xs text-gray-400">{language === 'ar' ? 'عملة مفعلة' : 'enabled'}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.activeRates}</p>
                <p className="text-2xl font-bold text-purple-600">{exchangeRates.length}</p>
                <p className="text-xs text-gray-400">{language === 'ar' ? 'سعر صرف' : 'rates'}</p>
              </div>
              <RefreshCw className="w-10 h-10 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Currencies Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {text.currencySettings}
          </CardTitle>
          <CardDescription>
            {language === 'ar' ? 'اختر العملات المفعلة وحدد العملة الأساسية' : 'Select enabled currencies and set base currency'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{text.code}</TableHead>
                <TableHead>{text.name}</TableHead>
                <TableHead>{text.symbol}</TableHead>
                <TableHead>{text.enabled}</TableHead>
                <TableHead>{text.baseCurrency}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#28376B] mx-auto"></div>
                  </TableCell>
                </TableRow>
              ) : (
                currencies.map((currency) => (
                  <TableRow key={currency.code}>
                    <TableCell className="font-mono font-bold">{currency.code}</TableCell>
                    <TableCell>
                      {language === 'ar' ? currency.name_ar : currency.name_en}
                    </TableCell>
                    <TableCell className="text-lg">{currency.symbol}</TableCell>
                    <TableCell>
                      <Switch
                        checked={enabledCurrencies.includes(currency.code)}
                        onCheckedChange={(checked) => handleToggleCurrency(currency.code, checked)}
                        disabled={currency.code === baseCurrency}
                      />
                    </TableCell>
                    <TableCell>
                      {currency.code === baseCurrency ? (
                        <Badge className="bg-[#28376B] text-white">{text.base}</Badge>
                      ) : enabledCurrencies.includes(currency.code) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetBaseCurrency(currency.code)}
                        >
                          {language === 'ar' ? 'تعيين كأساسي' : 'Set as Base'}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Exchange Rates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            {text.exchangeRates}
          </CardTitle>
          <CardDescription>
            {text.rateInfo}: {baseCurrency}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{text.currency}</TableHead>
                <TableHead>{text.rate}</TableHead>
                <TableHead>{text.effectiveDate}</TableHead>
                <TableHead>{text.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exchangeRates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    {text.noRates}
                  </TableCell>
                </TableRow>
              ) : (
                exchangeRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{rate.to_currency}</span>
                        <span className="text-gray-500">
                          ({getCurrencyName(rate.to_currency)})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      1 {baseCurrency} = {rate.rate} {rate.to_currency}
                    </TableCell>
                    <TableCell>{rate.effective_date}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRate(rate.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Rate Modal */}
      <Dialog open={showRateModal} onOpenChange={setShowRateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.addRate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{text.currency}</label>
              <select
                value={rateForm.to_currency}
                onChange={(e) => setRateForm(prev => ({ ...prev, to_currency: e.target.value }))}
                className="w-full p-2 border rounded-md"
              >
                <option value="">{language === 'ar' ? 'اختر العملة' : 'Select currency'}</option>
                {currencies
                  .filter(c => c.code !== baseCurrency && enabledCurrencies.includes(c.code))
                  .map(c => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {language === 'ar' ? c.name_ar : c.name_en}
                    </option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">
                {text.rate} (1 {baseCurrency} = ?)
              </label>
              <Input
                type="number"
                step="0.0001"
                value={rateForm.rate}
                onChange={(e) => setRateForm(prev => ({ ...prev, rate: e.target.value }))}
                placeholder="0.0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{text.effectiveDate}</label>
              <Input
                type="date"
                value={rateForm.effective_date}
                onChange={(e) => setRateForm(prev => ({ ...prev, effective_date: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRateModal(false)}>{text.cancel}</Button>
              <Button
                onClick={handleAddRate}
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                disabled={!rateForm.to_currency || !rateForm.rate}
              >
                {text.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Currency Converter Modal */}
      <Dialog open={showConverterModal} onOpenChange={setShowConverterModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              {text.converter}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700">{text.amount}</label>
              <Input
                type="number"
                value={converterForm.amount}
                onChange={(e) => setConverterForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0, result: null }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.from}</label>
                <select
                  value={converterForm.from_currency}
                  onChange={(e) => setConverterForm(prev => ({ ...prev, from_currency: e.target.value, result: null }))}
                  className="w-full p-2 border rounded-md"
                >
                  {enabledCurrencies.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.to}</label>
                <select
                  value={converterForm.to_currency}
                  onChange={(e) => setConverterForm(prev => ({ ...prev, to_currency: e.target.value, result: null }))}
                  className="w-full p-2 border rounded-md"
                >
                  {enabledCurrencies.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={handleConvert} className="w-full bg-[#28376B] hover:bg-[#1e2a52] text-white">
              {text.convert}
            </Button>
            
            {converterForm.result && (
              <div className="p-4 bg-gray-100 rounded-lg text-center">
                <p className="text-sm text-gray-500">{text.result}</p>
                <p className="text-2xl font-bold text-[#28376B]">
                  {converterForm.result.converted_amount?.toLocaleString()} {converterForm.result.to_currency}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {text.rate}: 1 {converterForm.result.from_currency} = {converterForm.result.rate} {converterForm.result.to_currency}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CurrenciesPage;
