-- Rota templates: save a week's shift pattern, apply to future weeks
-- =========================================================

create table public.rota_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz default now()
);

create table public.rota_template_shifts (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.rota_templates(id) on delete cascade,
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  day_index    smallint not null check (day_index between 0 and 6),  -- 0=Mon, 6=Sun
  start_time   text not null,
  end_time     text not null,
  role_label   text
);

create index idx_rota_templates_location on public.rota_templates(location_id);
create index idx_rota_template_shifts_template on public.rota_template_shifts(template_id);

-- RLS
alter table public.rota_templates enable row level security;
alter table public.rota_template_shifts enable row level security;

-- Templates: admin can do everything
create policy "rota_templates_read" on public.rota_templates
  for select using (public.my_role() in ('admin', 'manager'));

create policy "rota_templates_insert" on public.rota_templates
  for insert with check (public.my_role() = 'admin');

create policy "rota_templates_update" on public.rota_templates
  for update using (public.my_role() = 'admin');

create policy "rota_templates_delete" on public.rota_templates
  for delete using (public.my_role() = 'admin');

-- Template shifts: follow parent template permissions
create policy "rota_template_shifts_read" on public.rota_template_shifts
  for select using (
    exists (
      select 1 from public.rota_templates t
      where t.id = template_id
      and public.my_role() in ('admin', 'manager')
    )
  );

create policy "rota_template_shifts_insert" on public.rota_template_shifts
  for insert with check (public.my_role() = 'admin');

create policy "rota_template_shifts_delete" on public.rota_template_shifts
  for delete using (public.my_role() = 'admin');
