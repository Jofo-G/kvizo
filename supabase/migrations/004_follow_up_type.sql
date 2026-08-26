-- Add FOLLOW_UP question type and a score-adjustment helper

-- Widen the type check constraint
ALTER TABLE public.questions
  DROP CONSTRAINT questions_type_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
  CHECK (type IN ('MULTIPLE_CHOICE', 'OPEN', 'PROGRESSIVE_HINTS', 'FOLLOW_UP'));

-- RPC the host calls to give +1 / -1 to a player on a follow-up question
CREATE OR REPLACE FUNCTION public.adjust_session_player_score(
  p_session_player_id uuid,
  p_delta             integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.session_players
  SET score = score + p_delta
  WHERE id = p_session_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_session_player_score TO authenticated;
