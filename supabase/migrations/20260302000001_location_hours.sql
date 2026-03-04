-- Add shop hours to locations
-- opening_time / closing_time used as defaults when creating shifts
-- lunch_duration_mins used to calculate AM/PM half-day split

alter table public.locations
  add column opening_time     time    not null default '09:00',
  add column closing_time     time    not null default '17:00',
  add column lunch_duration_mins integer not null default 60;
