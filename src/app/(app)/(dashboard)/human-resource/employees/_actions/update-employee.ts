'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { UpdateEmployeeSchema } from '@/src/schema/human-resource/employees/update'
import z from 'zod'

/**
 * Update an existing employee
 */
export async function updateEmployee(
  id: string,
  data: z.infer<typeof UpdateEmployeeSchema>
): Promise<ApiResponse> {
  try {
    const result = await api.patch(`/employees/${id}`, data)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update employee',
        message: result.message,
      }
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    console.error('Error updating employee:', error)
    return {
      success: false,
      error: 'Failed to update employee',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
