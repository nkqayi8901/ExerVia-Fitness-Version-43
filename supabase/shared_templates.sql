-- Shared community templates for plans, programs, and recipes.
create table if not exists public.shared_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null check (template_type in ('training_plan', 'workout_program', 'recipe')),
  source_id uuid,
  title text not null,
  subtitle text,
  goal text,
  summary text,
  sport text,
  level text,
  focus text,
  duration_target integer,
  distance_target numeric,
  tags text[] not null default '{}'::text[],
  payload jsonb not null default '{}'::jsonb,
  created_by bigint references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shared_templates_type on public.shared_templates (template_type);
create index if not exists idx_shared_templates_created_at on public.shared_templates (created_at desc);
create index if not exists idx_shared_templates_goal on public.shared_templates (goal);
create index if not exists idx_shared_templates_tags_gin on public.shared_templates using gin (tags);

create table if not exists public.shared_template_ratings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.shared_templates(id) on delete cascade,
  user_id bigint not null references public.user_profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists shared_template_ratings_template_user_key
  on public.shared_template_ratings (template_id, user_id);

create table if not exists public.shared_template_tries (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.shared_templates(id) on delete cascade,
  user_id bigint not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists shared_template_tries_template_user_key
  on public.shared_template_tries (template_id, user_id);

create table if not exists public.shared_template_comments (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.shared_templates(id) on delete cascade,
  user_id bigint not null references public.user_profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shared_template_comments_template
  on public.shared_template_comments (template_id, created_at desc);
