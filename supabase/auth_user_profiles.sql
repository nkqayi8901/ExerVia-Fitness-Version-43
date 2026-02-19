-- Auth + username migration for existing bigint-based profiles.
-- Keeps legacy user_profiles.id as the core key used across existing tables.

alter table public.user_profiles
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists display_name text,
  add column if not exists updated_at timestamp with time zone default now();

-- Backfill usernames for existing rows from full_name.
-- Example: "John Smith" -> "johnsmith", duplicates become "johnsmith2", "johnsmith3", etc.
with base as (
  select
    id,
    lower(regexp_replace(coalesce(nullif(trim(full_name), ''), 'athlete'), '[^a-z0-9]+', '', 'g')) as raw_base
  from public.user_profiles
  where username is null or trim(username) = ''
),
normalized as (
  select
    id,
    case
      when raw_base is null or raw_base = '' then 'athlete'
      else raw_base
    end as base_name
  from base
),
ranked as (
  select
    id,
    base_name,
    row_number() over (partition by base_name order by id) as seq
  from normalized
)
update public.user_profiles up
set username = case
  when ranked.seq = 1 then ranked.base_name
  else ranked.base_name || ranked.seq::text
end
from ranked
where up.id = ranked.id;

-- Ensure any remaining empty usernames become a deterministic fallback.
update public.user_profiles
set username = 'athlete' || id::text
where username is null or trim(username) = '';

-- Backfill display_name from full_name then username.
update public.user_profiles
set display_name = coalesce(nullif(trim(full_name), ''), username)
where display_name is null or trim(display_name) = '';

-- Case-insensitive unique indexes.
create unique index if not exists user_profiles_username_unique
  on public.user_profiles (lower(username));

create unique index if not exists user_profiles_email_unique
  on public.user_profiles (lower(email))
  where email is not null;

create unique index if not exists user_profiles_auth_user_id_unique
  on public.user_profiles (auth_user_id)
  where auth_user_id is not null;

-- Keep updated_at fresh.
create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();
