-- ExerVia RLS Audit Script
-- Run in Supabase SQL editor on production environment.

-- 1) Tables in public schema without RLS enabled.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname not like 'pg_%'
  and c.relrowsecurity = false
order by c.relname;

-- 2) Tables with RLS enabled but no policies.
with public_tables as (
  select c.oid, c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity = true
)
select t.relname as table_name
from public_tables t
left join pg_policy p on p.polrelid = t.oid
where p.polname is null
order by t.relname;

-- 3) Policy inventory by table and command.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  permissive,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- 4) Broad public-write policy warning (manual review).
-- Finds policies granting INSERT/UPDATE/DELETE to public with "true" checks.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and cmd in ('INSERT', 'UPDATE', 'DELETE')
  and (
    roles::text ilike '%public%'
    or roles::text ilike '%anon%'
  )
  and (
    coalesce(qual, '') = 'true'
    or coalesce(with_check, '') = 'true'
  )
order by tablename, cmd, policyname;

