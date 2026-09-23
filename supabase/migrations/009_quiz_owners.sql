-- Quiz owners can grant other registered users full quiz-member access.

create or replace function public.list_quiz_owner_candidates(p_quiz_id uuid)
returns table (
  user_id uuid,
  email text,
  is_owner boolean
)
language plpgsql security definer stable
set search_path = public, auth
as $$
begin
  if not exists (
    select 1 from public.quizzes
    where id = p_quiz_id and owner_user_id = auth.uid()
  ) then
    raise exception 'Only the quiz creator can manage owners';
  end if;

  return query
  select
    users.id,
    users.email,
    exists (
      select 1 from public.quiz_members members
      where members.quiz_id = p_quiz_id
        and members.user_id = users.id
        and members.role = 'OWNER'
    )
  from auth.users users
  where users.email is not null
  order by users.email;
end;
$$;

create or replace function public.set_quiz_owner(
  p_quiz_id uuid,
  p_user_id uuid,
  p_is_owner boolean
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.quizzes
    where id = p_quiz_id and owner_user_id = auth.uid()
  ) then
    raise exception 'Only the quiz creator can manage owners';
  end if;

  if p_is_owner then
    insert into public.quiz_members (quiz_id, user_id, role)
    values (p_quiz_id, p_user_id, 'OWNER')
    on conflict (quiz_id, user_id) do update set role = 'OWNER';
  else
    if p_user_id = auth.uid() then
      raise exception 'The quiz creator cannot be removed';
    end if;
    delete from public.quiz_members
    where quiz_id = p_quiz_id and user_id = p_user_id;
  end if;
end;
$$;

grant execute on function public.list_quiz_owner_candidates(uuid) to authenticated;
grant execute on function public.set_quiz_owner(uuid, uuid, boolean) to authenticated;