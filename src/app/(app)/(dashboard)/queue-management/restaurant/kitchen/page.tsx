'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, UtensilsCrossed, RefreshCw, Clock } from 'lucide-react'
import {
  RestaurantKitchen,
  type KitchenTicket,
  type KitchenTicketStatus,
} from '@/src/libs/data/RestaurantData'
import { CapabilityGuard } from '../_components/CapabilityGuard'

const POLL_MS = 10_000

const STATUS_CONFIG: Record<
  KitchenTicketStatus,
  { label: string; bg: string; text: string; border: string; headerBg: string }
> = {
  PENDING: {
    label: 'Pending',
    bg: 'bg-yellow-50',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    headerBg: 'bg-yellow-100',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-300',
    headerBg: 'bg-blue-100',
  },
  READY: {
    label: 'Ready',
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-300',
    headerBg: 'bg-green-100',
  },
  DONE: {
    label: 'Done',
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    border: 'border-gray-200',
    headerBg: 'bg-gray-100',
  },
}

function elapsed(firedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(firedAt).getTime()) / 1000)
  const m = Math.floor(diff / 60)
  const s = diff % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

interface TicketCardProps {
  ticket: KitchenTicket
  onStatusChange: (id: string, status: KitchenTicketStatus) => void
  updating: boolean
}

function TicketCard({ ticket, onStatusChange, updating }: TicketCardProps) {
  const cfg = STATUS_CONFIG[ticket.status]
  const [elapsedStr, setElapsedStr] = useState(() => elapsed(ticket.firedAt))

  useEffect(() => {
    const interval = setInterval(() => setElapsedStr(elapsed(ticket.firedAt)), 1000)
    return () => clearInterval(interval)
  }, [ticket.firedAt])

  return (
    <div className={`rounded-2xl border-2 ${cfg.border} ${cfg.bg} flex flex-col overflow-hidden`}>
      <div className={`${cfg.headerBg} px-4 py-3 flex items-start justify-between gap-2`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-base">Table {ticket.tableNumber}</span>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-white/70 ${cfg.text}`}
            >
              {cfg.label}
            </span>
          </div>
          {ticket.courseLabel && (
            <p className="text-xs font-medium text-gray-600 mt-0.5">{ticket.courseLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{elapsedStr}</span>
        </div>
      </div>

      <div className="flex-1 p-4">
        <ul className="space-y-1.5">
          {ticket.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="font-bold text-gray-900 text-sm shrink-0">×{item.quantity}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 leading-tight">{item.name}</p>
                {item.modifiers && (
                  <p className="text-xs text-gray-500 truncate">{item.modifiers}</p>
                )}
                {item.notes && (
                  <p className="text-xs text-amber-700 italic truncate">{item.notes}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-4 pb-4 flex gap-2">
        {ticket.status === 'PENDING' && (
          <button
            onClick={() => onStatusChange(ticket.id, 'IN_PROGRESS')}
            disabled={updating}
            className="flex-1 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Start'}
          </button>
        )}
        {ticket.status === 'IN_PROGRESS' && (
          <button
            onClick={() => onStatusChange(ticket.id, 'READY')}
            disabled={updating}
            className="flex-1 py-2 text-xs font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Ready'}
          </button>
        )}
        {ticket.status === 'READY' && (
          <button
            onClick={() => onStatusChange(ticket.id, 'DONE')}
            disabled={updating}
            className="flex-1 py-2 text-xs font-semibold bg-gray-600 text-white rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Done'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    const res = await RestaurantKitchen.tickets()
    if (res.success && res.data) setTickets(res.data)
    else if (!res.success) setError(res.message ?? res.error ?? 'Failed to load tickets')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null
    try {
      import('socket.io-client')
        .then(({ io }) => {
          const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(
            /\/$/,
            ''
          )
          socket = io(`${base}/restaurant`, { withCredentials: true })
          socket.on('kitchen_ticket_updated', () => {
            load()
          })
        })
        .catch(() => {})
    } catch {}
    return () => {
      if (socket) socket.disconnect()
    }
  }, [load])

  const handleStatusChange = async (id: string, status: KitchenTicketStatus) => {
    setUpdatingId(id)
    const res = await RestaurantKitchen.updateStatus(id, status)
    if (res.success && res.data) {
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status: res.data!.status } : t)))
    }
    setUpdatingId(null)
  }

  const activeTickets = tickets.filter((t) => t.status !== 'DONE')
  const doneTickets = tickets.filter((t) => t.status === 'DONE')

  return (
    <CapabilityGuard capability="kitchenDisplay">
      <div className="min-h-screen bg-gray-100">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-amber-600" />
            <h1 className="font-bold text-gray-900 text-lg">Kitchen Display</h1>
            {activeTickets.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {activeTickets.length} active
              </span>
            )}
          </div>
          <button
            onClick={load}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-5">
          {loading && tickets.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading tickets...
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">{error}</div>
          ) : activeTickets.length === 0 ? (
            <div className="text-center py-20">
              <UtensilsCrossed className="w-14 h-14 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No active tickets. Kitchen is clear.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {activeTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onStatusChange={handleStatusChange}
                    updating={updatingId === ticket.id}
                  />
                ))}
              </div>

              {doneTickets.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Recently Done ({doneTickets.length})
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 opacity-60">
                    {doneTickets.slice(0, 12).map((ticket) => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        onStatusChange={handleStatusChange}
                        updating={updatingId === ticket.id}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </CapabilityGuard>
  )
}
