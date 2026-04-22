# ROKRota — TODO

Last updated: 2026-04-22 (end of Phase 3 — DB-layer multi-tenancy complete).

---

## Multi-tenant SaaS conversion (in progress)

Working branch: `feature/multi-tenant` (PR #1). Plan detailed in project memory.

- [x] **Phase 0** — Safety net: `scripts/check-brand.sh`, `scripts/clone-to-staging.ts`, `scripts/smoke-test.ts`, CI with brand check + typecheck
- [x] **Phase 0.5** — Product rename to `ROKRota` across user-facing surfaces (login, sidebar, manifest, icons, emails, docs). Infra identifiers (docker paths, container names) deliberately untouched
- [x] **Phase 1** — `organisations` table + `org_id NOT NULL` on all 11 user-data tables + ROK backfilled + `profiles.is_superuser` flag (Paul promoted). Triggers carry `org_id` through
- [x] **Phase 2** — `lib/supabase/org.ts` → `getCurrentOrg()` helper + `OrgContext` type
- [x] **Phase 3** — RLS rewrite. Every policy gates on `org_id = my_org_id()` + superuser bypass via `am_superuser()`. 39-case vitest isolation suite asserts cross-org impossible. CI wired
- [ ] **Phase 4** — App query audit: thread `getCurrentOrg()` through pages, ensure every INSERT sets `org_id`, verify location/employee selectors scoped to org
- [ ] **Phase 5** — Public `/signup` page + onboarding wizard + subdomain routing (`*.rokrota.com`). Blocked on purchasing `rokrota.com`
- [ ] **Phase 6** — Invite flow: replace admin-sets-password UX with Supabase `inviteUserByEmail` + magic link
- [ ] **Phase 7** — De-ROK-ify remaining customer-specific strings; per-org branding (name, email sender, logo)
- [ ] **Phase 8** — Cross-tenant isolation audit + `/security-review` skill + audit log
- [ ] **Phase 9** — Super-admin panel (list orgs, impersonate, suspend)
- [ ] **Phase 10** — Stripe (per-seat plans, webhooks, billing portal)

### Immediate user actions (unblocks tomorrow's work)

- [ ] Add 3 GitHub repo secrets so CI can run the isolation tests:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Buy `rokrota.com` via Cloudflare Registrar (blocks Phase 5, not earlier)

---

## Core app — built

### Auth, roles, data
- [x] Login (Supabase email/password)
- [x] Role-based access: admin / manager / barber
- [x] Row-level security (org-scoped since Phase 3)
- [x] CSV import from RotaCloud exports (16 employees, 182 leave records)
- [x] Super-admin flag for cross-tenant support access

### Rota
- [x] Weekly grid per location
- [x] Add / edit / delete shifts; Full day / AM / PM quick-select
- [x] Copy previous week
- [x] Publish with email to barbers (Resend)
- [x] Indicative labour cost (rate × hours)
- [x] Admin location switcher
- [x] Drag-and-drop shifts between days/barbers (desktop, @dnd-kit/core)
- [x] Rota templates — save + apply named patterns
- [x] Leave calendar overlay (amber cells, "On leave" badges, "{n} off" day counts)
- [x] Mobile card view (single-day picker below md breakpoint)

### Team
- [x] Employee cards with leave days + doc count
- [x] Click-through drawer: Info / Leave / Documents tabs
- [x] Add / edit barber profiles
- [x] Activate / deactivate barbers

### Leave
- [x] Barber submits unpaid leave
- [x] Manager approve / deny
- [x] Approval auto-creates `leave_block` shift on rota
- [x] Email to managers on submit
- [x] Email to employee on approve / deny

### Swaps
- [x] Barber proposal form (pick own shift, request cover or direct swap)
- [x] Manager approve / deny
- [x] Email notifications on propose / approve / deny

### Documents
- [x] Upload per employee (Supabase Storage, 10MB cap)
- [x] Download via signed URL

### Locations & settings
- [x] Location CRUD with per-day opening hours (Mon–Sun, open/close, lunch mins)
- [x] Profile settings + password change

### Platform
- [x] PWA manifest + service worker (installable on phone)
- [x] Mobile responsive (responsive selects, h-dvh, popover widths)
- [x] Loading skeletons per page
- [x] In-app notification bell (real-time Supabase subscription)
- [x] Barber-only "My Shifts" page

### Infra
- [x] Next.js 16 (App Router, Turbopack, TypeScript)
- [x] shadcn/ui + Tailwind 3 + green pastel palette
- [x] Migration runner via Supabase Management API
- [x] GitHub Actions auto-deploy to Synology via Tailscale + SSH
- [x] Cloudflare Tunnel (shared; lives at `/volume1/docker/cloudflared/`)
- [x] Supabase free-tier keep-alive sidecar
- [x] CI: brand check + typecheck + isolation tests

---

## Backlog (after multi-tenant lands)

- [ ] Audit log table + UI (rota publishes, leave decisions, user changes, org-level events)
- [ ] Print / export rota to PDF
- [ ] Dark mode
- [ ] Dashboard stats widget (shifts this week, pending leave, pending swaps)
- [ ] Recurring / repeating shifts
- [ ] Google Calendar / iCal export per barber
- [ ] Bulk shift entry (same shift applied to all barbers for one day)
- [ ] Unpublish a rota (currently one-way)
- [ ] Infra rename sweep: `rotaflow` → `rokrota` in docker paths, container names, GitHub workflow, npm package name (deferred from Phase 0.5)
