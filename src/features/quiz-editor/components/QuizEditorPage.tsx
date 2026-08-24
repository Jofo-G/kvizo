import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { Question, QuestionType } from '@/shared/types'
import {
    createQuestion,
    deleteQuestion,
    fetchQuestions,
    updateQuestion,
} from '../../quizzes/api/quizApi'
import { useQuiz, useUpdateQuiz } from '../../quizzes/hooks/useQuizzes'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { BulkAddPanel } from './BulkAddPanel'
import { useNavigate, useParams } from 'react-router-dom'
import { QuestionEditor } from './QuestionEditor'

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'OPEN', label: 'Open Answer' },
  { value: 'PROGRESSIVE_HINTS', label: 'Progressive Hints' },
]

export function QuizEditorPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: quiz, isLoading: quizLoading } = useQuiz(quizId!)
  const updateQuizMutation = useUpdateQuiz(quizId!)
  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['questions', quizId],
    queryFn: () => fetchQuestions(quizId!),
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingMeta, setEditingMeta] = useState(false)

  // Init local state from loaded quiz
  const displayName = quiz?.name ?? ''
  const displayDesc = quiz?.description ?? ''

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault()
    await updateQuizMutation.mutateAsync({ name: name || displayName, description: description || undefined })
    setEditingMeta(false)
  }

  async function handleAddQuestion(type: QuestionType) {
    const pos = (questions?.length ?? 0) + 1
    await createQuestion(quizId!, pos, type)
    qc.invalidateQueries({ queryKey: ['questions', quizId] })
  }

  async function handleDeleteQuestion(q: Question) {
    await deleteQuestion(q.id)
    // Re-number positions
    const remaining = (questions ?? []).filter((x) => x.id !== q.id)
    await Promise.all(
      remaining.map((x, i) =>
        x.position !== i + 1 ? updateQuestion(x.id, { position: i + 1 }) : Promise.resolve(),
      ),
    )
    qc.invalidateQueries({ queryKey: ['questions', quizId] })
  }

  async function swapPositions(a: Question, b: Question) {
    await Promise.all([
      updateQuestion(a.id, { position: b.position }),
      updateQuestion(b.id, { position: a.position }),
    ])
    qc.invalidateQueries({ queryKey: ['questions', quizId] })
  }

  if (quizLoading || questionsLoading) return <LoadingSpinner />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-400"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {editingMeta ? 'Edit Quiz Info' : displayName}
          </h1>
          {!editingMeta && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setName(displayName)
                setDescription(displayDesc)
                setEditingMeta(true)
              }}
            >
              Edit info
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
        {/* Meta edit */}
        {editingMeta && (
          <Card>
            <form onSubmit={saveMeta} className="flex flex-col gap-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={updateQuizMutation.isPending}>
                  {updateQuizMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setEditingMeta(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Questions */}
        <div className="flex flex-col gap-4">
          {questions?.map((q, i) => (
            <QuestionEditor
              key={q.id}
              question={q}
              quizId={quizId!}
              onDelete={() => handleDeleteQuestion(q)}
              onMoveUp={() => swapPositions(q, questions[i - 1])}
              onMoveDown={() => swapPositions(q, questions[i + 1])}
              isFirst={i === 0}
              isLast={i === (questions?.length ?? 1) - 1}
            />
          ))}
        </div>

        {/* Add question */}
        <BulkAddPanel quizId={quizId!} nextPosition={(questions?.length ?? 0) + 1} />

        <Card>
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Add a single question
          </p>
          <div className="flex flex-wrap gap-2">
            {QUESTION_TYPES.map((t) => (
              <Button
                key={t.value}
                variant="secondary"
                size="sm"
                onClick={() => handleAddQuestion(t.value)}
              >
                + {t.label}
              </Button>
            ))}
          </div>
        </Card>
      </main>
    </div>
  )
}
