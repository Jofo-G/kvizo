-- ============================================================
-- 006 – Hall of Fame (featured sessions)
-- ============================================================

-- ── Featured flag on quiz_sessions ────────────────────────────
alter table public.quiz_sessions
  add column if not exists is_featured boolean not null default false;

-- ── Public read of quizzes that have a featured session ───────
create policy "anyone can read quiz for featured sessions"
  on public.quizzes for select
  using (
    exists (
      select 1 from public.quiz_sessions s
      where s.quiz_id = id and s.is_featured = true
    )
  );

-- ── Public read of answers for featured sessions ──────────────
create policy "anyone can read answers for featured sessions"
  on public.answers for select
  using (
    exists (
      select 1 from public.quiz_sessions s
      where s.id = session_id and s.is_featured = true
    )
  );
