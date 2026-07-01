-- ============================================================================
-- GRAVITY · Migration 0011 — Community domain
-- communities, community_members, memberships, community_posts,
-- community_gallery, elite_policies + chat (channels/members/messages) +
-- match_invites. Wires the deferred community FKs on events + ledger.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- communities — organizer-owned hubs
-- ----------------------------------------------------------------------------
create table public.communities (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles (id) on delete restrict,
  name                  text not null,
  slug                  citext not null unique,
  profile_pic_path      text,
  banner_path           text,
  about                 text,
  location              text,
  address               text,
  rules                 text,
  visibility            text not null default 'public' check (visibility in ('public','private')),
  is_paid               boolean not null default false,
  requires_approval     boolean not null default false,
  membership_cost_paise bigint not null default 0 check (membership_cost_paise >= 0),
  invite_slug           citext unique,
  is_featured           boolean not null default false,   -- admin-only (RLS)
  is_restricted         boolean not null default false,   -- admin-only (RLS)
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  remarks               text
);
comment on table public.communities is 'Organizer-owned community. is_featured/is_restricted are admin-only (protected in RLS).';

create trigger trg_communities_updated_at
  before update on public.communities for each row execute function public.set_updated_at();
create index idx_communities_owner on public.communities (owner_id);
create index idx_communities_featured on public.communities (is_featured) where is_featured = true;

-- ----------------------------------------------------------------------------
-- community_members — membership lifecycle + role
-- ----------------------------------------------------------------------------
create table public.community_members (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'active' check (status in ('pending','active','banned','left')),
  role         text not null default 'member' check (role in ('member','elite','moderator')),
  joined_via   text not null default 'direct' check (joined_via in ('direct','invite','paid')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (community_id, user_id)
);
create trigger trg_community_members_updated_at
  before update on public.community_members for each row execute function public.set_updated_at();
create index idx_community_members_comm on public.community_members (community_id);
create index idx_community_members_user on public.community_members (user_id);

-- ----------------------------------------------------------------------------
-- memberships — paid membership records -> ledger
-- ----------------------------------------------------------------------------
create table public.memberships (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete restrict,
  user_id         uuid not null references public.profiles (id) on delete restrict,
  amount_paise    bigint not null check (amount_paise >= 0),
  status          text not null default 'pending' check (status in ('pending','active','expired','cancelled')),
  razorpay_order_id text,
  ledger_entry_id uuid references public.ledger_entries (id) on delete set null,
  period_start    timestamptz,
  period_end      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_memberships_updated_at
  before update on public.memberships for each row execute function public.set_updated_at();
create index idx_memberships_comm on public.memberships (community_id);

-- ----------------------------------------------------------------------------
-- community_posts — feed (can reference an event)
-- ----------------------------------------------------------------------------
create table public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete restrict,
  body         text not null,
  event_id     uuid references public.events (id) on delete set null,
  pinned       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create trigger trg_community_posts_updated_at
  before update on public.community_posts for each row execute function public.set_updated_at();
create index idx_community_posts_comm on public.community_posts (community_id, created_at desc);

-- ----------------------------------------------------------------------------
-- community_gallery
-- ----------------------------------------------------------------------------
create table public.community_gallery (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  image_path   text not null,
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index idx_community_gallery_comm on public.community_gallery (community_id);

-- ----------------------------------------------------------------------------
-- elite_policies — per-community elite approval rules
-- ----------------------------------------------------------------------------
create table public.elite_policies (
  id              uuid primary key default gen_random_uuid(),
  community_id    uuid not null unique references public.communities (id) on delete cascade,
  requires_gov_id boolean not null default true,
  min_kill_ratio  numeric(6,2),
  rules           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_elite_policies_updated_at
  before update on public.elite_policies for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- chat — channels, members, messages (Supabase Realtime on messages)
-- ----------------------------------------------------------------------------
create table public.chat_channels (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities (id) on delete cascade,
  kind         text not null default 'community' check (kind in ('community','group','dm')),
  name         text,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  created_at   timestamptz not null default now()
);
create index idx_chat_channels_comm on public.chat_channels (community_id);

create table public.chat_members (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now(),
  unique (channel_id, user_id)
);
create index idx_chat_members_channel on public.chat_members (channel_id);
create index idx_chat_members_user on public.chat_members (user_id);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete restrict,
  body       text not null,
  created_at timestamptz not null default now()
);
create index idx_chat_messages_channel on public.chat_messages (channel_id, created_at desc);

-- ----------------------------------------------------------------------------
-- match_invites — 1v1 / small-group invites
-- ----------------------------------------------------------------------------
create table public.match_invites (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.profiles (id) on delete cascade,
  to_user     uuid not null references public.profiles (id) on delete cascade,
  game_id     uuid references public.games (id) on delete set null,
  status      text not null default 'invited' check (status in ('invited','accepted','declined','cancelled')),
  message     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_match_invites_updated_at
  before update on public.match_invites for each row execute function public.set_updated_at();
create index idx_match_invites_to on public.match_invites (to_user, status);

-- ----------------------------------------------------------------------------
-- Deferred FKs now that communities exist.
-- ----------------------------------------------------------------------------
alter table public.events
  add constraint fk_events_community
    foreign key (community_id) references public.communities (id) on delete set null;

alter table public.ledger_entries
  add constraint fk_ledger_community
    foreign key (community_id) references public.communities (id) on delete restrict,
  add constraint fk_ledger_membership
    foreign key (membership_id) references public.memberships (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- Enable RLS (policies in 0012)
-- ----------------------------------------------------------------------------
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.memberships       enable row level security;
alter table public.community_posts   enable row level security;
alter table public.community_gallery enable row level security;
alter table public.elite_policies    enable row level security;
alter table public.chat_channels     enable row level security;
alter table public.chat_members      enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.match_invites     enable row level security;
