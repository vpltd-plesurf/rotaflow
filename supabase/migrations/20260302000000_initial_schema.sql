-- ROKRota Initial Schema
-- Run with: supabase db reset  (local) or apply in Supabase dashboard (cloud)

-- =========================================================
-- ENUMS
-- =========================================================

create type public.user_role as enum ('admin', 'manager', 'barber');
create type public.employee_status as enum ('active', 'inactive');
create type public.shift_status as enum ('scheduled', 'leave_block', 'swap_pending', 'cancelled');
create type public.leave_status as enum ('pending', 'approved', 'denied');
create type public.swap_status as enum ('pending', 'approved', 'denied');
create type public.doc_type as enum ('contract', 'insurance', 'id', 'other');

-- =========================================================
-- LOCATIONS
-- =========================================================

create table public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  address    text,
  created_at timestamptz not null default now()
);

comment on table public.locations is 'Barbershop locations (shops + head office)';

-- =========================================================
-- PROFILES
-- Extends auth.users — created automatically on signup
-- or manually by admin when adding a barber
-- =========================================================

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null,
  phone        text,
  role         public.user_role not null default 'barber',
  location_id  uuid references public.locations(id) on delete set null,
  hourly_rate  numeric(8,2),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'User profile linked to auth.users. All staff have a profile.';

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'barber')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- EMPLOYEE DETAILS
-- Additional HR info for barber profiles
-- =========================================================

create table public.employee_details (
  id                      uuid primary key references public.profiles(id) on delete cascade,
  emergency_contact_name  text,
  emergency_contact_phone text,
  notes                   text,
  status                  public.employee_status not null default 'active'
);

comment on table public.employee_details is 'Extended HR info per employee (barbers). 1:1 with profiles.';

-- Auto-create employee_details when a barber profile is created
create or replace function public.handle_new_barber_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role = 'barber' then
    insert into public.employee_details (id, status)
    values (new.id, 'active')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_barber_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_barber_profile();

-- =========================================================
-- ROTAS
-- One rota per location per week (Mon–Sun)
-- =========================================================

create table public.rotas (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  week_start   date not null, -- always a Monday
  published    boolean not null default false,
  published_at timestamptz,
  created_by   uuid not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  unique (location_id, week_start)
);

create index idx_rotas_location_week on public.rotas(location_id, week_start);

-- =========================================================
-- SHIFTS
-- Individual shifts within a rota
-- =========================================================

create table public.shifts (
  id           uuid primary key default gen_random_uuid(),
  rota_id      uuid not null references public.rotas(id) on delete cascade,
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  role_label   text,
  notes        text,
  status       public.shift_status not null default 'scheduled',
  created_at   timestamptz not null default now()
);

create index idx_shifts_rota_id on public.shifts(rota_id);
create index idx_shifts_employee_date on public.shifts(employee_id, date);

-- =========================================================
-- LEAVE REQUESTS
-- Unpaid leave requests submitted by barbers
-- =========================================================

create table public.leave_requests (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  start_date   date not null,
  end_date     date not null,
  reason       text,
  status       public.leave_status not null default 'pending',
  reviewed_by  uuid references public.profiles(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);

create index idx_leave_requests_employee on public.leave_requests(employee_id);
create index idx_leave_requests_status on public.leave_requests(status);

-- =========================================================
-- SHIFT SWAPS
-- Barber-to-barber swap proposals, approved by manager
-- =========================================================

create table public.shift_swaps (
  id               uuid primary key default gen_random_uuid(),
  requester_id     uuid not null references public.profiles(id) on delete cascade,
  target_id        uuid references public.profiles(id),
  shift_id         uuid not null references public.shifts(id) on delete cascade,
  target_shift_id  uuid references public.shifts(id),
  message          text,
  status           public.swap_status not null default 'pending',
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_shift_swaps_requester on public.shift_swaps(requester_id);
create index idx_shift_swaps_status on public.shift_swaps(status);

-- =========================================================
-- DOCUMENTS
-- Files stored in Supabase Storage, metadata here
-- =========================================================

create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  file_path    text not null,  -- path in Supabase Storage
  file_name    text not null,
  file_size    bigint,
  doc_type     public.doc_type not null default 'other',
  uploaded_by  uuid not null references public.profiles(id),
  created_at   timestamptz not null default now()
);

create index idx_documents_employee on public.documents(employee_id);

-- =========================================================
-- NOTIFICATIONS
-- In-app notifications
-- =========================================================

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  type          text not null,
  message       text not null,
  link          text,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications(recipient_id, read);

-- =========================================================
-- ROW-LEVEL SECURITY
-- =========================================================

alter table public.locations        enable row level security;
alter table public.profiles         enable row level security;
alter table public.employee_details enable row level security;
alter table public.rotas            enable row level security;
alter table public.shifts           enable row level security;
alter table public.leave_requests   enable row level security;
alter table public.shift_swaps      enable row level security;
alter table public.documents        enable row level security;
alter table public.notifications    enable row level security;

-- Helper: get current user's role
create or replace function public.my_role()
returns public.user_role language sql security definer stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Helper: get current user's location_id
create or replace function public.my_location_id()
returns uuid language sql security definer stable
as $$
  select location_id from public.profiles where id = auth.uid();
$$;

-- ---- LOCATIONS ----
-- Everyone can read locations
create policy "locations_read" on public.locations
  for select using (true);

-- Only admins can modify
create policy "locations_write" on public.locations
  for all using (public.my_role() = 'admin');

-- ---- PROFILES ----
-- Users can read all profiles (needed for rota display)
create policy "profiles_read" on public.profiles
  for select using (true);

-- Users can update their own profile
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Admin/manager can insert profiles (creating barbers)
create policy "profiles_insert_manager" on public.profiles
  for insert with check (public.my_role() in ('admin', 'manager'));

-- ---- EMPLOYEE DETAILS ----
-- Barbers can read their own; managers see their location; admins see all
create policy "employee_details_read" on public.employee_details
  for select using (
    auth.uid() = id
    or public.my_role() = 'admin'
    or (
      public.my_role() = 'manager'
      and (select location_id from public.profiles where id = employee_details.id) = public.my_location_id()
    )
  );

create policy "employee_details_write" on public.employee_details
  for all using (
    public.my_role() = 'admin'
    or (
      public.my_role() = 'manager'
      and (select location_id from public.profiles where id = employee_details.id) = public.my_location_id()
    )
  );

-- ---- ROTAS ----
-- Barbers see rotas for their location
create policy "rotas_read" on public.rotas
  for select using (
    public.my_role() = 'admin'
    or location_id = public.my_location_id()
  );

-- Managers and admins can write rotas for their location
create policy "rotas_write" on public.rotas
  for all using (
    public.my_role() = 'admin'
    or (public.my_role() = 'manager' and location_id = public.my_location_id())
  );

-- ---- SHIFTS ----
-- Barbers can see shifts in their location's rotas
create policy "shifts_read" on public.shifts
  for select using (
    public.my_role() = 'admin'
    or employee_id = auth.uid()
    or (
      public.my_role() = 'manager'
      and (select location_id from public.rotas where id = shifts.rota_id) = public.my_location_id()
    )
  );

create policy "shifts_write" on public.shifts
  for all using (
    public.my_role() = 'admin'
    or (
      public.my_role() = 'manager'
      and (select location_id from public.rotas where id = shifts.rota_id) = public.my_location_id()
    )
  );

-- ---- LEAVE REQUESTS ----
-- Barbers see their own; managers see their location's; admins see all
create policy "leave_requests_read" on public.leave_requests
  for select using (
    employee_id = auth.uid()
    or public.my_role() = 'admin'
    or (
      public.my_role() = 'manager'
      and (select location_id from public.profiles where id = leave_requests.employee_id) = public.my_location_id()
    )
  );

-- Anyone can insert a leave request for themselves
create policy "leave_requests_insert" on public.leave_requests
  for insert with check (employee_id = auth.uid());

-- Only managers/admins can update (approve/deny)
create policy "leave_requests_update" on public.leave_requests
  for update using (
    public.my_role() = 'admin'
    or (
      public.my_role() = 'manager'
      and (select location_id from public.profiles where id = leave_requests.employee_id) = public.my_location_id()
    )
  );

-- ---- SHIFT SWAPS ----
create policy "shift_swaps_read" on public.shift_swaps
  for select using (
    requester_id = auth.uid()
    or target_id = auth.uid()
    or public.my_role() in ('admin', 'manager')
  );

create policy "shift_swaps_insert" on public.shift_swaps
  for insert with check (requester_id = auth.uid());

create policy "shift_swaps_update" on public.shift_swaps
  for update using (
    public.my_role() in ('admin', 'manager')
    or requester_id = auth.uid()
  );

-- ---- DOCUMENTS ----
-- Employees see their own; managers see their location's; admins see all
create policy "documents_read" on public.documents
  for select using (
    employee_id = auth.uid()
    or public.my_role() = 'admin'
    or (
      public.my_role() = 'manager'
      and (select location_id from public.profiles where id = documents.employee_id) = public.my_location_id()
    )
  );

create policy "documents_write" on public.documents
  for all using (
    public.my_role() in ('admin', 'manager')
    or employee_id = auth.uid()
  );

-- ---- NOTIFICATIONS ----
create policy "notifications_read_own" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (recipient_id = auth.uid());

-- Service role can insert notifications (from API routes)
create policy "notifications_insert_service" on public.notifications
  for insert with check (true);

-- =========================================================
-- STORAGE BUCKET for documents
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)  -- 10MB limit
on conflict (id) do nothing;

-- Storage RLS
create policy "documents_storage_upload" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );

create policy "documents_storage_read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );

create policy "documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
  );

-- =========================================================
-- SEED DATA (remove before production)
-- =========================================================

-- ROK Barbers locations (from RotaCloud export)
insert into public.locations (name, address) values
  ('ROK Brooklands',  '379 Fen St, Milton Keynes MK10 7NH'),
  ('ROK Unity Place', '200 Grafton Gate, Milton Keynes MK9 1UP'),
  ('ROK Westcroft',   'Unit 4 Morrisons, Wimborne Crs, Westcroft, Milton Keynes MK4 4DD'),
  ('Head Office',     'Milton Keynes');
