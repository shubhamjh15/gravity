-- ============================================================================
-- GRAVITY · Migration 0022 — Elite applications (ROADMAP 3.7)
--
-- 0011 created elite_policies (requires_gov_id, min_kill_ratio, rules) and
-- community_members.role already allows 'elite' — but there was nowhere to
-- record a request, so the "gov-ID + kill-ratio proof → elite approval"
-- workflow had no table to live in and no code anywhere.
--
-- This adds the application record plus a review RPC that enforces the
-- community's own policy in the DATABASE. Doing the check server-side matters:
-- the reviewer is a community owner, not a platform admin, and elite status
-- gates entry to higher-stakes events.
-- ============================================================================

create table public.elite_applications (
  id                  uuid primary key default gen_random_uuid(),
  community_id        uuid not null references public.communities (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  -- What the applicant claimed at submission time. Kept as a snapshot so a
  -- later stat change doesn't rewrite the basis a decision was made on.
  kill_ratio_claimed  numeric(6,2),
  note                text,
  review_note         text,
  reviewed_by         uuid references auth.users (id),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,

  -- One application per member per community; re-applying updates the row.
  unique (community_id, user_id)
);

comment on table public.elite_applications is
  'Requests for elite status within a community. Reviewed against that community''s elite_policies.';

create trigger trg_elite_applications_updated_at
  before update on public.elite_applications
  for each row execute function public.set_updated_at();

create index idx_elite_apps_review
  on public.elite_applications (community_id, status);

alter table public.elite_applications enable row level security;

-- Applicants read and file their own; the community owner reads and reviews
-- everything in their community.
create policy "elite_apps: applicant or owner read"
  on public.elite_applications for select to authenticated
  using (
    user_id = auth.uid()
    or public.owns_community(community_id, auth.uid())
    or public.is_superadmin(auth.uid())
  );

-- Only an ACTIVE member of the community may apply, and only for themselves.
create policy "elite_apps: member applies for self"
  on public.elite_applications for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_members cm
      where cm.community_id = elite_applications.community_id
        and cm.user_id = auth.uid()
        and cm.status = 'active'
    )
  );

-- The applicant may amend or withdraw a PENDING application; the owner may
-- review any of them. Deciding is done through the RPC below, which also
-- flips the member's role — a bare UPDATE here can't grant elite by itself.
create policy "elite_apps: applicant amends pending"
  on public.elite_applications for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status in ('pending', 'withdrawn'));

create policy "elite_apps: owner reviews"
  on public.elite_applications for update to authenticated
  using (public.owns_community(community_id, auth.uid()))
  with check (public.owns_community(community_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- review_elite_application — approve or reject, enforcing the community policy.
--
-- On approval it checks the policy the community actually set:
--   * requires_gov_id  → the applicant's KYC must be verified
--   * min_kill_ratio   → their best per-game kill ratio must clear the bar
-- and only then promotes community_members.role to 'elite'.
--
-- Reads profiles_private.kyc_status, which is why this is SECURITY DEFINER: a
-- community owner must NOT be able to read that table directly (#6). Only the
-- verified/not-verified verdict escapes — never the document or the ID number.
-- ----------------------------------------------------------------------------
create or replace function public.review_elite_application(
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
  v_app        public.elite_applications%rowtype;
  v_policy     public.elite_policies%rowtype;
  v_kyc        text;
  v_best_ratio numeric;
begin
  select * into v_app from public.elite_applications where id = p_application_id;
  if not found then
    raise exception 'review_elite_application: application not found';
  end if;

  if not (
    public.owns_community(v_app.community_id, auth.uid())
    or public.is_superadmin(auth.uid())
  ) then
    raise exception 'review_elite_application: not authorized'
      using errcode = '42501';
  end if;

  if v_app.status <> 'pending' then
    raise exception 'review_elite_application: already %', v_app.status;
  end if;

  if not p_approve then
    update public.elite_applications
    set status = 'rejected',
        review_note = p_review_note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_application_id;
    return 'rejected';
  end if;

  -- Approving: the community's own policy is the gate.
  select * into v_policy from public.elite_policies
  where community_id = v_app.community_id;

  if found then
    if v_policy.requires_gov_id then
      select pp.kyc_status into v_kyc
      from public.profiles_private pp
      where pp.user_id = v_app.user_id;

      if coalesce(v_kyc, 'pending') <> 'verified' then
        raise exception 'ELITE_GOV_ID_REQUIRED';
      end if;
    end if;

    if v_policy.min_kill_ratio is not null then
      select max(pgp.kill_ratio) into v_best_ratio
      from public.player_game_profiles pgp
      where pgp.user_id = v_app.user_id;

      if coalesce(v_best_ratio, 0) < v_policy.min_kill_ratio then
        raise exception 'ELITE_KILL_RATIO_TOO_LOW';
      end if;
    end if;
  end if;

  update public.elite_applications
  set status = 'approved',
      review_note = p_review_note,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_application_id;

  update public.community_members
  set role = 'elite'
  where community_id = v_app.community_id
    and user_id = v_app.user_id;

  perform public.write_audit_log(
    p_action       => 'approve_elite',
    p_target_table => 'community_members',
    p_target_id    => v_app.user_id,
    p_after        => jsonb_build_object(
      'community_id', v_app.community_id,
      'application_id', p_application_id
    )
  );

  return 'approved';
end;
$$;

comment on function public.review_elite_application is
  'Approve/reject an elite application, enforcing the community''s elite_policies. Reads kyc_status without exposing PII (#6).';

revoke all on function public.review_elite_application(uuid, boolean, text) from public;
grant execute on function public.review_elite_application(uuid, boolean, text) to authenticated, service_role;
