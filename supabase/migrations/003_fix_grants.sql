-- Grant table-level privileges that Supabase roles need to satisfy RLS policies
grant select on public.user_profiles to authenticated;
grant insert, update, delete on public.user_profiles to authenticated;

-- Ensure player_profiles has the same (belt-and-suspenders)
grant select on public.player_profiles to authenticated, anon;
grant insert, update, delete on public.player_profiles to authenticated;
