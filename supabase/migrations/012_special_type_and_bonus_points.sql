-- Add SPECIAL question type (host awards a custom point amount, no answer from players)
-- and track ad-hoc/bonus point adjustments separately from answer-derived points.

ALTER TABLE public.questions
  DROP CONSTRAINT questions_type_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_type_check
  CHECK (type IN ('MULTIPLE_CHOICE', 'OPEN', 'PROGRESSIVE_HINTS', 'FOLLOW_UP', 'PAUSE', 'SPECIAL'));

-- Running total of points given via adjust_session_player_score (FOLLOW_UP scoring,
-- SPECIAL question scoring, and the host's ad-hoc points panel). Lets the UI show
-- "default points from answers" vs "bonus points" side by side.
ALTER TABLE public.session_players
  ADD COLUMN IF NOT EXISTS bonus_points integer NOT NULL DEFAULT 0;

-- Re-create with an authorization check (only quiz members/hosts of the player's
-- session may adjust scores) and bonus_points bookkeeping.
CREATE OR REPLACE FUNCTION public.adjust_session_player_score(
  p_session_player_id uuid,
  p_delta             integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_quiz_id uuid;
BEGIN
  SELECT s.quiz_id INTO v_quiz_id
  FROM public.session_players sp
  JOIN public.quiz_sessions s ON s.id = sp.session_id
  WHERE sp.id = p_session_player_id;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  IF NOT public.is_quiz_member(v_quiz_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.session_players
  SET score = score + p_delta,
      bonus_points = bonus_points + p_delta
  WHERE id = p_session_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_session_player_score TO authenticated;
