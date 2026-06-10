'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Tag, AlertCircle, Pencil, Power, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import AddStatusTypeModal from '@/src/components/human-resource/AddStatusTypeModal'
import {
  getStatusTypes,
  createStatusType,
  updateStatusType,
  setStatusTypeActive,
} from '../_actions'
import type { AttendanceStatusType, AttendanceStatusTypeInput } from '../_actions'

const CATEGORY_LABELS: Record<string, string> = {
  RegularAttendance: 'Regular Attendance',
  AttendanceException: 'Attendance Exception',
  NonAttendance: 'Non-Attendance',
}

const CATEGORY_BADGE: Record<string, string> = {
  RegularAttendance: 'bg-blue-50 text-blue-700 border-blue-200',
  AttendanceException: 'bg-amber-50 text-amber-700 border-amber-200',
  NonAttendance: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

const PAYROLL_LABELS: Record<string, string> = {
  Paid: 'Paid',
  Unpaid: 'Unpaid',
  PaidWithTardiness: 'Paid w/ Tardiness',
  DependsOnLeaveType: 'Depends on Leave',
}

const DEDUCTION_LABELS: Record<string, string> = {
  None: '—',
  Percentage: 'Percentage',
  FixedAmount: 'Fixed amount',
  MinutesBased: 'Minutes-based',
  HoursBased: 'Hours-based',
}

function formatDeduction(item: AttendanceStatusType) {
  if (!item.deductionType || item.deductionType === 'None') return '—'
  if (item.deductionType === 'Percentage') return `${item.deductionValue ?? 0}%`
  if (item.deductionType === 'FixedAmount') return `₱${item.deductionValue ?? 0}`
  return DEDUCTION_LABELS[item.deductionType] ?? item.deductionType
}

const PAYROLL_BADGE: Record<string, string> = {
  Paid: 'bg-green-50 text-green-700',
  Unpaid: 'bg-red-50 text-red-700',
  PaidWithTardiness: 'bg-amber-50 text-amber-700',
  DependsOnLeaveType: 'bg-purple-50 text-purple-700',
}

export default function AttendanceStatusTypePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStatusType, setSelectedStatusType] = useState<AttendanceStatusType | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const {
    data: statusTypes = [],
    isLoading,
    error,
  } = useQuery<AttendanceStatusType[]>({
    queryKey: ['attendance-status-types'],
    queryFn: () => getStatusTypes({ includeInactive: true }),
  })

  const categories = Array.from(
    new Set(statusTypes.map((item) => item.statusCategory).filter(Boolean))
  ) as string[]

  const filteredStatusTypes = useMemo(() => {
    return statusTypes.filter((item) => {
      const matchesSearch =
        item.statusName.toLowerCase().includes(search.toLowerCase()) ||
        item.statusCode.toLowerCase().includes(search.toLowerCase()) ||
        (item.description ?? '').toLowerCase().includes(search.toLowerCase())
      const matchesActive =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && item.isActive) ||
        (statusFilter === 'Inactive' && !item.isActive)
      const matchesCategory =
        categoryFilter === 'All Categories' || item.statusCategory === categoryFilter
      return matchesSearch && matchesActive && matchesCategory
    })
  }, [statusTypes, search, statusFilter, categoryFilter])

  const handleSave = async (data: AttendanceStatusTypeInput) => {
    setSaveError(null)
    const result = selectedStatusType
      ? await updateStatusType(selectedStatusType.id, data)
      : await createStatusType(data)
    if (!result.success) throw new Error(result.error ?? 'Failed to save status type')
    setSelectedStatusType(null)
    await queryClient.invalidateQueries({ queryKey: ['attendance-status-types'] })
  }

  const openAddModal = () => {
    setSelectedStatusType(null)
    setIsModalOpen(true)
  }

  const openEditModal = (item: AttendanceStatusType) => {
    setSelectedStatusType(item)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedStatusType(null)
  }

  const handleToggleActive = async (item: AttendanceStatusType) => {
    setActionError(null)
    if (item.isActive) {
      const confirmed = window.confirm(
        'Are you sure you want to deactivate this status type? Existing attendance records will keep this status, but it will no longer be available for new logs.'
      )
      if (!confirmed) return
    }

    const result = await setStatusTypeActive(item.id, !item.isActive)
    if (!result.success) {
      setActionError(result.error ?? 'Failed to update status type.')
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['attendance-status-types'] })
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <button
            type="button"
            onClick={() => router.push('/human-resource/attendance')}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Attendance
          </button>

          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-purple-600" />
                <h1 className="text-2xl font-semibold text-zinc-900">Attendance Status Types</h1>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500 max-w-2xl">
                Standardized classifications used across attendance records, summaries, and payroll
                processing. All logs and reports reference these status types.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              className="shrink-0 rounded-xl bg-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-purple-800"
            >
              + Add Status Type
            </button>
          </div>

          {saveError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}
          {actionError && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {actionError}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Search by name, code, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-purple-400"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            >
              <option>All Categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 outline-none focus:border-purple-400"
            >
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                <p className="mt-3 text-sm text-zinc-500">Loading status types…</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-400" />
              <p className="mt-2 text-sm text-red-600">Failed to load attendance status types.</p>
            </div>
          ) : filteredStatusTypes.length === 0 && statusTypes.length === 0 ? (
            <div className="p-12 text-center">
              <Tag className="mx-auto h-10 w-10 text-zinc-300" />
              <p className="mt-3 text-sm font-medium text-zinc-700">
                No status types configured yet
              </p>
              <p className="mt-1 text-xs text-zinc-400 max-w-xs mx-auto">
                Status types define how attendance records are classified (Present, Absent, Late,
                etc.) and how they affect payroll. Add the defaults to get started.
              </p>
              <button
                onClick={openAddModal}
                className="mt-4 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
              >
                Add First Status Type
              </button>
            </div>
          ) : filteredStatusTypes.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-zinc-500">No status types match your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Code
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Description
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Category
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Payroll Impact
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Deduction
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      Active
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredStatusTypes.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-zinc-900">{item.statusName}</td>
                      <td className="px-5 py-3.5">
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700 font-mono">
                          {item.statusCode}
                        </code>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 max-w-xs truncate">
                        {item.description ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.statusCategory ? (
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE[item.statusCategory] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}
                          >
                            {CATEGORY_LABELS[item.statusCategory] ?? item.statusCategory}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {item.payrollImpact ? (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${PAYROLL_BADGE[item.payrollImpact] ?? 'bg-zinc-100 text-zinc-600'}`}
                          >
                            {PAYROLL_LABELS[item.payrollImpact] ?? item.payrollImpact}
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-zinc-700">{formatDeduction(item)}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}
                        >
                          {item.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            {item.isActive ? (
                              <Power className="h-3.5 w-3.5" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            {item.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AddStatusTypeModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialValue={selectedStatusType}
      />
    </div>
  )
}
