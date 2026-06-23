-- ============================================================================
-- GRAVITY · Migration 0001 — Foundation
-- Extensions, shared trigger functions, and conventions used by every table.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto (Supabase enables it, but be explicit).
create extension if not exists "pgcrypto";
create extension if not exists "citext"; -- case-insensitive email/slug uniqueness

-- ----------------------------------------------------------------------------
-- set_updated_at() — keep updated_at current on every UPDATE.
-- Attach with:  create trigger <t> before update on <table>
--               for each row execute function public.set_updated_at();
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Money guard: a domain-like CHECK helper is overkill; we rely on BIGINT
-- columns + CHECK (amount_paise >= 0) per table. Money is ALWAYS paise.
-- Percentages are ALWAYS basis points (bps). Never store floats for money.
-- ----------------------------------------------------------------------------

comment on function public.set_updated_at() is
  'Trigger fn: sets NEW.updated_at = now() on UPDATE. Used by all business tables.';
