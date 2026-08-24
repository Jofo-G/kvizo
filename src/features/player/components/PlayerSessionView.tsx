import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { PlayerProfile, SessionPlayer } from '@/shared/types'
import { PLAYER_SESSION_ID_KEY, PLAYER_SESSION_KEY, PLAYER_TOKEN_KEY } from '@/shared/types'
import { supabase } from '@/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { fetchQuestions } from '../../quizzes/api/quizApi'
import { useState } from 'react'
import { usePlayerSession } from '../hooks/usePlayerSession'
import { PlayerQuestionView } from './PlayerQuestionView'

async function fetchPlayerProfiles(): Promise<PlayerProfile[]> {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .order('name')
  if (error) throw error
  return data as PlayerProfile[]
}

async function createPlayerProfile(name: string): Promise<PlayerProfile> {
  const { data, error } = await supabase
    .from('player_profiles')
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  return data as PlayerProfile
}

interface Props {
  sessionId: string
}

export function PlayerSessionView({ sessionId }: Props) {
  const {
    session,
    players,
    myPlayer,
    loading,
    isJoined,
    joinSession,
    submitAnswer,
  } = usePlayerSession(sessionId)

  const [newName, setNewName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function leaveSession() {
    const playerId = localStorage.getItem(PLAYER_SESSION_KEY)
    const token = localStorage.getItem(PLAYER_TOKEN_KEY)
    if (playerId && token) {
      try {
        await supabase.rpc('leave_session', {
          p_session_player_id: playerId,
          p_player_token: token,
        })
      } catch {/* ignore — still clear localStorage */}
    }
    localStorage.removeItem(PLAYER_TOKEN_KEY)
    localStorage.removeItem(PLAYER_SESSION_KEY)
    localStorage.removeItem(PLAYER_SESSION_ID_KEY)
    window.location.reload()
  }

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['player_profiles'],
    queryFn: fetchPlayerProfiles,
    enabled: !isJoined,
  })

  const activePlayers: SessionPlayer[] = players

  async function handleJoinExisting(profile: PlayerProfile) {
    const alreadyJoined = activePlayers.some((p) => p.player_profile_id === profile.id)
    if (alreadyJoined) return
    setError('')
    setJoining(true)
    try {
      await joinSession(profile.id, profile.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  async function handleJoinNew(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setError('')
    setJoining(true)
    try {
      const profile = await createPlayerProfile(newName.trim())
      await joinSession(profile.id, profile.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join')
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center">Session not found.</p>

  // ── Not yet joined: show player picker ──────────────────────
  if (!isJoined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <Card className="w-full max-w-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Choose your name</h2>
          {profilesLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {profiles?.map((p) => {
                const taken = activePlayers.some((sp) => sp.player_profile_id === p.id)
                return (
                  <button
                    key={p.id}
                    disabled={taken || joining}
                    onClick={() => handleJoinExisting(p)}
                    className={`rounded-xl px-4 py-3 text-left font-medium transition-colors ${
                      taken
                        ? 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-white border border-gray-200 text-gray-900 hover:bg-indigo-50 hover:border-indigo-400 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:hover:bg-indigo-900/30'
                    }`}
                  >
                    {p.name}{' '}
                    {taken && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">— Joined</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <form onSubmit={handleJoinNew} className="flex flex-col gap-3 border-t pt-4 border-gray-200 dark:border-gray-700">
            <Input
              placeholder="+ New player name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button type="submit" disabled={joining || !newName.trim()}>
              {joining ? 'Joining…' : 'Join as new player'}
            </Button>
          </form>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </Card>
      </div>
    )
  }

  // ── Joined: show lobby or active question ────────────────────
  if (session.status === 'LOBBY') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <Card className="w-full max-w-sm text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {myPlayer?.display_name}
          </p>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Waiting for host to start…</p>
          <p className="text-sm text-gray-400 mb-4">
            {activePlayers.length} player{activePlayers.length !== 1 ? 's' : ''} joined
          </p>
          <button
            onClick={leaveSession}
            className="text-xs text-gray-400 hover:text-red-500 underline"
          >
            Wrong name? Change player
          </button>
        </Card>
      </div>
    )
  }

  if (session.status === 'FINISHED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <Card className="w-full max-w-sm text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Quiz Finished!</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Your score: <span className="font-bold text-indigo-600">{myPlayer?.score ?? 0}</span>
          </p>
          <ol className="text-left flex flex-col gap-2 mb-4">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-gray-700 dark:text-gray-300">
                    {i + 1}. {p.display_name}
                    {p.id === myPlayer?.id && ' (you)'}
                  </span>
                  <span className="font-bold">{p.score}</span>
                </li>
              ))}
          </ol>
        </Card>
      </div>
    )
  }

  const { data: questions } = useQuery({
    queryKey: ['questions', session?.quiz_id],
    queryFn: () => fetchQuestions(session!.quiz_id),
    enabled: !!session?.quiz_id,
  })

  const currentQuestionIndex = questions?.findIndex(
    (q) => q.id === session?.current_question_id,
  ) ?? -1

  // Running
  return (
    <PlayerQuestionView
      session={session}
      myPlayer={myPlayer!}
      submitAnswer={submitAnswer}
      questionNumber={currentQuestionIndex + 1}
      totalQuestions={questions?.length ?? 0}
    />
  )
}
