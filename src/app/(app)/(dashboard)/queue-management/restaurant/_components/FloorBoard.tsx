'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  Plus,
  Users,
  Clock,
  ChevronRight,
  X,
  Check,
  Loader2,
  UtensilsCrossed,
  CreditCard,
  ShoppingCart,
  List,
  PhoneCall,
  ShoppingBag,
  CheckCircle2,
  Trash2,
  Settings,
  Plug,
  QrCode,
  Merge,
  Split,
} from 'lucide-react'
import {
  RestaurantTables,
  RestaurantTabs,
  RestaurantFloor,
  RestaurantWaitlist,
  RestaurantConfigAPI,
  type FloorBoardTable,
  type RestaurantTable,
  type RestaurantTab,
  type TableStatus,
  type TabLine,
  type WaitlistParty,
  TABLE_STATUS_LABELS,
  TABLE_STATUS_COLORS,
  type AddTabLineInput,
} from '@/src/libs/data/RestaurantData'
import {
  itemLookup,
  getActivePosConfig,
  getTransaction,
  getDefaultAccountingTaxRate,
} from '../../../pos/_actions/pos-actions'
import {
  QueueTickets,
  QueueCategories,
  type QueueTicket,
  type QueueCategory,
} from '@/src/libs/data/QueueData'
import type { PosTransactionLine } from '@/src/schema/pos'

export const POS_FROM_TAB_KEY = 'pos_from_tab'

const POLL_MS = 20_000

// ─── Add Item Modal ───────────────────────────────────────────────────────────

interface AddItemModalProps {
  tab: RestaurantTab
  onClose: () => void
  onAdded: () => void
}

function AddItemModal({ tab, onClose, onAdded }: AddItemModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<
    Array<{ id: string; name: string; sku?: string; price: number; taxRate: number | null }>
  >([])
  const [searching, setSearching] = useState(false)
  const [qty, setQty] = useState(1)
  const [selected, setSelected] = useState<{
    id: string
    name: string
    sku?: string
    price: number
    taxRate: number | null
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      setSearching(true)
      const res = await itemLookup(query)
      setResults(
        ((res.data ?? []) as Record<string, unknown>[]).map((item) => ({
          id: item.id as string,
          name: item.name as string,
          sku: item.sku as string | undefined,
          price: Number(item.price ?? 0),
          taxRate: item.taxRate != null ? Number(item.taxRate) : null,
        }))
      )
      setSearching(false)
    }, 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query])

  const add = async () => {
    if (!selected) return
    setAdding(true)
    setError('')
    const payload: AddTabLineInput = {
      itemId: selected.id,
      itemName: selected.name,
      sku: selected.sku,
      quantity: qty,
      unitPrice: selected.price,
      notes: notes || undefined,
    }
    const res = await RestaurantTabs.addLine(tab.id, payload)
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to add item')
      setAdding(false)
      return
    }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Add Item to Tab — {tab.tableName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search item</label>
            <div className="relative">
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelected(null)
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg pr-8"
                placeholder="Item name or SKU..."
              />
              {searching && (
                <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            {results.length > 0 && !selected && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-40 overflow-y-auto divide-y divide-gray-100">
                {results.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelected(r)
                      setQuery(r.name)
                      setResults([])
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between"
                  >
                    <span>{r.name}</span>
                    <span className="text-gray-500 font-mono text-xs">₱{r.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600">Qty</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-mono">{qty}</span>
                  <button
                    onClick={() => setQty((q) => q + 1)}
                    className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
                <span className="ml-auto text-sm font-semibold text-gray-900">
                  ₱{(selected.price * qty).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Notes / modifiers
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  placeholder="No onion, extra sauce..."
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={add}
            disabled={!selected || adding}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {adding ? 'Adding...' : 'Add to Tab'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Tab Panel ────────────────────────────────────────────────────────────────

interface TabPanelProps {
  table: RestaurantTable
  tab: RestaurantTab | null
  taxRate: number | null
  onClose: () => void
  onRefresh: () => void
}

function TabPanel({ table, tab, taxRate, onClose, onRefresh }: TabPanelProps) {
  const router = useRouter()
  const [showAddItem, setShowAddItem] = useState(false)
  const [opening, setOpening] = useState(false)
  const [closing, setClosing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

  const openTab = async () => {
    setOpening(true)
    setError('')
    const res = await RestaurantTabs.open(table.id, { partyName: table.partyName ?? undefined })
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to open tab')
      setOpening(false)
      return
    }
    onRefresh()
    setOpening(false)
  }

  const removeItem = async (line: TabLine) => {
    if (!tab) return
    setRemovingId(line.id)
    await RestaurantTabs.removeLine(tab.id, line.id)
    onRefresh()
    setRemovingId(null)
  }

  const closeTab = async () => {
    if (!tab) return
    setClosing(true)
    setError('')
    const res = await RestaurantTabs.close(tab.id)
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to close tab')
      setClosing(false)
      return
    }
    const result = res.data
    if (result) {
      const cartLines = result.lines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        sku: l.sku ?? undefined,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        taxRate: null,
      }))
      localStorage.setItem('pos_resumed_cart', JSON.stringify({ lines: cartLines }))
      localStorage.setItem(
        POS_FROM_TAB_KEY,
        JSON.stringify({
          tabId: tab.id,
          posTransactionId: result.posTransactionId,
          tableId: result.tableId,
          tableName: tab.tableName,
        })
      )
    }
    router.push('/pos/checkout')
  }

  const clearTable = async () => {
    setClearing(true)
    setError('')
    const res = await RestaurantTables.clearTable(table.id)
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to clear table')
      setClearing(false)
      return
    }
    onClose()
    // floor_board_updated WebSocket event from the backend triggers load() automatically
  }

  const deleteTable = async () => {
    setDeleting(true)
    setError('')
    const res = await RestaurantTables.remove(table.id)
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to delete table')
      setDeleting(false)
      return
    }
    onClose()
    // floor_board_updated WebSocket event from the backend triggers load() automatically
  }

  const applyTax = (price: number) => (taxRate != null ? price * (1 + taxRate / 100) : price)
  const lines = tab?.lines ?? []
  const subtotal = lines.reduce((sum, l) => sum + applyTax(l.unitPrice) * l.quantity, 0)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white w-full sm:max-w-md sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <div>
              <h3 className="font-semibold text-gray-900">Table {table.number}</h3>
              {table.partyName && <p className="text-xs text-gray-500">{table.partyName}</p>}
            </div>
            <div className="flex items-center gap-2">
              {tab && tab.status === 'open' && (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              )}
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {!tab ? (
              <div className="text-center py-8">
                <UtensilsCrossed className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-4">No open tab for this table.</p>
                <button
                  onClick={openTab}
                  disabled={opening}
                  className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {opening ? 'Opening...' : 'Open Tab'}
                </button>
              </div>
            ) : (
              <>
                {lines.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Tab is open — no items yet.
                  </p>
                ) : (
                  <div className="space-y-1 mb-4">
                    {lines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-start gap-3 py-2 border-b border-gray-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {line.itemName}
                          </p>
                          {line.notes && <p className="text-xs text-gray-400">{line.notes}</p>}
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">×{line.quantity}</span>
                        <span className="text-sm font-mono text-gray-700 shrink-0">
                          {fmt(applyTax(line.unitPrice) * line.quantity)}
                        </span>
                        <button
                          onClick={() => removeItem(line)}
                          disabled={removingId === line.id}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0 disabled:opacity-40"
                        >
                          {removingId === line.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <X className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-between text-sm font-semibold text-gray-900 pt-2">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
              </>
            )}

            {error && <p className="mt-3 text-xs text-red-600 bg-red-50 rounded p-2">{error}</p>}
          </div>

          {tab && tab.status === 'open' && (
            <div className="shrink-0 border-t border-gray-100 px-5 py-4">
              <button
                onClick={closeTab}
                disabled={closing || lines.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {closing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                {closing ? 'Sending to POS...' : 'Close Tab → POS'}
              </button>
              <p className="text-xs text-center text-gray-400 mt-1.5">
                Opens POS checkout with this order pre-loaded
              </p>
            </div>
          )}

          {/* Split Table — only for combined tables */}
          {(table as any).combinedTables?.length > 0 && (
            <div className="shrink-0 px-5 pb-2">
              <button
                onClick={async () => {
                  await RestaurantTables.split(table.id)
                  onClose()
                  onRefresh()
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50"
              >
                <Split className="w-3.5 h-3.5" /> Split Combined Tables
              </button>
            </div>
          )}

          {/* Clear Table — only when there's a tab or the table is occupied */}
          {(tab || table.status?.toLowerCase() !== 'open') && (
            <div className="shrink-0 px-5 pb-4">
              {showClearConfirm ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-red-700 mb-2">
                    {lines.length > 0
                      ? 'This will void the open tab and clear the table.'
                      : 'Mark this table as available for the next party?'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={clearTable}
                      disabled={clearing}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {clearing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      ) : (
                        'Yes, Clear Table'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear Table
                </button>
              )}

              {/* Delete table — permanent removal */}
              {showDeleteConfirm ? (
                <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">
                    Permanently remove Table {table.number} from the floor plan?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteTable}
                      disabled={deleting}
                      className="flex-1 px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
                    >
                      {deleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      ) : (
                        'Delete Table'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 py-1"
                >
                  Delete this table
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddItem && tab && (
        <AddItemModal tab={tab} onClose={() => setShowAddItem(false)} onAdded={onRefresh} />
      )}
    </>
  )
}

// ─── Table Card ───────────────────────────────────────────────────────────────

const QUEUE_PALETTE = [
  { bg: 'bg-purple-500', label: 'bg-purple-100 text-purple-700' },
  { bg: 'bg-blue-500', label: 'bg-blue-100 text-blue-700' },
  { bg: 'bg-rose-500', label: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-amber-500', label: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-teal-500', label: 'bg-teal-100 text-teal-700' },
  { bg: 'bg-indigo-500', label: 'bg-indigo-100 text-indigo-700' },
  { bg: 'bg-pink-500', label: 'bg-pink-100 text-pink-700' },
  { bg: 'bg-cyan-500', label: 'bg-cyan-100 text-cyan-700' },
]

interface TableCardProps {
  table: FloorBoardTable
  onClick: () => void
  isDragActive?: boolean
  isDropTarget?: boolean
  tabLines?: TabLine[]
  pendingTickets?: number
  queueLabels?: Array<{ name: string; colorIdx: number }>
}

function TableCard({
  table,
  onClick,
  isDragActive,
  isDropTarget,
  tabLines,
  pendingTickets,
  queueLabels,
}: TableCardProps) {
  const normalizedStatus = (table.status?.toLowerCase() ?? 'open') as TableStatus
  const colors = TABLE_STATUS_COLORS[normalizedStatus] ?? TABLE_STATUS_COLORS['open']
  const label = TABLE_STATUS_LABELS[normalizedStatus] ?? table.status

  const hasLines = tabLines && tabLines.length > 0
  const total = hasLines
    ? tabLines.reduce((s, l) => s + Number(l.quantity) * Number(l.unitPrice), 0)
    : null
  const SHOW_MAX = 4

  const combinedTables = (table as any).combinedTables as
    | {
        id: string
        number: string
        seats: number
        partyName?: string | null
        activeTabId?: string | null
      }[]
    | undefined
  const isCombined = combinedTables && combinedTables.length > 0
  const totalSeats = isCombined
    ? table.seats + combinedTables.reduce((s, t) => s + t.seats, 0)
    : table.seats

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl border-2 p-3 text-left transition-all w-full ${
        isDropTarget
          ? 'scale-[1.06] ring-2 ring-amber-400 ring-offset-2 shadow-xl border-amber-400 bg-amber-50'
          : isDragActive
            ? 'opacity-50 hover:opacity-80 hover:scale-[1.02]'
            : 'hover:scale-[1.02] hover:shadow-md'
      } ${isDropTarget ? '' : `${colors.bg} ${colors.border}`} focus:outline-none`}
    >
      {/* ── header ── */}
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <span className="text-base font-bold text-gray-900">T{table.number}</span>
          {isCombined && (
            <span className="text-[10px] text-blue-600 font-medium ml-1">
              +{combinedTables.map((t) => `T${t.number}`).join('+')}
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/70 ${colors.text}`}
        >
          {label}
        </span>
      </div>

      <div className="flex items-center gap-1 text-[11px] text-gray-500">
        <Users
          className={`w-3 h-3 ${table.partySize && table.partySize > totalSeats ? 'text-red-500' : ''}`}
        />
        <span
          className={
            table.partySize && table.partySize > totalSeats ? 'text-red-600 font-semibold' : ''
          }
        >
          {table.partySize ?? totalSeats}
        </span>
        {table.partySize && table.partySize !== totalSeats && (
          <span className="text-gray-300">/{totalSeats}</span>
        )}
        {table.partySize && table.partySize > totalSeats && (
          <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1 rounded">OVER</span>
        )}
        {table.section && <span className="text-gray-400">· {table.section}</span>}
      </div>

      {(() => {
        const names = [
          table.partyName,
          ...(combinedTables?.map((ct) => ct.partyName).filter(Boolean) ?? []),
        ].filter(Boolean) as string[]
        return names.length > 0 ? (
          <p className="text-[11px] font-medium text-gray-700 truncate mt-0.5">
            {names.join(', ')}
          </p>
        ) : null
      })()}

      {table.seatedAt && !hasLines && (
        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
          <Clock className="w-3 h-3" />
          <span>
            {new Date(table.seatedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      )}

      {table.upcomingBooking && !hasLines && (
        <p className="text-[11px] text-violet-600 truncate mt-0.5">
          {table.upcomingBooking.guestName} @ {table.upcomingBooking.time}
        </p>
      )}

      {/* ── order items ─────────────────────────────────────────────── */}
      {hasLines ? (
        <div className="mt-2 pt-2 border-t border-current/20">
          <ul className="space-y-0.5">
            {tabLines.slice(0, SHOW_MAX).map((line) => {
              const lineTotal = Number(line.quantity) * Number(line.unitPrice)
              return (
                <li key={line.id} className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold text-amber-700 shrink-0 font-mono">
                    ×{Number(line.quantity)}
                  </span>
                  <span className="text-[11px] text-gray-800 truncate flex-1 leading-tight min-w-0">
                    {line.itemName}
                  </span>
                  <span className="text-[10px] font-mono text-gray-600 shrink-0">
                    ₱
                    {lineTotal.toLocaleString('en-PH', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </li>
              )
            })}
            {tabLines.length > SHOW_MAX && (
              <li className="text-[10px] text-gray-400 pl-4">+{tabLines.length - SHOW_MAX} more</li>
            )}
          </ul>
          <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-current/10">
            <span className="text-[10px] text-gray-500">
              {tabLines.reduce((s, l) => s + Number(l.quantity), 0)} items
            </span>
            <span className="text-[11px] font-bold text-gray-900">
              ₱
              {total!.toLocaleString('en-PH', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>
      ) : table.activeTab ? (
        /* server summary when tab exists but lines not loaded yet */
        <div className="mt-1.5 pt-1.5 border-t border-current/20 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">{table.activeTab.itemCount} items</span>
          <span className="text-[11px] font-bold text-amber-700">
            ₱
            {Number(table.activeTab.subtotal).toLocaleString('en-PH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      ) : table.activeTabId ? (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400"
          title="Open tab"
        />
      ) : null}

      {!!pendingTickets && (
        <span className="absolute -top-1.5 -right-1.5 z-10 min-w-[18px] h-[18px] bg-amber-500 text-white text-[9px] font-black px-1 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white">
          {pendingTickets}
        </span>
      )}
    </button>
  )
}

// ─── Add Table Modal ──────────────────────────────────────────────────────────

interface AddTableModalProps {
  onClose: () => void
  onCreated: (table: RestaurantTable) => void
}

function AddTableModal({ onClose, onCreated }: AddTableModalProps) {
  const [number, setNumber] = useState('')
  const [section, setSection] = useState('')
  const [seats, setSeats] = useState('4')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!number.trim()) {
      setError('Table number is required')
      return
    }
    setSaving(true)
    const res = await RestaurantTables.create({
      number: number.trim(),
      section: section.trim() || undefined,
      seats: parseInt(seats, 10) || 4,
    })
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to create table')
      setSaving(false)
      return
    }
    onCreated(res.data!)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={create} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Add Table</h3>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Table number *</span>
            <input
              autoFocus
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="1, 2A, Bar-1..."
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Section</span>
            <input
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="Main, Patio, Bar..."
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Seats</span>
            <input
              type="number"
              min={1}
              max={20}
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Table'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Status Picker ────────────────────────────────────────────────────────────

const STATUS_FLOW: TableStatus[] = [
  'open',
  'reserved',
  'seated',
  'ordering',
  'entree',
  'check_dropped',
  'needs_bussing',
]

interface StatusPickerProps {
  table: RestaurantTable
  onClose: () => void
  onChanged: () => void
}

function StatusPicker({ table, onClose, onChanged }: StatusPickerProps) {
  const [saving, setSaving] = useState(false)

  const pick = async (status: TableStatus) => {
    setSaving(true)
    await RestaurantTables.updateStatus(table.id, status)
    onChanged()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-gray-900 mb-3">Set Status — Table {table.number}</h3>
        <div className="space-y-1">
          {STATUS_FLOW.map((s) => {
            const c = TABLE_STATUS_COLORS[s]
            const active = (table.status?.toLowerCase() ?? 'open') === s
            return (
              <button
                key={s}
                onClick={() => pick(s)}
                disabled={saving || active}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? `${c.bg} ${c.text} ${c.border} border` : 'hover:bg-gray-50 text-gray-700'} disabled:cursor-not-allowed`}
              >
                {TABLE_STATUS_LABELS[s]}
                {active && <Check className="w-4 h-4" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Add Waitlist Party Modal ─────────────────────────────────────────────────

interface AddWaitlistModalProps {
  onClose: () => void
  onAdded: () => void
}

function AddWaitlistModal({ onClose, onAdded }: AddWaitlistModalProps) {
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSaving(true)
    const res = await RestaurantWaitlist.add({
      name: name.trim(),
      size: Math.max(1, parseInt(partySize, 10) || 1),
      phone: phone.trim() || undefined,
    })
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to add party')
      setSaving(false)
      return
    }
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Add to Waitlist</h3>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Name *</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="Guest name..."
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Party size</span>
            <input
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="09XX XXX XXXX"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Party'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Seat Party Modal ─────────────────────────────────────────────────────────

interface SeatPartyModalProps {
  party: WaitlistParty
  tables: FloorBoardTable[]
  onClose: () => void
  onSeated: () => void
}

function SeatPartyModal({ party, tables, onClose, onSeated }: SeatPartyModalProps) {
  const [selectedTableId, setSelectedTableId] = useState('')
  const [seating, setSeating] = useState(false)
  const [error, setError] = useState('')

  const openTables = tables.filter((t) => t.status?.toLowerCase() === 'open')

  const seat = async () => {
    if (!selectedTableId) {
      setError('Select a table')
      return
    }
    setSeating(true)
    const res = await RestaurantWaitlist.seat(party.id, selectedTableId)
    if (!res.success) {
      setError(res.message ?? res.error ?? 'Failed to seat party')
      setSeating(false)
      return
    }
    onSeated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-1">Seat {party.name}</h3>
        <p className="text-xs text-gray-500 mb-4">Party of {party.partySize}</p>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {openTables.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No open tables available.</p>
          ) : (
            openTables.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${selectedTableId === t.id ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
              >
                <span>Table {t.number}</span>
                <span className="text-xs text-gray-400">
                  {t.seats} seats{t.section ? ` · ${t.section}` : ''}
                </span>
              </button>
            ))
          )}
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={seat}
            disabled={seating || !selectedTableId}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {seating ? 'Seating...' : 'Seat Party'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Waitlist Panel ───────────────────────────────────────────────────────────

interface WaitlistPanelProps {
  parties: WaitlistParty[]
  tables: FloorBoardTable[]
  loading: boolean
  onRefresh: () => void
  onSeat: () => void
  onDragStart: (party: WaitlistParty) => void
  onDragEnd: () => void
  onClose: () => void
}

function WaitlistPanel({
  parties,
  tables,
  loading,
  onRefresh,
  onSeat,
  onDragStart,
  onDragEnd,
  onClose,
}: WaitlistPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [seatParty, setSeatParty] = useState<WaitlistParty | null>(null)
  const [actioningId, setActioningId] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const [tenantId, setTenantId] = useState('')

  useEffect(() => {
    if (!showQr || tenantId) return
    RestaurantConfigAPI.get().then((res) => {
      if (res.success && res.data) setTenantId(res.data.tenantId)
    })
  }, [showQr, tenantId])

  const joinUrl =
    tenantId && typeof window !== 'undefined' ? `${window.location.origin}/join?t=${tenantId}` : ''
  const qrSrc = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`
    : ''

  const waiting = parties.filter((p) => {
    const s = p.status?.toLowerCase()
    return s === 'waiting' || s === 'called'
  })

  const handleNoShow = async (party: WaitlistParty) => {
    setActioningId(party.id)
    await RestaurantWaitlist.noShow(party.id)
    onRefresh()
    setActioningId(null)
  }

  return (
    <>
      <div className="fixed inset-y-0 right-0 z-30 w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <List className="w-4 h-4 text-amber-600" />
            <h2 className="font-semibold text-gray-900 text-sm">Waitlist</h2>
            {waiting.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {waiting.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQr((v) => !v)}
              title="QR code for guests to join"
              className={`p-1.5 rounded-lg border transition-colors ${showQr ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-3 pt-2 pb-1 text-[11px] text-gray-400 italic">
          Drag a party card onto an open table to seat them
        </div>

        {showQr && (
          <div className="mx-3 mb-2 p-4 border border-amber-200 rounded-xl bg-amber-50 text-center">
            <p className="text-xs font-semibold text-amber-800 mb-3">Scan to join waitlist</p>
            {!joinUrl ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              </div>
            ) : (
              <>
                <img src={qrSrc} alt="QR Code" className="mx-auto rounded-lg w-[110px] h-[110px]" />
                <p className="text-[10px] text-amber-700 mt-2 break-all">{joinUrl}</p>
                <button
                  onClick={() => navigator.clipboard?.writeText(joinUrl)}
                  className="mt-2 text-[11px] text-amber-600 hover:text-amber-800 flex items-center gap-1 mx-auto"
                >
                  Copy link
                </button>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : waiting.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No parties waiting</p>
            </div>
          ) : (
            <div className="space-y-2">
              {waiting.map((party, idx) => (
                <div
                  key={party.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    onDragStart(party)
                  }}
                  onDragEnd={onDragEnd}
                  className="bg-gray-50 rounded-xl p-3 border border-gray-100 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                        <p className="text-sm font-semibold text-gray-900">{party.name}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {party.phone && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <PhoneCall className="w-3 h-3" /> {party.phone}
                          </span>
                        )}
                        {party.quotedWait && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ~{party.quotedWait}m
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0 ml-2">
                      {(() => {
                        const n = party.partySize ?? party.size ?? 0
                        return (
                          <>
                            <Users className="w-3.5 h-3.5" /> {n} {n === 1 ? 'person' : 'people'}
                          </>
                        )
                      })()}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSeatParty(party)}
                      className="flex-1 px-2 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Seat
                    </button>
                    <button
                      onClick={() => handleNoShow(party)}
                      disabled={actioningId === party.id}
                      className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200 disabled:opacity-40"
                    >
                      {actioningId === party.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'No Show'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddWaitlistModal onClose={() => setShowAddModal(false)} onAdded={onRefresh} />
      )}

      {seatParty && (
        <SeatPartyModal
          party={seatParty}
          tables={tables}
          onClose={() => setSeatParty(null)}
          onSeated={() => {
            onSeat()
            setSeatParty(null)
          }}
        />
      )}
    </>
  )
}

// ─── Orders Panel ────────────────────────────────────────────────────────────

interface OrdersPanelProps {
  tickets: QueueTicket[]
  ticketLines: Map<string, PosTransactionLine[]>
  categories: QueueCategory[]
  loading: boolean
  onServe: (ticket: QueueTicket) => Promise<void>
  onClose: () => void
  onDragStart: (ticket: QueueTicket) => void
  onDragEnd: () => void
}

function OrdersPanel({
  tickets,
  ticketLines,
  categories,
  loading,
  onServe,
  onClose,
  onDragStart,
  onDragEnd,
}: OrdersPanelProps) {
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
  const [servingId, setServingId] = useState<string | null>(null)

  const handle = async (ticket: QueueTicket) => {
    setServingId(ticket.id)
    await onServe(ticket)
    setServingId(null)
  }

  const pending = tickets.filter((t) => t.status === 'WAITING' || t.status === 'CALLED')

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-purple-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Pending Orders</h2>
          {pending.length > 0 && (
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {pending.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="px-3 pt-2 pb-1 text-[11px] text-gray-400 italic">
        Drag a ticket onto a table to serve it
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : pending.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No pending orders</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((ticket) => {
              const lines = ticket.posTransactionId
                ? (ticketLines.get(ticket.posTransactionId) ?? [])
                : []
              return (
                <div
                  key={ticket.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    onDragStart(ticket)
                  }}
                  onDragEnd={onDragEnd}
                  className="bg-gray-50 rounded-xl p-3 border border-gray-100 cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-purple-700">#{ticket.number}</span>
                      {ticket.status === 'CALLED' && (
                        <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Called
                        </span>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      {categoryMap.get(ticket.categoryId) && (
                        <p className="text-[11px] font-bold text-purple-700 leading-tight">
                          <span className="font-normal text-gray-400">for </span>
                          {categoryMap.get(ticket.categoryId)}
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400">
                        {new Date(ticket.issuedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {ticket.customerName && (
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {ticket.customerName}
                    </p>
                  )}

                  {lines.length > 0 && (
                    <ul className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      {lines.map((line, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-purple-600 shrink-0">
                            ×{Number(line.quantity)}
                          </span>
                          <span className="flex-1 truncate text-gray-700">{line.itemName}</span>
                          <span className="text-gray-400 shrink-0">
                            ₱
                            {Number(line.lineTotal).toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-end pt-1 border-t border-gray-100">
                        <span className="text-xs font-semibold text-gray-700">
                          ₱
                          {lines
                            .reduce((s, l) => s + Number(l.lineTotal), 0)
                            .toLocaleString('en-PH', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                        </span>
                      </li>
                    </ul>
                  )}

                  <button
                    onClick={() => handle(ticket)}
                    disabled={servingId === ticket.id}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {servingId === ticket.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Served
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Queue Settings Panel ────────────────────────────────────────────────────

interface QueueSettingsPanelProps {
  categories: QueueCategory[]
  selectedIds: string[]
  tables: FloorBoardTable[]
  queueTableMap: Record<string, string[]>
  onChange: (ids: string[]) => void
  onTableMapChange: (map: Record<string, string[]>) => void
  onClose: () => void
}

function QueueSettingsPanel({
  categories,
  selectedIds,
  tables,
  queueTableMap,
  onChange,
  onTableMapChange,
  onClose,
}: QueueSettingsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleQueue = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onChange(next)
    if (!next.includes(id)) setExpandedId(null)
    else setExpandedId(id)
  }

  const toggleTable = (catId: string, tableId: string) => {
    const current = queueTableMap[catId] ?? []
    const next = current.includes(tableId)
      ? current.filter((x) => x !== tableId)
      : [...current, tableId]
    onTableMapChange({ ...queueTableMap, [catId]: next })
  }

  const clearTableAssignments = (catId: string) => {
    onTableMapChange({ ...queueTableMap, [catId]: [] })
  }

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-purple-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Queue Connections</h2>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <p className="px-4 pt-3 pb-1 text-[11px] text-gray-400">
        Connect queues to the floor board. Expand a queue to assign it to specific tables.
      </p>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {categories.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">No queue categories found.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const on = selectedIds.includes(cat.id)
            const expanded = expandedId === cat.id
            const assignedTables = queueTableMap[cat.id] ?? []

            return (
              <div
                key={cat.id}
                className={`rounded-xl border overflow-hidden transition-colors ${on ? 'border-purple-200' : 'border-gray-100'}`}
              >
                {/* Queue row */}
                <div
                  className={`flex items-center gap-2 px-3 py-2.5 ${on ? 'bg-purple-50' : 'bg-gray-50'}`}
                >
                  <button
                    onClick={() => toggleQueue(cat.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? 'bg-purple-600' : 'bg-gray-300'}`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${on ? 'text-purple-800' : 'text-gray-600'}`}
                      >
                        {cat.name}
                      </p>
                      {assignedTables.length > 0 && (
                        <p className="text-[10px] text-purple-500">
                          {assignedTables.length} table{assignedTables.length !== 1 ? 's' : ''}{' '}
                          assigned
                        </p>
                      )}
                    </div>
                  </button>
                  {on && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : cat.id)}
                      className={`p-1 rounded text-purple-400 hover:text-purple-700 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    >
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </button>
                  )}
                </div>

                {/* Table picker — shown when expanded */}
                {on && expanded && (
                  <div className="border-t border-purple-100 bg-white px-3 py-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Assign tables
                      </p>
                      {assignedTables.length > 0 && (
                        <button
                          onClick={() => clearTableAssignments(cat.id)}
                          className="text-[10px] text-red-400 hover:text-red-600"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {tables.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No tables on floor yet.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        {tables.map((t) => {
                          const checked = assignedTables.includes(t.id)
                          return (
                            <button
                              key={t.id}
                              onClick={() => toggleTable(cat.id, t.id)}
                              className={`py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                checked
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-purple-300'
                              }`}
                            >
                              T{t.number}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
        <button
          onClick={() => onChange(categories.map((c) => c.id))}
          className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Select All
        </button>
        <button
          onClick={() => onChange([])}
          className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Clear All
        </button>
      </div>
    </div>
  )
}

// ─── Floor Board ─────────────────────────────────────────────────────────────

export default function FloorBoard() {
  const [tables, setTables] = useState<FloorBoardTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedTable, setSelectedTable] = useState<FloorBoardTable | null>(null)
  const [activeTab, setActiveTab] = useState<RestaurantTab | null>(null)
  const [loadingTab, setLoadingTab] = useState(false)
  const [showAddTable, setShowAddTable] = useState(false)
  const [statusPickerTable, setStatusPickerTable] = useState<FloorBoardTable | null>(null)
  const [filterSection, setFilterSection] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<TableStatus | 'all'>('all')
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [waitlistParties, setWaitlistParties] = useState<WaitlistParty[]>([])
  const [waitlistLoading, setWaitlistLoading] = useState(false)
  const [showOrders, setShowOrders] = useState(false)
  const [showQueueSettings, setShowQueueSettings] = useState(false)
  const [queueCategories, setQueueCategories] = useState<QueueCategory[]>([])
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([])
  const [orderTickets, setOrderTickets] = useState<QueueTicket[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [draggingTicket, setDraggingTicket] = useState<QueueTicket | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [ticketLines, setTicketLines] = useState<Map<string, PosTransactionLine[]>>(new Map())
  const [tableTabLines, setTableTabLines] = useState<Map<string, TabLine[]>>(new Map())
  const lineCacheRef = useRef<Map<string, PosTransactionLine[]>>(new Map())
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draggingParty, setDraggingParty] = useState<WaitlistParty | null>(null)
  const [combineMode, setCombineMode] = useState(false)
  const [selectedForCombine, setSelectedForCombine] = useState<Set<string>>(new Set())
  const [combining, setCombining] = useState(false)
  const [activeTaxRate, setActiveTaxRate] = useState<number | null>(null)
  const [queueTableMap, setQueueTableMap] = useState<Record<string, string[]>>({})
  const [posConnectedCatIds, setPosConnectedCatIds] = useState<Set<string>>(new Set())
  const selectedQueueIdsRef = useRef<string[]>([])
  const showOrdersRef = useRef(false)

  const load = useCallback(async () => {
    const boardRes = await RestaurantFloor.board()
    let freshTables: FloorBoardTable[] = []
    if (boardRes.success && boardRes.data) {
      freshTables = boardRes.data
      setTables(freshTables)
    } else {
      setError(boardRes.message ?? boardRes.error ?? 'Failed to load tables')
    }
    setLoading(false)

    // Fetch tab lines for tables that have or likely have an active tab.
    // Backend doesn't always populate activeTabId, so also probe tables with
    // statuses that imply an open tab.
    const TAB_STATUSES = new Set(['seated', 'ordering', 'entree', 'check_dropped', 'needs_bussing'])
    const tabCandidates = freshTables.filter(
      (t) => t.activeTabId || TAB_STATUSES.has(t.status?.toLowerCase() ?? '')
    )
    const lineResults = await Promise.all(
      tabCandidates.map(async (t) => {
        const res = t.activeTabId
          ? await RestaurantTabs.get(t.activeTabId)
          : await RestaurantTabs.getActiveByTable(t.id)
        let lines = res.success && res.data ? res.data.lines : []
        const partyName = res.success && res.data ? (res.data.partyName ?? null) : null

        // Also fetch tab lines from combined sub-tables and merge
        const combined = (t as any).combinedTables as
          | { id: string; activeTabId?: string | null }[]
          | undefined
        if (combined?.length) {
          const subResults = await Promise.all(
            combined.map(async (ct) => {
              const subRes = ct.activeTabId
                ? await RestaurantTabs.get(ct.activeTabId)
                : await RestaurantTabs.getActiveByTable(ct.id)
              return subRes.success && subRes.data ? subRes.data.lines : []
            })
          )
          lines = [...lines, ...subResults.flat()]
        }

        return lines.length > 0 || partyName ? { tableId: t.id, lines, partyName } : null
      })
    )
    const tabCandidateIds = new Set(tabCandidates.map((t) => t.id))
    setTableTabLines((prev) => {
      const next = new Map(prev)
      for (const id of next.keys()) {
        if (!tabCandidateIds.has(id)) next.delete(id)
      }
      for (const r of lineResults) {
        if (r) next.set(r.tableId, r.lines)
      }
      return next
    })
    // Back-fill partyName onto tables from their tab when the backend omits it
    const tabPartyNames = new Map<string, string>()
    for (const r of lineResults) {
      if (r?.partyName) tabPartyNames.set(r.tableId, r.partyName)
    }
    if (tabPartyNames.size > 0) {
      setTables((prev) =>
        prev.map((t) =>
          !t.partyName && tabPartyNames.has(t.id)
            ? { ...t, partyName: tabPartyNames.get(t.id) ?? null }
            : t
        )
      )
    }
  }, [])

  const loadWaitlist = useCallback(async () => {
    setWaitlistLoading(true)
    const res = await RestaurantWaitlist.list()
    if (res.success && res.data) setWaitlistParties(res.data)
    setWaitlistLoading(false)
  }, [])

  const loadOrders = useCallback(async (catIds: string[]) => {
    if (catIds.length === 0) {
      setOrderTickets([])
      return
    }
    const results = await Promise.all(catIds.map((id) => QueueTickets.list(id)))
    const tickets = results
      .filter((r) => r.success && r.data)
      .flatMap((r) => r.data!)
      .sort((a, b) => new Date(a.issuedAt).getTime() - new Date(b.issuedAt).getTime())
    setOrderTickets(tickets)

    // Fetch transaction lines for tickets not yet in cache
    const toFetch = tickets.filter(
      (t) => t.posTransactionId && !lineCacheRef.current.has(t.posTransactionId)
    )
    await Promise.all(
      toFetch.map(async (t) => {
        if (!t.posTransactionId) return
        const txRes = await getTransaction(t.posTransactionId)
        if (txRes.success && txRes.data?.lines) {
          lineCacheRef.current.set(t.posTransactionId, txRes.data.lines)
        }
      })
    )
    setTicketLines(new Map(lineCacheRef.current))
  }, [])

  useEffect(() => {
    getDefaultAccountingTaxRate().then((rate) => setActiveTaxRate(rate?.rate ?? null))
    Promise.all([QueueCategories.list(), getActivePosConfig()]).then(([catRes, configRes]) => {
      if (!catRes.success || !catRes.data) return
      const cats = catRes.data
      setQueueCategories(cats)
      // Determine which queue is connected via POS configuration (orderQueueCategoryId)
      const posQueueId = configRes.success ? (configRes.data?.orderQueueCategoryId ?? null) : null
      const posIds = new Set<string>(posQueueId ? [posQueueId] : [])
      setPosConnectedCatIds(posIds)
      // Restore saved queue selection; restrict to POS-connected categories
      const saved = localStorage.getItem('floor_board_queue_ids')
      const ids = saved
        ? (JSON.parse(saved) as string[]).filter((id) => posIds.has(id))
        : Array.from(posIds)
      setSelectedQueueIds(ids)
      selectedQueueIdsRef.current = ids
      // Restore saved queue-table assignments
      const savedMap = localStorage.getItem('floor_board_queue_table_map')
      if (savedMap) setQueueTableMap(JSON.parse(savedMap))
    })
  }, [])

  useEffect(() => {
    showOrdersRef.current = showOrders
  }, [showOrders])

  const handleQueueSelectionChange = useCallback(
    (ids: string[]) => {
      setSelectedQueueIds(ids)
      selectedQueueIdsRef.current = ids
      localStorage.setItem('floor_board_queue_ids', JSON.stringify(ids))
      loadOrders(ids)
    },
    [loadOrders]
  )

  const handleQueueTableMapChange = useCallback((map: Record<string, string[]>) => {
    setQueueTableMap(map)
    localStorage.setItem('floor_board_queue_table_map', JSON.stringify(map))
  }, [])

  // Initial load so the badge count is accurate before the panel is ever opened
  useEffect(() => {
    if (selectedQueueIds.length === 0) return
    loadOrders(selectedQueueIds)
  }, [selectedQueueIds, loadOrders])

  // Poll while the panel is open (fallback if WebSocket is unavailable)
  useEffect(() => {
    if (!showOrders || selectedQueueIds.length === 0) return
    setOrdersLoading(true)
    loadOrders(selectedQueueIds).then(() => setOrdersLoading(false))
    const interval = setInterval(() => loadOrders(selectedQueueIds), POLL_MS)
    return () => clearInterval(interval)
  }, [showOrders, selectedQueueIds, loadOrders])

  useEffect(() => {
    load()
    loadWaitlist()
    pollRef.current = setInterval(load, POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load, loadWaitlist])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let socket: any = null
    try {
      // Dynamic import to avoid SSR issues
      import('socket.io-client')
        .then(({ io }) => {
          const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(
            /\/$/,
            ''
          )
          socket = io(`${base}/restaurant`, { withCredentials: true })
          socket.on(
            'table_status_changed',
            ({ tableId, status }: { tableId: string; status: TableStatus }) => {
              setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, status } : t)))
            }
          )
          socket.on('floor_board_updated', () => {
            load()
          })
          socket.on('tab_updated', () => {
            setSelectedTable((current) => {
              if (current) openTablePanel(current)
              return current
            })
          })
          socket.on('waitlist_updated', () => {
            loadWaitlist()
          })
        })
        .catch(() => {})
    } catch {}
    return () => {
      if (socket) socket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, loadWaitlist])

  // Queue namespace — real-time order notifications
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qSocket: any = null
    import('socket.io-client')
      .then(({ io }) => {
        const base = (process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
        qSocket = io(`${base}/queue`, { withCredentials: true })
        const onOrderEvent = () => {
          const ids = selectedQueueIdsRef.current
          if (ids.length === 0) return
          loadOrders(ids)
        }
        qSocket.on('queue_add', onOrderEvent)
        qSocket.on('queue_updated', onOrderEvent)
        qSocket.on('queue_served', onOrderEvent)
      })
      .catch(() => {})
    return () => {
      if (qSocket) qSocket.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadOrders])

  const openTablePanel = async (table: FloorBoardTable) => {
    setSelectedTable(table)
    setActiveTab(null)
    // Resolve the tab ID: prefer activeTabId, fall back to the summary's id
    const tabId = table.activeTabId ?? table.activeTab?.id ?? null
    setLoadingTab(true)
    if (tabId) {
      const res = await RestaurantTabs.get(tabId)
      if (res.success && res.data) setActiveTab(res.data)
    } else {
      // No known tab ID — query by table as last resort
      const res = await RestaurantTabs.getActiveByTable(table.id)
      if (res.success && res.data) {
        setActiveTab(res.data)
        setSelectedTable({ ...table, activeTabId: res.data.id })
      }
    }
    setLoadingTab(false)
  }

  const refreshAll = useCallback(async () => {
    await load()
    if (selectedTable) {
      const updated = tables.find((t) => t.id === selectedTable.id)
      if (updated) await openTablePanel(updated)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, selectedTable, tables])

  const handleCombine = async () => {
    if (selectedForCombine.size < 2) return
    setCombining(true)
    await RestaurantTables.combine(Array.from(selectedForCombine))
    setCombining(false)
    setCombineMode(false)
    setSelectedForCombine(new Set())
    load()
  }

  const toggleCombineMode = () => {
    setCombineMode((v) => !v)
    setSelectedForCombine(new Set())
  }

  const toggleTableSelect = (id: string) => {
    setSelectedForCombine((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Map each table to its assigned queue labels (name + palette index)
  const tableQueueLabels = useMemo(() => {
    const map = new Map<string, Array<{ name: string; colorIdx: number }>>()
    queueCategories.forEach((cat, idx) => {
      const tableIds = queueTableMap[cat.id] ?? []
      for (const tableId of tableIds) {
        const existing = map.get(tableId) ?? []
        map.set(tableId, [...existing, { name: cat.name, colorIdx: idx }])
      }
    })
    return map
  }, [queueCategories, queueTableMap])

  // Group filtered tables into queue sections for the floor board layout

  // Count pending queue tickets assigned to each table via queue-table mapping
  const pendingByTable = useMemo(() => {
    const map = new Map<string, number>()
    const pending = orderTickets.filter(
      (t) => (t.status === 'WAITING' || t.status === 'CALLED') && !!t.posTransactionId
    )
    for (const [catId, tableIds] of Object.entries(queueTableMap)) {
      const count = pending.filter((t) => t.categoryId === catId).length
      if (count === 0) continue
      for (const tableId of tableIds) {
        map.set(tableId, (map.get(tableId) ?? 0) + count)
      }
    }
    return map
  }, [orderTickets, queueTableMap])

  // Build party-name lookup from waitlist so the table card shows who is seated
  // even when the backend doesn't propagate partyName onto the table record.
  const seatedPartyByTable = new Map<string, string>()
  for (const p of waitlistParties) {
    if (p.tableId && p.status?.toLowerCase() === 'seated') {
      seatedPartyByTable.set(p.tableId, p.name)
    }
  }

  const sections = [
    'all',
    ...Array.from(new Set(tables.map((t) => t.section).filter(Boolean) as string[])),
  ]
  const statuses: Array<TableStatus | 'all'> = ['all', ...STATUS_FLOW]

  const filtered = tables.filter((t) => {
    if (filterSection !== 'all' && t.section !== filterSection) return false
    if (filterStatus !== 'all' && t.status.toLowerCase() !== filterStatus) return false
    return true
  })

  const queueSections = useMemo(() => {
    type Section = {
      queueId: string | null
      name: string | null
      colorIdx: number
      tables: FloorBoardTable[]
    }
    const sections: Section[] = []
    const placedIds = new Set<string>()

    queueCategories.forEach((cat, idx) => {
      if (!selectedQueueIds.includes(cat.id)) return
      const assignedIds = new Set(queueTableMap[cat.id] ?? [])
      const sectionTables = filtered.filter((t) => assignedIds.has(t.id))
      if (sectionTables.length === 0) return
      sectionTables.forEach((t) => placedIds.add(t.id))
      sections.push({ queueId: cat.id, name: cat.name, colorIdx: idx, tables: sectionTables })
    })

    const unassigned = filtered.filter((t) => !placedIds.has(t.id))
    if (unassigned.length > 0)
      sections.push({ queueId: null, name: null, colorIdx: -1, tables: unassigned })

    return sections
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, queueCategories, selectedQueueIds, queueTableMap])

  const hasSections = queueSections.some((s) => s.queueId !== null)

  const counts: Record<TableStatus, number> = {
    open: 0,
    reserved: 0,
    seated: 0,
    ordering: 0,
    entree: 0,
    check_dropped: 0,
    needs_bussing: 0,
  }
  tables.forEach((t) => {
    const s = t.status.toLowerCase() as TableStatus
    counts[s] = (counts[s] ?? 0) + 1
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <UtensilsCrossed className="w-5 h-5 text-amber-600 shrink-0" />
          <h1 className="font-bold text-gray-900 text-lg truncate">Floor Board</h1>
          <span className="text-xs text-gray-400 shrink-0">{tables.length} tables</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none shrink-0">
          {/* Orders — show count badge */}
          <button
            onClick={() =>
              setShowOrders((v) => {
                if (!v) {
                  setShowWaitlist(false)
                  setShowQueueSettings(false)
                }
                return !v
              })
            }
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${showOrders ? 'bg-purple-100 text-purple-700 border-purple-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Orders</span>
            {orderTickets.filter((t) => t.status === 'WAITING' || t.status === 'CALLED').length >
              0 && (
              <span className="bg-purple-600 text-white text-xs font-bold px-1.5 rounded-full shrink-0">
                {orderTickets.filter((t) => t.status === 'WAITING' || t.status === 'CALLED').length}
              </span>
            )}
          </button>

          {/* Waitlist — show count badge */}
          <button
            onClick={() =>
              setShowWaitlist((v) => {
                if (!v) {
                  setShowOrders(false)
                  setShowQueueSettings(false)
                  loadWaitlist()
                }
                return !v
              })
            }
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${showWaitlist ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <List className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Waitlist</span>
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0 ${
                waitlistParties.filter((p) => {
                  const s = p.status?.toLowerCase()
                  return s === 'waiting' || s === 'called'
                }).length > 0
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {
                waitlistParties.filter((p) => {
                  const s = p.status?.toLowerCase()
                  return s === 'waiting' || s === 'called'
                }).length
              }
            </span>
          </button>

          {/* Divider */}
          <span className="w-px h-6 bg-gray-200 shrink-0" />

          {/* Queue connections */}
          <button
            onClick={() =>
              setShowQueueSettings((v) => {
                if (!v) {
                  setShowOrders(false)
                  setShowWaitlist(false)
                }
                return !v
              })
            }
            title="Queue connections"
            className={`p-2 rounded-lg border transition-colors ${showQueueSettings ? 'bg-purple-100 text-purple-700 border-purple-200' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
          >
            <Plug className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-transparent"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Combine */}
          <button
            onClick={toggleCombineMode}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm font-semibold rounded-lg border transition-colors ${combineMode ? 'bg-blue-100 text-blue-700 border-blue-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Merge className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Combine</span>
          </button>

          {/* Add table — primary CTA */}
          <button
            onClick={() => setShowAddTable(true)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Table</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-5 py-3 bg-white border-b border-gray-100 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilterStatus('all')}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filterStatus === 'all' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
        >
          All
          <span className="font-bold">{tables.length}</span>
        </button>
        {(Object.entries(counts) as [TableStatus, number][]).map(([s, n]) => {
          const c = TABLE_STATUS_COLORS[s]
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${filterStatus === s ? `${c.bg} ${c.border} ${c.text}` : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${filterStatus === s ? 'bg-current' : 'bg-gray-300'}`}
              />
              {TABLE_STATUS_LABELS[s]}
              <span className="font-bold">{n}</span>
            </button>
          )
        })}
      </div>

      {sections.length > 2 && (
        <div className="flex gap-2 px-5 py-2 bg-white border-b border-gray-100 overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setFilterSection(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${filterSection === s ? 'bg-amber-100 text-amber-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {s === 'all' ? 'All Sections' : s}
            </button>
          ))}
        </div>
      )}

      <div
        className={`p-5 transition-all ${showWaitlist || showOrders || showQueueSettings ? 'lg:pr-[340px]' : ''}`}
      >
        {loading && tables.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading floor...
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 rounded-lg p-4 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              {tables.length === 0
                ? 'No tables yet. Add your first table to get started.'
                : 'No tables match the current filter.'}
            </p>
            {tables.length === 0 && (
              <button
                onClick={() => setShowAddTable(true)}
                className="px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Add First Table
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {queueSections.map((section) => {
              const palette =
                section.queueId !== null
                  ? QUEUE_PALETTE[section.colorIdx % QUEUE_PALETTE.length]
                  : null
              return (
                <div key={section.queueId ?? 'unassigned'}>
                  {/* Section divider */}
                  {hasSections &&
                    (palette ? (
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-px flex-1 rounded-full ${palette.bg} opacity-30`} />
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-full ${palette.label}`}
                        >
                          {section.name}
                        </span>
                        <div className={`h-px flex-1 rounded-full ${palette.bg} opacity-30`} />
                      </div>
                    ) : queueSections.length > 1 ? (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-px flex-1 bg-gray-200 rounded-full" />
                        <span className="text-xs font-medium text-gray-400 px-2">Other tables</span>
                        <div className="h-px flex-1 bg-gray-200 rounded-full" />
                      </div>
                    ) : null)}

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {section.tables.map((table) => (
                      <div
                        key={table.id}
                        className="relative group"
                        onDragOver={(e) => {
                          if (!draggingTicket && !draggingParty) return
                          if (draggingParty && table.status?.toLowerCase() !== 'open') return
                          if (draggingTicket) {
                            const assigned = queueTableMap[draggingTicket.categoryId] ?? []
                            if (assigned.length > 0 && !assigned.includes(table.id)) return
                          }
                          e.preventDefault()
                          setDropTargetId(table.id)
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return
                          setDropTargetId(null)
                        }}
                        onDrop={async (e) => {
                          e.preventDefault()
                          setDropTargetId(null)

                          if (draggingParty) {
                            const party = draggingParty
                            setDraggingParty(null)
                            const res = await RestaurantWaitlist.seat(party.id, table.id)
                            if (res.success) {
                              loadWaitlist()
                              load()
                            }
                            return
                          }

                          if (!draggingTicket) return
                          const ticket = draggingTicket
                          const assigned = queueTableMap[ticket.categoryId] ?? []
                          if (assigned.length > 0 && !assigned.includes(table.id)) {
                            setDraggingTicket(null)
                            return
                          }
                          setDraggingTicket(null)

                          await QueueTickets.serve(ticket.id)
                          setOrderTickets((prev) => prev.filter((t) => t.id !== ticket.id))

                          let tabId: string | null = table.activeTabId ?? null
                          if (!tabId) {
                            const tabRes = await RestaurantTabs.open(table.id, {
                              partyName: ticket.customerName ?? undefined,
                            })
                            if (tabRes.success && tabRes.data) tabId = tabRes.data.id
                          }

                          const droppedLines: PosTransactionLine[] = ticket.posTransactionId
                            ? (lineCacheRef.current.get(ticket.posTransactionId) ?? [])
                            : []

                          if (tabId && droppedLines.length > 0) {
                            await Promise.all(
                              droppedLines.map((line) => {
                                const qty = Number(line.quantity)
                                const unitPrice =
                                  qty > 0 ? Number(line.lineTotal) / qty : Number(line.unitPrice)
                                return RestaurantTabs.addLine(tabId!, {
                                  itemId: line.itemId,
                                  itemName: line.itemName,
                                  sku: line.sku ?? undefined,
                                  quantity: qty,
                                  unitPrice,
                                })
                              })
                            )
                          }

                          const addedQty = droppedLines.reduce((s, l) => s + Number(l.quantity), 0)
                          const addedTotal = droppedLines.reduce(
                            (s, l) => s + Number(l.lineTotal),
                            0
                          )
                          setTables((prev) =>
                            prev.map((t) => {
                              if (t.id !== table.id) return t
                              return {
                                ...t,
                                activeTabId: tabId ?? t.activeTabId,
                                status:
                                  t.status === 'open' || t.status === 'reserved'
                                    ? 'ordering'
                                    : t.status,
                                activeTab: tabId
                                  ? {
                                      id: tabId,
                                      itemCount: (t.activeTab?.itemCount ?? 0) + addedQty,
                                      subtotal: (t.activeTab?.subtotal ?? 0) + addedTotal,
                                    }
                                  : t.activeTab,
                              } as FloorBoardTable
                            })
                          )

                          if (tabId) {
                            const updatedTab = await RestaurantTabs.get(tabId)
                            if (updatedTab.success && updatedTab.data) {
                              setTableTabLines((prev) => {
                                const next = new Map(prev)
                                next.set(table.id, updatedTab.data!.lines)
                                return next
                              })
                            }
                          }

                          openTablePanel({
                            ...table,
                            activeTabId: tabId ?? table.activeTabId ?? undefined,
                          } as FloorBoardTable)
                        }}
                      >
                        {combineMode && (
                          <div
                            className={`absolute inset-0 z-10 rounded-xl border-2 transition-all pointer-events-none ${selectedForCombine.has(table.id) ? 'border-blue-500 bg-blue-500/10' : 'border-transparent'}`}
                          >
                            {selectedForCombine.has(table.id) && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                        )}
                        <TableCard
                          table={
                            table.partyName
                              ? table
                              : { ...table, partyName: seatedPartyByTable.get(table.id) ?? null }
                          }
                          onClick={() =>
                            combineMode ? toggleTableSelect(table.id) : openTablePanel(table)
                          }
                          isDragActive={!combineMode && !!(draggingTicket || draggingParty)}
                          isDropTarget={!combineMode && dropTargetId === table.id}
                          tabLines={tableTabLines
                            .get(table.id)
                            ?.map((l) =>
                              activeTaxRate != null
                                ? { ...l, unitPrice: l.unitPrice * (1 + activeTaxRate / 100) }
                                : l
                            )}
                          pendingTickets={pendingByTable.get(table.id)}
                          queueLabels={tableQueueLabels.get(table.id)}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setStatusPickerTable(table)
                          }}
                          className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 p-1 bg-white/90 rounded-md text-gray-400 hover:text-gray-700 shadow-sm transition-opacity"
                          title="Change status"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedTable &&
        (loadingTab ? (
          <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        ) : (
          <TabPanel
            table={selectedTable}
            tab={activeTab}
            taxRate={activeTaxRate}
            onClose={() => {
              setSelectedTable(null)
              setActiveTab(null)
            }}
            onRefresh={refreshAll}
          />
        ))}

      {/* Combine mode floating action bar */}
      {combineMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-blue-200 shadow-xl rounded-2xl px-5 py-3">
          <div className="text-sm text-blue-700 font-medium">
            {selectedForCombine.size === 0
              ? 'Select tables to combine'
              : `${selectedForCombine.size} table${selectedForCombine.size > 1 ? 's' : ''} selected`}
          </div>
          {selectedForCombine.size >= 2 && (
            <button
              onClick={handleCombine}
              disabled={combining}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {combining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Merge className="w-4 h-4" />
              )}
              Merge Tables
            </button>
          )}
          <button
            onClick={toggleCombineMode}
            className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl"
          >
            Cancel
          </button>
        </div>
      )}

      {showAddTable && (
        <AddTableModal
          onClose={() => setShowAddTable(false)}
          onCreated={(newTable) => {
            if (newTable) {
              setTables((prev) => [
                ...prev,
                { ...newTable, activeTab: null, upcomingBooking: null },
              ])
            }
            load()
          }}
        />
      )}

      {statusPickerTable && (
        <StatusPicker
          table={statusPickerTable}
          onClose={() => setStatusPickerTable(null)}
          onChanged={load}
        />
      )}

      {showWaitlist && (
        <WaitlistPanel
          parties={waitlistParties}
          tables={tables}
          loading={waitlistLoading}
          onRefresh={loadWaitlist}
          onSeat={() => {
            loadWaitlist()
            load()
          }}
          onDragStart={(party) => setDraggingParty(party)}
          onDragEnd={() => setDraggingParty(null)}
          onClose={() => setShowWaitlist(false)}
        />
      )}

      {showOrders && (
        <OrdersPanel
          tickets={orderTickets}
          ticketLines={ticketLines}
          categories={queueCategories.filter((c) => posConnectedCatIds.has(c.id))}
          loading={ordersLoading}
          onServe={async (ticket) => {
            await QueueTickets.serve(ticket.id)
            loadOrders(selectedQueueIds)
          }}
          onClose={() => setShowOrders(false)}
          onDragStart={(ticket) => setDraggingTicket(ticket)}
          onDragEnd={() => {
            setDraggingTicket(null)
            setDropTargetId(null)
          }}
        />
      )}

      {showQueueSettings && (
        <QueueSettingsPanel
          categories={queueCategories.filter((c) => posConnectedCatIds.has(c.id))}
          selectedIds={selectedQueueIds}
          tables={tables}
          queueTableMap={queueTableMap}
          onChange={handleQueueSelectionChange}
          onTableMapChange={handleQueueTableMapChange}
          onClose={() => setShowQueueSettings(false)}
        />
      )}
    </div>
  )
}
