'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeCashLoanListResponse } from '@/src/schema/accounting/employee-cash-loans'

export async function listEmployeeCashLoans(params: { search?: string; status?: string } = {}) {
  return api.get<EmployeeCashLoanListResponse>('/accounting/employee-cash-loans', params)
}
