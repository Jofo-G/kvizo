import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { formatDate } from '@/shared/lib/utils'
import {
    fetchAnswersForSession,
    fetchQuestions,
    fetchSession,
    fetchSessionPlayers,
} from '../../quizzes/api/quizApi'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

export function SessionResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSession(sessionId!),
  })

  const { data: players } = useQuery({
    queryKey: ['players', sessionId],
    queryFn: () => fetchSessionPlayers(sessionId!),
    enabled: !!session,
  })

  const { data: questions } = useQuery({
    queryKey: ['questions', session?.quiz_id],
    queryFn: () => fetchQuestions(session!.quiz_id),
    enabled: !!session?.quiz_id,
  })

  const { data: answers } = useQuery({
    queryKey: ['answers', sessionId],
    queryFn: () => fetchAnswersForSession(sessionId!),
    enabled: !!session,
  })

  if (sessionLoading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center">Session not found.</p>

  const sorted = [...(players ?? [])].sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen bg-wow-bg">
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18] shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(`/quizzes/${session.quiz_id}`)}
            className="text-[#9d8a5e] hover:text-[#c8a84b] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
              Session Results
            </h1>
            <p className="text-sm text-[#6b5e42]">
              {formatDate(session.created_at)} · {session.status}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
        <Card>
          <h2 className="text-lg font-bold text-[#c8a84b] mb-4" style={{ fontFamily: 'Cinzel, serif' }}>Final Leaderboard</h2>
          <ol className="flex flex-col gap-2">
            {sorted.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between">
                <span className="text-[#9d8a5e]">
                  {i + 1}. {p.display_name}
                </span>
                <span className="font-bold text-[#c8a84b]">{p.score} pts</span>
              </li>
            ))}
          </ol>
        </Card>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
            Question Breakdown
          </h2>
          <div className="flex flex-col gap-4">
            {questions?.map((q, qi) => {
              const qAnswers = answers?.filter((a) => a.question_id === q.id) ?? []
              const correct = qAnswers.filter((a) => a.is_correct).length
              return (
                <Card key={q.id}>
                  <p className="font-semibold text-[#e8d5a0] mb-1">
                    Q{qi + 1}: {q.text || '(no label)'}{' '}
                    <span className="text-xs text-[#6b5e42]">{q.type}</span>
                  </p>
                  <p className="text-sm text-[#9d8a5e] mb-3">
                    {correct} / {qAnswers.length} correct
                  </p>
                  <div className="flex flex-col gap-1">
                    {qAnswers.map((a) => {
                      const player = players?.find((p) => p.id === a.session_player_id)
                      return (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                          <span className="text-[#9d8a5e]">
                            {player?.display_name}
                            {a.answer_text ? ` — "${a.answer_text}"` : ''}
                            {a.hint_index_at_submission != null
                              ? ` (hint ${a.hint_index_at_submission})`
                              : ''}
                          </span>
                          <span className={a.is_correct ? 'text-green-400' : 'text-red-400'}>
                            {a.is_correct ? `✓ ${a.points_awarded}pts` : '✕'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
