# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

---

## ✅ COMPLETED FEATURES (February 7, 2026)

### 1. Real-time Notifications System
- WebSocket support
- Multiple notification types
- Notification center UI
- Mark as read functionality

### 2. Invoices System (Regular + E-Tax)
- Full invoice management
- Tax calculation (14% VAT)
- Payment tracking
- Egyptian E-Tax support (simulated)

### 3. Customer Portal
- Customer login & dashboard
- View invoices and payments
- Profile management
- Company-side portal management

### 4. Purchases & Supplier Management
- Purchase orders with status workflow
- Supplier CRUD
- Tax calculation
- Order tracking

### 5. Approval Workflows
- Multi-level approval chains
- Multiple request types (expense, leave, PO, invoice, salary, document)
- Status tracking
- Approval history

### 6. Real-time Sync (NEW)
- **WebSocket-based live updates** across all devices
- Connection indicator showing "Live" status
- Automatic reconnection on disconnect
- Updates for: Invoices, Purchases, Approvals

### 7. Attachments System (NEW)
- **Upload files to any entity** (invoices, approvals, purchase orders)
- **All file types supported**
- **Max file size: 10 MB**
- Drag & drop upload
- File preview (images, PDFs)
- Download functionality
- Delete attachments

---

## Key API Endpoints

### Attachments
- `POST /api/attachments/upload` - Upload file (multipart/form-data)
- `GET /api/attachments/entity/{type}/{id}` - Get entity attachments
- `GET /api/attachments/{id}/download` - Download file
- `DELETE /api/attachments/{id}` - Delete attachment

### Real-time Sync
- `WS /api/attachments/ws/sync/{company_id}` - WebSocket for live updates

---

## Test Credentials

### Company User
- Email: test@company.com
- Password: Test@123

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
- [x] Approval Workflows
- [x] Real-time Sync across devices
- [x] Attachments System

### P1 - Next Priority
- [ ] Attendance System (Clock-in/Clock-out)
- [ ] Project & Task Management

### P2 - Medium Priority
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

## Architecture Notes

### Real-time Sync
- WebSocket connection per company
- Broadcast updates to all connected clients
- Automatic reconnection with exponential backoff
- Ping/pong keep-alive every 30 seconds

### Attachments Storage
- Files stored as Base64 in MongoDB (development)
- Production recommendation: Use S3 or cloud storage
- File metadata stored separately from content
- Content-type detection using mimetypes

---

*Last Updated: February 7, 2026*
