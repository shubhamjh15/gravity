-- ============================================================================
-- GRAVITY · Seed data (idempotent)
-- Run after migrations on a fresh DB: supabase db reset applies this.
-- Safe to re-run.
-- ============================================================================

-- ---- Supported games (FK lookup, not enum) ---------------------------------
insert into public.games (slug, name, sort_order) values
  ('free_fire', 'Free Fire', 1),
  ('bgmi',      'BGMI',      2),
  ('pubg',      'PUBG',      3)
on conflict (slug) do nothing;

-- ---- Platform-wide settings (configurable, not hardcoded) ------------------
-- Fees in basis points; money defaults in paise. Adjust in the admin console.
insert into public.app_settings (key, value, description) values
  ('platform_fee_bps',        '550'::jsonb,   'Default platform commission on paid registrations (basis points). 550 = 5.5%.'),
  ('fallback_gateway_fee_bps','200'::jsonb,   'Extra fee applied when the fallback gateway is used (bps).'),
  ('membership_default_paise','0'::jsonb,     'Default community membership cost in paise (0 = organizer sets).'),
  ('slot_hold_ttl_seconds',   '600'::jsonb,   'How long a registration slot is reserved awaiting payment (seconds).'),
  ('maintenance_mode',        'false'::jsonb, 'When true, the platform shows a maintenance screen.'),
  ('payouts_mode',            '"manual"'::jsonb, 'manual (v1) or razorpayx (Phase 6).'),
  ('feature_flags',           '{"store": true, "sponsors": true, "communities": true}'::jsonb, 'Per-surface feature toggles.')
on conflict (key) do update set value = excluded.value, description = excluded.description;

-- ---- Superadmin bootstrap ---------------------------------------------------
-- Superadmins CANNOT be seeded by email here because auth.users rows are
-- created by Supabase Auth on first Google login. After your first login,
-- promote yourself by running (in the SQL editor, replacing the email):
--
--   insert into public.user_roles (user_id, role)
--   select id, 'superadmin' from auth.users where email = 'you@example.com'
--   on conflict do nothing;
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;
--
-- Seed at least TWO superadmins + keep a break-glass runbook (see ../SETUP.md).
