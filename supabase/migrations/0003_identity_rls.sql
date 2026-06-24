-- ============================================================================
-- GRAVITY · Migration 0003 — Identity RLS policies (deny-by-default)
-- RLS is already enabled (0002). Here we grant the minimum each role needs.
-- Anything not explicitly allowed is denied.
--
-- Supabase roles: `anon` (logged-out), `authenticated` (logged-in). auth.uid()
-- returns the current user's id.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles — public can read LIVE profiles; owner edits own; no client INSERT
-- (handle_new_user owns creation). Superadmin can manage all.
-- ----------------------------------------------------------------------------
create policy "profiles: public read live"
  on public.profiles for select
  using (deleted_at is null);

create policy "profiles: owner update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: superadmin all"
  on public.profiles for all
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- profiles_private — THE most sensitive table. Owner or superadmin ONLY.
-- No public/anon access of any kind. (#6)
-- ----------------------------------------------------------------------------
create policy "profiles_private: owner select"
  on public.profiles_private for select
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "profiles_private: owner upsert"
  on public.profiles_private for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "profiles_private: owner update"
  on public.profiles_private for update
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()))
  with check (user_id = auth.uid() or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- user_roles — user may READ own roles; only superadmin may modify.
-- This is what prevents privilege escalation (#2).
-- ----------------------------------------------------------------------------
create policy "user_roles: read own or superadmin"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "user_roles: superadmin insert"
  on public.user_roles for insert
  to authenticated
  with check (public.is_superadmin(auth.uid()));

create policy "user_roles: superadmin update"
  on public.user_roles for update
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

create policy "user_roles: superadmin delete"
  on public.user_roles for delete
  to authenticated
  using (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- games — public read of active titles; superadmin writes.
-- ----------------------------------------------------------------------------
create policy "games: public read"
  on public.games for select
  using (is_active = true or public.is_superadmin(auth.uid()));

create policy "games: superadmin write"
  on public.games for all
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- player_game_profiles — owner manages own; public reads non-sensitive (the
-- skill_proof_path is in a private bucket, so exposing the row is acceptable;
-- the file itself is gated by storage policy). Superadmin all.
-- ----------------------------------------------------------------------------
create policy "pgp: public read"
  on public.player_game_profiles for select
  using (true);

create policy "pgp: owner write"
  on public.player_game_profiles for all
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()))
  with check (user_id = auth.uid() or public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- player_documents — owner reads/creates own; superadmin reviews. NOT public.
-- ----------------------------------------------------------------------------
create policy "player_documents: owner select"
  on public.player_documents for select
  to authenticated
  using (user_id = auth.uid() or public.is_superadmin(auth.uid()));

create policy "player_documents: owner insert"
  on public.player_documents for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "player_documents: superadmin review"
  on public.player_documents for update
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ----------------------------------------------------------------------------
-- player_stats — public read (feeds leaderboard/profile). No client writes;
-- updated by SECURITY DEFINER routines at result-lock + cron. Superadmin all.
-- ----------------------------------------------------------------------------
create policy "player_stats: public read"
  on public.player_stats for select
  using (true);

create policy "player_stats: superadmin write"
  on public.player_stats for all
  to authenticated
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));
