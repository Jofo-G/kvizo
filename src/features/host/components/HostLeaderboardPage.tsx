import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { useHostSession } from '../hooks/useHostSession'
import { useParams } from 'react-router-dom'

const MEDALS = ['🥇', '🥈', '🥉']

export function HostLeaderboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, players, loading } = useHostSession(sessionId!)

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center text-[#9d8a5e]">Session not found.</p>

  const sorted = [...players].sort((a, b) => b.score - a.score)
  const isFinished = session.status === 'FINISHED'

  return (
    <div className="min-h-screen bg-wow-bg text-[#e8d5a0] flex flex-col">
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18] px-8 py-5 flex items-center justify-between shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
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
        <h1
          className="text-xl font-bold uppercase tracking-[0.3em] text-[#c8a84b] mb-8"
          style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 10px rgba(200,168,75,0.3)' }}
        >
          ★ Leaderboard ★
        </h1>

        {sorted.length === 0 ? (
          <p className="text-[#9d8a5e] text-lg">No players yet</p>
        ) : (
          <ol className="w-full flex flex-col gap-3">
            {sorted.map((player, i) => (
              <li
                key={player.id}
                className={`flex items-center gap-4 rounded px-6 py-4 border transition-all ${
                  i === 0
                    ? 'border-[#f0c040] bg-[#1a1200] shadow-[0_0_20px_rgba(200,168,75,0.25)] text-2xl'
                    : i === 1
                      ? 'border-[#9d9d9d] bg-[#141414] shadow-[0_0_10px_rgba(157,157,157,0.1)] text-xl'
                      : i === 2
                        ? 'border-[#cd7f32] bg-[#180e06] shadow-[0_0_10px_rgba(205,127,50,0.15)] text-xl'
                        : 'border-[#7a5c1c] bg-[#0c0f18] text-lg'
                }`}
              >
                <span className="w-10 shrink-0 text-center text-2xl">
                  {i < 3 ? MEDALS[i] : <span className="text-base font-semibold text-[#9d8a5e]">{i + 1}</span>}
                </span>

                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.display_name}
                    className={`h-14 w-14 rounded-full object-cover shrink-0 ${
                      i === 0 ? 'ring-2 ring-[#f0c040] shadow-[0_0_10px_rgba(200,168,75,0.4)]'
                      : i === 1 ? 'ring-2 ring-[#9d9d9d]'
                      : i === 2 ? 'ring-2 ring-[#cd7f32]'
                      : 'ring-1 ring-[#7a5c1c]'
                    }`}
                  />
                ) : (
                  <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 font-bold text-[#1a0e00] text-xl ${
                    i === 0 ? 'bg-gradient-to-b from-[#d4a843] to-[#7a5c1c] ring-2 ring-[#f0c040]'
                    : i === 1 ? 'bg-gradient-to-b from-[#b0b0b0] to-[#606060] ring-2 ring-[#9d9d9d]'
                    : i === 2 ? 'bg-gradient-to-b from-[#cd7f32] to-[#8b4513] ring-2 ring-[#cd7f32]'
                    : 'bg-[#10131e] text-[#c8a84b] ring-1 ring-[#7a5c1c]'
                  }`}>
                    {player.display_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <span className="min-w-0 flex-1 truncate font-semibold text-[#e8d5a0]" style={i === 0 ? { fontFamily: 'Cinzel, serif' } : {}}>
                  {player.display_name}
                </span>

                <span className={`shrink-0 font-bold ${
                  i === 0 ? 'text-[#f0c040] text-2xl' : i === 1 ? 'text-[#c0c0c0]' : i === 2 ? 'text-[#cd7f32]' : 'text-[#c8a84b]'
                }`}>
                  {player.score}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
