import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchSessionByCode } from '../../quizzes/api/quizApi'

export function JoinPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const session = await fetchSessionByCode(code.trim())
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-gray-900">
      <Card className="w-full max-w-sm">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">Kvizo</h1>
        <p className="mb-6 text-gray-500 dark:text-gray-400">Enter your room code to join</p>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <Input
            id="code"
            label="Room code"
            placeholder="824196"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            required
            className="text-center text-2xl font-mono tracking-widest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Looking up…' : 'Join'}
          </Button>
        </form>
        <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Quiz host?{' '}
            <a href="/login" className="text-indigo-600 hover:underline dark:text-indigo-400">
              Sign in
            </a>
          </p>
        </div>
      </Card>
    </div>
  )
}
