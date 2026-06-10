'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, CalendarX2, Info } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import {
  createLeaveRequest,
  getLeaveTypes,
  getLeaveBalance,
} from '@/src/libs/actions/leave.actions'
import {
  submitLeaveRequestSchema,
  type SubmitLeaveRequestInput,
} from '@/src/schema/human-resource/leave/leave.schema'
import { api } from '@/src/libs/api/client'

type CreateLeaveRequestModalProps = {
  isOpen: boolean
  onClose: () => void
  employeeId: string
  onSuccess?: () => void
}

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

type DaysBreakdown = {
  calendarDays: number
  excludedHolidayCount: number
  chargeableDays: number
  excludedHolidayDates: string[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string) {
  const d = new Date(iso)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export default function CreateLeaveRequestModal({
  isOpen,
  onClose,
  employeeId,
  onSuccess,
}: CreateLeaveRequestModalProps) {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [breakdown, setBreakdown] = useState<DaysBreakdown | null>(null)
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
    setValue,
  } = useForm<SubmitLeaveRequestInput>({
    resolver: zodResolver(submitLeaveRequestSchema),
    defaultValues: {
      employeeId,
      isUnpaidLeave: false,
    },
  })

  const startDate = watch('startDate')
  const endDate = watch('endDate')
  const leaveTypeId = watch('leaveTypeId')

  useEffect(() => {
    if (isOpen) loadLeaveData()
  }, [isOpen])

  const fetchBreakdown = useCallback(
    async (start: string, end: string) => {
      if (!start || !end || end < start) {
        setBreakdown(null)
        return
      }
      setLoadingBreakdown(true)
      try {
        const result = await api.get<DaysBreakdown>('/leave-management/calculate-days', {
          startDate: start,
          endDate: end,
          employeeId,
        })
        if (result.success && result.data) {
          setBreakdown(result.data)
          setValue(
            'totalDaysRequested',
            result.data.chargeableDays > 0 ? result.data.chargeableDays : 1
          )
        }
      } catch {
        // silent — backend will re-validate
      } finally {
        setLoadingBreakdown(false)
      }
    },
    [employeeId, setValue]
  )

  useEffect(() => {
    const startStr =
      startDate instanceof Date
        ? startDate.toISOString().slice(0, 10)
        : ((startDate as string | undefined) ?? '')
    const endStr =
      endDate instanceof Date
        ? endDate.toISOString().slice(0, 10)
        : ((endDate as string | undefined) ?? '')
    if (startStr && endStr) {
      fetchBreakdown(startStr, endStr)
    } else {
      setBreakdown(null)
    }
  }, [startDate, endDate, fetchBreakdown])

  const loadLeaveData = async () => {
    try {
      setLoadingData(true)
      const [typesResult, balanceResult] = await Promise.all([
        getLeaveTypes(),
        getLeaveBalance(employeeId),
      ])
      if (typesResult.success) setLeaveTypes(typesResult.data as LeaveType[])
      if (balanceResult.success) setLeaveBalances(balanceResult.data as LeaveBalance[])
      setError(null)
    } catch (err) {
      setError('Failed to load leave data')
      console.error(err)
    } finally {
      setLoadingData(false)
    }
  }

  const onSubmit = async (data: SubmitLeaveRequestInput) => {
    if (breakdown && breakdown.chargeableDays <= 0) {
      setError('All selected dates are non-deductible holidays. No leave request is needed.')
      return
    }
    try {
      const result = await createLeaveRequest(data)
      if (result.success) {
        reset()
        setBreakdown(null)
        onClose()
        onSuccess?.()
      } else {
        setError(result.error || 'An error occurred')
      }
    } catch (err) {
      setError('Failed to create leave request')
      console.error(err)
    }
  }

  const selectedLeaveType = leaveTypes.find((t) => t.id === leaveTypeId)
  const selectedBalance = leaveBalances.find((b) => b.leaveTypeId === leaveTypeId)
  const remainingDays = selectedBalance
    ? selectedBalance.allocatedDays +
      selectedBalance.carryoverDays +
      selectedBalance.adjustedDays -
      selectedBalance.usedDays
    : 0

  if (!isOpen) return null

  const chargeableDays = breakdown?.chargeableDays ?? 0
  const allHolidays = breakdown !== null && breakdown.chargeableDays <= 0

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 sm:items-center sm:justify-center">
      <div className="max-h-screen w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">Create Leave Request</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {loadingData ? (
            <div className="text-center py-8">
              <p className="text-zinc-600">Loading leave types...</p>
            </div>
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
                      {leaveTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name} ({type.code})
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.leaveTypeId && (
                  <p className="mt-1 text-xs text-red-600">{errors.leaveTypeId.message}</p>
                )}
              </div>

              {selectedLeaveType && selectedBalance && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm">
                  <p className="font-medium text-blue-900">Your {selectedLeaveType.name} Balance</p>
                  <p className="mt-1 text-blue-800">
                    Remaining: <strong>{remainingDays} days</strong>
                  </p>
                </div>
              )}

              {/* Start Date */}
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

              {/* End Date */}
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

              {/* Leave Days Breakdown */}
              {breakdown && (
                <div
                  className={`rounded-lg border p-3 text-sm space-y-1.5 ${allHolidays ? 'bg-amber-50 border-amber-200' : 'bg-zinc-50 border-zinc-200'}`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-zinc-800">
                    {allHolidays ? (
                      <CalendarX2 className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Info className="h-4 w-4 text-zinc-500" />
                    )}
                    Leave Days Breakdown
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
                    <span>Calendar days:</span>
                    <span className="font-medium text-zinc-800">{breakdown.calendarDays}</span>
                    {breakdown.excludedHolidayCount > 0 && (
                      <>
                        <span>Holidays excluded:</span>
                        <span className="font-medium text-amber-700">
                          −{breakdown.excludedHolidayCount}
                        </span>
                      </>
                    )}
                    <span className="font-medium text-zinc-900">Chargeable days:</span>
                    <span
                      className={`font-bold ${allHolidays ? 'text-amber-700' : 'text-zinc-900'}`}
                    >
                      {breakdown.chargeableDays}
                    </span>
                  </div>
                  {breakdown.excludedHolidayDates.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {breakdown.excludedHolidayDates.map((d) => (
                        <p key={d} className="text-xs text-amber-700">
                          {fmtDate(d)} is a holiday and will not be deducted from your leave
                          balance.
                        </p>
                      ))}
                    </div>
                  )}
                  {allHolidays && (
                    <p className="text-xs font-medium text-amber-800 mt-1">
                      All selected dates are non-deductible holidays. A leave request is not needed.
                    </p>
                  )}
                </div>
              )}
              {loadingBreakdown && <p className="text-xs text-zinc-400">Checking holidays...</p>}

              {/* Hidden: totalDaysRequested driven by breakdown */}
              <Controller
                name="totalDaysRequested"
                control={control}
                render={({ field }) => (
                  <input
                    type="hidden"
                    name={field.name}
                    value={Number(field.value) || 0}
                    ref={field.ref}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />

              {/* Reason */}
              <div>
                <label className="text-sm font-medium text-zinc-900">Reason *</label>
                <Controller
                  name="reason"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                      rows={3}
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

              {/* Unpaid Leave Checkbox */}
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

              {/* Submit */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting || allHolidays || (breakdown !== null && chargeableDays <= 0)
                  }
                  className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Creating...'
                    : breakdown
                      ? `Request ${chargeableDays} Day${chargeableDays !== 1 ? 's' : ''}`
                      : 'Create Request'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
