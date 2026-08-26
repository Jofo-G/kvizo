import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import type { AcceptedAnswer, Question, QuestionHint, QuestionOption } from '@/shared/types'
import {
    fetchAcceptedAnswers,
    fetchHints,
    fetchOptions,
    updateQuestion,
    upsertAcceptedAnswers,
    upsertHints,
    upsertOptions,
} from '../../quizzes/api/quizApi'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  question: Question
  quizId: string
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}

export function QuestionEditor({
  question,
  quizId,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: Props) {
  const qc = useQueryClient()
  const [collapsed, setCollapsed] = useState(true)
  const [text, setText] = useState(question.text ?? '')
  const [defaultPoints, setDefaultPoints] = useState(question.default_points ?? 1)
  const [saving, setSaving] = useState(false)

  // Multiple choice options
  const [options, setOptions] = useState<Array<Omit<QuestionOption, 'id' | 'question_id'>>>([])
  // Open / Progressive accepted answers
  const [acceptedRaw, setAcceptedRaw] = useState('')
  // Progressive hints
  const [hints, setHints] = useState<Array<Omit<QuestionHint, 'id' | 'question_id'>>>([])

  useEffect(() => {
    if (question.type === 'MULTIPLE_CHOICE') {
      fetchOptions(question.id).then((opts) =>
        setOptions(opts.map(({ position, text, is_correct }) => ({ position, text, is_correct }))),
      )
    } else if (question.type === 'OPEN' || question.type === 'PROGRESSIVE_HINTS') {
      fetchAcceptedAnswers(question.id).then((aa: AcceptedAnswer[]) =>
        setAcceptedRaw(aa.map((a) => a.answer).join('\n')),
      )
    }
    if (question.type === 'PROGRESSIVE_HINTS') {
      fetchHints(question.id).then((h) =>
        setHints(h.map(({ position, text, points }) => ({ position, text, points }))),
      )
    }
  }, [question.id, question.type])

  async function save() {
    setSaving(true)
    try {
      await updateQuestion(question.id, {
        text: text || null,
        default_points: question.type !== 'FOLLOW_UP' ? defaultPoints : null,
      })
      if (question.type === 'MULTIPLE_CHOICE') {
        await upsertOptions(question.id, options)
      } else if (question.type === 'OPEN' || question.type === 'PROGRESSIVE_HINTS') {
        const answers = acceptedRaw
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
        await upsertAcceptedAnswers(question.id, answers)
      }
      if (question.type === 'PROGRESSIVE_HINTS') {
        await upsertHints(question.id, hints)
      }
      qc.invalidateQueries({ queryKey: ['questions', quizId] })
      setCollapsed(true)
    } finally {
      setSaving(false)
    }
  }

  function addOption() {
    setOptions([...options, { position: options.length + 1, text: '', is_correct: false }])
  }

  function addHint() {
    setHints([...hints, { position: hints.length + 1, text: '', points: 1 }])
  }

  return (
    <Card className="flex flex-col gap-4">
      {/* Header – click to expand/collapse */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className={`text-sm font-semibold uppercase tracking-wide ${
          question.type === 'FOLLOW_UP'
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-indigo-600 dark:text-indigo-400'
        }`}>
          {question.type === 'FOLLOW_UP' ? '↪ FOLLOW-UP' : question.type.replace('_', ' ')} — Q{question.position}
          {question.text ? ` · ${question.text}` : ''}
        </span>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={isFirst} onClick={onMoveUp} className="p-1 disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button disabled={isLast} onClick={onMoveDown} className="p-1 disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this question?')) onDelete()
            }}
            className="p-1 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
      <Input
        label="Question label (short text, shown in app)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Optional short label"
      />

      {question.type === 'MULTIPLE_CHOICE' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Options</label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={opt.is_correct}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = { ...next[i], is_correct: e.target.checked }
                  setOptions(next)
                }}
                className="h-4 w-4 accent-indigo-600"
                title="Mark as correct"
              />
              <input
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                value={opt.text}
                onChange={(e) => {
                  const next = [...options]
                  next[i] = { ...next[i], text: e.target.value }
                  setOptions(next)
                }}
              />
              <button
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addOption}>
            + Add option
          </Button>
          <Input
            label="Points for correct answer"
            type="number"
            min={1}
            value={defaultPoints}
            onChange={(e) => setDefaultPoints(Number(e.target.value))}
          />
        </div>
      )}

      {(question.type === 'OPEN' || question.type === 'PROGRESSIVE_HINTS') && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Accepted answers (one per line, case-insensitive)
          </label>
          <textarea
            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            rows={4}
            value={acceptedRaw}
            onChange={(e) => setAcceptedRaw(e.target.value)}
            placeholder={"paris\nparis, france\nla belle ville"}
          />
        </div>
      )}

      {question.type === 'OPEN' && (
        <Input
          label="Points for correct answer"
          type="number"
          min={1}
          value={defaultPoints}
          onChange={(e) => setDefaultPoints(Number(e.target.value))}
        />
      )}

      {question.type === 'PROGRESSIVE_HINTS' && (
        <Input
          label="Points for answering with NO hint shown"
          type="number"
          min={1}
          value={defaultPoints}
          onChange={(e) => setDefaultPoints(Number(e.target.value))}
        />
      )}

      {question.type === 'PROGRESSIVE_HINTS' && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Hints</label>
          {hints.map((hint, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <input
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={`Hint ${i + 1}`}
                  value={hint.text}
                  onChange={(e) => {
                    const next = [...hints]
                    next[i] = { ...next[i], text: e.target.value }
                    setHints(next)
                  }}
                />
                <input
                  type="number"
                  min={1}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Points"
                  value={hint.points}
                  onChange={(e) => {
                    const next = [...hints]
                    next[i] = { ...next[i], points: Number(e.target.value) }
                    setHints(next)
                  }}
                />
              </div>
              <button
                onClick={() => setHints(hints.filter((_, j) => j !== i))}
                className="mt-1 text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={addHint}>
            + Add hint
          </Button>
        </div>
      )}

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save question'}
      </Button>

      {question.type === 'FOLLOW_UP' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 rounded-lg bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
          ↪ Follow-up — no answer needed. During the session the host awards&nbsp;<strong>+1</strong>,&nbsp;<strong>0</strong>, or&nbsp;<strong>−1</strong> to each player manually.
        </p>
      )}
        </>
      )}
    </Card>
  )
}
