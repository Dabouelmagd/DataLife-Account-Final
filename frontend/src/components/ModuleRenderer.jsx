/**
 * Module Renderer Component
 * مكون عرض الوحدات
 * Handles rendering the appropriate component based on active module
 */

import React from 'react';
import IndustryPackScreen from './IndustryPackScreen';
import RecruitmentPage from '../pages/RecruitmentPage';
import UnauthorizedPage from './UnauthorizedPage';

// Page imports
import InvoicesModule from '../components/InvoicesModule';
import CustomerPortalManagement from '../components/CustomerPortalManagement';
import PurchasesModule from '../components/PurchasesModule';
import ApprovalsModule from '../components/ApprovalsModule';
import AttendanceManagement from '../components/AttendanceManagement';
import ProjectsModule from '../components/ProjectsModule';
import DocumentsModule from '../components/DocumentsModule';
import JournalEntriesPage from '../pages/JournalEntriesPage';
import GeneralLedgerPage from '../pages/GeneralLedgerPage';
import FinancialReportsPage from '../pages/FinancialReportsPage';
import InvoicesPage from '../pages/InvoicesPage';
import PartiesPage from '../pages/PartiesPage';
import ProductsPage from '../pages/ProductsPage';
import InvoiceReportsPage from '../pages/InvoiceReportsPage';
import CurrenciesPage from '../pages/CurrenciesPage';
import InventoryPage from '../pages/InventoryPage';
import PayrollPage from '../pages/PayrollPage';
import EmployeeProfilePage from '../pages/EmployeeProfilePage';
import EmployeesPage from '../pages/EmployeesPage';
import ShiftsPage from '../pages/ShiftsPage';
import AttendancePage from '../pages/AttendancePage';
import HRSettingsPage from '../pages/HRSettingsPage';
import ETASettingsPage from '../pages/ETASettingsPage';
import ProjectsPage from '../pages/ProjectsPage';
import CasualLeavePage from '../pages/CasualLeavePage';
import AnnualLeavePage from '../pages/AnnualLeavePage';
import HRReportsPage from '../pages/HRReportsPage';
import TerminationPage from '../pages/TerminationPage';
import DeductionsPage from '../pages/DeductionsPage';
import AllowancesPage from '../pages/AllowancesPage';
import ShiftsManagementPage from '../pages/ShiftsManagementPage';
import SalesModule from '../pages/SalesModule';
import HRComprehensiveReportsPage from '../pages/HRComprehensiveReportsPage';
import SystemReportsPage from '../pages/SystemReportsPage';
import TrialBalancePage from '../pages/TrialBalancePage';
import IncomeStatementPage from '../pages/IncomeStatementPage';
import BalanceSheetPage from '../pages/BalanceSheetPage';
import BankManagementPage from '../pages/BankManagementPage';
import BankSettingsPage from '../pages/BankSettingsPage';
import AdminDashboardPage from '../pages/AdminDashboardPage';
import SuperAdminDashboard from '../pages/SuperAdminDashboard';
import SystemMonitorPage from '../pages/SystemMonitorPage';
import NotificationSettingsPage from '../pages/NotificationSettingsPage';
import UserGuidePage from '../pages/UserGuidePage';
import ReferralPanel from './ReferralPanel';
import TaxesModule from './TaxesModule';
import SubscriptionPage from './SubscriptionPage';
import AppUpdatesPage from '../pages/AppUpdatesPage';
import ReportManagementPage from '../pages/ReportManagementPage';
import AssetsModule from '../components/AssetsModule';

// Overview components
import HROverviewContent from '../components/HROverviewContent';
import FinancialOverviewContent from '../components/FinancialOverviewContent';
import InvoicesOverviewContent from '../components/InvoicesOverviewContent';

// Sub-modules
import {
  SalariesModule,
  AllowancesModule,
  DeductionsModule,
  CasualLeaveModule,
  AnnualLeaveModule,
  AttendanceModule,
  HRReportsModule
} from '../components/HRSubModules';

import {
  JournalEntriesModule,
  TreasuryModule,
  BankModule,
  CustomersModule,
  SuppliersModule,
  CustodyModule,
  AccountsModule,
  InventoryModule,
  FinancialReportsModule
} from '../components/FinancialSubModules';

import { AnalyticsModule } from '../components/AnalyticsModule';
import CompanySettings from '../components/CompanySettings';
import ImportDataPage from '../components/ImportDataPage';
import DashboardContent from '../components/DashboardContent';

/**
 * Render HR Module Content
 */
export const renderHRContent = ({
  activeHRSubModule,
  language,
  employees,
  stats,
  selectedEmployeeId,
  setSelectedEmployeeId,
  setActiveHRSubModule
}) => {
  // Employee Profile View
  if (selectedEmployeeId) {
    return (
      <EmployeeProfilePage 
        employeeId={selectedEmployeeId} 
        onBack={() => setSelectedEmployeeId(null)}
      />
    );
  }

  // HR Overview
  if (['overview', 'hr-overview'].includes(activeHRSubModule) || !activeHRSubModule) {
    return (
      <HROverviewContent
        language={language}
        stats={stats}
        employees={employees}
        onAddEmployee={() => setActiveHRSubModule('employees')}
        onNavigate={(subModule) => setActiveHRSubModule(subModule)}
        onViewEmployee={(id) => setSelectedEmployeeId(id)}
      />
    );
  }

  // HR Sub-modules
  const hrSubModuleMap = {
    'employees': <EmployeesPage language={language} />,
    'recruitment': <RecruitmentPage />,      // jobs, candidates, scorecards, hiring
    'payroll': <PayrollPage language={language} />,
    'salaries': <PayrollPage language={language} />,  // legacy alias -> real payroll
    'allowances': <AllowancesPage language={language} />,
    'deductions': <DeductionsPage language={language} />,
    'attendance': <AttendancePage language={language} />,
    'shifts': <ShiftsManagementPage language={language} />,
    'casual-leave': <CasualLeavePage language={language} />,
    'annual-leave': <AnnualLeavePage language={language} />,
    'termination': <TerminationPage language={language} />,
    'reports': <HRComprehensiveReportsPage language={language} />,
    'hr-settings': <HRSettingsPage language={language} />
  };

  return hrSubModuleMap[activeHRSubModule] || null;
};

/**
 * Render Financial Module Content
 */
export const renderFinancialContent = ({
  activeFinancialSubModule,
  language,
  stats,
  setActiveFinancialSubModule
}) => {
  // Financial Overview
  if (activeFinancialSubModule === 'overview' || !activeFinancialSubModule) {
    return (
      <FinancialOverviewContent
        language={language}
        stats={stats}
        onNavigate={(subModule) => setActiveFinancialSubModule(subModule)}
      />
    );
  }

  // Financial Sub-modules
  const financialSubModuleMap = {
    'journal-entries': <JournalEntriesPage language={language} />,
    'general-ledger': <GeneralLedgerPage language={language} />,
    'parties': <PartiesPage language={language} />,
    'products': <ProductsPage language={language} />,
    'currencies': <CurrenciesPage language={language} />,
    'inventory': <InventoryPage language={language} />,
    'bank': <BankManagementPage language={language} />,
    'bank-settings': <BankSettingsPage language={language} />,
    'trial-balance': <TrialBalancePage language={language} />,
    'income-statement': <IncomeStatementPage language={language} />,
    'balance-sheet': <BalanceSheetPage language={language} />,
    'reports': <FinancialReportsPage language={language} />
  };

  return financialSubModuleMap[activeFinancialSubModule] || <JournalEntriesPage language={language} />;
};

/**
 * Render Invoice Module Content
 */
export const renderInvoiceContent = ({
  activeInvoiceSubModule,
  language,
  stats,
  setActiveInvoiceSubModule
}) => {
  // Invoice Overview
  if (activeInvoiceSubModule === 'overview' || !activeInvoiceSubModule) {
    return (
      <InvoicesOverviewContent
        language={language}
        stats={stats}
        onNavigate={(subModule) => setActiveInvoiceSubModule(subModule)}
        onCreateInvoice={() => setActiveInvoiceSubModule('invoices')}
        onGoToETASettings={() => setActiveInvoiceSubModule('eta-settings')}
      />
    );
  }

  // Invoice Sub-modules
  const invoiceSubModuleMap = {
    'invoices': <InvoicesPage language={language} />,
    'reports': <InvoiceReportsPage language={language} />,
    'eta-settings': <ETASettingsPage language={language} />
  };

  return invoiceSubModuleMap[activeInvoiceSubModule] || <InvoicesPage language={language} />;
};

/**
 * Main Module Renderer
 */
const ModuleRenderer = ({
  activeModule,
  setActiveModule,
  activeHRSubModule,
  activeFinancialSubModule,
  activeInvoiceSubModule,
  language,
  employees,
  stats,
  selectedEmployeeId,
  setSelectedEmployeeId,
  setActiveHRSubModule,
  setActiveFinancialSubModule,
  setActiveInvoiceSubModule,
  navigate,
  userRole,
  user
}) => {
  // Permission check helper
  // Get user permissions from prop OR from localStorage (in case prop is stale)
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const userPermissions = user?.permissions || storedUser?.permissions || [];
  // On a refresh the user arrives a moment after the first render. Until then
  // this list is empty, every screen looked forbidden, and the app bounced
  // back to the dashboard — which is why a refresh never stayed where it was.
  // `Boolean(storedUser)` was true for an empty {} — JavaScript objects always
  // are — so a refresh read "permissions loaded, and they are none", and every
  // screen was refused. Readiness means the user actually carries a role or a
  // permission list, not merely that an object exists.
  const permissionsReady = Boolean(
    (user && (user.role || user.id || user.permissions)) ||
    (storedUser && (storedUser.role || storedUser.id || storedUser.permissions))
  );
  const effectiveRole = String(user?.role || storedUser?.role || userRole || '').trim();
  const FULL_ACCESS_ROLES = ['Super Admin', 'مدير النظام', 'رئيس مجلس الإدارة',
                             'Board Chairman', 'مدير عام', 'General Manager'];
  const isSuperAdmin = FULL_ACCESS_ROLES.includes(effectiveRole);

  const hasPermission = (requiredPermission) => {
    if (isSuperAdmin) return true;
    if (!requiredPermission) return true;
    if (!permissionsReady) return true;   // not yet known ≠ not allowed
    return userPermissions.includes(requiredPermission);
  };

  // Module → required permission map
  const modulePermissions = {
    'financial': 'financial',
    'journal-entries': 'financial',
    'general-ledger': 'financial',
    'financial-reports': 'financial',
    'currencies': 'financial',
    'invoices': 'invoices',
    'invoice-reports': 'invoices',
    'purchases': 'purchases',
    'parties': 'financial',
    'products': 'inventory',
    'inventory': 'inventory',
    'hr': 'hr',
    'payroll': 'hr',
    'employees': 'hr',
    'recruitment': 'hr',
    'attendance': 'hr',
    'shifts': 'hr',
    'hr-settings': 'hr_admin',
    'projects': 'projects',
    'analytics': 'analytics',
    'approvals': 'approvals',
    'users': 'users',
    'settings': 'settings',
    'reports': 'reports',
  };

  // Check permission for current module
  // an activated pack opens its own screen: pack_<key>
  if (typeof activeModule === 'string' && activeModule.startsWith('pack_')) {
    return (
      <IndustryPackScreen packKey={activeModule.slice(5)} language={language}
        onNavigate={setActiveModule} />
    );
  }

  const requiredPerm = modulePermissions[activeModule];
  if (!permissionsReady) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-[#1e3a8a] rounded-full animate-spin" />
      </div>
    );
  }
  if (requiredPerm && !hasPermission(requiredPerm)) {
    return <UnauthorizedPage moduleName={activeModule} />;
  }
  // Dashboard Module
  if (activeModule === 'dashboard') {
    // Create onNavigate handler for dashboard quick actions
    const handleDashboardNavigate = (module, subModule) => {
      if (module === 'hr') {
        setActiveHRSubModule(subModule || 'overview');
        if (setActiveModule) setActiveModule('hr');
      } else if (module === 'financial') {
        setActiveFinancialSubModule(subModule || 'overview');
        if (setActiveModule) setActiveModule('financial');
      } else if (module === 'invoices') {
        setActiveInvoiceSubModule(subModule || 'overview');
        if (setActiveModule) setActiveModule('invoices');
      } else if (module === 'reports') {
        if (setActiveModule) setActiveModule('reports');
      } else {
        if (setActiveModule) setActiveModule(module);
      }
    };
    return <DashboardContent language={language} stats={stats} onNavigate={handleDashboardNavigate} />;
  }

  // HR Module
  if (activeModule === 'hr') {
    return renderHRContent({
      activeHRSubModule,
      language,
      employees,
      stats,
      selectedEmployeeId,
      setSelectedEmployeeId,
      setActiveHRSubModule,
      setActiveModule,
      userRole
    });
  }

  // Financial Module
  if (activeModule === 'financial') {
    return renderFinancialContent({
      activeFinancialSubModule,
      language,
      stats,
      setActiveFinancialSubModule
    });
  }

  // Invoices Module
  if (activeModule === 'invoices') {
    return renderInvoiceContent({
      activeInvoiceSubModule,
      language,
      stats,
      setActiveInvoiceSubModule
    });
  }

  // Simple modules (no sub-modules)
  const simpleModuleMap = {
    'sales': <SalesModule language={language} />,
    'assets': <AssetsModule />,
    'taxes': <TaxesModule />,
    'analytics': <AnalyticsModule language={language} />,
    'system-reports': <SystemReportsPage language={language} />,
    'report-management': <ReportManagementPage language={language} />,
    'customer-portal-mgmt': <CustomerPortalManagement language={language} />,
    'purchases': <PurchasesModule language={language} />,
    'approvals': <ApprovalsModule language={language} />,
    'attendance-mgmt': <AttendanceManagement language={language} />,
    'projects': <ProjectsModule language={language} />,
    'documents': <DocumentsModule language={language} />,
    'settings': <CompanySettings language={language} />,
    'import': <ImportDataPage language={language} />,
    'subscription': <SubscriptionPage />,
    'app-updates': <AppUpdatesPage />,
    'admin-dashboard': <AdminDashboardPage language={language} />,
    'super-admin': <SuperAdminDashboard language={language} />,
    'system-monitor': <SystemMonitorPage />,
    'notification-settings': <NotificationSettingsPage language={language} />,
    'user-guide': <UserGuidePage language={language} />,
    'referral': (
      <div className="p-6">
        <ReferralPanel />
      </div>
    )
  };

  // A sub-module was only reachable through its parent section: the maps for
  // HR and Finance were consulted inside those branches, so arriving at
  // ?tab=inventory directly — from a link, a bookmark, a pack screen, or a
  // refresh — found nothing and showed "this page is unavailable". They are
  // looked up by name too now, which is what makes the URL shareable.
  if (simpleModuleMap[activeModule]) {
    return simpleModuleMap[activeModule];
  }

  if (financialSubModuleMap[activeModule]) {
    return financialSubModuleMap[activeModule];
  }

  if (hrSubModuleMap[activeModule]) {
    return hrSubModuleMap[activeModule];
  }

  // Coupon Management - redirect
  if (activeModule === 'coupons') {
    navigate('/admin/coupons');
    return null;
  }

  // Unknown module — never render a blank page
  return <UnauthorizedPage moduleName={activeModule} notFound />;
};

export default ModuleRenderer;
