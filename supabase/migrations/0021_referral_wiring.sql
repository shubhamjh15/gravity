-- ============================================================================
-- GRAVITY · Migration 0021 — Referral / discount codes, corrected and wired
--
-- 0015 created referral_codes, referral_redemptions and redeem_code() — and
-- nothing ever called them. Reviewing that dead code before wiring it up
-- surfaced three defects:
--
-- 1. FLOAT MONEY MATH. `floor(p_base_paise * discount_value / 100.0)` divides
--    by a float literal, so the amount goes through float64 before flooring —
--    exactly what NON-NEGOTIABLE #1 forbids. Now integer-only.
--
-- 2. NO SCOPE CHECK. The table has scope/scope_id (community | event | store |
--    global) but redeem_code ignored both, so a store coupon worked on a
--    tournament entry and a code for community A worked in community B.
--
-- 3. CONSUMED BEFORE PAYMENT. It redeemed at call time. Since money settles
--    only from the webhook (#5), an abandoned checkout would burn a
--    single-use code and the player would have paid nothing.
--
-- The fix splits validation from consumption:
--    preview_code()        — read-only; validates and returns the discount.
--    redeem_code_for_user() — records the use; called from the webhook, once
--                             the money has actually landed.
-- redeem_code() is kept as a thin wrapper so nothing that might call it breaks.
-- ============================================================================

-- Remember what was applied, so settlement can redeem the right code and the
-- charged amount is reconstructible from the row alone.
alter table public.registrations
  add column if not exists referral_code_id uuid references public.referral_codes (id) on delete set null,
  add column if not exists discount_paise   bigint not null default 0 check (discount_paise >= 0);

alter table public.store_orders
  add column if not exists referral_code_id uuid references public.referral_codes (id) on delete set null,
  add column if not exists discount_paise   bigint not null default 0 check (discount_paise >= 0);

-- ----------------------------------------------------------------------------
-- preview_code — validate a code and compute its discount. NO side effects.
--
-- Safe to call from the UI on every keystroke and again server-side when
-- creating the payment order.
-- ----------------------------------------------------------------------------
create or replace function public.preview_code(
  p_code       text,
  p_base_paise bigint,
  p_scope      text default null,
  p_scope_id   uuid default null
)
returns table (discount_paise bigint, code_id uuid, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  rc         public.referral_codes%rowtype;
  v_uses     int;
  v_discount bigint;
begin
  if p_base_paise is null or p_base_paise < 0 then
    return query select 0::bigint, null::uuid, 'INVALID_BASE'; return;
  end if;

  select * into rc from public.referral_codes
  where code = p_code and is_active = true;

  if not found then
    return query select 0::bigint, null::uuid, 'INVALID_CODE'; return;
  end if;

  if rc.valid_from is not null and now() < rc.valid_from then
    return query select 0::bigint, rc.id, 'CODE_NOT_STARTED'; return;
  end if;
  if rc.valid_to is not null and now() > rc.valid_to then
    return query select 0::bigint, rc.id, 'CODE_EXPIRED'; return;
  end if;
  if rc.max_uses is not null and rc.used_count >= rc.max_uses then
    return query select 0::bigint, rc.id, 'CODE_EXHAUSTED'; return;
  end if;

  -- Scope: a global code works anywhere; anything else must match exactly.
  if rc.scope <> 'global' then
    if p_scope is null or rc.scope <> p_scope then
      return query select 0::bigint, rc.id, 'CODE_WRONG_SCOPE'; return;
    end if;
    if rc.scope_id is not null and rc.scope_id is distinct from p_scope_id then
      return query select 0::bigint, rc.id, 'CODE_WRONG_SCOPE'; return;
    end if;
  end if;

  if v_uid is not null then
    select count(*) into v_uses from public.referral_redemptions
    where code_id = rc.id and user_id = v_uid;

    if v_uses >= rc.per_user_limit then
      return query select 0::bigint, rc.id, 'CODE_ALREADY_USED'; return;
    end if;
  end if;

  -- INTEGER money math only (#1). Percent discounts floor to whole paise, and
  -- a discount can never exceed the base — nobody gets paid to check out.
  if rc.discount_kind = 'pct' then
    v_discount := (p_base_paise * greatest(rc.discount_value, 0)) / 100;
  else
    v_discount := greatest(rc.discount_value, 0);
  end if;

  v_discount := least(v_discount, p_base_paise);

  return query select v_discount, rc.id, 'OK';
end;
$$;

comment on function public.preview_code is
  'Validate a discount/referral code and return its discount in paise. Read-only — no redemption.';

revoke all on function public.preview_code(text, bigint, text, uuid) from public;
grant execute on function public.preview_code(text, bigint, text, uuid) to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- redeem_code_for_user — record a redemption for an explicit user.
--
-- Called from the Razorpay webhook, which runs as service_role with no
-- auth.uid(), so the user is passed in rather than inferred. Idempotent: the
-- UNIQUE (code_id, user_id) makes a webhook replay a no-op instead of
-- double-counting used_count.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_code_for_user(
  p_code_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted boolean := false;
begin
  if p_code_id is null or p_user_id is null then
    return false;
  end if;

  -- Lock the code row so concurrent settlements can't race used_count.
  perform 1 from public.referral_codes where id = p_code_id for update;

  insert into public.referral_redemptions (code_id, user_id)
  values (p_code_id, p_user_id)
  on conflict (code_id, user_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted then
    update public.referral_codes
    set used_count = used_count + 1
    where id = p_code_id;
  end if;

  return v_inserted;
end;
$$;

comment on function public.redeem_code_for_user is
  'Record a code redemption for an explicit user, at settlement. Idempotent on (code_id, user_id).';

revoke all on function public.redeem_code_for_user(uuid, uuid) from public;
grant execute on function public.redeem_code_for_user(uuid, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- redeem_code — kept for compatibility, now integer-only and scope-aware.
-- Prefer preview_code + redeem_code_for_user for anything payment-related.
-- ----------------------------------------------------------------------------
create or replace function public.redeem_code(p_code text, p_base_paise bigint)
returns table (discount_paise bigint, code_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_preview  record;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_preview
  from public.preview_code(p_code, p_base_paise, null, null);

  if v_preview.reason <> 'OK' then
    raise exception '%', v_preview.reason;
  end if;

  perform public.redeem_code_for_user(v_preview.code_id, v_uid);

  return query select v_preview.discount_paise, v_preview.code_id;
end;
$$;

revoke all on function public.redeem_code(text, bigint) from public;
grant execute on function public.redeem_code(text, bigint) to authenticated;
