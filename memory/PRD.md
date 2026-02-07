# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

---

## Session Updates (February 2026 - Current Session)

### ✅ COMPLETED IN THIS SESSION:

#### 0. Super Admin - User Permissions Editor (NEW - Feb 7, 2026)
- **Backend API Endpoints**:
  - `GET /api/admin/permissions` - Returns all 10 available permissions
  - `PUT /api/admin/users/{user_id}/permissions` - Updates user permissions
  - `GET /api/admin/all-users` - Returns all users from all companies
  - `PUT /api/users/{user_id}/permissions` - For company managers to update their employees
- **Frontend Features**:
  - 🛡️ Shield icon button in Company Users table for editing permissions
  - 📋 Modal with all available permissions as clickable cards/checkboxes
  - ✅ Select All / Deselect All buttons
  - 💾 Save Permissions button with success toast notification
  - 📊 Permission count display (Selected X of Y)
- **Available Permissions**:
  - Dashboard, HR, Financial, Invoices, Purchases
  - Projects, Analytics, Settings, User Management, Approvals
- **Files Modified**:
  - `/app/backend/api/admin.py` - Added permissions and all-users endpoints
  - `/app/backend/api/users.py` - Added permissions update for managers
  - `/app/frontend/src/components/AdminDashboard.jsx` - Added permissions UI
- **Test Status**: ✅ All tests passed (Backend 100%, Frontend 100%)

#### 1. All Users Tab in Admin Dashboard (NEW - Feb 7, 2026)
- **New Tab**: "All Users" tab in Super Admin dashboard
- **Features**:
  - Shows ALL users from ALL companies (69+ users)
  - Search functionality (by name, email, company, role)
  - User count display
  - Edit permissions button (Shield icon) for each user
  - Shows user status (Active/Suspended)
  - Shows permissions count for each user
- **Files Modified**:
  - `/app/frontend/src/components/AdminDashboard.jsx`
- **Test Status**: ✅ Working

#### 2. Language Switcher in App (NEW - Feb 7, 2026)
- **Sidebar**: Added "Change Language" button with globe icon
  - Shows current language toggle (EN/عربي)
  - One-click language switch
- **Settings Page**: New "Language" tab with visual language selection
  - Card-based UI for Arabic/English selection
  - Shows current language indicator
  - Auto-saves preference
- **Files Modified**:
  - `/app/frontend/src/components/ModernSidebar.jsx`
  - `/app/frontend/src/components/CompanySettings.jsx`
- **Test Status**: ✅ Working

#### 3. Company Manager - Edit Employee Permissions (NEW - Feb 7, 2026)
- **New API**: `PUT /api/users/{user_id}/permissions`
- **Permission**: Only company managers (General Manager, CEO, Board Chairman) can edit
- **Company Isolation**: Managers can only edit users in their own company
- **UI**: Shield icon in UserManagement.jsx with Modal
- **Files Modified**:
  - `/app/backend/api/users.py`
  - `/app/frontend/src/components/UserManagement.jsx`
- **Test Status**: ✅ Backend tested, Frontend UI added

---

## Previous Session Updates (December 2025)

#### 1. Features Guide Page - Bilingual Support (NEW)
- **Language Toggle Button**: Added a prominent button in the header to switch between Arabic and English
- **Full Arabic Translation**: Complete Arabic content for all sections
- **Full English Translation**: Complete English content for all sections
- **RTL/LTR Support**: Dynamic direction change based on selected language
- **Sections Translated**:
  - System Overview
  - Main Modules (6 modules)
  - HR Module Details
  - Financial Module Details
  - Projects Module Details
  - Reports & Export
  - Admin Control Panel
  - Permissions System
  - How to Use (5 steps)
  - Technical Specifications
  - CTA Section
  - Footer

#### 2. FAQ Section Added to Landing Page (NEW)
- **8 Frequently Asked Questions**: Comprehensive Q&A section
- **Bilingual Content**: Both Arabic and English versions
- **Accordion UI**: Expandable questions with smooth animations
- **🔍 Search Feature**: Real-time search to filter questions
  - Search in both questions and answers
  - Shows result count when searching
  - Clear search button (X)
  - "No results found" message with clear button
- **Contact CTA**: "Didn't find your answer?" section with contact button
- **Questions Covered**:
  - What is DataLife ERP?
  - Can I try the system before purchasing?
  - How is data stored and is it secure?
  - Can I add multiple users?
  - Does the system support Arabic?
  - How can I get technical support?
  - Can I export data and reports?
  - What payment methods are available?

#### 3. AI Support Chatbot (NEW)
- **AI-Powered**: Uses OpenAI GPT-5.2 via Emergent Universal Key
- **Floating Widget**: Appears on all pages in bottom-right corner
- **Bilingual Support**: Works in Arabic and English
- **Features**:
  - 🤖 Intelligent AI responses about DataLife ERP
  - 💬 Real-time chat with typing indicator
  - 🗑️ Clear chat history
  - 📧 Email chat transcript to user
  - 👤 Request human support (creates support ticket)
  - ⬆️ Minimize/maximize chat window
- **Backend API Endpoints**:
  - POST `/api/chatbot/send` - Send message and get AI response
  - GET `/api/chatbot/history/{session_id}` - Get chat history
  - POST `/api/chatbot/email-transcript` - Email conversation
  - POST `/api/chatbot/request-human-support` - Create support ticket
  - DELETE `/api/chatbot/session/{session_id}` - Clear session
- **Files Created**:
  - `/app/backend/api/chatbot.py` - Backend API
  - `/app/frontend/src/components/SupportChatbot.jsx` - Frontend component

#### 4. Push Notifications System (VERIFIED EXISTING)
- **Already Implemented**: Full notification system with WebSocket support
- **Features**:
  - 🔔 Real-time notifications via WebSocket
  - 📱 Browser push notifications (with permission request)
  - 📋 Notification types: tasks, leaves, payments, reports, etc.
  - ✅ Mark as read / Mark all as read
  - 🗑️ Delete notifications
  - 🔢 Unread count badge on bell icon
- **Components**:
  - `/app/frontend/src/components/NotificationCenter.jsx` - Notification dropdown
  - `/app/frontend/src/components/NotificationPermissionRequest.jsx` - Permission banner (NEW)
  - `/app/backend/api/notifications.py` - Backend API with WebSocket
- **Integration**: Already integrated in ModernSidebar and RealDashboard

---

## Previous Session Completions

### Session 3 (February 7, 2026):
- ✅ Subscription Code Display (3 locations)
- ✅ Permission Icons with Colors (green/red)
- ✅ Print Excludes Sidebar
- ✅ All Print/Export Functions
- ✅ Advanced Permissions Management System
- ✅ Super Admin Control Panel
- ✅ Comprehensive Settings Page
- ✅ Features Guide Page (Arabic only - now bilingual)
- ✅ Homepage Updates with new features sections
- ✅ Video Modal in Hero section

---

## Key Files Modified

### Current Session:
- `/app/frontend/src/components/FeaturesPage.jsx` - Added bilingual support with language toggle
- `/app/frontend/src/components/LandingPage.jsx` - Added FAQ section with bilingual content

### Previous Sessions:
- `/app/frontend/src/components/LoginPage.jsx`
- `/app/frontend/src/components/CompanyRegistrationPage.jsx`
- `/app/frontend/src/components/ModernSidebar.jsx`
- `/app/frontend/src/index.css`
- `/app/backend/models/user.py`
- `/app/backend/services/user_service.py`

---

## Test Credentials

### Super Admin (Full System Access)
- **URL Path**: `/login` then navigate to `/admin`
- **Email**: superadmin@datalife.com
- **Password**: Admin@2024
- **Role**: Super Admin
- **Permissions**: All permissions

### Test User (Financial Manager)
- Email: finance.20251010_154022@company.com
- Password: password123

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] All core ERP modules
- [x] Print/Export for all major modules
- [x] Modern Sidebar redesign
- [x] Subscription code display
- [x] Permission icons with colors
- [x] Print excludes sidebar
- [x] Settings page with full content
- [x] User Permissions Management System
- [x] Super Admin Control Panel
- [x] Features Guide Page (Bilingual)
- [x] FAQ Section on Landing Page
- [x] Video Modal in Hero section
- [x] **Super Admin - User Permissions Editor** (Feb 2026)

### P1 - Future Enhancements
- [ ] WhatsApp Integration (Twilio)
- [ ] Local Payment Gateways
- [ ] Dark mode toggle
- [ ] Actual video content for video modal
- [ ] Email integration for chatbot transcripts (SendGrid/SMTP)

### P2 - Backlog
- [ ] Custom themes
- [ ] Advanced reporting
- [ ] Email notifications

---

*Last Updated: February 7, 2026*
