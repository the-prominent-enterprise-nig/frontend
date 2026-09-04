'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  BranchesApi,
  DepartmentsApi,
  DivisionsApi,
  type BranchLite,
  type Department,
  type Division,
} from '@/src/libs/data/OrgStructureData'

/**
 * The payroll dimensions, maintained per branch: "per branch → department",
 * then divisions under those.
 *
 * A branch is picked first and everything below is scoped to it, mirroring
 * how the Expense form cascades — a department belongs to exactly one
 * branch, and a division to that branch plus (optionally) one of its
 * departments. A division left on "All departments" is branch-wide and
 * shows up under every department in that branch.
 *
 * Deletes are soft server-side, so retiring a department doesn't orphan the
 * expenses already tagged with it. Retiring one takes its divisions with it.
 */
export default function DepartmentsSection() {
  const [branches, setBranches] = useState<BranchLite[]>([])
  const [branchId, setBranchId] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [divisions, setDivisions] = useState<Division[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deptName, setDeptName] = useState('')
  const [deptCode, setDeptCode] = useState('')
  const [savingDept, setSavingDept] = useState(false)

  const [divName, setDivName] = useState('')
  const [divCode, setDivCode] = useState('')
  const [divDepartmentId, setDivDepartmentId] = useState('')
  const [savingDiv, setSavingDiv] = useState(false)

  useEffect(() => {
    BranchesApi.list().then((r) => {
      const list = r.data?.data ?? []
      setBranches(list)
      // Land on a usable branch rather than an empty page.
      if (list.length > 0) setBranchId((current) => current || list[0].id)
    })
  }, [])

  const load = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setError(null)
    const [d, v] = await Promise.all([
      DepartmentsApi.list({ branchId, includeInactive: true }),
      DivisionsApi.list({ branchId, includeInactive: true }),
    ])
    if (d.success && d.data) setDepartments(d.data.data)
    else setError(d.message || d.error || 'Failed to load departments')
    if (v.success && v.data) setDivisions(v.data.data)
    setLoading(false)
  }, [branchId])

  useEffect(() => {
    load()
  }, [load])

  const addDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId || !deptName.trim()) return
    setSavingDept(true)
    setError(null)
    const res = await DepartmentsApi.create({
      branchId,
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

  const addDivision = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!branchId || !divName.trim()) return
    setSavingDiv(true)
    setError(null)
    const res = await DivisionsApi.create({
      branchId,
      departmentId: divDepartmentId || undefined,
      name: divName.trim(),
      code: divCode.trim() || undefined,
    })
    setSavingDiv(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to add division')
      return
    }
    setDivName('')
    setDivCode('')
    load()
  }

  const removeDivision = async (id: string) => {
    setError(null)
    const res = await DivisionsApi.remove(id)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to retire division')
      return
    }
    load()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Departments &amp; Divisions</h1>
        <p className="mt-1 text-sm text-gray-500">
          The dimensions payroll and other expenses are tagged with. Each department belongs to one
          branch; divisions sit under a branch and, optionally, one of its departments.
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
            {branches.length === 0 && <option value="">No branches yet</option>}
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
            disabled={savingDept || !branchId || !deptName.trim()}
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

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Divisions</h2>
        </div>
        <form onSubmit={addDivision} className="flex flex-wrap items-end gap-3 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Name</span>
            <input
              value={divName}
              onChange={(e) => setDivName(e.target.value)}
              placeholder="e.g. Appliance"
              className="w-56 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Department</span>
            <select
              value={divDepartmentId}
              onChange={(e) => setDivDepartmentId(e.target.value)}
              className="w-56 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Code</span>
            <input
              value={divCode}
              onChange={(e) => setDivCode(e.target.value)}
              placeholder="Optional"
              className="w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={savingDiv || !branchId || !divName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {savingDiv ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add
          </button>
        </form>
        <Rows
          loading={loading}
          empty="No divisions in this branch yet."
          rows={divisions.map((d) => ({
            id: d.id,
            primary: d.name,
            secondary: d.department ? d.department.name : 'All departments',
            onRemove: () => removeDivision(d.id),
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
