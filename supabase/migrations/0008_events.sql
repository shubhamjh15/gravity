-- ============================================================================
-- GRAVITY · Migration 0008 — Tournament domain (the core loop)
-- events, registrations, prize_structures, event_results, payouts.
-- Communities don't exist yet (Phase 3) so community_id is a plain uuid here
-- and gets its FK in the community migration. Money rules: paise everywhere,
-- slot reservation is atomic (RPC), payouts are dup-guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- events — the card + the page
-- ----------------------------------------------------------------------------
create table public.events (
  id                     uuid primary key default gen_random_uuid(),
  organizer_id           uuid not null references public.profiles (id) on delete restrict,
  community_id           uuid,                         -- FK added in Phase 3
  game_id                uuid not null references public.games (id) on delete restrict,
  title                  text not null,
  slug                   citext not null unique,
  banner_path            text,
  description            text,
  dos_and_donts          text,
  rules                  text,
  registration_schema    jsonb not null default '[]'::jsonb,  -- dynamic fields
  entry_fee_paise        bigint not null default 0 check (entry_fee_paise >= 0),
  max_slots              int not null default 100 check (max_slots > 0),
  visibility             text not null default 'public' check (visibility in ('public','private')),
  status                 text not null default 'draft'
                           check (status in ('draft','upcoming','ongoing','completed','archived','cancelled')),
  requires_approval      boolean not null default false,
  gov_id_required        boolean not null default false,
  -- room credentials: revealed only to paid players via RPC (never selected publicly)
  room_id                text,
  room_password          text,
  room_released_at       timestamptz,
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  starts_at              timestamptz,
  ends_at                timestamptz,
  created_at             timestamptz not null default now(),
  created_by             uuid references auth.users (id),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  remarks                text
);
comment on table public.events is 'Tournament card + page. room_id/room_password must never be selected by the public (use get_room_credentials RPC).';

create trigger trg_events_updated_at
  before update on public.events for each row execute function public.set_updated_at();

create index idx_events_status   on public.events (status) where deleted_at is null;
create index idx_events_game     on public.events (game_id);
create index idx_events_organizer on public.events (organizer_id);
create index idx_events_community on public.events (community_id);
create index idx_events_starts    on public.events (starts_at);

-- ----------------------------------------------------------------------------
-- prize_structures — per-event economics (one per event)
-- rank_prizes_paise: jsonb { "1": 70000, "2": 30000, ... } in paise.
-- ----------------------------------------------------------------------------
create table public.prize_structures (
  id                     uuid primary key default gen_random_uuid(),
  event_id               uuid not null unique references public.events (id) on delete cascade,
  entry_fee_paise        bigint not null default 0 check (entry_fee_paise >= 0),
  rank_prizes_paise      jsonb not null default '{}'::jsonb,
  per_kill_paise         bigint not null default 0 check (per_kill_paise >= 0),
  kill_budget_cap_paise  bigint not null default 0 check (kill_budget_cap_paise >= 0),
  admin_cut_paise        bigint not null default 0 check (admin_cut_paise >= 0),
  organizer_profit_paise bigint not null default 0 check (organizer_profit_paise >= 0),
  fill_policy            text not null default 'scale_down' check (fill_policy in ('scale_down','guaranteed')),
  kill_surplus_policy    text not null default 'to_organizer'
                           check (kill_surplus_policy in ('to_organizer','to_admin','to_prize','destroy')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger trg_prize_structures_updated_at
  before update on public.prize_structures for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- registrations — per-player lifecycle + slot reservation (TTL) + form_data
-- ----------------------------------------------------------------------------
create table public.registrations (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete restrict,
  status              text not null default 'slot_held'
                        check (status in ('slot_held','paid','confirmed','cancelled','refunded','waitlisted','rejected')),
  slot_held_until     timestamptz,                  -- TTL; swept by cron
  form_data           jsonb not null default '{}'::jsonb,
  razorpay_order_id   text,
  ledger_entry_id     uuid references public.ledger_entries (id) on delete set null,
  approved_by         uuid references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (event_id, user_id)                        -- no duplicate registrations
);
comment on table public.registrations is 'Per-player registration + payment lifecycle. Slot reservation is atomic (reserve_slot RPC).';

create trigger trg_registrations_updated_at
  before update on public.registrations for each row execute function public.set_updated_at();

create index idx_registrations_event on public.registrations (event_id);
create index idx_registrations_user  on public.registrations (user_id);
create index idx_registrations_status on public.registrations (event_id, status);

-- ----------------------------------------------------------------------------
-- event_results — final standings (rank + kills) + screenshot + amounts
-- ----------------------------------------------------------------------------
create table public.event_results (
  id                         uuid primary key default gen_random_uuid(),
  event_id                   uuid not null references public.events (id) on delete cascade,
  user_id                    uuid not null references public.profiles (id) on delete restrict,
  rank                       int,
  kills                      int not null default 0 check (kills >= 0),
  amount_paid_paise          bigint not null default 0 check (amount_paid_paise >= 0),
  leaderboard_screenshot_path text,                 -- private bucket
  status                     text not null default 'provisional' check (status in ('provisional','published')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (event_id, user_id)
);
create trigger trg_event_results_updated_at
  before update on public.event_results for each row execute function public.set_updated_at();
create index idx_event_results_event on public.event_results (event_id);

-- ----------------------------------------------------------------------------
-- payouts — winner payout records (manual UPI v1) with dup guard
-- ----------------------------------------------------------------------------
create table public.payouts (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events (id) on delete restrict,
  user_id         uuid not null references public.profiles (id) on delete restrict,
  upi_id          text,
  amount_paise    bigint not null check (amount_paise >= 0),
  status          text not null default 'pending' check (status in ('pending','paid','failed')),
  utr             text,
  approved_by     uuid references auth.users (id),
  ledger_entry_id uuid references public.ledger_entries (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_payouts_updated_at
  before update on public.payouts for each row execute function public.set_updated_at();

-- duplicate-payout guard: at most one PAID payout per (event,user).
create unique index uq_payout_paid_once
  on public.payouts (event_id, user_id) where status = 'paid';
create index idx_payouts_event on public.payouts (event_id);

-- ----------------------------------------------------------------------------
-- Deferred ledger FKs: now that events/registrations exist, wire them up.
-- (community/membership/etc. added in their own phases.)
-- ----------------------------------------------------------------------------
alter table public.ledger_entries
  add constraint fk_ledger_event
    foreign key (event_id) references public.events (id) on delete restrict,
  add constraint fk_ledger_registration
    foreign key (registration_id) references public.registrations (id) on delete restrict;

-- ----------------------------------------------------------------------------
-- Enable RLS (policies in 0009)
-- ----------------------------------------------------------------------------
alter table public.events           enable row level security;
alter table public.prize_structures enable row level security;
alter table public.registrations    enable row level security;
alter table public.event_results    enable row level security;
alter table public.payouts          enable row level security;
