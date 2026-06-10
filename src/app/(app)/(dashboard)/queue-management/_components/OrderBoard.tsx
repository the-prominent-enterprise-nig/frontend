'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Maximize2, RefreshCw, ChefHat, CheckCheck } from 'lucide-react'
import { QueueCategories, QueueTickets, type QueueTicket } from '@/src/libs/data/QueueData'
import { getTransaction } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import type { PosTransactionLine } from '@/src/schema/pos'
import { useQueueSocket } from '@/src/libs/hooks/useQueueSocket'

type DisplayTicket = {
  id: string
  number: number
  customerName?: string | null
  categoryName: string
  salesOrderId?: string | null
  posTransactionId?: string | null
  issuedAt?: string | null
  calledAt?: string | null
  lines?: PosTransactionLine[] | null
}

function elapsed(iso?: string | null) {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  return `${mins}m ago`
}

function TicketCard({
  ticket,
  variant,
}: {
  ticket: DisplayTicket
  variant: 'slate' | 'amber' | 'green'
}) {
  const c = {
    slate: {
      card: 'bg-slate-800/60 border-slate-700/50',
      num: 'text-slate-200',
      badge: 'bg-slate-700/60 text-slate-400',
      name: 'text-slate-300/80',
      meta: 'text-slate-500',
    },
    amber: {
      card: 'bg-amber-950/70 border-amber-700/60 shadow-amber-900/20 shadow-md',
      num: 'text-amber-200',
      badge: 'bg-amber-800/50 text-amber-400',
      name: 'text-amber-100/80',
      meta: 'text-amber-600',
    },
    green: {
      card: 'bg-emerald-950/50 border-emerald-800/40 opacity-70',
      num: 'text-emerald-400',
      badge: 'bg-emerald-900/50 text-emerald-600',
      name: 'text-emerald-500/70',
      meta: 'text-emerald-700',
    },
  }[variant]

  const timeLabel = elapsed(variant === 'slate' ? ticket.issuedAt : ticket.calledAt)

  return (
    <div className={`rounded-xl border px-4 py-3 transition-all ${c.card}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-3xl font-black tabular-nums leading-none ${c.num}`}>
          #{String(ticket.number).padStart(3, '0')}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.badge}`}
        >
          {ticket.categoryName}
        </span>
      </div>
      {ticket.customerName && (
        <p className={`mt-1.5 text-sm font-medium truncate ${c.name}`}>{ticket.customerName}</p>
      )}

      {ticket.lines && ticket.lines.length > 0 && (
        <ul className={`mt-2 space-y-0.5 border-t border-white/10 pt-2 text-xs ${c.meta}`}>
          {ticket.lines.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className={`font-mono font-bold shrink-0 ${c.badge.split(' ')[1]}`}>
                ×{Number(l.quantity)}
              </span>
              <span className="flex-1 truncate text-white/70">{l.itemName}</span>
            </li>
          ))}
        </ul>
      )}

      <div className={`mt-1.5 flex items-center gap-1.5 text-xs ${c.meta}`}>
        {ticket.salesOrderId && <span>{ticket.salesOrderId}</span>}
        {ticket.salesOrderId && timeLabel && <span>·</span>}
        {timeLabel && <span>{timeLabel}</span>}
      </div>
    </div>
  )
}

function Column({
  title,
  subtitle,
  icon,
  tickets,
  variant,
  headerBg,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  tickets: DisplayTicket[]
  variant: 'slate' | 'amber' | 'green'
  headerBg: string
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className={`flex-none border-b border-white/10 px-5 py-4 ${headerBg}`}>
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <p className="text-base font-bold tracking-wide">{title}</p>
            <p className="text-xs opacity-50">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {tickets.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm italic text-white/20">
            No orders
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} variant={variant} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrderBoard() {
  const [preparing, setPreparing] = useState<DisplayTicket[]>([])
  const [completed, setCompleted] = useState<DisplayTicket[]>([])
  const [spinning, setSpinning] = useState(false)
  const [now, setNow] = useState(new Date())
  const fetchedTxIds = useRef<Set<string>>(new Set())
  const lineCache = useRef<Map<string, PosTransactionLine[]>>(new Map())

  const load = useCallback(async () => {
    setSpinning(true)
    const catsRes = await QueueCategories.list()
    const categories = catsRes.data ?? []

    if (categories.length === 0) {
      setSpinning(false)
      return
    }

    const results = await Promise.all(categories.map((c) => QueueTickets.list(c.id)))

    const w: DisplayTicket[] = []
    const p: DisplayTicket[] = []
    const c: DisplayTicket[] = []

    categories.forEach((cat, i) => {
      const tickets: QueueTicket[] = results[i].data ?? []
      tickets.forEach((t) => {
        const row: DisplayTicket = {
          id: t.id,
          number: t.number,
          customerName: t.customerName,
          categoryName: cat.name,
          salesOrderId: t.salesOrderId,
          posTransactionId: t.posTransactionId,
          issuedAt: t.issuedAt,
          calledAt: t.calledAt,
        }
        if (t.status === 'WAITING') w.push(row)
        else if (t.status === 'CALLED') p.push(row)
        else if (t.status === 'SERVED') c.push(row)
      })
    })

    w.sort((a, b) => a.number - b.number)
    p.sort((a, b) => a.number - b.number)
    c.sort((a, b) => new Date(b.calledAt ?? 0).getTime() - new Date(a.calledAt ?? 0).getTime())

    const all = [...w, ...p, ...c.slice(0, 12)]

    // Fetch lines only for IDs not yet fetched; persist results in lineCache across polls
    const toFetch = all.filter(
      (t) => t.posTransactionId && !fetchedTxIds.current.has(t.posTransactionId)
    )
    toFetch.forEach((t) => {
      if (t.posTransactionId) fetchedTxIds.current.add(t.posTransactionId)
    })
    await Promise.all(
      toFetch.map(async (t) => {
        if (!t.posTransactionId) return
        const res = await getTransaction(t.posTransactionId)
        if (res.success && res.data?.lines)
          lineCache.current.set(t.posTransactionId, res.data.lines)
      })
    )

    const attach = (rows: DisplayTicket[]) =>
      rows.map((r) => ({
        ...r,
        lines: r.posTransactionId ? (lineCache.current.get(r.posTransactionId) ?? null) : null,
      }))

    setPreparing(attach(p))
    setCompleted(attach(c.slice(0, 12)))
    setSpinning(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useQueueSocket(load)

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000)
    const onVisibility = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(clock)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  const dp = preparing
  const dc = completed

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950 text-white">
      {/* Header */}
      <div className="flex-none border-b border-white/10 bg-black/50 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/queue-management"
              className="rounded-lg bg-white/5 p-2 hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Order Board</h1>
              <p className="text-xs text-gray-500">Live · real-time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-gray-300">
              {now.toLocaleTimeString('en-PH', { hour12: false })}
            </span>
            <button
              onClick={load}
              className="rounded-lg bg-white/5 p-2 hover:bg-white/10 transition"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-lg bg-white/5 p-2 hover:bg-white/10 transition"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2-column board */}
      <div className="min-h-0 flex-1 grid grid-cols-2 divide-x divide-white/10">
        {/* Column 1 — Preparing (CALLED by cashier) */}
        <Column
          title="Preparing"
          subtitle={`${dp.length} order${dp.length !== 1 ? 's' : ''} in progress`}
          icon={<ChefHat className="h-5 w-5 text-amber-400" />}
          tickets={dp}
          variant="amber"
          headerBg="bg-amber-950/50"
        />

        {/* Column 3 — Completed (SERVED) */}
        <Column
          title="Serving"
          subtitle="Recently served"
          icon={<CheckCheck className="h-5 w-5 text-emerald-500" />}
          tickets={dc}
          variant="green"
          headerBg="bg-emerald-950/40"
        />
      </div>

      {/* Footer */}
      <div className="flex-none border-t border-white/10 bg-black/40 px-5 py-1.5 text-center text-xs text-gray-600">
        Press &quot;Next&quot; on the queue dashboard to move an order to Preparing · Press
        &quot;Completed&quot; to finish
      </div>
    </div>
  )
}
