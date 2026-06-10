'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { createUserSchema } from '@/src/schema/settings/create-user'

interface CreateUserResponse {
  id: string
  email: string
}

/**
 * Create a new user
 */
export async function createUser(input: unknown): Promise<ApiResponse<CreateUserResponse>> {
  try {
    // Validate input data
    const result = createUserSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        message: result.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    // Call API to create user
    const { employeeId, ...userData } = result.data
    const payload = employeeId ? { ...userData, employeeId } : userData
    const response = await api.post<CreateUserResponse>('/users', payload)

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create user',
        message: response.message,
      }
    }

    // Revalidate users and employee masterlist caches. User creation now
    // creates/links an Employee profile server-side.
    revalidatePath('/settings/users')
    revalidatePath('/human-resource/employees')
    revalidateTag('users', 'max')
    revalidateTag('employees', 'max')

    return {
      success: true,
      data: response.data,
      message: 'User created successfully',
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return {
      success: false,
      error: 'Failed to create user',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
