'use client'

import { useEffect, useRef } from 'react'

const QUEUE_EVENTS = [
  'queue_add',
  'queue_called',
  'queue_served',
  'queue_reset',
  'queue_updated',
] as const

/**
 * Connects to the backend /queue Socket.IO namespace and calls `onUpdate`
 * whenever any queue event fires. Disconnects on unmount.
 */
export function useQueueSocket(onUpdate: () => void) {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null

    import('socket.io-client')
      .then(({ io }) => {
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        socket = io(`${base}/queue`, { withCredentials: true })

        const handler = () => cbRef.current()
        QUEUE_EVENTS.forEach((ev) => socket.on(ev, handler))
      })
      .catch(() => {})

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])
}
