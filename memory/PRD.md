# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

---

## Session Updates (February 2026)

### ✅ COMPLETED AND VERIFIED (May 13, 2026 - Session 2)

#### 17. Email Notifications + Trial Countdown Banner
- **Request**: Email manager on new join request, email employee on approval, and add Trial Countdown banner.
- **Implementation**:
  - **`auth.py / join-by-code`**: triggers `_notify_managers_of_join_request` (async task) — emails the company contact_email + all admin-role users (General Manager, CEO, Board Chairman, Arabic equivalents, Super Admin) via Resend. RTL Arabic HTML with "مراجعة الطلب" CTA.
  - **`users.py / approve`**: triggers `_notify_user_approved` — emails the approved user in Arabic with "تسجيل الدخول الآن" CTA.
  - Both calls are fire-and-forget via `asyncio.create_task` so the API does not block.
  - **Trial Countdown Banner** (`TrialCountdownBanner.jsx`):
    - Reads `trial` info from `PlanContext` (added in plan-modules endpoint).
    - Shows days remaining; switches between indigo/orange/red gradient based on state (normal / urgent ≤3 days / expired).
    - Buttons: **Upgrade Now** → `/subscription`, **X** → dismiss (saved in sessionStorage).
    - Hidden for non-trial plans.
  - Backend `GET /api/companies/{id}/plan-modules` now returns `trial: {is_trial, trial_ends_at, days_remaining, expired}`.
- **Test Status**:
  - Backend: ✅ Endpoint returns trial info correctly (verified at days=14, days=2, days=0).
  - Frontend: ✅ Visual verification of 3 states — normal (indigo), urgent 1-day (orange), expired (red).

### ✅ COMPLETED AND VERIFIED (May 13, 2026)

#### 16. Plan-Based Feature Gating + Self-Join + Update Popup + Super Admin Fix
- **Request**: gate modules by plan, self-join by code, update popup, link Super Admin to admin role.
- **Implementation**:
  - **Super Admin role**: added to `ROLE_PERMISSIONS` with full module/permission access (matching Enterprise).
  - **PLAN_MODULES mapping** in `backend/models/plan_modules.py`:
    - Starter → dashboard, hr, financial, reports, settings
    - Professional → +inventory, invoices, purchases, analytics, projects
    - Enterprise → all modules
    - HR-Only / Financial-Only / Inventory-Only / Lifetime / Trial → custom sets
  - **`GET /api/companies/{id}/plan-modules`** returns plan + allowed modules + label.
  - **Sidebar (`ModernSidebar.jsx`)**: shows current-plan badge; modules not in plan are grayed out with 🔒 icon; clicking shows a toast with "Upgrade Plan" CTA (Sonner). Sub-modules are hidden for locked items.
  - **Self-join by subscription code**:
    - `POST /api/auth/join-by-code` creates a user with `pending_approval=True`, `is_active=False`.
    - New page `JoinCompanyPage.jsx` at `/join-company` with full RTL/LTR support.
    - Link added on `LoginPage` (green CTA "Join as Employee").
    - Login blocks pending users with proper Arabic message until approval.
  - **Pending approvals UI** in `EmployeesTab.jsx`:
    - New amber card "Pending Join Requests" with approve/reject actions.
    - `GET /api/users/pending`, `POST /api/users/{id}/approve`, `POST /api/users/{id}/reject`.
    - Manager can still edit permissions/role after approval from the existing Edit button.
  - **UpdateNotificationPopup** (`UpdateNotificationPopup.jsx`):
    - Shows a gradient popup in the corner when `REACT_APP_VERSION` differs from `localStorage.datalife_last_seen_version`.
    - Buttons: Reload (refreshes page) / Later (dismisses + saves version).
- **Test Status**:
  - Backend: ✅ join-by-code (HTTP 200), wrong code (404), pending login (403 with Arabic msg), pending list, approve & re-login (200), reject.
  - Backend: ✅ plan-modules endpoint returns correct modules per plan.
  - Frontend: ✅ visual verification — join page, locked modules with lock icon, "Upgrade Plan" toast on click, pending approvals card with approve/reject buttons, update popup.

### ✅ COMPLETED AND VERIFIED (May 13, 2026)

#### 15. Change Password & Delete Employee in Settings
- **Request**: Add change password and delete employee features in Settings
- **Implementation**:
  - `POST /api/auth/change-password` (requires current password verification)
  - `ProfileTab.jsx`: New "Change Password" card with show/hide toggles & validation
  - `EmployeesTab.jsx`: Red trash icon next to each employee (hidden for current user)
  - `CompanySettings.jsx`: wired `handleDeleteEmployee` with optimistic UI update
  - Employee list filters out deactivated users (`is_active === false`)
- **Test Status**:
  - Backend: ✅ Verified via curl (login → change-password → re-login with new pwd → revert)
  - Backend: ✅ Verified delete (invite → DELETE /api/users/{id} → 200 OK)
  - Frontend: ✅ Visual verification of both tabs (Profile + Employees)

### ✅ COMPLETED AND VERIFIED (Feb 25, 2026)

#### 14. Page Footer with Branding
- **Request**: Move DataLife logos from sidebar to page footer
- **Implementation**:
  - Created `AppFooter.jsx` component
  - Footer at bottom of all pages (not sidebar)
  - Left side: DataLife Account logo + description + copyright
  - Center: "POWERED BY" divider
  - Right side: DataLife AI logo + description
  - Full Arabic/English support with RTL
- **Footer Content**:
  - **English**: "Enterprise Resource Planning" / "DataLife AI" / "Smart Business Solutions"
  - **Arabic**: "نظام إدارة الموارد" / "داتا لايف للذكاء الاصطناعي" / "حلول ذكية للأعمال"
- **Test Status**: ✅ Visual verification complete

---

### ✅ Previously Completed (Feb 25, 2026)

#### 8-13. Data Import & UI Features
- Data Import from Excel/CSV
- Import buttons on all pages  
- Error export feature
- Dark mode toggle + enhanced styling
- File format preview in import modal

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@datalife.com | Admin@2024 |
| Board Chairman | dalia@datalifeai.com | Dalia@2024 |

---

## Key Files Modified (Latest Session)

### Footer Component
- `/app/frontend/src/components/AppFooter.jsx` - New footer component
- `/app/frontend/src/components/RealDashboard.jsx` - Added footer
- `/app/frontend/src/components/ModernSidebar.jsx` - Removed footer from sidebar

### Logo Files
- `/app/frontend/public/datalife-account-en.jpg`
- `/app/frontend/public/datalife-account-ar.jpg`
- `/app/frontend/public/datalife-ai.png`

---

## Page Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐  ┌────────────────────────────────────┐    │
│ │          │  │                                    │    │
│ │ Sidebar  │  │         Main Content               │    │
│ │          │  │                                    │    │
│ │ - Menu   │  │         (Dashboard/Pages)          │    │
│ │ - User   │  │                                    │    │
│ │ - Dark   │  │                                    │    │
│ │ - Lang   │  │                                    │    │
│ │          │  │                                    │    │
│ └──────────┘  └────────────────────────────────────┘    │
│              ┌────────────────────────────────────────┐ │
│              │ [DataLife Account] POWERED BY [DL AI] │ │
│              └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Stack
- **Frontend**: React 18, TailwindCSS, Shadcn/UI
- **Backend**: Python, FastAPI
- **Database**: MongoDB
- **Theme**: Dark mode with CSS variables

---

## Prioritized Backlog

### P0 - Completed ✅
- [x] Data Import from Excel/CSV
- [x] Import buttons on all pages
- [x] Error export for failed imports
- [x] Dark Mode toggle + enhanced styling
- [x] File Format Preview in import modal
- [x] Page Footer with DataLife branding

### P1 - Future Enhancements
- [ ] Deploy to production (datalifeaccount.com)
- [ ] Email notifications
- [ ] WhatsApp Integration

---

## Test Reports
- Latest: `/app/test_reports/iteration_16.json`

---

*Last Updated: February 25, 2026*
