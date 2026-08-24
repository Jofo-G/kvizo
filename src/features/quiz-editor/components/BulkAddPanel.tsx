import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import type { QuestionType } from '@/shared/types'
import { bulkCreateQuestions } from '../../quizzes/api/quizApi'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

interface Props {
  quizId: string
  nextPosition: number
}

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'PROGRESSIVE_HINTS', label: 'Progressive Hints' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'OPEN', label: 'Open Answer' },
]

export function BulkAddPanel({ quizId, nextPosition }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<QuestionType>('PROGRESSIVE_HINTS')
  const [count, setCount] = useState(10)
  const [defaultPoints, setDefaultPoints] = useState(1)
  const [optionCount, setOptionCount] = useState(4)
  const [hintPoints, setHintPoints] = useState<number[]>([5, 3, 1])
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  function addHintSlot() {
    setHintPoints([...hintPoints, 1])
  }

  function removeHintSlot(i: number) {
    setHintPoints(hintPoints.filter((_, j) => j !== i))
  }

  async function handleCreate() {
    setLoading(true)
    setDone(false)
    try {
      await bulkCreateQuestions(
        quizId,
        nextPosition,
        count,
        type,
        hintPoints,
        defaultPoints,
        optionCount,
      )
      qc.invalidateQueries({ queryKey: ['questions', quizId] })
      setDone(true)
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
        <span>⚡ Bulk add questions</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Question type
            </label>
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                    type === t.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-36">
              Number of questions
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded-xl border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Hints config */}
          {type === 'PROGRESSIVE_HINTS' && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Hints (points per hint)
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {hintPoints.map((pts, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">#{i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      value={pts}
                      onChange={(e) => {
                        const next = [...hintPoints]
                        next[i] = Number(e.target.value)
                        setHintPoints(next)
                      }}
                      className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeHintSlot(i)}
                      className="text-red-400 hover:text-red-600"
                      disabled={hintPoints.length <= 1}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={addHintSlot}>
                  + Hint
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Each question gets {hintPoints.length} hint(s). Answers left blank — fill them in after.
              </p>
            </div>
          )}

          {/* Multiple choice option count */}
          {type === 'MULTIPLE_CHOICE' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-36">
                Options per question
              </label>
              <input
                type="number"
                min={2}
                max={8}
                value={optionCount}
                onChange={(e) => setOptionCount(Number(e.target.value))}
                className="w-20 rounded-xl border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
              <span className="text-xs text-gray-400">blank options, fill text after</span>
            </div>
          )}

          {/* Default points for non-progressive */}
          {type !== 'PROGRESSIVE_HINTS' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-36">
                Points per correct answer
              </label>
              <input
                type="number"
                min={1}
                value={defaultPoints}
                onChange={(e) => setDefaultPoints(Number(e.target.value))}
                className="w-20 rounded-xl border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          )}

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading
              ? 'Creating…'
              : `Create ${count} ${TYPE_OPTIONS.find((t2) => t2.value === type)?.label} questions`}
          </Button>

          {done && (
            <p className="text-sm text-green-600 dark:text-green-400 text-center">
              ✓ {count} questions added
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
