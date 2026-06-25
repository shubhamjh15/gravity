-- ============================================================================
-- GRAVITY · Migration 0005 — Admin / governance
-- platform_admins, admin_sessions, app_settings, audit_log, notifications.
-- The hidden admin URL is cosmetic; the REAL gate is is_superadmin() + these
-- tables. (#4)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- platform_admins — hidden-admin allowlist (TOTP + IP allowlist), hardened.
-- A user must be BOTH a superadmin (user_roles) AND on this allowlist to use
-- the admin console; defence in depth.
-- ----------------------------------------------------------------------------
create table public.platform_admins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references public.profiles (id) on delete cascade,
  totp_secret   text,                 -- encrypted at rest in app layer
  ip_allowlist  text[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.platform_admins is 'Hidden-admin allowlist. Superadmin AND on this list AND TOTP/IP to enter the console.';

create trigger trg_platform_admins_updated_at
  before update on public.platform_admins
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- admin_sessions — short-lived hardened sessions for the console.
-- ----------------------------------------------------------------------------
create table public.admin_sessions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.platform_admins (id) on delete cascade,
  ip          text,
  user_agent  text,
  expires_at  timestamptz not null,
  last_seen   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
create index idx_admin_sessions_admin on public.admin_sessions (admin_id);

-- ----------------------------------------------------------------------------
-- app_settings — configurable business values (fees, membership defaults,
-- maintenance mode, feature flags). Key/JSON. Superadmin writes; server reads.
-- ----------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id)
);
comment on table public.app_settings is 'Configurable business values (never hardcode). Superadmin write; server read.';

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- audit_log — APPEND ONLY. No update/delete policy at all (#11 audit rules).
-- ----------------------------------------------------------------------------
create table public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references auth.users (id),
  action        text not null,
  target_table  text,
  target_id     uuid,
  before        jsonb,
  after         jsonb,
  ip            text,
  created_at    timestamptz not null default now()
);
comment on table public.audit_log is 'Append-only privileged-action log. Never editable or deletable.';

create index idx_audit_actor  on public.audit_log (actor_id);
create index idx_audit_target on public.audit_log (target_table, target_id);

-- write_audit_log — SECURITY DEFINER append helper.
create or replace function public.write_audit_log(
  p_action       text,
  p_target_table text default null,
  p_target_id    uuid default null,
  p_before       jsonb default null,
  p_after        jsonb default null,
  p_ip           text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.audit_log (actor_id, action, target_table, target_id, before, after, ip)
  values (auth.uid(), p_action, p_target_table, p_target_id, p_before, p_after, p_ip)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.write_audit_log from public;
grant execute on function public.write_audit_log to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- notifications — per-user feed (bell, Realtime). Owner-only.
-- ----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_notifications_user on public.notifications (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.platform_admins enable row level security;
alter table public.admin_sessions  enable row level security;
alter table public.app_settings    enable row level security;
alter table public.audit_log       enable row level security;
alter table public.notifications   enable row level security;

-- platform_admins / admin_sessions: superadmin only.
create policy "platform_admins: superadmin all"
  on public.platform_admins for all to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));

create policy "admin_sessions: superadmin all"
  on public.admin_sessions for all to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));

-- app_settings: a small public-readable allowlist (maintenance flag, etc.) is
-- handled in app code via the service role; here we keep it superadmin-gated
-- for reads to be safe, and superadmin for writes.
create policy "app_settings: superadmin read"
  on public.app_settings for select to authenticated
  using (public.is_superadmin(auth.uid()));
create policy "app_settings: superadmin write"
  on public.app_settings for all to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));

-- audit_log: superadmin may READ. No insert/update/delete policy => only the
-- SECURITY DEFINER writer can append; nobody can mutate/delete. (append-only)
create policy "audit_log: superadmin read"
  on public.audit_log for select to authenticated
  using (public.is_superadmin(auth.uid()));

-- notifications: owner reads + marks read; superadmin may read.
create policy "notifications: owner read"
  on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));
create policy "notifications: owner update (mark read)"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
