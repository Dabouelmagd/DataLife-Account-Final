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
- **Bug Fixed**: Employee names now display correctly (was showing "Unknown")

### 9. Projects & Tasks Management (NEW - Feb 7, 2026)
- **Projects CRUD**: Create, read, update, delete projects
- **Tasks CRUD**: Create, read, update, delete tasks
- **Task Assignment**: Assign tasks to team members
- **Progress Tracking**: Automatic progress calculation from completed tasks
- **Status Management**: Planning, In Progress, On Hold, Completed, Cancelled
- **Priority Levels**: Low, Medium, High, Urgent
- **Task Comments**: Add comments to tasks with user attribution
- **My Tasks View**: Personal task dashboard
- **Dashboard Stats**: Overview with overdue and due-this-week indicators
- **Real-time Sync**: Live updates across all connected clients
- **Kanban-style View**: Tasks grouped by status

---

## Key API Endpoints

### Attendance
- `POST /api/attendance/check-in` - Employee check-in
- `POST /api/attendance/check-out` - Employee check-out
- `GET /api/attendance/today` - Today's attendance
- `GET /api/attendance/report` - Attendance report
- `GET /api/attendance/settings` - Get settings
- `PUT /api/attendance/settings` - Update settings
- `POST /api/attendance/qr/generate` - Generate QR code

### Projects & Tasks
- `POST /api/tasks/projects` - Create project
- `GET /api/tasks/projects` - List projects
- `GET /api/tasks/projects/{id}` - Get project with tasks
- `PUT /api/tasks/projects/{id}` - Update project
- `DELETE /api/tasks/projects/{id}` - Delete project
- `POST /api/tasks/` - Create task
- `GET /api/tasks/` - List tasks
- `GET /api/tasks/{id}` - Get task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/my-tasks` - Get user's tasks
- `GET /api/tasks/dashboard/stats` - Get dashboard stats
- `POST /api/tasks/{id}/comments` - Add comment to task

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

### P0 - Completed
- [x] Real-time Notifications
- [x] Invoices System (Regular + E-Tax)
- [x] Customer Portal
- [x] Purchases & Supplier Management
- [x] Approval Workflows
- [x] Real-time Sync across devices
- [x] Attachments System
- [x] Attendance Management
- [x] Projects & Tasks Management

### P1 - Next Priority
- [ ] WhatsApp Integration (Twilio) - Deferred by user

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

---

## Known Issues & Mocked Features

### Mocked/Simulated
- **E-Tax Invoice Submission**: The `/invoices/e-tax-submit` endpoint is a placeholder and does not connect to Egypt's real E-Tax API

### Fixed Issues (Feb 7, 2026)
- Employee name "Unknown" in attendance records - Fixed by using correct field name `name` instead of `full_name`
- Task comment user_name "Unknown" - Fixed by fetching user full_name from database

---

## Architecture Notes

### Backend
- FastAPI with async MongoDB (Motor)
- JWT authentication
- WebSocket for real-time updates

### Frontend
- React with Tailwind CSS + Shadcn UI
- Context API for state management (Auth, Language)
- Custom hooks for real-time sync

### Database
- MongoDB with collections: users, companies, employees, projects, tasks, attendance, notifications, invoices, etc.

---

*Last Updated: February 7, 2026*
