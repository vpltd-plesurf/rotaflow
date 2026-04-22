-- Phase 1 (multi-tenant): organisations table + org_id on all user-data tables.
--
-- RLS policies for per-table org isolation are NOT rewritten here — that's
-- Phase 3. After this migration, existing policies continue to work (they
-- don't reference org_id). The org column is populated and enforced NOT NULL
-- so the app can start writing it; cross-org isolation is a later step.
--
-- All-or-nothing via explicit BEGIN/COMMIT.

begin;

-- =========================================================
-- 1. SUPERUSER FLAG ON PROFILES (must come before the
--    organisations policy that references it)
-- =========================================================

alter table public.profiles add column is_superuser boolean not null default false;

update public.profiles
  set is_superuser = true
  where id = (select id from auth.users where email = 'paul@rokbarbers.com');

-- =========================================================
-- 2. ORGANISATIONS
-- =========================================================

create type public.org_status as enum ('active', 'suspended', 'trial');

create table public.organisations (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,        -- DNS-safe tenant id (e.g. "rok" for rok.rokrota.com)
  name       text not null,               -- display name (e.g. "ROK Barbers")
  status     public.org_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  constraint organisations_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

comment on table public.organisations is 'Tenants. Every user-data row belongs to exactly one organisation.';

alter table public.organisations enable row level security;

-- Permissive read for now; tightened in Phase 3
create policy "organisations_read_all" on public.organisations
  for select using (true);

-- Only superusers can create/modify orgs via DB (signup flow uses service role)
create policy "organisations_write_superuser" on public.organisations
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_superuser = true)
  );

-- =========================================================
-- 3. SEED ROK ORG (so backfill has a target)
-- =========================================================

insert into public.organisations (slug, name) values ('rok', 'ROK Barbers');

-- =========================================================
-- 4. ADD org_id TO EVERY USER-DATA TABLE
-- =========================================================

alter table public.profiles              add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.locations             add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.employee_details      add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.rotas                 add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.shifts                add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.leave_requests        add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.shift_swaps           add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.documents             add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.notifications         add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.rota_templates        add column org_id uuid references public.organisations(id) on delete restrict;
alter table public.rota_template_shifts  add column org_id uuid references public.organisations(id) on delete restrict;

-- =========================================================
-- 5. BACKFILL EVERY ROW TO ROK
-- =========================================================

do $$
declare rok_id uuid := (select id from public.organisations where slug = 'rok');
begin
  update public.profiles              set org_id = rok_id;
  update public.locations             set org_id = rok_id;
  update public.employee_details      set org_id = rok_id;
  update public.rotas                 set org_id = rok_id;
  update public.shifts                set org_id = rok_id;
  update public.leave_requests        set org_id = rok_id;
  update public.shift_swaps           set org_id = rok_id;
  update public.documents             set org_id = rok_id;
  update public.notifications         set org_id = rok_id;
  update public.rota_templates        set org_id = rok_id;
  update public.rota_template_shifts  set org_id = rok_id;
end $$;

-- =========================================================
-- 6. ENFORCE NOT NULL + INDEXES
-- =========================================================

alter table public.profiles              alter column org_id set not null;
alter table public.locations             alter column org_id set not null;
alter table public.employee_details      alter column org_id set not null;
alter table public.rotas                 alter column org_id set not null;
alter table public.shifts                alter column org_id set not null;
alter table public.leave_requests        alter column org_id set not null;
alter table public.shift_swaps           alter column org_id set not null;
alter table public.documents             alter column org_id set not null;
alter table public.notifications         alter column org_id set not null;
alter table public.rota_templates        alter column org_id set not null;
alter table public.rota_template_shifts  alter column org_id set not null;

create index idx_profiles_org             on public.profiles(org_id);
create index idx_locations_org            on public.locations(org_id);
create index idx_employee_details_org     on public.employee_details(org_id);
create index idx_rotas_org                on public.rotas(org_id);
create index idx_shifts_org               on public.shifts(org_id);
create index idx_leave_requests_org       on public.leave_requests(org_id);
create index idx_shift_swaps_org          on public.shift_swaps(org_id);
create index idx_documents_org            on public.documents(org_id);
create index idx_notifications_org        on public.notifications(org_id);
create index idx_rota_templates_org       on public.rota_templates(org_id);
create index idx_rota_template_shifts_org on public.rota_template_shifts(org_id);

-- =========================================================
-- 7. UPDATE TRIGGERS TO CARRY org_id THROUGH
-- =========================================================
--
-- The handle_new_user() trigger creates a profile on auth.users insert but
-- doesn't know the org_id. Until Phase 5 (signup wizard) rewrites the flow,
-- new auth.users created outside the signup wizard would NULL-violate. Guard
-- by defaulting new profiles to the single ROK org — the only org that exists
-- pre-Phase-5 — so existing admin-invite flows keep working. The signup
-- wizard will overwrite org_id explicitly via raw_user_meta_data.org_id.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  default_org uuid;
begin
  select id into default_org from public.organisations where slug = 'rok';

  insert into public.profiles (id, full_name, role, org_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'barber'),
    coalesce((new.raw_user_meta_data->>'org_id')::uuid, default_org)
  );
  return new;
end;
$$;

-- Barber-details trigger — carry org_id from parent profile
create or replace function public.handle_new_barber_profile()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.role = 'barber' then
    insert into public.employee_details (id, status, org_id)
    values (new.id, 'active', new.org_id)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

commit;
