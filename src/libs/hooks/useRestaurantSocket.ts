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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null

    import('socket.io-client')
      .then(({ io }) => {
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        socket = io(`${base}/restaurant`, { withCredentials: true })

        RESTAURANT_EVENTS.forEach((ev) => {
          socket.on(ev, (payload: unknown) => cbRef.current(ev, payload))
        })
      })
      .catch(() => {})

    return () => {
      if (socket) socket.disconnect()
    }
  }, [])
}
