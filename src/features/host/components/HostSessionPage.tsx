import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import {
    adjustPlayerScore,
    fetchAnswersForQuestion,
    fetchQuestions,
} from '../../quizzes/api/quizApi'
import { useHostSession } from '../hooks/useHostSession'
import { supabase } from '@/supabase/client'
import type { Answer, Question } from '@/shared/types'
import { QRCodeSVG } from 'qrcode.react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'

export function HostSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const {
    session,
    players,
    loading,
    startQuiz,
    startQuestion,
    revealNextHint,
    closeAnswers,
    finishSession,
    refreshLeaderboard,
  } = useHostSession(sessionId!)

  const { data: questions } = useQuery({
    queryKey: ['questions', session?.quiz_id],
    queryFn: () => fetchQuestions(session!.quiz_id),
    enabled: !!session?.quiz_id,
  })

  const currentQuestion: Question | undefined = questions?.find(
    (q) => q.id === session?.current_question_id,
  )

  const { data: currentAnswers } = useQuery({
    queryKey: ['answers', sessionId, session?.current_question_id],
    queryFn: () => fetchAnswersForQuestion(sessionId!, session!.current_question_id!),
    enabled: !!session?.current_question_id,
    refetchInterval: 3000,
  })

  const { data: currentHints } = useQuery({
    queryKey: ['hints', session?.current_question_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('question_hints')
        .select('id')
        .eq('question_id', session!.current_question_id)
      return data ?? []
    },
    enabled: currentQuestion?.type === 'PROGRESSIVE_HINTS' && !!session?.current_question_id,
  })

  const allHintsRevealed =
    currentQuestion?.type === 'PROGRESSIVE_HINTS' &&
    (session?.current_hint_index ?? 0) >= (currentHints?.length ?? 0)

  const [overrideLoading, setOverrideLoading] = useState<Record<string, 'approve' | 'reject' | null>>({})
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({})

  // follow-up scoring: tracks committed delta per player (-1 / 0 / +1)
  const [followUpScores, setFollowUpScores] = useState<Record<string, number>>({})
  const [followUpLoading, setFollowUpLoading] = useState<Record<string, boolean>>({})

  // reset per-question follow-up scores when moving to a new question
  useEffect(() => {
    setFollowUpScores({})
    setFollowUpLoading({})
  }, [session?.current_question_id])

  async function handleFollowUpScore(sessionPlayerId: string, newValue: number) {
    const current = followUpScores[sessionPlayerId] ?? 0
    const delta = newValue - current
    if (delta === 0) return
    setFollowUpLoading((prev) => ({ ...prev, [sessionPlayerId]: true }))
    try {
      await adjustPlayerScore(sessionPlayerId, delta)
      await refreshLeaderboard()
      setFollowUpScores((prev) => ({ ...prev, [sessionPlayerId]: newValue }))
    } finally {
      setFollowUpLoading((prev) => ({ ...prev, [sessionPlayerId]: false }))
    }
  }
  async function handleOverride(answer: Answer, correct: boolean) {
    setOptimisticOverrides((prev) => ({ ...prev, [answer.id]: correct }))
    setOverrideLoading((prev) => ({ ...prev, [answer.id]: correct ? 'approve' : 'reject' }))
    try {
      await supabase.rpc('override_answer', { p_answer_id: answer.id, p_is_correct: correct })
      await refreshLeaderboard()
      setOptimisticOverrides((prev) => { const n = { ...prev }; delete n[answer.id]; return n })
    } catch {
      setOptimisticOverrides((prev) => { const n = { ...prev }; delete n[answer.id]; return n })
    } finally {
      setOverrideLoading((prev) => ({ ...prev, [answer.id]: null }))
    }
  }

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center text-[#9d8a5e]">Session not found.</p>

  const isLobby = session.status === 'LOBBY'
  const isRunning = session.status === 'RUNNING'
  const isFinished = session.status === 'FINISHED'
  const currentIdx = questions?.findIndex((q) => q.id === session.current_question_id) ?? -1
  const hasNextQuestion = currentIdx < (questions?.length ?? 0) - 1
  const isProgressiveHints = currentQuestion?.type === 'PROGRESSIVE_HINTS'
  const isFollowUp = currentQuestion?.type === 'FOLLOW_UP'
  const isPause = currentQuestion?.type === 'PAUSE'

  return (
    <div
      className="relative min-h-screen text-[#e8d5a0]"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-[#080a10]/78" />
      <div className="relative z-10 flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-[#7a5c1c] px-6 py-4 flex items-center justify-between shadow-[0_2px_15px_rgba(200,168,75,0.1)] bg-[#0c0f18]/90 backdrop-blur-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#9d8a5e]" style={{ fontFamily: 'Cinzel, serif' }}>Host Control</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'Cinzel, serif' }}>
            ROOM:{' '}
            <span className="font-mono text-[#f0c040]" style={{ textShadow: '0 0 10px rgba(200,168,75,0.5)' }}>{session.join_code}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[#9d8a5e]">
            <Users className="h-5 w-5" />
            <span className="text-lg font-semibold text-[#c8a84b]">{players.length}</span>
          </div>
          <a
            href={`/sessions/${sessionId}/leaderboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-[#c8a84b] bg-[#10131e] px-3 py-1.5 text-sm font-semibold text-[#c8a84b] transition-all hover:border-[#f0c040] hover:text-[#f0c040] hover:shadow-[0_0_10px_rgba(200,168,75,0.3)]"
          >
            Open Leaderboard ↗
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
      <main className="flex flex-col gap-6">
        {/* LOBBY */}
        {isLobby && (
          <Card>
            <h2 className="text-xl font-bold text-[#c8a84b] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Waiting for players…</h2>

            {/* QR code + join URL */}
            <div className="flex flex-col items-center gap-3 mb-6 p-4 rounded border border-[#7a5c1c] bg-white">
              <QRCodeSVG
                value={`${window.location.origin}/join?code=${session.join_code}`}
                size={180}
                includeMargin
              />
              <p className="text-sm text-[#9d8a5e] font-mono">{window.location.origin}/join</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {players.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full border border-[#7a5c1c] bg-[#10131e] px-3 py-1 text-sm text-[#c8a84b]"
                >
                  {p.display_name}
                </span>
              ))}
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={players.length === 0 || !questions?.length}
              onClick={() => startQuiz(questions![0].id, questions![0].type !== 'FOLLOW_UP' && questions![0].type !== 'PAUSE')}
            >
              START QUIZ
            </Button>
          </Card>
        )}

        {/* RUNNING */}
        {isRunning && (
          <>

            {/* Active question controls */}
            {session.current_question_id && (
              <Card>
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#9d8a5e]" style={{ fontFamily: 'Cinzel, serif' }}>
                    Question {currentIdx + 1} / {questions?.length}
                  </p>
                  <p className="text-xl font-bold text-[#e8d5a0]">
                    {currentQuestion?.text || `Question ${currentIdx + 1}`}
                  </p>
                  <p className="text-sm text-[#9d8a5e] mt-1">
                    Type: {currentQuestion?.type.replace('_', ' ')}
                  </p>
                  {isProgressiveHints && (
                    <p className="text-sm text-[#c8a84b] mt-1">
                      {session.current_hint_index === 0
                        ? 'No hint shown yet (max points)'
                        : `Hint ${session.current_hint_index} shown`}
                    </p>
                  )}
                  <p className="text-sm text-[#9d8a5e] mt-1">
                    Answers received: {currentAnswers?.length ?? 0} / {players.length}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {isProgressiveHints && session.accepting_answers && !allHintsRevealed && (
                    <Button variant="secondary" size="lg" onClick={revealNextHint}>
                      REVEAL HINT {(session.current_hint_index ?? 0) + 1}
                    </Button>
                  )}
                  {isProgressiveHints && allHintsRevealed && session.accepting_answers && (
                    <p className="text-center text-sm text-[#9d8a5e]">All hints revealed</p>
                  )}
                  {session.accepting_answers && !isFollowUp && !isPause && (
                    <Button variant="secondary" size="lg" onClick={closeAnswers}>
                      CLOSE ANSWERS
                    </Button>
                  )}
                  {!session.accepting_answers && !isPause && (
                    <>
                      {hasNextQuestion && (
                        <Button
                          size="lg"
                          onClick={() => {
                            const next = questions![currentIdx + 1]
                            startQuestion(next.id, next.type !== 'FOLLOW_UP' && next.type !== 'PAUSE')
                          }}
                        >
                          NEXT QUESTION ({currentIdx + 2}/{questions?.length})
                        </Button>
                      )}
                    </>
                  )}
                  {isPause && (
                    <>
                      <div className="text-center py-2 mb-3">
                        <p className="text-3xl mb-1">⏸</p>
                        <p className="text-base text-[#9d8a5e]">Players are on a break screen.</p>
                      </div>
                      {hasNextQuestion && (
                        <Button
                          size="lg"
                          className="w-full"
                          onClick={() => {
                            const next = questions![currentIdx + 1]
                            startQuestion(next.id, next.type !== 'FOLLOW_UP' && next.type !== 'PAUSE')
                          }}
                        >
                          RESUME — NEXT QUESTION ({currentIdx + 2}/{questions?.length})
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    variant="danger"
                    size="lg"
                    onClick={() => {
                      if (confirm('Finish the session?')) finishSession()
                    }}
                  >
                    FINISH SESSION
                  </Button>
                </div>
              </Card>
            )}

            {/* Answer review — shown for non-follow-up, non-pause types after answers close */}
            {!session.accepting_answers && currentQuestion && !isFollowUp && !isPause && (currentAnswers?.length ?? 0) > 0 && (
              <Card>
                <h3 className="text-lg font-semibold text-[#c8a84b] mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                  Answer Review — approve or reject each answer
                </h3>
                <div className="flex flex-col gap-2">
                  {[...(currentAnswers ?? [])]
                    .sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
                    .map((a, rank) => {
                    const player = players.find((p) => p.id === a.session_player_id)
                    const effective = a.id in optimisticOverrides ? optimisticOverrides[a.id] : a.is_correct
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-lg px-4 py-3 transition-colors border ${
                          effective === true ? 'bg-green-950/40 border-green-700/50' :
                          effective === false ? 'bg-red-950/30 border-red-900/50' :
                          'bg-[#0c0f18] border-[#7a5c1c]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-lg font-black tabular-nums w-7 shrink-0 ${
                            rank === 0 ? 'text-[#f0c040]' : rank === 1 ? 'text-[#9d9d9d]' : rank === 2 ? 'text-[#cd7f32]' : 'text-[#6b5e42]'
                          }`}>#{rank + 1}</span>
                          <div>
                            <span className="font-semibold text-[#e8d5a0]">{player?.display_name}</span>
                            <p className="text-sm text-[#9d8a5e] mt-0.5">
                              {a.answer_text || (a.selected_option_id ? `Option selected` : '—')}
                            </p>
                            {a.hint_index_at_submission != null && (
                              <p className="text-xs text-[#6b5e42] mt-0.5">
                                Answered {a.hint_index_at_submission === 0 ? 'before hints' : `after hint ${a.hint_index_at_submission}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center shrink-0 ml-4">
                          <button
                            onClick={() => handleOverride(a, true)}
                            disabled={!!overrideLoading[a.id]}
                            className={`rounded px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                              effective === true
                                ? 'bg-green-600 text-white border border-green-500'
                                : 'bg-[#10131e] text-[#9d8a5e] border border-[#7a5c1c] hover:bg-green-800 hover:text-green-300 hover:border-green-700'
                            }`}
                          >
                            {overrideLoading[a.id] === 'approve' ? '…' : `✓ ${effective === true ? `${a.points_awarded}pts` : 'Approve'}`}
                          </button>
                          <button
                            onClick={() => handleOverride(a, false)}
                            disabled={!!overrideLoading[a.id]}
                            className={`rounded px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                              effective === false
                                ? 'bg-red-600 text-white border border-red-500'
                                : 'bg-[#10131e] text-[#9d8a5e] border border-[#7a5c1c] hover:bg-red-900 hover:text-red-300 hover:border-red-800'
                            }`}
                          >
                            {overrideLoading[a.id] === 'reject' ? '…' : '✕ Reject'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Follow-up scoring panel */}
            {isFollowUp && currentQuestion && (
              <Card>
                <h3 className="text-lg font-semibold text-[#c8a84b] mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
                  ↪ Follow-up — score each player
                </h3>
                <p className="text-xs text-[#9d8a5e] mb-4">
                  Default is 0. Give +1 if they got it right, −1 if wrong.
                </p>
                <div className="flex flex-col gap-2">
                  {players.map((p) => {
                    const assigned = followUpScores[p.id] ?? 0
                    const busy = !!followUpLoading[p.id]
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded border border-[#7a5c1c] bg-[#0c0f18] px-4 py-3">
                        <span className="font-semibold text-[#e8d5a0]">{p.display_name}</span>
                        <div className="flex gap-1 shrink-0">
                          {([-1, 0, 1] as const).map((val) => (
                            <button
                              key={val}
                              disabled={busy}
                              onClick={() => handleFollowUpScore(p.id, val)}
                              className={`rounded px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                                assigned === val
                                  ? val === 1  ? 'bg-green-600 text-white border border-green-500'
                                  : val === -1 ? 'bg-red-600 text-white border border-red-500'
                                  :              'bg-[#7a5c1c] text-[#e8d5a0] border border-[#c8a84b]'
                                  : 'bg-[#10131e] text-[#9d8a5e] border border-[#7a5c1c] hover:border-[#c8a84b] hover:text-[#c8a84b]'
                              }`}
                            >
                              {val === 1 ? '+1' : val === -1 ? '−1' : '0'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </>
        )}

        {/* FINISHED */}
        {isFinished && (
          <Card className="text-center">
            <h2 className="text-2xl font-bold text-[#f0c040] mb-6" style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 15px rgba(200,168,75,0.4)' }}>Final Results</h2>
            <ol className="flex flex-col gap-3 mb-6">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between text-xl">
                    <span className="text-[#9d8a5e]">
                      {i + 1}. {p.display_name}
                    </span>
                    <span className="font-bold text-[#c8a84b]">{p.score}</span>
                  </li>
                ))}
            </ol>
            <Button variant="secondary" onClick={() => navigate(`/quizzes/${session.quiz_id}`)}>
              Back to Quiz
            </Button>
          </Card>
        )}
      </main>

      </div>
      </div>
    </div>
  )
}
