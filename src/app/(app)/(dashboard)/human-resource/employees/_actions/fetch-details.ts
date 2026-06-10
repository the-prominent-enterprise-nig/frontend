'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  EmployeeDetailDto,
  EmployeeDetailSchema,
} from '@/src/schema/human-resource/employees/details'

export async function getEmployeeById(id: string): Promise<ApiResponse<EmployeeDetailDto>> {
  try {
    const result = await api.get<EmployeeDetailDto>(`/employees/${id}`, undefined, {
      tags: [`employee-${id}`, 'employees'],
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch employee',
        message: result.message,
      }
    }

    const validated = EmployeeDetailSchema.parse(result.data)

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
