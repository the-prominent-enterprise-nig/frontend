'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Calendar, Info } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import {
  calculateLeaveDays,
  submitMyLeaveRequest,
  getLeaveTypes,
  getLeaveBalance,
} from '@/src/libs/actions/leave.actions'
import {
  myLeaveRequestSchema,
  type MyLeaveRequestInput,
} from '@/src/schema/human-resource/leave/leave.schema'

type LeaveType = {
  id: string
  name: string
  code: string
  isPaidLeave: boolean
  allowUnpaidIfZeroBalance: boolean
}

type LeaveBalance = {
  leaveTypeId: string
  allocatedDays: number
  adjustedDays: number
  usedDays: number
  carryoverDays: number
}

type DayPreview = {
  calendarDays: number
  chargeableLeaveDays: number
  excludedHolidays: { date: string; name: string }[]
}

type Props = {
  isOpen: boolean
  employeeId: string
  onClose: () => void
  onSuccess?: () => void
}

export default function MyLeaveRequestModal({ isOpen, employeeId, onClose, onSuccess }: Props) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [preview, setPreview] = useState<DayPreview | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<MyLeaveRequestInput>({
    resolver: zodResolver(myLeaveRequestSchema),
    defaultValues: { isUnpaidLeave: false },
  })

  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const leaveTypeId = watch('leaveTypeId')

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setPreview(null)
    setLoadingData(true)
    Promise.all([getLeaveTypes(), getLeaveBalance(employeeId)])
      .then(([typesRes, balRes]) => {
        if (typesRes.success) setLeaveTypes(typesRes.data as LeaveType[])
        if (balRes.success) setBalances(balRes.data as LeaveBalance[])
      })
      .catch(() => setError('Failed to load leave data'))
      .finally(() => setLoadingData(false))
  }, [isOpen, employeeId])

  const fetchPreview = useCallback(async (start: string, end: string) => {
    setLoadingPreview(true)
    setPreview(null)
    try {
      const res = await calculateLeaveDays(start, end)
      if (res.success) setPreview(res.data)
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  useEffect(() => {
    const startStr =
      startDate instanceof Date
        ? startDate.toISOString().split('T')[0]
        : typeof startDate === 'string'
          ? startDate
          : null
    const endStr =
      endDate instanceof Date
        ? endDate.toISOString().split('T')[0]
        : typeof endDate === 'string'
          ? endDate
          : null

    if (startStr && endStr && endStr >= startStr) {
      fetchPreview(startStr, endStr)
    } else {
      setPreview(null)
    }
  }, [startDate, endDate, fetchPreview])

  const selectedLeaveType = leaveTypes.find((t) => t.id === leaveTypeId)
  const selectedBalance = balances.find((b) => b.leaveTypeId === leaveTypeId)
  const remainingDays = selectedBalance
    ? selectedBalance.allocatedDays +
      selectedBalance.carryoverDays +
      selectedBalance.adjustedDays -
      selectedBalance.usedDays
    : null

  const onSubmit = async (data: MyLeaveRequestInput) => {
    if (preview?.chargeableLeaveDays === 0) {
      setError('Cannot submit — all selected days are holidays.')
      return
    }
    setError(null)
    try {
      const result = await submitMyLeaveRequest(data)
      if (result.success) {
        reset()
        setPreview(null)
        onClose()
        onSuccess?.()
      } else {
        setError(result.error ?? 'Failed to submit leave request')
      }
    } catch (err) {
      console.error('submitMyLeaveRequest error:', err)
      setError('An unexpected error occurred. Please try again.')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">File Leave Request</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {loadingData ? (
            <div className="py-8 text-center text-sm text-zinc-500">Loading leave data...</div>
          ) : (
            <>
              {/* Leave Type */}
              <div>
                <label className="text-sm font-medium text-zinc-900">Leave Type *</label>
                <Controller
                  name="leaveTypeId"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                    >
                      <option value="">Select a leave type</option>
                      {leaveTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.leaveTypeId && (
                  <p className="mt-1 text-xs text-red-600">{errors.leaveTypeId.message}</p>
                )}
              </div>

              {/* Balance info */}
              {selectedLeaveType && remainingDays !== null && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                  <p className="font-medium text-blue-900">{selectedLeaveType.name} Balance</p>
                  <p className="mt-0.5 text-blue-700">
                    {remainingDays} day{remainingDays !== 1 ? 's' : ''} remaining
                  </p>
                </div>
              )}

              {/* Start / End Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-zinc-900">Start Date *</label>
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="date"
                        className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().split('T')[0]
                            : (field.value ?? '')
                        }
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-xs text-red-600">{errors.startDate.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-900">End Date *</label>
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="date"
                        className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                        value={
                          field.value instanceof Date
                            ? field.value.toISOString().split('T')[0]
                            : (field.value ?? '')
                        }
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                      />
                    )}
                  />
                  {errors.endDate && (
                    <p className="mt-1 text-xs text-red-600">{errors.endDate.message}</p>
                  )}
                </div>
              </div>

              {/* Day Preview */}
              {(loadingPreview || preview) && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700">
                    <Calendar className="h-4 w-4" />
                    Leave Days Preview
                  </div>
                  {loadingPreview ? (
                    <p className="text-sm text-zinc-500">Calculating...</p>
                  ) : preview ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-zinc-700">
                        <span>Calendar days</span>
                        <span className="font-medium">{preview.calendarDays}</span>
                      </div>
                      {preview.excludedHolidays.length > 0 && (
                        <div className="flex justify-between text-amber-700">
                          <span>Holidays excluded</span>
                          <span className="font-medium">−{preview.excludedHolidays.length}</span>
                        </div>
                      )}
                      <div
                        className={`flex justify-between font-semibold ${preview.chargeableLeaveDays === 0 ? 'text-red-700' : 'text-zinc-900'}`}
                      >
                        <span>Chargeable leave days</span>
                        <span>{preview.chargeableLeaveDays}</span>
                      </div>
                      {preview.excludedHolidays.length > 0 && (
                        <div className="mt-2 space-y-1 border-t border-zinc-200 pt-2">
                          {preview.excludedHolidays.map((h) => (
                            <div
                              key={h.date}
                              className="flex items-start gap-1.5 text-xs text-amber-700"
                            >
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>
                                {h.date} — {h.name} will not be deducted from your balance
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {preview.chargeableLeaveDays === 0 && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          All selected days are holidays. Adjust your dates or choose different
                          days.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-zinc-900">Reason *</label>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="Enter reason for leave..."
                    />
                  )}
                />
                {errors.reason && (
                  <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>
                )}
              </div>

              {/* Supporting Attachment */}
              <div>
                <label className="text-sm font-medium text-zinc-900">Supporting Attachment</label>
                <Controller
                  name="supportingAttachment"
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      placeholder="e.g., medical certificate filename"
                    />
                  )}
                />
              </div>

              {/* Unpaid Leave */}
              <div>
                <label className="flex items-center gap-2">
                  <Controller
                    name="isUnpaidLeave"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="checkbox"
                        checked={Boolean(field.value)}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="rounded border-zinc-300"
                      />
                    )}
                  />
                  <span className="text-sm text-zinc-700">Request as unpaid leave</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || preview?.chargeableLeaveDays === 0}
                  className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
