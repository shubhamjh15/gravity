-- ============================================================================
-- GRAVITY · Migration 0019 — Event revenue split + organizer ledger visibility
--
-- BUGS THIS FIXES:
--
-- 1. platform_fee and organizer_profit ledger rows were NEVER written. The
--    prize structure stores both, the engine computes both, the admin revenue
--    dashboard has labels for both, and the organizer dashboard filters for
--    organizer_profit — but nothing ever created the rows. Organizer profit
--    read ₹0 forever and the platform's own cut appeared nowhere in the ledger,
--    so the split that lib/prize.ts validates to the paise was never actually
--    recorded against the money it came from.
--
-- 2. Ledger RLS was never widened for organizers. 0004's own comment says the
--    community-ownership check "is added in the community phase" — it never
--    was. The policy stayed `user_id = auth.uid()`, so an organizer querying
--    their own event's ledger rows got nothing back regardless of the filter.
--
-- Entry fees already entered the ledger as 'event_entry' charges with
-- direction 'in'. Slicing that pool into admin cut and organizer profit is a
-- RE-SLICE of money already counted, so both rows use direction 'internal',
-- which SCHEMA.md §8 defines as excluded from gross. Recording them as 'in'
-- would double-count platform revenue.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Idempotency backstop: an event's split may be recorded at most once. The RPC
-- below checks first; this index makes a concurrent double-publish impossible.
-- ----------------------------------------------------------------------------
create unique index if not exists uq_ledger_event_split
  on public.ledger_entries (event_id, source_type)
  where event_id is not null
    and source_type in ('platform_fee', 'organizer_profit');

-- ----------------------------------------------------------------------------
-- write_ledger_entry's unique-violation handler assumed the only unique index
-- was the razorpay one, so ANY unique violation returned NULL instead of
-- failing. With uq_ledger_event_split added that would silently swallow a real
-- error. Re-raise unless we can actually resolve the existing payment row.
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
    -- Idempotent replay of a Razorpay capture: return the row we already have.
    if p_razorpay_payment_id is not null then
      select id into v_id from public.ledger_entries
      where razorpay_payment_id = p_razorpay_payment_id
      limit 1;

      if v_id is not null then
        return v_id;
      end if;
    end if;

    -- Any other collision is a real problem — do not swallow it.
    raise;
end;
$$;

comment on function public.write_ledger_entry is
  'ONLY sanctioned ledger insert. SECURITY DEFINER. Idempotent on razorpay_payment_id; re-raises every other unique violation.';

revoke all on function public.write_ledger_entry from public;
grant execute on function public.write_ledger_entry to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- settle_event_split — record an event's admin cut + organizer profit once.
--
-- Called at result-publish, when the paid count (and therefore the real
-- collected pool, after any under-fill scaling) is finally known. Amounts come
-- from lib/prize.ts, the single engine that computes them.
-- ----------------------------------------------------------------------------
create or replace function public.settle_event_split(
  p_event_id               uuid,
  p_admin_cut_paise        bigint,
  p_organizer_profit_paise bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
begin
  if p_event_id is null then
    raise exception 'settle_event_split: event_id is required';
  end if;
  if coalesce(p_admin_cut_paise, 0) < 0 or coalesce(p_organizer_profit_paise, 0) < 0 then
    raise exception 'settle_event_split: amounts must be >= 0';
  end if;

  select * into v_event from public.events where id = p_event_id;
  if not found then
    raise exception 'settle_event_split: event % not found', p_event_id;
  end if;

  -- Already recorded? Publishing twice must not double the platform's books.
  if exists (
    select 1 from public.ledger_entries
    where event_id = p_event_id
      and source_type in ('platform_fee', 'organizer_profit')
  ) then
    return;
  end if;

  if coalesce(p_admin_cut_paise, 0) > 0 then
    perform public.write_ledger_entry(
      p_entry_type   => 'fee',
      p_source_type  => 'platform_fee',
      p_direction    => 'internal',
      p_amount_paise => p_admin_cut_paise,
      p_status       => 'settled',
      p_event_id     => p_event_id,
      p_community_id => v_event.community_id,
      p_organizer_id => v_event.organizer_id,
      p_meta         => jsonb_build_object('reason', 'event_result_lock')
    );
  end if;

  if coalesce(p_organizer_profit_paise, 0) > 0 then
    perform public.write_ledger_entry(
      p_entry_type   => 'adjustment',
      p_source_type  => 'organizer_profit',
      p_direction    => 'internal',
      p_amount_paise => p_organizer_profit_paise,
      p_status       => 'settled',
      p_event_id     => p_event_id,
      p_community_id => v_event.community_id,
      p_organizer_id => v_event.organizer_id,
      p_user_id      => v_event.organizer_id,
      p_meta         => jsonb_build_object('reason', 'event_result_lock')
    );
  end if;
end;
$$;

comment on function public.settle_event_split is
  'Record an event''s admin cut + organizer profit as internal ledger rows, once. Called at result-publish.';

revoke all on function public.settle_event_split(uuid, bigint, bigint) from public;
grant execute on function public.settle_event_split(uuid, bigint, bigint) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Widen ledger reads to the scopes a user legitimately owns (the check 0004
-- deferred). Still deny-by-default for everyone else, and still no write
-- policy — inserts happen only through the SECURITY DEFINER RPC.
-- ----------------------------------------------------------------------------
drop policy if exists "ledger: read own" on public.ledger_entries;

create policy "ledger: read own or owned scope"
  on public.ledger_entries for select
  to authenticated
  using (
    user_id = auth.uid()
    or organizer_id = auth.uid()
    or (event_id is not null and public.owns_event(event_id, auth.uid()))
    or (community_id is not null and public.owns_community(community_id, auth.uid()))
    or public.is_superadmin(auth.uid())
  );
