'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  createPosOverrideReason,
  getPosOverrideReasons,
  updatePosOverrideReason,
  type PosOverrideReason,
} from '../../../_actions/pos-actions'

type Props = { initial: PosOverrideReason[]; initialError: string }

/** The reasons a cashier picks from when a sale carries a price override
 * (Scenario 71). A reason is never deleted — sales already rung up under it
 * keep pointing at it — so a retired one is switched off instead, which only
 * takes it out of the checkout dropdown. */
export function OverrideReasonsManager({ initial, initialError }: Props) {
  const [reasons, setReasons] = useState(initial)
  const [error, setError] = useState(initialError)
  const [newName, setNewName] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  async function reload() {
    try {
      const res = await getPosOverrideReasons()
      if (res.success && res.data) setReasons(res.data)
    } catch {
      // Leaves what is on screen; the next action or a refresh brings it back in line.
    }
  }

  // Server actions run one at a time and Next cancels one that a newer call
  // supersedes — the call then throws instead of returning {success:false}. Left
  // alone that leaves an optimistic checkbox showing a change nothing saved, so
  // every write here treats a throw as a failed save and resyncs from the server.
  async function attempt<T extends { success?: boolean; error?: string }>(
    run: () => Promise<T>
  ): Promise<T | { success: false; error: string }> {
    try {
      return await run()
    } catch {
      return { success: false, error: 'The change did not reach the server — please try again.' }
    }
  }

  async function add() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError('')
    const res = await attempt(() => createPosOverrideReason(name))
    setBusy(false)
    if (!res.success) {
      setError(res.error ?? 'Could not add the reason.')
      await reload()
      return
    }
    setNewName('')
    await reload()
  }

  async function rename(reason: PosOverrideReason) {
    const name = (drafts[reason.id] ?? reason.name).trim()
    if (!name || name === reason.name) return
    setBusy(true)
    setError('')
    const res = await attempt(() => updatePosOverrideReason(reason.id, { name }))
    setBusy(false)
    if (!res.success) {
      setError(res.error ?? 'Could not rename the reason.')
      await reload()
      return
    }
    setDrafts((d) => {
      const next = { ...d }
      delete next[reason.id]
      return next
    })
    await reload()
  }

  // The checkbox follows the click at once and goes back if the server says no,
  // instead of snapping back to its old state for the length of the request.
  async function toggle(reason: PosOverrideReason) {
    const isActive = !reason.isActive
    const setActive = (value: boolean) =>
      setReasons((prev) => prev.map((r) => (r.id === reason.id ? { ...r, isActive: value } : r)))
    setBusy(true)
    setError('')
    setActive(isActive)
    const res = await attempt(() => updatePosOverrideReason(reason.id, { isActive }))
    setBusy(false)
    if (!res.success) {
      setActive(reason.isActive)
      setError(res.error ?? 'Could not update the reason.')
      await reload()
      return
    }
    await reload()
  }

  return (
    <div className="min-h-full px-6 py-6">
      <h2 className="text-xl font-bold text-prominent-purple-900">Override Reasons</h2>
      <p className="mt-1 text-sm text-gray-500">
        What a cashier picks from when a sale carries a price override. Reasons are never deleted —
        switch one off to take it out of the checkout dropdown while old sales keep it.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="new-reason" className="mb-1 block text-xs font-semibold text-gray-600">
            New reason
          </label>
          <input
            id="new-reason"
            className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            placeholder="e.g. Anniversary sale"
            maxLength={100}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={busy || !newName.trim()}
          className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800 disabled:opacity-50"
        >
          <Plus size={14} />
          Add reason
        </button>
      </div>

      <ul className="mt-6 divide-y divide-gray-100 border-t border-gray-200" data-testid="reasons">
        {reasons.map((r) => {
          const draft = drafts[r.id] ?? r.name
          const changed = draft.trim() !== r.name
          return (
            <li key={r.id} className="flex items-center gap-4 py-3" data-testid="reason-row">
              <input
                aria-label={`Name of ${r.name}`}
                className={`min-w-0 flex-1 rounded-lg border border-transparent px-3 py-2 text-sm outline-none hover:border-purple-100 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 ${
                  r.isActive ? 'text-gray-800' : 'text-gray-400'
                }`}
                maxLength={100}
                value={draft}
                onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && rename(r)}
              />
              {changed && (
                <button
                  type="button"
                  onClick={() => rename(r)}
                  disabled={busy || !draft.trim()}
                  className="text-sm font-medium text-purple-700 hover:underline disabled:opacity-50"
                >
                  Save name
                </button>
              )}
              <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={r.isActive}
                  disabled={busy}
                  onChange={() => toggle(r)}
                  aria-label={`Offer ${r.name} at checkout`}
                />
                Offered at checkout
              </label>
            </li>
          )
        })}
        {reasons.length === 0 && (
          <li className="py-6 text-sm text-gray-500">No reasons yet — add the first one above.</li>
        )}
      </ul>
    </div>
  )
}
