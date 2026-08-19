-- ============================================================================
-- GRAVITY · test helpers
--
-- Loaded by every test file. Provides a way to "become" a user so RLS is
-- actually exercised.
--
-- IMPORTANT: RLS is bypassed by the table owner and by superusers. A test that
-- forgets `set local role authenticated` will PASS while proving nothing. Every
-- assertion below goes through tests.login_as() or tests.logout(), which set
-- both the role and the JWT claim auth.uid() reads.
-- ============================================================================

create schema if not exists tests;

/**
 * Act as a signed-in user for the rest of the transaction.
 * Mirrors what PostgREST does per request: sets the role and the JWT claims
 * that auth.uid() / auth.role() read from.
 */
create or replace function tests.login_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aud', 'authenticated'
    )::text,
    true            -- local: reverts at the end of the transaction
  );
  execute 'set local role authenticated';
end;
$$;

/** Act as an anonymous visitor (the `anon` role, no JWT subject). */
create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('role', 'anon', 'aud', 'authenticated')::text,
    true
  );
  execute 'set local role anon';
end;
$$;

/**
 * Drop back to the owning role so a test can set up fixtures.
 *
 * `reset role`, not `set role postgres`: once login_as() has switched to
 * `authenticated`, that role isn't a member of `postgres` and couldn't switch
 * back. `reset role` returns to the SESSION role, which is whoever connected.
 */
create or replace function tests.as_owner()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end;
$$;

/**
 * Create a confirmed auth user + the rows handle_new_user() would create.
 * Returns the new user id.
 */
create or replace function tests.create_user(
  p_email text,
  p_name  text default 'Test Player'
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, p_email, json_build_object('full_name', p_name)::jsonb);

  -- handle_new_user fires on that insert and creates profile / private row /
  -- player role / stats shell. Be defensive in case the trigger is absent.
  insert into public.profiles (id, email, display_name)
  values (v_id, p_email, p_name)
  on conflict (id) do nothing;

  insert into public.profiles_private (user_id)
  values (v_id)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (v_id, 'player')
  on conflict (user_id, role) do nothing;

  insert into public.player_stats (user_id)
  values (v_id)
  on conflict (user_id) do nothing;

  return v_id;
end;
$$;

/** Grant a role directly (bypassing the superadmin-only RLS on user_roles). */
create or replace function tests.grant_role(p_user_id uuid, p_role text)
returns void
language plpgsql
as $$
begin
  insert into public.user_roles (user_id, role)
  values (p_user_id, p_role)
  on conflict (user_id, role) do nothing;
end;
$$;

-- A test spends most of its time AS `authenticated` or `anon`, and has to be
-- able to call these helpers (notably logout/as_owner) from there. Without
-- these grants a suite dies with "permission denied for schema tests" the
-- moment it switches role.
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

/**
 * Make a fixture table readable by the roles a test switches into.
 *
 * Temp tables are owned by the connecting role, so `authenticated` can't read
 * them — which looks exactly like an RLS failure and would be mistaken for a
 * real finding. Call this after creating each fixture table.
 */
create or replace function tests.share_fixture(p_table text)
returns void
language plpgsql
as $$
begin
  execute format('grant select on %I to anon, authenticated', p_table);
end;
$$;

grant execute on function tests.share_fixture(text) to anon, authenticated;
