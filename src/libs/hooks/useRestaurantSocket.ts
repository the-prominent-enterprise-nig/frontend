'use client'

import { useEffect, useRef } from 'react'

const RESTAURANT_EVENTS = [
  'table_status_changed',
  'floor_board_updated',
  'tab_updated',
  'kitchen_ticket_updated',
  'waitlist_updated',
  'low_score_alert',
] as const

export type RestaurantEvent = (typeof RESTAURANT_EVENTS)[number]

export function useRestaurantSocket(onUpdate: (event: RestaurantEvent, payload: unknown) => void) {
  const cbRef = useRef(onUpdate)
  cbRef.current = onUpdate

  useEffect(() => {
    // React 18/19 Strict Mode (Next.js dev server) double-invokes this
    // effect — mount, cleanup, mount again — to catch exactly this kind of
    // bug. Because connecting is async, the FIRST mount's cleanup can fire
    // before `socket` is even assigned, so without this guard that
    // never-cancelled connection leaks: two live sockets end up joined to
    // the same rooms, and every event arrives twice. `cancelled` makes the
    // leaked mount's connection a no-op once its import() resolves.
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null

    import('socket.io-client')
      .then(({ io }) => {
        if (cancelled) return
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        socket = io(`${base}/restaurant`, { withCredentials: true })

        RESTAURANT_EVENTS.forEach((ev) => {
          socket.on(ev, (payload: unknown) => cbRef.current(ev, payload))
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [])
}
