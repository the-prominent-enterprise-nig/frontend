'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useDeletePayslip } from '../_hooks/usePayslips'
import type { Payslip } from '@/src/schema/human-resource/payslips'

interface Props {
  payslip: Payslip
  onClose: () => void
  onSuccess: () => void
}

export default function DeletePayslipModal({ payslip, onClose, onSuccess }: Props) {
  const { mutateAsync, isPending } = useDeletePayslip()

  const employeeName = payslip.employee
    ? `${payslip.employee.firstName} ${payslip.employee.lastName}`
    : payslip.employeeId

  async function handleDelete() {
    const result = await mutateAsync(payslip.id)
    if (result.success) onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl mx-4 p-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
          <Trash2 size={20} className="text-red-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 text-center">Delete Payslip</h2>
        <p className="mt-2 text-sm text-gray-500 text-center">
          Are you sure you want to delete the payslip for{' '}
          <span className="font-medium text-gray-700">{employeeName}</span>? This action cannot be
          undone.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
