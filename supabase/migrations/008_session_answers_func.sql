-- ============================================================
-- 008 – Public RPC for session answers (featured or quiz member)
-- ============================================================

-- Returns answers when the session is featured (public) or the caller is a quiz member.
create or replace function public.get_session_answers(p_session_id uuid)
returns setof public.answers language sql security definer stable as $$
  select a.*
  from public.answers a
  join public.quiz_sessions qs on qs.id = a.session_id
  where a.session_id = p_session_id
    and (
      qs.is_featured = true
      or public.is_quiz_member(qs.quiz_id)
    );
$$;

grant execute on function public.get_session_answers(uuid) to anon, authenticated;
