# DataLife Account - ERP System PRD

## Original Problem Statement
Multi-tenant ERP system with comprehensive business management capabilities including:
- User Management & Authentication
- HR & Payroll
- Financial Management & Accounting
- Inventory Management
- Electronic Invoicing (E-Invoicing)
- Data Import/Export
- Reporting & Analytics

## User Personas
1. **Company Administrator** - Full access to all modules
2. **Financial Manager** - Access to financial, invoicing, and accounting modules
3. **HR Manager** - Access to HR and payroll modules
4. **Department Manager** - Limited access based on role

## Core Requirements

### Completed Features ✅

#### 1. Authentication & User Management
- JWT-based authentication
- Multi-tenant company registration
- User roles and permissions
- Profile photo upload
- Password change functionality
- Employee deletion (admin only)

#### 2. Data Import System
- Excel/CSV file import for all modules
- Import history tracking
- Error export for failed rows
- File format guide in modal

#### 3. Professional Accounting System
- Chart of Accounts management
- Journal Entries (create, post, reverse)
- General Ledger with account drill-down
- Financial Reports:
  - Trial Balance
  - Income Statement
  - Balance Sheet
- Quick Entry buttons (receipts, payments)
- Excel export for all reports

#### 4. Electronic Invoicing System
- **Document Types:**
  - Sales Invoices
  - Purchase Invoices
  - Sales Quotations
  - Purchase Orders
- **Features:**
  - Party Management (Customers/Suppliers)
  - Product/Service Catalog
  - VAT calculation (14% default)
  - Discount support (line-level)
  - PDF generation with QR Code
  - Automatic journal entry creation on approval
  - Quotation to Invoice conversion
  - Payment tracking
- **ETA Compliance:**
  - Tax ID validation
  - ETA code support for products
  - QR Code generation
- **Reports:**
  - Sales Report (by date, customer, product)
  - Purchases Report (by date, supplier, product)
  - VAT Report (output tax, input tax, net VAT, tax breakdown)
  - Aging Report (receivables with 0-30, 31-60, 61-90, 90+ buckets)
  - Excel export for all reports

#### 5. Multi-Currency Support (NEW - April 2026) ✅
- **Currency Management Page:**
  - View all 11 supported currencies (EGP, USD, EUR, SAR, AED, GBP, KWD, QAR, BHD, OMR, JOD)
  - Enable/Disable currencies per company
  - Set base currency
  - Stats cards showing enabled currencies count
- **Exchange Rates:**
  - Add exchange rates with effective date
  - View rates table with delete option
  - Rates stored per company
- **Currency Converter:**
  - Convert amounts between currencies
  - Uses stored exchange rates
  - Real-time calculation display
- **Invoice Integration:**
  - Currency selector in Create Invoice modal
  - Shows only enabled currencies
  - All enabled currencies available: EGP, USD, EUR, SAR, AED, GBP

#### 6. Invoice Adjustments - Discounts & Additions (NEW - April 2026) ✅
- **Discount Types:**
  - Contract Discount (خصم تعاقد)
  - Early Payment Discount (خصم دفع مبكر)
  - Volume Discount (خصم كمية)
  - Promotional Discount (خصم ترويجي)
  - Custom Discount (خصم مخصص)
- **Addition Types:**
  - Shipping Fee (رسوم شحن)
  - Service Fee (رسوم خدمة)
  - Table Tax (ضريبة جدول)
  - Insurance (تأمين)
  - Handling Fee (رسوم مناولة)
  - Custom Addition (إضافة مخصصة)
- **Calculation Options:**
  - Percentage (نسبة مئوية)
  - Fixed Amount (مبلغ ثابت)
- **Application Base:**
  - Before Tax (قبل الضريبة)
  - After Tax (بعد الضريبة)
- **UI Features:**
  - "Add Discount" button (red)
  - "Add Fee" button (green)
  - Real-time total calculation
  - Separate display for Total Discounts and Total Additions

#### 7. Professional Inventory Management System (NEW - April 2026) ✅
- **Multi-Warehouse Support:**
  - Create unlimited warehouses
  - Set default warehouse
  - Allow/Disallow negative stock per warehouse
- **Product Management:**
  - Multi-level categories (parent/child)
  - Barcode and SKU support
  - Multiple units of measure (with conversion factors)
  - Cost and sale price tracking
  - Tax rate configuration
  - Reorder level, min/max stock limits
  - Expiry date tracking
- **Stock Movements:**
  - Purchase (inward)
  - Sales (outward)
  - Transfer In/Out (between warehouses)
  - Adjustments (increase/decrease)
  - Returns (customer/supplier)
  - Damage write-off
  - Expired items write-off
  - Opening balance
- **Stock Transfers:**
  - Draft → Approve workflow
  - Line items with products and quantities
  - Automatic stock update on approval
- **Stock Adjustments/Counts:**
  - Physical inventory count
  - Variance calculation (system vs actual)
  - Multiple reasons (count, damage, theft, expired)
- **Reports:**
  - Stock Balance Report
  - Movement History Report
  - Low Stock Report (items below reorder level)
  - Stock Valuation Report (Average, FIFO, LIFO methods)
  - Expiry Report (items expiring soon)
- **Dashboard Stats:**
  - Total Stock Value
  - Total Products
  - Low Stock Count
  - Expiring Soon Count

#### 8. HR to Accounting Integration - Payroll System (NEW - April 2026) ✅
- **Payroll Runs Management:**
  - Create monthly payroll runs (YYYY-MM format)
  - Calculate payroll for all active employees
  - Approve payroll (creates journal entry automatically)
  - Pay/disburse payroll (creates payment journal entry)
  - Duplicate month prevention
- **Payroll Calculations (Egyptian Compliance):**
  - Basic salary tracking
  - Social insurance (employee 11%, company 18.75%)
  - Income tax brackets (Egyptian tax law)
  - Personal exemption (15,000 EGP)
  - Insurance min/max wage limits
- **Employee Loans (السُلف):**
  - Create loans with installment plans
  - Approve loans (creates journal entry)
  - Automatic deduction from salary
  - Track remaining balance
- **End of Service Settlements:**
  - Calculate years of service
  - End of service compensation
  - Settle pending loans
  - Deactivate employee on approval
- **Automatic Journal Entries:**
  - On Payroll Approval:
    - Dr. Salaries Expense
    - Dr. Social Insurance Expense (company share)
    - Cr. Social Insurance Payable
    - Cr. Income Tax Payable
    - Cr. Salaries Payable (net)
  - On Payroll Payment:
    - Dr. Salaries Payable
    - Cr. Bank/Cash
- **Payroll Reports:**
  - Monthly Cost Report
  - Department Cost Report
  - Employee Payslip
- **Payroll Settings:**
  - Social insurance rates
  - Income tax brackets
  - Personal exemption
  - Account mappings
- **Frontend Features:**
  - Payroll page under HR module
  - 5 tabs: Payroll Runs, Loans, End of Service, Reports, Settings
  - Summary cards (Employees, Gross, Deductions, Loans)
  - Status badges (Draft, Calculated, Approved, Paid)
  - Action buttons (Calculate, Approve, Pay, View)
- **Testing:**
  - 24/24 backend tests passed (100%)
  - All payroll flows verified
  - Journal entry integration confirmed

#### 9. Extended Employee Management System (NEW - April 2026) ✅
- **Employee Profile Page:**
  - Personal Information tab (name, ID, contact, emergency)
  - Employment Data tab (position, department, insurance, bank info)
  - Salary & Benefits tab (basic salary, allowances, deductions, summary)
  - Documents tab (upload/view employee documents)
  - Payroll History tab (monthly payroll records)
- **Photo & Documents:**
  - Upload employee photo
  - Upload multiple documents (contract, ID, certificates, etc.)
  - Document types: Contract, National ID, Passport, Certificate, Insurance Card, Medical Report
- **Allowances Management:**
  - Categories: Housing, Transportation, Phone, Meal, Clothing, Representation, Nature of Work
  - Fixed amount or percentage of basic salary
  - Taxable/Non-taxable flag
- **Deductions Management:**
  - Categories: Health Insurance, Medical, Absence, Late, Penalty
  - Automatic calculation of social insurance
- **Salary Summary:**
  - Real-time gross salary calculation
  - Real-time net salary calculation
  - Visual summary cards

#### 10. Work Shifts Management (NEW - April 2026) ✅
- **Shift Types:**
  - Morning (صباحية)
  - Evening (مسائية)
  - Night (ليلية)
  - Split (منقسمة)
  - Flexible (مرنة)
- **Shift Configuration:**
  - Start/End times
  - Break start/end times
  - Break duration
  - Working hours
  - Working days (Sunday-Saturday)
- **Overtime Settings:**
  - Overtime rate (default 1.5x)
  - Holiday rate (default 2.0x)
  - Night rate (default 1.25x)
  - Overtime starts after X hours
- **Late Tolerance:**
  - Allow late minutes configuration
  - Deduct after late flag
- **UI Features:**
  - Shift cards with colored badges by type
  - Add/Edit/Delete shifts
  - Working days selection

#### 11. Payroll Email Notifications (NEW - April 2026) ✅
- **Payslip Emails:**
  - Send payslip via email to employees
  - HTML formatted email with Arabic support
  - Shows: Basic salary, Allowances, Gross, Deductions, Net salary
  - Professional email template with company branding
- **Bulk Send:**
  - Send to all employees in a payroll run
  - Track sent count
  - Handle missing email addresses
- **Integration:**
  - Resend API for email delivery
  - Non-blocking async email sending
  - Mail button on approved/paid payroll runs

#### 12. HR Pages Redesign & Automatic Alerts System (NEW - April 2026) ✅
- **Redesigned HR Pages:**
  - Deductions Page (DeductionsPage.jsx):
    - Modern red gradient header
    - 4 stats cards (Total Deductions, Total Amount, Absence Deductions, Late Deductions)
    - Category filter and search
    - Add/View/Delete deduction modals
    - Export to Excel functionality
    - Categories: Absence, Late, Penalty, Loan, Insurance, Tax, Other
  - Allowances & Overtime Page (AllowancesPage.jsx):
    - Modern blue gradient header
    - 4 stats cards (Total Allowances, Total Amount, Overtime Records, Overtime Amount)
    - Dynamic overtime calculation (hours × rate)
    - Categories: Overtime, Housing, Transport, Phone, Meal, Bonus, Commission, Other
  - Shifts Management Page (ShiftsManagementPage.jsx):
    - Modern cyan gradient header
    - 4 stats cards (Total Shifts, Active Shifts, Total Employees, Avg Hours)
    - Shift cards with colored badges by type
    - Comprehensive shift form (times, breaks, working days, overtime rates, late settings)
    - Shift types: Morning, Evening, Night, Split, Flexible
  - Attendance Page (AttendancePage.jsx):
    - Updated with modern teal gradient header
    - Consistent design with other HR pages
- **Backend APIs (NEW - April 2026) ✅:**
  - `/api/hr/deductions` - Full CRUD for deductions management
  - `/api/hr/allowances` - Full CRUD for allowances & overtime
  - `/api/hr/shifts` - Full CRUD for work shifts with employee count
  - `/api/hr/stats/deductions` - Deductions statistics by category
  - `/api/hr/stats/allowances` - Allowances statistics with overtime hours
  - `/api/hr/stats/shifts` - Shifts statistics
- **Automatic HR Alerts System:**
  - API Endpoint: GET /api/notifications/hr-alerts
  - Alert Types:
    - leave_expiring: Annual leave balance expiring soon (within 30 days of year end)
    - termination_approaching: Contract end date approaching (within 30 days)
  - Alert Properties: priority (high/medium), days_remaining, employee info
  - Dashboard Integration: HRAlerts component displays alerts with navigation to relevant pages
- **Employee Code Protection:**
  - employee_code field is automatically generated on employee creation (format: EMP-0001)
  - employee_code is immutable - cannot be modified via PUT /api/employees/{id}
  - Backend removes employee_code from update requests
- **Testing:**
  - Backend APIs: All endpoints working with real database
  - Frontend pages: Verified with data-testid attributes


#### 13. Page Consolidation & Comprehensive HR Reports (NEW - April 2026) ✅
- **Purchases & Orders Page Consolidation:**
  - Merged "Purchase Orders" and "Purchase Invoices" into single "Purchases & Orders" page
  - Modern indigo gradient header design
  - Tabs: Purchase Orders, Suppliers
  - Unified statistics cards
  - Sidebar shows single "Purchases & Orders" entry
- **Projects & Tasks Page Consolidation:**
  - Merged "Projects" and "Tasks" into single "Projects & Tasks" page
  - Modern violet gradient header design
  - Projects display with task counts and progress
  - Real-time connection status indicator
  - Quick actions: New Project, New Task, Export
  - Sidebar shows single "Projects & Tasks" entry
- **Comprehensive HR Reports (HRComprehensiveReportsPage.jsx):**
  - Employee selector (all or individual)
  - Month filter
  - Per-employee comprehensive report cards:
    - Attendance section: Working days, Present, Absent, Late, Attendance rate
    - Deductions section: By category with totals
    - Allowances section: By category with totals  
    - Financial Summary: Base salary, Allowances, Deductions, Net balance, Final salary
  - Overview statistics: Total employees, Total deductions, Total allowances, Net difference
  - Export to PDF functionality
  - Print support with custom print styles
  - Real data from /api/employees with mock fallback


#### 13. Attendance Management System (NEW - April 2026) ✅

#### 14. Interactive Charts & Page Design Updates (NEW - April 2026) ✅
- **HR Comprehensive Reports - Interactive Charts:**
  - Attendance Distribution Pie Chart (Present/Absent/Late)
  - Employee Comparison Bar Chart (Allowances vs Deductions)
  - Deductions by Category Pie Chart
  - Allowances by Category Pie Chart
  - Using recharts library for responsive charts
- **Analytics Page Redesign:**
  - Modern indigo gradient header
  - Period selector (Daily/Monthly/Yearly) in header
  - Export buttons (Print, Excel, PDF) in header
  - Tabs: Overview, Financial, HR, Inventory
- **Approvals Page Redesign:**
  - Modern amber/orange gradient header
  - Real-time connection indicator
  - Stats cards with color coding
  - Tabs: Pending Approvals, My Requests, Workflows
- **Import Data Page Redesign:**
  - Modern emerald/teal gradient header
  - Import type cards (Employees, Customers, Suppliers, etc.)
  - Import history table with status tracking

#### 15. System-Wide Reports Page (NEW - April 2026) ✅
- **System Reports Landing Page Updated:**
  - Modern dark gradient header with icon
  - 3 report cards (HR Reports, Financial Reports, System Reports)
  - Color-coded cards with hover effects (cyan, emerald, violet)
  - Arabic/English bilingual support
- **System-Wide Reports Page (SystemReportsPage.jsx):**
  - Comprehensive overview of all system modules
  - 6 tabs: Overview, Financial, HR, Sales, Inventory, Projects
  - Period filter (Daily/Monthly/Yearly) with month selector
  - Export: Excel and PDF buttons
  - Refresh data functionality
  - **Overview Tab:**
    - 4 main stats: Total Revenue, Total Expenses, Net Profit, Total Employees
    - 6 secondary stats: Customers, Suppliers, Products, Projects, Pending Invoices, Low Stock
    - Monthly Revenue & Expenses Chart (ComposedChart with bars + line)
    - Sales by Category Pie Chart
  - **Financial Tab:**
    - Expenses Breakdown Pie Chart
    - Profit Trend Area Chart
  - **HR Tab:**
    - Employee by Department Pie Chart
    - HR Statistics cards
  - **Sales Tab:**
    - Customer, Invoice, Pending counts
  - **Inventory Tab:**
    - Inventory Status Pie Chart (In Stock, Low Stock, Out of Stock)
    - Inventory Summary cards
  - **Projects Tab:**
    - Project Status Pie Chart (Active, Completed, On Hold, Cancelled)
    - Projects Summary with completion rate progress bar
  - Arabic/English full bilingual support
  - Real data fetching from: /api/employees, /api/customers, /api/suppliers, /api/invoices, /api/purchases, /api/products, /api/projects, /api/expenses, /api/revenues
  - Mock data fallback for demo purposes

#### 16. Egyptian Standard Chart of Accounts (NEW - April 2026) ✅
- **Chart of Accounts Upgraded to Egyptian Accounting Standard:**
  - Replaced old numbering system (1000, 2000, etc.) with Egyptian standard (1, 11, 111, 11101, etc.)
  - Total 71 accounts following the Egyptian accounting hierarchy
  - Account structure with header (تجميعي) and detail (فرعي يقبل حركات) levels
  - **Accounts Categories Added:**
    - 1: الأصول (Assets)
      - 11: الأصول غير المتداولة (Non-Current Assets)
        - 111: الأراضي - 11101, 11102
        - 112-116: مباني، سيارات، آلات، أثاث، كمبيوتر
      - 12: المخزون (Inventory) - 121-124
      - 13: المدينون (Receivables) - 131-136
      - 14: مشروعات تحت التنفيذ
      - 16: النقدية (Cash) - 161, 162
    - 2: الالتزامات وحقوق الملكية
      - 21: حقوق الملكية - 211-213
      - 22: المخصصات والاحتياطيات - 221, 222, 223
      - 24: القروض والتسهيلات - 241, 242
      - 25: الدائنون - 251-255
    - 3: المصروفات
      - 31: تكلفة المبيعات (COGS) - 311-313
      - 33: المصروفات الإدارية - 331-334
      - 34: المصروفات البيعية - 341-343
    - 4: الإيرادات
      - 41: إيرادات النشاط - 411-413
      - 42: إيرادات أخرى - 421-423
- **API Endpoints:**
  - POST /api/accounting/accounts/reinitialize - Reset and reinitialize with Egyptian standard
- **UI Improvements:**
  - Modern gradient header with building icon
  - Tree-view table with folder/file icons
  - Account level column (رئيسي تجميعي / فرعي)
  - System account badges
  - RTL support with proper indentation
  - Dark mode support
  - Search and filter functionality
  - Export to CSV

#### 17. Financial Reports Suite (NEW - April 2026) ✅
- **Trial Balance Page (TrialBalancePage.jsx):**
  - Modern indigo gradient header with balance icon
  - Date selector for "as of date"
  - Balance status card (balanced/unbalanced indicator)
  - Grouped accounts by type (Assets, Liabilities, Equity, Revenue, Expenses)
  - Expandable/collapsible groups with folder icons
  - Total debit and credit columns
  - Show/hide zero balances toggle
  - Export to CSV functionality
  - Print button
  - Arabic/English bilingual support
  - Dark mode support
  
- **Income Statement Page (IncomeStatementPage.jsx):**
  - Modern emerald gradient header with receipt icon
  - Period date range selector (from/to)
  - Summary cards (Total Revenue, Total Expenses, Net Profit/Loss)
  - Revenue vs Expenses comparison bar chart (Recharts)
  - Expense breakdown pie chart
  - Detailed revenue table
  - Detailed expenses table
  - Net income summary equation card
  - Export to CSV functionality
  - Arabic/English bilingual support
  - Dark mode support
  
- **Balance Sheet Page (BalanceSheetPage.jsx):**
  - Modern blue gradient header with building icon
  - Date selector for "as of date"
  - Balance equation card (Assets = Liabilities + Equity)
  - Summary cards (Total Assets, Total Liabilities, Total Equity)
  - Assets breakdown pie chart
  - Financing sources pie chart
  - Expandable sections:
    - Current Assets
    - Fixed Assets
    - Current Liabilities
    - Long-term Liabilities
    - Equity
  - Export to CSV functionality
  - Arabic/English bilingual support
  - Dark mode support

- **Navigation Updates:**
  - Added Trial Balance to Financial module sidebar
  - Added Income Statement to Financial module sidebar
  - Added Balance Sheet to Financial module sidebar
  - All three reports accessible from القيود اليومية section

#### 18. Journal Entries Integration with Egyptian Standard (NEW - April 2026) ✅
- **Journal Entries Page Updated:**
  - Now fetches accounts from `/api/accounting/accounts?active_only=false`
  - Filters to show only posting accounts (is_header = false)
  - Account dropdown shows Egyptian standard codes (11101, 11102, 112, etc.)
  - 52 posting accounts available for journal entry creation
  - Proper Arabic/English bilingual support with language prop passed
  
- **Route Files Created for Future Refactoring:**
  - `/app/frontend/src/routes/HRRoutes.jsx` - HR module routing logic (77 lines)
  - `/app/frontend/src/routes/FinancialRoutes.jsx` - Financial module routing logic (68 lines)
  - `/app/frontend/src/routes/ReportsRoutes.jsx` - Reports module routing logic (109 lines)
  - `/app/frontend/src/routes/index.js` - Central export for all routes
  
- **RealDashboard.jsx Improvements:**
  - Added `language` prop to all page components for consistent bilingual support
  - Maintained current functionality while preparing for future modularization

#### 19. Multi-Bank Management System (NEW - April 2026) ✅
- **Backend API (`/app/backend/api/bank_management.py`):**
  - `GET /api/bank-accounts` - List all bank accounts with calculated balances
  - `POST /api/bank-accounts` - Create new bank account
  - `PUT /api/bank-accounts/{id}` - Update bank account
  - `DELETE /api/bank-accounts/{id}` - Delete bank account (only if no transactions)
  - `GET /api/bank-transactions` - List transactions with filters (bank, type, date)
  - `POST /api/bank-transactions` - Create new transaction
  - `DELETE /api/bank-transactions/{id}` - Delete transaction
  - `GET /api/bank-checks` - List checks (incoming/outgoing)
  - `PUT /api/bank-checks/{id}/status` - Update check status

- **Frontend Page (`/app/frontend/src/pages/BankManagementPage.jsx`):**
  - Modern gradient header with bank icon
  - Summary cards: Total Accounts, Total Balance, Total Deposits, Total Withdrawals
  - **Two tabs:**
    1. **Bank Accounts Tab:**
       - Card view for each bank account
       - Shows bank name (Arabic/English), account number, current balance
       - Deposit/Withdrawal indicators per account
       - Quick "Add Transaction" button per account
       - Delete account button
       - View account details modal
    2. **Transactions Tab:**
       - Table view of all transactions
       - Filter by type: All, Deposits, Withdrawals, Checks
       - Transaction number (BTX-YYYY-XXXXX format)
       - Color-coded types (green for deposits, red for withdrawals/checks)
  - **Add Account Modal:**
    - Bank name (Arabic/English)
    - Account number
    - Branch name
    - Opening balance
    - Account type (Current/Savings)
  - **Add Transaction Modal:**
    - Bank account selector
    - Transaction type: Deposit, Withdrawal, Check Deposit, Check Issued, Transfer In/Out
    - Amount, Description, Reference
    - Check-specific fields (check number, date, beneficiary)
  - Full Arabic/English bilingual support
  - Dark mode support

- **Data Models:**
  - `bank_accounts` collection: bank_name, bank_name_en, account_number, iban, swift_code, branch_name, currency, opening_balance, account_type, linked_account_code, is_active
  - `bank_transactions` collection: bank_account_id, transaction_type, amount, description, reference, check_number, check_date, check_bank, beneficiary, transaction_date, status, journal_entry_id, journal_entry_number

#### 20. Bank Transactions to Accounting Integration (NEW - April 2026) ✅
- **Automatic Journal Entry Creation:**
  - Every bank transaction (deposit, withdrawal, check) automatically creates a corresponding journal entry
  - Journal entries follow double-entry bookkeeping principles
  - **Transaction Types & Journal Logic:**
    | نوع العملية | الطرف المدين | الطرف الدائن |
    |------------|-------------|--------------|
    | إيداع (deposit) | 162 - البنوك | الحساب المقابل (نقدية/عملاء/إيراد) |
    | سحب (withdrawal) | المصروفات/الموردون | 162 - البنوك |
    | شيك وارد (check_deposit) | 162 - البنوك | 131 - العملاء |
    | شيك صادر (check_issued) | 251 - الموردون | 162 - البنوك |
    | تحويل (transfer) | البنك المستلم | البنك المرسل |

- **Backend API Enhancements (`/app/backend/api/bank_management.py`):**
  - `POST /api/bank-transactions` - Now accepts `counter_account_code` and `auto_create_journal` parameters
  - `GET /api/bank-counter-accounts` - Get recommended counter accounts per transaction type
  - `GET /api/bank-transactions/{id}/journal-entry` - View linked journal entry
  - `POST /api/bank-transactions/{id}/create-journal` - Create journal for existing transaction

- **Frontend Updates (`/app/frontend/src/pages/BankManagementPage.jsx`):**
  - **Transactions Table:** New "Journal Entry" column shows linked entry number (#9, #10, etc.)
  - **Journal Entry Modal:** Click on journal number to view full entry details (accounts, amounts, status)
  - **Add Transaction Modal:** 
    - New "Journal Entry" section with purple border
    - "Auto-create journal entry" checkbox (enabled by default)
    - "Counter Account" dropdown with recommended accounts per transaction type
    - Accounts grouped by: Recommended Accounts (based on transaction type)
    - Helper text: "Leave empty for automatic default selection"

- **Default Counter Accounts:**
  - Deposit: 161 (النقدية بالصندوق)
  - Withdrawal: 331 (رواتب وأجور)
  - Check Deposit: 131 (العملاء)
  - Check Issued: 251 (الموردون)
  - Transfer: 162 (بنك آخر)

- **Testing Verified:**
  - Created deposit transaction → Journal Entry #9 created automatically
  - Created withdrawal transaction → Journal Entry #10 created automatically
  - Journal entry shows balanced debit/credit with "Entry is balanced" indicator
  - All entries linked correctly to their source bank transactions

#### 21. Bank Settings & Auto-Post Configuration (NEW - April 2026) ✅
- **Backend API (`/app/backend/api/bank_management.py`):**
  - `GET /api/bank-settings` - Get company bank settings
  - `PUT /api/bank-settings` - Update company bank settings
  - Settings stored per-company (multi-tenant support)

- **Settings Available:**
  - **auto_post_journal**: Enable/disable automatic journal entry posting
  - **default_deposit_account**: Default credit account for deposits (default: 161)
  - **default_withdrawal_account**: Default debit account for withdrawals (default: 331)
  - **default_check_deposit_account**: Default credit account for incoming checks (default: 131)
  - **default_check_issued_account**: Default debit account for issued checks (default: 251)
  - **require_approval_above**: Amount threshold requiring approval (optional)
  - **notify_on_large_transaction**: Enable large transaction alerts
  - **large_transaction_threshold**: Amount threshold for alerts (default: 100,000)

- **Frontend Page (`/app/frontend/src/pages/BankSettingsPage.jsx`):**
  - Modern gradient header with settings icon
  - **Journal Entry Posting card:**
    - Toggle for auto-post feature
    - Green indicator when enabled ("Auto-posting is enabled")
    - Yellow warning when disabled ("Manual posting required")
  - **Transaction Alerts card:**
    - Toggle for large transaction notifications
    - Threshold amount input
    - Optional approval threshold input
  - **Default Counter Accounts card:**
    - Color-coded account selectors for each transaction type
    - Deposit (green), Withdrawal (red), Check Deposit (blue), Check Issued (purple)
    - Dropdown with all available posting accounts

- **Auto-Post Behavior:**
  - When enabled: Journal entries are created with status "posted" and immediately affect account balances
  - When disabled: Journal entries are created as "draft" and need manual posting from Journal Entries page
  - Each company can configure independently

- **Testing Verified:**
  - Settings API working correctly
  - Enabled auto-post → Created deposit → Journal Entry #11 with status "posted" ✅
  - Settings page displaying correctly with all options

#### 22. Email Notification System (NEW - April 2026) ✅
- **Backend API (`/app/backend/api/email_notifications.py`):**
  - `POST /api/notifications/send-email` - Send single email
  - `POST /api/notifications/send-bulk-email` - Send bulk emails (background task)
  - `GET /api/notifications/settings` - Get company notification settings
  - `PUT /api/notifications/settings` - Update notification settings
  - `GET /api/notifications/logs` - Get notification history
  - `POST /api/notifications/trigger/large-transaction` - Trigger large transaction alert
  - `POST /api/notifications/trigger/payslips` - Send payslips to employees
  - `POST /api/notifications/check-alerts` - Check and send automatic alerts

- **Email Templates (Arabic RTL Support):**
  - Large transaction alert (معاملة بنكية كبيرة)
  - Payslip notification (كشف الراتب)
  - Contract expiry warning (انتهاء العقد)
  - Invoice due reminder (فاتورة مستحقة)
  - Approval request (طلب موافقة)

- **Notification Settings:**
  - **email_notifications_enabled**: Master toggle for all notifications
  - **notify_large_transactions**: Alert when bank transaction exceeds threshold
  - **large_transaction_threshold**: Amount threshold (default: 100,000)
  - **notify_payroll_ready**: Notify when payroll is ready
  - **notify_employees_payslip**: Send payslips to employees
  - **notify_contract_expiry**: Alert before contract expires
  - **contract_expiry_days**: Days before expiry to alert (default: 30)
  - **notify_invoice_due**: Alert for due invoices
  - **invoice_due_days**: Days before due date (default: 7)
  - **notify_pending_approvals**: Alert for new approval requests
  - **admin_emails**: List of admin email addresses

- **Email Service Integration:**
  - Using Resend API for reliable email delivery
  - Async sending with background tasks for bulk emails
  - HTML templates with Arabic RTL support
  - Notification logging for audit trail

- **Frontend Page (`/app/frontend/src/pages/NotificationSettingsPage.jsx`):**
  - Orange gradient header
  - Admin Emails management (add/remove)
  - Send Test Email button
  - Toggle switches for each notification type
  - Recent Notification Log display

#### 23. Admin Dashboard - Advanced Analytics (NEW - April 2026) ✅
- **Frontend Page (`/app/frontend/src/pages/AdminDashboardPage.jsx`):**
  - Colorful gradient header with Refresh button
  - **Quick Stats Row 1 (Financial):**
    - Total Revenue with growth percentage
    - Bank Balance with today's deposits
    - Pending Invoices with overdue count
    - Net Profit with growth percentage
  - **Quick Stats Row 2 (Operations):**
    - Employees (total/active)
    - Customers count
    - Products (total/low stock)
    - Active Projects (active/completed)
  - **Charts Section:**
    - Revenue & Expenses bar chart (6 months)
    - Profit line overlay
    - Expenses Breakdown pie chart
  - **Bottom Section:**
    - Recent Transactions list with color-coded types
    - Alerts & Notifications panel

- **Data Sources:**
  - Real-time data from employees, customers, suppliers APIs
  - Bank accounts and transactions
  - Invoices and products
  - Projects status

- **Check-in/Check-out:**
  - Record check-in time
  - Record check-out time
  - Device tracking (fingerprint device ID)
  - Automatic working hours calculation
- **Late & Overtime Calculation:**
  - Compare with shift expected times
  - Grace period support
  - Automatic late minutes calculation
  - Overtime hours calculation
  - Night/Holiday overtime rates
- **Daily Summary:**
  - Total employees count
  - Present/Absent/Late/On Leave counts
  - Total working hours
  - Total overtime hours
  - Attendance rate percentage
- **Monthly Summary:**
  - Per-employee statistics
  - Working days, present days, absent days
  - Late days count
  - Leave days count
  - Total working hours & overtime
  - Attendance rate per employee
- **Fingerprint Report:**
  - Date range filter
  - Employee/Department filter
  - Expected vs Actual times
  - Late minutes & overtime hours
  - Export capability
- **Overtime Report:**
  - Monthly overtime totals
  - Per-employee breakdown
  - Overtime days count
  - Detailed daily overtime records
- **Import Fingerprint:**
  - CSV file upload
  - Auto-match employees by code
  - Auto-calculate working hours
  - Error reporting
- **Manual Attendance:**
  - Add manual entries
  - Excuse/reason support
  - Status selection (present, absent, late, on_leave)
- **Holidays Management:**
  - Add official holidays
  - Annual recurrence support
  - Holiday-aware calculations
- **Attendance Settings:**
  - Grace period minutes
  - Late deduction per minute
  - Max late before absence
  - Early leave deduction
  - Absence deduction type/days
  - Overtime approval requirement
  - Weekend days configuration
  - Require both punches

#### 14. Attendance-Payroll Integration with Company HR Settings (NEW - April 2026) ✅
- **Company HR Settings (إعدادات الموارد البشرية لكل شركة):**
  - Separate configuration per company (multi-tenant support)
  - Flexible rules that each company can customize
- **Late Deduction Settings:**
  - Enable/Disable late deduction
  - Calculation methods: Per Minute, Per Hour, Brackets, None
  - Grace period (minutes) - late allowed without deduction
  - Per minute/hour deduction rate
  - Max late minutes before counting as absence
- **Absence Deduction Settings:**
  - Enable/Disable absence deduction
  - Calculation methods: Full Day, Day + Penalty, None
  - Days deducted per absence
  - Penalty percentage (for day_plus_penalty method)
  - Option to deduct excused absence
- **Overtime Settings:**
  - Enable/Disable overtime bonus
  - Calculation method: Hourly, Daily, None
  - Regular overtime rate (default 1.5x)
  - Holiday overtime rate (default 2.0x)
  - Night overtime rate (default 1.25x)
  - Max monthly overtime hours
  - Require pre-approval option
- **General Settings:**
  - Standard working hours per day (default 8)
  - Standard working days per month (default 22)
  - Weekend days selection (multiple days)
- **Payroll Integration:**
  - Automatic attendance data fetch when calculating payroll
  - Late deduction added to payroll deductions
  - Absence deduction added to payroll deductions
  - Overtime bonus added to payroll allowances
  - Preview endpoint: `GET /api/payroll/attendance-payroll-preview?month=YYYY-MM`
  - Shows per-employee impact before creating payroll
- **API Endpoints:**
  - `GET /api/payroll/hr-settings` - Get company HR settings
  - `PUT /api/payroll/hr-settings` - Update company HR settings
  - `GET /api/payroll/attendance-payroll-preview` - Preview attendance impact on payroll
- **Frontend HR Settings Page:**
  - Accessible via: Human Resources > HR Settings
  - 4 cards: Late Deduction, Absence Deduction, Overtime, General Settings
  - Real-time form updates
  - Save Settings button
  - Arabic/English bilingual support
- **Testing:**
  - 22/22 backend tests passed (100%)
  - Frontend page verified

#### 15. Egyptian Tax Authority (ETA) Integration (NEW - April 2026) ✅ PARTIAL
- **Company ETA Settings:**
  - Separate configuration per company (multi-tenant support)
  - Tax Registration Number
  - Branch ID (0 for head office)
  - Activity Code
- **API Credentials Management:**
  - Client ID storage
  - Client Secret secure storage (masked in UI)
  - Links to ETA portals (Preproduction and Production)
- **Environment Selection:**
  - Preproduction (Testing) environment
  - Production environment
  - Easy toggle between environments
- **Connection Testing:**
  - Test Connection button
  - Connection status tracking
  - Last test timestamp
- **Integration Status:**
  - Enable/Disable integration toggle
  - Auto-submit invoices on approval option
- **Submissions Log:**
  - Track all submitted invoices
  - Status tracking (pending, submitted, valid, invalid, rejected, cancelled)
  - Document UUID and Long ID storage
  - Submission timestamp
- **API Endpoints:**
  - `GET /api/eta/settings` - Get company ETA settings
  - `PUT /api/eta/settings` - Update company ETA settings
  - `POST /api/eta/test-connection` - Test connection with ETA
  - `GET /api/eta/submissions` - Get submissions log
  - `POST /api/eta/submit-invoice` - Submit invoice to ETA
  - `GET /api/eta/submission-status/{uuid}` - Check submission status
  - `GET /api/eta/document/{uuid}` - Get document details
- **Frontend ETA Settings Page:**
  - Accessible via: E-Invoices > Tax Authority Settings
  - 2 tabs: Settings and Submissions Log
  - 4 settings cards: Tax Registration Data, API Credentials, Environment, Integration Status
  - Warning banner about using Preproduction first
  - Save Settings button
- **Testing:**
  - 20/20 backend tests passed (100%)
  - Frontend page verified

#### 16. UI/UX
- Dark/Light mode toggle
- RTL/LTR language support (Arabic/English)
- Responsive sidebar with sub-menus
- Application footer with branding
- Company logo placement

### Upcoming Tasks 📋

#### P1 - High Priority
1. **Egyptian Tax Authority (ETA) Invoice Submission** ✅ PARTIALLY DONE
   - ✅ Company ETA Settings page created
   - ✅ API credentials management (Client ID, Client Secret)
   - ✅ Environment selection (Preproduction/Production)
   - ✅ Connection testing endpoint
   - ✅ Submissions log with status tracking
   - 🔄 REMAINING: Actual invoice submission to ETA (requires real credentials)
   - 🔄 REMAINING: Document validation and error handling
   - 🔄 REMAINING: UUID and receipt number tracking

2. **Additional Email Notifications**
   - New employee welcome email
   - Leave approval notifications
   - Attendance alerts
   - Invoice sent notifications
   - Payment reminders
   - Report generation alerts

#### P2 - Medium Priority
1. **Payment Terms Enhancement**
   - Custom payment terms
   - Installment plans
   - Early payment discounts

#### P3 - Future Enhancements
1. **Bank Reconciliation**
2. **Budget Management**
3. **Project Costing**
4. **Mobile App**

## Technical Architecture

### Backend (FastAPI)
```
/app/backend/
├── api/
│   ├── accounting.py      # Accounting endpoints
│   ├── invoice.py         # E-invoicing + Currency endpoints
│   └── auth.py            # Authentication
├── models/
│   ├── accounting.py      # Accounting models
│   └── invoice.py         # Invoice + Currency models
├── services/
│   ├── accounting_service.py
│   └── invoice_service.py
└── server.py
```

### Frontend (React)
```
/app/frontend/src/
├── components/
│   ├── RealDashboard.jsx  # Main dashboard
│   ├── ModernSidebar.jsx  # Navigation
│   └── ui/                # Shadcn components
├── pages/
│   ├── InvoicesPage.jsx       # E-invoicing with currency selector
│   ├── PartiesPage.jsx        # Customers/Suppliers
│   ├── ProductsPage.jsx       # Products catalog
│   ├── CurrenciesPage.jsx     # Currency Management (NEW)
│   ├── InvoiceReportsPage.jsx # Invoice Reports
│   ├── JournalEntriesPage.jsx
│   ├── GeneralLedgerPage.jsx
│   └── FinancialReportsPage.jsx
└── contexts/
    ├── ThemeContext.jsx
    └── LanguageContext.jsx
```

### Database (MongoDB)
**Collections:**
- users
- companies
- employees
- chart_of_accounts
- journal_entries
- invoices
- parties
- products
- import_logs
- company_currencies (NEW)
- exchange_rates (NEW)

### Key Dependencies
- Backend: FastAPI, PyMongo, ReportLab, QRCode, Pandas, XlsxWriter, arabic-reshaper, python-bidi
- Frontend: React, Shadcn/UI, Lucide Icons, Sonner

## API Endpoints

### Currency Management (NEW)
```
GET    /api/invoice/config/currencies          # Get all currencies with enabled status
PUT    /api/invoice/config/currencies/settings # Update base currency and enabled currencies
GET    /api/invoice/config/exchange-rates      # Get exchange rates
POST   /api/invoice/config/exchange-rates      # Add new exchange rate
DELETE /api/invoice/config/exchange-rates/{id} # Delete exchange rate
GET    /api/invoice/config/convert             # Convert currency amount
```

### Adjustments (NEW)
```
GET    /api/invoice/adjustment-categories  # Get all discount/addition categories
```

### Invoicing
```
POST   /api/invoice/                    # Create invoice (supports currency field)
GET    /api/invoice/                    # List invoices
GET    /api/invoice/{id}                # Get invoice details
POST   /api/invoice/{id}/approve        # Approve invoice
GET    /api/invoice/{id}/pdf            # Download PDF
POST   /api/invoice/{id}/convert-to-invoice  # Convert quote to invoice

# Parties
POST   /api/invoice/parties             # Create party
GET    /api/invoice/parties             # List parties
PUT    /api/invoice/parties/{id}        # Update party

# Products
POST   /api/invoice/products            # Create product
GET    /api/invoice/products            # List products
GET    /api/invoice/units               # List units

# Reports
GET    /api/invoice/reports/sales       # Sales Report
GET    /api/invoice/reports/purchases   # Purchases Report
GET    /api/invoice/reports/vat         # VAT Report
GET    /api/invoice/reports/aging       # Aging Report
GET    /api/invoice/reports/export/{type}  # Export to Excel
```

### Attendance (NEW)
```
# Check-in/Check-out
POST   /api/attendance-pro/check-in           # Record check-in
POST   /api/attendance-pro/check-out          # Record check-out
POST   /api/attendance-pro/manual             # Add manual attendance

# Records
GET    /api/attendance-pro/records            # List attendance records
GET    /api/attendance-pro/records/{id}       # Get record details
PUT    /api/attendance-pro/records/{id}       # Update record
DELETE /api/attendance-pro/records/{id}       # Delete record

# Summaries & Reports
GET    /api/attendance-pro/daily-summary      # Daily statistics
GET    /api/attendance-pro/monthly-summary    # Monthly per-employee summary
GET    /api/attendance-pro/fingerprint-report # Fingerprint report
GET    /api/attendance-pro/overtime-report    # Overtime report
GET    /api/attendance-pro/statistics         # Monthly statistics

# Holidays & Settings
GET    /api/attendance-pro/holidays           # List holidays
POST   /api/attendance-pro/holidays           # Add holiday
DELETE /api/attendance-pro/holidays/{id}      # Delete holiday
GET    /api/attendance-pro/settings           # Get settings
PUT    /api/attendance-pro/settings           # Update settings

# Import
POST   /api/attendance-pro/import-fingerprint # Import from CSV
```

### Accounting
```
POST   /api/accounting/journal-entries  # Create entry
GET    /api/accounting/journal-entries  # List entries
POST   /api/accounting/journal-entries/{id}/post
GET    /api/accounting/general-ledger
GET    /api/accounting/reports/trial-balance
GET    /api/accounting/reports/income-statement
GET    /api/accounting/reports/balance-sheet
```

### Payroll (NEW)
```
# Payroll Runs
GET    /api/payroll/runs                    # List payroll runs
POST   /api/payroll/runs                    # Create payroll run
GET    /api/payroll/runs/{id}               # Get run details
POST   /api/payroll/runs/{id}/calculate     # Calculate salaries
POST   /api/payroll/runs/{id}/approve       # Approve (creates journal entry)
POST   /api/payroll/runs/{id}/pay           # Pay (creates payment entry)

# Loans
GET    /api/payroll/loans                   # List loans
POST   /api/payroll/loans                   # Create loan
POST   /api/payroll/loans/{id}/approve      # Approve loan (creates journal entry)

# End of Service
GET    /api/payroll/end-of-service          # List settlements
POST   /api/payroll/end-of-service          # Create settlement
POST   /api/payroll/end-of-service/{id}/approve  # Approve (creates journal entry)

# Settings & Reports
GET    /api/payroll/settings                # Get payroll settings
PUT    /api/payroll/settings                # Update settings
GET    /api/payroll/reports/monthly-cost    # Monthly cost report
GET    /api/payroll/reports/department-cost # Department cost report
GET    /api/payroll/reports/payslip/{run_id}/{employee_id}  # Employee payslip
```

## Testing Credentials
- Email: dalia@datalifeai.com
- Password: Dalia@2024

## Deployment Notes
- Preview URL: https://bulk-upload-demo.preview.emergentagent.com
- Production: datalifeaccount.com (requires "Save to Github" and deploy)
- Static files served via /api/uploads/ to bypass Ingress routing

## Known Issues
- MongoDB ObjectId must be excluded from API responses
- Static uploads must use /api/uploads/ prefix
- Route collisions: New GET endpoints must be placed before /{invoice_id} route or use explicit prefixes

## Changelog

- **April 5, 2026 (Update 12)**: HR Pages Redesign & Termination Feature ✅
  - **Casual Leave Page (Cyan theme):**
    - Modern header with export & add buttons
    - Stats cards (Total, Approved, Pending, Rejected)
    - Filterable table with actions (View, Approve, Reject, Delete)
    - Add/View/Delete modals
    - New file: `/app/frontend/src/pages/CasualLeavePage.jsx`
  
  - **Annual Leave Page (Violet theme):**
    - Modern header with export & request buttons
    - Stats cards (Total Requests, Total Days, Approved, Pending)
    - Leave balance progress bar
    - Date range selection (From/To)
    - New file: `/app/frontend/src/pages/AnnualLeavePage.jsx`
  
  - **HR Reports Page:**
    - Report type selector (Attendance, Salary, Department, Leave)
    - Interactive charts using Recharts:
      - Attendance: Bar Chart (Present/Absent/Late)
      - Salary: Line Chart (Salaries/Allowances/Deductions)
      - Department: Pie Chart with legend
      - Leave: Pie Chart with breakdown
    - Date range filter
    - Export functionality
    - New file: `/app/frontend/src/pages/HRReportsPage.jsx`
  
  - **Termination Page (Rose theme):**
    - Stats cards (Total Cases, Completed, Pending, Total Settlement)
    - Termination reasons: Resignation, End of Contract, Termination, Retirement, Mutual Agreement, Death, Disability
    - Final settlement tracking
    - Notice period management
    - Detailed view modal
    - New file: `/app/frontend/src/pages/TerminationPage.jsx`
  
  - Added "Termination" menu item to HR module in sidebar
  - Updated routing in `RealDashboard.jsx`
  - Testing: Frontend verified (screenshots in Arabic)

- **April 5, 2026 (Update 11)**: Overview Pages Redesign ✅
  - **HR Overview (Cyan theme):**
    - Header with gradient background and description
    - 4 stat cards (Employees, Allowances, Deductions, Attendance Rate)
    - Quick actions buttons (Add Employee, Payroll, Attendance, Reports)
    - Employee list table with avatars and badges
    - New file: `/app/frontend/src/components/HROverviewContent.jsx`
  
  - **Financial Overview (Emerald theme):**
    - Header with gradient background and description
    - 4 stat cards (Revenue, Expenses, Net Profit, Active Customers)
    - Quick financial actions (Journal Entry, New Customer, New Supplier, Reports)
    - Financial summary section with icons
    - New file: `/app/frontend/src/components/FinancialOverviewContent.jsx`
  
  - **Invoices Overview (Amber theme):**
    - Header with gradient background, ETA Settings & New Invoice buttons
    - 4 stat cards (Total, Pending, Sent, Approved)
    - Quick actions with descriptions (Sales Invoice, Purchase Invoice, Reports, ETA Settings)
    - Invoice status breakdown (Draft, Pending, Submitted, Approved, Rejected)
    - ETA integration banner
    - New file: `/app/frontend/src/components/InvoicesOverviewContent.jsx`
  
  - Updated routing in `ModernSidebar.jsx` and `RealDashboard.jsx`
  - Testing: Frontend verified (screenshots in Arabic)

- **April 5, 2026 (Update 10)**: User Management & Dashboard Charts ✅
  - **Change Password Feature:**
    - Frontend form in ProfileTab with current/new/confirm password fields
    - Backend API: POST /api/auth/change-password
    - Password validation (min 6 characters)
    - Success/error toast notifications
  
  - **Delete Employee Feature:**
    - Delete button in EmployeesTab for each non-current user
    - Confirmation modal before deletion
    - Backend API: DELETE /api/users/{user_id}
    - Cannot delete your own account (UI protection)
  
  - **Activity Log System:**
    - New backend API: /api/activity/* (logs, stats, recent)
    - Activity log tab in Settings
    - Stats cards (Total Activities, Today's Actions, Active Users, Action Types)
    - Filter by entity type (Users, Employees, Invoices, Payroll)
    - Pagination support
    - New files: /app/backend/api/activity_log.py, /app/frontend/src/components/settings/ActivityLogTab.jsx
  
  - **Interactive Dashboard Charts:**
    - Revenue vs Expenses Area Chart
    - Monthly Invoices Bar Chart
    - Employee Distribution Pie Chart
    - Expense Breakdown Pie Chart
    - Employee Growth Line Chart
    - Period selector (Week/Month/Quarter/Year)
    - Recharts library integration
    - New file: /app/frontend/src/components/DashboardCharts.jsx
  
  - Testing: Frontend verified (screenshots)

- **April 5, 2026 (Update 9)**: Dashboard UI/UX Redesign ✅
  - Complete redesign of Dashboard to match new sidebar color scheme
  - New welcome header with date display
  - Color-coded stats cards (Cyan for HR, Emerald for Financial, Amber for Invoices, Teal for Inventory)
  - Modern Quick Actions section with Phosphor icons
  - Recent Activity section with colored module badges
  - Upcoming Tasks with progress bars
  - Module navigation cards for quick access
  - Full Dark Mode support with consistent colors
  - RTL (Arabic) support verified
  - Created new component: `/app/frontend/src/components/DashboardContent.jsx`
  - Updated: `/app/frontend/src/components/RealDashboard.jsx`
  - Testing: Frontend UI verified (screenshots)

- **April 4, 2026 (Update 8)**: Attendance Management System with Fingerprint Report ✅
  - Daily Attendance tracking with check-in/check-out
  - Automatic late minutes and overtime calculation
  - Monthly summary per employee (present days, absent, late, overtime)
  - Fingerprint Report with date range filter
  - Overtime Report with monthly totals
  - Import fingerprint data from CSV
  - Manual attendance entry
  - Holidays management
  - Attendance settings (grace period, deduction rates, weekend days)
  - Statistics dashboard (attendance rate, total hours, late minutes)
  - Frontend: AttendancePage with 4 tabs under HR module
  - Backend: /app/backend/api/attendance_api.py (20+ endpoints)
  - Testing: 100% backend (22 tests), 100% frontend

- **April 4, 2026 (Update 7)**: Extended Employee Management, Work Shifts, and Payroll Email Notifications ✅
  - Employee Profile Page with 5 tabs (Personal Info, Employment, Salary, Documents, History)
  - Photo upload and multiple document upload for employees
  - Allowances and Deductions management per employee
  - Salary summary with gross/net calculation
  - Work Shifts management for factories (Morning, Evening, Night, Split, Flexible)
  - Shift configuration: working hours, overtime rates, break times, working days
  - Payroll email notifications via Resend API
  - Send payslip emails to employees (HTML formatted, Arabic support)
  - Testing: 94% backend (15/16), 100% frontend

- **April 4, 2026 (Update 6)**: HR to Accounting Integration - Payroll System ✅
  - Complete payroll management with monthly runs
  - Payroll calculation with Egyptian tax/insurance rates
  - Employee loans with installment tracking
  - End of service settlements
  - Automatic journal entry creation on approval
  - Automatic payment journal entry on disbursement
  - Reports: Monthly Cost, Department Cost, Payslip
  - Frontend: PayrollPage with 5 tabs under HR module
  - Backend: /app/backend/api/payroll.py (20+ endpoints)
  - Testing: 24/24 tests passed (100%)

- **April 4, 2026 (Update 5)**: Professional Inventory Management System ✅
  - Complete inventory module with multi-warehouse support
  - Products with barcode, SKU, multi-unit, categories
  - Stock movements (11 types: purchase, sales, transfers, adjustments, returns, damage, expired, opening)
  - Stock transfers with draft/approve workflow
  - Stock adjustments/counts for physical inventory
  - 5 Reports: Stock Balance, Movement History, Low Stock, Valuation, Expiry
  - Frontend: InventoryPage with 8 tabs, stats cards, modals
  - Backend: /app/backend/api/inventory_pro.py (26 endpoints)
  - Testing: 100% pass rate (16 backend tests, all UI verified)

- **April 4, 2026 (Update 4)**: Invoice Adjustments (Discounts & Additions) Implemented ✅
  - Added InvoiceAdjustment model with type (discount/addition), category, calculation_type (percentage/fixed), base (before_tax/after_tax)
  - Backend: GET /api/invoice/adjustment-categories returns all categories
  - Backend: POST /api/invoice/ accepts adjustments array
  - Backend: calculate_invoice_totals includes adjustment calculations
  - Frontend: "Discounts & Additions" section in Create Invoice modal
  - Frontend: Add Discount (red) and Add Fee (green) buttons
  - Frontend: Real-time total calculation with Total Discounts and Total Additions display
  - Testing: 100% pass rate (13 backend tests, all frontend UI verified)

- **April 4, 2026 (Update 3)**: Multi-Currency Support Implemented ✅
  - Currency Management Page (CurrenciesPage.jsx)
  - 11 supported currencies with enable/disable
  - Exchange rates management with effective date
  - Currency converter modal
  - Currency selector in Create Invoice modal
  - Backend API: /api/invoice/config/currencies, /api/invoice/config/exchange-rates, /api/invoice/config/convert
  - Testing: 100% pass rate (18 backend tests, all frontend UI verified)

- **April 4, 2026 (Update 2)**: Added Invoice Reports System
  - Sales Report (group by date/customer/product)
  - Purchases Report (group by date/supplier/product)
  - VAT Report (output tax, input tax, net VAT, breakdown by rate)
  - Aging Report (receivables with 0-30, 31-60, 61-90, 90+ day buckets)
  - Excel export for all reports
  
- **April 4, 2026**: Implemented complete Electronic Invoicing system
  - Sales/Purchase Invoices
  - Quotations and Purchase Orders
  - Customer/Supplier Management
  - Product/Service Catalog
  - VAT calculations
  - PDF with QR Code
  - Automatic accounting journal entries
