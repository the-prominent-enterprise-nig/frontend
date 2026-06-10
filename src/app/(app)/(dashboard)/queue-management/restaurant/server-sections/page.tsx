'use client'

import { useCallback, useEffect, useState } from 'react'
import { UsersRound, Plus, Loader2, RefreshCw, Trash2, Lightbulb } from 'lucide-react'
import {
  RestaurantServerSections,
  RestaurantSections,
  type ServerSection,
  type ServerCoverCount,
  type RestaurantSection,
  type AssignServerSectionInput,
} from '@/src/libs/data/RestaurantData'
import { CapabilityGuard } from '../_components/CapabilityGuard'

const TODAY = new Date().toISOString().slice(0, 10)

export default function ServerSectionsPage() {
  const [shiftDate, setShiftDate] = useState(TODAY)
  const [assignments, setAssignments] = useState<ServerSection[]>([])
  const [coverCounts, setCoverCounts] = useState<ServerCoverCount[]>([])
  const [sections, setSections] = useState<RestaurantSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AssignServerSectionInput>({
    serverId: '',
    sectionId: '',
    shiftDate: TODAY,
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [suggestion, setSuggestion] = useState<{ serverId: string; serverName: string } | null>(
    null
  )
  const [suggestPartySize, setSuggestPartySize] = useState(2)
  const [loadingSuggest, setLoadingSuggest] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [assignRes, countsRes, sectRes] = await Promise.all([
      RestaurantServerSections.list(shiftDate),
      RestaurantServerSections.coverCounts(shiftDate),
      RestaurantSections.list(),
    ])
    if (assignRes.success && assignRes.data) setAssignments(assignRes.data)
    if (countsRes.success && countsRes.data) setCoverCounts(countsRes.data)
    if (sectRes.success && sectRes.data) setSections(sectRes.data)
    if (!assignRes.success) setError(assignRes.message ?? 'Failed to load')
    setLoading(false)
  }, [shiftDate])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!form.serverId.trim()) {
      setFormError('Server ID / name is required')
      return
    }
    if (!form.sectionId) {
      setFormError('Select a section')
      return
    }
    setFormError('')
    setSubmitting(true)
    const res = await RestaurantServerSections.assign({ ...form, shiftDate })
    if (res.success) {
      setShowForm(false)
      setForm({ serverId: '', sectionId: '', shiftDate: TODAY })
      load()
    } else {
      setFormError(res.message ?? 'Failed to assign')
    }
    setSubmitting(false)
  }

  const remove = async (id: string) => {
    await RestaurantServerSections.remove(id)
    setAssignments((prev) => prev.filter((a) => a.id !== id))
  }

  const suggest = async () => {
    setLoadingSuggest(true)
    const res = await RestaurantServerSections.suggest(suggestPartySize)
    if (res.success && res.data) setSuggestion(res.data)
    setLoadingSuggest(false)
  }

  return (
    <CapabilityGuard capability="serverSections">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-gray-600" />
            <h1 className="text-xl font-bold text-gray-900">Server Sections</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
            >
              <Plus className="h-4 w-4" /> Assign
            </button>
          </div>
        </div>

        {/* Shift date filter */}
        <div className="flex items-center gap-3 mb-5">
          <label className="text-sm font-medium text-gray-600">Shift Date</label>
          <input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Suggest server */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">Suggest a Server</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Party size</label>
              <input
                type="number"
                min={1}
                value={suggestPartySize}
                onChange={(e) => setSuggestPartySize(Number(e.target.value))}
                className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <button
              onClick={suggest}
              disabled={loadingSuggest}
              className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {loadingSuggest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Suggest
            </button>
            {suggestion && (
              <span className="text-sm font-medium text-gray-800">
                → <span className="text-orange-600">{suggestion.serverName}</span>
              </span>
            )}
          </div>
        </section>

        {/* Cover counts */}
        {coverCounts.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-4 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Cover Counts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {coverCounts.map((cc) => (
                <div
                  key={cc.serverId}
                  className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-gray-900">{cc.serverName}</p>
                  <p className="text-2xl font-black text-orange-500 tabular-nums">
                    {cc.coverCount}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cc.sectionIds.length} section{cc.sectionIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Assignments */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <UsersRound className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">No assignments for this shift</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{a.serverName}</p>
                  <p className="text-xs text-gray-500">{a.sectionName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-orange-500 tabular-nums">
                    {a.coverCount} covers
                  </span>
                  <button
                    onClick={() => remove(a.id)}
                    className="rounded-lg p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assign Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 mx-4">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-gray-900">Assign Server to Section</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-1.5 hover:bg-gray-100 transition"
                >
                  ×
                </button>
              </div>

              {formError && (
                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Server ID / Name *
                  </label>
                  <input
                    value={form.serverId}
                    onChange={(e) => setForm({ ...form, serverId: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    placeholder="Server name or ID"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Section *
                  </label>
                  {sections.length > 0 ? (
                    <select
                      value={form.sectionId}
                      onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="">Select section</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.sectionId}
                      onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="Section ID"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CapabilityGuard>
  )
}
