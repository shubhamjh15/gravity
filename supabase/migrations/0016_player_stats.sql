-- ============================================================================
-- GRAVITY · Migration 0016 — player_stats maintenance (result-lock)
--
-- BUG THIS FIXES: player_stats was created as a zero-filled shell on signup by
-- handle_new_user() and then NEVER written again — no trigger, no app write.
-- Everything downstream read zeros forever: the profile ("0 kills / ₹0 earned"),
-- the public player page, and refresh_leaderboard() — which rebuilds snapshots
-- FROM player_stats, so the leaderboard was permanently empty.
--
-- The fix, per ROADMAP 4.3 ("refresh on result-lock"):
--   * recompute_player_stats(uuid) recomputes one player's row from the two
--     sources of truth — published event_results (kills/wins/matches) and the
--     unified ledger (net earnings). It never accumulates deltas, so it is
--     idempotent and self-healing: a re-run always converges on the truth.
--   * A row trigger on event_results refreshes each affected player.
--   * A row trigger on ledger_entries refreshes on settled prize payouts.
--   * A STATEMENT trigger on event_results rebuilds the leaderboard exactly
--     once per publish (not once per winner), using a transition table.
--
-- Non-negotiable #1: money stays BIGINT paise throughout. #3: earnings are read
-- from ledger_entries, never from a parallel tally.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- recompute_player_stats — rebuild ONE player's aggregate row from scratch.
--
-- kills/wins/matches come from PUBLISHED results only: provisional results are
-- an organizer's draft and must never move a public leaderboard.
--
-- net_earnings_paise comes from the ledger — an actual settled prize payout —
-- not from event_results.amount_paid_paise. A won amount is not earnings until
-- the money has moved (payouts are manual in v1), and #3 makes the ledger the
-- single source for every rupee.
-- ----------------------------------------------------------------------------
create or replace function public.recompute_player_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  -- The stats row is created at signup, but be defensive: a backfill or an
  -- imported account may not have one.
  insert into public.player_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  update public.player_stats ps
  set total_kills        = r.kills,
      total_wins         = r.wins,
      total_matches      = r.matches,
      net_earnings_paise = l.earned
  from (
    select
      coalesce(sum(er.kills), 0)                             as kills,
      coalesce(count(*) filter (where er.rank = 1), 0)        as wins,
      coalesce(count(*), 0)                                   as matches
    from public.event_results er
    where er.user_id = p_user_id
      and er.status  = 'published'
  ) r,
  (
    select coalesce(sum(le.amount_paise), 0) as earned
    from public.ledger_entries le
    where le.user_id     = p_user_id
      and le.entry_type  = 'payout'
      and le.source_type = 'prize'
      and le.status      = 'settled'
  ) l
  where ps.user_id = p_user_id;
end;
$$;

comment on function public.recompute_player_stats is
  'Rebuild one player''s player_stats from published event_results + settled prize payouts in the ledger. Idempotent.';

revoke all on function public.recompute_player_stats(uuid) from public;
grant execute on function public.recompute_player_stats(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- Trigger: any change to a player's results refreshes that player.
--
-- Fires on the OLD user too on UPDATE, so correcting a mis-keyed result row
-- (wrong player) decrements the player it was taken away from.
-- ----------------------------------------------------------------------------
create or replace function public.trg_stats_after_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_player_stats(old.user_id);
    return old;
  end if;

  perform public.recompute_player_stats(new.user_id);

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.recompute_player_stats(old.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_event_results_stats on public.event_results;
create trigger trg_event_results_stats
  after insert or update or delete on public.event_results
  for each row execute function public.trg_stats_after_result();

-- ----------------------------------------------------------------------------
-- Trigger: a settled prize payout in the ledger updates net earnings.
--
-- Scoped tightly so ordinary charge rows (entry fees, store orders) don't cause
-- a needless recompute on every payment.
-- ----------------------------------------------------------------------------
create or replace function public.trg_stats_after_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and new.entry_type  = 'payout'
     and new.source_type = 'prize'
  then
    perform public.recompute_player_stats(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ledger_stats on public.ledger_entries;
create trigger trg_ledger_stats
  after insert or update on public.ledger_entries
  for each row execute function public.trg_stats_after_ledger();

-- ----------------------------------------------------------------------------
-- Statement trigger: rebuild the leaderboard ONCE per publish.
--
-- publishResults() flips every result row for an event in a single UPDATE, so a
-- row-level trigger would rebuild the whole leaderboard once per winner. A
-- statement trigger with a transition table does it once, and only when a row
-- actually landed in 'published'.
-- ----------------------------------------------------------------------------
create or replace function public.trg_leaderboard_after_results()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from newtab where status = 'published') then
    perform public.refresh_leaderboard();
  end if;
  return null;
end;
$$;

drop trigger if exists trg_event_results_leaderboard_upd on public.event_results;
create trigger trg_event_results_leaderboard_upd
  after update on public.event_results
  referencing new table as newtab
  for each statement execute function public.trg_leaderboard_after_results();

drop trigger if exists trg_event_results_leaderboard_ins on public.event_results;
create trigger trg_event_results_leaderboard_ins
  after insert on public.event_results
  referencing new table as newtab
  for each statement execute function public.trg_leaderboard_after_results();

-- ----------------------------------------------------------------------------
-- refresh_leaderboard was created in 0013 with default PUBLIC execute, which
-- let any anonymous caller trigger a full table rebuild. Lock it to the cron
-- role + trusted server code; the triggers above are SECURITY DEFINER and call
-- it regardless of the caller's grants.
-- ----------------------------------------------------------------------------
revoke all on function public.refresh_leaderboard() from public;
grant execute on function public.refresh_leaderboard() to service_role;

-- ----------------------------------------------------------------------------
-- Backfill: bring every existing player's stats in line with history. Safe to
-- re-run; costs one pass over players who have results or prize payouts.
-- ----------------------------------------------------------------------------
do $$
declare
  v_user uuid;
begin
  for v_user in
    select user_id from public.event_results where status = 'published'
    union
    select user_id from public.ledger_entries
      where entry_type = 'payout' and source_type = 'prize' and user_id is not null
  loop
    perform public.recompute_player_stats(v_user);
  end loop;

  perform public.refresh_leaderboard();
end $$;
