'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

/**
 * Reactivate a soft-deleted role — POST /roles/:id/reactivate sets
 * isActive: true server-side (roles.service.ts). The exact inverse of
 * deleteRole: since soft-delete never touches permissions or user
 * assignments, this restores the role to exactly what it was before
 * deletion, nothing else to reconcile.
 */
export async function reactivateRole(id: string): Promise<ApiResponse> {
  try {
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to reactivate roles',
      }
    }

    if (!can(session, 'admin:roles:update') && !can(session, 'admin:roles:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to reactivate roles. Required: admin:roles:update',
      }
    }

    const response = await api.post(`/roles/${id}/reactivate`)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to reactivate role',
        message: response.message,
      }
    }

    revalidatePath('/settings/roles')

    return { success: true, message: 'Role reactivated' }
  } catch (error) {
    console.error('Error reactivating role:', error)
    return {
      success: false,
      error: 'Failed to reactivate role',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
