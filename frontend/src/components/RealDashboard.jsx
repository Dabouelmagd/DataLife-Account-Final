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

// Config
import { getAvailableModules } from '../config/moduleConfig';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RealDashboard = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  // Module states
  const [activeModule, setActiveModule] = useState('dashboard');
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
    activeProjects: 0
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
      
      const [employeesRes, allowances, deductions, customers, suppliers, journalEntries] = await Promise.all([
        axios.get(`${API_URL}/api/hr/employees`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/hr/allowances`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/hr/deductions`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/financial/customers`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/financial/suppliers`, config).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/financial/journal-entries`, config).catch(() => ({ data: [] }))
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

      setEmployees(employeesData);
      
      // Calculate revenue and expenses from journal entry lines
      let revenue = 0;
      let expenses = 0;
      entriesData.forEach(entry => {
        if (entry.lines && Array.isArray(entry.lines)) {
          entry.lines.forEach(line => {
            revenue += line.credit || 0;
            expenses += line.debit || 0;
          });
        } else {
          // Fallback for simple entries
          if (entry.type === 'credit') revenue += entry.amount || 0;
          if (entry.type === 'debit') expenses += entry.amount || 0;
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
        activeProjects: customersData.length + suppliersData.length
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
      />

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-y-auto ${isRTL ? 'mr-72' : 'ml-72'}`}>
        <div className="flex-1 p-6">
          <ModuleRenderer
            activeModule={activeModule}
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
  );
};

export default RealDashboard;
