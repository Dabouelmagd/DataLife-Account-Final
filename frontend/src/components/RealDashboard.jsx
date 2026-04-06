/**
 * Real Dashboard - Main Application Container
 * لوحة التحكم الرئيسية - الحاوية الرئيسية للتطبيق
 * 
 * Refactored: Module logic moved to moduleConfig.js and ModuleRenderer.jsx
 */

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
      
      setEmployees(employeesRes.data);
      
      const revenue = journalEntries.data
        .filter(entry => entry.type === 'credit')
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);
      const expenses = journalEntries.data
        .filter(entry => entry.type === 'debit')
        .reduce((sum, entry) => sum + (entry.amount || 0), 0);

      setStats({
        totalEmployees: employeesRes.data.length,
        totalAllowances: allowances.data.reduce((sum, a) => sum + (a.amount || 0), 0),
        totalDeductions: deductions.data.reduce((sum, d) => sum + (d.amount || 0), 0),
        totalCustomers: customers.data.length,
        totalSuppliers: suppliers.data.length,
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        activeProjects: customers.data.length + suppliers.data.length
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
