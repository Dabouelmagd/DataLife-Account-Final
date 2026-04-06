import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
  DialogDescription,
} from '../components/ui/dialog';
import { 
  FileText, Download, Send, RefreshCw, Calendar, Clock, 
  CheckCircle, Mail, BarChart3, TrendingUp, Settings,
  Play, AlertCircle, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL + '/api/reports';
const getToken = () => localStorage.getItem('token');

export default function ReportManagementPage() {
  const { language } = useLanguage();
  const { isDark } = useTheme();
  const isRTL = language === 'ar';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  
  const [generateForm, setGenerateForm] = useState({
    report_type: 'weekly',
    start_date: '',
    end_date: '',
    send_email: false,
    email_to: ''
  });

  const [sendForm, setSendForm] = useState({
    report_type: 'weekly',
    email_to: ''
  });

  const t = {
    ar: {
      title: 'إدارة التقارير',
      subtitle: 'إنشاء وتحميل وإرسال تقارير المبيعات والكوبونات',
      generateReport: 'إنشاء تقرير',
      sendReport: 'إرسال تقرير',
      downloadReport: 'تحميل تقرير',
      reportHistory: 'سجل التقارير',
      reportType: 'نوع التقرير',
      weekly: 'أسبوعي',
      monthly: 'شهري',
      custom: 'مخصص',
      startDate: 'من تاريخ',
      endDate: 'إلى تاريخ',
      sendViaEmail: 'إرسال عبر البريد',
      emailTo: 'البريد الإلكتروني',
      generate: 'إنشاء',
      send: 'إرسال',
      cancel: 'إلغاء',
      generating: 'جاري الإنشاء...',
      sending: 'جاري الإرسال...',
      reportGenerated: 'تم إنشاء التقرير بنجاح',
      reportSent: 'تم إرسال التقرير بنجاح',
      error: 'حدث خطأ',
      noReports: 'لا توجد تقارير',
      date: 'التاريخ',
      period: 'الفترة',
      status: 'الحالة',
      sentTo: 'أُرسل إلى',
      actions: 'الإجراءات',
      generated: 'تم الإنشاء',
      sent: 'تم الإرسال',
      quickActions: 'إجراءات سريعة',
      downloadWeekly: 'تحميل التقرير الأسبوعي',
      downloadMonthly: 'تحميل التقرير الشهري',
      sendWeeklyNow: 'إرسال التقرير الأسبوعي الآن',
      sendMonthlyNow: 'إرسال التقرير الشهري الآن',
      stats: 'إحصائيات التقارير',
      totalReports: 'إجمالي التقارير',
      weeklyReports: 'تقارير أسبوعية',
      monthlyReports: 'تقارير شهرية',
      sentReports: 'تقارير مُرسلة',
      scheduledReports: 'التقارير المجدولة',
      scheduledDesc: 'يتم إرسال التقارير تلقائياً حسب الجدول التالي',
      dailyAt: 'يومياً الساعة',
      weeklyOn: 'أسبوعياً يوم',
      monthlyOn: 'شهرياً يوم',
      sunday: 'الأحد',
      firstDay: 'الأول',
      view: 'معاينة'
    },
    en: {
      title: 'Report Management',
      subtitle: 'Generate, download, and send sales and coupon reports',
      generateReport: 'Generate Report',
      sendReport: 'Send Report',
      downloadReport: 'Download Report',
      reportHistory: 'Report History',
      reportType: 'Report Type',
      weekly: 'Weekly',
      monthly: 'Monthly',
      custom: 'Custom',
      startDate: 'Start Date',
      endDate: 'End Date',
      sendViaEmail: 'Send via Email',
      emailTo: 'Email To',
      generate: 'Generate',
      send: 'Send',
      cancel: 'Cancel',
      generating: 'Generating...',
      sending: 'Sending...',
      reportGenerated: 'Report generated successfully',
      reportSent: 'Report sent successfully',
      error: 'An error occurred',
      noReports: 'No reports found',
      date: 'Date',
      period: 'Period',
      status: 'Status',
      sentTo: 'Sent To',
      actions: 'Actions',
      generated: 'Generated',
      sent: 'Sent',
      quickActions: 'Quick Actions',
      downloadWeekly: 'Download Weekly Report',
      downloadMonthly: 'Download Monthly Report',
      sendWeeklyNow: 'Send Weekly Report Now',
      sendMonthlyNow: 'Send Monthly Report Now',
      stats: 'Report Statistics',
      totalReports: 'Total Reports',
      weeklyReports: 'Weekly Reports',
      monthlyReports: 'Monthly Reports',
      sentReports: 'Sent Reports',
      scheduledReports: 'Scheduled Reports',
      scheduledDesc: 'Reports are automatically sent according to the following schedule',
      dailyAt: 'Daily at',
      weeklyOn: 'Weekly on',
      monthlyOn: 'Monthly on',
      sunday: 'Sunday',
      firstDay: '1st',
      view: 'View'
    }
  };

  const text = t[language] || t.ar;

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(`${API}/history?limit=50`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const token = getToken();
      const response = await fetch(`${API}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(generateForm)
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(text.reportGenerated);
        setShowGenerateModal(false);
        fetchReports();
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(text.error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReport = async () => {
    setSending(true);
    try {
      const token = getToken();
      const url = sendForm.email_to 
        ? `${API}/send-now/${sendForm.report_type}?email_to=${encodeURIComponent(sendForm.email_to)}`
        : `${API}/send-now/${sendForm.report_type}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success(text.reportSent);
        setShowSendModal(false);
        fetchReports();
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error(text.error);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadReport = async (reportType) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/download/${reportType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(text.reportGenerated);
      } else {
        toast.error(text.error);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error(text.error);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'sent') {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <Mail className="w-3 h-3" />
          {text.sent}
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-800 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        {text.generated}
      </Badge>
    );
  };

  const stats = {
    total: reports.length,
    weekly: reports.filter(r => r.report_type === 'weekly').length,
    monthly: reports.filter(r => r.report_type === 'monthly').length,
    sent: reports.filter(r => r.status === 'sent').length
  };

  return (
    <div className="p-6 space-y-6" dir={isRTL ? 'rtl' : 'ltr'} data-testid="report-management-page">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#28376B]" />
            {text.title}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{text.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowSendModal(true)}
            data-testid="send-report-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            {text.sendReport}
          </Button>
          <Button 
            onClick={() => setShowGenerateModal(true)}
            className="bg-[#28376B] hover:bg-[#1e2a52]"
            data-testid="generate-report-btn"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {text.generateReport}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{text.totalReports}</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{text.weeklyReports}</p>
                <p className="text-2xl font-bold text-green-600">{stats.weekly}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{text.monthlyReports}</p>
                <p className="text-2xl font-bold text-purple-600">{stats.monthly}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{text.sentReports}</p>
                <p className="text-2xl font-bold text-orange-600">{stats.sent}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Scheduled Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-[#28376B]" />
              {text.quickActions}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => handleDownloadReport('weekly')}
                data-testid="download-weekly-btn"
              >
                <Download className="w-5 h-5 mb-2 text-green-600" />
                <span className="text-sm">{text.downloadWeekly}</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => handleDownloadReport('monthly')}
                data-testid="download-monthly-btn"
              >
                <Download className="w-5 h-5 mb-2 text-purple-600" />
                <span className="text-sm">{text.downloadMonthly}</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => { setSendForm({ report_type: 'weekly', email_to: '' }); setShowSendModal(true); }}
              >
                <Send className="w-5 h-5 mb-2 text-blue-600" />
                <span className="text-sm">{text.sendWeeklyNow}</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-auto py-4 flex-col"
                onClick={() => { setSendForm({ report_type: 'monthly', email_to: '' }); setShowSendModal(true); }}
              >
                <Send className="w-5 h-5 mb-2 text-orange-600" />
                <span className="text-sm">{text.sendMonthlyNow}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#28376B]" />
              {text.scheduledReports}
            </CardTitle>
            <CardDescription>{text.scheduledDesc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">{text.weekly}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">{text.weeklyOn} {text.sunday} - 08:00 AM</p>
                </div>
                <Badge className="ml-auto bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-purple-800 dark:text-purple-200">{text.monthly}</p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">{text.monthlyOn} {text.firstDay} - 09:00 AM</p>
                </div>
                <Badge className="ml-auto bg-purple-100 text-purple-800">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#28376B]" />
              {text.reportHistory}
            </span>
            <Button variant="ghost" size="sm" onClick={fetchReports}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-[#28376B]" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{text.noReports}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text.date}</TableHead>
                  <TableHead>{text.reportType}</TableHead>
                  <TableHead>{text.period}</TableHead>
                  <TableHead>{text.status}</TableHead>
                  <TableHead>{text.sentTo}</TableHead>
                  <TableHead>{text.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {report.generated_at ? new Date(report.generated_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {report.report_type === 'weekly' ? text.weekly : text.monthly}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {report.period ? `${report.period.start} → ${report.period.end}` : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {report.sent_to || '-'}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownloadReport(report.report_type)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#28376B]" />
              {text.generateReport}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{text.reportType}</label>
              <Select 
                value={generateForm.report_type} 
                onValueChange={(val) => setGenerateForm(prev => ({ ...prev, report_type: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{text.weekly}</SelectItem>
                  <SelectItem value="monthly">{text.monthly}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{text.startDate}</label>
                <Input 
                  type="date"
                  value={generateForm.start_date}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{text.endDate}</label>
                <Input 
                  type="date"
                  value={generateForm.end_date}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="send_email"
                checked={generateForm.send_email}
                onChange={(e) => setGenerateForm(prev => ({ ...prev, send_email: e.target.checked }))}
                className="w-4 h-4 accent-[#28376B]"
              />
              <label htmlFor="send_email" className="text-sm">{text.sendViaEmail}</label>
            </div>

            {generateForm.send_email && (
              <div>
                <label className="block text-sm font-medium mb-1">{text.emailTo}</label>
                <Input 
                  type="email"
                  value={generateForm.email_to}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, email_to: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
                {text.cancel}
              </Button>
              <Button 
                onClick={handleGenerateReport}
                disabled={generating}
                className="bg-[#28376B] hover:bg-[#1e2a52]"
              >
                {generating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4 mr-2" />
                )}
                {generating ? text.generating : text.generate}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Report Modal */}
      <Dialog open={showSendModal} onOpenChange={setShowSendModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-[#28376B]" />
              {text.sendReport}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{text.reportType}</label>
              <Select 
                value={sendForm.report_type} 
                onValueChange={(val) => setSendForm(prev => ({ ...prev, report_type: val }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">{text.weekly}</SelectItem>
                  <SelectItem value="monthly">{text.monthly}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">{text.emailTo}</label>
              <Input 
                type="email"
                value={sendForm.email_to}
                onChange={(e) => setSendForm(prev => ({ ...prev, email_to: e.target.value }))}
                placeholder="email@example.com (optional)"
              />
              <p className="text-xs text-gray-500 mt-1">
                {language === 'ar' ? 'اتركه فارغاً للإرسال للبريد الافتراضي' : 'Leave empty to send to default email'}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowSendModal(false)}>
                {text.cancel}
              </Button>
              <Button 
                onClick={handleSendReport}
                disabled={sending}
                className="bg-[#28376B] hover:bg-[#1e2a52]"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {sending ? text.sending : text.send}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
