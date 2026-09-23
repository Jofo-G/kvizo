-- Preserve Hall of Fame records by preventing deletion of their source quiz.

create or replace function public.prevent_featured_quiz_deletion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.quiz_sessions
    where quiz_id = old.id
      and is_featured = true
  ) then
    raise exception 'This quiz cannot be deleted because it has a Hall of Fame session';
  end if;

  return old;
end;
$$;

drop trigger if exists prevent_featured_quiz_deletion on public.quizzes;
create trigger prevent_featured_quiz_deletion
before delete on public.quizzes
for each row execute function public.prevent_featured_quiz_deletion();