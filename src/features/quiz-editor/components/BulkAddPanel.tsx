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
  { value: 'FOLLOW_UP', label: 'Follow-up' },
]

export function BulkAddPanel({ quizId, nextPosition }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<QuestionType>('PROGRESSIVE_HINTS')
  const [count, setCount] = useState(10)
  const [namePrefix, setNamePrefix] = useState('')
  const [withFollowUp, setWithFollowUp] = useState(false)
  const [followUpNamePrefix, setFollowUpNamePrefix] = useState('')
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
        namePrefix.trim() || undefined,
        type !== 'FOLLOW_UP' ? withFollowUp : false,
        followUpNamePrefix.trim() || undefined,
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
        className="flex w-full items-center justify-between text-sm font-semibold text-[#c8a84b] hover:text-[#f0c040] transition-colors"
      >
        <span>⚡ Bulk add questions</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {/* Type */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#9d8a5e] uppercase tracking-wider">
              Question type
            </label>
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`rounded px-3 py-1.5 text-sm font-semibold transition-all border ${
                    type === t.value
                      ? 'bg-gradient-to-b from-[#d4a843] to-[#7a5c1c] text-[#1a0e00] border-[#f0c040]'
                      : 'bg-[#10131e] text-[#9d8a5e] border-[#7a5c1c] hover:border-[#c8a84b] hover:text-[#c8a84b]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[#9d8a5e] w-36">
              Number of questions
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors"
            />
          </div>

          {/* Name prefix — applied to all created questions */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-[#9d8a5e]">
              Question name / label <span className="text-[#6b5e42] font-normal">(optional, same for all)</span>
            </label>
            <input
              type="text"
              value={namePrefix}
              onChange={(e) => setNamePrefix(e.target.value)}
              placeholder="e.g. Which zone is this mob from"
              className="rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] placeholder-[#6b5e42] outline-none focus:border-[#c8a84b] transition-colors"
            />
          </div>

          {/* Follow-up toggle — hidden when type is already FOLLOW_UP */}
          {type !== 'FOLLOW_UP' && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={withFollowUp}
                  onChange={(e) => setWithFollowUp(e.target.checked)}
                  className="h-4 w-4 accent-[#c8a84b]"
                />
                <span className="text-sm font-medium text-[#9d8a5e]">
                  Add a follow-up after each question
                </span>
              </label>
              {withFollowUp && (
                <div className="ml-6 flex flex-col gap-1">
                  <label className="text-sm text-[#9d8a5e]">
                    Follow-up label <span className="font-normal text-[#6b5e42]">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={followUpNamePrefix}
                    onChange={(e) => setFollowUpNamePrefix(e.target.value)}
                    placeholder="e.g. Show where in the zone the mob is"
                    className="rounded border border-[#c8a84b]/40 bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] placeholder-[#6b5e42] outline-none focus:border-[#c8a84b] transition-colors"
                  />
                  <p className="text-xs text-[#f0c040]/70">
                    Creates {count * 2} questions total — one follow-up after each main question.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Progressive hints config */}
          {type === 'PROGRESSIVE_HINTS' && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-[#9d8a5e] w-36">
                  Points — no hint
                </label>
                <input
                  type="number"
                  min={1}
                  value={defaultPoints}
                  onChange={(e) => setDefaultPoints(Number(e.target.value))}
                  className="w-20 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors"
                />
                <span className="text-xs text-[#6b5e42]">awarded if answered before any hint</span>
              </div>
              <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#9d8a5e]">
                Hints (points per hint)
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                {hintPoints.map((pts, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-xs text-[#6b5e42]">#{i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      value={pts}
                      onChange={(e) => {
                        const next = [...hintPoints]
                        next[i] = Number(e.target.value)
                        setHintPoints(next)
                      }}
                      className="w-16 rounded border border-[#7a5c1c] bg-[#080a10] px-2 py-1 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => removeHintSlot(i)}
                      className="text-red-600 hover:text-red-400 transition-colors"
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
              <p className="text-xs text-[#6b5e42]">
                Each question gets {hintPoints.length} hint(s). Answers left blank — fill them in after.
              </p>
              </div>
            </>
          )}

          {/* Multiple choice option count */}
          {type === 'MULTIPLE_CHOICE' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#9d8a5e] w-36">
                Options per question
              </label>
              <input
                type="number"
                min={2}
                max={8}
                value={optionCount}
                onChange={(e) => setOptionCount(Number(e.target.value))}
                className="w-20 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors"
              />
              <span className="text-xs text-[#6b5e42]">blank options, fill text after</span>
            </div>
          )}

          {/* Default points for non-progressive, non-followup */}
          {type !== 'PROGRESSIVE_HINTS' && type !== 'FOLLOW_UP' && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-[#9d8a5e] w-36">
                Points per correct answer
              </label>
              <input
                type="number"
                min={1}
                value={defaultPoints}
                onChange={(e) => setDefaultPoints(Number(e.target.value))}
                className="w-20 rounded border border-[#7a5c1c] bg-[#080a10] px-3 py-1.5 text-sm text-[#e8d5a0] outline-none focus:border-[#c8a84b] transition-colors"
              />
            </div>
          )}

          {type === 'FOLLOW_UP' && (
            <p className="text-xs text-[#f0c040]/80 rounded border border-[#c8a84b]/30 bg-[#1a1200] px-3 py-2">
              ↪ Follow-up questions have no answer — host scores each player +1 / 0 / −1 during the session.
            </p>
          )}

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading
              ? 'Creating…'
              : `Create ${withFollowUp && type !== 'FOLLOW_UP' ? count * 2 : count} questions${withFollowUp && type !== 'FOLLOW_UP' ? ` (${count} + ${count} follow-ups)` : ''}`}
          </Button>

          {done && (
            <p className="text-sm text-green-400 text-center">
              ✓ {withFollowUp && type !== 'FOLLOW_UP' ? count * 2 : count} questions added
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
