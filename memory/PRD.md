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

### NEW FEATURES (February 7, 2026)

1. **Real-time Notifications System**
   - WebSocket support for real-time updates
   - Multiple notification types (subscription, payment, inventory, leave, employee, report)
   - Notification center UI with unread count badge
   - Mark as read / Mark all as read
   - Delete notifications
   - Arabic/English support
   - Background tasks for subscription expiry alerts

2. **Invoices System (Regular + E-Tax)**
   - Full invoice management (create, read, update, delete)
   - Tax calculation (14% VAT - Egyptian standard)
   - Discount support per item
   - Payment tracking with multiple payment methods
   - Email sending via Resend
   - Invoice statistics dashboard

3. **Egyptian E-Tax (الفاتورة الإلكترونية المصرية)**
   - E-Tax invoice creation with unique UUID
   - Customer and Issuer Tax ID support
   - Simulated submission to Egyptian Tax Authority
   - E-Tax status tracking (pending, submitted)
   - E-Tax statistics dashboard
   - **Note**: Real integration requires ETA Portal registration and digital signature

---

## API Endpoints

### Notifications API
- `GET /api/notifications/` - Get all notifications
- `POST /api/notifications/` - Create notification
- `PUT /api/notifications/{id}/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/{id}` - Delete notification
- `DELETE /api/notifications/clear-all` - Clear read notifications
- `WS /api/notifications/ws/{user_id}` - WebSocket for real-time

### Invoices API
- `GET /api/invoices/` - Get all invoices
- `POST /api/invoices/` - Create invoice (regular or etax)
- `GET /api/invoices/stats` - Invoice statistics
- `GET /api/invoices/{number}` - Get single invoice
- `PUT /api/invoices/{number}` - Update invoice
- `PUT /api/invoices/{number}/status` - Update status
- `POST /api/invoices/{number}/payment` - Record payment
- `DELETE /api/invoices/{number}` - Cancel invoice
- `POST /api/invoices/{number}/send` - Send via email
- `GET /api/invoices/{number}/payments` - Payment history

### E-Tax API
- `POST /api/invoices/{number}/etax/submit` - Submit to E-Tax (MOCKED)
- `GET /api/invoices/{number}/etax/status` - E-Tax status
- `GET /api/invoices/etax/stats` - E-Tax statistics

---

## Third-Party Integrations
- Resend (Email)
- Stripe (Payments)
- recharts, xlsx, jspdf (Reports)

---

## Test Credentials
- Email: test@company.com
- Password: Test@123

## Production Credentials
- Email: dalia@ddaadvertising.net
- Password: Dalia@2024

---

## Prioritized Backlog (P0/P1/P2)

### P0 - Completed
- [x] Real-time Notifications
- [x] Invoices System (Regular + E-Tax)

### P1 - Next Priority
- [ ] Customer Portal
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

---

## Mocked/Simulated Features
- **E-Tax Submission**: The `/api/invoices/{number}/etax/submit` endpoint simulates submission to the Egyptian Tax Authority. Real integration requires:
  - ETA Portal registration
  - Digital signature (التوقيع الإلكتروني)
  - SDK integration
  - Tax Authority approval

---

*Last Updated: February 7, 2026*
