import { supabase } from '@/supabase/client'
import type { QuizSession, SessionPlayer } from '@/shared/types'
import { fetchSession, fetchSessionPlayers, updateSession } from '../../quizzes/api/quizApi'
import { broadcastEvent, subscribeToSession } from '../../sessions/api/realtimeApi'
import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useHostSession(sessionId: string) {
  const [session, setSession] = useState<QuizSession | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  async function reload() {
    const [s, p] = await Promise.all([
      fetchSession(sessionId),
      fetchSessionPlayers(sessionId),
    ])
    setSession(s)
    setPlayers(p)
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))

    channelRef.current = subscribeToSession(sessionId, () => {
      reload()
    })

    // Listen to DB changes for real-time player joins
    // (requires: alter publication supabase_realtime add table public.session_players)
    const dbChannel = supabase
      .channel(`db-session-players:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` },
        () => reload(),
      )
      .subscribe()

    // Polling fallback: re-fetch every 3s during lobby/running
    const poll = setInterval(() => reload(), 3000)

    return () => {
      channelRef.current?.unsubscribe()
      dbChannel.unsubscribe()
      clearInterval(poll)
    }
  }, [sessionId])

  async function startQuiz(firstQuestionId: string, acceptAnswers = true) {
    await updateSession(sessionId, {
      status: 'RUNNING',
      started_at: new Date().toISOString(),
      current_question_id: firstQuestionId,
      current_hint_index: 0,
      accepting_answers: acceptAnswers,
    })
    await broadcastEvent(sessionId, { type: 'SESSION_STARTED' })
    await broadcastEvent(sessionId, { type: 'QUESTION_STARTED', questionId: firstQuestionId })
    await reload()
  }

  async function startQuestion(questionId: string, acceptAnswers = true) {
    await updateSession(sessionId, {
      current_question_id: questionId,
      current_hint_index: 0,
      accepting_answers: acceptAnswers,
    })
    await broadcastEvent(sessionId, { type: 'QUESTION_STARTED', questionId })
    await reload()
  }

  async function revealNextHint() {
    if (!session) return
    const nextIdx = (session.current_hint_index ?? 1) + 1
    await updateSession(sessionId, { current_hint_index: nextIdx })
    await broadcastEvent(sessionId, {
      type: 'HINT_REVEALED',
      questionId: session.current_question_id,
      hintIndex: nextIdx,
    })
    await reload()
  }

  async function closeAnswers() {
    if (!session) return
    await updateSession(sessionId, { accepting_answers: false })
    await broadcastEvent(sessionId, {
      type: 'QUESTION_CLOSED',
      questionId: session.current_question_id,
    })
    await reload()
  }

  async function finishSession() {
    await updateSession(sessionId, {
      status: 'FINISHED',
      finished_at: new Date().toISOString(),
      accepting_answers: false,
    })
    await broadcastEvent(sessionId, { type: 'SESSION_FINISHED' })
    await reload()
  }

  async function refreshLeaderboard() {
    await reload()
    await broadcastEvent(sessionId, { type: 'SCOREBOARD_UPDATED' })
  }

  return {
    session,
    players,
    loading,
    reload,
    startQuiz,
    startQuestion,
    revealNextHint,
    closeAnswers,
    finishSession,
    refreshLeaderboard,
  }
}
