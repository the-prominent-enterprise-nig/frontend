'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  ShoppingCart,
  MoreHorizontal,
  Clock,
  Loader2,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
} from 'lucide-react'
import type { SalesOrder } from '@/src/libs/actions/sales.actions'
import { updateOrderStatus } from '@/src/libs/actions/sales.actions'
import CreateSalesOrderModal from './CreateSalesOrderModal'

type OrderStatus = SalesOrder['status']

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  confirmed: 'bg-blue-100 text-blue-700',
  processing: 'bg-amber-100 text-amber-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  processing: 'Processing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const ALL_STATUSES: OrderStatus[] = ['draft', 'confirmed', 'processing', 'delivered', 'cancelled']

// ─── Action menu ─────────────────────────────────────────────────────────────

type StatusAction = { label: string; status: OrderStatus; icon: React.ReactNode }

function getStatusActions(current: OrderStatus): StatusAction[] {
  switch (current) {
    case 'draft':
      return [
        {
          label: 'Confirm Order',
          status: 'confirmed',
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
        },
        {
          label: 'Cancel Order',
          status: 'cancelled',
          icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
        },
      ]
    case 'confirmed':
      return [
        {
          label: 'Mark as Processing',
          status: 'processing',
          icon: <Truck className="h-3.5 w-3.5 text-amber-500" />,
        },
        {
          label: 'Cancel Order',
          status: 'cancelled',
          icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
        },
      ]
    case 'processing':
      return [
        {
          label: 'Mark as Delivered',
          status: 'delivered',
          icon: <PackageCheck className="h-3.5 w-3.5 text-emerald-500" />,
        },
        {
          label: 'Cancel Order',
          status: 'cancelled',
          icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
        },
      ]
    default:
      return []
  }
}

function OrderMenu({
  order,
  busy,
  onStatusChange,
}: {
  order: SalesOrder
  busy: boolean
  onStatusChange: (id: string, status: OrderStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const actions = getStatusActions(order.status)
  if (actions.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        disabled={busy}
        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 transition disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {actions.map((a) => (
            <button
              key={a.status}
              onClick={() => {
                setOpen(false)
                onStatusChange(order.id, a.status)
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {a.icon}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  initialData: SalesOrder[]
  initialTotal: number
}

export default function OrdersClient({ initialData, initialTotal }: Props) {
  const [orders, setOrders] = useState<SalesOrder[]>(initialData)
  const [total, setTotal] = useState(initialTotal)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const openCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length

  function handleCreated(newOrder: SalesOrder) {
    setOrders((prev) => [newOrder, ...prev])
    setTotal((t) => t + 1)
    setModalOpen(false)
  }

  const handleStatusChange = useCallback(async (orderId: string, status: OrderStatus) => {
    setBusyId(orderId)
    setActionError(null)
    const result = await updateOrderStatus(orderId, status)
    setBusyId(null)
    if (result.success && result.data) {
      const updated = result.data
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)))
    } else {
      setActionError(result.error ?? 'Failed to update order status')
    }
  }, [])

  function formatAmount(amount: string, currency: string) {
    const num = parseFloat(amount)
    if (isNaN(num)) return `${currency} 0.00`
    return `${currency} ${num.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Orders</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {openCount} open order{openCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-purple-400"
              />
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-prominent-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Order
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {(['all', ...ALL_STATUSES] as const).map((s) => {
            const count = s === 'all' ? orders.length : orders.filter((o) => o.status === s).length
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === s ? 'bg-prominent-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
                <span
                  className={`rounded-full px-1.5 text-[10px] font-semibold ${statusFilter === s ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart className="mx-auto h-10 w-10 text-gray-200" />
              <p className="mt-3 text-sm font-medium text-gray-500">No orders found</p>
              <p className="mt-1 text-xs text-gray-400">
                {orders.length === 0
                  ? 'Create your first sales order to get started.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Order #',
                    'Customer',
                    'Order Date',
                    'Expected Delivery',
                    'Total',
                    'Status',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((o) => (
                  <tr key={o.id} className="transition hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-gray-300" />
                        <span className="text-sm font-semibold text-purple-700">
                          {o.orderNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {o.customerName}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(o.orderDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3 text-gray-300" />
                        {formatDate(o.expectedDelivery)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {formatAmount(o.totalAmount, o.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[o.status]}`}
                      >
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <OrderMenu
                        order={o}
                        busy={busyId === o.id}
                        onStatusChange={handleStatusChange}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateSalesOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleCreated}
      />
    </div>
  )
}
