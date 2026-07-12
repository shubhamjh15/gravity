-- ============================================================================
-- GRAVITY · Migration 0015 — Referral codes + cron jobs (hardening)
-- referral_codes (consolidated discount/referral) + atomic redemption RPC.
-- pg_cron schedules: leaderboard refresh, slot-hold sweep, installment overdue.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- referral_codes — one consolidated model for referral + discount codes.
-- ----------------------------------------------------------------------------
create table public.referral_codes (
  id             uuid primary key default gen_random_uuid(),
  code           citext not null unique,
  kind           text not null default 'discount' check (kind in ('referral','discount')),
  scope          text not null default 'global' check (scope in ('community','event','store','global')),
  scope_id       uuid,
  discount_kind  text not null default 'pct' check (discount_kind in ('pct','flat')),
  discount_value int not null default 0,          -- pct: percent; flat: paise
  max_uses       int,                              -- null = unlimited
  used_count     int not null default 0,
  per_user_limit int not null default 1,
  valid_from     timestamptz,
  valid_to       timestamptz,
  is_active      boolean not null default true,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now()
);
create index idx_referral_scope on public.referral_codes (scope, scope_id);

create table public.referral_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code_id     uuid not null references public.referral_codes (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (code_id, user_id)
);

alter table public.referral_codes        enable row level security;
alter table public.referral_redemptions  enable row level security;

create policy "referral_codes: public read active"
  on public.referral_codes for select using (is_active = true or public.is_superadmin(auth.uid()));
create policy "referral_codes: creator/admin write"
  on public.referral_codes for all to authenticated
  using (public.is_superadmin(auth.uid()) or created_by = auth.uid())
  with check (public.is_superadmin(auth.uid()) or created_by = auth.uid());

create policy "referral_redemptions: own read"
  on public.referral_redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

-- redeem_code — atomic redemption: validates window/limits, records the use,
-- bumps used_count, returns the discount to apply (in paise) for a given base.
create or replace function public.redeem_code(p_code text, p_base_paise bigint)
returns table (discount_paise bigint, code_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  rc public.referral_codes%rowtype;
  v_user_uses int;
  v_discount bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into rc from public.referral_codes
  where code = p_code and is_active = true
  for update;
  if not found then raise exception 'INVALID_CODE'; end if;

  if rc.valid_from is not null and now() < rc.valid_from then raise exception 'CODE_NOT_STARTED'; end if;
  if rc.valid_to   is not null and now() > rc.valid_to   then raise exception 'CODE_EXPIRED'; end if;
  if rc.max_uses   is not null and rc.used_count >= rc.max_uses then raise exception 'CODE_EXHAUSTED'; end if;

  select count(*) into v_user_uses from public.referral_redemptions
  where code_id = rc.id and user_id = v_uid;
  if v_user_uses >= rc.per_user_limit then raise exception 'CODE_ALREADY_USED'; end if;

  -- compute discount
  if rc.discount_kind = 'pct' then
    v_discount := floor(p_base_paise * rc.discount_value / 100.0);
  else
    v_discount := least(rc.discount_value, p_base_paise);
  end if;

  insert into public.referral_redemptions (code_id, user_id) values (rc.id, v_uid);
  update public.referral_codes set used_count = used_count + 1 where id = rc.id;

  return query select v_discount, rc.id;
end;
$$;
revoke all on function public.redeem_code(text, bigint) from public;
grant execute on function public.redeem_code(text, bigint) to authenticated;

-- ----------------------------------------------------------------------------
-- Cron jobs (pg_cron). Guarded: only schedule if the extension is available.
-- On Supabase, enable pg_cron in the dashboard; these are idempotent.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- Leaderboard refresh — every 15 min.
    perform cron.schedule('gravity_leaderboard_refresh', '*/15 * * * *',
      $cron$ select public.refresh_leaderboard(); $cron$);

    -- Slot-hold sweep — every 5 min (never relied on for correctness).
    perform cron.schedule('gravity_slot_sweep', '*/5 * * * *',
      $cron$ select public.sweep_expired_slots(); $cron$);

    -- Installment overdue flag — daily.
    perform cron.schedule('gravity_installment_overdue', '0 2 * * *',
      $cron$ update public.store_payment_schedule
             set status = 'overdue'
             where status = 'pending' and due_at is not null and due_at < now(); $cron$);
  end if;
exception when others then
  -- If cron isn't available in this environment, skip silently; the app uses
  -- Vercel Cron as a fallback and never relies on a sweep for correctness.
  null;
end $$;
