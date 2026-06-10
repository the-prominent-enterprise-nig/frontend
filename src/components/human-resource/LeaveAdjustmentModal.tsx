'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Info, Users, User, Globe } from 'lucide-react'
import {
  leaveAdjustmentSchema,
  LeaveAdjustmentInput,
} from '@/src/schema/human-resource/leave/leave.schema'
import { createLeaveAdjustment, getMySession } from '@/src/libs/actions/leave.actions'

// Fallback email shown in the form before the session loads
const FALLBACK_USER_EMAIL = 'hr.admin@prominent.com'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  department?: { id: string; name: string } | null
}

type LeaveType = {
  id: string
  name: string
  code: string
}

type LeaveAdjustmentModalProps = {
  employees: Employee[]
  leaveTypes: LeaveType[]
  preselectedEmployeeId?: string
  onClose: () => void
  onSuccess: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APPLY_TO_OPTIONS = [
  {
    value: 'Single Employee',
    label: 'Single Employee',
    description: 'Apply to one specific employee',
    icon: User,
  },
  {
    value: 'Multiple Employees',
    label: 'Multiple Employees',
    description: 'Apply to a selected group',
    icon: Users,
  },
  {
    value: 'All Employees',
    label: 'All Employees',
    description: 'Apply to everyone in the company',
    icon: Globe,
  },
] as const

const ADJUSTMENT_TYPES = [
  { value: 'Add', label: 'Add Days', description: 'Credit additional days to balance' },
  { value: 'Deduct', label: 'Deduct Days', description: 'Remove days from balance' },
  { value: 'Set Balance', label: 'Set Balance', description: 'Override balance to exact value' },
] as const

const currentYear = new Date().getFullYear()
const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

// ─── Small helpers ────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {children}
      {required && <span className="ml-0.5 text-red-500">*</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>
}

function inputClass(hasError?: boolean) {
  return `w-full rounded-lg border ${
    hasError
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-700'
      : 'border-zinc-200 focus:border-purple-400 focus:ring-purple-100 dark:border-zinc-700'
  } bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 dark:bg-zinc-800 dark:text-white`
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeaveAdjustmentModal({
  employees,
  leaveTypes,
  preselectedEmployeeId,
  onClose,
  onSuccess,
}: LeaveAdjustmentModalProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [userEmail, setUserEmail] = useState(FALLBACK_USER_EMAIL)

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LeaveAdjustmentInput>({
    resolver: zodResolver(leaveAdjustmentSchema),
    defaultValues: {
      applyTo: 'Single Employee',
      selectedEmployeeId: preselectedEmployeeId ?? '',
      selectedEmployeeIds: [],
      leaveTypeId: '',
      year: currentYear,
      adjustmentType: 'Add',
      adjustmentValue: 0,
      reason: '',
      updatedBy: FALLBACK_USER_EMAIL,
      effectiveImmediately: true,
    },
  })

  // Load logged-in user email from session and update form field
  useEffect(() => {
    getMySession().then((result) => {
      if (result.success && result.data.email) {
        setUserEmail(result.data.email)
        setValue('updatedBy', result.data.email)
      }
    })
  }, [])

  const applyTo = watch('applyTo')
  const adjustmentType = watch('adjustmentType')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Sync checkedIds → form value
  const toggleEmployee = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setValue('selectedEmployeeIds', Array.from(next))
      return next
    })
  }

  const onSubmit = async (data: LeaveAdjustmentInput) => {
    const result = await createLeaveAdjustment(data)
    if (result.success) {
      onSuccess()
    } else {
      setError('root', { message: result.error ?? 'Failed to save adjustment' })
    }
  }

  const adjustmentInfo: Record<string, string> = {
    Add: 'The specified days will be added on top of the current balance.',
    Deduct: 'The specified days will be subtracted from the current balance.',
    'Set Balance': 'The remaining balance will be overwritten to exactly this value.',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              Adjust Leave Balance
            </h2>
            <p className="text-xs text-zinc-500">Changes take effect immediately upon saving</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="max-h-[75vh] overflow-y-auto">
          <div className="space-y-5 px-6 py-5">
            {/* ── Apply To ── */}
            <div>
              <FieldLabel required>Apply To</FieldLabel>
              <Controller
                name="applyTo"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2">
                    {APPLY_TO_OPTIONS.map((opt) => {
                      const Icon = opt.icon
                      const active = field.value === opt.value
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition ${
                            active
                              ? 'border-purple-400 bg-purple-50 text-purple-800 dark:border-purple-600 dark:bg-purple-950/50 dark:text-purple-200'
                              : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 ${active ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'}`}
                          />
                          <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                          <p className="text-xs opacity-60 leading-tight">{opt.description}</p>
                        </button>
                      )
                    })}
                  </div>
                )}
              />
            </div>

            {/* ── Employee selection ── */}
            {applyTo === 'Single Employee' && (
              <div>
                <FieldLabel required>Employee</FieldLabel>
                <Controller
                  name="selectedEmployeeId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <select {...field} className={inputClass(!!fieldState.error)}>
                        <option value="">Select an employee…</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.firstName} {emp.lastName} — {emp.employeeCode}
                            {emp.department ? ` (${emp.department.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <FieldError message={fieldState.error?.message} />
                    </>
                  )}
                />
              </div>
            )}

            {applyTo === 'Multiple Employees' && (
              <div>
                <FieldLabel required>Select Employees</FieldLabel>
                <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {employees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <input
                        type="checkbox"
                        checked={checkedIds.has(emp.id)}
                        onChange={() => toggleEmployee(emp.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-400"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          {emp.firstName} {emp.lastName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {emp.employeeCode}
                          {emp.department ? ` · ${emp.department.name}` : ''}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                {checkedIds.size === 0 && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Select at least one employee
                  </p>
                )}
                {checkedIds.size > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {checkedIds.size} employee{checkedIds.size !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            )}

            {applyTo === 'All Employees' && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 dark:border-blue-800 dark:bg-blue-950/30">
                <Globe className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  This adjustment will apply to <strong>all employees</strong>.
                </p>
              </div>
            )}

            {/* ── Leave Type + Year ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Leave Type</FieldLabel>
                <Controller
                  name="leaveTypeId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <select {...field} className={inputClass(!!fieldState.error)}>
                        <option value="">Select type…</option>
                        {leaveTypes.map((lt) => (
                          <option key={lt.id} value={lt.id}>
                            {lt.name} ({lt.code})
                          </option>
                        ))}
                      </select>
                      <FieldError message={fieldState.error?.message} />
                    </>
                  )}
                />
              </div>
              <div>
                <FieldLabel required>Year</FieldLabel>
                <Controller
                  name="year"
                  control={control}
                  render={({ field, fieldState }) => (
                    <>
                      <select
                        {...field}
                        value={field.value as number | undefined}
                        className={inputClass(!!fieldState.error)}
                      >
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <FieldError message={fieldState.error?.message} />
                    </>
                  )}
                />
              </div>
            </div>

            {/* ── Adjustment Type ── */}
            <div>
              <FieldLabel required>Adjustment Type</FieldLabel>
              <Controller
                name="adjustmentType"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2">
                    {ADJUSTMENT_TYPES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition ${
                          field.value === opt.value
                            ? 'border-purple-400 bg-purple-50 text-purple-800 dark:border-purple-600 dark:bg-purple-950/50 dark:text-purple-200'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        <p className="text-xs font-semibold">{opt.label}</p>
                        <p className="mt-0.5 text-xs opacity-70 leading-tight">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              />
              {adjustmentType && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    {adjustmentInfo[adjustmentType]}
                  </p>
                </div>
              )}
            </div>

            {/* ── Number of Days ── */}
            <div>
              <FieldLabel required>
                {adjustmentType === 'Set Balance' ? 'New Balance (days)' : 'Number of Days'}
              </FieldLabel>
              <Controller
                name="adjustmentValue"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <input
                      {...field}
                      value={field.value as number | undefined}
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="0"
                      className={inputClass(!!fieldState.error)}
                    />
                    <FieldError message={fieldState.error?.message} />
                  </>
                )}
              />
            </div>

            {/* ── Reason ── */}
            <div>
              <FieldLabel required>Reason</FieldLabel>
              <Controller
                name="reason"
                control={control}
                render={({ field, fieldState }) => (
                  <>
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Describe the reason for this adjustment…"
                      className={`${inputClass(!!fieldState.error)} resize-none`}
                    />
                    <FieldError message={fieldState.error?.message} />
                  </>
                )}
              />
            </div>

            {/* ── Updated by (read-only) ── */}
            <div>
              <p className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Updated by
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/60">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                  {userEmail[0].toUpperCase()}
                </div>
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{userEmail}</span>
              </div>
            </div>

            {/* Root error */}
            {errors.root && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {errors.root.message}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (applyTo === 'Multiple Employees' && checkedIds.size === 0)}
              className="rounded-lg bg-purple-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-purple-800 disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
