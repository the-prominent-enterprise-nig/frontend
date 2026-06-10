'use client'

import React, { useState } from 'react'
import { Plus, RefreshCw, Pencil, Trash2, Loader2, Sun } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}
import {
  useHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  useApplyPhilippineTemplate,
} from '../_hooks/useHolidays'
import HolidayFormDialog from './HolidayFormDialog'
import {
  Holiday,
  CreateHolidayInput,
  HOLIDAY_TYPE_LABELS,
  HOLIDAY_SCOPE_LABELS,
} from '@/src/schema/human-resource/holidays'

interface Branch {
  id: string
  name: string
}

interface Props {
  branches: Branch[]
}

const CURRENT_YEAR = new Date().getFullYear()

export default function HolidayCalendar({ branches }: Props) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Holiday | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: result, isLoading } = useHolidays(year)
  const createMutation = useCreateHoliday()
  const updateMutation = useUpdateHoliday()
  const deleteMutation = useDeleteHoliday()
  const templateMutation = useApplyPhilippineTemplate()

  const holidays = result?.success ? (result.data ?? []) : []

  const handleSubmit = async (data: CreateHolidayInput) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, input: data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setDialogOpen(false)
    setEditing(null)
  }

  const handleEdit = (h: Holiday) => {
    setEditing(h)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await deleteMutation.mutateAsync(id)
    setDeletingId(null)
  }

  const handleApplyTemplate = () => {
    templateMutation.mutate(year)
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const typeBadgeColor: Record<string, string> = {
    Regular: 'bg-blue-100 text-blue-700',
    SpecialNonWorking: 'bg-amber-100 text-amber-700',
    Company: 'bg-purple-100 text-purple-700',
    Branch: 'bg-teal-100 text-teal-700',
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">Year</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
          >
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleApplyTemplate}
            disabled={templateMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {templateMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Apply PH {year} Template
          </button>
          <button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus size={14} />
            Add Holiday
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Scope</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Branch</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Worked ×</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Not-worked ×</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Affects Leave</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400">
                    <Loader2 size={20} className="animate-spin mx-auto mb-1" />
                    Loading holidays…
                  </td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10">
                    <Sun size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-400 text-sm">No holidays for {year}.</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Click &quot;Apply PH {year} Template&quot; to load Philippine national
                      holidays.
                    </p>
                  </td>
                </tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(h.date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${typeBadgeColor[h.type] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {HOLIDAY_TYPE_LABELS[h.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {HOLIDAY_SCOPE_LABELS[h.scope]}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {h.branch?.name ?? (h.scope === 'BranchOnly' ? '—' : 'All')}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 font-mono text-xs">
                      {h.payWhenWorkedMultiplier.toFixed(1)}×
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 font-mono text-xs">
                      {h.payWhenNotWorkedMultiplier.toFixed(1)}×
                    </td>
                    <td className="px-4 py-3 text-center">
                      {h.affectsLeaveCount ? (
                        <span className="text-xs text-amber-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-xs text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${h.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {h.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEdit(h)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(h.id)}
                          disabled={deletingId === h.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === h.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {holidays.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
            {holidays.length} holiday{holidays.length !== 1 ? 's' : ''} in {year}
          </div>
        )}
      </div>

      {/* Payroll integration note */}
      <p className="text-xs text-gray-400 italic">
        Leave, attendance, and payroll integration coming soon — multipliers are stored and will be
        applied automatically.
      </p>

      <HolidayFormDialog
        open={dialogOpen}
        holiday={editing}
        branches={branches}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
