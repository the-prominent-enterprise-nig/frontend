'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export interface UpdateUserPayload {
  firstName?: string
  lastName?: string
  middleName?: string
  contactNumber?: string
  dateOfBirth?: string
  maritalStatus?: string
  hireDate?: string
  branchId?: string
}

export async function updateUser(userId: string, payload: UpdateUserPayload): Promise<ApiResponse> {
  try {
    const response = await api.patch(`/users/${userId}`, payload)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to update user',
        message: response.message,
      }
    }

    revalidatePath('/settings/users')
    return { success: true }
  } catch (error) {
    console.error('Error updating user:', error)
    return {
      success: false,
      error: 'Failed to update user',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
