'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateEmployeeSchema } from '@/src/schema/human-resource/employees/create'
import z from 'zod'

/**
 * Create a new employee
 */
export async function createEmployee(
  data: z.infer<typeof CreateEmployeeSchema>
): Promise<ApiResponse> {
  try {
    const result = await api.post('/employees', data)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create employee',
        message: result.message,
      }
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    console.error('Error creating employee:', error)
    return {
      success: false,
      error: 'Failed to create employee',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
