-- Run this AFTER auth_user_profiles.sql
-- Purpose:
-- 1) Guarantee every profile has a valid username
-- 2) Enforce username format + NOT NULL
-- 3) Auto-generate username on inserts/updates when missing

-- Step 1: normalize existing usernames and repair invalid/short/null values
-- Valid target format: lowercase letters + numbers only, length 3..32
with normalized as (
  select
    id,
    lower(regexp_replace(coalesce(username, ''), '[^a-z0-9]+', '', 'g')) as cleaned
  from public.user_profiles
),
repaired as (
  select
    id,
    case
      when cleaned = '' or length(cleaned) < 3 then 'athlete' || id::text
      else left(cleaned, 32)
    end as candidate
  from normalized
),
ranked as (
  select
    id,
    candidate,
    row_number() over (partition by candidate order by id) as seq
  from repaired
)
update public.user_profiles up
set username = case
  when ranked.seq = 1 then ranked.candidate
  else left(ranked.candidate, 28) || ranked.seq::text
end
from ranked
where up.id = ranked.id;

-- Step 2: trigger to normalize + auto-fill username/display_name
create or replace function public.normalize_user_profile_fields()
returns trigger
language plpgsql
as $$
declare
  base_name text;
begin
  -- Normalize incoming username
  if new.username is not null then
    new.username := lower(regexp_replace(new.username, '[^a-z0-9]+', '', 'g'));
  end if;

  -- Auto-generate if missing/too short
  if new.username is null or new.username = '' or length(new.username) < 3 then
    -- id is normally available in BEFORE INSERT for bigserial-backed rows
    if new.id is not null then
      new.username := 'athlete' || new.id::text;
    else
      -- fallback in rare cases
      base_name := lower(regexp_replace(coalesce(new.full_name, 'athlete'), '[^a-z0-9]+', '', 'g'));
      if base_name = '' or length(base_name) < 3 then
        new.username := 'athlete' || floor(extract(epoch from now()))::bigint::text;
      else
        new.username := left(base_name, 32);
      end if;
    end if;
  end if;

  -- Cap length
  new.username := left(new.username, 32);

  -- Ensure display_name always has a human-readable value
  if new.display_name is null or btrim(new.display_name) = '' then
    new.display_name := coalesce(nullif(btrim(new.full_name), ''), new.username);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_profiles_normalize on public.user_profiles;
create trigger trg_user_profiles_normalize
before insert or update on public.user_profiles
for each row
execute function public.normalize_user_profile_fields();

-- Step 3: enforce hard constraints
alter table public.user_profiles
  alter column username set not null;

alter table public.user_profiles
  drop constraint if exists user_profiles_username_format_chk;

alter table public.user_profiles
  add constraint user_profiles_username_format_chk
  check (username ~ '^[a-z0-9]{3,32}$');

