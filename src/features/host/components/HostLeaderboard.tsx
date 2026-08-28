import type { SessionPlayer } from '@/shared/types'

const MEDALS = ['🥇', '🥈', '🥉']

function PlayerAvatar({ player }: { player: SessionPlayer }) {
  if (player.avatar_url) {
    return (
      <img
        src={player.avatar_url}
        alt={player.display_name}
        className="h-14 w-14 rounded-full object-cover ring-2 ring-[#c8a84b] shrink-0"
      />
    )
  }
  return (
    <div className="h-14 w-14 rounded-full bg-[#10131e] ring-2 ring-[#7a5c1c] flex items-center justify-center shrink-0 text-xl font-bold text-[#c8a84b]">
      {player.display_name.charAt(0).toUpperCase()}
    </div>
  )
}

export function HostLeaderboard({ players }: { players: SessionPlayer[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="rounded border border-[#c8a84b] bg-[#10131e] shadow-[0_0_15px_rgba(200,168,75,0.12)] flex flex-col gap-3 p-4">
      <h2 className="text-center text-sm font-bold uppercase tracking-[0.2em] text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
        ★ Leaderboard ★
      </h2>

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#9d8a5e]">No players yet</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {sorted.map((player, i) => (
            <li
              key={player.id}
              className={`flex items-center gap-3 rounded px-3 py-2 border transition-all ${
                i === 0
                  ? 'border-[#f0c040] bg-[#1a1200] shadow-[0_0_10px_rgba(200,168,75,0.2)]'
                  : i === 1
                    ? 'border-[#9d9d9d] bg-[#141414]'
                    : i === 2
                      ? 'border-[#cd7f32] bg-[#180e06]'
                      : 'border-[#7a5c1c] bg-[#0c0f18]'
              }`}
            >
              <span className="w-8 shrink-0 text-center text-xl">
                {i < 3 ? (
                  MEDALS[i]
                ) : (
                  <span className="text-sm font-semibold text-[#9d8a5e]">{i + 1}</span>
                )}
              </span>

              <PlayerAvatar player={player} />

              <span className="min-w-0 flex-1 truncate font-semibold text-[#e8d5a0]">
                {player.display_name}
              </span>

              <span className={`shrink-0 text-lg font-bold ${i === 0 ? 'text-[#f0c040]' : 'text-[#c8a84b]'}`}>
                {player.score}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
