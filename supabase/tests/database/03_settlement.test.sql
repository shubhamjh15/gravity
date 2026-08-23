-- ============================================================================
-- GRAVITY · Integrity tests — derived state
--
-- Covers the three recompute paths added in migrations 0016/0017/0019, each of
-- which replaced a bug where a value was either never written or accumulated
-- instead of derived:
--   * player_stats  (0016) — was never written at all
--   * store orders  (0017) — amount_paid never derived, installments never
--                            advanced, stock never decremented
--   * event split   (0019) — platform_fee / organizer_profit never recorded
--
-- Each is asserted to be IDEMPOTENT, because all three run from retry-prone
-- paths (a webhook redelivery, a re-publish).
--
-- Run:  supabase test db
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

\i supabase/tests/database/00_helpers.sql

select tests.as_owner();

create temporary table t_ids (label text primary key, id uuid);
insert into t_ids values
  ('organizer', tests.create_user('org2@test.gravity', 'Org Two')),
  ('winner',    tests.create_user('win@test.gravity',  'Winner'));

select tests.share_fixture('t_ids');

select tests.grant_role((select id from t_ids where label = 'organizer'), 'organizer');

insert into public.games (slug, name, is_active)
values ('bgmi', 'BGMI', true)
on conflict (slug) do nothing;

create temporary table t_event as select gen_random_uuid() as id;
select tests.share_fixture('t_event');

insert into public.events (
  id, organizer_id, game_id, title, slug,
  entry_fee_paise, max_slots, status, visibility
)
select
  (select id from t_event),
  (select id from t_ids where label = 'organizer'),
  (select id from public.games where slug = 'bgmi'),
  'Split Cup', 'split-cup-test',
  4000, 50, 'completed', 'public';

-- ---------------------------------------------------------------------------
-- player_stats is derived from PUBLISHED results only (migration 0016)
-- ---------------------------------------------------------------------------

-- Provisional results must not move a public leaderboard.
insert into public.event_results (event_id, user_id, rank, kills, amount_paid_paise, status)
values (
  (select id from t_event),
  (select id from t_ids where label = 'winner'),
  1, 7, 70000, 'provisional'
);

select is(
  (select total_kills from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  0::bigint,
  'A PROVISIONAL result does not touch player_stats (organizer draft)'
);

-- Publishing does.
update public.event_results
set status = 'published'
where event_id = (select id from t_event);

select is(
  (select total_kills from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  7::bigint,
  'Publishing a result updates total_kills (0016 — was never written before)'
);

select is(
  (select total_wins from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  1::bigint,
  'A rank-1 finish counts as a win'
);

select is(
  (select total_matches from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  1::bigint,
  'Matches played counts published results'
);

-- Earnings come from the LEDGER, not from event_results.amount_paid_paise:
-- money won is not money moved until a payout settles (#3).
select is(
  (select net_earnings_paise from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  0::bigint,
  'Winnings are NOT counted as earnings before the payout settles (#3)'
);

select public.write_ledger_entry(
  p_entry_type   => 'payout',
  p_source_type  => 'prize',
  p_direction    => 'out',
  p_amount_paise => 70000,
  p_status       => 'settled',
  p_user_id      => (select id from t_ids where label = 'winner'),
  p_event_id     => (select id from t_event)
);

select is(
  (select net_earnings_paise from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  70000::bigint,
  'A settled prize payout raises net earnings'
);

-- Recompute is idempotent — it rebuilds, never accumulates.
select public.recompute_player_stats((select id from t_ids where label = 'winner'));
select public.recompute_player_stats((select id from t_ids where label = 'winner'));

select is(
  (select total_kills from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  7::bigint,
  'recompute_player_stats is idempotent — kills do not accumulate'
);

select is(
  (select net_earnings_paise from public.player_stats
   where user_id = (select id from t_ids where label = 'winner')),
  70000::bigint,
  'recompute_player_stats is idempotent — earnings do not accumulate'
);

-- The leaderboard rebuilt off the back of the publish.
select isnt_empty(
  $$ select 1 from public.leaderboard_snapshots
     where metric = 'kills' and scope = 'global' $$,
  'Publishing results rebuilt the leaderboard snapshots (0016 statement trigger)'
);

-- ---------------------------------------------------------------------------
-- Event revenue split is recorded once (migration 0019)
-- ---------------------------------------------------------------------------
select public.settle_event_split((select id from t_event), 11000, 30000);

select is(
  (select count(*)::int from public.ledger_entries
   where event_id = (select id from t_event)
     and source_type in ('platform_fee','organizer_profit')),
  2,
  'settle_event_split records the admin cut and the organizer profit'
);

select is(
  (select direction from public.ledger_entries
   where event_id = (select id from t_event) and source_type = 'platform_fee'),
  'internal',
  'The split is INTERNAL — it re-slices money already counted as gross'
);

-- Re-publishing must not double the books.
select public.settle_event_split((select id from t_event), 11000, 30000);

select is(
  (select count(*)::int from public.ledger_entries
   where event_id = (select id from t_event)
     and source_type in ('platform_fee','organizer_profit')),
  2,
  'settle_event_split is idempotent — a re-publish does not double the books'
);

-- ---------------------------------------------------------------------------
-- Store settlement derives, and commits stock once (migration 0017)
-- ---------------------------------------------------------------------------
create temporary table t_store as
select
  gen_random_uuid() as product_id,
  gen_random_uuid() as variant_id,
  gen_random_uuid() as order_id;

insert into public.store_products (id, name, slug, mrp_paise, sale_price_paise, allow_partial)
select product_id, 'Test Jersey', 'test-jersey-settle', 200000, 200000, true from t_store;

insert into public.store_variants (id, product_id, sku, name, price_paise)
select variant_id, product_id, 'TEST-SKU-1', 'Size M', 200000 from t_store;

insert into public.store_inventory (variant_id, stock)
select variant_id, 10 from t_store;

insert into public.store_orders (id, user_id, status, total_paise, is_partial)
select order_id, (select id from t_ids where label = 'winner'), 'pending', 200000, true
from t_store;

insert into public.store_order_items (order_id, variant_id, qty, unit_price_paise)
select order_id, variant_id, 2, 200000 from t_store;

insert into public.store_payment_schedule (order_id, due_paise, status)
select order_id, 100000, 'pending' from t_store;

-- First installment.
select public.settle_store_payment(
  (select order_id from t_store), 'pay_STORE_1', 100000
);

select is(
  (select status from public.store_orders where id = (select order_id from t_store)),
  'partially_paid',
  'Paying the first of two installments leaves the order PARTIALLY paid, not paid'
);

select is(
  (select stock from public.store_inventory where variant_id = (select variant_id from t_store)),
  8,
  'Stock is decremented by the ordered quantity on first capture'
);

-- Replay the same payment: idempotent, and stock must not fall again.
select public.settle_store_payment(
  (select order_id from t_store), 'pay_STORE_1', 100000
);

select is(
  (select stock from public.store_inventory where variant_id = (select variant_id from t_store)),
  8,
  'Replaying a webhook does not decrement stock a second time (#5)'
);

select * from finish();
rollback;
