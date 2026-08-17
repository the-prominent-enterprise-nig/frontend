'use client'

import { useEffect, useRef } from 'react'
import type { NotificationType } from '@/src/schema/notifications/notification'

/** Raw push payload — unlike a fetched NotificationItem, it has no isRead/readAt
 * (a freshly-created notification is by definition unread for its recipient). */
export interface NotificationPushPayload {
  id: string
  eventType: NotificationType
  entityType: string
  entityId: string
  title: string
  message: string
  metadata: unknown
  branchId: string | null
  createdAt: string
}

export interface NotificationSocketCallbacks {
  onNotificationCreated?: (payload: NotificationPushPayload) => void
}

/**
 * Mirrors usePosSocket.ts's shape. Unlike that hook, no explicit 'join' emit
 * is needed on connect — the backend gateway authenticates the handshake
 * itself and derives room membership (user:${userId}) from the authenticated
 * connection, not a client-supplied id.
 */
export function useNotificationsSocket(
  enabled: boolean,
  callbacks: NotificationSocketCallbacks
): void {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    if (!enabled) return

    // React 18/19 Strict Mode (Next.js dev server) double-invokes this
    // effect — mount, cleanup, mount again — to catch exactly this kind of
    // bug. Because connecting is async, the FIRST mount's cleanup can fire
    // before `socket` is even assigned, so without this guard that
    // never-cancelled connection leaks: two live sockets end up joined to
    // the same user:${userId} room, and every event arrives twice. `cancelled`
    // makes the leaked mount's connection a no-op once its import() resolves.
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null

    import('socket.io-client')
      .then(({ io }) => {
        if (cancelled) return
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        socket = io(`${base}/notifications`, { withCredentials: true })

        socket.on('notification:new', (payload: NotificationPushPayload) => {
          cbRef.current.onNotificationCreated?.(payload)
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [enabled])
}
