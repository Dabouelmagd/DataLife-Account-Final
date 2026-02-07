# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support. Key features include HR, Financials, Inventory Management modules, Analytics dashboard, User Management, Authentication, Reporting, and Subscriptions.

## Core Requirements
- Multi-tenant architecture with company isolation
- Bilingual support (Arabic/English) with RTL
- Role-based access control
- Financial reporting with export capabilities
- HR management with payroll
- Inventory tracking
- Subscription management with activation codes

---

## What's Been Implemented

### Authentication & User Management ✅
- Company registration with owner setup
- User login with JWT tokens
- Password reset flow (via Resend email)
- User invitation system
- Role management (General Manager, HR Manager, Financial Manager, etc.)

### Dashboard & Analytics ✅
- Real-time KPI cards
- Quick actions panel
- Recent activity tracking
- Upcoming tasks
- Multi-language support (EN/AR)

### HR Module ✅
- Employee management
- Salaries, Allowances, Deductions
- Leave management (Casual, Annual)
- Attendance tracking
- HR Reports with export

### Financial Module ✅
- Journal entries
- Treasury, Bank, Custody management
- Customers & Suppliers
- Accounts management
- Financial Reports with export

### Inventory Module ✅
- Stock tracking
- Inventory reports

### Reporting System ✅
- PDF/CSV/Excel export
- Print functionality
- Analytics visualization with charts
- **NEW** Advanced date filtering for financial reports (year, quarter, month, custom range)
- **NEW** Period comparison functionality
- **NEW** Monthly breakdown analysis

### Subscription System ✅
- Backend API for plans and activation codes
- **NEW** Frontend UI for subscriptions (`/subscription` route)
- **NEW** Stripe payment integration (fully functional)
- **NEW** Payment success page with polling
- Pricing for Starter, Professional, Enterprise plans
- Individual module packages (HR, Financial, Inventory)
- Duration options (3, 6, 9, 12 months, lifetime)
- Activation code validation

### Translation System ✅
- **FIXED** Demo section translations for EN and AR
- All KPIs, Quick Actions, Recent Activity properly translated

---

## Prioritized Backlog

### P0 - Critical
- [BLOCKED] Production deployment - requires user to click "Redeploy"
- [BLOCKED] Production database user migration (password_hash consistency)

### P1 - High Priority
- Date filtering for financial reports (UI added, needs backend wiring)

### P2 - Medium Priority
- Remove console.log statements from frontend
- Production database data migration script

### P3 - Low Priority
- Additional analytics features
- Enhanced reporting filters

---

## Technical Architecture

```
/app
├── backend/
│   ├── api/
│   │   ├── auth.py         - Authentication endpoints
│   │   ├── users.py        - User management
│   │   ├── subscriptions.py - Subscription management
│   │   └── ...
│   ├── models/
│   │   ├── user.py
│   │   ├── company.py
│   │   └── subscription.py
│   └── services/
│       ├── auth_service.py
│       └── user_service.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RealDashboard.jsx
│   │   │   ├── SubscriptionPage.jsx  # NEW
│   │   │   ├── FinancialSubModules.jsx
│   │   │   └── ...
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   └── LanguageContext.jsx
│   │   └── data/
│   │       └── translations.js  # FIXED
│   └── .env
└── memory/
    └── PRD.md
```

---

## Database Schema

### users
- id, email, password_hash, full_name, role, company_id, is_active

### companies
- id, name, owner_id, subscription_plan, subscription_status

### subscriptions
- id, user_id, company_id, plan, duration, status, start_date, end_date, amount_paid

### activation_codes
- id, code, plan, duration, discount_percent, max_uses, current_uses, is_active

---

## Third-Party Integrations
- **Resend** - Email delivery (password reset, invitations)
- **Stripe** - Payment processing (fully integrated)
- **recharts** - Data visualization
- **xlsx** - Excel export
- **jspdf** - PDF generation
- **emergentintegrations** - Stripe checkout library

---

## Test Credentials
- Email: test@company.com
- Password: Test@123
- Role: General Manager

---

## Known Issues
1. Production site needs Redeploy to apply latest fixes
2. Production database may have password field inconsistency
3. Some console.log statements remain in frontend code

---

*Last Updated: February 6, 2026*
