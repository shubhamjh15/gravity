-- ============================================================================
-- GRAVITY · Migration 0020 — Audited PII access
--
-- NON-NEGOTIABLE #6: UPI / phone / gov-ID live in profiles_private, no public
-- policy may reach them, and superadmin reads are AUDITED.
--
-- The RLS on profiles_private is correctly strict — owner or superadmin only.
-- But two legitimate flows need PII they cannot otherwise reach:
--
--   1. Room-credential delivery over WhatsApp needs a paid participant's
--      phone. The organizer must never be able to browse phone numbers, but
--      the SERVER needs one at the moment of release.
--   2. Payouts are manual in v1: an admin has to see the winner's UPI id to
--      transfer prize money.
--
-- Both are solved the same way — a narrow SECURITY DEFINER function that
-- checks authority, returns only the rows that flow demands, and writes an
-- audit_log row every time. Nothing here widens an RLS policy: the tight
-- deny-by-default stays, and these are the only doors through it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_event_contact_phones — phones of an event's PAID participants.
--
-- Callable only by that event's organizer (or a superadmin). Returns paid /
-- confirmed registrations only, so an organizer can't harvest numbers by
-- creating an event nobody joined. Every call is audited with the row count.
--
-- Intended for server-side fan-out (room release). The result must never be
-- rendered to the organizer.
-- ----------------------------------------------------------------------------
create or replace function public.get_event_contact_phones(p_event_id uuid)
returns table (user_id uuid, phone text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not (
    public.owns_event(p_event_id, auth.uid())
    or public.is_superadmin(auth.uid())
  ) then
    raise exception 'get_event_contact_phones: not authorized for event %', p_event_id
      using errcode = '42501';
  end if;

  return query
  select pp.user_id, pp.phone
  from public.profiles_private pp
  join public.registrations r
    on r.user_id = pp.user_id
   and r.event_id = p_event_id
  where r.status in ('paid', 'confirmed')
    and pp.phone is not null;

  get diagnostics v_count = row_count;

  perform public.write_audit_log(
    p_action       => 'read_event_contact_phones',
    p_target_table => 'profiles_private',
    p_target_id    => p_event_id,
    p_after        => jsonb_build_object('rows_returned', v_count)
  );
end;
$$;

comment on function public.get_event_contact_phones is
  'Phones of an event''s paid participants, for server-side room-credential delivery. Owner/superadmin only. Audited.';

revoke all on function public.get_event_contact_phones(uuid) from public;
grant execute on function public.get_event_contact_phones(uuid) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- reveal_player_pii — superadmin PII reveal for the players directory
-- (ROADMAP 6.1: "players directory (audited PII reveal)").
--
-- The admin users page claimed to be audited but never actually read PII and
-- never wrote an audit row. This is the real thing: one player, one explicit
-- action, one audit entry naming who looked and why.
-- ----------------------------------------------------------------------------
create or replace function public.reveal_player_pii(
  p_user_id uuid,
  p_reason  text default null
)
returns table (
  user_id     uuid,
  upi_id      text,
  phone       text,
  gov_id_type text,
  kyc_status  text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'reveal_player_pii: superadmin only'
      using errcode = '42501';
  end if;

  -- Audit BEFORE returning: if the read happens, the record exists, even if
  -- the caller drops the connection mid-response.
  perform public.write_audit_log(
    p_action       => 'reveal_player_pii',
    p_target_table => 'profiles_private',
    p_target_id    => p_user_id,
    p_after        => jsonb_build_object('reason', coalesce(p_reason, 'unspecified'))
  );

  -- Deliberately does NOT return gov_id_doc_path: viewing the document itself
  -- goes through a separately-audited signed URL, not this summary.
  return query
  select pp.user_id, pp.upi_id, pp.phone, pp.gov_id_type, pp.kyc_status
  from public.profiles_private pp
  where pp.user_id = p_user_id;
end;
$$;

comment on function public.reveal_player_pii is
  'Superadmin-only PII reveal for one player. Writes an audit_log row before returning (#6).';

revoke all on function public.reveal_player_pii(uuid, text) from public;
grant execute on function public.reveal_player_pii(uuid, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- get_payout_upi — the winner's UPI id for a pending payout.
--
-- publishResults creates payout rows without a upi_id because the organizer
-- can't read profiles_private. This lets the person actually sending the money
-- resolve it at transfer time, audited, without opening PII more broadly.
-- ----------------------------------------------------------------------------
create or replace function public.get_payout_upi(p_payout_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout public.payouts%rowtype;
  v_upi    text;
begin
  select * into v_payout from public.payouts where id = p_payout_id;
  if not found then
    raise exception 'get_payout_upi: payout % not found', p_payout_id;
  end if;

  if not (
    public.owns_event(v_payout.event_id, auth.uid())
    or public.is_superadmin(auth.uid())
  ) then
    raise exception 'get_payout_upi: not authorized'
      using errcode = '42501';
  end if;

  select pp.upi_id into v_upi
  from public.profiles_private pp
  where pp.user_id = v_payout.user_id;

  perform public.write_audit_log(
    p_action       => 'read_payout_upi',
    p_target_table => 'profiles_private',
    p_target_id    => v_payout.user_id,
    p_after        => jsonb_build_object('payout_id', p_payout_id, 'found', v_upi is not null)
  );

  return v_upi;
end;
$$;

comment on function public.get_payout_upi is
  'UPI id for one payout, for the person sending the money. Event owner/superadmin only. Audited.';

revoke all on function public.get_payout_upi(uuid) from public;
grant execute on function public.get_payout_upi(uuid) to authenticated, service_role;
