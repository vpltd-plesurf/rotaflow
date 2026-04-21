# ROKRota — TODO

## Done

### Infrastructure
- [x] Next.js 16 app scaffold (App Router, Turbopack, TypeScript)
- [x] Supabase cloud project connected (gyennfqrhcllyzahiddp)
- [x] shadcn/ui + Tailwind CSS
- [x] Database schema + RLS policies
- [x] Migration runner (`npm run migrate`) via Supabase Management API
- [x] CSV import from RotaCloud exports (16 employees, 182 leave records)
- [x] Role-based access: Admin / Manager / Barber

### Pages & Features
- [x] Login (Supabase email/password)
- [x] Dashboard home (role-aware quick links)
- [x] **Rota** — weekly grid per location, add/edit/delete shifts
- [x] **Rota** — shift quick-select: Full day / AM / PM (uses per-day shop hours)
- [x] **Rota** — copy previous week
- [x] **Rota** — publish + email notification to barbers (Resend)
- [x] **Rota** — indicative labour cost (rate × hours)
- [x] **Rota** — admin location switcher
- [x] **Team** — employee cards with leave days + doc count
- [x] **Team** — click-through drawer: Info / Leave / Documents tabs
- [x] **Team** — add/edit barber profiles
- [x] **Team** — activate / deactivate barbers
- [x] **Leave** — barbers submit unpaid leave requests
- [x] **Leave** — manager approve / deny
- [x] **Documents** — upload files per employee (Supabase Storage, 10MB)
- [x] **Documents** — download via signed URL
- [x] **Locations** — CRUD with per-day opening hours (Mon–Sun toggle, open/close, lunch mins)
- [x] **Settings** — profile edit + password change
- [x] **Swaps** — page scaffolded

---

## Not Done / Needs Work

### Shift Swaps
- [ ] Swap proposal form (barber picks a shift and requests cover or direct swap)
- [ ] Manager approve/deny swap → rota updates automatically
- [ ] Notification to both barbers when swap is approved

### Leave
- [ ] Leave requests should auto-block the shift on the rota when approved (create a `leave_block` shift)
- [ ] Filterable leave history view (by location, barber, date range)
- [ ] Manager leave approval should trigger email to barber

### Notifications
- [ ] In-app notification bell (table exists, UI not wired up)
- [ ] Email on leave approved/denied
- [ ] Email on shift swap approved/denied

### Rota
- [ ] Drag-and-drop to move shifts between days/barbers
- [ ] Rota templates (save a week as a named template, apply to future weeks)
- [ ] Unpublish a rota (currently publish is one-way)
- [ ] Barber view — barber sees only their own shifts (currently hidden in grid; consider a dedicated "My Shifts" view)

### Documents
- [ ] Upload from the Team drawer directly (currently redirects to Documents page)
- [ ] Delete document

### General Polish
- [ ] PWA manifest + service worker (installable on phone)
- [ ] Mobile layout audit (rota grid is wide — consider card view on small screens)
- [ ] Empty states and loading skeletons throughout
- [ ] Audit log for key actions (leave approvals, rota publishes, barber changes)

---

## Suggestions

- **Bulk shift entry** — apply the same shift (e.g. 9–18) to all barbers for a whole day in one click
- **"My Shifts" barber view** — a simple list/calendar of upcoming shifts for the logged-in barber, optimised for mobile
- **Print / export rota** — generate a printable PDF or simple HTML view of the week's rota
- **Leave calendar view** — show approved leave as a calendar overlay on the rota grid so managers can see clashes at a glance
- **Dashboard stats widget** — shifts this week, pending leave requests, pending swaps at a glance
- **Repeat/recurring shifts** — mark a shift as repeating weekly so it auto-populates future weeks without copying
- **Google Calendar sync** — export rota to iCal / Google Calendar per barber
