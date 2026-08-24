-- ============================================================
-- Kvizo – initial schema
-- ============================================================

-- Extension for UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- user_profiles (optional extra data on top of auth.users)
-- ============================================================
create table public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at  timestamptz default now()
);

alter table public.user_profiles enable row level security;

create policy "users can read own profile"
  on public.user_profiles for select using (auth.uid() = id);

create policy "users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);

-- ============================================================
-- quizzes
-- ============================================================
create table public.quizzes (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table public.quizzes enable row level security;

-- quiz_members (owner + editors)
create table public.quiz_members (
  quiz_id    uuid not null references public.quizzes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('OWNER', 'EDITOR')),
  created_at timestamptz default now(),
  primary key (quiz_id, user_id)
);

alter table public.quiz_members enable row level security;

-- Helper: is the current user an owner or editor of a quiz?
create or replace function public.is_quiz_member(p_quiz_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.quiz_members
    where quiz_id = p_quiz_id
      and user_id = auth.uid()
  );
$$;

create policy "quiz members can read quiz"
  on public.quizzes for select
  using (public.is_quiz_member(id));

create policy "quiz members can update quiz"
  on public.quizzes for update
  using (public.is_quiz_member(id));

create policy "quiz members can delete quiz"
  on public.quizzes for delete
  using (owner_user_id = auth.uid());

create policy "authenticated users can create quizzes"
  on public.quizzes for insert
  with check (auth.uid() = owner_user_id);

create policy "quiz members can read quiz_members"
  on public.quiz_members for select
  using (public.is_quiz_member(quiz_id));

create policy "quiz owners can insert quiz_members"
  on public.quiz_members for insert
  with check (
    exists (
      select 1 from public.quiz_members
      where quiz_id = quiz_members.quiz_id
        and user_id = auth.uid()
        and role = 'OWNER'
    )
  );

create policy "quiz owners can delete quiz_members"
  on public.quiz_members for delete
  using (
    exists (
      select 1 from public.quiz_members qm
      where qm.quiz_id = quiz_members.quiz_id
        and qm.user_id = auth.uid()
        and qm.role = 'OWNER'
    )
  );

-- Auto-insert owner into quiz_members on quiz creation
create or replace function public.on_quiz_created()
returns trigger language plpgsql security definer as $$
begin
  insert into public.quiz_members (quiz_id, user_id, role)
  values (new.id, new.owner_user_id, 'OWNER');
  return new;
end;
$$;

create trigger quiz_created_add_owner
  after insert on public.quizzes
  for each row execute function public.on_quiz_created();

-- ============================================================
-- questions
-- ============================================================
create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  position       integer not null,
  type           text not null check (type in ('MULTIPLE_CHOICE', 'OPEN', 'PROGRESSIVE_HINTS')),
  text           text,
  default_points integer,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table public.questions enable row level security;

create policy "quiz members can read questions"
  on public.questions for select
  using (public.is_quiz_member(quiz_id));

create policy "quiz members can insert questions"
  on public.questions for insert
  with check (public.is_quiz_member(quiz_id));

create policy "quiz members can update questions"
  on public.questions for update
  using (public.is_quiz_member(quiz_id));

create policy "quiz members can delete questions"
  on public.questions for delete
  using (public.is_quiz_member(quiz_id));

-- ============================================================
-- question_options (multiple choice)
-- ============================================================
create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  position    integer not null,
  text        text not null,
  is_correct  boolean not null default false
);

alter table public.question_options enable row level security;

-- Players must NOT see is_correct while question is active – enforced at app layer.
-- RLS: readable by quiz members only (host) when building quiz;
--      players get options without is_correct via a view/function.
create policy "quiz members can manage options"
  on public.question_options for all
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id
        and public.is_quiz_member(q.quiz_id)
    )
  );

-- ============================================================
-- accepted_answers (open / progressive)
-- ============================================================
create table public.accepted_answers (
  id                uuid primary key default gen_random_uuid(),
  question_id       uuid not null references public.questions(id) on delete cascade,
  answer            text not null,
  normalized_answer text not null
);

alter table public.accepted_answers enable row level security;

create policy "quiz members can manage accepted_answers"
  on public.accepted_answers for all
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id
        and public.is_quiz_member(q.quiz_id)
    )
  );

-- ============================================================
-- question_hints (progressive hints)
-- ============================================================
create table public.question_hints (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  position    integer not null,
  text        text not null,
  points      integer not null
);

alter table public.question_hints enable row level security;

create policy "quiz members can manage hints"
  on public.question_hints for all
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_id
        and public.is_quiz_member(q.quiz_id)
    )
  );

-- ============================================================
-- player_profiles
-- ============================================================
create table public.player_profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.player_profiles enable row level security;

-- Anyone can read player profiles (needed for join screen)
create policy "anyone can read player_profiles"
  on public.player_profiles for select using (true);

create policy "anyone can create player_profiles"
  on public.player_profiles for insert with check (true);

-- ============================================================
-- quiz_sessions
-- ============================================================
create table public.quiz_sessions (
  id                  uuid primary key default gen_random_uuid(),
  quiz_id             uuid not null references public.quizzes(id) on delete cascade,
  host_user_id        uuid not null references auth.users(id),
  join_code           text not null unique,
  status              text not null default 'LOBBY'
                        check (status in ('LOBBY','RUNNING','FINISHED','CANCELLED')),
  current_question_id uuid references public.questions(id) on delete set null,
  current_hint_index  integer,
  accepting_answers   boolean not null default false,
  started_at          timestamptz,
  finished_at         timestamptz,
  created_at          timestamptz default now()
);

alter table public.quiz_sessions enable row level security;

-- Hosts (quiz members) can manage sessions
create policy "quiz members can create sessions"
  on public.quiz_sessions for insert
  with check (
    auth.uid() = host_user_id
    and public.is_quiz_member(quiz_id)
  );

create policy "quiz members can read sessions"
  on public.quiz_sessions for select
  using (public.is_quiz_member(quiz_id));

create policy "quiz members can update sessions"
  on public.quiz_sessions for update
  using (public.is_quiz_member(quiz_id));

-- Players can read session by join_code or session_id (needed for /join and /play)
create policy "anyone can read active session by id"
  on public.quiz_sessions for select
  using (true);

-- ============================================================
-- session_players
-- ============================================================
create table public.session_players (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.quiz_sessions(id) on delete cascade,
  player_profile_id uuid references public.player_profiles(id) on delete set null,
  display_name      text not null,
  score             integer not null default 0,
  player_token_hash text not null,
  joined_at         timestamptz default now()
);

alter table public.session_players enable row level security;

create policy "anyone can read session_players"
  on public.session_players for select using (true);

-- Players insert themselves via joinSession RPC (security definer)
-- Quiz members can read all
create policy "quiz members can update session_players"
  on public.session_players for update
  using (
    exists (
      select 1 from public.quiz_sessions s
      where s.id = session_id
        and public.is_quiz_member(s.quiz_id)
    )
  );

-- ============================================================
-- answers
-- ============================================================
create table public.answers (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.quiz_sessions(id) on delete cascade,
  session_player_id     uuid not null references public.session_players(id) on delete cascade,
  question_id           uuid not null references public.questions(id) on delete cascade,
  answer_text           text,
  selected_option_id    uuid references public.question_options(id) on delete set null,
  hint_index_at_submission integer,
  is_correct            boolean,
  points_awarded        integer not null default 0,
  submitted_at          timestamptz default now(),
  updated_at            timestamptz default now(),
  unique (session_player_id, question_id)
);

alter table public.answers enable row level security;

-- Quiz members can read all answers for their sessions
create policy "quiz members can read answers"
  on public.answers for select
  using (
    exists (
      select 1 from public.quiz_sessions s
      where s.id = session_id
        and public.is_quiz_member(s.quiz_id)
    )
  );

-- Players submit/update their own answer via submitAnswer RPC

-- ============================================================
-- RPC: join_session
-- Creates / reuses a session_player, returns player_token
-- ============================================================
create or replace function public.join_session(
  p_join_code       text,
  p_player_profile_id uuid,
  p_display_name    text
)
returns jsonb language plpgsql security definer as $$
declare
  v_session   public.quiz_sessions;
  v_existing  public.session_players;
  v_token     text;
  v_token_hash text;
  v_player_id uuid;
begin
  -- Resolve session
  select * into v_session
  from public.quiz_sessions
  where join_code = p_join_code
    and status = 'LOBBY';

  if not found then
    raise exception 'Session not found or not in lobby';
  end if;

  -- Check if profile already joined this session
  select * into v_existing
  from public.session_players
  where session_id = v_session.id
    and player_profile_id = p_player_profile_id;

  if found then
    raise exception 'Player already joined this session';
  end if;

  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into public.session_players
    (session_id, player_profile_id, display_name, player_token_hash)
  values
    (v_session.id, p_player_profile_id, p_display_name, v_token_hash)
  returning id into v_player_id;

  return jsonb_build_object(
    'session_id', v_session.id,
    'session_player_id', v_player_id,
    'player_token', v_token
  );
end;
$$;

-- ============================================================
-- RPC: submit_answer
-- ============================================================
create or replace function public.submit_answer(
  p_session_player_id uuid,
  p_player_token      text,
  p_question_id       uuid,
  p_answer_text       text default null,
  p_selected_option_id uuid default null
)
returns jsonb language plpgsql security definer as $$
declare
  v_player      public.session_players;
  v_session     public.quiz_sessions;
  v_question    public.questions;
  v_is_correct  boolean := false;
  v_points      integer := 0;
  v_hint_index  integer;
  v_token_hash  text;
  v_answer_id   uuid;
  v_existing    public.answers;
begin
  v_token_hash := encode(digest(p_player_token, 'sha256'), 'hex');

  -- Authenticate player
  select * into v_player
  from public.session_players
  where id = p_session_player_id
    and player_token_hash = v_token_hash;

  if not found then
    raise exception 'Invalid player token';
  end if;

  -- Get session
  select * into v_session
  from public.quiz_sessions
  where id = v_player.session_id
    and accepting_answers = true
    and current_question_id = p_question_id;

  if not found then
    raise exception 'Answers not currently accepted for this question';
  end if;

  v_hint_index := v_session.current_hint_index;

  -- Get question
  select * into v_question
  from public.questions where id = p_question_id;

  -- Determine correctness & points
  if v_question.type = 'MULTIPLE_CHOICE' then
    select is_correct into v_is_correct
    from public.question_options
    where id = p_selected_option_id;

    if v_is_correct then
      v_points := coalesce(v_question.default_points, 1);
    end if;

  elsif v_question.type in ('OPEN', 'PROGRESSIVE_HINTS') then
    -- Normalize and compare
    declare
      v_normalized text;
    begin
      v_normalized := lower(trim(regexp_replace(p_answer_text, '\s+', ' ', 'g')));
      select true into v_is_correct
      from public.accepted_answers
      where question_id = p_question_id
        and normalized_answer = v_normalized
      limit 1;
      v_is_correct := coalesce(v_is_correct, false);
    end;

    if v_is_correct then
      if v_question.type = 'PROGRESSIVE_HINTS' and v_hint_index is not null then
        select points into v_points
        from public.question_hints
        where question_id = p_question_id
          and position = v_hint_index;
        v_points := coalesce(v_points, 0);
      else
        v_points := coalesce(v_question.default_points, 1);
      end if;
    end if;
  end if;

  -- Upsert answer (one per player/question)
  select * into v_existing
  from public.answers
  where session_player_id = p_session_player_id
    and question_id = p_question_id;

  if found then
    -- Only allow update for non-progressive types in MVP
    if v_question.type = 'PROGRESSIVE_HINTS' then
      raise exception 'Answer already submitted for this question';
    end if;

    -- Undo previous points
    update public.session_players
    set score = score - v_existing.points_awarded
    where id = p_session_player_id;

    update public.answers
    set answer_text = p_answer_text,
        selected_option_id = p_selected_option_id,
        hint_index_at_submission = v_hint_index,
        is_correct = v_is_correct,
        points_awarded = v_points,
        updated_at = now()
    where id = v_existing.id
    returning id into v_answer_id;
  else
    insert into public.answers
      (session_id, session_player_id, question_id, answer_text,
       selected_option_id, hint_index_at_submission, is_correct, points_awarded)
    values
      (v_player.session_id, p_session_player_id, p_question_id, p_answer_text,
       p_selected_option_id, v_hint_index, v_is_correct, v_points)
    returning id into v_answer_id;
  end if;

  -- Update player score
  update public.session_players
  set score = score + v_points
  where id = p_session_player_id;

  return jsonb_build_object(
    'answer_id', v_answer_id,
    'is_correct', v_is_correct,
    'points_awarded', v_points
  );
end;
$$;

-- ============================================================
-- RPC: override_answer
-- Host manually marks an answer correct/incorrect
-- ============================================================
create or replace function public.override_answer(
  p_answer_id  uuid,
  p_is_correct boolean
)
returns void language plpgsql security definer as $$
declare
  v_answer   public.answers;
  v_question public.questions;
  v_points   integer := 0;
begin
  select * into v_answer from public.answers where id = p_answer_id;
  if not found then raise exception 'Answer not found'; end if;

  -- Verify caller is a quiz member
  if not public.is_quiz_member(
    (select quiz_id from public.quiz_sessions where id = v_answer.session_id)
  ) then
    raise exception 'Not authorized';
  end if;

  select * into v_question from public.questions where id = v_answer.question_id;

  if p_is_correct then
    if v_question.type = 'PROGRESSIVE_HINTS' and v_answer.hint_index_at_submission is not null then
      select points into v_points
      from public.question_hints
      where question_id = v_question.id
        and position = v_answer.hint_index_at_submission;
      v_points := coalesce(v_points, 0);
    else
      v_points := coalesce(v_question.default_points, 1);
    end if;
  end if;

  -- Adjust score
  update public.session_players
  set score = score - v_answer.points_awarded + v_points
  where id = v_answer.session_player_id;

  update public.answers
  set is_correct = p_is_correct,
      points_awarded = v_points,
      updated_at = now()
  where id = p_answer_id;
end;
$$;

-- ============================================================
-- Grants (RLS restricts rows; grants allow table access at all)
-- ============================================================
grant select, insert, update, delete on public.quizzes           to authenticated;
grant select, insert, update, delete on public.quiz_members      to authenticated;
grant select, insert, update, delete on public.questions         to authenticated;
grant select, insert, update, delete on public.question_options  to authenticated;
grant select, insert, update, delete on public.accepted_answers  to authenticated;
grant select, insert, update, delete on public.question_hints    to authenticated;
grant select, insert, update, delete on public.quiz_sessions     to authenticated;
grant select, insert, update, delete on public.session_players   to authenticated;
grant select, insert, update, delete on public.answers           to authenticated;
grant select, insert               on public.player_profiles     to authenticated;

grant select         on public.quiz_sessions    to anon;
grant select         on public.session_players  to anon;
grant select, insert on public.player_profiles  to anon;

grant select on public.question_options_safe to anon, authenticated;

-- ============================================================
-- Helper view: safe question options for players (no is_correct)
-- ============================================================
create view public.question_options_safe as
  select id, question_id, position, text
  from public.question_options;

-- ============================================================
-- RPC: create_quiz
-- Security definer so auth.uid() is always resolved correctly
-- ============================================================
create or replace function public.create_quiz(
  p_name        text,
  p_description text default null
)
returns public.quizzes language plpgsql security definer as $$
declare
  v_quiz public.quizzes;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.quizzes (owner_user_id, name, description)
  values (auth.uid(), p_name, p_description)
  returning * into v_quiz;

  return v_quiz;
end;
$$;
