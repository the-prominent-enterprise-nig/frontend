'use client'

import { useEffect, useRef } from 'react'
import type { ParkedSale } from '@/src/schema/pos'

export interface ParkedSaleCreatedPayload {
  id: string
  terminalId: string
  branchId: string
  label: string
  parkedBy: string
  status: 'parked'
  cartData: Record<string, unknown>
  parkedAt: string
}

export interface ParkedSaleStatusPayload {
  id: string
  terminalId: string
  branchId: string
  status: string
  resumedAt?: string
}

export interface PosSocketCallbacks {
  onParkedSaleCreated?: (payload: ParkedSaleCreatedPayload) => void
  onParkedSaleResumed?: (payload: ParkedSaleStatusPayload) => void
  onParkedSaleCancelled?: (payload: ParkedSaleStatusPayload) => void
}

export function usePosSocket(terminalId: string | undefined, callbacks: PosSocketCallbacks): void {
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  useEffect(() => {
    if (!terminalId) return

    // React 18/19 Strict Mode (Next.js dev server) double-invokes this
    // effect — mount, cleanup, mount again — to catch exactly this kind of
    // bug. Because connecting is async, the FIRST mount's cleanup can fire
    // before `socket` is even assigned, so without this guard that
    // never-cancelled connection leaks: two live sockets end up joined to
    // the same branch room, and every event arrives twice. `cancelled` makes
    // the leaked mount's connection a no-op once its import() resolves.
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null

    import('socket.io-client')
      .then(({ io }) => {
        if (cancelled) return
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        socket = io(`${base}/pos`, { withCredentials: true })

        // Re-emit join on every connect/reconnect — socket ID changes on reconnect
        // so the server-side room membership is lost and must be re-established.
        const join = (): void => socket.emit('join', { terminalId })
        socket.on('connect', join)

        socket.on('parked-sale:created', (payload: ParkedSaleCreatedPayload) => {
          cbRef.current.onParkedSaleCreated?.(payload)
        })

        socket.on('parked-sale:resumed', (payload: ParkedSaleStatusPayload) => {
          cbRef.current.onParkedSaleResumed?.(payload)
        })

        socket.on('parked-sale:cancelled', (payload: ParkedSaleStatusPayload) => {
          cbRef.current.onParkedSaleCancelled?.(payload)
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (socket) socket.disconnect()
    }
  }, [terminalId])
}

export function toParkedSale(payload: ParkedSaleCreatedPayload): ParkedSale {
  return {
    id: payload.id,
    terminalId: payload.terminalId,
    label: payload.label,
    cartData: payload.cartData,
    parkedBy: payload.parkedBy,
    parkedAt: payload.parkedAt,
    status: payload.status,
    createdAt: payload.parkedAt,
  }
}
