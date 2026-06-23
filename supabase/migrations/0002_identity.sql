-- ============================================================================
-- GRAVITY · Migration 0002 — Identity domain
-- profiles, profiles_private, user_roles, games, player_game_profiles,
-- player_documents, player_stats + role helper functions + handle_new_user.
--
-- NON-NEGOTIABLES honoured here:
--  #2  user_roles is the ONLY authz source. No role column on profiles.
--  #6  PII (upi/phone/gov-id) lives in profiles_private, separate table.
-- RLS is enabled on every table; policies are added in migration 0003.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — public-safe identity, 1:1 with auth.users (id = auth.users.id)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text,
  avatar_path             text,
  banner_path             text,
  age                     int check (age is null or (age between 13 and 100)),
  gender                  text check (gender is null or gender in ('male','female','other','undisclosed')),
  email                   citext,
  profile_completion_pct  int  not null default 0 check (profile_completion_pct between 0 and 100),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  status                  text not null default 'active' check (status in ('active','suspended','deleted')),
  remarks                 text
);
comment on table public.profiles is 'Public-safe user identity. NO role column (see user_roles). PII lives in profiles_private.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- profiles_private — sensitive PII, owner/superadmin only (RLS in 0003)
-- ----------------------------------------------------------------------------
create table public.profiles_private (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  upi_id           text,
  phone            text,
  gov_id_type      text check (gov_id_type is null or gov_id_type in ('aadhaar','pan','dl','passport','voter')),
  gov_id_doc_path  text,
  kyc_status       text not null default 'pending' check (kyc_status in ('pending','verified','rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.profiles_private is 'Sensitive PII. Reachable ONLY by the owner or a superadmin. No public view may join this.';

create trigger trg_profiles_private_updated_at
  before update on public.profiles_private
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- user_roles — the single source of authorization truth (multi-role)
-- ----------------------------------------------------------------------------
create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('player','organizer','superadmin')),
  granted_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  unique (user_id, role)
);
comment on table public.user_roles is 'ONLY authz source. player implicit/default; organizer & superadmin are elevated. INSERT/UPDATE/DELETE = superadmin only.';

create index idx_user_roles_user on public.user_roles (user_id);

-- ----------------------------------------------------------------------------
-- Role helper functions (SECURITY DEFINER so RLS policies can call them
-- without recursing into user_roles' own RLS). search_path pinned for safety.
-- ----------------------------------------------------------------------------
create or replace function public.has_role(uid uuid, role_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = uid and ur.role = role_name
  );
$$;

create or replace function public.is_superadmin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(uid, 'superadmin');
$$;

create or replace function public.is_organizer(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(uid, 'organizer');
$$;

comment on function public.has_role(uuid, text) is 'True if the user holds the given role. SECURITY DEFINER to be callable inside RLS.';

-- ----------------------------------------------------------------------------
-- games — title lookup (FK, not an enum), so new titles need no schema change
-- ----------------------------------------------------------------------------
create table public.games (
  id          uuid primary key default gen_random_uuid(),
  slug        citext not null unique,
  name        text not null,
  icon_path   text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
comment on table public.games is 'Supported titles (Free Fire, BGMI, PUBG...). FK target, never an enum.';

-- ----------------------------------------------------------------------------
-- player_game_profiles — per-game identity & stats input
-- ----------------------------------------------------------------------------
create table public.player_game_profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  game_id          uuid not null references public.games (id) on delete restrict,
  in_game_id       text,
  ign              text,           -- in-game name
  ranking          text,
  kill_ratio       numeric(6,2),
  win_ratio        numeric(6,2),
  skill_proof_path text,           -- private bucket
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, game_id)
);

create trigger trg_pgp_updated_at
  before update on public.player_game_profiles
  for each row execute function public.set_updated_at();

create index idx_pgp_user on public.player_game_profiles (user_id);
create index idx_pgp_game on public.player_game_profiles (game_id);

-- ----------------------------------------------------------------------------
-- player_documents — gov-id / skill-proof uploads + review state
-- ----------------------------------------------------------------------------
create table public.player_documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  doc_type       text not null check (doc_type in ('gov_id','skill_proof','kill_ratio_proof','elite_pass_proof')),
  file_path      text not null,    -- private bucket
  review_status  text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  reviewed_by    uuid references auth.users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_player_documents_updated_at
  before update on public.player_documents
  for each row execute function public.set_updated_at();

create index idx_player_documents_user on public.player_documents (user_id);

-- ----------------------------------------------------------------------------
-- player_stats — aggregated, computed (feeds leaderboard + profile). 1:1.
-- Never hand-edited; updated by result-lock + cron.
-- ----------------------------------------------------------------------------
create table public.player_stats (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  total_kills        bigint not null default 0,
  total_wins         bigint not null default 0,
  total_matches      bigint not null default 0,
  net_earnings_paise bigint not null default 0 check (net_earnings_paise >= 0),
  updated_at         timestamptz not null default now()
);

create trigger trg_player_stats_updated_at
  before update on public.player_stats
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- handle_new_user — defensively create profile + default player role + stats
-- on signup. Triggered by auth.users INSERT (Supabase Auth).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- profile (public-safe)
  insert into public.profiles (id, email, display_name, avatar_path)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  -- empty private row (owner fills later)
  insert into public.profiles_private (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  -- default role: every new account is a player
  insert into public.user_roles (user_id, role)
  values (new.id, 'player')
  on conflict (user_id, role) do nothing;

  -- stats shell
  insert into public.player_stats (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is 'On signup: creates profile, empty profiles_private, default player role, and stats shell.';

-- ----------------------------------------------------------------------------
-- Enable RLS on every identity table (policies in 0003). Deny-by-default:
-- with RLS on and no policy, all access is denied except table owner.
-- ----------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.profiles_private      enable row level security;
alter table public.user_roles            enable row level security;
alter table public.games                 enable row level security;
alter table public.player_game_profiles  enable row level security;
alter table public.player_documents      enable row level security;
alter table public.player_stats          enable row level security;
