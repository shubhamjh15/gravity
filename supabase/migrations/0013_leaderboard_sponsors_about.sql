-- ============================================================================
-- GRAVITY · Migration 0013 — Leaderboard + Sponsors + About (Phase 4)
-- leaderboard_snapshots (materialized rankings), sponsors,
-- sponsorship_requests, about_pages. Plus the deferred sponsor FK on ledger.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- leaderboard_snapshots — precomputed rankings (read on the hot path)
-- metric × scope × period. Refreshed by cron + on result-lock.
-- ----------------------------------------------------------------------------
create table public.leaderboard_snapshots (
  id          uuid primary key default gen_random_uuid(),
  metric      text not null check (metric in ('kill_ratio','win_ratio','net_earnings','kills','wins')),
  scope       text not null check (scope in ('global','community','event')),
  scope_id    uuid,                       -- null for global
  period      text not null check (period in ('daily','monthly','yearly','all_time')),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  value       numeric not null default 0,
  rank        int not null,
  snapshot_at timestamptz not null default now()
);
create index idx_lb_lookup on public.leaderboard_snapshots (metric, scope, scope_id, period, rank);
create index idx_lb_user on public.leaderboard_snapshots (user_id);

-- ----------------------------------------------------------------------------
-- sponsors — published sponsor directory
-- ----------------------------------------------------------------------------
create table public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_path    text,
  website      text,
  details      text,
  community_id uuid references public.communities (id) on delete set null,
  published_by uuid references auth.users (id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_sponsors_updated_at
  before update on public.sponsors for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- sponsorship_requests — inbound requests routed to admin + community admin
-- ----------------------------------------------------------------------------
create table public.sponsorship_requests (
  id                  uuid primary key default gen_random_uuid(),
  sponsor_name        text not null,
  contact_email       text not null,
  contact_phone       text,
  details             text,
  budget_paise        bigint check (budget_paise is null or budget_paise >= 0),
  target_community_id uuid references public.communities (id) on delete set null,
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected','published')),
  routed_to           uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_sponsorship_requests_updated_at
  before update on public.sponsorship_requests for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- about_pages — single editable About page (Tiptap JSON) + gallery + company
-- ----------------------------------------------------------------------------
create table public.about_pages (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique default 'main',
  content_json    jsonb not null default '{}'::jsonb,   -- Tiptap doc
  gallery         jsonb not null default '[]'::jsonb,    -- [{path, caption}]
  company_details jsonb not null default '{}'::jsonb,
  updated_by      uuid references auth.users (id),
  updated_at      timestamptz not null default now()
);
create trigger trg_about_pages_updated_at
  before update on public.about_pages for each row execute function public.set_updated_at();

-- Deferred ledger FK now that sponsors exists.
alter table public.ledger_entries
  add constraint fk_ledger_sponsor
    foreign key (sponsor_id) references public.sponsors (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.leaderboard_snapshots enable row level security;
alter table public.sponsors              enable row level security;
alter table public.sponsorship_requests  enable row level security;
alter table public.about_pages           enable row level security;

-- leaderboard: public read.
create policy "leaderboard: public read" on public.leaderboard_snapshots for select using (true);
create policy "leaderboard: superadmin write"
  on public.leaderboard_snapshots for all to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));

-- sponsors: public read active; admin/community-owner write.
create policy "sponsors: public read"
  on public.sponsors for select
  using (is_active = true or public.is_superadmin(auth.uid()) or (community_id is not null and public.owns_community(community_id, auth.uid())));
create policy "sponsors: admin write"
  on public.sponsors for all to authenticated
  using (public.is_superadmin(auth.uid()) or (community_id is not null and public.owns_community(community_id, auth.uid())))
  with check (public.is_superadmin(auth.uid()) or (community_id is not null and public.owns_community(community_id, auth.uid())));

-- sponsorship_requests: anyone may submit; superadmin + targeted owner read/manage.
create policy "sponsorship_requests: anyone submit"
  on public.sponsorship_requests for insert with check (true);
create policy "sponsorship_requests: admin read"
  on public.sponsorship_requests for select to authenticated
  using (public.is_superadmin(auth.uid()) or (target_community_id is not null and public.owns_community(target_community_id, auth.uid())));
create policy "sponsorship_requests: admin manage"
  on public.sponsorship_requests for update to authenticated
  using (public.is_superadmin(auth.uid()) or (target_community_id is not null and public.owns_community(target_community_id, auth.uid())))
  with check (public.is_superadmin(auth.uid()) or (target_community_id is not null and public.owns_community(target_community_id, auth.uid())));

-- about: public read; superadmin write.
create policy "about: public read" on public.about_pages for select using (true);
create policy "about: superadmin write"
  on public.about_pages for all to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- refresh_leaderboard — recompute snapshots from player_stats (global/all_time)
-- + per-event from event_results. Called by cron + on result publish.
-- ----------------------------------------------------------------------------
create or replace function public.refresh_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Clear global all_time snapshots, rebuild from player_stats.
  delete from public.leaderboard_snapshots where scope = 'global' and period = 'all_time';

  -- net_earnings
  insert into public.leaderboard_snapshots (metric, scope, scope_id, period, user_id, value, rank)
  select 'net_earnings','global',null,'all_time', user_id, net_earnings_paise,
         row_number() over (order by net_earnings_paise desc)
  from public.player_stats where net_earnings_paise > 0;

  -- kills
  insert into public.leaderboard_snapshots (metric, scope, scope_id, period, user_id, value, rank)
  select 'kills','global',null,'all_time', user_id, total_kills,
         row_number() over (order by total_kills desc)
  from public.player_stats where total_kills > 0;

  -- wins
  insert into public.leaderboard_snapshots (metric, scope, scope_id, period, user_id, value, rank)
  select 'wins','global',null,'all_time', user_id, total_wins,
         row_number() over (order by total_wins desc)
  from public.player_stats where total_wins > 0;
end;
$$;
comment on function public.refresh_leaderboard is 'Rebuild global all-time leaderboard snapshots from player_stats. Cron + on result-lock.';
