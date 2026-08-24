import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useCreateQuiz, useDeleteQuiz, useMyQuizzes } from '../hooks/useQuizzes'
import { formatDate } from '@/shared/lib/utils'

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: quizzes, isLoading } = useMyQuizzes()
  const createMutation = useCreateQuiz()
  const deleteMutation = useDeleteQuiz()

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const quiz = await createMutation.mutateAsync({ name: newName.trim() })
    setNewName('')
    setCreating(false)
    navigate(`/quizzes/${quiz.id}/edit`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Kvizo</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Quizzes</h2>
          <Button onClick={() => setCreating(true)}>+ New Quiz</Button>
        </div>

        {creating && (
          <Card className="mb-6">
            <form onSubmit={handleCreate} className="flex gap-3">
              <Input
                placeholder="Quiz name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="flex-1"
              />
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </form>
          </Card>
        )}

        {isLoading ? (
          <LoadingSpinner />
        ) : quizzes?.length === 0 ? (
          <Card className="text-center py-12 text-gray-500 dark:text-gray-400">
            No quizzes yet. Create one to get started!
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {quizzes?.map((quiz) => (
              <Card key={quiz.id} className="flex items-center justify-between">
                <div>
                  <Link
                    to={`/quizzes/${quiz.id}`}
                    className="text-lg font-semibold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                  >
                    {quiz.name}
                  </Link>
                  {quiz.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{quiz.description}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(quiz.updated_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/quizzes/${quiz.id}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (confirm(`Delete "${quiz.name}"?`)) {
                        deleteMutation.mutate(quiz.id)
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
