'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useUpdatePayslip } from '../_hooks/usePayslips'
import type { Payslip, UpdatePayslipInput } from '@/src/schema/human-resource/payslips'

interface Props {
  payslip: Payslip
  onClose: () => void
  onSuccess: () => void
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

function n(val: unknown): string {
  if (val === undefined || val === null || val === '') return ''
  return String(val)
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1 border-b border-gray-100">
      {children}
    </p>
  )
}

function formatSpecialHourKey(key: string): string {
  const isHoliday = key.startsWith('holiday_')
  const datePart = key.replace(/^(holiday|weekend)_/, '').replace(/_hours$/, '')
  const label = new Date(datePart + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${isHoliday ? 'Holiday' : 'Weekend'} — ${label}`
}

export default function EditPayslipModal({ payslip, onClose, onSuccess }: Props) {
  const raw = payslip.payslipData as Record<string, unknown>
  const isGenerated = 'totalIncome' in raw || 'incomeTaxDeduction' in raw

  const specialHours = Object.entries(raw).filter(
    ([key]) => key.startsWith('holiday_') || key.startsWith('weekend_')
  )

  const [form, setForm] = useState({
    // Common
    cycle: payslip.cycle,
    cycleStartDate: payslip.cycleStartDate.slice(0, 10),
    cycleEndDate: payslip.cycleEndDate.slice(0, 10),
    visibility: payslip.visibility,
    notes: n(raw.notes),
    netPay: n(raw.netPay),

    // Generated payslip fields
    numberOfDays: n(raw.numberOfDays),
    actualNumberOfDays: n(raw.actualNumberOfDays),
    dailyRate: n(raw.dailyRate),
    grossPay: n(raw.grossPay),
    total: n(raw.total),
    allowance: n(raw.allowance),
    specialIncentives: n(raw.specialIncentives),
    reconciliationPay: n(raw.reconciliationPay),
    thirteenthMonthPay: n(raw.thirteenthMonthPay),
    totalIncome: n(raw.totalIncome),
    incomeTaxDeduction: n(raw.incomeTaxDeduction),
    sss: n(raw.sss),
    philHealth: n(raw.philHealth),
    pagIbig: n(raw.pagIbig),
    loan: n(raw.loan),
    totalDeduction: n(raw.totalDeduction),
    loanBalance: n(raw.loanBalance),

    // Manual payslip fields
    basicPay: n(raw.basicPay),
    allowances: n(raw.allowances),
    deductions: n(raw.deductions),
  })

  const [error, setError] = useState('')
  const { mutateAsync, isPending } = useUpdatePayslip()

  function set(name: string, value: string | number | boolean) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    set(name, type === 'checkbox' ? (e.target as HTMLInputElement).checked : value)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const payslipData: Record<string, unknown> = { ...raw }

    if (isGenerated) {
      if (form.numberOfDays !== '') payslipData.numberOfDays = parseFloat(form.numberOfDays)
      if (form.actualNumberOfDays !== '')
        payslipData.actualNumberOfDays = parseFloat(form.actualNumberOfDays)
      if (form.dailyRate !== '') payslipData.dailyRate = parseFloat(form.dailyRate)
      if (form.grossPay !== '') payslipData.grossPay = parseFloat(form.grossPay)
      if (form.total !== '') payslipData.total = parseFloat(form.total)
      if (form.allowance !== '') payslipData.allowance = parseFloat(form.allowance)
      if (form.specialIncentives !== '')
        payslipData.specialIncentives = parseFloat(form.specialIncentives)
      if (form.reconciliationPay !== '')
        payslipData.reconciliationPay = parseFloat(form.reconciliationPay)
      if (form.thirteenthMonthPay !== '')
        payslipData.thirteenthMonthPay = parseFloat(form.thirteenthMonthPay)
      if (form.totalIncome !== '') payslipData.totalIncome = parseFloat(form.totalIncome)
      if (form.incomeTaxDeduction !== '')
        payslipData.incomeTaxDeduction = parseFloat(form.incomeTaxDeduction)
      if (form.sss !== '') payslipData.sss = parseFloat(form.sss)
      if (form.philHealth !== '') payslipData.philHealth = parseFloat(form.philHealth)
      if (form.pagIbig !== '') payslipData.pagIbig = parseFloat(form.pagIbig)
      if (form.loan !== '') payslipData.loan = parseFloat(form.loan)
      if (form.totalDeduction !== '') payslipData.totalDeduction = parseFloat(form.totalDeduction)
      if (form.loanBalance !== '') payslipData.loanBalance = parseFloat(form.loanBalance)
    } else {
      if (form.basicPay !== '') payslipData.basicPay = parseFloat(form.basicPay)
      if (form.allowances !== '') payslipData.allowances = parseFloat(form.allowances)
      if (form.grossPay !== '') payslipData.grossPay = parseFloat(form.grossPay)
      if (form.deductions !== '') payslipData.deductions = parseFloat(form.deductions)
    }

    if (form.netPay !== '') payslipData.netPay = parseFloat(form.netPay)
    payslipData.notes = form.notes

    const input: UpdatePayslipInput = {
      cycle: form.cycle,
      cycleStartDate: form.cycleStartDate,
      cycleEndDate: form.cycleEndDate,
      visibility: form.visibility,
      payslipData,
    }

    const result = await mutateAsync({ id: payslip.id, data: input })
    if (!result.success) {
      setError(result.error || 'Failed to update payslip.')
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit Payslip</h2>
            {payslip.employee && (
              <p className="text-xs text-gray-400 mt-0.5">
                {payslip.employee.firstName} {payslip.employee.lastName} &middot;{' '}
                {payslip.employee.employeeCode}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            {/* Period & Cycle */}
            <SectionLabel>Period & Cycle</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cycle Start</label>
                <input
                  type="date"
                  name="cycleStartDate"
                  value={form.cycleStartDate}
                  onChange={handleInput}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cycle End</label>
                <input
                  type="date"
                  name="cycleEndDate"
                  value={form.cycleEndDate}
                  onChange={handleInput}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cycle #</label>
              <input
                type="number"
                name="cycle"
                value={form.cycle}
                onChange={handleInput}
                min={1}
                className={inputCls}
              />
            </div>

            {/* Earnings */}
            <SectionLabel>Earnings</SectionLabel>
            {isGenerated ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Days Present
                    </label>
                    <input
                      type="number"
                      name="numberOfDays"
                      value={form.numberOfDays}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Actual Days
                    </label>
                    <input
                      type="number"
                      name="actualNumberOfDays"
                      value={form.actualNumberOfDays}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Daily Rate
                    </label>
                    <input
                      type="number"
                      name="dailyRate"
                      value={form.dailyRate}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Gross Pay
                    </label>
                    <input
                      type="number"
                      name="grossPay"
                      value={form.grossPay}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Total Amount
                    </label>
                    <input
                      type="number"
                      name="total"
                      value={form.total}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Allowance
                    </label>
                    <input
                      type="number"
                      name="allowance"
                      value={form.allowance}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Special Incentives
                    </label>
                    <input
                      type="number"
                      name="specialIncentives"
                      value={form.specialIncentives}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Reconciliation Pay
                    </label>
                    <input
                      type="number"
                      name="reconciliationPay"
                      value={form.reconciliationPay}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      13th Month Pay
                    </label>
                    <input
                      type="number"
                      name="thirteenthMonthPay"
                      value={form.thirteenthMonthPay}
                      onChange={handleInput}
                      step="0.01"
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Total Income
                  </label>
                  <input
                    type="number"
                    name="totalIncome"
                    value={form.totalIncome}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                {specialHours.length > 0 && (
                  <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Special Hours (read-only)
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {specialHours.map(([key, val]) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-gray-500">{formatSpecialHourKey(key)}</span>
                          <span className="font-medium text-gray-700">{String(val)} hrs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Basic Pay</label>
                  <input
                    type="number"
                    name="basicPay"
                    value={form.basicPay}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Allowances</label>
                  <input
                    type="number"
                    name="allowances"
                    value={form.allowances}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Gross Pay</label>
                  <input
                    type="number"
                    name="grossPay"
                    value={form.grossPay}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            {/* Deductions */}
            <SectionLabel>Deductions</SectionLabel>
            {isGenerated ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Withholding Tax
                  </label>
                  <input
                    type="number"
                    name="incomeTaxDeduction"
                    value={form.incomeTaxDeduction}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">SSS</label>
                  <input
                    type="number"
                    name="sss"
                    value={form.sss}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">PhilHealth</label>
                  <input
                    type="number"
                    name="philHealth"
                    value={form.philHealth}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pag-IBIG</label>
                  <input
                    type="number"
                    name="pagIbig"
                    value={form.pagIbig}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Loan Deduction
                  </label>
                  <input
                    type="number"
                    name="loan"
                    value={form.loan}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Total Deductions
                  </label>
                  <input
                    type="number"
                    name="totalDeduction"
                    value={form.totalDeduction}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Total Deductions
                </label>
                <input
                  type="number"
                  name="deductions"
                  value={form.deductions}
                  onChange={handleInput}
                  step="0.01"
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
            )}

            {/* Net Pay & Loan Balance */}
            <SectionLabel>Summary</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Net Pay</label>
                <input
                  type="number"
                  name="netPay"
                  value={form.netPay}
                  onChange={handleInput}
                  step="0.01"
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
              {isGenerated && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Loan Balance
                  </label>
                  <input
                    type="number"
                    name="loanBalance"
                    value={form.loanBalance}
                    onChange={handleInput}
                    step="0.01"
                    placeholder="0.00"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleInput}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>

            {/* Visibility */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-visibility"
                name="visibility"
                checked={form.visibility}
                onChange={handleInput}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="edit-visibility" className="text-sm text-gray-700">
                Visible to employee
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
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
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
