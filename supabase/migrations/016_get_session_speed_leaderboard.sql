-- Public RPC (no auth required) that aggregates each player's average
-- time-to-correct-answer for a session. Used by the public big-screen
-- leaderboard's "Fastest" tab, which — unlike get_session_answers — must
-- work for anonymous viewers (e.g. a TV not logged in as the quiz host).
CREATE OR REPLACE FUNCTION public.get_session_speed_leaderboard(p_session_id uuid)
RETURNS TABLE (session_player_id uuid, avg_seconds numeric, answer_count integer)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    a.session_player_id,
    avg(extract(epoch FROM (a.submitted_at - a.question_started_at)))::numeric AS avg_seconds,
    count(*)::integer AS answer_count
  FROM public.answers a
  WHERE a.session_id = p_session_id
    AND a.is_correct = true
    AND a.question_started_at IS NOT NULL
  GROUP BY a.session_player_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_speed_leaderboard(uuid) TO anon, authenticated;
