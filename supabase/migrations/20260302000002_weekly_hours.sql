-- Replace single opening_time/closing_time with per-day weekly schedule
alter table public.locations
  drop column opening_time,
  drop column closing_time,
  add column weekly_hours jsonb not null default '{
    "mon": {"open": "09:00", "close": "17:30", "closed": false},
    "tue": {"open": "09:00", "close": "17:30", "closed": false},
    "wed": {"open": "09:00", "close": "17:30", "closed": false},
    "thu": {"open": "09:00", "close": "17:30", "closed": false},
    "fri": {"open": "09:00", "close": "17:30", "closed": false},
    "sat": {"open": "09:00", "close": "17:30", "closed": false},
    "sun": {"open": "10:00", "close": "16:00", "closed": true}
  }';
