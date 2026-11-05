-- JARVIS Phase 1 foundation schema
-- Run in Supabase: SQL Editor → paste → Run  (or `supabase db push` with the CLI).
-- Every table is owned by a user and protected with Row Level Security.

create extension if not exists "pgcrypto";
create extension if not exists "vector";   -- prepared for Phase 3 (knowledge retrieval)

-- ─── Helpers ──────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Profiles & preferences ──────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Adebayo',
  default_mode text not null default 'normal',
  voice_enabled boolean not null default false,
  -- Proactive features (Phase 6) are off until the user turns them on.
  proactive_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Projects (workspaces) ───────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  status text not null default 'active' check (status in ('active','paused','done','archived')),
  vision text not null default '',
  next_action text not null default '',
  -- Flexible sections: { "Problem": "...", "Users": "...", "Competitors": "...", ... }
  sections jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id, updated_at desc);
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ─── Conversations & messages ────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New conversation',
  mode text not null default 'normal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists conversations_user_idx on public.conversations(user_id, updated_at desc);
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  mode text,
  -- Names/types of attachments sent with this message (file bytes are not stored in Phase 1).
  attachments jsonb not null default '[]'::jsonb,
  -- Web sources cited by the reply, if any.
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

-- ─── Long-term memory ────────────────────────────────────────────────
create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'identity','goals','projects','preferences','learning',
    'decisions','patterns','achievements','challenges'
  )),
  content text not null check (char_length(content) between 1 and 2000),
  importance smallint not null default 3 check (importance between 1 and 5),
  pinned boolean not null default false,
  source text not null default 'manual' check (source in ('manual','chat')),
  project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists memories_user_idx on public.memories(user_id, category, importance desc);
create trigger memories_touch before update on public.memories
  for each row execute function public.touch_updated_at();

-- ─── Knowledge library (prepared for Phase 3) ────────────────────────
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  storage_path text,           -- Supabase Storage object path
  mime_type text,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  page int,
  embedding vector(1024),      -- dimension depends on the embedding model chosen in Phase 3
  created_at timestamptz not null default now()
);

-- ─── Focus sessions (Daily Command Center) ───────────────────────────
create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task text not null,
  expected_outcome text not null default '',
  minutes smallint not null check (minutes in (25,45,60)),
  completed boolean,
  reflection text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists focus_user_idx on public.focus_sessions(user_id, started_at desc);

-- ─── Audit log (memory changes, deletions) ───────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity text not null,
  entity_id uuid,
  created_at timestamptz not null default now()
);

-- ─── Row Level Security: each user only sees their own rows ──────────
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.memories        enable row level security;
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;
alter table public.focus_sessions  enable row level security;
alter table public.audit_log       enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own memories" on public.memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own documents" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chunks" on public.document_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own focus" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Audit log is append-only from the app's point of view.
create policy "read own audit" on public.audit_log
  for select using (auth.uid() = user_id);
create policy "insert own audit" on public.audit_log
  for insert with check (auth.uid() = user_id);
