# DataLife Account - Product Requirements Document

## Original Problem Statement
Multi-tenant SaaS ERP application for financial and HR management supporting Arabic/English bilingual interface with RTL support.

---

## Session Updates (February 2026)

### ✅ COMPLETED AND VERIFIED (May 13, 2026 - Session 5)

#### 20. PDF + Print + Bulk ZIP + Monthly VAT Report
- **Request**: real PDF export, native print, bulk ZIP download, monthly VAT report.
- **Implementation**:
  - **WeasyPrint** installed for HTML → PDF (Arabic-friendly with Noto Sans Arabic fonts).
  - **`render_invoice_pdf(html)`** + **`build_invoices_zip(invoices)`** + **`build_monthly_vat_report_html(...)`** + **`send_monthly_vat_report(...)`** in `tax_invoice_service.py`.
  - **New backend endpoints** in `api/payments.py`:
    - `GET /api/payments/tax-invoices/{invoice_number}/pdf` → 36KB PDF
    - `GET /api/payments/tax-invoices/bulk-download?company_id=&year=&month=` → ZIP with one HTML + one PDF per invoice
    - `POST /api/payments/tax-invoices/vat-report/send?company_id=&month=&year=&recipient_email=` → emails report (with PDF attachment) and persists to `vat_reports` collection
    - `GET /api/payments/tax-invoices/vat-report/preview?company_id=&month=&year=` → HTML preview
  - **Print button on invoice HTML**: floating top-left bar with "Print" + "Save as PDF" buttons (hidden in print via `.no-print`).
  - **Scheduler** (`services/scheduler.py`) using APScheduler `AsyncIOScheduler`:
    - Cron job: 1st of every month at 06:00 UTC (≈ 09:00 Cairo).
    - Iterates over every company that issued invoices in the previous month and emails the VAT report to its `contact_email`.
    - Started/stopped via FastAPI `on_event("startup"/"shutdown")`.
  - **Frontend `TaxInvoicesSection.jsx`** updated:
    - Header buttons: `Preview VAT` / `Email VAT` / `Download ZIP` / `Export CSV`.
    - Per-row buttons: View 🔗, Print 🖨️, PDF 📄, Download ⬇️.
    - Bulk ZIP respects current year/month filter.
    - VAT report requires selecting both a year and a month (otherwise toast error).
- **Test Status**:
  - Backend: ✅ `GET /pdf` → 200 (36KB PDF), `bulk-download` → 200 (112KB ZIP, 3 HTML + 3 PDF), `vat-report/send` → 200 (sent:true, PDF attachment).
  - Frontend: ✅ Visual verification — 4 header CTAs + 4 row actions render correctly with proper colors.

### ✅ COMPLETED AND VERIFIED (May 13, 2026 - Session 4)

#### 19. Tax Invoices History in Subscription Tab
- **Request**: Add "Tax Invoices History" section in the Subscription settings tab with download per invoice + Year/Month filter.
- **Implementation**:
  - **New component**: `frontend/src/components/settings/TaxInvoicesSection.jsx`
    - Fetches `/api/payments/tax-invoices?company_id={id}`.
    - Year + Month filter dropdowns.
    - Table with: Invoice #, Date, Plan, VAT 14%, Total + Actions (View 🔗 / Download ⬇️).
    - Filtered totals row (VAT total + grand total).
    - Export to CSV (UTF-8 BOM for Arabic, friendly accountant headers).
    - Empty/loading/error states.
  - **Embedded** in `SubscriptionTab.jsx` (spans full width below existing cards).
- **Test Status**:
  - Backend: ✅ `/api/payments/tax-invoices` returns invoices.
  - Frontend: ✅ Visual verification — 3 test invoices displayed with proper formatting, filters working, totals computed correctly (10,380 EGP, VAT 1,274.74 EGP).

### ✅ COMPLETED AND VERIFIED (May 13, 2026 - Session 3)

#### 18. Tax Invoice (14% VAT-inclusive) Auto-Issuance + Email
- **Request**: After payment, generate a 14% tax invoice (VAT-inclusive pricing) and email it to the customer.
- **Implementation**:
  - **New service**: `backend/services/tax_invoice_service.py`
    - `calculate_vat_breakdown(total_inclusive, rate=0.14)`: splits VAT-inclusive total → subtotal + VAT
    - `build_tax_invoice_html(...)`: renders bilingual (Arabic RTL + English) tax invoice HTML with gradient header, From/Bill-To cards, items table, totals with green emphasis on grand total, and Egyptian VAT-law note.
    - `send_tax_invoice_email(...)`: persists invoice to `tax_invoices` collection AND emails it via Resend.
  - **`/api/payments/status/{session_id}`** (success flow) and **`/api/webhook/stripe`** (webhook flow) now both call `send_tax_invoice_email` after activating the subscription.
  - **New endpoints**:
    - `GET /api/payments/tax-invoices?company_id=X` — list invoices
    - `GET /api/payments/tax-invoices/{invoice_number}/html` — render full HTML for re-download/print
  - **Invoice number format**: `DL-{YYYY}-{8-char-hex}` (e.g. `DL-2026-9224C579`)
  - Pricing example: 2,390 EGP (incl) → 2,096.49 subtotal + 293.51 VAT (14%)
- **Bug fix**: `payments.py` and `webhook.py` were using default `DB_NAME=multi_tenant_erp` because they didn't call `load_dotenv()` before reading env. Added `load_dotenv()` at the top of both files.
- **Test Status**:
  - Backend: ✅ VAT math verified for multiple amounts (87.72+12.28=100, 5607.02+784.98=6392).
  - Backend: ✅ Invoice persisted to `tax_invoices` collection, Resend send returned success (`sent=True`).
  - Backend: ✅ `GET /api/payments/tax-invoices` returns correct list filtered by company_id.
  - Visual: ✅ Invoice HTML renders professionally (RTL Arabic + English) with proper VAT breakdown.

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
