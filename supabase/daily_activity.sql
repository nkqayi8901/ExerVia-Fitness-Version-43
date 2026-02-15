create table if not exists daily_activity (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references user_profiles(id) on delete cascade,
  activity_date date not null,
  activity_type text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists daily_activity_user_day_type_key
  on daily_activity (user_id, activity_date, activity_type);

create index if not exists daily_activity_user_day_idx
  on daily_activity (user_id, activity_date desc);

alter table user_state
  add column if not exists streak_days integer not null default 0;

