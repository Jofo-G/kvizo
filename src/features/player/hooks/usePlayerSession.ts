import { supabase } from '@/supabase/client'
import type { QuizSession, SessionPlayer } from '@/shared/types'
import {
  PLAYER_SESSION_ID_KEY,
  PLAYER_SESSION_KEY,
  PLAYER_TOKEN_KEY,
} from '@/shared/types'
import { fetchSession, fetchSessionPlayers } from '../../quizzes/api/quizApi'
import { subscribeToSession } from '../../sessions/api/realtimeApi'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'

interface StoredPlayerData {
  sessionPlayerId: string
  playerToken: string
  sessionId: string
}

function loadStoredPlayer(): StoredPlayerData | null {
  const sessionPlayerId = localStorage.getItem(PLAYER_SESSION_KEY)
  const playerToken = localStorage.getItem(PLAYER_TOKEN_KEY)
  const sessionId = localStorage.getItem(PLAYER_SESSION_ID_KEY)
  if (!sessionPlayerId || !playerToken || !sessionId) return null
  return { sessionPlayerId, playerToken, sessionId }
}

export function usePlayerSession(sessionId: string) {
  const [session, setSession] = useState<QuizSession | null>(null)
  const [players, setPlayers] = useState<SessionPlayer[]>([])
  const [myPlayer, setMyPlayer] = useState<SessionPlayer | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitResult, setSubmitResult] = useState<{
    is_correct: boolean
    points_awarded: number
  } | null>(null)

  const storedRef = useRef<StoredPlayerData | null>(loadStoredPlayer())
  const channelRef = useRef<RealtimeChannel | null>(null)

  async function reload() {
    const [s, p] = await Promise.all([
      fetchSession(sessionId),
      fetchSessionPlayers(sessionId),
    ])
    setSession(s)
    setPlayers(p)

    const stored = storedRef.current
    if (stored) {
      const me = p.find((x) => x.id === stored.sessionPlayerId)
      setMyPlayer(me ?? null)
    }
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))

    channelRef.current = subscribeToSession(sessionId, () => {
      reload()
    })

    // DB-driven player list updates
    const dbChannel = supabase
      .channel(`db-players-watch:${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_players', filter: `session_id=eq.${sessionId}` },
        () => reload(),
      )
      .subscribe()

    return () => {
      channelRef.current?.unsubscribe()
      dbChannel.unsubscribe()
    }
  }, [sessionId])

  async function joinSession(playerProfileId: string, displayName: string) {
    const { data, error } = await supabase.rpc('join_session', {
      p_join_code: session?.join_code,
      p_player_profile_id: playerProfileId,
      p_display_name: displayName,
    })
    if (error) throw error

    const result = data as {
      session_id: string
      session_player_id: string
      player_token: string
    }

    localStorage.setItem(PLAYER_TOKEN_KEY, result.player_token)
    localStorage.setItem(PLAYER_SESSION_KEY, result.session_player_id)
    localStorage.setItem(PLAYER_SESSION_ID_KEY, result.session_id)
    storedRef.current = {
      sessionPlayerId: result.session_player_id,
      playerToken: result.player_token,
      sessionId: result.session_id,
    }

    await reload()
  }

  async function submitAnswer(params: {
    questionId: string
    answerText?: string
    selectedOptionId?: string
  }) {
    const stored = storedRef.current
    if (!stored) throw new Error('Not joined')

    const { data, error } = await supabase.rpc('submit_answer', {
      p_session_player_id: stored.sessionPlayerId,
      p_player_token: stored.playerToken,
      p_question_id: params.questionId,
      p_answer_text: params.answerText ?? null,
      p_selected_option_id: params.selectedOptionId ?? null,
    })
    if (error) throw error
    setSubmitResult(data as { is_correct: boolean; points_awarded: number })
    await reload()
  }

  const isJoined = !!storedRef.current && !!myPlayer

  return {
    session,
    players,
    myPlayer,
    loading,
    isJoined,
    submitResult,
    joinSession,
    submitAnswer,
    storedRef,
  }
}
