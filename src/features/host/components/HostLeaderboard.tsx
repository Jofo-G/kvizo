import type { SessionPlayer } from '@/shared/types'

const MEDALS = ['🥇', '🥈', '🥉']

function PlayerAvatar({ player }: { player: SessionPlayer }) {
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.display_name}
        className="h-14 w-14 rounded-full object-cover ring-2 ring-indigo-500 shrink-0"
      />
    )
  }
  return (
    <div className="h-14 w-14 rounded-full bg-indigo-700 ring-2 ring-indigo-500 flex items-center justify-center shrink-0 text-xl font-bold text-white">
      {player.display_name.charAt(0).toUpperCase()}
    </div>
  )
}

export function HostLeaderboard({ players }: { players: SessionPlayer[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="rounded-2xl bg-gray-800 border border-gray-700 flex flex-col gap-3 p-4">
      <h2 className="text-center text-sm font-bold uppercase tracking-widest text-indigo-400">
        Leaderboard
      </h2>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No players yet</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {sorted.map((player, i) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                i === 0
                  ? 'bg-yellow-900/40 ring-1 ring-yellow-500/50'
                  : i === 1
                    ? 'bg-gray-600/40 ring-1 ring-gray-500/30'
                    : i === 2
                      ? 'bg-orange-900/30 ring-1 ring-orange-600/30'
                      : 'bg-gray-700/30'
              }`}
            >
              {/* Rank */}
              <span className="w-8 shrink-0 text-center text-xl">
                {i < 3 ? (
                  MEDALS[i]
                ) : (
                  <span className="text-sm font-semibold text-gray-400">{i + 1}</span>
                )}
              </span>

              <PlayerAvatar player={player} />

              <span className="min-w-0 flex-1 truncate font-semibold text-white">
                {player.display_name}
              </span>

              <span className="shrink-0 text-lg font-bold text-indigo-300">
                {player.score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
