import { supabase } from '@/supabase/client'
import type { AcceptedAnswer, Answer, Question, QuestionHint, QuestionOption, Quiz, QuizSession, SessionPlayer } from '@/shared/types'

// ── Quizzes ────────────────────────────────────────────────

export async function fetchMyQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Quiz[]
}

export async function fetchQuiz(quizId: string): Promise<Quiz> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .single()
  if (error) throw error
  return data as Quiz
}

export async function createQuiz(name: string, description?: string): Promise<Quiz> {
  const { data, error } = await supabase.rpc('create_quiz', {
    p_name: name,
    p_description: description ?? null,
  })
  if (error) throw error
  return data as Quiz
}

export async function updateQuiz(quizId: string, updates: Partial<Pick<Quiz, 'name' | 'description'>>): Promise<void> {
  const { error } = await supabase
    .from('quizzes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', quizId)
  if (error) throw error
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const { error } = await supabase.from('quizzes').delete().eq('id', quizId)
  if (error) throw error
}

// ── Questions ──────────────────────────────────────────────

export async function fetchQuestions(quizId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('position')
  if (error) throw error
  return data as Question[]
}

export async function createQuestion(
  quizId: string,
  position: number,
  type: Question['type'],
): Promise<Question> {
  const { data, error } = await supabase
    .from('questions')
    .insert({ quiz_id: quizId, position, type })
    .select()
    .single()
  if (error) throw error
  return data as Question
}

export async function updateQuestion(
  questionId: string,
  updates: Partial<Omit<Question, 'id' | 'quiz_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('questions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', questionId)
  if (error) throw error
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', questionId)
  if (error) throw error
}

export async function bulkCreateQuestions(
  quizId: string,
  startPosition: number,
  count: number,
  type: Question['type'],
  hintPoints: number[],   // for PROGRESSIVE_HINTS: points per hint position
  defaultPoints: number,  // for MULTIPLE_CHOICE / OPEN
  optionCount: number,    // for MULTIPLE_CHOICE
): Promise<void> {
  // Create all questions in one insert
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .insert(
      Array.from({ length: count }, (_, i) => ({
        quiz_id: quizId,
        position: startPosition + i,
        type,
        default_points: type !== 'PROGRESSIVE_HINTS' ? defaultPoints : null,
      })),
    )
    .select()
  if (qErr) throw qErr

  // Create hints or blank options for each question
  if (type === 'PROGRESSIVE_HINTS' && hintPoints.length > 0) {
    const hintRows = (questions as Question[]).flatMap((q) =>
      hintPoints.map((pts, idx) => ({
        question_id: q.id,
        position: idx + 1,
        text: '',
        points: pts,
      })),
    )
    const { error } = await supabase.from('question_hints').insert(hintRows)
    if (error) throw error
  }

  if (type === 'MULTIPLE_CHOICE' && optionCount > 0) {
    const optionRows = (questions as Question[]).flatMap((q) =>
      Array.from({ length: optionCount }, (_, i) => ({
        question_id: q.id,
        position: i + 1,
        text: '',
        is_correct: false,
      })),
    )
    const { error } = await supabase.from('question_options').insert(optionRows)
    if (error) throw error
  }
}

// ── Question options ───────────────────────────────────────

export async function fetchOptions(questionId: string): Promise<QuestionOption[]> {
  const { data, error } = await supabase
    .from('question_options')
    .select('*')
    .eq('question_id', questionId)
    .order('position')
  if (error) throw error
  return data as QuestionOption[]
}

export async function upsertOptions(
  questionId: string,
  options: Array<Omit<QuestionOption, 'id' | 'question_id'>>,
): Promise<void> {
  // Delete existing then re-insert for simplicity
  await supabase.from('question_options').delete().eq('question_id', questionId)
  if (options.length === 0) return
  const { error } = await supabase.from('question_options').insert(
    options.map((o) => ({ ...o, question_id: questionId })),
  )
  if (error) throw error
}

// ── Accepted answers ───────────────────────────────────────

import { normalizeAnswer } from '@/shared/lib/utils'

export async function fetchAcceptedAnswers(questionId: string): Promise<AcceptedAnswer[]> {
  const { data, error } = await supabase
    .from('accepted_answers')
    .select('*')
    .eq('question_id', questionId)
  if (error) throw error
  return data as AcceptedAnswer[]
}

export async function upsertAcceptedAnswers(questionId: string, answers: string[]): Promise<void> {
  await supabase.from('accepted_answers').delete().eq('question_id', questionId)
  if (answers.length === 0) return
  const { error } = await supabase.from('accepted_answers').insert(
    answers.map((a) => ({
      question_id: questionId,
      answer: a,
      normalized_answer: normalizeAnswer(a),
    })),
  )
  if (error) throw error
}

// ── Question hints ─────────────────────────────────────────

export async function fetchHints(questionId: string): Promise<QuestionHint[]> {
  const { data, error } = await supabase
    .from('question_hints')
    .select('*')
    .eq('question_id', questionId)
    .order('position')
  if (error) throw error
  return data as QuestionHint[]
}

export async function upsertHints(
  questionId: string,
  hints: Array<Omit<QuestionHint, 'id' | 'question_id'>>,
): Promise<void> {
  await supabase.from('question_hints').delete().eq('question_id', questionId)
  if (hints.length === 0) return
  const { error } = await supabase.from('question_hints').insert(
    hints.map((h) => ({ ...h, question_id: questionId })),
  )
  if (error) throw error
}

// ── Sessions ───────────────────────────────────────────────

export async function fetchSession(sessionId: string): Promise<QuizSession> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  return data as QuizSession
}

export async function fetchSessionByCode(joinCode: string): Promise<QuizSession | null> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('join_code', joinCode)
    .single()
  if (error) return null
  return data as QuizSession
}

export async function fetchSessionsForQuiz(quizId: string): Promise<QuizSession[]> {
  const { data, error } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as QuizSession[]
}

export async function createSession(quizId: string, joinCode: string): Promise<QuizSession> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('quiz_sessions')
    .insert({ quiz_id: quizId, host_user_id: user.id, join_code: joinCode })
    .select()
    .single()
  if (error) throw error
  return data as QuizSession
}

export async function updateSession(
  sessionId: string,
  updates: Partial<Pick<QuizSession, 'status' | 'current_question_id' | 'current_hint_index' | 'accepting_answers' | 'started_at' | 'finished_at'>>,
): Promise<void> {
  const { error } = await supabase
    .from('quiz_sessions')
    .update(updates)
    .eq('id', sessionId)
  if (error) throw error
}

// ── Session players ────────────────────────────────────────

export async function fetchSessionPlayers(sessionId: string): Promise<SessionPlayer[]> {
  const { data, error } = await supabase
    .from('session_players')
    .select('*, player_profiles(avatar_url)')
    .eq('session_id', sessionId)
    .order('score', { ascending: false })
  if (error) throw error
  return (data ?? []).map((p: any) => ({
    id: p.id,
    session_id: p.session_id,
    player_profile_id: p.player_profile_id,
    display_name: p.display_name,
    score: p.score,
    joined_at: p.joined_at,
    avatar_url: p.player_profiles?.avatar_url ?? null,
  })) as SessionPlayer[]
}

// ── Answers ────────────────────────────────────────────────

export async function fetchAnswersForSession(sessionId: string): Promise<Answer[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('session_id', sessionId)
  if (error) throw error
  return data as Answer[]
}

export async function fetchAnswersForQuestion(
  sessionId: string,
  questionId: string,
): Promise<Answer[]> {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('session_id', sessionId)
    .eq('question_id', questionId)
  if (error) throw error
  return data as Answer[]
}
