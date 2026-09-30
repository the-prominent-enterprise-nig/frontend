'use server'

import { api } from '@/src/libs/api/client'
import type { EmployeeListResponse } from '@/src/schema/accounting/employees'

export async function listEmployees(
  params: { search?: string; status?: string; branchId?: string; page?: number } = {}
) {
  return api.get<EmployeeListResponse>('/accounting/employees', params)
}
