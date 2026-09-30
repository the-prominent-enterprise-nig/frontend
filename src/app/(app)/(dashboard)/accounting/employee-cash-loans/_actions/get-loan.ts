'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeCashLoan } from '@/src/schema/accounting/employee-cash-loans'

export async function getEmployeeCashLoan(id: string) {
  return api.get<EmployeeCashLoan>(`/accounting/employee-cash-loans/${id}`)
}
