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
// ONE connection per tab, shared by every caller, ref-counted.
//
// Each hook instance used to open its own socket. That was already true of
// NotificationBell (mounted in TopBar, so on every dashboard page); adding a
// second caller anywhere else meant two live sockets in the same
// user:${userId} room and every event delivered twice — the exact fault the
// Strict Mode comment below guards against, just arrived at from a different
// direction. Subscribers now share one socket and the last one out closes it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sharedSocket: any = null
let sharedSocketPending: Promise<void> | null = null
const subscribers = new Set<(payload: NotificationPushPayload) => void>()

function dispatch(payload: NotificationPushPayload) {
  // Copied before iterating — a subscriber may unsubscribe during dispatch.
  for (const fn of Array.from(subscribers)) fn(payload)
}

async function ensureSocket(): Promise<void> {
  if (sharedSocket) return
  if (!sharedSocketPending) {
    sharedSocketPending = import('socket.io-client')
      .then(({ io }) => {
        // Another caller may have won the race while this import resolved.
        if (sharedSocket) return
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        sharedSocket = io(`${base}/notifications`, { withCredentials: true })
        sharedSocket.on('notification:new', dispatch)
      })
      .catch(() => {})
      .finally(() => {
        sharedSocketPending = null
      })
  }
  return sharedSocketPending
}

function releaseSocket() {
  if (subscribers.size > 0 || !sharedSocket) return
  sharedSocket.off('notification:new', dispatch)
  sharedSocket.disconnect()
  sharedSocket = null
}

export function useNotificationsSocket(
  enabled: boolean,
  callbacks: NotificationSocketCallbacks
): void {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    if (!enabled) return

    // React 18/19 Strict Mode (Next.js dev server) double-invokes this
    // effect — mount, cleanup, mount again. With a shared socket the old
    // leak is gone (there is only ever one), but the subscriber still has to
    // be removed on cleanup or the unmounted mount keeps receiving events.
    const listener = (payload: NotificationPushPayload) => {
      cbRef.current.onNotificationCreated?.(payload)
    }
    subscribers.add(listener)
    void ensureSocket()

    return () => {
      subscribers.delete(listener)
      releaseSocket()
    }
  }, [enabled])
}
