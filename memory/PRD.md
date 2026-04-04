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

#### 4. Electronic Invoicing System (NEW - April 2026)
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

#### 5. UI/UX
- Dark/Light mode toggle
- RTL/LTR language support (Arabic/English)
- Responsive sidebar with sub-menus
- Application footer with branding
- Company logo placement

### In Progress 🔄
- None currently

### Upcoming Tasks 📋

#### P1 - High Priority
1. **Egyptian Tax Authority (ETA) API Integration**
   - Direct submission to ETA portal
   - Status tracking
   - Compliance reporting

2. **Email Notifications**
   - Invoice sent notifications
   - Payment reminders
   - Report generation alerts

#### P2 - Medium Priority
1. **Multi-currency Support**
   - Currency management
   - Exchange rate tracking
   - Multi-currency invoices

2. **Payment Terms Enhancement**
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
│   ├── invoice.py         # E-invoicing endpoints (NEW)
│   └── auth.py            # Authentication
├── models/
│   ├── accounting.py      # Accounting models
│   └── invoice.py         # Invoice models (NEW)
├── services/
│   ├── accounting_service.py
│   └── invoice_service.py # Invoice logic (NEW)
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
│   ├── InvoicesPage.jsx   # E-invoicing (NEW)
│   ├── PartiesPage.jsx    # Customers/Suppliers (NEW)
│   ├── ProductsPage.jsx   # Products catalog (NEW)
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
- invoices (NEW)
- parties (NEW)
- products (NEW)
- import_logs

### Key Dependencies
- Backend: FastAPI, PyMongo, ReportLab, QRCode, Pandas, XlsxWriter
- Frontend: React, Shadcn/UI, Lucide Icons, Sonner

## API Endpoints

### Invoicing (NEW)
```
POST   /api/invoice/                    # Create invoice
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

## Changelog
- **April 4, 2026**: Implemented complete Electronic Invoicing system
  - Sales/Purchase Invoices
  - Quotations and Purchase Orders
  - Customer/Supplier Management
  - Product/Service Catalog
  - VAT calculations
  - PDF with QR Code
  - Automatic accounting journal entries
