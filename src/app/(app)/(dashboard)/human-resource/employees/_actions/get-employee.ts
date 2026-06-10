'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { Employee } from '@/src/schema/human-resource/employees/list'

/**
 * Get a single employee by ID
 */
export async function getEmployee(id: string): Promise<ApiResponse<Employee>> {
  try {
    const result = await api.get<Employee>(`/employees/${id}`)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch employee',
        message: result.message,
      }
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    console.error('Error fetching employee:', error)
    return {
      success: false,
      error: 'Failed to fetch employee',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
