'use client'

import { EmployeeDetailDto } from '@/src/schema/human-resource/employees/details'

interface Props {
  employee: EmployeeDetailDto
  className?: string
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">
        {value ?? <span className="text-gray-400 font-normal">—</span>}
      </p>
    </div>
  )
}

function formatCurrency(value?: number | null) {
  if (value == null) return undefined
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatPayoutCycle(cycle?: string | null) {
  if (!cycle) return undefined
  const map: Record<string, string> = {
    FirstCycle: '1st cycle (1st–15th)',
    SecondCycle: '2nd cycle (16th–end)',
    Both: 'Both cycles',
  }
  return map[cycle] ?? cycle
}

export function PayrollSetupSection({ employee, className }: Props) {
  return (
    <div className={`flex flex-col ${className ?? ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
          Payroll setup
        </h3>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        <div className="bg-white rounded-lg border border-gray-200 px-4 flex flex-col">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider pt-4 pb-2">
            Allowance
          </p>
          <div className="flex-1">
            <Field label="Allowance amount" value={formatCurrency(employee.allowance)} />
            <Field label="Payout cycle" value={formatPayoutCycle(employee.allowancePayoutCycle)} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 px-4 flex flex-col">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider pt-4 pb-2">
            Deductions
          </p>
          <div className="flex-1">
            <Field label="Loan balance" value={formatCurrency(employee.loan)} />
            <Field label="Loan deduction / cutoff" value={formatCurrency(employee.loanDeduction)} />
            <Field label="SILC" value={formatCurrency(employee.silc)} />
          </div>
        </div>
      </div>
    </div>
  )
}
