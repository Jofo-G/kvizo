-- Allow MULTIPLE_CHOICE and OPEN questions to deduct points for wrong answers.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS negative_points integer NOT NULL DEFAULT 0;

-- Re-create submit_answer: subtract negative_points on an incorrect
-- MULTIPLE_CHOICE / OPEN answer instead of always awarding 0.
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
       selected_option_id, hint_index_at_submission, is_correct, points_awarded)
    VALUES
      (v_player.session_id, p_session_player_id, p_question_id, p_answer_text,
       p_selected_option_id, v_hint_index, v_is_correct, v_points)
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

-- Re-create override_answer: apply negative_points when a host manually
-- marks a MULTIPLE_CHOICE / OPEN answer as incorrect.
CREATE OR REPLACE FUNCTION public.override_answer(
  p_answer_id  uuid,
  p_is_correct boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_answer   public.answers;
  v_question public.questions;
  v_points   integer := 0;
BEGIN
  SELECT * INTO v_answer FROM public.answers WHERE id = p_answer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Answer not found'; END IF;

  -- Verify caller is a quiz member
  IF NOT public.is_quiz_member(
    (SELECT quiz_id FROM public.quiz_sessions WHERE id = v_answer.session_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_question FROM public.questions WHERE id = v_answer.question_id;

  IF p_is_correct THEN
    IF v_question.type = 'PROGRESSIVE_HINTS' AND v_answer.hint_index_at_submission IS NOT NULL THEN
      SELECT points INTO v_points
      FROM public.question_hints
      WHERE question_id = v_question.id
        AND position = v_answer.hint_index_at_submission;
      v_points := coalesce(v_points, 0);
    ELSE
      v_points := coalesce(v_question.default_points, 1);
    END IF;
  ELSIF v_question.type IN ('MULTIPLE_CHOICE', 'OPEN') THEN
    v_points := -coalesce(v_question.negative_points, 0);
  END IF;

  -- Adjust score
  UPDATE public.session_players
  SET score = score - v_answer.points_awarded + v_points
  WHERE id = v_answer.session_player_id;

  UPDATE public.answers
  SET is_correct = p_is_correct,
      points_awarded = v_points,
      updated_at = now()
  WHERE id = p_answer_id;
END;
$$;

-- Carry negative_points through quiz JSON import/export.
CREATE OR REPLACE FUNCTION public.replace_quiz_from_export(
  p_quiz_id uuid,
  p_quiz jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_data jsonb;
  question_id uuid;
  question_position integer := 0;
BEGIN
  IF NOT public.is_quiz_member(p_quiz_id) THEN
    RAISE EXCEPTION 'You do not have access to this quiz';
  END IF;

  UPDATE public.quizzes
  SET
    name = p_quiz->'quiz'->>'name',
    description = p_quiz->'quiz'->>'description',
    updated_at = now()
  WHERE id = p_quiz_id;

  DELETE FROM public.questions WHERE quiz_id = p_quiz_id;

  FOR question_data IN
    SELECT value
    FROM jsonb_array_elements(p_quiz->'questions')
  LOOP
    question_position := question_position + 1;
    INSERT INTO public.questions (quiz_id, position, type, text, default_points, negative_points)
    VALUES (
      p_quiz_id,
      question_position,
      question_data->>'type',
      question_data->>'text',
      (question_data->>'default_points')::integer,
      coalesce((question_data->>'negative_points')::integer, 0)
    )
    RETURNING id INTO question_id;

    INSERT INTO public.question_options (question_id, position, text, is_correct)
    SELECT question_id, option_data.position, option_data.text, option_data.is_correct
    FROM jsonb_to_recordset(coalesce(question_data->'options', '[]'::jsonb))
      AS option_data(position integer, text text, is_correct boolean);

    INSERT INTO public.accepted_answers (question_id, answer, normalized_answer)
    SELECT
      question_id,
      answer_data.answer,
      regexp_replace(
        regexp_replace(lower(trim(answer_data.answer)), '\s+', ' ', 'g'),
        '[.,!?;:''"]',
        '',
        'g'
      )
    FROM jsonb_array_elements_text(coalesce(question_data->'accepted_answers', '[]'::jsonb))
      AS answer_data(answer);

    INSERT INTO public.question_hints (question_id, position, text, points)
    SELECT question_id, hint_data.position, hint_data.text, hint_data.points
    FROM jsonb_to_recordset(coalesce(question_data->'hints', '[]'::jsonb))
      AS hint_data(position integer, text text, points integer);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_quiz_from_export(uuid, jsonb) TO authenticated;
