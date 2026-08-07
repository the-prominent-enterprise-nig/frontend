'use server'

import { customersApi } from '@/src/libs/api/crm'
import type { Customer } from '@/src/schema/crm/types'
import type { ApiResponse } from '@/src/libs/api/client'

export async function searchApplicantCustomers(q: string): Promise<ApiResponse<Customer[]>> {
  const result = await customersApi.list({ search: q, limit: 10 })
  if (!result.success) return { success: false, error: result.error || 'Search failed' }
  return { success: true, data: result.data?.data ?? [] }
}

export async function getApplicantCustomer(id: string): Promise<ApiResponse<Customer>> {
  return customersApi.get(id)
}
