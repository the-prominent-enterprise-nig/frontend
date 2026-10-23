'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeCashLoanEmployee } from '@/src/schema/accounting/employee-cash-loans'

export async function searchEmployeesForCashLoan(search: string) {
  return api.get<EmployeeCashLoanEmployee[]>('/accounting/employee-cash-loans/employees', {
    search,
    limit: 20,
  })
}
