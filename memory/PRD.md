# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

## What's Been Implemented (Complete List)

### Core Features
- **Authentication**: Login, Registration, Password Reset, JWT tokens
- **User Management**: CRUD, Roles, Invitations
- **Company Management**: Multi-tenant architecture
- **Dashboard**: KPIs, Quick Actions, Analytics
- **Bilingual Support**: Arabic/English with RTL

### Modules
- **HR Module**: Employees, Salaries, Allowances, Deductions, Leave Management
- **Financial Module**: Journal Entries, Treasury, Bank, Custody, Customers, Suppliers
- **Inventory Module**: Stock tracking, Reports

### Reporting
- PDF/CSV/Excel Export
- Print functionality
- Advanced date filtering (year, quarter, month, custom)
- Period comparison

### Subscription System
- Stripe payment integration
- Activation codes system
- Multiple plans (Starter, Professional, Enterprise)

### Admin Dashboard
- Statistics overview
- Subscription management
- Activation codes management

---

## NEW FEATURES (February 7, 2026)

### 1. Real-time Notifications System ✅
- WebSocket support for real-time updates
- Multiple notification types
- Notification center UI with unread count badge
- Mark as read / Mark all as read
- Arabic/English support

### 2. Invoices System (Regular + E-Tax) ✅
- Full invoice management (CRUD)
- Tax calculation (14% VAT)
- Payment tracking
- Email sending
- Egyptian E-Tax support (simulated)

### 3. Customer Portal ✅
**Customer Side:**
- Customer login
- Dashboard with invoice statistics
- View invoices and payments
- Profile management

**Company Side:**
- Portal setup with unique code
- Invite customers
- Manage portal access

### 4. Purchases & Supplier Management ✅
**Purchase Orders:**
- Create purchase orders with multiple items
- Tax calculation (14%)
- Status workflow: Draft → Pending Approval → Approved → Ordered → Received
- Order cancellation
- Payment tracking

**Supplier Management:**
- Supplier CRUD
- Contact information
- Payment terms
- Category classification
- Order history per supplier

**Features:**
- Purchase statistics dashboard
- Status filtering
- Search functionality
- Top suppliers tracking

---

## API Endpoints Summary

### Notifications
- `GET/POST /api/notifications/`
- `PUT /api/notifications/{id}/read`
- `WS /api/notifications/ws/{user_id}`

### Invoices
- `GET/POST /api/invoices/`
- `GET /api/invoices/stats`
- `POST /api/invoices/{number}/etax/submit`

### Customer Portal
- `POST /api/customer-portal/login`
- `GET /api/customer-portal/dashboard`
- `GET /api/customer-portal/invoices`
- `POST /api/customer-portal/customers/invite`

### Purchases
- `GET/POST /api/purchases/suppliers`
- `PUT /api/purchases/suppliers/{id}`
- `GET/POST /api/purchases/orders`
- `PUT /api/purchases/orders/{po}/status`
- `DELETE /api/purchases/orders/{po}`
- `GET /api/purchases/stats`

---

## Test Credentials

### Company User
- Email: test@company.com
- Password: Test@123

### Portal Customer
- Email: customer@example.com
- Password: ZWU0KdwRNzti

### Production Admin
- Email: dalia@ddaadvertising.net
- Password: Dalia@2024

---

## Prioritized Backlog

### ✅ Completed (P0)
- [x] Real-time Notifications
- [x] Invoices System (Regular + E-Tax)
- [x] Customer Portal
- [x] Purchases & Supplier Management

### P1 - Next Priority
- [ ] Approval Workflows
- [ ] Attendance System (Clock-in/Clock-out)

### P2 - Medium Priority
- [ ] Project & Task Management
- [ ] Local Payment Gateways (Fawry, Paymob)
- [ ] Document Management System
- [ ] Google Calendar Integration

### P3 - Future Enhancements
- [ ] AI-powered Smart Reports
- [ ] Mobile App (PWA)
- [ ] External System Integrations
- [ ] Automatic Backup System
- [ ] Audit Trail System
- [ ] Customizable Dashboard
- [ ] Employee Performance Evaluation
- [ ] Bonuses and Incentives System
- [ ] Ticketing and Support System

### Deferred
- [ ] WhatsApp Integration (Twilio)

---

## Mocked Features
- **E-Tax Submission**: Simulated (requires ETA Portal registration)

---

## Frontend Routes
- `/` - Landing Page
- `/login` - Company User Login
- `/dashboard` - Main Dashboard
- `/customer-portal` - Customer Portal
- `/admin` - Admin Dashboard
- `/subscription` - Subscription Management

---

## Test Files
- `/app/backend/tests/test_customer_portal.py`
- `/app/backend/tests/test_purchases.py`
- `/app/test_reports/iteration_*.json`

---

*Last Updated: February 7, 2026*
