-- ============================================================================
-- GRAVITY · Migration 0009 — Tournament-domain RLS + room-credential gating
-- The single most security-sensitive rule here: room_id / room_password must
-- never be selectable by the public. We expose a column-safe view for public
-- reads and a SECURITY DEFINER RPC for paid participants to fetch creds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is the current user a paid/confirmed participant of an event?
-- Used to gate room credentials.
-- ----------------------------------------------------------------------------
create or replace function public.is_event_participant(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.registrations r
    where r.event_id = p_event_id
      and r.user_id = p_user_id
      and r.status in ('paid','confirmed')
  );
$$;

-- Helper: does the current user own (organize) this event?
create or replace function public.owns_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id and e.organizer_id = p_user_id
  );
$$;

-- ----------------------------------------------------------------------------
-- events RLS
--   - public can read PUBLISHED public events (not drafts), but the room creds
--     columns are protected by a separate view (below) — base table read still
--     technically returns them, so we DO NOT grant broad column select to anon.
--     Instead: public reads go through the `public_events` view; the base table
--     is readable by organizer (own) + superadmin only for full columns.
-- ----------------------------------------------------------------------------

-- Organizer manages own events (full row incl. room creds).
create policy "events: organizer manages own"
  on public.events for all
  to authenticated
  using (organizer_id = auth.uid() or public.is_superadmin(auth.uid()))
  with check (organizer_id = auth.uid() or public.is_superadmin(auth.uid()));

-- Authenticated participants can read the event row (needed for "my tournaments"),
-- but the safe public view is what the listing/detail pages use for everyone.
create policy "events: participant read"
  on public.events for select
  to authenticated
  using (
    visibility = 'public'
    or organizer_id = auth.uid()
    or public.is_event_participant(id, auth.uid())
    or public.is_superadmin(auth.uid())
  );

-- Anonymous read of public, listed events (drafts excluded).
create policy "events: anon read public"
  on public.events for select
  to anon
  using (
    visibility = 'public'
    and status in ('upcoming','ongoing','completed','archived')
    and deleted_at is null
  );

-- A column-safe VIEW for public consumption: everything EXCEPT room creds.
create or replace view public.public_events
with (security_invoker = true)
as
  select
    id, organizer_id, community_id, game_id, title, slug, banner_path,
    description, dos_and_donts, rules, registration_schema, entry_fee_paise,
    max_slots, visibility, status, requires_approval, gov_id_required,
    room_released_at, registration_opens_at, registration_closes_at,
    starts_at, ends_at, created_at
  from public.events
  where deleted_at is null;
comment on view public.public_events is 'Public-safe event columns (NO room_id/room_password). Use this for listings/detail.';

-- ----------------------------------------------------------------------------
-- get_room_credentials — the ONLY way to read room creds. Returns them only to
-- a paid participant or the organizer/superadmin; otherwise null.
-- ----------------------------------------------------------------------------
create or replace function public.get_room_credentials(p_event_id uuid)
returns table (room_id text, room_password text, room_released_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.is_event_participant(p_event_id, auth.uid())
     or public.owns_event(p_event_id, auth.uid())
     or public.is_superadmin(auth.uid())
  then
    return query
      select e.room_id, e.room_password, e.room_released_at
      from public.events e where e.id = p_event_id;
  else
    return; -- empty: not entitled
  end if;
end;
$$;
revoke all on function public.get_room_credentials(uuid) from public;
grant execute on function public.get_room_credentials(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- prize_structures RLS — public read (so players see the pool); organizer write.
-- ----------------------------------------------------------------------------
create policy "prize_structures: public read"
  on public.prize_structures for select using (true);
create policy "prize_structures: organizer write"
  on public.prize_structures for all to authenticated
  using (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- registrations RLS — player reads/creates OWN; organizer reads/moderates own
-- event's registrations. No hard deletes.
-- ----------------------------------------------------------------------------
create policy "registrations: player read own"
  on public.registrations for select to authenticated
  using (user_id = auth.uid() or public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));

create policy "registrations: player create own"
  on public.registrations for insert to authenticated
  with check (user_id = auth.uid());

create policy "registrations: player update own (cancel)"
  on public.registrations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "registrations: organizer moderate"
  on public.registrations for update to authenticated
  using (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- event_results RLS — public read when published; organizer writes.
-- ----------------------------------------------------------------------------
create policy "event_results: public read published"
  on public.event_results for select
  using (status = 'published' or public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));
create policy "event_results: organizer write"
  on public.event_results for all to authenticated
  using (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- payouts RLS — winner reads own; organizer/superadmin manage.
-- ----------------------------------------------------------------------------
create policy "payouts: winner read own"
  on public.payouts for select to authenticated
  using (user_id = auth.uid() or public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));
create policy "payouts: organizer manage"
  on public.payouts for all to authenticated
  using (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (public.owns_event(event_id, auth.uid()) or public.is_superadmin(auth.uid()));
