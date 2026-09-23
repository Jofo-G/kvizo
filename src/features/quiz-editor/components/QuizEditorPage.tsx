import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { Question, QuestionType, QuizExportQuestion } from '@/shared/types'
import {
    createQuestion,
    deleteQuestion,
  exportQuiz,
    fetchQuestions,
  replaceQuizFromExport,
    updateQuestion,
} from '../../quizzes/api/quizApi'
import { useQuiz, useUpdateQuiz } from '../../quizzes/hooks/useQuizzes'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { BulkAddPanel } from './BulkAddPanel'
import { useNavigate, useParams } from 'react-router-dom'
import { QuestionEditor } from './QuestionEditor'

type JsonRecord = Record<string, unknown>

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'OPEN', label: 'Open Answer' },
  { value: 'PROGRESSIVE_HINTS', label: 'Progressive Hints' },
  { value: 'PAUSE', label: '⏸ Pause' },
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
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [transferError, setTransferError] = useState<string | null>(null)
  const [transferring, setTransferring] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleBulkDelete() {
    if (!selectedIds.size) return
    if (!confirm(`Delete ${selectedIds.size} question(s)?`)) return
    await Promise.all([...selectedIds].map((id) => deleteQuestion(id)))
    const remaining = (questions ?? []).filter((q) => !selectedIds.has(q.id))
    await Promise.all(
      remaining.map((q, i) =>
        q.position !== i + 1 ? updateQuestion(q.id, { position: i + 1 }) : Promise.resolve(),
      ),
    )
    setSelectedIds(new Set())
    setSelectMode(false)
    qc.invalidateQueries({ queryKey: ['questions', quizId] })
  }

  function downloadExport() {
    if (!quiz) return
    setTransferError(null)
    setTransferring(true)
    exportQuiz(quiz, questions ?? [])
      .then((data) => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `${quiz.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '') || 'quiz'}.json`
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setTransferError('Could not export this quiz. Please try again.'))
      .finally(() => setTransferring(false))
  }

  async function handleImport(file: File) {
    try {
      setTransferError(null)
      const importedQuiz = parseQuizExport(JSON.parse(await file.text()))
      if (!confirm(`Replace this quiz with "${importedQuiz.quiz.name}" and its ${importedQuiz.questions.length} question(s)? This cannot be undone.`)) return
      setTransferring(true)
      await replaceQuizFromExport(quizId!, questions ?? [], importedQuiz)
      await qc.invalidateQueries({ queryKey: ['quiz', quizId] })
      await qc.invalidateQueries({ queryKey: ['questions', quizId] })
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : 'Could not import that file.')
    } finally {
      setTransferring(false)
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  if (quizLoading || questionsLoading) return <LoadingSpinner />

  return (
    <div className="relative min-h-screen" style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-[#080a10]/80" />
      <div className="relative z-10 min-h-screen">
      {/* Header */}
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18]/90 backdrop-blur-sm shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(`/quizzes/${quizId}`)}
            className="text-[#9d8a5e] hover:text-[#c8a84b] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
            {editingMeta ? 'Edit Quiz Info' : displayName}
          </h1>
          {!editingMeta && (
            <div className="ml-auto flex items-center gap-1">
              <button type="button" title="Export quiz JSON" aria-label="Export quiz JSON" onClick={downloadExport} disabled={transferring} className="p-2 text-[#9d8a5e] hover:text-[#c8a84b] disabled:opacity-40 transition-colors">
                <Download className="h-4 w-4" />
              </button>
              <button type="button" title="Import quiz JSON" aria-label="Import quiz JSON" onClick={() => importInputRef.current?.click()} disabled={transferring} className="p-2 text-[#9d8a5e] hover:text-[#c8a84b] disabled:opacity-40 transition-colors">
                <Upload className="h-4 w-4" />
              </button>
              <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImport(file)
              }} />
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
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 flex flex-col gap-6">
        {transferError && <p role="alert" className="rounded border border-red-500/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{transferError}</p>}
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
          {/* Bulk-delete toolbar */}
          {(questions?.length ?? 0) > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setSelectMode((s) => !s); setSelectedIds(new Set()) }}
                className="text-sm font-medium text-[#9d8a5e] hover:text-[#c8a84b] underline underline-offset-2 transition-colors"
              >
                {selectMode ? 'Cancel' : 'Bulk delete'}
              </button>
              {selectMode && (
                <>
                  <label className="flex items-center gap-1.5 text-sm text-[#9d8a5e] cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#c8a84b]"
                      checked={selectedIds.size === questions!.length}
                      onChange={(e) =>
                        setSelectedIds(e.target.checked ? new Set(questions!.map((q) => q.id)) : new Set())
                      }
                    />
                    Select all
                  </label>
                  <button
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={handleBulkDelete}
                    className="ml-auto rounded bg-gradient-to-b from-[#c0392b] to-[#7f1d1d] px-3 py-1.5 text-sm font-semibold text-white border border-[#ef4444] hover:from-[#e74c3c] hover:to-[#991b1b] disabled:opacity-40 transition-all"
                  >
                    Delete {selectedIds.size > 0 ? `${selectedIds.size} ` : ''}selected
                  </button>
                </>
              )}
            </div>
          )}

          {questions?.map((q, i) => (
            <div key={q.id} className="flex items-start gap-2">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(q.id)}
                  onChange={() => toggleSelect(q.id)}
                  className="mt-4 h-4 w-4 shrink-0 accent-[#c8a84b]"
                />
              )}
              <div className="flex-1 min-w-0">
                <QuestionEditor
                  question={q}
                  quizId={quizId!}
                  onDelete={() => handleDeleteQuestion(q)}
                  onMoveUp={() => swapPositions(q, questions[i - 1])}
                  onMoveDown={() => swapPositions(q, questions[i + 1])}
                  isFirst={i === 0}
                  isLast={i === (questions?.length ?? 1) - 1}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add question */}
        <BulkAddPanel quizId={quizId!} nextPosition={(questions?.length ?? 0) + 1} />

        <Card>
          <p className="mb-3 text-sm font-medium text-[#9d8a5e] uppercase tracking-wider">
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
    </div>
  )
}

function parseQuizExport(value: unknown) {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.quiz) || !Array.isArray(value.questions)) {
    throw new Error('This is not a supported Kvizo quiz export.')
  }
  if (typeof value.quiz.name !== 'string' || !value.quiz.name.trim() || (value.quiz.description !== null && typeof value.quiz.description !== 'string')) {
    throw new Error('The quiz name or description is invalid.')
  }

  return {
    version: 1 as const,
    quiz: { name: value.quiz.name.trim(), description: value.quiz.description },
    questions: value.questions.map((question, index) => parseQuestion(question, index)),
  }
}

function parseQuestion(value: unknown, index: number): QuizExportQuestion {
  if (!isRecord(value) || !['MULTIPLE_CHOICE', 'OPEN', 'PROGRESSIVE_HINTS', 'FOLLOW_UP', 'PAUSE'].includes(String(value.type))) {
    throw new Error(`Question ${index + 1} has an invalid type.`)
  }
  if ((value.text !== null && typeof value.text !== 'string') || (value.default_points !== null && !isPositiveInteger(value.default_points))) {
    throw new Error(`Question ${index + 1} has invalid text or points.`)
  }
  const options = parseItems<QuizExportQuestion['options'][number]>(value.options, index, 'option', (option) =>
    isRecord(option) && isPositiveInteger(option.position) && typeof option.text === 'string' && typeof option.is_correct === 'boolean',
  )
  const acceptedAnswers = parseItems<string>(value.accepted_answers, index, 'accepted answer', (answer) => typeof answer === 'string')
  const hints = parseItems<QuizExportQuestion['hints'][number]>(value.hints, index, 'hint', (hint) =>
    isRecord(hint) && isPositiveInteger(hint.position) && typeof hint.text === 'string' && isPositiveInteger(hint.points),
  )
  return { type: value.type as QuestionType, text: value.text, default_points: value.default_points, options, accepted_answers: acceptedAnswers, hints }
}

function parseItems<T>(value: unknown, questionIndex: number, label: string, isValid: (item: unknown) => boolean): T[] {
  if (!Array.isArray(value) || !value.every(isValid)) {
    throw new Error(`Question ${questionIndex + 1} has an invalid ${label}.`)
  }
  return value as T[]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}
