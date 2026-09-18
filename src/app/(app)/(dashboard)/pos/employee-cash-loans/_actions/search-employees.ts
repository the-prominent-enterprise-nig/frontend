'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeCashLoanEmployee } from '@/src/schema/pos/employee-cash-loans'

export async function searchEmployeesForCashLoan(search: string) {
  return api.get<EmployeeCashLoanEmployee[]>('/pos/employee-cash-loans/employees', {
    search,
    limit: 20,
  })
}
