-- ============================================================
-- 007 – Public RPC for Hall of Fame (bypasses quizzes RLS)
-- ============================================================

-- Returns featured sessions with quiz name and top-scorer; security definer
-- lets anon users read quizzes without needing quiz membership.
create or replace function public.get_featured_sessions()
returns table (
  id                    uuid,
  quiz_id               uuid,
  quiz_name             text,
  created_at            timestamptz,
  winner_display_name   text,
  winner_avatar_url     text,
  winner_score          integer
) language sql security definer stable as $$
  select
    qs.id,
    qs.quiz_id,
    q.name            as quiz_name,
    qs.created_at,
    sp.display_name   as winner_display_name,
    pp.avatar_url     as winner_avatar_url,
    sp.score          as winner_score
  from public.quiz_sessions qs
  join public.quizzes q on q.id = qs.quiz_id
  left join lateral (
    select sp2.display_name, sp2.score, sp2.player_profile_id
    from public.session_players sp2
    where sp2.session_id = qs.id
    order by sp2.score desc
    limit 1
  ) sp on true
  left join public.player_profiles pp on pp.id = sp.player_profile_id
  where qs.is_featured = true
  order by qs.created_at desc;
$$;

grant execute on function public.get_featured_sessions() to anon, authenticated;
