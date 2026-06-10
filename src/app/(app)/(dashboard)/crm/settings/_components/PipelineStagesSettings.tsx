'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { pipelineStagesApi } from '@/src/libs/api/crm'
import type { PipelineStage } from '@/src/schema/crm/types'

export default function PipelineStagesSettings({ tenantId }: { tenantId: string }) {
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const res = await pipelineStagesApi.list()
    if (res.success && res.data) setStages(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    const res = await pipelineStagesApi.create({
      tenantId,
      name: newName.trim(),
      orderIndex: stages.length,
      isWonStage: false,
      isLostStage: false,
    })
    setSaving(false)
    if (res.success) {
      setNewName('')
      load()
    } else {
      setError(res.error ?? 'Failed to create stage')
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this pipeline stage?')) return
    const res = await pipelineStagesApi.remove(id)
    if (res.success) load()
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">CRM Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure your sales pipeline stages.</p>
      </header>

      <section className="max-w-xl rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-[14px] font-semibold text-gray-900">Pipeline stages</h2>
        <p className="mt-1 text-[12.5px] text-gray-500">
          Stages are shown left-to-right on the pipeline view in the order below.
        </p>

        {loading ? (
          <p className="mt-4 text-[13px] text-gray-400">Loading…</p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {stages.map((s, idx) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">
                    {idx + 1}
                  </span>
                  <span className="text-[13px] font-medium text-gray-800">{s.name}</span>
                  {s.isWonStage && (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      WON
                    </span>
                  )}
                  {s.isLostStage && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                      LOST
                    </span>
                  )}
                </div>
                <button
                  onClick={() => remove(s.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {stages.length === 0 && (
              <li className="py-4 text-center text-[12.5px] text-gray-400">
                No stages yet — add your first below.
              </li>
            )}
          </ul>
        )}

        <form onSubmit={add} className="mt-4 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New stage name (e.g. Qualified)"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-prominent-orange-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      </section>
    </div>
  )
}
