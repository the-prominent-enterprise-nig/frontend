'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  BranchesApi,
  DepartmentsApi,
  type BranchLite,
  type Department,
} from '@/src/libs/data/OrgStructureData'

/**
 * Departments, maintained per branch — "per branch → department".
 *
 * There is no Divisions section: an expense line's Division is one pick from
 * the branches and departments listed together, so this page plus the
 * existing Branches page are between them the whole option list.
 *
 * Deletes are soft server-side, so retiring a department doesn't orphan the
 * expense lines already tagged with it.
 */
export default function DepartmentsSection() {
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [branchId, setBranchId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [savingDept, setSavingDept] = useState(false)

  useEffect(() => {
    // No default branch: '' means Company-wide, which is where the client's
    // own Division list lives and so the more useful landing view.
    BranchesApi.list().then((r) => setBranches(r.data?.data ?? []))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // The API filters by branch when given one and returns everything when
    // not, so the company-wide view asks for all and keeps the unowned ones.
    const d = await DepartmentsApi.list({
      branchId: branchId || undefined,
      includeInactive: true,
    })
    if (d.success && d.data) {
      setDepartments(branchId ? d.data.data : d.data.data.filter((x) => !x.branchId))
    } else setError(d.message || d.error || 'Failed to load departments')
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptName.trim()) return
    setSavingDept(true)
    setError(null)
    const res = await DepartmentsApi.create({
      branchId: branchId || undefined,
      name: deptName.trim(),
      code: deptCode.trim() || undefined,
    })
    setSavingDept(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to add department')
      return
    }
    setDeptName('')
    setDeptCode('')
    load()
  }

  const removeDepartment = async (id: string) => {
    setError(null)
    const res = await DepartmentsApi.remove(id)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to retire department')
      return
    }
    load()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Departments</h1>
        <p className="mt-1 text-sm text-gray-500">
          A department is company-wide, or belongs to one branch. Expense lines are tagged with a
          Division, which is one pick from your branches and these departments listed together.
        </p>
      </header>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-medium text-gray-600">Branch</span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">— Company-wide —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Departments</h2>
        </div>
        <form onSubmit={addDepartment} className="flex flex-wrap items-end gap-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Name</span>
            <input
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="e.g. Sales"
              className="w-56 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Code</span>
            <input
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
              placeholder="Optional"
              className="w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={savingDept || !deptName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingDept ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </form>
        <Rows
          loading={loading}
          empty="No departments in this branch yet."
          rows={departments.map((d) => ({
            id: d.id,
            primary: d.name,
            secondary: d.code ?? '',
            onRemove: () => removeDepartment(d.id),
          }))}
        />
      </section>
    </div>
  )
}

function Rows({
  loading,
  empty,
  rows,
}: {
  loading: boolean
  empty: string
  rows: { id: string; primary: string; secondary: string; onRemove: () => void }[]
}) {
  if (loading) {
    return <p className="px-4 py-6 text-sm text-gray-400">Loading…</p>
  }
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-sm text-gray-400">{empty}</p>
  }
  return (
    <ul className="divide-y divide-gray-100 border-t border-gray-200">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
          <div>
            <p className="text-sm text-gray-900">{r.primary}</p>
            {r.secondary && <p className="text-xs text-gray-400">{r.secondary}</p>}
          </div>
          <button
            onClick={r.onRemove}
            aria-label={`Retire ${r.primary}`}
            className="rounded p-1 text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}
