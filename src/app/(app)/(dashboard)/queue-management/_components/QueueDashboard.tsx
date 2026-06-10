'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
  Settings,
  Tv,
  BarChart3,
  ChevronRight,
  CheckCircle,
  X,
  Bell,
  BellOff,
  UtensilsCrossed,
  LayoutGrid,
  Users,
  Clock,
  TicketCheck,
  Activity,
  ChevronLeft,
  Hash,
  ArrowRight,
  Printer,
} from 'lucide-react'
import {
  QueueCategories,
  QueueTickets,
  QueueStatsAPI,
  fmtWait,
  type QueueCategory,
  type QueueTicket,
  type QueueStats,
} from '@/src/libs/data/QueueData'

const POLL_MS = 5000
const BROADCAST_CHANNEL = 'queue-board-update'

function broadcastBoardUpdate() {
  try {
    new BroadcastChannel(BROADCAST_CHANNEL).postMessage('update')
  } catch {
    /* unsupported */
  }
}

function playDing() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.setValueAtTime(0.0001, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6)
    o.start()
    o.stop(ctx.currentTime + 1.8)
  } catch {
    /* no audio */
  }
}

export default function QueueDashboard() {
  const [categories, setCategories] = useState<QueueCategory[]>([])
  const [ticketsByCategory, setTicketsByCategory] = useState<Record<string, QueueTicket[]>>({})
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [filter, setFilter] = useState<string | 'all'>('all')
  const [sound, setSound] = useState(true)
  const [loading, setLoading] = useState(true)
  const [issueFor, setIssueFor] = useState<QueueCategory | null>(null)
  const [resetConfirm, setResetConfirm] = useState<string | null>(null)
  const [flashing, setFlashing] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    const [cats, st] = await Promise.all([QueueCategories.list(), QueueStatsAPI.get()])
    const list = cats.data ?? []
    setCategories(list)
    setStats(st.data ?? null)
    const ticketResults = await Promise.all(list.map((c) => QueueTickets.list(c.id)))
    const map: Record<string, QueueTicket[]> = {}
    list.forEach((c, i) => {
      map[c.id] = ticketResults[i].data ?? []
    })
    setTicketsByCategory((prev) => {
      for (const c of list) {
        const newCalled = (map[c.id] ?? []).find((t) => t.status === 'CALLED')
        const oldCalled = (prev[c.id] ?? []).find((t) => t.status === 'CALLED')
        if (newCalled && newCalled.id !== oldCalled?.id) {
          if (sound) playDing()
          setFlashing((f) => ({ ...f, [c.id]: true }))
          setTimeout(() => setFlashing((f) => ({ ...f, [c.id]: false })), 3000)
        }
      }
      return map
    })
    setLoading(false)
  }, [sound])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (timer) return
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        load()
      }, POLL_MS)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        load()
        start()
      }
    }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  useEffect(() => {
    if (!resetConfirm) return
    const t = setTimeout(() => setResetConfirm(null), 5000)
    return () => clearTimeout(t)
  }, [resetConfirm])

  const handleNext = async (id: string) => {
    const res = await QueueTickets.next(id)
    if (!res.success) {
      alert(res.message || res.error || 'Failed to call next')
      return
    }
    if (res.data && !res.data.ok) {
      const reason =
        res.data.reason === 'no_tickets_waiting' ? 'No tickets waiting.' : 'No previous ticket.'
      alert(reason)
    }
    broadcastBoardUpdate()
    load()
  }
  const handlePrev = async (id: string) => {
    const res = await QueueTickets.prev(id)
    if (!res.success) {
      alert(res.message || res.error || 'Failed')
      return
    }
    if (res.data && !res.data.ok) alert('No previous ticket to recall.')
    broadcastBoardUpdate()
    load()
  }
  const handleServe = async (ticketId: string) => {
    await QueueTickets.serve(ticketId)
    broadcastBoardUpdate()
    load()
  }
  const handleReset = async (id: string) => {
    await QueueTickets.reset(id)
    setResetConfirm(null)
    load()
  }

  const visibleCategories =
    filter === 'all' ? categories : categories.filter((c) => c.id === filter)

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Primary row */}
          <div className="flex items-center justify-between gap-2 py-3 sm:py-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-purple-700 flex items-center justify-center shrink-0">
                <TicketCheck className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-semibold text-gray-900 leading-tight">
                  Queue Management
                </h1>
                <p className="hidden sm:block text-xs text-gray-500">
                  Issue tickets, call customers, monitor throughput
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSound((s) => !s)}
                title={sound ? 'Mute alerts' : 'Unmute alerts'}
                className={`p-2 rounded-lg transition-colors ${sound ? 'text-purple-700 bg-purple-50 hover:bg-purple-100' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                {sound ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>
              <button
                onClick={load}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {/* Desktop nav */}
              <div className="hidden sm:flex items-center gap-1">
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <Link
                  href="/queue-management/display"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Tv className="w-3.5 h-3.5" /> Display
                </Link>
                <Link
                  href="/queue-management/reports"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Reports
                </Link>
                <Link
                  href="/queue-management/order-board"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LayoutGrid className="w-3.5 h-3.5" /> Order Board
                </Link>
                <Link
                  href="/queue-management/restaurant"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" /> Restaurant
                </Link>
                <div className="w-px h-5 bg-gray-200 mx-1" />
                <Link
                  href="/queue-management/settings"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Manage Queues
                </Link>
              </div>

              {/* Mobile: settings icon only */}
              <Link
                href="/queue-management/settings"
                title="Manage Queues"
                className="sm:hidden p-2 rounded-lg bg-purple-700 text-white hover:bg-purple-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Mobile secondary nav row */}
          <div className="sm:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-none">
            <Link
              href="/queue-management/display"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg shrink-0 transition-colors"
            >
              <Tv className="w-3 h-3" /> Display
            </Link>
            <Link
              href="/queue-management/reports"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg shrink-0 transition-colors"
            >
              <BarChart3 className="w-3 h-3" /> Reports
            </Link>
            <Link
              href="/queue-management/order-board"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg shrink-0 transition-colors"
            >
              <LayoutGrid className="w-3 h-3" /> Order Board
            </Link>
            <Link
              href="/queue-management/restaurant"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg shrink-0 transition-colors"
            >
              <UtensilsCrossed className="w-3 h-3" /> Restaurant
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Tickets Today"
            value={stats?.issuedToday ?? 0}
            icon={<Hash className="w-4 h-4" />}
            color="purple"
          />
          <StatCard
            label="Now Serving"
            value={stats?.nowServing ?? 0}
            icon={<Activity className="w-4 h-4" />}
            color="blue"
          />
          <StatCard
            label="Waiting"
            value={stats?.waiting ?? 0}
            icon={<Users className="w-4 h-4" />}
            color={typeof stats?.waiting === 'number' && stats.waiting > 10 ? 'amber' : 'emerald'}
          />
          <StatCard
            label="Avg Service Time"
            value={fmtWait(stats?.avgServiceSec ?? 0)}
            icon={<Clock className="w-4 h-4" />}
            color="slate"
          />
        </div>

        {/* Filter chips */}
        {categories.length > 0 && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === 'all' ? 'bg-purple-700 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                All Queues
                <span
                  className={`ml-1.5 text-xs font-semibold ${filter === 'all' ? 'text-purple-200' : 'text-gray-400'}`}
                >
                  {categories.length}
                </span>
              </button>
              {categories.map((c) => {
                const tickets = ticketsByCategory[c.id] ?? []
                const waitCount = tickets.filter((t) => t.status === 'WAITING').length
                return (
                  <button
                    key={c.id}
                    onClick={() => setFilter(c.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filter === c.id ? 'bg-purple-700 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    {c.name}
                    {waitCount > 0 && (
                      <span
                        className={`ml-1.5 text-xs font-semibold ${filter === c.id ? 'text-purple-200' : 'text-amber-600'}`}
                      >
                        {waitCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Queue cards */}
        {loading && categories.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 animate-pulse"
              >
                <div className="h-5 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-16 bg-gray-100 rounded-lg mb-4" />
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white border border-dashed border-gray-300 rounded-xl p-8 sm:p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center mb-4">
              <TicketCheck className="w-7 h-7 text-purple-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">No queues yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs">
              Create your first queue to start managing customers and ticket numbers.
            </p>
            <Link
              href="/queue-management/settings"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create your first queue
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {visibleCategories.map((c) => {
              const tickets = ticketsByCategory[c.id] ?? []
              const called = tickets.find((t) => t.status === 'CALLED')
              const waiting = tickets.filter((t) => t.status === 'WAITING')
              const upNext = waiting.slice(0, 5)
              const isFlash = flashing[c.id]
              const isResetConfirming = resetConfirm === c.id
              return (
                <QueueCard
                  key={c.id}
                  category={c}
                  called={called}
                  waiting={waiting}
                  upNext={upNext}
                  isFlash={isFlash}
                  isResetConfirming={isResetConfirming}
                  onIssue={() => setIssueFor(c)}
                  onNext={() => handleNext(c.id)}
                  onPrev={() => handlePrev(c.id)}
                  onServe={() => called && handleServe(called.id)}
                  onReset={() => handleReset(c.id)}
                  onResetRequest={() => setResetConfirm(c.id)}
                  onResetCancel={() => setResetConfirm(null)}
                />
              )
            })}
          </div>
        )}
      </div>

      {issueFor && (
        <IssueTicketDialog
          category={issueFor}
          onClose={() => setIssueFor(null)}
          onIssued={() => {
            setIssueFor(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'purple' | 'blue' | 'emerald' | 'amber' | 'slate'
}) {
  const colorMap = {
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${colorMap[color]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium truncate">{label}</div>
        <div className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{value}</div>
      </div>
    </div>
  )
}

function QueueCard({
  category,
  called,
  waiting,
  upNext,
  isFlash,
  isResetConfirming,
  onIssue,
  onNext,
  onPrev,
  onServe,
  onReset,
  onResetRequest,
  onResetCancel,
}: {
  category: QueueCategory
  called: QueueTicket | undefined
  waiting: QueueTicket[]
  upNext: QueueTicket[]
  isFlash: boolean
  isResetConfirming: boolean
  onIssue: () => void
  onNext: () => void
  onPrev: () => void
  onServe: () => void
  onReset: () => void
  onResetRequest: () => void
  onResetCancel: () => void
}) {
  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-300 flex flex-col ${isFlash ? 'border-amber-400 shadow-md shadow-amber-100 ring-1 ring-amber-200' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">{category.name}</div>
          {category.counterName && (
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-500">Counter {category.counterName}</span>
            </div>
          )}
        </div>
        <button
          onClick={onIssue}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-3 h-3" /> <span className="hidden xs:inline sm:inline">Issue </span>
          Ticket
        </button>
      </div>

      {/* Now Serving */}
      <div
        className={`mx-4 sm:mx-5 mb-3 sm:mb-4 rounded-xl p-3 sm:p-4 text-center transition-colors ${isFlash ? 'bg-amber-50' : 'bg-gray-50'}`}
      >
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Now Serving
        </div>
        <div
          className={`text-4xl sm:text-5xl font-black tracking-tight leading-none ${isFlash ? 'text-amber-700' : called ? 'text-gray-900' : 'text-gray-300'}`}
        >
          {called ? `#${String(called.number).padStart(3, '0')}` : '—'}
        </div>
        {called?.customerName && (
          <div className="text-xs text-gray-500 mt-2 font-medium">{called.customerName}</div>
        )}
      </div>

      {/* Up Next */}
      <div className="px-4 sm:px-5 mb-3 sm:mb-4 flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">Up Next</span>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${waiting.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}
          >
            {waiting.length} waiting
          </span>
        </div>
        {upNext.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-1">No tickets waiting</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {upNext.map((t, i) => (
              <span
                key={t.id}
                className={`px-2 sm:px-2.5 py-1 text-xs rounded-lg font-mono font-semibold ${i === 0 ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200' : 'bg-gray-100 text-gray-600'}`}
              >
                #{String(t.number).padStart(3, '0')}
              </span>
            ))}
            {waiting.length > 5 && (
              <span className="px-2 sm:px-2.5 py-1 text-xs rounded-lg font-medium bg-gray-100 text-gray-500">
                +{waiting.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t border-gray-100 pt-3 sm:pt-4">
        {/* Main action row */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            disabled={!called}
            title="Recall previous ticket"
            className="flex items-center justify-center w-9 h-9 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={onNext}
            disabled={waiting.length === 0}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg disabled:opacity-30 transition-colors"
          >
            Call Next <ArrowRight className="w-4 h-4" />
          </button>
          {called && (
            <button
              onClick={onServe}
              title="Mark as served"
              className="flex items-center justify-center w-9 h-9 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors shrink-0"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Reset row — separate line so it never crowds the main actions */}
        <div className="flex justify-end mt-2">
          {isResetConfirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onReset}
                className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Confirm Reset
              </button>
              <button
                onClick={onResetCancel}
                className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onResetRequest}
              className="px-2.5 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            >
              Reset queue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function IssueTicketDialog({
  category,
  onClose,
  onIssued,
}: {
  category: QueueCategory
  onClose: () => void
  onIssued: () => void
}) {
  const [count, setCount] = useState('1')
  const [customerName, setCustomerName] = useState('')
  const [salesOrderId, setSalesOrderId] = useState('')
  const [printAfter, setPrintAfter] = useState(false)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const n = Math.max(1, parseInt(count) || 1)
    const res = await QueueTickets.issue(category.id, {
      count: n,
      customerName: customerName || undefined,
      salesOrderId: salesOrderId || undefined,
    })
    setSaving(false)
    if (!res.success) {
      alert(res.message || res.error || 'Failed')
      return
    }
    if (printAfter && res.data) {
      const printWindow = window.open('', '_blank', 'width=400,height=600')
      if (printWindow) {
        printWindow.document.write(`<html><head><title>Tickets</title><style>
          body { font-family: monospace; padding: 0; margin: 0; }
          .ticket { padding: 20px; text-align: center; page-break-after: always; border-bottom: 2px dashed #000; }
          .ticket:last-child { border-bottom: none; }
          .num { font-size: 64px; font-weight: bold; margin: 10px 0; }
          .svc { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
          .dt { font-size: 12px; color: #555; margin-top: 10px; }
        </style></head><body>`)
        for (const t of res.data.tickets) {
          printWindow.document.write(
            `<div class="ticket"><div class="svc">${category.name}</div><div class="num">#${String(t.number).padStart(3, '0')}</div><div class="dt">${new Date().toLocaleString('en-PH')}</div></div>`
          )
        }
        printWindow.document.write('</body></html>')
        printWindow.document.close()
        setTimeout(() => printWindow.print(), 200)
      }
    }
    onIssued()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[92dvh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <TicketCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Issue Ticket</h3>
              <p className="text-xs text-gray-500">{category.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal body */}
        <form onSubmit={submit} className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Number of tickets
            </label>
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Customer name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
              placeholder="Walk-in customer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Sales Order # <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              value={salesOrderId}
              onChange={(e) => setSalesOrderId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
              placeholder="SO-12345"
            />
          </div>
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={printAfter}
              onChange={(e) => setPrintAfter(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-700"
            />
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm text-gray-700">Print tickets after issuing</span>
            </div>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Issuing…
                </>
              ) : (
                <>
                  <TicketCheck className="w-3.5 h-3.5" />
                  Issue Ticket{parseInt(count) > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
