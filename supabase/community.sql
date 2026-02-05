create table if not exists community_forums (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  topic_slug text unique,
  created_by bigint,
  created_at timestamptz default now()
);

create unique index if not exists community_forums_topic_slug_key
  on community_forums (topic_slug);

create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  forum_id uuid references community_forums(id) on delete cascade,
  title text not null,
  body text,
  created_by bigint references user_profiles(id),
  created_at timestamptz default now()
);

create table if not exists community_post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade,
  parent_id uuid references community_post_replies(id) on delete cascade,
  body text not null,
  created_by bigint references user_profiles(id),
  created_at timestamptz default now()
);

create table if not exists community_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references community_posts(id) on delete cascade,
  reply_id uuid references community_post_replies(id) on delete cascade,
  user_id bigint references user_profiles(id),
  reaction text not null,
  created_at timestamptz default now()
);

create index if not exists community_reactions_post_id_idx
  on community_reactions (post_id);

create index if not exists community_reactions_reply_id_idx
  on community_reactions (reply_id);

create table if not exists community_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal text,
  privacy text default 'invite',
  created_by bigint references user_profiles(id),
  created_at timestamptz default now()
);

create table if not exists community_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references community_groups(id) on delete cascade,
  user_id bigint references user_profiles(id),
  role text default 'member',
  created_at timestamptz default now()
);

create unique index if not exists community_group_members_group_user_key
  on community_group_members (group_id, user_id);

create table if not exists community_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references community_groups(id) on delete cascade,
  body text not null,
  created_by bigint references user_profiles(id),
  created_at timestamptz default now()
);

create table if not exists community_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text default 'distance',
  target_value numeric,
  duration_days integer default 7,
  created_by bigint references user_profiles(id),
  created_at timestamptz default now()
);

create table if not exists community_challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references community_challenges(id) on delete cascade,
  user_id bigint references user_profiles(id),
  progress numeric default 0,
  created_at timestamptz default now()
);

create unique index if not exists community_challenge_participants_challenge_user_key
  on community_challenge_participants (challenge_id, user_id);

create table if not exists community_friends (
  id uuid primary key default gen_random_uuid(),
  user_id bigint references user_profiles(id),
  friend_user_id bigint references user_profiles(id),
  status text default 'pending',
  created_at timestamptz default now()
);

alter table community_friends
  drop constraint if exists community_friends_user_order_check;

alter table community_friends
  add constraint community_friends_user_order_check
  check (user_id < friend_user_id);

create unique index if not exists community_friends_user_pair_key
  on community_friends (user_id, friend_user_id);

create table if not exists community_friend_messages (
  id uuid primary key default gen_random_uuid(),
  user_id bigint references user_profiles(id),
  friend_user_id bigint references user_profiles(id),
  body text not null,
  created_at timestamptz default now()
);

create index if not exists community_friend_messages_pair_idx
  on community_friend_messages (user_id, friend_user_id, created_at);

create table if not exists weekly_notes (
  id uuid primary key default gen_random_uuid(),
  user_id bigint references user_profiles(id),
  week_start date not null,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists weekly_notes_user_week_key
  on weekly_notes (user_id, week_start);
