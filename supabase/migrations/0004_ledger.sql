-- ============================================================================
-- GRAVITY · Migration 0004 — The unified ledger (NON-NEGOTIABLE #3)
-- Every rupee that moves is ONE row in ledger_entries, written ONLY via the
-- write_ledger_entry() SECURITY DEFINER RPC. The whole revenue dashboard is a
-- GROUP BY on this table. Plus webhook_events for Razorpay idempotency (#5).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ledger_entries
-- ----------------------------------------------------------------------------
create table public.ledger_entries (
  id                  uuid primary key default gen_random_uuid(),

  entry_type          text not null check (entry_type in ('charge','payout','refund','fee','adjustment')),
  source_type         text not null check (source_type in (
                        'event_entry','membership','sponsorship','store',
                        'prize','platform_fee','organizer_profit','manual')),
  direction           text not null check (direction in ('in','out','internal')),

  amount_paise        bigint not null check (amount_paise >= 0),
  currency            text   not null default 'INR',
  status              text   not null default 'pending'
                        check (status in ('pending','captured','settled','failed','reversed')),

  -- nullable provenance FKs; all RESTRICT so money rows can't be orphaned.
  -- (FKs to event/community/etc. are added in later phase migrations via
  --  ALTER TABLE once those tables exist; user FK is available now.)
  user_id             uuid references public.profiles (id) on delete restrict,
  community_id        uuid,
  event_id            uuid,
  registration_id     uuid,
  store_order_id      uuid,
  membership_id       uuid,
  sponsor_id          uuid,
  organizer_id        uuid,

  razorpay_payment_id text,                 -- UNIQUE on charge rows (idempotency)
  related_entry_id    uuid references public.ledger_entries (id) on delete restrict,
  fee_rate_applied_bps int,
  meta                jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users (id)
);
comment on table public.ledger_entries is
  'The ONE money ledger. One row per rupee. Write ONLY via write_ledger_entry(). Dashboard = GROUP BY here.';

-- Idempotency: a captured charge from Razorpay appears at most once.
create unique index uq_ledger_rzp_payment
  on public.ledger_entries (razorpay_payment_id)
  where razorpay_payment_id is not null;

-- Dashboard / lookup indexes (planned in the spec).
create index idx_ledger_created_at      on public.ledger_entries (created_at);
create index idx_ledger_source_status   on public.ledger_entries (source_type, status);
create index idx_ledger_community       on public.ledger_entries (community_id);
create index idx_ledger_event           on public.ledger_entries (event_id);
create index idx_ledger_user            on public.ledger_entries (user_id);

alter table public.ledger_entries enable row level security;

-- RLS: users may read ledger rows that are THEIRS. Organizers read rows for
-- their own communities (community ownership check is added in the community
-- phase; for now: own rows). Superadmin reads everything. NO direct writes:
-- inserts happen only through the SECURITY DEFINER RPC below.
create policy "ledger: read own"
  on public.ledger_entries for select
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

-- (No INSERT/UPDATE/DELETE policy on purpose — deny-by-default. The RPC,
--  running as definer, bypasses RLS to insert.)

-- ----------------------------------------------------------------------------
-- write_ledger_entry — the ONLY sanctioned way to add a ledger row.
-- SECURITY DEFINER: runs with the function owner's rights, so callers don't
-- need direct INSERT on the table. Validates the enums + non-negative amount.
-- Returns the new row id.
-- ----------------------------------------------------------------------------
create or replace function public.write_ledger_entry(
  p_entry_type           text,
  p_source_type          text,
  p_direction            text,
  p_amount_paise         bigint,
  p_status               text default 'pending',
  p_currency             text default 'INR',
  p_user_id              uuid default null,
  p_community_id         uuid default null,
  p_event_id             uuid default null,
  p_registration_id      uuid default null,
  p_store_order_id       uuid default null,
  p_membership_id        uuid default null,
  p_sponsor_id           uuid default null,
  p_organizer_id         uuid default null,
  p_razorpay_payment_id  text default null,
  p_related_entry_id     uuid default null,
  p_fee_rate_applied_bps int  default null,
  p_meta                 jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_amount_paise is null or p_amount_paise < 0 then
    raise exception 'write_ledger_entry: amount_paise must be >= 0 (got %)', p_amount_paise;
  end if;

  insert into public.ledger_entries (
    entry_type, source_type, direction, amount_paise, currency, status,
    user_id, community_id, event_id, registration_id, store_order_id,
    membership_id, sponsor_id, organizer_id,
    razorpay_payment_id, related_entry_id, fee_rate_applied_bps, meta, created_by
  ) values (
    p_entry_type, p_source_type, p_direction, p_amount_paise, p_currency, p_status,
    p_user_id, p_community_id, p_event_id, p_registration_id, p_store_order_id,
    p_membership_id, p_sponsor_id, p_organizer_id,
    p_razorpay_payment_id, p_related_entry_id, p_fee_rate_applied_bps, p_meta, auth.uid()
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    -- Duplicate razorpay_payment_id => idempotent no-op: return existing id.
    select id into v_id from public.ledger_entries
    where razorpay_payment_id = p_razorpay_payment_id
    limit 1;
    return v_id;
end;
$$;

comment on function public.write_ledger_entry is
  'ONLY sanctioned ledger insert. SECURITY DEFINER. Idempotent on razorpay_payment_id.';

-- Lock down who can execute the RPC: authenticated users + service role.
revoke all on function public.write_ledger_entry from public;
grant execute on function public.write_ledger_entry to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- webhook_events — raw Razorpay payloads + event-id dedupe (#5 one path).
-- ----------------------------------------------------------------------------
create table public.webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  provider           text not null default 'razorpay',
  razorpay_event_id  text unique,            -- dedupe key
  event_type         text,
  payload            jsonb not null,
  signature_valid    boolean not null default false,
  processing_status  text not null default 'received'
                        check (processing_status in ('received','processed','failed','ignored')),
  error_detail       text,
  received_at        timestamptz not null default now(),
  processed_at       timestamptz
);
comment on table public.webhook_events is 'Raw payment-provider webhooks + idempotency. Money settles only from here.';

create index idx_webhook_status on public.webhook_events (processing_status);

alter table public.webhook_events enable row level security;
-- Only superadmin can read; the webhook route uses the service role to write.
create policy "webhook_events: superadmin read"
  on public.webhook_events for select
  to authenticated
  using (public.is_superadmin(auth.uid()));
