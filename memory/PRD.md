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
- Multiple durations (3, 6, 9, 12 months, lifetime)

### Admin Dashboard
- Statistics overview
- Subscription management
- Activation codes management
- Company management

---

## NEW FEATURES (February 7, 2026)

### 1. Real-time Notifications System ✅
- WebSocket support for real-time updates
- Multiple notification types (subscription, payment, inventory, leave, employee, report)
- Notification center UI with unread count badge
- Mark as read / Mark all as read
- Delete notifications
- Arabic/English support
- Background tasks for subscription expiry alerts

### 2. Invoices System (Regular + E-Tax) ✅
- Full invoice management (create, read, update, delete)
- Tax calculation (14% VAT - Egyptian standard)
- Discount support per item
- Payment tracking with multiple payment methods
- Email sending via Resend
- Invoice statistics dashboard

### 3. Egyptian E-Tax (الفاتورة الإلكترونية المصرية) ✅
- E-Tax invoice creation with unique UUID
- Customer and Issuer Tax ID support
- Simulated submission to Egyptian Tax Authority
- E-Tax status tracking (pending, submitted)
- E-Tax statistics dashboard
- **Note**: Real integration requires ETA Portal registration and digital signature

### 4. Customer Portal ✅
**Customer Side:**
- Customer login with email/password
- Dashboard with invoice statistics (total, paid, pending)
- View all invoices and their details
- View payment history
- Profile management (update info, change password)

**Company Side:**
- Portal setup with unique portal code
- Invite customers via email with temporary password
- View all portal customers
- Enable/Disable customer access
- Copy portal URL and code

---

## API Endpoints

### Notifications API
- `GET /api/notifications/` - Get all notifications
- `POST /api/notifications/` - Create notification
- `PUT /api/notifications/{id}/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/{id}` - Delete notification
- `WS /api/notifications/ws/{user_id}` - WebSocket

### Invoices API
- `GET /api/invoices/` - Get all invoices
- `POST /api/invoices/` - Create invoice
- `GET /api/invoices/stats` - Invoice statistics
- `GET /api/invoices/{number}` - Get single invoice
- `PUT /api/invoices/{number}/status` - Update status
- `POST /api/invoices/{number}/payment` - Record payment
- `POST /api/invoices/{number}/send` - Send via email

### E-Tax API
- `POST /api/invoices/{number}/etax/submit` - Submit to E-Tax (MOCKED)
- `GET /api/invoices/{number}/etax/status` - E-Tax status
- `GET /api/invoices/etax/stats` - E-Tax statistics

### Customer Portal API
- `POST /api/customer-portal/login` - Customer login
- `GET /api/customer-portal/dashboard` - Dashboard data
- `GET /api/customer-portal/invoices` - Customer invoices
- `GET /api/customer-portal/payments` - Customer payments
- `GET /api/customer-portal/profile` - Get profile
- `PUT /api/customer-portal/profile` - Update profile
- `PUT /api/customer-portal/change-password` - Change password
- `POST /api/customer-portal/setup-portal` - Setup portal (company)
- `GET /api/customer-portal/customers` - List customers (company)
- `POST /api/customer-portal/customers/invite` - Invite customer
- `PUT /api/customer-portal/customers/{id}/toggle` - Toggle access

---

## Third-Party Integrations
- Resend (Email)
- Stripe (Payments)
- recharts, xlsx, jspdf (Reports)

---

## Test Credentials

### Company User
- Email: test@company.com
- Password: Test@123

### Portal Customer
- Email: customer@example.com
- Password: ZWU0KdwRNzti (temporary)

### Production Admin
- Email: dalia@ddaadvertising.net
- Password: Dalia@2024

---

## Prioritized Backlog (P0/P1/P2)

### ✅ Completed (P0)
- [x] Real-time Notifications
- [x] Invoices System (Regular + E-Tax)
- [x] Customer Portal

### P1 - Next Priority
- [ ] Purchasing & Supplier System
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
- [ ] WhatsApp Integration (Twilio) - User deferred

---

## Mocked/Simulated Features
- **E-Tax Submission**: Simulated - requires ETA Portal registration and digital signature

---

## Frontend Routes
- `/` - Landing Page
- `/login` - Company User Login
- `/dashboard` - Main Dashboard
- `/customer-portal` - Customer Portal (separate auth)
- `/admin` - Admin Dashboard
- `/subscription` - Subscription Management

---

*Last Updated: February 7, 2026*
