-- ============================================================================
-- GRAVITY · Migration 0010 — Atomic slot reservation + registration helpers
-- Prevents oversell under concurrency: the count check + insert happen inside
-- one transaction with row locking. Free events confirm immediately; paid
-- events hold a slot with a TTL until the webhook settles payment.
-- ============================================================================

-- reserve_slot — atomically reserve a registration slot for the current user.
-- Returns the registration id. Raises if full, duplicate, or registration is
-- closed. For paid events status='slot_held' with a TTL; for free events the
-- caller confirms separately (or we confirm here when entry_fee = 0).
create or replace function public.reserve_slot(
  p_event_id uuid,
  p_form_data jsonb default '{}'::jsonb,
  p_ttl_seconds int default 600
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid          uuid := auth.uid();
  v_event        public.events%rowtype;
  v_taken        int;
  v_existing     uuid;
  v_status       text;
  v_reg_id       uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Lock the event row to serialize concurrent reservations for this event.
  select * into v_event from public.events
  where id = p_event_id and deleted_at is null
  for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if v_event.status not in ('upcoming','ongoing') then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  if v_event.registration_closes_at is not null
     and now() > v_event.registration_closes_at then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  -- Already registered? (idempotent-ish: return the existing active reg.)
  select id, status into v_existing, v_status
  from public.registrations
  where event_id = p_event_id and user_id = v_uid;

  if found then
    if v_status in ('cancelled','rejected','refunded') then
      -- allow re-registration by reviving the row
      update public.registrations
      set status = case when v_event.entry_fee_paise = 0 then 'confirmed' else 'slot_held' end,
          slot_held_until = case when v_event.entry_fee_paise = 0 then null
                                 else now() + make_interval(secs => p_ttl_seconds) end,
          form_data = p_form_data,
          updated_at = now()
      where id = v_existing;
      return v_existing;
    else
      raise exception 'ALREADY_REGISTERED';
    end if;
  end if;

  -- Count slots already taken (held or paid/confirmed and not expired).
  select count(*) into v_taken
  from public.registrations
  where event_id = p_event_id
    and status in ('slot_held','paid','confirmed','waitlisted')
    and (slot_held_until is null or slot_held_until > now() or status <> 'slot_held');

  if v_taken >= v_event.max_slots then
    raise exception 'EVENT_FULL';
  end if;

  -- Insert. Free events confirm immediately; paid events hold with a TTL.
  insert into public.registrations (event_id, user_id, status, slot_held_until, form_data)
  values (
    p_event_id, v_uid,
    case when v_event.entry_fee_paise = 0 then 'confirmed' else 'slot_held' end,
    case when v_event.entry_fee_paise = 0 then null
         else now() + make_interval(secs => p_ttl_seconds) end,
    p_form_data
  )
  returning id into v_reg_id;

  return v_reg_id;
end;
$$;
revoke all on function public.reserve_slot(uuid, jsonb, int) from public;
grant execute on function public.reserve_slot(uuid, jsonb, int) to authenticated;

comment on function public.reserve_slot is
  'Atomic, oversell-safe slot reservation. Free events confirm; paid events hold with TTL until webhook settles.';

-- sweep_expired_slots — cron target: release holds whose TTL passed without payment.
create or replace function public.sweep_expired_slots()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  update public.registrations
  set status = 'cancelled', updated_at = now()
  where status = 'slot_held'
    and slot_held_until is not null
    and slot_held_until < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
comment on function public.sweep_expired_slots is 'Cron: cancel slot_held registrations whose TTL expired. Never relied on for correctness.';
