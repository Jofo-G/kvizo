import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { fetchAnswersForSession } from '../../quizzes/api/quizApi'
import { useHostSession } from '../hooks/useHostSession'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router-dom'

const MEDALS = ['🥇', '🥈', '🥉']

export function HostLeaderboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, players, loading } = useHostSession(sessionId!)
  const [tab, setTab] = useState<'score' | 'fastest'>('score')

  const { data: answers } = useQuery({
    queryKey: ['answers', sessionId],
    queryFn: () => fetchAnswersForSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: 3000,
  })

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center text-[#9d8a5e]">Session not found.</p>

  const isFinished = session.status === 'FINISHED'

  // Average seconds-to-answer on correct answers only — lower is faster.
  const avgSecondsByPlayer = new Map<string, number>()
  if (answers) {
    const totals = new Map<string, { sum: number; count: number }>()
    for (const a of answers) {
      if (!a.is_correct || !a.question_started_at) continue
      const seconds = (new Date(a.submitted_at).getTime() - new Date(a.question_started_at).getTime()) / 1000
      if (!Number.isFinite(seconds) || seconds < 0) continue
      const entry = totals.get(a.session_player_id) ?? { sum: 0, count: 0 }
      entry.sum += seconds
      entry.count += 1
      totals.set(a.session_player_id, entry)
    }
    for (const [playerId, { sum, count }] of totals) {
      avgSecondsByPlayer.set(playerId, sum / count)
    }
  }

  const scoreSorted = [...players].sort((a, b) => b.score - a.score)
  const fastestSorted = [...players].sort((a, b) => {
    const aAvg = avgSecondsByPlayer.get(a.id)
    const bAvg = avgSecondsByPlayer.get(b.id)
    if (aAvg === undefined && bAvg === undefined) return 0
    if (aAvg === undefined) return 1
    if (bAvg === undefined) return -1
    return aAvg - bAvg
  })

  const sorted = tab === 'score' ? scoreSorted : fastestSorted

  return (
    <div
      className="relative min-h-screen text-[#e8d5a0] flex flex-col"
      style={{ backgroundImage: 'url(/bg.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-[#080a10]/75" />
      <div className="relative z-10 flex flex-col min-h-screen">
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18]/90 backdrop-blur-sm px-8 py-5 flex items-center justify-between shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
        <p className="text-3xl font-bold tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>
          ROOM:{' '}
          <span className="font-mono text-[#f0c040]" style={{ textShadow: '0 0 10px rgba(200,168,75,0.5)' }}>{session.join_code}</span>
        </p>
        {isFinished && (
          <span className="rounded border border-green-600 bg-green-950/60 px-4 py-1 text-sm font-semibold uppercase tracking-widest text-green-400">
            Final Results
          </span>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-start px-8 py-10 max-w-3xl mx-auto w-full">
        <div className="mb-6 flex gap-2 rounded border border-[#7a5c1c] bg-[#0c0f18]/80 p-1">
          <button
            onClick={() => setTab('score')}
            className={`rounded px-5 py-2 text-sm font-bold uppercase tracking-widest transition-all ${
              tab === 'score' ? 'bg-[#c8a84b] text-[#1a0e00]' : 'text-[#9d8a5e] hover:text-[#c8a84b]'
            }`}
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            ★ Score
          </button>
          <button
            onClick={() => setTab('fastest')}
            className={`rounded px-5 py-2 text-sm font-bold uppercase tracking-widest transition-all ${
              tab === 'fastest' ? 'bg-[#c8a84b] text-[#1a0e00]' : 'text-[#9d8a5e] hover:text-[#c8a84b]'
            }`}
            style={{ fontFamily: 'Cinzel, serif' }}
          >
            ⚡ Fastest
          </button>
        </div>

        <h1
          className="text-xl font-bold uppercase tracking-[0.3em] text-[#c8a84b] mb-8"
          style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 10px rgba(200,168,75,0.3)' }}
        >
          {tab === 'score' ? '★ Leaderboard ★' : '⚡ Fastest Answers ⚡'}
        </h1>

        {sorted.length === 0 ? (
          <p className="text-[#9d8a5e] text-lg">No players yet</p>
        ) : (
          <ol className="w-full flex flex-col gap-3">
            {sorted.map((player, i) => {
              const avgSeconds = avgSecondsByPlayer.get(player.id)
              // Rank medals/highlighting only apply to players who have a value for this tab.
              const rank = tab === 'fastest' && avgSeconds === undefined ? null : i
              return (
                <li
                  key={player.id}
                  className={`flex items-center gap-4 rounded px-6 py-4 border transition-all ${
                    rank === 0
                      ? 'border-[#f0c040] bg-[#1a1200] shadow-[0_0_20px_rgba(200,168,75,0.25)] text-2xl'
                      : rank === 1
                        ? 'border-[#9d9d9d] bg-[#141414] shadow-[0_0_10px_rgba(157,157,157,0.1)] text-xl'
                        : rank === 2
                          ? 'border-[#cd7f32] bg-[#180e06] shadow-[0_0_10px_rgba(205,127,50,0.15)] text-xl'
                          : 'border-[#7a5c1c] bg-[#0c0f18] text-lg'
                  }`}
                >
                  <span className="w-10 shrink-0 text-center text-2xl">
                    {rank === null ? (
                      <span className="text-base font-semibold text-[#6b5e42]">–</span>
                    ) : rank < 3 ? (
                      MEDALS[rank]
                    ) : (
                      <span className="text-base font-semibold text-[#9d8a5e]">{rank + 1}</span>
                    )}
                  </span>

                  {player.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.display_name}
                      className={`h-14 w-14 rounded-full object-cover shrink-0 ${
                        rank === 0 ? 'ring-2 ring-[#f0c040] shadow-[0_0_10px_rgba(200,168,75,0.4)]'
                        : rank === 1 ? 'ring-2 ring-[#9d9d9d]'
                        : rank === 2 ? 'ring-2 ring-[#cd7f32]'
                        : 'ring-1 ring-[#7a5c1c]'
                      }`}
                    />
                  ) : (
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 font-bold text-[#1a0e00] text-xl ${
                      rank === 0 ? 'bg-gradient-to-b from-[#d4a843] to-[#7a5c1c] ring-2 ring-[#f0c040]'
                      : rank === 1 ? 'bg-gradient-to-b from-[#b0b0b0] to-[#606060] ring-2 ring-[#9d9d9d]'
                      : rank === 2 ? 'bg-gradient-to-b from-[#cd7f32] to-[#8b4513] ring-2 ring-[#cd7f32]'
                      : 'bg-[#10131e] text-[#c8a84b] ring-1 ring-[#7a5c1c]'
                    }`}>
                      {player.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <span className="min-w-0 flex-1 truncate font-semibold text-[#e8d5a0]" style={rank === 0 ? { fontFamily: 'Cinzel, serif' } : {}}>
                    {player.display_name}
                  </span>

                  {tab === 'score' ? (
                    <span className="shrink-0 text-right">
                      <span className={`font-bold ${
                        rank === 0 ? 'text-[#f0c040] text-2xl' : rank === 1 ? 'text-[#c0c0c0]' : rank === 2 ? 'text-[#cd7f32]' : 'text-[#c8a84b]'
                      }`}>
                        {player.score}
                      </span>
                      {player.bonus_points !== 0 && (
                        <span className={`block text-xs font-semibold ${player.bonus_points > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {player.bonus_points > 0 ? `+${player.bonus_points}` : player.bonus_points} bonus
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="shrink-0 text-right">
                      <span className={`font-bold ${
                        rank === 0 ? 'text-[#f0c040] text-2xl' : rank === 1 ? 'text-[#c0c0c0]' : rank === 2 ? 'text-[#cd7f32]' : rank === null ? 'text-[#6b5e42]' : 'text-[#c8a84b]'
                      }`}>
                        {avgSeconds === undefined ? 'no data' : `${avgSeconds.toFixed(1)}s`}
                      </span>
                      {avgSeconds !== undefined && (
                        <span className="block text-xs font-semibold text-[#6b5e42]">avg / correct answer</span>
                      )}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </div>
      </div>
    </div>
  )
}

