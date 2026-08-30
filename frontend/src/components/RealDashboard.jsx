/**
 * Real Dashboard - Main Application Container
 * لوحة التحكم الرئيسية - الحاوية الرئيسية للتطبيق
 * 
 * Refactored: Module logic moved to moduleConfig.js and ModuleRenderer.jsx
 */

import AssetsModule from './AssetsModule';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Components
import ModernSidebar from './ModernSidebar';
import AppFooter from './AppFooter';
import ModuleRenderer from './ModuleRenderer';
import AppUpdateNotification from './AppUpdateNotification';
import { useIdleTimeout } from '../hooks/useIdleTimeout';

// Config
import { getAvailableModules } from '../config/moduleConfig';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RealDashboard = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  // Module states
  const [activeModule, setActiveModule] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle
  const [idleWarning, setIdleWarning] = useState(false);

  // Auto logout after 30 min idle — financial data protection
  useIdleTimeout({
    onLogout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?reason=idle';
    },
    onWarning: (secsLeft) => setIdleWarning(secsLeft),
  });
  const [activeHRSubModule, setActiveHRSubModule] = useState(null);
  const [activeFinancialSubModule, setActiveFinancialSubModule] = useState(null);
  const [activeInvoiceSubModule, setActiveInvoiceSubModule] = useState(null);
  
  // Data states
  const [company, setCompany] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalAllowances: 0,
    totalDeductions: 0,
    totalCustomers: 0,
    totalSuppliers: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    activeProjects: 0,
    invoiceCount: 0,
    inventoryCount: 0,
    totalPayroll: 0,
    pendingApprovals: 0,
    lowStockCount: 0,
  });
  
  const isRTL = language === 'ar';

  // Fetch initial data
  useEffect(() => {
    fetchCompanyData();
    fetchStats();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/companies/${user.company_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompany(response.data);
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      const [employeesRes, allowances, deductions, customers, suppliers, journalEntries, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/api/hr/employees`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/hr/allowances`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/hr/deductions`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/financial/customers`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/financial/suppliers`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/financial/journal-entries`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/projects`, config).catch(() => ({ data: [] }))
      ]);
      
      // Helper to safely extract array data from API responses
      const safeArray = (res) => {
        if (Array.isArray(res?.data)) return res.data;
        if (Array.isArray(res)) return res;
        if (res?.data?.data && Array.isArray(res.data.data)) return res.data.data;
        return [];
      };

      const employeesData = safeArray(employeesRes);
      const allowancesData = safeArray(allowances);
      const deductionsData = safeArray(deductions);
      const customersData = safeArray(customers);
      const suppliersData = safeArray(suppliers);
      const entriesData = safeArray(journalEntries);
      const projectsData   = safeArray(projectsRes);
      const invoicesData   = safeArray(invoicesRes);
      const inventoryData  = safeArray(inventoryRes);
      const approvalsData  = safeArray(approvalsRes);

      setEmployees(employeesData);
      
      // Calculate revenue and expenses from journal entries
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      let revenue = 0;
      let expenses = 0;
      entriesData.forEach(entry => {
        const entryMonth = (entry.date || entry.created_at || '').slice(0, 7);
        const isCurrentMonth = entryMonth === currentMonth;
        if (entry.lines && Array.isArray(entry.lines)) {
          entry.lines.forEach(line => {
            if (isCurrentMonth) {
              revenue += line.credit || 0;
              expenses += line.debit || 0;
            }
          });
        } else {
          // Simple entry format: credit_account = revenue, debit_account = expense
          const creditAcc = (entry.credit_account || '').toLowerCase();
          const debitAcc = (entry.debit_account || '').toLowerCase();
          const amt = entry.amount || 0;
          const revenueKeywords = ['إيراد', 'revenue', 'مبيعات', 'sales', 'دخل', 'income'];
          const expenseKeywords = ['مصروف', 'expense', 'تكلفة', 'cost', 'إهلاك', 'depreciation'];
          if (revenueKeywords.some(k => creditAcc.includes(k))) revenue += amt;
          if (expenseKeywords.some(k => debitAcc.includes(k))) expenses += amt;
        }
      });

      setStats({
        totalEmployees: employeesData.length,
        totalAllowances: allowancesData.reduce((sum, a) => sum + (a.amount || 0), 0),
        totalDeductions: deductionsData.reduce((sum, d) => sum + (d.amount || 0), 0),
        totalCustomers: customersData.length,
        totalSuppliers: suppliersData.length,
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        invoiceCount:   invoicesData.length,
        inventoryCount: inventoryData.length,
        totalPayroll:   employeesData.reduce((s, e) => s + (e.basic_salary || 0), 0),
        pendingApprovals: approvalsData.length,
        lowStockCount:  inventoryData.filter(i => (i.quantity || 0) <= (i.min_quantity || 0)).length,_progress').length || projectsData.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get available modules based on user role
  const modules = getAvailableModules(user, language);

  return (
    <>
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <ModernSidebar
        user={user}
        language={language}
        modules={modules}
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        activeHRSubModule={activeHRSubModule}
        setActiveHRSubModule={setActiveHRSubModule}
        activeFinancialSubModule={activeFinancialSubModule}
        setActiveFinancialSubModule={setActiveFinancialSubModule}
        activeInvoiceSubModule={activeInvoiceSubModule}
        setActiveInvoiceSubModule={setActiveInvoiceSubModule}
        onLogout={handleLogout}
        navigate={navigate}
        company={company}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-y-auto transition-all duration-300
        ${isRTL ? 'lg:mr-[260px]' : 'lg:ml-[260px]'}`}>
        {/* Mobile header with hamburger */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/datalife-logo-arabic.svg" alt="DataLife" className="h-7 object-contain" />
        </div>
        <div className="flex-1 p-4 md:p-6">
          {/* Back Button */}
          {activeModule !== 'dashboard' && (
            <button
              onClick={() => setActiveModule('dashboard')}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 hover:text-[#28376B] hover:bg-gray-100 rounded-lg transition-colors mb-4"
            >
              {isRTL
                ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              }
              <span>{language === 'ar' ? 'رجوع للرئيسية' : 'Back to Dashboard'}</span>
            </button>
          )}
          <ModuleRenderer
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            activeHRSubModule={activeHRSubModule}
            activeFinancialSubModule={activeFinancialSubModule}
            activeInvoiceSubModule={activeInvoiceSubModule}
            language={language}
            employees={employees}
            stats={stats}
            selectedEmployeeId={selectedEmployeeId}
            setSelectedEmployeeId={setSelectedEmployeeId}
            setActiveHRSubModule={setActiveHRSubModule}
            setActiveFinancialSubModule={setActiveFinancialSubModule}
            setActiveInvoiceSubModule={setActiveInvoiceSubModule}
            navigate={navigate}
          />
        </div>
        
        {/* Footer */}
        <AppFooter />
      </div>
    </div>
    <AppUpdateNotification />

    {/* Idle Warning Banner */}
    {idleWarning && (
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center py-2 text-sm font-medium">
        ⚠️ {language === 'ar'
          ? `سيتم تسجيل خروجك تلقائياً خلال ${Math.floor(idleWarning)} ثانية بسبب عدم النشاط`
          : `You will be logged out in ${Math.floor(idleWarning)} seconds due to inactivity`}
        <button
          onClick={() => setIdleWarning(false)}
          className="mr-4 underline font-bold"
        >
          {language === 'ar' ? 'استمرار' : 'Stay logged in'}
        </button>
      </div>
    )}
    </>
  );
};

export default RealDashboard;
