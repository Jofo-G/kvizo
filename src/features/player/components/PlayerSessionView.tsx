import { Card } from '@/shared/components/Card'
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

  const { data: questions } = useQuery({
    queryKey: ['questions', session?.quiz_id],
    queryFn: () => fetchQuestions(session!.quiz_id),
    enabled: !!session?.quiz_id,
  })

  const currentQuestionIndex = questions?.findIndex(
    (q) => q.id === session?.current_question_id,
  ) ?? -1

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

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center text-[#9d8a5e]">Session not found.</p>

  if (!isJoined) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
        <div className="absolute inset-[-5%]" style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(6px) brightness(0.2)' }} />
        <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-6 text-center">
          <h1
            className="text-3xl font-black tracking-[0.15em] text-[#f0c040] mb-1"
            style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 15px rgba(200,168,75,0.5)' }}
          >
            KVIZO
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-[#9d8a5e]">Choose your champion</p>
        </div>
        <Card className="w-full max-w-lg">
          <h2 className="mb-6 text-xl font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>Who are you?</h2>
          {profilesLoading ? (
            <LoadingSpinner />
          ) : profiles?.length === 0 ? (
            <p className="text-center text-[#9d8a5e]">
              No players have been set up yet. Ask the host to add players.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {profiles?.map((p) => {
                const taken = activePlayers.some((sp) => sp.player_profile_id === p.id)
                return (
                  <button
                    key={p.id}
                    disabled={taken || joining}
                    onClick={() => handleJoinExisting(p)}
                    className={`flex flex-col items-center gap-1 rounded p-2 transition-all border ${
                      taken
                        ? 'cursor-not-allowed opacity-30 border-transparent'
                        : 'border-[#7a5c1c] hover:border-[#c8a84b] hover:bg-[#c8a84b]/5 hover:shadow-[0_0_10px_rgba(200,168,75,0.2)]'
                    }`}
                  >
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.name}
                        className="h-16 w-16 rounded-full object-cover border-2 border-[#7a5c1c]"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10131e] text-2xl font-bold text-[#c8a84b] border-2 border-[#7a5c1c]">
                        {p.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="text-center text-sm font-medium leading-tight text-[#e8d5a0]">
                      {p.name}
                    </span>
                    {taken && (
                      <span className="text-xs text-[#6b5e42]">Joined</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </Card>
        </div>
      </div>
    )
  }

  // ── Joined: show lobby or active question ────────────────────
  if (session.status === 'LOBBY') {
    const myProfile = profiles?.find((p) => p.id === myPlayer?.player_profile_id)
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
        <div className="absolute inset-[-5%]" style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(6px) brightness(0.2)' }} />
        <Card className="relative z-10 w-full max-w-sm text-center">
          <div className="mb-4 flex flex-col items-center gap-3">
            {myProfile?.avatar_url ? (
              <img
                src={myProfile.avatar_url}
                alt={myPlayer?.display_name}
                className="h-24 w-24 rounded-full object-cover border-2 border-[#c8a84b] shadow-[0_0_15px_rgba(200,168,75,0.4)]"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#10131e] text-4xl font-bold text-[#c8a84b] border-2 border-[#c8a84b] shadow-[0_0_15px_rgba(200,168,75,0.3)]">
                {myPlayer?.display_name[0]?.toUpperCase()}
              </div>
            )}
            <p className="text-2xl font-bold text-[#e8d5a0]" style={{ fontFamily: 'Cinzel, serif' }}>
              {myPlayer?.display_name}
            </p>
          </div>
          <p className="text-[#9d8a5e] mb-6">Waiting for host to start…</p>
          <p className="text-sm text-[#6b5e42] mb-4">
            {activePlayers.length} player{activePlayers.length !== 1 ? 's' : ''} in the Tavern
          </p>
          <button
            onClick={leaveSession}
            className="text-xs text-[#6b5e42] hover:text-red-400 underline transition-colors"
          >
            Wrong name? Change player
          </button>
        </Card>
      </div>
    )
  }

  if (session.status === 'FINISHED') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
        <div className="absolute inset-[-5%]" style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(6px) brightness(0.2)' }} />
        <Card className="relative z-10 w-full max-w-sm text-center">
          <h2
            className="text-2xl font-bold text-[#f0c040] mb-4"
            style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 12px rgba(200,168,75,0.4)' }}
          >
            Quiz Finished!
          </h2>
          <p className="text-lg text-[#9d8a5e] mb-6">
            Your score: <span className="font-bold text-[#c8a84b]">{myPlayer?.score ?? 0}</span>
          </p>
          <ol className="text-left flex flex-col gap-2 mb-4">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-[#9d8a5e]">
                    {i + 1}. {p.display_name}
                    {p.id === myPlayer?.id && ' (you)'}
                  </span>
                  <span className="font-bold text-[#c8a84b]">{p.score}</span>
                </li>
              ))}
          </ol>
        </Card>
      </div>
    )
  }
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
