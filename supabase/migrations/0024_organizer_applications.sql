-- ============================================================================
-- GRAVITY · Migration 0024 — Organizer applications
--
-- GAP THIS CLOSES: the acceptance criteria say an organizer "registers and
-- becomes verified", but there was no way to ask. The footer's "Become an
-- organizer" link pointed at /login, which bounces a signed-in user to their
-- profile — a dead end. The only route to the role was a superadmin granting it
-- from the console, so a player had no way to even express interest.
--
-- Deliberately does NOT collect phone/ID here. That is PII and belongs in
-- profiles_private (#6); a reviewer who needs it uses the audited
-- reveal_player_pii path rather than having it copied into a second table.
-- ============================================================================

create table public.organizer_applications (
  id            uuid primary key default gen_random_uuid(),
  -- One live application per person; re-applying updates the row.
  user_id       uuid not null unique references public.profiles (id) on delete cascade,
  org_name      text not null,
  games         text,
  experience    text not null,
  audience_size text,
  links         text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  review_note   text,
  reviewed_by   uuid references auth.users (id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.organizer_applications is
  'Requests for the organizer role. Approval grants it via review_organizer_application().';

create trigger trg_organizer_applications_updated_at
  before update on public.organizer_applications
  for each row execute function public.set_updated_at();

create index idx_organizer_apps_queue
  on public.organizer_applications (status, created_at desc);

alter table public.organizer_applications enable row level security;

-- Applicants see and file their own; superadmins see and review everything.
create policy "organizer_apps: own or admin read"
  on public.organizer_applications for select to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "organizer_apps: apply for self"
  on public.organizer_applications for insert to authenticated
  with check (user_id = auth.uid());

-- The applicant may amend or withdraw a PENDING application. Note the WITH
-- CHECK: they can move it to 'withdrawn' but never to 'approved' — granting the
-- role happens only inside the RPC below.
create policy "organizer_apps: applicant amends pending"
  on public.organizer_applications for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending', 'withdrawn'));

create policy "organizer_apps: superadmin manage"
  on public.organizer_applications for all to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- review_organizer_application — approve (granting the role) or reject.
--
-- SECURITY DEFINER so the decision and the role grant happen in ONE
-- transaction: an approved application can never be left without the role, and
-- the role is never granted without a recorded decision. Audited either way.
-- ----------------------------------------------------------------------------
create or replace function public.review_organizer_application(
  p_application_id uuid,
  p_approve        boolean,
  p_review_note    text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.organizer_applications%rowtype;
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'review_organizer_application: superadmin only'
      using errcode = '42501';
  end if;

  select * into v_app from public.organizer_applications where id = p_application_id;
  if not found then
    raise exception 'review_organizer_application: application not found';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'ALREADY_REVIEWED';
  end if;

  update public.organizer_applications
  set status      = case when p_approve then 'approved' else 'rejected' end,
      review_note = p_review_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_application_id;

  if p_approve then
    insert into public.user_roles (user_id, role, granted_by)
    values (v_app.user_id, 'organizer', auth.uid())
    on conflict (user_id, role) do nothing;
  end if;

  perform public.write_audit_log(
    p_action       => case when p_approve then 'approve_organizer' else 'reject_organizer' end,
    p_target_table => 'organizer_applications',
    p_target_id    => v_app.user_id,
    p_after        => jsonb_build_object(
      'application_id', p_application_id,
      'org_name', v_app.org_name
    )
  );

  return case when p_approve then 'approved' else 'rejected' end;
end;
$$;

revoke all on function public.review_organizer_application(uuid, boolean, text) from public;
grant execute on function public.review_organizer_application(uuid, boolean, text) to authenticated, service_role;
