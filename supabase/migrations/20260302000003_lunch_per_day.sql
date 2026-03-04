-- Move lunch_mins into weekly_hours per day, drop global lunch_duration_mins
-- Update weekly_hours default to include lunch_mins per day with ROK Barbers schedule

alter table public.locations
  drop column lunch_duration_mins,
  alter column weekly_hours set default '{
    "mon": {"open": "09:00", "close": "18:00", "closed": false, "lunch_mins": 60},
    "tue": {"open": "09:00", "close": "18:00", "closed": false, "lunch_mins": 60},
    "wed": {"open": "09:00", "close": "18:00", "closed": false, "lunch_mins": 60},
    "thu": {"open": "09:00", "close": "18:00", "closed": false, "lunch_mins": 60},
    "fri": {"open": "09:00", "close": "19:00", "closed": false, "lunch_mins": 60},
    "sat": {"open": "09:00", "close": "16:00", "closed": false, "lunch_mins": 40},
    "sun": {"open": "10:00", "close": "16:00", "closed": true,  "lunch_mins": 30}
  }';

-- Backfill existing rows to add lunch_mins per day
update public.locations
set weekly_hours = weekly_hours
  || jsonb_build_object(
    'mon', (weekly_hours->'mon') || '{"lunch_mins": 60}'::jsonb,
    'tue', (weekly_hours->'tue') || '{"lunch_mins": 60}'::jsonb,
    'wed', (weekly_hours->'wed') || '{"lunch_mins": 60}'::jsonb,
    'thu', (weekly_hours->'thu') || '{"lunch_mins": 60}'::jsonb,
    'fri', (weekly_hours->'fri') || '{"lunch_mins": 60}'::jsonb,
    'sat', (weekly_hours->'sat') || '{"lunch_mins": 40}'::jsonb,
    'sun', (weekly_hours->'sun') || '{"lunch_mins": 30}'::jsonb
  );
