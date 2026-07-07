'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { getActivePosConfig, getTransactions, addToOrderQueue } from '../_actions/pos-actions'
import { KdsApi, type KdsOrder, type KdsLine } from '@/src/libs/data/KdsData'
import { useQueueSocket } from '@/src/libs/hooks/useQueueSocket'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
}

// ─── Order Card ───────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: KdsOrder
  onToPrepare?: () => Promise<void>
  onServe?: () => Promise<void>
  onErase?: () => Promise<void>
}

function OrderCard({ order, onToPrepare, onServe, onErase }: OrderCardProps) {
  const [actioning, setActioning] = useState(false)

  const handle = (fn?: () => Promise<void>) => async () => {
    if (!fn) return
    setActioning(true)
    await fn()
    setActioning(false)
  }

  const lines: KdsLine[] = order.transaction?.lines ?? []
  const total = order.transaction ? Number(order.transaction.totalAmount) : null

  const isWaiting = order.status === 'WAITING'
  const isCalled = order.status === 'CALLED'

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
          #{order.number}
        </div>
        <div className="flex-1 min-w-0">
          {order.customerName && (
            <p className="text-sm font-semibold text-gray-900 truncate">{order.customerName}</p>
          )}
          {order.salesOrderId && (
            <p className="text-xs font-mono text-gray-400 truncate">{order.salesOrderId}</p>
          )}
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatTime(order.issuedAt)}
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
        {lines.length > 0 ? (
          <div className="space-y-1">
            {lines.map((line) => {
              const qty = Number(line.quantity)
              const ti = Number(line.lineTotal)
              return (
                <div key={line.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`font-mono font-bold text-xs shrink-0 ${qtyColor}`}>
                      ×{qty}
                    </span>
                    <span className="text-xs text-gray-700 truncate">
                      {line.itemName ?? line.itemId}
                    </span>
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

// ─── Order Card Skeleton ────────────────────────────────────────────────────

function OrderCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="w-11 h-11 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 space-y-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
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
  loading,
  children,
}: {
  title: string
  icon: React.ReactNode
  count: number
  headerClass: string
  emptyText: string
  action?: React.ReactNode
  loading?: boolean
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
        {loading ? (
          <>
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </>
        ) : count === 0 ? (
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
  const [waiting, setWaiting] = useState<KdsOrder[]>([])
  const [preparing, setPreparing] = useState<KdsOrder[]>([])
  const [completed, setCompleted] = useState<KdsOrder[]>([])
  const [fetching, setFetching] = useState(false)
  const [txInput, setTxInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    getActivePosConfig().then((res) => {
      setCategoryId(res.data?.orderQueueCategoryId ?? null)
    })
  }, [])

  const { branchId } = usePosBranchContext()

  const loadOrders = useCallback(
    async (catId: string) => {
      const res = await KdsApi.listOrders({
        categoryId: catId,
        ...(branchId ? { branchId } : {}),
        statuses: ['WAITING', 'CALLED', 'SERVED'],
      })
      if (res.success && res.data) {
        const orders = res.data.data
        setWaiting(orders.filter((o) => o.status === 'WAITING'))
        setPreparing(orders.filter((o) => o.status === 'CALLED'))
        setCompleted(
          orders
            .filter((o) => o.status === 'SERVED')
            .sort(
              (a, b) =>
                new Date(b.servedAt ?? b.issuedAt).getTime() -
                new Date(a.servedAt ?? a.issuedAt).getTime()
            )
            .slice(0, 20)
        )
      }
      setFetching(false)
    },
    [branchId]
  )

  useEffect(() => {
    if (!categoryId) return
    setFetching(true)
    loadOrders(categoryId)
  }, [categoryId, loadOrders])

  useQueueSocket(() => {
    if (categoryId) loadOrders(categoryId)
  })

  const toPrepare = async (order: KdsOrder) => {
    await KdsApi.callOrder(order.id)
    if (categoryId) loadOrders(categoryId)
  }

  const serve = async (order: KdsOrder) => {
    await KdsApi.serveOrder(order.id)
    if (categoryId) loadOrders(categoryId)
  }

  const erase = async (order: KdsOrder) => {
    await KdsApi.cancelOrder(order.id)
    if (categoryId) loadOrders(categoryId)
  }

  const [clearingAll, setClearingAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const eraseAll = async () => {
    if (completed.length === 0) return
    setClearingAll(true)
    await Promise.all(completed.map((o) => KdsApi.cancelOrder(o.id)))
    setConfirmClear(false)
    setClearingAll(false)
    if (categoryId) loadOrders(categoryId)
  }

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
      loadOrders(categoryId)
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
            {waiting.map((order) => (
              <OrderCard key={order.id} order={order} onToPrepare={() => toPrepare(order)} />
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
            {preparing.map((order) => (
              <OrderCard key={order.id} order={order} onServe={() => serve(order)} />
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
            {completed.map((order) => (
              <OrderCard key={order.id} order={order} onErase={() => erase(order)} />
            ))}
          </BoardColumn>
        </div>
      )}
    </div>
  )
}
