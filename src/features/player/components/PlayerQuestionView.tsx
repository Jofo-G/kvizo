import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { QuizSession, QuestionOptionSafe, SessionPlayer } from '@/shared/types'
import { supabase } from '@/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

interface Props {
  session: QuizSession
  myPlayer: SessionPlayer
  submitAnswer: (params: { questionId: string; answerText?: string; selectedOptionId?: string }) => Promise<void>
  submitResult: { is_correct: boolean; points_awarded: number } | null
}

export function PlayerQuestionView({ session, myPlayer, submitAnswer, submitResult }: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [openText, setOpenText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Reset everything on new question
  useEffect(() => {
    setSelectedOptionId(null)
    setOpenText('')
    setSubmitted(false)
    setSubmitError('')
  }, [session.current_question_id])

  // Allow re-answer when a new hint is revealed
  useEffect(() => {
    if (session.current_hint_index !== undefined && session.current_hint_index !== null) {
      setSubmitted(false)
      setSubmitError('')
    }
  }, [session.current_hint_index])

  const { data: question } = useQuery({
    queryKey: ['question', session.current_question_id],
    queryFn: async () => {
      if (!session.current_question_id) return null
      const { data } = await supabase
        .from('questions')
        .select('*')
        .eq('id', session.current_question_id)
        .single()
      return data
    },
    enabled: !!session.current_question_id,
  })

  const { data: options } = useQuery<QuestionOptionSafe[]>({
    queryKey: ['options_safe', session.current_question_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('question_options_safe')
        .select('*')
        .eq('question_id', session.current_question_id)
        .order('position')
      return (data ?? []) as QuestionOptionSafe[]
    },
    enabled: question?.type === 'MULTIPLE_CHOICE',
  })

  const { data: currentHint } = useQuery({
    queryKey: ['hint', session.current_question_id, session.current_hint_index],
    queryFn: async () => {
      const { data } = await supabase
        .from('question_hints')
        .select('*')
        .eq('question_id', session.current_question_id)
        .eq('position', session.current_hint_index)
        .single()
      return data
    },
    enabled: question?.type === 'PROGRESSIVE_HINTS' && !!session.current_hint_index,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || submitted) return
    setSubmitError('')
    setSubmitting(true)
    try {
      await submitAnswer({
        questionId: session.current_question_id!,
        answerText: openText || undefined,
        selectedOptionId: selectedOptionId || undefined,
      })
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (!session.current_question_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
        <Card className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Waiting for next question…</p>
          <p className="text-sm mt-2 text-indigo-500 font-semibold">
            Score: {myPlayer.score}
          </p>
        </Card>
      </div>
    )
  }

  if (!question) return <LoadingSpinner />

  const isClosed = !session.accepting_answers

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Score bar */}
      <div className="bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white">
        {myPlayer.display_name} · Score: {myPlayer.score}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col gap-4">
          {/* Question label */}
          {question.text && (
            <Card>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{question.text}</p>
            </Card>
          )}

          {/* Progressive hint */}
          {question.type === 'PROGRESSIVE_HINTS' && (
            <Card className="border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-700">
              {currentHint ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1">
                    Hint {session.current_hint_index} · {currentHint.points} pts if correct now
                  </p>
                  <p className="text-gray-800 dark:text-gray-200">{currentHint.text}</p>
                </>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  No hint yet — answer now for maximum points
                </p>
              )}
            </Card>
          )}

          {/* Closed + result */}
          {isClosed && (
            <Card className={`text-center ${
              submitResult
                ? submitResult.is_correct
                  ? 'bg-green-50 border-green-400 dark:bg-green-950/40 dark:border-green-600'
                  : 'bg-red-50 border-red-400 dark:bg-red-950/40 dark:border-red-600'
                : 'bg-amber-50 border-amber-400 dark:bg-amber-950/40 dark:border-amber-700'
            }`}>
              {submitResult ? (
                <p className={`text-xl font-bold ${submitResult.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                  {submitResult.is_correct ? `✓ Correct! +${submitResult.points_awarded} points` : '✕ Incorrect'}
                </p>
              ) : (
                <p className="text-amber-700 dark:text-amber-400 font-semibold">Answers closed — no answer submitted</p>
              )}
            </Card>
          )}

          {/* Submitted confirmation while still open */}
          {submitted && !isClosed && (
            <Card className={`text-center ${submitResult?.is_correct ? 'bg-green-50 border-green-400 dark:bg-green-950/40' : 'bg-red-50 border-red-400 dark:bg-red-950/40'}`}>
              <p className={`text-lg font-bold ${submitResult?.is_correct ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {submitResult?.is_correct ? `✓ Correct! +${submitResult.points_awarded} pts` : '✕ Wrong — wait for next hint or try again when revealed'}
              </p>
            </Card>
          )}

          {/* Answer controls */}
          {!isClosed && !submitted && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {question.type === 'MULTIPLE_CHOICE' && (
                <div className="flex flex-col gap-2">
                  {options?.map((opt, i) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`rounded-2xl border-2 px-5 py-4 text-left text-lg font-semibold transition-all ${
                        selectedOptionId === opt.id
                          ? 'border-indigo-500 bg-indigo-600 text-white'
                          : 'border-gray-200 bg-white text-gray-900 hover:border-indigo-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}. {opt.text}
                    </button>
                  ))}
                  {selectedOptionId && (
                    <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit'}
                    </Button>
                  )}
                </div>
              )}

              {(question.type === 'OPEN' || question.type === 'PROGRESSIVE_HINTS') && (
                <div className="flex flex-col gap-3">
                  <input
                    className="w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-lg text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    placeholder="Your answer…"
                    value={openText}
                    onChange={(e) => setOpenText(e.target.value)}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <Button type="submit" size="lg" className="w-full" disabled={submitting || !openText.trim()}>
                    {submitting ? 'Submitting…' : 'Submit'}
                  </Button>
                </div>
              )}

              {submitError && (
                <p className="text-sm text-red-600 text-center">{submitError}</p>
              )}
            </form>
          )}

          {/* Already submitted - show waiting state */}
          {submitted && !isClosed && (
            <Card className="text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Answer submitted. Waiting for host…
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
