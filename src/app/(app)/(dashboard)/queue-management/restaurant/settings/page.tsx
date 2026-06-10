'use client'

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Settings, Loader2, CheckCircle2, RefreshCw } from 'lucide-react'
import {
  RestaurantConfigAPI,
  type RestaurantConfig,
  type QmsMode,
  type RestaurantCapabilities,
  CAPABILITY_LABELS,
  DEFAULT_CAPABILITIES,
} from '@/src/libs/data/RestaurantData'

export default function RestaurantSettingsPage() {
  const [config, setConfig] = useState<RestaurantConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const load = useCallback(async () => {
    setLoading(true)
    const res = await RestaurantConfigAPI.get()
    if (res.success && res.data) setConfig(res.data)
    else setError(res.message ?? 'Failed to load config')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const setMode = async (mode: QmsMode) => {
    if (!config || saving) return
    setSaving(true)
    const res = await RestaurantConfigAPI.update({ mode })
    if (res.success && res.data) {
      setConfig(res.data)
      flash()
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else {
      setError(res.message ?? 'Failed to update')
    }
    setSaving(false)
  }

  const toggleCapability = async (key: keyof RestaurantCapabilities) => {
    if (!config || saving) return
    const next = { ...config.capabilities, [key]: !config.capabilities?.[key] }
    setSaving(true)
    const res = await RestaurantConfigAPI.update({ capabilities: next })
    if (res.success && res.data) {
      setConfig(res.data)
      flash()
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else {
      setError(res.message ?? 'Failed to update')
    }
    setSaving(false)
  }

  const applyRecommended = async () => {
    setApplying(true)
    const res = await RestaurantConfigAPI.recommendedSetup()
    if (res.success && res.data) {
      setConfig(res.data)
      flash()
      queryClient.invalidateQueries({ queryKey: ['restaurant-config'] })
    } else {
      setError(res.message ?? 'Failed to apply recommended setup')
    }
    setApplying(false)
  }

  const flash = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading settings...
      </div>
    )
  }

  const caps = config?.capabilities ?? DEFAULT_CAPABILITIES

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600" />
          <h1 className="text-xl font-bold text-gray-900">Restaurant Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button
            onClick={load}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Mode Toggle */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Queue Mode</h2>
        <p className="text-xs text-gray-500 mb-4">
          Switch between standard queue management and full restaurant mode.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(['STANDARD', 'RESTAURANT'] as QmsMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setMode(mode)}
              disabled={saving || config?.mode === mode}
              className={`rounded-xl border-2 px-4 py-4 text-left transition-all ${
                config?.mode === mode
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } disabled:cursor-not-allowed`}
            >
              <p
                className={`text-sm font-semibold ${config?.mode === mode ? 'text-orange-700' : 'text-gray-800'}`}
              >
                {mode === 'STANDARD' ? 'Standard' : 'Restaurant'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {mode === 'STANDARD'
                  ? 'Basic queue ticketing only'
                  : 'Tables, tabs, kitchen & more'}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Capabilities</h2>
            <p className="text-xs text-gray-500 mt-0.5">Enable the features your venue needs.</p>
          </div>
          <button
            onClick={applyRecommended}
            disabled={applying || saving}
            className="flex items-center gap-1.5 rounded-lg bg-orange-50 border border-orange-200 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition disabled:opacity-50"
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Recommended Setup
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {(Object.keys(CAPABILITY_LABELS) as Array<keyof RestaurantCapabilities>).map((key) => (
            <div key={key} className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-700">{CAPABILITY_LABELS[key]}</span>
              <button
                role="switch"
                aria-checked={caps[key]}
                onClick={() => toggleCapability(key)}
                disabled={saving}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                  caps[key] ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform ring-0 transition duration-200 ${
                    caps[key] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
