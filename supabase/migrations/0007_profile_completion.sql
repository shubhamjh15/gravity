-- ============================================================================
-- GRAVITY · Migration 0007 — Profile completion (derived, not hand-maintained)
-- The spec requires profile_completion_pct to be COMPUTED. We recompute it on
-- any change to the inputs (profiles, profiles_private, player_game_profiles)
-- via triggers, so the meter is always truthful.
-- ============================================================================

-- Weighted completion: 8 signals, 100% when all present.
--   display_name, avatar, age, gender   (public profile)   -> 12.5% each = 50%
--   phone, upi_id, gov_id_doc_path      (private/KYC)       -> ~16.6% each = 50% (split)
--   at least one player_game_profile                        -> counted in the mix
-- We keep it simple + deterministic.
create or replace function public.compute_profile_completion(p_user_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pts int := 0;
  total int := 8;
  prof public.profiles%rowtype;
  priv public.profiles_private%rowtype;
  has_game boolean;
begin
  select * into prof from public.profiles where id = p_user_id;
  if not found then
    return 0;
  end if;
  select * into priv from public.profiles_private where user_id = p_user_id;

  if prof.display_name is not null and length(trim(prof.display_name)) > 0 then pts := pts + 1; end if;
  if prof.avatar_path is not null then pts := pts + 1; end if;
  if prof.age is not null then pts := pts + 1; end if;
  if prof.gender is not null then pts := pts + 1; end if;

  if priv.phone is not null and length(trim(priv.phone)) > 0 then pts := pts + 1; end if;
  if priv.upi_id is not null and length(trim(priv.upi_id)) > 0 then pts := pts + 1; end if;
  if priv.gov_id_doc_path is not null then pts := pts + 1; end if;

  select exists(
    select 1 from public.player_game_profiles
    where user_id = p_user_id and in_game_id is not null
  ) into has_game;
  if has_game then pts := pts + 1; end if;

  return floor((pts::numeric / total) * 100)::int;
end;
$$;

-- Apply the computed value back onto profiles.profile_completion_pct.
create or replace function public.refresh_profile_completion(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set profile_completion_pct = public.compute_profile_completion(p_user_id)
  where id = p_user_id;
end;
$$;

-- Trigger fns for each input table -------------------------------------------
create or replace function public.trg_refresh_completion_profiles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- avoid infinite loop: only recompute when a relevant input column changed,
  -- and never when we're the one writing profile_completion_pct.
  if (tg_op = 'INSERT') or
     (new.display_name is distinct from old.display_name) or
     (new.avatar_path is distinct from old.avatar_path) or
     (new.age is distinct from old.age) or
     (new.gender is distinct from old.gender)
  then
    update public.profiles
    set profile_completion_pct = public.compute_profile_completion(new.id)
    where id = new.id;
  end if;
  return new;
end; $$;

create or replace function public.trg_refresh_completion_private()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_profile_completion(new.user_id);
  return new;
end; $$;

create or replace function public.trg_refresh_completion_game()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_profile_completion(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end; $$;

-- Wire the triggers ----------------------------------------------------------
drop trigger if exists trg_completion_on_profiles on public.profiles;
create trigger trg_completion_on_profiles
  after insert or update on public.profiles
  for each row execute function public.trg_refresh_completion_profiles();

drop trigger if exists trg_completion_on_private on public.profiles_private;
create trigger trg_completion_on_private
  after insert or update on public.profiles_private
  for each row execute function public.trg_refresh_completion_private();

drop trigger if exists trg_completion_on_game on public.player_game_profiles;
create trigger trg_completion_on_game
  after insert or update or delete on public.player_game_profiles
  for each row execute function public.trg_refresh_completion_game();

comment on function public.compute_profile_completion(uuid) is
  'Derived profile completion 0-100 from 8 signals. Never hand-set; triggers keep profiles.profile_completion_pct current.';
