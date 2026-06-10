'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { Employee, EmployeeSchema } from '@/src/schema/human-resource/employees/list'

/**
 * Get a single employee by ID
 */
export async function getEmployeeById(employeeId: string): Promise<ApiResponse<Employee>> {
  try {
    const result = await api.get<Employee>(`/employees/${employeeId}`)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch employee',
        message: result.message,
      }
    }

    // Validate response structure
    const validated = EmployeeSchema.parse(result.data)

    return {
      success: true,
      data: validated,
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
