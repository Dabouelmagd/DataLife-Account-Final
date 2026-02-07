# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

---

## COMPLETED FEATURES (February 7, 2026)

### 1. Real-time Notifications System
- WebSocket support for real-time updates
- Multiple notification types
- Notification center UI with badge

### 2. Invoices System (Regular + E-Tax)
- Full invoice CRUD
- Tax calculation (14% VAT)
- Egyptian E-Tax support (SIMULATED - not connected to real government API)

### 3. Customer Portal
- Customer login & dashboard
- View invoices and payments
- Profile management

### 4. Purchases & Supplier Management
- Purchase orders with workflow
- Supplier CRUD
- Order tracking

### 5. Approval Workflows
- Multi-level approval chains
- Multiple request types
- Approval history

### 6. Real-time Sync
- WebSocket-based live updates
- Connection indicator ("Live" badge)
- Automatic reconnection

### 7. Attachments System
- Upload files to any entity
- All file types (max 10 MB)
- Preview images/PDFs
- Download/Delete

### 8. Attendance Management
- Check-in/Check-out with manual and QR methods
- Today's Attendance dashboard with real-time stats
- Employee Statistics: Total, Present, Absent, Late
- Reports: Date range reports with summaries
- Settings: Work start/end time, late threshold
- QR Code Generation for attendance
- Live Updates via WebSocket

### 9. Projects & Tasks Management
- Projects CRUD: Create, read, update, delete projects
- Tasks CRUD: Create, read, update, delete tasks
- Task Assignment: Assign tasks to team members
- Progress Tracking: Automatic progress calculation from completed tasks
- Status Management: Planning, In Progress, On Hold, Completed, Cancelled
- Priority Levels: Low, Medium, High, Urgent
- Task Comments: Add comments to tasks with user attribution
- My Tasks View: Personal task dashboard
- Dashboard Stats: Overview with overdue and due-this-week indicators
- Real-time Sync: Live updates across all connected clients

### 10. Document Management System (NEW - Feb 7, 2026) ✅
- **Folder System**: Create, rename, delete folders with custom colors
- **Document Upload**: Drag & drop upload with category and tags
- **Categories**: 8 predefined categories (Contracts, Invoices, HR, Financial, Legal, Policies, Reports, Other)
- **Search & Filter**: Full-text search, filter by category/type
- **View Modes**: Grid and List view toggle
- **Document Actions**: Download, preview, delete (soft/permanent)
- **Stats Dashboard**: Total documents, total size, folders count, recent uploads
- **File Types**: Supports all file types with automatic type detection
- **Breadcrumb Navigation**: Navigate folder hierarchy easily

### 11. Automatic Task Notifications (NEW - Feb 7, 2026) ✅
- **Due Soon Alerts**: Notifications for tasks due today, tomorrow, or within 3 days
- **Overdue Tracking**: List of overdue tasks sorted by due date
- **Automatic Notifications**: System creates notifications for upcoming deadlines
- **Notification Types**: 
  - `task_due` - Task due soon (amber)
  - `task_overdue` - Task overdue (red)
  - `task_assigned` - New task assigned (blue)
  - `project_update` - Project updates (purple)
  - `document_shared` - Document sharing (blue)

---

## Key API Endpoints

### Documents
- `GET /api/documents/` - List documents (with filters)
- `GET /api/documents/categories` - Get 8 categories
- `GET /api/documents/stats` - Get statistics
- `GET /api/documents/{id}` - Get single document
- `GET /api/documents/{id}/download` - Download file
- `POST /api/documents/upload` - Upload document
- `DELETE /api/documents/{id}` - Archive document
- `DELETE /api/documents/{id}?permanent=true` - Permanent delete
- `POST /api/documents/folders` - Create folder
- `GET /api/documents/folders` - List folders
- `PUT /api/documents/folders/{id}` - Update folder
- `DELETE /api/documents/folders/{id}` - Delete folder

### Task Notifications
- `GET /api/tasks/notifications/due-soon` - Tasks due within 3 days
- `GET /api/tasks/notifications/overdue` - Overdue tasks
- `POST /api/tasks/notifications/check-and-send` - Create notifications

---

## Test Credentials

### Production Admin
- Email: dalia@ddaadvertising.net
- Password: Dalia@2024

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Real-time Notifications
- [x] Invoices System (Regular + E-Tax)
- [x] Customer Portal
- [x] Purchases & Supplier Management
- [x] Approval Workflows
- [x] Real-time Sync across devices
- [x] Attachments System
- [x] Attendance Management
- [x] Projects & Tasks Management
- [x] Document Management System
- [x] Automatic Task Notifications

### P1 - Next Priority
- [ ] WhatsApp Integration (Twilio) - Deferred by user

### P2 - Medium Priority
- [ ] Local Payment Gateways (Fawry, Paymob)
- [ ] Google Calendar Integration
- [ ] Email Integration (Invoice sending)

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

## Known Issues & Mocked Features

### Mocked/Simulated
- **E-Tax Invoice Submission**: The `/invoices/e-tax-submit` endpoint is a placeholder and does not connect to Egypt's real E-Tax API

### Fixed Issues (Feb 7, 2026)
- Employee name "Unknown" in attendance records - Fixed by using correct field name `name`
- Task comment user_name "Unknown" - Fixed by fetching from database
- Documents route ordering - `/stats` now correctly matched before `/{id}`
- Documents upload Form params - Category and tags now received correctly
- Documents delete logic - Proper error handling for soft vs permanent delete

---

## Architecture Notes

### Backend
- FastAPI with async MongoDB (Motor)
- JWT authentication
- WebSocket for real-time updates
- File storage in local filesystem

### Frontend
- React with Tailwind CSS + Shadcn UI
- Context API for state management (Auth, Language)
- Custom hooks for real-time sync

### Database Collections
- users, companies, employees, projects, tasks
- attendance, notifications, invoices
- documents, folders, attachments

---

## Test Reports
- `/app/test_reports/iteration_6.json` - Projects & Tasks + Attendance
- `/app/test_reports/iteration_7.json` - Documents + Task Notifications

---

*Last Updated: February 7, 2026*
