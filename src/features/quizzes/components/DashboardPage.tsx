import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { ConfirmDialog } from '@/shared/components/ConfirmDialog'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useCreateQuiz, useDeleteQuiz, useMyQuizzes } from '../hooks/useQuizzes'
import { formatDate } from '@/shared/lib/utils'
import { LogOut, Users } from 'lucide-react'

export function DashboardPage() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: quizzes, isLoading } = useMyQuizzes()
  const createMutation = useCreateQuiz()
  const deleteMutation = useDeleteQuiz()

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [quizToDelete, setQuizToDelete] = useState<{ id: string; name: string } | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const quiz = await createMutation.mutateAsync({ name: newName.trim() })
    setNewName('')
    setCreating(false)
    navigate(`/quizzes/${quiz.id}/edit`)
  }

  return (
    <div className="relative min-h-screen" style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-[#080a10]/80" />
      <div className="relative z-10 min-h-screen">
      {/* Header */}
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18]/90 backdrop-blur-sm shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <h1
            className="text-xl font-black tracking-[0.15em] text-[#f0c040]"
            style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 12px rgba(200,168,75,0.4)' }}
          >
            KVIZO
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#6b5e42]">{user?.email}</span>
            {isAdmin && (
              <Link
                to="/admin/users"
                aria-label="Manage players"
                title="Manage players"
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-transparent text-[#c8a84b] transition-colors hover:border-[#c8a84b]/30 hover:bg-[#c8a84b]/10 hover:text-[#f0c040]"
              >
                <Users className="h-5 w-5" />
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Sign out"
              title="Sign out"
              className="h-9 w-9 p-0"
              onClick={signOut}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2
            className="text-2xl font-bold text-[#c8a84b]"
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            My Quizzes
          </h2>
          <Button onClick={() => setCreating(true)}>+ New Quiz</Button>
        </div>

        {deleteError && <p role="alert" className="mb-6 rounded border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{deleteError}</p>}

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
          <Card className="text-center py-12 text-[#9d8a5e]">
            No quizzes yet. Create one to get started!
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {quizzes?.map((quiz) => (
              <Card key={quiz.id} className="flex items-center justify-between hover:border-[#f0c040] hover:shadow-[0_0_20px_rgba(200,168,75,0.2)] transition-all duration-200">
                <div>
                  <Link
                    to={`/quizzes/${quiz.id}`}
                    className="text-lg font-semibold text-[#e8d5a0] hover:text-[#f0c040] transition-colors"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {quiz.name}
                  </Link>
                  {quiz.description && (
                    <p className="text-sm text-[#9d8a5e]">{quiz.description}</p>
                  )}
                  <p className="text-xs text-[#6b5e42]">
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
                    onClick={() => setQuizToDelete({ id: quiz.id, name: quiz.name })}
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
      <ConfirmDialog
        open={!!quizToDelete}
        title="Delete quiz?"
        message={quizToDelete ? `Delete "${quizToDelete.name}"?` : ''}
        confirmLabel="Delete quiz"
        onConfirm={async () => {
          if (!quizToDelete) return
          setDeleteError(null)
          try {
            await deleteMutation.mutateAsync(quizToDelete.id)
            setQuizToDelete(null)
          } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Could not delete quiz.')
          }
        }}
        onCancel={() => setQuizToDelete(null)}
      />
    </div>
  )
}
