-- Import a complete quiz export in one atomic database transaction.

create or replace function public.replace_quiz_from_export(
  p_quiz_id uuid,
  p_quiz jsonb
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  question_data jsonb;
  question_id uuid;
  question_position integer := 0;
begin
  if not public.is_quiz_member(p_quiz_id) then
    raise exception 'You do not have access to this quiz';
  end if;

  update public.quizzes
  set
    name = p_quiz->'quiz'->>'name',
    description = p_quiz->'quiz'->>'description',
    updated_at = now()
  where id = p_quiz_id;

  delete from public.questions where quiz_id = p_quiz_id;

  for question_data in
    select value
    from jsonb_array_elements(p_quiz->'questions')
  loop
    question_position := question_position + 1;
    insert into public.questions (quiz_id, position, type, text, default_points)
    values (
      p_quiz_id,
      question_position,
      question_data->>'type',
      question_data->>'text',
      (question_data->>'default_points')::integer
    )
    returning id into question_id;

    insert into public.question_options (question_id, position, text, is_correct)
    select question_id, option_data.position, option_data.text, option_data.is_correct
    from jsonb_to_recordset(coalesce(question_data->'options', '[]'::jsonb))
      as option_data(position integer, text text, is_correct boolean);

    insert into public.accepted_answers (question_id, answer, normalized_answer)
    select
      question_id,
      answer_data.answer,
      regexp_replace(
        regexp_replace(lower(trim(answer_data.answer)), '\s+', ' ', 'g'),
        '[.,!?;:''"]',
        '',
        'g'
      )
    from jsonb_array_elements_text(coalesce(question_data->'accepted_answers', '[]'::jsonb))
      as answer_data(answer);

    insert into public.question_hints (question_id, position, text, points)
    select question_id, hint_data.position, hint_data.text, hint_data.points
    from jsonb_to_recordset(coalesce(question_data->'hints', '[]'::jsonb))
      as hint_data(position integer, text text, points integer);
  end loop;
end;
$$;

grant execute on function public.replace_quiz_from_export(uuid, jsonb) to authenticated;