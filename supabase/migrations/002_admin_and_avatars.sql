-- ============================================================
-- 002 – Admin role & player avatars
-- ============================================================

-- ── Admin flag on user_profiles ────────────────────────────────
alter table public.user_profiles
  add column if not exists is_admin boolean not null default false;

-- ── is_admin helper ───────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select is_admin from public.user_profiles where id = auth.uid()),
    false
  );
$$;

-- Grant admin to every existing user_profiles row
update public.user_profiles set is_admin = true;

-- Insert a profile for auth users that don't have one yet (grant admin)
insert into public.user_profiles (id, display_name, is_admin)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.email, 'User'),
  true
from auth.users u
where u.id not in (select id from public.user_profiles)
on conflict (id) do nothing;

-- Allow users to read their own is_admin flag (existing select policy covers this)

-- ── Avatar URL on player_profiles ─────────────────────────────
alter table public.player_profiles
  add column if not exists avatar_url text;

-- ── Tighten player_profiles write policies ────────────────────
-- Remove the open "anyone can create" policy
drop policy if exists "anyone can create player_profiles" on public.player_profiles;

-- Only admins may create / update / delete player profiles
create policy "admins can create player_profiles"
  on public.player_profiles for insert
  with check (public.is_admin());

create policy "admins can update player_profiles"
  on public.player_profiles for update
  using (public.is_admin());

create policy "admins can delete player_profiles"
  on public.player_profiles for delete
  using (public.is_admin());

-- ── Storage bucket for player avatars ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-avatars',
  'player-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Anyone can read (bucket is public)
create policy "Public read player avatars"
  on storage.objects for select
  using (bucket_id = 'player-avatars');

create policy "Admins can upload player avatars"
  on storage.objects for insert
  with check (bucket_id = 'player-avatars' and public.is_admin());

create policy "Admins can update player avatars"
  on storage.objects for update
  using (bucket_id = 'player-avatars' and public.is_admin());

create policy "Admins can delete player avatars"
  on storage.objects for delete
  using (bucket_id = 'player-avatars' and public.is_admin());
