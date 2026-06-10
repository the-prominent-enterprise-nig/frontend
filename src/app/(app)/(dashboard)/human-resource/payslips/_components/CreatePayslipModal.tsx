'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCreatePayslip } from '../_hooks/usePayslips'
import type { CreatePayslipInput } from '@/src/schema/human-resource/payslips'

interface Employee {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
}

interface Props {
  employees: Employee[]
  onClose: () => void
  onSuccess: () => void
}

const defaultForm = {
  employeeId: '',
  payrollPeriodId: '',
  cycle: 1,
  cycleStartDate: '',
  cycleEndDate: '',
  visibility: true,
  basicPay: '',
  allowances: '',
  grossPay: '',
  deductions: '',
  netPay: '',
  notes: '',
}

export default function CreatePayslipModal({ employees, onClose, onSuccess }: Props) {
  const [form, setForm] = useState(defaultForm)
  const [error, setError] = useState('')
  const { mutateAsync, isPending } = useCreatePayslip()

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.employeeId) {
      setError('Please select an employee.')
      return
    }
    if (!form.cycleStartDate || !form.cycleEndDate) {
      setError('Cycle start and end dates are required.')
      return
    }

    const payslipData: Record<string, unknown> = {}
    if (form.basicPay) payslipData.basicPay = parseFloat(form.basicPay)
    if (form.allowances) payslipData.allowances = parseFloat(form.allowances)
    if (form.grossPay) payslipData.grossPay = parseFloat(form.grossPay)
    if (form.deductions) payslipData.deductions = parseFloat(form.deductions)
    if (form.netPay) payslipData.netPay = parseFloat(form.netPay)
    if (form.notes) payslipData.notes = form.notes

    const input: CreatePayslipInput = {
      employeeId: form.employeeId,
      payrollPeriodId: form.payrollPeriodId || '',
      cycle: form.cycle,
      cycleStartDate: form.cycleStartDate,
      cycleEndDate: form.cycleEndDate,
      visibility: form.visibility,
      payslipData,
    }

    const result = await mutateAsync(input)
    if (!result.success) {
      setError(result.error || 'Failed to create payslip.')
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl mx-4">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Create Payslip</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Employee *</label>
            <select
              name="employeeId"
              value={form.employeeId}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="">Select employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Payroll Period ID
            </label>
            <input
              type="text"
              name="payrollPeriodId"
              value={form.payrollPeriodId}
              onChange={handleChange}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cycle Start *</label>
              <input
                type="date"
                name="cycleStartDate"
                value={form.cycleStartDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cycle End *</label>
              <input
                type="date"
                name="cycleEndDate"
                value={form.cycleEndDate}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cycle #</label>
            <input
              type="number"
              name="cycle"
              value={form.cycle}
              onChange={handleChange}
              min={1}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Basic Pay</label>
              <input
                type="number"
                name="basicPay"
                value={form.basicPay}
                onChange={handleChange}
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Allowances</label>
              <input
                type="number"
                name="allowances"
                value={form.allowances}
                onChange={handleChange}
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Gross Pay</label>
              <input
                type="number"
                name="grossPay"
                value={form.grossPay}
                onChange={handleChange}
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Deductions</label>
              <input
                type="number"
                name="deductions"
                value={form.deductions}
                onChange={handleChange}
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Net Pay</label>
            <input
              type="number"
              name="netPay"
              value={form.netPay}
              onChange={handleChange}
              step="0.01"
              placeholder="0.00"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="visibility"
              name="visibility"
              checked={form.visibility}
              onChange={handleChange}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <label htmlFor="visibility" className="text-sm text-gray-700">
              Visible to employee
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 size={14} className="animate-spin" />}
              Create Payslip
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
