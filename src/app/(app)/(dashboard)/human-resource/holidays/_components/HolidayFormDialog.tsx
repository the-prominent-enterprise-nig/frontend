'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { X, Loader2 } from 'lucide-react'
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
  open: boolean
  holiday?: Holiday | null
  branches: Branch[]
  onClose: () => void
  onSubmit: (data: CreateHolidayInput) => Promise<void>
  isSubmitting: boolean
}

export default function HolidayFormDialog({
  open,
  holiday,
  branches,
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  const isEdit = !!holiday

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateHolidayInput>({
    defaultValues: {
      name: '',
      date: '',
      type: 'Regular',
      scope: 'Enterprise',
      branchId: undefined,
      payWhenWorkedMultiplier: 2.0,
      payWhenNotWorkedMultiplier: 1.0,
      affectsLeaveCount: false,
      notes: '',
      isActive: true,
    },
  })

  const scope = watch('scope')
  const type = watch('type')

  // Preset multipliers based on type selection
  useEffect(() => {
    if (!isEdit) {
      if (type === 'Regular') {
        reset((v) => ({ ...v, payWhenWorkedMultiplier: 2.0, payWhenNotWorkedMultiplier: 1.0 }))
      } else if (type === 'SpecialNonWorking') {
        reset((v) => ({ ...v, payWhenWorkedMultiplier: 1.3, payWhenNotWorkedMultiplier: 0.0 }))
      } else {
        reset((v) => ({ ...v, payWhenWorkedMultiplier: 1.5, payWhenNotWorkedMultiplier: 1.0 }))
      }
    }
  }, [type])

  useEffect(() => {
    if (open) {
      if (holiday) {
        reset({
          name: holiday.name,
          date: holiday.date.slice(0, 10),
          type: holiday.type,
          scope: holiday.scope,
          branchId: holiday.branchId ?? undefined,
          payWhenWorkedMultiplier: holiday.payWhenWorkedMultiplier,
          payWhenNotWorkedMultiplier: holiday.payWhenNotWorkedMultiplier,
          affectsLeaveCount: holiday.affectsLeaveCount,
          notes: holiday.notes ?? '',
          isActive: holiday.isActive,
        })
      } else {
        reset({
          name: '',
          date: '',
          type: 'Regular',
          scope: 'Enterprise',
          branchId: undefined,
          payWhenWorkedMultiplier: 2.0,
          payWhenNotWorkedMultiplier: 1.0,
          affectsLeaveCount: false,
          notes: '',
          isActive: true,
        })
      }
    }
  }, [open, holiday, reset])

  if (!open) return null

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit Holiday' : 'Add Holiday'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* Name */}
          <div>
            <label className={labelCls}>Holiday Name *</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className={inputCls}
              placeholder="e.g. National Heroes Day"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>Date *</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className={inputCls}
            />
            {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
          </div>

          {/* Type + Scope row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select {...register('type')} className={inputCls}>
                {Object.entries(HOLIDAY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Scope</label>
              <select {...register('scope')} className={inputCls}>
                {Object.entries(HOLIDAY_SCOPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Branch (shown only when BranchOnly) */}
          {scope === 'BranchOnly' && (
            <div>
              <label className={labelCls}>Branch *</label>
              <select
                {...register('branchId', {
                  required:
                    scope === 'BranchOnly'
                      ? 'Branch is required for branch-specific holidays'
                      : false,
                })}
                className={inputCls}
              >
                <option value="">Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {errors.branchId && (
                <p className="text-xs text-red-500 mt-1">{errors.branchId.message}</p>
              )}
            </div>
          )}

          {/* Multipliers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Worked Pay ×</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('payWhenWorkedMultiplier', { valueAsNumber: true })}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-0.5">e.g. 2.0 = 200%</p>
            </div>
            <div>
              <label className={labelCls}>Not-worked Pay ×</label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('payWhenNotWorkedMultiplier', { valueAsNumber: true })}
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-0.5">e.g. 0.0 = no pay</p>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                {...register('affectsLeaveCount')}
                className="rounded border-gray-300 text-purple-600"
              />
              <span>Counts against leave balance when taken as leave</span>
            </label>
            {isEdit && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Active</span>
              </label>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              className={inputCls + ' resize-none'}
              placeholder="Optional notes"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Holiday'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
