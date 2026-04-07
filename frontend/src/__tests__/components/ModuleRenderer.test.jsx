/**
 * ModuleRenderer Component Tests
 * اختبارات مكون عرض الوحدات
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModuleRenderer, { 
  renderHRContent, 
  renderFinancialContent, 
  renderInvoiceContent 
} from '../../components/ModuleRenderer';

// Mock all the imported modules
jest.mock('../../components/InvoicesModule', () => () => <div data-testid="invoices-module">Invoices Module</div>);
jest.mock('../../components/CustomerPortalManagement', () => () => <div data-testid="customer-portal">Customer Portal</div>);
jest.mock('../../components/PurchasesModule', () => () => <div data-testid="purchases-module">Purchases Module</div>);
jest.mock('../../components/ApprovalsModule', () => () => <div data-testid="approvals-module">Approvals Module</div>);
jest.mock('../../components/AttendanceManagement', () => () => <div data-testid="attendance-mgmt">Attendance Management</div>);
jest.mock('../../components/ProjectsModule', () => () => <div data-testid="projects-module">Projects Module</div>);
jest.mock('../../components/DocumentsModule', () => () => <div data-testid="documents-module">Documents Module</div>);

// Mock pages
jest.mock('../../pages/JournalEntriesPage', () => () => <div data-testid="journal-entries">Journal Entries</div>);
jest.mock('../../pages/GeneralLedgerPage', () => () => <div data-testid="general-ledger">General Ledger</div>);
jest.mock('../../pages/FinancialReportsPage', () => () => <div data-testid="financial-reports">Financial Reports</div>);
jest.mock('../../pages/InvoicesPage', () => () => <div data-testid="invoices-page">Invoices Page</div>);
jest.mock('../../pages/PartiesPage', () => () => <div data-testid="parties-page">Parties Page</div>);
jest.mock('../../pages/ProductsPage', () => () => <div data-testid="products-page">Products Page</div>);
jest.mock('../../pages/InvoiceReportsPage', () => () => <div data-testid="invoice-reports">Invoice Reports</div>);
jest.mock('../../pages/CurrenciesPage', () => () => <div data-testid="currencies-page">Currencies Page</div>);
jest.mock('../../pages/InventoryPage', () => () => <div data-testid="inventory-page">Inventory Page</div>);
jest.mock('../../pages/PayrollPage', () => () => <div data-testid="payroll-page">Payroll Page</div>);
jest.mock('../../pages/EmployeeProfilePage', () => ({ employeeId, onBack }) => (
  <div data-testid="employee-profile">Employee Profile {employeeId}</div>
));
jest.mock('../../pages/ShiftsPage', () => () => <div data-testid="shifts-page">Shifts Page</div>);
jest.mock('../../pages/AttendancePage', () => () => <div data-testid="attendance-page">Attendance Page</div>);
jest.mock('../../pages/HRSettingsPage', () => () => <div data-testid="hr-settings">HR Settings</div>);
jest.mock('../../pages/ETASettingsPage', () => () => <div data-testid="eta-settings">ETA Settings</div>);
jest.mock('../../pages/ProjectsPage', () => () => <div data-testid="projects-page">Projects Page</div>);
jest.mock('../../pages/CasualLeavePage', () => () => <div data-testid="casual-leave">Casual Leave</div>);
jest.mock('../../pages/AnnualLeavePage', () => () => <div data-testid="annual-leave">Annual Leave</div>);
jest.mock('../../pages/HRReportsPage', () => () => <div data-testid="hr-reports">HR Reports</div>);
jest.mock('../../pages/TerminationPage', () => () => <div data-testid="termination">Termination</div>);
jest.mock('../../pages/DeductionsPage', () => () => <div data-testid="deductions">Deductions</div>);
jest.mock('../../pages/AllowancesPage', () => () => <div data-testid="allowances">Allowances</div>);
jest.mock('../../pages/ShiftsManagementPage', () => () => <div data-testid="shifts-management">Shifts Management</div>);
jest.mock('../../pages/SalariesPage', () => () => <div data-testid="salaries">Salaries</div>);
jest.mock('../../pages/HRComprehensiveReportsPage', () => () => <div data-testid="hr-comprehensive-reports">HR Comprehensive Reports</div>);
jest.mock('../../pages/SystemReportsPage', () => () => <div data-testid="system-reports">System Reports</div>);
jest.mock('../../pages/TrialBalancePage', () => () => <div data-testid="trial-balance">Trial Balance</div>);
jest.mock('../../pages/IncomeStatementPage', () => () => <div data-testid="income-statement">Income Statement</div>);
jest.mock('../../pages/BalanceSheetPage', () => () => <div data-testid="balance-sheet">Balance Sheet</div>);
jest.mock('../../pages/BankManagementPage', () => () => <div data-testid="bank-management">Bank Management</div>);
jest.mock('../../pages/BankSettingsPage', () => () => <div data-testid="bank-settings">Bank Settings</div>);
jest.mock('../../pages/AdminDashboardPage', () => () => <div data-testid="admin-dashboard">Admin Dashboard</div>);
jest.mock('../../pages/SuperAdminDashboard', () => () => <div data-testid="super-admin-dashboard">Super Admin Dashboard</div>);
jest.mock('../../pages/NotificationSettingsPage', () => () => <div data-testid="notification-settings">Notification Settings</div>);
jest.mock('../../pages/UserGuidePage', () => () => <div data-testid="user-guide">User Guide</div>);
jest.mock('../../pages/ReportManagementPage', () => () => <div data-testid="report-management">Report Management</div>);

// Mock overview components
jest.mock('../../components/HROverviewContent', () => ({ onNavigate, onViewEmployee }) => (
  <div data-testid="hr-overview">HR Overview</div>
));
jest.mock('../../components/FinancialOverviewContent', () => ({ onNavigate }) => (
  <div data-testid="financial-overview">Financial Overview</div>
));
jest.mock('../../components/InvoicesOverviewContent', () => ({ onNavigate }) => (
  <div data-testid="invoices-overview">Invoices Overview</div>
));

// Mock sub-modules
jest.mock('../../components/HRSubModules', () => ({
  SalariesModule: () => <div data-testid="salaries-module">Salaries Module</div>,
  AllowancesModule: () => <div data-testid="allowances-module">Allowances Module</div>,
  DeductionsModule: () => <div data-testid="deductions-module">Deductions Module</div>,
  CasualLeaveModule: () => <div data-testid="casual-leave-module">Casual Leave Module</div>,
  AnnualLeaveModule: () => <div data-testid="annual-leave-module">Annual Leave Module</div>,
  AttendanceModule: () => <div data-testid="attendance-module">Attendance Module</div>,
  HRReportsModule: () => <div data-testid="hr-reports-module">HR Reports Module</div>
}));

jest.mock('../../components/FinancialSubModules', () => ({
  JournalEntriesModule: () => <div data-testid="journal-entries-module">Journal Entries Module</div>,
  TreasuryModule: () => <div data-testid="treasury-module">Treasury Module</div>,
  BankModule: () => <div data-testid="bank-module">Bank Module</div>,
  CustomersModule: () => <div data-testid="customers-module">Customers Module</div>,
  SuppliersModule: () => <div data-testid="suppliers-module">Suppliers Module</div>,
  CustodyModule: () => <div data-testid="custody-module">Custody Module</div>,
  AccountsModule: () => <div data-testid="accounts-module">Accounts Module</div>,
  InventoryModule: () => <div data-testid="inventory-module">Inventory Module</div>,
  FinancialReportsModule: () => <div data-testid="financial-reports-module">Financial Reports Module</div>
}));

jest.mock('../../components/AnalyticsModule', () => ({
  AnalyticsModule: () => <div data-testid="analytics-module">Analytics Module</div>
}));

jest.mock('../../components/CompanySettings', () => () => <div data-testid="company-settings">Company Settings</div>);
jest.mock('../../components/ImportDataPage', () => () => <div data-testid="import-data">Import Data</div>);
jest.mock('../../components/DashboardContent', () => () => <div data-testid="dashboard-content">Dashboard Content</div>);

// Default props
const defaultProps = {
  activeModule: 'dashboard',
  activeHRSubModule: null,
  activeFinancialSubModule: null,
  activeInvoiceSubModule: null,
  language: 'en',
  employees: [],
  stats: {},
  selectedEmployeeId: null,
  setSelectedEmployeeId: jest.fn(),
  setActiveHRSubModule: jest.fn(),
  setActiveFinancialSubModule: jest.fn(),
  setActiveInvoiceSubModule: jest.fn(),
  navigate: jest.fn()
};

describe('ModuleRenderer Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboard Module', () => {
    it('should render dashboard content for dashboard module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="dashboard" />);
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });
  });

  describe('HR Module', () => {
    it('should render HR overview when activeHRSubModule is overview', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="hr" 
          activeHRSubModule="overview" 
        />
      );
      expect(screen.getByTestId('hr-overview')).toBeInTheDocument();
    });

    it('should render HR overview when activeHRSubModule is null', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="hr" 
          activeHRSubModule={null} 
        />
      );
      expect(screen.getByTestId('hr-overview')).toBeInTheDocument();
    });

    it('should render payroll page for employees sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="hr" 
          activeHRSubModule="employees" 
        />
      );
      expect(screen.getByTestId('payroll-page')).toBeInTheDocument();
    });

    it('should render salaries page for salaries sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="hr" 
          activeHRSubModule="salaries" 
        />
      );
      expect(screen.getByTestId('salaries')).toBeInTheDocument();
    });

    it('should render attendance page for attendance sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="hr" 
          activeHRSubModule="attendance" 
        />
      );
      expect(screen.getByTestId('attendance-page')).toBeInTheDocument();
    });

    it('should render employee profile when selectedEmployeeId is set', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="hr" 
          selectedEmployeeId="emp123" 
        />
      );
      expect(screen.getByTestId('employee-profile')).toBeInTheDocument();
      expect(screen.getByText(/emp123/)).toBeInTheDocument();
    });
  });

  describe('Financial Module', () => {
    it('should render financial overview for overview sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="financial" 
          activeFinancialSubModule="overview" 
        />
      );
      expect(screen.getByTestId('financial-overview')).toBeInTheDocument();
    });

    it('should render journal entries for journal-entries sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="financial" 
          activeFinancialSubModule="journal-entries" 
        />
      );
      expect(screen.getByTestId('journal-entries')).toBeInTheDocument();
    });

    it('should render bank management for bank sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="financial" 
          activeFinancialSubModule="bank" 
        />
      );
      expect(screen.getByTestId('bank-management')).toBeInTheDocument();
    });

    it('should render trial balance for trial-balance sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="financial" 
          activeFinancialSubModule="trial-balance" 
        />
      );
      expect(screen.getByTestId('trial-balance')).toBeInTheDocument();
    });
  });

  describe('Invoices Module', () => {
    it('should render invoices overview for overview sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="invoices" 
          activeInvoiceSubModule="overview" 
        />
      );
      expect(screen.getByTestId('invoices-overview')).toBeInTheDocument();
    });

    it('should render invoices page for invoices sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="invoices" 
          activeInvoiceSubModule="invoices" 
        />
      );
      expect(screen.getByTestId('invoices-page')).toBeInTheDocument();
    });

    it('should render ETA settings for eta-settings sub-module', () => {
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="invoices" 
          activeInvoiceSubModule="eta-settings" 
        />
      );
      expect(screen.getByTestId('eta-settings')).toBeInTheDocument();
    });
  });

  describe('Simple Modules', () => {
    it('should render analytics module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="analytics" />);
      expect(screen.getByTestId('analytics-module')).toBeInTheDocument();
    });

    it('should render projects module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="projects" />);
      expect(screen.getByTestId('projects-module')).toBeInTheDocument();
    });

    it('should render purchases module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="purchases" />);
      expect(screen.getByTestId('purchases-module')).toBeInTheDocument();
    });

    it('should render approvals module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="approvals" />);
      expect(screen.getByTestId('approvals-module')).toBeInTheDocument();
    });

    it('should render documents module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="documents" />);
      expect(screen.getByTestId('documents-module')).toBeInTheDocument();
    });

    it('should render settings module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="settings" />);
      expect(screen.getByTestId('company-settings')).toBeInTheDocument();
    });

    it('should render import data module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="import" />);
      expect(screen.getByTestId('import-data')).toBeInTheDocument();
    });

    it('should render admin dashboard module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="admin-dashboard" />);
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    });

    it('should render super admin dashboard module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="super-admin" />);
      expect(screen.getByTestId('super-admin-dashboard')).toBeInTheDocument();
    });

    it('should render notification settings module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="notification-settings" />);
      expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
    });

    it('should render user guide module', () => {
      render(<ModuleRenderer {...defaultProps} activeModule="user-guide" />);
      expect(screen.getByTestId('user-guide')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to coupons page', () => {
      const mockNavigate = jest.fn();
      render(
        <ModuleRenderer 
          {...defaultProps} 
          activeModule="coupons" 
          navigate={mockNavigate}
        />
      );
      expect(mockNavigate).toHaveBeenCalledWith('/admin/coupons');
    });
  });

  describe('Unknown Module', () => {
    it('should return null for unknown module', () => {
      const { container } = render(
        <ModuleRenderer {...defaultProps} activeModule="unknown-module" />
      );
      expect(container.firstChild).toBeNull();
    });
  });
});

describe('renderHRContent Function', () => {
  it('should return employee profile when selectedEmployeeId is set', () => {
    const result = renderHRContent({
      activeHRSubModule: 'overview',
      language: 'en',
      employees: [],
      stats: {},
      selectedEmployeeId: 'emp123',
      setSelectedEmployeeId: jest.fn(),
      setActiveHRSubModule: jest.fn()
    });
    
    const { container } = render(result);
    expect(screen.getByTestId('employee-profile')).toBeInTheDocument();
  });

  it('should return HR overview when no sub-module is selected', () => {
    const result = renderHRContent({
      activeHRSubModule: null,
      language: 'en',
      employees: [],
      stats: {},
      selectedEmployeeId: null,
      setSelectedEmployeeId: jest.fn(),
      setActiveHRSubModule: jest.fn()
    });
    
    render(result);
    expect(screen.getByTestId('hr-overview')).toBeInTheDocument();
  });
});

describe('renderFinancialContent Function', () => {
  it('should return financial overview when no sub-module is selected', () => {
    const result = renderFinancialContent({
      activeFinancialSubModule: null,
      language: 'en',
      stats: {},
      setActiveFinancialSubModule: jest.fn()
    });
    
    render(result);
    expect(screen.getByTestId('financial-overview')).toBeInTheDocument();
  });

  it('should return journal entries page for journal-entries sub-module', () => {
    const result = renderFinancialContent({
      activeFinancialSubModule: 'journal-entries',
      language: 'en',
      stats: {},
      setActiveFinancialSubModule: jest.fn()
    });
    
    render(result);
    expect(screen.getByTestId('journal-entries')).toBeInTheDocument();
  });
});

describe('renderInvoiceContent Function', () => {
  it('should return invoices overview when no sub-module is selected', () => {
    const result = renderInvoiceContent({
      activeInvoiceSubModule: null,
      language: 'en',
      stats: {},
      setActiveInvoiceSubModule: jest.fn()
    });
    
    render(result);
    expect(screen.getByTestId('invoices-overview')).toBeInTheDocument();
  });

  it('should return invoices page for invoices sub-module', () => {
    const result = renderInvoiceContent({
      activeInvoiceSubModule: 'invoices',
      language: 'en',
      stats: {},
      setActiveInvoiceSubModule: jest.fn()
    });
    
    render(result);
    expect(screen.getByTestId('invoices-page')).toBeInTheDocument();
  });
});
