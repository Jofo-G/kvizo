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
        default_points: question.type !== 'FOLLOW_UP' && question.type !== 'PAUSE' ? defaultPoints : null,
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
            ? 'text-[#f0c040]'
            : question.type === 'PAUSE'
            ? 'text-[#9d8a5e]'
            : 'text-[#c8a84b]'
        }`}>
          {question.type === 'FOLLOW_UP' ? '↪ FOLLOW-UP' : question.type === 'PAUSE' ? '⏸ PAUSE' : question.type.replace('_', ' ')} — Q{question.position}
          {question.text ? ` · ${question.text}` : ''}
        </span>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button disabled={isFirst} onClick={onMoveUp} className="p-1 text-[#9d8a5e] hover:text-[#c8a84b] disabled:opacity-30 transition-colors">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button disabled={isLast} onClick={onMoveDown} className="p-1 text-[#9d8a5e] hover:text-[#c8a84b] disabled:opacity-30 transition-colors">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm('Delete this question?')) onDelete()
            }}
            className="p-1 text-red-600 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-5">

          {/* ── Label ──────────────────────────────────────── */}
          <Input
            label="Question label"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Short text shown in-app (optional)"
          />

          {/* ── Multiple choice ────────────────────────────── */}
          {question.type === 'MULTIPLE_CHOICE' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9d8a5e]">Options</span>
                <label className="flex items-center gap-2 text-xs text-[#9d8a5e]">
                  Points for correct answer
                  <input
                    type="number"
                    min={1}
                    value={defaultPoints}
                    onChange={(e) => setDefaultPoints(Number(e.target.value))}
                    className="w-16 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors text-center"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
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
                      className="h-4 w-4 shrink-0 accent-[#c8a84b]"
                      title="Mark as correct"
                    />
                    <input
                      className="flex-1 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] placeholder-[#6b5e42] outline-none focus:border-[#c8a84b] transition-colors"
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
                      className="shrink-0 text-red-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="secondary" onClick={addOption} className="self-start">
                + Add option
              </Button>
            </div>
          )}

          {/* ── Accepted answers (open + progressive) ──────── */}
          {(question.type === 'OPEN' || question.type === 'PROGRESSIVE_HINTS') && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9d8a5e]">
                  Accepted answers <span className="normal-case font-normal">(one per line, case-insensitive)</span>
                </span>
                {question.type === 'OPEN' && (
                  <label className="flex items-center gap-2 text-xs text-[#9d8a5e]">
                    Points
                    <input
                      type="number"
                      min={1}
                      value={defaultPoints}
                      onChange={(e) => setDefaultPoints(Number(e.target.value))}
                      className="w-16 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors text-center"
                    />
                  </label>
                )}
              </div>
              <textarea
                className="w-full rounded border border-[#7a5c1c] bg-[#080a10] px-4 py-2.5 text-sm text-[#e8d5a0] placeholder-[#6b5e42] outline-none focus:border-[#c8a84b] transition-colors resize-none"
                rows={4}
                value={acceptedRaw}
                onChange={(e) => setAcceptedRaw(e.target.value)}
                placeholder={"paris\nparis, france\nla belle ville"}
              />
            </div>
          )}

          {/* ── Progressive hints ──────────────────────────── */}
          {question.type === 'PROGRESSIVE_HINTS' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#9d8a5e]">Hints</span>
                <label className="flex items-center gap-2 text-xs text-[#9d8a5e]">
                  Points with no hint shown
                  <input
                    type="number"
                    min={1}
                    value={defaultPoints}
                    onChange={(e) => setDefaultPoints(Number(e.target.value))}
                    className="w-16 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors text-center"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                {hints.map((hint, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="shrink-0 w-5 text-center text-xs text-[#6b5e42]">{i + 1}</span>
                    <input
                      className="flex-1 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] placeholder-[#6b5e42] outline-none focus:border-[#c8a84b] transition-colors"
                      placeholder={`Hint ${i + 1}`}
                      value={hint.text}
                      onChange={(e) => {
                        const next = [...hints]
                        next[i] = { ...next[i], text: e.target.value }
                        setHints(next)
                      }}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-[#6b5e42] shrink-0">
                      pts
                      <input
                        type="number"
                        min={1}
                        value={hint.points}
                        onChange={(e) => {
                          const next = [...hints]
                          next[i] = { ...next[i], points: Number(e.target.value) }
                          setHints(next)
                        }}
                        className="w-14 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors text-center"
                      />
                    </label>
                    <button
                      onClick={() => setHints(hints.filter((_, j) => j !== i))}
                      className="shrink-0 text-red-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="secondary" onClick={addHint} className="self-start">
                + Add hint
              </Button>
            </div>
          )}

          {/* ── Info banners for special types ─────────────── */}
          {question.type === 'FOLLOW_UP' && (
            <p className="text-xs text-[#f0c040]/80 rounded border border-[#c8a84b]/30 bg-[#1a1200] px-3 py-2">
              ↪ Follow-up — no answer needed. During the session the host awards&nbsp;<strong>+1</strong>,&nbsp;<strong>0</strong>, or&nbsp;<strong>−1</strong> to each player manually.
            </p>
          )}
          {question.type === 'PAUSE' && (
            <p className="text-xs text-[#9d8a5e] rounded border border-[#7a5c1c] bg-[#0c0f18] px-3 py-2">
              ⏸ Pause — players see a break screen with no answer input. The label above is shown as the break title. Host clicks Next Question to continue.
            </p>
          )}

          <Button size="sm" onClick={save} disabled={saving} className="self-start">
            {saving ? 'Saving…' : 'Save question'}
          </Button>

        </div>
      )}
    </Card>
  )
}
