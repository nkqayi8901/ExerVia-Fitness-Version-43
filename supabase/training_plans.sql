-- Training plan templates (global) and user plans (per user)
create table if not exists public.training_plan_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  goal text,
  summary text,
  default_focus text,
  duration_target integer,
  distance_target numeric,
  outline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent duplicate templates across seeds
create unique index if not exists uq_training_plan_templates_name_sport
  on public.training_plan_templates (name, sport);

create table if not exists public.user_training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.user_profiles (id) on delete cascade,
  name text not null,
  sport text not null,
  goal text,
  summary text,
  default_focus text,
  duration_target integer,
  distance_target numeric,
  outline jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_training_plan_templates_name on public.training_plan_templates (name);
create index if not exists idx_user_training_plans_user on public.user_training_plans (user_id);

-- Unified catalog view (templates + user plans)
create or replace view public.training_plan_catalog as
select
  id,
  name,
  sport,
  goal,
  summary,
  default_focus,
  duration_target,
  distance_target,
  outline,
  created_at,
  updated_at,
  null::bigint as user_id,
  'template'::text as source
from public.training_plan_templates
union all
select
  id,
  name,
  sport,
  goal,
  summary,
  default_focus,
  duration_target,
  distance_target,
  outline,
  created_at,
  updated_at,
  user_id,
  'user'::text as source
from public.user_training_plans;

-- Seed plan packs
insert into public.training_plan_templates
  (name, sport, goal, summary, default_focus, duration_target, distance_target, outline)
values
(
  'Hyrox Foundation',
  'hybrid',
  'Hybrid engine + strength endurance',
  '4-week build blending running, sled work, and stations.',
  'Race Prep',
  60,
  8,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Run 40 min','Sled push/pull technique','Burpee broad jumps')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Tempo 20 min','Wall balls + farmer carry','Row intervals')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Mixed station circuit','Run 50 min','Ski erg intervals')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Race simulation','Recovery 30 min','Mobility reset'))
  )
),
(
  'Hybrid Endurance',
  'hybrid',
  'Strength base + endurance conditioning',
  'Balanced week with strength intervals and longer cardio blocks.',
  'Base',
  55,
  6,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Strength density 30 min','Zone 2 35 min','Recovery 25 min')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Tempo 15 min','Carry + sled circuit','Endurance 50 min')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Speed ladder','Zone 2 45 min','Mobility reset')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Test day','Recovery 30 min','Endurance 60 min'))
  )
),
(
  '10K Build',
  'running',
  'Race-ready conditioning',
  '4-week rhythm with speed and tempo balance.',
  'Race Prep',
  45,
  7,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Base run 40 min','Intervals 6x2','Recovery 30 min')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Tempo 20 min','Hills 8x30','Long run 60 min')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Speed ladder','Base 45 min','Long run 70 min')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Race simulation','Recovery 25 min','Shakeout 20 min'))
  )
),
(
  'Trail Engine',
  'trail',
  'Endurance + elevation tolerance',
  'Strengthen legs, lungs, and cadence for off-road builds.',
  'Base',
  65,
  9,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Hills 6x60s','Easy run 30 min','Strength hike 40 min')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Tempo trail 25 min','Long trail 75 min','Mobility reset')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Descents technique','Endurance 60 min','Recovery 30 min')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Trail simulation','Recovery 30 min','Easy run 40 min'))
  )
),
(
  'Swim Economy',
  'swimming',
  'Form, aerobic base, and pacing',
  'Designed for steady endurance and clean mechanics.',
  'Base',
  50,
  null,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Technique 30 min','Steady 25 min','Kick set 20 min')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Pull buoy 30 min','Intervals 10x50','Recovery 20 min')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Tempo 20 min','Long swim 40 min','Mobility reset')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Test 400m','Recovery 20 min','Easy 30 min'))
  )
),
(
  'Cycling Power Base',
  'cycling',
  'Endurance plus torque work',
  'Builds aerobic base and leg power.',
  'Base',
  70,
  18,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Cadence 45 min','Hill repeats 6x2','Recovery 30 min')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Zone 2 60 min','Tempo 20 min','Core reset')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Power sprints 8x30s','Endurance 75 min','Recovery 30 min')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Test ride 45 min','Recovery 30 min','Easy spin 35 min'))
  )
),
(
  'Hybrid Engine Plus',
  'hybrid',
  'Strength + engine with tactical volume',
  'Built for hybrid athletes chasing balanced capacity.',
  'Tempo',
  60,
  8,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Carry ladder 20 min','Tempo run 25 min','Mobility reset')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Sled push 6x20m','Row 5x500','Recovery 25 min')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Mixed circuit 30 min','Easy run 30 min','Core reset')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Simulation day','Recovery 30 min','Easy 35 min'))
  )
),
(
  'Speed Ladder',
  'running',
  'Short-distance speed development',
  'Priming for races and fast finishes.',
  'Speed',
  40,
  5,
  jsonb_build_array(
    jsonb_build_object('week','Week 1','sessions',jsonb_build_array('Strides 10x20s','Tempo 15 min','Recovery 25 min')),
    jsonb_build_object('week','Week 2','sessions',jsonb_build_array('Intervals 12x200','Easy run 30 min','Mobility reset')),
    jsonb_build_object('week','Week 3','sessions',jsonb_build_array('Hills 10x20','Tempo 20 min','Recovery 25 min')),
    jsonb_build_object('week','Week 4','sessions',jsonb_build_array('Time trial','Recovery 20 min','Easy 25 min'))
  )
)
on conflict (name, sport) do nothing;
