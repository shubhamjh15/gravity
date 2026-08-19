-- ============================================================================
-- GRAVITY · Migration 0018 — Announcements + Featured placements
--
-- Both tables are specified in SCHEMA.md §7 and referenced by ROADMAP 3.8 and
-- 6.1, but existed in NO migration — the schema doc and the database had
-- silently diverged. This closes that gap.
--
--   announcements       — the "Announcement from the Admin" banner. Scoped
--                         global / community / event, with an active window.
--   featured_placements — curated hype/deal slots on the landing + listings.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- announcements
--
-- scope_id is intentionally a bare uuid rather than an FK: one column cannot
-- reference three different tables, and a CHECK keeps the pairing honest
-- (global must have no target; community/event must have one).
-- ----------------------------------------------------------------------------
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('global', 'community', 'event')),
  scope_id    uuid,
  title       text not null,
  body        text,
  level       text not null default 'info' check (level in ('info', 'warning', 'critical')),
  active_from timestamptz not null default now(),
  active_to   timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),
  deleted_at  timestamptz,
  remarks     text,

  constraint announcements_scope_target check (
    (scope = 'global' and scope_id is null)
    or (scope in ('community', 'event') and scope_id is not null)
  ),
  constraint announcements_window check (
    active_to is null or active_to > active_from
  )
);

comment on table public.announcements is
  'Admin/community announcements with an active window. scope_id targets a community or event; null for global.';

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- The hot path is "what is live right now for this scope".
create index idx_announcements_live
  on public.announcements (scope, scope_id, active_from desc)
  where deleted_at is null;

-- ----------------------------------------------------------------------------
-- featured_placements
-- ----------------------------------------------------------------------------
create table public.featured_placements (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('event', 'community')),
  target_id  uuid not null,
  reason     text not null default 'hype' check (reason in ('hype', 'deal', 'partner')),
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),

  -- One placement per target: re-featuring updates rather than duplicates.
  unique (kind, target_id)
);

comment on table public.featured_placements is
  'Curated featured slots for events/communities. Superadmin-only writes (#2: placement is a platform decision).';

create trigger trg_featured_placements_updated_at
  before update on public.featured_placements
  for each row execute function public.set_updated_at();

create index idx_featured_active
  on public.featured_placements (kind, sort_order)
  where active = true;

-- ----------------------------------------------------------------------------
-- RLS — deny-by-default, then the minimum each role needs (#4)
-- ----------------------------------------------------------------------------
alter table public.announcements       enable row level security;
alter table public.featured_placements enable row level security;

-- Read: anyone may see an announcement that is live right now. Authors and
-- superadmins additionally see scheduled/expired/soft-deleted ones so they can
-- manage them.
create policy "announcements: public read live"
  on public.announcements for select
  using (
    (
      deleted_at is null
      and active_from <= now()
      and (active_to is null or active_to > now())
    )
    or public.is_superadmin(auth.uid())
    or (scope = 'community' and scope_id is not null and public.owns_community(scope_id, auth.uid()))
  );

-- Write: superadmin anywhere; a community owner only within their own community
-- (ROADMAP 3.8 "per-community announcements"). Event-scoped announcements are
-- superadmin-only for now — event owners get theirs via the community scope.
create policy "announcements: superadmin write"
  on public.announcements for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "announcements: community owner insert"
  on public.announcements for insert to authenticated
  with check (
    scope = 'community'
    and scope_id is not null
    and public.owns_community(scope_id, auth.uid())
  );

create policy "announcements: community owner update"
  on public.announcements for update to authenticated
  using (
    scope = 'community'
    and scope_id is not null
    and public.owns_community(scope_id, auth.uid())
  )
  with check (
    scope = 'community'
    and scope_id is not null
    and public.owns_community(scope_id, auth.uid())
  );

-- Featured placements: public read of active rows; superadmin writes only.
create policy "featured: public read active"
  on public.featured_placements for select
  using (active = true or public.is_superadmin(auth.uid()));

create policy "featured: superadmin write"
  on public.featured_placements for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));
