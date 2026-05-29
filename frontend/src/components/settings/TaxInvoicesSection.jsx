import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Receipt, Download, ExternalLink, FileSpreadsheet, Filter, Loader2 } from 'lucide-react';

/**
 * Tax invoices history section for the Subscription tab in Settings.
 * Shows all VAT-inclusive tax invoices issued to the company, with year
 * & month filtering and per-invoice download / open buttons.
 */
const TaxInvoicesSection = ({ language, companyId }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const isRTL = language === 'ar';

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${API_URL}/api/payments/tax-invoices`,
          {
            params: { company_id: companyId },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!cancelled) setInvoices(res.data || []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.detail ||
              (language === 'ar' ? 'فشل تحميل الفواتير' : 'Failed to load invoices')
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, API_URL, language]);

  // Compute available years (descending) for the dropdown
  const years = useMemo(() => {
    const ys = new Set();
    invoices.forEach((inv) => {
      if (inv.issued_at) ys.add(new Date(inv.issued_at).getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  }, [invoices]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (!inv.issued_at) return false;
      const d = new Date(inv.issued_at);
      if (yearFilter !== 'all' && d.getFullYear() !== Number(yearFilter)) return false;
      if (monthFilter !== 'all' && d.getMonth() + 1 !== Number(monthFilter)) return false;
      return true;
    });
  }, [invoices, yearFilter, monthFilter]);

  const totals = useMemo(() => {
    const sum = (key) =>
      filtered.reduce((acc, inv) => acc + Number(inv[key] || 0), 0);
    return {
      count: filtered.length,
      subtotal: sum('subtotal_egp'),
      vat: sum('vat_amount_egp'),
      total: sum('total_egp'),
    };
  }, [filtered]);

  const planLabel = (plan) => {
    const map = {
      starter:         { ar: 'المبتدئ',        en: 'Starter' },
      professional:    { ar: 'المحترف',        en: 'Professional' },
      enterprise:      { ar: 'المؤسسي',        en: 'Enterprise' },
      'hr-only':       { ar: 'الموارد البشرية', en: 'HR Only' },
      'financial-only':{ ar: 'المالية',         en: 'Financial Only' },
      'inventory-only':{ ar: 'المخزون',         en: 'Inventory Only' },
      lifetime:        { ar: 'اشتراك دائم',     en: 'Lifetime' },
    };
    const info = map[plan] || { ar: plan, en: plan };
    return language === 'ar' ? info.ar : info.en;
  };

  const openInvoice = (invoiceNumber) => {
    window.open(`${API_URL}/api/payments/tax-invoices/${invoiceNumber}/html`, '_blank');
  };

  const downloadInvoice = async (invoiceNumber) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/payments/tax-invoices/${invoiceNumber}/html`,
        { responseType: 'text' }
      );
      const blob = new Blob([res.data], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback to opening in new tab
      openInvoice(invoiceNumber);
    }
  };

  const exportCSV = () => {
    const headers = [
      language === 'ar' ? 'رقم الفاتورة' : 'Invoice #',
      language === 'ar' ? 'التاريخ' : 'Date',
      language === 'ar' ? 'العميل' : 'Customer',
      language === 'ar' ? 'الباقة' : 'Plan',
      language === 'ar' ? 'المجموع الفرعي' : 'Subtotal (EGP)',
      language === 'ar' ? 'الضريبة 14%' : 'VAT 14% (EGP)',
      language === 'ar' ? 'الإجمالي' : 'Total (EGP)',
    ];
    const rows = filtered.map((inv) => [
      inv.invoice_number,
      inv.issued_at ? new Date(inv.issued_at).toISOString().split('T')[0] : '',
      inv.customer_name || inv.customer_email,
      inv.plan,
      Number(inv.subtotal_egp).toFixed(2),
      Number(inv.vat_amount_egp).toFixed(2),
      Number(inv.total_egp).toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-invoices-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const months = [
    { v: '1', ar: 'يناير', en: 'Jan' },
    { v: '2', ar: 'فبراير', en: 'Feb' },
    { v: '3', ar: 'مارس', en: 'Mar' },
    { v: '4', ar: 'أبريل', en: 'Apr' },
    { v: '5', ar: 'مايو', en: 'May' },
    { v: '6', ar: 'يونيو', en: 'Jun' },
    { v: '7', ar: 'يوليو', en: 'Jul' },
    { v: '8', ar: 'أغسطس', en: 'Aug' },
    { v: '9', ar: 'سبتمبر', en: 'Sep' },
    { v: '10', ar: 'أكتوبر', en: 'Oct' },
    { v: '11', ar: 'نوفمبر', en: 'Nov' },
    { v: '12', ar: 'ديسمبر', en: 'Dec' },
  ];

  return (
    <Card className="md:col-span-2" data-testid="tax-invoices-section">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            {language === 'ar' ? 'سجل الفواتير الضريبية' : 'Tax Invoices History'}
          </div>
          <Button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            size="sm"
            variant="outline"
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            data-testid="export-invoices-csv"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            {language === 'ar' ? 'تصدير CSV' : 'Export CSV'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="h-4 w-4" />
            <span className="font-medium">{language === 'ar' ? 'تصفية' : 'Filter'}</span>
          </div>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500"
            data-testid="invoice-year-filter"
          >
            <option value="all">{language === 'ar' ? 'كل السنوات' : 'All years'}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500"
            data-testid="invoice-month-filter"
          >
            <option value="all">{language === 'ar' ? 'كل الأشهر' : 'All months'}</option>
            {months.map((m) => (
              <option key={m.v} value={m.v}>{language === 'ar' ? m.ar : m.en}</option>
            ))}
          </select>
          <div className="ml-auto text-sm text-gray-500">
            {totals.count} {language === 'ar' ? 'فاتورة' : 'invoices'}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Receipt className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>{language === 'ar' ? 'لا توجد فواتير ضريبية بعد' : 'No tax invoices yet'}</p>
            <p className="text-xs mt-1">
              {language === 'ar'
                ? 'ستظهر هنا تلقائياً بعد إتمام أي عملية دفع.'
                : 'They will appear here automatically after any payment.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                  <tr>
                    <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {language === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}
                    </th>
                    <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {language === 'ar' ? 'التاريخ' : 'Date'}
                    </th>
                    <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {language === 'ar' ? 'الباقة' : 'Plan'}
                    </th>
                    <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {language === 'ar' ? 'الضريبة 14%' : 'VAT 14%'}
                    </th>
                    <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {language === 'ar' ? 'الإجمالي' : 'Total'}
                    </th>
                    <th className="px-3 py-2 text-center">
                      {language === 'ar' ? 'إجراءات' : 'Actions'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filtered.map((inv) => (
                    <tr key={inv.invoice_number} className="hover:bg-emerald-50/30" data-testid={`invoice-row-${inv.invoice_number}`}>
                      <td className="px-3 py-2.5 font-mono text-xs text-emerald-700 font-semibold">
                        {inv.invoice_number}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">
                        {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString(
                          language === 'ar' ? 'ar-EG' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric' }
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{planLabel(inv.plan)}</td>
                      <td className="px-3 py-2.5 text-gray-600">
                        {Number(inv.vat_amount_egp).toLocaleString()} EGP
                      </td>
                      <td className="px-3 py-2.5 font-bold text-gray-900">
                        {Number(inv.total_egp).toLocaleString()} EGP
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openInvoice(inv.invoice_number)}
                            className="h-7 px-2 text-xs"
                            title={language === 'ar' ? 'عرض' : 'View'}
                            data-testid={`view-invoice-${inv.invoice_number}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => downloadInvoice(inv.invoice_number)}
                            className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                            title={language === 'ar' ? 'تحميل' : 'Download'}
                            data-testid={`download-invoice-${inv.invoice_number}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                  <tr className="font-bold text-emerald-900">
                    <td colSpan={3} className={`px-3 py-2.5 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {language === 'ar' ? 'الإجمالي (مفلتر)' : 'Total (filtered)'}
                    </td>
                    <td className="px-3 py-2.5">{totals.vat.toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP</td>
                    <td className="px-3 py-2.5">{totals.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} EGP</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              {language === 'ar'
                ? '* الأسعار شاملة ضريبة القيمة المضافة 14% بموجب القانون المصري.'
                : '* All prices are VAT-inclusive (14%) under Egyptian VAT law.'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TaxInvoicesSection;
