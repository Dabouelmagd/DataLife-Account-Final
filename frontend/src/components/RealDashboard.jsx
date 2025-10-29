import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { 
  Users, DollarSign, FileText, Calendar, Settings, LogOut,
  Building2, TrendingUp, PieChart, BarChart
} from 'lucide-react';
import axios from 'axios';

// Import sub-modules from existing files
import {
  SalariesModule,
  AllowancesModule,
  DeductionsModule,
  CasualLeaveModule,
  AnnualLeaveModule,
  AttendanceModule
} from './HRSubModules';

import {
  JournalEntriesModule,
  TreasuryModule,
  BankModule,
  CustomersModule,
  SuppliersModule
} from './FinancialSubModules';

const RealDashboard = () => {
  const { user, logout } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('overview');
  const [activeSubModule, setActiveSubModule] = useState(null);
  const [company, setCompany] = useState(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalAllowances: 0,
    totalDeductions: 0,
    totalCustomers: 0,
    totalSuppliers: 0
  });
  const isRTL = language === 'ar';

  useEffect(() => {
    fetchCompanyData();
    fetchStats();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company_id}`,
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
      
      // Fetch data from various endpoints
      const [employees, allowances, deductions, customers, suppliers] = await Promise.all([
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/hr/employees`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/hr/allowances`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/hr/deductions`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/financial/customers`, config).catch(() => ({ data: [] })),
        axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/financial/suppliers`, config).catch(() => ({ data: [] }))
      ]);

      setStats({
        totalEmployees: employees.data.length,
        totalAllowances: allowances.data.reduce((sum, a) => sum + (a.amount || 0), 0),
        totalDeductions: deductions.data.reduce((sum, d) => sum + (d.amount || 0), 0),
        totalCustomers: customers.data.length,
        totalSuppliers: suppliers.data.length
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Define modules based on user role
  const getAvailableModules = () => {
    const role = user?.role;
    const modules = [];

    // Overview available to all
    modules.push({ id: 'overview', name: language === 'ar' ? 'نظرة عامة' : 'Overview', icon: <PieChart /> });

    // HR Module
    const hrRoles = ['General Manager', 'CEO', 'Board Chairman', 'HR Manager', 'Financial Manager', 'Chief Accountant',
                     'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'مدير الموارد البشرية', 'المدير المالي', 'رئيس الحسابات'];
    if (hrRoles.includes(role)) {
      modules.push({ 
        id: 'hr', 
        name: language === 'ar' ? 'الموارد البشرية' : 'Human Resources', 
        icon: <Users />,
        subModules: [
          { id: 'salaries', name: language === 'ar' ? 'المرتبات' : 'Salaries' },
          { id: 'allowances', name: language === 'ar' ? 'البدلات' : 'Allowances' },
          { id: 'deductions', name: language === 'ar' ? 'الخصومات' : 'Deductions' },
          { id: 'casual-leave', name: language === 'ar' ? 'الإجازات العارضة' : 'Casual Leave' },
          { id: 'annual-leave', name: language === 'ar' ? 'الإجازات السنوية' : 'Annual Leave' },
          { id: 'attendance', name: language === 'ar' ? 'الحضور' : 'Attendance' }
        ]
      });
    }

    // Financial Module
    const financialRoles = ['General Manager', 'CEO', 'Board Chairman', 'Financial Manager', 'Chief Accountant', 'Accountant',
                            'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة', 'المدير المالي', 'رئيس الحسابات', 'محاسب'];
    if (financialRoles.includes(role)) {
      modules.push({ 
        id: 'financial', 
        name: language === 'ar' ? 'المالية' : 'Financial', 
        icon: <DollarSign />,
        subModules: [
          { id: 'journal-entries', name: language === 'ar' ? 'القيود اليومية' : 'Journal Entries' },
          { id: 'treasury', name: language === 'ar' ? 'الخزنة' : 'Treasury' },
          { id: 'bank', name: language === 'ar' ? 'البنك' : 'Bank' },
          { id: 'customers', name: language === 'ar' ? 'العملاء' : 'Customers' },
          { id: 'suppliers', name: language === 'ar' ? 'الموردين' : 'Suppliers' }
        ]
      });
    }

    return modules;
  };

  const renderContent = () => {
    // Overview
    if (activeModule === 'overview') {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#28376B]">
                {language === 'ar' ? 'مرحباً' : 'Welcome'}, {user?.full_name}
              </h1>
              <p className="text-gray-600 mt-2">
                {company?.name} • {user?.role}
              </p>
            </div>
            {company?.logo_url && (
              <img src={company.logo_url} alt="Company Logo" className="h-16 object-contain" />
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{language === 'ar' ? 'الموظفين' : 'Employees'}</span>
                  <Users className="h-4 w-4 text-[#28376B]" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{language === 'ar' ? 'إجمالي البدلات' : 'Total Allowances'}</span>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.totalAllowances.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{language === 'ar' ? 'إجمالي الخصومات' : 'Total Deductions'}</span>
                  <TrendingUp className="h-4 w-4 text-red-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {stats.totalDeductions.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{language === 'ar' ? 'العملاء' : 'Customers'}</span>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.totalCustomers}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button 
                  onClick={() => navigate('/settings')}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-24 space-y-2"
                >
                  <Settings className="h-6 w-6" />
                  <span className="text-sm">{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
                </Button>
                <Button 
                  onClick={() => { setActiveModule('hr'); setActiveSubModule('salaries'); }}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-24 space-y-2"
                >
                  <DollarSign className="h-6 w-6" />
                  <span className="text-sm">{language === 'ar' ? 'المرتبات' : 'Salaries'}</span>
                </Button>
                <Button 
                  onClick={() => { setActiveModule('financial'); setActiveSubModule('bank'); }}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-24 space-y-2"
                >
                  <Building2 className="h-6 w-6" />
                  <span className="text-sm">{language === 'ar' ? 'البنك' : 'Bank'}</span>
                </Button>
                <Button 
                  onClick={() => navigate('/demo')}
                  variant="outline"
                  className="flex flex-col items-center justify-center h-24 space-y-2"
                >
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">{language === 'ar' ? 'التجربة' : 'Demo'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // HR Sub-modules
    if (activeModule === 'hr') {
      switch (activeSubModule) {
        case 'salaries':
          return <SalariesModule language={language} userRole={user?.role} />;
        case 'allowances':
          return <AllowancesModule language={language} userRole={user?.role} />;
        case 'deductions':
          return <DeductionsModule language={language} userRole={user?.role} />;
        case 'casual-leave':
          return <CasualLeaveModule language={language} userRole={user?.role} />;
        case 'annual-leave':
          return <AnnualLeaveModule language={language} userRole={user?.role} />;
        case 'attendance':
          return <AttendanceModule language={language} userRole={user?.role} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
    }

    // Financial Sub-modules
    if (activeModule === 'financial') {
      switch (activeSubModule) {
        case 'journal-entries':
          return <JournalEntriesModule language={language} userRole={user?.role} />;
        case 'treasury':
          return <TreasuryModule language={language} userRole={user?.role} />;
        case 'bank':
          return <BankModule language={language} userRole={user?.role} />;
        case 'customers':
          return <CustomersModule language={language} userRole={user?.role} />;
        case 'suppliers':
          return <SuppliersModule language={language} userRole={user?.role} />;
        default:
          return <div>{language === 'ar' ? 'اختر وحدة فرعية' : 'Select a sub-module'}</div>;
      }
    }

    return null;
  };

  const modules = getAvailableModules();
  const currentModule = modules.find(m => m.id === activeModule);

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Modern Sidebar */}
      <div className="w-72 bg-gradient-to-b from-[#1e293b] to-[#0f172a] shadow-2xl flex flex-col relative overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl translate-y-32 -translate-x-32"></div>
        
        {/* Company Logo/Name - Modern Header */}
        <div className="p-6 relative z-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20 shadow-xl">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-14 object-contain mx-auto filter drop-shadow-lg" />
            ) : (
              <h2 className="text-xl font-bold text-white text-center tracking-tight">{company?.name}</h2>
            )}
          </div>
        </div>

        {/* Main Modules - Modern Design */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 relative z-10 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {modules.map(module => (
            <div key={module.id} className="space-y-1">
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-300 group ${
                  activeModule === module.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105'
                }`}
                onClick={() => {
                  setActiveModule(module.id);
                  setActiveSubModule(null);
                }}
              >
                <div className={`p-2 rounded-lg transition-all duration-300 ${
                  activeModule === module.id 
                    ? 'bg-white/20' 
                    : 'bg-white/5 group-hover:bg-white/10'
                }`}>
                  {React.cloneElement(module.icon, { className: 'h-5 w-5' })}
                </div>
                <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-semibold`}>{module.name}</span>
                {module.subModules && (
                  <div className={`transition-transform duration-300 ${activeModule === module.id ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
              </button>

              {/* Sub-modules - Modern Collapse Animation */}
              {module.subModules && activeModule === module.id && (
                <div className={`space-y-1 ${isRTL ? 'mr-4 pr-4 border-r-2' : 'ml-4 pl-4 border-l-2'} border-blue-500/30 animate-in slide-in-from-top-2 duration-300`}>
                  {module.subModules.map(sub => (
                    <button
                      key={sub.id}
                      className={`w-full text-sm px-4 py-2.5 rounded-lg transition-all duration-200 ${
                        activeSubModule === sub.id
                          ? 'bg-white/20 text-white font-semibold shadow-lg'
                          : 'text-gray-400 hover:text-white hover:bg-white/10'
                      } ${isRTL ? 'text-right' : 'text-left'}`}
                      onClick={() => setActiveSubModule(sub.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                          activeSubModule === sub.id ? 'bg-white w-2 h-2' : 'bg-gray-500'
                        }`}></div>
                        {sub.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Actions - Modern Glass Effect */}
        <div className="p-4 space-y-2 relative z-10 border-t border-white/10">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-300 group"
            onClick={() => navigate('/settings')}
          >
            <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 transition-all duration-300">
              <Settings className="h-5 w-5" />
            </div>
            <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
              {language === 'ar' ? 'الإعدادات' : 'Settings'}
            </span>
          </button>
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all duration-300 group"
            onClick={handleLogout}
          >
            <div className="p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-all duration-300">
              <LogOut className="h-5 w-5" />
            </div>
            <span className={`flex-1 text-${isRTL ? 'right' : 'left'} font-medium`}>
              {language === 'ar' ? 'تسجيل الخروج' : 'Logout'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {renderContent()}
      </div>
    </div>
  );
};

export default RealDashboard;
