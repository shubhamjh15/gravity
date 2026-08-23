-- ============================================================================
-- GRAVITY · Migration 0023 — Lock down room credentials (SECURITY FIX)
--
-- VULNERABILITY THIS CLOSES
--
-- RLS is ROW-level, not column-level. The "events: anon read public" policy
-- (0009) grants anonymous visitors every public event row, and Supabase's
-- default `grant all on all tables to anon, authenticated` handed them SELECT
-- on every COLUMN of that row — including room_id and room_password.
--
-- So this worked, unauthenticated, against the live database:
--
--     GET /rest/v1/events?select=room_id,room_password&status=eq.upcoming
--
-- Anyone could read the room password for every tournament without paying an
-- entry fee. That defeats the entire paid-players-only gate: the
-- `public_events` view and the `get_room_credentials` RPC were both built to
-- protect these columns, but nothing stopped a client querying the BASE TABLE
-- directly and asking for them by name.
--
-- SCHEMA.md §3 called for exactly this: "room_id/room_password must not be
-- selectable by the public — enforce via a column-filtered view or a dedicated
-- RPC". The view and RPC existed; the base-table grant was never revoked.
--
-- Found by 02_rls_money.test.sql the first time the pgTAP suites were run
-- against a real database.
--
-- THE FIX: column-level SELECT grants. Every column except the two secrets is
-- readable; the secrets are reachable only through get_room_credentials(),
-- which is SECURITY DEFINER and checks paid participation or ownership.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Rebuild the SELECT grant on public.events, column by column.
--
-- Done dynamically so the grant stays correct as columns are added. IMPORTANT:
-- any future secret column must be added to `secret_columns` below, or it will
-- be granted to the public along with everything else.
-- ----------------------------------------------------------------------------
do $$
declare
  secret_columns constant text[] := array['room_id', 'room_password'];
  visible_columns text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into visible_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'events'
    and column_name <> all (secret_columns);

  -- Drop the blanket grant first; a column grant does not override a table one.
  execute 'revoke select on public.events from anon, authenticated';

  execute format(
    'grant select (%s) on public.events to anon, authenticated',
    visible_columns
  );
end $$;

-- ----------------------------------------------------------------------------
-- Anonymous visitors have no business writing to events at all. RLS already
-- blocks it (no permissive policy for anon on write commands), but TRUNCATE in
-- particular is NOT subject to RLS, so the grant should not exist either.
-- Defence in depth: remove the capability, don't just filter it.
-- ----------------------------------------------------------------------------
revoke insert, update, delete, truncate on public.events from anon;
revoke truncate on public.events from authenticated;

-- ----------------------------------------------------------------------------
-- The same reasoning applies to every other table holding a secret or PII.
-- profiles_private is already RLS-restricted to owner/superadmin, but no role
-- should hold TRUNCATE on it, and anon should hold nothing at all.
-- ----------------------------------------------------------------------------
revoke all on public.profiles_private from anon;
revoke truncate on public.profiles_private from authenticated;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.admin_sessions from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.audit_log from anon;
revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- app_settings holds the platform's own commercials; superadmins read it
-- through RLS, and trusted server code through the service role.
revoke all on public.app_settings from anon;
revoke truncate on public.app_settings from authenticated;

-- The ledger is append-only via the RPC; nobody writes it directly (#3).
revoke insert, update, delete, truncate on public.ledger_entries from anon, authenticated;
revoke all on public.ledger_entries from anon;

comment on table public.events is
  'Tournament card + page. room_id/room_password are NOT granted to anon/authenticated (migration 0023) — read them only via get_room_credentials().';
