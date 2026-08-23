-- ============================================================================
-- GRAVITY · RLS + integrity tests — the money system
-- (NON-NEGOTIABLES #1, #3, #4, #5)
--
-- Covers the four things CLAUDE.md names explicitly: ledger write discipline,
-- webhook/settlement idempotency, slot oversell, and payout duplication.
--
-- Run:  supabase test db
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

\i supabase/tests/database/00_helpers.sql

select tests.as_owner();

create temporary table t_ids (label text primary key, id uuid);
insert into t_ids values
  ('organizer', tests.create_user('org@test.gravity',  'Organizer')),
  ('player',    tests.create_user('p1@test.gravity',   'Player One')),
  ('rival',     tests.create_user('p2@test.gravity',   'Player Two')),
  ('admin',     tests.create_user('root@test.gravity', 'Root'));

select tests.share_fixture('t_ids');

select tests.grant_role((select id from t_ids where label = 'organizer'), 'organizer');
select tests.grant_role((select id from t_ids where label = 'admin'), 'superadmin');

-- A game + an event with 2 slots at ₹40, so oversell is easy to provoke.
insert into public.games (slug, name, is_active)
values ('free_fire', 'Free Fire', true)
on conflict (slug) do nothing;

create temporary table t_event as
select gen_random_uuid() as id;
select tests.share_fixture('t_event');

insert into public.events (
  id, organizer_id, game_id, title, slug,
  entry_fee_paise, max_slots, status, visibility,
  room_id, room_password
)
select
  (select id from t_event),
  (select id from t_ids where label = 'organizer'),
  (select id from public.games where slug = 'free_fire'),
  'Test Cup', 'test-cup-rls',
  4000, 2, 'upcoming', 'public',
  'ROOM-123', 'secret-pass';

-- ---------------------------------------------------------------------------
-- #3 — the ledger is write-only through the RPC
-- ---------------------------------------------------------------------------
select tests.login_as((select id from t_ids where label = 'player'));

select throws_ok(
  $$ insert into public.ledger_entries
       (entry_type, source_type, direction, amount_paise, status)
     values ('charge','event_entry','in', 100000, 'captured') $$,
  null, null,
  'A user CANNOT insert directly into ledger_entries (#3 — RPC is the only door)'
);

select is(
  (select count(*)::int from public.ledger_entries),
  0,
  'The ledger is still empty after the direct-insert attempt'
);

-- The RPC is the sanctioned path.
select tests.as_owner();

create temporary table t_ledger as
select public.write_ledger_entry(
  p_entry_type          => 'charge',
  p_source_type         => 'event_entry',
  p_direction           => 'in',
  p_amount_paise        => 4000,
  p_status              => 'captured',
  p_user_id             => (select id from t_ids where label = 'player'),
  p_event_id            => (select id from t_event),
  p_razorpay_payment_id => 'pay_TESTIDEMPOTENT'
) as id;

select tests.share_fixture('t_ledger');

select isnt(
  (select id from t_ledger), null,
  'write_ledger_entry creates a row'
);

-- #5 — replaying the same Razorpay payment must not double-charge.
select is(
  public.write_ledger_entry(
    p_entry_type          => 'charge',
    p_source_type         => 'event_entry',
    p_direction           => 'in',
    p_amount_paise        => 4000,
    p_status              => 'captured',
    p_user_id             => (select id from t_ids where label = 'player'),
    p_event_id            => (select id from t_event),
    p_razorpay_payment_id => 'pay_TESTIDEMPOTENT'
  ),
  (select id from t_ledger),
  'Replaying a razorpay_payment_id returns the SAME row (#5 idempotency)'
);

select is(
  (select count(*)::int from public.ledger_entries
   where razorpay_payment_id = 'pay_TESTIDEMPOTENT'),
  1,
  'Exactly one ledger row exists for that payment id — no double credit'
);

-- #1 — money can never be negative.
select throws_ok(
  $$ select public.write_ledger_entry(
       p_entry_type   => 'charge',
       p_source_type  => 'manual',
       p_direction    => 'in',
       p_amount_paise => -500
     ) $$,
  null, null,
  'write_ledger_entry rejects a negative amount (#1)'
);

-- ---------------------------------------------------------------------------
-- Ledger visibility — a player sees only their own rows
-- ---------------------------------------------------------------------------
select tests.login_as((select id from t_ids where label = 'rival'));

select is_empty(
  $$ select 1 from public.ledger_entries $$,
  'An uninvolved player reads NO ledger rows'
);

select tests.login_as((select id from t_ids where label = 'player'));

select is(
  (select count(*)::int from public.ledger_entries),
  1,
  'A player reads exactly their own ledger row'
);

-- The organizer reads rows for their own event (widened in migration 0019).
select tests.login_as((select id from t_ids where label = 'organizer'));

select isnt_empty(
  $$ select 1 from public.ledger_entries $$,
  'An organizer reads ledger rows for events they own (0019)'
);

-- ---------------------------------------------------------------------------
-- Room credentials are never publicly selectable (#4 / SCHEMA.md §3)
-- ---------------------------------------------------------------------------
select tests.logout();

-- REGRESSION TEST for the vulnerability migration 0023 closed.
--
-- RLS is row-level: the "events: anon read public" policy hands anon the whole
-- row, and Supabase's default table grant handed over every column with it —
-- so `?select=room_password` returned live passwords to anyone. 0023 revokes
-- the column grant, which makes this a hard permission ERROR rather than an
-- empty result.
select throws_ok(
  $$ select room_password from public.events $$,
  '42501',
  null,
  'An anonymous visitor CANNOT select room_password off events (0023)'
);

select throws_ok(
  $$ select room_id from public.events $$,
  '42501',
  null,
  'An anonymous visitor CANNOT select room_id off events (0023)'
);

-- ...while the non-secret columns stay public, so listings still work.
select lives_ok(
  $$ select id, title, status from public.events $$,
  'Non-secret event columns remain readable by anonymous visitors'
);

select lives_ok(
  $$ select id, title from public.public_events $$,
  'The public_events view still serves anonymous listings'
);

select tests.login_as((select id from t_ids where label = 'rival'));

-- The RPC returns an EMPTY set for someone not entitled (it doesn't raise),
-- which is the behaviour the app relies on to show "not available yet".
select is_empty(
  format(
    $$ select * from public.get_room_credentials(%L) $$,
    (select id from t_event)
  ),
  'A non-participant gets NO room credentials from the RPC'
);

-- ---------------------------------------------------------------------------
-- Slot oversell — reserve_slot must be atomic and bounded by max_slots
-- ---------------------------------------------------------------------------
select tests.as_owner();

insert into public.registrations (event_id, user_id, status)
values
  ((select id from t_event), (select id from t_ids where label = 'player'), 'confirmed'),
  ((select id from t_event), (select id from t_ids where label = 'rival'),  'confirmed');

-- The event holds 2 slots and both are taken; a third must be refused.
select tests.login_as((select id from t_ids where label = 'admin'));

select throws_ok(
  format(
    $$ select public.reserve_slot(%L, %L) $$,
    (select id from t_event),
    (select id from t_ids where label = 'admin')
  ),
  null, null,
  'reserve_slot refuses a third registration on a 2-slot event (no oversell)'
);

select is(
  (select count(*)::int from public.registrations
   where event_id = (select id from t_event)
     and status in ('slot_held','paid','confirmed')),
  2,
  'The event still holds exactly max_slots registrations'
);

-- A player cannot register twice.
select tests.as_owner();

select throws_ok(
  format(
    $$ insert into public.registrations (event_id, user_id, status)
       values (%L, %L, 'confirmed') $$,
    (select id from t_event),
    (select id from t_ids where label = 'player')
  ),
  null, null,
  'UNIQUE (event_id, user_id) blocks a duplicate registration'
);

-- ---------------------------------------------------------------------------
-- Duplicate-payout guard
-- ---------------------------------------------------------------------------
insert into public.payouts (event_id, user_id, amount_paise, status)
values (
  (select id from t_event),
  (select id from t_ids where label = 'player'),
  70000, 'paid'
);

select throws_ok(
  format(
    $$ insert into public.payouts (event_id, user_id, amount_paise, status)
       values (%L, %L, 70000, 'paid') $$,
    (select id from t_event),
    (select id from t_ids where label = 'player')
  ),
  null, null,
  'A winner cannot be paid twice for the same event (uq_payout_paid_once)'
);

-- A second PENDING row is still allowed (only PAID is unique).
select lives_ok(
  format(
    $$ insert into public.payouts (event_id, user_id, amount_paise, status)
       values (%L, %L, 1000, 'pending') $$,
    (select id from t_event),
    (select id from t_ids where label = 'rival')
  ),
  'A pending payout for a different winner is unaffected by the guard'
);

-- ---------------------------------------------------------------------------
-- #4 — RLS on every money table
-- ---------------------------------------------------------------------------
select ok(
  (select bool_and(rowsecurity)
   from pg_tables
   where schemaname = 'public'
     and tablename in (
       'ledger_entries', 'webhook_events', 'registrations',
       'payouts', 'event_results', 'prize_structures',
       'store_orders', 'store_payments', 'store_payment_schedule'
     )),
  'RLS is enabled on every money-bearing table (#4)'
);

select * from finish();
rollback;
