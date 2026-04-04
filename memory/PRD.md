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

#### 9. UI/UX
- Dark/Light mode toggle
- RTL/LTR language support (Arabic/English)
- Responsive sidebar with sub-menus
- Application footer with branding
- Company logo placement

### Upcoming Tasks 📋

#### P1 - High Priority
1. **Egyptian Tax Authority (ETA) API Integration**
   - Direct submission to ETA portal
   - Status tracking
   - Compliance reporting
   - **NOTE:** Must use `integration_playbook_expert_v2` for this integration

2. **Email Notifications**
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
