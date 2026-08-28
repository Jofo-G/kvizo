import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { QuizSession, QuestionOptionSafe, SessionPlayer } from '@/shared/types'
import { PLAYER_SESSION_KEY, PLAYER_TOKEN_KEY } from '@/shared/types'
import { supabase } from '@/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

interface Props {
  session: QuizSession
  myPlayer: SessionPlayer
  submitAnswer: (params: { questionId: string; answerText?: string; selectedOptionId?: string }) => Promise<void>
  questionNumber: number
  totalQuestions: number
}

export function PlayerQuestionView({ session, myPlayer, submitAnswer, questionNumber, totalQuestions }: Props) {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [openText, setOpenText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  // Tracks if player submitted at any point this question (survives hint resets)
  const [hasEverSubmitted, setHasEverSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Reset everything on new question
  useEffect(() => {
    setSelectedOptionId(null)
    setOpenText('')
    setSubmitted(false)
    setHasEverSubmitted(false)
    setSubmitError('')
  }, [session.current_question_id])

  // Allow re-answer when a new hint is revealed; keep hasEverSubmitted
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

  const isClosed = !session.accepting_answers

  // Poll own answer result after host closes and reviews
  const { data: reviewResult } = useQuery<{ is_correct: boolean | null; points_awarded: number } | null>({
    queryKey: ['my_answer', session.current_question_id, isClosed],
    queryFn: async () => {
      const playerId = localStorage.getItem(PLAYER_SESSION_KEY)
      const token = localStorage.getItem(PLAYER_TOKEN_KEY)
      if (!playerId || !token || !session.current_question_id) return null
      const { data } = await supabase.rpc('get_my_answer', {
        p_session_player_id: playerId,
        p_player_token: token,
        p_question_id: session.current_question_id,
      })
      return data ?? null
    },
    enabled: isClosed && !!session.current_question_id,
    refetchInterval: isClosed ? 2000 : false,
    refetchOnMount: true,
    staleTime: 0,
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
      setHasEverSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (!session.current_question_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wow-bg p-4">
        <Card className="text-center">
          <p className="text-[#9d8a5e]">Waiting for next question…</p>
          <p className="text-sm mt-2 text-[#c8a84b] font-semibold">
            Score: {myPlayer.score}
          </p>
        </Card>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wow-bg">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-wow-bg">
      {/* Score bar */}
      <div className="border-b border-[#7a5c1c] bg-[#0c0f18] px-4 py-2 flex items-center justify-between text-sm font-semibold">
        <span className="text-[#c8a84b]">{myPlayer.display_name} · {isClosed ? `Score: ${myPlayer.score}` : '🔒'}</span>
        <span className="text-[#9d8a5e]">
          Q{question?.position ?? questionNumber}{totalQuestions > 0 ? `/${totalQuestions}` : ''}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col gap-4">

          {/* Question text — prominent heading, no card box */}
          {question.text && (
            <div className="text-center px-2">
              <p
                className="text-2xl font-bold text-[#e8d5a0] leading-snug"
                style={{ fontFamily: 'Cinzel, serif' }}
              >
                {question.text}
              </p>
              <div className="mt-3 h-px bg-gradient-to-r from-transparent via-[#7a5c1c] to-transparent" />
            </div>
          )}

          {/* Follow-up question */}
          {question.type === 'FOLLOW_UP' && (
            <Card className="text-center border-[#c8a84b]/60 bg-[#1a1200]">
              <p className="text-base font-bold text-[#f0c040] mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
                ↪ Bonus Follow-up
              </p>
              <p className="text-sm text-[#9d8a5e]">
                No answer needed — the host will score you directly.
              </p>
              {myPlayer.score !== undefined && (
                <p className="text-xs text-[#6b5e42] mt-3">
                  Current score: {myPlayer.score}
                </p>
              )}
            </Card>
          )}

          {/* Progressive hint — side-accented strip, not a card */}
          {question.type === 'PROGRESSIVE_HINTS' && (
            currentHint ? (
              <div className="rounded-r border-l-4 border-[#9f69e0] bg-[#9f69e0]/10 px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#9f69e0]">
                    ✦ Hint {session.current_hint_index}
                  </span>
                  <span className="text-xs font-semibold text-[#9f69e0]/70 tabular-nums">
                    {currentHint.points} pts if answered now
                  </span>
                </div>
                <p className="text-[#e8d5a0] text-base">{currentHint.text}</p>
              </div>
            ) : (
              <p className="text-center text-xs italic text-[#9d8a5e]">
                ✦ No hint yet — answer now for maximum points
              </p>
            )
          )}

          {/* Closed notice */}
          {isClosed && question.type !== 'FOLLOW_UP' && (
            <Card className={`text-center border ${
              reviewResult?.is_correct === true
                ? 'bg-green-950/40 border-green-700/60'
                : 'bg-[#1a0e00] border-[#c8a84b]/40'
            }`}>
              {reviewResult?.is_correct === true ? (
                <>
                  <p className="text-xl font-bold text-green-400" style={{ fontFamily: 'Cinzel, serif' }}>
                    ✔ Correct! +{reviewResult.points_awarded} points
                  </p>
                  <p className="text-sm text-green-600 mt-1">
                    Total: {myPlayer.score}
                  </p>
                </>
              ) : (
                <p className="text-[#c8a84b] font-semibold">
                  {hasEverSubmitted ? '✔ Answer submitted — waiting for host review…' : 'Answers closed — no answer submitted'}
                </p>
              )}
            </Card>
          )}

          {/* Submitted confirmation while still open */}
          {submitted && !isClosed && question.type !== 'FOLLOW_UP' && (
            <Card className="text-center bg-[#0c0f18] border-[#7a5c1c]">
              <p className="text-[#c8a84b] font-semibold">
                ✔ Answer submitted
              </p>
              <p className="text-xs text-[#6b5e42] mt-1">
                {question?.type === 'PROGRESSIVE_HINTS'
                  ? 'You can update your answer when the next hint is revealed'
                  : 'You can update your answer until the host closes the question'}
              </p>
            </Card>
          )}

          {/* Answer controls */}
          {!isClosed && !submitted && question.type !== 'FOLLOW_UP' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {question.type === 'MULTIPLE_CHOICE' && (
                <div className="flex flex-col gap-2">
                  {options?.map((opt, i) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOptionId(opt.id)}
                      className={`rounded border-2 px-5 py-4 text-left text-lg font-semibold transition-all ${
                        selectedOptionId === opt.id
                          ? 'border-[#f0c040] bg-[#1a1200] text-[#f0c040] shadow-[0_0_15px_rgba(200,168,75,0.3)]'
                          : 'border-[#7a5c1c] bg-[#10131e] text-[#e8d5a0] hover:border-[#c8a84b] hover:bg-[#161a28]'
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
                    className="w-full rounded border-2 border-[#7a5c1c] bg-[#080a10] px-5 py-4 text-lg text-[#e8d5a0] placeholder-[#6b5e42] outline-none focus:border-[#c8a84b] focus:shadow-[0_0_10px_rgba(200,168,75,0.25)] transition-all"
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
                <p className="text-sm text-red-400 text-center">{submitError}</p>
              )}
            </form>
          )}

          {/* Already submitted - show waiting state */}
          {submitted && !isClosed && (
            <Card className="text-center">
              <p className="text-[#9d8a5e] text-sm">
                Answer submitted. Waiting for host…
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
