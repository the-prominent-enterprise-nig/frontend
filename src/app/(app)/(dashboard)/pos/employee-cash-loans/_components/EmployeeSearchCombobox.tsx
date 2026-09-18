'use client'

import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { searchEmployeesForCashLoan } from '../_actions/search-employees'
import type { EmployeeCashLoanEmployee } from '@/src/schema/pos/employee-cash-loans'

function fullName(e: EmployeeCashLoanEmployee): string {
  return [e.firstName, e.lastName].filter(Boolean).join(' ')
}

type Props = {
  value: string
  onChange: (employeeId: string) => void
  onSelectEmployee?: (employee: EmployeeCashLoanEmployee) => void
  error?: string
}

export default function EmployeeSearchCombobox({
  value,
  onChange,
  onSelectEmployee,
  error,
}: Props) {
  async function search(query: string): Promise<SearchComboboxOption[]> {
    const res = await searchEmployeesForCashLoan(query)
    if (!res.success || !res.data) return []
    return res.data.map((e) => ({
      id: e.id,
      primary: fullName(e),
      secondary: [e.employeeCode, e.branch?.name].filter(Boolean).join(' · '),
      meta: e,
    }))
  }

  return (
    <SearchCombobox
      value={value}
      onChange={onChange}
      onSelect={(option) => onSelectEmployee?.(option.meta as EmployeeCashLoanEmployee)}
      queryKey="pos-employee-cash-loan-employees"
      search={search}
      placeholder="Search employee by name or code…"
      emptyMessage="No employees found"
      error={error}
    />
  )
}
