import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { useHostSession } from '../hooks/useHostSession'
import { useParams } from 'react-router-dom'

const MEDALS = ['🥇', '🥈', '🥉']

export function HostLeaderboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, players, loading } = useHostSession(sessionId!)

  if (loading) return <LoadingSpinner />
  if (!session) return <p className="p-8 text-center text-white">Session not found.</p>

  const sorted = [...players].sort((a, b) => b.score - a.score)
  const isFinished = session.status === 'FINISHED'

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="border-b border-gray-700 bg-gray-800 px-8 py-5 flex items-center justify-between">
        <p className="text-3xl font-bold tracking-wide">
          ROOM:{' '}
          <span className="font-mono text-indigo-400">{session.join_code}</span>
        </p>
        {isFinished && (
          <span className="rounded-full bg-green-700 px-4 py-1 text-sm font-semibold uppercase tracking-widest">
            Final Results
          </span>
        )}
      </header>

      <div className="flex-1 flex flex-col items-center justify-start px-8 py-10 max-w-3xl mx-auto w-full">
        <h1 className="text-xl font-bold uppercase tracking-widest text-indigo-400 mb-8">
          Leaderboard
        </h1>

        {sorted.length === 0 ? (
          <p className="text-gray-500 text-lg">No players yet</p>
        ) : (
          <ol className="w-full flex flex-col gap-3">
            {sorted.map((player, i) => (
              <li
                key={player.id}
                className={`flex items-center gap-4 rounded-2xl px-6 py-4 transition-all ${
                  i === 0
                    ? 'bg-yellow-900/40 ring-2 ring-yellow-500/60 text-2xl'
                    : i === 1
                      ? 'bg-gray-600/40 ring-1 ring-gray-400/40 text-xl'
                      : i === 2
                        ? 'bg-orange-900/30 ring-1 ring-orange-500/40 text-xl'
                        : 'bg-gray-700/30 text-lg'
                }`}
              >
                <span className="w-10 shrink-0 text-center text-2xl">
                  {i < 3 ? MEDALS[i] : <span className="text-base font-semibold text-gray-400">{i + 1}</span>}
                </span>

                {player.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.display_name}
                    className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-500 shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-full bg-indigo-700 ring-2 ring-indigo-500 flex items-center justify-center shrink-0 font-bold text-white text-xl">
                    {player.display_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <span className="min-w-0 flex-1 truncate font-semibold text-white">
                  {player.display_name}
                </span>

                <span className="shrink-0 font-bold text-indigo-300">
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
