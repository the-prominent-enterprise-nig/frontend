'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2,
  Settings,
  ChefHat,
  ClipboardList,
  CheckCheck,
  X,
  Plus,
} from 'lucide-react'
import {
  getActivePosConfig,
  getTransaction,
  getTransactions,
  addToOrderQueue,
} from '../_actions/pos-actions'
import { QueueTickets, type QueueTicket } from '@/src/libs/data/QueueData'
import type { PosTransactionLine } from '@/src/schema/pos'
import { useQueueSocket } from '@/src/libs/hooks/useQueueSocket'

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  ticket: QueueTicket
  lines: PosTransactionLine[] | null
  loadingLines: boolean
  onToPrepare?: () => Promise<void>
  onServe?: () => Promise<void>
  onErase?: () => Promise<void>
}

function OrderCard({ ticket, lines, loadingLines, onToPrepare, onServe, onErase }: OrderCardProps) {
  const [actioning, setActioning] = useState(false)

  const handle = (fn?: () => Promise<void>) => async () => {
    if (!fn) return
    setActioning(true)
    await fn()
    setActioning(false)
  }

  const total =
    lines?.reduce((sum, l) => sum + Number(l.lineTotal) + Number(l.taxAmount ?? 0), 0) ?? null

  const isWaiting = ticket.status === 'WAITING'
  const isCalled = ticket.status === 'CALLED'

  const borderClass = isWaiting
    ? 'border-gray-200'
    : isCalled
      ? 'border-amber-200'
      : 'border-emerald-200'
  const numBg = isWaiting
    ? 'bg-gray-50 text-gray-700'
    : isCalled
      ? 'bg-amber-50 text-amber-700'
      : 'bg-emerald-50 text-emerald-700'
  const bodyBg = isWaiting
    ? 'border-gray-100 bg-gray-50'
    : isCalled
      ? 'border-amber-100 bg-amber-50/40'
      : 'border-emerald-100 bg-emerald-50/30'
  const qtyColor = isCalled ? 'text-amber-500' : 'text-gray-400'

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-sm ${borderClass}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-black text-base ${numBg}`}
        >
          #{ticket.number}
        </div>
        <div className="flex-1 min-w-0">
          {ticket.customerName && (
            <p className="text-sm font-semibold text-gray-900 truncate">{ticket.customerName}</p>
          )}
          {ticket.salesOrderId && (
            <p className="text-xs font-mono text-gray-400 truncate">{ticket.salesOrderId}</p>
          )}
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatTime(ticket.issuedAt)}
          </p>
        </div>
        {onErase && (
          <button
            onClick={handle(onErase)}
            disabled={actioning}
            className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition disabled:opacity-50"
            title="Remove from board"
          >
            {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Line items */}
      <div className={`border-t px-4 py-2.5 ${bodyBg}`}>
        {loadingLines ? (
          <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading items…
          </div>
        ) : lines && lines.length > 0 ? (
          <div className="space-y-1">
            {lines.map((line, i) => {
              const qty = Number(line.quantity)
              const ti = Number(line.lineTotal) + Number(line.taxAmount ?? 0)
              return (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`font-mono font-bold text-xs shrink-0 ${qtyColor}`}>
                      ×{qty}
                    </span>
                    <span className="text-xs text-gray-700 truncate">{line.itemName}</span>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 font-medium">{fmt(ti)}</span>
                </div>
              )
            })}
            {total !== null && (
              <div className="flex justify-between pt-1.5 mt-0.5 border-t border-gray-200 text-xs font-bold text-gray-800">
                <span>Total</span>
                <span>{fmt(total)}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 py-0.5 italic">No item details</p>
        )}
      </div>

      {/* Action button */}
      {(onToPrepare || onServe) && (
        <div className="px-4 py-2.5 border-t border-gray-100">
          {onToPrepare && (
            <button
              onClick={handle(onToPrepare)}
              disabled={actioning}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition"
            >
              {actioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChefHat className="w-4 h-4" />
              )}
              To Prepare
            </button>
          )}
          {onServe && (
            <button
              onClick={handle(onServe)}
              disabled={actioning}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {actioning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Served
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({
  title,
  icon,
  count,
  headerClass,
  emptyText,
  action,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  headerClass: string
  emptyText: string
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 mb-4 shrink-0 ${headerClass}`}
      >
        {icon}
        <span className="font-bold text-sm">{title}</span>
        <span className="ml-auto rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
          {count}
        </span>
        {action}
      </div>
      <div className="flex-1 overflow-y-auto space-y-3">
        {count === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm italic text-gray-300">
            {emptyText}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PosOrderQueuePage() {
  const [categoryId, setCategoryId] = useState<string | null | undefined>(undefined)
  const [waiting, setWaiting] = useState<QueueTicket[]>([])
  const [preparing, setPreparing] = useState<QueueTicket[]>([])
  const [completed, setCompleted] = useState<QueueTicket[]>([])
  const [txLines, setTxLines] = useState<Record<string, PosTransactionLine[] | null>>({})
  const [loadingTx, setLoadingTx] = useState<Record<string, boolean>>({})
  const [fetching, setFetching] = useState(false)
  const [txInput, setTxInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const fetchedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    getActivePosConfig().then((res) => {
      setCategoryId(res.data?.orderQueueCategoryId ?? null)
    })
  }, [])

  const fetchTxDetails = useCallback(async (tickets: QueueTicket[]) => {
    const toFetch = tickets.filter(
      (t) => t.posTransactionId && !fetchedIds.current.has(t.posTransactionId)
    )
    if (!toFetch.length) return
    toFetch.forEach((t) => {
      if (t.posTransactionId) fetchedIds.current.add(t.posTransactionId)
    })
    setLoadingTx((prev) => {
      const next = { ...prev }
      toFetch.forEach((t) => {
        if (t.posTransactionId) next[t.posTransactionId] = true
      })
      return next
    })
    await Promise.all(
      toFetch.map(async (t) => {
        if (!t.posTransactionId) return
        const res = await getTransaction(t.posTransactionId)
        setTxLines((prev) => ({ ...prev, [t.posTransactionId!]: res.data?.lines ?? null }))
        setLoadingTx((prev) => {
          const n = { ...prev }
          delete n[t.posTransactionId!]
          return n
        })
      })
    )
  }, [])

  const loadTickets = useCallback(
    async (catId: string) => {
      const res = await QueueTickets.list(catId)
      if (res.success && res.data) {
        const w = res.data.filter((t) => t.status === 'WAITING')
        const p = res.data.filter((t) => t.status === 'CALLED')
        const c = res.data
          .filter((t) => t.status === 'SERVED')
          .sort(
            (a, b) =>
              new Date(b.servedAt ?? b.issuedAt).getTime() -
              new Date(a.servedAt ?? a.issuedAt).getTime()
          )
          .slice(0, 20)
        setWaiting(w)
        setPreparing(p)
        setCompleted(c)
        fetchTxDetails([...w, ...p, ...c])
      }
      setFetching(false)
    },
    [fetchTxDetails]
  )

  useEffect(() => {
    if (!categoryId) return
    setFetching(true)
    loadTickets(categoryId)
  }, [categoryId, loadTickets])

  useQueueSocket(() => {
    if (categoryId) loadTickets(categoryId)
  })

  const toPrepare = async (ticket: QueueTicket) => {
    await QueueTickets.call(ticket.id)
    if (categoryId) loadTickets(categoryId)
  }

  const serve = async (ticket: QueueTicket) => {
    await QueueTickets.serve(ticket.id)
    if (categoryId) loadTickets(categoryId)
  }

  const erase = async (ticket: QueueTicket) => {
    await QueueTickets.cancel(ticket.id)
    if (categoryId) loadTickets(categoryId)
  }

  const [clearingAll, setClearingAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const eraseAll = async () => {
    if (completed.length === 0) return
    setClearingAll(true)
    await Promise.all(completed.map((t) => QueueTickets.cancel(t.id)))
    setConfirmClear(false)
    setClearingAll(false)
    if (categoryId) loadTickets(categoryId)
  }

  const getLines = (t: QueueTicket) =>
    t.posTransactionId ? (txLines[t.posTransactionId] ?? null) : null
  const isLoading = (t: QueueTicket) => !!(t.posTransactionId && loadingTx[t.posTransactionId])

  const handleAddToQueue = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    const num = txInput.trim()
    if (!num || !categoryId) return
    setAdding(true)
    setAddError(null)
    const res = await getTransactions({ transactionNumber: num })
    const tx = res.data?.[0]
    if (!tx) {
      setAddError(`No transaction found for "${num}"`)
      setAdding(false)
      return
    }
    const qRes = await addToOrderQueue(tx.id, { categoryId })
    if (!qRes.success) {
      setAddError(qRes.error ?? 'Failed to add to queue')
    } else {
      setTxInput('')
      loadTickets(categoryId)
    }
    setAdding(false)
  }

  if (categoryId === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50">
      {/* Header */}
      <div className="flex-none border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Order Queue</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Live pending orders from completed sales.
            </p>
          </div>
          {categoryId && (
            <div className="flex items-center gap-3">
              <form onSubmit={handleAddToQueue} className="flex items-center gap-2">
                <input
                  type="text"
                  value={txInput}
                  onChange={(e) => {
                    setTxInput(e.target.value)
                    setAddError(null)
                  }}
                  placeholder="Transaction no. e.g. POS-123…"
                  className="w-64 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                />
                <button
                  type="submit"
                  disabled={adding || !txInput.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50 transition"
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </form>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
                Real-time
              </div>
            </div>
          )}
        </div>
        {addError && <p className="mt-2 text-xs text-red-500">{addError}</p>}
      </div>

      {!categoryId ? (
        <div className="flex-1 flex items-center justify-center p-10">
          <div className="bg-white border border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3 text-center max-w-sm w-full">
            <ShoppingBag className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium text-gray-600">No order queue configured</p>
            <p className="text-xs text-gray-400">
              Go to POS Settings → General Configuration and select an Order Queue category.
            </p>
            <Link
              href="/pos/settings"
              className="mt-2 flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
            >
              <Settings className="w-4 h-4" /> Go to POS Settings
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-4 p-6">
          {/* Waiting */}
          <BoardColumn
            title="Waiting"
            icon={<ClipboardList className="w-4 h-4 text-white/80" />}
            count={waiting.length}
            headerClass="bg-slate-600 text-white"
            emptyText="No orders waiting"
          >
            {waiting.map((ticket) => (
              <OrderCard
                key={ticket.id}
                ticket={ticket}
                lines={getLines(ticket)}
                loadingLines={isLoading(ticket)}
                onToPrepare={() => toPrepare(ticket)}
              />
            ))}
          </BoardColumn>

          {/* Preparing */}
          <BoardColumn
            title="Preparing"
            icon={<ChefHat className="w-4 h-4 text-white/80" />}
            count={preparing.length}
            headerClass="bg-amber-500 text-white"
            emptyText="Nothing being prepared"
          >
            {preparing.map((ticket) => (
              <OrderCard
                key={ticket.id}
                ticket={ticket}
                lines={getLines(ticket)}
                loadingLines={isLoading(ticket)}
                onServe={() => serve(ticket)}
              />
            ))}
          </BoardColumn>

          {/* Completed */}
          <BoardColumn
            title="Completed"
            icon={<CheckCheck className="w-4 h-4 text-white/80" />}
            count={completed.length}
            headerClass="bg-emerald-600 text-white"
            emptyText="No completed orders"
            action={
              completed.length > 0 &&
              (confirmClear ? (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={eraseAll}
                    disabled={clearingAll}
                    className="px-2 py-0.5 text-[11px] font-semibold bg-white text-emerald-700 rounded-md hover:bg-emerald-50 disabled:opacity-50"
                  >
                    {clearingAll ? 'Clearing…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-0.5 text-[11px] font-medium bg-white/20 text-white rounded-md hover:bg-white/30"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="ml-1 px-2 py-0.5 text-[11px] font-semibold bg-white/20 text-white rounded-md hover:bg-white/30"
                >
                  Clear All
                </button>
              ))
            }
          >
            {completed.map((ticket) => (
              <OrderCard
                key={ticket.id}
                ticket={ticket}
                lines={getLines(ticket)}
                loadingLines={isLoading(ticket)}
                onErase={() => erase(ticket)}
              />
            ))}
          </BoardColumn>
        </div>
      )}
    </div>
  )
}
