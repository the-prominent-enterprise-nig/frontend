'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeCashLoan } from '@/src/schema/pos/employee-cash-loans'

export async function getEmployeeCashLoan(id: string) {
  return api.get<EmployeeCashLoan>(`/pos/employee-cash-loans/${id}`)
}
