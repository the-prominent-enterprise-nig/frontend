'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  LayoutGrid,
} from 'lucide-react'
import { QueueCategories, type QueueCategory } from '@/src/libs/data/QueueData'
import {
  RestaurantConfigAPI,
  type RestaurantConfig,
  type RestaurantCapabilities,
  CAPABILITY_LABELS,
  RECOMMENDED_CAPABILITIES,
  DEFAULT_CAPABILITIES,
} from '@/src/libs/data/RestaurantData'

// ─── Restaurant Mode Section ──────────────────────────────────────────────────

function RestaurantModeSection() {
  const [config, setConfig] = useState<RestaurantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [capOpen, setCapOpen] = useState(false)
  const [showRecommended, setShowRecommended] = useState(false)
  const queryClient = useQueryClient()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await RestaurantConfigAPI.get()
    if (res.success && res.data) setConfig(res.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleMode = async () => {
    if (!config || saving) return
    const newMode = config.mode === 'RESTAURANT' ? 'STANDARD' : 'RESTAURANT'
    setSaving(true)
    setError(null)

    if (newMode === 'RESTAURANT' && config.mode === 'STANDARD') {
      setShowRecommended(true)
      setSaving(false)
      return
    }

    const res = await RestaurantConfigAPI.update({ mode: newMode })
    if (res.success && res.data) {
      setConfig(res.data)
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else setError(res.message ?? res.error ?? 'Failed to update mode')
    setSaving(false)
  }

  const applyRecommended = async () => {
    setSaving(true)
    const res = await RestaurantConfigAPI.update({
      mode: 'RESTAURANT',
      capabilities: RECOMMENDED_CAPABILITIES,
    })
    if (res.success && res.data) {
      setConfig(res.data)
      setShowRecommended(false)
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else setError(res.message ?? res.error ?? 'Failed to update')
    setSaving(false)
  }

  const applyBlank = async () => {
    setSaving(true)
    const res = await RestaurantConfigAPI.update({
      mode: 'RESTAURANT',
      capabilities: DEFAULT_CAPABILITIES,
    })
    if (res.success && res.data) {
      setConfig(res.data)
      setShowRecommended(false)
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else setError(res.message ?? res.error ?? 'Failed to update')
    setSaving(false)
  }

  const toggleCapability = async (key: keyof RestaurantCapabilities) => {
    if (!config || saving) return
    const newCaps = { ...config.capabilities, [key]: !config.capabilities?.[key] }
    setSaving(true)
    const res = await RestaurantConfigAPI.update({ capabilities: newCaps })
    if (res.success && res.data) {
      setConfig(res.data)
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else setError(res.message ?? res.error ?? 'Failed to update')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 flex items-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading restaurant mode config...
      </div>
    )
  }

  const isRestaurant = config?.mode === 'RESTAURANT'

  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden">
      {/* Header + mode toggle */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Restaurant Mode</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Switches Queue Management from a service counter into a restaurant floor system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isRestaurant ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {isRestaurant ? 'Restaurant' : 'Standard Counter'}
          </span>
          <button
            onClick={toggleMode}
            disabled={saving}
            className="disabled:opacity-50"
            title={isRestaurant ? 'Switch to Standard Counter' : 'Switch to Restaurant Mode'}
          >
            {isRestaurant ? (
              <ToggleRight className="w-9 h-9 text-amber-500" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Recommended setup prompt */}
      {showRecommended && (
        <div className="px-5 py-4 bg-amber-50 border-b border-amber-200">
          <p className="text-sm font-medium text-amber-800 mb-1">Recommended setup</p>
          <p className="text-xs text-amber-700 mb-3">
            This will enable: Floor Plan, Waitlist, Reservations, Open Tabs, Kitchen Display, and QR
            Waitlist Join. Server Sections and Feedback remain off.
          </p>
          <div className="flex gap-2">
            <button
              onClick={applyRecommended}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Applying...' : 'Use Recommended'}
            </button>
            <button
              onClick={applyBlank}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-semibold border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50"
            >
              Start blank
            </button>
            <button
              onClick={() => setShowRecommended(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Capability switches (visible only in restaurant mode) */}
      {isRestaurant && config && (
        <>
          <button
            onClick={() => setCapOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm text-gray-700 hover:bg-gray-50"
          >
            <span className="font-medium">Capabilities</span>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{Object.values(config.capabilities ?? {}).filter(Boolean).length} on</span>
              {capOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {capOpen && (
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {(Object.keys(CAPABILITY_LABELS) as Array<keyof RestaurantCapabilities>).map(
                (key) => {
                  const on = config.capabilities?.[key]
                  return (
                    <div key={key} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm text-gray-800">{CAPABILITY_LABELS[key]}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium ${on ? 'text-emerald-600' : 'text-gray-400'}`}
                        >
                          {on ? 'ON' : 'OFF'}
                        </span>
                        <button
                          onClick={() => toggleCapability(key)}
                          disabled={saving}
                          className="disabled:opacity-40"
                        >
                          {on ? (
                            <ToggleRight className="w-7 h-7 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-7 h-7 text-gray-300" />
                          )}
                        </button>
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
            <Link
              href="/queue-management/restaurant"
              className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900"
            >
              <LayoutGrid className="w-4 h-4" />
              Open Restaurant Floor Board
            </Link>
          </div>
        </>
      )}

      {error && (
        <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {error}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QueueSettings() {
  const [items, setItems] = useState<QueueCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCounter, setEditCounter] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCounter, setNewCounter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await QueueCategories.list()
    setItems(res.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const startEdit = (q: QueueCategory) => {
    setEditingId(q.id)
    setEditName(q.name)
    setEditCounter(q.counterName ?? '')
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditCounter('')
  }
  const saveEdit = async (id: string) => {
    if (!editName.trim()) {
      setError('Queue name cannot be empty')
      return
    }
    const res = await QueueCategories.update(id, {
      name: editName.trim(),
      counterName: editCounter || null,
    })
    if (!res.success) {
      setError(res.message || res.error || 'Update failed')
      return
    }
    setError(null)
    cancelEdit()
    load()
  }
  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setError('Queue name cannot be empty')
      return
    }
    const res = await QueueCategories.create({
      name: newName.trim(),
      counterName: newCounter || undefined,
    })
    if (!res.success) {
      setError(res.message || res.error || 'Create failed')
      return
    }
    setError(null)
    setNewName('')
    setNewCounter('')
    setCreating(false)
    load()
  }
  const remove = async (id: string) => {
    await QueueCategories.remove(id)
    setDeleteConfirm(null)
    load()
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/queue-management" className="p-2 rounded hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">Queue Settings</h2>
            <p className="text-sm text-gray-500">Configure queue mode and service queues.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => {
              setCreating(true)
              setError(null)
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Queue
          </button>
        </div>
      </div>

      <RestaurantModeSection />

      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
        Service Queues
      </h3>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {creating && (
        <form
          onSubmit={create}
          className="bg-white border border-purple-300 rounded-lg p-4 mb-3 flex flex-wrap items-end gap-2"
        >
          <label className="block flex-1 min-w-[180px]">
            <span className="block text-xs font-medium text-gray-600 mb-1">Queue name *</span>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="Cashier, Returns, Service Desk..."
            />
          </label>
          <label className="block flex-1 min-w-[160px]">
            <span className="block text-xs font-medium text-gray-600 mb-1">Counter</span>
            <input
              value={newCounter}
              onChange={(e) => setNewCounter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="Counter 1"
            />
          </label>
          <div className="flex gap-1">
            <button
              type="submit"
              className="px-3 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false)
                setNewName('')
                setNewCounter('')
              }}
              className="px-3 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Queue</th>
              <th className="px-3 py-2 text-left">Counter</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                  No queues yet.
                </td>
              </tr>
            ) : (
              items.map((q) => (
                <tr key={q.id}>
                  {editingId === q.id ? (
                    <>
                      <td className="px-3 py-2">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={editCounter}
                          onChange={(e) => setEditCounter(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => saveEdit(q.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-medium text-gray-900">{q.name}</td>
                      <td className="px-3 py-2 text-gray-600">{q.counterName || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => startEdit(q)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {deleteConfirm === q.id ? (
                            <>
                              <button
                                onClick={() => remove(q.id)}
                                className="px-2 py-1 text-xs font-semibold bg-red-600 text-white rounded"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(q.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
