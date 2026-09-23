import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { formatDate, generateJoinCode } from '@/shared/lib/utils'
import { createSession, fetchQuizOwnerCandidates, fetchSessionsForQuiz, setQuizOwner, setSessionFeatured } from '../../quizzes/api/quizApi'
import { useQuiz } from '../hooks/useQuizzes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Star, UserPlus, X } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'

export function QuizDetailsPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const queryClient = useQueryClient()

  const { data: quiz, isLoading } = useQuiz(quizId!)
  const { data: sessions } = useQuery({
    queryKey: ['sessions', quizId],
    queryFn: () => fetchSessionsForQuiz(quizId!),
  })
  const isQuizCreator = quiz?.owner_user_id === user?.id
  const { data: ownerCandidates } = useQuery({
    queryKey: ['quiz-owner-candidates', quizId],
    queryFn: () => fetchQuizOwnerCandidates(quizId!),
    enabled: isQuizCreator,
  })

  const featureMutation = useMutation({
    mutationFn: ({ sessionId, featured }: { sessionId: string; featured: boolean }) =>
      setSessionFeatured(sessionId, featured),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions', quizId] }),
  })
  const ownerMutation = useMutation({
    mutationFn: ({ userId, isOwner }: { userId: string; isOwner: boolean }) =>
      setQuizOwner(quizId!, userId, isOwner),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quiz-owner-candidates', quizId] }),
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

        {isQuizCreator && (
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>Quiz Owners</h2>
              <p className="mt-1 text-sm text-[#9d8a5e]">Owners can edit this quiz and create or manage its sessions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ownerCandidates?.filter((candidate) => candidate.is_owner).map((candidate) => (
                <span key={candidate.user_id} className="flex items-center gap-1.5 rounded border border-[#7a5c1c] bg-[#080a10] px-2.5 py-1.5 text-sm text-[#e8d5a0]">
                  {candidate.email}
                  {candidate.user_id !== user?.id && (
                    <button
                      type="button"
                      title={`Remove ${candidate.email} as owner`}
                      aria-label={`Remove ${candidate.email} as owner`}
                      onClick={() => ownerMutation.mutate({ userId: candidate.user_id, isOwner: false })}
                      disabled={ownerMutation.isPending}
                      className="text-[#9d8a5e] hover:text-red-400 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <label className="flex max-w-md items-center gap-2">
              <span className="sr-only">Add quiz owner</span>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) ownerMutation.mutate({ userId: event.target.value, isOwner: true })
                }}
                disabled={ownerMutation.isPending}
                className="min-w-0 flex-1 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-2 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] disabled:opacity-40"
              >
                <option value="">Add a registered user...</option>
                {ownerCandidates?.filter((candidate) => !candidate.is_owner).map((candidate) => (
                  <option key={candidate.user_id} value={candidate.user_id}>{candidate.email}</option>
                ))}
              </select>
              <UserPlus className="h-5 w-5 shrink-0 text-[#c8a84b]" aria-hidden="true" />
            </label>
            {ownerMutation.error && <p role="alert" className="text-sm text-red-400">Could not update quiz owners.</p>}
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
                    {isAdmin && s.status === 'FINISHED' && (
                      <Button
                        size="sm"
                        variant={s.is_featured ? 'secondary' : 'ghost'}
                        title={s.is_featured ? 'Remove from Hall of Fame' : 'Add to Hall of Fame'}
                        onClick={() =>
                          featureMutation.mutate({ sessionId: s.id, featured: !s.is_featured })
                        }
                        disabled={featureMutation.isPending}
                      >
                        <Star
                          className="h-4 w-4"
                          fill={s.is_featured ? 'currentColor' : 'none'}
                        />
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
