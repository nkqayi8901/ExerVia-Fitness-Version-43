-- Program templates (global) and user programs (per user)
create table if not exists public.program_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text,
  focus text,
  description text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_programs (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.user_profiles (id) on delete cascade,
  name text not null,
  level text,
  focus text,
  description text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_program_templates_name on public.program_templates (name);
create index if not exists idx_user_programs_user on public.user_programs (user_id);

-- Optional seed templates
insert into public.program_templates (name, level, focus, description, exercises)
values
(
  'Classic Glute Day',
  'Beginner',
  'Lower Body',
  'Glutes and posterior chain with clean fundamentals.',
  jsonb_build_array(
    jsonb_build_object('name','Barbell Hip Thrust','sets',4,'reps',8,'type','weights'),
    jsonb_build_object('name','Romanian Deadlift','sets',3,'reps',10,'type','weights'),
    jsonb_build_object('name','Bulgarian Split Squat','sets',3,'reps',10,'type','weights'),
    jsonb_build_object('name','Glute Bridge','sets',3,'reps',12,'type','weights')
  )
),
(
  'Advanced Push Day',
  'Advanced',
  'Push',
  'Heavy press focus with accessory volume.',
  jsonb_build_array(
    jsonb_build_object('name','Bench Press','sets',5,'reps',5,'type','weights'),
    jsonb_build_object('name','Overhead Press','sets',4,'reps',6,'type','weights'),
    jsonb_build_object('name','Incline Dumbbell Press','sets',3,'reps',10,'type','weights'),
    jsonb_build_object('name','Triceps Pushdown','sets',3,'reps',12,'type','weights')
  )
),
(
  'Beginner Shoulders + Chest',
  'Beginner',
  'Upper Body',
  'Low-stress push session to build confidence.',
  jsonb_build_array(
    jsonb_build_object('name','Dumbbell Shoulder Press','sets',3,'reps',10,'type','weights'),
    jsonb_build_object('name','Incline Push-up','sets',3,'reps',12,'type','bodyweight'),
    jsonb_build_object('name','Cable Fly','sets',3,'reps',12,'type','weights'),
    jsonb_build_object('name','Lateral Raise','sets',2,'reps',15,'type','weights')
  )
),
(
  'Leg Day',
  'Intermediate',
  'Lower Body',
  'Squat, hinge, and pump to finish.',
  jsonb_build_array(
    jsonb_build_object('name','Back Squat','sets',4,'reps',6,'type','weights'),
    jsonb_build_object('name','Deadlift','sets',3,'reps',5,'type','weights'),
    jsonb_build_object('name','Leg Press','sets',3,'reps',10,'type','weights'),
    jsonb_build_object('name','Walking Lunge','sets',2,'reps',12,'type','weights')
  )
);
