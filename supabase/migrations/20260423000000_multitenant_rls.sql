-- Phase 3 (multi-tenant): RLS rewrite.
--
-- Every existing policy is dropped and recreated with an `org_id = my_org_id()`
-- guard layered on top of the original role logic. Superusers bypass via
-- `am_superuser() or ...` on every policy.
--
-- Existing behaviour for ROK (the only org today) is preserved: ROK users
-- continue to see ROK data exactly as before, because all their rows have
-- org_id = ROK.id and my_org_id() returns that for them.

begin;

-- =========================================================
-- 1. HELPER FUNCTIONS
-- =========================================================

create or replace function public.my_org_id()
returns uuid language sql security definer stable
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.am_superuser()
returns boolean language sql security definer stable
as $$
  select coalesce(is_superuser, false) from public.profiles where id = auth.uid();
$$;

-- my_role() and my_location_id() unchanged from initial schema.

-- =========================================================
-- 2. DROP EXISTING POLICIES
-- =========================================================

drop policy if exists "locations_read"               on public.locations;
drop policy if exists "locations_write"              on public.locations;

drop policy if exists "profiles_read"                on public.profiles;
drop policy if exists "profiles_update_own"          on public.profiles;
drop policy if exists "profiles_insert_manager"      on public.profiles;

drop policy if exists "employee_details_read"        on public.employee_details;
drop policy if exists "employee_details_write"       on public.employee_details;

drop policy if exists "rotas_read"                   on public.rotas;
drop policy if exists "rotas_write"                  on public.rotas;

drop policy if exists "shifts_read"                  on public.shifts;
drop policy if exists "shifts_write"                 on public.shifts;

drop policy if exists "leave_requests_read"          on public.leave_requests;
drop policy if exists "leave_requests_insert"        on public.leave_requests;
drop policy if exists "leave_requests_update"        on public.leave_requests;

drop policy if exists "shift_swaps_read"             on public.shift_swaps;
drop policy if exists "shift_swaps_insert"           on public.shift_swaps;
drop policy if exists "shift_swaps_update"           on public.shift_swaps;

drop policy if exists "documents_read"               on public.documents;
drop policy if exists "documents_write"              on public.documents;

drop policy if exists "notifications_read_own"       on public.notifications;
drop policy if exists "notifications_update_own"     on public.notifications;
drop policy if exists "notifications_insert_service" on public.notifications;

drop policy if exists "rota_templates_read"          on public.rota_templates;
drop policy if exists "rota_templates_insert"        on public.rota_templates;
drop policy if exists "rota_templates_update"        on public.rota_templates;
drop policy if exists "rota_templates_delete"        on public.rota_templates;

drop policy if exists "rota_template_shifts_read"    on public.rota_template_shifts;
drop policy if exists "rota_template_shifts_insert"  on public.rota_template_shifts;
drop policy if exists "rota_template_shifts_delete"  on public.rota_template_shifts;

-- =========================================================
-- 3. RECREATE WITH ORG GUARDS
-- =========================================================

-- ---- LOCATIONS ----
create policy "locations_read" on public.locations
  for select using (
    public.am_superuser() or org_id = public.my_org_id()
  );

create policy "locations_insert" on public.locations
  for insert with check (
    public.am_superuser()
    or (public.my_role() = 'admin' and org_id = public.my_org_id())
  );

create policy "locations_update" on public.locations
  for update using (
    public.am_superuser()
    or (public.my_role() = 'admin' and org_id = public.my_org_id())
  );

create policy "locations_delete" on public.locations
  for delete using (
    public.am_superuser()
    or (public.my_role() = 'admin' and org_id = public.my_org_id())
  );

-- ---- PROFILES ----
-- Users see profiles within their own org (needed for rota display).
create policy "profiles_read" on public.profiles
  for select using (
    public.am_superuser() or org_id = public.my_org_id()
  );

-- Users can update their own profile
create policy "profiles_update_own" on public.profiles
  for update using (
    public.am_superuser()
    or (auth.uid() = id and org_id = public.my_org_id())
  );

-- Admin/manager can insert profiles for their org
create policy "profiles_insert_manager" on public.profiles
  for insert with check (
    public.am_superuser()
    or (public.my_role() in ('admin', 'manager') and org_id = public.my_org_id())
  );

-- ---- EMPLOYEE DETAILS ----
create policy "employee_details_read" on public.employee_details
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      auth.uid() = id
      or public.my_role() = 'admin'
      or (
        public.my_role() = 'manager'
        and (select location_id from public.profiles where id = employee_details.id) = public.my_location_id()
      )
    ))
  );

create policy "employee_details_write" on public.employee_details
  for all using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() = 'admin'
      or (
        public.my_role() = 'manager'
        and (select location_id from public.profiles where id = employee_details.id) = public.my_location_id()
      )
    ))
  );

-- ---- ROTAS ----
create policy "rotas_read" on public.rotas
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() = 'admin'
      or location_id = public.my_location_id()
    ))
  );

create policy "rotas_write" on public.rotas
  for all using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() = 'admin'
      or (public.my_role() = 'manager' and location_id = public.my_location_id())
    ))
  );

-- ---- SHIFTS ----
create policy "shifts_read" on public.shifts
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() = 'admin'
      or employee_id = auth.uid()
      or (
        public.my_role() = 'manager'
        and (select location_id from public.rotas where id = shifts.rota_id) = public.my_location_id()
      )
    ))
  );

create policy "shifts_write" on public.shifts
  for all using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() = 'admin'
      or (
        public.my_role() = 'manager'
        and (select location_id from public.rotas where id = shifts.rota_id) = public.my_location_id()
      )
    ))
  );

-- ---- LEAVE REQUESTS ----
create policy "leave_requests_read" on public.leave_requests
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      employee_id = auth.uid()
      or public.my_role() = 'admin'
      or (
        public.my_role() = 'manager'
        and (select location_id from public.profiles where id = leave_requests.employee_id) = public.my_location_id()
      )
    ))
  );

create policy "leave_requests_insert" on public.leave_requests
  for insert with check (
    public.am_superuser()
    or (employee_id = auth.uid() and org_id = public.my_org_id())
  );

create policy "leave_requests_update" on public.leave_requests
  for update using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() = 'admin'
      or (
        public.my_role() = 'manager'
        and (select location_id from public.profiles where id = leave_requests.employee_id) = public.my_location_id()
      )
    ))
  );

-- ---- SHIFT SWAPS ----
create policy "shift_swaps_read" on public.shift_swaps
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      requester_id = auth.uid()
      or target_id = auth.uid()
      or public.my_role() in ('admin', 'manager')
    ))
  );

create policy "shift_swaps_insert" on public.shift_swaps
  for insert with check (
    public.am_superuser()
    or (requester_id = auth.uid() and org_id = public.my_org_id())
  );

create policy "shift_swaps_update" on public.shift_swaps
  for update using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() in ('admin', 'manager')
      or requester_id = auth.uid()
    ))
  );

-- ---- DOCUMENTS ----
create policy "documents_read" on public.documents
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      employee_id = auth.uid()
      or public.my_role() = 'admin'
      or (
        public.my_role() = 'manager'
        and (select location_id from public.profiles where id = documents.employee_id) = public.my_location_id()
      )
    ))
  );

create policy "documents_write" on public.documents
  for all using (
    public.am_superuser()
    or (org_id = public.my_org_id() and (
      public.my_role() in ('admin', 'manager')
      or employee_id = auth.uid()
    ))
  );

-- ---- NOTIFICATIONS ----
-- Users read/update their own; service role inserts for them (server-side).
create policy "notifications_read_own" on public.notifications
  for select using (
    public.am_superuser()
    or (recipient_id = auth.uid() and org_id = public.my_org_id())
  );

create policy "notifications_update_own" on public.notifications
  for update using (
    public.am_superuser()
    or (recipient_id = auth.uid() and org_id = public.my_org_id())
  );

-- Insert: kept intentionally permissive because API routes run as service
-- role (bypasses RLS). User-scoped clients have no legitimate reason to
-- create notifications for other users; if they ever do, require same-org.
create policy "notifications_insert_service" on public.notifications
  for insert with check (
    public.am_superuser() or org_id = public.my_org_id()
  );

-- ---- ROTA TEMPLATES ----
create policy "rota_templates_read" on public.rota_templates
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() in ('admin', 'manager'))
  );

create policy "rota_templates_insert" on public.rota_templates
  for insert with check (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() = 'admin')
  );

create policy "rota_templates_update" on public.rota_templates
  for update using (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() = 'admin')
  );

create policy "rota_templates_delete" on public.rota_templates
  for delete using (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() = 'admin')
  );

-- ---- ROTA TEMPLATE SHIFTS ----
create policy "rota_template_shifts_read" on public.rota_template_shifts
  for select using (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() in ('admin', 'manager'))
  );

create policy "rota_template_shifts_insert" on public.rota_template_shifts
  for insert with check (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() = 'admin')
  );

create policy "rota_template_shifts_delete" on public.rota_template_shifts
  for delete using (
    public.am_superuser()
    or (org_id = public.my_org_id() and public.my_role() = 'admin')
  );

commit;
