-- ============================================================================
-- GRAVITY · Migration 0012 — Community-domain RLS
-- Membership gates chat + private content. Admin-only flags (is_featured /
-- is_restricted) cannot be set by the owner. Chat is readable only by channel
-- members.
-- ============================================================================

-- Helpers --------------------------------------------------------------------
create or replace function public.owns_community(p_community_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities c
    where c.id = p_community_id and c.owner_id = p_user_id
  );
$$;

create or replace function public.is_community_member(p_community_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = p_community_id
      and m.user_id = p_user_id
      and m.status = 'active'
  );
$$;

create or replace function public.is_channel_member(p_channel_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_members cm
    where cm.channel_id = p_channel_id and cm.user_id = p_user_id
  );
$$;

-- ----------------------------------------------------------------------------
-- communities
--   public read of public communities; owner manages own; superadmin all.
--   is_featured / is_restricted may ONLY be changed by superadmin: we enforce
--   by a trigger that blocks owner edits to those columns.
-- ----------------------------------------------------------------------------
create policy "communities: public read"
  on public.communities for select
  using (
    (visibility = 'public' and deleted_at is null)
    or owner_id = auth.uid()
    or public.is_community_member(id, auth.uid())
    or public.is_superadmin(auth.uid())
  );

create policy "communities: owner insert"
  on public.communities for insert to authenticated
  with check (owner_id = auth.uid());

create policy "communities: owner update"
  on public.communities for update to authenticated
  using (owner_id = auth.uid() or public.is_superadmin(auth.uid()))
  with check (owner_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "communities: superadmin delete"
  on public.communities for delete to authenticated
  using (public.is_superadmin(auth.uid()));

-- Block owners from setting admin-only flags. Superadmin bypasses.
create or replace function public.guard_community_admin_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin(auth.uid()) then
    if new.is_featured is distinct from old.is_featured
       or new.is_restricted is distinct from old.is_restricted then
      raise exception 'ADMIN_ONLY_FLAG';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_guard_community_flags on public.communities;
create trigger trg_guard_community_flags
  before update on public.communities
  for each row execute function public.guard_community_admin_flags();

-- ----------------------------------------------------------------------------
-- community_members — member reads own + community members visible to members;
-- owner moderates; users can request to join (insert self as pending/active).
-- ----------------------------------------------------------------------------
create policy "community_members: visible to members + owner"
  on public.community_members for select
  using (
    user_id = auth.uid()
    or public.owns_community(community_id, auth.uid())
    or public.is_community_member(community_id, auth.uid())
    or public.is_superadmin(auth.uid())
  );

create policy "community_members: self join"
  on public.community_members for insert to authenticated
  with check (user_id = auth.uid());

create policy "community_members: owner moderate"
  on public.community_members for update to authenticated
  using (public.owns_community(community_id, auth.uid()) or user_id = auth.uid() or public.is_superadmin(auth.uid()))
  with check (public.owns_community(community_id, auth.uid()) or user_id = auth.uid() or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- memberships — owner of membership reads own; community owner + superadmin read.
-- Writes happen via server/webhook (service role).
-- ----------------------------------------------------------------------------
create policy "memberships: read own or community owner"
  on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()));
create policy "memberships: self insert"
  on public.memberships for insert to authenticated
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- community_posts — members read; author/owner write.
-- ----------------------------------------------------------------------------
create policy "community_posts: members read"
  on public.community_posts for select
  using (
    deleted_at is null and (
      public.is_community_member(community_id, auth.uid())
      or public.owns_community(community_id, auth.uid())
      or exists (select 1 from public.communities c where c.id = community_id and c.visibility = 'public')
    )
  );
create policy "community_posts: member or owner write"
  on public.community_posts for insert to authenticated
  with check (
    author_id = auth.uid() and (
      public.is_community_member(community_id, auth.uid())
      or public.owns_community(community_id, auth.uid())
    )
  );
create policy "community_posts: author or owner update"
  on public.community_posts for update to authenticated
  using (author_id = auth.uid() or public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (author_id = auth.uid() or public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- community_gallery — public read for public communities; owner write.
-- ----------------------------------------------------------------------------
create policy "community_gallery: read"
  on public.community_gallery for select
  using (
    exists (select 1 from public.communities c where c.id = community_id and (c.visibility = 'public' or c.owner_id = auth.uid()))
    or public.is_community_member(community_id, auth.uid())
  );
create policy "community_gallery: owner write"
  on public.community_gallery for all to authenticated
  using (public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- elite_policies — public read; owner write.
-- ----------------------------------------------------------------------------
create policy "elite_policies: read" on public.elite_policies for select using (true);
create policy "elite_policies: owner write"
  on public.elite_policies for all to authenticated
  using (public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()))
  with check (public.owns_community(community_id, auth.uid()) or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- chat — channels visible to members; messages readable/writable by channel
-- members only (the privacy-critical rule).
-- ----------------------------------------------------------------------------
create policy "chat_channels: member read"
  on public.chat_channels for select to authenticated
  using (
    public.is_channel_member(id, auth.uid())
    or (community_id is not null and public.owns_community(community_id, auth.uid()))
    or public.is_superadmin(auth.uid())
  );
create policy "chat_channels: create"
  on public.chat_channels for insert to authenticated
  with check (created_by = auth.uid());

create policy "chat_members: visible to channel members"
  on public.chat_members for select to authenticated
  using (public.is_channel_member(channel_id, auth.uid()) or public.is_superadmin(auth.uid()));
create policy "chat_members: join"
  on public.chat_members for insert to authenticated
  with check (user_id = auth.uid() or exists (
    select 1 from public.chat_channels ch where ch.id = channel_id and ch.created_by = auth.uid()
  ));

create policy "chat_messages: members read"
  on public.chat_messages for select to authenticated
  using (public.is_channel_member(channel_id, auth.uid()) or public.is_superadmin(auth.uid()));
create policy "chat_messages: members send"
  on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_channel_member(channel_id, auth.uid()));

-- ----------------------------------------------------------------------------
-- match_invites — sender + recipient read; sender creates; recipient responds.
-- ----------------------------------------------------------------------------
create policy "match_invites: parties read"
  on public.match_invites for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());
create policy "match_invites: sender create"
  on public.match_invites for insert to authenticated
  with check (from_user = auth.uid());
create policy "match_invites: recipient respond"
  on public.match_invites for update to authenticated
  using (to_user = auth.uid() or from_user = auth.uid())
  with check (to_user = auth.uid() or from_user = auth.uid());
