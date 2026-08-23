-- ============================================================================
-- GRAVITY · RLS negative tests — identity & PII (NON-NEGOTIABLES #2, #4, #6)
--
-- These are the tests CLAUDE.md asks for and the codebase did not have. They
-- assert what must NOT be possible, because a permissive RLS bug is invisible
-- from the app — every page still renders, it just shows the wrong person's
-- data.
--
-- Run:  supabase test db
-- ============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

\i supabase/tests/database/00_helpers.sql

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
select tests.as_owner();

create temporary table t_ids (label text primary key, id uuid);
insert into t_ids values
  ('alice', tests.create_user('alice@test.gravity', 'Alice')),
  ('bob',   tests.create_user('bob@test.gravity',   'Bob')),
  ('admin', tests.create_user('admin@test.gravity', 'Admin'));

-- Fixture tables are owned by the connecting role; the assertions below run as
-- `authenticated`/`anon` and must still be able to read them.
select tests.share_fixture('t_ids');

select tests.grant_role((select id from t_ids where label = 'admin'), 'superadmin');

-- Give both players PII to try to steal.
update public.profiles_private
set upi_id = 'alice@upi', phone = '9876500001'
where user_id = (select id from t_ids where label = 'alice');

update public.profiles_private
set upi_id = 'bob@upi', phone = '9876500002'
where user_id = (select id from t_ids where label = 'bob');

-- ---------------------------------------------------------------------------
-- #6 — profiles_private is unreachable by anyone but the owner / superadmin
-- ---------------------------------------------------------------------------
select tests.login_as((select id from t_ids where label = 'alice'));

select is(
  (select count(*)::int from public.profiles_private),
  1,
  'A player sees exactly one profiles_private row — their own'
);

select is_empty(
  format(
    $$ select 1 from public.profiles_private where user_id = %L $$,
    (select id from t_ids where label = 'bob')
  ),
  'A player CANNOT read another player''s profiles_private row (#6)'
);

-- An UPDATE filtered out by RLS affects ZERO rows; it does not raise. So the
-- meaningful assertion is that Bob's payout target is untouched afterwards —
-- asserting a throw would pass for the wrong reason.
update public.profiles_private
set upi_id = 'stolen@upi'
where user_id = (select id from t_ids where label = 'bob');

select tests.as_owner();

select is(
  (select upi_id from public.profiles_private
   where user_id = (select id from t_ids where label = 'bob')),
  'bob@upi',
  'A player cannot redirect another player''s UPI payout target'
);

select tests.login_as((select id from t_ids where label = 'alice'));

-- Anonymous visitors must not reach PII at all.
select tests.logout();

-- Stronger than an RLS filter since migration 0023: anon holds NO grant on this
-- table at all, so the read is refused outright rather than returning empty.
select throws_ok(
  $$ select 1 from public.profiles_private $$,
  '42501',
  null,
  'An anonymous visitor CANNOT read profiles_private at all (#6)'
);

-- Superadmin may read it (this is the audited path).
select tests.login_as((select id from t_ids where label = 'admin'));

select ok(
  (select count(*) from public.profiles_private) >= 2,
  'A superadmin can read profiles_private (audited reveal path)'
);

-- ---------------------------------------------------------------------------
-- #2 — user_roles is the only authz source and is NOT self-writable
-- ---------------------------------------------------------------------------
select tests.login_as((select id from t_ids where label = 'bob'));

select throws_ok(
  format(
    $$ insert into public.user_roles (user_id, role) values (%L, 'superadmin') $$,
    (select id from t_ids where label = 'bob')
  ),
  null,
  null,
  'A player CANNOT grant themselves superadmin (#2 — privilege escalation)'
);

select throws_ok(
  format(
    $$ insert into public.user_roles (user_id, role) values (%L, 'organizer') $$,
    (select id from t_ids where label = 'bob')
  ),
  null,
  null,
  'A player cannot self-promote to organizer'
);

select is(
  (select count(*)::int from public.user_roles
   where user_id = (select id from t_ids where label = 'bob')),
  1,
  'Bob still holds exactly one role (player) after both attempts'
);

select is_empty(
  format(
    $$ select 1 from public.user_roles where user_id = %L $$,
    (select id from t_ids where label = 'alice')
  ),
  'A player cannot enumerate another player''s roles'
);

-- profiles has no role column at all — the schema must never regain one.
select hasnt_column(
  'public', 'profiles', 'role',
  'profiles has NO role column (#2 — authz lives only in user_roles)'
);

-- ---------------------------------------------------------------------------
-- Public profile surface: readable, but only the safe columns exist there
-- ---------------------------------------------------------------------------
select tests.logout();

select isnt_empty(
  $$ select 1 from public.profiles $$,
  'Public profiles are readable by anonymous visitors (public player pages)'
);

select hasnt_column(
  'public', 'profiles', 'upi_id',
  'profiles carries no upi_id — PII is split into profiles_private (#6)'
);

select hasnt_column(
  'public', 'profiles', 'phone',
  'profiles carries no phone column (#6)'
);

-- ---------------------------------------------------------------------------
-- #4 — RLS is actually enabled on every identity table
-- ---------------------------------------------------------------------------
select tests.as_owner();

select ok(
  (select bool_and(rowsecurity)
   from pg_tables
   where schemaname = 'public'
     and tablename in (
       'profiles', 'profiles_private', 'user_roles',
       'player_game_profiles', 'player_documents', 'player_stats'
     )),
  'RLS is enabled on every identity table (#4 deny-by-default)'
);

-- player_stats must not be hand-editable: it is derived (migration 0016).
select tests.login_as((select id from t_ids where label = 'bob'));

update public.player_stats
set net_earnings_paise = 99999999
where user_id = (select id from t_ids where label = 'bob');

select is(
  (select net_earnings_paise from public.player_stats
   where user_id = (select id from t_ids where label = 'bob')),
  0::bigint,
  'A player cannot inflate their own earnings — player_stats is derived, not writable'
);

select * from finish();
rollback;
