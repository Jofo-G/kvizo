import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { formatDate } from '@/shared/lib/utils'
import { fetchFeaturedSessions } from '../../quizzes/api/quizApi'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchSessionByCode } from '../../quizzes/api/quizApi'
import { Trophy } from 'lucide-react'

export function JoinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: featuredSessions } = useQuery({
    queryKey: ['featuredSessions'],
    queryFn: fetchFeaturedSessions,
  })

  // Auto-submit if code came from QR link
  useEffect(() => {
    const qrCode = searchParams.get('code')
    if (qrCode) handleJoinWithCode(qrCode)
  }, [])

  async function handleJoinWithCode(c: string) {
    setError('')
    setLoading(true)
    try {
      const session = await fetchSessionByCode(c.trim())
      if (!session) {
        setError('Room not found. Check the code and try again.')
        return
      }
      if (session.status !== 'LOBBY') {
        setError('This session is no longer accepting players.')
        return
      }
      navigate(`/play/${session.id}`)
    } catch {
      setError('Could not connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    await handleJoinWithCode(code)
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center p-4"
      style={{
        backgroundImage: 'url(/bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* dark overlay to keep text readable */}
      <div className="absolute inset-0 bg-[#080a10]/80" />
      <div className="relative z-10 flex w-full flex-col items-center">
      <div className="mb-8 text-center">
        <h1
          className="text-5xl font-black tracking-[0.2em] text-[#f0c040]"
          style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 25px rgba(200,168,75,0.6), 0 2px 4px rgba(0,0,0,0.8)' }}
        >
          KVIZO
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-[#9d8a5e]">Enter the Tavern</p>
      </div>

      <Card className="w-full max-w-sm">
        <p
          className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-[#9d8a5e]"
          style={{ fontFamily: 'Cinzel, serif' }}
        >
          Enter your room code to join
        </p>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <Input
            id="code"
            label="Room Code"
            placeholder="824196"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            required
            className="text-center text-2xl font-mono tracking-[0.4em]"
          />
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Seeking…' : 'Join the Table'}
          </Button>
        </form>
        <div className="mt-6 border-t border-[#7a5c1c] pt-4">
          <p className="text-center text-sm text-[#6b5e42]">
            Quiz host?{' '}
            <a href="/login" className="text-[#c8a84b] hover:text-[#f0c040] transition-colors">
              Sign in
            </a>
          </p>
        </div>
      </Card>

      {featuredSessions && featuredSessions.length > 0 && (
        <div className="mt-12 w-full max-w-3xl">
          <div className="mb-4 flex items-center justify-center gap-2">
            <Trophy className="h-5 w-5 text-[#f0c040]" />
            <h2
              className="text-lg font-bold tracking-[0.15em] text-[#f0c040]"
              style={{ fontFamily: 'Cinzel, serif', textShadow: '0 0 10px rgba(200,168,75,0.4)' }}
            >
              Hall of Fame
            </h2>
            <Trophy className="h-5 w-5 text-[#f0c040]" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => navigate(`/sessions/${session.id}/results`)}
                className="group text-left w-full"
              >
                <Card className="flex flex-col gap-3 hover:border-[#f0c040] hover:shadow-[0_0_25px_rgba(200,168,75,0.25)] transition-all duration-200">
                  <p
                    className="text-sm font-bold text-[#c8a84b] truncate"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {session.quiz_name}
                  </p>
                  <div className="flex flex-col items-center gap-2 py-2">
                    {session.winner_avatar_url ? (
                      <img
                        src={session.winner_avatar_url}
                        alt={session.winner_display_name ?? 'Winner'}
                        className="h-16 w-16 rounded-full object-cover border-2 border-[#f0c040] shadow-[0_0_12px_rgba(200,168,75,0.4)]"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-[#1a1f2e] border-2 border-[#7a5c1c] flex items-center justify-center">
                        <Trophy className="h-7 w-7 text-[#c8a84b]" />
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-semibold text-[#e8d5a0]">
                        {session.winner_display_name ?? '—'}
                      </p>
                      {session.winner_score !== null && (
                        <p className="text-xs text-[#9d8a5e]">{session.winner_score} pts</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-[#6b5e42] text-center">
                    {formatDate(session.created_at)}
                  </p>
                </Card>
              </button>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
