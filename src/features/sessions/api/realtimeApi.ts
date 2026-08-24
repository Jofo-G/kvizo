import { supabase } from '@/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { RealtimeEvent } from '@/shared/types'

export function subscribeToSession(
  sessionId: string,
  onEvent: (event: RealtimeEvent) => void,
): RealtimeChannel {
  const channel = supabase.channel(`quiz-session:${sessionId}`)
  channel.on('broadcast', { event: '*' }, ({ payload }) => {
    onEvent(payload as RealtimeEvent)
  })
  channel.subscribe()
  return channel
}

export async function broadcastEvent(
  sessionId: string,
  event: RealtimeEvent,
): Promise<void> {
  await supabase.channel(`quiz-session:${sessionId}`).send({
    type: 'broadcast',
    event: event.type,
    payload: event,
  })
}
