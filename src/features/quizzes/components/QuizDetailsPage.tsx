import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { formatDate, generateJoinCode } from '@/shared/lib/utils'
import { createSession, fetchSessionsForQuiz } from '../../quizzes/api/quizApi'
import { useQuiz } from '../hooks/useQuizzes'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function QuizDetailsPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()

  const { data: quiz, isLoading } = useQuiz(quizId!)
  const { data: sessions } = useQuery({
    queryKey: ['sessions', quizId],
    queryFn: () => fetchSessionsForQuiz(quizId!),
  })

  async function handleStartSession() {
    const code = generateJoinCode()
    const session = await createSession(quizId!, code)
    navigate(`/sessions/${session.id}/host`)
  }

  if (isLoading) return <LoadingSpinner />

  return (
    <div className="relative min-h-screen" style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-[#080a10]/80" />
      <div className="relative z-10 min-h-screen">
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18]/90 backdrop-blur-sm shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[#9d8a5e] hover:text-[#c8a84b] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>{quiz?.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
        <div className="flex gap-3">
          <Button onClick={() => navigate(`/quizzes/${quizId}/edit`)}>Edit Quiz</Button>
          <Button variant="secondary" onClick={handleStartSession}>
            Start New Session
          </Button>
        </div>

        {quiz?.description && (
          <Card>
            <p className="text-[#9d8a5e]">{quiz.description}</p>
          </Card>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
            Session History
          </h2>
          {sessions?.length === 0 ? (
            <p className="text-[#9d8a5e]">No sessions yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions?.map((s) => (
                <Card key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#e8d5a0]">
                      {formatDate(s.created_at)}
                    </p>
                    <p className="text-sm text-[#9d8a5e]">
                      Status:{' '}
                      <span className={
                        s.status === 'RUNNING' ? 'text-green-400 font-semibold' :
                        s.status === 'LOBBY' ? 'text-[#f0c040] font-semibold' :
                        'text-[#6b5e42]'
                      }>
                        {s.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(s.status === 'LOBBY' || s.status === 'RUNNING') && (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/sessions/${s.id}/host`)}
                      >
                        Resume host
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/sessions/${s.id}/results`)}
                    >
                      Results
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      </div>
    </div>
  )
}
