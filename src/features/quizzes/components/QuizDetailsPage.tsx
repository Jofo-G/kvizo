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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{quiz?.name}</h1>
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
            <p className="text-gray-700 dark:text-gray-300">{quiz.description}</p>
          </Card>
        )}

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Session History
          </h2>
          {sessions?.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No sessions yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions?.map((s) => (
                <Card key={s.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatDate(s.created_at)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Status: {s.status}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/sessions/${s.id}/results`)}
                  >
                    View
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
