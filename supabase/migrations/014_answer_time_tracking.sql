-- Track how long players take to answer, to power a "Fastest" leaderboard.

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS current_question_started_at timestamptz;

ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS question_started_at timestamptz;

-- Re-create submit_answer: capture the question's start time on first
-- submission only (mirrors submitted_at, which also survives later edits).
CREATE OR REPLACE FUNCTION public.submit_answer(
  p_session_player_id uuid,
  p_player_token      text,
  p_question_id       uuid,
  p_answer_text       text DEFAULT NULL,
  p_selected_option_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_player      public.session_players;
  v_session     public.quiz_sessions;
  v_question    public.questions;
  v_is_correct  boolean := false;
  v_points      integer := 0;
  v_hint_index  integer;
  v_token_hash  text;
  v_answer_id   uuid;
  v_existing    public.answers;
BEGIN
  v_token_hash := encode(digest(p_player_token, 'sha256'), 'hex');

  -- Authenticate player
  SELECT * INTO v_player
  FROM public.session_players
  WHERE id = p_session_player_id
    AND player_token_hash = v_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  -- Get session
  SELECT * INTO v_session
  FROM public.quiz_sessions
  WHERE id = v_player.session_id
    AND accepting_answers = true
    AND current_question_id = p_question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Answers not currently accepted for this question';
  END IF;

  v_hint_index := v_session.current_hint_index;

  -- Get question
  SELECT * INTO v_question
  FROM public.questions WHERE id = p_question_id;

  -- Determine correctness & points
  IF v_question.type = 'MULTIPLE_CHOICE' THEN
    SELECT is_correct INTO v_is_correct
    FROM public.question_options
    WHERE id = p_selected_option_id;
    v_is_correct := coalesce(v_is_correct, false);

    IF v_is_correct THEN
      v_points := coalesce(v_question.default_points, 1);
    ELSE
      v_points := -coalesce(v_question.negative_points, 0);
    END IF;

  ELSIF v_question.type IN ('OPEN', 'PROGRESSIVE_HINTS') THEN
    -- Normalize and compare
    DECLARE
      v_normalized text;
    BEGIN
      v_normalized := lower(trim(regexp_replace(p_answer_text, '\s+', ' ', 'g')));
      SELECT true INTO v_is_correct
      FROM public.accepted_answers
      WHERE question_id = p_question_id
        AND normalized_answer = v_normalized
      LIMIT 1;
      v_is_correct := coalesce(v_is_correct, false);
    END;

    IF v_is_correct THEN
      IF v_question.type = 'PROGRESSIVE_HINTS' AND v_hint_index IS NOT NULL THEN
        SELECT points INTO v_points
        FROM public.question_hints
        WHERE question_id = p_question_id
          AND position = v_hint_index;
        v_points := coalesce(v_points, 0);
      ELSE
        v_points := coalesce(v_question.default_points, 1);
      END IF;
    ELSIF v_question.type = 'OPEN' THEN
      v_points := -coalesce(v_question.negative_points, 0);
    END IF;
  END IF;

  -- Upsert answer (one per player/question)
  SELECT * INTO v_existing
  FROM public.answers
  WHERE session_player_id = p_session_player_id
    AND question_id = p_question_id;

  IF FOUND THEN
    -- Only allow update for non-progressive types in MVP
    IF v_question.type = 'PROGRESSIVE_HINTS' THEN
      RAISE EXCEPTION 'Answer already submitted for this question';
    END IF;

    -- Undo previous points
    UPDATE public.session_players
    SET score = score - v_existing.points_awarded
    WHERE id = p_session_player_id;

    UPDATE public.answers
    SET answer_text = p_answer_text,
        selected_option_id = p_selected_option_id,
        hint_index_at_submission = v_hint_index,
        is_correct = v_is_correct,
        points_awarded = v_points,
        updated_at = now()
    WHERE id = v_existing.id
    RETURNING id INTO v_answer_id;
  ELSE
    INSERT INTO public.answers
      (session_id, session_player_id, question_id, answer_text,
       selected_option_id, hint_index_at_submission, is_correct, points_awarded,
       question_started_at)
    VALUES
      (v_player.session_id, p_session_player_id, p_question_id, p_answer_text,
       p_selected_option_id, v_hint_index, v_is_correct, v_points,
       v_session.current_question_started_at)
    RETURNING id INTO v_answer_id;
  END IF;

  -- Update player score
  UPDATE public.session_players
  SET score = score + v_points
  WHERE id = p_session_player_id;

  RETURN jsonb_build_object(
    'answer_id', v_answer_id,
    'is_correct', v_is_correct,
    'points_awarded', v_points
  );
END;
$$;
