'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type {
  AttendanceStatusType,
  AttendanceStatusTypeInput,
} from '@/src/app/(app)/(dashboard)/human-resource/attendance/_actions'

const STATUS_CATEGORIES = [
  { value: 'RegularAttendance', label: 'Regular Attendance' },
  { value: 'AttendanceException', label: 'Attendance Exception' },
  { value: 'NonAttendance', label: 'Non-Attendance' },
]

const PAYROLL_IMPACTS = [
  { value: 'Paid', label: 'Paid' },
  { value: 'Unpaid', label: 'Unpaid' },
  { value: 'PaidWithTardiness', label: 'Paid with Tardiness Deduction' },
  { value: 'DependsOnLeaveType', label: 'Depends on Leave Type' },
]

const DEDUCTION_TYPES = [
  { value: 'Percentage', label: 'Percentage' },
  { value: 'FixedAmount', label: 'Fixed Amount' },
  { value: 'MinutesBased', label: 'Minutes Based' },
  { value: 'HoursBased', label: 'Hours Based' },
]

type AddStatusTypeModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave?: (data: AttendanceStatusTypeInput) => Promise<void> | void
  initialValue?: AttendanceStatusType | null
}

export default function AddStatusTypeModal({
  isOpen,
  onClose,
  onSave,
  initialValue,
}: AddStatusTypeModalProps) {
  const [statusName, setStatusName] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [description, setDescription] = useState('')
  const [statusCategory, setStatusCategory] = useState('')
  const [payrollImpact, setPayrollImpact] = useState('')
  const [deductionType, setDeductionType] = useState('Percentage')
  const [deductionValue, setDeductionValue] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = Boolean(initialValue)
  const usesDeduction = payrollImpact === 'PaidWithTardiness'

  useEffect(() => {
    if (!isOpen) return
    setStatusName(initialValue?.statusName ?? '')
    setStatusCode(initialValue?.statusCode ?? '')
    setDescription(initialValue?.description ?? '')
    setStatusCategory(initialValue?.statusCategory ?? '')
    setPayrollImpact(initialValue?.payrollImpact ?? '')
    setDeductionType(
      initialValue?.deductionType && initialValue.deductionType !== 'None'
        ? initialValue.deductionType
        : 'Percentage'
    )
    setDeductionValue(
      initialValue?.deductionValue === null || initialValue?.deductionValue === undefined
        ? ''
        : String(initialValue.deductionValue)
    )
    setIsActive(initialValue?.isActive ?? true)
    setError(null)
  }, [initialValue, isOpen])

  if (!isOpen) return null

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const validateDeduction = () => {
    if (!usesDeduction) return null

    const value = Number(deductionValue)
    if (!deductionType) return 'Deduction type is required.'
    if (deductionValue.trim() === '' || Number.isNaN(value)) return 'Deduction value is required.'
    if (value < 0) return 'Deduction value cannot be negative.'
    if (deductionType === 'Percentage' && value > 100) {
      return 'Percentage deduction must be between 0 and 100.'
    }
    return null
  }

  const handleSave = async () => {
    if (!statusName.trim()) return setError('Status name is required.')
    if (!statusCode.trim()) return setError('Status code is required.')
    if (!statusCategory) return setError('Status category is required.')
    if (!payrollImpact) return setError('Payroll impact is required.')

    const deductionError = validateDeduction()
    if (deductionError) return setError(deductionError)

    setError(null)
    setSaving(true)
    try {
      await onSave?.({
        statusName: statusName.trim(),
        statusCode: statusCode.trim().toUpperCase().replace(/\s+/g, '_'),
        description: description.trim() || null,
        statusCategory,
        payrollImpact,
        deductionType: usesDeduction ? deductionType : 'None',
        deductionValue: usesDeduction ? Number(deductionValue) : null,
        isActive,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save status type.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {isEditing ? 'Edit Attendance Status Type' : 'Add Attendance Status Type'}
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Configure how attendance records are classified and prepared for payroll.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          {error && (
            <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Status Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={statusName}
              onChange={(event) => setStatusName(event.target.value)}
              placeholder="e.g. Present"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Status Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={statusCode}
              onChange={(event) => setStatusCode(event.target.value.toUpperCase())}
              placeholder="e.g. PRESENT"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Briefly describe when this status is used"
              rows={2}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Status Category <span className="text-red-500">*</span>
            </label>
            <select
              value={statusCategory}
              onChange={(event) => setStatusCategory(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Select category</option>
              {STATUS_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Payroll Impact <span className="text-red-500">*</span>
            </label>
            <select
              value={payrollImpact}
              onChange={(event) => setPayrollImpact(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">Select impact</option>
              {PAYROLL_IMPACTS.map((impact) => (
                <option key={impact.value} value={impact.value}>
                  {impact.label}
                </option>
              ))}
            </select>
          </div>

          {usesDeduction && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Deduction Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={deductionType}
                  onChange={(event) => setDeductionType(event.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  {DEDUCTION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Deduction Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={deductionType === 'Percentage' ? 100 : undefined}
                  step="0.01"
                  value={deductionValue}
                  onChange={(event) => setDeductionValue(event.target.value)}
                  placeholder={deductionType === 'Percentage' ? 'e.g. 5' : 'e.g. 50'}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </div>
            </>
          )}

          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">
              Active and available for new attendance logs
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Status Type'}
          </button>
        </div>
      </div>
    </div>
  )
}
