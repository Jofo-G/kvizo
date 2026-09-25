import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import {
  adjustPlayerScore,
  fetchAnswersForQuestion,
  fetchOptions,
  fetchQuestions,
} from '../../quizzes/api/quizApi'
import { useHostSession } from '../hooks/useHostSession'
import { supabase } from '@/supabase/client'
import type { Answer, Question } from '@/shared/types'
import { QRCodeSVG } from 'qrcode.react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { Settings, Trophy, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'

export function HostSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const {
    session,
    players,
    loading,
    startQuiz,
    startQuestion,
    revealNextHint,
    closeAnswers,
    reopenAnswers,
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

  const { data: currentOptions } = useQuery({
    queryKey: ['options', session?.current_question_id],
    queryFn: () => fetchOptions(session!.current_question_id!),
    enabled: currentQuestion?.type === 'MULTIPLE_CHOICE' && !!session?.current_question_id,
  })

  const allHintsRevealed =
    currentQuestion?.type === 'PROGRESSIVE_HINTS' &&
    (session?.current_hint_index ?? 0) >= (currentHints?.length ?? 0)

  const [overrideLoading, setOverrideLoading] = useState<Record<string, 'approve' | 'reject' | null>>({})
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, boolean>>({})
  // Whether the host has approved/rejected at least one answer for the current question
  const [reviewedThisQuestion, setReviewedThisQuestion] = useState(false)

  // follow-up scoring: tracks committed delta per player (-1 / 0 / +1)
  const [followUpScores, setFollowUpScores] = useState<Record<string, number>>({})
  const [followUpLoading, setFollowUpLoading] = useState<Record<string, boolean>>({})

  // special scoring: tracks committed custom point amount per player for the current question
  const [specialScores, setSpecialScores] = useState<Record<string, number>>({})
  const [specialInputs, setSpecialInputs] = useState<Record<string, string>>({})
  const [specialLoading, setSpecialLoading] = useState<Record<string, boolean>>({})

  // reset per-question follow-up scores when moving to a new question
  useEffect(() => {
    setFollowUpScores({})
    setFollowUpLoading({})
    setSpecialScores({})
    setSpecialInputs({})
    setSpecialLoading({})
    setReviewedThisQuestion(false)
  }, [session?.current_question_id])

  // admin points panel — lets the host adjust any player's score at any time
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false)
  const [showNextConfirmation, setShowNextConfirmation] = useState(false)
  const [adminInputs, setAdminInputs] = useState<Record<string, string>>({})
  const [adminLoading, setAdminLoading] = useState<Record<string, boolean>>({})

  async function handleSpecialScore(sessionPlayerId: string, newValue: number) {
    const current = specialScores[sessionPlayerId] ?? 0
    const delta = newValue - current
    if (delta === 0) return
    setSpecialLoading((prev) => ({ ...prev, [sessionPlayerId]: true }))
    try {
      await adjustPlayerScore(sessionPlayerId, delta)
      await refreshLeaderboard()
      setSpecialScores((prev) => ({ ...prev, [sessionPlayerId]: newValue }))
    } finally {
      setSpecialLoading((prev) => ({ ...prev, [sessionPlayerId]: false }))
    }
  }

  async function handleAdminAdjust(sessionPlayerId: string) {
    const raw = adminInputs[sessionPlayerId]
    const delta = Number(raw)
    if (!raw || Number.isNaN(delta) || delta === 0) return
    setAdminLoading((prev) => ({ ...prev, [sessionPlayerId]: true }))
    try {
      await adjustPlayerScore(sessionPlayerId, delta)
      await refreshLeaderboard()
      setAdminInputs((prev) => ({ ...prev, [sessionPlayerId]: '' }))
    } finally {
      setAdminLoading((prev) => ({ ...prev, [sessionPlayerId]: false }))
    }
  }

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
    setReviewedThisQuestion(true)
    try {
      await supabase.rpc('override_answer', { p_answer_id: answer.id, p_is_correct: correct })
      // Wait for the answers query to catch up before dropping the optimistic
      // value, otherwise it briefly flashes back to the stale cached result.
      await Promise.all([
        refreshLeaderboard(),
        queryClient.invalidateQueries({ queryKey: ['answers', sessionId, session?.current_question_id] }),
      ])
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
  const isSpecial = currentQuestion?.type === 'SPECIAL'

  function goToNextQuestion() {
    const next = questions![currentIdx + 1]
    startQuestion(next.id, next.type !== 'FOLLOW_UP' && next.type !== 'PAUSE' && next.type !== 'SPECIAL')
  }

  function handleNextQuestionClick() {
    const hasUnreviewedAnswers =
      !isFollowUp && !isPause && !isSpecial && (currentAnswers?.length ?? 0) > 0 && !reviewedThisQuestion
    if (hasUnreviewedAnswers) {
      setShowNextConfirmation(true)
    } else {
      goToNextQuestion()
    }
  }

  return (
    <div
      className="relative min-h-dvh text-[#e8d5a0]"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-[#080a10]/78" />
      <div className="relative z-10 flex flex-col min-h-dvh">
      {/* Header */}
      <header className="flex flex-row items-center justify-between gap-2 border-b border-[#7a5c1c] bg-[#0c0f18]/90 px-3 py-2 shadow-[0_2px_15px_rgba(200,168,75,0.1)] backdrop-blur-sm sm:gap-3 sm:px-6 sm:py-4">
        <div className="min-w-0 shrink-0">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[#9d8a5e] sm:text-xs sm:tracking-[0.25em]" style={{ fontFamily: 'Cinzel, serif' }}>Host Control</p>
          <p className="whitespace-nowrap text-xl font-bold sm:text-2xl" style={{ fontFamily: 'Cinzel, serif' }}>
            ROOM:{' '}
            <span className="font-mono text-[#f0c040]" style={{ textShadow: '0 0 10px rgba(200,168,75,0.5)' }}>{session.join_code}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 overflow-x-auto sm:gap-4">
          <div className="flex shrink-0 items-center gap-2 text-[#9d8a5e]">
            <Users className="h-5 w-5" />
            <span className="text-lg font-semibold text-[#c8a84b]">{players.length}</span>
          </div>
          <button
            onClick={() => setShowAdminPanel(true)}
            title="Adjust player points"
            className="shrink-0 rounded border border-[#7a5c1c] bg-[#10131e] p-2 text-[#9d8a5e] transition-all hover:border-[#c8a84b] hover:text-[#c8a84b] hover:shadow-[0_0_10px_rgba(200,168,75,0.3)]"
          >
            <Settings className="h-5 w-5" />
          </button>
          {isRunning && (
            <Button
              variant="danger"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setShowFinishConfirmation(true)}
            >
              <span className="sm:hidden">FINISH</span>
              <span className="hidden sm:inline">FINISH SESSION</span>
            </Button>
          )}
          <a
            href={`/sessions/${sessionId}/leaderboard`}
            target="_blank"
            rel="noopener noreferrer"
            className={`${isAdmin ? 'hidden md:inline-flex' : 'inline-flex'} shrink-0 whitespace-nowrap rounded border border-[#c8a84b] bg-[#10131e] px-3 py-1.5 text-sm font-semibold text-[#c8a84b] transition-all hover:border-[#f0c040] hover:text-[#f0c040] hover:shadow-[0_0_10px_rgba(200,168,75,0.3)]`}
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

            <div className="grid grid-cols-3 gap-3 mb-6 sm:grid-cols-4">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex min-w-0 flex-col items-center gap-2 py-2 text-sm text-[#c8a84b]"
                >
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.display_name}
                      className="h-14 w-14 rounded-full object-cover border-2 border-[#f0c040] shadow-[0_0_12px_rgba(200,168,75,0.4)]"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#7a5c1c] bg-[#1a1f2e]">
                      <Trophy className="h-6 w-6 text-[#c8a84b]" />
                    </div>
                  )}
                  <span className="w-full truncate text-center">{p.display_name}</span>
                </div>
              ))}
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={players.length === 0 || !questions?.length}
              onClick={() => startQuiz(questions![0].id, questions![0].type !== 'FOLLOW_UP' && questions![0].type !== 'PAUSE' && questions![0].type !== 'SPECIAL')}
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
                  {session.accepting_answers && !isFollowUp && !isPause && !isSpecial && (
                    <Button variant="secondary" size="lg" onClick={closeAnswers}>
                      CLOSE ANSWERS
                    </Button>
                  )}
                  {!session.accepting_answers && !isPause && (
                    <div className="flex flex-row gap-3">
                      {!isFollowUp && !isSpecial && (
                        <Button
                          variant="secondary"
                          size="lg"
                          className="flex-1"
                          onClick={reopenAnswers}
                          aria-label="Go back — reopen answers"
                          title="Go back — reopen answers"
                        >
                          Open ans.
                        </Button>
                      )}
                      {hasNextQuestion && (
                        <Button
                          size="lg"
                          className="flex-1"
                          onClick={handleNextQuestionClick}
                          aria-label={`Next question (${currentIdx + 2}/${questions?.length})`}
                          title={`Next question (${currentIdx + 2}/${questions?.length})`}
                        >
                          Next Q.
                        </Button>
                      )}
                    </div>
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
                            startQuestion(next.id, next.type !== 'FOLLOW_UP' && next.type !== 'PAUSE' && next.type !== 'SPECIAL')
                          }}
                        >
                          RESUME — NEXT QUESTION ({currentIdx + 2}/{questions?.length})
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )}

            {/* Answer review — shown for non-follow-up, non-pause, non-special types after answers close */}
            {!session.accepting_answers && currentQuestion && !isFollowUp && !isPause && !isSpecial && (currentAnswers?.length ?? 0) > 0 && (
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
                    const optionIndex = currentOptions?.findIndex((o) => o.id === a.selected_option_id) ?? -1
                    const selectedOption = optionIndex >= 0 ? currentOptions![optionIndex] : undefined
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
                              {a.answer_text || (selectedOption ? `${String.fromCharCode(65 + optionIndex)}. ${selectedOption.text}` : a.selected_option_id ? 'Option selected' : '—')}
                            </p>
                            {a.hint_index_at_submission != null && (
                              <p className="text-xs text-[#6b5e42] mt-0.5">
                                Answered {a.hint_index_at_submission === 0 ? 'before hints' : `after hint ${a.hint_index_at_submission}`}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-center shrink-0 ml-4">
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

            {/* Special scoring panel — custom point amount per player */}
            {isSpecial && currentQuestion && (
              <Card>
                <h3 className="text-lg font-semibold text-[#e07a5f] mb-1" style={{ fontFamily: 'Cinzel, serif' }}>
                  ★ Special — award custom points
                </h3>
                <p className="text-xs text-[#9d8a5e] mb-4">
                  Enter any amount (positive or negative) and apply it to each player.
                </p>
                <div className="flex flex-col gap-2">
                  {players.map((p) => {
                    const assigned = specialScores[p.id] ?? 0
                    const busy = !!specialLoading[p.id]
                    const inputValue = specialInputs[p.id] ?? ''
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded border border-[#7a5c1c] bg-[#0c0f18] px-4 py-3">
                        <div>
                          <span className="font-semibold text-[#e8d5a0]">{p.display_name}</span>
                          {assigned !== 0 && (
                            <span className={`ml-2 text-xs font-bold ${assigned > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {assigned > 0 ? `+${assigned}` : assigned} applied
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 items-center shrink-0">
                          <input
                            type="number"
                            disabled={busy}
                            value={inputValue}
                            onChange={(e) => setSpecialInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="0"
                            className="w-20 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#e07a5f] transition-colors text-center"
                          />
                          <button
                            disabled={busy || !inputValue}
                            onClick={() => {
                              const val = Number(inputValue)
                              if (Number.isNaN(val)) return
                              handleSpecialScore(p.id, val)
                            }}
                            className="rounded px-3 py-1.5 text-sm font-bold bg-[#e07a5f]/90 text-[#1a0e0c] hover:bg-[#e07a5f] transition-colors disabled:opacity-50"
                          >
                            {busy ? '…' : 'Give'}
                          </button>
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
                    <span className="text-right">
                      <span className="font-bold text-[#c8a84b]">{p.score}</span>
                      {p.bonus_points !== 0 && (
                        <span className={`block text-xs font-semibold ${p.bonus_points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.bonus_points > 0 ? `+${p.bonus_points}` : p.bonus_points} bonus · {p.score - p.bonus_points} from answers
                        </span>
                      )}
                    </span>
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

      {/* Admin points panel — adjust any player's score at any time */}
      {showAdminPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-semibold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
                ⚙ Adjust Points
              </h3>
              <button
                onClick={() => setShowAdminPanel(false)}
                className="text-[#9d8a5e] hover:text-[#c8a84b] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-[#9d8a5e] mb-4">
              Give or take any amount of points from a player, at any point in the session.
            </p>
            <div className="flex flex-col gap-2">
              {players.map((p) => {
                const busy = !!adminLoading[p.id]
                const inputValue = adminInputs[p.id] ?? ''
                return (
                  <div key={p.id} className="flex items-center justify-between rounded border border-[#7a5c1c] bg-[#0c0f18] px-4 py-3">
                    <div>
                      <span className="font-semibold text-[#e8d5a0]">{p.display_name}</span>
                      <p className="text-xs text-[#6b5e42] mt-0.5">
                        Score: {p.score}
                        {p.bonus_points !== 0 && (
                          <span className={p.bonus_points > 0 ? 'text-green-500' : 'text-red-500'}>
                            {' '}({p.bonus_points > 0 ? `+${p.bonus_points}` : p.bonus_points} bonus)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center shrink-0">
                      <input
                        type="number"
                        disabled={busy}
                        value={inputValue}
                        onChange={(e) => setAdminInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        placeholder="0"
                        className="w-20 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors text-center"
                      />
                      <button
                        disabled={busy || !inputValue}
                        onClick={() => handleAdminAdjust(p.id)}
                        className="rounded px-3 py-1.5 text-sm font-bold bg-[#c8a84b] text-[#1a0e00] hover:bg-[#f0c040] transition-colors disabled:opacity-50"
                      >
                        {busy ? '…' : 'Apply'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {players.length === 0 && (
                <p className="text-sm text-center text-[#9d8a5e] py-4">No players yet</p>
              )}
            </div>
          </Card>
        </div>
      )}
      <ConfirmDialog
        open={showFinishConfirmation}
        title="Finish session?"
        message="Players will no longer be able to answer this session."
        confirmLabel="Finish session"
        onConfirm={async () => {
          await finishSession()
          setShowFinishConfirmation(false)
        }}
        onCancel={() => setShowFinishConfirmation(false)}
      />
      <ConfirmDialog
        open={showNextConfirmation}
        title="Skip answer review?"
        message="You haven't approved or rejected any answers for this question yet. Continue to the next question anyway?"
        confirmLabel="Next question"
        onConfirm={() => {
          setShowNextConfirmation(false)
          goToNextQuestion()
        }}
        onCancel={() => setShowNextConfirmation(false)}
      />
    </div>
  )
}
