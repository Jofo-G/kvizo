import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import {
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

  async function handleOverride(answer: Answer, correct: boolean) {
    await supabase.rpc('override_answer', { p_answer_id: answer.id, p_is_correct: correct })
    await refreshLeaderboard()
  }

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center">Session not found.</p>

  const isLobby = session.status === 'LOBBY'
  const isRunning = session.status === 'RUNNING'
  const isFinished = session.status === 'FINISHED'
  const currentIdx = questions?.findIndex((q) => q.id === session.current_question_id) ?? -1
  const hasNextQuestion = currentIdx < (questions?.length ?? 0) - 1
  const isProgressiveHints = currentQuestion?.type === 'PROGRESSIVE_HINTS'

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
        <div className="flex items-center gap-2 text-gray-300">
          <Users className="h-5 w-5" />
          <span className="text-lg font-semibold">{players.length}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 flex flex-col gap-6">
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
              onClick={() => startQuiz(questions![0].id)}
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
                  {isProgressiveHints && session.accepting_answers && (
                    <Button variant="secondary" size="lg" onClick={revealNextHint}>
                      REVEAL HINT {(session.current_hint_index ?? 0) + 1}
                    </Button>
                  )}
                  {session.accepting_answers && (
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
                          onClick={() => startQuestion(questions![currentIdx + 1].id)}
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

            {/* Answer review for open questions */}
            {!session.accepting_answers &&
              currentQuestion &&
              (currentQuestion.type === 'OPEN' || currentQuestion.type === 'PROGRESSIVE_HINTS') && (
                <Card className="dark:bg-gray-800 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-3">Answer Review</h3>
                  <div className="flex flex-col gap-2">
                    {currentAnswers?.map((a) => {
                      const player = players.find((p) => p.id === a.session_player_id)
                      return (
                        <div
                          key={a.id}
                          className="flex items-center justify-between rounded-lg bg-gray-700 px-4 py-2"
                        >
                          <div>
                            <span className="font-medium text-white">{player?.display_name}</span>
                            <p className="text-sm text-gray-300">{a.answer_text}</p>
                          </div>
                          <div className="flex gap-2 items-center">
                            <span
                              className={`text-sm font-semibold ${a.is_correct ? 'text-green-400' : 'text-red-400'}`}
                            >
                              {a.is_correct ? `✓ ${a.points_awarded}pts` : '✕'}
                            </span>
                            <button
                              onClick={() => handleOverride(a, !a.is_correct)}
                              className="text-xs text-indigo-400 hover:text-indigo-200"
                            >
                              Override
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

            {/* Leaderboard */}
            {!session.accepting_answers && players.length > 0 && (
              <Card className="dark:bg-gray-800 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-3">Leaderboard</h3>
                <ol className="flex flex-col gap-2">
                  {[...players]
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => (
                      <li key={p.id} className="flex items-center justify-between">
                        <span className="text-gray-300">
                          {i + 1}. {p.display_name}
                        </span>
                        <span className="font-bold text-white">{p.score}</span>
                      </li>
                    ))}
                </ol>
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
  )
}
