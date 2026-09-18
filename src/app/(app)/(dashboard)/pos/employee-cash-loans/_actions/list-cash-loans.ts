'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeCashLoanListResponse } from '@/src/schema/pos/employee-cash-loans'

export async function listEmployeeCashLoans(params: { search?: string; status?: string } = {}) {
  return api.get<EmployeeCashLoanListResponse>('/pos/employee-cash-loans', params)
}
