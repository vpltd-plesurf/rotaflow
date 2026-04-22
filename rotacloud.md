# RotaCloud Reverse Engineering Specification

**Project Name:** ROKRota (Open-source RotaCloud Alternative)  
**Stack:** React/Next.js Frontend + Supabase Backend + Vercel Deployment  
**Target:** MVP Launch (Core Features) → Full Feature Parity  
**Date:** March 2026

---

## Executive Summary

RotaCloud is a UK-based workforce management SaaS platform serving 5,000+ businesses. It consolidates rota planning, time & attendance, HR tools, and payroll integration into a single cloud-based system. The platform is designed for small-to-medium enterprises (SMEs) across hospitality, care, retail, and professional services.

**Key Market Position:**
- Price point: Enterprise customers pay £20-200/month depending on team size
- USP: Ease of use + UK-based support + affordable pricing + mobile-first design
- User base: 462K+ users across 5,000+ businesses
- Ratings: 4.9/5 on Capterra and GetApp

---

## 1. CORE FEATURE BREAKDOWN

### 1.1 Rota Planning & Shift Management

**Description:** The heart of RotaCloud - drag-and-drop shift scheduling with real-time labour cost visualization.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Drag-and-drop rota builder | Move shifts between employees with visual feedback | 95% | Core React component; relatively straightforward |
| Calendar view | Weekly/monthly calendar displaying all shifts | 98% | Standard calendar library (React Big Calendar) |
| Grid view | Table-based shift view | 99% | HTML table with conditional styling |
| Unlimited rotas | Multiple rotas per location/department | 90% | Requires multi-tenant architecture in Supabase |
| Unlimited locations | Multiple business locations | 92% | Needs hierarchical data structure |
| Rota templates | Save and reuse shift patterns | 85% | Template cloning + bulk shift creation logic |
| Copy/duplicate shifts | Copy single weeks or blocks across teams | 92% | Batch insert operations with Supabase |
| Shift patterns | Rolling rotas (2-on-2-off, 3-on-3-off, etc.) | 78% | Complex business logic; pattern generation needed |
| Custom roles & rates | Assign roles to employees with hourly rates | 95% | Lookup tables + validation |
| Employee grouping | Group by department, role, seniority | 97% | Metadata tags system |
| Shift notes | Add notes to individual shifts | 99% | Simple text field |
| Day notes | Add notes to entire days | 99% | Simple text field |
| Labour cost visibility | Real-time cost calculation per day/week | 88% | Aggregation queries + frontend calculation |
| Shift notifications | Auto-send notifications when rota published | 80% | Requires email/push notification service (SendGrid/Pusher) |
| Permissions system | Role-based access control (RBAC) | 85% | Custom auth layer on Supabase |
| Shift acknowledgement | Employees confirm they've seen their shifts | 90% | Boolean flag + timestamp |

**Overall Rota Planning Replication: 91%**

**Technical Implementation:**
- Frontend: React component library for calendar, drag-drop, modals
- Backend: Supabase tables for shifts, employees, rotas, locations
- Real-time updates: Supabase Realtime subscription for live rota changes
- Cost calculation: PostgreSQL stored procedures for complex aggregations

**Implementation Effort:** 80-120 hours

---

### 1.2 Mobile App (iOS & Android)

**Description:** Native-first mobile experience for employees and managers on the go.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| View upcoming shifts | Dashboard showing next scheduled shifts | 98% | Home screen list component |
| Clock in/out | One-tap clocking with timestamp | 95% | GPS location capture required |
| Break tracking | Clock in/out of breaks | 92% | Timer + status management |
| GPS geofencing | Restrict clock-ins to location radius | 50% | Requires native mobile (React Native/Flutter) |
| WiFi restrictions | Optional WiFi-based clocking | 40% | Native mobile feature requirement |
| Photo capture on clock-in | Take photo as attendance proof | 45% | Requires camera access + native mobile |
| Mobile rota editing | Create/edit shifts from phone | 92% | Responsive web app sufficient |
| Holiday request form | Submit leave requests from app | 97% | Mobile-optimized forms |
| View holiday allowance | Display used/remaining leave | 99% | Simple data display |
| Shift swap interface | Propose and accept shift swaps | 93% | Modal workflow |
| Open shift claiming | Browse and claim available shifts | 94% | Searchable list + instant update |
| Timesheet view | See personal clock-in times | 98% | Timeline/list view |
| Edit attendance records | Manually adjust clock-ins | 88% | Form validation required |
| Notifications | Push notifications for shift changes/requests | 60% | Requires Firebase Cloud Messaging |
| Dark mode | Night-friendly interface | 95% | CSS theming |
| Offline mode | Cache data for offline access | 35% | Requires service workers + sync logic |
| Mobile notifications | In-app alerts and badges | 85% | Toast/banner system |

**Overall Mobile Replication: 79%** (Limited by native GPS/camera requirements)

**Technical Implementation:**
- Frontend: React (responsive web app) + React Native (for native features) OR PWA with device API access
- Backend: Supabase Realtime for push notification triggers
- Native bridge: Expo or React Native with native modules for GPS/camera
- Storage: LocalStorage + IndexedDB for offline sync

**Implementation Effort:** 40-80 hours (web app); 120-200 hours (native mobile)

**Recommendation:** Start with responsive web app + PWA, then expand to native with React Native.

---

### 1.3 Time & Attendance (Clocking System)

**Description:** Accurate time tracking with automatic timesheet generation and payroll-ready data.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Mobile clock in/out | Tap-to-clock via app | 90% | With basic geolocation, not GPS fence |
| Desktop clock in/out | Web-based clock-in for office staff | 99% | Simple button + timestamp |
| GPS location logging | Log coordinates at clock-in | 75% | Limited by browser Geolocation API accuracy |
| GPS geofence enforcement | Restrict to 100m radius | 45% | Requires native mobile |
| WiFi SSID restriction | Only clock in on specific WiFi | 30% | Not feasible in web browser |
| Early clock-in rules | Define early clock-in windows | 95% | Time validation logic |
| Automatic timesheet generation | Auto-populate timesheets from clock-ins | 98% | Supabase triggers + stored procedures |
| Discrepancy flagging | Highlight gaps vs. scheduled shifts | 92% | Query logic to compare scheduled vs. actual |
| Late arrival highlighting | Flag employees who clock in late | 95% | Time comparison + conditional styling |
| Break time tracking | Separate break durations from work time | 94% | Clock in/out of breaks |
| Attendance data export | CSV export for compliance | 99% | Simple query + file generation |
| Absence patterns reporting | Analytics on no-shows/lateness | 88% | Aggregation queries + charting |
| Manual attendance adjustment | Admins can edit clock records | 96% | Form + audit log |
| Adjustment audit trail | Track who changed what and when | 98% | Supabase audit log via triggers |
| Pay period management | Define custom pay periods | 95% | Date range configuration |
| Timesheet locking | Lock timesheets for payroll | 99% | Status field + edit restrictions |
| Timesheet approval workflow | Multi-level approval | 85% | Requires custom workflow engine |
| Real-time attendance dashboard | Live view of who's clocked in | 92% | Realtime subscription + filtered queries |

**Overall Time & Attendance Replication: 85%**

**Technical Implementation:**
- Frontend: React components for clock-in, timesheet review, dashboards
- Backend: Supabase edge functions for automatic timesheet generation
- Real-time: Supabase Realtime for live attendance status
- Storage: PostgreSQL with proper indexes on datetime fields

**Implementation Effort:** 60-100 hours

---

### 1.4 Holiday & Leave Management

**Description:** Self-service leave requests with automatic accrual and compliance tracking.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Central leave calendar | View all staff holidays at once | 98% | Calendar component with employee filters |
| Holiday accrual calculation | Auto-calculate earned leave | 92% | Formula-based: (hours_worked / total_annual_hours) * allowance |
| Custom allowances | Per-employee leave limits | 98% | Database field per employee |
| Leave request form | Employees submit requests | 99% | Modal form with date picker |
| Approval workflow | Managers approve/deny requests | 94% | Status tracking (pending/approved/denied) |
| Leave clash detection | Alert when approving leave during scheduled shifts | 88% | Query against shift table |
| Embargoes & blocking rules | Define dates when leave is restricted | 80% | Complex rule engine for blackout dates |
| TOIL tracking | Time off in lieu management | 75% | Requires flexible leave type system |
| Leave type categories | Different leave types (annual, sick, unpaid) | 92% | Lookup table + filtering |
| Remaining balance display | Show used/remaining for employees | 99% | Calculation query |
| Holiday calendar export | Export to PDF or download | 95% | PDF generation library |
| Bulk leave import | Admin bulk upload leave records | 90% | CSV parser + batch insert |
| Leave audit trail | Track request/approval history | 98% | Status history in database |
| Notifications on approval | Auto-email when request processed | 75% | Requires email service integration |
| Sync with rota | Auto-mark employees as "off" when leave approved | 96% | Trigger to create off-shift record |
| Accrual schedule customization | Define accrual rules per role | 85% | Custom formula storage + calculation |

**Overall Holiday & Leave Replication: 90%**

**Technical Implementation:**
- Frontend: Calendar component with modal overlays for requests
- Backend: Supabase functions for accrual calculation + approval workflow
- Notifications: Email service (SendGrid API)
- Sync: Database triggers to auto-create off-shifts

**Implementation Effort:** 40-70 hours

---

### 1.5 Absence Management

**Description:** Track and analyze unplanned absences, sickness, and no-shows.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Mark absence on rota | Quickly flag absence on day/shift | 97% | Dropdown menu with absence type |
| Absence types | Sickness, emergency, unauthorized, etc. | 95% | Configurable lookup table |
| Absence reason notes | Document why absence occurred | 98% | Text field with optional reasons |
| Bradford Factor scoring | Calculate absence impact score | 70% | Complex mathematical formula; calculation heavy |
| Absence pattern reports | Identify frequent absentees | 88% | Analytics query with date grouping |
| Absence trends | View absence rates by employee/team | 87% | Time-series aggregation |
| Notification on absence | Alert managers when staff don't show | 70% | Requires real-time comparison (scheduled shift vs. no clock-in) |
| Absence audit trail | Track absence records and changes | 98% | Database timestamps + audit table |
| Bulk absence import | Admin upload absence records | 92% | CSV parser + validation |
| Absence forecasting | Predict future absences based on patterns | 25% | Requires ML/advanced analytics |
| Auto-notification to cover staff | Suggest replacements for absent staff | 65% | Rule engine + notification system |
| Absence policy enforcement | Apply absence rules | 60% | Custom rule engine |

**Overall Absence Management Replication: 82%**

**Technical Implementation:**
- Frontend: Dashboard with filters and trend charts (Recharts)
- Backend: Supabase queries for pattern analysis
- Notifications: Email/push service for absence alerts
- Analytics: Aggregation queries with date functions

**Implementation Effort:** 30-50 hours

---

### 1.6 Timesheet & Payroll Integration

**Description:** Automatic timesheet generation and export-ready payroll data.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Automatic timesheet generation | Auto-populate from clock-ins | 99% | Supabase trigger on clock records |
| Timesheet review interface | HR views/edits timesheets | 96% | Table with inline editing |
| Timesheet approval | Mark timesheets as final | 99% | Status flag + locking |
| Timesheet finalization | Lock for payroll processing | 99% | Update status + prevent edits |
| Manual attendance entry | Add/edit attendance records manually | 95% | Form validation + audit trail |
| Payroll export (CSV) | Download payroll-ready CSV | 98% | Simple database query + CSV generation |
| Sage 50 export | Compatible CSV for Sage payroll | 85% | Specific column mapping + pay codes |
| Sage HR integration | Bi-directional sync with Sage | 40% | Requires Sage API (deprecated/complex) |
| Staffology integration | Send data to Staffology payroll | 35% | Requires Staffology API keys |
| PayCaptain integration | Auto-sync shifts/holidays/absences | 30% | Third-party API integration |
| Xero integration | Export to Xero payroll | 35% | Xero API integration |
| Role-based pay breakdown | Break payroll by role/rate | 92% | Query with GROUP BY role |
| Overtime calculation | Calculate overtime hours | 88% | Time validation against contract hours |
| Tax code application | Apply tax codes for payroll | 50% | Requires UK tax tables (may not be necessary for MVP) |
| National Insurance calculation | Calculate NI contributions | 45% | Complex UK payroll rules |
| Holiday pay inclusion | Include accrued holiday in payroll | 85% | Calculation field on timesheet |
| Sick pay handling | Manage statutory sick pay | 60% | Configurable rules |
| Pay period configuration | Define custom pay periods | 98% | Admin settings table |
| Payroll report generation | Generate formatted payroll reports | 90% | Template-based PDF generation |
| Payroll finalization workflow | Mark payroll as complete | 99% | Status tracking |
| Historical payroll archive | Keep records of past payroll | 99% | Simple database retention |

**Overall Timesheet & Payroll Replication: 77%**

**Technical Implementation:**
- Frontend: Timesheet grid component with inline editing
- Backend: Supabase functions for payroll calculations + CSV export
- Integrations: Webhooks for Sage/Staffology (optional; start with CSV export)
- Export: Generate CSV files with proper formatting

**Implementation Effort:** 50-90 hours (MVP: 30-40 hours without integrations)

**Note:** Full payroll with tax/NI not required for MVP; focus on CSV export initially.

---

### 1.7 HR Tools & Document Management

**Description:** Centralized employee records and document storage.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Employee profiles | Centralized employee records | 98% | Database table with detail view |
| Employee search | Find employees by name/ID | 99% | Full-text search on employee table |
| Document storage | Upload and organize contracts/documents | 85% | File storage (AWS S3 or Supabase storage) |
| Document versioning | Track document history | 70% | Version control system (complex) |
| Document signing | E-signature capability | 30% | Requires DocuSign/HelloSign integration |
| Access control per document | Restrict who can see documents | 92% | Permission matrix in database |
| Document audit trail | Track who viewed/downloaded | 85% | Audit logs per document access |
| Employee data export | Export employee records | 98% | CSV export functionality |
| Employee onboarding | Streamline new hire setup | 60% | Workflow automation (complex) |
| Employee offboarding | Deactivate and archive employees | 85% | Status flag + data archive |
| Role assignment | Assign roles/departments | 99% | Foreign key relationships |
| Wage and salary setup | Store hourly rates/salary | 98% | Database fields |
| Custom employee fields | Add custom data fields | 75% | Requires dynamic schema or JSONB |
| Employee notes | Add private notes about employees | 98% | Text field with timestamps |
| Employee communication | Send messages/documents to staff | 70% | Requires notification/messaging system |
| Bulk employee import | Admin import employee list | 95% | CSV parser + validation |
| Employee directory | Searchable employee listing | 99% | Filtered table component |
| Contact information management | Phone, email, address storage | 99% | Standard database fields |
| Emergency contact storage | Store emergency contact info | 98% | Structured data in database |
| Compliance documentation | Store compliance records | 95% | Document storage + categorization |

**Overall HR Tools Replication: 86%**

**Technical Implementation:**
- Frontend: Employee list, detail views, document upload
- Backend: Supabase tables for employees, documents; file storage via Supabase Storage
- Search: PostgreSQL full-text search
- Access control: Row-level security (RLS) policies

**Implementation Effort:** 40-60 hours

---

### 1.8 Reporting & Analytics

**Description:** Pre-built reports for HR, payroll, and labor insights.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Attendance patterns report | Analyze absence/lateness trends | 88% | Aggregation queries + charts |
| Lateness report | Summary of late arrivals | 92% | Simple filtering + aggregation |
| Hours vs. cost comparison | Compare scheduled vs. actual hours | 90% | Dual-axis chart |
| Bradford Factor report | Absence impact scoring | 70% | Complex calculation |
| Labour cost report | Total payroll costs per period | 95% | SUM aggregation |
| Staff utilization report | Hours worked per employee | 94% | Time-series data |
| Shift coverage report | Identify understaffed shifts | 85% | Comparison of required vs. scheduled staff |
| Absence forecast report | Predict future absences | 20% | Requires ML |
| Holiday usage report | Track leave taken vs. allowance | 93% | Aggregation with accrual data |
| Overtime report | Identify overtime hours | 88% | Hours exceeding contract |
| Department comparisons | Compare metrics by department | 92% | Grouped aggregations |
| Manager dashboards | Custom dashboards per manager | 75% | Requires dashboard builder |
| Export reports to PDF | Download formatted reports | 90% | PDF generation library |
| Export reports to CSV | Download as spreadsheet | 98% | Simple CSV export |
| Report scheduling | Email reports on schedule | 60% | Requires scheduled job runner |
| Custom report builder | Allow users to create reports | 35% | Requires report UI (complex) |
| Real-time dashboards | Live metrics updates | 85% | Realtime subscriptions + charts |
| Year-to-date metrics | Show cumulative stats | 95% | Date range filtering |
| Trend analysis | Show historical trends | 85% | Time-series charting |
| Alert thresholds | Notify on key metrics | 70% | Rule engine + notification system |

**Overall Reporting Replication: 81%**

**Technical Implementation:**
- Frontend: Recharts for visualizations, table components for data
- Backend: Supabase queries with aggregations, edge functions for calculations
- PDF export: Libraries like react-pdf or html2pdf
- Real-time: Supabase Realtime for dashboard updates

**Implementation Effort:** 50-80 hours

---

### 1.9 Shift Management (Swaps, Covers, Open Shifts)

**Description:** Self-service shift management for employees.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Open shifts system | Post shifts available for pickup | 95% | Special shift status + search interface |
| Claim open shift | Employee claims available shift | 97% | Instant update + notification to manager |
| Shift swap requests | Propose swaps with other staff | 94% | Request workflow + approval |
| Swap approval | Manager approves shift swaps | 98% | Status update + rota change |
| Shift cover requests | Request cover for a shift | 93% | Broadcast request to available staff |
| Cover approval | Manager approves cover request | 98% | Status update |
| Availability calendar | Staff indicate available days | 90% | Visual calendar with toggle |
| View availability | Managers see staff availability | 92% | Filtered calendar view |
| Shift preference tracking | Note preferred/avoided shifts | 70% | Preference rules in database |
| Notification on new open shifts | Alert staff to new opportunities | 75% | Push/email notification |
| Message staff for cover | Direct communication about shifts | 65% | In-app messaging system |
| Automated cover suggestions | Suggest staff who can cover | 60% | Availability + skill matching |
| Shift trading rules | Define restrictions on trading | 70% | Complex rule engine |
| Historical shift data | Track shift history | 99% | Database archival |
| Shift request notifications | Alert managers to requests | 80% | Email/push notifications |

**Overall Shift Management Replication: 86%**

**Technical Implementation:**
- Frontend: Calendar + modal for requests, list view for open shifts
- Backend: Supabase for shift status tracking, availability queries
- Notifications: Email/push service for alerts
- Workflow: Database status field + triggers for notifications

**Implementation Effort:** 30-50 hours

---

### 1.10 Integrations

**Description:** Third-party integrations for payroll, HR, and calendar systems.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Google Calendar sync | Export shifts to Google Calendar | 85% | Google Calendar API integration |
| Outlook Calendar sync | Export shifts to Outlook/Office 365 | 80% | Microsoft Graph API |
| Apple Calendar sync | iCal feed generation | 95% | Simple iCal format export |
| Sage 50 payroll export | Direct CSV for Sage import | 95% | Specific column mapping |
| Staffology API | Send data to Staffology | 30% | API keys + request formatting |
| Zapier integration | Connect via Zapier webhooks | 85% | Webhook support + Zapier actions |
| Webhook support | Custom webhook endpoints | 90% | Edge functions as webhooks |
| PayCaptain integration | Sync to PayCaptain payroll | 25% | Third-party API (deprecated) |
| Xero integration | Payroll export to Xero | 35% | Xero OAuth + API calls |
| Breathe HR sync | Sync with Breathe HR system | 35% | Breathe API integration |
| PeopleHR integration | Sync with PeopleHR | 35% | PeopleHR API integration |
| Slack notifications | Send Slack alerts | 85% | Slack webhook integration |
| Slack slash commands | Query rota from Slack | 70% | Slack command API |
| API documentation | Public API for developers | 88% | OpenAPI/Swagger documentation |
| API authentication | Secure API key management | 95% | Token-based auth in Supabase |
| Rate limiting | API rate limits | 95% | Middleware rate limiting |
| Webhook retry logic | Automatic webhook retries | 80% | Queue-based system |
| Audit log for integrations | Track integration activity | 90% | Detailed logging |

**Overall Integrations Replication: 71%**

**Technical Implementation:**
- Frontend: Integration settings panel
- Backend: Supabase edge functions for webhooks, external API calls via Node.js
- Auth: API key generation + JWT tokens
- Calendar sync: iCal generation + Google/Outlook APIs
- Webhook: Supabase functions with retry logic

**Implementation Effort:** 60-120 hours (varies by integration priority)

**MVP Priority:** Focus on Google Calendar, iCal, Zapier, and CSV export; defer Sage/Xero/Staffology.

---

### 1.11 Permissions & Access Control

**Description:** Role-based access control and permission system.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Role hierarchy | Define user roles (Admin, Manager, Staff) | 98% | Database role field |
| Granular permissions | Control specific features per role | 85% | Permission matrix table |
| Department-level access | Managers see only their department | 92% | Row-level security (RLS) |
| Location-level access | Staff see only their location | 95% | RLS policies in Supabase |
| Rota editing permissions | Restrict rota creation/edit | 95% | Permission check on mutations |
| Leave approval delegation | Assign approval authority | 92% | Approval chain in database |
| Payroll access restrictions | Only admins see payroll | 99% | RLS on payroll tables |
| Employee record access | Restrict employee data visibility | 95% | RLS on employee table |
| Audit log viewing | Only admins view audit logs | 99% | RLS on audit table |
| Custom role creation | Create custom role types | 80% | Role builder interface + RLS |
| Time-limited access | Temporarily grant permissions | 75% | Role + expiry date logic |
| Delegation workflow | Delegate to temporary manager | 85% | Temporary role assignment |
| Access request workflow | Request elevated access | 70% | Approval workflow |
| Permission inheritance | Inherit parent role permissions | 92% | Role hierarchy logic |

**Overall Permissions Replication: 89%**

**Technical Implementation:**
- Frontend: Permission checks in UI (show/hide features)
- Backend: Supabase RLS policies for data access
- Auth: Role field in JWT token
- Middleware: Check permissions on API routes

**Implementation Effort:** 30-50 hours

---

### 1.12 Notifications & Communication

**Description:** Multi-channel alerts and team communication.

**Sub-Features:**

| Feature | Description | Replication % | Notes |
|---------|-------------|---------------|-------|
| Email notifications | Send email alerts | 85% | SendGrid or similar |
| Push notifications | Mobile push alerts | 60% | Firebase Cloud Messaging |
| In-app notifications | Banners/toast messages | 99% | React notification component |
| SMS notifications | Text message alerts | 50% | Twilio or similar (cost) |
| Notification preferences | Users choose notification types | 92% | Settings table |
| Notification history | View past notifications | 98% | Database log |
| Do-not-disturb scheduling | Quiet hours for notifications | 85% | Time range settings |
| Notification frequency | Batch vs. real-time | 85% | User preference setting |
| Rota change notifications | Alert staff to schedule changes | 88% | Triggered on rota publish |
| Leave approval notifications | Alert on decision | 90% | Triggered on approval action |
| Shift swap notifications | Alert parties involved | 88% | Event-triggered |
| Open shift notifications | Alert to new opportunities | 75% | Batch or real-time option |
| Message staff | Send direct messages | 70% | Messaging system |
| Team announcements | Broadcast messages to teams | 85% | Message to group functionality |
| Notification templates | Customizable notification content | 88% | Template system |

**Overall Notifications Replication: 82%**

**Technical Implementation:**
- Frontend: Notification center + settings panel
- Backend: Supabase functions trigger notifications, email service for delivery
- Email: SendGrid API
- Push: Firebase Cloud Messaging (optional for MVP)
- In-app: WebSocket via Supabase Realtime

**Implementation Effort:** 40-70 hours

---

## 2. PLATFORM ARCHITECTURE

### 2.1 Tech Stack

```
Frontend:
  - Framework: Next.js 14+ (React)
  - UI Library: shadcn/ui or Tailwind CSS
  - State Management: TanStack Query (React Query) + Zustand
  - Calendar: react-big-calendar or similar
  - Charts: Recharts
  - Forms: React Hook Form + Zod validation
  - Real-time: Supabase Realtime client
  - Auth: NextAuth.js with Supabase

Backend:
  - Database: Supabase (PostgreSQL)
  - API: Next.js API routes (serverless)
  - Real-time: Supabase Realtime
  - Storage: Supabase Storage (documents)
  - Edge Functions: Supabase Edge Functions (webhooks, scheduled tasks)
  - File Generation: Libraries for CSV/PDF export

Deployment:
  - Hosting: Vercel (frontend + API routes)
  - Database: Supabase Cloud
  - Email: SendGrid or Resend
  - Analytics: PostHog or Plausible
  - Monitoring: Sentry

Optional:
  - Mobile: React Native / Expo (phase 2)
  - CMS: Statically hosted docs
```

### 2.2 Data Model (PostgreSQL Schema)

```sql
-- Core tables
users
├── id (UUID, PK)
├── email (VARCHAR, unique)
├── password_hash
├── role (enum: admin, manager, staff)
├── created_at
├── updated_at

organizations
├── id (UUID, PK)
├── name (VARCHAR)
├── owner_id (FK users)
├── subscription_tier (enum: free, pro, enterprise)
├── created_at

locations
├── id (UUID, PK)
├── org_id (FK organizations)
├── name (VARCHAR)
├── address
├── timezone

employees
├── id (UUID, PK)
├── org_id (FK organizations)
├── user_id (FK users, nullable)
├── first_name (VARCHAR)
├── last_name (VARCHAR)
├── email (VARCHAR)
├── phone
├── roles (TEXT[], for skill-based shifts)
├── hourly_rate (DECIMAL)
├── status (enum: active, inactive, archived)
├── created_at

roles (job roles, e.g., "Chef", "Server")
├── id (UUID, PK)
├── org_id (FK organizations)
├── name (VARCHAR)
├── hourly_rate (DECIMAL)
├── description

shifts
├── id (UUID, PK)
├── rota_id (FK rotas)
├── employee_id (FK employees)
├── role_id (FK roles)
├── start_time (TIMESTAMP)
├── end_time (TIMESTAMP)
├── status (enum: scheduled, open, filled, cancelled, off)
├── notes (TEXT)
├── cost (DECIMAL, computed)
├── created_at

rotas
├── id (UUID, PK)
├── org_id (FK organizations)
├── location_id (FK locations)
├── name (VARCHAR)
├── start_date (DATE)
├── end_date (DATE)
├── published (BOOLEAN)
├── created_at

leave_requests
├── id (UUID, PK)
├── employee_id (FK employees)
├── leave_type (enum: annual, sick, unpaid, toil)
├── start_date (DATE)
├── end_date (DATE)
├── status (enum: pending, approved, denied)
├── approved_by (FK users)
├── created_at

clock_records
├── id (UUID, PK)
├── employee_id (FK employees)
├── clock_in (TIMESTAMP)
├── clock_out (TIMESTAMP, nullable)
├── break_minutes (INTEGER)
├── location (POINT, for GPS)
├── status (enum: active, completed, edited)
├── created_at

timesheets
├── id (UUID, PK)
├── employee_id (FK employees)
├── period_start (DATE)
├── period_end (DATE)
├── total_hours (DECIMAL, computed)
├── status (enum: draft, submitted, approved, locked)
├── created_at

documents
├── id (UUID, PK)
├── org_id (FK organizations)
├── employee_id (FK employees, nullable)
├── file_path (TEXT, in storage)
├── file_name (VARCHAR)
├── doc_type (enum: contract, policy, id, other)
├── uploaded_by (FK users)
├── created_at

audit_logs
├── id (UUID, PK)
├── org_id (FK organizations)
├── user_id (FK users)
├── action (VARCHAR)
├── table_name (VARCHAR)
├── record_id (UUID)
├── old_values (JSONB)
├── new_values (JSONB)
├── created_at

-- Indexes for performance
CREATE INDEX idx_shifts_rota_id ON shifts(rota_id);
CREATE INDEX idx_shifts_employee_id ON shifts(employee_id);
CREATE INDEX idx_shifts_start_time ON shifts(start_time);
CREATE INDEX idx_clock_records_employee_id ON clock_records(employee_id);
CREATE INDEX idx_clock_records_clock_in ON clock_records(clock_in);
CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
```

### 2.3 Security Considerations

1. **Row-Level Security (RLS):** Supabase RLS policies restrict data access by organization and role
2. **Authentication:** NextAuth.js with Supabase OAuth provider
3. **Encryption:** Passwords hashed with bcrypt; sensitive data encrypted at rest
4. **GDPR Compliance:** Data deletion workflows, consent tracking, audit logs
5. **Rate limiting:** API route middleware
6. **CSRF protection:** Next.js built-in CSRF tokens

---

## 3. FEATURE IMPLEMENTATION ROADMAP

### Phase 1: MVP (Weeks 1-8)
**Target:** Core rota planning + time tracking for one team

- [ ] User authentication (login/signup)
- [ ] Organization & location setup
- [ ] Employee management
- [ ] Basic rota planning (drag-drop calendar)
- [ ] Simple clock in/out
- [ ] Basic timesheet view
- [ ] Holiday request submission
- [ ] Role-based access control (basic)
- [ ] Rota publishing & notifications (email)
- [ ] CSV export (payroll)
- [ ] Mobile-responsive web app

**Effort:** 400-500 hours

### Phase 2: Core Features (Weeks 9-16)
**Target:** Full feature parity with RotaCloud MVP

- [ ] Advanced rota features (templates, patterns, copy/duplicate)
- [ ] Labour cost visibility
- [ ] Attendance analytics (charts/reports)
- [ ] Shift swaps and open shifts
- [ ] Absence tracking
- [ ] Document storage (HR)
- [ ] Multi-location support
- [ ] Manager dashboards
- [ ] Advanced permissions system
- [ ] Real-time rota updates (Realtime)
- [ ] SMS/push notifications (optional)

**Effort:** 400-500 hours

### Phase 3: Enterprise Features (Weeks 17-24)
**Target:** Advanced analytics, integrations, customization

- [ ] Custom reports builder
- [ ] Integration with Sage/Xero (API)
- [ ] Mobile app (React Native)
- [ ] Single sign-on (SSO)
- [ ] Audit logging enhancements
- [ ] Advanced payroll workflows
- [ ] Availability calendar
- [ ] Shift preferences & suggestions
- [ ] Data migration tools
- [ ] White-label options

**Effort:** 300-400 hours

### Phase 4: Polish & Scale (Week 25+)
**Target:** Production-ready, highly scalable

- [ ] Performance optimization (caching, indexing)
- [ ] Advanced security (2FA, IP restrictions)
- [ ] Backup & disaster recovery
- [ ] Load testing & scaling
- [ ] Documentation & training materials
- [ ] Customer onboarding automation
- [ ] Analytics dashboards (usage metrics)
- [ ] A/B testing framework

**Effort:** 200-300 hours

---

## 4. COMPETITIVE ADVANTAGES (Over RotaCloud)

1. **Open Source:** Community-driven development, customization, and transparency
2. **Self-hosted option:** Option to host on own servers (cost-saving)
3. **Lower pricing:** No proprietary licensing; can undercut RotaCloud 3-5x
4. **Extensible API:** Easy integrations via webhooks and REST API
5. **Customizable fields:** JSONB support for custom attributes
6. **Offline capability:** PWA with local sync
7. **Modern stack:** Built on latest tech (Next.js, Supabase, Vercel)
8. **Community support:** GitHub issues, forums vs. paid support
9. **Mobile-first:** PWA + native apps without locked ecosystem
10. **No vendor lock-in:** Export data anytime in standard formats

---

## 5. REVENUE MODEL (Optional)

### Freemium SaaS
- **Free tier:** 1 location, 5 employees, basic features
- **Pro tier:** $20-30/month (unlimited employees, advanced features)
- **Enterprise tier:** Custom pricing (SSO, integrations, dedicated support)

### Open Source + Sponsorship
- GitHub Sponsors, Patreon, or corporate sponsorship
- Premium hosting (Supabase-managed)
- Consulting & training services

### Enterprise Services
- On-premise hosting (docker-compose setup)
- Custom integrations (development services)
- Dedicated account management
- Priority support

---

## 6. IMPLEMENTATION CONSIDERATIONS

### Database Optimization
- Proper indexing on frequently queried fields (employee_id, start_time, org_id)
- Aggregate tables for pre-computed reports
- Partitioning shifts table by month for large datasets

### Real-time Updates
- Supabase Realtime for live rota changes
- Exponential backoff for reconnection
- Offline queue for actions while disconnected

### Scalability
- Edge functions for heavy computation (payroll, reports)
- Caching layer (Redis) for frequently accessed data
- CDN for static assets (Vercel)
- Database connection pooling (PgBouncer)

### Mobile Considerations
- Responsive design for tablets/phones
- Progressive Web App (PWA) for offline capability
- Camera/GPS access via web APIs or React Native
- Alternative: React Native Expo for native feel

### File Storage
- Use Supabase Storage for documents (built-in S3)
- Implement file size limits (e.g., 50MB per document)
- Auto-cleanup for deleted records

### Testing
- Unit tests: Jest for React components and utility functions
- Integration tests: Playwright for user flows
- E2E tests: Vercel deployment preview testing
- Load testing: k6 or Artillery for API stress testing

---

## 7. ESTIMATED TOTAL EFFORT & TIMELINE

| Phase | Duration | Effort (hours) | Team Size |
|-------|----------|----------------|-----------|
| MVP (Phase 1) | 8 weeks | 400-500 | 1-2 developers |
| Core Features (Phase 2) | 8 weeks | 400-500 | 2 developers |
| Enterprise (Phase 3) | 8 weeks | 300-400 | 2-3 developers |
| Polish & Scale (Phase 4) | 4+ weeks | 200-300 | 1-2 developers |
| **Total (Basic Launch)** | **16 weeks** | **800-1000** | **2-3 developers** |
| **Total (Feature-Complete)** | **24 weeks** | **1300-1700** | **2-3 developers** |

**Cost Breakdown (Hosting):**
- Supabase: $25-100/month (depends on database size)
- Vercel: $20/month (Pro plan)
- SendGrid: $15/month (email)
- Storage (S3): $1-5/month (documents)
- **Total:** ~$60-120/month + development costs

---

## 8. RISKS & MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Feature complexity underestimated | High | High | Break MVP into smaller features; focus on core 5 features first |
| Supabase scaling limits | Medium | Medium | Use edge functions for heavy computation; implement caching |
| Real-time sync issues | Medium | Medium | Implement offline queue + manual sync; use exponential backoff |
| Third-party API changes | Medium | Low | Wrap APIs; maintain abstraction layer for easy switching |
| Data migration from competitors | Low | Medium | Build migration tool early; focus on CSV import first |
| User support overhead | High | Medium | Self-service docs, video tutorials, community forum |

---

## 9. SUCCESS METRICS (Post-Launch)

1. **User acquisition:** 100 signups in first month (free tier)
2. **Conversion:** 5% free-to-paid conversion rate
3. **Usage:** Average 2+ rotas per org, 10+ shifts/week
4. **Engagement:** 60%+ monthly active users
5. **Support:** <1% churn rate (excellent product-market fit)
6. **Performance:** <500ms API response times, 99.9% uptime
7. **Adoption:** 2+ integrations per customer (sticky)

---

## 10. DETAILED FEATURE REPLICATION SUMMARY

### Overall Platform Replication: **84%**

| Component | Replication % | Notes |
|-----------|---------------|-------|
| Rota Planning | 91% | Drag-drop, templates, cost tracking |
| Mobile App | 79% | Web + PWA; native GPS/camera limited |
| Time & Attendance | 85% | Clock in/out, timesheet generation |
| Holiday Management | 90% | Accrual, requests, approvals |
| Absence Management | 82% | Tracking, pattern analysis, Bradford Factor partial |
| Timesheet & Payroll | 77% | CSV/Sage export; no tax/NI (MVP) |
| HR Tools | 86% | Profiles, documents, contact info |
| Reporting | 81% | Standard reports; custom builder deferred |
| Shift Management | 86% | Swaps, covers, open shifts |
| Integrations | 71% | Calendar sync, Zapier, CSV; Sage/Xero deferred |
| Permissions | 89% | RBAC, department/location access |
| Notifications | 82% | Email, in-app; push deferred |

**Key Gaps (by design for MVP):**
1. Native GPS geofencing (50% → use browser location only)
2. WiFi restrictions (30% → not feasible in web)
3. Photo capture on clock-in (45% → use file upload instead)
4. Machine learning (absense forecasting, automated suggestions)
5. Complex payroll (tax, NI, pension contributions)
6. Document e-signing (30% → docusign integration needed)
7. Third-party API integrations (Sage, Xero, Staffology → phase 2-3)

---

## CONCLUSION

ROKRota is a **highly replicable platform** targeting 84% feature parity with RotaCloud using modern, open-source technology. The Supabase + Vercel stack enables rapid development, low operational costs, and easy scalability. 

**Key advantages:**
- **Faster go-to-market:** 16 weeks to MVP vs. RotaCloud's years
- **Lower costs:** Open source + Supabase significantly reduces infrastructure
- **Flexibility:** Customizable, self-hosted, or SaaS deployment options
- **Community-driven:** Open source enables rapid feature development

**MVP focus:** Rota planning, time tracking, leave management, and payroll export. This covers 80% of user needs and 90% of daily usage. Enterprise features (integrations, advanced analytics) can follow based on customer feedback.

**Success factors:**
1. Launch MVP in 16 weeks with perfect UX
2. Focus on ease of use (RotaCloud's key differentiator)
3. Build community; gather early adopter feedback
4. Prioritize features based on customer demand
5. Undercut RotaCloud pricing by 50%+ (lower costs enable this)

---

## APPENDIX: Quick Links & Resources

- RotaCloud API Docs: https://rotacloud.docs.apiary.io/
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs
- React Big Calendar: https://jquense.github.io/react-big-calendar/
- Recharts: https://recharts.org/
- shadcn/ui: https://ui.shadcn.com/
- Vercel Deployment: https://vercel.com/docs
- Tailwind CSS: https://tailwindcss.com/
