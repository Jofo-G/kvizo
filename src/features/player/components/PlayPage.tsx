import { useParams } from 'react-router-dom'
import { PlayerSessionView } from './PlayerSessionView'

export function PlayPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  return <PlayerSessionView sessionId={sessionId!} />
}
