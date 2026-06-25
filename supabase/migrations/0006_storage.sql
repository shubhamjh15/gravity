-- ============================================================================
-- GRAVITY · Migration 0006 — Storage buckets + policies
-- Public buckets: avatars, banners, store-images, community-gallery.
-- Private buckets (signed URLs only): gov-id, skill-proof, leaderboard-screenshots.
-- (#6 — gov-id/PII files must never be public.)
-- ============================================================================

-- Create buckets (id == name). public flag drives default object visibility.
insert into storage.buckets (id, name, public)
values
  ('avatars',                 'avatars',                 true),
  ('banners',                 'banners',                 true),
  ('store-images',            'store-images',            true),
  ('community-gallery',       'community-gallery',       true),
  ('gov-id',                  'gov-id',                  false),
  ('skill-proof',             'skill-proof',             false),
  ('leaderboard-screenshots', 'leaderboard-screenshots', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Public buckets: anyone can read; only the authenticated owner can write to
-- their own folder (path convention: "<auth.uid()>/<file>").
-- ----------------------------------------------------------------------------
create policy "public buckets: read"
  on storage.objects for select
  using (bucket_id in ('avatars','banners','store-images','community-gallery'));

create policy "public buckets: owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars','banners','store-images','community-gallery')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "public buckets: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars','banners','store-images','community-gallery')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "public buckets: owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars','banners','store-images','community-gallery')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Private buckets: owner (folder = uid) or superadmin may read; owner writes
-- own folder. No anon access. Files are served via short-TTL signed URLs.
-- ----------------------------------------------------------------------------
create policy "private buckets: owner or superadmin read"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('gov-id','skill-proof','leaderboard-screenshots')
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_superadmin(auth.uid())
    )
  );

create policy "private buckets: owner write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('gov-id','skill-proof','leaderboard-screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "private buckets: owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('gov-id','skill-proof','leaderboard-screenshots')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
