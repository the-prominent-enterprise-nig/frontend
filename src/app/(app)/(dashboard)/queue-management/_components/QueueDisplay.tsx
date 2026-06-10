'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Maximize2, Settings2, X, Check } from 'lucide-react'
import {
  QueueCategories,
  QueueTickets,
  type QueueCategory,
  type QueueTicket,
} from '@/src/libs/data/QueueData'

const POLL_MS = 10000
const FILTER_STORAGE_KEY = 'queueDisplayFilter'
const PRESET_STORAGE_KEY = 'queueDisplayPresets'

// ─── Presets ──────────────────────────────────────────────────────────────────

type PresetKey = 'general' | 'medical' | 'bank' | 'restaurant' | 'minimal'

const PRESETS: Record<PresetKey, { label: string; useCases: string }> = {
  general: { label: 'General', useCases: 'Retail, service counters' },
  medical: { label: 'Medical', useCases: 'Clinics, hospitals, pharmacies' },
  bank: { label: 'Bank / Gov', useCases: 'Banks, government, licensing offices' },
  restaurant: { label: 'Restaurant', useCases: 'F&B, order pickup, delis' },
  minimal: { label: 'Minimal', useCases: 'Simple, uncluttered display' },
}

const PRESET_ORDER: PresetKey[] = ['general', 'medical', 'bank', 'restaurant', 'minimal']

// ─── Main component ───────────────────────────────────────────────────────────

export default function QueueDisplay() {
  const [selectedId, setSelectedId] = useState<string>('')
  const [allCategories, setAllCategories] = useState<QueueCategory[]>([])
  const [categories, setCategories] = useState<QueueCategory[]>([])
  const [ticketsByCategory, setTicketsByCategory] = useState<Record<string, QueueTicket[]>>({})
  const [now, setNow] = useState(new Date())
  const [presetMap, setPresetMap] = useState<Record<string, PresetKey>>({})
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const filter = window.localStorage.getItem(FILTER_STORAGE_KEY)
    if (filter) setSelectedId(filter)
    try {
      const stored = JSON.parse(window.localStorage.getItem(PRESET_STORAGE_KEY) ?? '{}')
      setPresetMap(stored)
    } catch {
      /* ignore */
    }
  }, [])

  const setPreset = (categoryId: string, preset: PresetKey) => {
    setPresetMap((prev) => {
      const next = { ...prev, [categoryId]: preset }
      if (typeof window !== 'undefined')
        window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const load = useCallback(async () => {
    const cats = await QueueCategories.list()
    const all = cats.data ?? []
    setAllCategories(all)
    const list = selectedId ? all.filter((c) => c.id === selectedId) : all
    setCategories(list)
    const tickets = await Promise.all(list.map((c) => QueueTickets.list(c.id)))
    const map: Record<string, QueueTicket[]> = {}
    list.forEach((c, i) => {
      map[c.id] = tickets[i].data ?? []
    })
    setTicketsByCategory((prev) => {
      for (const c of list) {
        const newCalled = (map[c.id] ?? []).find((t) => t.status === 'CALLED')
        const oldCalled = (prev[c.id] ?? []).find((t) => t.status === 'CALLED')
        if (newCalled && newCalled.id !== oldCalled?.id) {
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
            /* ignore */
          }
        }
      }
      return map
    })
  }, [selectedId])

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
    const clock = setInterval(() => setNow(new Date()), 1000)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(clock)
    }
  }, [load])

  const enterFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen().catch(() => {})
  }
  const onSelectChange = (id: string) => {
    setSelectedId(id)
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(FILTER_STORAGE_KEY, id)
      else window.localStorage.removeItem(FILTER_STORAGE_KEY)
    }
  }

  const count = categories.length
  const cols =
    count <= 1
      ? 'grid-cols-1'
      : count === 2
        ? 'grid-cols-2'
        : count <= 4
          ? 'grid-cols-2 grid-rows-2'
          : count <= 6
            ? 'grid-cols-3 grid-rows-2'
            : 'grid-cols-3 grid-rows-3'

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header bar */}
      <div className="flex-none border-b border-white/10 bg-black/30 backdrop-blur">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/queue-management"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Now Serving</h1>
              <p className="hidden sm:block text-xs text-slate-400">
                Please wait until your number is called
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <select
              value={selectedId}
              onChange={(e) => onSelectChange(e.target.value)}
              className="px-2 sm:px-3 py-2 text-xs sm:text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-30 sm:max-w-none"
            >
              <option value="" className="bg-slate-900">
                All queues
              </option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.name}
                  {c.counterName ? ` — Counter ${c.counterName}` : ''}
                </option>
              ))}
            </select>
            <div className="hidden sm:block text-right">
              <div className="text-3xl font-mono font-bold tabular-nums">
                {now.toLocaleTimeString('en-PH', { hour12: false })}
              </div>
              <div className="text-xs text-slate-400">
                {now.toLocaleDateString('en-PH', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
            <button
              onClick={() => setShowPanel((v) => !v)}
              title="Customize display style"
              className={`p-2 rounded-lg transition ${showPanel ? 'bg-white/20 text-white' : 'bg-white/5 hover:bg-white/10 text-slate-300'}`}
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button
              onClick={enterFullscreen}
              title="Toggle fullscreen"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Display style panel */}
      {showPanel && (
        <div className="flex-none border-b border-white/10 bg-slate-900/90 backdrop-blur px-4 sm:px-6 py-4 overflow-y-auto max-h-[50vh]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-white">Display Style</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose how each queue appears on screen. Saved in your browser.
              </p>
            </div>
            <button
              onClick={() => setShowPanel(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {allCategories.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No queues configured yet.</p>
          ) : (
            <div className="space-y-4">
              {allCategories.map((c) => {
                const current = presetMap[c.id] ?? 'general'
                return (
                  <div key={c.id}>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-sm font-semibold text-white">{c.name}</span>
                      {c.counterName && (
                        <span className="text-xs text-slate-500">Counter {c.counterName}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_ORDER.map((key) => {
                        const p = PRESETS[key]
                        const active = current === key
                        return (
                          <button
                            key={key}
                            onClick={() => setPreset(c.id, key)}
                            title={p.useCases}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                              active
                                ? 'bg-white/15 border-white/40 text-white'
                                : 'bg-transparent border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
                            }`}
                          >
                            {p.label}
                            {active && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-slate-600 mt-1.5">{PRESETS[current].useCases}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      <div className="flex-1 min-h-0 overflow-hidden p-3 sm:p-4 md:p-6">
        {categories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xl">
            {selectedId ? (
              <>
                <p>Selected queue not found.</p>
                <button
                  onClick={() => onSelectChange('')}
                  className="mt-4 px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg"
                >
                  Show all queues
                </button>
              </>
            ) : (
              'No active queues.'
            )}
          </div>
        ) : (
          <div className={`h-full grid ${cols} gap-3 sm:gap-4`}>
            {categories.map((c) => {
              const tickets = ticketsByCategory[c.id] ?? []
              const called = tickets.find((t) => t.status === 'CALLED')
              const waiting = tickets.filter((t) => t.status === 'WAITING')
              const preset = presetMap[c.id] ?? 'general'
              return (
                <DisplayCard
                  key={c.id}
                  category={c}
                  called={called}
                  waiting={waiting}
                  preset={preset}
                  totalCards={count}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-none border-t border-white/10 bg-black/40 backdrop-blur px-6 py-1.5 text-center text-xs text-slate-400">
        Updates automatically · Listen for the chime when your number is called
      </div>
    </div>
  )
}

// ─── Card dispatcher ──────────────────────────────────────────────────────────

function DisplayCard({
  category,
  called,
  waiting,
  preset,
  totalCards,
}: {
  category: QueueCategory
  called: QueueTicket | undefined
  waiting: QueueTicket[]
  preset: PresetKey
  totalCards: number
}) {
  const numStr = called ? `#${String(called.number).padStart(3, '0')}` : '—'
  const numSize =
    totalCards === 1
      ? 'text-[9rem] sm:text-[13rem]'
      : totalCards === 2
        ? 'text-[6rem] sm:text-[9rem]'
        : totalCards <= 4
          ? 'text-[4rem] sm:text-[6rem]'
          : 'text-4xl sm:text-5xl'

  if (preset === 'minimal')
    return (
      <MinimalCard
        category={category}
        called={called}
        waiting={waiting}
        numStr={numStr}
        numSize={numSize}
      />
    )
  if (preset === 'medical')
    return (
      <MedicalCard
        category={category}
        called={called}
        waiting={waiting}
        numStr={numStr}
        numSize={numSize}
      />
    )
  if (preset === 'bank')
    return (
      <BankCard
        category={category}
        called={called}
        waiting={waiting}
        numStr={numStr}
        numSize={numSize}
      />
    )
  if (preset === 'restaurant')
    return (
      <RestaurantCard
        category={category}
        called={called}
        waiting={waiting}
        numStr={numStr}
        numSize={numSize}
      />
    )
  return (
    <GeneralCard
      category={category}
      called={called}
      waiting={waiting}
      numStr={numStr}
      numSize={numSize}
    />
  )
}

interface CardProps {
  category: QueueCategory
  called: QueueTicket | undefined
  waiting: QueueTicket[]
  numStr: string
  numSize: string
}

// ─── General ──────────────────────────────────────────────────────────────────
// Dark board · service name · giant number · up-next badges

function GeneralCard({ category, called, waiting, numStr, numSize }: CardProps) {
  return (
    <div className="min-h-0 flex flex-col rounded-xl sm:rounded-2xl bg-white/4 border border-white/10 overflow-hidden shadow-2xl">
      <div className="flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-linear-to-r from-purple-600/30 to-blue-600/20 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm sm:text-base md:text-lg font-bold uppercase tracking-wider truncate">
            {category.name}
          </div>
          {category.counterName && (
            <div className="text-xs text-slate-300/80">Counter {category.counterName}</div>
          )}
        </div>
        <span className="text-xs text-slate-300/60 whitespace-nowrap shrink-0">
          {waiting.length} waiting
        </span>
      </div>
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2 text-center">
        <span className="text-xs uppercase tracking-widest text-slate-400 mb-1">Now Serving</span>
        <span
          className={`${numSize} leading-none font-black tabular-nums ${called ? 'bg-linear-to-br from-white to-slate-300 bg-clip-text text-transparent' : 'text-slate-700'}`}
        >
          {numStr}
        </span>
        {called?.customerName && (
          <span className="mt-2 text-sm md:text-base text-slate-300 truncate max-w-full">
            {called.customerName}
          </span>
        )}
      </div>
      <div className="flex-none px-4 sm:px-5 py-2 sm:py-3 bg-black/20 border-t border-white/10">
        <span className="text-xs uppercase tracking-widest text-slate-400 block mb-1.5">
          Up Next
        </span>
        {waiting.length === 0 ? (
          <span className="text-xs italic text-slate-500">No tickets waiting</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {waiting.slice(0, 4).map((t, i) => (
              <span
                key={t.id}
                className={`px-2.5 py-1 rounded-lg font-mono text-sm sm:text-lg tabular-nums font-bold ${i === 0 ? 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-400/40' : 'bg-white/5 text-slate-300'}`}
              >
                #{String(t.number).padStart(3, '0')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Medical ──────────────────────────────────────────────────────────────────
// Formal announcement style · "NOW CALLING TICKET #045" · "Please proceed to…"

function MedicalCard({ category, called, waiting, numStr, numSize }: CardProps) {
  return (
    <div className="min-h-0 flex flex-col rounded-xl sm:rounded-2xl bg-slate-900 border border-cyan-900/40 overflow-hidden shadow-2xl">
      {/* Thin service name bar */}
      <div className="flex-none flex items-center justify-between px-4 sm:px-6 py-2 border-b border-cyan-900/40 bg-cyan-950/30">
        <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-400 truncate">
          {category.name}
        </span>
        <span className="text-xs text-slate-500 shrink-0 ml-2">{waiting.length} waiting</span>
      </div>

      {/* Announcement area */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-8 py-4 gap-3 text-center">
        {called ? (
          <>
            <span className="text-xs sm:text-sm uppercase tracking-widest text-slate-400">
              Now Calling
            </span>
            <span className={`${numSize} leading-none font-black tabular-nums text-white`}>
              {numStr}
            </span>
            {called.customerName && (
              <span className="text-sm sm:text-xl font-medium text-slate-200">
                {called.customerName}
              </span>
            )}
            {category.counterName && (
              <div className="mt-2 sm:mt-4 px-4 sm:px-8 py-3 sm:py-4 rounded-xl border border-cyan-700/40 bg-cyan-950/50 text-center">
                <p className="text-xs sm:text-sm text-cyan-500 uppercase tracking-wider mb-1">
                  Please Proceed To
                </p>
                <p className="text-xl sm:text-3xl font-black text-cyan-300 tracking-wide">
                  Counter {category.counterName}
                </p>
              </div>
            )}
          </>
        ) : (
          <span className={`${numSize} leading-none font-black text-slate-700`}>—</span>
        )}
      </div>

      {/* Next in line */}
      <div className="flex-none px-4 sm:px-6 py-2.5 bg-cyan-950/20 border-t border-cyan-900/30">
        <span className="text-xs uppercase tracking-widest text-slate-500 block mb-1.5">
          Next in Line
        </span>
        {waiting.length === 0 ? (
          <span className="text-xs italic text-slate-600">No tickets waiting</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {waiting.slice(0, 4).map((t, i) => (
              <span
                key={t.id}
                className={`px-2.5 py-1 rounded-lg font-mono text-sm sm:text-base tabular-nums font-bold ${i === 0 ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/30' : 'bg-white/5 text-slate-400'}`}
              >
                #{String(t.number).padStart(3, '0')}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bank / Government ────────────────────────────────────────────────────────
// Counter-first · the window/counter number is the hero · formal navy

function BankCard({ category, called, waiting, numStr, numSize }: CardProps) {
  return (
    <div className="min-h-0 flex flex-col rounded-xl sm:rounded-2xl bg-slate-950 border border-blue-900/40 overflow-hidden shadow-2xl">
      {/* Counter hero */}
      <div className="flex-none flex flex-col items-center justify-center py-3 sm:py-4 bg-linear-to-b from-blue-900/40 to-transparent border-b border-blue-800/30">
        {category.counterName ? (
          <>
            <span className="text-xs uppercase tracking-widest text-blue-400/70 mb-0.5">
              Window / Counter
            </span>
            <span className="text-3xl sm:text-5xl md:text-6xl font-black text-blue-200 tracking-wide">
              {category.counterName}
            </span>
          </>
        ) : (
          <span className="text-sm sm:text-base font-bold uppercase tracking-widest text-blue-300">
            {category.name}
          </span>
        )}
        {category.counterName && (
          <span className="text-xs text-slate-500 mt-0.5 uppercase tracking-wider">
            {category.name}
          </span>
        )}
      </div>

      {/* Divider line */}
      <div className="flex-none h-px mx-6 bg-linear-to-r from-transparent via-blue-700/50 to-transparent" />

      {/* Number */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2 text-center gap-1">
        <span className="text-xs uppercase tracking-widest text-slate-500">Now Serving</span>
        <span
          className={`${numSize} leading-none font-black tabular-nums ${called ? 'text-blue-100' : 'text-slate-800'}`}
        >
          {numStr}
        </span>
        {called?.customerName && (
          <span className="text-sm sm:text-base text-slate-400 mt-1">{called.customerName}</span>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none px-4 sm:px-6 py-2.5 bg-blue-950/30 border-t border-blue-900/30 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-widest text-slate-600 block mb-1">Next</span>
          <div className="flex gap-1.5">
            {waiting.length === 0 ? (
              <span className="text-xs italic text-slate-700">None</span>
            ) : (
              waiting.slice(0, 3).map((t, i) => (
                <span
                  key={t.id}
                  className={`px-2 py-0.5 rounded font-mono text-sm tabular-nums font-bold ${i === 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-500'}`}
                >
                  #{String(t.number).padStart(3, '0')}
                </span>
              ))
            )}
          </div>
        </div>
        <span className="text-xs text-slate-600">{waiting.length} waiting</span>
      </div>
    </div>
  )
}

// ─── Restaurant ───────────────────────────────────────────────────────────────
// Order-ready board · multiple order tiles · warm amber

function RestaurantCard({ category, called, waiting, numStr, numSize }: CardProps) {
  return (
    <div className="min-h-0 flex flex-col rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-amber-950/60 border border-amber-800/40">
      {/* Header */}
      <div className="flex-none px-4 sm:px-5 py-2 sm:py-2.5 bg-linear-to-r from-amber-700/40 to-orange-700/30 border-b border-amber-700/30 flex items-center justify-between gap-2">
        <span className="text-sm sm:text-base font-bold uppercase tracking-wider text-amber-200 truncate">
          {category.name}
        </span>
        {called && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/30 whitespace-nowrap shrink-0 animate-pulse">
            ● ORDER READY
          </span>
        )}
      </div>

      {/* Current order */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-4 py-2 text-center">
        {called ? (
          <>
            <span className="text-xs uppercase tracking-widest text-amber-500/80 mb-1">
              Now Ready
            </span>
            <span className={`${numSize} leading-none font-black tabular-nums text-amber-100`}>
              {numStr}
            </span>
            {called.customerName && (
              <span className="text-sm sm:text-lg text-amber-300/80 mt-1 truncate max-w-full">
                {called.customerName}
              </span>
            )}
            {category.counterName && (
              <span className="text-xs text-amber-600 mt-1">Counter {category.counterName}</span>
            )}
          </>
        ) : (
          <span className={`${numSize} leading-none font-black text-amber-900/50`}>—</span>
        )}
      </div>

      {/* Also ready / queue tiles */}
      {waiting.length > 0 && (
        <div className="flex-none px-4 sm:px-5 py-3 bg-black/20 border-t border-amber-800/30">
          <span className="text-xs uppercase tracking-widest text-amber-600/80 block mb-2">
            In Queue
          </span>
          <div className="flex flex-wrap gap-2">
            {waiting.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="px-3 py-2 rounded-lg bg-amber-900/40 border border-amber-700/30 text-center"
              >
                <span className="font-mono font-black text-sm sm:text-base tabular-nums text-amber-300">
                  #{String(t.number).padStart(3, '0')}
                </span>
                {t.customerName && (
                  <div className="text-xs text-amber-700 truncate max-w-[5rem] mt-0.5">
                    {t.customerName}
                  </div>
                )}
              </div>
            ))}
            {waiting.length > 6 && (
              <div className="px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-800/20 flex items-center">
                <span className="text-xs text-amber-700">+{waiting.length - 6} more</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Minimal ──────────────────────────────────────────────────────────────────
// Number fills the entire card · nothing else · works at any distance

function MinimalCard({ category, called, waiting, numStr, numSize }: CardProps) {
  return (
    <div className="min-h-0 flex flex-col rounded-xl sm:rounded-2xl bg-black border border-white/5 overflow-hidden shadow-2xl">
      {/* Tiny label row */}
      <div className="flex-none flex items-center justify-between px-4 pt-3 pb-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-600 truncate">
          {category.name}
        </span>
        <span className="text-xs text-slate-800 shrink-0 ml-2">{waiting.length}</span>
      </div>
      {/* Number dominates */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <span
          className={`${numSize} font-black tabular-nums leading-none ${called ? 'text-white' : 'text-slate-900'}`}
        >
          {numStr}
        </span>
      </div>
      <div className="flex-none h-2" />
    </div>
  )
}
