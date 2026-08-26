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
import { useState } from 'react'

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
  if (!session) return <p className="p-8 text-center">Session not found.</p>

  const isLobby = session.status === 'LOBBY'
  const isRunning = session.status === 'RUNNING'
  const isFinished = session.status === 'FINISHED'
  const currentIdx = questions?.findIndex((q) => q.id === session.current_question_id) ?? -1
  const hasNextQuestion = currentIdx < (questions?.length ?? 0) - 1
  const isProgressiveHints = currentQuestion?.type === 'PROGRESSIVE_HINTS'
  const isFollowUp = currentQuestion?.type === 'FOLLOW_UP'

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400">Host Control</p>
          <p className="text-2xl font-bold">
            ROOM CODE:{' '}
            <span className="font-mono text-indigo-400">{session.join_code}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-300">
            <Users className="h-5 w-5" />
            <span className="text-lg font-semibold">{players.length}</span>
          </div>
          <a
            href={`/sessions/${sessionId}/leaderboard`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-indigo-700 hover:bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors"
          >
            Open Leaderboard ↗
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
      <main className="flex flex-col gap-6">
        {/* LOBBY */}
        {isLobby && (
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Waiting for players…</h2>

            {/* QR code + join URL */}
            <div className="flex flex-col items-center gap-3 mb-6 p-4 rounded-xl bg-white">
              <QRCodeSVG
                value={`${window.location.origin}/join?code=${session.join_code}`}
                size={180}
                includeMargin
              />
              <p className="text-sm text-gray-500 font-mono">{window.location.origin}/join</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {players.map((p) => (
                <span
                  key={p.id}
                  className="rounded-full bg-indigo-900/50 px-3 py-1 text-sm text-indigo-300"
                >
                  {p.display_name}
                </span>
              ))}
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={players.length === 0 || !questions?.length}
              onClick={() => startQuiz(questions![0].id, questions![0].type !== 'FOLLOW_UP')}
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
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-gray-400">
                    Question {currentIdx + 1} / {questions?.length}
                  </p>
                  <p className="text-xl font-bold text-white">
                    {currentQuestion?.text || `Question ${currentIdx + 1}`}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Type: {currentQuestion?.type.replace('_', ' ')}
                  </p>
                  {isProgressiveHints && (
                    <p className="text-sm text-indigo-400 mt-1">
                      {session.current_hint_index === 0
                        ? 'No hint shown yet (max points)'
                        : `Hint ${session.current_hint_index} shown`}
                    </p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
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
                    <p className="text-center text-sm text-gray-400">All hints revealed</p>
                  )}
                  {session.accepting_answers && !isFollowUp && (
                    <Button variant="secondary" size="lg" onClick={closeAnswers}>
                      CLOSE ANSWERS
                    </Button>
                  )}
                  {!session.accepting_answers && (
                    <>
                      <Button variant="secondary" size="lg" onClick={refreshLeaderboard}>
                        SHOW SCOREBOARD
                      </Button>
                      {hasNextQuestion && (
                        <Button
                          size="lg"
                          onClick={() => {
                            const next = questions![currentIdx + 1]
                            startQuestion(next.id, next.type !== 'FOLLOW_UP')
                          }}
                        >
                          NEXT QUESTION ({currentIdx + 2}/{questions?.length})
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

            {/* Answer review — shown for non-follow-up types after answers close */}
            {!session.accepting_answers && currentQuestion && !isFollowUp && (currentAnswers?.length ?? 0) > 0 && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-3">
                  Answer Review — approve or reject each answer
                </h3>
                <div className="flex flex-col gap-2">
                  {currentAnswers?.map((a) => {
                    const player = players.find((p) => p.id === a.session_player_id)
                    const effective = a.id in optimisticOverrides ? optimisticOverrides[a.id] : a.is_correct
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-lg px-4 py-3 transition-colors ${
                          effective === true ? 'bg-green-900/40' :
                          effective === false ? 'bg-red-900/30' :
                          'bg-gray-700'
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-white">{player?.display_name}</span>
                          <p className="text-sm text-gray-300 mt-0.5">
                            {a.answer_text || (a.selected_option_id ? `Option selected` : '—')}
                          </p>
                          {a.hint_index_at_submission != null && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Answered {a.hint_index_at_submission === 0 ? 'before hints' : `after hint ${a.hint_index_at_submission}`}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 items-center shrink-0 ml-4">
                          <button
                            onClick={() => handleOverride(a, true)}
                            disabled={!!overrideLoading[a.id]}
                            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                              effective === true
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-green-700 hover:text-white'
                            }`}
                          >
                            {overrideLoading[a.id] === 'approve' ? '…' : `✓ ${effective === true ? `${a.points_awarded}pts` : 'Approve'}`}
                          </button>
                          <button
                            onClick={() => handleOverride(a, false)}
                            disabled={!!overrideLoading[a.id]}
                            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-60 ${
                              effective === false
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-600 text-gray-300 hover:bg-red-700 hover:text-white'
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
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-1">
                  ↪ Follow-up — score each player
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Default is 0. Give +1 if they got it right, −1 if wrong.
                </p>
                <div className="flex flex-col gap-2">
                  {players.map((p) => {
                    const assigned = followUpScores[p.id] ?? 0
                    const busy = !!followUpLoading[p.id]
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-700 px-4 py-3">
                        <span className="font-semibold text-white">{p.display_name}</span>
                        <div className="flex gap-1 shrink-0">
                          {([-1, 0, 1] as const).map((val) => (
                            <button
                              key={val}
                              disabled={busy}
                              onClick={() => handleFollowUpScore(p.id, val)}
                              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-50 ${
                                assigned === val
                                  ? val === 1  ? 'bg-green-500 text-white'
                                  : val === -1 ? 'bg-red-500 text-white'
                                  :              'bg-gray-500 text-white'
                                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
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
          <Card className="dark:bg-gray-800 dark:border-gray-700 text-center">
            <h2 className="text-2xl font-bold text-white mb-6">Final Results</h2>
            <ol className="flex flex-col gap-3 mb-6">
              {[...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between text-xl">
                    <span className="text-gray-300">
                      {i + 1}. {p.display_name}
                    </span>
                    <span className="font-bold text-white">{p.score}</span>
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
  )
}
