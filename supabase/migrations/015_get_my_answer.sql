-- Public RPC so a player can fetch their own answer for a question.
-- Used to restore submitted/selected state after a page refresh, and to
-- show the review result once the host closes the question.
CREATE OR REPLACE FUNCTION public.get_my_answer(
  p_session_player_id uuid,
  p_player_token      text,
  p_question_id       uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_token_hash text;
  v_answer     public.answers;
BEGIN
  v_token_hash := encode(digest(p_player_token, 'sha256'), 'hex');

  IF NOT EXISTS (
    SELECT 1 FROM public.session_players
    WHERE id = p_session_player_id
      AND player_token_hash = v_token_hash
  ) THEN
    RAISE EXCEPTION 'Invalid player token';
  END IF;

  SELECT * INTO v_answer
  FROM public.answers
  WHERE session_player_id = p_session_player_id
    AND question_id = p_question_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'answer_text', v_answer.answer_text,
    'selected_option_id', v_answer.selected_option_id,
    'is_correct', v_answer.is_correct,
    'points_awarded', v_answer.points_awarded
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_answer(uuid, text, uuid) TO anon, authenticated;
