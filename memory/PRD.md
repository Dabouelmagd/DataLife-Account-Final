# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

---

## Session Updates (February 2026)

### ✅ COMPLETED AND VERIFIED (Feb 7, 2026)

#### 1. User Permissions Management
- **Three roles can edit employee permissions**: 
  - رئيس مجلس الإدارة (Board Chairman)
  - المدير العام (General Manager) 
  - المدير التنفيذي (CEO)
- **API Endpoint**: `PUT /api/users/{user_id}/permissions`
- **Available Permissions** (10 total):
  - Dashboard, HR, Financial, Invoices, Purchases
  - Projects, Analytics, Settings, User Management, Approvals
- **Test Status**: ✅ All tests passed

#### 2. Language Switcher Implementation
- **Location 1**: ModernSidebar.jsx - Toggle button with globe icon
- **Location 2**: LandingPage.jsx - Header navigation
- **Location 3**: CompanySettings.jsx - Dedicated Language tab
- **Features**: One-click toggle EN/AR, RTL layout auto-adjustment
- **Test Status**: ✅ Working in all locations

#### 3. Super Admin Dashboard
- **Route**: `/admin` (standalone admin panel)
- **Auto-redirect**: Super Admin users redirect to /admin on login
- **Tabs**: Overview, Subscriptions, Transactions, Activation Codes, Companies, All Users, Messages
- **Test Status**: ✅ Working

#### 4. Contact Form & Messages
- **Landing Page**: Contact form with SMTP email integration
- **Admin Panel**: Messages tab with unread notifications
- **Test Status**: ✅ Working

---

## Test Credentials

| Role | Email | Password | Redirects To |
|------|-------|----------|--------------|
| Super Admin | superadmin@datalife.com | Admin@2024 | /admin |
| Board Chairman | chairman@datalife.com | Admin@2024 | /dashboard |
| General Manager | manager@datalife.com | Admin@2024 | /dashboard |
| CEO | ceo@datalife.com | Admin@2024 | /dashboard |
| Employee | employee@datalife.com | Admin@2024 | /dashboard |

---

## Key Files Reference

### Frontend
- `/app/frontend/src/components/UserManagement.jsx` - User & permissions management
- `/app/frontend/src/components/ModernSidebar.jsx` - Sidebar with language switcher
- `/app/frontend/src/components/CompanySettings.jsx` - Settings with language tab
- `/app/frontend/src/components/AdminDashboard.jsx` - Super Admin panel
- `/app/frontend/src/components/LandingPage.jsx` - Landing page with contact form

### Backend
- `/app/backend/api/users.py` - User management & permissions API
- `/app/backend/api/admin.py` - Admin panel APIs
- `/app/backend/api/contact.py` - Contact form API
- `/app/backend/models/permission.py` - Role permissions definitions

---

## Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| GET | /api/users/ | List company users |
| PUT | /api/users/{id}/permissions | Update user permissions |
| GET | /api/admin/all-users | List all users (admin) |
| GET | /api/admin/messages | Get contact messages |
| POST | /api/contact/send | Submit contact form |

---

## Technical Stack
- **Frontend**: React 18, Vite, TailwindCSS, Shadcn/UI
- **Backend**: Python, FastAPI
- **Database**: MongoDB
- **Authentication**: JWT

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] User authentication & authorization
- [x] Role-based permissions system
- [x] Super Admin control panel
- [x] Language switcher (Sidebar, Header, Settings)
- [x] User management page
- [x] Contact form with SMTP
- [x] Messages management

### P1 - Future Enhancements
- [ ] WhatsApp Integration
- [ ] Dark mode toggle
- [ ] Advanced reporting
- [ ] Email notifications

---

## Test Reports
- Latest: `/app/test_reports/iteration_12.json`
- Backend: 91% (20/22 tests passed)
- Frontend: 100% (all UI flows working)

---

*Last Updated: February 7, 2026*
