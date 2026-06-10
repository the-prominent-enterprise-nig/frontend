'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  EmployeeListResponse,
  EmployeeListResponseSchema,
} from '@/src/schema/human-resource/employees/list'

/**
 * Get employees list with pagination, search, and filters
 */
export async function getEmployees(params?: {
  page?: number
  limit?: number
  search?: string
  status?: string
  departmentId?: string
  branchId?: string
}): Promise<ApiResponse<EmployeeListResponse>> {
  try {
    const tags = [
      'employees',
      params?.search ? `employees-search-${params.search}` : 'employees-search',
      params?.status ? `employees-status-${params.status}` : 'employees-status',
      params?.departmentId ? `employees-department-${params.departmentId}` : 'employees-department',
      params?.branchId ? `employees-branch-${params.branchId}` : 'employees-branch',
    ]

    const result = await api.get<EmployeeListResponse>('/employees', params, { tags })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch employees',
        message: result.message,
      }
    }

    // Validate response structure — use safeParse so a schema mismatch
    // logs details instead of silently returning empty to the caller.
    const parseResult = EmployeeListResponseSchema.safeParse(result.data)
    if (!parseResult.success) {
      console.error(
        '[getEmployees] Schema validation failed:',
        JSON.stringify(parseResult.error.issues, null, 2)
      )
      // Backend already validates via class-validator; fall back to raw data
      // so a schema drift doesn't silently empty the payroll/HR tables.
      return { success: true, data: result.data as EmployeeListResponse }
    }

    return {
      success: true,
      data: parseResult.data,
    }
  } catch (error) {
    console.error('Error fetching employees:', error)
    return {
      success: false,
      error: 'Failed to fetch employees',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
